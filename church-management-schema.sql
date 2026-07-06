-- ============================================================
-- ADPEL Digital - Gestao da Igreja
-- Execute este SQL no Supabase SQL Editor.
-- Ele cria as tabelas novas e amplia certificates sem apagar dados.
-- ============================================================

create extension if not exists pgcrypto;

-- Helper administrativo usado pelas policies.
create or replace function public.is_admin_master()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'master'
  )
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'master@adpel.com';
$$;

-- ------------------------------------------------------------
-- Membros
-- ------------------------------------------------------------
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  birth_date date,
  phone text,
  email text,
  address text,
  entry_date date,
  status text not null default 'ativo',
  role text not null default 'membro',
  baptized boolean not null default false,
  baptism_date date,
  notes text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint members_status_check check (status in ('ativo', 'afastado', 'transferido', 'falecido', 'removido')),
  constraint members_role_check check (role in ('visitante', 'membro', 'obreiro', 'lider', 'pastor', 'crianca', 'jovem'))
);

alter table public.members enable row level security;

drop policy if exists "members_admin_select" on public.members;
drop policy if exists "members_admin_insert" on public.members;
drop policy if exists "members_admin_update" on public.members;
drop policy if exists "members_admin_delete" on public.members;

create policy "members_admin_select"
  on public.members for select
  to authenticated
  using (public.is_admin_master());

create policy "members_admin_insert"
  on public.members for insert
  to authenticated
  with check (public.is_admin_master());

create policy "members_admin_update"
  on public.members for update
  to authenticated
  using (public.is_admin_master())
  with check (public.is_admin_master());

-- Sem delete definitivo pelo app. A policy abaixo bloqueia exclusoes.
create policy "members_admin_delete"
  on public.members for delete
  to authenticated
  using (false);

create index if not exists members_status_idx on public.members(status);
create index if not exists members_birth_date_idx on public.members(birth_date);
create index if not exists members_full_name_idx on public.members using gin (to_tsvector('portuguese', coalesce(full_name, '')));

-- ------------------------------------------------------------
-- Movimentacoes de membros
-- ------------------------------------------------------------
create table if not exists public.member_movements (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  movement_type text not null,
  movement_date date not null default current_date,
  reason text,
  responsible text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint member_movements_type_check check (movement_type in ('entrada', 'saida', 'transferencia', 'retorno', 'afastamento', 'falecimento', 'outro'))
);

alter table public.member_movements enable row level security;

drop policy if exists "member_movements_admin_select" on public.member_movements;
drop policy if exists "member_movements_admin_insert" on public.member_movements;
drop policy if exists "member_movements_admin_update" on public.member_movements;
drop policy if exists "member_movements_admin_delete" on public.member_movements;

create policy "member_movements_admin_select"
  on public.member_movements for select
  to authenticated
  using (public.is_admin_master());

create policy "member_movements_admin_insert"
  on public.member_movements for insert
  to authenticated
  with check (public.is_admin_master());

create policy "member_movements_admin_update"
  on public.member_movements for update
  to authenticated
  using (public.is_admin_master())
  with check (public.is_admin_master());

create policy "member_movements_admin_delete"
  on public.member_movements for delete
  to authenticated
  using (public.is_admin_master());

create index if not exists member_movements_member_idx on public.member_movements(member_id);
create index if not exists member_movements_date_idx on public.member_movements(movement_date);

-- ------------------------------------------------------------
-- Caixa
-- ------------------------------------------------------------
create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  category text not null,
  amount numeric(12, 2) not null,
  movement_date date not null default current_date,
  payment_method text,
  description text,
  receipt_url text,
  responsible text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint cash_movements_type_check check (type in ('entrada', 'saida')),
  constraint cash_movements_amount_positive check (amount > 0)
);

alter table public.cash_movements enable row level security;

drop policy if exists "cash_movements_admin_select" on public.cash_movements;
drop policy if exists "cash_movements_admin_insert" on public.cash_movements;
drop policy if exists "cash_movements_admin_update" on public.cash_movements;
drop policy if exists "cash_movements_admin_delete" on public.cash_movements;

create policy "cash_movements_admin_select"
  on public.cash_movements for select
  to authenticated
  using (public.is_admin_master());

create policy "cash_movements_admin_insert"
  on public.cash_movements for insert
  to authenticated
  with check (public.is_admin_master());

create policy "cash_movements_admin_update"
  on public.cash_movements for update
  to authenticated
  using (public.is_admin_master())
  with check (public.is_admin_master());

create policy "cash_movements_admin_delete"
  on public.cash_movements for delete
  to authenticated
  using (public.is_admin_master());

create index if not exists cash_movements_date_idx on public.cash_movements(movement_date);
create index if not exists cash_movements_type_idx on public.cash_movements(type);
create index if not exists cash_movements_category_idx on public.cash_movements(category);

-- ------------------------------------------------------------
-- Certificados administrativos
-- A tabela certificates ja existe no projeto para cursos.
-- Estas colunas permitem salvar tipos novos sem quebrar o fluxo antigo.
-- ------------------------------------------------------------
alter table public.certificates
  add column if not exists member_id uuid references public.members(id) on delete set null,
  add column if not exists certificate_type text,
  add column if not exists issued_at timestamptz not null default now(),
  add column if not exists issued_by uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'certificates_certificate_type_check'
  ) then
    alter table public.certificates
      add constraint certificates_certificate_type_check
      check (
        certificate_type is null
        or certificate_type in ('batismo', 'apresentacao_bebe', 'curso', 'participacao', 'membro')
      );
  end if;
end $$;

create index if not exists certificates_certificate_type_idx on public.certificates(certificate_type);
create index if not exists certificates_member_id_idx on public.certificates(member_id);

-- Observacao: o schema antigo possui policies permissivas em certificates.
-- Para producao, revise/remova as policies antigas e mantenha escrita admin.

-- ------------------------------------------------------------
-- Auditoria
-- ------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  table_name text,
  record_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_admin_select" on public.audit_logs;
drop policy if exists "audit_logs_admin_insert" on public.audit_logs;
drop policy if exists "audit_logs_admin_update" on public.audit_logs;
drop policy if exists "audit_logs_admin_delete" on public.audit_logs;

create policy "audit_logs_admin_select"
  on public.audit_logs for select
  to authenticated
  using (public.is_admin_master());

create policy "audit_logs_admin_insert"
  on public.audit_logs for insert
  to authenticated
  with check (public.is_admin_master());

create policy "audit_logs_admin_update"
  on public.audit_logs for update
  to authenticated
  using (false);

create policy "audit_logs_admin_delete"
  on public.audit_logs for delete
  to authenticated
  using (false);

create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at);
create index if not exists audit_logs_table_record_idx on public.audit_logs(table_name, record_id);

-- ------------------------------------------------------------
-- Trigger simples para updated_at em members
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists members_set_updated_at on public.members;
create trigger members_set_updated_at
before update on public.members
for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
