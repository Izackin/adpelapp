// ============================================================
// CRUD COURSES - admin/crud-courses.js
// ============================================================

function formatCoursePriceAdmin(cents) {
  var value = Number(cents || 0) / 100;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function coursePriceInputToCents(value) {
  var normalized = String(value == null ? '' : value).trim().replace(',', '.');
  var amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
}

function toggleCoursePricingFields() {
  var paid = document.getElementById('course-paid');
  var fields = document.getElementById('course-price-fields');
  var price = document.getElementById('course-price');
  var isPaid = !!(paid && paid.checked);
  if (fields) fields.classList.toggle('hidden', !isPaid);
  if (price) {
    price.required = isPaid;
    if (!isPaid) price.value = '';
  }
}

async function getCourseContentForAdmin(courseId) {
  if (!courseId || !window.supabaseClient) return [];
  var result = await window.supabaseClient
    .from('course_content')
    .select('lessons')
    .eq('course_id', courseId)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data && Array.isArray(result.data.lessons) ? result.data.lessons : [];
}

async function saveCourseContentForAdmin(courseId, lessons) {
  var result = await window.supabaseClient
    .from('course_content')
    .upsert({
      course_id: courseId,
      lessons: Array.isArray(lessons) ? lessons : [],
      updated_at: new Date().toISOString()
    }, { onConflict: 'course_id' });
  if (result.error) throw result.error;
}

function showCourseForm(course) {
  var container = document.getElementById('course-form-container');
  var titleEl = document.getElementById('course-form-title');
  if (!container) { return; }

  container.classList.remove('hidden');

  if (course) {
    titleEl.textContent = 'Editar Curso';
    document.getElementById('course-id').value = course.id || '';
    document.getElementById('course-title').value = course.title || '';
    document.getElementById('course-teacher').value = course.teacher_name || '';
    document.getElementById('course-category').value = course.category || 'Discipulado';
    document.getElementById('course-duration').value = course.duration || '';
    document.getElementById('course-description').value = course.description || '';
    document.getElementById('course-thumbnail').value = course.thumbnail_url || '';
    document.getElementById('course-cert-title').value = course.certificate_title || '';
    document.getElementById('course-cert-desc').value = course.certificate_description || '';
    document.getElementById('course-featured').checked = !!(course.is_featured);
    document.getElementById('course-published').checked = course.is_published !== false;
    document.getElementById('course-paid').checked = !!course.is_paid;
    document.getElementById('course-price').value = course.is_paid && Number(course.price_cents || 0) > 0
      ? (Number(course.price_cents) / 100).toFixed(2)
      : '';
    toggleCoursePricingFields();

    var lessonsList = document.getElementById('course-lessons-list');
    if (lessonsList) {
      lessonsList.innerHTML = '';
      var lessons = course.lessons || [];
      if (Array.isArray(lessons)) {
        for (var i = 0; i < lessons.length; i++) {
          addLessonField(lessons[i]);
        }
      }
    }
  } else {
    titleEl.textContent = 'Novo Curso';
    document.getElementById('course-form').reset();
    document.getElementById('course-id').value = '';
    document.getElementById('course-published').checked = true;
    document.getElementById('course-paid').checked = false;
    document.getElementById('course-price').value = '';
    toggleCoursePricingFields();
    var lessonsList2 = document.getElementById('course-lessons-list');
    if (lessonsList2) { lessonsList2.innerHTML = ''; }
  }
}

function hideCourseForm() {
  var container = document.getElementById('course-form-container');
  if (container) { container.classList.add('hidden'); }
}

function addLessonField(lesson) {
  var list = document.getElementById('course-lessons-list');
  if (!list) { return; }

  var div = document.createElement('div');
  div.className = 'admin-lesson-row flex gap-2 items-center';
  div.innerHTML =
    '<input type="text" placeholder="Título da aula" value="' + escapeHtml(lesson && lesson.title ? lesson.title : '') + '" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-adpel-500 outline-none">' +
    '<input type="url" placeholder="URL do YouTube" value="' + escapeHtml(lesson && lesson.url ? lesson.url : '') + '" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-adpel-500 outline-none">' +
    '<button type="button" onclick="this.parentElement.remove()" class="p-2 text-red-500 hover:text-red-700 min-w-[36px]"><i class="fas fa-trash-alt"></i></button>';
  list.appendChild(div);
}

function getLessonsFromFields(containerId) {
  var list = document.getElementById(containerId);
  if (!list) { return []; }

  var lessons = [];
  var divs = list.querySelectorAll(':scope > div');
  for (var i = 0; i < divs.length; i++) {
    var inputs = divs[i].querySelectorAll('input[type="text"], input[type="url"]');
    if (inputs.length >= 2) {
      var title = inputs[0].value.trim();
      var url = inputs[1].value.trim();
      if (title || url) {
        lessons.push({ title: title, url: url });
      }
    }
  }
  return lessons;
}

async function handleCourseSubmit(e) {
  e.preventDefault();

  var id = document.getElementById('course-id').value;
  var lessons = getLessonsFromFields('course-lessons-list');
  var isPaid = document.getElementById('course-paid').checked;
  var priceCents = isPaid ? coursePriceInputToCents(document.getElementById('course-price').value) : 0;

  if (isPaid && priceCents <= 0) {
    if (typeof showToast === 'function') showToast('Informe um valor válido para o curso pago.', 'warning');
    return;
  }

  var data = {
    title: document.getElementById('course-title').value.trim(),
    teacher_name: document.getElementById('course-teacher').value.trim(),
    category: document.getElementById('course-category').value,
    duration: parseInt(document.getElementById('course-duration').value) || 0,
    description: document.getElementById('course-description').value.trim(),
    thumbnail_url: document.getElementById('course-thumbnail').value.trim(),
    certificate_title: document.getElementById('course-cert-title').value.trim(),
    certificate_description: document.getElementById('course-cert-desc').value.trim(),
    is_featured: document.getElementById('course-featured').checked,
    is_published: document.getElementById('course-published').checked,
    is_paid: isPaid,
    price_cents: priceCents,
    lesson_count: lessons.length,
    // Conteúdo sensível vive em course_content. O campo legado fica vazio
    // em todo curso salvo por esta versão para não expor links de aulas.
    lessons: []
  };

  try {
    var courseId = id;
    var result;

    if (id) {
      // Salva o conteúdo protegido primeiro. Se a atualização de metadados
      // falhar, o curso continua com o conteúdo disponível ao administrador.
      await saveCourseContentForAdmin(id, lessons);
      result = await window.supabaseClient.from('courses').update(data).eq('id', id).select('id').single();
    } else {
      result = await window.supabaseClient.from('courses').insert(data).select('id').single();
      if (!result.error && result.data) {
        courseId = result.data.id;
        try {
          await saveCourseContentForAdmin(courseId, lessons);
        } catch (contentError) {
          await window.supabaseClient.from('courses').delete().eq('id', courseId);
          throw contentError;
        }
      }
    }

    if (result.error) throw result.error;
    if (typeof showToast === 'function') {
      showToast(id ? 'Curso atualizado!' : 'Curso criado!', 'success');
    }
    hideCourseForm();
    await loadAllData();
  } catch (error) {
    console.error('Erro ao salvar curso:', error);
    if (typeof showToast === 'function') showToast('Erro: ' + error.message, 'error');
  }
}

async function deleteCourse(id) {
  if (!confirm('Tem certeza que deseja excluir este curso?')) { return; }
  try {
    var result = await window.supabaseClient.from('courses').delete().eq('id', id);
    if (result.error) { throw result.error; }
    if (typeof showToast === 'function') { showToast('Curso excluído!', 'success'); }
    await loadAllData();
  } catch (error) {
    console.error('Erro ao excluir curso:', error);
    if (typeof showToast === 'function') { showToast('Erro: ' + error.message, 'error'); }
  }
}

function renderAdminCourses() {
  var container = document.getElementById('admin-courses-list');
  if (!container) { return; }

  if (!Array.isArray(coursesData) || coursesData.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-graduation-cap text-2xl"></i></div><h3>Nenhum curso encontrado</h3><p>Clique em "Novo Curso" para começar.</p></div>';
    return;
  }

  var html = '';
  for (var i = 0; i < coursesData.length; i++) {
    var course = coursesData[i];
    if (!course) continue;
    var courseJson = encodeInlineJson(course);
    html += '<div class="p-4 bg-gray-50 rounded-lg border border-gray-100">' +
      '<div class="flex items-start justify-between gap-3">' +
      '<div class="flex-1 min-w-0">' +
      '<h4 class="font-semibold text-gray-800 truncate">' + escapeHtml(course.title || 'Sem título') + '</h4>' +
      '<p class="text-sm text-gray-500 mt-1">' + escapeHtml(course.category || '') + (course.teacher_name ? ' &bull; ' + escapeHtml(course.teacher_name) : '') + '</p>' +
      '<div class="flex gap-2 mt-2">' +
      (course.is_featured ? '<span class="text-xs bg-adpel-100 text-adpel-700 px-2 py-0.5 rounded">Destaque</span>' : '') +
      (course.is_paid
        ? '<span class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded"><i class="fas fa-lock mr-1"></i>' + escapeHtml(formatCoursePriceAdmin(course.price_cents)) + '</span>'
        : '<span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Gratuito</span>') +
      (course.is_published !== false ? '<span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Publicado</span>' : '<span class="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded">Rascunho</span>') +
      '</div></div>' +
      '<div class="flex gap-2">' +
      '<button onclick="editCourse(\'' + courseJson + '\')" class="p-2 text-adpel-600 hover:bg-adpel-50 rounded-lg min-w-[36px] min-h-[36px]"><i class="fas fa-edit"></i></button>' +
      '<button onclick="deleteCourse(\'' + course.id + '\')" class="p-2 text-red-500 hover:bg-red-50 rounded-lg min-w-[36px] min-h-[36px]"><i class="fas fa-trash-alt"></i></button>' +
      '</div></div></div>';
  }
  container.innerHTML = html;
}

async function editCourse(encodedCourse) {
  try {
    var course = JSON.parse(decodeURIComponent(encodedCourse));
    var protectedLessons = [];
    try {
      protectedLessons = await getCourseContentForAdmin(course.id);
    } catch (contentError) {
      console.warn('Não foi possível carregar o conteúdo protegido do curso:', contentError);
      protectedLessons = Array.isArray(course.lessons) ? course.lessons : [];
    }
    course.lessons = protectedLessons;
    showCourseForm(course);
  } catch (e) {
    console.error('Erro ao editar curso:', e);
    if (typeof showToast === 'function') showToast('Erro ao abrir curso para edição.', 'error');
  }
}

console.log('✅ crud-courses.js carregado');
