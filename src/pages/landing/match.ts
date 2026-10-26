// The showcase's matcher (m1kuorg/basics#74): which demo card a typed
// question is, in the browser, with no request. Words are lowercased,
// stripped of stop words, lightly stemmed, and mapped through a small synonym
// list; a card's words are its skill's and every phrasing's. The card sharing
// the most of the question's words wins, if it shares at least half of them,
// so one common word ("way", "file") never makes a match on its own.

import type { DemoCard } from "../demo-card";

const STOP = new Set(
  "a an the i im i'm me my mine you your to do does did how what whats what's which why when where is are was be been it its it's in on of for and or with by from at as can could should would will i'd that this these those there so just any some please help want need get got way best".split(
    " ",
  ),
);

/** The redesign's synonyms (m1kuorg/basics#74), each group to one word. */
const SYNONYMS: Record<string, string> = {
  dicts: "dict",
  dictionary: "dict",
  dictionaries: "dict",
  div: "element",
  divs: "element",
  elements: "element",
  eaddrinuse: "port",
  ports: "port",
  datetime: "date",
  dates: "date",
};

/** Light stemming: commits, committed, committing are all "commit"; sorting is "sort". */
function stem(word: string): string {
  for (const suffix of ["ing", "ed", "es", "s"]) {
    if (word.length - suffix.length >= 3 && word.endsWith(suffix) && !word.endsWith("ss")) {
      let root = word.slice(0, -suffix.length);
      // committ(ed) to commit, stopp(ed) to stop.
      if (suffix !== "s" && /([b-df-hj-np-tv-z])\1$/.test(root)) root = root.slice(0, -1);
      return root;
    }
  }
  return word;
}

/** The words that carry meaning, as a set. */
export function words(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9']+/)) {
    const word = raw.replace(/^'+|'+$/g, "");
    if (!word || STOP.has(word)) continue;
    const plain = word.replace(/'s$/, "");
    out.add(stem(SYNONYMS[plain] ?? plain));
  }
  return out;
}

export type Matcher = (question: string) => DemoCard | null;

export function matcher(cards: DemoCard[]): Matcher {
  const vocab = cards.map((card) => ({ card, words: words([card.skill, ...card.borrows.map((ask) => ask.text)].join(" ")) }));
  return (question) => {
    const asked = words(question);
    if (!asked.size) return null;
    let best: { card: DemoCard; shared: number } | null = null;
    for (const { card, words: theirs } of vocab) {
      let shared = 0;
      for (const word of asked) if (theirs.has(word)) shared++;
      if (shared && (!best || shared > best.shared)) best = { card, shared };
    }
    return best && best.shared * 2 >= asked.size ? best.card : null;
  };
}

/** A card's phrasings ordered by how many of the question's words each shares, most first, then newest first. */
export function closest(card: DemoCard, question: string, n: number) {
  const asked = words(question);
  return card.borrows
    .map((ask) => ({ ask, shared: [...words(ask.text)].filter((word) => asked.has(word)).length }))
    .sort((x, y) => y.shared - x.shared || y.ask.at.localeCompare(x.ask.at))
    .slice(0, n)
    .map(({ ask }) => ask);
}
