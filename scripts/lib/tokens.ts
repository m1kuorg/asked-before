// The colour tokens of src/styles/globals.css's :root, read from the file,
// so what the scripts draw (the icons, the banners) and check (each page's
// theme colour) can't drift from the page. A token is a six-digit hex
// colour, given in lowercase; one that isn't there throws.

import { join } from "node:path";

const CSS = await Bun.file(join(import.meta.dir, "..", "..", "src", "styles", "globals.css")).text();

export function token(name: string): string {
  const value = CSS.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
  if (!value) throw new Error(`globals.css has no --${name} colour.`);
  return value.toLowerCase();
}
