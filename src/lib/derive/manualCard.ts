/*
 * Entry to a Field Manuals card and its detail record.
 *
 * The authored page lays out exactly three cards at fixed spots, so a reader
 * with one or two entries takes the middle and outer positions rather than
 * being stranded at the left edge. Each card is built from the same nested spans
 * the packaged card uses — the 3D book is those spans, so dropping any of them
 * leaves a flat rectangle instead of a volume.
 */
import type { DiaryEntry, ManualBook } from "../types";
import { cosmeticJitter, hashSeed, motifKeyOf, moodLabelOf, paletteFor } from "./catalog";
import { escapeHtml, formatDate, toRoman } from "./text";

/** The `books` record the Field Manuals page reads when a card is opened. */
export function toManualBook(entry: DiaryEntry): ManualBook {
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
    prompt: entry.subtitle || moodLabelOf(entry),
    review: formatDate(entry.date),
  };
}

/*
 * Card positions, copied from the authored sheet.
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
  const chosen = paletteFor(entry);
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

/** Card geometry the showcase positions its three cards with. */
export function toManualCard(entry: DiaryEntry, index: number, count: number): { id: string; style: string } {
  const chosen = paletteFor(entry);
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

export function toManualCardMarkup(entry: DiaryEntry, index: number, count: number): string {
  const { id, style } = toManualCard(entry, index, count);
  const chosen = paletteFor(entry);
  const title = escapeHtml(entry.title || "Tanpa judul");
  const tags = entry.tags ?? [];
  const footer = tags.length ? tags.slice(0, 3).join(" · ") : moodLabelOf(entry);

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

/** CSS the generated cards need, appended where the authored card rules sit. */
export function toManualCardCss(entries: DiaryEntry[]): string {
  return entries
    .map((entry, index) => {
      const layout = cardLayout(entries.length, index);
      return `.book-card[data-book="${manualKey(entry)}"] { --x: ${layout.x}; --y: ${layout.y}; --w: ${layout.w}; --r: ${layout.r}; --yaw: ${layout.yaw}; z-index: ${layout.z}; }`;
    })
    .join("\n");
}
