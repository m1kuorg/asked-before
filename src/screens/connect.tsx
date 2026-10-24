// Connect your AI (/app/connect): sets up an agent, Claude Code, Claude
// Desktop, or Cursor, with Asked Before's MCP server or plugin. Scaffold: the
// setup snippets moved here from Settings; the screen is built on its own
// branch (app-notes/more-pages/plan.md).

import type { ScreenProps } from "@/app/router";
import { Setup } from "./connect/setup";

export function Connect(_props: ScreenProps) {
  return (
    <div className="@container flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Connect your AI</h1>
      </header>
      <Setup made={null} />
    </div>
  );
}
