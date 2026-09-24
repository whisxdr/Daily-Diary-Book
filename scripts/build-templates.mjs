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
 *
 * The templates also replace the packaged pages' own editorial copy (brand,
 * edition line, colophon) with the interface language the app uses; those
 * replacements live in scripts/lib/copy.mjs and are asserted the same way.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

import { findLiteral, parseLiteral } from "./lib/scan.mjs";
import { rewrite, assertOnlyIntendedEdits, assertTokensYieldValidScript } from "./lib/rewrite.mjs";
import { SHELF_COPY, MANUAL_COPY } from "./lib/copy.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = join(ROOT, "public", "landing-pages");

const SHELF_SOURCE = join(PAGES, "complete-shelf-v2.html");
const MANUAL_SOURCE = join(PAGES, "bestsellers-book-showcase.html");
const SHELF_TEMPLATE = join(PAGES, "shelf.template.html");
const MANUAL_TEMPLATE = join(PAGES, "manual.template.html");

const BOOKS_TOKEN = "__DIARY_BOOKS__";
const FALLBACK_TOKEN = "__DIARY_FALLBACK__";
const FALLBACK_TITLE_TOKEN = "__DIARY_FALLBACK_TITLE__";
const CARDS_TOKEN = "__DIARY_CARDS__";
const CARD_CSS_TOKEN = "__DIARY_CARD_CSS__";
const MANUAL_BOOKS_TOKEN = "__DIARY_MANUAL_BOOKS__";
const HERO_TOKEN = "__DIARY_HERO__";

/** Replaces one unique region and returns the result plus the record of it. */
function splice(text, find, replace, label) {
  return rewrite(text, [{ find, replace, label }], "template");
}

// ---------------------------------------------------------------- shelf

function buildShelf() {
  const source = readFileSync(SHELF_SOURCE, "utf8");
  const edits = [];
  let out = source;

  // 1. The catalog itself.
  const books = findLiteral(source, "const BOOKS", "array");
  const parsedBooks = parseLiteral(books.text, "BOOKS");
  if (!Array.isArray(parsedBooks) || parsedBooks.length === 0) throw new Error("BOOKS is not a non-empty array");
  const requiredKeys = [
    "id", "title", "roman", "discipline", "note", "deck", "binding", "format",
    "theme", "motif", "motifKey", "paletteLabel", "color", "foil", "palette",
    "width", "height", "depth", "chapters", "seed",
  ];
  for (const key of requiredKeys) {
    if (!(key in parsedBooks[0])) throw new Error(`BOOKS entry is missing "${key}"`);
  }
  const booksSwap = splice(out, books.text, BOOKS_TOKEN, "BOOKS");
  out = booksSwap.out;
  edits.push(...booksSwap.applied);

  // 2. The atlas holds seven artworks, selected by position. With more entries
  //    than artworks the index runs off the end and drawImage throws, so wrap it.
  const cropSwap = splice(
    out,
    "COVER_CROPS[BOOKS.indexOf(book)]",
    "COVER_CROPS[mod(BOOKS.indexOf(book), COVER_CROPS.length)]",
    "COVER_CROPS lookup",
  );
  out = cropSwap.out;
  edits.push(...cropSwap.applied);

  // 3. The static fallback repeats the authored catalog as markup, and it is
  //    what a reader sees when WebGL is unavailable. Replace the whole grid,
  //    aria-label included, so the generated one names the reader's own shelf.
  const gridOpen = out.indexOf('<div class="fallback__grid"');
  if (gridOpen < 0) throw new Error("fallback grid not found");
  const gridClose = out.indexOf("</div>", out.indexOf("</article>", gridOpen));
  const gridEnd = gridClose + "</div>".length;
  const gridOriginal = out.slice(gridOpen, gridEnd);
  if (!gridOriginal.includes("fallback-book")) throw new Error("fallback grid does not contain book cards");
  const gridSwap = splice(out, gridOriginal, FALLBACK_TOKEN, "fallback grid");
  out = gridSwap.out;
  edits.push(...gridSwap.applied);

  // 4. Authored headline copy that names the original catalog.
  const titleSwap = splice(out, "Seven tools for making.", FALLBACK_TITLE_TOKEN, "fallback title");
  out = titleSwap.out;
  edits.push(...titleSwap.applied);

  // 5. The packaged pages' own editorial copy: brand, edition line, and the
  //    colophon crediting artwork this project does not use.
  const copySwap = rewrite(out, SHELF_COPY, "shelf copy");
  out = copySwap.out;
  edits.push(...copySwap.applied);

  assertOnlyIntendedEdits(source, out, edits, "shelf template");
  const shelfScripts = assertTokensYieldValidScript(
    out,
    [BOOKS_TOKEN, FALLBACK_TOKEN, FALLBACK_TITLE_TOKEN],
    "shelf template",
  );
  writeFileSync(SHELF_TEMPLATE, out, "utf8");
  return { source, out, books: parsedBooks.length, scripts: shelfScripts, copy: SHELF_COPY.length };
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
  const cardsSwap = splice(out, cardsOriginal, CARDS_TOKEN, "card block");
  out = cardsSwap.out;
  edits.push(...cardsSwap.applied);

  // 2. The oversized hero word is authored copy. It is the loudest thing on the
  //    page, so it carries the reader's own title rather than the packaged one.
  const heroNeedle = '<h1 class="hero-word" aria-hidden="true">Agents</h1>';
  const heroReplacement = `<h1 class="hero-word" aria-hidden="true">${HERO_TOKEN}</h1>`;
  const heroSwap = splice(out, heroNeedle, heroReplacement, "hero word");
  out = heroSwap.out;
  edits.push(...heroSwap.applied);

  // 3. selectBook() reads from a `books` object keyed by data-book.
  const booksObj = findLiteral(out, "const books = {", "object");
  const parsedBooks = parseLiteral(booksObj.text, "books object");
  if (typeof parsedBooks !== "object" || parsedBooks === null) throw new Error("books is not an object");
  const manualBooksSwap = splice(out, booksObj.text, MANUAL_BOOKS_TOKEN, "books object");
  out = manualBooksSwap.out;
  edits.push(...manualBooksSwap.applied);

  // 4. Card positions live in CSS keyed by data-book, so the generated cards
  //    need their own rules. They go at the end of the top-level sheet — not
  //    after the last authored card rule, which sits inside a width media query
  //    and would apply the generated positions only below that width.
  const sheetEnd = out.lastIndexOf("</style>");
  if (sheetEnd < 0) throw new Error("no </style> to append the card rules to");
  const cssSwap = splice(out, "</style>", `\n${CARD_CSS_TOKEN}\n</style>`, "card css");
  out = cssSwap.out;
  edits.push(...cssSwap.applied);

  // 5. The packaged pages' own editorial copy: masthead brand, the detail
  //    panel's demo defaults, and the section labels that name what the
  //    reader's own record actually holds.
  const copySwap = rewrite(out, MANUAL_COPY, "manual copy");
  out = copySwap.out;
  edits.push(...copySwap.applied);

  assertOnlyIntendedEdits(source, out, edits, "manual template");
  const manualScripts = assertTokensYieldValidScript(
    out,
    [CARDS_TOKEN, MANUAL_BOOKS_TOKEN, CARD_CSS_TOKEN, HERO_TOKEN],
    "manual template",
  );
  writeFileSync(MANUAL_TEMPLATE, out, "utf8");
  return { source, out, cards: cardStarts.length, scripts: manualScripts, copy: MANUAL_COPY.length };
}

const shelf = buildShelf();
const manual = buildManual();

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`shelf.template.html   ${kb(shelf.out.length)}  (source ${kb(shelf.source.length)}, ${shelf.books} catalog entries, ${shelf.copy} copy edits, ${shelf.scripts} script checked)`);
console.log(`manual.template.html  ${kb(manual.out.length)}  (source ${kb(manual.source.length)}, ${manual.cards} cards, ${manual.copy} copy edits, ${manual.scripts} script checked)`);
console.log("\nBoth templates differ from their sources only inside the replaced regions,");
console.log("and both still parse as JavaScript once every token is substituted.");
