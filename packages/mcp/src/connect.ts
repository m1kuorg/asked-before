// How an agent launches the Asked Before MCP server, kept in this one place:
// the command, the environment it reads, and the setup snippets for Claude
// Code, Claude Desktop, and Cursor built from them. The server reads its
// environment names from here, and the settings and docs pages show the
// snippets with their own server's address filled in. It's configured by
// an API key, the server URL, and an optional default shelf
// (m1kuorg/basics#50). It runs from a clone of the repo, with bun, or from
// the Claude Code plugin, which carries a single-file build of it and
// launches it with node (m1kuorg/basics#51).
// No imports, so the page can bundle it.

/** The settings the MCP server reads from its environment. */
export const MCP_ENV = {
  /** An API key from the settings page, ab_<id>_<secret>. */
  apiKey: "ASKED_BEFORE_API_KEY",
  /** The Asked Before server, such as https://asked-before.example. */
  url: "ASKED_BEFORE_URL",
  /** Optional: the shelf, by name or id, that the tools use when a call names none. */
  shelf: "ASKED_BEFORE_SHELF",
} as const;

/** What a snippet holds for the learner to replace: their clone of the repo, their key, and where bun is. */
export const PLACEHOLDERS = {
  clone: "/path/to/asked-before",
  apiKey: "YOUR_API_KEY",
  /** GUI apps may not see the shell's PATH, so Claude Desktop and Cursor take bun's full path, as `which bun` prints it. */
  bun: "/path/to/bun",
} as const;

/** The server's name in every agent's config. */
export const SERVER_NAME = "asked-before";

/** The server's entry, from the root of a clone of the repo. */
export const ENTRY_IN_CLONE = "packages/mcp/src/server.ts";

/**
 * The Claude Code plugin. A marketplace install copies only the plugin's
 * directory, so it carries a single-file build of this server
 * (`bun run build:plugin`), which its .mcp.json launches with node.
 */
export const PLUGIN = {
  /** Its directory, from the root of a clone. */
  dir: "plugins/asked-before",
  /** The marketplace that lists it: this repo on GitHub, whose root holds .claude-plugin/marketplace.json. */
  marketplace: "m1kuorg/asked-before",
  /** Its id, <plugin>@<marketplace>, once the marketplace is added. */
  id: "asked-before@asked-before",
  /** What launches the build: Node.js 20 or later, as the MCP SDK needs. */
  command: "node",
  /** The build, from the plugin's directory. */
  bundle: "dist/server.js",
  /** The options the plugin asks for (its userConfig), each passed on to the server as the MCP_ENV setting of the same key. */
  options: { url: "server_url", apiKey: "api_key", shelf: "shelf" },
} as const;

const ENTRY = `${PLACEHOLDERS.clone}/${ENTRY_IN_CLONE}`;

// The default shelf is optional, so the snippets leave it out.
const env = (serverUrl: string) => ({ [MCP_ENV.url]: serverUrl, [MCP_ENV.apiKey]: PLACEHOLDERS.apiKey });

/** The setup snippet for each agent, for the server at `serverUrl`: the Claude Code plugin, and the command from a clone for Claude Code, Claude Desktop, and Cursor. */
export function connectSnippets(serverUrl: string): { claudeCodePlugin: string; claudeCode: string; claudeDesktop: string; cursor: string } {
  const vars = env(serverUrl);
  const claudeCodePlugin = [
    `claude plugin marketplace add ${PLUGIN.marketplace}`,
    `claude plugin install ${PLUGIN.id} \\`,
    `  --config ${PLUGIN.options.url}=${serverUrl} \\`,
    `  --config ${PLUGIN.options.apiKey}=${PLACEHOLDERS.apiKey}`,
  ].join("\n");
  // `-e` takes several values, so another option sits between the last one and the server's name.
  const claudeCode = [
    "claude mcp add \\",
    ...Object.entries(vars).map(([name, value]) => `  -e ${name}=${value} \\`),
    "  --transport stdio --scope user \\",
    `  ${SERVER_NAME} -- bun ${ENTRY}`,
  ].join("\n");
  const config = (extra: Record<string, string>) =>
    JSON.stringify({ mcpServers: { [SERVER_NAME]: { ...extra, command: PLACEHOLDERS.bun, args: [ENTRY], env: vars } } }, null, 2)
      // A one-item list stays on one line.
      .replace(/\[\s+("[^"]*")\s+\]/g, "[$1]");
  return { claudeCodePlugin, claudeCode, claudeDesktop: config({}), cursor: config({ type: "stdio" }) };
}
