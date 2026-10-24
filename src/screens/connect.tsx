// Connect your AI (/app/connect; keys.list() and keys.create()). Its
// question: is my agent connected? The flow is a real <ol>, in order by
// position alone (no "Step 2"): pick your agent, give it a key, add it, and
// check it. The key is made here, shown once, and filled into the snippet;
// then the check watches for its first use while the page is open. Beside
// the flow, the rail: the account's keys with their last use, what the agent
// can do, and what it sends (app-notes/more-pages/plan.md, "Connect your AI",
// with plan-review.md's notes). The key made here lives in this screen's
// memory only, never in the URL or in storage, and goes when the learner
// leaves. The shared guest has no keys (the server answers it 403), so its
// key step says why and offers Sign up, and it gets no keys list.
//
// The grid: the canvas's 12 columns, 77px with 16px gutters at its full
// 1100px (12 x 77 + 11 x 16 = 1100). The flow takes 8 (729) and the rail 4
// (355): 729 + 16 + 355 = 1100, Home's split. On a canvas under 60rem it
// all stacks: the keys, then the flow, then the rest of the rail. The steps
// are panels and the rail isn't, so the two columns end where their content
// does.

import type { CreatedApiKey } from "@asked-before/sdk";
import { useState, type ReactNode } from "react";
import { cn } from "cn";
import type { ScreenProps } from "@/app/router";
import { useResource } from "@/app/use-resource";
import { MCP_SERVER_DOES } from "@/lib/copy";
import { AGENTS } from "./connect/agents";
import { Step } from "./connect/blocks";
import { Check, useFirstUse } from "./connect/check";
import { GuestKey, Key } from "./connect/key";
import { PickAgent } from "./connect/pick";
import { WhatItCanDo, WhatItSends, YourKeys } from "./connect/rail";
import { Setup } from "./connect/setup";

export function Connect({ client, account, signal }: ScreenProps) {
  return account.guest ? <GuestConnect /> : <AccountConnect client={client} signal={signal} />;
}

function AccountConnect({ client, signal }: Pick<ScreenProps, "client" | "signal">) {
  const [agent, setAgent] = useState(AGENTS[0]!);
  /** The key made on this visit, whole: shown once and filled into the snippet. */
  const [made, setMade] = useState<CreatedApiKey | null>(null);
  const keys = useResource(() => client.keys.list(), []);
  const first = useFirstUse(made, signal, (list) => keys.setData(list));

  function onMade(created: CreatedApiKey) {
    const { key: _shownOnce, ...listed } = created;
    if (keys.data) keys.setData((list) => list && [...list, listed]);
    else keys.retry();
    setMade(created);
  }

  return (
    <Layout
      steps={
        <>
          <Step title="Pick your agent">
            <PickAgent agent={agent} onPick={setAgent} />
          </Step>
          <Step title="Give it a key">
            <Key client={client} agent={agent} made={made} onMade={onMade} />
          </Step>
          <Step title="Add it">
            <Setup agent={agent} made={made} guest={false} />
          </Step>
          <Step title="Check it">
            <Check made={made} watch={first.watch} onRetry={first.retry} guest={false} />
          </Step>
        </>
      }
      keys={<YourKeys keys={keys} />}
      rail={
        <>
          <WhatItCanDo />
          <WhatItSends />
        </>
      }
    />
  );
}

function GuestConnect() {
  const [agent, setAgent] = useState(AGENTS[0]!);
  return (
    <Layout
      steps={
        <>
          <Step title="Pick your agent">
            <PickAgent agent={agent} onPick={setAgent} />
          </Step>
          <Step title="Give it a key">
            <GuestKey />
          </Step>
          <Step title="Add it">
            <Setup agent={agent} made={null} guest />
          </Step>
          <Step title="Check it">
            <Check made={null} watch={null} onRetry={() => {}} guest />
          </Step>
        </>
      }
      rail={
        <>
          <WhatItCanDo />
          <WhatItSends />
        </>
      }
    />
  );
}

/** `keys`, the account's keys, comes first in reading order, so on a narrow canvas a returning learner sees them before the flow; beside it, it tops the rail. */
function Layout({ steps, keys, rail }: { steps: ReactNode; keys?: ReactNode; rail: ReactNode }) {
  return (
    <div className="@container/connect flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Connect your AI</h1>
        {/* The docs' words for it, from their MCP section. */}
        <p className="max-w-prose text-muted-foreground">{MCP_SERVER_DOES}</p>
      </header>
      {/* Beside the flow, the rail is two rows: the keys, then the rest, with the flow's spare height under the rest. The rail's first heading is level with the first step's (the step's pad is 20px). */}
      <div className="grid items-start gap-x-4 gap-y-10 @min-[60rem]/connect:grid-cols-12 @min-[60rem]/connect:grid-rows-[auto_1fr]">
        {keys && <div className="min-w-0 @min-[60rem]/connect:col-span-4 @min-[60rem]/connect:col-start-9 @min-[60rem]/connect:row-start-1 @min-[60rem]/connect:pt-5">{keys}</div>}
        {/* Order by position alone; role="list" keeps the list a list in Safari, which drops it with the markers. */}
        <ol role="list" aria-label="Connect your AI, in order" className="flex min-w-0 list-none flex-col gap-4 @min-[60rem]/connect:col-span-8 @min-[60rem]/connect:col-start-1 @min-[60rem]/connect:row-span-2 @min-[60rem]/connect:row-start-1">
          {steps}
        </ol>
        <div className={cn(
            "flex min-w-0 flex-col gap-10 @min-[60rem]/connect:col-span-4 @min-[60rem]/connect:col-start-9",
            keys ? "@min-[60rem]/connect:row-start-2" : "@min-[60rem]/connect:row-start-1 @min-[60rem]/connect:pt-5",
          )}>{rail}</div>
      </div>
    </div>
  );
}
