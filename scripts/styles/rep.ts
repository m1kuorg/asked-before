// The cold rep's states on the real card page (public/styles/rep.css;
// m1kuorg/basics#46): the demo export uploaded into a project and sorted
// as the answer key sorts it, then card A's rep, with the rep and check
// requests answered by the styles check's model stand-in, queued here and
// never in the app. Its states: the card opened, with Take a cold rep;
// the first rep, with the lesson and a problem; waiting on a check with the answer locked; a failed check's
// error and retry; a failed rep, with the reason, the lesson again, and a
// fresh problem; typing in the focused answer box; a pass, with its stamp
// and the way back in the frame; the whole card page under it, with the
// card's phrasings, its return stamp, and its earlier reps; and a narrow
// screen. The project is deleted at the end, since the modules after this
// one share the learner and expect no projects.

import type { Page } from "playwright";
import { phrasings, sortEnds, upload } from "../lib/answer-key";
import { hold, refuse } from "../lib/model-stub";
import { known, repReply, verdictReply } from "../lib/reps";
import { FRAME, type Kit } from "../lib/styles";

const LESSON = [
  "A commit you haven't pushed can be taken back by moving your branch back one commit.",
  "git reset --soft HEAD~1 keeps the changes staged, --mixed keeps them unstaged, and --hard throws them away.",
  "Once a commit is pushed, use git revert, which adds a new commit instead of rewriting history.",
].join("\n");
const PROBLEMS = [
  "You committed two files to main, then saw that one of them holds a password. Nothing is pushed yet. You want both files' changes back in your working tree, uncommitted. What would you type?",
  "You pushed a commit to the shared main branch an hour ago, and two teammates have already pulled it. It broke the checkout page. You want main's code as it was before that commit. What would you type?",
];
const FAILED = "git revert HEAD keeps the bad commit in history and adds a second one that undoes it. This problem asks for the commit to be gone before you push, with your changes kept.";
const PASSED = "You chose git revert for a commit others already have, which undoes it with a new commit and leaves their history alone.";

/** Lets every key drop settle. */
const settle = (page: Page) => page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)).then(() => undefined));

export default async function rep(kit: Kit) {
  const { check, learner, model } = kit;
  const project = await learner.client.projects.create({ name: "Bootcamp" });
  try {
    await states(kit, project.id);
  } finally {
    await learner.client.projects.delete(project.id);
  }
}

async function states(kit: Kit, projectId: string) {
  const { check, learner, model } = kit;
  const sorted = await sortEnds(learner.client, (await upload(learner.client, projectId, phrasings, "bootcamp.json")).id);
  const [A] = await learner.client.cards.list(projectId);
  check(sorted.status === "sorted" && A !== undefined, `the demo export is sorted into a project, card A "${A?.skill}"`);
  const at = `/app/cards/${A!.id}`;
  const page = await kit.page({ loggedIn: true });
  const textarea = page.locator(".answer-box textarea");
  const checkAnswer = page.getByRole("button", { name: "Check my answer" });

  // Opened, the card shows with Take a cold rep, and no rep starts until it's chosen.
  await kit.open(page, at, '.block button:text-is("Take a cold rep")');
  await settle(page);
  await kit.shoot(page, "rep-opened");

  // The first rep: the lesson on the left, the problem and the answer box on the right.
  model.queue(repReply(PROBLEMS[0]!, LESSON));
  await page.getByRole("button", { name: "Take a cold rep" }).click();
  await page.locator(".block .problem").waitFor();
  await kit.shoot(page, "rep-first");

  // Waiting on a check, with the answer locked.
  const checking = hold();
  model.queue(checking.answer);
  await textarea.fill(known.wrong);
  await checkAnswer.click();
  await checking.reached;
  await page.locator(".block .is-waiting").waitFor();
  const frame = await textarea.evaluate((t) => `${getComputedStyle(t).borderTopStyle} ${getComputedStyle(t).borderTopColor}`);
  check(frame === "dotted rgb(96, 98, 99)", `a locked answer's frame drops to a dotted Disabled Gray rule (${frame})`);
  await kit.shoot(page, "rep-waiting", { plate: true });

  // The check fails: its error and a retry, under the locked answer.
  checking.release(refuse());
  await page.locator(".block .error").waitFor();
  await kit.shoot(page, "rep-error", { plate: true });

  // The retry fails the rep: the reason, the lesson again, and a fresh problem.
  model.queue(verdictReply("fail", FAILED), repReply(PROBLEMS[1]!));
  await page.getByRole("button", { name: "Try again" }).click();
  await page.locator(".block .verdict.is-failed ~ .problem").waitFor();
  const heavy = await page.locator(".verdict.is-failed").evaluate((v) => `${getComputedStyle(v).borderTopWidth} ${getComputedStyle(v).borderTopColor}`);
  check(heavy === "3px rgb(26, 26, 26)", `a failed verdict's frame is 3px iron black (${heavy})`);
  await kit.shoot(page, "rep-failed");

  // Typing in the focused answer box.
  await textarea.focus();
  await page.keyboard.type("git revert HEAD");
  await kit.shoot(page, "rep-focus-answer");

  // A pass: Returned, stamped, with the way back under it, inside the frame.
  model.queue(verdictReply("pass", PASSED));
  await textarea.fill(known.right);
  await checkAnswer.click();
  await page.getByRole("button", { name: "Back to the stack" }).waitFor();
  const back = await page.getByRole("button", { name: "Back to the stack" }).evaluate((b) => b.getBoundingClientRect().bottom);
  check(back <= FRAME.height, `after a pass, the way back sits in the 1080 frame however long the answer (its foot at ${Math.round(back)}px)`);
  const light = await page.locator(".verdict:not(.is-failed)").evaluate((v) => getComputedStyle(v).borderTopWidth);
  check(light === "1px", `the Returned verdict's frame is 1px (${light})`);
  await kit.shoot(page, "rep-passed");
  check((await page.evaluate(() => document.getAnimations().length)) === 0, "the returned card's keys are seated, with no drop");
  await kit.shoot(page, "card-page", { fullPage: true });

  // A narrow screen: one column, the rail outboard.
  await page.setViewportSize({ width: 390, height: 844 });
  await settle(page);
  await kit.shoot(page, "rep-narrow", { fullPage: true });
  await page.setViewportSize(FRAME);
}
