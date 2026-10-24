// The request as code, in three tabs that rewrite themselves as the inputs
// change (code.ts): curl, the TypeScript SDK, and fetch, each with its copy
// button. Every tab stays mounted, so each is in the page. Under them, why
// each sends YOUR_API_KEY, and what that means for a session-only endpoint.

import { useId } from "react";
import { PLACEHOLDERS } from "../../../packages/mcp/src/connect";
import { Code } from "@/components/section";
import { CopyBlock } from "@/components/copy-block";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { curl, fetchCode, sdkCode } from "./code";
import type { Entry, Param } from "./endpoints";
import type { Built } from "./request";

type CodeTabsProps = { built: Built; entry: Entry; ids: Partial<Record<Param, string>> };

export function CodeTabs({ built, entry, ids }: CodeTabsProps) {
  const headingId = useId();
  const origin = location.origin;
  const tabs = [
    { value: "curl", label: "curl", caption: "In a terminal", code: curl(origin, built) },
    { value: "sdk", label: "TypeScript SDK", caption: "With @asked-before/sdk", code: sdkCode(origin, built, entry, ids) },
    { value: "fetch", label: "fetch", caption: "In JavaScript", code: fetchCode(origin, built) },
  ];
  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-3">
      <h2 id={headingId} className="text-base font-medium">
        As code
      </h2>
      <Tabs defaultValue="curl" className="gap-3">
        <TabsList aria-label="Language">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} keepMounted>
            <CopyBlock caption={tab.caption} code={tab.code} copyLabel={`Copy the ${tab.label} code`} className="[&_pre]:break-words [&_pre]:whitespace-pre-wrap" />
          </TabsContent>
        ))}
      </Tabs>
      <p className="text-sm text-muted-foreground">
        Each one sends an API key in place of <Code>{PLACEHOLDERS.apiKey}</Code>, since this session's cookie can't be copied out of the browser.
        {entry.who === "Session only" && " This endpoint needs a session, so with a key it answers 403."}
      </p>
    </section>
  );
}
