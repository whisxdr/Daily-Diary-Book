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
 * Deleting a category that entries still name moves them, and the move is
 * reported to `onSave` rather than left implicit. `findCategory` would keep
 * *rendering* those entries under the first category either way, but the stored
 * id would still name the deleted one: the counts beside each row would keep
 * crediting a category that no longer exists, so the dialog would under-report
 * on the next delete, and the entries would silently re-point if that id ever
 * came back. Moving them makes the promise in the confirm dialog true.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MOTIF_KEYS, newCategoryId, type Category, type MotifKey } from "../lib/types";

type CategoryManagerProps = {
  categories: Category[];
  /** How many entries currently name each category id, for the delete prompt. */
  counts: Record<string, number>;
  /**
   * Persists the list. `remap` is present when categories were deleted that
   * entries still named: those entries must be rewritten to `to`, or they stay
   * pointed at an id that no longer resolves.
   */
  onSave: (categories: Category[], remap?: { from: string[]; to: string }) => Promise<void>;
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
  /*
   * Ids deleted in this session that entries may still name. Kept as state
   * rather than derived from the draft, because a deleted id is indistinguishable
   * from one the reader simply never had — and rewriting entries for the latter
   * would be wrong.
   */
  const [remapped, setRemapped] = useState<string[]>([]);
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
   * entries storing an id that no longer resolves. `findCategory` would keep
   * rendering them under the first category, so nothing would look broken — but
   * the stored id would keep counting toward a category that is gone, and would
   * silently re-attach if that id ever returned. The reader is told what will
   * happen, and the ids are remembered here so `save` can rewrite the entries.
   */
  const remove = useCallback((category: Category) => {
    const used = counts[category.id] ?? 0;
    if (used > 0) {
      const message =
        `${used} catatan memakai “${category.label}”.\n\n` +
        `Catatan itu akan dipindahkan ke kategori pertama, bukan dihapus. Lanjutkan?`;
      if (!window.confirm(message)) return;
    }
    // The guard first, then the state writes. Recording the move inside the
    // `setDraft` updater would run it twice under StrictMode's double-invoke.
    if (draft.length <= 1) return;
    setDraft((previous) => previous.filter((item) => item.id !== category.id));
    setRemapped((ids) => (ids.includes(category.id) ? ids : [...ids, category.id]));
  }, [counts, draft.length]);

  const save = useCallback(async () => {
    const cleaned = draft.map((item) => ({ ...item, label: item.label.trim() || "Tanpa nama" }));
    // Deleted ids that entries still name; the destination is the first category
    // that survives, which is the one `findCategory` would have rendered them
    // under anyway.
    const stale = remapped.filter((id) => !cleaned.some((item) => item.id === id));
    setSaving(true);
    setError(null);
    try {
      await onSave(cleaned, stale.length && cleaned.length ? { from: stale, to: cleaned[0].id } : undefined);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal menyimpan kategori");
      setSaving(false);
    }
  }, [draft, onClose, onSave, remapped]);

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
      /*
       * The check is "is focus inside the dialog", not "is focus on the first or
       * last item". A browser blurs an element the moment it is disabled, so
       * removing the second-to-last category leaves focus on `<body>` — which
       * matches neither `first` nor `last`, and Tab would walk out of the modal
       * into the page behind it. Treating any focus outside the dialog as an
       * edge sends it back to the right end.
       */
      const active = document.activeElement;
      const inside = active instanceof HTMLElement && dialog.contains(active);
      if (event.shiftKey && (!inside || active === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!inside || active === last)) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener("keydown", onKeyDown);
    return () => dialog.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  /*
   * A click on the scrim closes, but not when there are unsaved edits: the cost
   * here is the whole list, and the footer is already telling the reader those
   * changes are pending. Closing on an accidental click would silently discard
   * every rename in the dialog — the same class of loss the delete prompt exists
   * to prevent. Escape still closes outright, because that is the deliberate key.
   */
  const closeFromScrim = useCallback(() => {
    if (dirty) return;
    onClose();
  }, [dirty, onClose]);

  return (
    <div className="editor-scrim" onPointerDown={(event) => event.target === event.currentTarget && closeFromScrim()}>
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
