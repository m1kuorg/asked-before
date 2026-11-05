// A box's width in pixels, measured before paint and again whenever it
// changes, for charts laid out in pixels: the policy forbids style
// attributes, so a chart computes its geometry and writes it as SVG
// attributes instead. 0 until the box is measured.

import { useLayoutEffect, useRef, useState } from "react";

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setWidth(Math.floor(node.getBoundingClientRect().width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}
