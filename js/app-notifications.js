var appNotificationsCache = [];
var appNotificationsPollingId = null;
var appNotificationsPanelOpen = false;
var appNotificationsRealtimeChannel = null;
var appNotificationsRealtimeUserId = null;
var appNotificationsOwnerId = null;
var appNotificationsRequest = 0;
var appNotificationsUnread = null;
var appNotificationsFilter = 'all';
var appNotificationsLimit = 20;
var appNotificationsHasMore = false;
var appNotificationsLoading = false;
var appNotificationsError = false;
var appNotificationsRefreshTimer = null;
var appNotificationsView = 'inbox';
var appNotificationsDismissBusy = false;
var APP_NOTIFICATIONS_MAX_VISIBLE = 100;
var eventReminderEnabled = null;
var eventReminderBusy = false;
var eventReminderError = false;
var eventReminderRequest = 0;
var birthdayPreference = null;
var birthdayDraftDay = '';
var birthdayDraftMonth = '';
var birthdayReady = false;
var birthdayBusy = false;
var birthdayError = '';
var birthdayRequest = 0;
var pushDiagnosticResult = null;
var pushDiagnosticBusy = false;
var pushDiagnosticRequest = 0;

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

function resetAppNotificationSession(userId) {
  appNotificationsRequest++;
  if (appNotificationsRefreshTimer) clearTimeout(appNotificationsRefreshTimer);
  appNotificationsRefreshTimer = null;
  stopNotificationsRealtime();
  appNotificationsOwnerId = userId || null;
  eventReminderRequest++;
  birthdayRequest++;
  pushDiagnosticRequest++;
  pushDiagnosticResult = null;
  pushDiagnosticBusy = false;
  birthdayPreference = null;
  birthdayDraftDay = '';
  birthdayDraftMonth = '';
  birthdayReady = false;
  birthdayBusy = false;
  birthdayError = '';
  eventReminderEnabled = null;
  eventReminderBusy = false;
  eventReminderError = false;
  appNotificationsCache = [];
  appNotificationsUnread = null;
  appNotificationsFilter = 'all';
  appNotificationsLimit = 20;
  appNotificationsHasMore = false;
  appNotificationsLoading = false;
  appNotificationsError = false;
  appNotificationsView = 'inbox';
  appNotificationsDismissBusy = false;
  closeNotificationsPanel();
  updateNotificationBadge();
}

function isCurrentNotificationSession(userId) {
  var user = getAppNotificationUser();
  return !!user && user.id === userId && appNotificationsOwnerId === userId;
}

async function loadUserNotifications() {
  var user = getAppNotificationUser();
  var userId = user && user.id;
  if (appNotificationsOwnerId !== (userId || null)) resetAppNotificationSession(userId);
  if (appNotificationsRefreshTimer) clearTimeout(appNotificationsRefreshTimer);
  appNotificationsRefreshTimer = null;
  if (!userId || !window.supabaseClient) return;
  startNotificationsRealtime(userId);
  var request = ++appNotificationsRequest;
  var filter = appNotificationsFilter;
  var limit = appNotificationsLimit;
  appNotificationsLoading = true;
  appNotificationsError = false;
  renderNotificationsPanel();
  try {
    var listQuery = window.supabaseClient.from('app_notifications')
      .select('id, recipient_id, actor_id, type, title, body, entity_type, entity_id, url, read_at, created_at')
      .eq('recipient_id', userId).is('dismissed_at', null);
    if (filter === 'unread') listQuery = listQuery.is('read_at', null);
    var results = await Promise.all([
      listQuery.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit + 1),
      window.supabaseClient.from('app_notifications').select('id', { count: 'exact', head: true })
        .eq('recipient_id', userId).is('dismissed_at', null).is('read_at', null)
    ]);
    if (!isCurrentNotificationSession(userId) || request !== appNotificationsRequest) return;
    if (results[0].error || results[1].error) throw results[0].error || results[1].error;
    var rows = (results[0].data || []).filter(function(item) { return item.recipient_id === userId; });
    appNotificationsHasMore = rows.length > limit;
    appNotificationsCache = rows.slice(0, limit);
    appNotificationsUnread = typeof results[1].count === 'number' ? results[1].count : null;
    updateNotificationBadge();
    openPendingNotificationTarget();
  } catch (error) {
    if (!isCurrentNotificationSession(userId) || request !== appNotificationsRequest) return;
    appNotificationsError = true;
    if (!isAppNotificationsSchemaError(error)) console.warn('Erro ao carregar notificações internas:', error);
  } finally {
    if (isCurrentNotificationSession(userId) && request === appNotificationsRequest) {
      appNotificationsLoading = false;
      renderNotificationsPanel();
    }
  }
}

function mergeRealtimeNotification(notification) {
  if (!notification || !notification.id || !isCurrentNotificationSession(notification.recipient_id)) return;
  // Re-query canonical list and count; never overwrite a newer list with an older response.
  appNotificationsRequest++;
  if (appNotificationsRefreshTimer) clearTimeout(appNotificationsRefreshTimer);
  appNotificationsRefreshTimer = setTimeout(function() {
    appNotificationsRefreshTimer = null;
    loadUserNotifications();
  }, 250);
}

async function loadEventReminderPreference() {
  var user = getAppNotificationUser();
  if (!user || !isCurrentNotificationSession(user.id) || !window.supabaseClient || eventReminderBusy) return;
  var request = ++eventReminderRequest;
  eventReminderBusy = true;
  eventReminderError = false;
  renderNotificationsPanel();
  try {
    var result = await window.supabaseClient.from('event_reminder_preferences')
      .select('enabled').eq('user_id', user.id).maybeSingle();
    if (!isCurrentNotificationSession(user.id) || request !== eventReminderRequest) return;
    if (result.error) throw result.error;
    eventReminderEnabled = result.data?.enabled === true;
  } catch (error) {
    if (isCurrentNotificationSession(user.id) && request === eventReminderRequest) eventReminderError = true;
  } finally {
    if (isCurrentNotificationSession(user.id) && request === eventReminderRequest) {
      eventReminderBusy = false;
      renderNotificationsPanel();
    }
  }
}

async function toggleEventReminderPreference() {
  var user = getAppNotificationUser();
  if (!user || !isCurrentNotificationSession(user.id) || eventReminderBusy || eventReminderEnabled === null) return;
  var request = ++eventReminderRequest;
  var next = !eventReminderEnabled;
  eventReminderBusy = true;
  eventReminderError = false;
  renderNotificationsPanel();
  try {
    var result = await window.supabaseClient.from('event_reminder_preferences')
      .upsert({ user_id: user.id, enabled: next }, { onConflict: 'user_id' });
    if (!isCurrentNotificationSession(user.id) || request !== eventReminderRequest) return;
    if (result.error) throw result.error;
    eventReminderEnabled = next;
  } catch (error) {
    if (isCurrentNotificationSession(user.id) && request === eventReminderRequest) {
      eventReminderError = true;
      eventReminderEnabled = null;
    }
  } finally {
    if (isCurrentNotificationSession(user.id) && request === eventReminderRequest) {
      eventReminderBusy = false;
      renderNotificationsPanel();
    }
  }
}

function renderEventReminderPreference() {
  return [
    '<div class="notifications-panel-actions" aria-label="Preferências de lembretes">',
    '<div><strong>Lembretes de eventos</strong><p class="text-xs">Receba lembretes na véspera dos eventos em que confirmou presença. Envio automático em implantação.</p></div>',
    eventReminderError ? '<button onclick="loadEventReminderPreference()">Tentar novamente</button>' :
    '<button type="button" role="switch" aria-checked="' + String(eventReminderEnabled === true) +
      '" onclick="toggleEventReminderPreference()"' + (eventReminderBusy || eventReminderEnabled === null ? ' disabled' : '') + '>' +
      (eventReminderBusy || eventReminderEnabled === null ? 'Carregando...' : eventReminderEnabled ? 'Ativado — desativar' : 'Desativado — ativar') + '</button>',
    '</div>'
  ].join('');
}

function validBirthdayDayMonth(day, month) {
  return Number.isInteger(day) && Number.isInteger(month) && month >= 1 && month <= 12 &&
    day >= 1 && day <= [31,29,31,30,31,30,31,31,30,31,30,31][month-1];
}

function setBirthdayDraft(field, value) {
  var digits = String(value || '').replace(/[^0-9]/g, '').slice(0, 2);
  if (field === 'day') birthdayDraftDay = digits;
  if (field === 'month') birthdayDraftMonth = digits;
}

async function loadBirthdayPreference() {
  var user = getAppNotificationUser();
  if (!user || !isCurrentNotificationSession(user.id) || birthdayBusy || !window.supabaseClient) return;
  var request = ++birthdayRequest;
  birthdayBusy = true;
  birthdayError = '';
  renderNotificationsPanel();
  try {
    var result = await window.supabaseClient.from('birthday_reminder_preferences')
      .select('birth_day,birth_month').eq('user_id', user.id).maybeSingle();
    if (!isCurrentNotificationSession(user.id) || request !== birthdayRequest) return;
    if (result.error) throw result.error;
    birthdayPreference = result.data || null;
    birthdayDraftDay = birthdayPreference ? String(birthdayPreference.birth_day) : '';
    birthdayDraftMonth = birthdayPreference ? String(birthdayPreference.birth_month) : '';
    birthdayReady = true;
  } catch (error) {
    if (isCurrentNotificationSession(user.id) && request === birthdayRequest) {
      birthdayReady = false;
      birthdayError = 'Não foi possível carregar a preferência.';
    }
  } finally {
    if (isCurrentNotificationSession(user.id) && request === birthdayRequest) {
      birthdayBusy = false;
      renderNotificationsPanel();
    }
  }
}

async function saveBirthdayPreference(remove) {
  var user = getAppNotificationUser();
  if (!user || !isCurrentNotificationSession(user.id) || birthdayBusy || !birthdayReady) return;
  var day = Number(birthdayDraftDay), month = Number(birthdayDraftMonth);
  if (!remove && !validBirthdayDayMonth(day, month)) {
    birthdayError = 'Informe um dia e mês válidos.';
    renderNotificationsPanel();
    return;
  }
  var request = ++birthdayRequest;
  birthdayBusy = true;
  birthdayError = '';
  renderNotificationsPanel();
  try {
    var result = remove
      ? await window.supabaseClient.from('birthday_reminder_preferences').delete().eq('user_id', user.id)
      : await window.supabaseClient.from('birthday_reminder_preferences')
          .upsert({user_id:user.id,birth_day:day,birth_month:month},{onConflict:'user_id'});
    if (!isCurrentNotificationSession(user.id) || request !== birthdayRequest) return;
    if (result.error) throw result.error;
    birthdayPreference = remove ? null : {birth_day:day,birth_month:month};
    birthdayDraftDay = remove ? '' : String(day);
    birthdayDraftMonth = remove ? '' : String(month);
  } catch (error) {
    if (isCurrentNotificationSession(user.id) && request === birthdayRequest) {
      birthdayReady = false;
      birthdayError = 'Não foi possível confirmar a alteração.';
    }
  } finally {
    if (isCurrentNotificationSession(user.id) && request === birthdayRequest) {
      birthdayBusy = false;
      renderNotificationsPanel();
    }
  }
}

function renderBirthdayPreference() {
  var disabled = birthdayBusy || !birthdayReady ? ' disabled' : '';
  return [
    '<div class="notifications-panel-actions" aria-label="Preferência de aniversário">',
    '<div class="w-full"><strong>Mensagem de aniversário</strong><p class="text-xs">Se desejar receber parabéns da ADPEL, informe apenas o dia e o mês. A data não será publicada. Envio automático em implantação.</p></div>',
    birthdayError ? '<p class="w-full text-xs" role="status">' + escapeHtml(birthdayError) + '</p>' : '',
    !birthdayReady && !birthdayBusy ? '<button type="button" onclick="loadBirthdayPreference()">Tentar novamente</button>' : '',
    '<label class="text-xs">Dia <input type="number" min="1" max="31" inputmode="numeric" aria-label="Dia do aniversário" class="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1" value="' + escapeHtml(birthdayDraftDay) + '" oninput="setBirthdayDraft(&quot;day&quot;,this.value)"' + disabled + '></label>',
    '<label class="text-xs">Mês <input type="number" min="1" max="12" inputmode="numeric" aria-label="Mês do aniversário" class="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1" value="' + escapeHtml(birthdayDraftMonth) + '" oninput="setBirthdayDraft(&quot;month&quot;,this.value)"' + disabled + '></label>',
    '<button type="button" onclick="saveBirthdayPreference(false)"' + disabled + '>' + (birthdayPreference ? 'Atualizar' : 'Ativar parabéns') + '</button>',
    birthdayPreference ? '<button type="button" onclick="saveBirthdayPreference(true)"' + disabled + '>Desativar e remover data</button>' : '',
    '</div>'
  ].join('');
}

function setAppNotificationsFilter(filter) {
  if (filter !== 'all' && filter !== 'unread') return;
  if (filter === appNotificationsFilter) return;
  appNotificationsFilter = filter;
  appNotificationsCache = [];
  appNotificationsLimit = 20;
  appNotificationsHasMore = false;
  loadUserNotifications();
}

function loadMoreAppNotifications() {
  if (appNotificationsLoading || !appNotificationsHasMore || appNotificationsLimit >= APP_NOTIFICATIONS_MAX_VISIBLE) return;
  appNotificationsLimit = Math.min(APP_NOTIFICATIONS_MAX_VISIBLE, appNotificationsLimit + 20);
  loadUserNotifications();
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
      if (isCurrentNotificationSession(userId) && payload && payload.new && payload.new.recipient_id === userId) {
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
  var unread = appNotificationsUnread;
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
  if (appNotificationsPanelOpen) { closeNotificationsPanel(); return; }
  var user = getAppNotificationUser();
  if (!user) {
    if (typeof showToast === 'function') showToast('Faça login para ver suas notificações.', 'warning');
    if (typeof openModal === 'function') openModal('login-modal');
    return;
  }
  if (appNotificationsOwnerId !== user.id) resetAppNotificationSession(user.id);
  appNotificationsPanelOpen = true;
  appNotificationsView = 'inbox';
  var panel = ensureNotificationsPanel();
  panel.classList.remove('hidden');
  var bell = document.getElementById('notification-bell');
  if (bell && bell.setAttribute) bell.setAttribute('aria-expanded','true');
  renderNotificationsPanel();
  loadUserNotifications();
  loadEventReminderPreference();
  loadBirthdayPreference();
}

function closeNotificationsPanel() {
  appNotificationsPanelOpen = false;
  var panel = document.getElementById('notifications-panel');
  if (panel) { panel.classList.add('hidden'); panel.innerHTML = ''; }
  var bell = document.getElementById('notification-bell');
  if (bell && bell.setAttribute) bell.setAttribute('aria-expanded','false');
}

async function checkCurrentPushDevice() {
  var user = getAppNotificationUser();
  if (!user || !isCurrentNotificationSession(user.id) || pushDiagnosticBusy || typeof getPushDeviceDiagnostic !== 'function') return;
  var request = ++pushDiagnosticRequest;
  pushDiagnosticBusy = true;
  pushDiagnosticResult = null;
  renderNotificationsPanel();
  try {
    var result = await getPushDeviceDiagnostic();
    if (request === pushDiagnosticRequest && isCurrentNotificationSession(user.id)) pushDiagnosticResult = result;
  } catch (_) {
    if (request === pushDiagnosticRequest && isCurrentNotificationSession(user.id)) pushDiagnosticResult = {status:'error'};
  } finally {
    if (request === pushDiagnosticRequest && isCurrentNotificationSession(user.id)) {
      pushDiagnosticBusy = false;
      renderNotificationsPanel();
    }
  }
}

function renderPushDeviceDiagnostic() {
  if (typeof getPushDeviceDiagnostic !== 'function') return '';
  var rows = [];
  var d = pushDiagnosticResult;
  if (d && d.status === 'ok') {
    rows.push('Permissão: ' + ({granted:'concedida',denied:'bloqueada',default:'não solicitada'}[d.permission] || 'indisponível'));
    rows.push('Service Worker ativo: ' + (d.workerActive ? 'sim' : 'não'));
    rows.push('Página controlada: ' + (d.controlled ? 'sim' : 'não'));
    rows.push('Inscrição local: ' + (d.subscribed ? 'encontrada' : 'ausente'));
    rows.push('Inscrição desta conta no servidor: ' + (d.registered === true ? 'confirmada' : d.registered === false ? 'não encontrada' : 'não verificada'));
    if (d.trace) {
      var date = new Date(d.trace.receivedAt);
      rows.push('Último teste recebido pelo Service Worker: ' + (isNaN(date.getTime()) ? 'horário indisponível' : date.toLocaleString('pt-BR')));
      rows.push('Solicitação de exibição: ' + (d.trace.shown ? 'aceita pelo navegador' : 'falhou (' + (d.trace.failure || 'erro') + ')'));
    } else {
      rows.push('Nenhum registro local de teste desta conta. Isso não comprova falha de entrega.');
    }
  } else if (d) {
    rows.push(d.status === 'unsupported' ? 'Push não suportado neste ambiente.' : 'Não foi possível consultar o dispositivo.');
  }
  return [
    '<div class="notifications-panel-actions" aria-label="Diagnóstico de notificações">',
    '<div class="w-full"><strong>Diagnóstico deste dispositivo</strong><p class="text-xs">Verifique a inscrição e o recebimento de testes. Nenhuma mensagem será enviada.</p></div>',
    '<button type="button" onclick="checkCurrentPushDevice()"' + (pushDiagnosticBusy ? ' disabled' : '') + '>' + (pushDiagnosticBusy ? 'Verificando...' : 'Verificar dispositivo') + '</button>',
    rows.length ? '<div class="w-full text-xs" role="status">' + rows.map(function(row){return '<p>' + escapeHtml(row) + '</p>';}).join('') + '</div>' : '',
    '</div>'
  ].join('');
}

function setNotificationsView(view) {
  if (!appNotificationsPanelOpen || (view !== 'inbox' && view !== 'settings')) return;
  appNotificationsView = view;
  renderNotificationsPanel();
  var panel = document.getElementById('notifications-panel');
  var scroll = panel && panel.querySelector && panel.querySelector('.notifications-scroll');
  if (scroll) scroll.scrollTop = 0;
}

function renderNotificationsPanel() {
  var panel = document.getElementById('notifications-panel');
  if (!panel || !appNotificationsPanelOpen) return;
  if (!isCurrentNotificationSession(appNotificationsOwnerId)) { panel.innerHTML = ''; return; }
  var unread = appNotificationsUnread;
  var settings = appNotificationsView === 'settings';
  var oldScroll = panel.querySelector && panel.querySelector('.notifications-scroll');
  var top = oldScroll ? oldScroll.scrollTop : 0;
  var busy = appNotificationsDismissBusy ? ' disabled' : '';
  panel.innerHTML = [
    '<div class="notifications-backdrop" onclick="closeNotificationsPanel()" aria-hidden="true"></div>',
    '<section class="notifications-panel-inner" role="dialog" aria-label="Notificações">',
      '<header class="notifications-panel-head">',
        '<div><p class="app-eyebrow">Central de mensagens</p><h3>Notificações</h3><p class="notifications-subtitle">' + (unread === null ? 'Acompanhe seus avisos' : unread === 0 ? 'Você está em dia' : unread + ' não lida(s)') + '</p></div>',
        '<button type="button" onclick="closeNotificationsPanel()" class="notifications-close" aria-label="Fechar notificações"><i class="fas fa-times" aria-hidden="true"></i></button>',
      '</header>',
      '<div class="notifications-tabs" aria-label="Seções do sino">',
        '<button type="button" aria-pressed="' + String(!settings) + '" onclick="setNotificationsView(&quot;inbox&quot;)"><i class="fas fa-inbox"></i> Mensagens</button>',
        '<button type="button" aria-pressed="' + String(settings) + '" onclick="setNotificationsView(&quot;settings&quot;)"><i class="fas fa-sliders-h"></i> Ajustes</button>',
      '</div>',
      !settings ? '<div class="notifications-toolbar"><div class="notifications-panel-actions" aria-label="Filtrar notificações">' +
        '<button type="button" aria-pressed="' + String(appNotificationsFilter === 'all') + '" onclick="setAppNotificationsFilter(&quot;all&quot;)">Todas</button>' +
        '<button type="button" aria-pressed="' + String(appNotificationsFilter === 'unread') + '" onclick="setAppNotificationsFilter(&quot;unread&quot;)">Não lidas' + (unread !== null ? ' (' + unread + ')' : '') + '</button></div>' +
        '<div class="notifications-panel-actions notifications-management">' +
        (unread ? '<button type="button" onclick="markAllNotificationsAsRead()"' + busy + '><i class="fas fa-check-double"></i> Marcar lidas</button>' : '') +
        '<button type="button" onclick="loadUserNotifications()" aria-label="Atualizar notificações"' + (appNotificationsLoading ? ' disabled' : '') + '><i class="fas fa-sync-alt"></i> Atualizar</button>' +
        (appNotificationsCache.length || unread ? '<button type="button" class="notifications-danger" onclick="dismissAppNotifications(null)"' + busy + '><i class="fas fa-trash-alt"></i> Limpar tudo</button>' : '') +
        '</div></div>' : '',
      '<div class="notifications-scroll">',
        settings ? renderEventReminderPreference() + renderBirthdayPreference() + renderPushDeviceDiagnostic() : [
          appNotificationsError ? '<div class="notification-empty" role="status"><p>Não foi possível atualizar.</p><button type="button" onclick="loadUserNotifications()">Tentar novamente</button></div>' : '',
          '<div class="notifications-list" aria-busy="' + String(appNotificationsLoading) + '">',
          appNotificationsCache.length ? appNotificationsCache.map(renderNotificationItem).join('') : appNotificationsLoading ? '<div class="notification-empty" role="status"><p>Carregando notificações...</p></div>' : appNotificationsError ? '' : '<div class="notification-empty"><i class="fas fa-bell-slash"></i><p>' + (appNotificationsFilter === 'unread' ? 'Tudo em dia! Nenhuma notificação não lida.' : 'Nenhuma notificação ainda.') + '</p></div>',
          '</div>',
          appNotificationsHasMore && appNotificationsLimit < APP_NOTIFICATIONS_MAX_VISIBLE ? '<div class="notifications-panel-actions"><button type="button" onclick="loadMoreAppNotifications()"' + (appNotificationsLoading ? ' disabled' : '') + '>Carregar mais</button></div>' : '',
          appNotificationsHasMore && appNotificationsLimit >= APP_NOTIFICATIONS_MAX_VISIBLE ? '<div class="notification-empty"><p>Exibindo as 100 notificações mais recentes deste filtro.</p></div>' : ''
        ].join(''),
      '</div>',
      '<footer class="notifications-footer"><button type="button" onclick="closeNotificationsPanel()"><i class="fas fa-arrow-left"></i> Voltar ao aplicativo</button></footer>',
    '</section>'
  ].join('');
  var scroll = panel.querySelector && panel.querySelector('.notifications-scroll');
  if (scroll) scroll.scrollTop = top;
}

function getNotificationIcon(type) {
  var map = {
    community_comment: { icon: 'fa-comment', className: 'is-comment' },
    community_amen: { icon: 'fa-hands-praying', className: 'is-amen' },
    system: { icon: 'fa-bell', className: 'is-system' },
    event: { icon: 'fa-calendar', className: 'is-event' },
    event_reminder: { icon: 'fa-calendar-check', className: 'is-event' },
    birthday_greeting: { icon: 'fa-cake-candles', className: 'is-system' },
    course: { icon: 'fa-graduation-cap', className: 'is-course' },
    offering: { icon: 'fa-hand-holding-heart', className: 'is-offering' }
  };
  return map[type] || map.system;
}

function renderNotificationItem(notification) {
  var isUnread = !notification.read_at;
  var icon = getNotificationIcon(notification.type);
  var id = escapeHtml(notification.id);
  return [
    '<article class="notification-item ' + escapeHtml(icon.className) + ' ' + (isUnread ? 'is-unread' : '') + '">',
      '<button type="button" class="notification-open" onclick="markNotificationAsRead(&quot;' + id + '&quot;)">',
        '<span class="notification-unread-dot"></span>',
        '<span class="notification-icon"><i class="fas ' + escapeHtml(icon.icon) + '"></i></span>',
        '<span class="notification-copy">',
          '<strong>' + escapeHtml(notification.title || 'Nova notificação') + '</strong>',
          '<span>' + escapeHtml(notification.body || '') + '</span>',
          '<time>' + escapeHtml(formatNotificationDate(notification.created_at)) + '</time>',
        '</span>',
      '</button>',
      '<button type="button" class="notification-remove" aria-label="Remover notificação" title="Remover notificação" onclick="dismissAppNotifications(&quot;' + id + '&quot;)"' + (appNotificationsDismissBusy ? ' disabled' : '') + '><i class="fas fa-trash-alt" aria-hidden="true"></i></button>',
    '</article>'
  ].join('');
}

async function dismissAppNotifications(notificationId) {
  var user = getAppNotificationUser();
  if (!user || !isCurrentNotificationSession(user.id) || !window.supabaseClient || appNotificationsDismissBusy) return;
  if (notificationId !== null && !appNotificationsCache.some(function(n){return n.id === notificationId;})) return;
  if (notificationId === null && !window.confirm('Remover todas as notificações da sua caixa de entrada, inclusive as não lidas?')) return;
  var cutoff = new Date().toISOString();
  appNotificationsDismissBusy = true;
  renderNotificationsPanel();
  try {
    var query = window.supabaseClient.from('app_notifications').update({dismissed_at:cutoff})
      .eq('recipient_id',user.id).is('dismissed_at',null);
    if (notificationId !== null) query = query.eq('id',notificationId);
    else query = query.lte('created_at',cutoff);
    var result = await query;
    if (result.error) throw result.error;
    if (!isCurrentNotificationSession(user.id)) return;
    await loadUserNotifications();
    if (typeof showToast === 'function') showToast(notificationId === null ? 'Caixa de entrada limpa.' : 'Notificação removida.','success');
  } catch (_) {
    if (isCurrentNotificationSession(user.id) && typeof showToast === 'function') showToast('Não foi possível remover. Tente novamente.','error');
  } finally {
    if (isCurrentNotificationSession(user.id)) { appNotificationsDismissBusy = false; renderNotificationsPanel(); }
  }
}

async function markNotificationAsRead(notificationId) {
  var user = getAppNotificationUser();
  if (!user || !notificationId || !window.supabaseClient) return;
  if (!isCurrentNotificationSession(user.id)) return;
  var notification = appNotificationsCache.find(function(item) { return item.id === notificationId; });
  if (!notification) return;
  var readAt = new Date().toISOString();
  try {
    var result = await window.supabaseClient
      .from('app_notifications')
      .update({ read_at: readAt })
      .eq('id', notificationId)
      .eq('recipient_id', user.id);
    if (result.error) throw result.error;
    if (!isCurrentNotificationSession(user.id)) return;
    openNotificationTarget(notification);
    await loadUserNotifications();
  } catch (error) {
    if (!isCurrentNotificationSession(user.id)) return;
    console.warn('Erro ao marcar notificação como lida:', error);
    if (typeof showToast === 'function') showToast('Não foi possível abrir a notificação agora.', 'error');
  }
}

async function markAllNotificationsAsRead() {
  var user = getAppNotificationUser();
  if (!user || !window.supabaseClient) return;
  if (!isCurrentNotificationSession(user.id)) return;
  var readAt = new Date().toISOString();
  try {
    var result = await window.supabaseClient
      .from('app_notifications')
      .update({ read_at: readAt })
      .eq('recipient_id', user.id)
      .is('dismissed_at', null)
      .is('read_at', null);
    if (result.error) throw result.error;
    if (!isCurrentNotificationSession(user.id)) return;
    await loadUserNotifications();
  } catch (error) {
    if (!isCurrentNotificationSession(user.id)) return;
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
  appNotificationsPollingId = setInterval(function() {
    if (document.visibilityState !== 'hidden' && getAppNotificationUser()) loadUserNotifications();
  }, 60000);
}

document.addEventListener('click', function(event) {
  var panel = document.getElementById('notifications-panel');
  if (!panel || panel.classList.contains('hidden')) return;
  // Inline actions may rerender the panel before this event bubbles to document.
  if (panel.contains(event.target) || (typeof event.composedPath === 'function' && event.composedPath().includes(panel))) return;
  var bell = document.getElementById('notification-bell');
  if (bell && bell.contains(event.target)) return;
  closeNotificationsPanel();
});

document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') closeNotificationsPanel();
});

document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible' && getAppNotificationUser()) loadUserNotifications();
});

document.addEventListener('DOMContentLoaded', function() {
  setTimeout(loadUserNotifications, 900);
  startNotificationsPolling();
});

Object.assign(window, {
  loadUserNotifications: loadUserNotifications,
  resetAppNotificationSession: resetAppNotificationSession,
  setAppNotificationsFilter: setAppNotificationsFilter,
  loadMoreAppNotifications: loadMoreAppNotifications,
  loadEventReminderPreference: loadEventReminderPreference,
  toggleEventReminderPreference: toggleEventReminderPreference,
  loadBirthdayPreference: loadBirthdayPreference,
  setBirthdayDraft: setBirthdayDraft,
  saveBirthdayPreference: saveBirthdayPreference,
  checkCurrentPushDevice: checkCurrentPushDevice,
  setNotificationsView: setNotificationsView,
  dismissAppNotifications: dismissAppNotifications,
  updateNotificationBadge: updateNotificationBadge,
  openNotificationsPanel: openNotificationsPanel,
  closeNotificationsPanel: closeNotificationsPanel,
  getNotificationIcon: getNotificationIcon,
  markNotificationAsRead: markNotificationAsRead,
  markAllNotificationsAsRead: markAllNotificationsAsRead,
  startNotificationsRealtime: startNotificationsRealtime,
  stopNotificationsRealtime: stopNotificationsRealtime
});
