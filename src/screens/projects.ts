// The projects list (m1kuorg/basics#42): a row per project with its cards,
// how many are borrowed and returned, and its last upload, and the quiet
// actions to rename it in its row or delete it after a confirmation; then
// the field that makes a new one. With no projects, an empty state says
// what a project is for.

import type { Project } from "@asked-before/sdk";
import type { ScreenProps } from "../app/router";
import { confirmDelete } from "../parts/confirm";
import { button, el, link, uniqueId } from "../parts/dom";
import { emptyState } from "../parts/empty";
import { field, form } from "../parts/fields";
import { frame, load, notice } from "../parts/frame";
import { demoLabel, stamp } from "../parts/library";
import { messageOf } from "../parts/messages";
import { rows } from "../parts/rows";
import { startDemoProject } from "./upload";

export function mountProjects(root: HTMLElement, { client, navigate, signal }: ScreenProps) {
  const { block } = frame(root, [
    el("p", undefined, "A project keeps one part of your history apart, such as Work or Bootcamp."),
    el("p", undefined, "Its cards come only from its own uploads, so a question from one never lands on a card in another."),
  ]);
  const heading = el("h1", undefined, "Projects");

  let projects: Project[] = [];
  /** The project whose name is a field, or whose delete is being confirmed, if any. */
  let renaming: string | null = null;
  let deleting: string | null = null;

  const newProject = field({ label: "New project", name: "name", placeholder: "Such as Work or Bootcamp", autocomplete: "off" });
  const create = form({
    fields: [newProject.element],
    submit: "Create project",
    layout: "row",
    className: "new-project",
    onSubmit: async () => {
      const made = await client.projects.create({ name: newProject.input.value });
      projects = [...projects, made];
      newProject.input.value = "";
      draw();
      newProject.input.focus();
    },
  });

  load(block, {
    keep: [heading],
    line: "Finding your projects…",
    request: () => client.projects.list(),
    signal,
    show: (listed) => {
      projects = listed;
      draw();
    },
  });

  function draw(focus?: () => HTMLElement | null) {
    const list = projects.length
      ? rows({
          caption: "Your projects",
          items: projects,
          columns: [
            { label: "Project", cell: nameCell },
            { label: "Cards", numeric: true, className: "is-count", cell: (p) => String(p.counts.cards) },
            { label: "Borrowed", numeric: true, className: "is-count", cell: (p) => String(p.counts.borrowed + p.counts.borrowedAgain) },
            { label: "Returned", numeric: true, className: "is-count", cell: (p) => String(p.counts.returned) },
            { label: "Last upload", numeric: true, className: "is-date", cell: (p) => (p.lastUploadAt ? stamp(p.lastUploadAt) : "None yet") },
            { label: "Actions", hiddenLabel: true, className: "is-actions", cell: actionsCell },
          ],
          detail: (p) => (p.id === deleting ? confirmation(p) : null),
        })
      : emptyState(
          "No projects yet",
          "Make one for each part of your life you ask a chatbot about. Then upload a chat export into it, and every question you asked more than once becomes a card.",
          demoButton(),
        );
    block.replaceChildren(heading, list, create);
    focus?.()?.focus();
  }

  /** The demo action (m1kuorg/basics#43): a project flagged demo, with the demo export uploaded into it. */
  function demoButton() {
    const demo = button("Try the demo project", async () => {
      demo.disabled = true;
      demo.parentElement?.querySelector(".error")?.remove();
      try {
        await startDemoProject(client, navigate);
      } catch (error) {
        demo.disabled = false;
        demo.after(notice(messageOf(error)));
      }
    }, "secondary");
    return demo;
  }

  function nameCell(project: Project) {
    if (project.id !== renaming) {
      const title = el("span", "row-title", link(project.name, `/app/projects/${encodeURIComponent(project.id)}`));
      if (project.demo) title.append(demoLabel());
      return title;
    }
    const input = el("input");
    input.value = project.name;
    input.setAttribute("aria-label", `Name of ${project.name}`);
    input.setAttribute("form", formId(project));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") stopRenaming(project);
    });
    queueMicrotask(() => {
      if (input.isConnected) input.select();
    });
    return input;
  }

  function actionsCell(project: Project) {
    if (project.id === renaming) {
      // The rename form holds no cells of its own: the name's field and these buttons name it by id.
      const rename = el("form");
      rename.id = formId(project);
      rename.noValidate = true;
      const save = el("button", undefined, "Save");
      save.setAttribute("form", rename.id);
      rename.addEventListener("submit", async (event) => {
        event.preventDefault();
        const input = document.querySelector<HTMLInputElement>(`input[form="${rename.id}"]`)!;
        save.disabled = true;
        try {
          const renamed = await client.projects.rename(project.id, input.value);
          projects = projects.map((p) => (p.id === project.id ? renamed : p));
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
      return [rename, save, button("Cancel", () => stopRenaming(project), "quiet")];
    }
    const rename = button("Rename", () => {
      renaming = project.id;
      deleting = null;
      draw();
    }, "quiet");
    rename.setAttribute("aria-label", `Rename ${project.name}`);
    const remove = button("Delete", () => {
      deleting = deleting === project.id ? null : project.id;
      renaming = null;
      draw(deleting ? undefined : () => deleteButton(project));
    }, "quiet");
    remove.setAttribute("aria-label", `Delete ${project.name}`);
    remove.setAttribute("aria-expanded", String(deleting === project.id));
    return [rename, remove];
  }

  function confirmation(project: Project) {
    return confirmDelete({
      title: `Delete ${project.name}?`,
      body: "This deletes the project and everything in it: its uploads, phrasings, cards, and reps. It can't be undone.",
      action: `Delete ${project.name}`,
      onConfirm: async () => {
        await client.projects.delete(project.id);
        projects = projects.filter((p) => p.id !== project.id);
        deleting = null;
        draw(() => (projects.length ? null : newProject.input));
      },
      onCancel: () => {
        deleting = null;
        draw(() => deleteButton(project));
      },
    });
  }

  function stopRenaming(project: Project) {
    renaming = null;
    draw(() => renameButton(project));
  }

  const formId = (project: Project) => `rename-${project.id}`;
  const rowOf = (project: Project) =>
    [...block.querySelectorAll<HTMLTableRowElement>("tbody tr")].find((row) => row.querySelector(`a[href$="/${CSS.escape(encodeURIComponent(project.id))}"]`));
  const renameButton = (project: Project) => rowOf(project)?.querySelector<HTMLElement>("button[aria-label^='Rename']") ?? null;
  const deleteButton = (project: Project) => rowOf(project)?.querySelector<HTMLElement>("button[aria-label^='Delete']") ?? null;
}
