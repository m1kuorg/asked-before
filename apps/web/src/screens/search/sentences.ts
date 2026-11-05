// Search's sentences, built from search.get()'s answer alone: the answer
// to "Have you asked this before?" ("Yes: 9 of your messages ask that, all
// on Undo a git commit, To prove." or "No: none of your 27 messages has
// those words."), the grey line naming what was looked for, and the words
// of an example search taken from a card's skill.
import { searchWords, type SearchAnswer } from "@asked-before/sdk";
import { count } from "@/lib/format";
import { STATUS } from "@/lib/status";

const and = new Intl.ListFormat("en-US", { type: "conjunction" });

/** “git” and “commit”. */
export const quoted = (words: string[]) => and.format(words.map((word) => `“${word}”`));

/** "your 27 messages", "your one message". */
const yours = (n: number) => (n === 1 ? "your one message" : `your ${count(n)} messages`);

export function answerOf(answer: SearchAnswer): string {
  const { total, searched, cards } = answer;
  const those = answer.words.length === 1 ? "that word" : "those words";
  const them = answer.words.length === 1 ? "it" : "them";

  if (total === 0) {
    if (searched === 0) return "No: there are no messages of yours to search yet.";
    const none = (what: string) => (searched === 1 ? `your one message doesn't have ${what}` : `none of ${yours(searched)} has ${what}`);
    if (!cards.length) return `No: ${none(those)}.`;
    const named = cards.length === 1 ? `the card ${cards[0]!.card.skill} is named for ${them}` : `${count(cards.length)} cards are named for ${them}`;
    return `Not in ${those}: ${none(them)}, but ${named}.`;
  }

  const start = total === 1 ? "Yes: 1 of your messages asks that" : `Yes: ${count(total)} of your messages ask that`;
  const withMatches = cards.filter((found) => found.matches > 0);
  const onCards = withMatches.reduce((sum, found) => sum + found.matches, 0);
  const loose = total - onCards;
  if (!withMatches.length) return `${start}, and ${total === 1 ? "it isn't" : "none is"} on a card yet.`;
  if (withMatches.length === 1) {
    const { card } = withMatches[0]!;
    const on = `${card.skill}, ${STATUS[card.status].word}`;
    if (!loose) return `${start}, ${total === 1 ? "on" : "all on"} ${on}.`;
    return `${start}: ${count(onCards)} on ${on}, and ${count(loose)} not on a card.`;
  }
  return `${start}, on ${count(withMatches.length)} cards${loose ? `, and ${count(loose)} not on a card` : ""}.`;
}

/** The grey line under the answer: which words, in how many messages. */
export function lookedFor(answer: SearchAnswer): string {
  const where = answer.searched === 1 ? "your one message" : `all ${count(answer.searched)} of your messages`;
  return `Looked for ${quoted(answer.words)} in ${where}, and in your cards' names.`;
}

/** Words an example search leaves out of a skill's name. */
const SMALL = new Set(["a", "an", "and", "as", "at", "by", "for", "from", "in", "into", "is", "it", "its", "my", "of", "on", "or", "that", "that's", "the", "to", "with", "your"]);

/** An example search from a skill's name: its first two words that say something, "undo git" from "Undo a git commit". It always finds that card, by its name. */
export const exampleOf = (skill: string) =>
  searchWords(skill)
    .filter((word) => !SMALL.has(word))
    .slice(0, 2)
    .join(" ");
