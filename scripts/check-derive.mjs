#!/usr/bin/env node
/*
 * Checks that every entry shape `derive.ts` can be handed still produces a
 * record the packaged shelf page can render.
 *
 * The page indexes `chapters[0..2]` unconditionally. A shorter array throws a
 * TypeError inside the scene's own script, which its `initialize().catch()`
 * turns into the static-catalog fallback — the reader sees a designed page
 * instead of their shelf, and nothing logs the reason. That failure is silent,
 * so it is asserted here rather than left to a visual check.
 *
 * The cover-art case is the other half of that bargain. The page used to pick a
 * volume's artwork by its slot on the shelf, so with more than one entry a
 * volume wore a cover belonging to a different category than its cloth. That is
 * silent too — the shelf renders, it is simply wrong — so the pairing is
 * asserted directly: artwork follows the category, position never enters in.
 *
 *   npm run check:derive
 */
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/*
 * Bundled through a tiny generated entry rather than `derive.ts` directly: the
 * checks below need the category model from `types.ts` too, and a bundle only
 * exports what its entry point re-exports.
 */
const bundled = await build({
  stdin: {
    contents: `export * from "./src/lib/derive";\nexport * from "./src/lib/types";\n`,
    resolveDir: ROOT,
    sourcefile: "check-derive-entry.ts",
    loader: "ts",
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "neutral",
  logLevel: "silent",
});
const lib = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);

const { DEFAULT_CATEGORIES, MOTIF_KEYS, normalizeCategories } = lib;

/** An entry as the editor writes it, with per-case overrides. */
const entry = (overrides = {}) => ({
  id: "e1",
  date: "2026-09-22",
  title: "Cinta",
  subtitle: "Ingin ku mencintaimu",
  body: "Hari ini aku belajar mencintai hal kecil.",
  mood: "focus",
  tags: [],
  createdAt: "2026-09-22T00:00:00.000Z",
  updatedAt: "2026-09-22T00:00:00.000Z",
  ...overrides,
});

/*
 * Every shape a real entry can reach the shelf in: the editor always sends a
 * tags array, but an imported JSON file is only checked for id/title/body, and
 * a `mood` outside the known ids falls back to the default.
 */
const CASES = [
  ["no tags", entry()],
  ["one tag", entry({ tags: ["cinta"] })],
  ["two tags", entry({ tags: ["cinta", "tenang"] })],
  ["three tags", entry({ tags: ["cinta", "tenang", "pagi"] })],
  ["four tags", entry({ tags: ["a", "b", "c", "d"] })],
  ["empty-string tags", entry({ tags: ["", ""] })],
  ["imported without tags", { ...entry(), tags: undefined }],
  ["unknown category", entry({ mood: "nostalgia" })],
  ["empty title and body", entry({ title: "", subtitle: "", body: "" })],
  ["multiline body", entry({ body: "Satu.\n\nDua.\n\nTiga.\n\nEmpat." })],
];

const REQUIRED = [
  "id", "title", "roman", "discipline", "note", "deck", "binding", "format",
  "theme", "motif", "motifKey", "paletteLabel", "color", "foil", "palette",
  "coverCrop", "width", "height", "depth", "chapters", "seed",
];

let failed = 0;
const fail = (label, message) => {
  failed++;
  console.log(`  FAIL  ${label}: ${message}`);
};

const defaults = normalizeCategories(null);

console.log("derive.ts — shelf records\n");
for (const [label, input] of CASES) {
  let book;
  try {
    book = lib.toShelfBook(input, 0, defaults);
  } catch (error) {
    // The page's own `initialize().catch()` turns a throw here into the static
    // catalog, so a throw is a failure, not a crash of this check.
    fail(label, `toShelfBook threw: ${error.message}`);
    continue;
  }

  for (const key of REQUIRED) {
    if (book[key] === undefined) fail(label, `missing "${key}"`);
  }
  if (book.chapters.length !== 3) {
    fail(label, `chapters has ${book.chapters.length} entries, page indexes 3`);
  }
  for (const [index, chapter] of book.chapters.entries()) {
    if (typeof chapter !== "string" || !chapter) {
      fail(label, `chapters[${index}] is ${JSON.stringify(chapter)}, page calls .toUpperCase() on it`);
    }
  }
  for (const [key, kind] of [["width", "number"], ["height", "number"], ["depth", "number"], ["seed", "number"]]) {
    if (typeof book[key] !== kind || !Number.isFinite(book[key])) fail(label, `${key} is not a finite number`);
  }
  for (const key of ["palette", "paletteLabel", "color", "foil"]) {
    if (!book[key]) fail(label, `missing "${key}"`);
  }
  if (!lib.toRoman(1) || lib.toRoman(0) !== "I" || lib.toRoman(4) !== "IV") {
    fail(label, "toRoman is wrong");
  }
}

/*
 * The regression this whole change exists for. The page reads
 * `COVER_CROPS[book.coverCrop]`, so the crop has to come from the entry's
 * category and from nothing else. Before the fix it came from
 * `BOOKS.indexOf(book)` — the slot — which agreed with the category only while
 * there was exactly one entry, and that is why the malfunction appeared from the
 * second book on.
 */
console.log("\nderive.ts — cover artwork follows the category\n");
const everyCategory = DEFAULT_CATEGORIES.map((category) => ({
  label: `mood=${category.id} at slot 0`,
  input: entry({ id: `entry-${category.id}`, mood: category.id }),
}));

for (const { label, input } of everyCategory) {
  // Slot 0 for all of them: if position leaked back into the crop, every one of
  // these would come out identical.
  const book = lib.toShelfBook(input, 0, defaults);
  const category = DEFAULT_CATEGORIES.find((item) => item.id === input.mood);
  const expected = MOTIF_KEYS.indexOf(category.motifKey);
  if (book.coverCrop !== expected) {
    fail(label, `coverCrop is ${book.coverCrop}, expected ${expected} for motif "${category.motifKey}"`);
  }
  if (book.motifKey !== category.motifKey) {
    fail(label, `motifKey is "${book.motifKey}", expected "${category.motifKey}"`);
  }
}

/*
 * Position must not reach the look at all. The same entry at four different
 * slots has to render the same volume; only the ordinal may differ.
 */
{
  const input = entry({ mood: "play" });
  const atSlots = [0, 1, 2, 7].map((index) => lib.toShelfBook(input, index, defaults));
  const looks = new Set(atSlots.map((book) => `${book.coverCrop}|${book.color}|${book.paletteLabel}`));
  if (looks.size !== 1) {
    fail("slot independence", `the same entry wore ${looks.size} different looks across slots: ${[...looks].join(" / ")}`);
  }
  const ordinals = new Set(atSlots.map((book) => book.roman));
  if (ordinals.size !== 4) {
    fail("slot independence", `expected four distinct volume numbers, got ${[...ordinals].join(", ")}`);
  }
}

/*
 * A reader's own list. Renaming must move the label and nothing else — the id is
 * what entries store, so a rename that also changed the look would silently
 * repaint every entry in that category.
 */
console.log("\nderive.ts — reader-owned categories\n");
{
  const renamed = defaults.map((category) =>
    category.id === "play" ? { ...category, label: "Eksperimen" } : category,
  );
  const before = lib.toShelfBook(entry({ mood: "play" }), 0, defaults);
  const after = lib.toShelfBook(entry({ mood: "play" }), 0, renamed);
  if (after.binding === before.binding) {
    fail("rename", `binding still reads "${after.binding}" after the category was renamed`);
  }
  if (after.coverCrop !== before.coverCrop || after.color !== before.color) {
    fail("rename", "renaming a category changed its look; only the label may move");
  }
  if (!after.binding.includes("Eksperimen")) {
    fail("rename", `new label did not reach binding: "${after.binding}"`);
  }
  // `discipline` is the entry's own subtitle when it has one, and only falls
  // back to the category label when it does not — so the label is asserted
  // against a subtitle-less entry.
  const bare = lib.toShelfBook(entry({ mood: "play", subtitle: "" }), 0, renamed);
  if (bare.discipline !== "Eksperimen") {
    fail("rename", `a subtitle-less entry's discipline is "${bare.discipline}", expected "Eksperimen"`);
  }
}

/*
 * A reader's list with categories the shipped seven never had, and one whose
 * look is reassigned. Both are things the manager dialog can produce.
 */
{
  const custom = [
    { id: "life", label: "Life", motifKey: "orbits" },
    { id: "experiment", label: "Experiment", motifKey: "frames" },
  ];
  const life = lib.toShelfBook(entry({ mood: "life" }), 0, custom);
  if (life.motifKey !== "orbits" || life.coverCrop !== MOTIF_KEYS.indexOf("orbits")) {
    fail("custom list", `"Life" rendered as motif "${life.motifKey}" crop ${life.coverCrop}`);
  }
  if (!life.binding.includes("Life")) fail("custom list", `binding is "${life.binding}"`);
}

/*
 * The two ways an entry can name a category that is not in the list: deleted by
 * the reader, or imported from a device with a different list. Both must resolve
 * to a renderable volume rather than throwing or producing an undefined look.
 */
{
  const shrunk = defaults.filter((category) => category.id !== "wonder");
  const orphan = lib.toShelfBook(entry({ mood: "wonder" }), 0, shrunk);
  const first = shrunk[0];
  if (orphan.motifKey !== first.motifKey || orphan.coverCrop !== MOTIF_KEYS.indexOf(first.motifKey)) {
    fail("deleted category", `an entry naming a deleted category rendered as "${orphan.motifKey}", expected "${first.motifKey}"`);
  }
  if (orphan.coverCrop === undefined || !orphan.paletteLabel) {
    fail("deleted category", "the fallback volume is missing its look");
  }
}

/* A list that normalizes to nothing still has to render: the app never has zero
   categories, but an imported file or a corrupt value can claim to. */
{
  for (const [label, value] of [
    ["null", null],
    ["empty array", []],
    ["garbage", [{ nope: true }, "x", 42]],
  ]) {
    const list = normalizeCategories(value);
    if (!Array.isArray(list) || list.length === 0) {
      fail(`normalizeCategories(${label})`, "returned no categories");
      continue;
    }
    const book = lib.toShelfBook(entry({ mood: "focus" }), 0, list);
    if (!book.paletteLabel || book.coverCrop === undefined) {
      fail(`normalizeCategories(${label})`, "the resulting list does not render");
    }
  }
}

/*
 * `motifKey` reaches `PALETTES[motifKey]`, and that lookup is not safe for
 * arbitrary strings: `PALETTES["constructor"]` returns Object's constructor
 * rather than undefined, so a `?? PALETTES.brackets` fallback would not catch
 * it and the book would ship a function where its palette belongs. Every path
 * into the list goes through `normalizeCategories`, so this is where the
 * guarantee has to hold.
 */
{
  for (const bogus of ["constructor", "__proto__", "toString", "", "Orbits", "BRACKETS"]) {
    const list = normalizeCategories([{ id: "a", label: "A", motifKey: bogus }]);
    if (!MOTIF_KEYS.includes(list[0].motifKey)) {
      fail(`motifKey ${JSON.stringify(bogus)}`, `survived normalization as ${JSON.stringify(list[0].motifKey)}`);
      continue;
    }
    const book = lib.toShelfBook(entry({ mood: "a" }), 0, list);
    if (typeof book.palette !== "object" || !book.palette?.paper) {
      fail(`motifKey ${JSON.stringify(bogus)}`, `produced a book whose palette is ${typeof book.palette}`);
    }
  }
}

/*
 * Prototype-named category *ids* are legal reader data — an import can carry
 * them — and the manager's delete prompt counts entries per id. On an ordinary
 * object `counts["constructor"]` reads back an inherited member, so the dialog
 * would state a nonsense number while asking the reader to confirm a delete of
 * entries it had miscounted, and `counts["__proto__"] = n` would not even
 * create the key. Neither is a crash, which is exactly why it needs asserting:
 * nothing else in the app would ever notice.
 */
{
  const ids = ["__proto__", "constructor", "toString"];
  const list = normalizeCategories(ids.map((id) => ({ id, label: id, motifKey: "orbits" })));
  if (list.length !== ids.length) {
    fail("prototype-named ids", `did not survive normalization: got ${list.length} of ${ids.length}`);
  }

  const entries = ids.flatMap((id) => [entry({ id: `${id}-1`, mood: id }), entry({ id: `${id}-2`, mood: id })]);
  entries.push(entry({ id: "other", mood: "focus" }));
  const counts = lib.categoryCounts(entries);
  for (const id of ids) {
    if (counts[id] !== 2) {
      fail(`count for ${id}`, `expected 2, got ${JSON.stringify(counts[id])}`);
    }
  }
  if (counts.focus !== 1) {
    fail("count for focus", `expected 1, got ${JSON.stringify(counts.focus)}`);
  }
  // A prototype-less object has no inherited members to leak into a lookup,
  // which is the property that makes a count trustworthy for an unknown id.
  if (counts.neverUsed !== undefined) {
    fail("count for an unused id", `expected undefined, got ${JSON.stringify(counts.neverUsed)}`);
  }

  // Each id must also resolve to its own look, not to a prototype member.
  for (const id of ids) {
    const book = lib.toShelfBook(entry({ mood: id }), 0, list);
    if (book.motifKey !== "orbits") {
      fail(`prototype-named id ${id}`, `resolved to look ${JSON.stringify(book.motifKey)} instead of its own`);
    }
  }
}

/*
 * The manual page maps over its own steps, so a short array is safe there — but
 * a `steps` entry without a string title would still render as "undefined".
 */
console.log("\nderive.ts — manual records\n");
for (const [label, input] of CASES) {
  let manual;
  try {
    manual = lib.toManualBook(input, defaults);
  } catch (error) {
    fail(label, `toManualBook threw: ${error.message}`);
    continue;
  }
  if (typeof manual.title !== "string" || !manual.title) fail(label, "manual title is empty");
  if (typeof manual.year !== "string") fail(label, "manual year is not a string");
  for (const [index, step] of manual.steps.entries()) {
    if (typeof step.title !== "string" || typeof step.body !== "string") {
      fail(label, `steps[${index}] is not a pair of strings`);
    }
  }
}

console.log(
  failed === 0
    ? `\nAll ${CASES.length} entry shapes produce renderable records.\n`
    : `\n${failed} check(s) failed.\n`,
);
process.exit(failed === 0 ? 0 : 1);
