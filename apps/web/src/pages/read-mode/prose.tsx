// Read mode's prose, for the docs' and the privacy page's sections: code
// inside a sentence, a paragraph at the page's 70ch measure, a subheading,
// and the panel tone that reference material (a table, a code block) sits
// on.

import type { ReactNode } from "react";

/** A word or line of code inside prose. */
export const C = ({ children }: { children: ReactNode }) => (
  <code translate="no" className="rounded-sm bg-muted px-1 py-0.5 text-[0.875em] break-words">
    {children}
  </code>
);

/** Reading text at the page's measure. */
export const P = ({ children }: { children: ReactNode }) => <p className="max-w-[70ch]">{children}</p>;
export const H3 = ({ children }: { children: ReactNode }) => <h3 className="mt-6 text-xl font-semibold tracking-tight">{children}</h3>;

/** Reference material (every table and code block) sits on the panel tone; the table's rules turn white on it. */
export const Panel = ({ children }: { children: ReactNode }) => <div className="rounded-2xl bg-muted px-5 py-1 [--border:var(--edge)] [--rule:var(--background)]">{children}</div>;
