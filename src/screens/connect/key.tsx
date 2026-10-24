// Give it a key. For an account: one button, the screen's one filled
// primary, makes a key named for the agent ("Make a key for Cursor"); a name
// already taken is fine, as keys may share names. The new key is the only
// answer that carries it whole, so it's shown this once, as API keys shows
// it, with its copy button focused, and it's handed up to fill the snippet;
// it stays in memory only and goes when the learner leaves. For the shared
// guest, whose key requests the server refuses (403): why keys need an
// account of one's own, and Sign up, which comes back here.

import type { CreatedApiKey } from "@asked-before/sdk";
import { useEffect, useRef } from "react";
import type { ScreenProps } from "@/app/router";
import { ShownKey } from "@/components/shown-key";
import { TextLink } from "@/components/text-link";
import { Button, ButtonLink } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { API_KEY_POWERS } from "@/lib/copy";
import { useSafeSubmit } from "@/lib/use-safe-submit";
import type { Agent } from "./agents";

type KeyProps = Pick<ScreenProps, "client"> & { agent: Agent; made: CreatedApiKey | null; onMade: (key: CreatedApiKey) => void };

export function Key({ client, agent, made, onMade }: KeyProps) {
  const submit = useSafeSubmit(async () => onMade(await client.keys.create({ name: agent.key })));
  const button = useRef<HTMLButtonElement>(null);
  // The button locks while the key is made, which drops its focus; a failure gives it back, beside the message.
  useEffect(() => {
    if (submit.error) button.current?.focus();
  }, [submit.error]);

  if (made) {
    return (
      <ShownKey made={made} autoFocus>
        Like the key, the snippet below shows it only until you leave this page. Revoke it any time in <TextLink href="/app/settings/keys">API keys</TextLink>.
      </ShownKey>
    );
  }

  return (
    <form {...submit.form} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        <p>
          A key lets your agent reach your shelves without your password. This makes one named {agent.key}, shows it once, and puts it in the snippet below.
        </p>
        <p>{API_KEY_POWERS}</p>
      </div>
      <div className="flex flex-col items-start gap-2">
        <Button ref={button} type="submit" disabled={submit.busy} aria-describedby={submit.error ? submit.errorId : undefined}>
          {submit.busy && <Spinner data-icon="inline-start" />}
          Make a key for {agent.key}
        </Button>
        {submit.error && <FieldError id={submit.errorId}>{submit.error}</FieldError>}
      </div>
    </form>
  );
}

export function GuestKey() {
  return (
    <div className="flex flex-col items-start gap-4">
      <p className="text-sm text-muted-foreground">
        A key reaches one account's shelves, and every guest shares the Guest account, so it has no API keys. Sign up for an account of your own, with shelves only you see, and make a key for your agent here.
      </p>
      <ButtonLink href={`/signup?next=${encodeURIComponent("/app/connect")}`}>Sign up</ButtonLink>
    </div>
  );
}
