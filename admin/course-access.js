// ============================================================
// PAID COURSE ACCESS - admin/course-access.js
// Manual approval now; payment provider can automate the same
// status transition later without changing the course UX.
// ============================================================

var courseAccessRequestsData = [];

function courseAccessFormatBRL(cents) {
  var value = Number(cents || 0) / 100;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function courseAccessStatusMeta(status) {
  var map = {
    pending: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700', icon: 'clock' },
    active: { label: 'Liberado', cls: 'bg-green-100 text-green-700', icon: 'circle-check' },
    rejected: { label: 'Recusado', cls: 'bg-red-100 text-red-700', icon: 'circle-xmark' },
    revoked: { label: 'Revogado', cls: 'bg-gray-200 text-gray-600', icon: 'ban' }
  };
  return map[status] || { label: status || 'Desconhecido', cls: 'bg-gray-100 text-gray-600', icon: 'circle-question' };
}

function courseAccessDateLabel(value) {
  if (!value) return '';
  var date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).replace('.', '');
}

async function loadCourseAccessRequests() {
  var container = document.getElementById('course-access-admin-list');
  if (!container || !window.supabaseClient) return;

  container.innerHTML = '<div class="text-sm text-gray-500 py-6 text-center"><i class="fas fa-spinner fa-spin mr-2"></i>Carregando solicitações...</div>';

  try {
    var result = await window.supabaseClient
      .from('course_access')
      .select('id,course_id,user_id,status,amount_cents,access_source,requested_at,approved_at,approved_by,updated_at')
      .order('requested_at', { ascending: false });

    if (result.error) throw result.error;
    courseAccessRequestsData = result.data || [];

    var userIds = Array.from(new Set(courseAccessRequestsData.map(function(item) { return item.user_id; }).filter(Boolean)));
    var profilesMap = {};

    if (userIds.length) {
      var profilesResult = await window.supabaseClient
        .from('profiles')
        .select('id,full_name,public_name')
        .in('id', userIds);

      if (!profilesResult.error) {
        (profilesResult.data || []).forEach(function(profile) {
          profilesMap[profile.id] = profile;
        });
      }
    }

    renderCourseAccessRequests(profilesMap);
  } catch (error) {
    console.error('Erro ao carregar solicitações de cursos:', error);
    container.innerHTML = '<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Não foi possível carregar as solicitações de acesso.</div>';
  }
}

function renderCourseAccessRequests(profilesMap) {
  var container = document.getElementById('course-access-admin-list');
  var pendingBadge = document.getElementById('course-access-pending-count');
  if (!container) return;

  profilesMap = profilesMap || {};
  var pendingCount = courseAccessRequestsData.filter(function(item) { return item.status === 'pending'; }).length;

  if (pendingBadge) {
    pendingBadge.textContent = pendingCount + (pendingCount === 1 ? ' pendente' : ' pendentes');
    pendingBadge.classList.toggle('hidden', pendingCount === 0);
  }

  if (!courseAccessRequestsData.length) {
    container.innerHTML =
      '<div class="py-8 text-center text-gray-500">' +
        '<div class="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3"><i class="fas fa-unlock-keyhole text-gray-400"></i></div>' +
        '<p class="font-semibold text-gray-700">Nenhuma solicitação ainda</p>' +
        '<p class="text-xs mt-1">Quando alguém solicitar um curso pago, aparecerá aqui.</p>' +
      '</div>';
    return;
  }

  var courseMap = {};
  (Array.isArray(coursesData) ? coursesData : []).forEach(function(course) {
    courseMap[course.id] = course;
  });

  container.innerHTML = '<div class="space-y-3">' + courseAccessRequestsData.map(function(item) {
    var profile = profilesMap[item.user_id] || {};
    var course = courseMap[item.course_id] || {};
    var status = courseAccessStatusMeta(item.status);
    var name = profile.full_name || profile.public_name || 'Usuário';
    var currentPrice = Number(course.price_cents || item.amount_cents || 0);
    var amountChanged = Number(item.amount_cents || 0) !== Number(course.price_cents || item.amount_cents || 0);

    var actions = '';
    if (item.status !== 'active') {
      actions += '<button type="button" onclick="updateCourseAccessStatus(\'' + item.id + '\', \'active\')" class="px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700 min-h-[40px]"><i class="fas fa-unlock mr-1"></i>Liberar</button>';
    }
    if (item.status === 'pending') {
      actions += '<button type="button" onclick="updateCourseAccessStatus(\'' + item.id + '\', \'rejected\')" class="px-3 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 min-h-[40px]">Recusar</button>';
    }
    if (item.status === 'active') {
      actions += '<button type="button" onclick="updateCourseAccessStatus(\'' + item.id + '\', \'revoked\')" class="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-xs font-bold hover:bg-gray-50 min-h-[40px]">Revogar</button>';
    }

    return '<article class="rounded-xl border border-gray-200 p-4">' +
      '<div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">' +
        '<div class="min-w-0">' +
          '<div class="flex flex-wrap items-center gap-2">' +
            '<strong class="text-sm text-gray-800">' + escapeHtml(name) + '</strong>' +
            '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ' + status.cls + '"><i class="fas fa-' + status.icon + '"></i>' + status.label + '</span>' +
          '</div>' +
          '<p class="text-sm font-semibold text-adpel-700 mt-1 truncate">' + escapeHtml(course.title || 'Curso removido') + '</p>' +
          '<div class="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-gray-500">' +
            '<span><i class="fas fa-tag mr-1"></i>' + escapeHtml(courseAccessFormatBRL(currentPrice)) + '</span>' +
            '<span><i class="fas fa-clock mr-1"></i>' + escapeHtml(courseAccessDateLabel(item.requested_at)) + '</span>' +
            (amountChanged ? '<span class="text-amber-600 font-semibold"><i class="fas fa-triangle-exclamation mr-1"></i>Preço alterado desde a solicitação</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="flex flex-wrap gap-2">' + actions + '</div>' +
      '</div>' +
    '</article>';
  }).join('') + '</div>';
}

async function updateCourseAccessStatus(accessId, nextStatus) {
  var item = courseAccessRequestsData.find(function(row) { return String(row.id) === String(accessId); });
  if (!item || !window.supabaseClient) return;

  var labels = {
    active: 'liberar este curso para o usuário',
    rejected: 'recusar esta solicitação',
    revoked: 'revogar o acesso a este curso'
  };
  if (!confirm('Deseja ' + (labels[nextStatus] || 'alterar este acesso') + '?')) return;

  try {
    var update = {
      status: nextStatus,
      updated_at: new Date().toISOString()
    };

    if (nextStatus === 'active') {
      var authResult = await window.supabaseClient.auth.getUser();
      var adminUser = authResult.data && authResult.data.user ? authResult.data.user : null;
      update.approved_at = new Date().toISOString();
      update.approved_by = adminUser ? adminUser.id : null;
    } else if (nextStatus === 'rejected') {
      update.approved_at = null;
      update.approved_by = null;
    }

    var result = await window.supabaseClient
      .from('course_access')
      .update(update)
      .eq('id', accessId);

    if (result.error) throw result.error;

    await logCourseAccessAudit(item, nextStatus);
    if (typeof showToast === 'function') {
      showToast(nextStatus === 'active' ? 'Curso liberado para o usuário!' : 'Acesso atualizado.', 'success');
    }
    await loadCourseAccessRequests();
    if (typeof loadAdminDashboardData === 'function') {
      await loadAdminDashboardData();
    }
  } catch (error) {
    console.error('Erro ao atualizar acesso ao curso:', error);
    if (typeof showToast === 'function') showToast('Erro ao atualizar acesso: ' + error.message, 'error');
  }
}

async function logCourseAccessAudit(item, nextStatus) {
  try {
    var authResult = await window.supabaseClient.auth.getUser();
    var adminUser = authResult.data && authResult.data.user ? authResult.data.user : null;
    if (!adminUser) return;

    var actionMap = {
      active: 'course_access_approved',
      rejected: 'course_access_rejected',
      revoked: 'course_access_revoked'
    };

    await window.supabaseClient.from('audit_logs').insert({
      user_id: adminUser.id,
      action: actionMap[nextStatus] || 'course_access_updated',
      table_name: 'course_access',
      record_id: item.id,
      payload: {
        course_id: item.course_id,
        user_id: item.user_id,
        status: nextStatus,
        amount_cents: item.amount_cents
      }
    });
  } catch (error) {
    console.warn('Não foi possível registrar auditoria do acesso ao curso:', error);
  }
}

Object.assign(window, {
  loadCourseAccessRequests,
  renderCourseAccessRequests,
  updateCourseAccessStatus
});
