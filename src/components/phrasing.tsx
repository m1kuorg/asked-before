// Your words, word for word, as text (never markup), with each command flag
// (-m, --soft) kept on one line (inventory.md, "Shared behaviour").
import { Fragment } from "react";

export function Phrasing({ text }: { text: string }) {
  // The split's capture group puts the flags at the odd indexes.
  const parts = text.split(/((?<![\w-])--?\w[\w-]*)/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 ? (
          <span key={i} className="whitespace-nowrap">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
