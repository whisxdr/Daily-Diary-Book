/*
 * The shelf is the shelf. Every entry is one volume, and the volume's motif and
 * palette come from its mood, so the reader's own chronology renders as the
 * same designed object the packaged page ships with.
 *
 * The 3D scene lives in a sandboxed iframe, which means its canvas is not
 * reachable by keyboard or a screen reader. EntryList beside it is therefore not
 * a fallback — it is the accessible path to the same entries, and it stays
 * visible at every viewport width.
 */
import { useMemo, type ReactNode } from "react";
import { DiaryShelfPage } from "../shaders/landing-pages/LandingPages";
import { usePageBlob } from "../lib/usePageBlob";
import { toFallbackGrid, toShelfBook, escapeScriptJson } from "../lib/derive";
import type { DiaryEntry } from "../lib/types";
import { EntryList } from "./EntryList";

type ShelfViewProps = {
  entries: DiaryEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCompose: () => void;
  /** Storage controls, rendered under the list so the header stays one line. */
  storage?: ReactNode;
};

export function ShelfView({ entries, selectedId, onSelect, onCompose, storage }: ShelfViewProps) {
  const fill = useMemo(
    () => ({
      __DIARY_BOOKS__: escapeScriptJson(entries.map(toShelfBook)),
      __DIARY_FALLBACK__: toFallbackGrid(entries),
      __DIARY_FALLBACK_TITLE__: `${entries.length} volume${entries.length === 1 ? "" : "s"} of your own.`,
    }),
    [entries],
  );

  /*
   * The scene selects volume 0 on start, so an empty catalog throws inside its
   * own script and leaves the packaged "Codex" markup on screen. With nothing to
   * show there is nothing to render, and the 870 KB document is not worth
   * fetching either.
   */
  const { url, loading, error } = usePageBlob(entries.length ? "/landing-pages/shelf.template.html" : "", fill);
  const sceneReady = entries.length > 0 && url !== null;

  return (
    <div className="shelf-view">
      <div className="shelf-view__scene">
        {sceneReady ? (
          <DiaryShelfPage
            headingFont="iowan-old-style"
            bodyFont="inter"
            headingWeight={400}
            bodyWeight={400}
            primaryColor="#c87046"
            headingSize={60}
            bodySize={12}
            headingLetterSpacing={-0.055}
            sourceUrl={url}
          />
        ) : (
          <div className="shelf-view__placeholder" role="status">
            {entries.length === 0 ? (
              <>
                <p className="shelf-view__placeholder-title">Rak masih kosong</p>
                <p>
                  Setiap catatan menjadi satu volume di rak ini. Tulis yang pertama, lalu volume itu muncul di
                  sini dengan motif dan warnanya sendiri.
                </p>
              </>
            ) : error ? (
              `Rak gagal dimuat: ${error.message}`
            ) : (
              "Menyiapkan rak…"
            )}
          </div>
        )}
        {entries.length > 0 && loading ? <span className="sr-only">Memuat rak</span> : null}
      </div>

      <EntryList
        entries={entries}
        selectedId={selectedId}
        onSelect={onSelect}
        onCompose={onCompose}
        busy={loading && entries.length > 0}
        storage={storage}
      />
    </div>
  );
}
