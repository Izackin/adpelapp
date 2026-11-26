// ============================================================
// ADMIN.JS - Painel de Administração ADPEL (CORE)
// ============================================================
// Este arquivo contém apenas: navegação, sidebar, loadAllData,
// updateRecentActivity e init.
// Os CRUDs foram movidos para: admin/crud-*.js
// ============================================================

// ---- DATA STORAGE (global, usado por todos os CRUDs) ----
var coursesData = [];
var libraryData = [];
var certificatesData = [];
var agendaData = [];
var agendaAttendancesData = [];
var versesData = [];
var cofresData = [];
var cofresStatsData = {};
var appUpdatesData = [];
var membersData = [];
var memberMovementsData = [];
var cashMovementsData = [];
var churchCertificatesData = [];

if (typeof window.escapeHtml !== 'function') {
  window.escapeHtml = function(value) {
    if (value == null) return '';
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  };
}

if (typeof window.formatDate !== 'function') {
  window.formatDate = function(isoString) {
    if (!isoString) return '';
    var dateOnly = String(isoString).split('T')[0];
    var parts = dateOnly.split('-');
    if (parts.length !== 3) return '';
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  };
}

// ============================================================
// NAVIGATION
// ============================================================

var adminCurrentView = 'home';
var adminViewTitles = {home:'Visão geral',church:'Gestão da igreja',agenda:'Agenda e eventos',courses:'Cursos',library:'Biblioteca',verses:'Versículo do dia',certificates:'Certificados de curso',cofres:'Cofres',community:'Comunidade',notifications:'Notificações', 'app-updates':'Atualizações do app',system:'Sistema','bible-study':'Estudo bíblico'};
function adminNavigateTo(view) {
  if (view === 'avisos') view = 'agenda';
  if (!document.getElementById('admin-view-' + view)) return;
  adminCurrentView = view;
  var label = document.getElementById('admin-current-view');
  if (label) label.textContent = adminViewTitles[view] || 'Administração';
  var links = document.querySelectorAll('#sidebar button[data-admin-view]');
  for (var n = 0; n < links.length; n++) {
    if (links[n].dataset.adminView === view) links[n].setAttribute('aria-current','page');
    else links[n].removeAttribute('aria-current');
  }
  var main = document.querySelector('#admin-app main');
  if (main) main.scrollTop = 0;
  var views = document.querySelectorAll('[id^="admin-view-"]');
  for (var i = 0; i < views.length; i++) {
    views[i].classList.add('hidden');
  }

  var target = document.getElementById('admin-view-' + view);
  if (target) {
    target.classList.remove('hidden');
  }
  if (view === 'notifications' && typeof loadAdminAutomationStatus === 'function') {
    loadAdminAutomationStatus();
  }
  if (view === 'community' && typeof loadAdminCommunity === 'function') {
    loadAdminCommunity();
  }
  if (view === 'home' && !adminLoadPromise && adminInitialLoadComplete && typeof renderAdminDashboardV2 === 'function') {
    renderAdminDashboardV2();
  }
  if (view === 'bible-study' && typeof loadAdminBibleStudy === 'function') {
    loadAdminBibleStudy();
  }

  // Close mobile sidebar
  if (window.innerWidth < 768) {
    var sidebar = document.getElementById('sidebar');
    var backdrop = document.getElementById('admin-backdrop');
    if (sidebar) {
      sidebar.classList.add('hidden');
      sidebar.classList.remove('fixed');
    }
    if (backdrop) {
      backdrop.classList.add('hidden');
    }
    var menuButton = document.getElementById('admin-menu-toggle');
    if (menuButton) menuButton.setAttribute('aria-expanded','false');
  }
}

// ============================================================
// SIDEBAR TOGGLE
// ============================================================

function toggleSidebar() {
  var sidebar = document.getElementById('sidebar');
  var backdrop = document.getElementById('admin-backdrop');
  if (!sidebar) { return; }

  var menuButton = document.getElementById('admin-menu-toggle');
  if (sidebar.classList.contains('hidden')) {
    if (menuButton) menuButton.setAttribute('aria-expanded','true');
    sidebar.classList.remove('hidden');
    sidebar.classList.add('fixed');
    if (backdrop) { backdrop.classList.remove('hidden'); }
  } else {
    if (menuButton) menuButton.setAttribute('aria-expanded','false');
    sidebar.classList.add('hidden');
    sidebar.classList.remove('fixed');
    if (backdrop) { backdrop.classList.add('hidden'); }
  }
}

// ============================================================
// LOAD ALL DATA
// ============================================================

var adminLoadPromise = null;
var adminLoadQueued = false;
var adminInitialLoadComplete = false;
var adminAccessReady = false;

function adminLoadingState(active, message) {
  var el = document.getElementById('admin-load-status');
  if (el) { el.textContent = message || ''; el.setAttribute('aria-busy',String(active)); }
  var button = document.getElementById('admin-refresh-button');
  if (button) button.disabled = active;
}

function loadAllData() {
  if (!adminAccessReady || !window.supabaseClient) return Promise.resolve();
  // Serialize refreshes. A refresh requested after a write must not reuse stale data.
  if (adminLoadPromise) { adminLoadQueued = true; return adminLoadPromise; }
  adminLoadPromise = (async function() {
    try {
      do {
        adminLoadQueued = false;
        adminLoadingState(true, adminInitialLoadComplete ? 'Atualizando dados…' : 'Carregando painel…');
        try { await loadAdminDataPass(); } catch (error) {
          console.error('Erro ao carregar painel:',error);
          var updated=document.getElementById('admin-dashboard-updated');
          if(updated) updated.textContent='Falha na atualização';
          if(typeof showToast==='function') showToast('Não foi possível atualizar o painel. Tente novamente.','error');
        }
        adminInitialLoadComplete = true;
      } while (adminLoadQueued);
    } finally {
      adminLoadPromise = null;
      adminLoadingState(false,'');
    }
  })();
  return adminLoadPromise;
}

async function loadAdminDataPass() {
  var client = window.supabaseClient;
  var failures = [];
  var updated = document.getElementById('admin-dashboard-updated');
  if (updated) updated.textContent = 'Atualizando…';
  async function read(name, query, apply) {
    try {
      var result = await query;
      if (result.error) throw result.error;
      apply(result.data || []);
      return true;
    } catch (error) {
      failures.push(name);
      console.warn('Admin: falha ao carregar ' + name, error);
      return false;
    }
  }
  function count(id, value) { var el = document.getElementById(id); if (el) el.textContent = value; }
  function render(fn) { if (typeof fn === 'function') fn(); }
  async function task(name, fn) { try { if (typeof fn === 'function') await fn(); } catch (error) { failures.push(name); console.warn('Admin: falha em '+name,error); } }

  // Independent reads run in small parallel groups; renderers see their prerequisites.
  var first = await Promise.all([
    read('cursos',client.from('courses').select('*').order('created_at',{ascending:false}),function(rows){coursesData=rows;count('stat-courses',rows.length);render(typeof renderAdminCourses==='function'?renderAdminCourses:null);}),
    read('biblioteca',client.from('library_books').select('*').order('created_at',{ascending:false}),function(rows){libraryData=rows;count('stat-library',rows.length);render(typeof renderAdminLibrary==='function'?renderAdminLibrary:null);}),
    read('certificados',client.from('certificates').select('*').order('created_at',{ascending:false}),function(rows){certificatesData=rows;render(typeof renderAdminCertificates==='function'?renderAdminCertificates:null);}),
    read('eventos',client.from('events').select('*').order('event_date',{ascending:true}),function(rows){agendaData=rows;}),
    read('presenças',client.from('event_attendances').select('id,event_id,user_id,user_name,created_at'),function(rows){agendaAttendancesData=rows;})
  ]);
  render(typeof renderAdminAgenda==='function'?renderAdminAgenda:null);
  await Promise.all([
    read('atualizações',client.from('app_updates').select('*').order('created_at',{ascending:false}),function(rows){appUpdatesData=rows;count('stat-app-updates',rows.length);render(typeof renderAdminAppUpdates==='function'?renderAdminAppUpdates:null);}),
    read('versículos',client.from('verse_of_day').select('*').order('id',{ascending:false}),function(rows){versesData=rows;render(typeof renderAdminVerses==='function'?renderAdminVerses:null);}),
    read('cofres',client.from('fundraising_goals').select('*').order('created_at',{ascending:false}),function(rows){cofresData=rows;count('stat-cofres',rows.length);}),
    read('indicadores dos cofres',client.from('fundraising_stats').select('*'),function(rows){cofresStatsData={};rows.forEach(function(row){if(row&&row.goal_id)cofresStatsData[row.goal_id]=row;});}),
    task('solicitações de cursos',typeof loadCourseAccessRequests==='function'?loadCourseAccessRequests:null)
  ]);
  render(typeof renderAdminCofres==='function'?renderAdminCofres:null);
  await task('gestão da igreja',typeof loadChurchManagementData==='function'?function(){return loadChurchManagementData(first[2]?certificatesData:undefined);}:null);
  if (typeof loadAdminDashboardData === 'function') await task('visão geral',loadAdminDashboardData);
  else { updateAdminDashboardStats(); updateRecentActivity(); }
  if (failures.length) {
    if (updated) updated.textContent = 'Atualização parcial';
    if (typeof showToast === 'function') showToast('Algumas áreas não puderam ser atualizadas: '+failures.join(', ')+'. Tente atualizar novamente.','warning');
  }
}

function updateAdminDashboardStats() {
  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  var month = new Date().toISOString().slice(0, 7);
  var activeMembers = Array.isArray(membersData) ? membersData.filter(function(member) { return member.status === 'ativo'; }).length : 0;
  var newMembers = Array.isArray(membersData) ? membersData.filter(function(member) { return String(member.entry_date || '').slice(0, 7) === month; }).length : 0;
  var exits = Array.isArray(memberMovementsData) ? memberMovementsData.filter(function(item) {
    var type = item.movement_type || item.type;
    return String(item.movement_date || '').slice(0, 7) === month && ['saida', 'transferencia', 'afastamento', 'falecimento'].indexOf(type) >= 0;
  }).length : 0;
  var balance = 0;
  if (Array.isArray(cashMovementsData)) {
    for (var i = 0; i < cashMovementsData.length; i++) {
      var amount = Number(cashMovementsData[i].amount || 0);
      if (cashMovementsData[i].type === 'entrada') balance += amount;
      if (cashMovementsData[i].type === 'saida') balance -= amount;
    }
  }
  var today = new Date().toISOString().slice(0, 10);
  var upcomingEvents = Array.isArray(agendaData) ? agendaData.filter(function(event) {
    return String(event.event_date || '').slice(0, 10) >= today;
  }).length : 0;

  setText('stat-active-members', activeMembers);
  setText('stat-new-members', newMembers);
  setText('stat-member-exits', exits);
  setText('stat-cash-balance', 'R$ ' + balance.toFixed(2).replace('.', ','));
  setText('stat-certificates', Array.isArray(certificatesData) ? certificatesData.length : 0);
  setText('stat-upcoming-events', upcomingEvents);
}

// ============================================================
// RECENT ACTIVITY
// ============================================================

function updateRecentActivity() {
  var container = document.getElementById('recent-activity');
  if (!container) { return; }

  var items = [];

  if (Array.isArray(coursesData)) {
    for (var i = 0; i < Math.min(coursesData.length, 3); i++) {
      if (coursesData[i]) {
        items.push({
          type: 'course',
          icon: 'graduation-cap',
          color: 'text-adpel-600',
          text: 'Curso: ' + (coursesData[i].title || 'Sem título'),
          time: (coursesData[i].created_at || '')
        });
      }
    }
  }

  if (false && Array.isArray(window.avisosData)) {
    for (var j = 0; j < Math.min(avisosData.length, 2); j++) {
      if (avisosData[j]) {
        items.push({
          type: 'aviso',
          icon: 'bullhorn',
          color: 'text-red-600',
          text: 'Aviso: ' + (avisosData[j].title || 'Sem título'),
          time: (avisosData[j].created_at || '')
        });
      }
    }
  }

  if (Array.isArray(agendaData)) {
    for (var k = 0; k < Math.min(agendaData.length, 2); k++) {
      if (agendaData[k]) {
        items.push({
          type: 'event',
          icon: 'calendar-alt',
          color: 'text-purple-600',
          text: 'Evento: ' + (agendaData[k].title || 'Sem título'),
          time: (agendaData[k].created_at || '')
        });
      }
    }
  }

  if (items.length === 0) {
    container.innerHTML = '<div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"><div class="text-sm text-gray-600">Nenhum dado recente encontrado</div></div>';
    return;
  }

  var html = '';
  for (var x = 0; x < items.length; x++) {
    var item = items[x];
    html += '<div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">' +
      '<div class="flex items-center gap-3">' +
      '<i class="fas fa-' + item.icon + ' ' + item.color + '"></i>' +
      '<span class="text-sm text-gray-700">' + escapeHtml(item.text) + '</span>' +
      '</div>' +
      '<span class="text-xs text-gray-400">' + formatDate(item.time) + '</span>' +
      '</div>';
  }
  container.innerHTML = html;
}

// ============================================================
// INIT
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
  // Form listeners
  var courseForm = document.getElementById('course-form');
  if (courseForm) { courseForm.addEventListener('submit', handleCourseSubmit); }

  var libraryForm = document.getElementById('library-form');
  if (libraryForm) { libraryForm.addEventListener('submit', handleLibrarySubmit); }

  var certificateForm = document.getElementById('certificate-form');
  if (certificateForm) { certificateForm.addEventListener('submit', handleCertificateSubmit); }

  var agendaForm = document.getElementById('agenda-form');
  if (agendaForm) { agendaForm.addEventListener('submit', handleCreateAgenda); }

  var verseForm = document.getElementById('verse-form');
  if (verseForm) { verseForm.addEventListener('submit', handleVerseSubmit); }

  var cofreForm = document.getElementById('cofre-form');
  if (cofreForm) { cofreForm.addEventListener('submit', handleCofreSubmit); }

  var appUpdateForm = document.getElementById('app-update-form');
  if (appUpdateForm) { appUpdateForm.addEventListener('submit', handleAppUpdateSubmit); }

  // The access gate starts the initial load once, after master verification.
});

console.log('✅ admin.js carregado (core + recent activity + init)');
