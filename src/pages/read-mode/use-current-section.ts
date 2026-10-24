// Which of a reading page's sections is being read, for the index's
// aria-current. An IntersectionObserver watches each section cross a line a
// quarter of the way down the screen, and a sentinel at the page's foot, so a
// short last section is marked once the page can't scroll any further. It
// only decides which index link is current; it never touches the page's own
// colours.

import { useEffect, useState, type RefObject } from "react";

export function useCurrentSection(ids: string[], end: RefObject<HTMLElement | null>): string {
  const [current, setCurrent] = useState(ids[0]!);

  useEffect(() => {
    const sections = ids.map((id) => document.getElementById(id)).filter((node): node is HTMLElement => node !== null);
    let atEnd = false;
    const pick = () => {
      if (atEnd) return setCurrent(sections.at(-1)!.id);
      const line = innerHeight / 4;
      setCurrent(sections.findLast((section) => section.getBoundingClientRect().top <= line)?.id ?? sections[0]!.id);
    };
    const crossing = new IntersectionObserver(pick, { rootMargin: "0px 0px -75% 0px" });
    sections.forEach((section) => crossing.observe(section));
    const foot = new IntersectionObserver(([entry]) => {
      atEnd = entry!.isIntersecting;
      pick();
    });
    if (end.current) foot.observe(end.current);
    return () => {
      crossing.disconnect();
      foot.disconnect();
    };
  }, [ids, end]);

  return current;
}
