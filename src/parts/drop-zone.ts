// The drop zone: a recessed well that a file drops into, or that opens the
// file picker. It fills one ramp step down while a file is held over it, and
// hands the chosen file to `onFile`, naming it in the well.

import { el } from "./dom";

export type DropZoneOptions = {
  /** Such as "Drop your chat export here". */
  title: string;
  /** What it takes, such as "The .zip as it came, or its conversations.json". */
  hint: string;
  /** The file input's accept list, such as ".zip,.json". */
  accept: string;
  onFile: (file: File) => void;
};

export function dropZone({ title, hint, accept, onFile }: DropZoneOptions): HTMLLabelElement {
  const input = el("input", "visually-hidden");
  input.type = "file";
  input.accept = accept;
  const chosen = el("span", "drop-zone-file");
  chosen.setAttribute("aria-live", "polite");
  const zone = el(
    "label",
    "drop-zone",
    input,
    el("span", "drop-zone-title", title),
    el("span", undefined, hint),
    el("span", "drop-zone-choose", "Choose a file"),
    chosen,
  );

  const take = (file: File | undefined) => {
    if (!file) return;
    chosen.textContent = file.name;
    onFile(file);
  };
  input.addEventListener("change", () => take(input.files?.[0]));
  // A drag's enter and leave fire for every child it crosses, so the well counts them.
  let held = 0;
  zone.addEventListener("dragenter", (event) => {
    event.preventDefault();
    if (input.disabled) return;
    held++;
    zone.classList.add("is-over");
  });
  zone.addEventListener("dragover", (event) => event.preventDefault());
  zone.addEventListener("dragleave", () => {
    if (--held <= 0) {
      held = 0;
      zone.classList.remove("is-over");
    }
  });
  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    held = 0;
    zone.classList.remove("is-over");
    if (!input.disabled) take(event.dataTransfer?.files[0]);
  });
  return zone;
}
