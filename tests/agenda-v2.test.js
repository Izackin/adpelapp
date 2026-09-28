const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const source = read('admin/crud-agenda.js');
const html = read('admin.html');
const admin = read('admin.js');
const migration = read('supabase/migrations/20260928160000_agenda_v2.sql');

const fields = {};
function field(value = '', checked = false) {
  return { value, checked, classList: { add() {}, remove() {} }, reset() {}, scrollIntoView() {} };
}
[
  'agenda-id', 'agenda-title', 'agenda-category', 'agenda-date', 'agenda-time',
  'agenda-end-date', 'agenda-end-time', 'agenda-location', 'agenda-maps-url',
  'agenda-description', 'agenda-image-url', 'agenda-published', 'agenda-active',
  'agenda-featured', 'agenda-form-container', 'agenda-form-title', 'agenda-form'
].forEach((id) => { fields[id] = field(); });
fields['agenda-form'].reset = () => {};

let inserted = null;
let updated = null;
let deletedId = null;
let audit = null;
let reloads = 0;
let confirmMessage = '';

const context = {
  console,
  URL,
  Blob,
  Date,
  encodeURIComponent,
  decodeURIComponent,
  confirm(message) { confirmMessage = message; return true; },
  document: {
    getElementById(id) { return fields[id] || null; },
    body: { classList: { add() {}, remove() {} }, appendChild() {} },
    createElement() { return { click() {}, remove() {} }; }
  },
  showToast() {},
  loadAllData: async () => { reloads += 1; },
  logChurchAudit: async (...args) => { audit = args; },
  agendaData: [],
  agendaAttendancesData: [],
  window: {
    supabaseClient: {
      from(table) {
        assert.equal(table, 'events');
        return {
          insert(data) {
            inserted = data;
            return { select() { return { single: async () => ({ data: { id: 'new-id' }, error: null }) }; } };
          },
          update(data) {
            updated = data;
            return { eq: async (column, id) => { assert.equal(column, 'id'); assert.ok(id); return { error: null }; } };
          },
          delete() {
            return { eq: async (column, id) => { assert.equal(column, 'id'); deletedId = id; return { error: null }; } };
          }
        };
      }
    }
  }
};
context.window.window = context.window;
vm.runInNewContext(source, context, { filename: 'admin/crud-agenda.js' });

const valid = {
  title: 'Culto', event_date: '2026-10-10', event_time: null,
  end_date: null, end_time: null, maps_url: null, image_url: null
};
assert.deepEqual(Array.from(context.validateAgendaData(valid)), []);
assert.match(context.validateAgendaData({ ...valid, title: '' })[0], /título/);
assert.match(context.validateAgendaData({ ...valid, event_date: '' })[0], /data inicial/);
assert.match(context.validateAgendaData({ ...valid, end_date: '2026-10-09' })[0], /data final/);
assert.match(context.validateAgendaData({ ...valid, event_time: '20:00', end_time: '19:00' })[0], /hora final/);
assert.deepEqual(Array.from(context.validateAgendaData({ ...valid, event_time: '20:00', end_date: '2026-10-11', end_time: '19:00' })), []);
assert.match(context.validateAgendaData({ ...valid, maps_url: 'javascript:alert(1)' })[0], /Google Maps/);
assert.match(context.validateAgendaData({ ...valid, image_url: 'arquivo-local' })[0], /imagem/);

const original = {
  id: 'event-1', title: 'Reunião', category: 'reuniao', description: 'Descrição',
  image_url: 'https://example.com/image.jpg', event_date: '2026-10-10', event_time: '19:00',
  end_date: '2026-10-10', end_time: '20:00', location: 'Templo', maps_url: 'https://maps.google.com/',
  is_published: false, is_active: true, is_featured: true, source: 'google',
  external_event_id: 'external-1', external_calendar_id: 'calendar-1', created_at: 'ignored'
};
const copy = context.agendaDuplicateDraft(original);
assert.equal(copy.id, '');
assert.equal(copy.title, original.title);
assert.equal(copy.is_featured, true);
assert.equal(copy.source, 'manual');
assert.equal(copy.external_event_id, null);
assert.equal(copy.external_calendar_id, null);
assert.equal(Object.hasOwn(copy, 'created_at'), false);

const events = [
  { id: 'future-2', title: 'Culto B', location: 'Templo', event_date: '2026-10-10', category: 'culto', is_published: true, is_active: true },
  { id: 'past-1', title: 'Culto passado', location: 'Templo', event_date: '2026-09-20', category: 'culto', is_published: true, is_active: true },
  { id: 'future-1', title: 'Reunião Ágape', location: 'Sala 1', event_date: '2026-10-01', category: 'reuniao', is_published: false, is_active: false },
  { id: 'ongoing', title: 'Conferência', location: 'Auditório', event_date: '2026-09-27', end_date: '2026-09-29', category: 'evento', is_published: true, is_active: true }
];
assert.deepEqual(Array.from(context.filterAndSortAgenda(events, { period: 'upcoming' }, '2026-09-28')).map((item) => item.id), ['ongoing', 'future-1', 'future-2']);
assert.deepEqual(Array.from(context.filterAndSortAgenda(events, { period: 'past' }, '2026-09-28')).map((item) => item.id), ['past-1']);
assert.deepEqual(Array.from(context.filterAndSortAgenda(events, { period: 'upcoming', search: 'agape' }, '2026-09-28')).map((item) => item.id), ['future-1']);
assert.deepEqual(Array.from(context.filterAndSortAgenda(events, { period: 'all', publication: 'draft' }, '2026-09-28')).map((item) => item.id), ['future-1']);
assert.deepEqual(Array.from(context.filterAndSortAgenda(events, { period: 'all', active: 'inactive' }, '2026-09-28')).map((item) => item.id), ['future-1']);
assert.deepEqual(Array.from(context.filterAndSortAgenda(events, { period: 'all', category: 'evento' }, '2026-09-28')).map((item) => item.id), ['ongoing']);
assert.equal(context.agendaCsvCell('=CMD()'), '"\'=CMD()"');

async function exerciseCrud() {
  Object.assign(fields['agenda-title'], { value: 'Evento manual' });
  Object.assign(fields['agenda-category'], { value: 'evento' });
  Object.assign(fields['agenda-date'], { value: '2026-10-20' });
  Object.assign(fields['agenda-time'], { value: '' });
  Object.assign(fields['agenda-end-date'], { value: '2026-10-21' });
  Object.assign(fields['agenda-end-time'], { value: '' });
  Object.assign(fields['agenda-location'], { value: 'Templo' });
  Object.assign(fields['agenda-maps-url'], { value: 'https://maps.google.com/' });
  Object.assign(fields['agenda-description'], { value: 'Descrição' });
  Object.assign(fields['agenda-image-url'], { value: 'https://example.com/evento.jpg' });
  Object.assign(fields['agenda-published'], { checked: false });
  Object.assign(fields['agenda-active'], { checked: true });
  Object.assign(fields['agenda-featured'], { checked: true });
  fields['agenda-id'].value = '';
  await context.handleCreateAgenda({ preventDefault() {} });
  assert.equal(inserted.source, 'manual');
  assert.equal(inserted.is_published, false);
  assert.equal(inserted.is_active, true);
  assert.equal(inserted.is_featured, true);
  assert.equal(inserted.end_date, '2026-10-21');
  assert.equal(audit[0], 'event_created');

  fields['agenda-id'].value = 'event-1';
  fields['agenda-active'].checked = false;
  context.agendaData = [{ id: 'event-1', title: 'Evento manual', event_date: '2026-10-20', is_active: true }];
  await context.handleCreateAgenda({ preventDefault() {} });
  assert.equal(updated.is_active, false);
  assert.equal(Object.hasOwn(updated, 'source'), false);
  assert.equal(audit[0], 'event_deactivated');

  context.agendaAttendancesData = [{ id: 'a1', event_id: 'event-1', user_id: 'u1', user_name: 'Pessoa' }];
  await context.deleteAgenda('event-1');
  assert.equal(deletedId, 'event-1');
  assert.match(confirmMessage, /Prefira desativar/);
  assert.equal(audit[0], 'event_deleted');
  assert.equal(reloads, 3);
}

exerciseCrud().then(() => {
  assert.match(html, /id="agenda-end-date"/);
  assert.match(html, /id="agenda-end-time"/);
  assert.match(html, /id="agenda-image-url"/);
  assert.match(html, /id="agenda-active"/);
  assert.match(html, /id="agenda-featured"/);
  assert.match(html, /id="agenda-participants-modal"/);
  assert.match(admin, /Promise\.all\([\s\S]*event_attendances/);
  assert.match(migration, /add column if not exists end_date date/);
  assert.match(migration, /source text not null default 'manual'/);
  assert.match(migration, /check \(source in \('manual', 'google'\)\)/);
  assert.match(migration, /events_google_external_event_unique_idx/);
  assert.match(migration, /grant select, insert, delete on table public\.event_attendances to authenticated/);
  assert.doesNotMatch(source, /OAuth|syncToken|RRULE|webhook/);
  console.log('agenda-v2: all assertions passed');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
