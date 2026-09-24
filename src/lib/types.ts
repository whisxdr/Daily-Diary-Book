/** A single diary entry. Everything the shelf renders is derived from these. */
export type DiaryEntry = {
  id: string;
  /** ISO date (YYYY-MM-DD). Drives the shelf order. */
  date: string;
  title: string;
  subtitle: string;
  body: string;
  /**
   * The id of a `Category` — not its label. The field keeps the name `mood`
   * because that is the column and the localStorage key entries already use;
   * renaming it would strand every stored row for no gain. Because it holds an
   * id, renaming a category never re-points an entry.
   */
  mood: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

/** Draft shape used by the editor before an id and timestamps exist. */
export type DiaryDraft = Omit<DiaryEntry, "id" | "createdAt" | "updatedAt">;

/*
 * The seven authored looks, in the order the packaged atlas lays them out.
 *
 * A "look" is the visual half of a category: it selects the palette (cloth,
 * foil, paper, wall, ink) and the matching cover artwork. The order is not
 * arbitrary — it is the left-to-right order of the seven 512x768 crops inside
 * the embedded atlas in complete-shelf-v2.html, so index N here is crop N.
 * `MOTIF_CROPS` in derive.ts is built from this list, which is what keeps the
 * cover art and the palette of a category pointing at the same artwork.
 */
export const MOTIF_KEYS = ["brackets", "paths", "caret", "orbits", "modules", "frames", "compass"] as const;

export type MotifKey = (typeof MOTIF_KEYS)[number];

/**
 * A reader-editable category.
 *
 * The reader owns the label; the app owns the set of looks. Keeping `id`
 * separate from `label` is what makes a rename safe: entries store the id, so
 * "Focus" can become "Fokus" — or "Life", "Experience", "Experiment" — without
 * rewriting a single entry.
 */
export type Category = {
  /** Stable slug, generated once. Never rewritten, so entries keep resolving. */
  id: string;
  /** What the reader sees and edits. */
  label: string;
  /** Which authored look this category wears. */
  motifKey: MotifKey;
};

/** The seven categories the app ships with, matching the packaged catalog. */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: "focus", label: "Focus", motifKey: "brackets" },
  { id: "warmth", label: "Warmth", motifKey: "paths" },
  { id: "motion", label: "Motion", motifKey: "caret" },
  { id: "wonder", label: "Wonder", motifKey: "orbits" },
  { id: "craft", label: "Craft", motifKey: "modules" },
  { id: "play", label: "Play", motifKey: "frames" },
  { id: "clarity", label: "Clarity", motifKey: "compass" },
];

/** The category a brand-new entry starts on. Always present — it is a default. */
export const DEFAULT_CATEGORY_ID = DEFAULT_CATEGORIES[0].id;

export function isMotifKey(value: string): value is MotifKey {
  return (MOTIF_KEYS as readonly string[]).includes(value);
}

/**
 * Resolves a stored category id against the reader's current list.
 *
 * A miss is expected rather than exceptional: an entry can name a category the
 * reader has since deleted, or arrive by JSON import from a device with a
 * different list. Falling back to the first category keeps every derivation
 * total — returning undefined instead would leave a hole where the shelf's
 * `palette` belongs, and the page's own script throws on that.
 */
export function findCategory(categories: Category[], id: string): Category {
  return categories.find((category) => category.id === id) ?? categories[0] ?? DEFAULT_CATEGORIES[0];
}

/** True when the id resolves against this list. The UI uses it to flag a stale reference. */
export function hasCategory(categories: Category[], id: string): boolean {
  return categories.some((category) => category.id === id);
}

/**
 * True when a list is exactly the shipped seven, labels and looks included.
 *
 * Used by the export to decide whether the reader's categories need to travel
 * with the file. Comparing the whole list rather than just the count is what
 * makes this honest: a reader who renamed "Focus" to "Life" has a list of the
 * same length whose names exist nowhere else, and dropping them would produce a
 * backup that restores the entries under the wrong labels.
 */
export function isShippedCategories(categories: Category[]): boolean {
  return (
    categories.length === DEFAULT_CATEGORIES.length &&
    categories.every(
      (category, index) =>
        category.id === DEFAULT_CATEGORIES[index].id &&
        category.label === DEFAULT_CATEGORIES[index].label &&
        category.motifKey === DEFAULT_CATEGORIES[index].motifKey,
    )
  );
}

/**
 * Coerces stored or imported data into a usable category list.
 *
 * Categories are reader data, so they can arrive malformed: an older export, a
 * hand-edited localStorage value, or a list whose looks were renamed. Anything
 * unusable is dropped, and an empty result falls back to the shipped seven so
 * the shelf always has at least one look to render.
 */
export function normalizeCategories(value: unknown): Category[] {
  if (!Array.isArray(value)) return DEFAULT_CATEGORIES;
  const seen = new Set<string>();
  const out: Category[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const { id, label, motifKey } = item as Record<string, unknown>;
    if (typeof id !== "string" || !id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      label: typeof label === "string" && label.trim() ? label.trim() : id,
      motifKey: typeof motifKey === "string" && isMotifKey(motifKey) ? motifKey : MOTIF_KEYS[out.length % MOTIF_KEYS.length],
    });
  }
  return out.length ? out : DEFAULT_CATEGORIES;
}

/** A URL- and storage-safe id for a reader-created category. */
export function newCategoryId(label: string): string {
  const slug = label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const unique = Math.random().toString(36).slice(2, 8);
  return slug ? `${slug}-${unique}` : `kategori-${unique}`;
}

/**
 * The seven authored palettes, copied from the packaged shelf's catalog. Each
 * was drawn for one motif, so a category takes the palette belonging to its
 * look and the shelf stays as coherent as the original seven volumes were.
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
  /**
   * Index into the page's own `COVER_CROPS` for this volume's cover artwork.
   *
   * This is the field that fixes the category mismatch: the page can derive
   * every other part of a volume's look from the book object, but the cover
   * artwork is a raster in an atlas it only knows by position. Shipping the
   * crop with the data lets the artwork follow the category instead of the
   * shelf slot.
   */
  coverCrop: number;
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
