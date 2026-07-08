// notifications.js - InscriÃ§Ã£o Push para PWA ADPEL
// Os usuÃ¡rios precisam ativar as notificaÃ§Ãµes manualmente

// âš ï¸ SUBSTITUA esta chave pela sua VAPID Public Key gerada
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
    if (typeof adpelDebugLog === 'function') adpelDebugLog('[Push] API nao suportada');
    return;
  }
  try {
    await ensureServiceWorkerRegistration();
    const reg = await navigator.serviceWorker.ready;
    const existingSub = await reg.pushManager.getSubscription();
    if (existingSub) {
      await savePushSubscription(existingSub);
      if (typeof adpelDebugLog === 'function') adpelDebugLog('[Push] Inscricao existente confirmada');
    }
  } catch (err) {
    console.error('[Push] Erro ao verificar inscriÃ§Ã£o:', err);
  }
}

async function requestPushPermission() {
  if (!isPushSupported()) {
    if (typeof showToast === 'function') showToast('Seu dispositivo/navegador nÃ£o suporta notificaÃ§Ãµes push.', 'warning');
    return;
  }
  const userInfo = (typeof getCurrentUserInfo === 'function') ? getCurrentUserInfo() : {};
  if (!userInfo.user || !userInfo.user.id) {
    if (typeof showToast === 'function') showToast('Faça login para ativar notificações neste dispositivo.', 'warning');
    if (typeof openModal === 'function') openModal('login-modal');
    return;
  }
  try {
    await ensureServiceWorkerRegistration();
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      if (typeof showToast === 'function') showToast('PermissÃ£o negada. Ative nas configuraÃ§Ãµes do navegador se mudar de ideia.', 'info');
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
    if (typeof showToast === 'function') showToast('âœ… NotificaÃ§Ãµes ativadas! VocÃª receberÃ¡ avisos da ADPEL.', 'success');
  } catch (err) {
    console.error('[Push] Erro ao ativar notificaÃ§Ãµes:', err);
    if (typeof showToast === 'function') showToast('Erro ao ativar notificaÃ§Ãµes.', 'error');
  }
}

async function savePushSubscription(subscription) {
  if (!window.supabaseClient) return;
  try {
    const userInfo = (typeof getCurrentUserInfo === 'function') ? getCurrentUserInfo() : {};
    const userId = userInfo.user?.id || null;
    if (!userId) return;

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
    console.error('[Push] Erro ao salvar subscriÃ§Ã£o:', err);
  }
}

// Inicializa silenciosamente apÃ³s carregamento
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initPushNotifications, 2500);
});
