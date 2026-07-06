-- ADPEL - Perfil publico e bio do membro.

alter table public.profiles
  add column if not exists public_name text,
  add column if not exists bio text,
  add column if not exists avatar_url text,
  add column if not exists favorite_verse text,
  add column if not exists ministry text,
  add column if not exists phone text,
  add column if not exists instagram text,
  add column if not exists show_phone boolean default false,
  add column if not exists show_birth_date boolean default false,
  add column if not exists show_public_profile boolean default true,
  add column if not exists show_in_ranking boolean default true,
  add column if not exists updated_at timestamptz default now();

notify pgrst, 'reload schema';
