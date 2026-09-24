/*
 * Applies a list of anchored edits to a document and proves nothing else moved.
 *
 * The two ThreeUI pages are byte-exact against published digests, so every
 * transformation has to be auditable: each edit is recorded with the exact text
 * it replaced, and `assertOnlyIntendedEdits` reconstructs the source from the
 * result. If the reconstruction differs by even one byte, the build fails.
 */

/**
 * Applies `edits` (each `{ find, replace, label }`) left to right.
 *
 * Every `find` must be unique: a repeated anchor means the replacement would hit
 * a region the author did not mean, so it fails the build instead. The recorded
 * offsets are valid in the string state right after each edit, so reversing them
 * in reverse order is exact.
 */
export function rewrite(source, edits, label) {
  let out = source;
  const applied = [];

  for (const edit of edits) {
    const at = out.indexOf(edit.find);
    if (at < 0) throw new Error(`${label}: anchor not found: ${edit.label}`);
    if (out.indexOf(edit.find, at + 1) >= 0) {
      throw new Error(`${label}: anchor is not unique: ${edit.label}`);
    }
    out = out.slice(0, at) + edit.replace + out.slice(at + edit.find.length);
    applied.push({ at, original: edit.find, replacement: edit.replace, label: edit.label });
  }

  return { out, applied };
}

/**
 * Confirms the result differs from its source only inside the edited regions.
 *
 * Reverses every edit from last to first, so each recorded offset is still
 * valid at the moment it is used. Splicing the originals back must reproduce the
 * source byte-for-byte.
 */
export function assertOnlyIntendedEdits(source, result, applied, label) {
  let rebuilt = result;

  for (const edit of [...applied].reverse()) {
    const current = rebuilt.slice(edit.at, edit.at + edit.replacement.length);
    if (current !== edit.replacement) {
      throw new Error(
        `${label}: could not reverse "${edit.label}" — expected ${JSON.stringify(edit.replacement)} ` +
          `at ${edit.at}, found ${JSON.stringify(current.slice(0, 60))}`,
      );
    }
    rebuilt = rebuilt.slice(0, edit.at) + edit.original + rebuilt.slice(edit.at + edit.replacement.length);
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
export function assertTokensYieldValidScript(template, tokens, label) {
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
