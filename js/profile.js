async function loadProfileData() {
  const userInfo = getCurrentUserInfo();
  renderProfile(userInfo);
  await renderProfileOfferings(userInfo);
  if (window.ADPELJourney && typeof window.ADPELJourney.init === 'function') {
    await window.ADPELJourney.init();
  }
}

function renderProfile(userInfo) {
  const container = document.getElementById('profile-content');
  if (!container) return;
  if (!userInfo.isLoggedIn) {
    container.innerHTML = `
      <div class="bg-white rounded-2xl shadow-sm p-8 text-center">
        <div class="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <i class="fas fa-user-circle text-5xl text-gray-400"></i>
        </div>
        <h3 class="text-xl font-bold text-gray-800">Visitante</h3>
        <p class="text-gray-500 mt-2">Faca login para acessar seu perfil.</p>
        <button onclick="openModal('login-modal')" class="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition">Fazer Login</button>
      </div>`;
    return;
  }
  const profile = userInfo.profile || {};
  const user = userInfo.user || {};
  const displayName = escapeHtml(profile.full_name || user.email || 'Usuário');
  const displayEmail = escapeHtml(user.email || '');
  const roleLabel = userInfo.isMaster ? 'Administrador' : 'Membro';
  container.innerHTML = `
    <div class="bg-white rounded-2xl shadow-sm p-8">
      <div class="flex flex-col items-center mb-8">
        <div class="w-32 h-32 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-4">
          <i class="fas fa-user-circle text-5xl"></i>
        </div>
        <h3 class="text-xl font-bold text-gray-800">${displayName}</h3>
        <p class="text-gray-500">${displayEmail}</p>
        <span class="mt-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">${roleLabel}</span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div class="text-center p-4 bg-gray-50 rounded-xl"><p class="text-2xl font-bold text-gray-700">0</p><p class="text-sm text-gray-500">Cursos Concluidos</p></div>
        <div class="text-center p-4 bg-gray-50 rounded-xl"><p class="text-2xl font-bold text-gray-700">0h</p><p class="text-sm text-gray-500">Horas de Estudo</p></div>
      </div>
    </div>
    <div id="profile-offerings-content" class="mt-8"></div>`;
}

async function renderProfileOfferings(userInfo) {
  const container = document.getElementById('profile-offerings-content');
  if (!container) return;
  if (!userInfo || !userInfo.isLoggedIn || !userInfo.user || !window.supabaseClient) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '<div class="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 text-sm text-gray-500">Carregando suas ofertas...</div>';
  try {
    let result = await window.supabaseClient
      .from('fundraising_contributions')
      .select('*, fundraising_goals(name)')
      .eq('user_id', userInfo.user.id)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false })
      .limit(100);
    if (result.error && isOfferingSchemaError(result.error)) {
      result = await window.supabaseClient
        .from('fundraising_contributions')
        .select('*, fundraising_goals(name)')
        .eq('user_id', userInfo.user.id)
        .order('created_at', { ascending: false })
        .limit(100);
    }
    if (result.error) throw result.error;

    const offerings = result.data || [];
    const now = new Date();
    const startWeek = new Date(now);
    startWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    startWeek.setHours(0, 0, 0, 0);
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startYear = new Date(now.getFullYear(), 0, 1);
    const sumSince = (date) => offerings.reduce((total, item) => {
      const created = new Date(item.paid_at || item.created_at || 0);
      return created >= date ? total + Number(item.amount || 0) : total;
    }, 0);
    const total = offerings.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const goalNames = Array.from(new Set(offerings
      .filter(item => item.goal_id)
      .map(item => item.fundraising_goals && item.fundraising_goals.name ? item.fundraising_goals.name : 'Cofre')));
    const latest = offerings.slice(0, 5);

    container.innerHTML = [
      '<div class="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">',
        '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">',
          '<div>',
            '<h3 class="text-xl font-bold text-gray-900 flex items-center gap-2"><i class="fas fa-heart text-green-600"></i> Minhas Ofertas</h3>',
            '<p class="text-sm text-gray-500 mt-1">Seu historico de contribuicoes confirmadas.</p>',
          '</div>',
          '<button onclick="openOfferingReportModal()" class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition inline-flex items-center justify-center gap-2"><i class="fas fa-file-lines"></i> Gerar relatorio</button>',
        '</div>',
        '<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">',
          offeringMetricCard('Esta semana', sumSince(startWeek), 'fa-heart'),
          offeringMetricCard('Este mes', sumSince(startMonth), 'fa-calendar-days'),
          offeringMetricCard('Este ano', sumSince(startYear), 'fa-seedling'),
          offeringMetricCard('Total geral', total, 'fa-hands-praying'),
        '</div>',
        '<div class="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">',
          '<div class="bg-gray-50 rounded-xl p-4"><p class="text-2xl font-bold text-gray-900">' + offerings.length + '</p><p class="text-gray-500">Quantidade de ofertas</p></div>',
          '<div class="bg-gray-50 rounded-xl p-4"><p class="text-2xl font-bold text-gray-900">' + goalNames.length + '</p><p class="text-gray-500">Cofres ajudados</p></div>',
          '<div class="bg-gray-50 rounded-xl p-4"><p class="text-2xl font-bold text-gray-900">R$ ' + formatBRL(total) + '</p><p class="text-gray-500">Total ofertado</p></div>',
        '</div>',
        '<div class="mt-5">',
          '<h4 class="font-bold text-gray-800 mb-3">Ultimas ofertas</h4>',
          latest.length ? latest.map(offeringHistoryItem).join('') : '<p class="text-sm text-gray-500 bg-gray-50 rounded-xl p-4">Nenhuma oferta confirmada ainda.</p>',
        '</div>',
        '<div class="mt-5">',
          '<h4 class="font-bold text-gray-800 mb-2">Cofres ajudados</h4>',
          goalNames.length ? '<div class="flex flex-wrap gap-2">' + goalNames.map(name => '<span class="px-3 py-1 rounded-full bg-green-50 text-green-700 border border-green-100 text-xs font-bold">' + escapeHtml(name) + '</span>').join('') + '</div>' : '<p class="text-sm text-gray-500">Nenhum cofre ajudado ainda.</p>',
        '</div>',
      '</div>'
    ].join('');

    window.ADPELOfferingReportData = { userInfo: userInfo, offerings: offerings, total: total, goalNames: goalNames };
  } catch (error) {
    console.error('Erro ao carregar ofertas do perfil:', error);
    container.innerHTML = '<div class="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 text-sm text-gray-500">Nao foi possivel carregar suas ofertas agora.</div>';
  }
}

function offeringMetricCard(label, value, icon) {
  return '<div class="bg-green-50 rounded-xl p-4 border border-green-100"><div class="flex items-center gap-2 text-green-700 text-xs font-bold mb-2"><i class="fas ' + icon + '"></i>' + escapeHtml(label) + '</div><p class="text-xl font-bold text-gray-900">R$ ' + formatBRL(value) + '</p></div>';
}

function offeringHistoryItem(item) {
  const goal = item.fundraising_goals && item.fundraising_goals.name ? item.fundraising_goals.name : 'Oferta Livre';
  const date = formatDate(item.paid_at || item.created_at || '');
  return '<div class="flex items-center justify-between gap-3 py-3 border-t border-gray-100"><div class="min-w-0"><p class="font-semibold text-gray-800 truncate">' + escapeHtml(goal) + '</p><p class="text-xs text-gray-500">' + escapeHtml(date) + '</p></div><p class="font-bold text-green-700 whitespace-nowrap">R$ ' + formatBRL(item.amount) + '</p></div>';
}

function openOfferingReportModal() {
  const data = window.ADPELOfferingReportData;
  if (!data) return;
  const name = escapeHtml((data.userInfo.profile && data.userInfo.profile.full_name) || (data.userInfo.user && data.userInfo.user.email) || 'Membro');
  const modalId = 'offering-report-modal';
  let modal = document.getElementById(modalId);
  if (!modal) {
    modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4';
    document.body.appendChild(modal);
  }
  modal.innerHTML = [
    '<div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">',
      '<div class="bg-gradient-to-r from-green-700 to-emerald-500 p-6 text-white">',
        '<h3 class="text-2xl font-bold flex items-center gap-2"><i class="fas fa-file-lines"></i> Relatorio de Ofertas</h3>',
        '<p class="text-green-100 text-sm mt-1">Resumo das suas contribuicoes confirmadas.</p>',
      '</div>',
      '<div class="p-6 space-y-4" id="offering-report-print-area">',
        '<div><p class="text-xs text-gray-500">Nome</p><p class="font-bold text-gray-900">' + name + '</p></div>',
        '<div><p class="text-xs text-gray-500">Periodo</p><p class="font-bold text-gray-900">Historico disponivel</p></div>',
        '<div class="grid grid-cols-2 gap-3">',
          '<div class="bg-gray-50 rounded-xl p-4"><p class="text-xs text-gray-500">Total ofertado</p><p class="text-xl font-bold text-green-700">R$ ' + formatBRL(data.total) + '</p></div>',
          '<div class="bg-gray-50 rounded-xl p-4"><p class="text-xs text-gray-500">Quantidade</p><p class="text-xl font-bold text-gray-900">' + data.offerings.length + '</p></div>',
        '</div>',
        '<div><p class="text-xs text-gray-500">Cofres ajudados</p><p class="font-bold text-gray-900">' + (data.goalNames.length ? escapeHtml(data.goalNames.join(', ')) : 'Nenhum cofre destinado') + '</p></div>',
        '<p class="text-sm text-gray-600 bg-green-50 border border-green-100 rounded-xl p-4">Suas contribuicoes ajudam a manter a obra, fortalecer familias e expandir o Reino de Deus.</p>',
      '</div>',
      '<div class="px-6 pb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">',
        '<button onclick="printOfferingReport()" class="py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition"><i class="fas fa-print mr-2"></i>Imprimir / Salvar PDF</button>',
        '<button onclick="closeOfferingReportModal()" class="py-3 border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition">Fechar</button>',
      '</div>',
    '</div>'
  ].join('');
  restorePageScroll();
}

function closeOfferingReportModal() {
  const modal = document.getElementById('offering-report-modal');
  if (modal) modal.remove();
  restorePageScroll();
}

function printOfferingReport() {
  window.print();
}

Object.assign(window, {
  loadProfileData,
  renderProfile,
  renderProfileOfferings,
  offeringMetricCard,
  offeringHistoryItem,
  openOfferingReportModal,
  closeOfferingReportModal,
  printOfferingReport
});
