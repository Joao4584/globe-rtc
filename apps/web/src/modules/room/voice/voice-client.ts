import {
  ConnectionState,
  LocalTrackPublication,
  RemoteParticipant,
  RemoteTrack,
  Room,
  RoomEvent,
  Track,
} from "livekit-client";
import { api } from "@/modules/shared/http/api-client";
import { setVoiceState, useVoiceStore, type VoiceVideo } from "./voice-store";

// Seconds-ish to wait after the last nearby player leaves before dropping the connection (avoids flapping at the edge).
const LEAVE_DELAY_MS = 3000;

/**
 * Proximity voice/video on top of LiveKit. The game tells us who is near (`setNearby`); we connect while somebody is
 * near, hear/see only them (manual subscriptions) and disconnect shortly after everybody left.
 */
class VoiceClient {
  private roomPublicId?: string;
  private lk?: Room;
  private connecting = false;
  private nearby = new Map<string, number>(); // identity -> volume (0..1)
  private leaveTimer?: number;
  private audio = new Map<string, Map<string, HTMLMediaElement>>(); // identity -> track sid -> element
  private mutedBeforeDeafen = false;

  init(roomPublicId: string) {
    this.roomPublicId = roomPublicId;
  }

  dispose() {
    this.nearby = new Map();
    this.roomPublicId = undefined;
    window.clearTimeout(this.leaveTimer);
    this.leaveTimer = undefined;
    void this.disconnect();
  }

  /** identity -> volume for everybody inside the voice radius. */
  setNearby(entries: Map<string, number>) {
    this.nearby = entries;
    if (entries.size > 0) {
      window.clearTimeout(this.leaveTimer);
      this.leaveTimer = undefined;
      if (!this.lk && !this.connecting) void this.connect();
    } else if (this.lk && this.leaveTimer === undefined) {
      this.leaveTimer = window.setTimeout(() => {
        this.leaveTimer = undefined;
        if (this.nearby.size === 0) void this.disconnect();
      }, LEAVE_DELAY_MS);
    }
    this.applySubscriptions();
  }

  async setMuted(muted: boolean) {
    setVoiceState({ muted, ...(muted ? {} : { deafened: false }) });
    this.applyDeafen();
    await this.applyMic();
  }

  async setDeafened(deafened: boolean) {
    if (deafened) {
      this.mutedBeforeDeafen = useVoiceStore.getState().muted;
      setVoiceState({ deafened: true, muted: true });
    } else {
      setVoiceState({ deafened: false, muted: this.mutedBeforeDeafen });
    }
    this.applyDeafen();
    await this.applyMic();
  }

  async toggleCamera() {
    if (!this.lk) return;
    try {
      await this.lk.localParticipant.setCameraEnabled(!this.lk.localParticipant.isCameraEnabled);
    } catch {
      // Permission denied or no camera: nothing to show.
    }
    setVoiceState({ cameraOn: this.lk.localParticipant.isCameraEnabled });
  }

  async toggleScreen() {
    if (!this.lk) return;
    try {
      await this.lk.localParticipant.setScreenShareEnabled(!this.lk.localParticipant.isScreenShareEnabled);
    } catch {
      // The user closed the picker.
    }
    setVoiceState({ screenOn: this.lk.localParticipant.isScreenShareEnabled });
  }

  private async connect() {
    if (!this.roomPublicId || this.connecting || this.lk) return;
    this.connecting = true;
    setVoiceState({ status: "connecting", error: null });
    try {
      const { token, url } = await api.post(`room/${this.roomPublicId}/voice-token`).json<{ token: string; url: string }>();
      const lk = new Room({ adaptiveStream: true, dynacast: true });
      this.bind(lk);
      await lk.connect(url, token, { autoSubscribe: false });
      this.lk = lk;
      setVoiceState({ status: "connected" });
      void lk.startAudio().catch(() => undefined);
      this.refreshParticipants();
      this.applySubscriptions();
      await this.applyMic();
      // Everybody walked away while we were connecting.
      if (this.nearby.size === 0) this.setNearby(this.nearby);
    } catch {
      this.lk?.disconnect();
      this.lk = undefined;
      setVoiceState({ status: "error", error: "connect" });
    } finally {
      this.connecting = false;
    }
  }

  private async disconnect() {
    const lk = this.lk;
    this.lk = undefined;
    window.clearTimeout(this.leaveTimer);
    this.leaveTimer = undefined;
    this.audio.forEach((byTrack) => byTrack.forEach((el) => el.remove()));
    this.audio.clear();
    setVoiceState({ status: "idle", error: null, participants: [], speaking: [], videos: [], cameraOn: false, screenOn: false });
    if (lk) await lk.disconnect();
  }

  private bind(lk: Room) {
    lk.on(RoomEvent.ParticipantConnected, () => this.refreshParticipants());
    lk.on(RoomEvent.ParticipantDisconnected, (participant) => {
      this.dropAudio(participant.identity);
      setVoiceState({ videos: useVoiceStore.getState().videos.filter((video) => video.identity !== participant.identity) });
      this.refreshParticipants();
    });
    lk.on(RoomEvent.TrackPublished, (_pub, participant) => this.applyParticipant(participant));
    lk.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => this.onSubscribed(track, participant));
    lk.on(RoomEvent.TrackUnsubscribed, (track, _pub, participant) => this.onUnsubscribed(track, participant));
    lk.on(RoomEvent.ActiveSpeakersChanged, (speakers) => setVoiceState({ speaking: speakers.map((speaker) => speaker.identity) }));
    lk.on(RoomEvent.LocalTrackPublished, (pub) => this.onLocalPublished(pub));
    lk.on(RoomEvent.LocalTrackUnpublished, (pub) => this.onLocalUnpublished(pub));
    lk.on(RoomEvent.Disconnected, () => {
      if (this.lk === lk) {
        this.lk = undefined;
        void this.disconnect();
      }
    });
  }

  private refreshParticipants() {
    const lk = this.lk;
    if (!lk) return;
    setVoiceState({
      participants: Array.from(lk.remoteParticipants.values()).map((participant) => ({
        identity: participant.identity,
        name: participant.name || "Player",
      })),
    });
  }

  private applySubscriptions() {
    this.lk?.remoteParticipants.forEach((participant) => this.applyParticipant(participant));
  }

  // Subscribe to the tracks of people inside the radius, unsubscribe from everybody else.
  private applyParticipant(participant: RemoteParticipant) {
    const volume = this.nearby.get(participant.identity);
    participant.trackPublications.forEach((pub) => {
      const wanted = volume !== undefined;
      if (pub.isSubscribed !== wanted) pub.setSubscribed(wanted);
    });
    const { deafened } = useVoiceStore.getState();
    this.audio.get(participant.identity)?.forEach((el) => {
      el.volume = volume ?? 0;
      el.muted = deafened;
    });
  }

  private onSubscribed(track: RemoteTrack, participant: RemoteParticipant) {
    if (track.kind === Track.Kind.Audio) {
      const el = track.attach();
      el.muted = useVoiceStore.getState().deafened;
      el.volume = this.nearby.get(participant.identity) ?? 0;
      document.body.appendChild(el);
      const byTrack = this.audio.get(participant.identity) ?? new Map<string, HTMLMediaElement>();
      byTrack.set(track.sid ?? "", el);
      this.audio.set(participant.identity, byTrack);
      return;
    }
    if (track.kind === Track.Kind.Video) {
      const source = track.source === Track.Source.ScreenShare ? "screen" : "camera";
      this.addVideo({ key: `${participant.identity}:${track.sid}`, identity: participant.identity, name: participant.name || "Player", source, local: false, track });
    }
  }

  private onUnsubscribed(track: RemoteTrack, participant: RemoteParticipant) {
    track.detach();
    if (track.kind === Track.Kind.Audio) {
      const byTrack = this.audio.get(participant.identity);
      byTrack?.get(track.sid ?? "")?.remove();
      byTrack?.delete(track.sid ?? "");
      return;
    }
    this.removeVideo(`${participant.identity}:${track.sid}`);
  }

  private onLocalPublished(pub: LocalTrackPublication) {
    const track = pub.track;
    if (!track || track.kind !== Track.Kind.Video) return;
    const screen = pub.source === Track.Source.ScreenShare;
    this.addVideo({ key: `local:${pub.trackSid}`, identity: "local", name: "", source: screen ? "screen" : "camera", local: true, track });
    setVoiceState(screen ? { screenOn: true } : { cameraOn: true });
  }

  private onLocalUnpublished(pub: LocalTrackPublication) {
    if (pub.kind !== Track.Kind.Video) return;
    this.removeVideo(`local:${pub.trackSid}`);
    setVoiceState(pub.source === Track.Source.ScreenShare ? { screenOn: false } : { cameraOn: false });
  }

  private addVideo(video: VoiceVideo) {
    setVoiceState({ videos: [...useVoiceStore.getState().videos.filter((v) => v.key !== video.key), video] });
  }

  private removeVideo(key: string) {
    setVoiceState({ videos: useVoiceStore.getState().videos.filter((video) => video.key !== key) });
  }

  private dropAudio(identity: string) {
    this.audio.get(identity)?.forEach((el) => el.remove());
    this.audio.delete(identity);
  }

  private applyDeafen() {
    const { deafened } = useVoiceStore.getState();
    this.audio.forEach((byTrack) => byTrack.forEach((el) => (el.muted = deafened)));
  }

  // The microphone is only open while connected and not muted.
  private async applyMic() {
    const lk = this.lk;
    if (!lk || lk.state !== ConnectionState.Connected) return;
    try {
      await lk.localParticipant.setMicrophoneEnabled(!useVoiceStore.getState().muted);
      if (useVoiceStore.getState().error === "mic") setVoiceState({ error: null });
    } catch {
      setVoiceState({ error: "mic" });
    }
  }
}

export const voice = new VoiceClient();
