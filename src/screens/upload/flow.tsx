// An upload before its sort (inventory.md, "Upload"; flows 8 and 9):
// choose a file (under the drop target, what will leave this computer),
// read it here with the SDK's readExport (nothing is sent), preview it, then
// send it: uploads.create, uploads.append in chunks of
// MAX_CHUNK with the bar at the true ratio, and uploads.finish, then replace
// the address with ?upload=<id> so Back skips the sending. A failure while
// sending shows its error (the daily cap's 429 included) and "Try again",
// which carries on from the chunk that failed, in the same upload. The demo
// path (?export=demo on a demo shelf) fetches /demo/export.json, reads it the
// same way, and sends it at once, with the privacy line in view.
//
// Leaving mid-send doesn't stop the chunks (so the upload still finishes);
// nothing is drawn, and nobody is sent anywhere, after the screen is left.

import { ExportError, MAX_CHUNK, readExport, type Client, type ReadExport, type Shelf, type Upload } from "@asked-before/sdk";
import { useEffect, useId, useRef, useState } from "react";
import { CircleAlertIcon } from "lucide-react";
import type { ScreenProps } from "@/app/router";
import { ErrorNotice } from "@/components/error-notice";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WaitLine } from "@/components/wait-line";
import { DropZone } from "@/screens/upload/drop-zone";
import { Headline, Leaves, Preview, Privacy, ReadAs } from "@/screens/upload/preview";
import { ProgressLine } from "@/screens/upload/progress-line";
import { finished, watchPath } from "@/screens/upload/data";

const DEMO_EXPORT = "/demo/export.json";
const DEMO_FILE = "demo-export.json";

type Step =
  | { at: "choose"; problem?: string }
  | { at: "reading"; fileName: string }
  | { at: "preview"; read: ReadExport; fileName: string }
  | { at: "demo"; error: unknown }
  | { at: "sending"; read: ReadExport; fileName: string; sent: number; error: unknown };

type FlowProps = { client: Client; shelf: Shelf; demo: boolean; navigate: ScreenProps["navigate"]; signal: AbortSignal };

export function Flow({ client, shelf, demo, navigate, signal }: FlowProps) {
  const [step, setStep] = useState<Step>(demo ? { at: "demo", error: null } : { at: "choose" });
  const made = useRef<Upload | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  // Where focus goes once the next step is drawn, when a learner's action changed it.
  const focusNext = useRef<"input" | "heading" | null>(null);
  const problemId = useId();
  const draw = (next: Step) => {
    if (!signal.aborted) setStep(next);
  };

  useEffect(() => {
    const target = focusNext.current === "input" ? input.current : focusNext.current === "heading" ? heading.current : null;
    focusNext.current = null;
    target?.focus();
  }, [step.at]);

  // The demo starts once, from the address; never twice for one visit.
  const started = useRef(false);
  useEffect(() => {
    if (!demo || started.current) return;
    started.current = true;
    void runDemo();
  }, [demo]);

  async function readFile(file: File) {
    draw({ at: "reading", fileName: file.name });
    try {
      const read = await readExport(file);
      focusNext.current = "heading";
      draw({ at: "preview", read, fileName: file.name });
    } catch (error) {
      focusNext.current = "input";
      draw({ at: "choose", problem: error instanceof ExportError ? `Asked Before can't read ${file.name}. ${error.message}` : `Asked Before can't read ${file.name}.` });
    }
  }

  async function runDemo() {
    draw({ at: "demo", error: null });
    try {
      const response = await fetch(DEMO_EXPORT);
      if (!response.ok) throw new Error(`The demo export answered ${response.status}.`);
      const read = await readExport(await response.blob());
      void send(read, DEMO_FILE, 0);
    } catch {
      // Not an ApiError, so it reads as the connection line, with Try again.
      draw({ at: "demo", error: new TypeError("The demo export couldn't be fetched.") });
    }
  }

  /** Sends from the `from`th phrasing on, in the upload made already if there is one. */
  async function send(read: ReadExport, fileName: string, from: number) {
    const total = read.phrasings.length;
    let sent = from;
    draw({ at: "sending", read, fileName, sent, error: null });
    try {
      made.current ??= await client.uploads.create(shelf.id, { source: read.source, fileName });
      while (sent < total) {
        await client.uploads.append(made.current.id, read.phrasings.slice(sent, sent + MAX_CHUNK));
        sent = Math.min(sent + MAX_CHUNK, total);
        draw({ at: "sending", read, fileName, sent, error: null });
      }
      const done = await client.uploads.finish(made.current.id);
      if (signal.aborted) return;
      finished.set(done.id, done);
      navigate(watchPath(shelf.id, done.id), { replace: true });
    } catch (error) {
      draw({ at: "sending", read, fileName, sent, error });
    }
  }

  switch (step.at) {
    case "choose":
    case "reading":
      return (
        // On a wide screen these join the page's grid (upload.tsx): the drop target across it, then what will leave
        // (the preview's table, without its counts) beside the side panel.
        <div data-step="choose" className="flex flex-col gap-4 @min-[56rem]:contents">
          {step.at === "choose" && step.problem && (
            <Alert variant="negative" id={problemId} className="@min-[56rem]:col-span-12">
              <CircleAlertIcon aria-hidden="true" />
              <AlertDescription>{step.problem}</AlertDescription>
            </Alert>
          )}
          <DropZone
            className="@min-[56rem]:col-span-12"
            input={input}
            reading={step.at === "reading" ? step.fileName : undefined}
            problemId={step.at === "choose" && step.problem ? problemId : undefined}
            onFile={readFile}
          />
          <div className="min-w-0 @min-[56rem]:col-span-8">
            <Leaves level={2} />
          </div>
        </div>
      );
    case "preview":
      return (
        <Preview
          read={step.read}
          fileName={step.fileName}
          heading={heading}
          onUpload={() => {
            focusNext.current = "heading";
            void send(step.read, step.fileName, 0);
          }}
          onAnother={() => {
            focusNext.current = "input";
            setStep({ at: "choose" });
          }}
        />
      );
    case "demo":
      return (
        <section className="flex flex-col gap-4">
          {step.error === null ? <WaitLine>Reading the demo export…</WaitLine> : <ErrorNotice error={step.error} title="The demo export didn't load." onRetry={runDemo} />}
          <Privacy />
        </section>
      );
    case "sending": {
      const { read, fileName, sent, error } = step;
      return (
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Headline n={read.phrasings.length} words="of your own messages" heading={heading} />
            <ReadAs read={read} fileName={fileName} />
          </div>
          <ProgressLine label={error === null ? "Sending your messages…" : "Sending stopped"} done={sent} total={read.phrasings.length} unit="sent" />
          {error !== null && <ErrorNotice error={error} title="Your messages didn't all arrive." onRetry={() => void send(read, fileName, sent)} />}
          <Privacy />
        </section>
      );
    }
  }
}
