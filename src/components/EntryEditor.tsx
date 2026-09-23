/*
 * Writing surface for one entry. A dialog rather than a route: the shelf stays
 * mounted behind it, so closing returns to the same volume and camera position.
 *
 * Focus is trapped while open and Escape closes it. Autosave runs every 30s on
 * a dirty draft, and the explicit save stays the primary action.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MOODS, type DiaryDraft, type DiaryEntry } from "../lib/types";

type EntryEditorProps = {
  entry: DiaryEntry | null;
  onSave: (draft: DiaryDraft, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
};

const AUTOSAVE_MS = 30_000;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function draftFrom(entry: DiaryEntry | null): DiaryDraft {
  if (entry) {
    return {
      date: entry.date,
      title: entry.title,
      subtitle: entry.subtitle,
      body: entry.body,
      mood: entry.mood,
      tags: entry.tags,
    };
  }
  return { date: today(), title: "", subtitle: "", body: "", mood: "focus", tags: [] };
}

export function EntryEditor({ entry, onSave, onDelete, onClose }: EntryEditorProps) {
  const [draft, setDraft] = useState<DiaryDraft>(() => draftFrom(entry));
  const [tagText, setTagText] = useState(() => (entry?.tags ?? []).join(", "));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);

  const tags = useMemo(
    () =>
      tagText
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [tagText],
  );

  const update = useCallback(<K extends keyof DiaryDraft>(key: K, value: DiaryDraft[K]) => {
    dirtyRef.current = true;
    setDraft((previous) => ({ ...previous, [key]: value }));
  }, []);

  const save = useCallback(
    async (silent: boolean) => {
      if (saving) return;
      if (!draft.title.trim() && !draft.body.trim()) {
        if (!silent) setError("Judul atau isi harus diisi sebelum menyimpan.");
        return;
      }
      setSaving(true);
      setError(null);
      try {
        await onSave({ ...draft, tags }, entry?.id);
        dirtyRef.current = false;
        setStatus(silent ? "Tersimpan otomatis" : "Tersimpan");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Gagal menyimpan");
      } finally {
        setSaving(false);
      }
    },
    [draft, entry?.id, onSave, saving, tags],
  );

  // Autosave keeps a long writing session from being lost to a closed tab.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (dirtyRef.current) void save(true);
    }, AUTOSAVE_MS);
    return () => window.clearInterval(timer);
  }, [save]);

  // Escape closes, and Tab stays inside the dialog while it is open.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href]',
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
      <div
        className="editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
        ref={dialogRef}
      >
        <header className="editor__head">
          <h2 className="editor__title" id="editor-title">
            {entry ? "Ubah catatan" : "Catatan baru"}
          </h2>
          <button type="button" className="editor__close" onClick={onClose} aria-label="Tutup editor">
            Tutup
          </button>
        </header>

        <div className="editor__body">
          <label className="editor__field">
            <span>Tanggal</span>
            <input
              type="date"
              value={draft.date}
              onChange={(event) => update("date", event.target.value)}
            />
          </label>

          <label className="editor__field">
            <span>Judul</span>
            <input
              type="text"
              value={draft.title}
              maxLength={120}
              onChange={(event) => update("title", event.target.value)}
              placeholder="Judul volume"
            />
          </label>

          <label className="editor__field">
            <span>Subjudul</span>
            <input
              type="text"
              value={draft.subtitle}
              maxLength={120}
              onChange={(event) => update("subtitle", event.target.value)}
              placeholder="Satu baris yang merangkum hari ini"
            />
          </label>

          <label className="editor__field">
            <span>Suasana</span>
            <select value={draft.mood} onChange={(event) => update("mood", event.target.value)}>
              {MOODS.map((mood) => (
                <option key={mood.value} value={mood.value}>
                  {mood.label}
                </option>
              ))}
            </select>
          </label>

          <label className="editor__field editor__field--wide">
            <span>Tag</span>
            <input
              type="text"
              value={tagText}
              onChange={(event) => {
                dirtyRef.current = true;
                setTagText(event.target.value);
              }}
              placeholder="Pisahkan dengan koma"
            />
          </label>

          <label className="editor__field editor__field--wide">
            <span>Isi catatan</span>
            <textarea
              value={draft.body}
              rows={14}
              onChange={(event) => update("body", event.target.value)}
              placeholder="Tulis di sini. Pisahkan paragraf dengan satu baris kosong."
            />
          </label>
        </div>

        <footer className="editor__foot">
          <div className="editor__messages" role="status" aria-live="polite">
            {error ? <span className="editor__error">{error}</span> : status ? <span>{status}</span> : null}
          </div>
          <div className="editor__actions">
            {entry ? (
              <button
                type="button"
                className="editor__delete"
                onClick={async () => {
                  if (!window.confirm(`Hapus “${entry.title || "catatan ini"}”? Tindakan ini tidak bisa dibatalkan.`)) return;
                  setSaving(true);
                  try {
                    await onDelete(entry.id);
                  } catch (caught) {
                    setError(caught instanceof Error ? caught.message : "Gagal menghapus");
                    setSaving(false);
                  }
                }}
                disabled={saving}
              >
                Hapus
              </button>
            ) : null}
            <button type="button" className="editor__save" onClick={() => void save(false)} disabled={saving}>
              {saving ? "Menyimpan…" : "Simpan"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
