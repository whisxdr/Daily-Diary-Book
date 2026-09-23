#!/usr/bin/env node
/*
 * Checks every ThreeUI source file this project integrates against the SHA-256
 * digest published in its registered source bundle. Run it after any upgrade or
 * any edit to a file under src/shaders/ — a mismatch means the integration no
 * longer matches the revision it claims, and the fix is to re-integrate, never
 * to update the expected digest here.
 *
 *   npm run verify:threeui
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Digest per registered file, from the two published source bundles. */
const EXPECTED = [
  {
    path: "src/shaders/landing-pages/LandingPageFrame.tsx",
    sha256: "61de2cc50888aac4ac5557420b07fa47ed3543bb57c1e0055fafdefa53dbaa78",
  },
  {
    path: "public/landing-pages/bestsellers-book-showcase.html",
    sha256: "7c1ed1ca4a4c58f1c33956c84edd8f7ba450ea0312df718701e634a207568138",
  },
  {
    path: "public/landing-pages/complete-shelf-v2.html",
    sha256: "606f200fed8602c243f40a11c8c364f0e625c57f80e7c97dc76419da207f198e",
  },
  {
    path: "src/shaders/threeui.css",
    sha256: "efe4447139f1358dd8e9be68edf6fa46cbefbd1de423a4d6c439ca61d2c8eccf",
  },
];

/*
 * The registered LandingPages.tsx is the whole landing-page family in one
 * module: 22 page components and a dozen imports from sibling scenes that ship
 * outside this bundle. Only two of those components are used here, so the file
 * is a trim rather than a copy and cannot carry the whole-file digest. Its two
 * component bodies are reproduced byte-for-byte, and those are what is checked.
 */
const EXTRACTS = [
  {
    path: "src/shaders/landing-pages/LandingPages.tsx",
    label: "CompleteShelfLandingPage",
    sha256: "c7048e4b39daa00ec5a865f684f2b0095ce432fd0797557efe82ee00a4378776",
  },
  {
    path: "src/shaders/landing-pages/LandingPages.tsx",
    label: "BestsellersBookShowcase",
    sha256: "5e5ee3280e2cf3649f3846d24793d3b8217b9e31eea3b2147e2dc950fe2b1ed1",
  },
];

/** Returns the source of `export function <label>` up to its closing brace. */
function extractFunction(source, label) {
  const marker = `export function ${label}(`;
  const start = source.indexOf(marker);
  if (start < 0) return null;
  const end = source.indexOf("\n}\n", start);
  if (end < 0) return null;
  return source.slice(start, end + 3);
}

/** Files reconstructed from the npm package; checked against the same bundle. */
const RECONSTRUCTED = [
  {
    path: "src/shaders/landing-pages/pageTypography.js",
    from: "@designcodeio/threeui@1.2.0 lib-dist/shaders/landing-pages/pageTypography.js",
    note: "deobfuscated; registered bundle does not include this module",
  },
  {
    path: "src/shaders/landing-pages/pageRecipes.js",
    from: "@designcodeio/threeui@1.2.0 lib-dist/shaders/landing-pages/pageRecipes.js",
    note: "deobfuscated; registered bundle does not include this module",
  },
];

const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

let failed = 0;

console.log("Registered source — SHA-256\n");
for (const entry of EXPECTED) {
  const file = join(ROOT, entry.path);
  if (!existsSync(file)) {
    console.log(`  MISSING  ${entry.path}`);
    failed++;
    continue;
  }
  const actual = sha256(file);
  const ok = actual === entry.sha256;
  if (!ok) failed++;
  console.log(`  ${ok ? "OK      " : "MISMATCH"} ${entry.path}`);
  if (!ok) {
    console.log(`             expected ${entry.sha256}`);
    console.log(`             actual   ${actual}`);
  }
  if (entry.note) console.log(`             note: ${entry.note}`);
}

console.log("\nVerbatim component bodies inside the trimmed module\n");
for (const entry of EXTRACTS) {
  const file = join(ROOT, entry.path);
  if (!existsSync(file)) {
    console.log(`  MISSING  ${entry.path} :: ${entry.label}`);
    failed++;
    continue;
  }
  const body = extractFunction(readFileSync(file, "utf8"), entry.label);
  if (!body) {
    console.log(`  MISSING  ${entry.label} in ${entry.path}`);
    failed++;
    continue;
  }
  const actual = createHash("sha256").update(body).digest("hex");
  const ok = actual === entry.sha256;
  if (!ok) failed++;
  console.log(`  ${ok ? "OK      " : "MISMATCH"} ${entry.label}`);
  if (!ok) {
    console.log(`             expected ${entry.sha256}`);
    console.log(`             actual   ${actual}`);
  }
}

console.log("\nReconstructed from npm — digest not published in the bundle\n");
for (const entry of RECONSTRUCTED) {
  const file = join(ROOT, entry.path);
  const present = existsSync(file);
  if (!present) failed++;
  console.log(`  ${present ? "OK      " : "MISSING"} ${entry.path}`);
  console.log(`             source: ${entry.from}`);
  if (entry.note) console.log(`             note: ${entry.note}`);
}

console.log(
  failed === 0
    ? "\nAll registered files match the published revision.\n"
    : `\n${failed} file(s) do not match. Re-integrate from the registered source; do not edit the expected digest.\n`,
);
process.exit(failed === 0 ? 0 : 1);
