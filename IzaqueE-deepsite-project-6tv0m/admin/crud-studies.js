// ============================================================
// CRUD STUDIES - admin/crud-studies.js
// ============================================================

function showStudyForm(study) {
  var container = document.getElementById('study-form-container');
  var titleEl = document.getElementById('study-form-title');
  if (!container) { return; }

  container.classList.remove('hidden');

  if (study) {
    titleEl.textContent = 'Editar Estudo';
    document.getElementById('study-id').value = study.id || '';
    document.getElementById('study-title').value = study.title || '';
    document.getElementById('study-category').value = study.category || 'Devocional';
    document.getElementById('study-description').value = study.description || '';
    document.getElementById('study-content').value = study.content || '';
    document.getElementById('study-cover').value = study.cover_url || '';
    document.getElementById('study-featured').checked = !!(study.is_featured);
    document.getElementById('study-published').checked = study.is_published !== false;
    document.getElementById('study-existing-file').value = study.file_url || '';
    var fileStatus = document.getElementById('study-file-status');
    if (fileStatus) {
      fileStatus.textContent = study.file_url ? 'Arquivo existente: ' + study.file_url.split('/').pop() : 'Nenhum arquivo selecionado.';
    }

    var lessonsList = document.getElementById('study-lessons-list');
    if (lessonsList) {
      lessonsList.innerHTML = '';
      var lessons = study.lessons || [];
      if (Array.isArray(lessons)) {
        for (var i = 0; i < lessons.length; i++) {
          addStudyLessonField(lessons[i]);
        }
      }
    }
  } else {
    titleEl.textContent = 'Novo Estudo';
    document.getElementById('study-form').reset();
    document.getElementById('study-id').value = '';
    document.getElementById('study-published').checked = true;
    document.getElementById('study-existing-file').value = '';
    var fileStatus2 = document.getElementById('study-file-status');
    if (fileStatus2) { fileStatus2.textContent = 'Nenhum arquivo selecionado.'; }
    var lessonsList2 = document.getElementById('study-lessons-list');
    if (lessonsList2) { lessonsList2.innerHTML = ''; }
  }
}

function hideStudyForm() {
  var container = document.getElementById('study-form-container');
  if (container) { container.classList.add('hidden'); }
}

function addStudyLessonField(lesson) {
  var list = document.getElementById('study-lessons-list');
  if (!list) { return; }

  var div = document.createElement('div');
  div.className = 'flex gap-2 items-center';
  div.innerHTML =
    '<input type="text" placeholder="Título da aula" value="' + escapeHtml(lesson && lesson.title ? lesson.title : '') + '" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none">' +
    '<input type="url" placeholder="URL do YouTube" value="' + escapeHtml(lesson && lesson.url ? lesson.url : '') + '" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none">' +
    '<button type="button" onclick="this.parentElement.remove()" class="p-2 text-red-500 hover:text-red-700 min-w-[36px]"><i class="fas fa-trash-alt"></i></button>';
  list.appendChild(div);
}

async function handleStudySubmit(e) {
  e.preventDefault();

  var id = document.getElementById('study-id').value;
  var data = {
    title: document.getElementById('study-title').value.trim(),
    category: document.getElementById('study-category').value,
    description: document.getElementById('study-description').value.trim(),
    content: document.getElementById('study-content').value.trim(),
    cover_url: document.getElementById('study-cover').value.trim(),
    is_featured: document.getElementById('study-featured').checked,
    is_published: document.getElementById('study-published').checked,
    lessons: getLessonsFromFields('study-lessons-list')
  };

  var fileInput = document.getElementById('study-file');
  var existingFile = document.getElementById('study-existing-file').value;

  try {
    if (fileInput && fileInput.files && fileInput.files[0]) {
      var file = fileInput.files[0];
      var fileExt = file.name.split('.').pop();
      var fileName = 'studies/' + Date.now() + '_' + Math.random().toString(36).substr(2, 9) + '.' + fileExt;
      var uploadResult = await window.supabaseClient.storage.from('uploads').upload(fileName, file);
      if (uploadResult.error) { throw uploadResult.error; }
      var urlResult = window.supabaseClient.storage.from('uploads').getPublicUrl(fileName);
      data.file_url = urlResult.data.publicUrl;
    } else if (existingFile) {
      data.file_url = existingFile;
    }

    var result;
    if (id) {
      result = await window.supabaseClient.from('studies').update(data).eq('id', id);
    } else {
      result = await window.supabaseClient.from('studies').insert(data);
    }
    if (result.error) { throw result.error; }
    if (typeof showToast === 'function') { showToast(id ? 'Estudo atualizado!' : 'Estudo criado!', 'success'); }
    hideStudyForm();
    await loadAllData();
  } catch (error) {
    console.error('Erro ao salvar estudo:', error);
    if (typeof showToast === 'function') { showToast('Erro: ' + error.message, 'error'); }
  }
}

async function deleteStudy(id) {
  if (!confirm('Tem certeza que deseja excluir este estudo?')) { return; }
  try {
    var result = await window.supabaseClient.from('studies').delete().eq('id', id);
    if (result.error) { throw result.error; }
    if (typeof showToast === 'function') { showToast('Estudo excluído!', 'success'); }
    await loadAllData();
  } catch (error) {
    console.error('Erro ao excluir estudo:', error);
    if (typeof showToast === 'function') { showToast('Erro: ' + error.message, 'error'); }
  }
}

function renderAdminStudies() {
  var container = document.getElementById('admin-studies-list');
  if (!container) { return; }

  if (!Array.isArray(studiesData) || studiesData.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-book-open text-2xl"></i></div><h3>Nenhum estudo encontrado</h3><p>Clique em "Novo Estudo" para começar.</p></div>';
    return;
  }

  var html = '';
  for (var i = 0; i < studiesData.length; i++) {
    var study = studiesData[i];
    if (!study) continue;
    var studyJson = encodeURIComponent(JSON.stringify(study));
    html += '<div class="p-4 bg-gray-50 rounded-lg border border-gray-100">' +
      '<div class="flex items-start justify-between gap-3">' +
      '<div class="flex-1 min-w-0">' +
      '<h4 class="font-semibold text-gray-800 truncate">' + escapeHtml(study.title || 'Sem título') + '</h4>' +
      '<p class="text-sm text-gray-500 mt-1">' + escapeHtml(study.category || '') + '</p>' +
      '<div class="flex gap-2 mt-2">' +
      (study.is_featured ? '<span class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Destaque</span>' : '') +
      (study.is_published !== false ? '<span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Publicado</span>' : '<span class="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded">Rascunho</span>') +
      '</div></div>' +
      '<div class="flex gap-2">' +
      '<button onclick="editStudy(\'' + studyJson + '\')" class="p-2 text-amber-600 hover:bg-amber-50 rounded-lg min-w-[36px] min-h-[36px]"><i class="fas fa-edit"></i></button>' +
      '<button onclick="deleteStudy(\'' + study.id + '\')" class="p-2 text-red-500 hover:bg-red-50 rounded-lg min-w-[36px] min-h-[36px]"><i class="fas fa-trash-alt"></i></button>' +
      '</div></div></div>';
  }
  container.innerHTML = html;
}

function editStudy(encodedStudy) {
  try {
    var study = JSON.parse(decodeURIComponent(encodedStudy));
    showStudyForm(study);
  } catch (e) {
    console.error('Erro ao editar estudo:', e);
    if (typeof showToast === 'function') { showToast('Erro ao abrir estudo para edição.', 'error'); }
  }
}

console.log('✅ crud-studies.js carregado');