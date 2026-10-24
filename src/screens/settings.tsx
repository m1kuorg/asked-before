// Settings: one view per area (app-screens.md 8.2), Account at
// /app/settings, API keys at /app/settings/keys, and Your data at
// /app/settings/data, each of sections in two columns (taste-sheet-app.md),
// with its own form, status line, and errors (brief section 4, item 6;
// inventory.md, Settings). Scaffold: the areas are built on their own branch
// (app-notes/more-pages/plan.md).
// The shared guest has none of them, only the way to an account of one's
// own; the server refuses the guest every account and key endpoint anyway.

import type { CreatedApiKey } from "@asked-before/sdk";
import { useState } from "react";
import type { ScreenProps } from "@/app/router";
import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { GUEST_SETTINGS_BODY, GUEST_SETTINGS_TITLE } from "@/lib/copy";
import { ApiKeys } from "./settings/api-keys";
import { DeleteAccount } from "./settings/delete-account";
import { Password } from "./settings/password";
import { Profile } from "./settings/profile";
import { YourData } from "./settings/your-data";

export function SettingsAccount({ client, account, setAccount }: ScreenProps) {
  if (account.guest) return <GuestSettings />;
  return <AccountSettings client={client} account={account} setAccount={setAccount} />;
}

export const SettingsKeys = SettingsAccount;
export const SettingsData = SettingsAccount;

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

function AccountSettings({ client, account, setAccount }: Pick<ScreenProps, "client" | "account" | "setAccount">) {
  /** The key made on this visit, shown once under its row and filled into the agent snippets; gone when the learner leaves. */
  const [made, setMade] = useState<CreatedApiKey | null>(null);
  return (
    <div className="@container">
      <header className="flex flex-col gap-1 pb-8">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">
          Logged in as {account.name}, {account.email}.
        </p>
      </header>
      <Separator />
      <Profile client={client} account={account} setAccount={setAccount} />
      <Separator />
      <Password client={client} />
      <Separator />
      <ApiKeys client={client} made={made} setMade={setMade} />
      <Separator />
      <YourData client={client} />
      <Separator />
      <DeleteAccount client={client} />
    </div>
  );
}
