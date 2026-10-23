// The SDK's quickstart, for the docs page. It runs as a Bun macro when the
// pages are bundled (`with { type: "macro" }` in docs.tsx), so the page shows
// packages/sdk/examples/quickstart.ts as it is: the same file the SDK's
// README shows and `bun run check:docs` runs.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export function sdkQuickstart(): string {
  return readFileSync(join(import.meta.dir, "..", "..", "packages", "sdk", "examples", "quickstart.ts"), "utf8").trim();
}
