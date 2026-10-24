// Connect an agent: the setup snippets from connectSnippets(location.origin)
// (packages/mcp/src/connect.ts), one tab per agent. Claude Code's tab holds
// the plugin and the command without it; Claude Desktop's and Cursor's hold
// their JSON. Every tab stays mounted, so each snippet is in the page and
// found by its caption. When a key was made on this visit, the snippets hold
// it in place of YOUR_API_KEY.

import type { CreatedApiKey } from "@asked-before/sdk";
import { useMemo, type ReactNode } from "react";
import { connectSnippets, PLACEHOLDERS } from "../../../packages/mcp/src/connect";
import { CopyBlock } from "@/components/copy-block";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code, Section } from "../settings/section";

const { apiKey: KEY, clone: CLONE, bun: BUN } = PLACEHOLDERS;

/** Said before each snippet that runs from a copy of the repo. */
const FROM_A_COPY = (
  <p>
    Without the plugin, the server runs on your computer from a copy of Asked Before: clone it and run <Code>bun install</Code>, then add the server to your agent. In each snippet, put your copy's
    folder for <Code>{CLONE}</Code>, and a key from above for <Code>{KEY}</Code>.
  </p>
);

const WHICH_BUN = (
  <>
    For <Code>{BUN}</Code>, put the path that the command "which bun" prints.
  </>
);

export function Setup({ made }: { made: CreatedApiKey | null }) {
  const snippets = useMemo(() => {
    const all = connectSnippets(location.origin);
    if (!made) return all;
    const fill = (snippet: string) => snippet.replaceAll(KEY, made.key);
    return { claudeCodePlugin: fill(all.claudeCodePlugin), claudeCode: fill(all.claudeCode), claudeDesktop: fill(all.claudeDesktop), cursor: fill(all.cursor) };
  }, [made]);

  return (
    <Section
      id="connect-an-agent"
      title="Connect an agent"
      description={
        <>
          <p>
            Asked Before's MCP server lets Claude Code, Claude Desktop, or Cursor record the questions you ask there and run cold reps in chat. In Claude Code, the Asked Before plugin brings the
            server and a skill that tells Claude Code when to use it.
          </p>
          <p>
            Each snippet already holds this server's address, <Code>{location.origin}</Code>.
          </p>
          <p>
            More in the docs: <DocsLink href="/docs#mcp">the MCP server</DocsLink> and <DocsLink href="/docs#plugin">the Claude Code plugin</DocsLink>.
          </p>
        </>
      }
    >
      {made && (
        <p className="text-sm text-muted-foreground">
          These snippets hold {made.name}'s key in place of <Code>{KEY}</Code>. Like the key, they show it only until you leave this page.
        </p>
      )}
      <Tabs defaultValue="claude-code" className="gap-5">
        <TabsList aria-label="Agent">
          <TabsTrigger value="claude-code">Claude Code</TabsTrigger>
          <TabsTrigger value="claude-desktop">Claude Desktop</TabsTrigger>
          <TabsTrigger value="cursor">Cursor</TabsTrigger>
        </TabsList>
        <Panel value="claude-code">
          <Snippet caption="Claude Code plugin" code={snippets.claudeCodePlugin}>
            Run it in a terminal, with a key from above for <Code>{KEY}</Code>, then start a new Claude Code session. The plugin needs Node.js 20 or later.
          </Snippet>
          <div className="flex flex-col gap-3 border-t border-edge pt-5">
            {FROM_A_COPY}
            <Snippet caption="Claude Code without the plugin" code={snippets.claudeCode}>
              Run it in a terminal.
            </Snippet>
          </div>
        </Panel>
        <Panel value="claude-desktop">
          {FROM_A_COPY}
          <Snippet caption="Claude Desktop" code={snippets.claudeDesktop}>
            In Claude Desktop, open Settings, then Developer, then Edit Config, and add it to <Code>claude_desktop_config.json</Code>. {WHICH_BUN} Then restart Claude Desktop.
          </Snippet>
        </Panel>
        <Panel value="cursor">
          {FROM_A_COPY}
          <Snippet caption="Cursor" code={snippets.cursor}>
            Add it to <Code>~/.cursor/mcp.json</Code>, or to <Code>.cursor/mcp.json</Code> in one repository. {WHICH_BUN}
          </Snippet>
        </Panel>
      </Tabs>
    </Section>
  );
}

function Panel({ value, children }: { value: string; children: ReactNode }) {
  return (
    <TabsContent value={value} keepMounted className="flex flex-col gap-5 text-muted-foreground">
      {children}
    </TabsContent>
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

function DocsLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="text-foreground underline underline-offset-4 decoration-input hover:decoration-foreground">
      {children}
    </a>
  );
}
