// The dashboard (m1kuorg/basics#47), where signing up and logging in land,
// read from GET /dashboard. The margin keeps the totals as a ledger: your
// cards borrowed, borrowed again, and returned, in plain numbers. The block
// heads with what's still borrowed across your projects, most borrowed
// first, over the plate's count of cards not returned, and closes that list
// with the way to a cold rep on the top card. Then your latest borrows on
// the rail, your words facing the card each borrowed, newest first, so the
// keys are already seated; then your latest return stamps.
//
// With no projects, the empty state offers the demo project and a first
// upload: name a project, and go to its upload page. With projects but no
// cards yet, it leads to them.

import type { Dashboard, DashboardBorrow, DashboardCard, DashboardProject } from "@asked-before/sdk";
import type { ScreenProps } from "../app/router";
import { phrasing } from "../parts/card";
import { button, el, link, type Child } from "../parts/dom";
import { emptyState } from "../parts/empty";
import { field, form } from "../parts/fields";
import { frame, load, notice, plate } from "../parts/frame";
import { count, demoLabel, stamp } from "../parts/library";
import { messageOf } from "../parts/messages";
import { rows } from "../parts/rows";
import { startDemoProject } from "./upload";

const cardPath = (cardId: string) => `/app/cards/${encodeURIComponent(cardId)}`;
const projectPath = (projectId: string) => `/app/projects/${encodeURIComponent(projectId)}`;

const STATUS_NOTE =
  "A card stays borrowed until you pass a cold rep on it, which stamps it returned. A borrow dated after that stamp makes it borrowed again.";

export function mountDashboard(root: HTMLElement, { client, navigate, signal }: ScreenProps) {
  const { margin, block } = frame(root);
  const heading = el("h1", undefined, "Still borrowed");

  load(block, {
    keep: [heading],
    line: "Finding your cards…",
    request: () => client.dashboard.get(),
    signal,
    show: (dashboard) => {
      const out = dashboard.totals.borrowed + dashboard.totals.borrowedAgain;
      const counted = plate(count(out), out === 1 ? "card borrowed, not returned" : "cards borrowed, not returned");
      if (!dashboard.totals.cards) {
        margin.replaceChildren(el("p", undefined, "Your cards from every project are counted here, with the ones you still borrow at the top."), el("p", undefined, STATUS_NOTE));
        block.replaceChildren(heading, counted, ...(dashboard.projects ? noCardsYet() : firstVisit()));
        return;
      }
      margin.replaceChildren(...ledger(dashboard));
      // The margin explains the cut whenever the latest borrows span more than one year.
      if (new Set(dashboard.latestBorrows.map((borrow) => new Date(borrow.time).getFullYear())).size > 1) margin.append(el("p", undefined, "A cut in the rail marks where the year turns."));
      block.replaceChildren(heading, ...stillBorrowed(dashboard, counted), latestBorrows(dashboard.latestBorrows), latestReturns(dashboard.latestReturns));
    },
  });

  /** A new learner's empty state: the demo project, or a first project to upload into. */
  function firstVisit(): Node[] {
    const demo = button("Try the demo project", async () => {
      demo.disabled = true;
      demo.parentElement?.querySelector(".error")?.remove();
      try {
        await startDemoProject(client, navigate);
      } catch (error) {
        demo.disabled = false;
        demo.after(notice(messageOf(error)));
      }
    });
    const name = field({ label: "Or name your first project", name: "name", placeholder: "Such as Work or Bootcamp", autocomplete: "off" });
    const first = form({
      fields: [name.element],
      submit: "Upload a chat export",
      layout: "row",
      className: "first-project",
      onSubmit: async () => {
        const made = await client.projects.create({ name: name.input.value });
        navigate(`${projectPath(made.id)}/upload`);
      },
    });
    first.querySelector("button")!.classList.add("secondary");
    return [
      emptyState(
        "No cards yet",
        "Every question you've asked a chatbot more than once becomes a card, kept here until you pass a cold rep on it. Try the demo project to see a sorted history, made from a demo chat export.",
        demo,
      ),
      first,
    ];
  }

  /** Projects, but no cards in any of them yet. */
  function noCardsYet(): Node[] {
    return [
      emptyState(
        "No cards yet",
        "A card appears once a project's uploads hold the same question twice. Open one of your projects to upload a chat export into it, or to see its upload history.",
        link("Go to your projects", "/app/projects", "button"),
      ),
    ];
  }

  /** The margin's ledger: your cards by status, in plain numbers, and what they're counted across. */
  function ledger({ totals, projects }: Dashboard): Node[] {
    const line = (word: string, n: number, className?: string) => el("div", className, el("dt", undefined, word), el("dd", undefined, count(n)));
    return [
      el("h2", undefined, "Your cards"),
      el(
        "dl",
        "ledger",
        line("Borrowed", totals.borrowed),
        line("Borrowed again", totals.borrowedAgain),
        line("Returned", totals.returned),
        line("All cards", totals.cards, "ledger-total"),
      ),
      el("p", undefined, projects === 1 ? "Counted in your one project." : `Counted across your ${count(projects)} projects.`),
      el("p", undefined, STATUS_NOTE),
    ];
  }

  /** The cards no cold rep has returned, most borrowed first, and the way to a cold rep on the top one. */
  function stillBorrowed({ mostBorrowed, totals }: Dashboard, counted: HTMLElement): Node[] {
    const out = totals.borrowed + totals.borrowedAgain;
    if (!mostBorrowed.length) {
      return [
        counted,
        emptyState("Every card is returned", "Each card's latest cold rep passed after its latest borrow. A card comes back here when you borrow it again."),
      ];
    }
    const lede =
      mostBorrowed.length < out
        ? `The ${count(mostBorrowed.length)} most borrowed of the ${count(out)} cards no cold rep has returned yet. Each project's page has the rest.`
        : "Cards no cold rep has returned yet, most borrowed first.";
    const top = mostBorrowed[0]!;
    return [
      el("p", undefined, lede),
      counted,
      rows({
        caption: "Cards not returned, most borrowed first",
        items: mostBorrowed,
        columns: [
          { label: "Card", cell: (card) => cardTitle(card, card.status === "borrowed_again" ? ["Borrowed again"] : null) },
          { label: "Project", className: "is-project", cell: projectTitle },
          { label: "Borrows", numeric: true, className: "is-count", cell: (card) => count(card.count) },
          { label: "Last borrow", numeric: true, className: "is-date", cell: (card) => stamp(card.lastBorrowAt) },
        ],
      }),
      link(`Take a cold rep on ${top.skill}`, cardPath(top.id), "button take-rep"),
    ];
  }

  /** Your latest borrows on the rail, newest first: your words, a key, then the stamp and the card each borrowed. A cut marks where the year turns. */
  function latestBorrows(borrows: DashboardBorrow[]): HTMLElement {
    const years = Map.groupBy(borrows, (borrow) => new Date(borrow.time).getFullYear());
    const rails = [...years].map(([year, inYear]) => {
      const rail = el(
        "ol",
        "rail",
        ...inYear.map((borrow) => {
          const key = el("span", "rail-key");
          key.setAttribute("aria-hidden", "true");
          return el("li", undefined, phrasing(borrow.text), key, el("span", "stamp", stamp(borrow.time), link(borrow.card.skill, cardPath(borrow.card.id))));
        }),
      );
      rail.setAttribute("aria-label", `Borrowed in ${year}, newest first`);
      return rail;
    });
    return section("latest-borrows", "Latest borrows", el("p", undefined, "What you asked most recently, newest first, beside the card each one borrowed."), ...rails);
  }

  /** Your latest return stamps: each card, its project, and the day its cold rep passed; one borrowed again since says so. */
  function latestReturns(returns: DashboardCard[]): HTMLElement {
    if (!returns.length) {
      return section("latest-returns", "Latest returns", el("p", undefined, "No card is returned yet. A card is stamped returned the day you pass a cold rep on it."));
    }
    return section(
      "latest-returns",
      "Latest returns",
      rows({
        caption: "Cards returned, latest stamp first",
        items: returns,
        columns: [
          { label: "Card", cell: (card) => cardTitle(card, card.status === "borrowed_again" ? ["Borrowed again ", stamp(card.lastBorrowAt)] : null, { struck: card.status === "returned" }) },
          { label: "Project", className: "is-project", cell: projectTitle },
          { label: "Returned", numeric: true, className: "is-date", cell: (card) => stamp(card.returnedAt!) },
        ],
      }),
    );
  }

  function section(className: string, title: string, ...children: Child[]): HTMLElement {
    return el("section", className, el("h2", undefined, title), ...children);
  }

  /**
   * A card's skill, leading to the card and its cold rep, with its status
   * under it when it needs saying. A returned card's skill is struck, as its
   * margin key is on its project's page.
   */
  function cardTitle(card: DashboardCard, status: Child[] | null, { struck = false } = {}): Child[] {
    const skill = link("", cardPath(card.id));
    skill.append(struck ? el("span", "is-struck", card.skill) : card.skill);
    const title = el("span", "row-title", skill);
    return status ? [title, el("span", "card-status", ...status)] : [title];
  }

  function projectTitle({ project }: { project: DashboardProject }): HTMLElement {
    const title = el("span", "row-title", link(project.name, projectPath(project.id)));
    if (project.demo) title.append(demoLabel());
    return title;
  }
}
