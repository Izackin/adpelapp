// ============================================================
// CRUD AGENDA V2 - admin/crud-agenda.js
// ============================================================

var agendaParticipantsEventId = null;

function agendaText(value) {
  return String(value == null ? '' : value).trim();
}

function agendaComparisonText(value) {
  return agendaText(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
}

function agendaToday() {
  var now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
}

function agendaIsValidHttpUrl(value) {
  if (!agendaText(value)) return true;
  try {
    var parsed = new URL(agendaText(value));
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch (error) {
    return false;
  }
}

function validateAgendaData(data) {
  var errors = [];
  if (!agendaText(data.title)) errors.push('Informe o título do evento.');
  if (!agendaText(data.event_date)) errors.push('Informe a data inicial.');
  if (data.end_date && data.event_date && data.end_date < data.event_date) {
    errors.push('A data final não pode ser anterior à data inicial.');
  }
  var effectiveEndDate = data.end_date || data.event_date;
  if (data.event_time && data.end_time && data.event_date && effectiveEndDate === data.event_date && data.end_time < data.event_time) {
    errors.push('A hora final não pode ser anterior à hora inicial no mesmo dia.');
  }
  if (!agendaIsValidHttpUrl(data.maps_url)) errors.push('Informe uma URL válida para o Google Maps.');
  if (!agendaIsValidHttpUrl(data.image_url)) errors.push('Informe uma URL válida para a imagem.');
  return errors;
}

function agendaDuplicateDraft(event) {
  return {
    id: '',
    title: event.title || '',
    category: event.category || 'culto',
    description: event.description || '',
    image_url: event.image_url || '',
    event_date: event.event_date || '',
    event_time: event.event_time || '',
    end_date: event.end_date || '',
    end_time: event.end_time || '',
    location: event.location || '',
    maps_url: event.maps_url || '',
    is_published: event.is_published === true,
    is_active: event.is_active !== false,
    is_featured: event.is_featured === true,
    source: 'manual',
    external_event_id: null,
    external_calendar_id: null
  };
}

function agendaFiltersFromDom() {
  function value(id, fallback) {
    var input = document.getElementById(id);
    return input ? input.value : fallback;
  }
  return {
    search: value('agenda-search', ''),
    period: value('agenda-period-filter', 'upcoming'),
    category: value('agenda-category-filter', ''),
    publication: value('agenda-published-filter', ''),
    active: value('agenda-active-filter', '')
  };
}

function filterAndSortAgenda(events, filters, today) {
  var selected = filters || {};
  var referenceDate = today || agendaToday();
  var search = agendaComparisonText(selected.search);
  var filtered = (events || []).filter(function(event) {
    var finalDate = event.end_date || event.event_date || '';
    if (selected.period === 'upcoming' && (!finalDate || finalDate < referenceDate)) return false;
    if (selected.period === 'past' && (!finalDate || finalDate >= referenceDate)) return false;
    if (selected.category && event.category !== selected.category) return false;
    if (selected.publication === 'published' && event.is_published !== true) return false;
    if (selected.publication === 'draft' && event.is_published === true) return false;
    if (selected.active === 'active' && event.is_active === false) return false;
    if (selected.active === 'inactive' && event.is_active !== false) return false;
    if (search) {
      var haystack = agendaComparisonText((event.title || '') + ' ' + (event.location || ''));
      if (haystack.indexOf(search) === -1) return false;
    }
    return true;
  });

  return filtered.sort(function(a, b) {
    var aStart = (a.event_date || '9999-12-31') + 'T' + (a.event_time || '23:59');
    var bStart = (b.event_date || '9999-12-31') + 'T' + (b.event_time || '23:59');
    if (selected.period === 'past') return bStart.localeCompare(aStart);
    if (selected.period === 'all') {
      var aPast = (a.end_date || a.event_date || '') < referenceDate;
      var bPast = (b.end_date || b.event_date || '') < referenceDate;
      if (aPast !== bPast) return aPast ? 1 : -1;
      return aPast ? bStart.localeCompare(aStart) : aStart.localeCompare(bStart);
    }
    return aStart.localeCompare(bStart);
  });
}

function agendaAttendanceMap() {
  var source = typeof agendaAttendancesData !== 'undefined' ? agendaAttendancesData : [];
  var map = {};
  source.forEach(function(attendance) {
    if (!map[attendance.event_id]) map[attendance.event_id] = [];
    map[attendance.event_id].push(attendance);
  });
  return map;
}

function agendaFindEvent(id) {
  var source = typeof agendaData !== 'undefined' ? agendaData : [];
  return source.find(function(event) { return event && event.id === id; }) || null;
}

function agendaSafeImage(value) {
  if (!value) return '';
  if (typeof safeImageUrl === 'function') return safeImageUrl(value);
  return agendaIsValidHttpUrl(value) ? value : '';
}

function agendaScheduleText(event) {
  var text = typeof formatDate === 'function' ? formatDate(event.event_date) : event.event_date;
  if (event.end_date && event.end_date !== event.event_date) {
    text += ' até ' + (typeof formatDate === 'function' ? formatDate(event.end_date) : event.end_date);
  }
  if (event.event_time) text += ' · ' + event.event_time;
  if (event.end_time) text += '–' + event.end_time;
  return text;
}

function setAgendaFormValue(id, value) {
  var input = document.getElementById(id);
  if (input) input.value = value == null ? '' : value;
}

function setAgendaFormChecked(id, checked) {
  var input = document.getElementById(id);
  if (input) input.checked = !!checked;
}

function showAgendaForm(event, options) {
  var container = document.getElementById('agenda-form-container');
  var titleEl = document.getElementById('agenda-form-title');
  var form = document.getElementById('agenda-form');
  if (!container || !form) return;
  var duplicate = options && options.duplicate;
  var data = event || {};

  form.reset();
  container.classList.remove('hidden');
  if (titleEl) titleEl.textContent = duplicate ? 'Duplicar Evento' : (event ? 'Editar Evento' : 'Novo Evento');
  setAgendaFormValue('agenda-id', duplicate ? '' : (data.id || ''));
  setAgendaFormValue('agenda-title', data.title || '');
  setAgendaFormValue('agenda-category', data.category || 'culto');
  setAgendaFormValue('agenda-date', data.event_date || '');
  setAgendaFormValue('agenda-time', data.event_time || '');
  setAgendaFormValue('agenda-end-date', data.end_date || '');
  setAgendaFormValue('agenda-end-time', data.end_time || '');
  setAgendaFormValue('agenda-location', data.location || '');
  setAgendaFormValue('agenda-maps-url', data.maps_url || '');
  setAgendaFormValue('agenda-description', data.description || '');
  setAgendaFormValue('agenda-image-url', data.image_url || '');
  setAgendaFormChecked('agenda-published', event ? data.is_published === true : true);
  setAgendaFormChecked('agenda-active', event ? data.is_active !== false : true);
  setAgendaFormChecked('agenda-featured', event ? data.is_featured === true : false);
  if (typeof container.scrollIntoView === 'function') container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function hideAgendaForm() {
  var container = document.getElementById('agenda-form-container');
  if (container) container.classList.add('hidden');
}

function agendaFormData() {
  return {
    title: agendaText(document.getElementById('agenda-title').value),
    category: document.getElementById('agenda-category').value,
    event_date: document.getElementById('agenda-date').value,
    event_time: document.getElementById('agenda-time').value || null,
    end_date: document.getElementById('agenda-end-date').value || null,
    end_time: document.getElementById('agenda-end-time').value || null,
    location: agendaText(document.getElementById('agenda-location').value) || null,
    maps_url: agendaText(document.getElementById('agenda-maps-url').value) || null,
    description: agendaText(document.getElementById('agenda-description').value) || null,
    image_url: agendaText(document.getElementById('agenda-image-url').value) || null,
    is_published: document.getElementById('agenda-published').checked,
    is_active: document.getElementById('agenda-active').checked,
    is_featured: document.getElementById('agenda-featured').checked
  };
}

async function logAgendaAudit(action, recordId, event, extra) {
  if (typeof logChurchAudit !== 'function') return;
  await logChurchAudit(action, 'events', recordId || null, Object.assign({
    title: event.title,
    event_date: event.event_date,
    end_date: event.end_date,
    is_published: event.is_published,
    is_active: event.is_active,
    is_featured: event.is_featured,
    source: event.source || 'manual'
  }, extra || {}));
}

async function handleCreateAgenda(e) {
  e.preventDefault();
  var id = document.getElementById('agenda-id').value;
  var data = agendaFormData();
  var errors = validateAgendaData(data);
  if (errors.length) {
    if (typeof showToast === 'function') showToast(errors[0], 'error');
    return;
  }

  try {
    var result;
    var savedId = id;
    var previous = id ? agendaFindEvent(id) : null;
    if (id) {
      result = await window.supabaseClient.from('events').update(data).eq('id', id);
    } else {
      data.source = 'manual';
      result = await window.supabaseClient.from('events').insert(data).select('id').single();
      if (!result.error && result.data) savedId = result.data.id;
    }
    if (result.error) throw result.error;
    var action = !id ? 'event_created' : (previous && previous.is_active !== false && data.is_active === false ? 'event_deactivated' : 'event_updated');
    await logAgendaAudit(action, savedId, data);
    if (typeof showToast === 'function') showToast(id ? 'Evento atualizado!' : 'Evento criado!', 'success');
    hideAgendaForm();
    await loadAllData();
  } catch (error) {
    console.error('Erro ao salvar evento:', error);
    if (typeof showToast === 'function') showToast('Erro: ' + error.message, 'error');
  }
}

async function deleteAgenda(id) {
  var attendanceCount = (agendaAttendanceMap()[id] || []).length;
  var message = attendanceCount
    ? 'Este evento possui ' + attendanceCount + ' confirmação(ões), que serão removidas pela relação atual. Prefira desativar o evento para preservar o histórico. Deseja excluir mesmo assim?'
    : 'Tem certeza que deseja excluir este evento?';
  if (!confirm(message)) return;
  try {
    var event = agendaFindEvent(id) || { title: '', event_date: null };
    var result = await window.supabaseClient.from('events').delete().eq('id', id);
    if (result.error) throw result.error;
    await logAgendaAudit('event_deleted', id, event, { attendance_count: attendanceCount });
    if (typeof showToast === 'function') showToast('Evento excluído!', 'success');
    await loadAllData();
  } catch (error) {
    console.error('Erro ao excluir evento:', error);
    if (typeof showToast === 'function') showToast('Erro: ' + error.message, 'error');
  }
}

function renderAdminAgenda() {
  var container = document.getElementById('admin-agenda-list');
  if (!container) return;
  var source = typeof agendaData !== 'undefined' ? agendaData : [];
  var filtered = filterAndSortAgenda(source, agendaFiltersFromDom(), agendaToday());
  var count = document.getElementById('agenda-results-count');
  if (count) count.textContent = filtered.length + ' evento(s) encontrado(s)';

  if (!filtered.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-calendar-alt text-2xl"></i></div><h3>Nenhum evento encontrado</h3><p>Crie um evento ou ajuste os filtros.</p></div>';
    return;
  }

  var categoryLabels = { culto: 'Culto', estudo: 'Estudo', reuniao: 'Reunião', evento: 'Evento Especial' };
  var categoryColors = { culto: 'bg-purple-100 text-purple-700', estudo: 'bg-amber-100 text-amber-700', reuniao: 'bg-blue-100 text-blue-700', evento: 'bg-red-100 text-red-700' };
  var attendances = agendaAttendanceMap();
  var html = '';
  filtered.forEach(function(event) {
    if (!event) return;
    var eventJson = encodeInlineJson(event);
    var catLabel = categoryLabels[event.category] || event.category || 'Sem categoria';
    var catColor = categoryColors[event.category] || 'bg-gray-100 text-gray-700';
    var image = agendaSafeImage(event.image_url);
    var attendanceCount = (attendances[event.id] || []).length;
    html += '<article class="p-4 bg-gray-50 rounded-lg border border-gray-100">' +
      '<div class="flex flex-col lg:flex-row lg:items-start justify-between gap-4">' +
      '<div class="flex gap-3 flex-1 min-w-0">' +
      (image ? '<img src="' + escapeHtml(image) + '" alt="" class="w-14 h-14 rounded-lg object-cover flex-shrink-0" loading="lazy" onerror="this.remove()">' : '') +
      '<div class="flex-1 min-w-0"><h4 class="font-semibold text-gray-800 truncate">' + escapeHtml(event.title || 'Sem título') + '</h4>' +
      '<p class="text-sm text-gray-500 mt-1">' + escapeHtml(agendaScheduleText(event)) + (event.location ? ' &bull; ' + escapeHtml(event.location) : '') + '</p>' +
      '<div class="flex flex-wrap gap-2 mt-2"><span class="text-xs ' + catColor + ' px-2 py-0.5 rounded">' + escapeHtml(catLabel) + '</span>' +
      (event.is_published === true ? '<span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Publicado</span>' : '<span class="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded">Rascunho</span>') +
      (event.is_active !== false ? '<span class="text-xs bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded">Ativo</span>' : '<span class="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Inativo</span>') +
      (event.is_featured ? '<span class="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded"><i class="fas fa-star mr-1"></i>Destaque</span>' : '') +
      '<span class="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">' + attendanceCount + ' confirmado(s)</span></div></div></div>' +
      '<div class="flex flex-wrap lg:justify-end gap-1">' +
      '<button onclick="showAgendaParticipants(\'' + event.id + '\')" title="Ver participantes" class="px-3 py-2 text-sm text-indigo-500 hover:bg-indigo-50 rounded-lg min-h-[40px]"><i class="fas fa-users mr-1"></i>Participantes</button>' +
      '<button onclick="duplicateAgenda(\'' + eventJson + '\')" title="Duplicar" class="px-3 py-2 text-sm text-cyan-500 hover:bg-cyan-50 rounded-lg min-h-[40px]"><i class="fas fa-copy mr-1"></i>Duplicar</button>' +
      '<button onclick="editAgenda(\'' + eventJson + '\')" title="Editar" class="p-2 text-purple-500 hover:bg-purple-50 rounded-lg min-w-[40px] min-h-[40px]"><i class="fas fa-edit"></i></button>' +
      '<button onclick="deleteAgenda(\'' + event.id + '\')" title="Excluir" class="p-2 text-red-500 hover:bg-red-50 rounded-lg min-w-[40px] min-h-[40px]"><i class="fas fa-trash-alt"></i></button>' +
      '</div></div></article>';
  });
  container.innerHTML = html;
}

function editAgenda(encodedEvent) {
  try {
    showAgendaForm(JSON.parse(decodeURIComponent(encodedEvent)));
  } catch (error) {
    console.error('Erro ao editar evento:', error);
    if (typeof showToast === 'function') showToast('Erro ao abrir evento para edição.', 'error');
  }
}

function duplicateAgenda(encodedEvent) {
  try {
    var event = JSON.parse(decodeURIComponent(encodedEvent));
    showAgendaForm(agendaDuplicateDraft(event), { duplicate: true });
  } catch (error) {
    console.error('Erro ao duplicar evento:', error);
    if (typeof showToast === 'function') showToast('Erro ao preparar a cópia do evento.', 'error');
  }
}

function showAgendaParticipants(eventId) {
  var modal = document.getElementById('agenda-participants-modal');
  var title = document.getElementById('agenda-participants-title');
  var meta = document.getElementById('agenda-participants-meta');
  var list = document.getElementById('agenda-participants-list');
  var event = agendaFindEvent(eventId);
  if (!modal || !list || !event) return;
  agendaParticipantsEventId = eventId;
  var participants = (agendaAttendanceMap()[eventId] || []).slice().sort(function(a, b) {
    return String(a.created_at || '').localeCompare(String(b.created_at || ''));
  });
  if (title) title.textContent = event.title || 'Participantes';
  if (meta) meta.textContent = agendaScheduleText(event) + ' · ' + participants.length + ' confirmado(s)';
  list.innerHTML = participants.length ? participants.map(function(participant, index) {
    var confirmedAt = participant.created_at ? new Date(participant.created_at).toLocaleString('pt-BR') : 'Data não informada';
    return '<div class="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100"><div class="min-w-0"><strong class="text-sm text-gray-800">' + escapeHtml((index + 1) + '. ' + (participant.user_name || 'Membro')) + '</strong><p class="text-xs text-gray-500 mt-1">Confirmado em ' + escapeHtml(confirmedAt) + '</p></div><i class="fas fa-check-circle text-green-500"></i></div>';
  }).join('') : '<div class="text-center py-8 text-sm text-gray-500"><i class="fas fa-user-clock text-2xl mb-3 block"></i>Nenhuma presença confirmada.</div>';
  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
}

function hideAgendaParticipants() {
  var modal = document.getElementById('agenda-participants-modal');
  if (modal) modal.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
  agendaParticipantsEventId = null;
}

function agendaCsvCell(value) {
  var text = String(value == null ? '' : value);
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

function downloadAgendaParticipantsCsv() {
  var event = agendaFindEvent(agendaParticipantsEventId);
  if (!event) return;
  var participants = (agendaAttendanceMap()[event.id] || []).slice();
  var lines = [
    [agendaCsvCell('Evento'), agendaCsvCell(event.title || '')].join(';'),
    [agendaCsvCell('Data'), agendaCsvCell(agendaScheduleText(event))].join(';'),
    [agendaCsvCell('Total confirmado'), agendaCsvCell(participants.length)].join(';'),
    '',
    [agendaCsvCell('Nome'), agendaCsvCell('Confirmado em')].join(';')
  ];
  participants.forEach(function(participant) {
    lines.push([agendaCsvCell(participant.user_name || 'Membro'), agendaCsvCell(participant.created_at ? new Date(participant.created_at).toLocaleString('pt-BR') : '')].join(';'));
  });
  var blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');
  var slug = agendaComparisonText(event.title || 'evento').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  link.href = url;
  link.download = 'participantes-' + (slug || 'evento') + '-' + agendaToday() + '.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

console.log('crud-agenda.js V2 carregado');
