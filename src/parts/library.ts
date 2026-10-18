// Small pieces of the library's voice shared across screens: the privacy
// line, the demo-data label, a stamp's date, a count, and an export's
// chatbot by name.

import { el } from "./dom";

/** The privacy line (m1kuorg/basics#40, Privacy), shown wherever a phrasing is sent: the upload page, the landing page, and the like. */
export const PRIVACY_LINE =
  "Only your own messages, with when you sent them, leave this computer. The chatbot's answers and your titles never do, and the model sees your words only, never your dates.";

export const privacyLine = () => el("p", "privacy-line", PRIVACY_LINE);

/** A count as the page writes it, such as "2,000". */
export const count = (n: number) => n.toLocaleString("en-US");

/** Each export's chatbot, by name. */
export const SOURCES = { chatgpt: "ChatGPT", claude: "Claude" } as const;

/** The label beside a demo shelf's name, wherever it shows. */
export const demoLabel = () => el("span", "demo-label", "Demo data");

const pad = (n: number) => String(n).padStart(2, "0");

/** An ISO time as the date it falls on in the learner's own time zone, yyyy-mm-dd, in a <time>. */
export function stamp(iso: string): HTMLTimeElement {
  const at = new Date(iso);
  const node = el("time", undefined, `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`);
  node.dateTime = iso;
  return node;
}
