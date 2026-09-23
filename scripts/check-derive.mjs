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
 *   npm run check:derive
 */
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const bundled = await build({
  entryPoints: [join(ROOT, "src", "lib", "derive.ts")],
  bundle: true,
  write: false,
  format: "esm",
  platform: "neutral",
  logLevel: "silent",
});
const derive = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);

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
 * a `mood` outside the seven known values falls back to the default.
 */
const CASES = [
  ["no tags", entry()],
  ["one tag", entry({ tags: ["cinta"] })],
  ["two tags", entry({ tags: ["cinta", "tenang"] })],
  ["three tags", entry({ tags: ["cinta", "tenang", "pagi"] })],
  ["four tags", entry({ tags: ["a", "b", "c", "d"] })],
  ["empty-string tags", entry({ tags: ["", ""] })],
  ["imported without tags", { ...entry(), tags: undefined }],
  ["unknown mood", entry({ mood: "nostalgia" })],
  ["empty title and body", entry({ title: "", subtitle: "", body: "" })],
  ["multiline body", entry({ body: "Satu.\n\nDua.\n\nTiga.\n\nEmpat." })],
];

const REQUIRED = [
  "id", "title", "roman", "discipline", "note", "deck", "binding", "format",
  "theme", "motif", "motifKey", "paletteLabel", "color", "foil", "palette",
  "width", "height", "depth", "chapters", "seed",
];

let failed = 0;
const fail = (label, message) => {
  failed++;
  console.log(`  FAIL  ${label}: ${message}`);
};

console.log("derive.ts — shelf records\n");
for (const [label, input] of CASES) {
  let book;
  try {
    book = derive.toShelfBook(input, 0);
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
  if (!derive.toRoman(1) || derive.toRoman(0) !== "I" || derive.toRoman(4) !== "IV") {
    fail(label, "toRoman is wrong");
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
    manual = derive.toManualBook(input);
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
