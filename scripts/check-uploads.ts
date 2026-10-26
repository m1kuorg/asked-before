// Checks the uploads endpoints (m1kuorg/basics#43) end to end, through the
// SDK, on a fresh copy of the app: create an upload, append its phrasings
// in chunks, finish it so it waits to be sorted, get it, and list a
// shelf's uploads a page at a time. Finishing starts the sort
// (m1kuorg/basics#44, checked by check:sort-rules); here the app's model is
// a stand-in in this script, answering as the demo export's answer key does,
// so no sort reaches the real model. Uploading the same export again into
// the shelf stores nothing new; onto another shelf it stores it all. A
// phrasing over 2,000 characters, or a chunk over 500 phrasings, gets
// 413, and the largest chunk of all is stored whole; one dated more than 5
// minutes after the server's clock gets 400, as does anything but
// { sourceId, text, time }. Another account's upload is a 404, an API key
// can upload as a session can, an upload left unfinished strands none of
// its phrasings when the export is uploaded again, and the logs never hold
// a phrasing. It prints each step's checks and exits 1 if any fails, naming
// the step.
// Run: bun run check:uploads

import { ApiError, createClient, MAX_CHUNK, readExport, type Phrasing, type Shelf, type Upload } from "@asked-before/sdk";
import { join } from "node:path";
import { compareWithKey, keySorter, sortEnds } from "./lib/answer-key";
import { startApp } from "./lib/app";
import { reply, startModelStub } from "./lib/model-stub";

const model = await startModelStub(reply(keySorter));
const app = await startApp({ ANTHROPIC_BASE_URL: model.url, ANTHROPIC_API_KEY: "stand-in" });
const failures: string[] = [];
let current = "";

const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures.push(`${current}: ${what}`);
};

async function step(name: string, run: () => Promise<void>) {
  current = name;
  console.log(`\n${name}`);
  try {
    await run();
  } catch (error) {
    check(false, `threw ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`);
  }
}

/** The ApiError a call fails with, or null when it doesn't fail. */
async function failure(call: Promise<unknown>): Promise<ApiError | null> {
  try {
    await call;
    return null;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
}

const say = (error: ApiError | null) => (error ? `${error.status} "${error.message}"` : "no error");
const counts = (u: Upload) => `${u.status}, ${u.messages} messages, ${u.phrasings} new`;

const ada = app.browser();
const bea = app.browser();
const demo = await readExport(Bun.file(join(import.meta.dir, "..", "demo", "export.json")));
const MINUTE = 60 * 1000;
const at = (ms: number) => new Date(ms).toISOString();
const phrasing = (sourceId: string, text = "how do i undo my last git commit", time = "2026-01-02T03:04:05.000Z"): Phrasing => ({ sourceId, text, time });

let work: Shelf;
let bootcamp: Shelf;
let first: Upload;

/** Uploads phrasings onto a shelf as the page does: create, chunks of `size`, finish. */
async function upload(shelf: Shelf, phrasings: Phrasing[], size = MAX_CHUNK): Promise<Upload> {
  const made = await ada.client.uploads.create(shelf.id, { source: "chatgpt", fileName: "conversations.json" });
  for (let i = 0; i < phrasings.length; i += size) await ada.client.uploads.append(made.id, phrasings.slice(i, i + size));
  return ada.client.uploads.finish(made.id);
}

try {
  await step("1. Create an upload on a shelf: it's receiving, and empty", async () => {
    await ada.client.auth.signUp({ name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" });
    await bea.client.auth.signUp({ name: "Bea Example", email: "bea@example.com", password: "difference engine" });
    work = await ada.client.shelves.create({ name: "Work" });
    bootcamp = await ada.client.shelves.create({ name: "Bootcamp" });
    first = await ada.client.uploads.create(work.id, { source: "chatgpt", fileName: "chatgpt-export.zip" });
    check(
      first.shelfId === work.id && first.source === "chatgpt" && first.fileName === "chatgpt-export.zip" && first.status === "receiving",
      `made ${first.fileName}, ${first.source}, ${first.status}`,
    );
    check(first.messages === 0 && first.phrasings === 0 && first.offered === 0 && first.error === null && first.finishedAt === null, `it holds ${counts(first)}`);
    check(!Number.isNaN(Date.parse(first.createdAt)), `made at ${first.createdAt}`);
  });

  await step("2. Append the demo export's 27 phrasings in chunks of 10", async () => {
    let after = first;
    for (let i = 0; i < demo.phrasings.length; i += 10) after = await ada.client.uploads.append(first.id, demo.phrasings.slice(i, i + 10));
    check(after.messages === 27 && after.phrasings === 27 && after.status === "receiving", `after three chunks it holds ${counts(after)}`);
    const again = await ada.client.uploads.append(first.id, demo.phrasings.slice(0, 5));
    check(again.messages === 27 && again.phrasings === 27, `a chunk sent twice counts no message twice, and stores no phrasing twice: ${counts(again)}`);
  });

  await step("3. Finish it: it waits to be sorted, and takes nothing more", async () => {
    const finished = await ada.client.uploads.finish(first.id);
    check(finished.status === "waiting" && finished.finishedAt !== null && finished.phrasings === 27, `finished: ${counts(finished)}, at ${finished.finishedAt}`);
    const got = await ada.client.uploads.get(first.id);
    const sortFields = ({ status, offered, error, ...rest }: Upload) => JSON.stringify(rest);
    check(sortFields(got) === sortFields(finished) && got.status !== "receiving", `getting it says the same, with its sort under way: ${got.status}`);
    const late = await failure(ada.client.uploads.append(first.id, [phrasing("late")]));
    check(late?.status === 409, `appending after finishing: ${say(late)}`);
    const twice = await failure(ada.client.uploads.finish(first.id));
    check(twice?.status === 409, `finishing twice: ${say(twice)}`);
    const shelf = await ada.client.shelves.get(work.id);
    check(shelf.lastUploadAt === first.createdAt, `the shelf's last upload is ${shelf.lastUploadAt}`);
  });

  await step("4. Upload the same export again: nothing new on the shelf, everything new on another", async () => {
    const repeat = await upload(work, demo.phrasings);
    check(repeat.messages === 27 && repeat.phrasings === 0 && repeat.status === "waiting", `again into Work: ${counts(repeat)}`);
    const elsewhere = await upload(bootcamp, demo.phrasings, MAX_CHUNK);
    check(elsewhere.messages === 27 && elsewhere.phrasings === 27, `into Bootcamp: ${counts(elsewhere)}`);
    const claude = await ada.client.uploads.create(work.id, { source: "claude", fileName: "conversations.json" });
    check(claude.source === "claude", `a Claude upload is made as ${claude.source}`);
  });

  await step("5. A phrasing over 2,000 characters, or a chunk over 500 phrasings, gets 413", async () => {
    const open = await ada.client.uploads.create(work.id, { source: "chatgpt", fileName: "conversations.json" });
    const long = await failure(ada.client.uploads.append(open.id, [phrasing("long-1", "x".repeat(2001))]));
    check(long?.status === 413 && !long.message.includes("xxxx"), `2,001 characters: ${say(long)}`);
    const atLimit = await ada.client.uploads.append(open.id, [phrasing("long-2", "y".repeat(2000))]);
    check(atLimit.phrasings === 1, `exactly 2,000 characters is stored: ${counts(atLimit)}`);
    const many = Array.from({ length: MAX_CHUNK + 1 }, (_, i) => phrasing(`many-${i}`));
    const big = await failure(ada.client.uploads.append(open.id, many));
    check(big?.status === 413 && MAX_CHUNK === 500, `a chunk of ${MAX_CHUNK + 1}: ${say(big)}`);
    const full = await ada.client.uploads.append(open.id, many.slice(0, MAX_CHUNK));
    check(full.phrasings === MAX_CHUNK + 1, `a chunk of ${MAX_CHUNK} is stored: ${counts(full)}`);
    // About 3 MB of JSON, which D1 takes only in slices: a bound value holds at most 2 MB.
    const wide = await ada.client.uploads.create((await ada.client.shelves.create({ name: "Wide" })).id, { source: "chatgpt", fileName: "conversations.json" });
    const widest = await ada.client.uploads.append(wide.id, Array.from({ length: MAX_CHUNK }, (_, i) => phrasing(`wide-${i}`, `${i} ${"語".repeat(1990)}`)));
    check(widest.phrasings === MAX_CHUNK && widest.messages === MAX_CHUNK, `the largest chunk, ${MAX_CHUNK} phrasings of 2,000 characters of three bytes each, is stored whole: ${counts(widest)}`);
  });

  await step("6. A phrasing dated more than 5 minutes after the server's clock, or shaped otherwise, gets 400", async () => {
    const open = await ada.client.uploads.create(work.id, { source: "chatgpt", fileName: "conversations.json" });
    const ahead = await failure(ada.client.uploads.append(open.id, [phrasing("ahead-1", "a question", at(Date.now() + 6 * MINUTE))]));
    check(ahead?.status === 400, `6 minutes ahead: ${say(ahead)}`);
    const soon = await ada.client.uploads.append(open.id, [phrasing("ahead-2", "a question", at(Date.now() + 4 * MINUTE))]);
    check(soon.phrasings === 1, `4 minutes ahead is stored (a clock can run a little fast): ${counts(soon)}`);
    const send = (body: unknown) => fetch(`${app.url}/api/v1/uploads/${open.id}/phrasings`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: app.url, cookie: ada.cookie() },
      body: JSON.stringify(body),
    });
    const cases: [string, unknown][] = [
      ["a title beside the phrasing", { phrasings: [{ ...phrasing("t1"), title: "Undo last Git commit" }] }],
      ["an answer beside the phrasings", { phrasings: [phrasing("t2")], answers: ["git reset --soft HEAD~1"] }],
      ["no sourceId", { phrasings: [{ text: "a question", time: "2026-01-02T03:04:05.000Z" }] }],
      ["empty text", { phrasings: [phrasing("t3", "")] }],
      ["a time that isn't ISO", { phrasings: [phrasing("t4", "a question", "yesterday")] }],
      ["no list", { phrasings: "a question" }],
    ];
    for (const [what, body] of cases) {
      const response = await send(body);
      const said = ((await response.json()) as { error?: string }).error ?? "";
      check(response.status === 400 && !said.includes("Undo last Git commit") && !said.includes("git reset"), `${what}: ${response.status} "${said}"`);
    }
    const badSource = await failure(ada.client.uploads.create(work.id, { source: "gemini" as "chatgpt", fileName: "x.json" }));
    check(badSource?.status === 400, `an upload from another chatbot: ${say(badSource)}`);
    const noName = await failure(ada.client.uploads.create(work.id, { source: "claude", fileName: " " }));
    check(noName?.status === 400, `an upload with no file name: ${say(noName)}`);
  });

  await step("7. List a shelf's uploads, newest first, a page at a time", async () => {
    const all = await ada.client.uploads.list(work.id);
    check(all.uploads.length === 5 && all.next === null, `Work has ${all.uploads.length} uploads, next ${all.next}`);
    const newestFirst = all.uploads.every((u, i, list) => i === 0 || list[i - 1]!.createdAt >= u.createdAt);
    check(newestFirst && all.uploads.at(-1)?.id === first.id, "newest first, the first upload last");
    const page1 = await ada.client.uploads.list(work.id, { limit: 3 });
    const page2 = await ada.client.uploads.list(work.id, { limit: 3, cursor: page1.next! });
    check(page1.uploads.length === 3 && page1.next !== null && page2.uploads.length === 2 && page2.next === null, `pages of 3: ${page1.uploads.length}, then ${page2.uploads.length}`);
    const paged = [...page1.uploads, ...page2.uploads].map((u) => u.id).join();
    check(paged === all.uploads.map((u) => u.id).join(), "the pages hold the same uploads in the same order");
    const bad = await failure(ada.client.uploads.list(work.id, { limit: 0 }));
    check(bad?.status === 400, `a limit of 0: ${say(bad)}`);
  });

  await step("8. Another account's shelf or upload is a 404, and no session is a 401", async () => {
    const tries: [string, () => Promise<unknown>][] = [
      ["get", () => bea.client.uploads.get(first.id)],
      ["append", () => bea.client.uploads.append(first.id, [phrasing("bea-1")])],
      ["finish", () => bea.client.uploads.finish(first.id)],
      ["list", () => bea.client.uploads.list(work.id)],
      ["create", () => bea.client.uploads.create(work.id, { source: "chatgpt", fileName: "conversations.json" })],
    ];
    for (const [what, call] of tries) {
      const refused = await failure(call());
      check(refused?.status === 404, `Bea's ${what} on Ada's: ${say(refused)}`);
    }
    const missing = await failure(ada.client.uploads.get("no-such-upload"));
    check(missing?.status === 404, `a missing upload: ${say(missing)}`);
    const response = await fetch(`${app.url}/api/v1/uploads/${first.id}`);
    check(response.status === 401, `no session: ${response.status}`);
  });

  await step("9. An API key uploads an export, as a script would", async () => {
    const { key } = await ada.client.keys.create({ name: "Upload script" });
    const script = createClient({ baseUrl: app.url, apiKey: key });
    const read = await readExport(Bun.file(join(import.meta.dir, "..", "packages", "sdk", "fixtures", "claude.zip")));
    const made = await script.uploads.create(bootcamp.id, { source: read.source, fileName: "claude.zip" });
    await script.uploads.append(made.id, read.phrasings);
    const finished = await script.uploads.finish(made.id);
    check(finished.source === "claude" && finished.phrasings === 3 && finished.status === "waiting", `through the key: ${counts(finished)} from ${finished.source}`);
    const listed = await script.uploads.list(bootcamp.id);
    check(listed.uploads[0]?.id === made.id && (await script.uploads.get(made.id)).id === made.id, "and the key lists and gets it");
  });

  await step("10. An upload left unfinished strands nothing: uploading the export again sorts what it held", async () => {
    const side = await ada.client.shelves.create({ name: "Side shelf" });
    const left = await ada.client.uploads.create(side.id, { source: "chatgpt", fileName: "conversations.json" });
    await ada.client.uploads.append(left.id, demo.phrasings.slice(0, 10));
    // The tab closed before it finished, so the learner uploads the export again.
    const again = await upload(side, demo.phrasings);
    check(again.messages === 27 && again.phrasings === 27, `the new upload takes all 27 to sort: ${counts(again)}`);
    const unfinished = await ada.client.uploads.get(left.id);
    check(unfinished.status === "receiving" && unfinished.messages === 10 && unfinished.phrasings === 0, `the unfinished one keeps none of them: ${counts(unfinished)}`);
    const sorted = await sortEnds(ada.client, again.id);
    check(sorted.status === "sorted" && sorted.offered === 27, `its sort ends ${sorted.status}, ${sorted.offered} of ${sorted.phrasings} offered`);
    const { lines, problems } = await compareWithKey(ada.client, side.id);
    for (const line of lines) console.log(line);
    check(problems.length === 0, `each phrasing is on its card or unsorted, counted once, as the key says${problems.length ? `: ${problems.join("; ")}` : ""}`);
  });

  await step("11. The logs hold no phrasing", async () => {
    const log = app.log();
    const leaked = demo.phrasings.filter((p) => log.includes(p.text));
    check(log.includes("POST /api/v1/uploads/") && leaked.length === 0, `${log.split("\n").length} log lines, ${leaked.length} holding a phrasing`);
  });
} finally {
  await app.stop();
  model.stop();
}

console.log(failures.length ? `\n${failures.length} check(s) failed:\n${failures.join("\n")}` : "\nevery check passed");
process.exit(failures.length ? 1 : 0);
