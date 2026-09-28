const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const appNotifications = read('js/app-notifications.js');
const pushClient = read('notifications.js');
const serviceWorker = read('sw.js');
const migration = read('supabase/migrations/20260928131447_notification_center.sql');
const targetedEdge = read('supabase/functions/send-user-notification/index.ts');
const globalEdge = read('supabase/functions/send-notification/index.ts');
const admin = read('admin-notifications.js');
const auth = read('auth.js');

assert.match(appNotifications, /\.channel\('app-notifications-' \+ userId\)/);
assert.match(appNotifications, /table: 'app_notifications'/);
assert.match(appNotifications, /filter: 'recipient_id=eq\.' \+ userId/);
assert.match(appNotifications, /mergeRealtimeNotification\(payload\.new\)/);
assert.match(appNotifications, /removeChannel\(appNotificationsRealtimeChannel\)/);
assert.match(appNotifications, /setInterval\(loadUserNotifications, 60000\)/);
assert.match(appNotifications, /notification_post/);
assert.match(appNotifications, /community-post-highlight/);

assert.match(pushClient, /Notification\.permission !== 'default'/);
assert.match(pushClient, /onclick="requestPushPermission\(\)"/);
assert.match(pushClient, /await Notification\.requestPermission\(\)/);
assert.match(pushClient, /PUSH_PROMPT_RETRY_MS = 7 \* 24 \* 60 \* 60 \* 1000/);
assert.match(pushClient, /\.eq\('user_id', user\.id\)/);
assert.match(pushClient, /await subscription\.unsubscribe\(\)/);
assert.match(auth, /await removeCurrentPushSubscription\(\)/);

assert.match(serviceWorker, /notification_id: data\.notification_id/);
assert.match(serviceWorker, /await client\.navigate\(urlToOpen\)/);
assert.match(serviceWorker, /new URL\(client\.url\)\.origin === self\.location\.origin/);

assert.match(migration, /alter publication supabase_realtime add table public\.app_notifications/);
assert.match(migration, /grant update \(read_at\) on table public\.app_notifications to authenticated/);
assert.doesNotMatch(migration, /notifications_delete_own[\s\S]*create policy notifications_delete_own/);
assert.match(migration, /alter column user_id set not null/);
assert.match(migration, /on delete cascade/);
assert.match(migration, /vault\.create_secret/);
assert.match(migration, /x-adpel-webhook-secret/);
assert.match(migration, /exception[\s\S]*when others[\s\S]*return new/);

assert.match(targetedEdge, /rpc\("verify_notification_webhook_secret"/);
assert.match(targetedEdge, /\.eq\("id", notificationId\)/);
assert.match(targetedEdge, /\.eq\("user_id", notification\.recipient_id\)/);
assert.doesNotMatch(targetedEdge, /console\.(?:log|error)\([^\n]*(?:endpoint|webhookSecret|vapidPrivate)/);

assert.match(globalEdge, /profile\.role !== "master"/);
assert.match(globalEdge, /requestBody\.action === "stats"/);
assert.match(admin, /body: \{ action: 'stats' \}/);
assert.doesNotMatch(admin, /\.from\('push_subscriptions'\)/);

console.log('notification-center: all assertions passed');
