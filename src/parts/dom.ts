// Building markup. Every part and screen makes its elements here: children
// are nodes or plain strings, and a string is always set as text, never as
// HTML, so a phrasing or a model's reply can't become markup.

export type Child = Node | string;

/** An element with a class name (or none) and its children. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, ...children: Child[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

/** A button that runs `onClick`. Its class picks the look: none for the primary, "secondary", "retry", or "quiet". */
export function button(text: string, onClick: () => void, className?: string): HTMLButtonElement {
  const node = el("button", className, text);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

/** A link. Inside the app, the router follows it without reloading the page. Give it "button" or "button secondary" to look like one. */
export function link(text: string, href: string, className?: string): HTMLAnchorElement {
  const node = el("a", className, text);
  node.href = href;
  return node;
}

let ids = 0;

/** An id no other element on the page has, for labels and descriptions. */
export const uniqueId = (prefix: string) => `${prefix}-${++ids}`;
