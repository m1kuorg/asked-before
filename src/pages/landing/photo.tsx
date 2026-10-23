// The landing's found pictures, in one treatment: square corners, untouched
// black and white, the surface tone behind them while they load, and one
// line under each that says what it is and when. Each is credited in the
// footer from public/images/credits.json. A large picture can drift inside
// its frame with the scroll (landing.css), so it's 106% of the frame's height.
import { useEffect, useRef, useState } from "react";
import { cn } from "cn";

const CAPTION = "t-small mt-3 flex flex-wrap justify-between gap-x-6 gap-y-1 text-muted-foreground";

type PhotoProps = Omit<React.ComponentProps<"figure">, "children"> & {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
  date: string;
  /** The frame's height (its width is the figure's); without it the picture keeps its own proportions. */
  frame?: string;
  /** Where the crop sits, as an object-position class. */
  position?: string;
  drift?: boolean;
};

export function Photo({ src, width, height, alt, caption, date, frame, position, drift = false, ...figure }: PhotoProps) {
  return (
    <figure data-reveal="fade" {...figure}>
      <div className={cn("bg-plum-surface", drift && "photo-frame", frame)}>
        <img src={src} width={width} height={height} loading="lazy" decoding="async" alt={alt} className={cn("block w-full object-cover", drift ? "h-[106%]" : frame ? "h-full" : "h-auto", position)} />
      </div>
      <figcaption className={CAPTION}>
        <span>{caption}</span>
        <span>{date}</span>
      </figcaption>
    </figure>
  );
}

/** A found film as a muted loop: it plays only while it's in view, and the button beside its caption pauses it (WCAG 2.2.2). With reduced motion it waits on its poster until the visitor presses Play. */
export function Footage({ src, poster, width, height, caption, className }: { src: string; poster: string; width: number; height: number; caption: string; className?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const clip = video.current;
    if (!clip || typeof IntersectionObserver === "undefined") return;
    const watch = new IntersectionObserver(([entry]) => setInView(Boolean(entry?.isIntersecting)), { threshold: 0.2 });
    watch.observe(clip);
    return () => watch.disconnect();
  }, []);

  useEffect(() => {
    const clip = video.current;
    if (!clip) return;
    // A browser that refuses to play shows the poster and offers Play.
    if (inView && !paused) clip.play().catch(() => setPaused(true));
    else clip.pause();
  }, [inView, paused]);

  return (
    <figure data-reveal="fade" className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-6", className)}>
      <div className="col-span-2 bg-plum-surface">
        <video ref={video} muted loop playsInline preload="none" poster={poster} width={width} height={height} aria-hidden="true" className="block h-auto w-full">
          <source src={src} type="video/mp4" />
        </video>
      </div>
      {/* 44px tall for a finger, its word on the caption's first line. */}
      <button type="button" onClick={() => setPaused((was) => !was)} className="ink-link t-small col-start-2 row-start-2 inline-flex min-h-11 items-start pt-3 font-semibold" data-rest="underlined">
        {paused ? "Play" : "Pause"}
      </button>
      <figcaption className="t-small col-start-1 row-start-2 mt-3 text-muted-foreground">{caption}</figcaption>
    </figure>
  );
}
