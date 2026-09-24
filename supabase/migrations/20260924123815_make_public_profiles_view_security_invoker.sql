-- Mantem a projecao publica segura sem deixar uma view SECURITY DEFINER no
-- schema exposto. A funcao privilegiada fica em schema nao exposto e retorna
-- somente colunas publicas, com filtro e mascara aplicados no proprio corpo.

create schema if not exists adpel_private;

revoke all privileges on schema adpel_private from public;
grant usage on schema adpel_private to anon, authenticated;

create or replace function adpel_private.get_public_profiles()
returns table (
  id uuid,
  full_name text,
  public_name text,
  bio text,
  avatar_url text,
  favorite_verse text,
  ministry text,
  phone text,
  instagram text,
  show_phone boolean,
  show_public_profile boolean,
  show_in_ranking boolean
)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select
    profile.id,
    profile.full_name,
    profile.public_name,
    profile.bio,
    profile.avatar_url,
    profile.favorite_verse,
    profile.ministry,
    case when profile.show_phone is true then profile.phone else null end,
    profile.instagram,
    coalesce(profile.show_phone, false),
    coalesce(profile.show_public_profile, true),
    coalesce(profile.show_in_ranking, true)
  from public.profiles as profile
  where coalesce(profile.show_public_profile, true) is true;
$$;

revoke all privileges on function adpel_private.get_public_profiles()
  from public, anon, authenticated;
grant execute on function adpel_private.get_public_profiles()
  to anon, authenticated;

comment on function adpel_private.get_public_profiles() is
  'Fonte interna da projecao public_profiles; retorna apenas perfis publicos e mascara phone.';

create or replace view public.public_profiles
with (security_barrier = true, security_invoker = true)
as
select *
from adpel_private.get_public_profiles();

revoke all privileges on table public.public_profiles
  from public, anon, authenticated;
grant select on table public.public_profiles
  to anon, authenticated;

comment on view public.public_profiles is
  'View SECURITY INVOKER sobre funcao interna limitada; nao expoe a tabela profiles nem telefones ocultos.';

notify pgrst, 'reload schema';
