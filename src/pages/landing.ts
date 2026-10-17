// The landing page. It mounts into #app like every screen, from the shared
// parts: the pitch, card A of the demo export (demo-card.ts, read when the
// page is bundled) set on the rail with the card stack's own markup and
// stack.css, the three steps, what leaves this computer, agents, and the
// sign-up close. Each section's side-note is an `aside.margin` that
// landing.css hangs into the wide margin beside it.

import { el, link, type Child } from "../parts/dom";
import { field, form } from "../parts/fields";
import { plate } from "../parts/frame";
import { PRIVACY_LINE, demoLabel, stamp } from "../parts/library";
import { client } from "./account";
import { demoCard } from "./demo-card" with { type: "macro" };

const PITCH = "Turn a question you keep asking into one you can answer without AI.";

const card = demoCard();
const monthYear = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

/** A side-note: margin notes in sentence case, beside the section that holds it. */
const note = (...lines: string[]) => el("aside", "margin", ...lines.map((line) => el("p", undefined, line)));

/** A section after the head: it opens on an iron hairline, with its heading and its side-note. */
function section(className: string, heading: string, notes: string[], ...children: Child[]): HTMLElement {
  return el("section", `landing-section ${className}`, el("h2", undefined, heading), ...children, note(...notes));
}

/** Pairs set on the rail's columns: what it is on the left, what it means on the right. */
function pairs<K extends "ol" | "dl">(tag: K, className: string, items: [string, string][]): HTMLElement {
  const list = el(tag, `landing-pairs ${className}`);
  for (const [term, words] of items) {
    list.append(tag === "ol" ? el("li", undefined, el("h3", undefined, term), el("p", undefined, words)) : el("div", undefined, el("dt", undefined, term), el("dd", undefined, words)));
  }
  return list;
}

/** A phrasing as text, with each command flag (such as --soft) kept whole on its line. */
function phrasing(text: string): HTMLElement {
  const node = el("span", "phrasing");
  for (const [i, part] of text.split(/(--[\w-]+)/).entries()) if (part) node.append(i % 2 ? el("span", undefined, part) : part);
  return node;
}

/** One rail per year of borrows, a key on it for each, as the card stack sets them. */
function rails(borrows: { text: string; at: string }[]): HTMLElement[] {
  const years = Map.groupBy(borrows, (borrow) => new Date(borrow.at).getFullYear());
  return [...years].map(([year, rows]) => {
    const rail = el(
      "ol",
      "rail",
      ...rows.map((borrow) => {
        const key = el("span", "rail-key");
        key.setAttribute("aria-hidden", "true");
        return el("li", undefined, phrasing(borrow.text), key, el("span", "stamp", stamp(borrow.at)));
      }),
    );
    rail.setAttribute("aria-label", `Borrowed in ${year}`);
    return rail;
  });
}

function head(): Child[] {
  return [
    el("h1", undefined, PITCH),
    el(
      "div",
      "landing-lede",
      el(
        "p",
        undefined,
        "Upload a chat export, and Asked Before sorts what you asked into library cards, one for each skill you asked about more than once. A card is stamped returned only once you pass a cold rep on it by yourself.",
      ),
      el("div", "actions", link("Sign up", "/signup", "button"), link("Log in", "/login", "button secondary")),
    ),
  ];
}

function cardHead(): HTMLElement {
  const first = new Date(card.borrows[0]!.at);
  const last = new Date(card.borrows.at(-1)!.at);
  return el(
    "div",
    "landing-card",
    el("div", "heading", el("h2", "skill", card.skill), demoLabel()),
    el("p", undefined, `Borrowed ${card.borrows.length} times, ${monthYear.format(first)} to ${monthYear.format(last)}`),
    plate(card.borrows.length, "times borrowed, not returned"),
    note(
      "The most borrowed card in the demo export, a made-up chat export that comes with Asked Before.",
      "Each phrasing is one of its messages, word for word, beside the day it was sent, and each key on the rail is one borrow.",
      "A cut in the rail marks a new year of asking.",
    ),
  );
}

function steps(): HTMLElement {
  return section(
    "landing-steps-section",
    "From an export to a returned card",
    [
      "A question you've asked only once waits as unsorted, and becomes a card when you ask it again.",
      "Upload next month's export into the same project, and the phrasings already there are skipped.",
    ],
    pairs("ol", "landing-steps", [
      [
        "Upload a chat export",
        "Request your data from your chatbot, then drop the export on the upload page, as its .zip or its conversations.json. Your browser reads the file and sends only your own messages.",
      ],
      [
        "See your cards",
        "Asked Before sorts them into cards, one for each skill you've asked about more than once, stacked most borrowed first. Every phrasing is there word for word, stamped with the date you sent it.",
      ],
      [
        "Pass a cold rep",
        "Open a card for a fresh problem of its skill, and answer it in a plain box, without AI. Pass, and the card is stamped returned. Ask the chatbot again later, and the card is borrowed again.",
      ],
    ]),
  );
}

function privacy(): HTMLElement {
  return section(
    "landing-privacy",
    "What leaves this computer",
    ["System and tool messages stay here too.", "The server's logs keep each request's method, path, status, and duration, never your words."],
    el("p", "landing-statement", PRIVACY_LINE),
  );
}

function agents(): HTMLElement {
  return section(
    "landing-agents",
    "In your coding agent",
    ["Your agent reaches your projects with an API key you make in Settings, where each agent's setup has your server address filled in."],
    el(
      "p",
      undefined,
      "When you ask your agent how to do something, it can record the question in your own words, never its answer, your code, or secrets. If the question is on a card already, the agent says how many times you've borrowed it and offers a cold rep in the chat: it shows the problem, gives no hints, and sends your answer as you wrote it.",
    ),
    pairs("dl", "landing-setups", [
      ["Claude Code", "Install the Asked Before plugin, which brings the MCP server and a skill that tells the agent when to use it."],
      ["Claude Desktop and Cursor", "Add the MCP server with a config snippet."],
    ]),
    link("Read the docs", "/docs", "button secondary"),
  );
}

/** The sign-up form, as the sign-up page has it: a weak password or an email in use gets the server's message, and signing up goes to the dashboard. */
function signUp(): HTMLFormElement {
  const name = field({ label: "Name", name: "name", autocomplete: "name" });
  const email = field({ label: "Email", name: "email", type: "email", autocomplete: "email" });
  const password = field({ label: "Password", name: "password", type: "password", autocomplete: "new-password", hint: "At least 10 characters." });
  return form({
    fields: [name.element, email.element, password.element],
    submit: "Sign up",
    onSubmit: async () => {
      const session = await client.auth.signUp({ name: name.input.value, email: email.input.value, password: password.input.value });
      location.assign(session.next);
    },
  });
}

function close(): HTMLElement {
  return section(
    "landing-close",
    "Sign up",
    ["Once you sign up, this browser stays logged in for 30 days, or until you log out."],
    el(
      "div",
      "landing-columns",
      el(
        "div",
        undefined,
        el(
          "p",
          undefined,
          "An account keeps your projects, their cards, and every return stamp. Your first visit offers a demo project made from the demo export, so you can try the whole journey before you find your own export.",
        ),
        el("p", undefined, "Already signed up?"),
        link("Log in", "/login", "button secondary"),
      ),
      signUp(),
    ),
  );
}

const root = document.querySelector<HTMLElement>("#app")!;
root.replaceChildren(el("main", "block", ...head(), cardHead(), ...rails(card.borrows), steps(), privacy(), agents(), close()));
