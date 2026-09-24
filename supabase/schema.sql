-- Diary Book — entries table, row-level security, and the four policies the
-- app relies on. Run this once in the Supabase SQL editor for your project.
--
-- Every row is scoped to its owner. The anon key ships in the browser bundle,
-- so these policies are the only thing standing between one reader's diary and
-- another's: without them, RLS-enabled tables return nothing, and with the
-- wrong predicate they would return everything.

create table if not exists public.entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null default current_date,
  title       text not null default '',
  subtitle    text not null default '',
  body        text not null default '',
  mood        text not null default 'focus',
  tags        text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- The list query orders by date, and every policy filters by user_id.
create index if not exists entries_user_date_idx on public.entries (user_id, date desc);

alter table public.entries enable row level security;

-- A reader may only ever touch rows they own. `with check` on insert and update
-- is what stops a client from writing a row attributed to someone else.
drop policy if exists "entries are readable by owner" on public.entries;
create policy "entries are readable by owner"
  on public.entries for select
  using (auth.uid() = user_id);

drop policy if exists "entries are insertable by owner" on public.entries;
create policy "entries are insertable by owner"
  on public.entries for insert
  with check (auth.uid() = user_id);

drop policy if exists "entries are updatable by owner" on public.entries;
create policy "entries are updatable by owner"
  on public.entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "entries are deletable by owner" on public.entries;
create policy "entries are deletable by owner"
  on public.entries for delete
  using (auth.uid() = user_id);

-- The reader's own category list: the labels they see and the look each one
-- wears. One row per reader, because the list is small, always read whole, and
-- always written whole.
--
-- Entries reference a category by its stable id in `entries.mood`, so renaming
-- a category is a write to this row alone — no entry is touched, and no entry
-- can be left pointing at a label that no longer exists. That is also why the
-- list is jsonb rather than a table of rows: a rename must not have to rewrite
-- every entry that names the category.
create table if not exists public.categories (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  list        jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.categories enable row level security;

drop policy if exists "categories are readable by owner" on public.categories;
create policy "categories are readable by owner"
  on public.categories for select
  using (auth.uid() = user_id);

drop policy if exists "categories are insertable by owner" on public.categories;
create policy "categories are insertable by owner"
  on public.categories for insert
  with check (auth.uid() = user_id);

-- One policy covers the upsert: the client writes the whole row, so update
-- needs the same predicate as insert.
drop policy if exists "categories are updatable by owner" on public.categories;
create policy "categories are updatable by owner"
  on public.categories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
