/*
 * The authored catalog, transcribed from the packaged shelf page: one palette
 * per motif, the geometry ranges its seven volumes span, and the deterministic
 * helpers that pick a motif, a palette, and a stable seed for an entry.
 *
 * Keeping the motif-to-palette pairing is what makes a generated shelf read as
 * the same designed object as the original: the wall and shelf tones stay in the
 * same family, and the ink always contrasts with the paper it sits on.
 */
import { MOODS, isMood, DEFAULT_MOOD, type DiaryEntry, type Mood, type ShelfPalette } from "../types";

/** Motif labels as the packaged catalog names them, keyed by motifKey. */
export const MOTIF_LABELS: Record<string, string> = {
  brackets: "Nested brackets",
  paths: "Interlaced paths",
  caret: "Directional caret",
  orbits: "Suspended orbits",
  modules: "Connected modules",
  frames: "Folded frames",
  compass: "Drafting compass",
};

export type Palette = { color: string; foil: string; label: string; palette: ShelfPalette };

/** One authored palette per motif, taken from the packaged catalog. */
export const PALETTES: Record<string, Palette> = {
  brackets: {
    color: "#182a43",
    foil: "#c87046",
    label: "Ultramarine · bone · copper",
    palette: { paper: "#171a24", paperDeep: "#10131b", paperPale: "#f1eadf", ink: "#f4eee6", inkSoft: "#b9b4ae", wall: "#171a24", shelf: "#3a2118", shelfDark: "#1c0e0a", light: "#f4d7b9", fill: "#9fb3c9" },
  },
  paths: {
    color: "#c24d24",
    foil: "#efc16d",
    label: "Burnt orange · cream · burgundy",
    palette: { paper: "#762f1b", paperDeep: "#572113", paperPale: "#ffe4c5", ink: "#fff0df", inkSoft: "#e3bfa8", wall: "#762f1b", shelf: "#402015", shelfDark: "#1d0d08", light: "#ffd19a", fill: "#dc8c6b" },
  },
  caret: {
    color: "#afc400",
    foil: "#171a16",
    label: "Citron · ink · off-white",
    palette: { paper: "#c3cf21", paperDeep: "#9eaa16", paperPale: "#f0f2c9", ink: "#171914", inkSoft: "#485015", wall: "#c3cf21", shelf: "#3b2418", shelfDark: "#1c0f09", light: "#fff6ce", fill: "#dce37e" },
  },
  orbits: {
    color: "#1537a1",
    foil: "#dbe8f1",
    label: "Cobalt · sky · silver",
    palette: { paper: "#142a80", paperDeep: "#0b1953", paperPale: "#dbe8f1", ink: "#f3f5f2", inkSoft: "#b5c7e9", wall: "#142a80", shelf: "#3b2117", shelfDark: "#1a0d08", light: "#e5edf2", fill: "#5f85dc" },
  },
  modules: {
    color: "#c83222",
    foil: "#efb0aa",
    label: "Vermilion · plum · blush",
    palette: { paper: "#a62c21", paperDeep: "#7f1e17", paperPale: "#ffe0d5", ink: "#fff0e8", inkSoft: "#e9bbb2", wall: "#a62c21", shelf: "#432016", shelfDark: "#1f0d08", light: "#ffd1bc", fill: "#d66d66" },
  },
  frames: {
    color: "#da3b2f",
    foil: "#ff8eab",
    label: "Coral · pink · oxblood",
    palette: { paper: "#ae2830", paperDeep: "#7f1822", paperPale: "#ffe0df", ink: "#fff0e9", inkSoft: "#efb9b4", wall: "#ae2830", shelf: "#402016", shelfDark: "#1d0d08", light: "#ffc3bb", fill: "#e46d78" },
  },
  compass: {
    color: "#78a7bd",
    foil: "#e4e7e5",
    label: "Icy cyan · navy · aluminum",
    palette: { paper: "#7ea5b7", paperDeep: "#5e8699", paperPale: "#e6f0f2", ink: "#102a36", inkSoft: "#274b5a", wall: "#7ea5b7", shelf: "#382017", shelfDark: "#1b0e09", light: "#eef5f2", fill: "#add1df" },
  },
};

/** Geometry ranges copied from the packaged catalog's seven volumes. */
export const WIDTH = [0.92, 1.12];
export const HEIGHT = [1.46, 1.68];
export const DEPTH = [0.22, 0.3];

/** Stable 32-bit hash, so a given entry always gets the same volume. */
export function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/*
 * Cosmetic jitter, deliberately deterministic and non-cryptographic: the same
 * entry must always produce the same book geometry, or the shelf would reshape
 * itself on every render. Nothing here protects a secret, so a seeded value is
 * the correct tool rather than a random one.
 */
export function cosmeticJitter(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function moodOf(entry: DiaryEntry): Mood {
  return isMood(entry.mood) ? entry.mood : DEFAULT_MOOD;
}

export function motifKeyOf(entry: DiaryEntry): string {
  const mood = MOODS.find((m) => m.value === moodOf(entry));
  return mood?.motifKey ?? "brackets";
}

export function moodLabelOf(entry: DiaryEntry): string {
  return MOODS.find((m) => m.value === moodOf(entry))?.label ?? "Focus";
}

/** The palette belonging to an entry's mood, with the authored default. */
export function paletteFor(entry: DiaryEntry): Palette {
  return PALETTES[motifKeyOf(entry)] ?? PALETTES.brackets;
}
