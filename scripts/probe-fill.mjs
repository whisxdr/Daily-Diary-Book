/*
 * Fills the shelf template exactly the way the app does, writes the result to
 * public/, and leaves it there so it can be opened over HTTP with the browser's
 * own console attached. This is a diagnostic only.
 */
import { readFileSync, writeFileSync } from "node:fs";

const template = readFileSync("public/landing-pages/shelf.template.html", "utf8");

const entry = {
  id: "probe-1",
  date: "2026-09-22",
  title: "Cinta",
  subtitle: "Ingin ku mencintaimu",
  body: "Hari ini aku belajar mencintai hal kecil.\n\nParagraf kedua.",
  mood: "focus",
  tags: ["cinta", "tenang"],
};

const PALETTE = {
  color: "#182a43",
  foil: "#c87046",
  label: "Ultramarine · bone · copper",
  palette: { paper: "#171a24", paperDeep: "#10131b", paperPale: "#f1eadf", ink: "#f4eee6", inkSoft: "#b9b4ae", wall: "#171a24", shelf: "#3a2118", shelfDark: "#1c0e0a", light: "#f4d7b9", fill: "#9fb3c9" },
};

const book = {
  id: `entry-${entry.id}`,
  title: entry.title,
  roman: "I",
  discipline: entry.subtitle,
  note: entry.body.split("\n")[0],
  deck: entry.body.replace(/\s+/g, " "),
  binding: "Focus · Ultramarine",
  format: "22 September 2026",
  theme: "Cinta · focus",
  motif: "Nested brackets",
  motifKey: "brackets",
  paletteLabel: PALETTE.label,
  color: PALETTE.color,
  foil: PALETTE.foil,
  palette: PALETTE.palette,
  width: 1.02,
  height: 1.58,
  depth: 0.26,
  chapters: entry.tags,
  seed: 12345,
};

const escapeScriptJson = (value) =>
  JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

const escapeHtml = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const fallback = `<div class="fallback__grid" aria-label="Rak catatan pribadi">
        <article class="fallback-book" style="--book-color:${PALETTE.color};--book-foil:${PALETTE.foil};--book-height:390px"><span>Volume I</span><strong>${escapeHtml(entry.title)}</strong></article>
      </div>`;

let filled = template
  .split("__DIARY_BOOKS__").join(escapeScriptJson([book]))
  .split("__DIARY_FALLBACK__").join(fallback)
  .split("__DIARY_FALLBACK_TITLE__").join("1 volume of your own.");

const leftover = filled.match(/__DIARY_[A-Z_]+__/);
if (leftover) throw new Error("token left unfilled: " + leftover[0]);

writeFileSync("public/landing-pages/_probe.html", filled, "utf8");
console.log("wrote public/landing-pages/_probe.html", filled.length, "chars");
