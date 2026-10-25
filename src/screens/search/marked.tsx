// Your words, word for word, with every place a search's words appear
// marked in the house's selection pink and ink (not the ask pink, which is
// data). A word is found as the server finds it: anywhere, with A to Z in
// either case. Overlapping finds join into one mark. Each piece keeps
// Phrasing's flags on one line.
import { Phrasing } from "@/components/phrasing";

/** Lowercases A to Z only, as the database's lower() does, so every index stays where it was. */
const fold = (text: string) => text.replace(/[A-Z]/g, (letter) => letter.toLowerCase());

/** The [start, end) spans where any of `words` appears, sorted and joined where they touch. */
function spans(text: string, words: string[]): [number, number][] {
  const folded = fold(text);
  const found: [number, number][] = [];
  for (const word of words) {
    for (let at = folded.indexOf(word); at !== -1; at = folded.indexOf(word, at + 1)) found.push([at, at + word.length]);
  }
  found.sort((a, b) => a[0] - b[0]);
  const joined: [number, number][] = [];
  for (const span of found) {
    const last = joined.at(-1);
    if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
    else joined.push([...span]);
  }
  return joined;
}

export function Marked({ text, words }: { text: string; words: string[] }) {
  const parts: { text: string; mark: boolean }[] = [];
  let from = 0;
  for (const [start, end] of spans(text, words)) {
    if (start > from) parts.push({ text: text.slice(from, start), mark: false });
    parts.push({ text: text.slice(start, end), mark: true });
    from = end;
  }
  if (from < text.length) parts.push({ text: text.slice(from), mark: false });
  return (
    <>
      {parts.map((part, i) =>
        part.mark ? (
          <mark key={i} className="rounded-xs bg-(--selection) text-(--selection-foreground)">
            <Phrasing text={part.text} />
          </mark>
        ) : (
          <Phrasing key={i} text={part.text} />
        ),
      )}
    </>
  );
}
