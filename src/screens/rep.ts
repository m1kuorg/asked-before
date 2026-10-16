// The Rep screen, as a placeholder until m1kuorg/basics#29 lands: its input,
// one card, as plain text, with its one hand-back control.

import type { RepProps } from "../types";

export function mountRep(root: HTMLElement, { card, onReturned }: RepProps) {
  const heading = document.createElement("p");
  heading.textContent = `${card.skill}, borrowed ${card.count} times, ${card.firstMonth} to ${card.lastMonth}.`;
  const list = document.createElement("ol");
  for (const borrow of card.borrows) {
    const item = document.createElement("li");
    item.textContent = `${borrow.date}: ${borrow.text}`;
    list.append(item);
  }
  const stamp = document.createElement("button");
  stamp.textContent = "Stamp returned";
  stamp.addEventListener("click", () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    onReturned(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
  });
  root.append(heading, list, stamp);
}
