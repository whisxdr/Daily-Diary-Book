/*
 * One storage interface, two implementations. The Supabase one is used when the
 * project is configured; otherwise entries live in localStorage so the app is
 * fully usable offline and without an account.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_CATEGORIES,
  normalizeCategories,
  type Category,
  type DiaryEntry,
  type DiaryDraft,
} from "./types";

const STORAGE_KEY = "diary-book:entries";
const CATEGORY_KEY = "diary-book:categories";
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
  /**
   * The reader's category list. Categories are per-reader configuration rather
   * than per-entry data, so they are stored once and resolved by id at render
   * time. Returns the shipped defaults when nothing has been saved.
   */
  listCategories: () => Promise<Category[]>;
  saveCategories: (categories: Category[]) => Promise<void>;
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
  async listCategories() {
    const raw = localStorage.getItem(CATEGORY_KEY);
    if (!raw) return normalizeCategories(null);
    try {
      return normalizeCategories(JSON.parse(raw));
    } catch {
      // A corrupt value must not take the shelf down with it; the shipped
      // defaults are always a valid answer.
      return normalizeCategories(null);
    }
  },
  async saveCategories(categories) {
    localStorage.setItem(CATEGORY_KEY, JSON.stringify(categories));
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
  /*
   * Categories live in one row per reader, keyed by user_id, with the list held
   * as jsonb. A row per category would need its own ordering column and its own
   * policy set for no gain — the list is small, always read whole, and always
   * written whole.
   */
  async listCategories() {
    const client = supabase;
    if (!client) return normalizeCategories(null);
    const { data: userData } = await client.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return normalizeCategories(null);
    const { data, error } = await client
      .from("categories")
      .select("list")
      .eq("user_id", userId)
      .maybeSingle();
    // A missing row is the normal first-run state, not a failure: the shipped
    // defaults are what a reader starts from.
    if (error) return normalizeCategories(null);
    return normalizeCategories(data?.list);
  },
  async saveCategories(categories) {
    const client = supabase;
    if (!client) throw new Error("Supabase is not configured");
    const { data: userData } = await client.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) throw new Error("Sign in to save categories to the cloud");
    const { error } = await client
      .from("categories")
      .upsert({ user_id: userId, list: categories, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
  },
};

/** Entries the reader can see right now: the cloud when signed in, else local. */
export function activeStore(signedIn: boolean): Store {
  return cloudEnabled && signedIn ? supabaseStore : localStore;
}

export const localOwner = LOCAL_OWNER;

/**
 * Downloads every entry as a JSON file, the escape hatch for local storage.
 *
 * Categories are included so a backup restores the reader's own category names
 * and not just the entries that point at them. The file stays a plain array
 * when the list is the shipped default, so existing exports keep their shape.
 */
export function exportEntries(entries: DiaryEntry[], categories?: Category[]): void {
  const payload = categories ? { version: 2, categories, entries } : entries;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `diary-book-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export type ImportResult = {
  entries: DiaryEntry[];
  /** Present only when the file carried a category list. */
  categories: Category[] | null;
};

/**
 * Reads a previously exported file. Throws when the file is not an export.
 *
 * Accepts both shapes: the bare array older exports wrote, and the
 * `{version, categories, entries}` object this version writes.
 *
 * `categories` is `null` unless the file carried a list that actually yields
 * categories. That distinction matters because the caller *replaces* the
 * reader's list with whatever comes back, and `normalizeCategories` answers with
 * the shipped seven whenever it cannot make sense of its input. So a
 * truthy-but-unusable field — `"nope"`, `{}`, `[]`, `[{nope: 1}]` — would read as
 * a valid list of the defaults, and importing a slightly-corrupt file would
 * silently reset the reader's category names and re-point every entry that used
 * one. The test is therefore not "is it an array" but "did a list survive
 * normalization": only then does the file have categories worth restoring.
 */
export async function importEntries(file: File): Promise<ImportResult> {
  const parsed = JSON.parse(await file.text());
  const list = Array.isArray(parsed) ? parsed : parsed?.entries;
  if (!Array.isArray(list)) throw new Error("File does not contain an entry list");
  const entries = list.filter(
    (entry): entry is DiaryEntry =>
      typeof entry?.id === "string" && typeof entry?.title === "string" && typeof entry?.body === "string",
  );
  const rawCategories = Array.isArray(parsed) ? undefined : parsed?.categories;
  const restored = Array.isArray(rawCategories) ? normalizeCategories(rawCategories) : null;
  // `normalizeCategories` falls back to `DEFAULT_CATEGORIES` (the same array
  // instance) when it cannot use its input, so identity is what distinguishes a
  // real list from that fallback.
  const categories = restored && restored !== DEFAULT_CATEGORIES ? restored : null;
  return { entries, categories };
}
