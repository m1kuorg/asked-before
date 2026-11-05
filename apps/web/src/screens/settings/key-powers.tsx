// What a key can do: the API's one rule for keys, area by area, read from
// the docs' own table (src/pages/docs/reference.ts, whose routes check:docs
// holds to the server's). Two lists side by side: the SDK calls a key may
// make, and the ones only a logged-in browser may, where a key gets 403.
// Signing up, logging in, the guest, and the health check need neither, so
// they're left out. On a narrow panel the second list goes under the first.

import { Fragment } from "react";
import { Section } from "@/components/section";
import { TextLink } from "@/components/text-link";
import { API_KEY_POWERS } from "@/lib/copy";
import { AREAS, type Endpoint, type Who } from "@/pages/docs/reference";

/** Each area's calls that `who` may make, as SDK names without the area's: "list" for shelves.list. Areas with none are left out. */
const callsFor = (who: Who) =>
  AREAS.map(({ area, endpoints }) => ({
    area,
    calls: endpoints.filter((endpoint) => endpoint.who === who).map((endpoint: Endpoint) => endpoint.sdk.slice(endpoint.sdk.indexOf(".") + 1)),
  })).filter((row) => row.calls.length > 0);

const LISTS = [
  { title: "With a key", rows: callsFor("Key or session") },
  { title: "Only when logged in", rows: callsFor("Session only") },
];

export function KeyPowers() {
  return (
    <Section
      id="what-a-key-can-do"
      title="What a key can do"
      description={
        <>
          <p>{API_KEY_POWERS}</p>
          <p>
            Asked for anything else, the API answers a key 403. Every call is in the <TextLink href="/docs#endpoints">docs</TextLink>.
          </p>
        </>
      }
    >
      <div className="grid items-start gap-x-8 gap-y-6 @lg/panel:grid-cols-2">
        {LISTS.map((list) => (
          <Calls key={list.title} {...list} />
        ))}
      </div>
    </Section>
  );
}

/** One list: its title, then each area and its calls in code, a comma after each but the last. */
function Calls({ title, rows }: (typeof LISTS)[number]) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
        {rows.map(({ area, calls }) => (
          <Fragment key={area}>
            <dt className="text-muted-foreground">{area}</dt>
            <dd>
              {calls.map((name, i) => (
                <Fragment key={name}>
                  {/* SDK names that read as English words: a page translator would garble them. */}
                  <code translate="no" className="text-foreground">
                    {name}
                  </code>
                  {i < calls.length - 1 && ", "}
                </Fragment>
              ))}
            </dd>
          </Fragment>
        ))}
      </dl>
    </div>
  );
}
