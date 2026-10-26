// Connect your AI's two kinds of block, each a region named by its heading.
// A step of the flow is a tonal panel (the panel colour, 16px corners, a
// 16px pad, 20px from 640px up), an <li> of its <ol> whose 16/500 h2 says
// what to do ("Give it a key"); it's a container, so what's inside fits its
// own width. A block of the rail beside it is reference, so it sits on the
// ground with no frame of its own (docs/DESIGN.md, "Cards / Containers"): a
// 14/600 h2, as Home's panels have, an optional link on its right, and a grey
// line under it.

import { useId, type ReactNode } from "react";

export function Step({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <li>
      <section aria-labelledby={id} className="@container/step flex min-w-0 flex-col gap-4 rounded-2xl bg-panel p-4 sm:p-5">
        <h2 id={id} className="text-base font-medium">
          {title}
        </h2>
        {children}
      </section>
    </li>
  );
}

type RailBlockProps = { title: string; description?: ReactNode; link?: ReactNode; children: ReactNode };

export function RailBlock({ title, description, link, children }: RailBlockProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1">
          <h2 id={id} className="text-sm font-semibold">
            {title}
          </h2>
          {link && <div className="ml-auto text-sm">{link}</div>}
        </div>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}
