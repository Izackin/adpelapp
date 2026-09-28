var appNotificationsCache = [];
var appNotificationsPollingId = null;
var appNotificationsPanelOpen = false;
var appNotificationsRealtimeChannel = null;
var appNotificationsRealtimeUserId = null;

function getAppNotificationUser() {
  var userInfo = typeof getCurrentUserInfo === 'function' ? getCurrentUserInfo() : {};
  return userInfo && userInfo.isLoggedIn && userInfo.user ? userInfo.user : null;
}

function isAppNotificationsSchemaError(error) {
  var text = String(error && (error.message || error.details || error.hint || error.code) || '').toLowerCase();
  return text.indexOf('app_notifications') !== -1 ||
    text.indexOf('42p01') !== -1 ||
    text.indexOf('does not exist') !== -1 ||
    text.indexOf('could not find the table') !== -1;
}

function formatNotificationDate(value) {
  if (!value) return '';
  var date = new Date(value);
  if (isNaN(date.getTime())) return '';
  var diff = Date.now() - date.getTime();
  var minute = 60 * 1000;
  var hour = 60 * minute;
  var day = 24 * hour;
  if (diff < minute) return 'agora';
  if (diff < hour) return 'há ' + Math.max(1, Math.floor(diff / minute)) + ' min';
  if (diff < day) return 'há ' + Math.floor(diff / hour) + ' h';
  if (diff < day * 7) return 'há ' + Math.floor(diff / day) + ' d';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

async function loadUserNotifications() {
  var user = getAppNotificationUser();
  if (!user || !window.supabaseClient) {
    stopNotificationsRealtime();
    appNotificationsCache = [];
    updateNotificationBadge();
    renderNotificationsPanel();
    return;
  }

  try {
    startNotificationsRealtime(user.id);
    var result = await window.supabaseClient
      .from('app_notifications')
      .select('id, recipient_id, actor_id, type, title, body, entity_type, entity_id, url, read_at, created_at')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (result.error) throw result.error;
    appNotificationsCache = result.data || [];
    updateNotificationBadge();
    renderNotificationsPanel();
    openPendingNotificationTarget();
  } catch (error) {
    if (!isAppNotificationsSchemaError(error)) {
      console.warn('Erro ao carregar notificações internas:', error);
    }
    appNotificationsCache = [];
    updateNotificationBadge();
    renderNotificationsPanel();
  }
}

function mergeRealtimeNotification(notification) {
  if (!notification || !notification.id) return;
  var existingIndex = appNotificationsCache.findIndex(function(item) {
    return item.id === notification.id;
  });
  if (existingIndex >= 0) {
    appNotificationsCache[existingIndex] = Object.assign({}, appNotificationsCache[existingIndex], notification);
  } else {
    appNotificationsCache.unshift(notification);
    appNotificationsCache = appNotificationsCache.slice(0, 20);
  }
  updateNotificationBadge();
  renderNotificationsPanel();
}

function startNotificationsRealtime(userId) {
  if (!window.supabaseClient || !userId) return;
  if (appNotificationsRealtimeChannel && appNotificationsRealtimeUserId === userId) return;
  stopNotificationsRealtime();
  appNotificationsRealtimeUserId = userId;
  appNotificationsRealtimeChannel = window.supabaseClient
    .channel('app-notifications-' + userId)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'app_notifications',
      filter: 'recipient_id=eq.' + userId
    }, function(payload) {
      if (payload && payload.new && payload.new.recipient_id === userId) {
        mergeRealtimeNotification(payload.new);
      }
    })
    .subscribe(function(status) {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('Realtime de notificações indisponível; a atualização periódica continua ativa.');
      }
    });
}

function stopNotificationsRealtime() {
  if (appNotificationsRealtimeChannel && window.supabaseClient) {
    window.supabaseClient.removeChannel(appNotificationsRealtimeChannel);
  }
  appNotificationsRealtimeChannel = null;
  appNotificationsRealtimeUserId = null;
}

function updateNotificationBadge() {
  var badge = document.getElementById('notification-badge');
  if (!badge) return;
  var unread = appNotificationsCache.filter(function(item) { return !item.read_at; }).length;
  if (!unread) {
    badge.classList.add('hidden');
    badge.textContent = '';
    return;
  }
  badge.classList.remove('hidden');
  badge.textContent = unread > 9 ? '9+' : String(unread);
}

function ensureNotificationsPanel() {
  var panel = document.getElementById('notifications-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'notifications-panel';
    panel.className = 'notifications-panel hidden';
    document.body.appendChild(panel);
  }
  return panel;
}

function openNotificationsPanel() {
  var user = getAppNotificationUser();
  if (!user) {
    if (typeof showToast === 'function') showToast('Faça login para ver suas notificações.', 'warning');
    if (typeof openModal === 'function') openModal('login-modal');
    return;
  }
  appNotificationsPanelOpen = true;
  var panel = ensureNotificationsPanel();
  panel.classList.remove('hidden');
  renderNotificationsPanel();
  loadUserNotifications();
}

function closeNotificationsPanel() {
  appNotificationsPanelOpen = false;
  var panel = document.getElementById('notifications-panel');
  if (panel) panel.classList.add('hidden');
}

function renderNotificationsPanel() {
  var panel = document.getElementById('notifications-panel');
  if (!panel || !appNotificationsPanelOpen) return;
  var unread = appNotificationsCache.filter(function(item) { return !item.read_at; }).length;
  panel.innerHTML = [
    '<div class="notifications-panel-inner">',
      '<div class="notifications-panel-head">',
        '<div><p class="app-eyebrow">Sino</p><h3>Notificações</h3></div>',
        '<button onclick="closeNotificationsPanel()" class="notifications-close" aria-label="Fechar notificações"><i class="fas fa-times"></i></button>',
      '</div>',
      '<div class="notifications-panel-actions">',
        unread ? '<button onclick="markAllNotificationsAsRead()"><i class="fas fa-check-double"></i> Marcar todas como lidas</button>' : '',
      '</div>',
      '<div class="notifications-list">',
        appNotificationsCache.length ? appNotificationsCache.map(renderNotificationItem).join('') : '<div class="notification-empty"><i class="fas fa-bell-slash"></i><p>Nenhuma notificação ainda.</p></div>',
      '</div>',
    '</div>'
  ].join('');
}

function getNotificationIcon(type) {
  var map = {
    community_comment: { icon: 'fa-comment', className: 'is-comment' },
    community_amen: { icon: 'fa-hands-praying', className: 'is-amen' },
    system: { icon: 'fa-bell', className: 'is-system' },
    event: { icon: 'fa-calendar', className: 'is-event' },
    course: { icon: 'fa-graduation-cap', className: 'is-course' },
    offering: { icon: 'fa-hand-holding-heart', className: 'is-offering' }
  };
  return map[type] || map.system;
}

function renderNotificationItem(notification) {
  var isUnread = !notification.read_at;
  var icon = getNotificationIcon(notification.type);
  return [
    '<button onclick="markNotificationAsRead(&quot;' + escapeHtml(notification.id) + '&quot;)" class="notification-item ' + escapeHtml(icon.className) + ' ' + (isUnread ? 'is-unread' : '') + '">',
      '<span class="notification-unread-dot"></span>',
      '<span class="notification-icon"><i class="fas ' + escapeHtml(icon.icon) + '"></i></span>',
      '<span class="notification-copy">',
        '<strong>' + escapeHtml(notification.title || 'Nova notificação') + '</strong>',
        '<span>' + escapeHtml(notification.body || '') + '</span>',
      '</span>',
      '<time>' + escapeHtml(formatNotificationDate(notification.created_at)) + '</time>',
    '</button>'
  ].join('');
}

async function markNotificationAsRead(notificationId) {
  var user = getAppNotificationUser();
  if (!user || !notificationId || !window.supabaseClient) return;
  var notification = appNotificationsCache.find(function(item) { return item.id === notificationId; });
  var readAt = new Date().toISOString();
  try {
    var result = await window.supabaseClient
      .from('app_notifications')
      .update({ read_at: readAt })
      .eq('id', notificationId)
      .eq('recipient_id', user.id);
    if (result.error) throw result.error;
    appNotificationsCache = appNotificationsCache.map(function(item) {
      return item.id === notificationId ? Object.assign({}, item, { read_at: item.read_at || readAt }) : item;
    });
    updateNotificationBadge();
    renderNotificationsPanel();
    openNotificationTarget(notification);
  } catch (error) {
    console.warn('Erro ao marcar notificação como lida:', error);
    if (typeof showToast === 'function') showToast('Não foi possível abrir a notificação agora.', 'error');
  }
}

async function markAllNotificationsAsRead() {
  var user = getAppNotificationUser();
  if (!user || !window.supabaseClient) return;
  var readAt = new Date().toISOString();
  try {
    var result = await window.supabaseClient
      .from('app_notifications')
      .update({ read_at: readAt })
      .eq('recipient_id', user.id)
      .is('read_at', null);
    if (result.error) throw result.error;
    appNotificationsCache = appNotificationsCache.map(function(item) {
      return Object.assign({}, item, { read_at: item.read_at || readAt });
    });
    updateNotificationBadge();
    renderNotificationsPanel();
  } catch (error) {
    console.warn('Erro ao marcar notificações como lidas:', error);
    if (typeof showToast === 'function') showToast('Não foi possível marcar tudo como lido.', 'error');
  }
}

function openNotificationTarget(notification) {
  if (!notification) return;
  closeNotificationsPanel();
  if (notification.entity_type === 'community_post') {
    openCommunityPostNotification(notification.entity_id);
    return;
  }
  if (notification.url && notification.url.charAt(0) === '#') {
    var section = notification.url.replace('#', '').split('?')[0];
    if (section && typeof navigateTo === 'function') navigateTo(section);
    return;
  }
  if (notification.url && notification.url.charAt(0) === '/') {
    var target = new URL(notification.url, window.location.origin);
    if (target.origin === window.location.origin) window.location.assign(target.href);
  }
}

function openCommunityPostNotification(postId) {
  if (!postId || typeof navigateTo !== 'function') return;
  navigateTo('community');
  var attempts = 0;
  var scrollToCommunityPost = function() {
    attempts += 1;
    var card = document.getElementById('community-post-' + postId);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('community-post-highlight');
      setTimeout(function() { card.classList.remove('community-post-highlight'); }, 2000);
      return;
    }
    if (attempts < 8) setTimeout(scrollToCommunityPost, 300);
  };
  setTimeout(scrollToCommunityPost, 500);
}

function openPendingNotificationTarget() {
  var params = new URLSearchParams(window.location.search);
  var postId = params.get('notification_post');
  if (!postId || !/^[0-9a-f-]{36}$/i.test(postId) || !getAppNotificationUser()) return;
  params.delete('notification_post');
  var cleanQuery = params.toString();
  window.history.replaceState({}, '', window.location.pathname + (cleanQuery ? '?' + cleanQuery : '') + '#community');
  openCommunityPostNotification(postId);
}

function startNotificationsPolling() {
  if (appNotificationsPollingId) clearInterval(appNotificationsPollingId);
  appNotificationsPollingId = setInterval(loadUserNotifications, 60000);
}

document.addEventListener('click', function(event) {
  var panel = document.getElementById('notifications-panel');
  if (!panel || panel.classList.contains('hidden')) return;
  if (panel.contains(event.target)) return;
  var bell = document.getElementById('notification-bell');
  if (bell && bell.contains(event.target)) return;
  closeNotificationsPanel();
});

document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') closeNotificationsPanel();
});

document.addEventListener('DOMContentLoaded', function() {
  setTimeout(loadUserNotifications, 900);
  startNotificationsPolling();
});

Object.assign(window, {
  loadUserNotifications: loadUserNotifications,
  updateNotificationBadge: updateNotificationBadge,
  openNotificationsPanel: openNotificationsPanel,
  closeNotificationsPanel: closeNotificationsPanel,
  getNotificationIcon: getNotificationIcon,
  markNotificationAsRead: markNotificationAsRead,
  markAllNotificationsAsRead: markAllNotificationsAsRead,
  startNotificationsRealtime: startNotificationsRealtime,
  stopNotificationsRealtime: stopNotificationsRealtime
});
