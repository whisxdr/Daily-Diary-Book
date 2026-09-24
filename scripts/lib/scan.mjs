/*
 * Finds the balanced literal that follows a marker in a JavaScript source file.
 *
 * A plain regex cannot do this: the shelf's `BOOKS` array holds prose with
 * brackets and quotes inside it, so the scanner has to know what is string,
 * template, comment, and code. Both the array and the object form share this one
 * implementation — the only difference is the bracket pair.
 */

const PAIRS = {
  array: ["[", "]"],
  object: ["{", "}"],
};

/**
 * Returns `{ start, end, text }` for the literal following `marker`.
 *
 * @param {string} text   source to scan
 * @param {string} marker anchor the literal follows, e.g. `const BOOKS`
 * @param {"array"|"object"} kind which bracket pair delimits the literal
 */
export function findLiteral(text, marker, kind) {
  const [open, close] = PAIRS[kind];
  const markerAt = text.indexOf(marker);
  if (markerAt < 0) throw new Error(`marker not found: ${marker}`);
  const start = text.indexOf(open, markerAt);
  if (start < 0) throw new Error(`no ${kind} after marker: ${marker}`);

  let depth = 0;
  let quote = null;
  let template = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = start; i < text.length; i++) {
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
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return { start, end: i + 1, text: text.slice(start, i + 1) };
    }
  }
  throw new Error(`unterminated ${kind} after marker: ${marker}`);
}

/** Parses a literal we just located, so a bad region fails here, not at runtime. */
export function parseLiteral(literal, label) {
  try {
    return new Function(`return ${literal}`)();
  } catch (error) {
    throw new Error(`${label} does not parse as a literal: ${error.message}`);
  }
}
