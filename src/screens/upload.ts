// Upload a chat export into a project (m1kuorg/basics#43). The margin says
// how to request an export from ChatGPT and from Claude. A file dropped or
// chosen is read here, on this computer, by the SDK's reader; its preview
// counts your own messages and any left out for length, with the privacy
// line, before anything is sent. Uploading sends only the phrasings, in
// chunks, with the progress on the waiting line; a failed chunk shows the
// error and a retry that carries on with the same upload. A finished upload
// is shown from the query, ?upload=<id>, and watched while it waits and is
// sorted (m1kuorg/basics#44): the waiting line counts the phrasings sorted
// so far, and a sort that fails shows its error and a retry, which carries
// on from where it stopped.
//
// The demo action, startDemoProject(), makes a project flagged demo and
// comes here with ?export=demo, which reads the demo export with the same
// reader and uploads it through the same endpoints at once.

import { ExportError, MAX_CHUNK, MAX_PHRASING_LENGTH, readExport, type Client, type Shelf, type ReadExport, type Upload } from "@asked-before/sdk";
import type { ScreenProps } from "../app/router";
import { button, el, link } from "../parts/dom";
import { dropZone } from "../parts/drop-zone";
import { failure, frame, load, notice, plate, waiting } from "../parts/frame";
import { count, demoLabel, privacyLine, SOURCES } from "../parts/library";

const DEMO_EXPORT = "/demo/export.json";
/** How often a sort's progress is asked for while it runs. */
const WATCH_MS = 1000;

const plural = (n: number, one: string, many: string) => `${count(n)} ${n === 1 ? one : many}`;

/** The demo action: a project flagged demo, then its upload page, which uploads the demo export into it. */
export async function startDemoProject(client: Client, navigate: ScreenProps["navigate"]): Promise<void> {
  const project = await client.shelves.create({ name: "Demo", demo: true });
  navigate(`${uploadPath(project.id)}?export=demo`);
}

const uploadPath = (projectId: string) => `/app/projects/${encodeURIComponent(projectId)}/upload`;
const projectPath = (projectId: string) => `/app/projects/${encodeURIComponent(projectId)}`;

function instructions(): HTMLElement[] {
  return [
    el("h2", undefined, "From ChatGPT"),
    el("p", undefined, "Open Settings, then Data controls, and choose Export data. ChatGPT emails you a link to a zip, sometimes days later, and the link works for 24 hours."),
    el("h2", undefined, "From Claude"),
    el("p", undefined, "On the web or in the desktop app, open Settings, then Privacy, and choose Export data. Claude emails you a link to a zip that works for 24 hours."),
    el("p", undefined, "Drop the zip here as it came. There's no need to unzip it."),
  ];
}

export function mountUpload(root: HTMLElement, { client, params, query, navigate, signal }: ScreenProps<"projectId">) {
  const { block } = frame(root, instructions());
  const heading = el("h1", undefined, "Upload a chat export");
  const uploadId = query.get("upload");

  load(block, {
    keep: [heading],
    line: "Finding the project…",
    request: () => Promise.all([client.shelves.get(params.projectId), uploadId ? client.uploads.get(uploadId) : null]),
    signal,
    show: ([project, upload]) => {
      document.title = `Upload into ${project.name} · Asked Before`;
      const into = el("p", undefined, `Into ${project.name}.`);
      if (project.demo) into.append(" ", demoLabel());
      const top = [heading, into];
      const draw = (...children: Node[]) => {
        if (!signal.aborted) block.replaceChildren(...top, ...children);
      };

      if (upload && upload.shelfId === project.id) return done(upload);
      if (query.get("export") === "demo" && project.demo) return void demo();
      choose();

      /** The drop zone, under the notice of a file that couldn't be read, if any. */
      function choose(problem?: string) {
        const zone = dropZone({
          title: "Drop your chat export here",
          hint: "The zip ChatGPT or Claude emailed you, or the conversations.json inside it. It's read here, on this computer.",
          accept: ".zip,.json,.dms,application/zip,application/json",
          onFile: (file) => void read(file),
        });
        draw(...(problem ? [notice(problem)] : []), zone, privacyLine());
      }

      async function read(file: File) {
        draw(waiting(`Reading ${file.name}…`));
        try {
          preview(await readExport(file), file.name);
        } catch (error) {
          choose(error instanceof ExportError ? `Asked Before can't read ${file.name}. ${error.message}` : `Asked Before can't read ${file.name}.`);
        }
      }

      async function demo() {
        draw(waiting("Reading the demo export…"));
        try {
          const exported = await fetch(DEMO_EXPORT);
          if (!exported.ok) throw new Error();
          send(await readExport(await exported.blob()), "demo-export.json");
        } catch {
          draw(...failure(new Error(), demo));
        }
      }

      function preview(read: ReadExport, fileName: string) {
        const counted = plate(count(read.phrasings.length), "of your own messages");
        const lines: Node[] = [el("p", undefined, `${fileName}, read as a ${SOURCES[read.source]} export.`)];
        if (read.skipped) {
          lines.push(
            el(
              "p",
              undefined,
              `${count(read.skipped)} more of your messages ${read.skipped === 1 ? "runs" : "run"} over ${count(MAX_PHRASING_LENGTH)} characters, often a pasted log or file, so ${read.skipped === 1 ? "it stays" : "they stay"} here.`,
            ),
          );
        }
        const another = button("Choose another file", () => choose(), "secondary");
        if (!read.phrasings.length) {
          lines.push(el("p", undefined, "None of your own messages are in it, so there's nothing to upload."));
          return draw(counted, ...lines, privacyLine(), el("div", "actions", another));
        }
        const go = button(`Upload ${plural(read.phrasings.length, "message", "messages")}`, () => send(read, fileName));
        draw(counted, ...lines, privacyLine(), el("div", "actions", go, another));
      }

      /** Sends the phrasings in chunks; after a failure, Try again carries on from the chunk that failed, in the same upload. */
      function send(read: ReadExport, fileName: string) {
        const counted = plate(count(read.phrasings.length), "of your own messages");
        const total = read.phrasings.length;
        let made: Upload | undefined;
        let sent = 0;

        const attempt = async () => {
          const progress = () => draw(counted, waiting(`Sending your messages: ${count(sent)} of ${count(total)} sent…`));
          progress();
          try {
            made ??= await client.uploads.create(project.id, { source: read.source, fileName });
            while (sent < total) {
              await client.uploads.append(made.id, read.phrasings.slice(sent, sent + MAX_CHUNK));
              sent = Math.min(sent + MAX_CHUNK, total);
              progress();
            }
            const finished = await client.uploads.finish(made.id);
            if (signal.aborted) return;
            navigate(`${uploadPath(project.id)}?upload=${encodeURIComponent(finished.id)}`, { replace: true });
          } catch (error) {
            draw(counted, ...failure(error, attempt));
          }
        };
        void attempt();
      }

      /** A finished upload: where its sort stands, watched until it ends. */
      function done(upload: Upload) {
        show(upload, ...standing(upload));
        if (upload.status === "waiting" || upload.status === "sorting") setTimeout(() => void watch(upload), WATCH_MS);
      }

      /** A finished upload, how many of its messages were new, and then `lines`. */
      function show(upload: Upload, ...lines: Node[]) {
        const already = upload.messages - upload.phrasings;
        const said =
          upload.phrasings > 0
            ? `${upload.fileName} held ${count(upload.messages)} of your messages${already > 0 ? `, ${count(already)} of them in ${project.name} already` : ""}.`
            : upload.messages === 1
              ? `The one message in ${upload.fileName} was in ${project.name} already, so nothing new was added.`
              : `All ${count(upload.messages)} of your messages in ${upload.fileName} were in ${project.name} already, so nothing new was added.`;
        draw(
          plate(count(upload.phrasings), upload.phrasings === 1 ? "new phrasing" : "new phrasings"),
          el("section", "upload-done", el("p", undefined, said), ...lines),
          el("div", "actions", link(`Go to ${project.name}`, projectPath(project.id), "button"), link("Upload another export", uploadPath(project.id), "button secondary")),
        );
      }

      /** Where an upload stands, in the library's words. */
      function standing(upload: Upload): Node[] {
        const one = upload.phrasings === 1;
        switch (upload.status) {
          case "receiving":
            return [el("p", undefined, "This upload stopped before all its messages arrived. Upload the export again: nothing already sent is counted twice.")];
          case "waiting":
            return [upload.phrasings === 0 ? el("p", undefined, "There's nothing new to sort.") : waiting(`${one ? "It waits" : "They wait"} to be sorted into ${project.name}'s cards…`)];
          case "sorting":
            return [waiting(`Sorting ${one ? "it" : "them"} into ${project.name}'s cards: ${count(upload.offered)} of ${count(upload.phrasings)} sorted…`)];
          case "sorted":
            return [el("p", undefined, upload.phrasings === 0 ? "There was nothing new to sort." : `${one ? "It's" : "They're"} sorted into ${project.name}'s cards.`)];
          case "failed": {
            const lines: Node[] = [notice(upload.error ?? "The sort failed.")];
            if (upload.offered > 0) lines.push(el("p", undefined, `${count(upload.offered)} of ${count(upload.phrasings)} were sorted before it stopped. Trying again carries on from there.`));
            return [...lines, button("Try again", () => void retry(upload), "retry")];
          }
        }
      }

      /** Asks where the sort stands now; a failed ask shows its error and a retry that watches again. */
      async function watch(upload: Upload) {
        if (signal.aborted) return;
        try {
          done(await client.uploads.get(upload.id));
        } catch (error) {
          show(upload, ...failure(error, () => void watch(upload)));
        }
      }

      async function retry(upload: Upload) {
        show(upload, waiting("Starting the sort again…"));
        try {
          done(await client.uploads.retry(upload.id));
        } catch (error) {
          show(upload, ...failure(error, () => void retry(upload)));
        }
      }
    },
  });
}

