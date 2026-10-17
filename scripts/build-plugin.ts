// Builds the Claude Code plugin's MCP server (m1kuorg/basics#51): the
// server in packages/mcp, with the SDK, the MCP SDK, and zod inside it, as
// one file that Node.js 20 or later runs, in the plugin's directory. A
// marketplace install copies only that directory, and the packages aren't
// on npm, so the plugin carries this build. Rebuild it whenever the server
// or the SDK changes; `bun run check:plugin` fails while it's stale.
// Run: bun run build:plugin

import { join } from "node:path";
import { ENTRY_IN_CLONE, PLUGIN } from "../packages/mcp/src/connect";

const ROOT = join(import.meta.dir, "..");

/** Where the build goes. */
export const BUNDLE = join(ROOT, PLUGIN.dir, PLUGIN.bundle);

const BANNER = `// The Asked Before MCP server, built from ${ENTRY_IN_CLONE} by \`bun run build:plugin\`. Rebuild it rather than edit it.`;

/** The build's text: the same sources always build the same text, so a stale build shows as a difference. */
export async function buildServer(): Promise<string> {
  const build = await Bun.build({ entrypoints: [join(ROOT, ENTRY_IN_CLONE)], root: ROOT, target: "node", banner: BANNER });
  if (!build.success || build.outputs.length !== 1) throw new AggregateError(build.logs, "The MCP server didn't build.");
  return build.outputs[0]!.text();
}

if (import.meta.main) {
  const text = await buildServer();
  await Bun.write(BUNDLE, text);
  console.log(`Built ${PLUGIN.dir}/${PLUGIN.bundle} (${(text.length / 1024).toFixed(0)} KB).`);
}
