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
assert.match(html, /src="admin\/dashboard-v2\.js"/);
assert.match(html, /id="admin-dashboard-pendings"/);
assert.match(html, /id="admin-dashboard-google"/);
assert.match(html, /id="admin-dashboard-events"/);
assert.match(html, /id="admin-dashboard-members"/);
assert.match(html, /id="admin-dashboard-activity"/);
assert.match(html, /adminDashboardQuickAction\('member'\)/);
assert.match(html, /adminDashboardQuickAction\('notification'\)/);
assert.match(html, /adminDashboardOpenVerseEditor\(\)/);
assert.match(html, /id="admin-verses-editor"/);
assert.match(dashboard, /function adminDashboardOpenVerseEditor/);

assert.match(core, /await loadAdminDashboardData\(\)/);
assert.match(core, /view === 'home'[\s\S]*renderAdminDashboardV2/);

assert.match(dashboard, /from\('audit_logs'\)/);
assert.match(dashboard, /from\('member_imports'\)/);
assert.match(dashboard, /from\('calendar_integrations'\)/);
assert.match(dashboard, /select\('status,calendar_name,last_synced_at,last_error,watch_expires_at,updated_at'\)/);
assert.doesNotMatch(dashboard, /refresh_token_secret_id/);
assert.doesNotMatch(dashboard, /\.insert\(|\.update\(|\.delete\(/);
assert.match(dashboard, /event\.is_published !== true/);
assert.match(dashboard, /course\.is_published !== true/);
assert.match(dashboard, /completed_with_errors/);
assert.match(dashboard, /members_bulk_imported/);

assert.match(css, /\.admin-v2-quick-actions/);
assert.match(css, /\.admin-v2-metrics/);
assert.match(css, /\.admin-v2-layout/);
assert.match(css, /@media \(max-width: 767px\)/);

console.log('admin-dashboard-v2: all assertions passed');
