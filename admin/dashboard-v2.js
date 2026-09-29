// Admin Dashboard V2 - productivity overview using existing data only.
// No schema changes: members/events/courses are already loaded globally by admin.js.
// Extra dashboard context comes from audit_logs, member_imports and calendar_integrations.

var adminDashboardAuditData = [];
var adminDashboardImportData = [];
var adminDashboardCalendarIntegration = null;

function adminDashboardEscape(value) {
  return typeof window.escapeHtml === 'function'
    ? window.escapeHtml(value == null ? '' : value)
    : String(value == null ? '' : value);
}

function adminDashboardToday() {
  var now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
}

function adminDashboardMonthPrefix() {
  return adminDashboardToday().slice(0, 7);
}

function adminDashboardAddDays(dateString, days) {
  var date = new Date(String(dateString) + 'T12:00:00');
  date.setDate(date.getDate() + days);
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

function adminDashboardDateLabel(dateString) {
  if (!dateString) return 'Data a confirmar';
  var value = String(dateString).slice(0, 10);
  var date = new Date(value + 'T12:00:00');
  if (Number.isNaN(date.getTime())) return 'Data a confirmar';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

function adminDashboardDateTime(value) {
  if (!value) return 'Sem registro';
  var date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem registro';
  return date.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '');
}

function adminDashboardRelativeTime(value) {
  if (!value) return '';
  var date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  var diff = Date.now() - date.getTime();
  var minute = 60000;
  var hour = minute * 60;
  var day = hour * 24;
  if (diff < minute) return 'agora';
  if (diff < hour) return 'há ' + Math.max(1, Math.floor(diff / minute)) + ' min';
  if (diff < day) return 'há ' + Math.floor(diff / hour) + ' h';
  if (diff < day * 7) return 'há ' + Math.floor(diff / day) + ' d';
  return adminDashboardDateTime(value);
}

function adminDashboardCompactLocation(value) {
  var text = String(value || '').trim();
  if (!text) return '';
  return (text.split(/\s+-\s+|,/)[0] || text).trim();
}

function adminDashboardSetText(id, value) {
  var element = document.getElementById(id);
  if (element) element.textContent = value;
}

function adminDashboardStats() {
  var members = Array.isArray(membersData) ? membersData : [];
  var events = Array.isArray(agendaData) ? agendaData : [];
  var courses = Array.isArray(coursesData) ? coursesData : [];
  var month = adminDashboardMonthPrefix();
  var today = adminDashboardToday();
  var weekEnd = adminDashboardAddDays(today, 7);

  return {
    membersTotal: members.length,
    membersActive: members.filter(function(member) { return member.status === 'ativo'; }).length,
    membersNew: members.filter(function(member) { return String(member.entry_date || '').slice(0, 7) === month; }).length,
    birthdaysMonth: members.filter(function(member) { return String(member.birth_date || '').slice(5, 7) === month.slice(5, 7); }).length,
    eventsNext7: events.filter(function(event) {
      var date = String(event.event_date || '').slice(0, 10);
      return event.is_active !== false && date >= today && date <= weekEnd;
    }).length,
    eventsUpcoming: events.filter(function(event) {
      return event.is_active !== false && String(event.event_date || '').slice(0, 10) >= today;
    }).length,
    coursesPublished: courses.filter(function(course) { return course.is_published === true; }).length,
    coursesTotal: courses.length
  };
}

function adminDashboardOpenVerseEditor() {
  adminNavigateTo('home');
  window.setTimeout(function() {
    var editor = document.getElementById('admin-verses-editor');
    if (editor && typeof editor.scrollIntoView === 'function') {
      editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 80);
}

function adminDashboardQuickAction(action) {
  if (action === 'member') {
    adminNavigateTo('church');
    window.setTimeout(function() {
      if (typeof setChurchTab === 'function') setChurchTab('members');
      if (typeof showMemberForm === 'function') showMemberForm();
      var form = document.getElementById('member-form-container');
      if (form && typeof form.scrollIntoView === 'function') form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return;
  }

  if (action === 'event') {
    adminNavigateTo('agenda');
    window.setTimeout(function() {
      if (typeof showAgendaForm === 'function') showAgendaForm();
      var form = document.getElementById('agenda-form-container');
      if (form && typeof form.scrollIntoView === 'function') form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return;
  }

  if (action === 'notification') {
    adminNavigateTo('notifications');
    window.setTimeout(function() {
      var title = document.getElementById('notif-title');
      if (title && typeof title.focus === 'function') title.focus();
    }, 80);
    return;
  }

  if (action === 'course') {
    adminNavigateTo('courses');
    window.setTimeout(function() {
      if (typeof showCourseForm === 'function') showCourseForm();
      var form = document.getElementById('course-form-container');
      if (form && typeof form.scrollIntoView === 'function') form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }
}

function adminDashboardPendingItems() {
  var today = adminDashboardToday();
  var eventDrafts = (Array.isArray(agendaData) ? agendaData : []).filter(function(event) {
    return event.is_active !== false &&
      String(event.event_date || '').slice(0, 10) >= today &&
      event.is_published !== true;
  }).length;

  var courseDrafts = (Array.isArray(coursesData) ? coursesData : []).filter(function(course) {
    return course.is_published !== true;
  }).length;

  var importIssues = adminDashboardImportData.filter(function(item) {
    return Number(item.error_rows || 0) > 0 ||
      item.status === 'failed' ||
      item.status === 'completed_with_errors';
  }).length;

  var items = [];
  if (eventDrafts) {
    items.push({
      level: 'warning',
      icon: 'calendar-xmark',
      title: eventDrafts + (eventDrafts === 1 ? ' evento em rascunho' : ' eventos em rascunho'),
      text: 'Revise a publicação da agenda futura.',
      action: "adminNavigateTo('agenda')"
    });
  }

  if (courseDrafts) {
    items.push({
      level: 'info',
      icon: 'graduation-cap',
      title: courseDrafts + (courseDrafts === 1 ? ' curso não publicado' : ' cursos não publicados'),
      text: 'Conteúdo salvo que ainda não está visível no app.',
      action: "adminNavigateTo('courses')"
    });
  }

  if (importIssues) {
    items.push({
      level: 'danger',
      icon: 'file-circle-exclamation',
      title: importIssues + (importIssues === 1 ? ' importação requer atenção' : ' importações requerem atenção'),
      text: 'Há linhas com erro ou importação não concluída.',
      action: "adminNavigateTo('church')"
    });
  }

  if (adminDashboardCalendarIntegration &&
      (adminDashboardCalendarIntegration.status === 'error' || adminDashboardCalendarIntegration.last_error)) {
    items.push({
      level: 'danger',
      icon: 'calendar-days',
      title: 'Google Agenda requer atenção',
      text: adminDashboardCalendarIntegration.last_error || 'A integração está em estado de erro.',
      action: "adminNavigateTo('agenda')"
    });
  }

  return items;
}

function renderAdminDashboardPendings() {
  var container = document.getElementById('admin-dashboard-pendings');
  var count = document.getElementById('admin-dashboard-pending-count');
  if (!container) return;

  var items = adminDashboardPendingItems();
  if (count) count.textContent = String(items.length);

  if (!items.length) {
    container.innerHTML =
      '<div class="admin-v2-empty-success">' +
        '<span><i class="fas fa-circle-check"></i></span>' +
        '<div><strong>Tudo em ordem</strong><p>Nenhuma pendência importante encontrada agora.</p></div>' +
      '</div>';
    return;
  }

  container.innerHTML = items.map(function(item) {
    return '<button type="button" class="admin-v2-pending admin-v2-pending--' + item.level + '" onclick="' + item.action + '">' +
      '<span class="admin-v2-pending__icon"><i class="fas fa-' + item.icon + '"></i></span>' +
      '<span class="admin-v2-pending__body"><strong>' + adminDashboardEscape(item.title) + '</strong><small>' + adminDashboardEscape(item.text) + '</small></span>' +
      '<i class="fas fa-chevron-right admin-v2-pending__arrow"></i>' +
    '</button>';
  }).join('');
}

function renderAdminDashboardGoogle() {
  var container = document.getElementById('admin-dashboard-google');
  if (!container) return;

  var integration = adminDashboardCalendarIntegration;
  if (!integration) {
    container.innerHTML =
      '<div class="admin-v2-integration-state is-off">' +
        '<span class="admin-v2-integration-icon"><i class="fab fa-google"></i></span>' +
        '<div><strong>Não conectado</strong><p>Conecte um calendário para manter a agenda sincronizada.</p></div>' +
      '</div>' +
      '<button type="button" class="admin-v2-secondary-button" onclick="adminNavigateTo(\'agenda\')">Configurar na Agenda <i class="fas fa-arrow-right"></i></button>';
    return;
  }

  var active = integration.status === 'active' && !integration.last_error;
  container.innerHTML =
    '<div class="admin-v2-integration-state ' + (active ? 'is-ok' : 'is-error') + '">' +
      '<span class="admin-v2-integration-icon"><i class="fab fa-google"></i></span>' +
      '<div><strong>' + (active ? 'Sincronização ativa' : 'Atenção necessária') + '</strong>' +
      '<p>' + adminDashboardEscape(integration.calendar_name || 'Google Agenda') + '</p></div>' +
      '<span class="admin-v2-status-dot"></span>' +
    '</div>' +
    '<div class="admin-v2-integration-meta">' +
      '<span><small>Última sincronização</small><strong>' + adminDashboardEscape(adminDashboardDateTime(integration.last_synced_at)) + '</strong></span>' +
      '<span><small>Canal</small><strong>' + (integration.watch_expires_at ? 'Monitoramento ativo' : 'Sem monitoramento') + '</strong></span>' +
    '</div>' +
    (integration.last_error ? '<p class="admin-v2-inline-error">' + adminDashboardEscape(integration.last_error) + '</p>' : '') +
    '<button type="button" class="admin-v2-secondary-button" onclick="adminNavigateTo(\'agenda\')">Abrir integração <i class="fas fa-arrow-right"></i></button>';
}

function renderAdminDashboardEvents() {
  var container = document.getElementById('admin-dashboard-events');
  if (!container) return;

  var today = adminDashboardToday();
  var events = (Array.isArray(agendaData) ? agendaData : [])
    .filter(function(event) {
      return event.is_active !== false && String(event.event_date || '').slice(0, 10) >= today;
    })
    .slice()
    .sort(function(a, b) {
      var aKey = String(a.event_date || '') + 'T' + String(a.event_time || '23:59');
      var bKey = String(b.event_date || '') + 'T' + String(b.event_time || '23:59');
      return aKey.localeCompare(bKey);
    })
    .slice(0, 4);

  if (!events.length) {
    container.innerHTML = '<div class="admin-v2-empty"><i class="fas fa-calendar-check"></i><p>Nenhum evento futuro encontrado.</p></div>';
    return;
  }

  container.innerHTML = events.map(function(event) {
    var source = event.source === 'google' ? 'Google' : 'Manual';
    var draft = event.is_published !== true;
    return '<button type="button" class="admin-v2-event-row" onclick="adminNavigateTo(\'agenda\')">' +
      '<span class="admin-v2-event-date"><strong>' + adminDashboardEscape(adminDashboardDateLabel(event.event_date).split(' ')[0]) + '</strong><small>' + adminDashboardEscape((adminDashboardDateLabel(event.event_date).split(' ')[1] || '').toUpperCase()) + '</small></span>' +
      '<span class="admin-v2-event-main"><strong>' + adminDashboardEscape(event.title || 'Evento') + '</strong>' +
      '<small>' + (event.event_time ? '<i class="fas fa-clock"></i> ' + adminDashboardEscape(String(event.event_time).slice(0, 5)) : 'Horário a confirmar') +
      (event.location ? ' <span>·</span> <i class="fas fa-location-dot"></i> ' + adminDashboardEscape(adminDashboardCompactLocation(event.location)) : '') + '</small></span>' +
      '<span class="admin-v2-event-badges"><em>' + source + '</em>' + (draft ? '<em class="is-draft">Rascunho</em>' : '') + '</span>' +
      '<i class="fas fa-chevron-right admin-v2-event-arrow"></i>' +
    '</button>';
  }).join('');
}

function renderAdminDashboardMembers() {
  var container = document.getElementById('admin-dashboard-members');
  if (!container) return;
  var stats = adminDashboardStats();

  container.innerHTML =
    '<div class="admin-v2-member-grid">' +
      '<div><span>Membros cadastrados</span><strong>' + stats.membersTotal + '</strong></div>' +
      '<div><span>Ativos</span><strong>' + stats.membersActive + '</strong></div>' +
      '<div><span>Novos no mês</span><strong>' + stats.membersNew + '</strong></div>' +
      '<div><span>Aniversariantes</span><strong>' + stats.birthdaysMonth + '</strong></div>' +
    '</div>' +
    '<button type="button" class="admin-v2-secondary-button" onclick="adminNavigateTo(\'church\')">Abrir Gestão da Igreja <i class="fas fa-arrow-right"></i></button>';
}

function adminDashboardActivityLabel(item) {
  var labels = {
    member_created: 'Membro cadastrado',
    member_updated: 'Cadastro de membro atualizado',
    member_movement_created: 'Movimentação de membro registrada',
    members_bulk_imported: 'Importação de membros concluída',
    members_exported: 'Membros exportados',
    event_created: 'Evento criado',
    event_updated: 'Evento atualizado',
    event_deactivated: 'Evento desativado',
    event_deleted: 'Evento excluído',
    certificate_created: 'Certificado criado',
    cash_movement_created: 'Movimentação de caixa registrada',
    course_created: 'Curso criado',
    course_updated: 'Curso atualizado',
    course_deleted: 'Curso excluído'
  };
  return labels[item.action] || String(item.action || 'Atividade administrativa').replaceAll('_', ' ');
}

function adminDashboardActivityDetail(item) {
  var payload = item && item.payload && typeof item.payload === 'object' ? item.payload : {};
  if (item.action === 'members_bulk_imported') {
    return Number(payload.imported_rows || 0) + ' importado(s) · ' + Number(payload.error_rows || 0) + ' erro(s)';
  }
  if (item.action === 'members_exported') {
    return Number(payload.count || 0) + ' registro(s) · ' + String(payload.format || '').toUpperCase();
  }
  if (payload.title) return String(payload.title);
  if (payload.full_name) return String(payload.full_name);
  return item.table_name ? 'Área: ' + String(item.table_name).replaceAll('_', ' ') : '';
}

function adminDashboardActivityIcon(item) {
  var table = String(item.table_name || '');
  if (table.indexOf('member') >= 0) return 'users';
  if (table.indexOf('event') >= 0) return 'calendar-days';
  if (table.indexOf('certificate') >= 0) return 'certificate';
  if (table.indexOf('course') >= 0) return 'graduation-cap';
  if (table.indexOf('cash') >= 0) return 'wallet';
  return 'clock-rotate-left';
}

function renderAdminDashboardActivity() {
  var container = document.getElementById('admin-dashboard-activity');
  if (!container) return;

  var items = Array.isArray(adminDashboardAuditData) ? adminDashboardAuditData.slice(0, 7) : [];
  if (!items.length) {
    container.innerHTML = '<div class="admin-v2-empty"><i class="fas fa-clock-rotate-left"></i><p>Nenhuma atividade administrativa registrada.</p></div>';
    return;
  }

  container.innerHTML = items.map(function(item) {
    var detail = adminDashboardActivityDetail(item);
    return '<div class="admin-v2-activity-row">' +
      '<span class="admin-v2-activity-icon"><i class="fas fa-' + adminDashboardActivityIcon(item) + '"></i></span>' +
      '<span class="admin-v2-activity-main"><strong>' + adminDashboardEscape(adminDashboardActivityLabel(item)) + '</strong>' +
      (detail ? '<small>' + adminDashboardEscape(detail) + '</small>' : '') + '</span>' +
      '<time title="' + adminDashboardEscape(adminDashboardDateTime(item.created_at)) + '">' + adminDashboardEscape(adminDashboardRelativeTime(item.created_at)) + '</time>' +
    '</div>';
  }).join('');
}

function renderAdminDashboardMetrics() {
  var stats = adminDashboardStats();
  adminDashboardSetText('admin-v2-members-active', stats.membersActive);
  adminDashboardSetText('admin-v2-members-new', stats.membersNew);
  adminDashboardSetText('admin-v2-events-week', stats.eventsNext7);
  adminDashboardSetText('admin-v2-courses-published', stats.coursesPublished);

  var membersMeta = document.getElementById('admin-v2-members-meta');
  if (membersMeta) membersMeta.textContent = stats.membersTotal + ' cadastrados';

  var eventsMeta = document.getElementById('admin-v2-events-meta');
  if (eventsMeta) eventsMeta.textContent = stats.eventsUpcoming + ' futuros no total';

  var coursesMeta = document.getElementById('admin-v2-courses-meta');
  if (coursesMeta) coursesMeta.textContent = stats.coursesPublished + ' de ' + stats.coursesTotal + ' publicados';
}

function renderAdminDashboardV2() {
  renderAdminDashboardMetrics();
  renderAdminDashboardPendings();
  renderAdminDashboardGoogle();
  renderAdminDashboardEvents();
  renderAdminDashboardMembers();
  renderAdminDashboardActivity();

  var updated = document.getElementById('admin-dashboard-updated');
  if (updated) {
    updated.textContent = 'Atualizado às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
}

async function loadAdminDashboardData() {
  if (!window.supabaseClient) return;

  var queries = [
    window.supabaseClient
      .from('audit_logs')
      .select('id,action,table_name,payload,created_at')
      .order('created_at', { ascending: false })
      .limit(8),
    window.supabaseClient
      .from('member_imports')
      .select('id,file_name,source,status,imported_rows,error_rows,created_at')
      .order('created_at', { ascending: false })
      .limit(10),
    window.supabaseClient
      .from('calendar_integrations')
      .select('status,calendar_name,last_synced_at,last_error,watch_expires_at,updated_at')
      .eq('provider', 'google')
      .order('updated_at', { ascending: false })
      .limit(1)
  ];

  var results = await Promise.allSettled(queries);

  if (results[0].status === 'fulfilled' && !results[0].value.error) {
    adminDashboardAuditData = results[0].value.data || [];
  } else {
    console.warn('Dashboard: auditoria indisponível.', results[0].status === 'rejected' ? results[0].reason : results[0].value.error);
  }

  if (results[1].status === 'fulfilled' && !results[1].value.error) {
    adminDashboardImportData = results[1].value.data || [];
  } else {
    console.warn('Dashboard: histórico de importações indisponível.', results[1].status === 'rejected' ? results[1].reason : results[1].value.error);
  }

  if (results[2].status === 'fulfilled' && !results[2].value.error) {
    adminDashboardCalendarIntegration = (results[2].value.data || [])[0] || null;
  } else {
    console.warn('Dashboard: integração Google indisponível.', results[2].status === 'rejected' ? results[2].reason : results[2].value.error);
  }

  renderAdminDashboardV2();
}

Object.assign(window, {
  adminDashboardOpenVerseEditor,
  adminDashboardQuickAction,
  renderAdminDashboardV2,
  loadAdminDashboardData
});
