create or replace function public.retrieve_theological_context(
  query_embedding extensions.vector(384),
  retrieval_mode text default 'general_theology',
  match_count integer default 8,
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
  with candidates as (
    select
      c.id as chunk_id,
      d.id as document_id,
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
      (1 - (c.embedding <=> query_embedding))::double precision as similarity,
      case
        when retrieval_mode = 'doctrinal_position' then
          case
            when d.source_class in ('official_local','official_denominational') then 1
            when d.source_class = 'official_institutional' then 2
            when d.source_class = 'denominational_reference' then 3
            else 4
          end
        when retrieval_mode = 'pastoral' then
          case
            when d.source_class in ('official_local','official_denominational') then 1
            when d.source_class in ('official_institutional','denominational_reference') then 2
            else 3
          end
        when retrieval_mode = 'biblical_exegesis' then
          case
            when d.source_class in ('official_local','official_denominational') then 2
            when d.source_class = 'denominational_reference' then 3
            else 4
          end
        else 1
      end as source_priority
    from public.theological_chunks c
    join public.theological_documents d on d.id = c.document_id
    where d.active = true
      and c.embedding is not null
      and (1 - (c.embedding <=> query_embedding)) >= min_similarity
  )
  select *
  from candidates
  order by
    case
      when retrieval_mode in ('doctrinal_position','pastoral','biblical_exegesis')
        then source_priority
      else 1
    end asc,
    similarity desc,
    authority_level desc
  limit greatest(1, least(match_count, 20));
$$;

revoke all on function public.retrieve_theological_context(
  extensions.vector(384), text, integer, double precision
) from public, anon, authenticated;

grant execute on function public.retrieve_theological_context(
  extensions.vector(384), text, integer, double precision
) to service_role;
