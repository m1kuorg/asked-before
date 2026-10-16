// The Stack screen. It sends your message ids and texts to the group route
// once per load, builds the cards, and sets them in the Centre Rail: keys A
// to E in the margin, then the privacy line; the chosen card in the block.
// It only marks up #25's class names; public/styles.css styles them.

import { postJson, toGroupRequest } from "../api";
import { buildCards } from "../cards";
import { PRIVACY_LINE } from "../main";
import type { Borrow, Card, Message, StackProps } from "../types";

/** One load's cards and the chosen key, kept across remounts so the stack groups once per load. */
type Stack = { messages: Message[]; cards: Card[]; chosen: number };
let kept: Stack | undefined;

const keyLetter = (index: number) => String.fromCharCode(65 + index);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text: string, className: string | undefined, onClick: () => void) {
  const node = el("button", className, text);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

function time(date: string) {
  const node = el("time", undefined, date);
  node.dateTime = date;
  return node;
}

/** The rail, cut where the year turns: one `.rail` per year of borrows, oldest first. */
function rails(borrows: Borrow[]) {
  const years = Map.groupBy(borrows, (borrow) => borrow.date.slice(0, 4));
  return [...years].map(([year, inYear]) => {
    const rail = el("ol", "rail");
    rail.setAttribute("aria-label", `Borrowed in ${year}`);
    for (const borrow of inYear) {
      const key = el("span", "rail-key");
      key.setAttribute("aria-hidden", "true");
      const stamp = el("span", "stamp");
      stamp.append(time(borrow.date));
      const row = el("li");
      row.append(el("span", "phrasing", borrow.text), " ", key, " ", stamp);
      rail.append(row);
    }
    return rail;
  });
}

export function mountStack(root: HTMLElement, { messages, returned, onOpen }: StackProps) {
  const margin = el("aside", "margin");
  const privacy = el("p", "privacy-line", PRIVACY_LINE);
  margin.append(privacy);
  const block = el("section", "block");
  root.append(margin, block);

  if (kept?.messages === messages) showStack(kept);
  else sortMessages();

  async function sortMessages() {
    block.replaceChildren(el("p", "is-waiting", "Cataloging your questions…"));
    try {
      const cards = buildCards(await postJson("/api/group", toGroupRequest(messages)), messages);
      kept = { messages, cards, chosen: 0 };
      showStack(kept);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      block.replaceChildren(
        el("p", "error", `Your questions couldn't be cataloged. ${reason}`),
        button("Try again", "retry", sortMessages),
      );
    }
  }

  function showStack(stack: Stack) {
    if (stack.cards.length === 0) {
      block.replaceChildren(el("p", undefined, "Nothing in this chat export was asked more than once, so there are no cards."));
      return;
    }
    const keys = stack.cards.map((card, index) => {
      const key = button("", "margin-key", () => choose(index));
      if (returned.has(card.skill)) key.classList.add("is-returned");
      key.append(el("b", undefined, keyLetter(index)), " ", el("span", undefined, card.skill), " ", el("span", undefined, String(card.count)));
      return key;
    });
    const list = el("ol");
    for (const key of keys) {
      const item = el("li");
      item.append(key);
      list.append(item);
    }
    margin.replaceChildren(el("h2", undefined, "Keys, most borrowed first"), list, privacy);

    function choose(index: number) {
      stack.chosen = index;
      keys.forEach((key, i) => (i === index ? key.setAttribute("aria-current", "true") : key.removeAttribute("aria-current")));
      showCard(stack.cards[index]!, keyLetter(index));
    }
    choose(stack.chosen);
  }

  function showCard(card: Card, letter: string) {
    const returnedOn = returned.get(card.skill);
    const plate = el("p", "plate");
    plate.append(
      el("b", undefined, String(card.count)),
      " ",
      el("span", undefined, returnedOn ? "times borrowed, returned" : "times borrowed, not returned"),
    );
    // A returned card's rail closes with an end rule, dated the day it was stamped returned.
    const endRule: HTMLElement[] = [];
    if (returnedOn) {
      const rule = el("p", "end-rule", "Returned ");
      rule.append(time(returnedOn));
      endRule.push(rule);
    }
    block.replaceChildren(
      el("h1", "skill", card.skill),
      el("p", undefined, `Key ${letter}: borrowed ${card.count} times, ${card.firstMonth} to ${card.lastMonth}`),
      plate,
      ...rails(card.borrows),
      ...endRule,
      button(`Open key ${letter}`, undefined, () => onOpen(card)),
    );
  }
}
