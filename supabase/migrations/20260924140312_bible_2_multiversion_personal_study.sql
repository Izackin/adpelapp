-- Bíblia ADPEL 2.0: catálogo multiversão, referências canônicas e dados pessoais.
-- A migration preserva integralmente o texto ACF existente.

create table if not exists public.bible_books (
  id text primary key,
  name_pt text not null unique,
  testament text not null check (testament in ('old', 'new')),
  book_order smallint not null unique check (book_order between 1 and 66),
  chapter_count smallint not null check (chapter_count > 0),
  aliases text[] not null default '{}'
);

insert into public.bible_books (id, name_pt, testament, book_order, chapter_count, aliases) values
('GEN','Gênesis','old',1,50,array['genesis','gn','gen']),('EXO','Êxodo','old',2,40,array['exodo','ex','exo']),
('LEV','Levítico','old',3,27,array['levitico','lv','lev']),('NUM','Números','old',4,36,array['numeros','nm','num']),
('DEU','Deuteronômio','old',5,34,array['deuteronomio','dt','deu']),('JOS','Josué','old',6,24,array['josue','js','jos']),
('JDG','Juízes','old',7,21,array['juizes','jz','jdg']),('RUT','Rute','old',8,4,array['rt','rut']),
('1SA','1 Samuel','old',9,31,array['1samuel','1 samuel','1sm','1sa']),('2SA','2 Samuel','old',10,24,array['2samuel','2 samuel','2sm','2sa']),
('1KI','1 Reis','old',11,22,array['1reis','1 reis','1rs','1ki']),('2KI','2 Reis','old',12,25,array['2reis','2 reis','2rs','2ki']),
('1CH','1 Crônicas','old',13,29,array['1cronicas','1 cronicas','1cr','1ch']),('2CH','2 Crônicas','old',14,36,array['2cronicas','2 cronicas','2cr','2ch']),
('EZR','Esdras','old',15,10,array['ed','ezr']),('NEH','Neemias','old',16,13,array['ne','neh']),
('EST','Ester','old',17,10,array['et','est']),('JOB','Jó','old',18,42,array['jo','job']),
('PSA','Salmos','old',19,150,array['salmo','sl','ps','psa']),('PRO','Provérbios','old',20,31,array['proverbios','pv','pro']),
('ECC','Eclesiastes','old',21,12,array['ec','ecc']),('SNG','Cantares','old',22,8,array['cantico dos canticos','ct','sng']),
('ISA','Isaías','old',23,66,array['isaias','is','isa']),('JER','Jeremias','old',24,52,array['jr','jer']),
('LAM','Lamentações','old',25,5,array['lamentacoes','lm','lam']),('EZK','Ezequiel','old',26,48,array['ez','ezk']),
('DAN','Daniel','old',27,12,array['dn','dan']),('HOS','Oseias','old',28,14,array['oseias','oséias','os','hos']),
('JOL','Joel','old',29,3,array['jl','jol']),('AMO','Amós','old',30,9,array['amos','am','amo']),
('OBA','Obadias','old',31,1,array['ob','oba']),('JON','Jonas','old',32,4,array['jnas','jon']),
('MIC','Miqueias','old',33,7,array['miqueias','miquéias','mq','mic']),('NAM','Naum','old',34,3,array['na','nam']),
('HAB','Habacuque','old',35,3,array['hc','hab']),('ZEP','Sofonias','old',36,3,array['sf','zep']),
('HAG','Ageu','old',37,2,array['ag','hag']),('ZEC','Zacarias','old',38,14,array['zc','zec']),
('MAL','Malaquias','old',39,4,array['ml','mal']),('MAT','Mateus','new',40,28,array['mt','mat']),
('MRK','Marcos','new',41,16,array['mc','mk','mrk']),('LUK','Lucas','new',42,24,array['lc','lk','luk']),
('JHN','João','new',43,21,array['joao','joão','jo','jn','john','jhn']),('ACT','Atos','new',44,28,array['atos dos apostolos','at','act']),
('ROM','Romanos','new',45,16,array['rm','rom']),('1CO','1 Coríntios','new',46,16,array['1corintios','1 corintios','1co']),
('2CO','2 Coríntios','new',47,13,array['2corintios','2 corintios','2co']),('GAL','Gálatas','new',48,6,array['galatas','gl','gal']),
('EPH','Efésios','new',49,6,array['efesios','ef','eph']),('PHP','Filipenses','new',50,4,array['fp','fl','php']),
('COL','Colossenses','new',51,4,array['cl','col']),('1TH','1 Tessalonicenses','new',52,5,array['1tessalonicenses','1 tessalonicenses','1ts','1th']),
('2TH','2 Tessalonicenses','new',53,3,array['2tessalonicenses','2 tessalonicenses','2ts','2th']),('1TI','1 Timóteo','new',54,6,array['1timoteo','1 timoteo','1tm','1ti']),
('2TI','2 Timóteo','new',55,4,array['2timoteo','2 timoteo','2tm','2ti']),('TIT','Tito','new',56,3,array['tt','tit']),
('PHM','Filemom','new',57,1,array['fm','phm']),('HEB','Hebreus','new',58,13,array['hb','heb']),
('JAS','Tiago','new',59,5,array['tg','jas']),('1PE','1 Pedro','new',60,5,array['1pedro','1 pedro','1pd','1pe']),
('2PE','2 Pedro','new',61,3,array['2pedro','2 pedro','2pd','2pe']),('1JN','1 João','new',62,5,array['1joao','1 joão','1jo','1jn']),
('2JN','2 João','new',63,1,array['2joao','2 joão','2jo','2jn']),('3JN','3 João','new',64,1,array['3joao','3 joão','3jo','3jn']),
('JUD','Judas','new',65,1,array['jd','jud']),('REV','Apocalipse','new',66,22,array['ap','apocalipse','revelacao','rev'])
on conflict (id) do update set
  name_pt = excluded.name_pt,
  testament = excluded.testament,
  book_order = excluded.book_order,
  chapter_count = excluded.chapter_count,
  aliases = excluded.aliases;

create table if not exists public.bible_translations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9][a-z0-9_-]*$'),
  name text not null,
  short_name text not null,
  language text not null default 'pt-BR',
  provider text not null,
  source_type text not null check (source_type in ('local', 'external')),
  license_type text not null,
  copyright_notice text,
  attribution text,
  source_url text check (source_url is null or source_url ~ '^https://'),
  is_active boolean not null default false,
  is_default boolean not null default false,
  is_local boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((source_type = 'local') = is_local)
);

create unique index if not exists bible_translations_one_default_idx
  on public.bible_translations (is_default) where is_default;

insert into public.bible_translations
  (code, name, short_name, language, provider, source_type, license_type,
   copyright_notice, attribution, is_active, is_default, is_local)
values
  ('acf', 'Almeida Corrigida Fiel', 'ACF', 'pt-BR', 'ADPEL', 'local', 'authorized',
   'Utilizada na ADPEL mediante autorização.', 'ADPEL', true, true, true)
on conflict (code) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  language = excluded.language,
  provider = excluded.provider,
  source_type = excluded.source_type,
  license_type = excluded.license_type,
  copyright_notice = excluded.copyright_notice,
  attribution = excluded.attribution,
  is_active = excluded.is_active,
  is_default = excluded.is_default,
  is_local = excluded.is_local,
  updated_at = now();

alter table public.bible_verses
  add column if not exists translation_id uuid,
  add column if not exists book_id text,
  add column if not exists is_canonical boolean not null default true;

update public.bible_verses
set translation_id = (select id from public.bible_translations where code = 'acf')
where translation_id is null;

update public.bible_verses v
set book_id = b.id
from public.bible_books b
where v.book_id is null and v.book = b.name_pt;

-- Três seeds históricos repetem referências do conjunto ACF completo. Todos os
-- textos são preservados; apenas a cópia antiga deixa de participar da leitura.
with ranked as (
  select id,
         row_number() over (
           partition by translation_id, book_id, chapter, verse
           order by created_at desc nulls last, id desc
         ) as position
  from public.bible_verses
)
update public.bible_verses v
set is_canonical = (ranked.position = 1)
from ranked
where ranked.id = v.id and v.is_canonical is distinct from (ranked.position = 1);

do $$
begin
  if exists (select 1 from public.bible_verses where translation_id is null or book_id is null) then
    raise exception 'Bíblia 2.0: existem versículos sem tradução ou livro canônico';
  end if;
  if (select count(*) from public.bible_books) <> 66 then
    raise exception 'Bíblia 2.0: catálogo canônico deve conter 66 livros';
  end if;
end
$$;

alter table public.bible_verses
  alter column translation_id set not null,
  alter column book_id set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bible_verses_translation_id_fkey') then
    alter table public.bible_verses add constraint bible_verses_translation_id_fkey
      foreign key (translation_id) references public.bible_translations(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bible_verses_book_id_fkey') then
    alter table public.bible_verses add constraint bible_verses_book_id_fkey
      foreign key (book_id) references public.bible_books(id);
  end if;
end
$$;

create unique index if not exists bible_verses_reference_variant_uidx
  on public.bible_verses (translation_id, book_id, chapter, verse, is_canonical);
create index if not exists bible_verses_chapter_lookup_idx
  on public.bible_verses (translation_id, book_id, chapter, verse)
  where is_canonical;

create table if not exists public.bible_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null references public.bible_books(id),
  chapter smallint not null check (chapter > 0),
  verse_start smallint not null check (verse_start > 0),
  verse_end smallint not null check (verse_end >= verse_start),
  color text not null check (color in ('yellow', 'green', 'blue', 'pink')),
  translation_code text references public.bible_translations(code) on update cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, book_id, chapter, verse_start, verse_end)
);

create table if not exists public.bible_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null references public.bible_books(id),
  chapter smallint not null check (chapter > 0),
  verse_start smallint not null check (verse_start > 0),
  verse_end smallint not null check (verse_end >= verse_start),
  translation_code text references public.bible_translations(code) on update cascade,
  content text not null check (char_length(btrim(content)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, book_id, chapter, verse_start, verse_end)
);

create table if not exists public.bible_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null references public.bible_books(id),
  chapter smallint not null check (chapter > 0),
  verse_start smallint not null check (verse_start > 0),
  verse_end smallint not null check (verse_end >= verse_start),
  translation_code text references public.bible_translations(code) on update cascade,
  created_at timestamptz not null default now(),
  unique (user_id, book_id, chapter, verse_start, verse_end)
);

create table if not exists public.bible_reading_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null references public.bible_books(id),
  chapter smallint not null check (chapter > 0),
  is_read boolean not null default true,
  first_read_at timestamptz not null default now(),
  read_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id, chapter)
);

create table if not exists public.bible_completed_books (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null references public.bible_books(id),
  first_completed_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

create table if not exists public.user_bible_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  translation_code text not null default 'acf' references public.bible_translations(code) on update cascade,
  font_size smallint not null default 18 check (font_size between 14 and 26),
  last_book text references public.bible_books(id),
  last_chapter smallint check (last_chapter is null or last_chapter > 0),
  last_verse smallint check (last_verse is null or last_verse > 0),
  updated_at timestamptz not null default now()
);

create schema if not exists adpel_private;

create or replace function adpel_private.set_bible_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function adpel_private.set_bible_updated_at() from public, anon, authenticated;

create or replace function adpel_private.validate_personal_bible_reference()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if not exists (
    select 1 from public.bible_verses
    where book_id = new.book_id and chapter = new.chapter and is_canonical and verse = new.verse_start
  ) or not exists (
    select 1 from public.bible_verses
    where book_id = new.book_id and chapter = new.chapter and is_canonical and verse = new.verse_end
  ) then
    raise exception 'Referência bíblica inválida';
  end if;
  return new;
end;
$$;
revoke all on function adpel_private.validate_personal_bible_reference() from public, anon, authenticated;

create or replace function adpel_private.validate_bible_chapter()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if not exists (
    select 1 from public.bible_books
    where id = new.book_id and new.chapter between 1 and chapter_count
  ) then
    raise exception 'Livro ou capítulo inválido';
  end if;
  return new;
end;
$$;
revoke all on function adpel_private.validate_bible_chapter() from public, anon, authenticated;

drop trigger if exists set_bible_translations_updated_at on public.bible_translations;
create trigger set_bible_translations_updated_at before update on public.bible_translations
for each row execute function adpel_private.set_bible_updated_at();
drop trigger if exists set_bible_highlights_updated_at on public.bible_highlights;
create trigger set_bible_highlights_updated_at before update on public.bible_highlights
for each row execute function adpel_private.set_bible_updated_at();
drop trigger if exists set_bible_notes_updated_at on public.bible_notes;
create trigger set_bible_notes_updated_at before update on public.bible_notes
for each row execute function adpel_private.set_bible_updated_at();
drop trigger if exists set_bible_reading_progress_updated_at on public.bible_reading_progress;
create trigger set_bible_reading_progress_updated_at before update on public.bible_reading_progress
for each row execute function adpel_private.set_bible_updated_at();
drop trigger if exists set_user_bible_preferences_updated_at on public.user_bible_preferences;
create trigger set_user_bible_preferences_updated_at before update on public.user_bible_preferences
for each row execute function adpel_private.set_bible_updated_at();

do $$
declare table_name text;
begin
  foreach table_name in array array['bible_highlights','bible_notes','bible_bookmarks'] loop
    execute format('drop trigger if exists validate_personal_bible_reference on public.%I', table_name);
    execute format(
      'create trigger validate_personal_bible_reference before insert or update on public.%I for each row execute function adpel_private.validate_personal_bible_reference()',
      table_name
    );
  end loop;
end
$$;
drop trigger if exists validate_bible_progress_chapter on public.bible_reading_progress;
create trigger validate_bible_progress_chapter before insert or update on public.bible_reading_progress
for each row execute function adpel_private.validate_bible_chapter();

alter table public.bible_books enable row level security;
alter table public.bible_translations enable row level security;
alter table public.bible_verses enable row level security;
alter table public.bible_highlights enable row level security;
alter table public.bible_notes enable row level security;
alter table public.bible_bookmarks enable row level security;
alter table public.bible_reading_progress enable row level security;
alter table public.bible_completed_books enable row level security;
alter table public.user_bible_preferences enable row level security;

drop policy if exists "Bible public read" on public.bible_verses;
drop policy if exists "Bíblia leitura pública" on public.bible_verses;
drop policy if exists "Leitura pública Bíblia" on public.bible_verses;
drop policy if exists "Active Bible verses are public" on public.bible_verses;
create policy "Active Bible verses are public" on public.bible_verses
for select to anon, authenticated
using (
  is_canonical and exists (
    select 1 from public.bible_translations t
    where t.id = translation_id and t.is_active
  )
);

drop policy if exists "Bible books are public" on public.bible_books;
create policy "Bible books are public" on public.bible_books
for select to anon, authenticated using (true);
drop policy if exists "Active Bible translations are public" on public.bible_translations;
create policy "Active Bible translations are public" on public.bible_translations
for select to anon, authenticated using (is_active);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'bible_highlights','bible_notes','bible_bookmarks','bible_reading_progress',
    'bible_completed_books','user_bible_preferences'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || ' owner access', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      table_name || ' owner access', table_name
    );
  end loop;
end
$$;

revoke all on public.bible_books, public.bible_translations, public.bible_verses
  from anon, authenticated;
grant select on public.bible_books, public.bible_translations, public.bible_verses
  to anon, authenticated;

revoke all on public.bible_highlights, public.bible_notes, public.bible_bookmarks,
  public.bible_reading_progress, public.bible_completed_books, public.user_bible_preferences
  from anon, authenticated;
grant select, insert, update, delete on public.bible_highlights, public.bible_notes,
  public.bible_bookmarks, public.bible_reading_progress, public.bible_completed_books,
  public.user_bible_preferences to authenticated;

grant all on public.bible_books, public.bible_translations, public.bible_verses,
  public.bible_highlights, public.bible_notes, public.bible_bookmarks,
  public.bible_reading_progress, public.bible_completed_books, public.user_bible_preferences
  to service_role;

notify pgrst, 'reload schema';
