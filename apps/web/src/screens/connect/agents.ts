// The agents Connect your AI sets up, in the order it offers them: the
// Claude Code plugin first, the one it recommends, then the server from a
// copy of the repo in Claude Code, Claude Desktop, and Cursor. `key` is the
// name of the key the screen makes for one; both Claude Code paths make a
// "Claude Code" key, and keys may share names.

export type AgentId = "plugin" | "claude-code" | "claude-desktop" | "cursor";

export type Agent = { id: AgentId; label: string; key: string; recommended?: true; description: string };

export const AGENTS: Agent[] = [
  {
    id: "plugin",
    label: "Claude Code with the plugin",
    key: "Claude Code",
    recommended: true,
    description: "One install brings the server and a skill that tells Claude Code when to use it.",
  },
  { id: "claude-code", label: "Claude Code without the plugin", key: "Claude Code", description: "The server alone, run with bun from a copy of Asked Before." },
  { id: "claude-desktop", label: "Claude Desktop", key: "Claude Desktop", description: "The server from a copy of Asked Before, in Claude Desktop's config file." },
  { id: "cursor", label: "Cursor", key: "Cursor", description: "The server from a copy of Asked Before, in Cursor's mcp.json." },
];
