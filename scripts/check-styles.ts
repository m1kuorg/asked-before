// Checks the stylesheets (public/styles/) against docs/DESIGN.md on a fresh
// copy of the app, in a real browser at 1920×1080. It signs up one learner,
// then runs every surface module in scripts/styles/, in name order: each
// drives pages into its states, real screens or sample markup, and shoots
// them. Every shot is checked for the type floor (body text at least 20px,
// labels at least 14px), vermilion only on rail keys and key letters (in
// the markup and in the pixels), no radius or shadow, only the inks and the
// one ramp, contrast, at most one plate, and no sideways scroll. A surface's
// ticket adds its own module there, so tickets never edit the same file.
// It prints selectors, never message text, and exits 1 on any failure.
// Run: bun run check:styles [screenshot dir]

import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { startApp } from "./lib/app";
import { makeKit, type Result, type Surface } from "./lib/styles";

const OUT = process.argv[2] ?? join(tmpdir(), "asked-before-styles");
const SURFACES = join(import.meta.dir, "styles");
const LEARNER = { name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" };

const failures: string[] = [];
let current = "";
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures.push(`${current}: ${what}`);
};

await mkdir(OUT, { recursive: true });
const app = await startApp();
const browser = await chromium.launch();
const results: Result[] = [];

try {
  const session = app.browser();
  await session.client.auth.signUp(LEARNER);
  const kit = makeKit({ app, browser, learner: { ...LEARNER, ...session }, out: OUT, check, results });

  const files = [...new Bun.Glob("*.ts").scanSync(SURFACES)].sort();
  for (const file of files) {
    current = file;
    console.log(`\n${file}`);
    try {
      const surface = (await import(join(SURFACES, file))).default as Surface;
      await surface(kit);
    } catch (error) {
      check(false, `threw ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    }
  }

  console.log(`\n${"state".padEnd(24)}smallest body  smallest label`);
  for (const r of results) console.log(`${r.name.padEnd(24)}${`${r.body}px`.padEnd(15)}${r.label}px`);
  console.log(`\nscreenshots in ${OUT}`);
} finally {
  await browser.close();
  await app.stop();
}

console.log(failures.length ? `\n${failures.length} check(s) failed:\n${failures.join("\n")}` : "\nevery check passed");
process.exit(failures.length ? 1 : 0);
