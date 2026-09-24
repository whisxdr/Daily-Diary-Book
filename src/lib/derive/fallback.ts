/*
 * The static catalog a reader without WebGL sees. It is markup rather than a
 * scene, so it has to be generated as HTML and substituted into the page's own
 * fallback block.
 */
import type { DiaryEntry } from "../types";
import { cosmeticJitter, hashSeed, paletteFor } from "./catalog";
import { escapeHtml, toRoman } from "./text";

/** One fallback card: the markup a reader without WebGL sees. */
export function toFallbackCard(entry: DiaryEntry, index: number): string {
  const chosen = paletteFor(entry);
  const seed = hashSeed(entry.id);
  const height = Math.round(356 + cosmeticJitter(seed, 4) * 52);
  const title = escapeHtml(entry.title || "Untitled");
  return (
    `<article class="fallback-book" style="--book-color:${chosen.color};--book-foil:${chosen.foil};--book-height:${height}px">` +
    `<span>Volume ${toRoman(index + 1)}</span><strong>${title}</strong></article>`
  );
}

export function toFallbackGrid(entries: DiaryEntry[]): string {
  const cards = entries.map(toFallbackCard).join("\n        ");
  return `<div class="fallback__grid" aria-label="Rak catatan pribadi">\n        ${cards}\n      </div>`;
}
