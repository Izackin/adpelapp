import assert from 'node:assert/strict';
import {
  buildPushPayload,
  deliverToSubscriptions,
  notificationTargetUrl,
  validateWebhookPayload
} from '../supabase/functions/send-user-notification/logic.ts';

const notification = {
  id: '11111111-1111-4111-8111-111111111111',
  recipient_id: '22222222-2222-4222-8222-222222222222',
  type: 'community_comment',
  title: 'Novo comentário',
  body: 'Ana comentou em sua publicação.',
  entity_type: 'community_post',
  entity_id: '33333333-3333-4333-8333-333333333333',
  url: '#community'
};

assert.equal(validateWebhookPayload({
  type: 'INSERT',
  schema: 'public',
  table: 'app_notifications',
  record: notification
}), notification.id);

for (const invalidPayload of [
  null,
  { type: 'UPDATE', schema: 'public', table: 'app_notifications', record: notification },
  { type: 'INSERT', schema: 'private', table: 'app_notifications', record: notification },
  { type: 'INSERT', schema: 'public', table: 'profiles', record: notification },
  { type: 'INSERT', schema: 'public', table: 'app_notifications', record: { id: 'not-a-uuid' } }
]) {
  assert.throws(() => validateWebhookPayload(invalidPayload));
}

assert.equal(
  notificationTargetUrl(notification),
  '/index.html?notification_post=33333333-3333-4333-8333-333333333333#community'
);
assert.equal(notificationTargetUrl({ ...notification, entity_type: 'course', entity_id: null, url: '#courses' }), '/index.html#courses');
assert.equal(notificationTargetUrl({ ...notification, entity_type: 'course', entity_id: null, url: 'https://evil.example' }), '/index.html');

const payload = buildPushPayload(notification);
assert.equal(payload.notification_id, notification.id);
assert.equal(payload.type, 'community_comment');
assert.equal(payload.entity_id, notification.entity_id);

const subscriptions = [
  { endpoint: 'https://push.example/device-a', p256dh: 'a', auth: 'a' },
  { endpoint: 'https://push.example/device-b', p256dh: 'b', auth: 'b' }
];
const deliveries = [];
const successful = await deliverToSubscriptions(
  subscriptions,
  payload,
  async (subscription, payloadText) => deliveries.push([subscription.endpoint, JSON.parse(payloadText)]),
  async () => assert.fail('Uma inscrição válida não deve ser removida.')
);
assert.deepEqual(successful, { sent: 2, failed: 0, removed: 0 });
assert.equal(deliveries.length, 2);
assert.equal(deliveries[0][1].notification_id, notification.id);

const removed = [];
const withExpiredEndpoint = await deliverToSubscriptions(
  subscriptions,
  payload,
  async (subscription) => {
    if (subscription.endpoint.endsWith('device-a')) throw { statusCode: 410 };
  },
  async (endpoint) => removed.push(endpoint)
);
assert.deepEqual(withExpiredEndpoint, { sent: 1, failed: 1, removed: 1 });
assert.deepEqual(removed, ['https://push.example/device-a']);

assert.deepEqual(
  await deliverToSubscriptions([], payload, async () => {}, async () => {}),
  { sent: 0, failed: 0, removed: 0 }
);

console.log('notification-edge-logic: all assertions passed');
