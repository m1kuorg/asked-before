// One project: a placeholder until m1kuorg/basics#45 sets its card stack, its
// unsorted phrasings, and its upload history here, keeping the proof of
// concept's Centre Rail look (public/styles/stack.css). It shows the
// project's name, its demo label, and its count of cards on the plate.

import type { ScreenProps } from "../app/router";
import { el, link } from "../parts/dom";
import { emptyState } from "../parts/empty";
import { frame, load, plate } from "../parts/frame";
import { demoLabel } from "../parts/library";

export function mountProject(root: HTMLElement, { client, params, signal }: ScreenProps<"projectId">) {
  const { block } = frame(root);
  const upload = `/app/projects/${encodeURIComponent(params.projectId)}/upload`;
  load(block, {
    keep: [el("h1", undefined, "Project")],
    line: "Finding the project…",
    request: () => client.projects.get(params.projectId),
    signal,
    show: (project) => {
      document.title = `${project.name} · Asked Before`;
      const heading = el("div", "heading", el("h1", undefined, project.name));
      if (project.demo) heading.append(demoLabel());
      block.replaceChildren(
        heading,
        plate(project.counts.cards, project.counts.cards === 1 ? "card" : "cards"),
        emptyState(
          "No cards yet",
          "Upload a chat export into this project, and every question you asked more than once becomes a card.",
          link("Upload a chat export", upload, "button"),
        ),
      );
    },
  });
}
