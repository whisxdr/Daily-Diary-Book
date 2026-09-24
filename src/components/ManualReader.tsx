/*
 * The Field Manuals page as a reader for the three most recent entries.
 *
 * The page opens on a grid of three cards and reveals one entry in its detail
 * panel when a card is clicked — that is the authored interaction, unchanged.
 * The cards and the `books` object behind the panel are generated from entries,
 * so the writing shown is the reader's own.
 *
 * Mounted only while it is open: the source document is 3.5 MB, and none of it
 * belongs on the shelf.
 */
import { useMemo } from "react";
import { DiaryManualPage } from "../shaders/landing-pages/LandingPages";
import { usePageBlob } from "../lib/usePageBlob";
import {
  escapeHtml,
  escapeScriptJson,
  manualKey,
  toManualBook,
  toManualCardCss,
  toManualCardMarkup,
} from "../lib/derive";
import type { Category, DiaryEntry } from "../lib/types";

type ManualReaderProps = {
  entries: DiaryEntry[];
  categories: Category[];
  onClose: () => void;
};

/** The page lays out three cards, so it reads the three newest entries. */
const CARD_COUNT = 3;

/*
 * The hero word is set at up to 325px and never wraps, so a full title would run
 * off the page. One word keeps the authored scale; longer titles fall back to
 * their first word, which is what the packaged page does too ("Agents").
 */
function heroWord(entry: DiaryEntry | undefined): string {
  if (!entry) return "Diary";
  const title = entry.title.trim();
  if (!title) return "Diary";
  const first = title.split(/\s+/)[0];
  return first.length <= 12 ? first : first.slice(0, 11);
}

export function ManualReader({ entries, categories, onClose }: ManualReaderProps) {
  const recent = useMemo(() => entries.slice(0, CARD_COUNT), [entries]);

  const fill = useMemo(() => {
    const cards = recent
      .map((entry, index) => toManualCardMarkup(entry, index, recent.length, categories))
      .join("\n        ");

    const books: Record<string, ReturnType<typeof toManualBook>> = {};
    for (const entry of recent) {
      books[manualKey(entry)] = toManualBook(entry, categories);
    }

    return {
      __DIARY_CARDS__: cards,
      __DIARY_CARD_CSS__: toManualCardCss(recent),
      __DIARY_MANUAL_BOOKS__: escapeScriptJson(books),
      __DIARY_HERO__: escapeHtml(heroWord(recent[0])),
    };
  }, [categories, recent]);

  const { url, error } = usePageBlob(recent.length ? "/landing-pages/manual.template.html" : "", fill);

  return (
    <div className="reader-scrim">
      <div className="reader">
        <div className="reader__bar">
          <p className="reader__label">
            Pembaca — {recent.length} catatan terbaru
          </p>
          <button type="button" className="reader__close" onClick={onClose}>
            Tutup pembaca
          </button>
        </div>
        <div className="reader__frame">
          {url ? (
            <DiaryManualPage
              headingFont="iowan-old-style"
              bodyFont="iowan-old-style"
              headingWeight={500}
              bodyWeight={400}
              primaryColor="#c3a47b"
              headingSize={325}
              bodySize={17}
              headingLetterSpacing={-0.085}
              sourceUrl={url}
            />
          ) : (
            <p className="reader__status" role="status">
              {error ? `Pembaca gagal dimuat: ${error.message}` : "Menyiapkan pembaca…"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
