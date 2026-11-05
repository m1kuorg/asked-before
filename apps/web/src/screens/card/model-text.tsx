// The model's words on the card page (a lesson, a problem, a verdict's
// reason), set as text and never as markup: blank lines make paragraphs,
// ```fences``` make a code block, and `backticks` make inline code. Command
// flags (-m, --soft) stay on one line, as in your own messages.
import { cn } from "cn";
import { Phrasing } from "@/components/phrasing";

export function ModelText({ text, className }: { text: string; className?: string }) {
  // The split's capture group puts each fence's code at the odd indexes.
  const parts = text.split(/```[^\n]*\n?([\s\S]*?)```/);
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {parts.flatMap((part, i) =>
        i % 2
          ? [
              <pre key={i} className="overflow-x-auto rounded-lg bg-background px-3 py-2.5 text-sm">
                <code>{part.replace(/\n$/, "")}</code>
              </pre>,
            ]
          : part
              .split(/\n\s*\n/)
              .map((paragraph) => paragraph.trim())
              .filter(Boolean)
              .map((paragraph, j) => (
                <p key={`${i}-${j}`} className="break-words whitespace-pre-line">
                  <InlineText text={paragraph} />
                </p>
              )),
      )}
    </div>
  );
}

/** One line or paragraph of model text, with `inline code` (a short one kept on one line). */
export function InlineText({ text }: { text: string }) {
  const parts = text.split(/`([^`\n]+)`/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 ? (
          <code key={i} className={cn("rounded-sm bg-background px-1 py-px text-[0.875em]", part.length <= 32 && "whitespace-nowrap")}>
            <Phrasing text={part} />
          </code>
        ) : (
          <Phrasing key={i} text={part} />
        ),
      )}
    </>
  );
}
