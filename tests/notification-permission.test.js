const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'notifications.js'), 'utf8');
const storage = new Map();
let permissionRequests = 0;
let promptsAdded = 0;

const notificationApi = {
  permission: 'default',
  async requestPermission() {
    permissionRequests += 1;
    return this.permission;
  }
};

const serviceWorker = {
  async getRegistration() { return {}; },
  async register() { return {}; },
  ready: Promise.resolve({
    pushManager: {
      async getSubscription() { return null; },
      async subscribe() { throw new Error('Não deve inscrever sem permissão concedida.'); }
    }
  })
};

const documentStub = {
  addEventListener() {},
  getElementById() { return null; },
  createElement() {
    return {
      setAttribute() {},
      remove() {},
      className: '',
      id: '',
      innerHTML: ''
    };
  },
  body: { appendChild() { promptsAdded += 1; } }
};

const windowStub = {
  PushManager: function PushManager() {},
  Notification: notificationApi,
  supabaseClient: null
};

const context = {
  console,
  Uint8Array,
  Date,
  Promise,
  window: windowStub,
  navigator: { serviceWorker },
  Notification: notificationApi,
  document: documentStub,
  localStorage: {
    getItem(key) { return storage.get(key) || null; },
    setItem(key, value) { storage.set(key, value); },
    removeItem(key) { storage.delete(key); }
  },
  getCurrentUserInfo() {
    return { isLoggedIn: true, user: { id: '11111111-1111-4111-8111-111111111111' } };
  },
  setTimeout() { return 1; },
  clearTimeout() {},
  atob,
  btoa
};

vm.runInNewContext(source, context, { filename: 'notifications.js' });

(async () => {
  const initial = await windowStub.initPushNotifications();
  assert.equal(initial.status, 'prompt_available');
  assert.equal(permissionRequests, 0, 'O carregamento não deve pedir permissão automaticamente.');

  notificationApi.permission = 'denied';
  const denied = await windowStub.requestPushPermission();
  assert.equal(denied.status, 'denied');
  assert.equal(permissionRequests, 1);
  windowStub.showPushPermissionPrompt();
  assert.equal(promptsAdded, 0, 'O convite não deve reaparecer com permissão negada.');

  notificationApi.permission = 'default';
  const dismissed = await windowStub.requestPushPermission();
  assert.equal(dismissed.status, 'dismissed');
  windowStub.showPushPermissionPrompt();
  assert.equal(promptsAdded, 0, 'O convite adiado não deve reaparecer imediatamente.');

  console.log('notification-permission: all assertions passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
