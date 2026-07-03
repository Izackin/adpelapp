// ============================================================
// CRUD APP UPDATES - admin/crud-app-updates.js
// ============================================================
// Mantem o cadastro das novidades do app no painel admin.

function showAppUpdateForm(update) {
  var container = document.getElementById('app-update-form-container');
  var titleEl = document.getElementById('app-update-form-title');
  if (!container) { return; }

  container.classList.remove('hidden');

  if (update) {
    titleEl.textContent = 'Editar Atualização';
    document.getElementById('app-update-id').value = update.id || '';
    document.getElementById('app-update-title').value = update.title || '';
    document.getElementById('app-update-description').value = update.description || '';
    document.getElementById('app-update-version').value = update.version || '';
    document.getElementById('app-update-image-url').value = update.image_url || '';
    document.getElementById('app-update-active').checked = update.is_active !== false;
  } else {
    titleEl.textContent = 'Nova Atualização';
    document.getElementById('app-update-form').reset();
    document.getElementById('app-update-id').value = '';
    document.getElementById('app-update-active').checked = true;
  }
}

function hideAppUpdateForm() {
  var container = document.getElementById('app-update-form-container');
  if (container) { container.classList.add('hidden'); }
}

async function getAdminUserIdForAppUpdate() {
  try {
    if (!window.supabaseClient || !window.supabaseClient.auth) return null;
    var result = await window.supabaseClient.auth.getUser();
    return result && result.data && result.data.user ? result.data.user.id : null;
  } catch (error) {
    console.warn('Nao foi possivel identificar o admin para created_by:', error);
    return null;
  }
}

async function handleAppUpdateSubmit(e) {
  e.preventDefault();

  var id = document.getElementById('app-update-id').value;
  var data = {
    title: document.getElementById('app-update-title').value.trim(),
    description: document.getElementById('app-update-description').value.trim(),
    version: document.getElementById('app-update-version').value.trim() || null,
    image_url: document.getElementById('app-update-image-url').value.trim() || null,
    is_active: document.getElementById('app-update-active').checked
  };

  try {
    var result;
    if (id) {
      result = await window.supabaseClient.from('app_updates').update(data).eq('id', id);
    } else {
      var createdBy = await getAdminUserIdForAppUpdate();
      if (createdBy) { data.created_by = createdBy; }
      result = await window.supabaseClient.from('app_updates').insert(data);
    }

    if (result.error) { throw result.error; }
    if (typeof showToast === 'function') {
      showToast(id ? 'Atualização salva!' : 'Atualização criada!', 'success');
    }
    hideAppUpdateForm();
    await loadAllData();
  } catch (error) {
    console.error('Erro ao salvar atualização do app:', error);
    if (typeof showToast === 'function') { showToast('Erro: ' + error.message, 'error'); }
  }
}

async function toggleAppUpdateActive(id, isActive) {
  try {
    var result = await window.supabaseClient
      .from('app_updates')
      .update({ is_active: !isActive })
      .eq('id', id);

    if (result.error) { throw result.error; }
    if (typeof showToast === 'function') {
      showToast(!isActive ? 'Atualização ativada!' : 'Atualização desativada!', 'success');
    }
    await loadAllData();
  } catch (error) {
    console.error('Erro ao alterar status da atualização:', error);
    if (typeof showToast === 'function') { showToast('Erro: ' + error.message, 'error'); }
  }
}

async function deleteAppUpdate(id) {
  if (!confirm('Tem certeza que deseja excluir esta atualização?')) { return; }

  try {
    var result = await window.supabaseClient.from('app_updates').delete().eq('id', id);
    if (result.error) { throw result.error; }
    if (typeof showToast === 'function') { showToast('Atualização excluída!', 'success'); }
    await loadAllData();
  } catch (error) {
    console.error('Erro ao excluir atualização:', error);
    if (typeof showToast === 'function') { showToast('Erro: ' + error.message, 'error'); }
  }
}

function editAppUpdate(encodedUpdate) {
  try {
    var update = JSON.parse(decodeURIComponent(encodedUpdate));
    showAppUpdateForm(update);
  } catch (error) {
    console.error('Erro ao abrir atualização para edição:', error);
    if (typeof showToast === 'function') { showToast('Erro ao abrir atualização.', 'error'); }
  }
}

function renderAdminAppUpdates() {
  var container = document.getElementById('admin-app-updates-list');
  if (!container) { return; }

  if (!Array.isArray(appUpdatesData) || appUpdatesData.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-bullhorn text-2xl"></i></div><h3>Nenhuma atualização encontrada</h3><p>Clique em "Nova Atualização" para começar.</p></div>';
    return;
  }

  var html = '';
  for (var i = 0; i < appUpdatesData.length; i++) {
    var update = appUpdatesData[i];
    if (!update) continue;

    var cleanUpdate = {
      id: update.id,
      title: update.title || '',
      description: update.description || '',
      version: update.version || '',
      image_url: update.image_url || '',
      is_active: update.is_active !== false
    };
    var updateJson = encodeURIComponent(JSON.stringify(cleanUpdate));
    var isActive = update.is_active !== false;

    html += '<div class="p-4 bg-gray-50 rounded-lg border border-gray-100">' +
      '<div class="flex items-start justify-between gap-3">' +
      '<div class="flex-1 min-w-0">' +
      '<div class="flex flex-wrap items-center gap-2">' +
      '<h4 class="font-semibold text-gray-800 truncate">' + escapeHtml(update.title || 'Sem título') + '</h4>' +
      (update.version ? '<span class="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">v' + escapeHtml(update.version) + '</span>' : '') +
      (isActive ? '<span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Ativo</span>' : '<span class="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded">Inativo</span>') +
      '</div>' +
      '<p class="text-sm text-gray-500 mt-2 line-clamp-2">' + escapeHtml(update.description || '') + '</p>' +
      '<p class="text-xs text-gray-400 mt-2">Criado em ' + formatDate(update.created_at) + '</p>' +
      (update.image_url ? '<p class="text-xs text-emerald-600 mt-1 truncate"><i class="fas fa-image mr-1"></i>' + escapeHtml(update.image_url) + '</p>' : '') +
      '</div>' +
      '<div class="flex gap-2 shrink-0">' +
      '<button onclick="toggleAppUpdateActive(\'' + update.id + '\', ' + isActive + ')" class="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg min-w-[36px] min-h-[36px]" title="' + (isActive ? 'Desativar' : 'Ativar') + '"><i class="fas fa-' + (isActive ? 'toggle-on' : 'toggle-off') + '"></i></button>' +
      '<button onclick="editAppUpdate(\'' + updateJson + '\')" class="p-2 text-purple-600 hover:bg-purple-50 rounded-lg min-w-[36px] min-h-[36px]" title="Editar"><i class="fas fa-edit"></i></button>' +
      '<button onclick="deleteAppUpdate(\'' + update.id + '\')" class="p-2 text-red-500 hover:bg-red-50 rounded-lg min-w-[36px] min-h-[36px]" title="Excluir"><i class="fas fa-trash-alt"></i></button>' +
      '</div></div></div>';
  }

  container.innerHTML = html;
}

console.log('crud-app-updates.js carregado');
