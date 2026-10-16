// The Rep screen. The card's first rep comes with its lesson; you answer a
// fresh problem in a plain box, and the check gives a verdict with a reason.
// A fail shows the reason and the lesson again, then a different problem; a
// pass stamps the card returned and hands back today's date.

import { postJson } from "../api";
import type { CheckResponse, RepProps, RepRequest, RepResponse } from "../types";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text: string, onClick: () => void, className?: string) {
  const node = el("button", className, text);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

/** A titled section whose text keeps the model's line breaks as paragraphs. */
function section(className: string, title: string, text: string) {
  const node = el("section", className);
  node.append(el("h2", undefined, title));
  for (const line of text.split(/\n+/).filter((l) => l.trim())) node.append(el("p", undefined, line));
  return node;
}

/** Today in the visitor's own calendar, as yyyy-mm-dd. */
function today() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function mountRep(root: HTMLElement, { card, onReturned }: RepProps) {
  const phrasings = card.borrows.map((borrow) => borrow.text);
  /** Every problem shown on this card so far, sent with each later rep. */
  const problems: string[] = [];
  let lesson = "";

  const margin = el("aside", "margin");
  margin.append(
    el("p", undefined, `Borrowed ${card.firstMonth} to ${card.lastMonth}.`),
    el("p", undefined, "Answer without AI. A pass stamps the card returned."),
  );
  const plate = el("div", "plate");
  plate.append(el("b", undefined, String(card.count)), " ", el("span", undefined, "times borrowed"));
  const step = el("div");
  const block = el("main", "block");
  block.append(el("h1", "skill", card.skill), plate, step);
  root.append(margin, block);

  /**
   * Sends one request with a waiting line under `above`, then hands the reply
   * to `done`. A failure shows the error and a retry of the same request.
   */
  function send<T>(line: string, request: () => Promise<T>, above: Node[], done: (reply: T) => void) {
    const waiting = el("p", "is-waiting", line);
    waiting.setAttribute("role", "status");
    step.replaceChildren(...above, waiting);
    request().then(done, (error: unknown) => {
      const message = el("p", "error", error instanceof Error ? error.message : String(error));
      message.setAttribute("role", "alert");
      const retry = button("Try again", () => send(line, request, above, done), "retry");
      step.replaceChildren(...above, message, retry);
      retry.focus({ preventScroll: true });
    });
  }

  /** Asks for the next rep. After a fail, `above` is the reason and the lesson again. */
  function rep(above: Node[]) {
    const withLesson = problems.length === 0;
    const body: RepRequest = { skill: card.skill, phrasings, earlierProblems: [...problems], withLesson };
    const line = withLesson ? "Writing the lesson and pulling a problem…" : "Pulling a fresh problem…";
    send(line, () => postJson("/api/rep", body).then((reply) => assertRep(reply, withLesson)), above, (reply) => {
      if (withLesson) {
        lesson = reply.lesson!;
        above = [section("lesson", "The lesson", lesson)];
      }
      answer(above, reply.problem);
    });
  }

  /** Shows the problem under `above`, with the answer box. */
  function answer(above: Node[], problem: string) {
    problems.push(problem);
    const shown = section("problem", "The problem", problem);
    const box = el("form", "answer-box");
    const label = el("label", undefined, "Your answer, in your own words, without AI");
    const text = el("textarea");
    text.name = "answer";
    text.rows = 6;
    text.required = true;
    label.append(text);
    const submit = el("button", undefined, "Check my answer");
    submit.type = "submit";
    box.append(label, submit);
    step.replaceChildren(...above, shown, box);
    text.focus({ preventScroll: true });

    box.addEventListener("submit", (event) => {
      event.preventDefault();
      const yours = text.value.trim();
      if (!yours) return;
      // Locked from here on, so a retry resends exactly the answer on screen.
      text.readOnly = true;
      submit.disabled = true;
      const body = { skill: card.skill, problem, answer: yours };
      send("Checking your answer…", () => postJson("/api/check", body).then(assertVerdict), [...above, shown, box], ({ verdict, reason }) => {
        if (verdict === "fail") {
          rep([section("verdict is-failed", "Still borrowed", reason), section("lesson", "The lesson, again", lesson)]);
          return;
        }
        submit.remove();
        const date = today();
        const passed = section("verdict", "Returned", reason);
        passed.append(el("p", "stamp", `Stamped returned ${date}`));
        const back = button("Back to the stack", () => onReturned(date));
        step.replaceChildren(shown, box, passed, back);
        back.focus({ preventScroll: true });
      });
    });
  }

  rep([]);
}

/** Never shows a lesson or problem that didn't arrive. */
function assertRep(reply: RepResponse, withLesson: boolean) {
  if (typeof reply?.problem !== "string" || !reply.problem.trim()) throw new Error("The rep came back without a problem.");
  if (withLesson && (typeof reply.lesson !== "string" || !reply.lesson.trim())) {
    throw new Error("The rep came back without its lesson.");
  }
  return reply;
}

/** Never shows a verdict that didn't arrive. */
function assertVerdict(reply: CheckResponse) {
  if ((reply?.verdict !== "pass" && reply?.verdict !== "fail") || typeof reply.reason !== "string") {
    throw new Error("The check came back without a verdict.");
  }
  return reply;
}
