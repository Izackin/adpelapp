-- ============================================================
-- ADPEL Digital - Schema & RLS para Supabase
-- Execute isto no SQL Editor do seu projeto Supabase
-- ============================================================

-- Extensão necessária (geralmente já habilitada no Supabase)
create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------
-- 1. PERFIS (extendendo auth.users)
-- -----------------------------------------------------------
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  role text default 'member',
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Perfis públicos visíveis para todos"
  on public.profiles for select using (true);

create policy "Usuários inserem próprio perfil"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Usuários atualizam próprio perfil"
  on public.profiles for update using (auth.uid() = id);

-- -----------------------------------------------------------
-- 2. CURSOS
-- -----------------------------------------------------------
create table if not exists public.courses (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  teacher_name text,
  category text,
  duration int,
  description text,
  thumbnail_url text,
  lessons jsonb default '[]',
  is_featured boolean default false,
  is_published boolean default true,
  certificate_title text,
  certificate_description text,
  created_at timestamptz default now()
);

alter table public.courses enable row level security;

create policy "Cursos - leitura pública"
  on public.courses for select to anon, authenticated using (true);
create policy "Cursos - inserção autenticada"
  on public.courses for insert to authenticated with check (true);
create policy "Cursos - atualização autenticada"
  on public.courses for update to authenticated using (true);
create policy "Cursos - exclusão autenticada"
  on public.courses for delete to authenticated using (true);

-- -----------------------------------------------------------
-- 3. ESTUDOS
-- -----------------------------------------------------------
create table if not exists public.studies (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  category text,
  description text,
  content text,
  cover_url text,
  lessons jsonb default '[]',
  file_url text,
  is_featured boolean default false,
  is_published boolean default true,
  created_at timestamptz default now()
);

alter table public.studies enable row level security;

create policy "Estudos - leitura pública"
  on public.studies for select to anon, authenticated using (true);
create policy "Estudos - inserção autenticada"
  on public.studies for insert to authenticated with check (true);
create policy "Estudos - atualização autenticada"
  on public.studies for update to authenticated using (true);
create policy "Estudos - exclusão autenticada"
  on public.studies for delete to authenticated using (true);

-- -----------------------------------------------------------
-- 4. BIBLIOTECA (file_data = base64 / data URL do arquivo)
-- -----------------------------------------------------------
create table if not exists public.library_books (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  author text,
  category text,
  image text,              -- URL da capa
  description text,
  file_data text,          -- base64 do PDF/DOC/DOCX
  is_featured boolean default false,
  is_published boolean default true,
  created_at timestamptz default now()
);

alter table public.library_books enable row level security;

create policy "Biblioteca - leitura pública"
  on public.library_books for select to anon, authenticated using (true);
create policy "Biblioteca - inserção autenticada"
  on public.library_books for insert to authenticated with check (true);
create policy "Biblioteca - atualização autenticada"
  on public.library_books for update to authenticated using (true);
create policy "Biblioteca - exclusão autenticada"
  on public.library_books for delete to authenticated using (true);

-- -----------------------------------------------------------
-- 5. AVISOS
-- -----------------------------------------------------------
create table if not exists public.announcements (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  priority text default 'normal',
  message text not null,
  link text,
  expiry date,
  is_published boolean default true,
  created_at timestamptz default now()
);

alter table public.announcements enable row level security;

create policy "Avisos - leitura pública"
  on public.announcements for select to anon, authenticated using (true);
create policy "Avisos - inserção autenticada"
  on public.announcements for insert to authenticated with check (true);
create policy "Avisos - atualização autenticada"
  on public.announcements for update to authenticated using (true);
create policy "Avisos - exclusão autenticada"
  on public.announcements for delete to authenticated using (true);

-- -----------------------------------------------------------
-- 6. AGENDA / EVENTOS
-- -----------------------------------------------------------
create table if not exists public.events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  category text,
  event_date date,
  event_time text,
  location text,
  maps_url text,
  description text,
  is_published boolean default true,
  created_at timestamptz default now()
);

alter table public.events enable row level security;

create policy "Eventos - leitura pública"
  on public.events for select to anon, authenticated using (true);
create policy "Eventos - inserção autenticada"
  on public.events for insert to authenticated with check (true);
create policy "Eventos - atualização autenticada"
  on public.events for update to authenticated using (true);
create policy "Eventos - exclusão autenticada"
  on public.events for delete to authenticated using (true);

-- -----------------------------------------------------------
-- 7. CERTIFICADOS
-- -----------------------------------------------------------
create table if not exists public.certificates (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade,
  course_id uuid references public.courses on delete set null,
  title text not null,
  description text,
  completed_at date,
  certificate_data jsonb default null,
  created_at timestamptz default now()
);

alter table public.certificates enable row level security;

create policy "Certificados - leitura pública"
  on public.certificates for select to anon, authenticated using (true);
create policy "Certificados - inserção autenticada"
  on public.certificates for insert to authenticated with check (true);
create policy "Certificados - atualização autenticada"
  on public.certificates for update to authenticated using (true);
create policy "Certificados - exclusão autenticada"
  on public.certificates for delete to authenticated using (true);

-- -----------------------------------------------------------
-- 8. SEÇÕES DA HOME
-- -----------------------------------------------------------
create table if not exists public.home_sections (
  id uuid default gen_random_uuid() primary key,
  title text,
  subtitle text,
  description text,
  image_url text,
  button_text text,
  button_link text,
  "order" int default 0,
  is_published boolean default true,
  created_at timestamptz default now()
);

alter table public.home_sections enable row level security;

create policy "Home - leitura pública"
  on public.home_sections for select to anon, authenticated using (true);
create policy "Home - inserção autenticada"
  on public.home_sections for insert to authenticated with check (true);
create policy "Home - atualização autenticada"
  on public.home_sections for update to authenticated using (true);
create policy "Home - exclusão autenticada"
  on public.home_sections for delete to authenticated using (true);

-- -----------------------------------------------------------
-- 9. BÍBLIA (Versículos)
-- -----------------------------------------------------------
create table if not exists public.bible_verses (
  id bigint generated always as identity primary key,
  book text not null,
  chapter integer not null,
  verse integer not null,
  text text not null,
  created_at timestamptz default now()
);

create index if not exists idx_bible_book on public.bible_verses(book);
create index if not exists idx_bible_chapter on public.bible_verses(chapter);
create index if not exists idx_bible_verse on public.bible_verses(verse);
create index if not exists idx_bible_text on public.bible_verses using gin(to_tsvector('portuguese', text));

alter table public.bible_verses enable row level security;

drop policy if exists "Biblia leitura pública" on public.bible_verses;
create policy "Biblia leitura pública"
  on public.bible_verses
  for select
  using (true);

-- -----------------------------------------------------------
-- 10. VERSÍCULO DO DIA
-- -----------------------------------------------------------
create table if not exists public.verse_of_day (
  id bigserial primary key,
  reference text not null,
  text text not null
);

alter table public.verse_of_day enable row level security;

create policy "Versiculo do Dia - leitura publica"
  on public.verse_of_day for select to anon, authenticated using (true);
create policy "Versiculo do Dia - insercao autenticada"
  on public.verse_of_day for insert to authenticated with check (true);
create policy "Versiculo do Dia - atualizacao autenticada"
  on public.verse_of_day for update to authenticated using (true);
create policy "Versiculo do Dia - exclusao autenticada"
  on public.verse_of_day for delete to authenticated using (true);