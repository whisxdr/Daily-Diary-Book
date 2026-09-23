/*
 * Maps a diary entry onto the shapes the two ThreeUI pages expect.
 *
 * Neither page accepts data, so an entry has to become the same kind of record
 * the packaged pages ship with. The authored catalog is the template: its seven
 * volumes each pair one motif with one palette, and the geometry, seed, and
 * copy all follow from that pairing. An entry does the same thing — mood picks
 * the motif and its palette, and everything else is derived from the entry.
 */
import { MOODS, isMood, DEFAULT_MOOD, type DiaryEntry, type ManualBook, type Mood, type ShelfBook, type ShelfPalette } from "./types";

/** Motif labels as the packaged catalog names them, keyed by motifKey. */
const MOTIF_LABELS: Record<string, string> = {
  brackets: "Nested brackets",
  paths: "Interlaced paths",
  caret: "Directional caret",
  orbits: "Suspended orbits",
  modules: "Connected modules",
  frames: "Folded frames",
  compass: "Drafting compass",
};

/**
 * One authored palette per motif, taken from the packaged catalog. Keeping the
 * pairing is what makes a generated shelf read as the same designed object as
 * the original: the wall and shelf tones stay in the same family, and the ink
 * always contrasts with the paper it sits on.
 */
const PALETTES: Record<string, { color: string; foil: string; label: string; palette: ShelfPalette }> = {
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
const WIDTH = [0.92, 1.12];
const HEIGHT = [1.46, 1.68];
const DEPTH = [0.22, 0.3];

const ROMAN: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

export function toRoman(value: number): string {
  if (!Number.isFinite(value) || value < 1) return "I";
  let rest = Math.floor(value);
  let out = "";
  for (const [size, glyph] of ROMAN) {
    while (rest >= size) {
      out += glyph;
      rest -= size;
    }
  }
  return out;
}

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
function cosmeticJitter(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function moodOf(entry: DiaryEntry): Mood {
  return isMood(entry.mood) ? entry.mood : DEFAULT_MOOD;
}

function motifKeyOf(entry: DiaryEntry): string {
  const mood = MOODS.find((m) => m.value === moodOf(entry));
  return mood?.motifKey ?? "brackets";
}

/** First sentence, trimmed to a length that reads as a spine line. */
function summarize(body: string, limit: number): string {
  const flat = body.replace(/\s+/g, " ").trim();
  if (!flat) return "";
  const sentence = flat.match(/^[^.!?]*[.!?]/);
  const candidate = (sentence ? sentence[0] : flat).trim();
  return candidate.length <= limit ? candidate : `${candidate.slice(0, limit - 1).trimEnd()}…`;
}

function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Builds the `BOOKS` record for one entry.
 *
 * `index` is the entry's position in the shelf and becomes its volume number,
 * so the roman numeral follows the reader's own chronology rather than the id.
 */
export function toShelfBook(entry: DiaryEntry, index: number): ShelfBook {
  const motifKey = motifKeyOf(entry);
  const chosen = PALETTES[motifKey] ?? PALETTES.brackets;
  const seed = hashSeed(entry.id);
  const mood = MOODS.find((m) => m.value === moodOf(entry));
  const moodLabel = mood?.label ?? "Focus";

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

/** The `books` record the Field Manuals page reads when a card is opened. */
export function toManualBook(entry: DiaryEntry): ManualBook {
  const mood = MOODS.find((m) => m.value === moodOf(entry));
  const paragraphs = entry.body
    .split(/\n{2,}/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return {
    title: entry.title || "Untitled",
    year: entry.date.slice(0, 4),
    description: paragraphs[0] ?? "",
    // The authored page renders four titled steps; the entry's own paragraphs
    // fill them, so the reader shows the writing rather than placeholder copy.
    steps: paragraphs.slice(1, 5).map((paragraph, index) => ({
      title: (entry.tags ?? [])[index] ?? `Bagian ${index + 2}`,
      body: paragraph,
    })),
    prompt: entry.subtitle || (mood?.label ?? ""),
    review: formatDate(entry.date),
  };
}

/*
 * Card positions, copied from the authored sheet. The page lays out three cards
 * at fixed spots, so a reader with one or two entries takes the middle and outer
 * positions rather than being stranded at the left edge.
 */
const CARD_LAYOUTS = {
  left: { x: "23.2%", y: "40.5%", w: "min(30.5vw, 435px)", r: "-8deg", yaw: "-7deg", z: 1 },
  center: { x: "50%", y: "32.2%", w: "min(33vw, 470px)", r: ".8deg", yaw: "-3deg", z: 3 },
  right: { x: "76.4%", y: "39.4%", w: "min(30.5vw, 435px)", r: "8deg", yaw: "7deg", z: 2 },
} as const;

type CardSlot = keyof typeof CARD_LAYOUTS;

/** Which authored slot each card takes, given how many cards there are. */
export function cardSlots(count: number): CardSlot[] {
  if (count <= 1) return ["center"];
  if (count === 2) return ["left", "right"];
  return ["left", "center", "right"];
}

function cardLayout(count: number, index: number) {
  const slots = cardSlots(count);
  return CARD_LAYOUTS[slots[index % slots.length]];
}

/** The `data-book` key a card and its `books` entry share. */
export function manualKey(entry: DiaryEntry): string {
  return `entry-${entry.id}`;
}

/**
 * The authored card carries a photographic cover in `--cover`. An entry has no
 * such artwork, so its cover is drawn from its own motif and palette instead —
 * the same pairing the shelf uses for that mood, which keeps the two pages
 * reading as one collection rather than a placeholder.
 */
function coverArt(entry: DiaryEntry): string {
  const motifKey = motifKeyOf(entry);
  const chosen = PALETTES[motifKey] ?? PALETTES.brackets;
  const seed = hashSeed(entry.id);
  const angle = Math.round(cosmeticJitter(seed, 7) * 360);
  const stop = Math.round(24 + cosmeticJitter(seed, 8) * 30);
  const svg = motifSvg(motifKey, chosen.palette.ink, chosen.palette.fill);
  // Single quotes: this value is written into an HTML `style="…"` attribute, so
  // a double quote inside `url("…")` would terminate the attribute early.
  // `encodeURIComponent` leaves `'` alone, and the URL contains no `"`.
  return (
    `url('data:image/svg+xml,${encodeURIComponent(svg)}'), ` +
    `linear-gradient(${angle}deg, ${chosen.color} 0%, ${chosen.palette.paper} ${stop}%, ${chosen.palette.paperDeep} 100%)`
  );
}

/**
 * One line drawing per motif, on a 512x768 field so it fills the cover. They
 * echo the shelf's own engraved motifs: brackets, interlaced paths, a caret,
 * orbits, modules, folded frames, a compass.
 */
function motifSvg(motifKey: string, ink: string, fill: string): string {
  const open = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 768" fill="none" stroke="${ink}" stroke-opacity="0.5" stroke-width="3" stroke-linecap="round">`;
  const shapes: Record<string, string> = {
    brackets: [
      `<path d="M186 214h-44v340h44"/><path d="M326 214h44v340h-44"/>`,
      `<path d="M232 268h-30v232h30"/><path d="M280 268h30v232h-30"/>`,
      `<circle cx="256" cy="384" r="34" fill="${fill}" fill-opacity="0.3" stroke="none"/>`,
    ].join(""),
    paths: [
      `<path d="M256 196v96M256 292c0 60-72 62-72 122s72 62 72 122"/>`,
      `<path d="M256 292c0 60 72 62 72 122s-72 62-72 122"/>`,
      `<circle cx="256" cy="196" r="16" fill="${fill}" fill-opacity="0.35"/>`,
      `<circle cx="184" cy="536" r="12" fill="${fill}" fill-opacity="0.35"/>`,
      `<circle cx="328" cy="536" r="12" fill="${fill}" fill-opacity="0.35"/>`,
    ].join(""),
    caret: [
      `<path d="M256 178l-86 96h172z"/>`,
      `<path d="M256 300l-58 64h116z"/>`,
      `<path d="M256 390v214"/>`,
      `<path d="M198 522h116"/>`,
    ].join(""),
    orbits: [
      `<ellipse cx="256" cy="384" rx="152" ry="58"/>`,
      `<ellipse cx="256" cy="384" rx="152" ry="58" transform="rotate(60 256 384)"/>`,
      `<ellipse cx="256" cy="384" rx="152" ry="58" transform="rotate(-60 256 384)"/>`,
      `<circle cx="256" cy="384" r="30" fill="${fill}" fill-opacity="0.4"/>`,
      `<circle cx="408" cy="384" r="11" fill="${fill}" fill-opacity="0.6"/>`,
      `<circle cx="180" cy="252" r="11" fill="${fill}" fill-opacity="0.6"/>`,
    ].join(""),
    modules: [
      `<rect x="150" y="252" width="88" height="88" rx="10"/>`,
      `<rect x="274" y="252" width="88" height="88" rx="10"/>`,
      `<rect x="150" y="376" width="88" height="88" rx="10"/>`,
      `<rect x="274" y="376" width="88" height="88" rx="10"/>`,
      `<path d="M238 296h36M238 420h36M194 340v36M318 340v36"/>`,
      `<path d="M256 464v58M184 522h144"/>`,
      `<circle cx="256" cy="522" r="22" fill="${fill}" fill-opacity="0.35"/>`,
    ].join(""),
    frames: [
      `<rect x="146" y="234" width="220" height="290" rx="8"/>`,
      `<rect x="170" y="258" width="220" height="290" rx="8" transform="rotate(-6 280 403)"/>`,
      `<path d="M186 384h124M186 424h84"/>`,
    ].join(""),
    compass: [
      `<circle cx="256" cy="384" r="132"/>`,
      `<circle cx="256" cy="384" r="18" fill="${fill}" fill-opacity="0.5"/>`,
      `<path d="M256 252v96M256 420v96M124 384h96M292 384h96"/>`,
      `<path d="M256 252l-24 96 24 36 24-36z" fill="${fill}" fill-opacity="0.45"/>`,
      `<path d="M256 516l-24-96 24-36 24 36z" fill="${ink}" fill-opacity="0.25"/>`,
    ].join(""),
  };
  return `${open}${shapes[motifKey] ?? shapes.brackets}</svg>`;
}

/**
 * One card, in the authored structure: the 3D book is built entirely from these
 * nested spans, so dropping any of them leaves a flat rectangle instead of a
 * volume. The packaged card also holds a `<video>` cover animation; an entry has
 * no such clip, and the authored sheet already treats it as optional.
 */
export function toManualCardMarkup(entry: DiaryEntry, index: number, count: number): string {
  const { id, style } = toManualCard(entry, index, count);
  const motifKey = motifKeyOf(entry);
  const chosen = PALETTES[motifKey] ?? PALETTES.brackets;
  const title = escapeHtml(entry.title || "Tanpa judul");
  const tags = entry.tags ?? [];
  const footer = tags.length ? tags.slice(0, 3).join(" · ") : (MOODS.find((m) => m.value === moodOf(entry))?.label ?? "");

  return [
    `<button class="book-card" type="button" data-book="${escapeHtml(id)}" aria-label="Buka ${title}"`,
    ` style="--cover-color: ${chosen.color}; --cover: ${coverArt(entry)}; --cover-ink: ${chosen.palette.ink}; ${style}">`,
    `<span class="book" aria-hidden="true">`,
    `<span class="book-shadow"></span>`,
    `<span class="book-back"></span>`,
    `<span class="page-block"></span>`,
    `<span class="page-fan"><i></i><i></i><i></i><i></i></span>`,
    `<span class="front-cover">`,
    `<span class="cover-copy">`,
    `<span class="cover-kicker">Volume ${toRoman(index + 1)}</span>`,
    `<span class="cover-title">${title}</span>`,
    `<span class="cover-subtitle">${escapeHtml(entry.subtitle || "")}</span>`,
    `<span></span>`,
    `<span class="cover-footer">${escapeHtml(footer)}</span>`,
    `</span>`,
    `</span>`,
    `<span class="open-badge">Baca</span>`,
    `</span>`,
    `</button>`,
  ].join("");
}

/** Card geometry the showcase positions its three cards with. */
export function toManualCard(entry: DiaryEntry, index: number, count: number): { id: string; style: string } {
  const motifKey = motifKeyOf(entry);
  const chosen = PALETTES[motifKey] ?? PALETTES.brackets;
  const layout = cardLayout(count, index);
  return {
    id: manualKey(entry),
    style: [
      `--cover-color: ${chosen.color}`,
      `--x: ${layout.x}`,
      `--y: ${layout.y}`,
      `--w: ${layout.w}`,
      `--r: ${layout.r}`,
      `--yaw: ${layout.yaw}`,
      `z-index: ${layout.z}`,
    ].join("; "),
  };
}

/** CSS the generated cards need, appended where the authored card rules sit. */
export function toManualCardCss(entries: DiaryEntry[]): string {
  return entries
    .map((entry, index) => {
      const layout = cardLayout(entries.length, index);
      return `.book-card[data-book="${manualKey(entry)}"] { --x: ${layout.x}; --y: ${layout.y}; --w: ${layout.w}; --r: ${layout.r}; --yaw: ${layout.yaw}; z-index: ${layout.z}; }`;
    })
    .join("\n");
}

/** One fallback card: the markup a reader without WebGL sees. */
export function toFallbackCard(entry: DiaryEntry, index: number): string {
  const motifKey = motifKeyOf(entry);
  const chosen = PALETTES[motifKey] ?? PALETTES.brackets;
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

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escapes a value for embedding inside a `<script>` block. */
export function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function sortEntries(entries: DiaryEntry[]): DiaryEntry[] {
  return [...entries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.createdAt < b.createdAt ? 1 : -1));
}
