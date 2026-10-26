// The page's one way to reach the server: the SDK on the page's own origin,
// with its session cookie (ADR 0004). `client` is the app's: a 401 means the
// session is over, so it goes to /login?next=<here> and the request never
// settles, so nothing draws the failure as the page leaves. `publicClient`
// is the public pages': a 401 there is an answer to show. Also what a failure
// says, whether it's worth a retry, and the `next` path the public pages carry.

import { ApiError, createClient } from "@asked-before/sdk";
import { CONNECTION_FAILURE } from "@/lib/copy";
import { clearSignedIn } from "@/lib/signed-in";

/** Log in, then come back to where the learner is now. */
export function toLogIn(): void {
  clearSignedIn();
  location.assign(`/login?next=${encodeURIComponent(location.pathname + location.search + location.hash)}`);
}

async function send(url: string, init: RequestInit): Promise<Response> {
  const response = await fetch(url, init);
  if (response.status !== 401) return response;
  toLogIn();
  return new Promise<Response>(() => {});
}

export const client = createClient({ fetch: send });

/** The app's client with every request aborted when `signal` is: for what a screen fetches on its own after it draws, which leaving the screen cancels. */
export const clientFor = (signal: AbortSignal) => createClient({ fetch: (url, init) => send(url, { ...init, signal }) });

export const publicClient = createClient();

/** What a failure says on screen: the API's own message (written for the reader, never holding your words), or the connection line. */
export function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : CONNECTION_FAILURE;
}

/** Whether "Try again" can help: a network failure, a 5xx, or a 429 (m1kuorg/basics#74). A 4xx otherwise needs a different request. */
export function canRetry(error: unknown): boolean {
  return !(error instanceof ApiError) || error.status >= 500 || error.status === 429;
}

/** A 404 from the API: the shelf, card, or upload isn't there (or not yours, or wiped with the guest workspace). */
export const isNotFound = (error: unknown) => error instanceof ApiError && error.status === 404;

/** The app path a public page was sent from, `?next=`; the server follows it only when it's inside the app. */
export const nextPath = () => new URLSearchParams(location.search).get("next") ?? undefined;

/** A public page's address carrying `next` along, such as the log-in page's "Sign up" link. */
export function withNext(path: string): string {
  const next = nextPath();
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}
