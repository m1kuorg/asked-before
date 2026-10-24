// One row of a settings view (taste-sheet-app.md, "Settings in two
// columns"): a label column, its h2 at 16/500 and a 14px grey description,
// beside a panel in the panel tint (16px radius, 16px padding, no border, no
// shadow) holding the section's one form, its status line, and its errors.
// The grid is 5fr + 32px + 8fr: 431 + 32 + 689 = 1152 on the full canvas,
// and 425 + 32 + 679 = 1136 at 1440 wide. On a canvas under 64rem the label
// stacks above its panel. The h2 takes focus from an in-page link. Code, a
// placeholder inside a sentence, is Connect your AI's and the playground's
// too.

import { useId, type ReactNode } from "react";
import { TextLink } from "./text-link";

type SectionProps = { id: string; title: string; description?: ReactNode; children: ReactNode };

export function Section({ id, title, description, children }: SectionProps) {
  const headingId = useId();
  return (
    <section id={id} aria-labelledby={headingId} className="grid scroll-mt-16 gap-x-8 gap-y-4 py-8 lg:scroll-mt-8 @5xl:grid-cols-[minmax(0,5fr)_minmax(0,8fr)]">
      <div className="flex flex-col gap-1.5 @5xl:pt-3">
        <h2 id={headingId} tabIndex={-1} className="text-base font-medium">
          {title}
        </h2>
        {description && <div className="flex max-w-prose flex-col gap-3 text-sm text-muted-foreground">{description}</div>}
      </div>
      <div className="@container/panel flex min-w-0 flex-col gap-4 rounded-2xl bg-panel p-4">{children}</div>
    </section>
  );
}

/** A form's last row: its status line (always there, so a change is announced) on the left, its one submit on the right. */
export function FormFooter({ status, children }: { status?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
      {status !== undefined && (
        <p role="status" className="mr-auto text-sm text-muted-foreground">
          {status}
        </p>
      )}
      {children}
    </div>
  );
}

/** A placeholder or file name inside a sentence, in the monospace. */
export function Code({ children }: { children: ReactNode }) {
  return <code className="rounded-sm border border-border bg-background px-1 py-px text-xs text-foreground">{children}</code>;
}

/**
 * A link to another section of this page. The router follows every /app
 * link itself and would drop the jump, so this scrolls to the section and
 * focuses its heading.
 */
export function SectionLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <TextLink
      href={`#${to}`}
      onClick={(event) => {
        event.preventDefault();
        const section = document.getElementById(to);
        section?.scrollIntoView({ block: "start" });
        section?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
      }}
    >
      {children}
    </TextLink>
  );
}
