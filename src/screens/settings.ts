// Settings: a placeholder until m1kuorg/basics#48 builds the profile, the
// password, API keys, and agent setup, and m1kuorg/basics#49 the data
// export and account deletion, from the shared parts (src/parts/). It shows
// who is logged in.

import type { ScreenProps } from "../app/router";
import { el } from "../parts/dom";
import { frame } from "../parts/frame";

export function mountSettings(root: HTMLElement, { account }: ScreenProps) {
  const { block } = frame(root);
  block.append(
    el("h1", undefined, "Settings"),
    el("p", undefined, `Logged in as ${account.name}, ${account.email}.`),
  );
}
