/*
 * The shelf's accessible twin: the same entries as a real list of buttons, so
 * they can be reached by keyboard and announced by a screen reader. The 3D
 * canvas cannot do either — it is one bitmap inside a sandboxed frame.
 */
import { useMemo, useState, type ReactNode } from "react";
import { findCategory, type Category, type DiaryEntry } from "../lib/types";
import { lookColor, toRoman } from "../lib/derive";

type EntryListProps = {
  entries: DiaryEntry[];
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCompose: () => void;
  onManageCategories: () => void;
  busy?: boolean;
  storage?: ReactNode;
};

function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function EntryList({
  entries,
  categories,
  selectedId,
  onSelect,
  onCompose,
  onManageCategories,
  busy,
  storage,
}: EntryListProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter((entry) =>
      `${entry.title} ${entry.subtitle} ${entry.body} ${entry.tags.join(" ")}`.toLowerCase().includes(needle),
    );
  }, [entries, query]);

  return (
    <aside className="entry-list" aria-label="Daftar catatan">
      <div className="entry-list__head">
        <h2 className="entry-list__title">Catatan</h2>
        <div className="entry-list__head-actions">
          <button type="button" className="entry-list__categories" onClick={onManageCategories}>
            Kategori
          </button>
          <button type="button" className="entry-list__compose" onClick={onCompose}>
            Tulis baru
          </button>
        </div>
      </div>

      <label className="entry-list__search">
        <span className="entry-list__search-label">Cari catatan</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari judul, isi, atau tag"
        />
      </label>

      {busy ? <p className="entry-list__status" role="status">Menyiapkan rak…</p> : null}

      {entries.length === 0 ? (
        <p className="entry-list__status">
          Belum ada catatan. Tulis yang pertama, lalu catatan itu menjadi volume di rak.
        </p>
      ) : filtered.length === 0 ? (
        <p className="entry-list__status">Tidak ada catatan yang cocok dengan “{query}”.</p>
      ) : (
        <ul className="entry-list__items">
          {filtered.map((entry) => {
            const index = entries.indexOf(entry);
            const selected = entry.id === selectedId;
            const category = findCategory(categories, entry.mood);
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  className="entry-card"
                  aria-current={selected ? "true" : undefined}
                  onClick={() => onSelect(entry.id)}
                >
                  <span className="entry-card__roman">Volume {toRoman(index + 1)}</span>
                  <strong className="entry-card__title">{entry.title || "Tanpa judul"}</strong>
                  <span className="entry-card__meta">
                    <span className="entry-card__swatch" style={{ background: lookColor(category.motifKey) }} aria-hidden="true" />
                    {formatDate(entry.date)} · {category.label}
                  </span>
                  {entry.subtitle ? <span className="entry-card__subtitle">{entry.subtitle}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {storage ? <div className="entry-list__storage">{storage}</div> : null}
    </aside>
  );
}
