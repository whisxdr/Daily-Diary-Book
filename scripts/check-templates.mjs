#!/usr/bin/env node
/*
 * Checks that the generated templates carry the reader's own copy and nothing
 * from the packaged pages they were derived from.
 *
 * The copy tables in lib/copy.mjs only act on the anchors they list, so a phrase
 * they miss stays on the page with no warning — that is how the canvas running
 * heads and the book's colophon survived the first pass. This scan is the guard:
 * it looks for the packaged markers in the templates themselves, which is what
 * the reader actually loads.
 *
 *   npm run check:templates
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

import { PACKAGED_MARKERS } from "./lib/copy.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const TEMPLATES = [
  { name: "shelf.template.html", path: join(ROOT, "public", "landing-pages", "shelf.template.html") },
  { name: "manual.template.html", path: join(ROOT, "public", "landing-pages", "manual.template.html") },
];

let failed = 0;

console.log("Generated templates — packaged copy\n");
for (const template of TEMPLATES) {
  if (!existsSync(template.path)) {
    console.log(`  MISSING  ${template.name} — run npm run build:templates`);
    failed++;
    continue;
  }
  const text = readFileSync(template.path, "utf8");
  const found = PACKAGED_MARKERS.filter((marker) => text.includes(marker));
  if (found.length) failed++;
  console.log(`  ${found.length ? "COPY LEFT" : "OK       "} ${template.name}`);
  for (const marker of found) {
    console.log(`             still contains ${JSON.stringify(marker)}`);
  }
}

console.log(
  failed === 0
    ? "\nBoth templates carry only the reader's own copy.\n"
    : `\n${failed} template(s) still show packaged copy. Add the phrase to scripts/lib/copy.mjs and rebuild.\n`,
);
process.exit(failed === 0 ? 0 : 1);
