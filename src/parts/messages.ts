// What a failure says on screen. The API's messages are written for the
// person reading them and never hold phrasing text, so they're shown as
// they are; anything else means the server couldn't be reached.

import { ApiError } from "@asked-before/sdk";

export function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Asked Before couldn't be reached. Check your connection, then try again.";
}
