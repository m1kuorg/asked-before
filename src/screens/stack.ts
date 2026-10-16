// The Stack screen, as a placeholder until m1kuorg/basics#28 lands: its inputs
// as plain text, with its open control. It sends no group request; so that the
// page can be walked end to end, the card builder stacks every message on one
// card that says it's a placeholder.

import { buildCards } from "../cards";
import { PRIVACY_LINE } from "../main";
import type { StackProps } from "../types";

const PLACEHOLDER_SKILL = "Every message, until grouping is built";

export function mountStack(root: HTMLElement, { messages, returned, onOpen }: StackProps) {
  const paragraph = (text: string, className?: string) => {
    const p = document.createElement("p");
    if (className) p.className = className;
    p.textContent = text;
    return p;
  };
  const returnedText = [...returned].map(([skill, date]) => `${skill} on ${date}`).join(", ") || "none";
  root.append(
    paragraph(`${messages.length} of your own messages. Returned: ${returnedText}.`),
    paragraph(PRIVACY_LINE, "privacy-line"),
  );

  const [card] = buildCards({ skills: [{ name: PLACEHOLDER_SKILL, messageIds: messages.map((m) => m.id) }] }, messages);
  if (!card) {
    root.append(paragraph("Nothing was asked more than once."));
    return;
  }
  const open = document.createElement("button");
  open.textContent = "Open key A";
  open.addEventListener("click", () => onOpen(card));
  root.append(paragraph(`A: ${card.skill}, ${card.count} borrows, ${card.firstMonth} to ${card.lastMonth}.`), open);
}
