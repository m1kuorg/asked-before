// One project (m1kuorg/basics#45): its card stack, set in the proof of
// concept's Centre Rail (public/styles/stack.css). The margin names the
// project, with its demo-data label, then keys its cards A, B, C, … most
// borrowed first, ties to the later last borrow, as the API lists them. The
// block holds the chosen card: its skill, its count and months, its plate,
// and every phrasing word for word beside its stamp, one rail per year of
// borrows, with stamps and months in the learner's own time zone. Choosing
// a key sets its card in the block, and ?card=<id> keeps the choice.
//
// A card's status comes from the API and adds no ink: a returned card's
// margin key is struck through, and its rail closes with an end rule dated
// the day it was stamped returned, its keys already seated; a card borrowed
// again says so under its key and its rail, and its keys drop again.

import type { Card, CardDetail, CardStatus, Project } from "@asked-before/sdk";
import type { ScreenProps } from "../app/router";
import { button, el, link, type Child } from "../parts/dom";
import { emptyState } from "../parts/empty";
import { failure, frame, load, plate } from "../parts/frame";
import { demoLabel, privacyLine, stamp } from "../parts/library";

const projectPath = (projectId: string) => `/app/projects/${encodeURIComponent(projectId)}`;
const uploadPath = (projectId: string) => `${projectPath(projectId)}/upload`;
const cardPath = (cardId: string) => `/app/cards/${encodeURIComponent(cardId)}`;

/** What the plate's count is, after the card's status. */
const PLATE_CAPTION: Record<CardStatus, string> = {
  borrowed: "times borrowed, not returned",
  returned: "times borrowed, returned",
  borrowed_again: "times borrowed, borrowed again",
};

const monthYear = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const month = (iso: string) => monthYear.format(new Date(iso));

/** A card's key: A to Z, then AA, AB, and so on. */
function keyLetter(index: number): string {
  let letters = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  return letters;
}

/**
 * A phrasing's words, with each command flag (`-m`, `--soft`) in a bare
 * span, so the stylesheet keeps the flag on one line. The split's capture
 * group puts the flags at the odd indexes.
 */
function phrasing(text: string): HTMLElement {
  return el("span", "phrasing", ...text.split(/((?<![\w-])--?\w[\w-]*)/).map((part, i) => (i % 2 ? el("span", undefined, part) : part)));
}

/** The rail, cut where the year turns: one `.rail` per year of borrows, oldest first, a key for each. */
function rails(borrows: CardDetail["borrows"]): HTMLElement[] {
  const years = Map.groupBy(borrows, (borrow) => new Date(borrow.time).getFullYear());
  return [...years].map(([year, inYear]) => {
    const rail = el(
      "ol",
      "rail",
      ...inYear.map((borrow) => {
        const key = el("span", "rail-key");
        key.setAttribute("aria-hidden", "true");
        return el("li", undefined, phrasing(borrow.text), key, el("span", "stamp", stamp(borrow.time)));
      }),
    );
    rail.setAttribute("aria-label", `Borrowed in ${year}`);
    return rail;
  });
}

export function mountProject(root: HTMLElement, { client, params, query, signal }: ScreenProps<"projectId">) {
  const { margin, block } = frame(root);
  const yearCut = el("p", undefined, "A cut in the rail marks a new year of asking.");
  const privacy = privacyLine();

  load(block, {
    keep: [el("h1", undefined, "Project")],
    line: "Finding the project's cards…",
    request: async () => {
      const [project, cards] = await Promise.all([client.projects.get(params.projectId), client.cards.list(params.projectId)]);
      const chosen = cards.find((card) => card.id === query.get("card")) ?? cards[0];
      return { project, cards, chosen: chosen && (await client.cards.get(chosen.id)) };
    },
    signal,
    show: ({ project, cards, chosen }) => {
      document.title = `${project.name} · Asked Before`;
      if (!chosen) return noCards(project);
      stack(project, cards, chosen);
    },
  });

  /** A project with no cards yet: its name heads the block, over a plate of none. */
  function noCards(project: Project) {
    const heading = el("div", "heading", el("h1", undefined, project.name));
    if (project.demo) heading.append(demoLabel());
    margin.replaceChildren(privacy);
    block.replaceChildren(
      heading,
      plate(0, "cards"),
      emptyState(
        "No cards yet",
        "Upload a chat export into this project, and every question you asked more than once becomes a card.",
        link("Upload a chat export", uploadPath(project.id), "button"),
      ),
    );
  }

  /** The stack: the project's keys in the margin, and the chosen card in the block. */
  function stack(project: Project, cards: Card[], first: CardDetail) {
    const details = new Map<string, CardDetail>([[first.id, first]]);
    let chosen = first.id;

    const keys = cards.map((card, index) => {
      const key = button("", () => void choose(card, index), card.status === "returned" ? "margin-key is-returned" : "margin-key");
      const skill = el("span", undefined, card.skill);
      // The strike is read by no one, so a returned key also says so in words; a key borrowed again says it under its skill.
      if (card.status === "returned") skill.append(el("span", "visually-hidden", ", returned"));
      if (card.status === "borrowed_again") skill.append(" ", el("span", "key-status", "Borrowed again"));
      key.append(el("b", undefined, keyLetter(index)), " ", skill, " ", el("span", undefined, String(card.count)));
      return key;
    });
    const name = el("p", "project-name", project.name);
    if (project.demo) name.append(demoLabel());
    margin.replaceChildren(name, el("h2", undefined, "Keys, most borrowed first"), el("ol", undefined, ...keys.map((key) => el("li", undefined, key))), privacy);

    const index = cards.findIndex((card) => card.id === first.id);
    mark(index);
    showCard(first, keyLetter(index));

    function mark(index: number) {
      keys.forEach((key, i) => (i === index ? key.setAttribute("aria-current", "true") : key.removeAttribute("aria-current")));
    }

    async function choose(card: Card, index: number) {
      chosen = card.id;
      mark(index);
      history.replaceState(null, "", `${projectPath(project.id)}?card=${encodeURIComponent(card.id)}`);
      try {
        const detail = details.get(card.id) ?? (await client.cards.get(card.id));
        details.set(card.id, detail);
        if (chosen === card.id && !signal.aborted) showCard(detail, keyLetter(index));
      } catch (error) {
        if (chosen === card.id && !signal.aborted) block.replaceChildren(el("h1", "skill", card.skill), ...failure(error, () => void choose(card, index)));
      }
    }
  }

  /** One card in the block: its skill, its count and months, its plate, its rails, and the way to its cold rep. */
  function showCard(card: CardDetail, letter: string) {
    const cardRails = rails(card.borrows);
    // The margin explains the cut whenever the card's borrows span more than one year.
    if (cardRails.length > 1) privacy.before(yearCut);
    else yearCut.remove();
    const [from, to] = [month(card.firstBorrowAt), month(card.lastBorrowAt)];
    const children: Child[] = [
      el("h1", "skill", card.skill),
      el("p", undefined, `Key ${letter}: borrowed ${card.count} times, ${from === to ? `in ${from}` : `${from} to ${to}`}`),
      plate(card.count, PLATE_CAPTION[card.status]),
      ...cardRails,
    ];
    if (card.returnedAt && card.status === "returned") children.push(el("p", "end-rule", "Returned ", stamp(card.returnedAt)));
    if (card.returnedAt && card.status === "borrowed_again") children.push(el("p", undefined, "Returned ", stamp(card.returnedAt), ", then borrowed again."));
    children.push(link(`Open key ${letter}`, cardPath(card.id), "button"));
    block.replaceChildren(...children);
  }
}
