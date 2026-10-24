// Settings: one view per area (app-screens.md 8.2), each with the area's
// name as its h1 and its sections in two columns (taste-sheet-app.md):
// Account at /app/settings (Profile, then Password), API keys at
// /app/settings/keys (Your keys, then What a key can do), and Your data at
// /app/settings/data (Download your data, then Delete your account, last).
// Each section has its own form, status line, and errors (brief section 4,
// item 6; inventory.md, Settings), and its label column carries the current
// values the API gives, rather than a void beside a taller panel.
// The shared guest has none of them, only the way to an account of one's
// own, at every settings path; the server refuses the guest every account
// and key endpoint anyway.

import type { ReactNode } from "react";
import type { ScreenProps } from "@/app/router";
import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { GUEST_SETTINGS_BODY, GUEST_SETTINGS_TITLE } from "@/lib/copy";
import { ApiKeys } from "./settings/api-keys";
import { DeleteAccount } from "./settings/delete-account";
import { KeyPowers } from "./settings/key-powers";
import { Password } from "./settings/password";
import { Profile } from "./settings/profile";
import { TextLink } from "./settings/text-link";
import { YourData } from "./settings/your-data";

export function SettingsAccount({ client, account, setAccount }: ScreenProps) {
  if (account.guest) return <GuestSettings />;
  return (
    <View title="Account" line={`Logged in as ${account.name}, ${account.email}.`}>
      <Profile client={client} account={account} setAccount={setAccount} />
      <Separator />
      <Password client={client} />
    </View>
  );
}

export function SettingsKeys({ client, account }: ScreenProps) {
  if (account.guest) return <GuestSettings />;
  return (
    <View title="API keys" line="An API key lets a script or an agent reach your shelves without your password. Make one for each, so you can revoke one alone.">
      <ApiKeys client={client} />
      <Separator />
      <KeyPowers />
    </View>
  );
}

export function SettingsData({ client, account }: ScreenProps) {
  if (account.guest) return <GuestSettings />;
  return (
    <View
      title="Your data"
      line={
        <>
          Your data is yours: download all of it, or delete your account and everything in it. The <TextLink href="/privacy">privacy page</TextLink> says what Asked Before keeps, and where.
        </>
      }
    >
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

function GuestSettings() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">Every guest shares the Guest account, so it has no profile, password, or API keys, and its data is every guest's.</p>
      </header>
      <Empty className="py-12">
        <EmptyHeader>
          <EmptyTitle>
            <h2>{GUEST_SETTINGS_TITLE}</h2>
          </EmptyTitle>
          <EmptyDescription>{GUEST_SETTINGS_BODY}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {/* A real link: Button with render={<a>} would announce it as a button. */}
          <a href="/signup" className={buttonVariants()}>
            Sign up
          </a>
        </EmptyContent>
      </Empty>
    </div>
  );
}
