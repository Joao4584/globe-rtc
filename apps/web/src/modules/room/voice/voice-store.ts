import { create } from "zustand";
import type { Track } from "livekit-client";

export type VoiceVideo = {
  key: string;
  identity: string;
  name: string;
  source: "camera" | "screen";
  local: boolean;
  track: Track;
};

export type VoiceStatus = "idle" | "connecting" | "connected" | "error";

type VoiceState = {
  status: VoiceStatus;
  /** "mic" = microphone blocked/missing (can still listen); "connect" = could not reach the voice server. */
  error: "mic" | "connect" | null;
  muted: boolean;
  deafened: boolean;
  cameraOn: boolean;
  screenOn: boolean;
  /** People in the conversation (not including you). */
  participants: { identity: string; name: string }[];
  speaking: string[];
  videos: VoiceVideo[];
};

export const useVoiceStore = create<VoiceState>(() => ({
  status: "idle",
  error: null,
  muted: false,
  deafened: false,
  cameraOn: false,
  screenOn: false,
  participants: [],
  speaking: [],
  videos: [],
}));

export const setVoiceState = (patch: Partial<VoiceState>) => useVoiceStore.setState(patch);
