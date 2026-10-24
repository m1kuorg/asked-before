// Read mode: the frame the two reading pages share, the docs (/docs) and
// the privacy page (/privacy), on the app's light tokens. A top bar with
// the wordmark and "Open the app"; the h1, its lede, and what the page says
// next; then a left index of the page's sections, which marks the one being
// read, with a link to the other reading page under it, beside the sections
// in a centred column, their prose at a 70ch measure (prose.tsx). Every
// section is in the page at once, so a link to one scrolls there once the
// page has drawn. "Skip to content" comes first, past the top bar and the
// index.

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Mark } from "@/components/mark";
import { SkipLink } from "@/components/skip-link";
import { buttonVariants } from "@/components/ui/button";
import { useCurrentSection } from "./use-current-section";

export type Section = { id: string; title: string; body: ReactNode };

type ReadPageProps = {
  title: string;
  lede: string;
  /** What the page says under its lede. */
  intro: ReactNode;
  sections: Section[];
  /** The other reading page, linked under the index. */
  other: { href: string; label: string };
};

const INDEX_LINK = "block rounded-md px-2.5 py-1.5 text-sm leading-5 font-semibold text-muted-foreground transition-colors hover:text-foreground";

export function ReadPage({ title, lede, intro, sections, other }: ReadPageProps) {
  const ids = useMemo(() => sections.map(({ id }) => id), [sections]);
  const end = useRef<HTMLDivElement>(null);
  const current = useCurrentSection(ids, end);

  // The page draws after load, so the browser's own jump to #section missed it; make it once the fonts have set the text.
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id) void document.fonts.ready.then(() => document.getElementById(id)?.scrollIntoView());
  }, []);

  return (
    <div className="min-h-svh text-base leading-7 tracking-[-0.01em]">
      <SkipLink />
      <header className="flex items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <a href="/" className="flex items-center gap-2 text-base font-bold tracking-tight">
          <Mark />
          Asked Before
        </a>
        {/* A link styled as the primary button: Base UI's Button would give it role="button". */}
        <a href="/app/desk" className={buttonVariants()}>
          Open the app
        </a>
      </header>

      {/* The reading column sits in the middle of the page; the index hugs it from the left gutter. */}
      <main id="main" tabIndex={-1} className="grid px-4 pb-24 sm:px-8 lg:grid-cols-[minmax(11.5rem,1fr)_minmax(0,58rem)_minmax(0,1fr)] lg:gap-x-10">
        <div className="flex flex-col gap-6 pt-12 pb-10 lg:col-start-2 lg:pt-20 lg:pb-16">
          <h1 className="text-[clamp(4rem,10vw,8rem)] font-extrabold tracking-display leading-display">{title}</h1>
          <p className="max-w-[46ch] text-2xl leading-snug tracking-tight text-pretty md:text-3xl">{lede}</p>
          {intro}
        </div>

        <nav aria-label="Contents" className="pb-12 lg:sticky lg:top-8 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:mt-20 lg:w-[11.5rem] lg:self-start lg:justify-self-end lg:pb-0">
          <ol className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
            {sections.map(({ id, title }) => (
              <li key={id}>
                <a href={`#${id}`} aria-current={current === id ? "true" : undefined} className={`${INDEX_LINK} aria-[current=true]:bg-active aria-[current=true]:text-foreground`}>
                  {title}
                </a>
              </li>
            ))}
          </ol>
          {/* Not a section of this page: the other reading page, whose index links back here the same way. */}
          <p className="mt-4 lg:mt-6">
            <a href={other.href} className={INDEX_LINK}>
              {other.label}
            </a>
          </p>
        </nav>

        <div className="flex min-w-0 flex-col gap-24 lg:col-start-2">
          {sections.map(({ id, title, body }) => (
            <section key={id} id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-8 flex-col gap-4">
              <h2 id={`${id}-title`} className="text-3xl leading-tight font-bold tracking-tight text-balance">
                {title}
              </h2>
              {body}
            </section>
          ))}
          <div ref={end} aria-hidden="true" />
        </div>
      </main>
    </div>
  );
}
