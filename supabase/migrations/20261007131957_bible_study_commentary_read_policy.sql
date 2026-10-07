-- Separate roles so authenticated reads do not evaluate two permissive policies.
drop policy "Active Bible commentaries are public" on public.bible_commentaries;
drop policy "Master reads editorial drafts" on public.bible_commentaries;
create policy "Published commentaries are public" on public.bible_commentaries for select to anon
 using (is_active and exists(select 1 from public.bible_study_sources s where s.code=source_code and s.is_active));
create policy "Members read published or authorized draft commentaries" on public.bible_commentaries for select to authenticated
 using ((is_active and exists(select 1 from public.bible_study_sources s where s.code=source_code and s.is_active))
 or (source_code='adpel-editorial' and (select public.is_admin_master())));
notify pgrst,'reload schema';
