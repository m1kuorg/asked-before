// The dashboard's states (public/styles/dashboard.css; m1kuorg/basics#47),
// on the real page: a new learner's empty state, and its first upload
// refused for want of a name; waiting and failed, with the dashboard's
// request held and answered here, never in the app; a project with no cards
// yet; then the demo export sorted into a demo project as the answer key
// sorts it, card A returned and card B borrowed again by real cold reps (the
// model stand-in's answers queued here) and a newer borrow of B's skill, so
// every status shows: the first viewport, a focused cold rep link, the whole
// page, and a narrow screen. Its projects are deleted at the end, since the
// modules after this one share the learner and expect none.

import type { Route } from "playwright";
import { key, phrasings, sortEnds, upload } from "../lib/answer-key";
import { repReply, verdictReply } from "../lib/reps";
import type { Kit } from "../lib/styles";

export default async function dashboard(kit: Kit) {
  const { learner } = kit;
  const made: string[] = [];
  try {
    await states(kit, made);
  } finally {
    for (const id of made) await learner.client.projects.delete(id);
  }
}

async function states(kit: Kit, made: string[]) {
  const { check, learner, model } = kit;
  const page = await kit.page({ loggedIn: true });
  const block = page.locator(".block");

  // A new learner: the empty state, and the first upload's field refused for want of a name.
  await kit.open(page, "/app", ".block .empty");
  await kit.shoot(page, "dashboard-empty");
  await block.getByRole("button", { name: "Upload a chat export" }).click();
  await block.locator(".first-project .error").waitFor();
  const invalid = await block.getByLabel("Or name your first project").evaluate((input) => `${input.getAttribute("aria-invalid")} ${getComputedStyle(input).borderTopWidth}`);
  check(invalid === "true 3px", `the unnamed project's field is marked, its frame 3px (${invalid})`);
  await kit.shoot(page, "dashboard-first-project-refused");

  // Waiting, then a failure and its retry, with the dashboard's request held and answered here, never in the app.
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  const hold = async (route: Route) => {
    await held;
    await route.fulfill({ status: 500, json: { error: "The server failed." } });
  };
  await page.route("**/api/v1/dashboard", hold);
  await kit.open(page, "/app", ".block .is-waiting");
  await kit.shoot(page, "dashboard-waiting");
  release();
  await block.locator(".error").waitFor();
  await kit.shoot(page, "dashboard-failed");
  await page.unroute("**/api/v1/dashboard", hold);

  // A project, but no cards yet.
  const work = await learner.client.projects.create({ name: "Work" });
  made.push(work.id);
  await block.getByRole("button", { name: "Try again" }).click();
  await block.locator(".empty", { hasText: "Upload a chat export into one of your projects" }).waitFor();
  await kit.shoot(page, "dashboard-no-cards");

  // The demo export, sorted as the key sorts it; card A passes a cold rep, and card B passes one, then a newer borrow of its skill makes it borrowed again.
  const demo = await learner.client.projects.create({ name: "Demo", demo: true });
  made.push(demo.id);
  const sorted = await sortEnds(learner.client, (await upload(learner.client, demo.id, phrasings, "demo-export.json")).id);
  const [A, B] = await learner.client.cards.list(demo.id);
  let stamped = "";
  for (const card of [A!, B!]) {
    model.queue(repReply("A problem of the card's skill.", "The card's lesson."), verdictReply("pass", "You did it."));
    const { rep } = await learner.client.reps.start(card.id);
    stamped = (await learner.client.reps.check(rep.id, { answer: "My own answer." })).card.returnedAt!;
  }
  // One of card B's own phrasings, asked again a second after its return stamp, so the stand-in sorts it onto B.
  const again = phrasings[Number(key.skills[1]!.messageIds[0]!.slice(1)) - 1]!;
  const newer = await upload(learner.client, demo.id, [{ sourceId: "styles-again", text: again.text, time: new Date(Date.parse(stamped) + 1000).toISOString() }]);
  await sortEnds(learner.client, newer.id);
  const statuses = (await learner.client.cards.list(demo.id)).map((card) => card.status);
  check(sorted.status === "sorted" && statuses[0] === "returned" && statuses[1] === "borrowed_again", `the demo project's cards are ${statuses.join(", ")}`);

  await kit.open(page, "/app", ".block .latest-returns table.rows");
  await kit.shoot(page, "dashboard");
  check((await page.evaluate(() => document.getAnimations().length)) === 0, "the rail's keys are seated, with no drop");
  const ledgerRule = await page.locator(".margin .ledger-total").evaluate((line) => `${getComputedStyle(line).borderTopWidth} ${getComputedStyle(line).borderTopColor}`);
  check(ledgerRule === "1px rgb(26, 26, 26)", `All cards is ruled off by an iron hairline (${ledgerRule})`);

  // The cold rep link, from the keyboard.
  const take = block.locator(".take-rep");
  for (let i = 0; i < 40 && !(await take.evaluate((link) => link === document.activeElement)); i++) await page.keyboard.press("Tab");
  check(await take.evaluate((link) => link.matches(":focus-visible")), "the cold rep link takes the keyboard's focus, bracketed");
  await kit.shoot(page, "dashboard-focus");

  await kit.shoot(page, "dashboard-full", { fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await kit.open(page, "/app", ".block .latest-returns table.rows");
  await kit.shoot(page, "dashboard-narrow", { fullPage: true });
}
