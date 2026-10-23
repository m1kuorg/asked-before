// The docs page (/docs): how to reach your cards from your own scripts and
// agents (brief sections 5 and 7). A reading page on the app's light tokens:
// a top bar with the wordmark and "Open the app", the h1 and its lede, then
// a left index of the six sections, which marks the one being read, beside
// the sections in a centred column, their prose at a 70ch measure. Every
// section is in the page at once, so a link to one scrolls there once the
// page has drawn. "Skip to content" comes first, past the top bar and the
// index.
import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Mark } from "@/components/mark";
import { SkipLink } from "@/components/skip-link";
import { buttonVariants } from "@/components/ui/button";
import { C, SECTIONS } from "./docs/sections";
import { useCurrentSection } from "./docs/use-current-section";

const IDS = SECTIONS.map(({ id }) => id);

function Docs() {
  const end = useRef<HTMLDivElement>(null);
  const current = useCurrentSection(IDS, end);

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
          <h1 className="text-[clamp(4rem,10vw,8rem)] font-extrabold tracking-display leading-display">Docs</h1>
          <p className="max-w-[46ch] text-2xl leading-snug tracking-tight md:text-3xl">How to reach your cards from your own scripts and agents: the API, the SDK, the MCP server, and the Claude Code plugin.</p>
          <p>
            Every endpoint here is under <C>{`${location.origin}/api/v1`}</C>, this server's API.
          </p>
        </div>

        <nav aria-label="Contents" className="pb-12 lg:sticky lg:top-8 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:mt-20 lg:w-[11.5rem] lg:self-start lg:justify-self-end lg:pb-0">
          <ol className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
            {SECTIONS.map(({ id, title }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  aria-current={current === id ? "true" : undefined}
                  className="block rounded-md px-2.5 py-1.5 text-sm leading-5 font-semibold text-muted-foreground transition-colors hover:text-foreground aria-[current=true]:bg-active aria-[current=true]:text-foreground"
                >
                  {title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="flex min-w-0 flex-col gap-24 lg:col-start-2">
          {SECTIONS.map(({ id, title, body }) => (
            <section key={id} id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-8 flex-col gap-4">
              <h2 id={`${id}-title`} className="text-3xl leading-tight font-bold tracking-tight">
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

createRoot(document.getElementById("app")!).render(<Docs />);
