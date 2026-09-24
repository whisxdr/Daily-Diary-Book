#!/usr/bin/env node
/*
 * Checks that the artwork a volume wears belongs to the entry's category.
 *
 * This is the seam the original malfunction lived on. `derive.ts` decides which
 * crop a book should wear; the packaged page decides how to turn that field into
 * a tile of its atlas. The two are edited in different files — one TypeScript,
 * one a build-time patch on an immutable 880 KB HTML source — so asserting
 * either half alone cannot catch them drifting apart again. This reads the
 * expression out of the *built template* and runs it against books built by
 * `derive.ts`, which is the only place both halves meet.
 *
 * The bug it guards: the page used to select artwork by the volume's position on
 * the shelf (`COVER_CROPS[BOOKS.indexOf(book)]`), while cloth colour, foil, and
 * paper came from the entry's category. With one entry the two agreed by
 * coincidence, so the mismatch only appeared from the second book on — a "Play"
 * entry sitting at slot 0 wore the ultramarine brackets artwork over coral
 * cloth. The `old lookup gave` column below is what each slot used to render.
 *
 *   npm run check:cover
 */
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const bundled = await build({
  stdin: {
    contents: `export * from "./src/lib/derive";\nexport * from "./src/lib/types";\n`,
    resolveDir: ROOT,
    sourcefile: "check-cover-entry.ts",
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

const templatePath = join(ROOT, "public", "landing-pages", "shelf.template.html");
const page = readFileSync(templatePath, "utf8");

/*
 * Both the atlas and the lookup are read out of the generated page rather than
 * restated here. A copy would only ever test this file, and the whole point is
 * to test what the browser will actually run.
 */
const cropsMatch = page.match(/const COVER_CROPS = (\[[\s\S]*?\]);/);
if (!cropsMatch) throw new Error(`COVER_CROPS not found in ${templatePath} — run npm run build:templates`);
const COVER_CROPS = JSON.parse(cropsMatch[1]);

const exprMatch = page.match(/=\s*(COVER_CROPS\[[^\]]*\])\s*;/);
if (!exprMatch) throw new Error(`the COVER_CROPS lookup was not found in ${templatePath}`);
const cropExpression = exprMatch[1];

// The page's own `mod`, so the expression is evaluated with the same helper.
const mod = (value, length) => ((value % length) + length) % length;
const evaluateCrop = new Function("COVER_CROPS", "mod", "book", `return ${cropExpression};`);

const categories = lib.normalizeCategories(null);
const MOTIF_KEYS = lib.MOTIF_KEYS;

let failed = 0;
const fail = (message) => {
  failed++;
  console.log(`  FAIL  ${message}`);
};

console.log(`template:  ${cropExpression}`);
console.log(`atlas:     ${COVER_CROPS.length} crops\n`);

/*
 * A shelf whose order deliberately does not line up with the motif order — the
 * arrangement that used to wear the wrong artwork, and the one a reader reaches
 * by writing entries in any order they like.
 */
const MOODS = [
  "play", "focus", "clarity", "warmth", "craft", "motion", "wonder",
  "play", "clarity", "focus", "wonder", "craft",
];

const shelf = MOODS.map((mood, index) => ({
  id: `e${index}`,
  date: "2026-09-22",
  title: `Entry ${index}`,
  subtitle: "",
  body: "Body.",
  mood,
  tags: [],
  createdAt: "2026-09-22T00:00:00.000Z",
  updatedAt: "2026-09-22T00:00:00.000Z",
}));

console.log("slot  category   motif      crop  expected  artwork");
for (const [index, entry] of shelf.entries()) {
  const book = lib.toShelfBook(entry, index, categories);
  // The page destructures the expression as [x, y, w, h], so it yields a tile.
  const tile = evaluateCrop(COVER_CROPS, mod, book);
  const crop = COVER_CROPS.indexOf(tile);
  const expected = MOTIF_KEYS.indexOf(book.motifKey);
  const slotCrop = index % COVER_CROPS.length; // what the slot-based lookup gave
  const ok = crop === expected;
  if (!ok) fail(`slot ${index}: category "${entry.mood}" took crop ${crop}, expected ${expected}`);
  console.log(
    `${String(index).padStart(4)}  ${entry.mood.padEnd(9)}  ${book.motifKey.padEnd(9)}  ` +
      `${String(crop).padStart(4)}  ${String(expected).padStart(8)}  ${ok ? "ok" : "WRONG"}` +
      (slotCrop !== expected ? `   (slot lookup gave ${slotCrop})` : ""),
  );
}

/*
 * Every value the field can hold has to yield a real tile. An index that misses
 * destructures to `undefined` and throws inside the page's own script, where
 * `initialize().catch()` silently swaps in the static catalog — the reader loses
 * the whole scene and nothing logs the reason.
 */
console.log("\nmalformed coverCrop:");
for (const value of [undefined, null, NaN, -1, 99, "orbits", 3.7]) {
  const book = lib.toShelfBook(shelf[0], 0, categories);
  book.coverCrop = value;
  let tile;
  try {
    tile = evaluateCrop(COVER_CROPS, mod, book);
  } catch (error) {
    fail(`coverCrop=${String(value)} threw: ${error.message}`);
    continue;
  }
  const ok = Array.isArray(tile) && tile.length === 4;
  if (!ok) fail(`coverCrop=${String(value)} produced ${JSON.stringify(tile)}, which is not a tile`);
  console.log(`  ${String(value).padEnd(10)} -> crop ${String(COVER_CROPS.indexOf(tile)).padEnd(4)} ${ok ? "ok" : "WRONG"}`);
}

/* A reader's own list, including one whose look is reassigned. */
console.log("\nreader-owned categories:");
for (const category of [
  { id: "life", label: "Life", motifKey: "orbits" },
  { id: "experiment", label: "Experiment", motifKey: "frames" },
  { id: "play", label: "Bermain", motifKey: "compass" }, // a shipped id, relooked
]) {
  const book = lib.toShelfBook(shelf[0], 0, [category]);
  const tile = evaluateCrop(COVER_CROPS, mod, book);
  const crop = COVER_CROPS.indexOf(tile);
  const expected = MOTIF_KEYS.indexOf(category.motifKey);
  const ok = crop === expected;
  if (!ok) fail(`"${category.label}" wore crop ${crop}, expected ${expected} for "${category.motifKey}"`);
  console.log(`  ${category.label.padEnd(12)} ${category.motifKey.padEnd(9)} -> crop ${String(crop).padEnd(4)} ${ok ? "ok" : "WRONG"}`);
}

console.log(
  failed === 0
    ? "\nEvery volume wears the artwork of its own category.\n"
    : `\n${failed} check(s) failed.\n`,
);
process.exit(failed === 0 ? 0 : 1);
