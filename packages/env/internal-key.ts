import { createHmac } from "crypto";

/** Header the Next.js server uses to prove a request comes from our own servers. */
export const INTERNAL_KEY_HEADER = "x-internal-key";

/**
 * Derives the key for "internal-only" API routes from NEXTAUTH_SECRET.
 *
 * The Next.js server sends this derived key, never NEXTAUTH_SECRET itself. It is a one-way HMAC, so
 * even if the key leaks (logs, a proxy, a packet capture) nobody can recover NEXTAUTH_SECRET or forge
 * NextAuth sessions with it. This file has no side effects on purpose: it can be imported without
 * loading and validating the whole environment.
 */
export function deriveInternalApiKey(secret: string): string {
  return createHmac("sha256", secret).update("globe-rtc:internal-api:v1").digest("hex");
}
