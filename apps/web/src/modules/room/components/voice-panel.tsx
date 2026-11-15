"use client";

import { useEffect, useRef } from "react";
import { Headphones, HeadphoneOff, Mic, MicOff, MonitorOff, MonitorUp, Video, VideoOff } from "lucide-react";
import { useI18n } from "@/locales/client";
import { cn } from "@/modules/shared/utils";
import { voice } from "../voice/voice-client";
import { useVoiceStore, type VoiceVideo } from "../voice/voice-store";

function VideoTile({ video }: { video: VoiceVideo }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    video.track.attach(el);
    return () => {
      video.track.detach(el);
    };
  }, [video.track]);
  return (
    <div className="pointer-events-auto overflow-hidden rounded-lg border border-sky-200/80 bg-black/80 shadow-xl dark:border-slate-700">
      <video ref={ref} autoPlay playsInline muted className={cn("block w-56 bg-black", video.source === "screen" ? "object-contain" : "object-cover", video.local && video.source === "camera" && "-scale-x-100")} />
      <div className="truncate bg-black/60 px-2 py-0.5 text-[11px] text-white">{video.local ? "" : video.name}</div>
    </div>
  );
}

function ControlButton({ active, danger, disabled, label, onClick, children }: { active?: boolean; danger?: boolean; disabled?: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        danger ? "border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/20 dark:text-rose-200" : "border-sky-200 bg-white/90 text-slate-700 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
        active && !danger && "border-emerald-400 bg-emerald-100 text-emerald-700 dark:border-emerald-500/60 dark:bg-emerald-500/20 dark:text-emerald-200",
      )}
    >
      {children}
    </button>
  );
}

// Proximity voice controls (Discord-like): connection state, who is in the conversation, mute / deafen / camera /
// screen. The connection itself is driven by the game (walk near somebody = join, walk away = leave).
export function VoicePanel({ roomPublicId }: { roomPublicId: string }) {
  const t = useI18n();
  const { status, error, muted, deafened, cameraOn, screenOn, participants, speaking, videos } = useVoiceStore();

  useEffect(() => {
    voice.init(roomPublicId);
    return () => voice.dispose();
  }, [roomPublicId]);

  const connected = status === "connected";
  const statusLabel = error === "connect" ? t("room.voice.connectError") : status === "connecting" ? t("room.voice.connecting") : connected ? t("room.voice.connected") : t("room.voice.idle");

  return (
    <>
      {videos.length > 0 ? <div className="pointer-events-none absolute right-4 top-16 z-50 flex max-h-[70vh] flex-col gap-2 overflow-y-auto mobile:right-2 mobile:top-14">{videos.map((video) => <VideoTile key={video.key} video={video} />)}</div> : null}
      <div className="pointer-events-auto absolute bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-1.5 rounded-xl border border-sky-200/80 bg-white/88 px-3 py-2 shadow-xl backdrop-blur-sm mobile:bottom-24 dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex items-center gap-2 text-xs">
          <span className={cn("h-2 w-2 rounded-full", connected ? "bg-emerald-500" : status === "connecting" ? "bg-amber-400" : error ? "bg-rose-500" : "bg-slate-400")} />
          <span className="font-semibold text-slate-700 dark:text-slate-100">{statusLabel}</span>
          {error === "mic" ? <span className="text-rose-600 dark:text-rose-300">{t("room.voice.micDenied")}</span> : null}
        </div>
        {participants.length > 0 ? (
          <div className="flex max-w-[70vw] flex-wrap justify-center gap-1">
            {participants.map((participant) => (
              <span
                key={participant.identity}
                className={cn("rounded border px-1.5 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-100", speaking.includes(participant.identity) ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-500/20" : "border-sky-200 bg-sky-50 dark:border-slate-700 dark:bg-slate-800")}
              >
                {participant.name}
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex items-center gap-1.5">
          <ControlButton danger={muted} label={muted ? t("room.voice.unmute") : t("room.voice.mute")} onClick={() => void voice.setMuted(!muted)}>
            {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </ControlButton>
          <ControlButton danger={deafened} label={deafened ? t("room.voice.undeafen") : t("room.voice.deafen")} onClick={() => void voice.setDeafened(!deafened)}>
            {deafened ? <HeadphoneOff className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
          </ControlButton>
          <ControlButton active={cameraOn} disabled={!connected} label={cameraOn ? t("room.voice.cameraOff") : t("room.voice.cameraOn")} onClick={() => void voice.toggleCamera()}>
            {cameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </ControlButton>
          <ControlButton active={screenOn} disabled={!connected} label={screenOn ? t("room.voice.screenOff") : t("room.voice.screenOn")} onClick={() => void voice.toggleScreen()}>
            {screenOn ? <MonitorOff className="h-4 w-4" /> : <MonitorUp className="h-4 w-4" />}
          </ControlButton>
        </div>
        {!connected && status !== "connecting" ? <span className="text-[11px] text-slate-500 dark:text-slate-400">{t("room.voice.hint")}</span> : null}
      </div>
    </>
  );
}
