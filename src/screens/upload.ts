// Upload a chat export into a project: a placeholder until m1kuorg/basics#43
// builds the instructions, the drop zone (src/parts/drop-zone.ts), the local
// preview with the privacy line (src/parts/library.ts), and the upload.

import type { ScreenProps } from "../app/router";
import { el, link } from "../parts/dom";
import { frame, load } from "../parts/frame";

export function mountUpload(root: HTMLElement, { client, params, signal }: ScreenProps<"projectId">) {
  const { block } = frame(root);
  const heading = el("h1", undefined, "Upload a chat export");
  load(block, {
    keep: [heading],
    line: "Finding the project…",
    request: () => client.projects.get(params.projectId),
    signal,
    show: (project) => {
      block.replaceChildren(
        heading,
        el("p", undefined, `Into ${project.name}.`),
        el("p", undefined, link(`Back to ${project.name}`, `/app/projects/${encodeURIComponent(project.id)}`)),
      );
    },
  });
}
