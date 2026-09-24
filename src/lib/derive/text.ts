/*
 * Text and formatting shared by both derived pages: the roman numeral on a
 * spine, the one-line summary, the printed date, and the two escapers that keep
 * reader-written prose from breaking the generated markup.
 */

const ROMAN: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

export function toRoman(value: number): string {
  if (!Number.isFinite(value) || value < 1) return "I";
  let rest = Math.floor(value);
  let out = "";
  for (const [size, glyph] of ROMAN) {
    while (rest >= size) {
      out += glyph;
      rest -= size;
    }
  }
  return out;
}

/** First sentence, trimmed to a length that reads as a spine line. */
export function summarize(body: string, limit: number): string {
  const flat = body.replace(/\s+/g, " ").trim();
  if (!flat) return "";
  const sentence = flat.match(/^[^.!?]*[.!?]/);
  const candidate = (sentence ? sentence[0] : flat).trim();
  return candidate.length <= limit ? candidate : `${candidate.slice(0, limit - 1).trimEnd()}…`;
}

export function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escapes a value for embedding inside a `<script>` block. */
export function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
