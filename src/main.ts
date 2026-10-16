// The page entry. It holds the in-memory state, draws the top navigation with
// the demo-data label, and mounts one screen at a time into #app.

import { ExportError, parseExport } from "./parser";
import { mountLoad } from "./screens/load";
import { mountRep } from "./screens/rep";
import { mountStack } from "./screens/stack";
import type { Card, LoadProps, Message } from "./types";

/** The one privacy line; the Load and Stack screens render it as `.privacy-line`. */
export const PRIVACY_LINE =
  "Only your own messages go to the model. The chatbot's answers, your titles, and your dates stay on this computer.";

const DEMO_EXPORT = "/demo/export.json";

const root = document.querySelector<HTMLElement>("#app")!;
const nav = document.createElement("nav");
const name = document.createElement("span");
name.textContent = "Asked Before";
const label = document.createElement("span");
label.className = "demo-label";
label.textContent = "Demo data: a made-up chat export";
nav.append(name, " ", label);
root.before(nav);

let messages: Message[] = [];
const returned = new Map<string, string>();

async function readExport(): Promise<LoadProps["state"]> {
  try {
    const response = await fetch(DEMO_EXPORT);
    if (!response.ok) throw new ExportError(`The chat export couldn't be fetched (${response.status}).`);
    return { messages: parseExport(await response.text()) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

async function showLoad() {
  const state = await readExport();
  messages = "messages" in state ? state.messages : [];
  root.replaceChildren();
  mountLoad(root, { state, onLoad: showStack, onRetry: showLoad });
}

function showStack() {
  root.replaceChildren();
  mountStack(root, { messages, returned, onOpen: showRep });
}

function showRep(card: Card) {
  root.replaceChildren();
  mountRep(root, {
    card,
    onReturned: (date) => {
      returned.set(card.skill, date);
      showStack();
    },
  });
}

showLoad();
