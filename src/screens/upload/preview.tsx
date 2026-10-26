// What a read export holds, before anything is sent: the count of your own
// messages, the file and its chatbot, any left out for length, and "What
// leaves this computer" row by row (docs/DESIGN.md, "What Leaves This
// Computer"), then the privacy line and "Upload 27 messages". Below 640px
// each row of the table is what it is over one grey line saying where it
// goes. The same table, without counts, is the promise under the drop target
// before a file is chosen, and the record under a shelf's uploads.

import { MAX_PHRASING_LENGTH, type ReadExport } from "@asked-before/sdk";
import type { Ref } from "react";
import { Figure } from "@/components/figure";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PRIVACY_LINE, SOURCE_NAMES } from "@/lib/copy";
import { count, plural } from "@/lib/format";

/** "27 of your own messages", as the step's heading; it takes focus when the step changes. */
export function Headline({ n, words, heading }: { n: number; words: string; heading?: Ref<HTMLHeadingElement> }) {
  return (
    <h2 ref={heading} tabIndex={-1} className="flex flex-wrap items-baseline gap-x-2 text-base">
      <Figure n={n} className="text-2xl" /> <span>{words}</span>
    </h2>
  );
}

export function Privacy() {
  return <p className="max-w-[70ch] text-sm text-muted-foreground">{PRIVACY_LINE}</p>;
}

/** "conversations.json, read as a ChatGPT export.", and the long ones left out, if any. */
export function ReadAs({ read, fileName }: { read: ReadExport; fileName: string }) {
  const one = read.skipped === 1;
  return (
    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
      <p>{`${fileName}, read as a ${SOURCE_NAMES[read.source]} export.`}</p>
      {read.skipped > 0 && (
        <p>{`${count(read.skipped)} more of your messages ${one ? "runs" : "run"} over ${count(MAX_PHRASING_LENGTH)} characters, often a pasted log or file, so ${one ? "it stays" : "they stay"} here.`}</p>
      )}
    </div>
  );
}

type PreviewProps = { read: ReadExport; fileName: string; heading: Ref<HTMLHeadingElement>; onUpload: () => void; onAnother: () => void };

export function Preview({ read, fileName, heading, onUpload, onAnother }: PreviewProps) {
  const n = read.phrasings.length;
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Headline n={n} words="of your own messages" heading={heading} />
        <ReadAs read={read} fileName={fileName} />
      </div>
      {n ? <Leaves messages={n} skipped={read.skipped} level={3} /> : <p className="text-sm">None of your own messages are in it, so there's nothing to upload.</p>}
      <Privacy />
      <div className="flex flex-wrap gap-2">
        {n > 0 && <Button onClick={onUpload}>{`Upload ${plural(n, "message")}`}</Button>}
        <Button variant="secondary" onClick={onAnother}>
          Choose another file
        </Button>
      </div>
    </section>
  );
}

type LeavesProps = {
  /** The preview's counts. Without them the rows say what any export sends: the promise before a file is chosen, and the record under a shelf's uploads. */
  messages?: number;
  skipped?: number;
  /** Under a shelf's uploads nothing is "here": it's headed for every upload, and what isn't sent stays on your computer. */
  onShelf?: boolean;
  /** h3 under the preview's count; h2 where it heads its own block. */
  level: 2 | 3;
};

/** Each part of an export: whether it leaves this computer, and whether the model sees it. */
export function Leaves({ messages, skipped, onShelf = false, level }: LeavesProps) {
  const stay = (one: boolean) => `${one ? "Stays" : "Stay"} ${onShelf ? "on your computer" : "here"}`;
  const title = onShelf ? "What an upload sends" : "What leaves this computer";
  const Heading = level === 2 ? "h2" : "h3";
  const rows = [
    {
      what: messages === undefined ? "The words of your messages" : `The words of your ${plural(messages, "message")}`,
      leaves: "Sent",
      model: "Yes, your words only",
      phone: "Sent, and the model sees them",
    },
    { what: "When you sent each one", leaves: "Sent", model: "Never", phone: "Sent; the model never sees it" },
    {
      what: "Each message's id in the export",
      leaves: "Sent, so a re-upload isn't counted twice",
      model: "Never",
      phone: "Sent, so a re-upload isn't counted twice; the model never sees it",
    },
    { what: "The chatbot's answers", leaves: stay(false), model: "Never", phone: stay(false) },
    { what: "Conversation titles", leaves: stay(false), model: "Never", phone: stay(false) },
    { what: "System and tool messages", leaves: stay(false), model: "Never", phone: stay(false) },
    {
      what: skipped === undefined ? `Messages over ${count(MAX_PHRASING_LENGTH)} characters` : `${plural(skipped, "message")} over ${count(MAX_PHRASING_LENGTH)} characters`,
      leaves: stay(skipped === 1),
      model: "Never",
      phone: stay(skipped === 1),
    },
  ];
  return (
    <div className="flex flex-col gap-2">
      <Heading className="text-sm font-semibold">{title}</Heading>
      <Table className="max-sm:block">
        <TableCaption className="sr-only">{`${title}, and what the model sees`}</TableCaption>
        <TableHeader className="max-sm:hidden">
          <TableRow>
            <TableHead>{onShelf ? "In an export" : messages === undefined ? "In your export" : "In this export"}</TableHead>
            <TableHead>{onShelf ? "Leaves your computer" : "Leaves this computer"}</TableHead>
            <TableHead>The model sees it</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="max-sm:block">
          {rows.map((row) => {
            const sent = row.leaves.startsWith("Sent");
            return (
              <TableRow key={row.what} className="max-sm:flex max-sm:flex-col max-sm:gap-0.5 max-sm:py-2.5">
                <TableCell className="whitespace-normal max-sm:p-0">{row.what}</TableCell>
                <TableCell className={sent ? "whitespace-normal max-sm:hidden" : "whitespace-normal text-muted-foreground max-sm:hidden"}>{row.leaves}</TableCell>
                <TableCell className={row.model === "Never" ? "text-muted-foreground max-sm:hidden" : "max-sm:hidden"}>{row.model}</TableCell>
                <TableCell className="hidden p-0 text-xs whitespace-normal text-muted-foreground max-sm:block">{row.phone}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
