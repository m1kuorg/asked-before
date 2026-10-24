// Add it: the picked agent's setup snippet from connectSnippets(location.origin)
// (packages/mcp/src/connect.ts), so it holds this server's address, and
// where it goes, in the words Settings used for it. When a key was made on
// this visit, the snippet holds it in place of YOUR_API_KEY. The snippet
// keeps its caption ("Claude Code plugin", "Claude Code without the
// plugin", "Claude Desktop", "Cursor"), which check:connect reads.

import type { CreatedApiKey } from "@asked-before/sdk";
import { useMemo, type ReactNode } from "react";
import { connectSnippets, PLACEHOLDERS } from "../../../packages/mcp/src/connect";
import { CopyBlock } from "@/components/copy-block";
import { Code } from "@/components/section";
import { TextLink } from "@/components/text-link";
import type { Agent } from "./agents";

const { apiKey: KEY, clone: CLONE, bun: BUN } = PLACEHOLDERS;

const WHICH_BUN = (
  <>
    For <Code>{BUN}</Code>, put the path that the command “which bun” prints.
  </>
);

type SetupProps = { agent: Agent; made: CreatedApiKey | null; guest: boolean };

export function Setup({ agent, made, guest }: SetupProps) {
  const snippets = useMemo(() => connectSnippets(location.origin), []);
  const fill = (snippet: string) => (made ? snippet.replaceAll(KEY, made.key) : snippet);
  /** Where the key comes from, said wherever the snippet still holds the placeholder. */
  const keyFrom = made ? null : (
    <>
      {guest ? "an account's key" : "a key from above"} for <Code>{KEY}</Code>
    </>
  );

  /** Said before each snippet that runs from a copy of the repo. */
  const fromACopy = (
    <p>
      Without the plugin, the server runs on your computer from a copy of Asked Before: clone it and run <Code>bun install</Code>, then add the server to your agent. In the snippet, put your copy's folder for{" "}
      <Code>{CLONE}</Code>
      {keyFrom && <>, and {keyFrom}</>}.
    </p>
  );

  let body: ReactNode;
  if (agent.id === "plugin") {
    body = (
      <Snippet caption="Claude Code plugin" code={fill(snippets.claudeCodePlugin)}>
        Run it in a terminal{keyFrom && <>, with {keyFrom}</>}, then start a new Claude Code session. The plugin needs Node.js 20 or later.
      </Snippet>
    );
  } else if (agent.id === "claude-code") {
    body = (
      <>
        {fromACopy}
        <Snippet caption="Claude Code without the plugin" code={fill(snippets.claudeCode)}>
          Run it in a terminal.
        </Snippet>
      </>
    );
  } else if (agent.id === "claude-desktop") {
    body = (
      <>
        {fromACopy}
        <Snippet caption="Claude Desktop" code={fill(snippets.claudeDesktop)}>
          In Claude Desktop, open Settings, then Developer, then Edit Config, and add it to <Code>claude_desktop_config.json</Code>. {WHICH_BUN} Then restart Claude Desktop.
        </Snippet>
      </>
    );
  } else {
    body = (
      <>
        {fromACopy}
        <Snippet caption="Cursor" code={fill(snippets.cursor)}>
          Add it to <Code>~/.cursor/mcp.json</Code>, or to <Code>.cursor/mcp.json</Code> in one repository. {WHICH_BUN}
        </Snippet>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4 text-sm text-muted-foreground">
      <p>
        The snippet already holds this server's address, <Code>{location.origin}</Code>
        {made && (
          <>
            , and {made.name}'s key in place of <Code>{KEY}</Code>
          </>
        )}
        .
      </p>
      {body}
      <p>
        More in the docs:{" "}
        <TextLink href="/docs#mcp">the MCP server</TextLink>{" "}
        and{" "}
        <TextLink href="/docs#plugin">the Claude Code plugin</TextLink>
        .
      </p>
    </div>
  );
}

/** A snippet, then what to do with it. */
function Snippet({ caption, code, children }: { caption: string; code: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <CopyBlock caption={caption} code={code} className="text-foreground [&_pre]:bg-background" />
      <p>{children}</p>
    </div>
  );
}
