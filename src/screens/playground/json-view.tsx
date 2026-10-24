// An answer's JSON, pretty-printed a line at a time, with light colour from
// the tokens and no palette of its own: keys grey, strings in ink, numbers,
// true, false, and null in the pink kept for data, punctuation faint. Each
// line is indented by its depth and wraps under its own indent, so a long
// message or id stays in view at any width without scrolling sideways. An
// id that fills one of the request's fields is a button (plan-review.md
// note 8): a shelf's, an upload's, a card's, a cold rep's, or a key's id,
// by the key it sits under or the object it's in, and a list's next for its
// cursor. A click fills that field. A long answer scrolls inside its box,
// at most 70% of the screen tall. An answer past LARGE characters, such
// as a big export, is shown plain, since it would be tens of thousands of
// spans.

import type { ReactNode } from "react";
import { FIELD_NAMES, fillsField, kindOf, type Fillable, type Param } from "./endpoints";

const LARGE = 200_000;

/** A line's indent by depth, two characters a level, with what wraps hanging two more. Classes in full, so the build finds them. */
const INDENTS = ["pl-[2ch]", "pl-[4ch]", "pl-[6ch]", "pl-[8ch]", "pl-[10ch]", "pl-[12ch]", "pl-[14ch]", "pl-[16ch]", "pl-[18ch]"];

type Pick = (field: Fillable, value: string) => void;

export function JsonView({ value, text, root, onPick }: { value: unknown; text: string; root: Param | null; onPick: Pick }) {
  return (
    // A long answer scrolls in its own box, so the request and its code stay near; the box takes focus, for the keyboard.
    <pre tabIndex={0} aria-label="The answer's body" translate="no" className="max-h-[70svh] overflow-y-auto rounded-md text-xs leading-5 whitespace-pre-wrap text-foreground [overflow-wrap:anywhere]">
      <code>
        {text.length > LARGE
          ? JSON.stringify(value, null, 2)
          : lines(value, root, onPick).map((line, i) => (
              <span key={i} className={`block -indent-[2ch] ${INDENTS[Math.min(line.depth, INDENTS.length - 1)]}`}>
                {line.parts}
              </span>
            ))}
      </code>
    </pre>
  );
}

/** Whether any string in the answer fills a field, as the view would draw it. */
export function fills(value: unknown, root: Param | null): boolean {
  const walk = (item: unknown, kind: Param | null, key: string | null, owner: Param | null): boolean => {
    if (typeof item === "string") return key !== null && fillsField(key, owner) !== null;
    if (Array.isArray(item)) return item.some((element) => walk(element, kind, null, kind));
    if (item !== null && typeof item === "object") return Object.entries(item).some(([name, child]) => walk(child, kindOf(name), name, kind));
    return false;
  };
  return walk(value, root, null, null);
}

type Line = { depth: number; parts: ReactNode[] };

function lines(value: unknown, root: Param | null, onPick: Pick): Line[] {
  const out: Line[] = [];
  let line: Line = { depth: 0, parts: [] };
  let n = 0;
  const next = (depth: number) => {
    out.push(line);
    line = { depth, parts: [] };
  };
  const mark = (text: string, className: string) => line.parts.push(<span key={n++} className={className}>{text}</span>);
  const punctuation = (text: string) => mark(text, "text-faint");

  /** `kind` is what this value is when it's an object or a list of them; `key` and `owner` say where a string sits. */
  const walk = (item: unknown, depth: number, kind: Param | null, key: string | null, owner: Param | null): void => {
    if (item === null || typeof item === "boolean" || typeof item === "number") return void mark(String(item), "text-ask-ink");
    if (typeof item === "string") {
      const field = key === null ? null : fillsField(key, owner);
      if (!field) return void mark(JSON.stringify(item), "");
      line.parts.push(
        <span key={n++}>
          "
          <button
            type="button"
            aria-label={`${item}, fill the ${FIELD_NAMES[field].toLowerCase()} field`}
            onClick={() => onPick(field, item)}
            className="cursor-pointer rounded-sm text-left underline decoration-input decoration-dotted underline-offset-2 transition-colors hover:bg-background hover:decoration-foreground"
          >
            {item}
          </button>
          "
        </span>,
      );
      return;
    }
    if (typeof item !== "object") return void mark(String(item), "");
    if (Array.isArray(item)) {
      if (!item.length) return void punctuation("[]");
      punctuation("[");
      item.forEach((element, i) => {
        next(depth + 1);
        walk(element, depth + 1, kind, null, kind);
        if (i < item.length - 1) punctuation(",");
      });
      next(depth);
      return void punctuation("]");
    }
    const entries = Object.entries(item);
    if (!entries.length) return void punctuation("{}");
    punctuation("{");
    entries.forEach(([name, child], i) => {
      next(depth + 1);
      mark(JSON.stringify(name), "text-muted-foreground");
      punctuation(": ");
      walk(child, depth + 1, kindOf(name), name, kind);
      if (i < entries.length - 1) punctuation(",");
    });
    next(depth);
    punctuation("}");
  };

  walk(value, 0, root, null, null);
  out.push(line);
  return out;
}
