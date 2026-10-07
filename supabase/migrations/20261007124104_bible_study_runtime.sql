-- Preserve Psalm superscriptions as verse 0, instead of silently dropping them.
alter table public.bible_original_verses drop constraint bible_original_verses_verse_check;
alter table public.bible_original_verses add constraint bible_original_verses_verse_check
  check (verse > 0 or (book_id = 'PSA' and verse = 0));

create table public.bible_morphology_codes (
  source_code text not null references public.bible_study_sources(code) on update cascade on delete restrict,
  language text not null check(language in ('grc','he','arc')),
  code text not null,
  description_en text not null,
  description_pt text not null,
  primary key(source_code,language,code)
);
alter table public.bible_morphology_codes enable row level security;
revoke all on public.bible_morphology_codes from anon,authenticated;
grant select on public.bible_morphology_codes to anon,authenticated;
grant all on public.bible_morphology_codes to service_role;
create policy "Active morphology codes are public" on public.bible_morphology_codes for select to anon,authenticated
  using(exists(select 1 from public.bible_study_sources s where s.code=source_code and s.is_active));

-- Only the current project's trusted master role may edit local commentary.
-- Global linguistic data remains read-only for every browser user.
grant insert,update,delete on public.bible_commentaries to authenticated;
create policy "Master reads editorial drafts" on public.bible_commentaries for select to authenticated
  using (source_code='adpel-editorial' and (select public.is_admin_master()));
create policy "Master inserts editorial commentary" on public.bible_commentaries for insert to authenticated
  with check (source_code='adpel-editorial' and (select public.is_admin_master()));
create policy "Master updates editorial commentary" on public.bible_commentaries for update to authenticated
  using (source_code='adpel-editorial' and (select public.is_admin_master()))
  with check (source_code='adpel-editorial' and (select public.is_admin_master()));
create policy "Master deletes editorial commentary" on public.bible_commentaries for delete to authenticated
  using (source_code='adpel-editorial' and (select public.is_admin_master()));

-- Remove duplicate indexes introduced in the study foundation only.
drop index public.idx_bible_original_tokens_verse;
drop index public.idx_bible_lexicon_strong;
notify pgrst,'reload schema';
