// The page's one way to call the server. A non-2xx response throws an Error
// carrying the server's { error }.

import type {
  CheckRequest,
  CheckResponse,
  GroupRequest,
  GroupResponse,
  Message,
  RepRequest,
  RepResponse,
} from "./types";

type Routes = {
  "/api/group": [GroupRequest, GroupResponse];
  "/api/rep": [RepRequest, RepResponse];
  "/api/check": [CheckRequest, CheckResponse];
};

export async function postJson<P extends keyof Routes>(path: P, body: Routes[P][0]): Promise<Routes[P][1]> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (data as { error?: unknown } | null)?.error;
    throw new Error(typeof error === "string" ? error : `The request failed (${response.status}).`);
  }
  return data as Routes[P][1];
}

/** The group request: your message ids and texts, and nothing else. */
export const toGroupRequest = (messages: Message[]): GroupRequest => ({
  messages: messages.map(({ id, text }) => ({ id, text })),
});
