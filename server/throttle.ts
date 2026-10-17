// The per-IP throttle on signing up and logging in: at most 20 tries from
// one address in 15 minutes, counted in this process's memory (ADR 0003).
// Behind a proxy every caller shares the proxy's address; trusting a
// forwarded address waits for a deployment.

import { HttpError } from "./http";

const TRIES = 20;
const WINDOW_MS = 15 * 60 * 1000;

/** Each address's tries in its current window. */
const tries = new Map<string, { count: number; endsAt: number }>();

export function throttle(address: string): void {
  const now = Date.now();
  if (tries.size > 10_000) {
    for (const [key, entry] of tries) if (entry.endsAt <= now) tries.delete(key);
  }
  const entry = tries.get(address);
  if (!entry || entry.endsAt <= now) {
    tries.set(address, { count: 1, endsAt: now + WINDOW_MS });
  } else if (++entry.count > TRIES) {
    throw new HttpError(429, "Too many tries from this address. Wait a few minutes, then try again.");
  }
}
