// Paid Courses V1 - catalog metadata, paywall and protected content access.

async function paidCoursesAccessMap() {
  var userInfo = getCurrentUserInfo();
  if (!userInfo.isLoggedIn || !userInfo.user || !window.supabaseClient) return {};

  try {
    var result = await window.supabaseClient
      .from('course_access')
      .select('course_id,status,amount_cents,requested_at,approved_at')
      .eq('user_id', userInfo.user.id);

    if (result.error) throw result.error;

    var map = {};
    (result.data || []).forEach(function(item) {
      map[item.course_id] = item;
    });
    return map;
  } catch (error) {
    console.warn('Não foi possível carregar acessos aos cursos:', error);
    return {};
  }
}

function paidCoursesFormatBRL(cents) {
  var value = Number(cents || 0) / 100;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function paidCourseActionLabel(course, fallback) {
  if (!course.is_paid || course.hasAccess) return fallback || 'Assistir';
  if (course.accessStatus === 'pending') return 'Em análise';
  if (course.accessStatus === 'rejected' || course.accessStatus === 'revoked') return 'Solicitar novamente';
  return 'Conhecer curso';
}

async function paidLoadCoursesData() {
  try {
    var courses = await ADPEL.fetch.courses();
    var published = (courses || []).filter(function(course) { return course.is_published; });
    var userInfo = getCurrentUserInfo();
    var progressMap = {};
    var accessMap = {};

    if (userInfo.isLoggedIn) {
      var results = await Promise.all([
        getAllLessonProgress(),
        paidCoursesAccessMap()
      ]);
      var allProgress = results[0] || [];
      accessMap = results[1] || {};

      allProgress.forEach(function(progress) {
        if (!progressMap[progress.course_id]) progressMap[progress.course_id] = new Set();
        progressMap[progress.course_id].add(progress.lesson_index);
      });
    }

    var coursesWithStatus = published.map(function(course) {
      var total = Math.max(0, Number(course.lesson_count || 0));
      var completedSet = progressMap[course.id] || new Set();
      var completed = completedSet.size;
      var access = accessMap[course.id] || null;
      var hasAccess = !course.is_paid || !!(access && access.status === 'active');
      var status = 'not-started';

      if (!hasAccess && course.is_paid) {
        status = 'locked';
      } else if (total === 0) {
        status = 'completed';
      } else if (completed >= total) {
        status = 'completed';
      } else if (completed > 0) {
        status = 'in-progress';
      }

      return Object.assign({}, course, {
        totalLessons: total,
        completedLessons: completed,
        status: status,
        accessStatus: access ? access.status : null,
        hasAccess: hasAccess
      });
    });

    paidRenderCoursesList(coursesWithStatus);
  } catch (error) {
    console.error('Erro ao carregar cursos:', error);
  }
}

function paidCourseCarouselCard(course, actionLabel) {
  var lessonsTotal = typeof course.totalLessons === 'number'
    ? course.totalLessons
    : Math.max(0, Number(course.lesson_count || 0));
  var lessonsDone = typeof course.completedLessons === 'number' ? course.completedLessons : 0;
  var progress = lessonsTotal > 0 ? Math.min(100, Math.round((lessonsDone / lessonsTotal) * 100)) : 0;
  var courseData = encodeInlineJson(course);
  var thumbnailUrl = safeImageUrl(course.thumbnail_url);
  var locked = !!course.is_paid && !course.hasAccess;
  var buttonLabel = paidCourseActionLabel(course, actionLabel);

  var accessBadge = course.is_paid
    ? '<span class="course-paid-badge"><i class="fas fa-lock"></i> ' + escapeHtml(paidCoursesFormatBRL(course.price_cents)) + '</span>'
    : '<span class="course-free-badge">Gratuito</span>';

  var media = thumbnailUrl
    ? '<img src="' + escapeHtml(thumbnailUrl) + '" class="w-full h-full object-cover" alt="' + escapeHtml(course.title) + '">'
    : '<div class="w-full h-full flex items-center justify-center text-white/50"><i class="fas fa-graduation-cap text-5xl"></i></div>';

  var progressBlock = '';
  if (locked) {
    progressBlock =
      '<div class="course-locked-summary">' +
        '<span><i class="fas fa-video"></i> ' + lessonsTotal + ' aula' + (lessonsTotal !== 1 ? 's' : '') + '</span>' +
        '<strong>' + (course.accessStatus === 'pending' ? 'Aguardando liberação' : 'Conteúdo exclusivo') + '</strong>' +
      '</div>';
  } else {
    progressBlock =
      '<div class="mt-4">' +
        '<div class="flex justify-between text-xs text-gray-500 mb-1">' +
          '<span>' + lessonsDone + '/' + lessonsTotal + ' aulas</span>' +
          '<span>' + progress + '%</span>' +
        '</div>' +
        '<div class="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">' +
          '<div class="h-1.5 bg-blue-600 rounded-full" style="width:' + progress + '%"></div>' +
        '</div>' +
      '</div>';
  }

  var click = "if(!getCurrentUserInfo().isLoggedIn){openModal('login-modal');return;} openCourseModal('" + courseData + "')";

  return '' +
    '<div class="course-catalog-card min-w-[292px] max-w-[320px] flex-shrink-0 snap-start bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition group border border-gray-100">' +
      '<div class="relative h-40 bg-gradient-to-br from-blue-500 to-blue-700 cursor-pointer" onclick="' + click + '">' +
        media +
        '<div class="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent"></div>' +
        '<div class="course-catalog-card__access">' + accessBadge + '</div>' +
        '<div class="absolute bottom-3 right-3 bg-white/90 px-2 py-1 rounded text-xs font-bold text-blue-700">' + escapeHtml(course.category || 'Curso') + '</div>' +
      '</div>' +
      '<div class="p-4">' +
        '<h4 class="font-bold text-gray-800 group-hover:text-blue-600 transition cursor-pointer" onclick="' + click + '">' + escapeHtml(course.title) + '</h4>' +
        '<p class="text-sm text-gray-500 mt-2 line-clamp-2">' + escapeHtml(course.description || 'Sem descrição') + '</p>' +
        '<div class="flex items-center justify-between mt-4 text-sm text-gray-600">' +
          '<span class="flex items-center gap-1"><i class="fas fa-user-tie text-xs"></i> ' + escapeHtml(course.teacher_name || 'A definir') + '</span>' +
          '<span class="flex items-center gap-1"><i class="fas fa-clock text-xs"></i> ' + (course.duration ? escapeHtml(course.duration) + 'h' : 'A definir') + '</span>' +
        '</div>' +
        progressBlock +
        '<button onclick="' + click + '" class="mt-4 w-full py-2 ' + (locked ? 'course-paid-action' : 'bg-blue-600 hover:bg-blue-700') + ' text-white rounded-lg text-sm font-medium transition">' + escapeHtml(buttonLabel) + '</button>' +
      '</div>' +
    '</div>';
}

function paidRenderCoursesList(courses) {
  var completedContainer = document.getElementById('courses-completed');
  var inprogressContainer = document.getElementById('courses-inprogress');
  var notstartedContainer = document.getElementById('courses-notstarted');
  var completedSection = document.getElementById('courses-completed-section');
  var inprogressSection = document.getElementById('courses-inprogress-section');
  var notstartedSection = document.getElementById('courses-notstarted-section');
  var emptyState = document.getElementById('courses-empty');
  var carousels = document.getElementById('courses-carousels');

  if (!carousels) return;

  if (!courses || courses.length === 0) {
    if (completedSection) completedSection.classList.add('hidden');
    if (inprogressSection) inprogressSection.classList.add('hidden');
    if (notstartedSection) notstartedSection.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    carousels.classList.add('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');
  carousels.classList.remove('hidden');

  var completed = courses.filter(function(course) { return course.status === 'completed'; });
  var inprogress = courses.filter(function(course) { return course.status === 'in-progress'; });
  var notstarted = courses.filter(function(course) {
    return course.status === 'not-started' || course.status === 'locked';
  });

  if (completedSection) completedSection.classList.toggle('hidden', completed.length === 0);
  if (inprogressSection) inprogressSection.classList.toggle('hidden', inprogress.length === 0);
  if (notstartedSection) notstartedSection.classList.toggle('hidden', notstarted.length === 0);

  if (completedContainer) completedContainer.innerHTML = completed.map(function(course) {
    return paidCourseCarouselCard(course, 'Revisar');
  }).join('');

  if (inprogressContainer) inprogressContainer.innerHTML = inprogress.map(function(course) {
    return paidCourseCarouselCard(course, 'Continuar');
  }).join('');

  if (notstartedContainer) notstartedContainer.innerHTML = notstarted.map(function(course) {
    return paidCourseCarouselCard(course, 'Assistir');
  }).join('');
}

async function paidGetCurrentCourseAccess(courseId) {
  var userInfo = getCurrentUserInfo();
  if (!userInfo.isLoggedIn || !userInfo.user || !window.supabaseClient) return null;

  try {
    var result = await window.supabaseClient
      .from('course_access')
      .select('id,status,amount_cents,requested_at,approved_at')
      .eq('user_id', userInfo.user.id)
      .eq('course_id', courseId)
      .maybeSingle();

    if (result.error) throw result.error;
    return result.data || null;
  } catch (error) {
    console.warn('Não foi possível consultar o acesso ao curso:', error);
    return null;
  }
}

async function paidLoadProtectedLessons(courseId) {
  var result = await window.supabaseClient
    .from('course_content')
    .select('lessons')
    .eq('course_id', courseId)
    .maybeSingle();

  if (result.error) throw result.error;
  return result.data && Array.isArray(result.data.lessons) ? result.data.lessons : [];
}

function paidSetCourseContentVisibility(visible) {
  var content = document.getElementById('course-content-area');
  var panel = document.getElementById('course-access-panel');
  if (content) content.classList.toggle('hidden', !visible);
  if (panel) panel.classList.toggle('hidden', visible);
}

function paidRenderAccessPanel(course, access) {
  var title = document.getElementById('course-access-title');
  var message = document.getElementById('course-access-message');
  var price = document.getElementById('course-access-price');
  var action = document.getElementById('course-access-action');
  var note = document.getElementById('course-access-note');
  var status = access ? access.status : null;

  if (price) price.textContent = paidCoursesFormatBRL(course.price_cents);

  if (status === 'pending') {
    if (title) title.textContent = 'Solicitação em análise';
    if (message) message.textContent = 'Sua solicitação já foi enviada. A igreja fará a conferência do pagamento e liberará o curso manualmente.';
    if (action) {
      action.disabled = true;
      action.innerHTML = '<i class="fas fa-clock"></i> Aguardando liberação';
    }
    if (note) note.textContent = 'Você não precisa solicitar novamente.';
    return;
  }

  if (status === 'rejected') {
    if (title) title.textContent = 'Solicitação não aprovada';
    if (message) message.textContent = 'Você pode enviar uma nova solicitação caso o pagamento já tenha sido regularizado.';
    if (action) {
      action.disabled = false;
      action.innerHTML = '<i class="fas fa-rotate-right"></i> Solicitar novamente';
    }
    if (note) note.textContent = 'A confirmação continua manual nesta primeira versão.';
    return;
  }

  if (status === 'revoked') {
    if (title) title.textContent = 'Acesso indisponível';
    if (message) message.textContent = 'Este acesso foi revogado. Se necessário, envie uma nova solicitação.';
    if (action) {
      action.disabled = false;
      action.innerHTML = '<i class="fas fa-paper-plane"></i> Solicitar novamente';
    }
    if (note) note.textContent = 'A administração poderá liberar o curso novamente.';
    return;
  }

  if (title) title.textContent = 'Desbloquear curso';
  if (message) message.textContent = 'Solicite o acesso. Nesta primeira versão, a confirmação do pagamento e a liberação são feitas manualmente pela igreja.';
  if (action) {
    action.disabled = false;
    action.innerHTML = '<i class="fas fa-lock-open"></i> Solicitar acesso';
  }
  if (note) note.textContent = 'Nenhum pagamento é validado automaticamente ainda.';
}

async function paidOpenCourseModal(encodedCourse) {
  var course;
  try {
    course = JSON.parse(decodeURIComponent(encodedCourse));
  } catch (error) {
    console.error('Erro ao abrir curso:', error);
    return;
  }

  currentOpenCourse = course;

  var modal = document.getElementById('course-modal');
  var titleEl = document.getElementById('course-modal-title');
  var teacherEl = document.getElementById('course-modal-teacher');
  var descEl = document.getElementById('course-modal-description');
  var videoWrapper = document.getElementById('course-video-wrapper');
  var certBtn = document.getElementById('course-cert-btn');

  if (titleEl) titleEl.textContent = course.title || 'Curso';
  if (teacherEl) teacherEl.textContent = course.teacher_name ? 'Professor: ' + course.teacher_name : 'Professor: A definir';
  if (descEl) descEl.textContent = course.description || 'Sem descrição disponível.';

  if (videoWrapper) videoWrapper.classList.add('hidden');
  if (certBtn) {
    certBtn.classList.add('hidden');
    certBtn.classList.remove('flex');
  }

  if (ytPlayer && ytPlayer.destroy) {
    ytPlayer.destroy();
    ytPlayer = null;
  }

  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    restorePageScroll();
  }

  var access = null;
  if (course.is_paid) {
    access = await paidGetCurrentCourseAccess(course.id);
    course.accessStatus = access ? access.status : null;
    course.hasAccess = !!(access && access.status === 'active');

    if (!course.hasAccess) {
      currentOpenCourse = course;
      paidSetCourseContentVisibility(false);
      paidRenderAccessPanel(course, access);
      return;
    }
  }

  paidSetCourseContentVisibility(true);

  try {
    course.lessons = await paidLoadProtectedLessons(course.id);
  } catch (error) {
    console.error('Erro ao carregar conteúdo protegido do curso:', error);
    course.lessons = [];
    showToast('Não foi possível carregar as aulas deste curso.', 'error');
  }

  currentOpenCourse = course;
  await renderCourseLessons(course);
  await updateCertificateButton(course.id, normalizeLessons(course.lessons).length);
}

async function requestCurrentCourseAccess() {
  if (!currentOpenCourse || !currentOpenCourse.is_paid) return;

  var userInfo = getCurrentUserInfo();
  if (!userInfo.isLoggedIn || !userInfo.user) {
    closeCourseModal();
    openModal('login-modal');
    return;
  }

  var action = document.getElementById('course-access-action');
  if (action) {
    action.disabled = true;
    action.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
  }

  try {
    var existing = await paidGetCurrentCourseAccess(currentOpenCourse.id);
    var payload = {
      course_id: currentOpenCourse.id,
      user_id: userInfo.user.id,
      status: 'pending',
      amount_cents: Number(currentOpenCourse.price_cents || 0),
      access_source: 'manual_request',
      approved_at: null,
      approved_by: null,
      updated_at: new Date().toISOString()
    };

    var result;
    if (existing && (existing.status === 'rejected' || existing.status === 'revoked')) {
      result = await window.supabaseClient
        .from('course_access')
        .update(payload)
        .eq('id', existing.id);
    } else if (existing) {
      paidRenderAccessPanel(currentOpenCourse, existing);
      return;
    } else {
      delete payload.updated_at;
      result = await window.supabaseClient.from('course_access').insert(payload);
    }

    if (result.error) throw result.error;

    var refreshed = await paidGetCurrentCourseAccess(currentOpenCourse.id);
    currentOpenCourse.accessStatus = refreshed ? refreshed.status : 'pending';
    paidRenderAccessPanel(currentOpenCourse, refreshed || { status: 'pending' });

    if (typeof showToast === 'function') {
      showToast('Solicitação enviada! A liberação será feita pela administração.', 'success');
    }

    await paidLoadCoursesData();
  } catch (error) {
    console.error('Erro ao solicitar acesso ao curso:', error);
    if (action) action.disabled = false;
    if (typeof showToast === 'function') {
      showToast('Não foi possível enviar a solicitação de acesso.', 'error');
    }
    paidRenderAccessPanel(currentOpenCourse, await paidGetCurrentCourseAccess(currentOpenCourse.id));
  }
}

// Replace the original public course entry points without changing
// progress, player or certificate code.
loadCoursesData = paidLoadCoursesData;
courseCarouselCard = paidCourseCarouselCard;
renderCoursesList = paidRenderCoursesList;
openCourseModal = paidOpenCourseModal;

window.loadCoursesData = paidLoadCoursesData;
window.courseCarouselCard = paidCourseCarouselCard;
window.renderCoursesList = paidRenderCoursesList;
window.openCourseModal = paidOpenCourseModal;
window.requestCurrentCourseAccess = requestCurrentCourseAccess;
window.formatCoursePrice = paidCoursesFormatBRL;
