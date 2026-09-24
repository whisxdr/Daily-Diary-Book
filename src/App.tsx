import { useCallback, useEffect, useMemo, useState } from "react";
import { ShelfView } from "./components/ShelfView";
import { EntryEditor } from "./components/EntryEditor";
import { CategoryManager } from "./components/CategoryManager";
import { ManualReader } from "./components/ManualReader";
import { AuthGate } from "./components/AuthGate";
import { activeStore, cloudEnabled, supabase, type ImportResult } from "./lib/store";
import { categoryCounts, sortEntries } from "./lib/derive";
import { normalizeCategories, type Category, type DiaryDraft, type DiaryEntry } from "./lib/types";

export function App() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>(() => normalizeCategories(null));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ entry: DiaryEntry | null } | null>(null);
  const [managingCategories, setManagingCategories] = useState(false);
  const [reading, setReading] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const store = useMemo(() => activeStore(email !== null), [email]);

  const refresh = useCallback(async () => {
    try {
      setEntries(sortEntries(await store.list()));
      setCategories(await store.listCategories());
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal memuat catatan");
    }
  }, [store]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const save = useCallback(
    async (draft: DiaryDraft, id?: string) => {
      const saved = await store.save(draft, id);
      await refresh();
      setSelectedId(saved.id);
    },
    [refresh, store],
  );

  const remove = useCallback(
    async (id: string) => {
      await store.remove(id);
      setSelectedId((current) => (current === id ? null : current));
      setEditing(null);
      await refresh();
    },
    [refresh, store],
  );

  /*
   * The one place the list enters state, so the invariant lives here: whatever a
   * caller hands over is normalized before it is stored or rendered. `Category`
   * already constrains `motifKey` at the type level, but this is the boundary a
   * future caller could cross with raw input, and normalizing here means the
   * guarantee does not depend on every path having remembered to do it.
   */
  const saveCategories = useCallback(
    async (next: Category[]) => {
      const clean = normalizeCategories(next);
      await store.saveCategories(clean);
      // The shelf renders from `categories`, so the list has to come back from
      // the store before the change is visible.
      setCategories(clean);
    },
    [store],
  );

  /*
   * An import replaces the reader's category list when the file carries one, so
   * a backup restores the names the entries point at. The entries themselves are
   * written one at a time through the active store, which is what assigns ids
   * when saving to the cloud.
   */
  const importAll = useCallback(
    async ({ entries: imported, categories: importedCategories }: ImportResult) => {
      if (importedCategories) {
        // Through `saveCategories`, so an imported list is normalized and stored
        // by the same path the dialog uses.
        await saveCategories(importedCategories);
      }
      for (const entry of imported) {
        await store.save(
          {
            date: entry.date,
            title: entry.title,
            subtitle: entry.subtitle,
            body: entry.body,
            mood: entry.mood,
            tags: entry.tags,
          },
          cloudEnabled && email ? undefined : entry.id,
        );
      }
      await refresh();
    },
    [email, refresh, saveCategories, store],
  );

  /** How many entries name each category, for the manager's delete prompt. */
  const counts = useMemo(() => categoryCounts(entries), [entries]);

  return (
    <div className="app">
      <header className="app__bar">
        <div className="app__brand">
          <h1 className="app__title">Diary Book</h1>
          <p className="app__tagline">Rak catatan pribadi</p>
        </div>
        <nav className="app__nav" aria-label="Aksi">
          <button type="button" className="app__action" onClick={() => setEditing({ entry: null })}>
            Tulis baru
          </button>
          <button type="button" className="app__action" onClick={() => setManagingCategories(true)}>
            Kategori
          </button>
          <button
            type="button"
            className="app__action"
            onClick={() => setReading(true)}
            disabled={entries.length === 0}
          >
            Buka pembaca
          </button>
        </nav>
      </header>

      {error ? (
        <p className="app__error" role="alert">
          {error}
        </p>
      ) : null}

      <main className="app__main">
        <ShelfView
          entries={entries}
          categories={categories}
          selectedId={selectedId}
          onSelect={(id) => setEditing({ entry: entries.find((entry) => entry.id === id) ?? null })}
          onCompose={() => setEditing({ entry: null })}
          onManageCategories={() => setManagingCategories(true)}
          storage={
            <AuthGate
              entries={entries}
              categories={categories}
              email={email}
              onEntriesImported={importAll}
            />
          }
        />
      </main>

      {editing ? (
        <EntryEditor
          entry={editing.entry}
          categories={categories}
          onSave={save}
          onDelete={remove}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {managingCategories ? (
        <CategoryManager
          categories={categories}
          counts={counts}
          onSave={saveCategories}
          onClose={() => setManagingCategories(false)}
        />
      ) : null}

      {reading ? <ManualReader entries={entries} categories={categories} onClose={() => setReading(false)} /> : null}
    </div>
  );
}
