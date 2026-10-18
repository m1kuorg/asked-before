// The Desk (m1kuorg/basics#47), where signing up and logging in land,
// read from GET /desk. The margin keeps the totals as a ledger: your
// cards borrowed, borrowed again, and returned, in plain numbers. The block
// heads with what's still borrowed across your shelves, most borrowed
// first, over the plate's count of cards not returned, and closes that list
// with the way to a cold rep on the top card. Then your latest borrows on
// the rail, your words facing the card each borrowed, newest first, so the
// keys are already seated; then your latest return stamps.
//
// With no shelves, the empty state offers the demo shelf and a first
// upload: name a shelf, and go to its upload page. With shelves but no
// cards yet, it leads to them.

import type { Desk, DeskBorrow, DeskCard, DeskShelf } from "@asked-before/sdk";
import type { ScreenProps } from "../app/router";
import { phrasing } from "../parts/card";
import { button, el, link, type Child } from "../parts/dom";
import { emptyState } from "../parts/empty";
import { field, form } from "../parts/fields";
import { frame, load, notice, plate } from "../parts/frame";
import { count, demoLabel, stamp } from "../parts/library";
import { messageOf } from "../parts/messages";
import { rows } from "../parts/rows";
import { startDemoShelf } from "./upload";

const cardPath = (cardId: string) => `/app/cards/${encodeURIComponent(cardId)}`;
const shelfPath = (shelfId: string) => `/app/shelves/${encodeURIComponent(shelfId)}`;

const STATUS_NOTE =
  "A card stays borrowed until you pass a cold rep on it, which stamps it returned. A borrow dated after that stamp makes it borrowed again.";

export function mountDesk(root: HTMLElement, { client, navigate, signal }: ScreenProps) {
  const { margin, block } = frame(root);
  const heading = el("h1", undefined, "Still borrowed");

  load(block, {
    keep: [heading],
    line: "Finding your cards…",
    request: () => client.desk.get(),
    signal,
    show: (desk) => {
      const out = desk.totals.borrowed + desk.totals.borrowedAgain;
      const counted = plate(count(out), out === 1 ? "card borrowed, not returned" : "cards borrowed, not returned");
      if (!desk.totals.cards) {
        margin.replaceChildren(el("p", undefined, "Your cards from every shelf are counted here, with the ones you still borrow at the top."), el("p", undefined, STATUS_NOTE));
        block.replaceChildren(heading, counted, ...(desk.shelves ? noCardsYet() : firstVisit()));
        return;
      }
      margin.replaceChildren(...ledger(desk));
      // The margin explains the cut whenever the latest borrows span more than one year.
      if (new Set(desk.latestBorrows.map((borrow) => new Date(borrow.time).getFullYear())).size > 1) margin.append(el("p", undefined, "A cut in the rail marks where the year turns."));
      block.replaceChildren(heading, ...stillBorrowed(desk, counted), latestBorrows(desk.latestBorrows), latestReturns(desk.latestReturns));
    },
  });

  /** A new learner's empty state: the demo shelf, or a first shelf to upload to. */
  function firstVisit(): Node[] {
    const demo = button("Try the demo shelf", async () => {
      demo.disabled = true;
      demo.parentElement?.querySelector(".error")?.remove();
      try {
        await startDemoShelf(client, navigate);
      } catch (error) {
        demo.disabled = false;
        demo.after(notice(messageOf(error)));
      }
    });
    const name = field({ label: "Or name your first shelf", name: "name", placeholder: "Such as Work or Bootcamp", autocomplete: "off" });
    const first = form({
      fields: [name.element],
      submit: "Upload a chat export",
      layout: "row",
      className: "first-shelf",
      onSubmit: async () => {
        const made = await client.shelves.create({ name: name.input.value });
        navigate(`${shelfPath(made.id)}/upload`);
      },
    });
    first.querySelector("button")!.classList.add("secondary");
    return [
      emptyState(
        "No cards yet",
        "Every question you've asked a chatbot more than once becomes a card, kept here until you pass a cold rep on it. Try the demo shelf to see a sorted history, made from a demo chat export.",
        demo,
      ),
      first,
    ];
  }

  /** Shelves, but no cards on any of them yet. */
  function noCardsYet(): Node[] {
    return [
      emptyState(
        "No cards yet",
        "A card appears once a shelf's uploads hold the same question twice. Open one of your shelves to upload a chat export to it, or to see its upload history.",
        link("Go to your shelves", "/app/shelves", "button"),
      ),
    ];
  }

  /** The margin's ledger: your cards by status, in plain numbers, and what they're counted across. */
  function ledger({ totals, shelves }: Desk): Node[] {
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
      el("p", undefined, shelves === 1 ? "Counted on your one shelf." : `Counted across your ${count(shelves)} shelves.`),
      el("p", undefined, STATUS_NOTE),
    ];
  }

  /** The cards no cold rep has returned, most borrowed first, and the way to a cold rep on the top one. */
  function stillBorrowed({ mostBorrowed, totals }: Desk, counted: HTMLElement): Node[] {
    const out = totals.borrowed + totals.borrowedAgain;
    if (!mostBorrowed.length) {
      return [
        counted,
        emptyState("Every card is returned", "Each card's latest cold rep passed after its latest borrow. A card comes back here when you borrow it again."),
      ];
    }
    const lede =
      mostBorrowed.length < out
        ? `The ${count(mostBorrowed.length)} most borrowed of the ${count(out)} cards no cold rep has returned yet. Each shelf's page has the rest.`
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
          { label: "Shelf", className: "is-shelf", cell: shelfTitle },
          { label: "Borrows", numeric: true, className: "is-count", cell: (card) => count(card.count) },
          { label: "Last borrow", numeric: true, className: "is-date", cell: (card) => stamp(card.lastBorrowAt) },
        ],
      }),
      // ?rep=start has the card page start the rep at once, since this action already says it takes one.
      link(`Take a cold rep on ${top.skill}`, `${cardPath(top.id)}?rep=start`, "button take-rep"),
    ];
  }

  /** Your latest borrows on the rail, newest first: your words, a key, then the stamp and the card each borrowed. A cut marks where the year turns. */
  function latestBorrows(borrows: DeskBorrow[]): HTMLElement {
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

  /** Your latest return stamps: each card, its shelf, and the day its cold rep passed; one borrowed again since says so. */
  function latestReturns(returns: DeskCard[]): HTMLElement {
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
          { label: "Shelf", className: "is-shelf", cell: shelfTitle },
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
   * margin key is on its shelf's page.
   */
  function cardTitle(card: DeskCard, status: Child[] | null, { struck = false } = {}): Child[] {
    const skill = link("", cardPath(card.id));
    skill.append(struck ? el("span", "is-struck", card.skill) : card.skill);
    const title = el("span", "row-title", skill);
    return status ? [title, el("span", "card-status", ...status)] : [title];
  }

  function shelfTitle({ shelf }: { shelf: DeskShelf }): HTMLElement {
    const title = el("span", "row-title", link(shelf.name, shelfPath(shelf.id)));
    if (shelf.demo) title.append(demoLabel());
    return title;
  }
}
