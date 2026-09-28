const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const html = read('admin.html');
const importer = read('admin/member-import.js');
const exporter = read('admin/member-export.js');
const reports = read('admin/member-reports.js');
const migration = read('supabase/migrations/20260928155013_member_import_history.sql');

assert.match(html, /xlsx-0\.20\.3\/package\/dist\/xlsx\.full\.min\.js/);
assert.match(html, /jspdf@4\.2\.1\/dist\/jspdf\.umd\.min\.js/);
assert.match(html, /id="member-import-modal"/);
assert.match(html, /id="member-export-modal"/);
assert.match(html, /onclick="showMemberImport\(\)"/);
assert.match(html, /onclick="showMemberExport\(\)"/);
assert.match(html, /admin\/member-data-core\.js[\s\S]*admin\/member-import\.js[\s\S]*admin\/member-export\.js[\s\S]*admin\/member-reports\.js[\s\S]*admin\/church-management\.js/);

assert.match(importer, /BATCH_SIZE = 100/);
assert.match(importer, /PAGE_SIZE = 50/);
assert.match(importer, /\.from\('member_imports'\)/);
assert.match(importer, /\.from\('member_import_errors'\)/);
assert.match(importer, /members_bulk_imported/);
assert.doesNotMatch(importer, /auth\.admin|auth\.signUp|from\('profiles'\)/);

assert.match(exporter, /members_exported/);
assert.match(exporter, /neutralizeSpreadsheetCell/);
assert.match(exporter, /membros-adpel-/);

assert.match(reports, /Relatório geral de membros/);
assert.match(reports, /Lista de membros/);
assert.match(reports, /Aniversariantes/);
assert.doesNotMatch(reports, /member\.notes|notes:/);

assert.match(migration, /create table if not exists public\.member_imports/);
assert.match(migration, /create table if not exists public\.member_import_errors/);
assert.match(migration, /enable row level security/);
assert.match(migration, /public\.is_admin_master\(\)/);
assert.match(migration, /revoke all on table public\.members from anon, authenticated/);
assert.match(migration, /grant select, insert, update on table public\.members to authenticated/);
assert.doesNotMatch(migration, /grant all/);

console.log('member-migration-ui: all assertions passed');
