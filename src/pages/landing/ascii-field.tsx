// The dark chapters' ground, after ascii-magic.com: one of the page's own
// archival photographs rebuilt on a canvas from the demo history's
// phrasings, run in reading order through a grid of monospace cells. Each
// cell's light in the photograph sets its ink: a pink letter on a faint pink
// tile at an alpha that rises with the light, white letters in the brightest
// places, nothing in the shadows. A chapter may take the dots instead (an
// ordered 4×4 Bayer dither of the same light). The field clears itself
// around every word, control and app fragment of its chapter, measured from
// their real boxes, so nothing busy lies under a line anyone reads. The
// words drift one cell every 200ms and brighten under the pointer, only
// while the chapter is on screen and the tab is visible; with reduced motion
// it's one still frame. It starts half a screen before its chapter arrives
// and gives its pixels back once the chapter is further away; if the
// photograph fails there's no field, and the chapter keeps its flat ground.
import { useEffect, useRef } from "react";
import { cn } from "cn";
import { CARDS } from "./demo";

/** Every phrasing in the demo history, card by card, oldest first: what each field is set in. */
const STREAM = `${CARDS.flatMap((card) => card.borrows.map((ask) => ask.text)).join(" ")} `;
const GLYPHS = [...new Set(STREAM)];
/** Each character of the stream as its place in the glyph atlas. */
const CODES = [...STREAM].map((char) => GLYPHS.indexOf(char));
const FONT = '500 {px}px "JetBrains Mono", ui-monospace, monospace'; // taste-skill-ignore: canvas glyphs, never page text
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** The most cells a field draws; past it, its faintest go. */
const CAP = 4000;
const STEP = 200;
const REACH = 120;
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

type Props = {
  src: string;
  /** The dither's dots instead of the phrasings' type. */
  dots?: boolean;
  /** Where the crop sits in the photograph, from 0 to 1 across and down. */
  focus?: [number, number];
  /** How far past covering the chapter the photograph is enlarged, to bring its subject into the chapter's open ground. */
  zoom?: number;
  /** The strongest ink in the open ground, up to 0.5; a chapter of reading rows takes less. */
  peak?: number;
  /** How much quieter the middle is than the edges, from 0 to 1. */
  edge?: number;
  className?: string;
};

export function AsciiField({ src, dots = false, focus = [0.5, 0.5], zoom = 1, peak = 0.5, edge = 0, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [fx, fy] = focus;

  useEffect(() => {
    const canvas = ref.current!;
    const host = canvas.parentElement!;
    const pen = canvas.getContext("2d");
    if (!pen || typeof IntersectionObserver === "undefined") return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tone = (name: string, or: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || or;
    const inks = [tone("--pink", "#ff488b"), tone("--ring-on-dark", "#fff")];
    const lights = new Map<string, Float32Array>();
    let photo: ImageBitmap | HTMLImageElement | undefined;
    let atlas: HTMLCanvasElement | undefined;
    let W = 0, H = 0, cw = 0, ch = 0, gw = 0, gh = 0, cols = 0, rows = 0, dpr = 1;
    let ink = new Float32Array(0);
    let bright = new Uint8Array(0);
    let drawn: number[] = [];
    let shift = 0, tick = 0, frame = 0, fix = 0, close = false, begun = false, seen = false, moved = false, whole = false, gone = false;
    let px = -1e4, py = -1e4, ox = px, oy = py;

    /** The photograph's light per cell, cropped to cover the grid and equalized, so every photograph spends its tones evenly; kept per grid size. */
    const lightOf = () => {
      const key = `${cols}x${rows}`;
      let light = lights.get(key);
      if (light) return light;
      const scratch = document.createElement("canvas");
      scratch.width = cols;
      scratch.height = rows;
      const paint = scratch.getContext("2d", { willReadFrequently: true })!;
      paint.imageSmoothingQuality = "high";
      const { width: iw, height: ih } = photo!;
      const scale = Math.max((cols * cw) / iw, (rows * ch) / ih) * zoom;
      const sw = (cols * cw) / scale, sh = (rows * ch) / scale;
      paint.drawImage(photo!, (iw - sw) * fx, (ih - sh) * fy, sw, sh, 0, 0, cols, rows);
      const { data } = paint.getImageData(0, 0, cols, rows);
      light = new Float32Array(cols * rows);
      const counts = new Uint32Array(256);
      for (let i = 0; i < light.length; i++) counts[(light[i] = (data[i * 4]! * 0.299 + data[i * 4 + 1]! * 0.587 + data[i * 4 + 2]! * 0.114) | 0)]!++;
      for (let l = 1; l < 256; l++) counts[l]! += counts[l - 1]!;
      for (let i = 0; i < light.length; i++) light[i] = counts[light[i]!]! / light.length;
      lights.set(key, light);
      return light;
    };

    /** Every cell's ink: its light, cleared around the chapter's words and controls, quiet under the header and at the bottom edge. */
    const settle = () => {
      const light = lightOf();
      const n = cols * rows;
      const keep = new Float32Array(n).fill(1);
      const box = host.getBoundingClientRect();
      const boxes: DOMRect[] = [];
      const walk = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      for (let node = walk.nextNode(); node; node = walk.nextNode()) {
        if (!node.nodeValue?.trim()) continue;
        range.selectNodeContents(node);
        boxes.push(...range.getClientRects());
      }
      for (const part of host.querySelectorAll("input, button, a, table, [data-ui], img, video")) boxes.push(part.getBoundingClientRect());
      const pad = ch / 2, feather = Math.max(56, ch * 5), reach = pad + feather;
      for (const r of boxes) {
        if (r.width < 2 || r.height < 2) continue;
        const l = r.left - box.left, t = r.top - box.top, rr = r.right - box.left, b = r.bottom - box.top;
        for (let y = Math.max(0, Math.floor((t - reach) / ch)); y < Math.min(rows, Math.ceil((b + reach) / ch)); y++) {
          for (let x = Math.max(0, Math.floor((l - reach) / cw)); x < Math.min(cols, Math.ceil((rr + reach) / cw)); x++) {
            const cx = (x + 0.5) * cw, cy = (y + 0.5) * ch;
            const d = Math.hypot(Math.max(l - cx, 0, cx - rr), Math.max(t - cy, 0, cy - b)) - pad;
            const i = y * cols + x;
            keep[i] = Math.min(keep[i]!, ease(d / feather) ** 2);
          }
        }
      }
      ink = new Float32Array(n);
      bright = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const x = i % cols, y = (i - x) / cols, v = light[i]!;
        const cx = (x + 0.5) * cw, cy = (y + 0.5) * ch;
        // Shadows take nothing, the middle tones pink rising with the light, the highlights white.
        let a = dots ? (v > (BAYER[(y & 3) * 4 + (x & 3)]! + 0.5) / 16 ? 0.4 : 0) : v < 0.55 ? 0 : v > 0.93 ? peak : 0.1 + (peak - 0.1) * ease((v - 0.55) / 0.38);
        a *= keep[i]! * ease((cy - 72) / 120) * ease((H - cy) / 48);
        if (edge) a *= 1 - edge * (1 - Math.max(Math.abs((cx / W) * 2 - 1), Math.abs((cy / H) * 2 - 1)));
        ink[i] = a;
        bright[i] = v > 0.93 ? 1 : 0;
      }
      const inked = ink.filter((a) => a > 0.012);
      const floor = inked.length > CAP ? inked.sort().reverse()[CAP]! : 0.012;
      drawn = [];
      for (let i = 0; i < n; i++) if (ink[i]! > floor) drawn.push(i);
      else ink[i] = 0;
    };

    /** Each glyph once, in pink and in white, on a faint pink tile that carries the photograph's tone (a space is the tile alone), at the device's pixels. */
    const carve = () => {
      gw = Math.round(cw * dpr);
      gh = Math.round(ch * dpr);
      atlas = document.createElement("canvas");
      atlas.width = gw * GLYPHS.length;
      atlas.height = gh * 2;
      const paint = atlas.getContext("2d")!;
      paint.font = FONT.replace("{px}", String(Math.min(gw / 0.6, gh)));
      paint.textAlign = "center";
      inks.forEach((color, row) => {
        paint.globalAlpha = 0.22;
        paint.fillStyle = inks[0]!;
        paint.fillRect(0, row * gh + 1, atlas!.width, gh - 2);
        paint.globalAlpha = 1;
        paint.fillStyle = color;
        GLYPHS.forEach((glyph, k) => paint.fillText(glyph, (k + 0.5) * gw, (row + 0.78) * gh));
      });
    };

    const layout = () => {
      W = host.clientWidth;
      H = host.clientHeight;
      if (!W || !H) return false;
      // A line of type every 13px (10px on a phone), each character as wide as the face sets it; the dots sit in squares.
      ch = innerWidth < 640 ? 10 : 13;
      cw = dots ? ch : Math.round(ch * 0.62);
      dpr = Math.min(2, devicePixelRatio || 1);
      cols = Math.ceil(W / cw);
      rows = Math.ceil(H / ch);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      if (!dots && (gw !== Math.round(cw * dpr) || gh !== Math.round(ch * dpr))) carve();
      settle();
      return true;
    };

    /** One cell, brighter near the pointer. */
    const put = (i: number) => {
      const x = i % cols, y = (i - x) / cols;
      let a = ink[i]!;
      const d = Math.hypot((x + 0.5) * cw - px, (y + 0.5) * ch - py) / REACH;
      if (d < 1) a *= 1 + 1.4 * (1 - d) * (1 - d);
      pen.globalAlpha = Math.min(a, 0.9);
      if (dots) {
        const s = ch * 0.55;
        pen.fillStyle = inks[bright[i]!]!;
        pen.fillRect(x * cw + (cw - s) / 2, y * ch + (ch - s) / 2, s, s);
        return;
      }
      pen.drawImage(atlas!, CODES[(i + shift) % CODES.length]! * gw, bright[i]! * gh, gw, gh, x * cw, y * ch, cw, ch);
    };

    /** The whole field, or only the cells around where the pointer was and is. */
    const draw = (all = true) => {
      pen.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (all) {
        pen.clearRect(0, 0, W, H);
        for (const i of drawn) put(i);
      } else {
        const xs = [px, ox].filter((v) => v > -1e3), ys = [py, oy].filter((v) => v > -1e3);
        if (xs.length) {
          const c0 = Math.max(0, Math.floor((Math.min(...xs) - REACH) / cw)), c1 = Math.min(cols - 1, Math.floor((Math.max(...xs) + REACH) / cw));
          const r0 = Math.max(0, Math.floor((Math.min(...ys) - REACH) / ch)), r1 = Math.min(rows - 1, Math.floor((Math.max(...ys) + REACH) / ch));
          pen.clearRect(c0 * cw, r0 * ch, (c1 - c0 + 1) * cw, (r1 - r0 + 1) * ch);
          for (let y = r0; y <= r1; y++) for (let x = c0; x <= c1; x++) if (ink[y * cols + x]) put(y * cols + x);
        }
      }
      ox = px;
      oy = py;
    };

    const live = () => seen && !still && !document.hidden && !!photo && !gone;
    const run = (now: number) => {
      frame = 0;
      if (!live()) return;
      if (!dots && now - tick >= STEP) {
        tick = now;
        shift = (shift + 1) % CODES.length;
        draw();
      } else if (moved) draw(false);
      moved = false;
      if (!dots) frame = requestAnimationFrame(run);
    };
    const wake = () => {
      if (!frame && live()) frame = requestAnimationFrame(run);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    /** A word moved, the chapter changed size, a font arrived, or the chapter came near again: measure and draw on the next frame. */
    const queue = (resize: boolean) => {
      whole ||= resize;
      if (fix || !photo || !close) return;
      fix = requestAnimationFrame(() => {
        fix = 0;
        if (!close || (whole && !layout())) return;
        if (!whole) settle();
        whole = false;
        draw();
        canvas.dataset.on = "";
        wake();
      });
    };
    const remeasure = () => queue(false);

    const start = async () => {
      const image = new Image();
      image.src = src;
      try {
        await Promise.all([image.decode(), document.fonts?.load(FONT.replace("{px}", "12")).catch(() => [])]);
      } catch {
        return;
      }
      if (gone) return;
      // A small copy, made off the main thread where the browser can, is all the grid ever samples.
      photo = await createImageBitmap(image, { resizeWidth: Math.min(640, image.naturalWidth), resizeQuality: "high" }).catch(() => image);
      if (gone) return;
      queue(true);
    };

    const point = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const box = host.getBoundingClientRect();
      px = event.clientX - box.left;
      py = event.clientY - box.top;
      moved = true;
      wake();
    };
    const leave = () => {
      px = py = -1e4;
      moved = true;
      wake();
    };
    const shown = () => (document.hidden ? stop() : wake());

    // Half a screen ahead the field starts (or is drawn again); further away it gives its pixels back.
    const near = new IntersectionObserver(
      ([entry]) => {
        close = Boolean(entry?.isIntersecting);
        if (!close) {
          canvas.width = canvas.height = 0;
          whole = true;
        } else if (begun) queue(true);
        else {
          begun = true;
          void start();
        }
      },
      { rootMargin: "50% 0px" },
    );
    const sight = new IntersectionObserver(([entry]) => {
      seen = Boolean(entry?.isIntersecting);
      if (seen) wake();
      else stop();
    });
    const sizes = new ResizeObserver(() => queue(true));
    const edits = new MutationObserver(remeasure);
    near.observe(host);
    sight.observe(host);
    sizes.observe(host);
    edits.observe(host, { childList: true, subtree: true, characterData: true });
    host.addEventListener("transitionend", remeasure);
    host.addEventListener("animationend", remeasure);
    document.addEventListener("visibilitychange", shown);
    void document.fonts?.ready.then(remeasure);
    if (!still) {
      host.addEventListener("pointermove", point, { passive: true });
      host.addEventListener("pointerleave", leave);
    }
    return () => {
      gone = true;
      stop();
      cancelAnimationFrame(fix);
      near.disconnect();
      sight.disconnect();
      sizes.disconnect();
      edits.disconnect();
      host.removeEventListener("transitionend", remeasure);
      host.removeEventListener("animationend", remeasure);
      document.removeEventListener("visibilitychange", shown);
      host.removeEventListener("pointermove", point);
      host.removeEventListener("pointerleave", leave);
    };
  }, [src, dots, fx, fy, zoom, peak, edge]);

  return <canvas ref={ref} aria-hidden="true" className={cn("ascii-field pointer-events-none absolute inset-0 block size-full", className)} />;
}
