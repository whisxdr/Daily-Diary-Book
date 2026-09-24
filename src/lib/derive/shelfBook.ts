/*
 * Entry to shelf volume: the `BOOKS` record the packaged shelf page reads.
 *
 * `index` is the entry's position in the shelf and becomes its volume number,
 * so the roman numeral follows the reader's own chronology rather than the id.
 * Geometry is derived from the entry's stable seed, so a volume never reshapes
 * itself between renders.
 */
import type { DiaryEntry, ShelfBook } from "../types";
import { MOTIF_LABELS, WIDTH, HEIGHT, DEPTH, cosmeticJitter, hashSeed, motifKeyOf, moodLabelOf, paletteFor } from "./catalog";
import { formatDate, summarize, toRoman } from "./text";

export function toShelfBook(entry: DiaryEntry, index: number): ShelfBook {
  const motifKey = motifKeyOf(entry);
  const chosen = paletteFor(entry);
  const seed = hashSeed(entry.id);
  const moodLabel = moodLabelOf(entry);

  // The page indexes chapters[0..2] unconditionally — on its spine, its plates,
  // and its page labels. A short array throws inside the scene's own script and
  // the whole shelf falls back to the static catalog, so this is padded to three
  // rather than sliced to at most three.
  const tags = entry.tags ?? [];
  const chapters = [tags[0], tags[1], tags[2]].map(
    (tag, index) => tag || [moodLabel, formatDate(entry.date), "Notes"][index],
  );

  return {
    id: `entry-${entry.id}`,
    title: entry.title || "Untitled",
    roman: toRoman(index + 1),
    discipline: entry.subtitle || moodLabel,
    note: summarize(entry.body, 90) || `A ${moodLabel.toLowerCase()} entry.`,
    deck: entry.body.replace(/\s+/g, " ").trim(),
    binding: `${moodLabel} · ${chosen.label.split(" · ")[0]}`,
    format: formatDate(entry.date),
    theme: `${entry.title || "Untitled"} · ${moodLabel.toLowerCase()}`,
    motif: MOTIF_LABELS[motifKey] ?? "Nested brackets",
    motifKey,
    paletteLabel: chosen.label,
    color: chosen.color,
    foil: chosen.foil,
    palette: chosen.palette,
    width: Number((WIDTH[0] + cosmeticJitter(seed, 1) * (WIDTH[1] - WIDTH[0])).toFixed(2)),
    height: Number((HEIGHT[0] + cosmeticJitter(seed, 2) * (HEIGHT[1] - HEIGHT[0])).toFixed(2)),
    depth: Number((DEPTH[0] + cosmeticJitter(seed, 3) * (DEPTH[1] - DEPTH[0])).toFixed(2)),
    chapters,
    seed: seed % 997,
  };
}
