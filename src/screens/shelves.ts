// The shelves list (m1kuorg/basics#42): a row per shelf with its cards,
// how many are borrowed and returned, and its last upload, and the quiet
// actions to rename it in its row or delete it after a confirmation; then
// the field that makes a new one. With no shelves, an empty state says
// what a shelf is for.

import type { Shelf } from "@asked-before/sdk";
import type { ScreenProps } from "../app/router";
import { confirmDelete } from "../parts/confirm";
import { button, el, link, uniqueId } from "../parts/dom";
import { emptyState } from "../parts/empty";
import { field, form } from "../parts/fields";
import { frame, load, notice } from "../parts/frame";
import { demoLabel, stamp } from "../parts/library";
import { messageOf } from "../parts/messages";
import { rows } from "../parts/rows";
import { startDemoShelf } from "./upload";

export function mountShelves(root: HTMLElement, { client, navigate, signal }: ScreenProps) {
  const { block } = frame(root, [
    el("p", undefined, "A shelf keeps one part of your history apart, such as Work or Bootcamp."),
    el("p", undefined, "Its cards come only from its own uploads, so a question from one never lands on another's card."),
  ]);
  const heading = el("h1", undefined, "Shelves");

  let shelves: Shelf[] = [];
  /** The shelf whose name is a field, or whose delete is being confirmed, if any. */
  let renaming: string | null = null;
  let deleting: string | null = null;

  const newShelf = field({ label: "New shelf", name: "name", placeholder: "Such as Work or Bootcamp", autocomplete: "off" });
  const create = form({
    fields: [newShelf.element],
    submit: "Add shelf",
    layout: "row",
    className: "new-shelf",
    onSubmit: async () => {
      const made = await client.shelves.create({ name: newShelf.input.value });
      shelves = [...shelves, made];
      newShelf.input.value = "";
      draw();
      newShelf.input.focus();
    },
  });

  load(block, {
    keep: [heading],
    line: "Finding your shelves…",
    request: () => client.shelves.list(),
    signal,
    show: (listed) => {
      shelves = listed;
      draw();
    },
  });

  function draw(focus?: () => HTMLElement | null) {
    const list = shelves.length
      ? rows({
          caption: "Your shelves",
          items: shelves,
          columns: [
            { label: "Shelf", cell: nameCell },
            { label: "Cards", numeric: true, className: "is-count", cell: (p) => String(p.counts.cards) },
            { label: "Borrowed", numeric: true, className: "is-count", cell: (p) => String(p.counts.borrowed + p.counts.borrowedAgain) },
            { label: "Returned", numeric: true, className: "is-count", cell: (p) => String(p.counts.returned) },
            { label: "Last upload", numeric: true, className: "is-date", cell: (p) => (p.lastUploadAt ? stamp(p.lastUploadAt) : "None yet") },
            { label: "Actions", actions: true, className: "is-actions", cell: actionsCell },
          ],
          detail: (p) => (p.id === deleting ? confirmation(p) : null),
        })
      : emptyState(
          "No shelves yet",
          "Make one for each part of your life you ask a chatbot about. Then upload a chat export to it, and every question you asked more than once becomes a card.",
          demoButton(),
        );
    block.replaceChildren(heading, list, create);
    focus?.()?.focus();
  }

  /** The demo action (m1kuorg/basics#43): a shelf flagged demo, with the demo export uploaded onto it. */
  function demoButton() {
    const demo = button("Try the demo shelf", async () => {
      demo.disabled = true;
      demo.parentElement?.querySelector(".error")?.remove();
      try {
        await startDemoShelf(client, navigate);
      } catch (error) {
        demo.disabled = false;
        demo.after(notice(messageOf(error)));
      }
    }, "secondary");
    return demo;
  }

  function nameCell(shelf: Shelf) {
    if (shelf.id !== renaming) {
      const title = el("span", "row-title", link(shelf.name, `/app/shelves/${encodeURIComponent(shelf.id)}`));
      if (shelf.demo) title.append(demoLabel());
      return title;
    }
    const input = el("input");
    input.value = shelf.name;
    input.setAttribute("aria-label", `Name of ${shelf.name}`);
    input.setAttribute("form", formId(shelf));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") stopRenaming(shelf);
    });
    queueMicrotask(() => {
      if (input.isConnected) input.select();
    });
    return input;
  }

  function actionsCell(shelf: Shelf) {
    if (shelf.id === renaming) {
      // The rename form holds no cells of its own: the name's field and these buttons name it by id.
      const rename = el("form");
      rename.id = formId(shelf);
      rename.noValidate = true;
      const save = el("button", undefined, "Save");
      save.setAttribute("form", rename.id);
      rename.addEventListener("submit", async (event) => {
        event.preventDefault();
        const input = document.querySelector<HTMLInputElement>(`input[form="${rename.id}"]`)!;
        save.disabled = true;
        try {
          const renamed = await client.shelves.rename(shelf.id, input.value);
          shelves = shelves.map((p) => (p.id === shelf.id ? renamed : p));
          renaming = null;
          draw(() => renameButton(renamed));
        } catch (error) {
          save.disabled = false;
          input.closest("td")!.querySelector(".error")?.remove();
          const shown = notice(messageOf(error));
          shown.id = uniqueId("notice");
          input.after(shown);
          input.setAttribute("aria-invalid", "true");
          input.setAttribute("aria-describedby", shown.id);
          input.focus();
        }
      });
      return [rename, save, button("Cancel", () => stopRenaming(shelf), "quiet")];
    }
    const rename = button("Rename", () => {
      renaming = shelf.id;
      deleting = null;
      draw();
    }, "quiet");
    rename.setAttribute("aria-label", `Rename ${shelf.name}`);
    const remove = button("Delete", () => {
      deleting = deleting === shelf.id ? null : shelf.id;
      renaming = null;
      draw(deleting ? undefined : () => deleteButton(shelf));
    }, "quiet");
    remove.setAttribute("aria-label", `Delete ${shelf.name}`);
    remove.setAttribute("aria-expanded", String(deleting === shelf.id));
    return [rename, remove];
  }

  function confirmation(shelf: Shelf) {
    return confirmDelete({
      title: `Delete ${shelf.name}?`,
      body: "This deletes the shelf and everything on it: its uploads, phrasings, cards, and reps. It can't be undone.",
      action: `Delete ${shelf.name}`,
      onConfirm: async () => {
        await client.shelves.delete(shelf.id);
        shelves = shelves.filter((p) => p.id !== shelf.id);
        deleting = null;
        draw(() => (shelves.length ? null : newShelf.input));
      },
      onCancel: () => {
        deleting = null;
        draw(() => deleteButton(shelf));
      },
    });
  }

  function stopRenaming(shelf: Shelf) {
    renaming = null;
    draw(() => renameButton(shelf));
  }

  const formId = (shelf: Shelf) => `rename-${shelf.id}`;
  const rowOf = (shelf: Shelf) =>
    [...block.querySelectorAll<HTMLTableRowElement>("tbody tr")].find((row) => row.querySelector(`a[href$="/${CSS.escape(encodeURIComponent(shelf.id))}"]`));
  const renameButton = (shelf: Shelf) => rowOf(shelf)?.querySelector<HTMLElement>("button[aria-label^='Rename']") ?? null;
  const deleteButton = (shelf: Shelf) => rowOf(shelf)?.querySelector<HTMLElement>("button[aria-label^='Delete']") ?? null;
}
