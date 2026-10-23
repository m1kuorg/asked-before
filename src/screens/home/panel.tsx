// One of Home's tonal panels (taste-sheet-app.md, "home"): the panel colour
// one step off white toward the plum, 16px corners, a 20px pad, a 14/600
// title with an optional count chip and link on its right, a grey line under
// it, then its rows, then an optional footer: an action or a total, nothing
// else.
import { useId, type ReactNode } from "react";
import { cn } from "cn";

type PanelProps = {
  title: string;
  chip?: ReactNode;
  link?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function Panel({ title, chip, link, description, footer, className, children }: PanelProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("flex min-w-0 flex-col gap-4 rounded-2xl bg-panel p-4 sm:p-5", className)}>
      <div className="flex flex-col gap-1">
        <div className="flex min-h-5 items-center gap-2">
          <h2 id={id} className="text-sm font-semibold">
            {title}
          </h2>
          {chip}
          {link && <div className="ml-auto">{link}</div>}
        </div>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
      {footer && <div className="mt-auto">{footer}</div>}
    </section>
  );
}

/** A row card: white on the panel, a border one step darker, 63px tall at least. */
export const rowCard = "min-h-15.75 rounded-xl border border-border bg-card px-3 py-2.5 sm:px-4";

/** A link on a row's name: ink, no underline until hovered. */
export const nameLink = "font-medium text-foreground underline-offset-4 hover:underline";
