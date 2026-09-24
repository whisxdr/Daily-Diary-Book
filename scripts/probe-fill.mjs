#!/usr/bin/env node
/*
 * Fills the shelf template exactly the way the app does and writes the result to
 * .probe/, so it can be opened over HTTP with the browser's own console
 * attached. This is a diagnostic only; nothing in the app imports it.
 *
 * The records come from the real derive module rather than hand-copied literals.
 * The copy of that logic here had already drifted: it built `chapters` straight
 * from `entry.tags`, so a two-tag entry produced a two-element array — exactly
 * the shape that makes the page fall back to its static catalog without logging
 * anything. Writing the probe into .probe/ also keeps it out of the served
 * public/ directory, where it would ship as a stray page.
 *
 *   node scripts/probe-fill.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { build } from "esbuild";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, ".probe");
const OUT_FILE = join(OUT_DIR, "shelf-filled.html");

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

const entry = {
  id: "probe-1",
  date: "2026-09-22",
  title: "Cinta",
  subtitle: "Ingin ku mencintaimu",
  body: "Hari ini aku belajar mencintai hal kecil.\n\nParagraf kedua.",
  mood: "focus",
  tags: ["cinta", "tenang"],
  createdAt: "2026-09-22T00:00:00.000Z",
  updatedAt: "2026-09-22T00:00:00.000Z",
};

const template = readFileSync(join(ROOT, "public", "landing-pages", "shelf.template.html"), "utf8");

let filled = template
  .split("__DIARY_BOOKS__").join(derive.escapeScriptJson([derive.toShelfBook(entry, 0)]))
  .split("__DIARY_FALLBACK__").join(derive.toFallbackGrid([entry]))
  .split("__DIARY_FALLBACK_TITLE__").join("1 volume of your own.");

const leftover = filled.match(/__DIARY_[A-Z_]+__/);
if (leftover) throw new Error(`token left unfilled: ${leftover[0]}`);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, filled, "utf8");
console.log(`wrote .probe/shelf-filled.html (${filled.length} chars)`);
