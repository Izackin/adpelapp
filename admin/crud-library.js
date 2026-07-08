// ============================================================
// CRUD LIBRARY - admin/crud-library.js
// ============================================================

function showLibraryForm(book) {
  var container = document.getElementById('library-form-container');
  var titleEl = document.getElementById('library-form-title');
  if (!container) { return; }

  container.classList.remove('hidden');

  if (book) {
    titleEl.textContent = 'Editar Livro';
    document.getElementById('library-id').value = book.id || '';
    document.getElementById('library-title').value = book.title || '';
    document.getElementById('library-author').value = book.author || '';
    document.getElementById('library-category').value = book.category || '';
    document.getElementById('library-image').value = book.image || '';
    document.getElementById('library-description').value = book.description || '';
    document.getElementById('library-featured').checked = !!(book.is_featured);
    document.getElementById('library-published').checked = book.is_published !== false;
    document.getElementById('library-existing-file').value = book.file_url || '';
    var fileStatus = document.getElementById('library-file-status');
    if (fileStatus) {
      fileStatus.textContent = book.file_url ? 'Arquivo existente: ' + book.file_url.split('/').pop() : 'Nenhum arquivo selecionado.';
    }
  } else {
    titleEl.textContent = 'Novo Livro';
    document.getElementById('library-form').reset();
    document.getElementById('library-id').value = '';
    document.getElementById('library-published').checked = true;
    document.getElementById('library-existing-file').value = '';
    var fileStatus2 = document.getElementById('library-file-status');
    if (fileStatus2) { fileStatus2.textContent = 'Nenhum arquivo selecionado.'; }
  }
}

function hideLibraryForm() {
  var container = document.getElementById('library-form-container');
  if (container) { container.classList.add('hidden'); }
}

async function handleLibrarySubmit(e) {
  e.preventDefault();

  var id = document.getElementById('library-id').value;
  var data = {
    title: document.getElementById('library-title').value.trim(),
    author: document.getElementById('library-author').value.trim(),
    category: document.getElementById('library-category').value.trim(),
    image: document.getElementById('library-image').value.trim(),
    description: document.getElementById('library-description').value.trim(),
    is_featured: document.getElementById('library-featured').checked,
    is_published: document.getElementById('library-published').checked
  };

  var fileInput = document.getElementById('library-file');
  var existingFile = document.getElementById('library-existing-file').value;

  try {
    if (fileInput && fileInput.files && fileInput.files[0]) {
      var file = fileInput.files[0];
      var validation = typeof validateAdpelUploadFile === 'function'
        ? validateAdpelUploadFile(file, { allowedExtensions: ['pdf', 'doc', 'docx'], maxSize: 20 * 1024 * 1024 })
        : { ok: true };
      if (!validation.ok) { throw new Error(validation.message); }
      var fileExt = file.name.split('.').pop().toLowerCase();
      var fileName = 'library/' + Date.now() + '_' + Math.random().toString(36).substr(2, 9) + '.' + fileExt;
      var uploadResult = await window.supabaseClient.storage.from('uploads').upload(fileName, file);
      if (uploadResult.error) { throw uploadResult.error; }
      var urlResult = window.supabaseClient.storage.from('uploads').getPublicUrl(fileName);
      data.file_url = urlResult.data.publicUrl;
    } else if (existingFile) {
      data.file_url = existingFile;
    }

    var result;
    if (id) {
      result = await window.supabaseClient.from('library_books').update(data).eq('id', id);
    } else {
      result = await window.supabaseClient.from('library_books').insert(data);
    }
    if (result.error) { throw result.error; }
    if (typeof showToast === 'function') { showToast(id ? 'Livro atualizado!' : 'Livro criado!', 'success'); }
    hideLibraryForm();
    await loadAllData();
  } catch (error) {
    console.error('Erro ao salvar livro:', error);
    if (typeof showToast === 'function') { showToast('Erro: ' + error.message, 'error'); }
  }
}

async function deleteLibrary(id) {
  if (!confirm('Tem certeza que deseja excluir este livro?')) { return; }
  try {
    var result = await window.supabaseClient.from('library_books').delete().eq('id', id);
    if (result.error) { throw result.error; }
    if (typeof showToast === 'function') { showToast('Livro excluído!', 'success'); }
    await loadAllData();
  } catch (error) {
    console.error('Erro ao excluir livro:', error);
    if (typeof showToast === 'function') { showToast('Erro: ' + error.message, 'error'); }
  }
}

function renderAdminLibrary() {
  var container = document.getElementById('admin-library-list');
  if (!container) { return; }

  if (!Array.isArray(libraryData) || libraryData.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-book text-2xl"></i></div><h3>Nenhum livro encontrado</h3><p>Clique em "Novo Livro" para começar.</p></div>';
    return;
  }

  var html = '';
  for (var i = 0; i < libraryData.length; i++) {
    var book = libraryData[i];
    if (!book) continue;
    var bookJson = encodeURIComponent(JSON.stringify(book));
    html += '<div class="p-4 bg-gray-50 rounded-lg border border-gray-100">' +
      '<div class="flex items-start justify-between gap-3">' +
      '<div class="flex-1 min-w-0">' +
      '<h4 class="font-semibold text-gray-800 truncate">' + escapeHtml(book.title || 'Sem título') + '</h4>' +
      '<p class="text-sm text-gray-500 mt-1">' + escapeHtml(book.author || '') + (book.category ? ' &bull; ' + escapeHtml(book.category) : '') + '</p>' +
      '<div class="flex gap-2 mt-2">' +
      (book.is_featured ? '<span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Destaque</span>' : '') +
      (book.is_published !== false ? '<span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Publicado</span>' : '<span class="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded">Rascunho</span>') +
      '</div></div>' +
      '<div class="flex gap-2">' +
      '<button onclick="editLibrary(\'' + bookJson + '\')" class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg min-w-[36px] min-h-[36px]"><i class="fas fa-edit"></i></button>' +
      '<button onclick="deleteLibrary(\'' + book.id + '\')" class="p-2 text-red-500 hover:bg-red-50 rounded-lg min-w-[36px] min-h-[36px]"><i class="fas fa-trash-alt"></i></button>' +
      '</div></div></div>';
  }
  container.innerHTML = html;
}

function editLibrary(encodedBook) {
  try {
    var book = JSON.parse(decodeURIComponent(encodedBook));
    showLibraryForm(book);
  } catch (e) {
    console.error('Erro ao editar livro:', e);
    if (typeof showToast === 'function') { showToast('Erro ao abrir livro para edição.', 'error'); }
  }
}

console.log('✅ crud-library.js carregado');
