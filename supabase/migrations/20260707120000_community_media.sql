alter table public.community_posts
  add column if not exists image_url text;

insert into storage.buckets (id, name, public)
values ('community-media', 'community-media', true)
on conflict (id) do update set public = true;

drop policy if exists "community_media_public_select" on storage.objects;
drop policy if exists "community_media_user_insert" on storage.objects;
drop policy if exists "community_media_user_update" on storage.objects;
drop policy if exists "community_media_user_delete" on storage.objects;

create policy "community_media_public_select"
on storage.objects for select
using (
  bucket_id = 'community-media'
);

create policy "community_media_user_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'community-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "community_media_user_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'community-media'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'community-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "community_media_user_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'community-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

notify pgrst, 'reload schema';
