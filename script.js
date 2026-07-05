//=============================================================== script.js - ADPEL Digital Platform v3.0.0
//============== Funcoes de navegacao, renderizacao e interface

document.addEventListener('DOMContentLoaded', () => {
  // initAuth já é chamada por auth.js; aqui esperamos um pouco e carregamos a home
  setTimeout(() => {
    initApp();
    // Garantir que o banner seja atualizado após auth
    if (typeof updateBannerWelcome === 'function') {
      updateBannerWelcome();
    }
  }, 300);
  
  // Navegação por hash (links diretos)
  function handleHash() {
    const hash = window.location.hash.replace('#', '');
    if (hash && ['home','courses','library','certificate','cofres','ranking','profile'].includes(hash)) {
      navigateTo(hash);
    } else if (hash === 'studies') {
      navigateTo('courses');
    }
  }
  window.addEventListener('hashchange', handleHash);
  if (window.location.hash) handleHash();
  initMobileNavInteractions();
  initModalInteractions();
});

let currentSection = 'home';
let _lastHomeLoad = 0;
let _lastSectionLoads = {};
const SECTION_LOAD_DEBOUNCE = 2000;

function navigateTo(section) {
  if (section === 'studies') section = 'courses';
  // Seções que exigem login
  var restrictedSections = ['courses', 'library', 'certificate', 'profile'];
  var userInfo = getCurrentUserInfo();
  
  if (restrictedSections.indexOf(section) !== -1 && !userInfo.isLoggedIn) {
    openModal('login-modal');
    return;
  }

  const sections = ['home', 'courses', 'library', 'certificate', 'cofres', 'ranking', 'bible', 'profile'];
  sections.forEach(s => {
    const el = document.getElementById(s);
    if (el) el.classList.add('hidden');
  });
  const target = document.getElementById(section);
  if (target) {
    target.classList.remove('hidden');
    currentSection = section;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  loadSectionData(section);
  
  // Fechar sidebar mobile ao navegar
  if (window.innerWidth < 768) {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.add('hidden');
  }
  
  // Atualizar estado ativo da navegação mobile
  const mobileNav = document.getElementById('mobile-nav');
  if (mobileNav) {
    const groupMap = {
      home: 'home',
      courses: 'aprender',
      library: 'aprender',
      certificate: 'aprender',
      cofres: 'culto',
      ranking: 'culto',
      profile: 'home'
    };
    const activeGroup = groupMap[section] || section;
    mobileNav.querySelectorAll('.mobile-nav-btn').forEach(btn => {
      const btnGroup = btn.getAttribute('data-group');
      if (btnGroup === activeGroup) {
        btn.classList.add('text-adpel-600');
        btn.classList.remove('text-gray-600');
      } else {
        btn.classList.remove('text-adpel-600');
        btn.classList.add('text-gray-600');
      }
    });
  }
}

function loadSectionData(section) {
  const now = Date.now();
  if (_lastSectionLoads[section] && (now - _lastSectionLoads[section] < SECTION_LOAD_DEBOUNCE)) {
    console.log(`⏭️ loadSectionData(${section}) debounce`);
    return;
  }
  _lastSectionLoads[section] = now;
  switch(section) {
    case 'home': loadHomeData(); break;
    case 'courses': loadCoursesData(); break;
    case 'library': loadLibraryData(); break;
    case 'certificate': loadCertificatesData(); break;
    case 'cofres': if (typeof loadCofresData === 'function') loadCofresData(); break;
    case 'ranking': if (window.ADPELJourney && typeof window.ADPELJourney.renderRanking === 'function') window.ADPELJourney.renderRanking(); break;
    case 'bible': break; // busca manual pelo usuário
    case 'profile': loadProfileData(); break;
  }
}

async function initApp() {
  // O auth.js já inicializou a autenticação; aqui apenas esperamos a UI ficar pronta
  // e carregamos os dados da home.
  // Se auth.js ainda não terminou, esperamos um pouco.
  if (typeof currentUser === 'undefined') {
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  await loadHomeData();
  if (window.ADPELJourney && typeof window.ADPELJourney.init === 'function') {
    await window.ADPELJourney.init();
  }
  verificarAtualizacoesPendentes();
}

function isContentVisibleNow(item) {
  if (!window.ADPELDateUtils || typeof window.ADPELDateUtils.isWithinDateRange !== 'function') {
    return true;
  }
  return window.ADPELDateUtils.isWithinDateRange(item);
}

async function loadCertificatesData() {
  try {
    const userInfo = getCurrentUserInfo();
    if (!userInfo.isLoggedIn) { renderCertificatesList([]); return; }
    const certificates = await ADPEL.fetch.certificates();
    renderCertificatesList(certificates || []);
  } catch (e) {
    console.error(e);
    renderCertificatesList([]);
  }
}

async function loadProfileData() {
  const userInfo = getCurrentUserInfo();
  renderProfile(userInfo);
  await renderProfileOfferings(userInfo);
  if (window.ADPELJourney && typeof window.ADPELJourney.init === 'function') {
    await window.ADPELJourney.init();
  }
}

function renderCertificatesList(certificates) {
  const container = document.getElementById('certificates-list');
  if (!container) return;
  const isLoggedIn = getCurrentUserInfo().isLoggedIn;
  
  if (!isLoggedIn) {
    container.innerHTML = `
      <div class="col-span-full bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <i class="fas fa-lock text-2xl text-gray-400"></i>
        </div>
        <h3 class="font-semibold text-gray-800 mb-2">Área Exclusiva para Membros</h3>
        <p class="text-gray-500 text-sm mb-6">Faça login para visualizar seus certificados.</p>
        <button onclick="openModal('login-modal')" class="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">Entrar na Plataforma</button>
      </div>`;
    return;
  }
  
  if (!certificates || certificates.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
        <i class="fas fa-certificate text-4xl text-gray-300 mb-3"></i>
        <p class="text-gray-500 font-medium">Voce ainda nao possui certificados.</p>
        <p class="text-sm text-gray-400 mt-2">Ao finalizar seus cursos, eles aparecerao aqui.</p>
      </div>`;
    return;
  }
  container.innerHTML = certificates.map(cert => {
    const certTitle = escapeHtml(cert.title || 'Certificado');
    const certDesc = escapeHtml(cert.description || 'Certificado de conclusão');
    return `
    <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-lg transition">
      <div class="flex items-center gap-4">
        <div class="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
          <i class="fas fa-certificate text-2xl text-yellow-600"></i>
        </div>
        <div>
          <h4 class="font-bold text-gray-800">${certTitle}</h4>
          <p class="text-sm text-gray-500 mt-1">${certDesc}</p>
        </div>
      </div>
      <button onclick="viewCertificate('${encodeURIComponent(JSON.stringify(cert))}')" class="mt-4 w-full py-2 bg-yellow-50 text-yellow-700 rounded-lg text-sm font-medium hover:bg-yellow-100 transition flex items-center justify-center gap-2">
        <i class="fas fa-eye"></i> Visualizar Certificado
      </button>
    </div>
  `}).join('');
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

function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function parseLocalDate(dateString) {
  if (!dateString) return null;
  const s = String(dateString).trim().toLowerCase();
  if (s === 'null' || s === 'undefined' || s === '') return null;
  const parts = s.split('T')[0].split('-');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return new Date(year, month, day);
}

function formatDate(isoString) {
  if (!isoString) return '';
  const s = String(isoString).trim().toLowerCase();
  if (s === 'null' || s === 'undefined' || s === '') return '';
  const dateOnly = s.split('T')[0];
  const parts = dateOnly.split('-');
  if (parts.length !== 3) return '';
  const year = parts[0] || '';
  const month = parts[1] || '';
  const day = parts[2] || '';
  if (!year || !month || !day) return '';
  return `${day}/${month}/${year}`;
}

function getMonthName(monthStr) {
  if (!monthStr) return '';
  const s = String(monthStr).trim().toLowerCase();
  if (s === 'null' || s === 'undefined' || s === '') return '';
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const idx = parseInt(s, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= months.length) return '';
  return months[idx];
}



function scrollContainer(id, amount) {
  const el = document.getElementById(id);
  if (el) el.scrollBy({ left: amount, behavior: 'smooth' });
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.toggle('hidden');
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    restorePageScroll();
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
  }
}

// ==========================
// COURSE MODAL / LESSONS
// ==========================

let ofertaValorSelecionado = 0;
let ofertaTipo = null; // 'livre' ou 'destinada'
let ofertaCofreSelecionado = null; // objeto do cofre escolhido
let ofertaIdRegistrado = null; // ID da contribuição registrada
let ofertaEtapaAtual = 1; // 1=tipo, 2=cofres, 3=valor, 4=pix, 5=sucesso

function restorePageScroll() {
  document.body.style.overflow = '';
  document.body.classList.remove('overflow-hidden');
  document.documentElement.style.overflow = '';
  document.documentElement.classList.remove('overflow-hidden');
}

function openOfertaModal(options) {
  options = options || {};
  const modal = document.getElementById('oferta-modal');
  if (modal) {
    if (modal.parentElement !== document.body) {
      document.body.appendChild(modal);
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    restorePageScroll();
  }
  // Esconder footer no mobile para não aparecer atrás do modal
  const footer = document.querySelector('footer');
  if (footer) footer.classList.add('hidden');
  
  resetOfertaSelecao();
  mostrarEtapa('tipo');
  
  // Carregar cofres se necessário
  if (typeof loadCofresData === 'function' && (!Array.isArray(cofresData) || cofresData.length === 0)) {
    loadCofresData().then(() => {
      console.log('✅ Cofres carregados para o modal');
    });
  }
}

function openOfertaModalForCofre(goalId) {
  const userInfo = getCurrentUserInfo();
  if (!userInfo.isLoggedIn) {
    showToast('Faca login para contribuir.', 'warning');
    openModal('login-modal');
    restorePageScroll();
    return;
  }
  const abrir = function() {
    openOfertaModal();
    abrirOfertaDestinadaParaCofre(goalId);
  };
  if (typeof loadCofresData === 'function' && (!Array.isArray(cofresData) || cofresData.length === 0)) {
    loadCofresData().then(abrir).catch(abrir);
  } else {
    abrir();
  }
}

function abrirOfertaDestinadaParaCofre(goalId) {
  ofertaTipo = 'destinada';
  renderCofresNoModal();
  selecionarCofreOferta(goalId);
}

function selecionarTipoOferta(tipo) {
  ofertaTipo = tipo;
  
  if (tipo === 'destinada') {
    // Mostrar etapa de cofres
    mostrarEtapa('cofres');
    renderCofresNoModal();
  } else {
    // Oferta livre: ir direto para valor
    mostrarEtapa('valor');
  }
}

function voltarEtapaTipo() {
  ofertaTipo = null;
  ofertaCofreSelecionado = null;
  mostrarEtapa('tipo');
}

function renderCofresNoModal() {
  var container = document.getElementById('oferta-cofres-lista');
  if (!container) return;
  
  // Usar cofresData do fundraising.js ou buscar
  var cofres = (typeof cofresData !== 'undefined' && Array.isArray(cofresData)) ? cofresData : [];
  
  if (cofres.length === 0) {
    container.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">Nenhum cofre ativo no momento.</p>';
    return;
  }
  
  container.innerHTML = cofres.map(function(cofre) {
    if (!cofre || !cofre.id) return '';
    var stats = (typeof cofresStats !== 'undefined' && cofresStats[cofre.id]) ? cofresStats[cofre.id] : {};
    var currentAmount = parseFloat(stats.current_amount) || 0;
    var targetAmount = parseFloat(cofre.target_amount) || 0;
    var progressPct = targetAmount > 0 ? Math.min(100, Math.round((currentAmount / targetAmount) * 100)) : 0;
    var isComplete = progressPct >= 100;
    
    var nomeSeguro = (cofre.name && cofre.name !== 'undefined' && cofre.name !== 'null') ? cofre.name : 'Cofre';
    
    return '<button onclick="selecionarCofreOferta(\'' + cofre.id + '\')" ' +
      'class="w-full p-3 border-2 border-gray-200 rounded-xl text-left hover:border-green-500 hover:bg-green-50 transition group" ' +
      (isComplete ? 'disabled' : '') + '>' +
      '<div class="flex items-center justify-between">' +
      '<div class="flex-1">' +
      '<p class="font-semibold text-gray-800 text-sm">' + escapeHtml(nomeSeguro) + '</p>' +
      '<div class="mt-1 w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">' +
      '<div class="h-1.5 rounded-full ' + (isComplete ? 'bg-gray-400' : 'bg-green-500') + '" style="width:' + progressPct + '%"></div>' +
      '</div>' +
      '<p class="text-xs text-gray-500 mt-1">R$ ' + (typeof formatBRL === 'function' ? formatBRL(currentAmount) : currentAmount.toFixed(2)) + ' / R$ ' + (typeof formatBRL === 'function' ? formatBRL(targetAmount) : targetAmount.toFixed(2)) + '</p>' +
      '</div>' +
      '<i class="fas fa-chevron-right text-gray-400 ml-2"></i>' +
      '</div>' +
      '</button>';
  }).join('');
}

function selecionarCofreOferta(cofreId) {
  // Buscar o cofre nos dados
  var cofres = (typeof cofresData !== 'undefined' && Array.isArray(cofresData)) ? cofresData : [];
  var cofre = cofres.find(function(c) { return c.id === cofreId; });
  if (!cofre) {
    showToast('Cofre não encontrado.', 'error');
    return;
  }
  
  ofertaCofreSelecionado = cofre;
  // Avançar para etapa de valor
  mostrarEtapa('valor');
  
  showToast('Cofre selecionado: ' + (cofre.name || 'Objetivo'), 'info');
}

function closeOfertaModal() {
  const modal = document.getElementById('oferta-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    restorePageScroll();
  }
  // Restaurar footer
  const footer = document.querySelector('footer');
  if (footer) footer.classList.remove('hidden');
  
  resetOfertaSelecao();
  // Garantir que volte para etapa tipo na próxima abertura
  mostrarEtapa('tipo');
}

function mostrarEtapa(etapa) {
  const etapas = {
    'tipo': document.getElementById('oferta-etapa-tipo'),
    'cofres': document.getElementById('oferta-etapa-cofres'),
    'valor': document.getElementById('oferta-etapa-valor'),
    'pix': document.getElementById('oferta-pix-container'),
    'sucesso': document.getElementById('oferta-sucesso')
  };
  
  // Esconder todas
  Object.values(etapas).forEach(el => { if (el) el.classList.add('hidden'); });
  
  // Mostrar a etapa desejada
  if (etapas[etapa]) {
    etapas[etapa].classList.remove('hidden');
    ofertaEtapaAtual = ['tipo','cofres','valor','pix','sucesso'].indexOf(etapa) + 1;
  }
}

function resetOfertaSelecao() {
  ofertaValorSelecionado = 0;
  ofertaTipo = null;
  ofertaCofreSelecionado = null;
  ofertaIdRegistrado = null;
  ofertaEtapaAtual = 1;
  
  document.querySelectorAll('.oferta-valor-btn').forEach(btn => {
    btn.classList.remove('border-green-500', 'bg-green-50', 'text-green-700');
    btn.classList.add('border-gray-200', 'text-gray-700');
  });
  const personalizado = document.getElementById('oferta-personalizado');
  if (personalizado) personalizado.value = '';
  const valorSelecionado = document.getElementById('oferta-valor-selecionado');
  if (valorSelecionado) valorSelecionado.classList.add('hidden');
  
  // Resetar área PIX
  const pixContainer = document.getElementById('oferta-pix-container');
  const pixQrcode = document.getElementById('pix-qrcode');
  const pixCodigo = document.getElementById('pix-codigo');
  const sucesso = document.getElementById('oferta-sucesso');
  if (pixContainer) pixContainer.classList.add('hidden');
  if (pixQrcode) pixQrcode.src = '';
  if (pixCodigo) pixCodigo.value = '';
  if (sucesso) sucesso.classList.add('hidden');
  
  atualizarBotaoOferta();
}

function selectOfertaValor(valor) {
  ofertaValorSelecionado = valor;
  document.getElementById('oferta-personalizado').value = '';
  
  document.querySelectorAll('.oferta-valor-btn').forEach(btn => {
    const btnValor = parseFloat(btn.getAttribute('data-valor'));
    if (btnValor === valor) {
      btn.classList.add('border-green-500', 'bg-green-50', 'text-green-700');
      btn.classList.remove('border-gray-200', 'text-gray-700');
    } else {
      btn.classList.remove('border-green-500', 'bg-green-50', 'text-green-700');
      btn.classList.add('border-gray-200', 'text-gray-700');
    }
  });
  
  mostrarValorSelecionado();
  atualizarBotaoOferta();
}

function onOfertaPersonalizadoChange() {
  const input = document.getElementById('oferta-personalizado');
  const val = parseFloat(input.value);
  if (!isNaN(val) && val > 0) {
    ofertaValorSelecionado = val;
    document.querySelectorAll('.oferta-valor-btn').forEach(btn => {
      btn.classList.remove('border-green-500', 'bg-green-50', 'text-green-700');
      btn.classList.add('border-gray-200', 'text-gray-700');
    });
    mostrarValorSelecionado();
    atualizarBotaoOferta();
  } else {
    ofertaValorSelecionado = 0;
    document.getElementById('oferta-valor-selecionado').classList.add('hidden');
    atualizarBotaoOferta();
  }
}

function mostrarValorSelecionado() {
  const display = document.getElementById('oferta-valor-display');
  const container = document.getElementById('oferta-valor-selecionado');
  if (display && container && ofertaValorSelecionado > 0) {
    display.textContent = `R$ ${ofertaValorSelecionado.toFixed(2).replace('.', ',')}`;
    container.classList.remove('hidden');
  }
}

function atualizarBotaoOferta() {
  const btn = document.getElementById('oferta-pagar-btn');
  if (!btn) return;
  if (ofertaValorSelecionado > 0) {
    btn.disabled = false;
    btn.className = 'w-full py-4 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 transition-all duration-300 shadow-md';
    btn.innerHTML = '<i class="fas fa-arrow-right mr-2"></i> Continuar para Pagamento';
  } else {
    btn.disabled = true;
    btn.className = 'w-full py-4 bg-gray-300 text-gray-500 rounded-xl font-bold text-lg transition-all duration-300 cursor-not-allowed';
    btn.innerHTML = '<i class="fas fa-lock mr-2"></i> Selecione um valor';
  }
}

async function processarOferta() {
  if (ofertaValorSelecionado <= 0) {
    showToast('Selecione um valor para ofertar.', 'warning');
    return;
  }
  
  // A oferta destinada tambem sera registrada somente ao confirmar pagamento.
  if (false && ofertaTipo === 'destinada' && ofertaCofreSelecionado) {
    const userInfo = getCurrentUserInfo();
    if (userInfo.isLoggedIn && userInfo.user) {
      try {
        const { data, error } = await window.supabaseClient
          .from('fundraising_contributions')
          .insert([{
            goal_id: ofertaCofreSelecionado.id,
            user_id: userInfo.user.id,
            amount: ofertaValorSelecionado,
            anonymous: false
          }])
          .select('id');
          
        if (error) throw error;
        
        if (data && data.length > 0) {
          ofertaIdRegistrado = data[0].id;
          console.log('✅ Oferta registrada ID:', ofertaIdRegistrado);
        }
      } catch (e) {
        console.error('Erro ao registrar oferta destinada:', e);
        // Não bloqueia - continua para gerar PIX mesmo se falhar registro
      }
    }
  }
  
  // Mostrar etapa PIX
  mostrarEtapa('pix');
  
  // Atualizar label do destino no container PIX
  const pixContainer = document.getElementById('oferta-pix-container');
  if (pixContainer) {
    // Adicionar label de destino se não existir
    var destinoEl = document.getElementById('pix-destino-label');
    if (!destinoEl) {
      destinoEl = document.createElement('p');
      destinoEl.id = 'pix-destino-label';
      destinoEl.className = 'text-sm text-gray-600 text-center mb-2';
      pixContainer.insertBefore(destinoEl, pixContainer.firstChild);
    }
    if (ofertaTipo === 'destinada' && ofertaCofreSelecionado) {
      destinoEl.textContent = 'Destino: ' + (ofertaCofreSelecionado.name || 'Cofre');
    } else {
      destinoEl.textContent = 'Oferta Livre - ADPEL';
    }
  }
  
  // Gerar payload PIX (com identificador se for oferta destinada)
  var descricaoRaw = '';
  if (ofertaTipo === 'destinada' && ofertaCofreSelecionado) {
    var nomeCofre = String(ofertaCofreSelecionado.name || 'Cofre');
    // Limpar nome do cofre contra corrupção
    nomeCofre = nomeCofre
      .replace(/undefinednull/gi, '')
      .replace(/undefined/gi, '')
      .replace(/\bnull\b/gi, '')
      .trim();
    if (!nomeCofre || nomeCofre.length < 1) nomeCofre = 'Cofre';
    descricaoRaw = 'OFERTA ' + nomeCofre;
  } else {
    descricaoRaw = 'OFERTA ADPEL';
  }
  // Sanitizar descrição final (apenas alfanumérico, já será sanitizado em sanitizarTxId)
  var descricao = String(descricaoRaw)
    .replace(/undefinednull/gi, '')
    .replace(/undefined/gi, '')
    .replace(/\bnull\b/gi, '')
    .trim();
  if (!descricao || descricao.length < 2) descricao = 'OFERTAADPEL';
  
  const pixPayload = gerarPixPayload(ofertaValorSelecionado, descricao);
  console.log('🔑 PIX PAYLOAD:', pixPayload);
  
  // Exibir código PIX no textarea
  document.getElementById('pix-codigo').value = pixPayload;
  
  // Gerar QR Code
  const qrImage = document.getElementById('pix-qrcode');
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixPayload)}&margin=10`;
  qrImage.src = qrUrl;
  qrImage.alt = 'QR Code PIX';
  
  // Atualizar valor exibido
  document.getElementById('pix-valor-display').textContent = ofertaValorSelecionado.toFixed(2).replace('.', ',');
  
  showToast('QR Code PIX gerado com sucesso!', 'success');
}

// ==========================
// FUNÇÕES PIX - BR Code EMV
// ==========================

// ==========================
// CONSTANTES PIX (configure aqui)
// ==========================
const PIX_KEY  = 'adpel.ssantoandre@gmail.com';  // Chave PIX da igreja (email)
const PIX_NAME = 'ADPEL ASSEMBLEIA DE DEUS';     // Máximo 25 caracteres, sem acentos
const PIX_CITY = 'GOIANIA';                      // Sem acentos, máximo 15 caracteres

function emv(id, value) {
   value = String(value)
       .normalize('NFC')
       .trim();
   const length = [...value].length;
   return (
       id +
       String(length).padStart(2, '0') +
       value
   );
}

function gerarPixPayload(valor, descricao) {

  const pixKey = PIX_KEY;

  const merchantNameClean = String(PIX_NAME)
    .normalize('NFC')
    .trim()
    .toUpperCase()
    .substring(0, 25);

  const cityClean = String(PIX_CITY)
    .normalize('NFC')
    .trim()
    .toUpperCase()
    .substring(0, 15);

  let payload =

    emv('00', '01') +

    emv(
      '26',
      emv('00', 'BR.GOV.BCB.PIX') +
      emv('01', pixKey)
    ) +

    emv('52', '0000') +
    emv('53', '986') +
    emv('54', Number(valor).toFixed(2)) +
    emv('58', 'BR') +
    emv('59', merchantNameClean) +
    emv('60', cityClean) +

    // TXID obrigatório para maior compatibilidade
    emv(
      '62',
      emv('05', '***')
    );

  payload += '6304';

  payload += calcularCRC16(payload)
    .toUpperCase()
    .padStart(4, '0');

  console.log('🔑 PIX PAYLOAD:', payload);

  return payload;
}
  


// Função auxiliar para remover acentos
function removerAcentos(str) {
  if (!str) return '';
  return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function sanitizarTxId(descricao) {
   if (!descricao) return '';
   let limpo = removerAcentos(descricao);
   // Remove tudo que não for letra, número ou espaço
   limpo = limpo.replace(/[^A-Za-z0-9 ]/g, '');
   // Remove espaços extras
   limpo = limpo.replace(/\s+/g, ' ').trim();
   // Limita a 25 caracteres
   limpo = limpo.substring(0, 25);
   // Se ficou vazio, usa fallback
   if (limpo.length === 0) limpo = 'OFERTA' + Date.now().toString(36).substring(0, 10);
   return limpo.toUpperCase();
}

function calcularCRC16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc.toString(16)
    .padStart(4, '0')
    .toUpperCase();
}

function copiarPix() {
  const textarea = document.getElementById('pix-codigo');
  if (!textarea) return;
  
  textarea.select();
  textarea.setSelectionRange(0, 99999); // Mobile
  
  try {
    navigator.clipboard.writeText(textarea.value).then(() => {
      showToast('Código PIX copiado! Cole no seu app bancário.', 'success');
    }).catch(() => {
      // Fallback para navegadores antigos
      document.execCommand('copy');
      showToast('Código PIX copiado!', 'success');
    });
  } catch (e) {
    document.execCommand('copy');
    showToast('Código PIX copiado!', 'success');
  }
  
  // Desselecionar
  window.getSelection().removeAllRanges();
}

function gerarCodigoReciboOferta() {
  return 'ADPEL-' + Date.now().toString(36).toUpperCase();
}

function isOfferingSchemaError(error) {
  const text = String(error && (error.message || error.details || error.hint || error.code) || '').toLowerCase();
  return text.indexOf('contribution_type') !== -1 ||
    text.indexOf('receipt_code') !== -1 ||
    text.indexOf('paid_at') !== -1 ||
    text.indexOf('status') !== -1 ||
    text.indexOf('42703') !== -1 ||
    text.indexOf('pgrst204') !== -1;
}

async function registrarOfertaConfirmada() {
  if (ofertaIdRegistrado) return ofertaIdRegistrado;
  const userInfo = getCurrentUserInfo();
  if (!userInfo.isLoggedIn || !userInfo.user) {
    showToast('Faca login para registrar sua oferta.', 'warning');
    return null;
  }

  const isDestinada = ofertaTipo === 'destinada' && ofertaCofreSelecionado && ofertaCofreSelecionado.id;
  const payload = {
    goal_id: isDestinada ? ofertaCofreSelecionado.id : null,
    user_id: userInfo.user.id,
    amount: ofertaValorSelecionado,
    anonymous: false,
    contribution_type: isDestinada ? 'destinada' : 'livre',
    status: 'confirmed',
    receipt_code: gerarCodigoReciboOferta(),
    paid_at: new Date().toISOString()
  };

  let result = await window.supabaseClient
    .from('fundraising_contributions')
    .insert([payload]);

  if (result.error && isOfferingSchemaError(result.error)) {
    console.warn('Banco local sem colunas novas de ofertas. Usando registro compativel:', result.error);
    result = await window.supabaseClient
      .from('fundraising_contributions')
      .insert([{
        goal_id: payload.goal_id,
        user_id: payload.user_id,
        amount: payload.amount,
        anonymous: payload.anonymous
      }]);
  }

  if (result.error) throw result.error;
  ofertaIdRegistrado = payload.receipt_code;

  if (isDestinada) {
    await atualizarEstatisticasCofre(ofertaCofreSelecionado.id, ofertaValorSelecionado);
  }

  if (currentSection === 'profile') {
    renderProfileOfferings(userInfo);
  }

  return ofertaIdRegistrado;
}

async function atualizarEstatisticasCofre(goalId, amount) {
  // O banco atualiza fundraising_stats por trigger apos inserir em fundraising_contributions.
  // No frontend, apenas recarregamos os dados para refletir o novo progresso do cofre.
  if (!goalId) return;
  if (typeof loadCofresData === 'function') {
    await loadCofresData();
    return;
  }
  if (typeof renderCofresSection === 'function') renderCofresSection();
  if (typeof renderCofresNoModal === 'function') renderCofresNoModal();
}

async function confirmarPagamento() {
  try {
    await registrarOfertaConfirmada();
  } catch (e) {
    console.error('Erro ao registrar oferta confirmada:', e);
    showToast('Erro ao registrar oferta. Tente novamente.', 'error');
    return;
  }

  // Registrar oferta livre no banco (se não foi registrada antes)
  if (false && ofertaTipo === 'livre' && !ofertaIdRegistrado) {
    const userInfo = getCurrentUserInfo();
    if (userInfo.isLoggedIn && userInfo.user) {
      try {
        // Para ofertas livres, registramos na tabela de contribuições com goal_id null
        // ou podemos criar uma tabela separada no futuro
        const { data, error } = await window.supabaseClient
          .from('fundraising_contributions')
          .insert([{
            goal_id: null, // oferta livre (sem cofre)
            user_id: userInfo.user.id,
            amount: ofertaValorSelecionado,
            anonymous: false
          }])
          .select('id');
          
        if (error) {
          console.warn('Erro ao registrar oferta livre:', error);
          // Não bloqueia
        }
        
        if (data && data.length > 0) {
          ofertaIdRegistrado = data[0].id;
          console.log('✅ Oferta livre registrada ID:', ofertaIdRegistrado);
        }
      } catch (e) {
        console.error('Erro ao registrar oferta livre:', e);
      }
    }
  }
  
  // Exibir etapa de sucesso
  mostrarEtapa('sucesso');
  
  // Se for destinada, recarregar dados dos cofres
  if (ofertaTipo === 'destinada' && typeof loadCofresData === 'function') {
    await loadCofresData();
  }
  
  // Personalizar mensagem
  const msgEl = document.getElementById('oferta-sucesso-msg');
  const idEl = document.getElementById('oferta-id-registrado');
  
  if (msgEl) {
    if (ofertaTipo === 'destinada' && ofertaCofreSelecionado) {
      msgEl.textContent = 'Sua oferta foi destinada para "' + (ofertaCofreSelecionado.name || 'Cofre') + '". Deus abençoe!';
    } else {
      msgEl.textContent = '"Senhor, eu devolvo, porque sei que o Senhor me deu primeiro"';
    }
  }
  
  // Mostrar ID para referência futura (preparação para API de verificação)
  if (idEl && ofertaIdRegistrado) {
    idEl.textContent = 'Ref: ' + ofertaIdRegistrado;
  } else if (idEl) {
    idEl.textContent = '';
  }
  
  showToast('Deus abençoe sua oferta!', 'success');
  if (window.ADPELJourney && typeof window.ADPELJourney.registerSpiritualActivity === 'function') {
    window.ADPELJourney.registerSpiritualActivity('offering_made');
  } else if (window.ADPELJourney && typeof window.ADPELJourney.registerOffering === 'function') {
    window.ADPELJourney.registerOffering();
  }
  
  // TODO: Futuramente, aqui será feita a verificação via API de pagamento
  // Exemplo:
  // await verificarPagamentoPIX(ofertaIdRegistrado);
  // ou webhook receberá a confirmação e atualizará o status no banco
}

// ==========================
// CERTIFICATE BUILDER & VIEWER
// ==========================

function buildCertificateHTML({ userName, certTitle, courseTitle, description, duration, completedDate, logoUrl }) {
  // Fallbacks seguros para evitar undefined/null no certificado
  const safeUserName = userName || 'Estudante';
  const safeCertTitle = certTitle || 'Certificado de Conclusão';
  const safeCourseTitle = courseTitle || 'Curso';
  const safeDescription = description || 'concluiu com êxito o curso de';
  const safeDuration = duration || null;
  const safeCompletedDate = completedDate || new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  const safeLogoUrl = logoUrl || '';

  return `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(safeCertTitle)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      @page { size: 210mm 297mm; margin: 0; }
      body { 
        font-family: 'Inter', sans-serif; 
        background: #e5e7eb; 
        display: flex; 
        justify-content: center; 
        align-items: center; 
        min-height: 100vh; 
        padding: 12px;
      }
      .cert-frame {
        background: #fffbeb;
        border: 10px double #d97706;
        padding: 32px 48px;
        width: 210mm;
        height: 297mm;
        max-width: 210mm;
        max-height: 297mm;
        position: relative;
        box-shadow: 0 25px 80px rgba(0,0,0,0.25);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        overflow: hidden;
      }
      .cert-inner-border {
        position: absolute;
        inset: 8px;
        border: 2px solid #d97706;
        opacity: 0.4;
        pointer-events: none;
      }
      .watermark {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.04;
        pointer-events: none;
      }
      .watermark img { width: 320px; height: auto; }
      .header { text-align: center; position: relative; z-index: 1; }
      .logo { width: 72px; height: 72px; margin: 0 auto 12px; border-radius: 50%; overflow: hidden; border: 3px solid #d97706; background: white; }
      .logo img { width: 100%; height: 100%; object-fit: cover; }
      .institution { font-size: 0.8rem; letter-spacing: 3px; text-transform: uppercase; color: #92400e; font-weight: 600; margin-bottom: 6px; }
      h1 { font-family: 'Playfair Display', serif; font-size: 2.2rem; color: #1e3a8a; font-weight: 700; margin-bottom: 6px; letter-spacing: 1px; }
      .subtitle { font-family: 'Playfair Display', serif; font-size: 1rem; color: #92400e; font-style: italic; }
      .body { text-align: center; position: relative; z-index: 1; flex: 1; display: flex; flex-direction: column; justify-content: center; }
      .body p { font-size: 1rem; color: #475569; line-height: 1.7; margin-bottom: 10px; }
      .recipient { 
        font-family: 'Playfair Display', serif; 
        font-size: 1.9rem; 
        color: #1e3a8a; 
        font-weight: 700; 
        margin: 16px 0; 
        display: inline-block;
        border-bottom: 2px solid #d97706;
        padding-bottom: 6px;
      }
      .course-name { 
        font-family: 'Playfair Display', serif; 
        font-size: 1.3rem; 
        color: #b45309; 
        font-weight: 700; 
        margin: 12px 0; 
      }
      .details { font-size: 0.9rem; color: #64748b; margin-top: 12px; }
      .footer { 
        display: flex; 
        justify-content: center; 
        align-items: flex-end; 
        position: relative; 
        z-index: 1; 
        gap: 48px;
        padding-bottom: 8px;
      }
      .signature { text-align: center; min-width: 160px; }
      .signature-line { border-top: 1px solid #1e3a8a; width: 100%; margin: 0 auto 8px; padding-top: 8px; }
      .signature-name { font-weight: 600; color: #1e3a8a; font-size: 0.85rem; }
      .signature-role { font-size: 0.75rem; color: #92400e; text-transform: uppercase; letter-spacing: 1px; margin-top: 3px; }
      .seal { 
        width: 100px; 
        height: 100px; 
        border: 3px solid #d97706; 
        border-radius: 50%; 
        display: flex; 
        flex-direction: column;
        align-items: center; 
        justify-content: center; 
        color: #92400e; 
        font-weight: 700; 
        font-size: 0.65rem; 
        text-transform: uppercase; 
        letter-spacing: 1px;
        flex-shrink: 0;
        background: rgba(255,251,235,0.8);
        position: relative;
        margin-bottom: 4px;
      }
      .seal::before {
        content: '';
        position: absolute;
        inset: 5px;
        border: 1px solid #d97706;
        border-radius: 50%;
        opacity: 0.5;
      }
      .date { text-align: center; font-size: 0.85rem; color: #64748b; position: relative; z-index: 1; margin-bottom: 8px; }
      @media print { 
        body { background: white; padding: 0; margin: 0; } 
        .cert-frame { box-shadow: none; border-color: #d97706 !important; width: 210mm !important; height: 297mm !important; max-width: 210mm !important; max-height: 297mm !important; overflow: hidden !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; page-break-inside: avoid; break-inside: avoid; } 
        .no-print { display: none !important; } 
      }
      @media (max-width: 900px) {
        body { padding: 8px; }
        .cert-frame { width: 100%; height: auto; min-height: 297mm; padding: 24px; }
        h1 { font-size: 1.6rem; }
        .recipient { font-size: 1.4rem; }
        .course-name { font-size: 1.1rem; }
        .footer { gap: 24px; flex-wrap: wrap; }
        .seal { width: 85px; height: 85px; }
      }
    </style>
  </head>
  <body>
    <div class="cert-frame">
      <div class="cert-inner-border"></div>
      <div class="watermark">
        <img src="${safeLogoUrl}" alt="">
      </div>
      <div class="header">
        <div class="logo"><img src="${safeLogoUrl}" alt="ADPEL"></div>
        <div class="institution">Assembleia de Deus &mdash; Campo Pedro Ludovico</div>
        <h1>${escapeHtml(safeCertTitle)}</h1>
        <div class="subtitle">ADPEL Digital &mdash; Plataforma de Discipulado</div>
      </div>
      <div class="body">
        <p>Certificamos que</p>
        <div class="recipient">${escapeHtml(safeUserName)}</div>
        <p>${escapeHtml(safeDescription)}</p>
        <div class="course-name">${escapeHtml(safeCourseTitle)}</div>
        <p class="details">Carga horária de ${safeDuration ? safeDuration + ' horas' : 'não especificada'} &bull; Concluído em ${safeCompletedDate}</p>
      </div>
      <div class="date">Goiânia, ${safeCompletedDate}</div>
      <div class="footer">
        <div class="signature">
          <div class="signature-line"></div>
          <div class="signature-name">Pr. Presidente</div>
          <div class="signature-role">Diretor de Ensino</div>
        </div>
        <div class="seal">
          <span>ADPEL</span>
          <span style="font-size:1rem; color:#d97706; margin:3px 0;">&#10013;</span>
          <span>Digital</span>
        </div>
        <div class="signature">
          <div class="signature-line"></div>
          <div class="signature-name">Secretaria ADPEL</div>
          <div class="signature-role">Validação Digital</div>
        </div>
      </div>
    </div>
    <div class="no-print" style="position:fixed; bottom:20px; left:50%; transform:translateX(-50%); display:flex; gap:12px;">
      <button onclick="window.print()" style="padding:12px 24px; background:#1e3a8a; color:white; border:none; border-radius:10px; cursor:pointer; font-size:0.95rem; font-weight:600; box-shadow:0 4px 15px rgba(30,58,138,0.3);">Imprimir / Salvar PDF</button>
    </div>
  </body>
  </html>`;
}

function openCertificateViewModal() {
  const modal = document.getElementById('certificate-view-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
  }
}

function closeCertificateViewModal() {
  const modal = document.getElementById('certificate-view-modal');
  const iframe = document.getElementById('certificate-iframe');
  if (iframe) iframe.srcdoc = '';
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
  }
}

function printCurrentCertificate() {
  const iframe = document.getElementById('certificate-iframe');
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.print();
  }
}

async function viewCertificate(encodedCert) {
  let cert;
  try {
    cert = JSON.parse(decodeURIComponent(encodedCert));
  } catch (e) {
    console.error('Erro ao visualizar certificado:', e);
    return;
  }

  const userInfo = getCurrentUserInfo();
  const userName = cert.certificate_data?.user_name || userInfo.profile?.full_name || userInfo.user?.email || 'Estudante';
  const certTitle = cert.title || 'Certificado de Conclusão';
  const courseTitle = cert.certificate_data?.course_title || cert.title || 'Curso';
  const description = cert.certificate_data?.description || cert.description || 'concluiu com êxito o curso de';
  const duration = cert.certificate_data?.course_duration || '';
  const certDateRaw = cert.completed_at || cert.created_at;
  const completedDate = certDateRaw
    ? new Date(certDateRaw).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  const logoUrl = 'https://huggingface.co/spaces/IzaqueE/deepsite-project-6tv0m/resolve/main/images/adpel.logo.png';

  const html = buildCertificateHTML({
    userName,
    certTitle,
    courseTitle,
    description,
    duration,
    completedDate,
    logoUrl
  });

  const iframe = document.getElementById('certificate-iframe');
  if (iframe) {
    iframe.srcdoc = html;
  }
  openCertificateViewModal();
}

// Fechar modal ao clicar fora
document.addEventListener('click', (e) => {
  const ofertaModal = document.getElementById('oferta-modal');
  if (ofertaModal && !ofertaModal.classList.contains('hidden') && e.target === ofertaModal) {
    closeOfertaModal();
  }
});

// Fechar modal ao clicar fora do conteúdo
document.addEventListener('click', (e) => {
  const modal = document.getElementById('course-modal');
  if (modal && !modal.classList.contains('hidden') && e.target === modal) {
    closeCourseModal();
  }
  const studyModal = document.getElementById('study-modal');
  if (studyModal && !studyModal.classList.contains('hidden') && e.target === studyModal) {
    closeStudyModal();
  }
});

function toggleMobileMenu(menuId) {
  const menu = document.getElementById(menuId);
  const otherId = menuId === 'menu-aprender' ? 'menu-culto' : 'menu-aprender';
  const other = document.getElementById(otherId);
  if (other) other.classList.add('hidden');
  if (menu) menu.classList.toggle('hidden');
}

function closeMobileSubmenus() {
  const m1 = document.getElementById('menu-aprender');
  const m2 = document.getElementById('menu-culto');
  if (m1) m1.classList.add('hidden');
  if (m2) m2.classList.add('hidden');
}

function initMobileNavInteractions() {
  const mobileNav = document.getElementById('mobile-nav');
  if (!mobileNav) return;

  document.addEventListener('click', (event) => {
    if (mobileNav.contains(event.target)) return;
    closeMobileSubmenus();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMobileSubmenus();
    }
  });
}

function initModalInteractions() {
  const modalIds = [
    'login-modal',
    'register-modal',
    'course-modal',
    'study-modal',
    'oferta-modal',
    'contribution-modal',
    'certificate-view-modal'
  ];

  modalIds.forEach((modalId) => {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeModalById(modalId);
      }
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    const openModal = modalIds
      .map((modalId) => document.getElementById(modalId))
      .filter((modal) => modal && !modal.classList.contains('hidden'))
      .pop();

    if (openModal) {
      closeModalById(openModal.id);
    }
  });
}

function closeModalById(modalId) {
  const closers = {
    'course-modal': 'closeCourseModal',
    'study-modal': 'closeStudyModal',
    'oferta-modal': 'closeOfertaModal',
    'contribution-modal': 'closeContributionModal',
    'certificate-view-modal': 'closeCertificateViewModal'
  };
  const closerName = closers[modalId];

  if (closerName && typeof window[closerName] === 'function') {
    window[closerName]();
    return;
  }

  if (typeof closeModal === 'function') {
    closeModal(modalId);
  }
}

function toggleSidebarGroup(groupId) {
  const el = document.getElementById(groupId);
  const icon = document.getElementById(groupId + '-icon');
  if (el) el.classList.toggle('hidden');
  if (icon) icon.classList.toggle('rotate-180');
}
