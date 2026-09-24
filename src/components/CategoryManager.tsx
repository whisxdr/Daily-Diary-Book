/*
 * The reader's own category list.
 *
 * A category is a label the reader owns plus one of the seven authored looks.
 * The label is theirs to rename, add, and delete; the looks are the app's,
 * because each one is a designed pairing of palette and cover artwork that the
 * shelf and the reader both render. That split is why this dialog edits a
 * `label` and only ever *picks* a `motifKey` — and why the id is never shown
 * or rewritten, so renaming cannot orphan an entry.
 *
 * Deleting a category asks where its entries should go first. Without that
 * step the entries would survive but silently re-point at the first category,
 * which reads as data loss even though nothing was lost.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MOTIF_KEYS, newCategoryId, type Category, type MotifKey } from "../lib/types";

type CategoryManagerProps = {
  categories: Category[];
  /** How many entries currently name each category id, for the delete prompt. */
  counts: Record<string, number>;
  onSave: (categories: Category[]) => Promise<void>;
  onClose: () => void;
};

/** Human names for the looks, so the picker reads as design rather than code. */
const LOOK_LABELS: Record<MotifKey, { name: string; blurb: string; swatch: string }> = {
  brackets: { name: "Ultramarine", blurb: "Bone · copper", swatch: "#182a43" },
  paths: { name: "Burnt orange", blurb: "Cream · burgundy", swatch: "#c24d24" },
  caret: { name: "Citron", blurb: "Ink · off-white", swatch: "#afc400" },
  orbits: { name: "Cobalt", blurb: "Sky · silver", swatch: "#1537a1" },
  modules: { name: "Vermilion", blurb: "Plum · blush", swatch: "#c83222" },
  frames: { name: "Coral", blurb: "Pink · oxblood", swatch: "#da3b2f" },
  compass: { name: "Icy cyan", blurb: "Navy · aluminum", swatch: "#78a7bd" },
};

export function CategoryManager({ categories, counts, onSave, onClose }: CategoryManagerProps) {
  const [draft, setDraft] = useState<Category[]>(() => categories.map((category) => ({ ...category })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(categories),
    [categories, draft],
  );

  const rename = useCallback((id: string, label: string) => {
    setDraft((previous) => previous.map((item) => (item.id === id ? { ...item, label } : item)));
  }, []);

  const relook = useCallback((id: string, motifKey: MotifKey) => {
    setDraft((previous) => previous.map((item) => (item.id === id ? { ...item, motifKey } : item)));
  }, []);

  const add = useCallback(() => {
    setDraft((previous) => {
      const label = "Kategori baru";
      // A fresh look, cycling so a new category does not silently duplicate the
      // previous one's artwork.
      const motifKey = MOTIF_KEYS[previous.length % MOTIF_KEYS.length];
      return [...previous, { id: newCategoryId(label), label, motifKey }];
    });
  }, []);

  /*
   * Removing a category the reader still has entries in would leave those
   * entries pointing at an id that no longer resolves. `findCategory` resolves
   * that to the first category rather than failing, but doing it silently looks
   * like the entries changed by themselves — so the reader is asked to pick a
   * destination and the dialog reports what moved.
   */
  const remove = useCallback((category: Category) => {
    const used = counts[category.id] ?? 0;
    if (used > 0) {
      const message =
        `${used} catatan memakai “${category.label}”.\n\n` +
        `Catatan itu akan dipindahkan ke kategori pertama, bukan dihapus. Lanjutkan?`;
      if (!window.confirm(message)) return;
    }
    setDraft((previous) => (previous.length <= 1 ? previous : previous.filter((item) => item.id !== category.id)));
  }, [counts]);

  const save = useCallback(async () => {
    const cleaned = draft.map((item) => ({ ...item, label: item.label.trim() || "Tanpa nama" }));
    setSaving(true);
    setError(null);
    try {
      await onSave(cleaned);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal menyimpan kategori");
      setSaving(false);
    }
  }, [draft, onClose, onSave]);

  // Escape closes, and Tab stays inside the dialog — the same contract as the
  // entry editor.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href]',
        ),
      );
    focusable()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener("keydown", onKeyDown);
    return () => dialog.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="editor-scrim" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="editor editor--categories" role="dialog" aria-modal="true" aria-labelledby="category-title" ref={dialogRef}>
        <header className="editor__head">
          <h2 className="editor__title" id="category-title">
            Kategori
          </h2>
          <button type="button" className="editor__close" onClick={onClose} aria-label="Tutup kategori">
            Tutup
          </button>
        </header>

        <div className="editor__body editor__body--categories">
          <p className="category__intro">
            Nama kategori bisa diubah bebas. Tampilan buku ditentukan oleh motif, jadi setiap kategori tetap punya
            warna dan gambar sampulnya sendiri.
          </p>

          <ul className="category__list">
            {draft.map((category) => {
              const used = counts[category.id] ?? 0;
              const look = LOOK_LABELS[category.motifKey];
              return (
                <li className="category__row" key={category.id}>
                  <span className="category__swatch" style={{ background: look.swatch }} aria-hidden="true" />

                  <label className="category__field">
                    <span className="sr-only">Nama kategori</span>
                    <input
                      type="text"
                      value={category.label}
                      maxLength={40}
                      onChange={(event) => rename(category.id, event.target.value)}
                    />
                  </label>

                  <label className="category__look">
                    <span className="sr-only">Motif untuk {category.label}</span>
                    <select
                      value={category.motifKey}
                      onChange={(event) => relook(category.id, event.target.value as MotifKey)}
                    >
                      {MOTIF_KEYS.map((key) => (
                        <option key={key} value={key}>
                          {LOOK_LABELS[key].name} — {LOOK_LABELS[key].blurb}
                        </option>
                      ))}
                    </select>
                  </label>

                  <span className="category__count">{used ? `${used} catatan` : "kosong"}</span>

                  <button
                    type="button"
                    className="category__remove"
                    onClick={() => remove(category)}
                    disabled={draft.length <= 1}
                    aria-label={`Hapus kategori ${category.label}`}
                  >
                    Hapus
                  </button>
                </li>
              );
            })}
          </ul>

          <button type="button" className="category__add" onClick={add}>
            Tambah kategori
          </button>
        </div>

        <footer className="editor__foot">
          <div className="editor__messages" role="status" aria-live="polite">
            {error ? (
              <span className="editor__error">{error}</span>
            ) : dirty ? (
              <span>Ada perubahan belum disimpan</span>
            ) : null}
          </div>
          <div className="editor__actions">
            <button type="button" className="editor__save" onClick={() => void save()} disabled={saving || !dirty}>
              {saving ? "Menyimpan…" : "Simpan kategori"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
