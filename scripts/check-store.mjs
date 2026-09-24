#!/usr/bin/env node
/*
 * Checks that importing a file cannot quietly damage what the reader already
 * has, and that a corrupt category list cannot take the shelf down.
 *
 * The hazard is specific and easy to reintroduce. `App.importAll` *replaces* the
 * reader's category list with whatever the imported file carries, and
 * `normalizeCategories` answers with the shipped seven whenever it cannot make
 * sense of its input. So the obvious test — "is `parsed.categories` an array?" —
 * accepts `[]`, `"nope"`, `[{nope: 1}]`, all of which normalize to the shipped
 * defaults. Importing a slightly-corrupt backup would then silently reset every
 * category name the reader had written and re-point every entry that used one:
 * no error, no crash, just their words replaced. The question has to be "did a
 * list actually survive normalization", which is what `importEntries` now asks.
 *
 * The second half is the local store's own resilience: a `localStorage` value
 * that is not a category list must render as the shipped defaults, because the
 * alternative is a blank shelf.
 *
 *   npm run check:store
 */
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/*
 * `store.ts` reads `import.meta.env` and constructs a Supabase client at module
 * scope. Two adjustments make it loadable here:
 *
 *   - `import.meta.env` is stubbed to an empty object, so `supabase` stays null
 *     and `activeStore` resolves to the local store.
 *   - `@supabase/supabase-js` is replaced by a stub that throws if a client is
 *     ever constructed. This check is about the local store — the one that has
 *     to work with no account, and whose category list is the reader's only
 *     copy — so bundling the real client would only slow it down. The throw
 *     makes it loud if a future change starts reaching for the cloud here.
 */
const stubSupabase = {
  name: "stub-supabase",
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({
      path: "supabase-stub",
      namespace: "stub",
    }));
    pluginBuild.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
      contents: `export const createClient = () => {
        throw new Error("check:store exercises the local store; the cloud client is not bundled here");
      };`,
      loader: "js",
    }));
  },
};

const bundled = await build({
  stdin: {
    contents: `export * from "./src/lib/store";\nexport * from "./src/lib/types";\n`,
    resolveDir: ROOT,
    sourcefile: "check-store-entry.ts",
    loader: "ts",
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "neutral",
  define: { "import.meta.env": "{}" },
  plugins: [stubSupabase],
  logLevel: "silent",
});

/*
 * A `localStorage` stand-in, installed before the bundle is imported so the
 * store finds it. Only the three methods the local store uses.
 */
const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
};

const lib = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);
const { DEFAULT_CATEGORIES, importEntries, activeStore, normalizeCategories } = lib;

/*
 * With no env configured, `cloudEnabled` is false, so this is the local store —
 * reached through the same selector the app uses rather than a private binding.
 */
const localStore = activeStore(false);

let failed = 0;
const fail = (label, message) => {
  failed++;
  console.log(`  FAIL  ${label}: ${message}`);
};

const file = (value) =>
  new File([typeof value === "string" ? value : JSON.stringify(value)], "backup.json", {
    type: "application/json",
  });

const CUSTOM = [
  { id: "life", label: "Life", motifKey: "orbits" },
  { id: "experiment", label: "Experiment", motifKey: "compass" },
];

const ENTRY = {
  id: "e1",
  date: "2026-09-22",
  title: "Cinta",
  subtitle: "Ingin ku mencintaimu",
  body: "Hari ini aku belajar mencintai hal kecil.",
  mood: "life",
  tags: [],
  createdAt: "2026-09-22T00:00:00.000Z",
  updatedAt: "2026-09-22T00:00:00.000Z",
};

// ------------------------------------------------------- what a file may carry

console.log("store.ts — import shapes\n");

/*
 * Both shapes the app has written: the bare array older exports produced, and
 * the `{version, categories, entries}` object this version does. The old shape
 * has no categories, which must read as "the file says nothing about them" —
 * `null` — rather than as "restore the defaults".
 */
{
  const legacy = await importEntries(file([ENTRY]));
  if (legacy.entries.length !== 1) fail("bare array", `read ${legacy.entries.length} entries, expected 1`);
  if (legacy.categories !== null) {
    fail("bare array", `reported categories from a file that has none: ${JSON.stringify(legacy.categories)}`);
  }

  const current = await importEntries(file({ version: 2, categories: CUSTOM, entries: [ENTRY] }));
  if (current.entries.length !== 1) fail("version 2", `read ${current.entries.length} entries, expected 1`);
  if (current.categories?.length !== 2) {
    fail("version 2", `read ${current.categories?.length} categories, expected 2`);
  }
  if (current.categories?.[0]?.label !== "Life") {
    fail("version 2", `first category is ${JSON.stringify(current.categories?.[0])}`);
  }
}

/*
 * The entries list itself. A file with no list is not an import at all, and the
 * caller shows the throw; entries that are not entries are dropped rather than
 * rendered as blanks.
 */
{
  for (const [label, value] of [
    ["no entries field", { version: 2, categories: CUSTOM }],
    ["entries is a string", { entries: "nope" }],
    ["entries is an object", { entries: { 0: ENTRY } }],
    ["null document", "null"],
    ["a bare number", "42"],
    ["a bare string", '"hello"'],
  ]) {
    let threw = false;
    try {
      await importEntries(file(value));
    } catch {
      threw = true;
    }
    if (!threw) fail(label, "was accepted as an import");
  }

  const mixed = await importEntries(
    file({ entries: [ENTRY, { title: "no id" }, { id: "x" }, null, "nope", 42] }),
  );
  if (mixed.entries.length !== 1) {
    fail("entries with junk", `kept ${mixed.entries.length} entries, expected only the 1 valid one`);
  }
}

// --------------------------------------- a corrupt list must not reset the reader

console.log("\nstore.ts — a corrupt list never replaces the reader's own\n");

/*
 * The regression this file exists for. Each value below is truthy or array-ish
 * enough that a naive check accepts it, while `normalizeCategories` returns the
 * shipped seven — which, if treated as the file's list, would overwrite the
 * reader's category names.
 */
const UNUSABLE = [
  ["a string", "nope"],
  ["an object", { life: "Life" }],
  ["an empty object", {}],
  ["an empty array", []],
  ["zero", 0],
  ["false", false],
  ["objects without ids", [{ nope: 1 }, { label: "Life" }]],
  ["null entries in the list", [null, undefined]],
  ["bare strings", ["life", "experiment"]],
  ["a numeric id", [{ id: 1, label: "Life", motifKey: "orbits" }]],
  ["an empty id", [{ id: "", label: "Life", motifKey: "orbits" }]],
];

for (const [label, value] of UNUSABLE) {
  // Establish the trap first: this is what a naive "is it an array" test would
  // have accepted as the reader's new list.
  const naive = Array.isArray(value) ? normalizeCategories(value) : null;
  if (naive && naive === DEFAULT_CATEGORIES && !Array.isArray(value)) {
    fail(label, "expected the naive path to be the trap, but normalizeCategories did not fall back");
  }

  const result = await importEntries(file({ version: 2, categories: value, entries: [ENTRY] }));
  if (result.categories !== null) {
    fail(
      label,
      `read as a category list: ${JSON.stringify(result.categories)?.slice(0, 80)} — this would reset the reader's names`,
    );
  }
}

/*
 * The same values, driven through the path `App.importAll` actually takes, with
 * the reader's own list already saved. This is the consequence rather than the
 * flag: their names are still there afterwards.
 */
{
  for (const [label, value] of UNUSABLE) {
    await localStore.saveCategories(CUSTOM);
    const result = await importEntries(file({ version: 2, categories: value, entries: [ENTRY] }));
    // Exactly what App.importAll does with the result.
    if (result.categories) await localStore.saveCategories(result.categories);
    const after = await localStore.listCategories();
    if (after.length !== 2 || after[0].label !== "Life" || after[1].label !== "Experiment") {
      fail(label, `the reader's own names did not survive: ${JSON.stringify(after)?.slice(0, 80)}`);
    }
  }
}

/*
 * And the other direction: a file that does carry a usable list must restore it,
 * or backups would not bring the reader's names back at all. Junk alongside real
 * categories is dropped, not fatal.
 */
{
  const one = await importEntries(file({ version: 2, categories: [CUSTOM[0]], entries: [ENTRY] }));
  if (one.categories?.length !== 1 || one.categories[0].label !== "Life") {
    fail("one valid category", `read ${JSON.stringify(one.categories)?.slice(0, 80)}`);
  }

  const mixed = await importEntries(
    file({ version: 2, categories: [CUSTOM[0], { nope: 1 }, "x", null, CUSTOM[1]], entries: [ENTRY] }),
  );
  if (mixed.categories?.length !== 2) {
    fail("valid categories with junk", `read ${mixed.categories?.length}, expected the 2 valid ones`);
  }

  /*
   * A file that exports the shipped defaults is a real list, not a fallback:
   * restoring it is harmless (it is what a new reader starts from), and treating
   * it as absent would be wrong for a file that means it.
   */
  const shipped = await importEntries(file({ version: 2, categories: DEFAULT_CATEGORIES, entries: [ENTRY] }));
  if (shipped.categories?.length !== DEFAULT_CATEGORIES.length) {
    fail("the shipped defaults", `read ${shipped.categories?.length}, expected ${DEFAULT_CATEGORIES.length}`);
  }

  /*
   * A whitespace-only id is deliberately *not* in UNUSABLE above. It is odd but
   * workable — the label is what the reader sees, and an entry naming that id
   * still resolves — whereas trimming the id would break exactly that link, since
   * an entry's `mood` would still hold the untrimmed value. So the check asserts
   * the property that matters instead: such a list is kept and still renders.
   */
  const spaced = await importEntries(
    file({ version: 2, categories: [{ id: "   ", label: "Life", motifKey: "orbits" }], entries: [ENTRY] }),
  );
  if (spaced.categories?.length !== 1) {
    fail("a whitespace id", `was dropped: read ${JSON.stringify(spaced.categories)}`);
  }
}

// ------------------------------------------------------------ the local store

console.log("\nstore.ts — the local store holds up\n");

{
  const saved = await localStore.save(
    { date: ENTRY.date, title: ENTRY.title, subtitle: ENTRY.subtitle, body: ENTRY.body, mood: "life", tags: [] },
  );
  const listed = await localStore.list();
  if (listed.length !== 1 || listed[0].id !== saved.id) {
    fail("save and list", `listed ${listed.length} entries`);
  }
  await localStore.remove(saved.id);
  if ((await localStore.list()).length !== 0) fail("remove", "the entry is still listed");

  // A corrupt value must render as the shipped defaults, not as a blank shelf.
  for (const [label, raw] of [
    ["not JSON", "{"],
    ["not a list", '"nope"'],
    ["a list of junk", "[1, 2, 3]"],
  ]) {
    memory.set("diary-book:categories", raw);
    const list = await localStore.listCategories();
    if (!Array.isArray(list) || list.length === 0) {
      fail(`listCategories with ${label}`, `returned ${JSON.stringify(list)}`);
    }
  }

  // No saved value at all is the first-run state, and must also render.
  memory.delete("diary-book:categories");
  const firstRun = await localStore.listCategories();
  if (firstRun.length !== DEFAULT_CATEGORIES.length) {
    fail("listCategories on first run", `returned ${firstRun.length} categories`);
  }

  // A saved list round-trips unchanged, ids and looks intact.
  await localStore.saveCategories(CUSTOM);
  const restored = await localStore.listCategories();
  if (JSON.stringify(restored) !== JSON.stringify(CUSTOM)) {
    fail("saveCategories round trip", `got ${JSON.stringify(restored)?.slice(0, 80)}`);
  }
}

if (failed) {
  console.log(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log("Importing a file cannot reset the reader's categories, and a corrupt list still renders.");
