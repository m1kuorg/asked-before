// Settings: one view per area (m1kuorg/basics#77), each with the area's name
// as its h1 and its sections in two columns (.taste-skill/app/direction.json,
// "Settings in two columns"): Account at /app/settings (Profile, then
// Password), API keys at /app/settings/keys (Your keys, then What a key can
// do), and Your data at /app/settings/data (What Asked Before keeps, Download
// your data, then Delete your account, last). Each section has its own form,
// status line, and errors (m1kuorg/basics#74), and its label column carries
// the current values the API gives, rather than a void beside a taller panel.
// The shared guest has none of them: at every settings path it gets one
// view, titled Settings, with the way to an account of one's own and, in
// the same two columns, what each of an account's three areas holds and
// needs, in words, with no form; the server refuses the guest every account
// and key endpoint anyway.

import { useEffect, type ReactNode } from "react";
import type { ScreenProps } from "@/app/router";
import { FormFooter, Section } from "@/components/section";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { GUEST_SETTINGS_BODY, GUEST_SETTINGS_TITLE } from "@/lib/copy";
import { ApiKeys } from "./settings/api-keys";
import { DeleteAccount } from "./settings/delete-account";
import { KeyPowers } from "./settings/key-powers";
import { Password } from "./settings/password";
import { Profile } from "./settings/profile";
import { WhatIsKept } from "./settings/what-is-kept";
import { YourData } from "./settings/your-data";

export function SettingsAccount({ client, account, setAccount, setTitle }: ScreenProps) {
  if (account.guest) return <GuestSettings setTitle={setTitle} />;
  return (
    <View title="Account" line={`Logged in as ${account.name}, ${account.email}.`}>
      <Profile client={client} account={account} setAccount={setAccount} />
      <Separator />
      <Password client={client} />
    </View>
  );
}

export function SettingsKeys({ client, account, setTitle }: ScreenProps) {
  if (account.guest) return <GuestSettings setTitle={setTitle} />;
  return (
    <View title="API keys" line="An API key lets a script or an agent reach your shelves without your password. Make one for each, so you can revoke one alone.">
      <ApiKeys client={client} />
      <Separator />
      <KeyPowers />
    </View>
  );
}

export function SettingsData({ client, account, setTitle }: ScreenProps) {
  if (account.guest) return <GuestSettings setTitle={setTitle} />;
  return (
    <View title="Your data" line="Your data is yours: see what Asked Before keeps, download all of it, or delete your account and everything in it.">
      <WhatIsKept />
      <Separator />
      <YourData client={client} />
      <Separator />
      <DeleteAccount client={client} />
    </View>
  );
}

/** A settings area: its name as the h1 with one grey line under it, then its sections, split by full-width rules. */
function View({ title, line, children }: { title: string; line: ReactNode; children: ReactNode }) {
  return (
    <div className="@container">
      <header className="flex flex-col gap-1 pb-8">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-pretty text-muted-foreground">{line}</p>
      </header>
      <Separator />
      {children}
    </div>
  );
}

/** An account's three areas, as the guest is told of them: what each holds, then what it needs. */
const AREAS = [
  { name: "Account", holds: "Your name, your email, and your password.", needs: "Changing your email or your password needs your current password." },
  { name: "API keys", holds: "Keys for your scripts and agents, each shown only once, when it's made.", needs: "Each key needs a name, and you can revoke one alone." },
  {
    name: "Your data",
    holds: "What Asked Before keeps for you: see it, download all of it, or delete your account and everything in it.",
    needs: "Downloading needs nothing more than being logged in; deleting needs your password, then a confirmation.",
  },
];

function GuestSettings({ setTitle }: Pick<ScreenProps, "setTitle">) {
  // One view at every settings path, so its tab and top bar say Settings, as its h1 does.
  useEffect(() => setTitle("Settings"), [setTitle]);
  return (
    <View title="Settings" line="Every guest shares the Guest account, so it has no profile, password, or API keys, and its data is every guest's.">
      <Section id="your-own-account" title={GUEST_SETTINGS_TITLE} description={<p>{GUEST_SETTINGS_BODY}</p>}>
        <p className="text-sm">Signing up takes a name, an email, and a password of at least 10 characters.</p>
        <p className="text-sm text-muted-foreground">An account starts empty, with Home offering the demo shelf. What you've added as the guest stays in the guest workspace.</p>
        <FormFooter>
          {/* A real link: Button with render={<a>} would announce it as a button. */}
          <a href="/signup" className={buttonVariants()}>
            Sign up
          </a>
        </FormFooter>
      </Section>
      <Separator />
      <Section id="an-accounts-settings" title="What an account's settings hold" description={<p>Three areas, each its own view, which Settings lists in the sidebar once you've signed up.</p>}>
        <dl className="flex flex-col text-sm">
          {AREAS.map((area) => (
            <div key={area.name} className="grid gap-x-4 gap-y-1 border-b border-border py-3 first:pt-1 last:border-b-0 last:pb-1 @lg/panel:grid-cols-[7rem_minmax(0,1fr)]">
              <dt className="text-muted-foreground">{area.name}</dt>
              <dd className="flex flex-col gap-1">
                <span>{area.holds}</span>
                <span className="text-muted-foreground">{area.needs}</span>
              </dd>
            </div>
          ))}
        </dl>
      </Section>
    </View>
  );
}
