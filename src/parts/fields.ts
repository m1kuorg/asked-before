// Form fields and forms. A field is a label over a square box in body type,
// with an optional hint under it that the box is described by. A form sends
// itself through `onSubmit` with its button locked, and shows the failure's
// message as a notice, so every form in the app answers the same way. When
// the message names exactly one of the form's fields (by its name or its
// label, such as "A password needs..."), that field is marked invalid,
// described by the notice, and focused. The browser's own validation bubbles
// are off: the server's messages say what's wrong.

import { el, uniqueId, type Child } from "./dom";
import { notice } from "./frame";
import { messageOf } from "./messages";

export type FieldOptions = {
  label: string;
  name: string;
  type?: "text" | "email" | "password" | "url";
  value?: string;
  /** Such as "email", "current-password", or "new-password", so the browser fills what it should. */
  autocomplete?: AutoFill;
  hint?: string;
  placeholder?: string;
  required?: boolean;
};

export function field({ label, name, type = "text", value, autocomplete, hint, placeholder, required = false }: FieldOptions): {
  element: HTMLElement;
  input: HTMLInputElement;
} {
  const input = el("input");
  input.id = uniqueId("field");
  input.name = name;
  input.type = type;
  input.required = required;
  if (value !== undefined) input.value = value;
  if (autocomplete) input.autocomplete = autocomplete;
  if (placeholder) input.placeholder = placeholder;
  const caption = el("label", undefined, label);
  caption.htmlFor = input.id;
  const element = el("div", "field", caption, input);
  if (hint) {
    const note = el("p", "field-hint", hint);
    note.id = uniqueId("hint");
    input.setAttribute("aria-describedby", note.id);
    element.append(note);
  }
  return { element, input };
}

export type FormOptions = {
  fields: Child[];
  /** The button's words: the action it takes, such as "Create project". */
  submit: string;
  /** Sends the form. A thrown error shows as the form's notice, and the button unlocks again. */
  onSubmit: (form: HTMLFormElement) => Promise<void>;
  /** "column" sets the fields one under another; "row" sets one field and its button on one line. */
  layout?: "column" | "row";
  className?: string;
};

export function form({ fields, submit, onSubmit, layout = "column", className }: FormOptions): HTMLFormElement {
  const button = el("button", undefined, submit);
  button.type = "submit";
  const node = el("form", [layout === "row" ? "field-row" : "form", className].filter(Boolean).join(" "), ...fields, button);
  node.noValidate = true;
  let shown: HTMLElement | undefined;
  let marked: HTMLInputElement | undefined;

  node.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (button.disabled) return;
    if (shown) {
      shown.remove();
      if (marked) unmark(marked, shown.id);
      shown = marked = undefined;
    }
    button.disabled = true;
    try {
      await onSubmit(node);
    } catch (error) {
      const message = messageOf(error);
      shown = notice(message);
      shown.id = uniqueId("notice");
      if (layout === "row") node.append(shown);
      else button.before(shown);
      marked = namedField(node, message);
      if (marked) {
        mark(marked, shown.id);
        marked.focus();
      }
    } finally {
      button.disabled = false;
    }
  });
  return node;
}

/** The one field a message names, by its name or its label as a whole word; none when it names several, as "Wrong email or password." does. */
function namedField(node: HTMLFormElement, message: string): HTMLInputElement | undefined {
  const names = (input: HTMLInputElement) => [input.name, input.labels?.[0]?.textContent ?? ""].filter(Boolean);
  const said = (word: string) => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(message);
  const named = [...node.querySelectorAll("input")].filter((input) => names(input).some(said));
  return named.length === 1 ? named[0] : undefined;
}

/** Marks a field invalid, described by the notice as well as its hint. */
function mark(input: HTMLInputElement, noticeId: string): void {
  input.setAttribute("aria-invalid", "true");
  input.setAttribute("aria-describedby", [input.getAttribute("aria-describedby"), noticeId].filter(Boolean).join(" "));
}

function unmark(input: HTMLInputElement, noticeId: string): void {
  input.removeAttribute("aria-invalid");
  const rest = (input.getAttribute("aria-describedby") ?? "").split(" ").filter((id) => id && id !== noticeId);
  if (rest.length) input.setAttribute("aria-describedby", rest.join(" "));
  else input.removeAttribute("aria-describedby");
}
