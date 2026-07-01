// ============================================================
// CRUD AGENDA - admin/crud-agenda.js
// ============================================================

function showAgendaForm(event) {
  var container = document.getElementById('agenda-form-container');
  var titleEl = document.getElementById('agenda-form-title');
  if (!container) { return; }

  container.classList.remove('hidden');

  if (event) {
    titleEl.textContent = 'Editar Evento';
    document.getElementById('agenda-id').value = event.id || '';
    document.getElementById('agenda-title').value = event.title || '';
    document.getElementById('agenda-category').value = event.category || 'culto';
    document.getElementById('agenda-date').value = event.event_date || '';
    document.getElementById('agenda-time').value = event.event_time || '';
    document.getElementById('agenda-location').value = event.location || '';
    document.getElementById('agenda-maps-url').value = event.maps_url || '';
    document.getElementById('agenda-description').value = event.description || '';
    document.getElementById('agenda-published').checked = event.is_published !== false;
  } else {
    titleEl.textContent = 'Novo Evento';
    document.getElementById('agenda-form').reset();
    document.getElementById('agenda-id').value = '';
    document.getElementById('agenda-published').checked = true;
  }
}

function hideAgendaForm() {
  var container = document.getElementById('agenda-form-container');
  if (container) { container.classList.add('hidden'); }
}

async function handleCreateAgenda(e) {
  e.preventDefault();

  var id = document.getElementById('agenda-id').value;
  var data = {
    title: document.getElementById('agenda-title').value.trim(),
    category: document.getElementById('agenda-category').value,
    event_date: document.getElementById('agenda-date').value,
    event_time: document.getElementById('agenda-time').value || null,
    location: document.getElementById('agenda-location').value.trim() || null,
    maps_url: document.getElementById('agenda-maps-url').value.trim() || null,
    description: document.getElementById('agenda-description').value.trim() || null,
    is_published: document.getElementById('agenda-published').checked
  };

  try {
    var result;
    if (id) {
      result = await window.supabaseClient.from('events').update(data).eq('id', id);
    } else {
      result = await window.supabaseClient.from('events').insert(data);
    }
    if (result.error) { throw result.error; }
    if (typeof showToast === 'function') { showToast(id ? 'Evento atualizado!' : 'Evento criado!', 'success'); }
    hideAgendaForm();
    await loadAllData();
  } catch (error) {
    console.error('Erro ao salvar evento:', error);
    if (typeof showToast === 'function') { showToast('Erro: ' + error.message, 'error'); }
  }
}

async function deleteAgenda(id) {
  if (!confirm('Tem certeza que deseja excluir este evento?')) { return; }
  try {
    var result = await window.supabaseClient.from('events').delete().eq('id', id);
    if (result.error) { throw result.error; }
    if (typeof showToast === 'function') { showToast('Evento excluído!', 'success'); }
    await loadAllData();
  } catch (error) {
    console.error('Erro ao excluir evento:', error);
    if (typeof showToast === 'function') { showToast('Erro: ' + error.message, 'error'); }
  }
}

function renderAdminAgenda() {
  var container = document.getElementById('admin-agenda-list');
  if (!container) { return; }

  if (!Array.isArray(agendaData) || agendaData.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-calendar-alt text-2xl"></i></div><h3>Nenhum evento encontrado</h3><p>Clique em "Novo Evento" para começar.</p></div>';
    return;
  }

  var categoryLabels = { culto: 'Culto', estudo: 'Estudo', reuniao: 'Reunião', evento: 'Evento Especial' };
  var categoryColors = { culto: 'bg-purple-100 text-purple-700', estudo: 'bg-amber-100 text-amber-700', reuniao: 'bg-blue-100 text-blue-700', evento: 'bg-red-100 text-red-700' };

  var html = '';
  for (var i = 0; i < agendaData.length; i++) {
    var event = agendaData[i];
    if (!event) continue;
    var eventJson = encodeURIComponent(JSON.stringify(event));
    var catLabel = categoryLabels[event.category] || event.category || '';
    var catColor = categoryColors[event.category] || 'bg-gray-100 text-gray-700';
    html += '<div class="p-4 bg-gray-50 rounded-lg border border-gray-100">' +
      '<div class="flex items-start justify-between gap-3">' +
      '<div class="flex-1 min-w-0">' +
      '<h4 class="font-semibold text-gray-800 truncate">' + escapeHtml(event.title || 'Sem título') + '</h4>' +
      '<p class="text-sm text-gray-500 mt-1">' + formatDate(event.event_date) + (event.event_time ? ' às ' + event.event_time : '') + (event.location ? ' &bull; ' + escapeHtml(event.location) : '') + '</p>' +
      '<div class="flex gap-2 mt-2">' +
      '<span class="text-xs ' + catColor + ' px-2 py-0.5 rounded">' + escapeHtml(catLabel) + '</span>' +
      (event.is_published !== false ? '<span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Publicado</span>' : '<span class="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded">Rascunho</span>') +
      '</div></div>' +
      '<div class="flex gap-2">' +
      '<button onclick="editAgenda(\'' + eventJson + '\')" class="p-2 text-purple-600 hover:bg-purple-50 rounded-lg min-w-[36px] min-h-[36px]"><i class="fas fa-edit"></i></button>' +
      '<button onclick="deleteAgenda(\'' + event.id + '\')" class="p-2 text-red-500 hover:bg-red-50 rounded-lg min-w-[36px] min-h-[36px]"><i class="fas fa-trash-alt"></i></button>' +
      '</div></div></div>';
  }
  container.innerHTML = html;
}

function editAgenda(encodedEvent) {
  try {
    var event = JSON.parse(decodeURIComponent(encodedEvent));
    showAgendaForm(event);
  } catch (e) {
    console.error('Erro ao editar evento:', e);
    if (typeof showToast === 'function') { showToast('Erro ao abrir evento para edição.', 'error'); }
  }
}

console.log('✅ crud-agenda.js carregado');