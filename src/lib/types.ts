/** A single diary entry. Everything the shelf renders is derived from these. */
export type DiaryEntry = {
  id: string;
  /** ISO date (YYYY-MM-DD). Drives the shelf order. */
  date: string;
  title: string;
  subtitle: string;
  body: string;
  /** One of `MOODS`; picks the motif and palette of the volume. */
  mood: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

/** Draft shape used by the editor before an id and timestamps exist. */
export type DiaryDraft = Omit<DiaryEntry, "id" | "createdAt" | "updatedAt">;

export const MOODS = [
  { value: "focus", label: "Focus", motifKey: "brackets" },
  { value: "warmth", label: "Warmth", motifKey: "paths" },
  { value: "motion", label: "Motion", motifKey: "caret" },
  { value: "wonder", label: "Wonder", motifKey: "orbits" },
  { value: "craft", label: "Craft", motifKey: "modules" },
  { value: "play", label: "Play", motifKey: "frames" },
  { value: "clarity", label: "Clarity", motifKey: "compass" },
] as const;

export type Mood = (typeof MOODS)[number]["value"];

export const DEFAULT_MOOD: Mood = "focus";

export function isMood(value: string): value is Mood {
  return MOODS.some((mood) => mood.value === value);
}

/**
 * The seven authored palettes, copied from the packaged shelf's catalog. Each
 * was drawn for one motif, so an entry takes the palette that belongs to its
 * mood and the shelf stays as coherent as the original seven volumes were.
 */
export type ShelfPalette = {
  paper: string;
  paperDeep: string;
  paperPale: string;
  ink: string;
  inkSoft: string;
  wall: string;
  shelf: string;
  shelfDark: string;
  light: string;
  fill: string;
};

export type ShelfBook = {
  id: string;
  title: string;
  roman: string;
  discipline: string;
  note: string;
  deck: string;
  binding: string;
  format: string;
  theme: string;
  motif: string;
  motifKey: string;
  paletteLabel: string;
  color: string;
  foil: string;
  palette: ShelfPalette;
  width: number;
  height: number;
  depth: number;
  chapters: string[];
  seed: number;
};

/** Shape the Field Manuals page reads out of its `books` object. */
export type ManualBook = {
  title: string;
  year: string;
  description: string;
  steps: { title: string; body: string }[];
  prompt: string;
  review: string;
};
