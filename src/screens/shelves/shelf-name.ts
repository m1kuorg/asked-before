// A shelf's name, checked in the page before it's sent, with the server's own
// rule and words (server/api/shelves.ts: trimmed, 1 to 80 characters), so a
// name that can't pass costs no request. The server still checks it.
import { ApiError } from "@asked-before/sdk";

export function shelfName(raw: FormDataEntryValue | null): string {
  const name = String(raw ?? "").trim();
  if (!name) throw new ApiError(400, "A shelf needs a name.");
  if (name.length > 80) throw new ApiError(400, "A shelf's name can have at most 80 characters.");
  return name;
}
