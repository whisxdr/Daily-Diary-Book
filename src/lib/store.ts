/*
 * One storage interface, two implementations. The Supabase one is used when the
 * project is configured; otherwise entries live in localStorage so the app is
 * fully usable offline and without an account.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DiaryEntry, DiaryDraft } from "./types";

const STORAGE_KEY = "diary-book:entries";
const LOCAL_OWNER = "local";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } }) : null;

/** True when a Supabase project is configured, which also enables sign-in. */
export const cloudEnabled = supabase !== null;

export type Store = {
  list: () => Promise<DiaryEntry[]>;
  save: (draft: DiaryDraft, id?: string) => Promise<DiaryEntry>;
  remove: (id: string) => Promise<void>;
};

function newId(): string {
  return crypto.randomUUID();
}

// ------------------------------------------------------------- local store

/*
 * ponytail: localStorage caps out around 5 MB, which is roughly a few thousand
 * entries of prose. Swap to IndexedDB if a reader ever approaches that; the
 * Store interface above is the only thing that has to change.
 */
const localStore: Store = {
  async list() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as DiaryEntry[]) : [];
    } catch {
      return [];
    }
  },
  async save(draft, id) {
    const entries = await localStore.list();
    const now = new Date().toISOString();
    const existing = id ? entries.find((entry) => entry.id === id) : undefined;
    const entry: DiaryEntry = {
      ...draft,
      id: existing?.id ?? newId(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const next = existing ? entries.map((item) => (item.id === entry.id ? entry : item)) : [...entries, entry];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return entry;
  },
  async remove(id) {
    const entries = await localStore.list();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.filter((entry) => entry.id !== id)));
  },
};

// ---------------------------------------------------------- supabase store

type EntryRow = {
  id: string;
  user_id: string;
  date: string;
  title: string;
  subtitle: string;
  body: string;
  mood: string;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
};

function fromRow(row: EntryRow): DiaryEntry {
  return {
    id: row.id,
    date: row.date,
    title: row.title,
    subtitle: row.subtitle,
    body: row.body,
    mood: row.mood,
    tags: row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const supabaseStore: Store = {
  async list() {
    const client = supabase;
    if (!client) return [];
    const { data, error } = await client
      .from("entries")
      .select("*")
      .order("date", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as EntryRow[]).map(fromRow);
  },
  async save(draft, id) {
    const client = supabase;
    if (!client) throw new Error("Supabase is not configured");
    const { data: userData } = await client.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) throw new Error("Sign in to save to the cloud");

    const payload = {
      date: draft.date,
      title: draft.title,
      subtitle: draft.subtitle,
      body: draft.body,
      mood: draft.mood,
      tags: draft.tags,
      updated_at: new Date().toISOString(),
    };

    if (id) {
      const { data, error } = await client.from("entries").update(payload).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      return fromRow(data as EntryRow);
    }
    const { data, error } = await client
      .from("entries")
      .insert({ ...payload, user_id: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return fromRow(data as EntryRow);
  },
  async remove(id) {
    const client = supabase;
    if (!client) throw new Error("Supabase is not configured");
    const { error } = await client.from("entries").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};

/** Entries the reader can see right now: the cloud when signed in, else local. */
export function activeStore(signedIn: boolean): Store {
  return cloudEnabled && signedIn ? supabaseStore : localStore;
}

export const localOwner = LOCAL_OWNER;

/** Downloads every entry as a JSON file, the escape hatch for local storage. */
export function exportEntries(entries: DiaryEntry[]): void {
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `diary-book-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Reads a previously exported file. Throws when the file is not an export. */
export async function importEntries(file: File): Promise<DiaryEntry[]> {
  const parsed = JSON.parse(await file.text());
  if (!Array.isArray(parsed)) throw new Error("File does not contain an entry list");
  return parsed.filter(
    (entry): entry is DiaryEntry =>
      typeof entry?.id === "string" && typeof entry?.title === "string" && typeof entry?.body === "string",
  );
}
