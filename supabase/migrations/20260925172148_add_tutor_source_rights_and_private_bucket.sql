alter table public.theological_documents
  add column if not exists rights_status text not null default 'unknown',
  add column if not exists rights_basis text,
  add column if not exists fulltext_rag_allowed boolean not null default false,
  add column if not exists production_allowed boolean not null default false,
  add column if not exists redistribution_allowed boolean not null default false,
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists content_checksum text,
  add column if not exists ingestion_status text not null default 'registered';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='theological_documents_rights_status_check'
  ) then
    alter table public.theological_documents
      add constraint theological_documents_rights_status_check
      check (rights_status in (
        'unknown','open_license','public_domain','licensed',
        'owner_authorized','restricted'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname='theological_documents_ingestion_status_check'
  ) then
    alter table public.theological_documents
      add constraint theological_documents_ingestion_status_check
      check (ingestion_status in (
        'registered','uploaded','extracting','chunked',
        'embedding','ready','error'
      ));
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tutor-sources',
  'tutor-sources',
  false,
  52428800,
  array['application/pdf']::text[]
)
on conflict (id) do update
set public=false,
    file_size_limit=52428800,
    allowed_mime_types=array['application/pdf']::text[];

comment on column public.theological_documents.rights_status is
'Status jurídico/operacional da fonte para uso no Tutor.';
comment on column public.theological_documents.fulltext_rag_allowed is
'Indica se o texto integral pode ser processado/indexado no RAG.';
comment on column public.theological_documents.production_allowed is
'Indica se a fonte pode participar do Tutor em produção.';
comment on column public.theological_documents.redistribution_allowed is
'Indica se o arquivo/texto pode ser redistribuído ao usuário final. Mantido falso por padrão.';
