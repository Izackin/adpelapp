// notifications.js - consentimento e inscrição Push para o PWA ADPEL.
// A permissão do navegador só é solicitada após um clique explícito do usuário.

const VAPID_PUBLIC_KEY = 'BHEIiMKvGsyRkJUuEdmV7DjcQc10TQ-2TJYLRaDmfhneT-kaEPHV-JF-0-3uGc7Y0xIobi3N42NnDcGS-21-Rsc';
const PUSH_PROMPT_DISMISSED_AT_KEY = 'adpel_push_prompt_dismissed_at';
const PUSH_PROMPT_RETRY_MS = 7 * 24 * 60 * 60 * 1000;

function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function ensureServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  return navigator.serviceWorker.register('./sw.js', {
    scope: './',
    updateViaCache: 'none'
  });
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function getAuthenticatedPushUser() {
  const userInfo = typeof getCurrentUserInfo === 'function' ? getCurrentUserInfo() : {};
  return userInfo && userInfo.isLoggedIn && userInfo.user ? userInfo.user : null;
}

function shouldShowPushPermissionPrompt() {
  if (!isPushSupported() || Notification.permission !== 'default') return false;
  if (!getAuthenticatedPushUser()) return false;
  const dismissedAt = Number(localStorage.getItem(PUSH_PROMPT_DISMISSED_AT_KEY) || 0);
  return !dismissedAt || Date.now() - dismissedAt >= PUSH_PROMPT_RETRY_MS;
}

function hidePushPermissionPrompt(rememberDismissal) {
  const prompt = document.getElementById('push-permission-prompt');
  if (prompt) prompt.remove();
  if (rememberDismissal) {
    localStorage.setItem(PUSH_PROMPT_DISMISSED_AT_KEY, String(Date.now()));
  }
}

function showPushPermissionPrompt() {
  if (!shouldShowPushPermissionPrompt() || document.getElementById('push-permission-prompt')) return;
  const prompt = document.createElement('aside');
  prompt.id = 'push-permission-prompt';
  prompt.className = 'push-permission-prompt';
  prompt.setAttribute('role', 'dialog');
  prompt.setAttribute('aria-label', 'Ativar notificações');
  prompt.innerHTML = [
    '<div class="push-permission-icon"><i class="fas fa-bell"></i></div>',
    '<div class="push-permission-copy">',
      '<strong>Não perca nenhuma novidade</strong>',
      '<span>Ative os avisos deste dispositivo para receber respostas, eventos e conteúdos importantes.</span>',
    '</div>',
    '<div class="push-permission-actions">',
      '<button type="button" class="push-permission-later" onclick="hidePushPermissionPrompt(true)">Agora não</button>',
      '<button type="button" class="push-permission-enable" onclick="requestPushPermission()"><i class="fas fa-bell"></i> Ativar</button>',
    '</div>'
  ].join('');
  document.body.appendChild(prompt);
}

async function initPushNotifications() {
  if (!isPushSupported()) return { status: 'unsupported' };
  const user = getAuthenticatedPushUser();
  if (!user) {
    hidePushPermissionPrompt(false);
    return { status: 'signed_out' };
  }

  try {
    await ensureServiceWorkerRegistration();
    if (Notification.permission === 'granted') {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }
      await savePushSubscription(subscription);
      hidePushPermissionPrompt(false);
      return { status: 'subscribed' };
    }

    if (Notification.permission === 'default') {
      setTimeout(showPushPermissionPrompt, 800);
      return { status: 'prompt_available' };
    }

    hidePushPermissionPrompt(false);
    return { status: 'denied' };
  } catch (error) {
    console.error('[Push] Falha ao inicializar notificações:', error);
    return { status: 'error' };
  }
}

async function requestPushPermission() {
  if (!isPushSupported()) {
    if (typeof showToast === 'function') showToast('Seu dispositivo ou navegador não suporta notificações push.', 'warning');
    return { status: 'unsupported' };
  }
  if (!getAuthenticatedPushUser()) {
    if (typeof showToast === 'function') showToast('Faça login para ativar notificações neste dispositivo.', 'warning');
    if (typeof openModal === 'function') openModal('login-modal');
    return { status: 'signed_out' };
  }

  try {
    await ensureServiceWorkerRegistration();
    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();

    if (permission === 'default') {
      hidePushPermissionPrompt(true);
      return { status: 'dismissed' };
    }
    if (permission === 'denied') {
      hidePushPermissionPrompt(false);
      if (typeof showToast === 'function') {
        showToast('As notificações estão bloqueadas. Você pode liberá-las nas configurações do navegador.', 'info');
      }
      return { status: 'denied' };
    }

    const result = await initPushNotifications();
    localStorage.removeItem(PUSH_PROMPT_DISMISSED_AT_KEY);
    if (typeof showToast === 'function') showToast('Notificações ativadas neste dispositivo!', 'success');
    return result;
  } catch (error) {
    console.error('[Push] Erro ao ativar notificações:', error);
    if (typeof showToast === 'function') showToast('Não foi possível ativar as notificações.', 'error');
    return { status: 'error' };
  }
}

async function savePushSubscription(subscription) {
  if (!window.supabaseClient || !subscription) return false;
  const user = getAuthenticatedPushUser();
  if (!user) return false;

  const p256dh = subscription.getKey('p256dh');
  const auth = subscription.getKey('auth');
  if (!p256dh || !auth) throw new Error('Chaves da inscrição push indisponíveis.');

  const { error } = await window.supabaseClient
    .from('push_subscriptions')
    .upsert({
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: arrayBufferToBase64(p256dh),
      auth: arrayBufferToBase64(auth)
    }, { onConflict: 'endpoint' });

  if (error) throw error;
  return true;
}

async function removeCurrentPushSubscription() {
  hidePushPermissionPrompt(false);
  if (!isPushSupported()) return { status: 'unsupported' };

  const user = getAuthenticatedPushUser();
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = registration ? await registration.pushManager.getSubscription() : null;
  if (!subscription) return { status: 'not_subscribed' };

  let databaseError = null;
  if (window.supabaseClient && user) {
    const result = await window.supabaseClient
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', subscription.endpoint)
      .eq('user_id', user.id);
    databaseError = result.error || null;
  }

  await subscription.unsubscribe();
  if (databaseError) throw databaseError;
  return { status: 'unsubscribed' };
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initPushNotifications, 2500);
});

Object.assign(window, {
  initPushNotifications,
  requestPushPermission,
  removeCurrentPushSubscription,
  showPushPermissionPrompt,
  hidePushPermissionPrompt
});
