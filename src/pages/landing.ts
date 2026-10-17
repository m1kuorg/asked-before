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

/** A section after the head: it opens on an iron hairline, with its heading set against the centre, its words across it, and its side-note. */
function section(className: string, heading: string, notes: string[], ...children: Child[]): HTMLElement {
  return el("section", `landing-section ${className}`, el("h2", undefined, heading), el("div", "landing-body", ...children), note(...notes));
}

/** Items between Rule Gray rules, each a title over its words. */
function items<K extends "ol" | "dl">(tag: K, className: string, entries: [string, string][]): HTMLElement {
  const list = el(tag, `landing-items ${className}`);
  for (const [title, words] of entries) {
    list.append(tag === "ol" ? el("li", undefined, el("h3", undefined, title), el("p", undefined, words)) : el("div", undefined, el("dt", undefined, title), el("dd", undefined, words)));
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

/** The sign-up form, as the sign-up page has it: a weak password or an email in use gets the server's message, and signing up goes to the dashboard. */
function signUp(): { form: HTMLFormElement; name: HTMLInputElement } {
  const name = field({ label: "Name", name: "name", autocomplete: "name" });
  const email = field({ label: "Email", name: "email", type: "email", autocomplete: "email" });
  const password = field({ label: "Password", name: "password", type: "password", autocomplete: "new-password", hint: "At least 10 characters." });
  return {
    name: name.input,
    form: form({
      fields: [name.element, email.element, password.element],
      submit: "Sign up",
      onSubmit: async () => {
        const session = await client.auth.signUp({ name: name.input.value, email: email.input.value, password: password.input.value });
        location.assign(session.next);
      },
    }),
  };
}

const signUpForm = signUp();

function head(): Child[] {
  // Sign up goes to the form that closes the page, with its first field ready.
  const start = link("Sign up", "#sign-up", "button");
  start.addEventListener("click", (event) => {
    event.preventDefault();
    document.getElementById("sign-up")!.scrollIntoView({ block: "start" });
    signUpForm.name.focus({ preventScroll: true });
    history.replaceState(null, "", "#sign-up");
  });
  return [
    el("h1", undefined, PITCH),
    el(
      "div",
      "landing-lede",
      el("p", undefined, "Upload a chat export, and Asked Before sorts what you asked into library cards, one for each skill you asked about more than once."),
      el("div", "actions", start),
    ),
  ];
}

function cardHead(): HTMLElement {
  const first = new Date(card.borrows[0]!.at);
  const last = new Date(card.borrows.at(-1)!.at);
  const name = el("h2", "skill", card.skill);
  name.id = "demo-card";
  const head = el(
    "section",
    "landing-card",
    el("div", "heading", name, demoLabel()),
    el("p", undefined, `Borrowed ${card.borrows.length} times, ${monthYear.format(first)} to ${monthYear.format(last)}`),
    plate(card.borrows.length, "times borrowed, not returned"),
    note(
      "The most borrowed card in the demo export, a made-up chat export that comes with Asked Before.",
      "Each phrasing is one of its messages, word for word, beside the day it was sent. Each time it was asked is a borrow, with one key on the rail.",
      "Pass a cold rep, a fresh problem of the skill answered without AI, and the card is stamped returned.",
      "A cut in the rail marks a new year of asking.",
    ),
  );
  head.setAttribute("aria-labelledby", name.id);
  return head;
}

function steps(): HTMLElement {
  return section(
    "landing-steps-section",
    "Three steps",
    [
      "A question you've asked only once waits as unsorted, and becomes a card when you ask it again.",
      "Upload next month's export into the same project, and the phrasings already there are skipped.",
    ],
    items("ol", "landing-steps", [
      [
        "Upload a chat export",
        "Request your data from your chatbot, then drop the export on the upload page, as its .zip or its conversations.json. Your browser reads the file and sends only your phrasings: your own messages, in your own words.",
      ],
      [
        "See your cards",
        "Asked Before sorts your phrasings into cards, one for each skill you've asked about more than once, stacked most borrowed first. Every phrasing is there word for word, stamped with the date you sent it.",
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
    ["System and tool messages stay too. The server logs requests, never your words."],
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
      "Your agent can record each how-to question as you ask it. Asked Before's skill and tools tell it to send only your own words, never its answer, your code, or secrets. If the question is on a card already, the agent says how many times you've borrowed it and can run a cold rep in the chat, told to show the problem, give no hints, and pass on your answer as you wrote it.",
    ),
    items("dl", "landing-setups", [
      ["Claude Code", "Install the Asked Before plugin: the MCP server, and a skill that tells the agent when to use it."],
      ["Claude Desktop and Cursor", "Add the MCP server with a config snippet."],
    ]),
    link("Read the docs", "/docs", "button secondary"),
  );
}

function close(): HTMLElement {
  const node = section(
    "landing-close",
    "Sign up",
    ["Once you sign up, this browser stays logged in for 30 days, or until you log out."],
    el(
      "p",
      undefined,
      "An account keeps your projects, their cards, and every return stamp. Your first visit offers a demo project made from the demo export, so you can try every step before you find your own export.",
    ),
    signUpForm.form,
    el("p", undefined, "Already signed up? ", link("Log in", "/login")),
  );
  node.id = "sign-up";
  return node;
}

const root = document.querySelector<HTMLElement>("#app")!;
root.replaceChildren(el("main", "block", ...head(), cardHead(), ...rails(card.borrows), steps(), privacy(), agents(), close()));
