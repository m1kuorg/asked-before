// How an agent launches the Asked Before MCP server, kept in this one place:
// the command, the environment it reads, and the setup snippets for Claude
// Code, Claude Desktop, and Cursor built from them. The server reads its
// environment names from here, and the settings page shows the snippets
// with its own server's address filled in. It runs from a clone of the
// repo, with bun, configured by an API key, the server URL, and an
// optional default project (app-notes/mcp-sdk.md). m1kuorg/basics#51
// corrects the snippets once the plugin carries its build.
// No imports, so the page can bundle it.

/** The settings the MCP server reads from its environment. */
export const MCP_ENV = {
  /** An API key from the settings page, ab_<id>_<secret>. */
  apiKey: "ASKED_BEFORE_API_KEY",
  /** The Asked Before server, such as https://asked-before.example. */
  url: "ASKED_BEFORE_URL",
  /** Optional: the project, by name or id, that the tools use when a call names none. */
  project: "ASKED_BEFORE_PROJECT",
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

const ENTRY = `${PLACEHOLDERS.clone}/${ENTRY_IN_CLONE}`;

// The default project is optional, so the snippets leave it out.
const env = (serverUrl: string) => ({ [MCP_ENV.url]: serverUrl, [MCP_ENV.apiKey]: PLACEHOLDERS.apiKey });

/** The setup snippet for each agent, for the server at `serverUrl`. */
export function connectSnippets(serverUrl: string): { claudeCode: string; claudeDesktop: string; cursor: string } {
  const vars = env(serverUrl);
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
  return { claudeCode, claudeDesktop: config({}), cursor: config({ type: "stdio" }) };
}
