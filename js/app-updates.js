// App updates module - extracted from script.js without behavior changes.

let appUpdatesQueue = [];

let appUpdatesCheckRunning = false;

let appUpdatesLastCheckUserId = null;

const APP_UPDATES_VISITOR_STORAGE_KEY = 'adpel_updates_read';

async function obterUsuarioAtualizacao() {
  try {
    if (window.ADPEL && window.ADPEL.auth && typeof window.ADPEL.auth.getSession === 'function') {
      const session = await window.ADPEL.auth.getSession();
      if (session && session.user) return session.user;
    }
    if (window.supabaseClient && window.supabaseClient.auth && typeof window.supabaseClient.auth.getUser === 'function') {
      const result = await window.supabaseClient.auth.getUser();
      if (result && result.data && result.data.user) return result.data.user;
    }
  } catch (error) {
    console.warn('Nao foi possivel identificar usuario para atualizacoes:', error);
  }
  return null;
}

function obterAtualizacoesLidasVisitante() {
  try {
    const raw = localStorage.getItem(APP_UPDATES_VISITOR_STORAGE_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids : [];
  } catch (error) {
    console.warn('Nao foi possivel ler atualizacoes locais:', error);
    return [];
  }
}

function salvarAtualizacaoLidaVisitante(updateId) {
  if (!updateId) return;
  const ids = obterAtualizacoesLidasVisitante();
  if (!ids.includes(updateId)) {
    ids.push(updateId);
    localStorage.setItem(APP_UPDATES_VISITOR_STORAGE_KEY, JSON.stringify(ids));
  }
}

async function verificarAtualizacoesPendentes(force) {
  if (!window.supabaseClient || appUpdatesCheckRunning) return;

  const user = await obterUsuarioAtualizacao();
  const readerKey = user && user.id ? user.id : 'visitor';
  if (!force && appUpdatesLastCheckUserId === readerKey) return;

  appUpdatesCheckRunning = true;
  try {
    const updatesResult = await window.supabaseClient
      .from('app_updates')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (updatesResult.error) throw updatesResult.error;
    const updates = updatesResult.data || [];
    if (!updates.length) {
      appUpdatesLastCheckUserId = readerKey;
      return;
    }

    let readIds = new Set();
    if (user && user.id) {
      const readsResult = await window.supabaseClient
        .from('app_update_reads')
        .select('update_id')
        .eq('user_id', user.id);

      if (readsResult.error) throw readsResult.error;
      readIds = new Set((readsResult.data || []).map(item => item.update_id));
    } else {
      readIds = new Set(obterAtualizacoesLidasVisitante());
    }

    appUpdatesQueue = updates.filter(update => update && update.id && !readIds.has(update.id));
    appUpdatesLastCheckUserId = readerKey;

    if (appUpdatesQueue.length) {
      mostrarModalAtualizacao(appUpdatesQueue.shift());
    }
  } catch (error) {
    console.warn('Erro ao verificar novidades do app:', error);
  } finally {
    appUpdatesCheckRunning = false;
  }
}

function mostrarModalAtualizacao(update) {
  if (!update || !update.id) return;
  let modal = document.getElementById('app-update-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'app-update-modal';
    modal.className = 'fixed inset-0 z-[999998] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4';
    document.body.appendChild(modal);
  }

  const version = update.version
    ? '<span class="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">Versao ' + escapeHtml(update.version) + '</span>'
    : '';
  const image = update.image_url
    ? '<img src="' + escapeHtml(update.image_url) + '" alt="" class="w-full h-44 object-cover rounded-xl border border-gray-100 shadow-sm">'
    : '';

  modal.innerHTML = [
    '<div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in border border-white/20">',
      '<div class="bg-gradient-to-r from-adpel-700 to-emerald-600 p-6 text-white">',
        '<div class="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mb-4">',
          '<i class="fas fa-star text-2xl"></i>',
        '</div>',
        '<h2 class="text-2xl font-bold">✨ Novidades no App</h2>',
        '<p class="text-emerald-50 text-sm mt-1">Atualização disponível</p>',
      '</div>',
      '<div class="p-6 space-y-4">',
        image,
        '<div>',
          '<h3 class="text-xl font-bold text-gray-900">' + escapeHtml(update.title || 'Atualização disponível') + '</h3>',
        '</div>',
        version,
        '<p class="text-gray-600 leading-relaxed whitespace-pre-line">' + escapeHtml(update.description || 'Temos novidades para você.') + '</p>',
        '<button onclick="marcarAtualizacaoComoLida(&quot;' + escapeHtml(update.id) + '&quot;)" class="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition flex items-center justify-center gap-2">',
          '<i class="fas fa-check"></i> OK, entendi',
        '</button>',
      '</div>',
    '</div>'
  ].join('');
}

async function marcarAtualizacaoComoLida(updateId) {
  if (!updateId) return;
  const user = await obterUsuarioAtualizacao();
  const modal = document.getElementById('app-update-modal');

  try {
    if (user && user.id && window.supabaseClient) {
      const result = await window.supabaseClient
        .from('app_update_reads')
        .insert([{
          update_id: updateId,
          user_id: user.id,
          read_at: new Date().toISOString()
        }]);
      if (result.error) throw result.error;
    } else {
      salvarAtualizacaoLidaVisitante(updateId);
    }
  } catch (error) {
    console.warn('Erro ao marcar novidade como lida:', error);
  }

  if (modal) modal.remove();
  if (appUpdatesQueue.length) {
    mostrarModalAtualizacao(appUpdatesQueue.shift());
  }
}

Object.assign(window, {
  obterUsuarioAtualizacao,
  obterAtualizacoesLidasVisitante,
  salvarAtualizacaoLidaVisitante,
  verificarAtualizacoesPendentes,
  mostrarModalAtualizacao,
  marcarAtualizacaoComoLida
});
