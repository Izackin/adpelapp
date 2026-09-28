-- Teste manual pós-migration. Toda escrita é revertida e não polui produção.
begin;

do $$
declare
  test_user_id uuid;
  test_import_id uuid;
begin
  select id into test_user_id from auth.users order by created_at limit 1;
  if test_user_id is null then
    raise exception 'Nenhum auth.users disponível para testar a FK created_by';
  end if;

  insert into public.member_imports (
    source, file_name, total_rows, valid_rows, imported_rows,
    skipped_rows, duplicate_rows, error_rows, status, created_by, metadata
  ) values (
    'generic', 'teste-transacional.csv', 3, 2, 1,
    1, 1, 1, 'completed_with_errors', test_user_id, '{"test": true}'::jsonb
  ) returning id into test_import_id;

  insert into public.member_import_errors (import_id, row_number, error_code, message)
  values (test_import_id, 2, 'invalid_email', 'E-mail inválido');

  if not exists (select 1 from public.member_imports where id = test_import_id) then
    raise exception 'Histórico de importação não foi persistido dentro da transação';
  end if;

  if not exists (select 1 from public.member_import_errors where import_id = test_import_id) then
    raise exception 'Erro de linha não foi persistido dentro da transação';
  end if;
end $$;

rollback;
