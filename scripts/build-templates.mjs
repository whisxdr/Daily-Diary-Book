#!/usr/bin/env node
/*
 * Turns the two byte-exact ThreeUI documents into runtime templates.
 *
 * Neither page accepts data: the shelf hardcodes its catalog in a `const BOOKS`
 * array and the showcase hardcodes three cards plus a `books` object, and
 * neither reads a query string, a global, or a message. So the entry data is
 * injected by substituting those authored literals with tokens, and the frame
 * receives the result through its `sourceUrl` prop as a blob URL.
 *
 * The source files under public/landing-pages/ are never modified — they stay
 * byte-exact against their published digests, which `verify-threeui.mjs` checks.
 * This script reads them and writes derived copies:
 *
 *   public/landing-pages/shelf.template.html
 *   public/landing-pages/manual.template.html
 *
 * Substitution happens here, once, at build time, so the fragile part — finding
 * the exact end of a JavaScript literal — runs under an assertion instead of on
 * every page load.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = join(ROOT, "public", "landing-pages");

const SHELF_SOURCE = join(PAGES, "complete-shelf-v2.html");
const MANUAL_SOURCE = join(PAGES, "bestsellers-book-showcase.html");
const SHELF_TEMPLATE = join(PAGES, "shelf.template.html");
const MANUAL_TEMPLATE = join(PAGES, "manual.template.html");

const BOOKS_TOKEN = "__DIARY_BOOKS__";
const FALLBACK_TOKEN = "__DIARY_FALLBACK__";
const CARDS_TOKEN = "__DIARY_CARDS__";
const CARD_CSS_TOKEN = "__DIARY_CARD_CSS__";
const MANUAL_BOOKS_TOKEN = "__DIARY_MANUAL_BOOKS__";
const HERO_TOKEN = "__DIARY_HERO__";

/**
 * Finds the balanced `[...]` literal that follows `marker`, ignoring brackets
 * inside strings, template literals, and comments. A plain regex cannot do this
 * because the array contains prose with brackets and quotes in it.
 */
function findArrayLiteral(text, marker) {
  const markerAt = text.indexOf(marker);
  if (markerAt < 0) throw new Error(`marker not found: ${marker}`);
  const open = text.indexOf("[", markerAt);
  if (open < 0) throw new Error(`no array after marker: ${marker}`);

  let depth = 0;
  let quote = null;
  let template = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = open; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (lineComment) {
      if (c === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (c === "*" && next === "/") {
        blockComment = false;
        i++;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === quote) quote = null;
      continue;
    }
    if (template) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === "`") template = false;
      continue;
    }
    if (c === "/" && next === "/") {
      lineComment = true;
      i++;
      continue;
    }
    if (c === "/" && next === "*") {
      blockComment = true;
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    if (c === "`") {
      template = true;
      continue;
    }
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return { start: open, end: i + 1, text: text.slice(open, i + 1) };
    }
  }
  throw new Error(`unterminated array after marker: ${marker}`);
}

/** Parses a literal we just located, so a bad region fails here, not at runtime. */
function parseLiteral(literal, label) {
  try {
    return new Function(`return ${literal}`)();
  } catch (error) {
    throw new Error(`${label} does not parse as a literal: ${error.message}`);
  }
}

/** Replaces one region and records it, so the diff outside can be asserted. */
function replaceOnce(text, needle, replacement, label) {
  const at = text.indexOf(needle);
  if (at < 0) throw new Error(`anchor not found: ${label}`);
  if (text.indexOf(needle, at + 1) >= 0) throw new Error(`anchor is not unique: ${label}`);
  return { text: text.slice(0, at) + replacement + text.slice(at + needle.length), at, length: needle.length };
}

/**
 * Confirms the template differs from its source only inside the replaced
 * regions. Each edit records the exact source text it replaced; splicing those
 * texts back over the result must reproduce the source byte-for-byte.
 */
function assertOnlyIntendedEdits(source, result, edits, label) {
  let rebuilt = result;
  for (const edit of edits) {
    const at = rebuilt.indexOf(edit.placeholder);
    if (at < 0) throw new Error(`${label}: placeholder for ${edit.label} is missing from the result`);
    rebuilt = rebuilt.slice(0, at) + edit.original + rebuilt.slice(at + edit.placeholder.length);
  }
  if (rebuilt !== source) {
    let i = 0;
    while (i < Math.min(rebuilt.length, source.length) && rebuilt[i] === source[i]) i++;
    throw new Error(
      `${label}: edits reached outside the intended regions ` +
        `(first difference at ${i}; source ${JSON.stringify(source.slice(i, i + 60))} ` +
        `vs result ${JSON.stringify(rebuilt.slice(i, i + 60))})`,
    );
  }
}

/** Records a replacement so `assertOnlyIntendedEdits` can reverse it. */
function record(edits, placeholder, original, label) {
  edits.push({ placeholder, original, label });
}

// ---------------------------------------------------------------- shelf

function buildShelf() {
  const source = readFileSync(SHELF_SOURCE, "utf8");
  const edits = [];
  let out = source;

  // 1. The catalog itself.
  const books = findArrayLiteral(source, "const BOOKS");
  const parsedBooks = parseLiteral(books.text, "BOOKS");
  if (!Array.isArray(parsedBooks) || parsedBooks.length === 0) throw new Error("BOOKS is not a non-empty array");
  /*
   * The keys the page's own rendering code reads. This validates the *packaged*
   * catalog, which is why `coverCrop` is absent here: the page learns that field
   * from the patch below, and it is asserted against our generated books in
   * `check-derive.mjs` instead.
   */
  const requiredKeys = [
    "id", "title", "roman", "discipline", "note", "deck", "binding", "format",
    "theme", "motif", "motifKey", "paletteLabel", "color", "foil", "palette",
    "width", "height", "depth", "chapters", "seed",
  ];
  for (const key of requiredKeys) {
    if (!(key in parsedBooks[0])) throw new Error(`BOOKS entry is missing "${key}"`);
  }
  const booksReplacement = BOOKS_TOKEN;
  record(edits, booksReplacement, books.text, "BOOKS");
  out = out.slice(0, books.start) + booksReplacement + out.slice(books.end);

  // 2. Cover artwork is looked up by the volume's position on the shelf:
  //
  //      COVER_CROPS[BOOKS.indexOf(book)]
  //
  //    That is the category mismatch. Everything else about a volume's look —
  //    cloth colour, foil, paper, wall, ink — is read off the book object, and
  //    `derive.ts` sets those from the entry's category. The artwork alone came
  //    from the slot, so a "Play" entry at slot 0 wore the ultramarine
  //    "brackets" artwork over coral cloth. With one entry the two agreed by
  //    coincidence (the default category is the first motif, and the only book
  //    is at slot 0), which is why it only showed up from the second entry on.
  //
  //    The atlas is authored in motif order, so the crop that belongs to a
  //    category is just that motif's index — which `derive.ts` now ships on the
  //    book as `coverCrop`. Reading it from the book fixes the mismatch and
  //    removes the position dependency entirely. The previous fix here wrapped
  //    the index in `mod(...)` to stop it running off the end past seven
  //    entries; that turned a crash into silent wrongness (entry 8 wore crop 0)
  //    and is no longer needed, because the index no longer depends on how many
  //    entries there are.
  //
  //    `Number`/`Math.trunc`/`|| 0` stay as guards rather than as the mechanism.
  //    `derive.ts` already clamps to a valid crop, but this expression runs
  //    inside the page's own script, where an index that is not a whole number —
  //    `NaN` from a hand-edited payload, a string, a float — indexes to
  //    `undefined`, and the destructuring on the left then throws. A throw there
  //    costs the reader the entire scene: `initialize().catch()` swaps in the
  //    static catalog and nothing logs why. Coercing first keeps a bad index to
  //    one wrong cover instead of no shelf at all.
  //
  //    The trailing `|| 0` is not redundant with the one inside. `Infinity` is
  //    truthy, so the inner guard passes it through, and `Infinity % 7` is `NaN`
  //    — the exact value the guard exists to prevent. JSON has no Infinity
  //    literal, but `1e999` parses to it, so a hand-edited file can carry one.
  //    `NaN || 0` is the case the outer guard catches, and after the inner guard
  //    it is the only one left.
  const cropUse = "COVER_CROPS[BOOKS.indexOf(book)]";
  const cropFix = "COVER_CROPS[mod(Math.trunc(Number(book.coverCrop)) || 0, COVER_CROPS.length) || 0]";
  const cropped = replaceOnce(out, cropUse, cropFix, "COVER_CROPS lookup");
  record(edits, cropFix, cropUse, "COVER_CROPS lookup");
  out = cropped.text;

  // 3. The static fallback repeats the authored catalog as markup, and it is
  //    what a reader sees when WebGL is unavailable. Replace the whole grid,
  //    aria-label included, so the generated one names the reader's own shelf.
  const gridOpen = out.indexOf('<div class="fallback__grid"');
  if (gridOpen < 0) throw new Error("fallback grid not found");
  const gridClose = out.indexOf("</div>", out.indexOf("</article>", gridOpen));
  const gridEnd = gridClose + "</div>".length;
  const gridOriginal = out.slice(gridOpen, gridEnd);
  if (!gridOriginal.includes("fallback-book")) throw new Error("fallback grid does not contain book cards");
  record(edits, FALLBACK_TOKEN, gridOriginal, "fallback grid");
  out = out.slice(0, gridOpen) + FALLBACK_TOKEN + out.slice(gridEnd);

  // 4. Authored headline copy that names the original catalog.
  const headline = "Seven tools for making.";
  const done = replaceOnce(out, headline, "__DIARY_FALLBACK_TITLE__", "fallback title");
  record(edits, "__DIARY_FALLBACK_TITLE__", headline, "fallback title");
  out = done.text;

  assertOnlyIntendedEdits(source, out, edits, "shelf template");
  const shelfScripts = assertTokensYieldValidScript(
    out,
    [BOOKS_TOKEN, FALLBACK_TOKEN, "__DIARY_FALLBACK_TITLE__"],
    "shelf template",
  );
  writeFileSync(SHELF_TEMPLATE, out, "utf8");
  return { source, out, books: parsedBooks.length, scripts: shelfScripts };
}

// --------------------------------------------------------------- manual

function buildManual() {
  const source = readFileSync(MANUAL_SOURCE, "utf8");
  const edits = [];
  let out = source;

  // 1. The three cards are static markup, each with a per-card style attribute
  //    carrying its cover, and CSS positions them by [data-book="…"]. Replace
  //    the card block and append generated positioning CSS.
  const cardStarts = [...out.matchAll(/<button\s+class="book-card"/g)].map((m) => m.index);
  if (cardStarts.length !== 3) throw new Error(`expected 3 book cards, found ${cardStarts.length}`);
  const cardsStart = cardStarts[0];
  const cardsEnd = out.indexOf("</button>", cardStarts[2]) + "</button>".length;
  const cardsOriginal = out.slice(cardsStart, cardsEnd);
  for (const id of ["codex", "claude", "cursor"]) {
    if (!cardsOriginal.includes(`data-book="${id}"`)) throw new Error(`card block is missing ${id}`);
  }
  record(edits, CARDS_TOKEN, cardsOriginal, "card block");
  out = out.slice(0, cardsStart) + CARDS_TOKEN + out.slice(cardsEnd);

  // 2. The oversized hero word is authored copy. It is the loudest thing on the
  //    page, so it carries the reader's own title rather than the packaged one.
  const heroNeedle = '<h1 class="hero-word" aria-hidden="true">Agents</h1>';
  const heroReplacement = `<h1 class="hero-word" aria-hidden="true">${HERO_TOKEN}</h1>`;
  const hero = replaceOnce(out, heroNeedle, heroReplacement, "hero word");
  record(edits, heroReplacement, heroNeedle, "hero word");
  out = hero.text;

  // 3. selectBook() reads from a `books` object keyed by data-book.
  const booksObj = findObjectLiteral(out, "const books = {");
  const parsedBooks = parseLiteral(booksObj.text, "books object");
  if (typeof parsedBooks !== "object" || parsedBooks === null) throw new Error("books is not an object");
  const manualBooksReplacement = MANUAL_BOOKS_TOKEN;
  record(edits, manualBooksReplacement, booksObj.text, "books object");
  out = out.slice(0, booksObj.start) + manualBooksReplacement + out.slice(booksObj.end);

  // 4. Card positions live in CSS keyed by data-book, so the generated cards
  //    need their own rules. They go at the end of the top-level sheet — not
  //    after the last authored card rule, which sits inside a width media query
  //    and would apply the generated positions only below that width.
  const sheetEnd = out.lastIndexOf("</style>");
  if (sheetEnd < 0) throw new Error("no </style> to append the card rules to");
  const cssInsertion = `\n${CARD_CSS_TOKEN}\n`;
  record(edits, cssInsertion, "", "card css");
  out = out.slice(0, sheetEnd) + cssInsertion + out.slice(sheetEnd);

  assertOnlyIntendedEdits(source, out, edits, "manual template");
  const manualScripts = assertTokensYieldValidScript(
    out,
    [CARDS_TOKEN, MANUAL_BOOKS_TOKEN, CARD_CSS_TOKEN, HERO_TOKEN],
    "manual template",
  );
  writeFileSync(MANUAL_TEMPLATE, out, "utf8");
  return { source, out, cards: cardStarts.length, scripts: manualScripts };
}

/**
 * Substitutes sample values for every token and parses the module script, so a
 * token placed outside the literal it replaces — which would produce
 * `const BOOKS = const BOOKS = …` — fails the build instead of the browser.
 *
 * The page's script is an ES module (`import * as THREE from "three"`), which
 * `new Function` cannot parse. Rewriting the import and export statements to
 * plain declarations keeps every other byte — including the tokens — in place
 * while making the body parseable as a script.
 */
function assertTokensYieldValidScript(template, tokens, label) {
  let filled = template;
  for (const token of tokens) filled = filled.split(token).join("null");
  const scripts = [
    ...filled.matchAll(
      /<script(?![^>]*\bsrc=)(?![^>]*\btype=["'](?:importmap|application\/json)["'])[^>]*>([\s\S]*?)<\/script>/g,
    ),
  ];
  if (!scripts.length) throw new Error(`${label}: no inline script found`);
  for (const [index, script] of scripts.entries()) {
    const parseable = script[1]
      .replace(/^\s*import\s+[\s\S]*?\s+from\s+["'][^"']+["'];?/gm, "")
      .replace(/^\s*import\s+["'][^"']+["'];?/gm, "")
      .replace(/^\s*export\s+/gm, "");
    try {
      new Function(parseable);
    } catch (error) {
      throw new Error(`${label}: inline script ${index} does not parse after token substitution (${error.message})`);
    }
  }
  return scripts.length;
}

/** Same as findArrayLiteral but for a `{…}` literal. */
function findObjectLiteral(text, marker) {
  const at = text.indexOf(marker);
  if (at < 0) throw new Error(`marker not found: ${marker}`);
  const open = text.indexOf("{", at);
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (lineComment) { if (c === "\n") lineComment = false; continue; }
    if (blockComment) { if (c === "*" && next === "/") { blockComment = false; i++; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "/" && next === "/") { lineComment = true; i++; continue; }
    if (c === "/" && next === "*") { blockComment = true; i++; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return { start: open, end: i + 1, text: text.slice(open, i + 1) }; }
  }
  throw new Error(`unterminated object after marker: ${marker}`);
}

const shelf = buildShelf();
const manual = buildManual();

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`shelf.template.html   ${kb(shelf.out.length)}  (source ${kb(shelf.source.length)}, ${shelf.books} catalog entries, ${shelf.scripts} script checked)`);
console.log(`manual.template.html  ${kb(manual.out.length)}  (source ${kb(manual.source.length)}, ${manual.cards} cards, ${manual.scripts} script checked)`);
console.log("\nBoth templates differ from their sources only inside the replaced regions,");
console.log("and both still parse as JavaScript once every token is substituted.");
