// ============================================================
// CRUD VERSES - admin/crud-verses.js
// ============================================================

function showVerseForm(verse) {
  var container = document.getElementById('verse-form-container');
  var titleEl = document.getElementById('verse-form-title');
  if (!container) { return; }

  container.classList.remove('hidden');

  if (verse) {
    titleEl.textContent = 'Editar Versículo';
    document.getElementById('verse-id').value = verse.id || '';
    document.getElementById('verse-reference').value = verse.reference || '';
    document.getElementById('verse-text-input').value = verse.text || '';
  } else {
    titleEl.textContent = 'Novo Versículo';
    document.getElementById('verse-form').reset();
    document.getElementById('verse-id').value = '';
  }
}

function hideVerseForm() {
  var container = document.getElementById('verse-form-container');
  if (container) { container.classList.add('hidden'); }
}

function editVerse(id) {
  var verse = null;
  if (Array.isArray(versesData)) {
    for (var i = 0; i < versesData.length; i++) {
      if (versesData[i].id === id || versesData[i].id == id) {
        verse = versesData[i];
        break;
      }
    }
  }
  if (verse) { showVerseForm(verse); }
}

async function handleVerseSubmit(e) {
  e.preventDefault();

  var id = document.getElementById('verse-id').value;
  var data = {
    reference: document.getElementById('verse-reference').value.trim(),
    text: document.getElementById('verse-text-input').value.trim()
  };

  try {
    var result;
    if (id) {
      result = await window.supabaseClient.from('verse_of_day').update(data).eq('id', id);
    } else {
      result = await window.supabaseClient.from('verse_of_day').insert(data);
    }
    if (result.error) { throw result.error; }
    if (typeof showToast === 'function') { showToast(id ? 'Versículo atualizado!' : 'Versículo criado!', 'success'); }
    hideVerseForm();
    await loadAllData();
  } catch (error) {
    console.error('Erro ao salvar versículo:', error);
    if (typeof showToast === 'function') { showToast('Erro: ' + error.message, 'error'); }
  }
}

async function deleteVerse(id) {
  if (!confirm('Tem certeza que deseja excluir este versículo?')) { return; }
  try {
    var result = await window.supabaseClient.from('verse_of_day').delete().eq('id', id);
    if (result.error) { throw result.error; }
    if (typeof showToast === 'function') { showToast('Versículo excluído!', 'success'); }
    await loadAllData();
  } catch (error) {
    console.error('Erro ao excluir versículo:', error);
    if (typeof showToast === 'function') { showToast('Erro: ' + error.message, 'error'); }
  }
}

function renderAdminVerses() {
  var container = document.getElementById('admin-verses-list');
  if (!container) { return; }

  if (!Array.isArray(versesData) || versesData.length === 0) {
    container.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">Nenhum versículo cadastrado.</p>';
    return;
  }

  var html = '';
  for (var i = 0; i < versesData.length; i++) {
    var verse = versesData[i];
    if (!verse) continue;
    html += '<div class="p-3 bg-gray-50 rounded-lg border border-gray-100">' +
      '<div class="flex items-start justify-between gap-2">' +
      '<div class="flex-1 min-w-0">' +
      '<p class="text-sm text-gray-800 italic">"' + escapeHtml(verse.text || '') + '"</p>' +
      '<p class="text-xs text-gray-500 mt-1 font-semibold">' + escapeHtml(verse.reference || '') + '</p>' +
      '</div>' +
      '<div class="flex gap-1">' +
      '<button onclick="editVerse(\'' + verse.id + '\')" class="p-1.5 text-adpel-600 hover:bg-adpel-50 rounded min-w-[32px] min-h-[32px]"><i class="fas fa-edit text-xs"></i></button>' +
      '<button onclick="deleteVerse(\'' + verse.id + '\')" class="p-1.5 text-red-500 hover:bg-red-50 rounded min-w-[32px] min-h-[32px]"><i class="fas fa-trash-alt text-xs"></i></button>' +
      '</div></div></div>';
  }
  container.innerHTML = html;
}

console.log('✅ crud-verses.js carregado');