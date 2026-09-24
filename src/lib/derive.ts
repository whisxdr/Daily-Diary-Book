/*
 * Entry to packaged-page shapes.
 *
 * Neither ThreeUI page accepts data, so an entry has to become the same kind of
 * record the packaged pages ship with. That work is split by target page rather
 * than kept in one file: the shelf's `BOOKS` record, the Field Manuals card and
 * its detail record, and the static fallback grid each have their own module
 * under `derive/`. This file is the entry point they are read from, and it
 * exports the same surface the single-file version did.
 */
import type { DiaryEntry } from "./types";

export { toRoman, escapeHtml, escapeScriptJson } from "./derive/text";
export { hashSeed } from "./derive/catalog";
export { toShelfBook } from "./derive/shelfBook";
export { toManualBook, toManualCard, toManualCardMarkup, toManualCardCss, cardSlots, manualKey } from "./derive/manualCard";
export { toFallbackCard, toFallbackGrid } from "./derive/fallback";

/** Newest first, with the created time breaking a tie on the same date. */
export function sortEntries(entries: DiaryEntry[]): DiaryEntry[] {
  return [...entries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.createdAt < b.createdAt ? 1 : -1));
}
