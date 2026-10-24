// The rail beside the flow. Your keys (an account's only): each key's name,
// prefix, and last use, the most recent first and at most five, so a
// returning learner sees which keys something has used already; the date
// is in ink, as the row's one figure, and "Never" in grey. Managed in API
// keys. It's the same list the check refreshes, so a first use shows
// here too. What it can do: the MCP server's tools, from the docs' own
// table (src/pages/docs/reference.ts). What it sends: your own words, and
// which tools send them, from the tools' descriptions
// (packages/mcp/src/server.ts).

import type { ApiKey } from "@asked-before/sdk";
import type { Resource } from "@/app/use-resource";
import { ErrorNotice } from "@/components/error-notice";
import { TextLink } from "@/components/text-link";
import { Time } from "@/components/time";
import { WaitLine } from "@/components/wait-line";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { plural } from "@/lib/format";
import { TOOLS } from "@/pages/docs/reference";
import { RailBlock } from "./blocks";

const SHOWN = 5;

/** A key's latest sign of life: its last use, or else when it was made. */
const latest = (key: ApiKey) => Date.parse(key.lastUsedAt ?? key.createdAt);

export function YourKeys({ keys }: { keys: Resource<ApiKey[]> }) {
  const link = <TextLink href="/app/settings/keys">Manage in API keys</TextLink>;
  if (keys.error !== null && !keys.data) {
    return (
      <RailBlock title="Your keys" link={link}>
        <ErrorNotice error={keys.error} title="Your API keys didn't load." onRetry={keys.retry} />
      </RailBlock>
    );
  }
  if (keys.data?.length === 0) {
    return (
      <RailBlock title="Your keys" link={link}>
        <p className="text-sm text-muted-foreground">No API keys yet. The key you make here shows in this list, with its last use.</p>
      </RailBlock>
    );
  }

  const shown = keys.data && [...keys.data].sort((a, b) => latest(b) - latest(a)).slice(0, SHOWN);
  const more = keys.data ? keys.data.length - SHOWN : 0;
  return (
    <RailBlock title="Your keys" description="When each key was last used, the most recent first." link={link}>
      <Table>
        <TableCaption className="sr-only">Your API keys and their last use</TableCaption>
        <TableHeader className="[&_tr]:border-edge">
          <TableRow>
            <TableHead>Key</TableHead>
            <TableHead className="text-right">Last used</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown
            ? shown.map((key) => (
                <TableRow key={key.id} className="border-border">
                  <TableCell className="w-full max-w-0">
                    <span className="block truncate font-medium">{key.name}</span>
                    <code translate="no" className="block truncate text-xs text-muted-foreground">{key.prefix}</code>
                  </TableCell>
                  <TableCell className="text-right align-top tabular-nums">{key.lastUsedAt ? <Time iso={key.lastUsedAt} format="iso" /> : <span className="text-muted-foreground">Never</span>}</TableCell>
                </TableRow>
              ))
            : [0, 1].map((i) => (
                <TableRow key={i} className="border-border">
                  <TableCell className="w-full max-w-0">
                    {i === 0 ? <WaitLine>Finding your API keys…</WaitLine> : <Skeleton className="h-4 w-24" />}
                    <Skeleton className="mt-1.5 h-3 w-36" />
                  </TableCell>
                  <TableCell className="align-top">
                    <Skeleton className="ml-auto h-4 w-20" />
                  </TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>
      {more > 0 && <p className="text-sm text-muted-foreground">And {plural(more, "more key")} in API keys.</p>}
    </RailBlock>
  );
}

export function WhatItCanDo() {
  return (
    <RailBlock title="What it can do" description="The MCP server's tools, by the names your agent shows.">
      <dl className="flex flex-col">
        {TOOLS.map(([tool, does]) => (
          <div key={tool} className="flex flex-col gap-0.5 border-b border-border py-2.5 first:pt-0 last:border-b-0 last:pb-0">
            <dt>
              <code translate="no" className="text-xs text-foreground">{tool}</code>
            </dt>
            <dd className="text-sm text-muted-foreground">{does}</dd>
          </div>
        ))}
      </dl>
      {/* The docs' MCP section says this of the daily cap, word for word (src/pages/docs/sections.tsx). */}
      <p className="text-sm text-muted-foreground">
        Recording a question the model has to place, starting a cold rep, and checking an answer each count toward the app's daily cap of model requests, which is for the whole app, guests included.
      </p>
    </RailBlock>
  );
}

/** What each tool sends of yours; the others send nothing (their descriptions say so). */
const SENDS: Record<string, string> = {
  record_question: "your question, word for word, as you asked it",
  check_answer: "your answer to a cold rep, as you wrote it",
};
const SILENT = TOOLS.map(([tool]) => tool).filter((tool) => !(tool in SENDS));

export function WhatItSends() {
  return (
    <RailBlock title="What it sends">
      {/* The docs' MCP section, word for word (src/pages/docs/sections.tsx). */}
      <p className="text-sm">Its tools tell the agent to send only your own words: never its answer, your code, or secrets.</p>
      <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
        {Object.entries(SENDS).map(([tool, what]) => (
          <li key={tool}>
            <code translate="no" className="text-xs text-foreground">{tool}</code> sends {what}.
          </li>
        ))}
        <li>
          {SILENT.map((tool, i) => (
            <span key={tool}>
              {i > 0 && (i === SILENT.length - 1 ? ", and " : ", ")}
              <code translate="no" className="text-xs text-foreground">{tool}</code>
            </span>
          ))}{" "}
          send nothing of yours.
        </li>
      </ul>
    </RailBlock>
  );
}
