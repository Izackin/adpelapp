// admin-notifications.js - Master envia Push para todos os inscritos

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('notification-form');
  if (form) form.addEventListener('submit', sendMasterNotification);

  // Carrega estatísticas ao iniciar
  loadNotificationStats();
});

async function sendMasterNotification(e) {
  e.preventDefault();

  const title = document.getElementById('notif-title').value.trim();
  const body = document.getElementById('notif-body').value.trim();
  const url = document.getElementById('notif-url').value.trim();
  const notificationUrl = safeNavigationUrl(url || window.location.origin + '/');

  if (!title || !body) {
    if (typeof showToast === 'function') showToast('Preencha título e mensagem.', 'warning');
    return;
  }
  if (!notificationUrl) {
    if (typeof showToast === 'function') showToast('Informe uma URL HTTP(S) ou caminho interno válido.', 'warning');
    return;
  }

  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Enviando...';
  }

  try {
    const { data, error } = await window.supabaseClient.functions.invoke('send-notification', {
      body: { title, body, url: notificationUrl }
    });

    if (error) {
      if (error.message && error.message.toLowerCase().includes('function not found')) {
        throw new Error('Edge Function "send-notification" não encontrada. Configure-a no Supabase.');
      }
      throw error;
    }
    if (data && data.sent && !data.sentCount) data.sentCount = data.sent;

    if (typeof showToast === 'function') showToast(`✅ Notificação enviada para ${data?.sentCount || 0} dispositivo(s)!`, 'success');
    document.getElementById('notification-form').reset();
    loadNotificationStats();
  } catch (err) {
    console.error('Erro ao enviar notificação:', err);
    if (typeof showToast === 'function') showToast('Erro: ' + (err.message || 'Falha no envio'), 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar para Todos';
    }
  }
}

async function loadNotificationStats() {
  const countEl = document.getElementById('notif-subscriber-count');
  if (!countEl || !window.supabaseClient) return;
  try {
    const { data, error } = await window.supabaseClient.functions.invoke('send-notification', {
      body: { action: 'stats' }
    });
    if (error) throw error;
    countEl.textContent = (data?.subscriberCount || 0) + ' dispositivo(s) inscrito(s)';
  } catch (e) {
    countEl.textContent = 'Erro ao carregar estatísticas';
  }
}


let automationStatusRequest = 0;
let automationControlBusy = false;
let automationControlRows = [];
const automationLabels = {
  events: 'Lembretes de eventos',
  birthdays: 'Mensagens de aniversário'
};

function renderAutomationStatus(rows) {
  const cards = document.getElementById('automation-status-cards');
  if (!cards) return;
  cards.replaceChildren();
  for (const key of Object.keys(automationLabels)) {
    const row = rows.find(item => item.automation_key === key);
    const card = document.createElement('article');
    card.className = 'rounded-lg border border-gray-200 p-4 space-y-2';
    const heading = document.createElement('h4');
    heading.className = 'font-semibold text-gray-800';
    heading.textContent = automationLabels[key];
    card.appendChild(heading);
    const status = document.createElement('p');
    status.className = 'text-sm font-semibold ' + (row?.scheduler_exists && row.active ? 'text-emerald-700' : 'text-amber-700');
    status.textContent = !row || !row.scheduler_exists ? 'Agendador indisponível' : row.active ? 'Ativa' : 'Pausada';
    card.appendChild(status);
    if (row) {
      const metrics = [
        ['Usuários que aderiram', row.opted_in],
        ['Elegíveis nesta execução (até 30)', row.eligible_now],
        ['Notificações internas geradas', row.generated_total]
      ];
      for (const [label, value] of metrics) {
        const p = document.createElement('p');
        p.className = 'text-sm text-gray-700';
        const count = Number(value);
        p.textContent = label + ': ' + (value != null && Number.isSafeInteger(count) && count >= 0 ? count.toLocaleString('pt-BR') : '—');
        card.appendChild(p);
      }
      const last = document.createElement('p');
      last.className = 'text-xs text-gray-500';
      const date = row.last_run_at ? new Date(row.last_run_at) : null;
      const statuses = {succeeded:'Concluída',failed:'Falhou',running:'Executando',starting:'Iniciando',connecting:'Conectando',sending:'Enviando'};
      last.textContent = date && !isNaN(date.getTime())
        ? 'Última execução: ' + date.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}) + ' · ' + (statuses[row.last_run_status] || 'Estado não identificado')
        : 'Nenhuma execução registrada';
      card.appendChild(last);
      const control = document.createElement('button');
      control.type = 'button';
      control.className = 'px-3 py-2 border rounded-lg text-sm font-medium min-h-[44px] ' +
        (row.active ? 'border-amber-300 text-amber-800' : 'border-emerald-300 text-emerald-800');
      control.disabled = automationControlBusy || !row.scheduler_exists || (!row.active && !row.release_approved);
      control.textContent = row.active ? 'Pausar automação' : row.release_approved ? 'Ativar automação' : 'Aguardando homologação';
      control.addEventListener('click', () => changeAutomationActive(key, !row.active));
      card.appendChild(control);
    }
    cards.appendChild(card);
  }
}

async function loadAdminAutomationStatus() {
  const message = document.getElementById('automation-status-message');
  const cards = document.getElementById('automation-status-cards');
  const button = document.getElementById('automation-refresh');
  if (!message || !cards || !window.supabaseClient || automationControlBusy) return;
  const request = ++automationStatusRequest;
  if (button) button.disabled = true;
  cards.replaceChildren();
  automationControlRows = [];
  message.textContent = 'Consultando automações...';
  try {
    const {data,error} = await window.supabaseClient.rpc('get_admin_automation_control_status');
    if (request !== automationStatusRequest) return;
    if (error || !Array.isArray(data)) throw new Error('Consulta indisponível');
    automationControlRows = data;
    renderAutomationStatus(data);
    message.textContent = 'Atualizado agora. Horário de Brasília.';
  } catch (error) {
    if (request !== automationStatusRequest) return;
    cards.replaceChildren();
    message.textContent = 'Não foi possível consultar as automações. Verifique seu acesso master e tente novamente.';
  } finally {
    if (request === automationStatusRequest && button) button.disabled = false;
  }
}

async function changeAutomationActive(key, active) {
  if (automationControlBusy || !window.supabaseClient || typeof active !== 'boolean' ||
      !Object.prototype.hasOwnProperty.call(automationLabels, key)) return;
  const row = automationControlRows.find(item => item.automation_key === key);
  if (!row || !row.scheduler_exists || row.active === active || (active && !row.release_approved)) return;
  const confirmation = active
    ? 'Ativar ' + automationLabels[key] + '? Os próximos agendamentos poderão gerar notificações reais para usuários que aderiram.'
    : 'Pausar ' + automationLabels[key] + '? Novas execuções serão interrompidas; notificações já geradas não serão recolhidas.';
  if (!window.confirm(confirmation)) return;
  automationControlBusy = true;
  automationStatusRequest++;
  const message = document.getElementById('automation-status-message');
  const refresh = document.getElementById('automation-refresh');
  if (refresh) refresh.disabled = true;
  renderAutomationStatus(automationControlRows);
  if (message) message.textContent = 'Aplicando alteração...';
  let succeeded = false;
  try {
    const {data,error} = await window.supabaseClient.rpc('set_admin_automation_active',{p_key:key,p_active:active});
    if (error || data !== active) throw new Error('Alteração não confirmada');
    succeeded = true;
  } catch (error) {
    if (typeof showToast === 'function') showToast('Não foi possível confirmar a alteração. Consulte o status novamente.','error');
  } finally {
    automationControlBusy = false;
    await loadAdminAutomationStatus();
    if (succeeded && typeof showToast === 'function') showToast(active ? 'Automação ativada.' : 'Automação pausada.','success');
  }
}
