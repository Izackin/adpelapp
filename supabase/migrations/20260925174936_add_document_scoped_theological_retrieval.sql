create or replace function public.match_document_theological_chunks(
  query_embedding extensions.vector(384),
  target_document_id uuid,
  match_count integer default 3,
  min_similarity double precision default 0.20
)
returns table (
  chunk_id bigint,
  document_id uuid,
  title text,
  institution text,
  document_type text,
  source_class text,
  authority_level smallint,
  section_title text,
  page_start integer,
  page_end integer,
  topic text,
  content text,
  similarity double precision,
  source_priority integer
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    c.id,
    d.id,
    d.title,
    d.institution,
    d.document_type,
    d.source_class,
    d.authority_level,
    c.section_title,
    c.page_start,
    c.page_end,
    c.topic,
    c.content,
    (1 - (c.embedding <=> query_embedding))::double precision,
    50
  from public.theological_chunks c
  join public.theological_documents d on d.id=c.document_id
  where d.active=true
    and d.id=target_document_id
    and c.embedding is not null
    and (1 - (c.embedding <=> query_embedding)) >= min_similarity
  order by c.embedding <=> query_embedding
  limit greatest(1, least(match_count, 6));
$$;

revoke all on function public.match_document_theological_chunks(
  extensions.vector(384), uuid, integer, double precision
) from public, anon, authenticated;

grant execute on function public.match_document_theological_chunks(
  extensions.vector(384), uuid, integer, double precision
) to service_role;
