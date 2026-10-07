create table if not exists public.bible_study_sources (
  code text primary key,
  name text not null,
  description text,
  source_url text,
  license_type text not null,
  attribution text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bible_lexicon_entries (
  id bigint generated always as identity primary key,
  source_code text not null references public.bible_study_sources(code) on update cascade on delete restrict,
  strong_number text not null,
  language text not null check (language in ('he','arc','grc')),
  lemma text not null,
  transliteration text,
  part_of_speech text,
  gloss_pt text,
  definition_short_pt text,
  definition_long_pt text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_code, strong_number)
);

create table if not exists public.bible_original_verses (
  id bigint generated always as identity primary key,
  source_code text not null references public.bible_study_sources(code) on update cascade on delete restrict,
  book_id text not null references public.bible_books(id) on update cascade on delete restrict,
  chapter smallint not null check (chapter > 0),
  verse smallint not null check (verse > 0),
  language text not null check (language in ('he','arc','grc')),
  text_original text not null,
  transliteration text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_code, book_id, chapter, verse)
);

create table if not exists public.bible_original_tokens (
  id bigint generated always as identity primary key,
  original_verse_id bigint not null references public.bible_original_verses(id) on delete cascade,
  token_position smallint not null check (token_position > 0),
  token_type text not null default 'word' check (token_type in ('word','punctuation')),
  surface text not null,
  normalized text,
  lemma text,
  transliteration text,
  strong_number text,
  lexicon_entry_id bigint references public.bible_lexicon_entries(id) on delete set null,
  morphology_code text,
  morphology_text_pt text,
  gloss_pt text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (original_verse_id, token_position)
);

create table if not exists public.bible_cross_references (
  id bigint generated always as identity primary key,
  source_code text not null references public.bible_study_sources(code) on update cascade on delete restrict,
  from_book_id text not null references public.bible_books(id) on update cascade on delete restrict,
  from_chapter smallint not null check (from_chapter > 0),
  from_verse smallint not null check (from_verse > 0),
  to_book_id text not null references public.bible_books(id) on update cascade on delete restrict,
  to_chapter smallint not null check (to_chapter > 0),
  to_verse smallint not null check (to_verse > 0),
  relation_type text not null default 'related',
  weight numeric(6,3),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_code, from_book_id, from_chapter, from_verse, to_book_id, to_chapter, to_verse)
);

create table if not exists public.bible_commentaries (
  id uuid primary key default gen_random_uuid(),
  source_code text not null references public.bible_study_sources(code) on update cascade on delete restrict,
  book_id text not null references public.bible_books(id) on update cascade on delete restrict,
  chapter smallint not null check (chapter > 0),
  verse_start smallint not null check (verse_start > 0),
  verse_end smallint not null check (verse_end >= verse_start),
  title text,
  content text not null,
  category text not null default 'expository',
  author_name text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bible_lexicon_strong on public.bible_lexicon_entries (strong_number);
create index if not exists idx_bible_lexicon_lemma on public.bible_lexicon_entries (lemma);
create index if not exists idx_bible_original_verses_location on public.bible_original_verses (book_id, chapter, verse);
create index if not exists idx_bible_original_tokens_verse on public.bible_original_tokens (original_verse_id, token_position);
create index if not exists idx_bible_original_tokens_strong on public.bible_original_tokens (strong_number);
create index if not exists idx_bible_original_tokens_lemma on public.bible_original_tokens (lemma);
create index if not exists idx_bible_cross_refs_from on public.bible_cross_references (from_book_id, from_chapter, from_verse);
create index if not exists idx_bible_cross_refs_to on public.bible_cross_references (to_book_id, to_chapter, to_verse);
create index if not exists idx_bible_commentaries_location on public.bible_commentaries (book_id, chapter, verse_start, verse_end) where is_active;

alter table public.bible_study_sources enable row level security;
alter table public.bible_lexicon_entries enable row level security;
alter table public.bible_original_verses enable row level security;
alter table public.bible_original_tokens enable row level security;
alter table public.bible_cross_references enable row level security;
alter table public.bible_commentaries enable row level security;

revoke all on table public.bible_study_sources from anon, authenticated;
revoke all on table public.bible_lexicon_entries from anon, authenticated;
revoke all on table public.bible_original_verses from anon, authenticated;
revoke all on table public.bible_original_tokens from anon, authenticated;
revoke all on table public.bible_cross_references from anon, authenticated;
revoke all on table public.bible_commentaries from anon, authenticated;

grant select on table public.bible_study_sources to anon, authenticated;
grant select on table public.bible_lexicon_entries to anon, authenticated;
grant select on table public.bible_original_verses to anon, authenticated;
grant select on table public.bible_original_tokens to anon, authenticated;
grant select on table public.bible_cross_references to anon, authenticated;
grant select on table public.bible_commentaries to anon, authenticated;

create policy "Active Bible study sources are public"
on public.bible_study_sources for select
to anon, authenticated
using (is_active);

create policy "Bible lexicon entries are public"
on public.bible_lexicon_entries for select
to anon, authenticated
using (exists (
  select 1 from public.bible_study_sources s
  where s.code = bible_lexicon_entries.source_code and s.is_active
));

create policy "Bible original verses are public"
on public.bible_original_verses for select
to anon, authenticated
using (exists (
  select 1 from public.bible_study_sources s
  where s.code = bible_original_verses.source_code and s.is_active
));

create policy "Bible original tokens are public"
on public.bible_original_tokens for select
to anon, authenticated
using (exists (
  select 1
  from public.bible_original_verses v
  join public.bible_study_sources s on s.code = v.source_code
  where v.id = bible_original_tokens.original_verse_id and s.is_active
));

create policy "Bible cross references are public"
on public.bible_cross_references for select
to anon, authenticated
using (exists (
  select 1 from public.bible_study_sources s
  where s.code = bible_cross_references.source_code and s.is_active
));

create policy "Active Bible commentaries are public"
on public.bible_commentaries for select
to anon, authenticated
using (
  is_active and exists (
    select 1 from public.bible_study_sources s
    where s.code = bible_commentaries.source_code and s.is_active
  )
);

