// One card and its cold rep (m1kuorg/basics#46), with the look the proof of
// concept's rep screen shipped (public/styles/rep.css): the card's skill at
// the head of the block, its count on the plate after its status, and the
// rep either side of a centre hairline, with what you were told on the left
// (the verdict, the lesson) and what you do on the right (the problem and
// the answer box). The margin names the card's project, its borrows and
// months, and its status. Under the rep, the card's phrasings on the rail
// with their stamps, closed by its return stamp, then its earlier cold
// reps, newest first, each with its problem and verdict.
//
// Opening a card takes its rep up where it stands: an open rep (the latest,
// unchecked) is shown again, after the reason of a failed one before it;
// otherwise the card shows with Take a cold rep, which starts a fresh one,
// so opening a card to look at it spends no model request. The card's
// first rep brings the lesson; a failed rep shows its reason and the lesson
// again, then a different problem; a pass stamps the card returned on the
// day it passed, and leads back to the stack. Every model wait has its
// waiting line, and every failure its error and a retry of the same
// request; the answer stays locked while it's checked, so a retry checks
// what's on screen.

import type { CardDetail, Project, Rep } from "@asked-before/sdk";
import type { ScreenProps } from "../app/router";
import { borrowedAgain, flagged, months, PLATE_CAPTION, railEnd, rails } from "../parts/card";
import { button, el, link } from "../parts/dom";
import { failure, frame, load, plate, waiting } from "../parts/frame";
import { demoLabel, privacyLine, stamp } from "../parts/library";
import { rows } from "../parts/rows";

const projectPath = (projectId: string) => `/app/projects/${encodeURIComponent(projectId)}`;

/** A titled section whose text keeps the model's line breaks as paragraphs. */
function section(className: string, title: string, text: string): HTMLElement {
  const node = el("section", className, el("h2", undefined, title));
  for (const line of text.split(/\n+/).filter((l) => l.trim())) node.append(el("p", undefined, ...flagged(line)));
  return node;
}

/** What you were told before a problem: the reason a rep failed, and the lesson, again after a failure. */
function told(failed: Rep | null, lesson: string | null): HTMLElement[] {
  return [
    ...(failed ? [section("verdict is-failed", "Still borrowed", failed.reason ?? "")] : []),
    ...(lesson ? [section("lesson", failed ? "The lesson, again" : "The lesson", lesson)] : []),
  ];
}

export function mountCard(root: HTMLElement, { client, params, navigate, signal }: ScreenProps<"cardId">) {
  const { margin, block } = frame(root);

  load(block, {
    keep: [el("h1", undefined, "Card")],
    line: "Finding the card…",
    request: async () => {
      const card = await client.cards.get(params.cardId);
      return { card, project: await client.projects.get(card.projectId) };
    },
    signal,
    show: ({ card, project }) => setCard(card, project),
  });

  function setCard(first: CardDetail, project: Project) {
    let card = first;
    document.title = `${card.skill} · Asked Before`;
    const step = el("div");
    const status = el("p");
    const cardRails = rails(card.borrows);
    let plateNode = plate(card.count, PLATE_CAPTION[card.status]);
    let closing: HTMLElement | null = null;
    let earlier: HTMLElement | null = null;

    const name = el("p", "project-name", link(project.name, projectPath(project.id)));
    if (project.demo) name.append(demoLabel());
    margin.replaceChildren(
      name,
      el("p", undefined, `Borrowed ${card.count} times, ${months(card)}.`),
      status,
      el("p", undefined, "Answer without AI. A pass stamps the card returned."),
      ...(cardRails.length > 1 ? [el("p", undefined, "A cut in the rail marks a new year of asking.")] : []),
      privacyLine(),
    );
    block.replaceChildren(el("h1", "skill", card.skill), plateNode, step, el("h2", "rail-heading", "Your phrasings, oldest first"), ...cardRails);
    showStatus();

    const lastChecked = card.reps.findLast((rep) => rep.checkedAt !== null) ?? null;
    const failedBefore = lastChecked?.verdict === "fail" ? lastChecked : null;
    const open = card.reps.at(-1)?.checkedAt === null ? card.reps.at(-1)! : null;
    if (open) answer(told(failedBefore, lastChecked?.verdict === "pass" ? null : card.lesson), open);
    else offer(failedBefore);

    /** The card's status wherever it shows: the margin, the plate, the end of its rail, and its earlier reps. */
    function showStatus() {
      status.replaceChildren(
        ...(card.returnedAt === null ? ["Not returned yet."] : card.status === "borrowed_again" ? borrowedAgain(card.returnedAt) : ["Returned ", stamp(card.returnedAt), "."]),
      );
      const next = plate(card.count, PLATE_CAPTION[card.status]);
      plateNode.replaceWith(next);
      plateNode = next;

      closing?.remove();
      closing = railEnd(card);
      if (closing) cardRails.at(-1)!.after(closing);

      const checked = card.reps.filter((rep) => rep.checkedAt !== null).reverse();
      earlier?.remove();
      earlier = checked.length
        ? el(
            "section",
            "earlier-reps",
            el("h2", undefined, "Earlier cold reps, newest first"),
            rows({
              caption: `Earlier cold reps on ${card.skill}, newest first`,
              items: checked,
              columns: [
                { label: "Checked", className: "is-date", cell: (rep) => el("span", "row-title", stamp(rep.checkedAt!)) },
                { label: "Problem", cell: (rep) => rep.problem },
                { label: "Verdict", className: "is-verdict", cell: (rep) => (rep.verdict === "pass" ? "Returned" : "Still borrowed") },
              ],
            }),
          )
        : null;
      if (earlier) block.append(earlier);
    }

    /**
     * Sends one request with a waiting line under `above`, then hands the
     * reply to `done`. A failure shows the error and a retry of the same
     * request. Nothing is drawn once the learner has left.
     */
    function send<T>(line: string, request: () => Promise<T>, above: Node[], done: (reply: T) => void) {
      step.replaceChildren(...above, waiting(line));
      request().then(
        (reply) => {
          if (!signal.aborted) done(reply);
        },
        (error: unknown) => {
          if (signal.aborted) return;
          const [notice, retry] = failure(error, () => send(line, request, above, done));
          step.replaceChildren(...above, notice!, retry!);
          retry!.focus({ preventScroll: true });
        },
      );
    }

    /** The action that starts a fresh rep; after a failed one, under its reason and the lesson again. */
    function offer(failed: Rep | null) {
      const take = button("Take a cold rep", () => start(failed));
      step.replaceChildren(...told(failed, failed && card.lesson), take);
      take.focus({ preventScroll: true });
    }

    /** Starts a fresh rep. After a failed one, its reason and the lesson again stay above while the problem is written. */
    function start(failed: Rep | null) {
      const line = card.lesson === null ? "Writing the lesson and pulling a problem…" : "Pulling a fresh problem…";
      send(line, () => client.reps.start(card.id), told(failed, failed && card.lesson), ({ rep, lesson }) => {
        card = { ...card, lesson: lesson ?? card.lesson, reps: [...card.reps, rep] };
        answer(told(failed, lesson), rep);
      });
    }

    /** Shows the rep's problem under `above`, with the answer box. */
    function answer(above: Node[], rep: Rep) {
      const shown = section("problem", "The problem", rep.problem);
      const text = el("textarea");
      text.name = "answer";
      text.rows = 6;
      text.required = true;
      const submit = el("button", undefined, "Check my answer");
      submit.type = "submit";
      const box = el("form", "answer-box", el("label", undefined, "Your answer, in your own words, without AI", text), submit);
      step.replaceChildren(...above, shown, box);
      text.focus({ preventScroll: true });

      box.addEventListener("submit", (event) => {
        event.preventDefault();
        const yours = text.value.trim();
        if (!yours) return;
        // Locked from here on, so a retry checks exactly the answer on screen.
        text.readOnly = true;
        submit.disabled = true;
        send("Checking your answer…", () => client.reps.check(rep.id, { answer: yours }), [...above, shown, box], (checked) => {
          card = { ...card, ...checked.card, reps: card.reps.map((r) => (r.id === checked.rep.id ? checked.rep : r)) };
          showStatus();
          if (checked.rep.verdict === "fail") return start(checked.rep);
          submit.remove();
          const passed = section("verdict", "Returned", checked.rep.reason ?? "");
          passed.append(el("p", "stamp", "Stamped returned ", stamp(checked.rep.checkedAt!)));
          const back = button("Back to the stack", () => navigate(`${projectPath(card.projectId)}?card=${encodeURIComponent(card.id)}`));
          step.replaceChildren(shown, box, passed, back);
          back.focus({ preventScroll: true });
        });
      });
    }
  }
}
