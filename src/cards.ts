// The card builder: turns the group route's result and the messages into
// cards. The model only says which messages belong together and names the
// skill; counts and dates come from the messages' timestamps, here.

import type { Card, GroupResponse, Message } from "./types";

export class GroupingError extends Error {
  override name = "GroupingError";
}

export const MAX_SKILL_NAME = 60;

const isoDate = (time: number) => new Date(time * 1000).toISOString().slice(0, 10);

const monthYear = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const month = (time: number) => monthYear.format(new Date(time * 1000));

/**
 * Every id must exist and appear once across all groups. Groups under two
 * borrows are dropped; a kept group's name must be one line of 1 to 60
 * characters. Cards come most borrowed first, ties to the later last borrow.
 */
export function buildCards(result: GroupResponse, messages: Message[]): Card[] {
  if (typeof result !== "object" || result === null || !Array.isArray(result.skills)) {
    throw new GroupingError("The grouping has no list of skills.");
  }
  const byId = new Map(messages.map((message) => [message.id, message]));
  const seen = new Set<string>();

  const groups = result.skills.map((group, index) => {
    const where = `Skill ${index + 1}`;
    if (typeof group !== "object" || group === null || !Array.isArray(group.messageIds)) {
      throw new GroupingError(`${where} has no list of message ids.`);
    }
    const borrowed = group.messageIds.map((id) => {
      const message = typeof id === "string" ? byId.get(id) : undefined;
      if (!message) throw new GroupingError(`${where} names a message that doesn't exist: ${String(id)}.`);
      if (seen.has(message.id)) throw new GroupingError(`Message ${message.id} is in more than one group.`);
      seen.add(message.id);
      return message;
    });
    return { where, name: group.name, borrowed };
  });

  return groups
    .filter((group) => group.borrowed.length >= 2)
    .map(({ where, name, borrowed }) => {
      if (typeof name !== "string" || name.trim() === "") throw new GroupingError(`${where} has no name.`);
      const skill = name.trim();
      if (/[\r\n]/.test(skill)) throw new GroupingError(`${where}'s name runs over more than one line.`);
      if (skill.length > MAX_SKILL_NAME) {
        throw new GroupingError(`${where}'s name is longer than ${MAX_SKILL_NAME} characters.`);
      }
      const sorted = [...borrowed].sort((a, b) => a.time - b.time);
      const first = sorted[0]!;
      const last = sorted[sorted.length - 1]!;
      const card: Card = {
        skill,
        count: sorted.length,
        firstMonth: month(first.time),
        lastMonth: month(last.time),
        borrows: sorted.map((m) => ({ messageId: m.id, text: m.text, date: isoDate(m.time) })),
      };
      return { card, lastTime: last.time };
    })
    .sort((a, b) => b.card.count - a.card.count || b.lastTime - a.lastTime)
    .map(({ card }) => card);
}
