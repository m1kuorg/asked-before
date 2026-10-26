// The landing page (m1kuorg/basics#74, and the direction in
// .taste-skill/direction.json): type and nothing else on the first screen, a
// few credited archival pictures further down, colour by chapter. Each
// chapter is a full-bleed field of one palette colour and says which ink it
// takes (data-chapter-ink); the fixed header's corners take the ink of the
// chapter beneath them. Parts marked data-reveal rise once as they enter.
// "Skip to content" comes first, past the header. No API call is made until a
// guest button is pressed.
import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { SkipLink } from "@/components/skip-link";
import { CtaChapter, FaqChapter, FeaturesChapter, Footer, HeroChapter, NineWaysChapter, ProofChapter } from "./chapters";
import { GuestAction } from "./guest";
import { HowItWorksChapter } from "./how-it-works";
import { ShowcaseChapter } from "./showcase";

export function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const [revealing, setRevealing] = useState(false);

  // Entrances: each part is shown once when it scrolls in, and never hidden again.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const seen = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-in", "");
          seen.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );
    root.current?.querySelectorAll("[data-reveal]").forEach((part) => seen.observe(part));
    setRevealing(true);
    return () => seen.disconnect();
  }, []);

  return (
    <div ref={root} id="top" className={cn("landing min-h-svh bg-plum-black font-sans text-white [--radius:0px]", revealing && "reveal-on")}>
      <SkipLink />
      <Header />
      <main id="main" tabIndex={-1}>
        <HeroChapter />
        <NineWaysChapter />
        <ShowcaseChapter />
        <HowItWorksChapter />
        <ProofChapter />
        <FeaturesChapter />
        <FaqChapter />
        <CtaChapter />
      </main>
      <Footer />
    </div>
  );
}

/** The wordmark at the top left; Docs, Log in, and the one action at the top right. Each half of the bar takes the ink and the ground of the chapter under it, so the bar disappears into each chapter, the split one included. */
function Header() {
  const header = useRef<HTMLElement>(null);

  useEffect(() => {
    const probes = [...(header.current?.querySelectorAll<HTMLElement>("[data-ink-probe]") ?? [])];
    let frame = 0;
    // Every corner is read before any is written, so a scroll frame lays the page out once.
    const update = () => {
      frame = 0;
      const chapters = [...document.querySelectorAll<HTMLElement>("[data-chapter-ink]")];
      const inks = probes.map((probe) => {
        const box = probe.getBoundingClientRect();
        const x = box.left + box.width / 2;
        const y = box.top + Math.min(box.height, 72) / 2;
        // The innermost chapter under the corner: a chapter's own parts (the photograph) come after it.
        const under = chapters.findLast((chapter) => {
          const r = chapter.getBoundingClientRect();
          return r.top <= y && r.bottom > y && r.left <= x && r.right > x;
        });
        // The bar is the chapter's own ground, so what scrolls under it never shows through its words.
        return { ink: under?.dataset.chapterInk ?? "light", ground: under ? getComputedStyle(under).backgroundColor : "" };
      });
      probes.forEach((probe, i) => {
        probe.dataset.ink = inks[i]!.ink;
        probe.style.backgroundColor = inks[i]!.ground;
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("scroll", schedule);
      removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <header ref={header} className="fixed inset-x-0 top-0 z-50 grid grid-cols-[auto_1fr] md:grid-cols-2">
      <div data-ink-probe className="ink-probe load-fade t-small flex items-start pt-4 pb-2 pl-(--margin) font-semibold md:pt-6">
        <a href="/" className="ink-link flex h-12 items-center whitespace-nowrap">
          Asked Before
        </a>
      </div>
      <nav aria-label="Asked Before" data-ink-probe data-n="2" className="ink-probe load-fade t-small flex items-start justify-end gap-5 pt-4 pr-(--margin) pb-2 pl-4 font-semibold md:gap-7 md:pt-6">
        <a href="/docs" className="ink-link hidden h-12 items-center whitespace-nowrap sm:flex">
          Docs
        </a>
        <a href="/login" className="ink-link flex h-12 items-center whitespace-nowrap">
          Log in
        </a>
        <GuestAction compact />
      </nav>
    </header>
  );
}
