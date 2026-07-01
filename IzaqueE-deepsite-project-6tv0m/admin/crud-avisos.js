// ============================================================
// CRUD AVISOS - admin/crud-avisos.js
// ============================================================

function showAvisoForm(aviso) {
  var container = document.getElementById('aviso-form-container');
  var titleEl = document.getElementById('aviso-form-title');
  if (!container) { return; }

  container.classList.remove('hidden');

  if (aviso) {
    titleEl.textContent = 'Editar Aviso';
    document.getElementById('aviso-id').value = aviso.id || '';
    document.getElementById('aviso-title').value = aviso.title || '';
    document.getElementById('aviso-priority').value = aviso.priority || 'normal';
    document.getElementById('aviso-message').value = aviso.message || '';
    document.getElementById('aviso-link').value = aviso.link || '';
    document.getElementById('aviso-expiry').value = aviso.expiry || '';
    document.getElementById('aviso-published').checked = aviso.is_published !== false;
  } else {
    titleEl.textContent = 'Novo Aviso';
    document.getElementById('aviso-form').reset();
    document.getElementById('aviso-id').value = '';
    document.getElementById('aviso-published').checked = true;
  }
}

function hideAvisoForm() {
  var container = document.getElementById('aviso-form-container');
  if (container) { container.classList.add('hidden'); }
}

async function handleAvisoSubmit(e) {
  e.preventDefault();

  var id = document.getElementById('aviso-id').value;
  var data = {
    title: document.getElementById('aviso-title').value.trim(),
    priority: document.getElementById('aviso-priority').value,
    message: document.getElementById('aviso-message').value.trim(),
    link: document.getElementById('aviso-link').value.trim() || null,
    expiry: document.getElementById('aviso-expiry').value || null,
    is_published: document.getElementById('aviso-published').checked
  };

  try {
    var result;
    if (id) {
      result = await window.supabaseClient.from('announcements').update(data).eq('id', id);
    } else {
      result = await window.supabaseClient.from('announcements').insert(data);
    }
    if (result.error) { throw result.error; }
    if (typeof showToast === 'function') { showToast(id ? 'Aviso atualizado!' : 'Aviso criado!', 'success'); }
    hideAvisoForm();
    await loadAllData();
  } catch (error) {
    console.error('Erro ao salvar aviso:', error);
    if (typeof showToast === 'function') { showToast('Erro: ' + error.message, 'error'); }
  }
}

async function deleteAviso(id) {
  if (!confirm('Tem certeza que deseja excluir este aviso?')) { return; }
  try {
    var result = await window.supabaseClient.from('announcements').delete().eq('id', id);
    if (result.error) { throw result.error; }
    if (typeof showToast === 'function') { showToast('Aviso excluído!', 'success'); }
    await loadAllData();
  } catch (error) {
    console.error('Erro ao excluir aviso:', error);
    if (typeof showToast === 'function') { showToast('Erro: ' + error.message, 'error'); }
  }
}

function renderAdminAvisos() {
  var container = document.getElementById('admin-avisos-list');
  if (!container) { return; }

  if (!Array.isArray(avisosData) || avisosData.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-bullhorn text-2xl"></i></div><h3>Nenhum aviso encontrado</h3><p>Clique em "Novo Aviso" para começar.</p></div>';
    return;
  }

  var html = '';
  for (var i = 0; i < avisosData.length; i++) {
    var aviso = avisosData[i];
    if (!aviso) continue;
    var avisoJson = encodeURIComponent(JSON.stringify(aviso));
    html += '<div class="p-4 bg-gray-50 rounded-lg border border-gray-100">' +
      '<div class="flex items-start justify-between gap-3">' +
      '<div class="flex-1 min-w-0">' +
      '<h4 class="font-semibold text-gray-800 truncate">' + escapeHtml(aviso.title || 'Sem título') + '</h4>' +
      '<p class="text-sm text-gray-500 mt-1 line-clamp-2">' + escapeHtml(aviso.message || '') + '</p>' +
      '<div class="flex gap-2 mt-2">' +
      (aviso.priority === 'urgent' ? '<span class="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Urgente</span>' : '') +
      (aviso.is_published !== false ? '<span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Publicado</span>' : '<span class="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded">Rascunho</span>') +
      '</div></div>' +
      '<div class="flex gap-2">' +
      '<button onclick="editAviso(\'' + avisoJson + '\')" class="p-2 text-red-600 hover:bg-red-50 rounded-lg min-w-[36px] min-h-[36px]"><i class="fas fa-edit"></i></button>' +
      '<button onclick="deleteAviso(\'' + aviso.id + '\')" class="p-2 text-red-500 hover:bg-red-50 rounded-lg min-w-[36px] min-h-[36px]"><i class="fas fa-trash-alt"></i></button>' +
      '</div></div></div>';
  }
  container.innerHTML = html;
}

function editAviso(encodedAviso) {
  try {
    var aviso = JSON.parse(decodeURIComponent(encodedAviso));
    showAvisoForm(aviso);
  } catch (e) {
    console.error('Erro ao editar aviso:', e);
    if (typeof showToast === 'function') { showToast('Erro ao abrir aviso para edição.', 'error'); }
  }
}

console.log('✅ crud-avisos.js carregado');