// The drop target: a real <input type="file"> (visually hidden, focusable,
// its focus drawn on the whole target) under a label that fills the frame, so
// a click anywhere chooses a file; dragging a file over marks the frame, and
// a drop takes the first file. While a file is read, the frame stays and says
// so. The hint ends with the line that it's read on this computer, and the
// privacy line closes the frame; the input is described by both. The frame
// is as tall as what it holds, and keeps that height while a file is read.

import { useId, useRef, useState, type RefObject } from "react";
import { FileArchiveIcon } from "lucide-react";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { WaitLine } from "@/components/wait-line";
import { PRIVACY_LINE, READ_LOCALLY } from "@/lib/copy";

export const ACCEPT = ".zip,.json,.dms,application/zip,application/json";

type DropZoneProps = {
  onFile: (file: File) => void;
  /** The name of the file being read, while it is. */
  reading?: string;
  /** A notice about the last file, which the input is then described by. */
  problemId?: string;
  input?: RefObject<HTMLInputElement | null>;
  className?: string;
};

export function DropZone({ onFile, reading, problemId, input, className }: DropZoneProps) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const ids = { input: useId(), title: useId(), hint: useId(), choose: useId(), privacy: useId() };

  return (
    <div
      data-over={over || undefined}
      onDragEnter={(event) => {
        event.preventDefault();
        depth.current += 1;
        setOver(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = reading ? "none" : "copy";
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (!depth.current) setOver(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        depth.current = 0;
        setOver(false);
        const file = event.dataTransfer.files[0];
        if (file && !reading) onFile(file);
      }}
      className={cn(
        "group flex flex-col rounded-2xl border border-dashed border-input bg-background transition-colors",
        "data-over:border-solid data-over:border-primary data-over:bg-panel",
        "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring",
        className,
      )}
    >
      <input
        ref={input}
        id={ids.input}
        type="file"
        accept={ACCEPT}
        disabled={Boolean(reading)}
        aria-labelledby={`${ids.title} ${ids.choose}`}
        aria-describedby={[ids.hint, ids.privacy, problemId].filter(Boolean).join(" ")}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) onFile(file);
        }}
        className="sr-only"
      />
      {/* While a file is read, the label keeps its room, unseen, and the wait line sits over it. */}
      <div className="relative flex flex-col">
        <label htmlFor={ids.input} className={cn("flex cursor-pointer flex-col items-center gap-3 px-6 py-8 text-center", reading && "invisible")}>
          <FileArchiveIcon aria-hidden="true" className="size-5 text-muted-foreground" />
          <span id={ids.title} className="text-base font-medium">
            Drop your chat export here
          </span>
          <span id={ids.hint} className="max-w-md text-sm text-muted-foreground">
            {`The zip ChatGPT or Claude emailed you, or the conversations.json inside it. ${READ_LOCALLY}`}
          </span>
          <span id={ids.choose} aria-hidden="true" className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mt-1 group-hover:border-input group-hover:bg-muted")}>
            Choose a file
          </span>
        </label>
        {reading && <WaitLine className="absolute inset-0 justify-center px-6">{`Reading ${reading}…`}</WaitLine>}
      </div>
      <p id={ids.privacy} className="border-t border-dashed border-input px-5 py-4 text-sm text-muted-foreground">
        {PRIVACY_LINE}
      </p>
    </div>
  );
}
