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

function adminNavigateTo(view) {
  if (view === 'studies') view = 'courses';
  if (view === 'avisos') view = 'agenda';
  var views = document.querySelectorAll('[id^="admin-view-"]');
  for (var i = 0; i < views.length; i++) {
    views[i].classList.add('hidden');
  }

  var target = document.getElementById('admin-view-' + view);
  if (target) {
    target.classList.remove('hidden');
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
  }
}

// ============================================================
// SIDEBAR TOGGLE
// ============================================================

function toggleSidebar() {
  var sidebar = document.getElementById('sidebar');
  var backdrop = document.getElementById('admin-backdrop');
  if (!sidebar) { return; }

  if (sidebar.classList.contains('hidden')) {
    sidebar.classList.remove('hidden');
    sidebar.classList.add('fixed');
    if (backdrop) { backdrop.classList.remove('hidden'); }
  } else {
    sidebar.classList.add('hidden');
    sidebar.classList.remove('fixed');
    if (backdrop) { backdrop.classList.add('hidden'); }
  }
}

// ============================================================
// LOAD ALL DATA
// ============================================================

async function loadAllData() {
  if (!window.supabaseClient) {
    console.error('❌ Supabase client não disponível');
    return;
  }

  try {
    // Courses
    var cResult = await window.supabaseClient
      .from('courses').select('*').order('created_at', { ascending: false });
    coursesData = cResult.data || [];
    var statCourses = document.getElementById('stat-courses');
    if (statCourses) { statCourses.textContent = coursesData.length; }
    if (typeof renderAdminCourses === 'function') renderAdminCourses();

    // Library
    var lResult = await window.supabaseClient
      .from('library_books').select('*').order('created_at', { ascending: false });
    libraryData = lResult.data || [];
    var statLibrary = document.getElementById('stat-library');
    if (statLibrary) { statLibrary.textContent = libraryData.length; }
    if (typeof renderAdminLibrary === 'function') renderAdminLibrary();

    // Certificates
    var certResult = await window.supabaseClient
      .from('certificates').select('*').order('created_at', { ascending: false });
    certificatesData = certResult.data || [];
    if (typeof renderAdminCertificates === 'function') renderAdminCertificates();

    // Agenda (tabela: events)
    var agResult = await window.supabaseClient
      .from('events').select('*').order('event_date', { ascending: true });
    agendaData = agResult.data || [];
    if (typeof renderAdminAgenda === 'function') renderAdminAgenda();

    // Atualizacoes do App
    var updatesResult = await window.supabaseClient
      .from('app_updates').select('*').order('created_at', { ascending: false });
    if (!updatesResult.error) {
      appUpdatesData = updatesResult.data || [];
      var statUpdates = document.getElementById('stat-app-updates');
      if (statUpdates) { statUpdates.textContent = appUpdatesData.length; }
      if (typeof renderAdminAppUpdates === 'function') renderAdminAppUpdates();
    } else {
      console.warn('Nao foi possivel carregar atualizacoes do app:', updatesResult.error);
    }

    // Verses
    var vResult = await window.supabaseClient
      .from('verse_of_day').select('*').order('id', { ascending: false });
    versesData = vResult.data || [];
    if (typeof renderAdminVerses === 'function') renderAdminVerses();

    // Cofres
    var cofResult = await window.supabaseClient
      .from('fundraising_goals').select('*').order('created_at', { ascending: false });
    cofresData = cofResult.data || [];
    var statCofres = document.getElementById('stat-cofres');
    if (statCofres) { statCofres.textContent = cofresData.length; }

    // Cofres Stats
    var statsResult = await window.supabaseClient
      .from('fundraising_stats').select('*');
    if (statsResult.data) {
      cofresStatsData = {};
      for (var si = 0; si < statsResult.data.length; si++) {
        var s = statsResult.data[si];
        if (s && s.goal_id) {
          cofresStatsData[s.goal_id] = s;
        }
      }
    }
    if (typeof renderAdminCofres === 'function') renderAdminCofres();

    // Church Management (optional module)
    if (typeof loadChurchManagementData === 'function') {
      await loadChurchManagementData();
    }

    // Update recent activity
    updateAdminDashboardStats();
    updateRecentActivity();

  } catch (error) {
    console.error('❌ Erro ao carregar dados:', error);
    if (typeof showToast === 'function') showToast('Erro ao carregar dados', 'error');
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

  // Load data after DOM is ready and Supabase is initialized
  setTimeout(function() {
    if (typeof loadAllData === 'function') {
      loadAllData();
    }
  }, 500);
});

console.log('✅ admin.js carregado (core + recent activity + init)');
