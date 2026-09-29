const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const html = read('admin.html');
const core = read('admin.js');
const dashboard = read('admin/dashboard-v2.js');
const css = read('admin-ux.css');

assert.doesNotThrow(() => new Function(dashboard));

assert.ok(html.includes('src="admin/dashboard-v2.js"'));
assert.ok(html.includes('id="admin-dashboard-pendings"'));
assert.ok(html.includes('id="admin-dashboard-google"'));
assert.ok(html.includes('id="admin-dashboard-events"'));
assert.ok(html.includes('id="admin-dashboard-members"'));
assert.ok(html.includes('id="admin-dashboard-activity"'));
assert.ok(html.includes("adminDashboardQuickAction('member')"));
assert.ok(html.includes("adminDashboardQuickAction('notification')"));
assert.ok(html.includes('id="admin-view-verses"'));
assert.ok(html.includes("adminNavigateTo('verses')"));
assert.ok(html.includes('id="admin-verses-editor"'));
assert.ok(html.includes('Gestão da Igreja'));
assert.ok(html.includes('Atualizações do App'));
assert.ok(html.includes('Notificações Push'));

assert.ok(core.includes('await loadAdminDashboardData()'));
assert.ok(core.includes("view === 'home'"));
assert.ok(core.includes('renderAdminDashboardV2()'));

assert.ok(dashboard.includes(".from('audit_logs')"));
assert.ok(dashboard.includes(".from('member_imports')"));
assert.ok(dashboard.includes(".from('calendar_integrations')"));
assert.ok(dashboard.includes("select('status,calendar_name,last_synced_at,last_error,watch_expires_at,updated_at')"));
assert.ok(!dashboard.includes('refresh_token_secret_id'));
assert.ok(!dashboard.includes('.insert('));
assert.ok(!dashboard.includes('.update('));
assert.ok(!dashboard.includes('.delete('));
assert.ok(dashboard.includes('event.is_published !== true'));
assert.ok(dashboard.includes('course.is_published !== true'));
assert.ok(dashboard.includes('completed_with_errors'));
assert.ok(dashboard.includes('members_bulk_imported'));
assert.ok(dashboard.includes("'SET'"));
assert.ok(dashboard.includes('slice(0, 5)'));
assert.ok(!dashboard.includes('adminDashboardOpenVerseEditor'));

assert.ok(css.includes('.admin-v2-quick-actions'));
assert.ok(css.includes('.admin-v2-metrics'));
assert.ok(css.includes('.admin-v2-layout'));
assert.ok(css.includes('.admin-v2-hero--compact'));
assert.ok(css.includes('@media (max-width: 767px)'));

console.log('admin-dashboard-v2: all assertions passed');
