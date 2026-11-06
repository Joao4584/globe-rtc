import { randomInt } from "crypto";
import { SkinSeed } from "./types";

export type Rng = () => number;

/** Same seed, same sequence: lets the server hand the front a seed instead of the whole selection. */
export function createRng(seed: SkinSeed): Rng {
  let state = typeof seed === "number" ? seed >>> 0 : hashString(seed);
  return () => {
    // mulberry32
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newSeed(): number {
  return randomInt(0, 2 ** 32);
}

export function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

// FNV-1a
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
