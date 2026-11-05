// What Asked Before keeps, first in Your data: the database's rows, the
// privacy page's own (DATABASE_HOLDS in copy.ts), as a key-value list on
// row rules in the panel: what it is in grey, what's kept of it in ink. On
// a narrow panel each value goes under its name. The label column says
// where they're kept and links to the privacy page for the rest.

import { Section } from "@/components/section";
import { TextLink } from "@/components/text-link";
import { DATABASE_HOLDS } from "@/lib/copy";

export function WhatIsKept() {
  return (
    <Section
      id="what-asked-before-keeps"
      title="What Asked Before keeps"
      description={
        <>
          <p>Everything Asked Before keeps for you is in one database on Cloudflare D1. Cloudflare is Asked Before's host.</p>
          <p>Your password never leaves your computer. The page derives a key from it with scrypt and sends that in its place, so the database has only a salted SHA-256 of the key.</p>
          <p>
            The <TextLink href="/privacy">privacy page</TextLink> says the rest: what leaves your computer, what the model sees, the one cookie, and the logs.
          </p>
        </>
      }
    >
      <dl className="flex flex-col text-sm">
        {DATABASE_HOLDS.map(([what, kept]) => (
          <div key={what} className="grid gap-x-4 gap-y-1 border-b border-border py-3 first:pt-1 last:border-b-0 last:pb-1 @lg/panel:grid-cols-[10rem_minmax(0,1fr)]">
            <dt className="text-muted-foreground">{what}</dt>
            <dd className="text-pretty">{kept}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
