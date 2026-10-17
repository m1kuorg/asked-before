// The cold rep's states (public/styles/rep.css; m1kuorg/basics#46 owns this
// module and retargets it to the real card page). Until then they're sample
// markup in the proof of concept's shapes, set into the app page: a failed
// rep with the lesson again and a fresh problem, waiting on a check with the
// answer locked, and the answer box focused.

import { join } from "node:path";
import { buildCards } from "../../src/cards";
import { parseExport } from "../../src/parser";
import { SAMPLE_PATH, type Kit } from "../lib/styles";

const ROOT = join(import.meta.dir, "..", "..");
const messages = parseExport(await Bun.file(join(ROOT, "demo/export.json")).text());
const answerKey: { skills: { name: string; messageIds: string[] }[] } = await Bun.file(join(ROOT, "demo/answer-key.json")).json();
const A = buildCards({ skills: answerKey.skills }, messages)[0]!;

const esc = (text: string) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const head = `<h1 class="skill">${esc(A.skill)}</h1><div class="plate"><b>${A.count}</b> <span>times borrowed</span></div>`;
const margin = `<aside class="margin"><p>Key A: borrowed ${A.count} times, ${A.firstMonth} to ${A.lastMonth}.</p><p>Answer without AI. A pass stamps the card returned.</p></aside>`;
const lesson = `<section class="lesson"><h2>The lesson</h2><p>A commit you haven't pushed can be taken back by moving your branch back one commit.</p><p>git reset --soft HEAD~1 keeps the changes staged, --mixed keeps them unstaged, and --hard throws them away.</p><p>Once a commit is pushed, use git revert, which adds a new commit instead of rewriting history.</p></section>`;
const problem = `<section class="problem"><h2>A fresh problem</h2><p>You committed two files to main, then saw that one of them holds a password. Nothing is pushed yet. Take the commit back, keep both files' changes in your working tree, and leave main where it was before the commit.</p></section>`;
const answerBox = (answer: string, locked: boolean) =>
  `<form class="answer-box"><label>Your answer, without AI<textarea${locked ? " disabled" : ""}>${esc(answer)}</textarea></label><button type="submit"${locked ? " disabled" : ""}>Check my answer</button></form>`;

const STATES = {
  failed: `${margin}<main class="block">${head}<div><section class="verdict is-failed"><h2>Still borrowed</h2><p>git revert HEAD keeps the bad commit in history and adds a second one that undoes it. This problem asks for the commit to be gone before you push, with your changes kept.</p></section>${lesson}${problem}${answerBox("", false)}</div></main>`,
  waiting: `${margin}<main class="block">${head}<div>${lesson}${problem}${answerBox("git reset HEAD~1, then commit the file without the password", true)}<p class="is-waiting" role="status">Checking your answer…</p></div></main>`,
};

export default async function rep(kit: Kit) {
  const page = await kit.page({ loggedIn: true });
  await kit.open(page, SAMPLE_PATH, ".block h1");
  await kit.render(page, STATES.failed);
  await kit.shoot(page, "rep-failed");
  await kit.render(page, STATES.waiting);
  await kit.shoot(page, "rep-waiting");
  await kit.render(page, STATES.failed);
  await page.locator("textarea").focus();
  await page.keyboard.type("git revert HEAD");
  await kit.shoot(page, "rep-focus-answer");
}
