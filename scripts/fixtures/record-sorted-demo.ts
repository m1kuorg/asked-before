// Records demo/sorted.json, the guest workspace's demo shelf as the real
// sort placed it (m1kuorg/basics#73): the demo export uploaded onto a demo
// shelf of a fresh copy of the app, sorted by the real model with nothing
// stubbed, and held to the answer key before it's kept. The daily reset
// (server/store/guest.ts) restores the guest's demo shelf from this file,
// so it spends no model request. Record it again after any change to the
// sort's prompt or to the demo export. It needs ANTHROPIC_API_KEY, and
// makes 2 model requests a try, up to 3 tries.
// Run: bun run scripts/fixtures/record-sorted-demo.ts

import { join } from "node:path";
import { MODEL } from "../../server/model";
import { compareWithKey, phrasings, sortEnds, upload } from "../lib/answer-key";
import { startApp } from "../lib/app";

const OUT = join(import.meta.dir, "..", "..", "demo", "sorted.json");
const TRIES = 3;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Set ANTHROPIC_API_KEY: the demo export is sorted by the real model.");
  process.exit(1);
}

const app = await startApp();
try {
  const { client } = app.browser();
  await client.auth.signUp({ name: "Demo Recorder", email: "recorder@example.com", password: "a long enough password" });
  for (let attempt = 1; ; attempt++) {
    const shelf = await client.shelves.create({ name: "Demo", demo: true });
    const sorted = await sortEnds(client, (await upload(client, shelf.id, phrasings, "demo-export.json")).id);
    const { lines, problems } = sorted.status === "sorted" ? await compareWithKey(client, shelf.id) : { lines: [], problems: [`the sort ${sorted.status}: ${sorted.error}`] };
    console.log(`Try ${attempt}:\n${lines.join("\n")}`);
    if (!problems.length) {
      const cards = await Promise.all((await client.cards.list(shelf.id)).map((card) => client.cards.get(card.id)));
      await Bun.write(
        OUT,
        `${JSON.stringify(
          {
            label: "Demo data: the demo export (demo/export.json), a made-up chat export, as Asked Before's real sort placed it, held to demo/answer-key.json. The guest workspace's demo shelf is restored from it every day. Recorded by scripts/fixtures/record-sorted-demo.ts.",
            sortedAt: new Date().toISOString(),
            model: MODEL,
            upload: { source: "chatgpt", fileName: "demo-export.json" },
            cards: cards.map((card) => ({ skill: card.skill, phrasings: card.borrows.map((borrow) => borrow.sourceId) })),
            phrasings,
          },
          null,
          2,
        )}\n`,
      );
      console.log(`\nWrote ${OUT}: ${cards.length} cards, ${phrasings.length} phrasings.`);
      break;
    }
    console.log(problems.map((problem) => `  ${problem}`).join("\n"));
    if (attempt === TRIES) throw new Error(`The real sort missed the answer key ${TRIES} times running.`);
  }
} finally {
  await app.stop();
}
