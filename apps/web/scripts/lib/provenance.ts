// The record of where each drawn raster in public/ came from, the way
// public/images/credits.json records the found photographs: one entry per
// file, saying what it shows, what it was drawn from, which script drew it,
// its size in pixels and bytes, and when. scripts/build-icons.ts and
// scripts/build-og.ts each replace their own entries in
// public/provenance.json and leave the other's alone. It isn't served.

import { join } from "node:path";

export const PROVENANCE = join(import.meta.dir, "..", "..", "public", "provenance.json");

export type Provenance = {
  /** From the repo's root, as "public/og/home.png". */
  file: string;
  media: "image" | "icon";
  width: number;
  height: number;
  /** An .ico's layers, in pixels. */
  sizes?: number[];
  what: string;
  /** The files it was drawn from. */
  from: string[];
  madeBy: string;
  bytes: number;
  saved?: string;
};

/** Writes `entries` as everything `madeBy` made, keeping every other script's. */
export async function recordProvenance(madeBy: string, entries: Provenance[]): Promise<void> {
  const file = Bun.file(PROVENANCE);
  const kept = ((await file.exists()) ? ((await file.json()) as Provenance[]) : []).filter((entry) => entry.madeBy !== madeBy);
  const saved = new Date().toISOString();
  const all = [...kept, ...entries.map((entry) => ({ ...entry, saved }))].sort((a, b) => a.file.localeCompare(b.file));
  await Bun.write(PROVENANCE, `${JSON.stringify(all, null, 2)}\n`);
}
