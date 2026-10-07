-- ADPEL Digital - histórico seguro de importações de membros.

create table if not exists public.member_imports (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'generic',
  file_name text not null,
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  imported_rows integer not null default 0,
  skipped_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  error_rows integer not null default 0,
  status text not null default 'pending',
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint member_imports_source_format_check
    check (source ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint member_imports_file_name_length_check
    check (char_length(file_name) between 1 and 255),
  constraint member_imports_status_check
    check (status in ('pending', 'processing', 'completed', 'completed_with_errors', 'failed')),
  constraint member_imports_counts_check
    check (
      total_rows >= 0 and valid_rows >= 0 and imported_rows >= 0
      and skipped_rows >= 0 and duplicate_rows >= 0 and error_rows >= 0
    ),
  constraint member_imports_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.member_import_errors (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.member_imports(id) on delete cascade,
  row_number integer not null,
  error_code text not null,
  message text not null,
  created_at timestamptz not null default now(),
  constraint member_import_errors_row_number_check check (row_number > 0),
  constraint member_import_errors_code_format_check
    check (error_code ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint member_import_errors_message_length_check
    check (char_length(message) between 1 and 500)
);

create index if not exists member_imports_created_at_idx
  on public.member_imports(created_at desc);
create index if not exists member_imports_created_by_idx
  on public.member_imports(created_by);
create index if not exists member_imports_status_idx
  on public.member_imports(status);
create index if not exists member_import_errors_import_id_idx
  on public.member_import_errors(import_id);

alter table public.member_imports enable row level security;
alter table public.member_import_errors enable row level security;

revoke all on table public.member_imports from anon, authenticated;
revoke all on table public.member_import_errors from anon, authenticated;
grant select, insert, update on table public.member_imports to authenticated;
grant select, insert on table public.member_import_errors to authenticated;

create policy member_imports_master_select
  on public.member_imports for select to authenticated
  using (public.is_admin_master());

create policy member_imports_master_insert
  on public.member_imports for insert to authenticated
  with check (
    public.is_admin_master()
    and created_by = (select auth.uid())
  );

create policy member_imports_master_update
  on public.member_imports for update to authenticated
  using (public.is_admin_master())
  with check (
    public.is_admin_master()
    and created_by = (select auth.uid())
  );

create policy member_import_errors_master_select
  on public.member_import_errors for select to authenticated
  using (public.is_admin_master());

create policy member_import_errors_master_insert
  on public.member_import_errors for insert to authenticated
  with check (
    public.is_admin_master()
    and exists (
      select 1
      from public.member_imports parent_import
      where parent_import.id = import_id
        and parent_import.created_by = (select auth.uid())
    )
  );

-- O cliente administrativo não precisa de DELETE/TRUNCATE/TRIGGER/REFERENCES
-- para manter o CRUD e executar importações em lote.
revoke all on table public.members from anon, authenticated;
grant select, insert, update on table public.members to authenticated;

comment on table public.member_imports is
  'Histórico consolidado de importações de membros, sem cópia das linhas pessoais do arquivo.';
comment on table public.member_import_errors is
  'Erros mínimos por linha para diagnóstico, sem armazenar os dados pessoais importados.';

notify pgrst, 'reload schema';
