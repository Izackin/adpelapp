// notifications.js - Inscrição Push para PWA ADPEL
// Os usuários precisam ativar as notificações manualmente

// ⚠️ SUBSTITUA esta chave pela sua VAPID Public Key gerada
const VAPID_PUBLIC_KEY = 'BHEIiMKvGsyRkJUuEdmV7DjcQc10TQ-2TJYLRaDmfhneT-kaEPHV-JF-0-3uGc7Y0xIobi3N42NnDcGS-21-Rsc';

function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function ensureServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  return navigator.serviceWorker.register('sw.js');
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function initPushNotifications() {
  if (!isPushSupported()) {
    console.log('[Push] API não suportada neste navegador.');
    return;
  }
  try {
    await ensureServiceWorkerRegistration();
    const reg = await navigator.serviceWorker.ready;
    const existingSub = await reg.pushManager.getSubscription();
    if (existingSub) {
      await savePushSubscription(existingSub);
      console.log('[Push] Inscrição existente confirmada.');
    }
  } catch (err) {
    console.error('[Push] Erro ao verificar inscrição:', err);
  }
}

async function requestPushPermission() {
  if (!isPushSupported()) {
    if (typeof showToast === 'function') showToast('Seu dispositivo/navegador não suporta notificações push.', 'warning');
    return;
  }
  try {
    await ensureServiceWorkerRegistration();
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      if (typeof showToast === 'function') showToast('Permissão negada. Ative nas configurações do navegador se mudar de ideia.', 'info');
      return;
    }

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    await savePushSubscription(sub);
    if (typeof showToast === 'function') showToast('✅ Notificações ativadas! Você receberá avisos da ADPEL.', 'success');
  } catch (err) {
    console.error('[Push] Erro ao ativar notificações:', err);
    if (typeof showToast === 'function') showToast('Erro ao ativar notificações.', 'error');
  }
}

async function savePushSubscription(subscription) {
  if (!window.supabaseClient) return;
  try {
    const userInfo = (typeof getCurrentUserInfo === 'function') ? getCurrentUserInfo() : {};
    const userId = userInfo.user?.id || null;

    const subData = {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
      auth: arrayBufferToBase64(subscription.getKey('auth'))
    };

    const { error } = await window.supabaseClient
      .from('push_subscriptions')
      .upsert(subData, { onConflict: 'endpoint' });

    if (error) throw error;
  } catch (err) {
    console.error('[Push] Erro ao salvar subscrição:', err);
  }
}

// Inicializa silenciosamente após carregamento
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initPushNotifications, 2500);
});
