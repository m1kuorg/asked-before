// The shared parts (src/parts/), drawn by their own code for the styles
// check (scripts/styles/parts.ts), which bundles this file and runs it in
// the app's page. Each sample is a screen's frame holding one family of
// parts in the states a screen will show them in.

import { ApiError } from "@asked-before/sdk";
import { confirmDelete } from "../../src/parts/confirm";
import { codeBlock } from "../../src/parts/code-block";
import { button, el, link } from "../../src/parts/dom";
import { dropZone } from "../../src/parts/drop-zone";
import { emptyState } from "../../src/parts/empty";
import { field, form } from "../../src/parts/fields";
import { frame, plate } from "../../src/parts/frame";
import { demoLabel, privacyLine, stamp } from "../../src/parts/library";
import { rows } from "../../src/parts/rows";

const refuse = (message: string) => async () => {
  throw new ApiError(400, message);
};

const SAMPLES: Record<string, (root: HTMLElement) => void> = {
  forms(root) {
    const { block } = frame(root, [el("p", undefined, "A form's fields sit one under another, each label over its box.")]);
    const password = field({ label: "New password", name: "password", type: "password", hint: "At least 10 characters." });
    password.input.value = "too short";
    const column = form({
      fields: [field({ label: "Name", name: "name", value: "Ada Lovelace" }).element, field({ label: "Email", name: "email", type: "email", placeholder: "you@example.com" }).element, password.element],
      submit: "Save",
      onSubmit: refuse("A password needs at least 10 characters."),
    });
    const locked = field({ label: "Server address", name: "server", value: "https://asked-before.example" });
    locked.input.readOnly = true;
    const row = form({ fields: [field({ label: "New project", name: "name", placeholder: "Such as Work or Bootcamp" }).element], submit: "Create project", layout: "row", onSubmit: refuse("A project needs a name.") });
    const off = button("Revoke", () => {});
    off.disabled = true;
    block.append(el("h1", undefined, "Form fields"), column, locked.element, row, off);
    column.requestSubmit();
    row.requestSubmit();
  },

  rows(root) {
    const { block } = frame(root, [el("h2", undefined, "Rows"), el("p", undefined, "Hairlines open and close a list, with Rule Gray between its rows.")]);
    type Key = { name: string; prefix: string; created: string; used: string | null };
    const keys: Key[] = [
      { name: "Laptop agent", prefix: "ab_01a14", created: "2026-10-02T09:12:00Z", used: "2026-10-17T08:30:00Z" },
      { name: "Bootcamp scripts", prefix: "ab_01a15", created: "2026-10-09T18:40:00Z", used: null },
      { name: "Old desktop", prefix: "ab_01a16", created: "2026-09-21T11:05:00Z", used: "2026-09-30T16:00:00Z" },
    ];
    block.append(
      el("div", "heading", el("h1", undefined, "Rows"), demoLabel()),
      plate(3, "API keys"),
      rows({
        caption: "API keys",
        items: keys,
        columns: [
          { label: "Name", cell: (k) => k.name },
          { label: "Prefix", cell: (k) => k.prefix },
          { label: "Created", numeric: true, cell: (k) => stamp(k.created) },
          { label: "Last used", numeric: true, cell: (k) => (k.used ? stamp(k.used) : "Never") },
          { label: "Actions", actions: true, cell: (k) => button("Revoke", () => {}, "quiet") },
        ],
        detail: (k) =>
          k.name === "Old desktop"
            ? confirmDelete({
                title: "Revoke Old desktop?",
                body: "Anything using this key stops reaching Asked Before at once. It can't be undone.",
                action: "Revoke Old desktop",
                onConfirm: refuse("That key is already revoked."),
                onCancel: () => {},
              })
            : null,
      }),
      emptyState("No uploads yet", "Upload a chat export into this project, and every question you asked more than once becomes a card.", link("Upload a chat export", "#", "button"), link("Read how to get one", "#", "button secondary")),
    );
  },

  wells(root) {
    const { block } = frame(root, [privacyLine()]);
    block.append(
      el("h1", undefined, "Wells"),
      dropZone({ title: "Drop your chat export here", hint: "The .zip as it came, or its conversations.json.", accept: ".zip,.json", onFile: () => {} }),
      codeBlock("Claude Code", "claude mcp add asked-before -- bunx asked-before-mcp --server https://asked-before.example"),
      codeBlock("Claude Desktop", '{\n  "mcpServers": {\n    "asked-before": {\n      "command": "bunx",\n      "args": ["asked-before-mcp"],\n      "env": { "ASKED_BEFORE_API_KEY": "ab_01a14_…" }\n    }\n  }\n}'),
    );
  },
};

declare global {
  interface Window {
    showSample: (name: string) => void;
  }
}

window.showSample = (name) => {
  const root = document.querySelector<HTMLElement>("#app")!;
  root.replaceChildren();
  root.dataset.screen = "sample";
  SAMPLES[name]!(root);
};
