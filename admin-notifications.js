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

  if (!title || !body) {
    if (typeof showToast === 'function') showToast('Preencha título e mensagem.', 'warning');
    return;
  }

  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Enviando...';
  }

  try {
    const { data, error } = await window.supabaseClient.functions.invoke('send-notification', {
      body: { title, body, url: url || window.location.origin + '/' }
    });

    if (error) {
      if (error.message && error.message.toLowerCase().includes('function not found')) {
        throw new Error('Edge Function "send-notification" não encontrada. Configure-a no Supabase.');
      }
      throw error;
    }

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
    const { count, error } = await window.supabaseClient
      .from('push_subscriptions')
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    countEl.textContent = (count || 0) + ' dispositivo(s) inscrito(s)';
  } catch (e) {
    countEl.textContent = 'Erro ao carregar estatísticas';
  }
}