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
const bookUrls = {};
let _lastHomeLoad = 0;
let _lastSectionLoads = {};
const SECTION_LOAD_DEBOUNCE = 2000;
let ytPlayer = null;
let currentCourseForPlayer = null;
let currentLessonIndexForPlayer = null;
let currentOpenCourse = null;
let currentOpenStudy = null;
let studyYtPlayer = null;
let currentStudyForPlayer = null;
let currentStudyLessonIndexForPlayer = null;
let appUpdatesQueue = [];
let appUpdatesCheckRunning = false;
let appUpdatesLastCheckUserId = null;
const APP_UPDATES_VISITOR_STORAGE_KEY = 'adpel_updates_read';

function cacheBookUrl(id, url) {
  if (id && url) bookUrls[id] = url;
}

async function readBook(id) {
  const url = bookUrls[id];
  if (url) {
    window.open(url, '_blank');
    return;
  }
  try {
    const { data, error } = await window.supabaseClient.from('library_books').select('file_url').eq('id', id).single();
    if (error) throw error;
    if (data?.file_url) {
      bookUrls[id] = data.file_url;
      window.open(data.file_url, '_blank');
    } else {
      showToast('Este livro não possui arquivo para leitura.', 'info');
    }
  } catch (e) {
    console.error(e);
    showToast('Erro ao abrir livro.', 'error');
  }
}

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

function updateBannerWelcome() {
  const title = document.getElementById('home-welcome-title');
  const subtitle = document.getElementById('home-welcome-subtitle');
  if (!title && !subtitle) return;

  const userInfo = typeof getCurrentUserInfo === 'function' ? getCurrentUserInfo() : { isLoggedIn: false };
  const profile = userInfo.profile || {};
  const user = userInfo.user || {};
  const name = profile.full_name || user.email || '';

  if (title) {
    title.textContent = userInfo.isLoggedIn && name ? 'Olá, ' + name : 'Olá, seja bem-vindo';
  }
  if (subtitle) {
    subtitle.textContent = userInfo.isLoggedIn
      ? 'Continue sua caminhada com fé, ensino e comunhão.'
      : 'Entre para acompanhar cursos, ofertas, conquistas e sua caminhada.';
  }
}

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

async function carregarVersiculoDoDia() {
  try {
    const diaAno = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
    );
    const { data, error } = await window.supabaseClient
      .from('verse_of_day')
      .select('*')
      .order('id');

    if (error) {
      console.error('Erro ao buscar versículo do dia:', error);
      return;
    }

    const textEl = document.getElementById('verse-text');
    const refEl = document.getElementById('verse-ref');

    if (!data || !data.length) {
      if (textEl) textEl.textContent = 'Nenhum versículo cadastrado.';
      if (refEl) refEl.textContent = '';
      return;
    }

    const versiculo = data[diaAno % data.length];
    if (!versiculo) {
      if (textEl) textEl.textContent = 'Nenhum versículo disponível.';
      if (refEl) refEl.textContent = '';
      return;
    }

    if (textEl) textEl.textContent = versiculo.text || '';
    if (refEl) refEl.textContent = versiculo.reference ? '— ' + versiculo.reference : '';
  } catch (e) {
    console.error('Erro em carregarVersiculoDoDia:', e);
  }
}

async function loadHomeData() {
  const now = Date.now();
  if (now - _lastHomeLoad < SECTION_LOAD_DEBOUNCE) {
    console.log('⏭️ loadHomeData debounce');
    return;
  }
  _lastHomeLoad = now;

  // 1. Versículo do Dia
  await carregarVersiculoDoDia();

  try {
    const [courses, events, attendances, announcements] = await Promise.all([
      ADPEL.fetch.courses(),
      ADPEL.fetch.events(),
      fetchAllAttendances(),
      ADPEL.fetch.announcements()
    ]);

    // Cursos em andamento
    const userInfo = getCurrentUserInfo();
    let progressMap = {};
    if (userInfo.isLoggedIn) {
      const allProgress = await getAllLessonProgress();
      allProgress.forEach(p => {
        if (!progressMap[p.course_id]) progressMap[p.course_id] = new Set();
        progressMap[p.course_id].add(p.lesson_index);
      });
    }

    const publishedCourses = (courses || [])
      .filter(c => c.is_published)
      .filter(isContentVisibleNow);
    const inProgressCourses = publishedCourses.map(course => {
      const lessons = normalizeLessons(course.lessons);
      const total = lessons.length;
      const completedSet = progressMap[course.id] || new Set();
      const completed = completedSet.size;
      let status = 'not-started';
      if (total === 0) status = 'completed';
      else if (completed >= total) status = 'completed';
      else if (completed > 0) status = 'in-progress';
      return { ...course, totalLessons: total, completedLessons: completed, status };
    }).filter(c => c.status === 'in-progress');

    renderContinueSection(inProgressCourses);

    const attendancesByEvent = {};
    (attendances || []).forEach(a => {
      if (!attendancesByEvent[a.event_id]) attendancesByEvent[a.event_id] = [];
      attendancesByEvent[a.event_id].push(a);
    });

    const futureEvents = (events || []).filter(isHomeEventVisible);
    const publishedAnnouncements = (announcements || [])
      .filter(a => a.is_published)
      .filter(isContentVisibleNow);
    renderHomeEvents(buildUnifiedAgenda(futureEvents, publishedAnnouncements), attendancesByEvent);

    const announcementsSection = document.getElementById('home-announcements-section');
    if (announcementsSection) {
      announcementsSection.classList.add('hidden');
    }

  } catch (error) {
    console.error('Erro ao carregar dados da home:', error);
  }
}

function isContentVisibleNow(item) {
  if (!window.ADPELDateUtils || typeof window.ADPELDateUtils.isWithinDateRange !== 'function') {
    return true;
  }
  return window.ADPELDateUtils.isWithinDateRange(item);
}

function buildUnifiedAgenda(events, announcements) {
  const eventItems = (events || []).map(e => ({ ...e, agenda_type: 'event' }));
  const announcementItems = (announcements || []).map(a => {
    const dateSource = a.expiry || a.expires_at || a.created_at || new Date().toISOString();
    return {
      id: 'announcement-' + (a.id || String(a.title || '').replace(/\s+/g, '-')),
      agenda_type: 'announcement',
      title: a.title || 'Aviso',
      description: a.message || a.description || '',
      event_date: String(dateSource).slice(0, 10),
      event_time: '',
      category: a.priority === 'urgent' ? 'aviso_urgente' : 'aviso',
      link: a.link || ''
    };
  });

  return eventItems.concat(announcementItems).sort((a, b) => {
    const aDate = String(a.event_date || '').slice(0, 10);
    const bDate = String(b.event_date || '').slice(0, 10);
    return aDate.localeCompare(bDate);
  });
}

function isHomeEventVisible(event) {
  if (!window.ADPELDateUtils || typeof window.ADPELDateUtils.isWithinDateRange !== 'function') {
    return true;
  }

  return window.ADPELDateUtils.isWithinDateRange(
    event,
    window.ADPELDateUtils.startFields,
    window.ADPELDateUtils.endFields.concat(['event_date'])
  );
}

async function fetchAllAttendances() {
  try {
    const { data, error } = await window.supabaseClient.from('event_attendances').select('*');
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Erro ao buscar presenças:', e);
    return [];
  }
}

async function confirmAttendance(eventId) {
  const userInfo = getCurrentUserInfo();
  if (!userInfo.isLoggedIn) {
    showToast('Faça login para confirmar presença.', 'warning');
    openModal('login-modal');
    return;
  }
  
  const name = userInfo.profile?.full_name || userInfo.user?.email || 'Membro';
  
  try {
    // Verifica se já existe presença do usuário neste evento
    const { data: existing, error: fetchError } = await window.supabaseClient
      .from('event_attendances')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userInfo.user.id)
      .maybeSingle();
      
    if (fetchError) throw fetchError;
    
    if (existing) {
      // Desmarcar presença
      const { error: delError } = await window.supabaseClient
        .from('event_attendances')
        .delete()
        .eq('id', existing.id);
      if (delError) throw delError;
      showToast('Presença cancelada.', 'info');
    } else {
      // Marcar presença
      const { error } = await window.supabaseClient
        .from('event_attendances')
        .insert([{ event_id: eventId, user_id: userInfo.user.id, user_name: name }]);
      if (error) throw error;
      showToast('Estamos te aguardando!', 'success');
    }
    
    await renderEventAttendees(eventId);
  } catch (e) {
    console.error('Erro ao confirmar presença:', e);
    showToast('Erro ao atualizar presença.', 'error');
  }
}

async function renderEventAttendees(eventId) {
  try {
    const { data, error } = await window.supabaseClient
      .from('event_attendances')
      .select('user_id, user_name')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });
      
    if (error) throw error;
    
    const container = document.getElementById(`attendees-${eventId}`);
    const btn = document.getElementById(`attendance-btn-${eventId}`);
    if (!container) return;
    
    const attendees = data || [];
    const userInfo = getCurrentUserInfo();
    const hasConfirmed = userInfo.isLoggedIn && attendees.some(a => a.user_id === userInfo.user?.id);
    
    // Atualiza botão
    if (btn) {
      if (hasConfirmed) {
        btn.className = 'w-full py-1.5 px-3 rounded-lg text-xs font-bold transition bg-green-100 text-green-700 border border-green-200';
        btn.innerHTML = '<i class="fas fa-check mr-1"></i> Presença Confirmada';
      } else {
        btn.className = 'w-full py-1.5 px-3 rounded-lg text-xs font-bold transition bg-purple-600 text-white hover:bg-purple-700 active:bg-purple-800';
        btn.innerHTML = '<i class="fas fa-hand-point-up mr-1"></i> Marcar Presença';
      }
    }
    
    if (attendees.length === 0) {
      container.innerHTML = '';
      return;
    }
    
    const visible = attendees.slice(0, 3);
    const hidden = attendees.slice(3);
    const hiddenCount = hidden.length;
    
    let html = visible.map(a => 
      `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 border border-purple-200">${escapeHtml(a.user_name || 'Membro')}</span>`
    ).join('');
    
    if (hiddenCount > 0) {
      html += `<button onclick="toggleAttendees('${eventId}')" id="attendees-toggle-${eventId}" data-count="${hiddenCount}" class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 transition">+${hiddenCount}</button>`;
      html += `<div id="attendees-extra-${eventId}" class="hidden flex flex-wrap gap-1 w-full mt-1">`;
      html += hidden.map(a => `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 border border-purple-200">${escapeHtml(a.user_name || 'Membro')}</span>`).join('');
      html += `</div>`;
    }
    
    container.innerHTML = html;
  } catch (e) {
    console.error('Erro ao renderizar presenças:', e);
  }
}

function toggleAttendees(eventId) {
  const extra = document.getElementById(`attendees-extra-${eventId}`);
  const btn = document.getElementById(`attendees-toggle-${eventId}`);
  if (!extra || !btn) return;
  const originalCount = btn.getAttribute('data-count');
  if (extra.classList.contains('hidden')) {
    extra.classList.remove('hidden');
    btn.textContent = 'Ver menos';
  } else {
    extra.classList.add('hidden');
    btn.textContent = `+${originalCount}`;
  }
}

async function loadCoursesData() {
  try {
    const courses = await ADPEL.fetch.courses();
    const published = (courses || []).filter(c => c.is_published);
    
    const userInfo = getCurrentUserInfo();
    let progressMap = {};
    if (userInfo.isLoggedIn) {
      const allProgress = await getAllLessonProgress();
      allProgress.forEach(p => {
        if (!progressMap[p.course_id]) progressMap[p.course_id] = new Set();
        progressMap[p.course_id].add(p.lesson_index);
      });
    }
    
    const coursesWithStatus = published.map(course => {
      const lessons = normalizeLessons(course.lessons);
      const total = lessons.length;
      const completedSet = progressMap[course.id] || new Set();
      const completed = completedSet.size;
      
      let status = 'not-started';
      if (total === 0) {
        status = 'completed';
      } else if (completed >= total) {
        status = 'completed';
      } else if (completed > 0) {
        status = 'in-progress';
      }
      
      return { ...course, totalLessons: total, completedLessons: completed, status };
    });
    
    renderCoursesList(coursesWithStatus);
  } catch (e) {
    console.error(e);
  }
}

async function loadStudiesData() {
  try {
    const studies = await ADPEL.fetch.studies();
    renderStudiesList((studies || []).filter(s => s.is_published));
  } catch (e) {
    console.error(e);
  }
}

async function loadLibraryData() {
  try {
    const library = await ADPEL.fetch.library();
    renderBooksGrid((library || []).filter(b => b.is_published));
  } catch (e) {
    console.error(e);
  }
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

function renderAnnouncements(announcements) {
  const container = document.getElementById('news-container');
  if (!container) return;
  const isLoggedIn = getCurrentUserInfo().isLoggedIn;
  
  if (!announcements || announcements.length === 0) {
    container.innerHTML = `
      <div class="min-w-full bg-white rounded-xl p-6 text-center border border-gray-100 snap-start">
        <div class="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <i class="fas fa-bullhorn text-2xl text-blue-500"></i>
        </div>
        <h3 class="font-semibold text-gray-800 mb-2">Nenhum Aviso Pendente</h3>
        <p class="text-gray-500 text-sm">Comunicados importantes aparecerao aqui.</p>
      </div>`;
    container.classList.toggle('blur-overlay', !isLoggedIn);
    return;
  }
  container.innerHTML = announcements.map(a => `
    <div class="min-w-[300px] max-w-[340px] flex-shrink-0 snap-start bg-yellow-50 border border-yellow-200 rounded-xl p-4 ${a.priority === 'urgent' ? 'border-l-4 border-l-red-500' : ''}">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <i class="fas fa-bullhorn text-yellow-600"></i>
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="font-semibold text-gray-800 truncate">${escapeHtml(a.title)}</h4>
          <p class="text-gray-600 text-sm mt-1 line-clamp-3">${escapeHtml(a.message)}</p>
          ${a.link ? `<a href="${escapeHtml(a.link)}" target="_blank" class="inline-block mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"><i class="fas fa-external-link-alt mr-1"></i>Saiba mais</a>` : ''}
          ${a.expiry ? `<p class="text-xs text-gray-400 mt-2">Validade: ${formatDate(a.expiry)}</p>` : ''}
        </div>
      </div>
    </div>
  `).join('');
  
  if (!isLoggedIn) {
    container.classList.add('blur-overlay');
  } else {
    container.classList.remove('blur-overlay');
  }
}

function renderEvents(events, attendancesByEvent = {}) {
  const container = document.getElementById('events-container');
  if (!container) return;
  const isLoggedIn = getCurrentUserInfo().isLoggedIn;
  
  if (!events || events.length === 0) {
    container.innerHTML = `
      <div class="min-w-full bg-white rounded-xl p-6 text-center border border-gray-100 snap-start">
        <div class="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <i class="fas fa-calendar-alt text-2xl text-purple-500"></i>
        </div>
        <h3 class="font-semibold text-gray-800 mb-2">Agenda Vazia</h3>
        <p class="text-gray-500 text-sm">Eventos programados aparecerao aqui.</p>
      </div>`;
    container.classList.toggle('blur-overlay', !isLoggedIn);
    return;
  }
  
  const categoryColors = {
    culto: 'border-l-blue-500 bg-blue-50',
    estudo: 'border-l-purple-500 bg-purple-50',
    reuniao: 'border-l-gray-500 bg-gray-50',
    evento: 'border-l-gold-500 bg-gold-50'
  };
  
  container.innerHTML = events.map(e => {
    const isAnnouncement = e.agenda_type === 'announcement';
    const dateStr = e.event_date && e.event_date !== 'null' && e.event_date !== 'undefined' ? String(e.event_date) : '';
    const dateParts = dateStr ? dateStr.split('-') : [];
    const day = dateParts[2] || '--';
    const month = dateParts[1] || '';
    const attendees = isAnnouncement ? [] : (attendancesByEvent[e.id] || []);
    const hasConfirmed = isLoggedIn && attendees.some(a => a.user_id === getCurrentUserInfo().user?.id);
    const visibleAttendees = attendees.slice(0, 3);
    const hiddenAttendees = attendees.slice(3);
    const hiddenCount = hiddenAttendees.length;
    
    return `
    <div class="min-w-[300px] max-w-[340px] flex-shrink-0 snap-start bg-white rounded-xl p-4 border border-gray-100 border-l-4 ${categoryColors[e.category] || 'border-l-gray-300'}">
      <div class="flex items-center gap-3">
        <div class="text-center min-w-[50px]">
          <span class="text-2xl font-bold text-gray-800">${escapeHtml(day)}</span>
          <span class="block text-xs text-gray-500 uppercase">${escapeHtml(month ? getMonthName(month) : '')}</span>
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="font-semibold text-gray-800 truncate">${escapeHtml(e.title || 'Evento')}</h4>
          <p class="text-sm text-gray-500 flex items-center gap-1 mt-1 flex-wrap">
            <i class="fas fa-clock text-xs"></i> ${escapeHtml(e.event_time || '')}
            ${e.location ? `<span class="flex items-center gap-1"><i class="fas fa-map-marker-alt text-xs ml-2"></i> ${e.maps_url ? `<a href="${escapeHtml(e.maps_url)}" target="_blank" class="hover:text-adpel-600 hover:underline">${escapeHtml(e.location)}</a>` : escapeHtml(e.location)}</span>` : ''}
          </p>
        </div>
      </div>
      ${e.description ? `<p class="text-xs text-gray-500 mt-2 line-clamp-2">${escapeHtml(e.description)}</p>` : ''}
      ${e.link ? `<a href="${escapeHtml(e.link)}" target="_blank" class="inline-flex items-center gap-1 mt-3 text-xs font-bold text-adpel-700 hover:text-adpel-900 hover:underline"><i class="fas fa-arrow-up-right-from-square"></i> Abrir link</a>` : ''}
      <div class="${isAnnouncement ? 'hidden' : ''} mt-3 pt-3 border-t border-gray-100">
        <button id="attendance-btn-${e.id}" onclick="confirmAttendance('${e.id}')" class="w-full py-1.5 px-3 rounded-lg text-xs font-bold transition ${hasConfirmed ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-purple-600 text-white hover:bg-purple-700 active:bg-purple-800'}">
          ${hasConfirmed ? '<i class="fas fa-check mr-1"></i> Presença Confirmada' : '<i class="fas fa-hand-point-up mr-1"></i> Marcar Presença'}
        </button>
        <div id="attendees-${e.id}" class="mt-2 flex flex-wrap gap-1 items-center">
          ${visibleAttendees.map(a => `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 border border-purple-200">${escapeHtml(a.user_name || 'Membro')}</span>`).join('')}
          ${hiddenCount > 0 ? `<button onclick="toggleAttendees('${e.id}')" id="attendees-toggle-${e.id}" data-count="${hiddenCount}" class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 transition">+${hiddenCount}</button>` : ''}
          <div id="attendees-extra-${e.id}" class="hidden flex flex-wrap gap-1 w-full mt-1">
            ${hiddenAttendees.map(a => `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 border border-purple-200">${escapeHtml(a.user_name || 'Membro')}</span>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `}).join('');
  
  if (!isLoggedIn) {
    container.classList.add('blur-overlay');
  } else {
    container.classList.remove('blur-overlay');
  }
}

function renderHomeEvents(events, attendancesByEvent = {}) {
  const section = document.getElementById('home-events-section');
  const container = document.getElementById('home-events-container');
  if (!section || !container) return;

  if (!events || events.length === 0) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  const sectionTitle = section.querySelector('h2');
  if (sectionTitle) sectionTitle.textContent = 'Agenda';
  const isLoggedIn = getCurrentUserInfo().isLoggedIn;

  const categoryColors = {
    culto: 'border-l-blue-500 bg-blue-50',
    estudo: 'border-l-purple-500 bg-purple-50',
    reuniao: 'border-l-gray-500 bg-gray-50',
    evento: 'border-l-gold-500 bg-gold-50',
    aviso: 'border-l-amber-500 bg-amber-50',
    aviso_urgente: 'border-l-red-500 bg-red-50'
  };

  container.innerHTML = events.map(e => {
    const isAnnouncement = e.agenda_type === 'announcement';
    const dateStr = e.event_date && e.event_date !== 'null' && e.event_date !== 'undefined' ? String(e.event_date) : '';
    const dateParts = dateStr ? dateStr.split('-') : [];
    const day = dateParts[2] || '--';
    const month = dateParts[1] || '';
    const attendees = isAnnouncement ? [] : (attendancesByEvent[e.id] || []);
    const hasConfirmed = isLoggedIn && attendees.some(a => a.user_id === getCurrentUserInfo().user?.id);
    const visibleAttendees = attendees.slice(0, 3);
    const hiddenAttendees = attendees.slice(3);
    const hiddenCount = hiddenAttendees.length;

    return `
    <div class="min-w-[300px] max-w-[340px] flex-shrink-0 snap-start bg-white rounded-xl p-4 border border-gray-100 border-l-4 ${categoryColors[e.category] || 'border-l-gray-300'}">
      <div class="flex items-center gap-3">
        <div class="text-center min-w-[50px]">
          <span class="text-2xl font-bold text-gray-800">${escapeHtml(day)}</span>
          <span class="block text-xs text-gray-500 uppercase">${escapeHtml(month ? getMonthName(month) : '')}</span>
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="font-semibold text-gray-800 truncate">${escapeHtml(e.title || 'Evento')}</h4>
          <p class="text-sm text-gray-500 flex items-center gap-1 mt-1 flex-wrap">
            <i class="fas fa-clock text-xs"></i> ${escapeHtml(e.event_time || '')}
            ${e.location ? `<span class="flex items-center gap-1"><i class="fas fa-map-marker-alt text-xs ml-2"></i> ${e.maps_url ? `<a href="${escapeHtml(e.maps_url)}" target="_blank" class="hover:text-adpel-600 hover:underline">${escapeHtml(e.location)}</a>` : escapeHtml(e.location)}</span>` : ''}
          </p>
        </div>
      </div>
      ${e.description ? `<p class="text-xs text-gray-500 mt-2 line-clamp-2">${escapeHtml(e.description)}</p>` : ''}
      ${e.link ? `<a href="${escapeHtml(e.link)}" target="_blank" class="inline-flex items-center gap-1 mt-3 text-xs font-bold text-adpel-700 hover:text-adpel-900 hover:underline"><i class="fas fa-arrow-up-right-from-square"></i> Abrir link</a>` : ''}
      <div class="${isAnnouncement ? 'hidden' : ''} mt-3 pt-3 border-t border-gray-100">
        <button id="attendance-btn-${e.id}" onclick="confirmAttendance('${e.id}')" class="w-full py-1.5 px-3 rounded-lg text-xs font-bold transition ${hasConfirmed ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-purple-600 text-white hover:bg-purple-700 active:bg-purple-800'}">
          ${hasConfirmed ? '<i class="fas fa-check mr-1"></i> Presença Confirmada' : '<i class="fas fa-hand-point-up mr-1"></i> Marcar Presença'}
        </button>
        <div id="attendees-${e.id}" class="mt-2 flex flex-wrap gap-1 items-center">
          ${visibleAttendees.map(a => `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 border border-purple-200">${escapeHtml(a.user_name || 'Membro')}</span>`).join('')}
          ${hiddenCount > 0 ? `<button onclick="toggleAttendees('${e.id}')" id="attendees-toggle-${e.id}" data-count="${hiddenCount}" class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 transition">+${hiddenCount}</button>` : ''}
          <div id="attendees-extra-${e.id}" class="hidden flex flex-wrap gap-1 w-full mt-1">
            ${hiddenAttendees.map(a => `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 border border-purple-200">${escapeHtml(a.user_name || 'Membro')}</span>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `}).join('');
}

function renderContinueSection(courses) {
  const section = document.getElementById('continue-section');
  const container = document.getElementById('continue-grid');
  if (!section || !container) return;

  if (!courses || courses.length === 0) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  container.innerHTML = courses.map(course => courseCarouselCard(course, 'Continuar')).join('');
}

function renderFeaturedCourses(courses) {
  const container = document.getElementById('featured-courses');
  if (!container) return;
  if (!courses || courses.length === 0) {
    container.innerHTML = `
      <div class="min-w-[300px] flex-shrink-0 w-full text-center py-8 bg-white rounded-xl border border-dashed border-gray-300">
        <i class="fas fa-graduation-cap text-4xl text-gray-300 mb-3"></i>
        <p class="text-gray-500">Nenhum curso em destaque.</p>
        <p class="text-xs text-gray-400 mt-2">Marque "Destaque (Home)" no painel administrativo para exibir um curso aqui.</p>
      </div>`;
    return;
  }
  const isLoggedIn = getCurrentUserInfo().isLoggedIn;
  container.innerHTML = courses.map(course => `
    <div class="min-w-[300px] flex-shrink-0 snap-start bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition group">
      <div class="relative h-40 bg-gradient-to-br from-blue-500 to-blue-700 cursor-pointer" onclick="if(!getCurrentUserInfo().isLoggedIn){openModal('login-modal');return;} openCourseModal('${encodeURIComponent(JSON.stringify(course))}')">
        ${course.thumbnail_url 
          ? `<img src="${course.thumbnail_url}" class="w-full h-full object-cover" alt="${escapeHtml(course.title)}">`
          : `<div class="w-full h-full flex items-center justify-center text-white/50"><i class="fas fa-graduation-cap text-5xl"></i></div>`}
        <div class="absolute top-3 right-3 bg-white/90 px-2 py-1 rounded text-xs font-bold text-blue-700">${escapeHtml(course.category || 'Curso')}</div>
      </div>
      <div class="p-4">
        <h4 class="font-bold text-gray-800 group-hover:text-blue-600 transition cursor-pointer" onclick="if(!getCurrentUserInfo().isLoggedIn){openModal('login-modal');return;} openCourseModal('${encodeURIComponent(JSON.stringify(course))}')">${escapeHtml(course.title)}</h4>
        <p class="text-sm text-gray-500 mt-2 line-clamp-2">${escapeHtml(course.description || 'Sem descricao')}</p>
        <div class="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span class="flex items-center gap-1"><i class="fas fa-user-tie text-xs"></i> ${escapeHtml(course.teacher_name || 'A definir')}</span>
          <span class="flex items-center gap-1"><i class="fas fa-clock text-xs"></i> ${course.duration ? `${course.duration}h` : 'A definir'}</span>
        </div>
        <button onclick="if(!getCurrentUserInfo().isLoggedIn){openModal('login-modal');return;} openCourseModal('${encodeURIComponent(JSON.stringify(course))}')" class="mt-3 w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">Ver Aulas</button>
      </div>
    </div>
  `).join('');
}

function renderFeaturedStudies(studies) {
  const container = document.getElementById('featured-studies');
  if (!container) return;
  if (!studies || studies.length === 0) {
    container.innerHTML = `
      <div class="min-w-[300px] flex-shrink-0 w-full text-center py-8 bg-white rounded-xl border border-dashed border-gray-300">
        <i class="fas fa-book-open text-4xl text-gray-300 mb-3"></i>
        <p class="text-gray-500">Nenhum estudo em destaque.</p>
      </div>`;
    return;
  }
  container.innerHTML = studies.map(study => `
    <div class="min-w-[300px] flex-shrink-0 snap-start bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition cursor-pointer group" onclick="if(!getCurrentUserInfo().isLoggedIn){openModal('login-modal');return;} openStudyModal('${encodeURIComponent(JSON.stringify(study))}')">
      <div class="relative h-40 bg-gradient-to-br from-amber-500 to-amber-600 overflow-hidden">
        ${study.cover_url 
          ? `<img src="${study.cover_url}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500" alt="${escapeHtml(study.title)}">`
          : `<div class="w-full h-full flex items-center justify-center text-white/50"><i class="fas fa-book-open text-5xl"></i></div>`}
        <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
          <span class="bg-amber-500 text-white px-2 py-1 rounded text-xs font-bold">${escapeHtml(study.category || 'Estudo')}</span>
        </div>
      </div>
      <div class="p-4">
        <h4 class="font-bold text-gray-800 group-hover:text-amber-600 transition">${escapeHtml(study.title)}</h4>
        <p class="text-sm text-gray-500 mt-2 line-clamp-2">${escapeHtml(study.description || 'Sem descricao')}</p>
      </div>
    </div>
  `).join('');
}

function renderFeaturedBooks(books) {
  const container = document.getElementById('featured-books');
  if (!container) return;
  if (!books || books.length === 0) {
    container.innerHTML = `
      <div class="min-w-[260px] flex-shrink-0 w-full text-center py-8 bg-white rounded-xl border border-dashed border-gray-300">
        <i class="fas fa-book text-4xl text-gray-300 mb-3"></i>
        <p class="text-gray-500">Nenhum livro em destaque.</p>
      </div>`;
    return;
  }
  container.innerHTML = books.map(book => {
    cacheBookUrl(book.id, book.file_url);
    return `<div class="min-w-[260px] flex-shrink-0 snap-start bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition cursor-pointer group p-4">
      <div class="relative h-48 bg-gray-100 rounded-lg overflow-hidden mb-4">
        ${book.image 
          ? `<img src="${book.image}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500" alt="${escapeHtml(book.title)}" onerror="this.src='http://static.photos/book/200x300/1'">`
          : `<div class="w-full h-full flex items-center justify-center text-gray-400"><i class="fas fa-book text-5xl"></i></div>`}
      </div>
      <h4 class="font-bold text-gray-800 group-hover:text-blue-600 transition text-sm">${escapeHtml(book.title)}</h4>
      <p class="text-xs text-gray-500 mt-1">${escapeHtml(book.author || 'Autor desconhecido')}</p>
      <button onclick="if(!getCurrentUserInfo().isLoggedIn){openModal('login-modal');return;} readBook('${book.id}')" class="mt-3 w-full py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-blue-600 hover:text-white transition">Ler</button>
    </div>`;
  }).join('');
}

function courseCarouselCard(course, btnText) {
  const lessons = normalizeLessons(course.lessons);
  const hasLessons = lessons.length > 0;
  const pct = course.totalLessons > 0 ? Math.round((course.completedLessons / course.totalLessons) * 100) : 0;
  
  let statusBadge = '';
  if (course.status === 'completed') {
    statusBadge = `<span class="absolute top-3 left-3 bg-green-500 text-white px-2 py-1 rounded text-xs font-bold shadow-sm"><i class="fas fa-check mr-1"></i> Concluído</span>`;
  } else if (course.status === 'in-progress') {
    statusBadge = `<span class="absolute top-3 left-3 bg-amber-500 text-white px-2 py-1 rounded text-xs font-bold shadow-sm"><i class="fas fa-play mr-1"></i> ${pct}%</span>`;
  }
  
  const progressBar = course.totalLessons > 0 ? `
    <div class="mt-2">
      <div class="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div class="${course.status === 'completed' ? 'bg-green-500' : 'bg-blue-600'} h-1.5 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
      </div>
      <p class="text-[10px] text-gray-400 mt-1">${course.completedLessons} de ${course.totalLessons} aula${course.totalLessons !== 1 ? 's' : ''}</p>
    </div>` : '';

  return `
    <div class="min-w-[280px] max-w-[280px] flex-shrink-0 snap-start bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition group border border-gray-100">
      <div class="relative h-40 bg-gradient-to-br from-blue-500 to-blue-700 overflow-hidden cursor-pointer" onclick="if(!getCurrentUserInfo().isLoggedIn){openModal('login-modal');return;} openCourseModal('${encodeURIComponent(JSON.stringify(course))}')">
        ${course.thumbnail_url 
          ? `<img src="${course.thumbnail_url}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500" alt="${escapeHtml(course.title)}">`
          : `<div class="w-full h-full flex items-center justify-center text-white/50"><i class="fas fa-graduation-cap text-5xl"></i></div>`}
        ${statusBadge}
        <div class="absolute bottom-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded text-xs font-bold text-blue-700">${escapeHtml(course.category || 'Curso')}</div>
      </div>
      <div class="p-4">
        <h4 class="font-bold text-gray-800 group-hover:text-blue-600 transition cursor-pointer truncate" onclick="if(!getCurrentUserInfo().isLoggedIn){openModal('login-modal');return;} openCourseModal('${encodeURIComponent(JSON.stringify(course))}')">${escapeHtml(course.title)}</h4>
        <p class="text-sm text-gray-500 mt-1 line-clamp-2 h-10">${escapeHtml(course.description || 'Sem descrição')}</p>
        <div class="flex items-center justify-between mt-3 text-xs text-gray-500">
          <span class="flex items-center gap-1"><i class="fas fa-user-tie"></i> ${escapeHtml(course.teacher_name || 'A definir')}</span>
          <span class="flex items-center gap-1"><i class="fas fa-clock"></i> ${course.duration ? `${course.duration}h` : 'A definir'}</span>
        </div>
        ${progressBar}
        <button onclick="if(!getCurrentUserInfo().isLoggedIn){openModal('login-modal');return;} openCourseModal('${encodeURIComponent(JSON.stringify(course))}')" class="mt-3 w-full py-2 ${course.status === 'completed' ? 'bg-green-600 hover:bg-green-700' : course.status === 'in-progress' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg text-sm font-medium transition shadow-sm">
          ${btnText}
        </button>
      </div>
    </div>
  `;
}

function renderCoursesList(courses) {
  const completedContainer = document.getElementById('courses-completed');
  const inprogressContainer = document.getElementById('courses-inprogress');
  const notstartedContainer = document.getElementById('courses-notstarted');
  const completedSection = document.getElementById('courses-completed-section');
  const inprogressSection = document.getElementById('courses-inprogress-section');
  const notstartedSection = document.getElementById('courses-notstarted-section');
  const emptyState = document.getElementById('courses-empty');
  const carousels = document.getElementById('courses-carousels');

  if (!carousels) return;

  if (!courses || courses.length === 0) {
    if (completedSection) completedSection.classList.add('hidden');
    if (inprogressSection) inprogressSection.classList.add('hidden');
    if (notstartedSection) notstartedSection.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    if (carousels) carousels.classList.add('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');
  if (carousels) carousels.classList.remove('hidden');

  const completed = courses.filter(c => c.status === 'completed');
  const inprogress = courses.filter(c => c.status === 'in-progress');
  const notstarted = courses.filter(c => c.status === 'not-started');

  if (completedSection) completedSection.classList.toggle('hidden', completed.length === 0);
  if (inprogressSection) inprogressSection.classList.toggle('hidden', inprogress.length === 0);
  if (notstartedSection) notstartedSection.classList.toggle('hidden', notstarted.length === 0);

  if (completedContainer) completedContainer.innerHTML = completed.map(c => courseCarouselCard(c, 'Revisar')).join('');
  if (inprogressContainer) inprogressContainer.innerHTML = inprogress.map(c => courseCarouselCard(c, 'Continuar')).join('');
  if (notstartedContainer) notstartedContainer.innerHTML = notstarted.map(c => courseCarouselCard(c, 'Assistir')).join('');
}

function renderStudiesList(studies) {
  const container = document.getElementById('studies-list');
  if (!container) return;
  if (!studies || studies.length === 0) {
    container.innerHTML = `
      <div class="min-w-[300px] flex-shrink-0 w-full text-center py-8 bg-white rounded-xl border border-dashed border-gray-300">
        <i class="fas fa-book-open text-4xl text-gray-300 mb-3"></i>
        <p class="text-gray-500">Nenhum estudo disponível.</p>
      </div>`;
    return;
  }
  container.innerHTML = studies.map(study => `
    <div class="min-w-[300px] flex-shrink-0 snap-start bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition cursor-pointer group border border-gray-100" onclick="if(!getCurrentUserInfo().isLoggedIn){openModal('login-modal');return;} openStudyModal('${encodeURIComponent(JSON.stringify(study))}')">
      <div class="relative h-40 bg-gradient-to-br from-amber-500 to-amber-600 overflow-hidden">
        ${study.cover_url 
          ? `<img src="${study.cover_url}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500" alt="${escapeHtml(study.title)}">`
          : `<div class="w-full h-full flex items-center justify-center text-white/50"><i class="fas fa-book-open text-5xl"></i></div>`}
        <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
          <span class="bg-amber-500 text-white px-2 py-1 rounded text-xs font-bold">${escapeHtml(study.category || 'Estudo')}</span>
        </div>
      </div>
      <div class="p-4">
        <h4 class="font-bold text-gray-800 group-hover:text-amber-600 transition">${escapeHtml(study.title)}</h4>
        <p class="text-sm text-gray-500 mt-2 line-clamp-2">${escapeHtml(study.description || 'Sem descricao')}</p>
      </div>
    </div>
  `).join('');
}

function renderBooksGrid(books) {
  const container = document.getElementById('books-grid');
  if (!container) return;
  if (!books || books.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
        <i class="fas fa-book text-4xl text-gray-300 mb-3"></i>
        <p class="text-gray-500">Nenhum livro disponivel na biblioteca.</p>
      </div>`;
    return;
  }
  container.innerHTML = books.map(book => {
    cacheBookUrl(book.id, book.file_url);
    return `<div class="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition cursor-pointer group p-4">
      <div class="relative h-56 bg-gray-100 rounded-lg overflow-hidden mb-4">
        ${book.image 
          ? `<img src="${book.image}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500" alt="${escapeHtml(book.title)}" onerror="this.src='http://static.photos/book/200x300/1'">`
          : `<div class="w-full h-full flex items-center justify-center text-gray-400"><i class="fas fa-book text-5xl"></i></div>`}
      </div>
      <h4 class="font-bold text-gray-800 group-hover:text-blue-600 transition">${escapeHtml(book.title)}</h4>
      <p class="text-sm text-gray-500 mt-1">${escapeHtml(book.author || 'Autor desconhecido')}</p>
      <p class="text-xs text-gray-400 mt-2">${escapeHtml(book.category || 'Sem categoria')}</p>
      <button onclick="if(!getCurrentUserInfo().isLoggedIn){openModal('login-modal');return;} readBook('${book.id}')" class="mt-4 w-full py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-blue-600 hover:text-white transition">Ler</button>
    </div>`;
  }).join('');
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

// ==========================
// BIBLE SEARCH
// ==========================

async function buscarBiblia() {
  const input = document.getElementById('bible-search-input');
  const termo = input ? input.value.trim() : '';
  if (!termo) return;

  const loadingEl = document.getElementById('bible-loading');
  const resultsEl = document.getElementById('bible-results');
  const emptyEl = document.getElementById('bible-empty');
  const errorEl = document.getElementById('bible-error');

  if (loadingEl) loadingEl.classList.remove('hidden');
  if (resultsEl) resultsEl.innerHTML = '';
  if (emptyEl) emptyEl.classList.add('hidden');
  if (errorEl) {
    errorEl.classList.add('hidden');
    errorEl.textContent = '';
  }

  try {
    let data = [];
    // Tentar identificar referência bíblica: Livro Cap[:Vers]
    // Ex: João 3, João 3:16, 1 João 3:16
    const refRegex = /^(\d?(?:\s)?[A-Za-zÀ-ú]+)\s+(\d+)(?::(\d+))?$/;
    const match = termo.match(refRegex);

    if (match) {
      const book = match[1].trim();
      const chapter = parseInt(match[2], 10);
      const verse = match[3] ? parseInt(match[3], 10) : null;

      let q = window.supabaseClient
        .from('bible_verses')
        .select('*')
        .ilike('book', `%${book}%`)
        .eq('chapter', chapter)
        .limit(20);
      if (verse !== null) q = q.eq('verse', verse);
      const { data: refData, error } = await q;
      if (error) throw error;
      data = refData || [];
    }

    // Se não achou como referência, buscar por texto ou nome de livro
    if (data.length === 0) {
      const { data: textData, error } = await window.supabaseClient
        .from('bible_verses')
        .select('*')
        .or(`book.ilike.%${termo}%,text.ilike.%${termo}%`)
        .limit(20);
      if (error) throw error;
      data = textData || [];
    }

    renderBibleResults(data);
  } catch (e) {
    console.error('Erro na busca bíblica:', e);
    mostrarResultadosBiblia();
    if (errorEl) {
      errorEl.textContent = 'Erro ao buscar na Bíblia. Tente novamente.';
      errorEl.classList.remove('hidden');
    }
  } finally {
    if (loadingEl) loadingEl.classList.add('hidden');
  }
}

function renderBibleResults(results) {
  const container = document.getElementById('bible-results');
  const emptyEl = document.getElementById('bible-empty');
  if (!container) return;

  if (!results || results.length === 0) {
    container.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('hidden');
    mostrarResultadosBiblia();
    return;
  }

  if (emptyEl) emptyEl.classList.add('hidden');
  mostrarResultadosBiblia();

  container.innerHTML = results.map(v => `
    <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-lg transition group">
      <div class="flex items-start justify-between gap-3 mb-2">
        <h4 class="font-bold text-adpel-700 text-sm uppercase tracking-wide">${escapeHtml(v.book)} ${escapeHtml(v.chapter)}:${escapeHtml(v.verse)}</h4>
        <span class="text-[10px] bg-adpel-50 text-adpel-700 px-2 py-0.5 rounded border border-adpel-100">ACF</span>
      </div>
      <p class="text-gray-600 text-base leading-relaxed">${escapeHtml(v.text)}</p>
    </div>
  `).join('');
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

function normalizeLessons(lessons) {
  if (!lessons) return [];
  if (Array.isArray(lessons)) return lessons;
  if (typeof lessons === 'string') {
    try { return JSON.parse(lessons); } catch (e) { return []; }
  }
  return [];
}

function extractYouTubeID(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

async function getLessonProgress(courseId) {
  const userInfo = getCurrentUserInfo();
  if (!userInfo.isLoggedIn || !userInfo.user) return [];
  try {
    const { data, error } = await window.supabaseClient
      .from('user_lesson_progress')
      .select('lesson_index')
      .eq('user_id', userInfo.user.id)
      .eq('course_id', courseId);
    if (error) throw error;
    return data ? data.map(d => d.lesson_index) : [];
  } catch (e) {
    console.error('Erro ao buscar progresso:', e);
    return [];
  }
}

function isLessonCompleted(completedIndexes, index) {
  return completedIndexes.includes(index);
}

async function getAllLessonProgress() {
  const userInfo = getCurrentUserInfo();
  if (!userInfo.isLoggedIn || !userInfo.user) return [];
  try {
    const { data, error } = await window.supabaseClient
      .from('user_lesson_progress')
      .select('course_id, lesson_index')
      .eq('user_id', userInfo.user.id);
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Erro ao buscar progresso geral:', e);
    return [];
  }
}

async function toggleLessonComplete(courseId, index) {
  const userInfo = getCurrentUserInfo();
  if (!userInfo.isLoggedIn || !userInfo.user) {
    showToast('Faça login para salvar seu progresso.', 'warning');
    return;
  }
  try {
    const { data: existing, error: fetchError } = await window.supabaseClient
      .from('user_lesson_progress')
      .select('id')
      .eq('user_id', userInfo.user.id)
      .eq('course_id', courseId)
      .eq('lesson_index', index)
      .maybeSingle();
    if (fetchError) throw fetchError;

    if (existing) {
      const { error: delError } = await window.supabaseClient
        .from('user_lesson_progress')
        .delete()
        .eq('id', existing.id);
      if (delError) throw delError;
      showToast('Aula marcada como pendente.', 'info');
    } else {
      const totalLessons = currentOpenCourse && currentOpenCourse.id === courseId
        ? normalizeLessons(currentOpenCourse.lessons).length
        : 0;
      const completedBefore = await getLessonProgress(courseId);
      const { error: insError } = await window.supabaseClient
        .from('user_lesson_progress')
        .insert([{
          user_id: userInfo.user.id,
          course_id: courseId,
          lesson_index: index,
          completed: true,
          completed_at: new Date().toISOString()
        }]);
      if (insError) throw insError;
      if (window.ADPELJourney && typeof window.ADPELJourney.registerLessonWatched === 'function') {
        window.ADPELJourney.registerLessonWatched(courseId, index);
      }
      if (totalLessons > 0 && completedBefore.length + 1 >= totalLessons && window.ADPELJourney && typeof window.ADPELJourney.registerCourseCompleted === 'function') {
        window.ADPELJourney.registerCourseCompleted(courseId);
      }
      showToast('Aula concluída!', 'success');
    }

    if (currentOpenCourse && currentOpenCourse.id === courseId) {
      await renderCourseLessons(currentOpenCourse);
      await updateCertificateButton(courseId, normalizeLessons(currentOpenCourse.lessons).length);
    }
  } catch (e) {
    console.error('Erro ao atualizar progresso:', e);
    showToast('Erro ao salvar progresso.', 'error');
  }
}

async function renderCourseLessons(course) {
  const lessonsContainer = document.getElementById('course-lessons-container');
  const noLessonsEl = document.getElementById('course-no-lessons');
  const videoWrapper = document.getElementById('course-video-wrapper');
  const videoFrame = document.getElementById('course-video-frame');
  if (!lessonsContainer) return;

  lessonsContainer.innerHTML = '';
  if (noLessonsEl) noLessonsEl.classList.add('hidden');

  const lessons = normalizeLessons(course.lessons);
  if (lessons.length === 0) {
    if (noLessonsEl) noLessonsEl.classList.remove('hidden');
    return;
  }

  const completedIndexes = await getLessonProgress(course.id);

  lessons.forEach((url, index) => {
    const videoId = extractYouTubeID(url);
    const isYouTube = !!videoId;
    const isCompleted = isLessonCompleted(completedIndexes, index);

    const item = document.createElement('div');
    item.className = `flex items-center gap-3 p-3 rounded-lg border transition cursor-pointer select-none ${
      isCompleted ? 'bg-green-50 border-green-200 hover:bg-green-100' : 'bg-gray-50 border-gray-100 hover:bg-blue-50'
    }`;

    item.innerHTML = `
      <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition ${
        isCompleted ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
      }">
        <i class="fas fa-check text-xs"></i>
      </div>
      <div class="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 font-bold text-sm">${index + 1}</div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-gray-800 truncate">Aula ${index + 1}</p>
        <p class="text-xs ${isCompleted ? 'text-green-600 font-medium' : 'text-gray-500'}">${isCompleted ? 'Concluído' : 'Clique para assistir'}</p>
      </div>
    `;

    item.addEventListener('click', () => {
      if (isYouTube && videoWrapper) {
        videoWrapper.classList.remove('hidden');
        loadYouTubePlayer(videoId, course.id, index);
      } else {
        window.open(url, '_blank');
      }
    });

    lessonsContainer.appendChild(item);
  });
}

async function openCourseModal(encodedCourse) {
  let course;
  try {
    course = JSON.parse(decodeURIComponent(encodedCourse));
  } catch (e) {
    console.error('Erro ao abrir curso:', e);
    return;
  }

  currentOpenCourse = course;

  const modal = document.getElementById('course-modal');
  const titleEl = document.getElementById('course-modal-title');
  const teacherEl = document.getElementById('course-modal-teacher');
  const descEl = document.getElementById('course-modal-description');
  const lessonsContainer = document.getElementById('course-lessons-container');
  const noLessonsEl = document.getElementById('course-no-lessons');
  const videoWrapper = document.getElementById('course-video-wrapper');

  if (titleEl) titleEl.textContent = course.title || 'Curso';
  if (teacherEl) teacherEl.textContent = course.teacher_name ? `Professor: ${course.teacher_name}` : 'Professor: A definir';
  if (descEl) descEl.textContent = course.description || 'Sem descrição disponível.';

  // Reset video
  if (videoWrapper) videoWrapper.classList.add('hidden');
  if (ytPlayer && ytPlayer.destroy) {
    ytPlayer.destroy();
    ytPlayer = null;
  }

  await renderCourseLessons(course);
  await updateCertificateButton(course.id, normalizeLessons(course.lessons).length);

  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    restorePageScroll();
  }
}

function closeCourseModal() {
  const modal = document.getElementById('course-modal');
  const videoWrapper = document.getElementById('course-video-wrapper');
  if (ytPlayer && ytPlayer.destroy) {
    ytPlayer.destroy();
    ytPlayer = null;
  }
  if (videoWrapper) videoWrapper.classList.add('hidden');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
  }
  currentCourseForPlayer = null;
  currentLessonIndexForPlayer = null;
  currentOpenCourse = null;
}

function loadYouTubePlayer(videoId, courseId, lessonIndex) {
  if (!window.YT || !window.YT.Player) {
    setTimeout(() => loadYouTubePlayer(videoId, courseId, lessonIndex), 500);
    return;
  }
  currentCourseForPlayer = courseId;
  currentLessonIndexForPlayer = lessonIndex;

  if (ytPlayer && ytPlayer.destroy) {
    ytPlayer.destroy();
  }

  ytPlayer = new YT.Player('yt-player', {
    height: '100%',
    width: '100%',
    videoId: videoId,
    playerVars: {
      autoplay: 1,
      rel: 0,
      modestbranding: 1
    },
    events: {
      'onStateChange': onPlayerStateChange
    }
  });
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.ENDED) {
    if (currentCourseForPlayer !== null && currentLessonIndexForPlayer !== null) {
      toggleLessonComplete(currentCourseForPlayer, currentLessonIndexForPlayer);
    }
  }
}

async function updateCertificateButton(courseId, totalLessons) {
  const btn = document.getElementById('course-cert-btn');
  if (!btn) return;

  const completedIndexes = await getLessonProgress(courseId);
  const allCompleted = totalLessons > 0 && completedIndexes.length >= totalLessons;

  if (allCompleted) {
    btn.classList.remove('hidden', 'opacity-50', 'cursor-not-allowed');
    btn.classList.add('flex');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-award"></i> <span>Baixar Certificado</span>';
  } else {
    btn.classList.remove('hidden', 'flex');
    btn.classList.add('flex', 'opacity-50', 'cursor-not-allowed');
    btn.disabled = true;
    const remaining = totalLessons - completedIndexes.length;
    btn.innerHTML = `<i class="fas fa-lock"></i> <span>Certificado (${remaining} aula${remaining !== 1 ? 's' : ''} rest.)</span>`;
  }
}

async function downloadCertificate() {
  if (!currentOpenCourse) return;
  const lessons = normalizeLessons(currentOpenCourse.lessons);
  const completedIndexes = await getLessonProgress(currentOpenCourse.id);
  if (completedIndexes.length < lessons.length) {
    showToast('Complete todas as aulas para baixar o certificado.', 'warning');
    return;
  }

  const userInfo = getCurrentUserInfo();
  const userName = userInfo.profile?.full_name || userInfo.user?.email || 'Estudante';
  const today = new Date();
  const certTitle = currentOpenCourse.certificate_title || currentOpenCourse.title || 'Certificado de Conclusão';
  const certDesc = currentOpenCourse.certificate_description || `Concluiu o curso "${currentOpenCourse.title}" com êxito.`;

  const certificateData = {
    user_name: userName,
    course_title: currentOpenCourse.title,
    course_duration: currentOpenCourse.duration,
    description: certDesc,
    completed_at: today
  };

  // Salvar certificado no histórico do usuário
  try {
    if (userInfo.user) {
      // Verifica se certificado já foi emitido para não duplicar
      const { data: existingCert, error: checkError } = await window.supabaseClient
        .from('certificates')
        .select('id')
        .eq('user_id', userInfo.user.id)
        .eq('title', certTitle)
        .maybeSingle();

      if (checkError) {
        console.error('Erro ao verificar certificado existente:', checkError);
      }

      if (existingCert) {
        showToast('Certificado já foi emitido anteriormente.', 'info');
      } else {
        const { error } = await window.supabaseClient
          .from('certificates')
          .insert([{
            user_id: userInfo.user.id,
            course_id: currentOpenCourse.id,
            title: certTitle,
            description: certDesc,
            completed_at: today,
            certificate_data: certificateData
          }]);

        if (error) {
          console.error('Erro ao salvar certificado no histórico:', error);
          showToast('Erro ao salvar certificado no histórico.', 'error');
        } else {
          showToast('Certificado adicionado ao seu histórico!', 'success');
          if (currentSection === 'certificate') {
            await loadCertificatesData();
          }
        }
      }
    }
  } catch (e) {
    console.error('Erro ao salvar certificado no histórico:', e);
  }

  const logoUrl = 'https://huggingface.co/spaces/IzaqueE/deepsite-project-6tv0m/resolve/main/images/adpel.logo.png';
  const completedDate = today.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  const html = buildCertificateHTML({
    userName,
    certTitle,
    courseTitle: currentOpenCourse.title,
    description: certDesc,
    duration: currentOpenCourse.duration,
    completedDate,
    logoUrl
  });

  const certWindow = window.open('', '_blank');
  certWindow.document.write(html);
  certWindow.document.close();
}

function openStudyModal(encodedStudy) {
  let study;
  try {
    study = JSON.parse(decodeURIComponent(encodedStudy));
  } catch (e) {
    console.error('Erro ao abrir estudo:', e);
    return;
  }
  currentOpenStudy = study;

  const titleEl = document.getElementById('study-modal-title');
  const catEl = document.getElementById('study-modal-category');
  const descEl = document.getElementById('study-modal-description');
  const contentSection = document.getElementById('study-content-section');
  const contentDiv = document.getElementById('study-modal-content');
  const fileSection = document.getElementById('study-file-section');
  const fileLink = document.getElementById('study-file-link');
  const lessonsSection = document.getElementById('study-lessons-section');
  const lessonsContainer = document.getElementById('study-lessons-container');
  const noLessonsEl = document.getElementById('study-no-lessons');
  const videoWrapper = document.getElementById('study-video-wrapper');

  if (titleEl) titleEl.textContent = study.title || 'Estudo';
  if (catEl) catEl.textContent = study.category || 'Estudo';
  if (descEl) descEl.textContent = study.description || 'Sem descrição.';

  if (study.content && contentSection && contentDiv) {
    contentSection.classList.remove('hidden');
    contentDiv.innerHTML = study.content;
  } else if (contentSection) {
    contentSection.classList.add('hidden');
  }

  if (study.file_url && fileSection && fileLink) {
    fileSection.classList.remove('hidden');
    fileLink.href = study.file_url;
  } else if (fileSection) {
    fileSection.classList.add('hidden');
  }

  if (lessonsContainer) lessonsContainer.innerHTML = '';
  if (noLessonsEl) noLessonsEl.classList.add('hidden');
  if (videoWrapper) videoWrapper.classList.add('hidden');
  if (studyYtPlayer && studyYtPlayer.destroy) { studyYtPlayer.destroy(); studyYtPlayer = null; }

  const lessons = normalizeLessons(study.lessons);
  if (lessons.length > 0 && lessonsSection && lessonsContainer) {
    lessonsSection.classList.remove('hidden');
    lessons.forEach((url, index) => {
      const videoId = extractYouTubeID(url);
      const div = document.createElement('div');
      div.className = 'flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-amber-50 transition cursor-pointer';
      div.innerHTML = `
        <div class="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0 font-bold text-sm">${index + 1}</div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-800 truncate">Aula ${index + 1}</p>
          <p class="text-xs text-gray-500">${videoId ? 'Clique para assistir' : 'Clique para abrir'}</p>
        </div>
      `;
      div.addEventListener('click', () => {
        if (videoId && videoWrapper) {
          videoWrapper.classList.remove('hidden');
          loadStudyYouTubePlayer(videoId, study.id, index);
        } else {
          window.open(url, '_blank');
        }
      });
      lessonsContainer.appendChild(div);
    });
  } else if (lessonsSection) {
    lessonsSection.classList.add('hidden');
  }

  const modal = document.getElementById('study-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    restorePageScroll();
  }
}

function closeStudyModal() {
  const modal = document.getElementById('study-modal');
  const videoWrapper = document.getElementById('study-video-wrapper');
  if (studyYtPlayer && studyYtPlayer.destroy) { studyYtPlayer.destroy(); studyYtPlayer = null; }
  if (videoWrapper) videoWrapper.classList.add('hidden');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
  }
  currentOpenStudy = null;
  currentStudyForPlayer = null;
  currentStudyLessonIndexForPlayer = null;
}

function loadStudyYouTubePlayer(videoId, studyId, lessonIndex) {
  if (!window.YT || !window.YT.Player) {
    setTimeout(() => loadStudyYouTubePlayer(videoId, studyId, lessonIndex), 500);
    return;
  }
  currentStudyForPlayer = studyId;
  currentStudyLessonIndexForPlayer = lessonIndex;
  if (studyYtPlayer && studyYtPlayer.destroy) studyYtPlayer.destroy();
  studyYtPlayer = new YT.Player('study-yt-player', {
    height: '100%',
    width: '100%',
    videoId: videoId,
    playerVars: { autoplay: 1, rel: 0, modestbranding: 1 },
    events: {
      'onStateChange': (event) => {
        if (event.data === YT.PlayerState.ENDED) {
          showToast('Aula concluída!', 'success');
          if (window.ADPELJourney && typeof window.ADPELJourney.registerStudyCompleted === 'function') {
            window.ADPELJourney.registerStudyCompleted(studyId);
          }
        }
      }
    }
  });
}

// Bloquear orientação para landscape quando vídeo entrar em tela cheia
['fullscreenchange', 'webkitfullscreenchange'].forEach(eventName => {
  document.addEventListener(eventName, async () => {
    const fsElement = document.fullscreenElement || document.webkitFullscreenElement;
    const isCourseModalOpen = document.getElementById('course-modal') && !document.getElementById('course-modal').classList.contains('hidden');
    const isStudyModalOpen = document.getElementById('study-modal') && !document.getElementById('study-modal').classList.contains('hidden');

    if (fsElement && (isCourseModalOpen || isStudyModalOpen)) {
      if (screen.orientation && screen.orientation.lock) {
        try { await screen.orientation.lock('landscape'); } catch (e) { console.log('Orientação não pôde ser travada.'); }
      }
    } else if (!fsElement) {
      if (screen.orientation && screen.orientation.unlock) {
        try { await screen.orientation.unlock(); } catch (e) {}
      }
    }
  });
});

// ==========================
// OFERTA MODAL
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

// ==========================
// BIBLE READER FUNCTIONS
// ==========================

const bibleBooks = [
  "Gênesis","Êxodo","Levítico","Números","Deuteronômio","Josué","Juízes","Rute","1 Samuel","2 Samuel","1 Reis","2 Reis","1 Crônicas","2 Crônicas","Esdras","Neemias","Ester","Jó","Salmos","Provérbios","Eclesiastes","Cantares","Isaías","Jeremias","Lamentações","Ezequiel","Daniel","Oséias","Joel","Amós","Obadias","Jonas","Miquéias","Naum","Habacuque","Sofonias","Ageu","Zacarias","Malaquias",
  "Mateus","Marcos","Lucas","João","Atos","Romanos","1 Coríntios","2 Coríntios","Gálatas","Efésios","Filipenses","Colossenses","1 Tessalonicenses","2 Tessalonicenses","1 Timóteo","2 Timóteo","Tito","Filemom","Hebreus","Tiago","1 Pedro","2 Pedro","1 João","2 João","3 João","Judas","Apocalipse"
];

let currentBibleBook = null;
let currentBibleChapter = null;

function populateBibleBooks() {
  const select = document.getElementById('bible-book-select');
  if (!select) return;
  if (select.options.length > 1) return;
  select.innerHTML = '<option value="">Selecione o Livro</option>';
  bibleBooks.forEach(book => {
    const option = document.createElement('option');
    option.value = book;
    option.textContent = book;
    select.appendChild(option);
  });
}

function abrirBiblia() {
  const cover = document.getElementById('bible-cover');
  const reader = document.getElementById('bible-reader');
  if (cover) cover.classList.add('hidden');
  if (reader) reader.classList.remove('hidden');
  populateBibleBooks();
  mostrarPaginaBiblia();
  if (window.ADPELJourney && typeof window.ADPELJourney.registerBibleRead === 'function') {
    window.ADPELJourney.registerBibleRead();
  }
  if (!currentBibleBook) {
    const select = document.getElementById('bible-book-select');
    if (select) {
      select.value = bibleBooks[0];
      mudarLivroBiblia(bibleBooks[0]);
    }
  }
}

function voltarCapaBiblia() {
  const cover = document.getElementById('bible-cover');
  const reader = document.getElementById('bible-reader');
  if (cover) cover.classList.remove('hidden');
  if (reader) reader.classList.add('hidden');
}

function mostrarPaginaBiblia() {
  const page = document.getElementById('bible-page');
  const results = document.getElementById('bible-search-results');
  const searchStatus = document.getElementById('bible-search-status');
  if (page) page.classList.remove('hidden');
  if (results) results.classList.add('hidden');
  if (searchStatus) searchStatus.classList.add('hidden');
}

function mostrarResultadosBiblia() {
  const page = document.getElementById('bible-page');
  const results = document.getElementById('bible-search-results');
  if (page) page.classList.add('hidden');
  if (results) results.classList.remove('hidden');
}

function voltarLeituraBiblia() {
  mostrarPaginaBiblia();
  const input = document.getElementById('bible-search-input');
  if (input) input.value = '';
}

async function mudarLivroBiblia(book) {
  if (!book) return;
  currentBibleBook = book;
  currentBibleChapter = 1;
  await carregarCapitulo(book, 1);
}

function renderChapterButtons(maxChapter) {
  const container = document.getElementById('bible-chapter-selector');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 1; i <= maxChapter; i++) {
    const btn = document.createElement('button');
    btn.className = `chapter-btn ${i === currentBibleChapter ? 'active' : ''}`;
    btn.textContent = i;
    btn.onclick = () => carregarCapitulo(currentBibleBook, i);
    container.appendChild(btn);
  }
}

async function carregarCapitulo(book, chapter) {
  if (!book || !chapter) return;
  currentBibleBook = book;
  currentBibleChapter = parseInt(chapter, 10);
  
  const content = document.getElementById('bible-verses-content');
  const currentBookEl = document.getElementById('bible-current-book');
  const currentChapterEl = document.getElementById('bible-current-chapter');
  const loading = document.getElementById('bible-page-loading');
  const prevBtn = document.getElementById('btn-capitulo-ant');
  const nextBtn = document.getElementById('btn-capitulo-prox');
  
  if (loading) loading.classList.remove('hidden');
  if (content) content.innerHTML = '';
  if (currentBookEl) currentBookEl.textContent = book;
  if (currentChapterEl) currentChapterEl.textContent = `Capítulo ${currentBibleChapter}`;
  
  try {
    const { data: verses, error } = await window.supabaseClient
      .from('bible_verses')
      .select('*')
      .eq('book', book)
      .eq('chapter', currentBibleChapter)
      .order('verse', { ascending: true });
      
    if (error) throw error;
    
    if (content) {
      if (verses && verses.length > 0) {
        content.innerHTML = verses.map(v => 
          `<p><span class="verse-num">${v.verse}</span>${escapeHtml(v.text)}</p>`
        ).join('');
      } else {
        content.innerHTML = '<p class="text-center text-[#8c7a6a] italic mt-8">Nenhum versículo encontrado para este capítulo.</p>';
      }
    }
    
    const { data: chapterData, error: chError } = await window.supabaseClient
      .from('bible_verses')
      .select('chapter')
      .eq('book', book)
      .order('chapter', { ascending: false })
      .limit(1);
      
    let maxChapter = 1;
    if (!chError && chapterData && chapterData.length > 0) {
      maxChapter = chapterData[0].chapter;
    }
    
    renderChapterButtons(maxChapter);
    if (window.ADPELJourney && typeof window.ADPELJourney.registerChapterRead === 'function') {
      window.ADPELJourney.registerChapterRead(book, currentBibleChapter);
      if (currentBibleChapter >= maxChapter && typeof window.ADPELJourney.registerBookCompleted === 'function') {
        window.ADPELJourney.registerBookCompleted(book);
      }
    }
    
    if (prevBtn) prevBtn.disabled = currentBibleChapter <= 1;
    if (nextBtn) nextBtn.disabled = currentBibleChapter >= maxChapter;
    
    const select = document.getElementById('bible-book-select');
    if (select) select.value = book;
    
  } catch (e) {
    console.error('Erro ao carregar capítulo:', e);
    if (content) content.innerHTML = '<p class="text-center text-red-600 italic mt-8">Erro ao carregar capítulo. Tente novamente.</p>';
  } finally {
    if (loading) loading.classList.add('hidden');
  }
}

function capituloAnterior() {
  if (currentBibleBook && currentBibleChapter > 1) {
    carregarCapitulo(currentBibleBook, currentBibleChapter - 1);
  }
}

function proximoCapitulo() {
  if (currentBibleBook) {
    carregarCapitulo(currentBibleBook, currentBibleChapter + 1);
  }
}

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
