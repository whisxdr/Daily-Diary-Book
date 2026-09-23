import { useCallback, useEffect, useMemo, useState } from "react";
import { ShelfView } from "./components/ShelfView";
import { EntryEditor } from "./components/EntryEditor";
import { ManualReader } from "./components/ManualReader";
import { AuthGate } from "./components/AuthGate";
import { activeStore, cloudEnabled, supabase } from "./lib/store";
import { sortEntries } from "./lib/derive";
import type { DiaryDraft, DiaryEntry } from "./lib/types";

export function App() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ entry: DiaryEntry | null } | null>(null);
  const [reading, setReading] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const store = useMemo(() => activeStore(email !== null), [email]);

  const refresh = useCallback(async () => {
    try {
      setEntries(sortEntries(await store.list()));
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
          selectedId={selectedId}
          onSelect={(id) => setEditing({ entry: entries.find((entry) => entry.id === id) ?? null })}
          onCompose={() => setEditing({ entry: null })}
          storage={
            <AuthGate
              entries={entries}
              email={email}
              onEntriesImported={async (imported) => {
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
              }}
            />
          }
        />
      </main>

      {editing ? (
        <EntryEditor
          entry={editing.entry}
          onSave={save}
          onDelete={remove}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {reading ? <ManualReader entries={entries} onClose={() => setReading(false)} /> : null}
    </div>
  );
}
