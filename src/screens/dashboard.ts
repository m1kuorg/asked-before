// The dashboard: a placeholder until m1kuorg/basics#47 builds it, with the
// impeccable skill, from GET /dashboard. Signing up and logging in land here.

import type { ScreenProps } from "../app/router";
import { el, link } from "../parts/dom";
import { frame } from "../parts/frame";

export function mountDashboard(root: HTMLElement, { account }: ScreenProps) {
  const { block } = frame(root);
  block.append(
    el("h1", undefined, "Dashboard"),
    el("p", undefined, `Welcome, ${account.name}. Your most borrowed cards, and your latest borrows and returns, will be set out here.`),
    el("p", undefined, link("Go to your projects", "/app/projects")),
  );
}
