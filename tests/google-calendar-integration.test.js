const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

async function run() {
  const logic = await import(pathToFileURL(path.join(root, 'supabase/functions/_shared/google-calendar-logic.mjs')).href);
  const allDay = logic.mapGoogleEvent({
    id: 'all-day-1',
    summary: 'Conferência',
    start: { date: '2026-10-10' },
    end: { date: '2026-10-13' }
  }, 'calendar@example.com', 'America/Sao_Paulo');
  assert.equal(allDay.event_date, '2026-10-10');
  assert.equal(allDay.end_date, '2026-10-12', 'Google usa fim exclusivo em eventos de dia inteiro');
  assert.equal(allDay.event_time, null);

  const timed = logic.mapGoogleEvent({
    id: 'timed-1',
    summary: 'Culto',
    start: { dateTime: '2026-10-10T22:00:00Z', timeZone: 'America/Sao_Paulo' },
    end: { dateTime: '2026-10-10T23:30:00Z', timeZone: 'America/Sao_Paulo' }
  }, 'calendar@example.com', 'America/Sao_Paulo');
  assert.equal(timed.event_date, '2026-10-10');
  assert.equal(timed.event_time, '19:00');
  assert.equal(timed.end_time, '20:30');
  assert.equal(timed.source, 'google');

  assert.deepEqual(logic.mapGoogleEvent({ id: 'cancelled-1', status: 'cancelled' }, 'cal', 'UTC'), {
    external_event_id: 'cancelled-1', cancelled: true
  });
  assert.equal(logic.mapGoogleEvent({ id: 'invalid', start: {} }, 'cal', 'UTC'), null);
  assert.equal(logic.previousIsoDate('2026-03-01'), '2026-02-28');

  const safe = logic.publicIntegration({
    id: 'integration-1', provider: 'google', calendar_id: 'cal', status: 'active',
    sync_token: 'must-not-leak', refresh_token_secret_id: 'must-not-leak', watch_token_hash: 'must-not-leak'
  });
  assert.equal(safe.calendar_id, 'cal');
  assert.equal(Object.hasOwn(safe, 'sync_token'), false);
  assert.equal(Object.hasOwn(safe, 'refresh_token_secret_id'), false);
  assert.equal(Object.hasOwn(safe, 'watch_token_hash'), false);

  const adminSource = read('admin/google-calendar.js');
  const calls = [];
  const panel = { innerHTML: '' };
  const context = {
    console,
    URLSearchParams,
    Date,
    confirm: () => true,
    document: {
      title: 'Admin',
      getElementById: (id) => id === 'google-calendar-panel' ? panel : null,
      addEventListener() {}
    },
    window: {
      escapeHtml: (value) => String(value),
      location: { search: '', pathname: '/admin.html', hash: '', assign() {} },
      history: { replaceState() {} },
      supabaseClient: {
        functions: {
          async invoke(name, options) {
            calls.push({ name, options });
            return { data: { integration: null }, error: null };
          }
        }
      }
    },
    setTimeout() {},
    showToast() {}
  };
  vm.runInNewContext(adminSource, context, { filename: 'admin/google-calendar.js' });
  await context.invokeGoogleCalendarFunction('google-calendar-api', { action: 'status' });
  assert.equal(calls[0].name, 'google-calendar-api');
  assert.equal(calls[0].options.body.action, 'status');
  assert.doesNotMatch(adminSource, /GOOGLE_CLIENT_SECRET|refresh_token|SERVICE_ROLE/);

  const html = read('admin.html');
  const migration = read('supabase/migrations/20260928183000_google_calendar_integration.sql');
  const cronMigration = read('supabase/migrations/20260928184500_google_calendar_watch_cron.sql');
  const shared = read('supabase/functions/_shared/google-calendar.ts');
  const webhook = read('supabase/functions/google-calendar-webhook/index.ts');
  const renew = read('supabase/functions/google-calendar-renew-watches/index.ts');
  assert.match(html, /id="google-calendar-panel"/);
  assert.match(html, /admin\/google-calendar\.js/);
  assert.match(migration, /create table if not exists public\.calendar_integrations/);
  assert.match(migration, /alter table public\.calendar_integrations enable row level security/);
  assert.match(migration, /public\.is_admin_master\(\)/);
  assert.match(migration, /vault\.create_secret/);
  assert.match(migration, /vault\.decrypted_secrets/);
  assert.match(migration, /grant execute on function public\.get_google_calendar_refresh_token\(uuid\)\s+to service_role/);
  assert.doesNotMatch(migration, /grant execute on function public\.get_google_calendar_refresh_token\(uuid\)\s+to (anon|authenticated)/);
  assert.match(shared, /calendar\.readonly/);
  assert.match(shared, /access_type: "offline"/);
  assert.match(shared, /include_granted_scopes: "true"/);
  assert.match(shared, /singleEvents: "true"/);
  assert.match(shared, /showDeleted: "true"/);
  assert.match(shared, /timeMin: ADPEL_SYNC_TIME_MIN/);
  assert.match(shared, /timeMax: ADPEL_SYNC_TIME_MAX/);
  assert.match(shared, /2026-10-01T00:00:00-03:00/);
  assert.match(shared, /2027-01-01T00:00:00-03:00/);
  assert.match(shared, /\.eq\("source", "google"\)/);
  assert.match(shared, /sync_token: null/);
  assert.doesNotMatch(shared, /params\.set\("syncToken"/);
  assert.match(webhook, /x-goog-channel-id/);
  assert.match(webhook, /x-goog-resource-id/);
  assert.match(webhook, /x-goog-channel-token/);
  assert.match(webhook, /EdgeRuntime\.waitUntil/);
  assert.match(cronMigration, /adpel_google_calendar_cron_secret/);
  assert.match(cronMigration, /0 \*\/6 \* \* \*/);
  assert.match(cronMigration, /google-calendar-renew-watches/);
  assert.match(renew, /verify_google_calendar_cron_secret/);
  assert.match(renew, /renewWatch/);
  console.log('google-calendar-integration: all assertions passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
