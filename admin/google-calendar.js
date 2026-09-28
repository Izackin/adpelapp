// Google Calendar -> Agenda ADPEL. Credenciais e sincronizacao ficam nas Edge Functions.
var googleCalendarIntegration = null;
var googleCalendarChoices = [];
var googleCalendarBusy = false;
var googleCalendarChoosing = false;

function googleCalendarEscape(value) {
  return typeof window.escapeHtml === 'function' ? window.escapeHtml(value == null ? '' : value) : String(value == null ? '' : value);
}

function googleCalendarDate(value) {
  if (!value) return 'Ainda não executada';
  var date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Data indisponível' : date.toLocaleString('pt-BR');
}

function googleCalendarButton(label, handler, classes, icon, disabled) {
  return '<button type="button" onclick="' + handler + '" ' + (disabled ? 'disabled ' : '') +
    'class="min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ' + classes + '">' +
    (icon ? '<i class="' + icon + ' mr-2"></i>' : '') + googleCalendarEscape(label) + '</button>';
}

function renderGoogleCalendarPanel() {
  var panel = document.getElementById('google-calendar-panel');
  if (!panel) return;
  var integration = googleCalendarIntegration;
  var connected = integration && integration.status !== 'disconnected';
  var active = connected && integration.calendar_id;
  var statusClass = integration && integration.status === 'error' ? 'bg-red-100 text-red-700' : (active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600');
  var statusText = integration && integration.status === 'error' ? 'Atenção necessária' : (active ? 'Sincronização ativa' : (connected ? 'Conta conectada' : 'Não conectado'));

  var html = '<div class="flex flex-col lg:flex-row lg:items-start justify-between gap-4">' +
    '<div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><h3 class="font-bold text-gray-800"><i class="fab fa-google text-blue-600 mr-2"></i>Google Agenda</h3>' +
    '<span class="px-2.5 py-1 rounded-full text-xs font-semibold ' + statusClass + '">' + statusText + '</span></div>' +
    '<p class="text-xs text-gray-500 mt-1">Importação somente leitura para a Agenda ADPEL.</p>';

  if (active) {
    html += '<div class="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">' +
      '<div><span class="block text-gray-400">Calendário</span><strong class="text-gray-700 break-words">' + googleCalendarEscape(integration.calendar_name || integration.calendar_id) + '</strong></div>' +
      '<div><span class="block text-gray-400">Fuso horário</span><strong class="text-gray-700">' + googleCalendarEscape(integration.calendar_timezone || 'UTC') + '</strong></div>' +
      '<div><span class="block text-gray-400">Última sincronização</span><strong class="text-gray-700">' + googleCalendarEscape(googleCalendarDate(integration.last_synced_at)) + '</strong></div></div>';
  }
  if (integration && integration.last_error) {
    html += '<p class="mt-3 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-3">' + googleCalendarEscape(integration.last_error) + '</p>';
  }
  html += '</div><div class="flex flex-wrap gap-2">';

  if (!connected) {
    html += googleCalendarButton(googleCalendarBusy ? 'Conectando...' : 'Conectar Google Agenda', 'connectGoogleCalendar()', 'bg-blue-600 text-white hover:bg-blue-700', 'fab fa-google', googleCalendarBusy);
  } else if (!active || googleCalendarChoosing) {
    html += googleCalendarButton(googleCalendarBusy ? 'Carregando...' : 'Atualizar calendários', 'loadGoogleCalendarChoices()', 'bg-gray-100 text-gray-700 hover:bg-gray-200', 'fas fa-rotate', googleCalendarBusy);
    html += googleCalendarButton('Cancelar', 'cancelGoogleCalendarChoice()', 'border border-gray-300 text-gray-600 hover:bg-gray-50', '', googleCalendarBusy || !active);
  } else {
    html += googleCalendarButton(googleCalendarBusy ? 'Sincronizando...' : 'Sincronizar agora', 'syncGoogleCalendarNow()', 'bg-blue-600 text-white hover:bg-blue-700', 'fas fa-rotate', googleCalendarBusy);
    html += googleCalendarButton('Trocar calendário', 'chooseAnotherGoogleCalendar()', 'border border-gray-300 text-gray-700 hover:bg-gray-50', 'fas fa-calendar-days', googleCalendarBusy);
    html += googleCalendarButton('Desconectar', 'disconnectGoogleCalendar()', 'text-red-700 hover:bg-red-50', 'fas fa-link-slash', googleCalendarBusy);
  }
  html += '</div></div>';

  if (connected && (!active || googleCalendarChoosing)) {
    html += '<div class="mt-4 border-t border-gray-100 pt-4"><label for="google-calendar-select" class="block text-sm font-medium text-gray-700 mb-2">Calendário para importar</label>' +
      '<div class="flex flex-col sm:flex-row gap-2"><select id="google-calendar-select" class="flex-1 min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">' +
      (googleCalendarChoices.length ? googleCalendarChoices.map(function(calendar) {
        return '<option value="' + googleCalendarEscape(calendar.id) + '"' + (calendar.id === integration.calendar_id ? ' selected' : '') + '>' + googleCalendarEscape(calendar.name + (calendar.primary ? ' (principal)' : '')) + '</option>';
      }).join('') : '<option value="">Carregue os calendários disponíveis</option>') + '</select>' +
      googleCalendarButton(googleCalendarBusy ? 'Aplicando...' : 'Usar este calendário', 'selectGoogleCalendar()', 'bg-green-600 text-white hover:bg-green-700', 'fas fa-check', googleCalendarBusy || !googleCalendarChoices.length) + '</div></div>';
  }
  panel.innerHTML = html;
}

async function invokeGoogleCalendarFunction(name, body) {
  if (!window.supabaseClient || !window.supabaseClient.functions) throw new Error('Supabase indisponível.');
  var result = await window.supabaseClient.functions.invoke(name, { body: body || {} });
  if (result.error) throw new Error(result.error.message || 'Falha na integração com Google Agenda.');
  if (result.data && result.data.error) throw new Error(result.data.error);
  return result.data || {};
}

async function loadGoogleCalendarStatus() {
  try {
    var data = await invokeGoogleCalendarFunction('google-calendar-api', { action: 'status' });
    googleCalendarIntegration = data.integration || null;
    renderGoogleCalendarPanel();
    if (googleCalendarIntegration && googleCalendarIntegration.status !== 'disconnected' && !googleCalendarIntegration.calendar_id) {
      await loadGoogleCalendarChoices();
    }
  } catch (error) {
    var panel = document.getElementById('google-calendar-panel');
    if (panel) panel.innerHTML = '<p class="text-sm text-red-700"><i class="fas fa-triangle-exclamation mr-2"></i>' + googleCalendarEscape(error.message) + '</p>';
  }
}

async function connectGoogleCalendar() {
  if (googleCalendarBusy) return;
  googleCalendarBusy = true;
  renderGoogleCalendarPanel();
  try {
    var data = await invokeGoogleCalendarFunction('google-calendar-oauth-start', {});
    if (!data.authorization_url) throw new Error('URL de autorização não recebida.');
    window.location.assign(data.authorization_url);
  } catch (error) {
    googleCalendarBusy = false;
    renderGoogleCalendarPanel();
    if (typeof showToast === 'function') showToast(error.message, 'error');
  }
}

async function loadGoogleCalendarChoices() {
  if (googleCalendarBusy) return;
  googleCalendarBusy = true;
  googleCalendarChoosing = true;
  renderGoogleCalendarPanel();
  try {
    var data = await invokeGoogleCalendarFunction('google-calendar-api', { action: 'list_calendars' });
    googleCalendarChoices = data.calendars || [];
    googleCalendarIntegration = data.integration || googleCalendarIntegration;
  } catch (error) {
    if (typeof showToast === 'function') showToast(error.message, 'error');
  } finally {
    googleCalendarBusy = false;
    renderGoogleCalendarPanel();
  }
}

function chooseAnotherGoogleCalendar() {
  googleCalendarChoosing = true;
  googleCalendarChoices = [];
  renderGoogleCalendarPanel();
  loadGoogleCalendarChoices();
}

function cancelGoogleCalendarChoice() {
  if (!googleCalendarIntegration || !googleCalendarIntegration.calendar_id) return;
  googleCalendarChoosing = false;
  renderGoogleCalendarPanel();
}

async function selectGoogleCalendar() {
  if (googleCalendarBusy) return;
  var select = document.getElementById('google-calendar-select');
  if (!select || !select.value) return;
  googleCalendarBusy = true;
  renderGoogleCalendarPanel();
  try {
    var data = await invokeGoogleCalendarFunction('google-calendar-api', { action: 'select_calendar', calendar_id: select.value });
    googleCalendarIntegration = data.integration;
    googleCalendarChoosing = false;
    if (typeof loadAllData === 'function') await loadAllData();
    if (typeof showToast === 'function') showToast('Google Agenda conectado. ' + ((data.sync && data.sync.created) || 0) + ' evento(s) importado(s).', 'success');
  } catch (error) {
    if (typeof showToast === 'function') showToast(error.message, 'error');
    await loadGoogleCalendarStatus();
  } finally {
    googleCalendarBusy = false;
    renderGoogleCalendarPanel();
  }
}

async function syncGoogleCalendarNow() {
  if (googleCalendarBusy) return;
  googleCalendarBusy = true;
  renderGoogleCalendarPanel();
  try {
    var data = await invokeGoogleCalendarFunction('google-calendar-api', { action: 'sync' });
    googleCalendarIntegration = data.integration;
    if (typeof loadAllData === 'function') await loadAllData();
    var sync = data.sync || {};
    if (typeof showToast === 'function') showToast('Sincronização concluída: ' + (sync.created || 0) + ' novo(s), ' + (sync.updated || 0) + ' atualizado(s).', 'success');
  } catch (error) {
    if (typeof showToast === 'function') showToast(error.message, 'error');
    await loadGoogleCalendarStatus();
  } finally {
    googleCalendarBusy = false;
    renderGoogleCalendarPanel();
  }
}

async function disconnectGoogleCalendar() {
  if (googleCalendarBusy || !confirm('Desconectar o Google Agenda? Os eventos importados serão mantidos como histórico inativo.')) return;
  googleCalendarBusy = true;
  renderGoogleCalendarPanel();
  try {
    var data = await invokeGoogleCalendarFunction('google-calendar-api', { action: 'disconnect' });
    googleCalendarIntegration = data.integration;
    googleCalendarChoices = [];
    if (typeof loadAllData === 'function') await loadAllData();
    if (typeof showToast === 'function') showToast('Google Agenda desconectado.', 'success');
  } catch (error) {
    if (typeof showToast === 'function') showToast(error.message, 'error');
  } finally {
    googleCalendarBusy = false;
    renderGoogleCalendarPanel();
  }
}

document.addEventListener('DOMContentLoaded', function() {
  var params = new URLSearchParams(window.location.search);
  var result = params.get('google_calendar');
  if (result) {
    if (typeof adminNavigateTo === 'function') adminNavigateTo('agenda');
    var message = params.get('google_calendar_message');
    setTimeout(function() {
      if (typeof showToast === 'function') showToast(result === 'connected' ? 'Conta Google conectada. Escolha o calendário.' : (message || 'Não foi possível conectar o Google Agenda.'), result === 'connected' ? 'success' : 'error');
    }, 600);
    params.delete('google_calendar');
    params.delete('google_calendar_message');
    var cleanUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '') + window.location.hash;
    window.history.replaceState({}, document.title, cleanUrl);
  }
  setTimeout(loadGoogleCalendarStatus, 800);
});
