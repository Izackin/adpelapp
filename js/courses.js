// Courses and studies module - extracted from script.js without behavior changes.

let ytPlayer = null;

let currentCourseForPlayer = null;

let currentLessonIndexForPlayer = null;

let currentOpenCourse = null;

let currentOpenStudy = null;

let studyYtPlayer = null;

let currentStudyForPlayer = null;

let currentStudyLessonIndexForPlayer = null;

async function loadCoursesData() {
  try {
    const courses = await ADPEL.fetch.courses();
    const published = (courses || []).filter(c => c.is_published);
    
    const userInfo = getCurrentUserInfo();
    let progressMap = {};
    if (userInfo.isLoggedIn) {
      const allProgress = await getAllLessonProgress();
      allProgress.forEach(p => {
        if (!progressMap[p.course_id]) progressMap[p.course_id] = new Set();
        progressMap[p.course_id].add(p.lesson_index);
      });
    }
    
    const coursesWithStatus = published.map(course => {
      const lessons = normalizeLessons(course.lessons);
      const total = lessons.length;
      const completedSet = progressMap[course.id] || new Set();
      const completed = completedSet.size;
      
      let status = 'not-started';
      if (total === 0) {
        status = 'completed';
      } else if (completed >= total) {
        status = 'completed';
      } else if (completed > 0) {
        status = 'in-progress';
      }
      
      return { ...course, totalLessons: total, completedLessons: completed, status };
    });
    
    renderCoursesList(coursesWithStatus);
  } catch (e) {
    console.error(e);
  }
}

async function loadStudiesData() {
  try {
    const studies = await ADPEL.fetch.studies();
    renderStudiesList((studies || []).filter(s => s.is_published));
  } catch (e) {
    console.error(e);
  }
}

function renderFeaturedStudies(studies) {
  const container = document.getElementById('featured-studies');
  if (!container) return;
  if (!studies || studies.length === 0) {
    container.innerHTML = `
      <div class="min-w-[300px] flex-shrink-0 w-full text-center py-8 bg-white rounded-xl border border-dashed border-gray-300">
        <i class="fas fa-book-open text-4xl text-gray-300 mb-3"></i>
        <p class="text-gray-500">Nenhum estudo em destaque.</p>
      </div>`;
    return;
  }
  container.innerHTML = studies.map(study => `
    <div class="min-w-[300px] flex-shrink-0 snap-start bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition cursor-pointer group" onclick="if(!getCurrentUserInfo().isLoggedIn){openModal('login-modal');return;} openStudyModal('${encodeURIComponent(JSON.stringify(study))}')">
      <div class="relative h-40 bg-gradient-to-br from-amber-500 to-amber-600 overflow-hidden">
        ${study.cover_url 
          ? `<img src="${study.cover_url}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500" alt="${escapeHtml(study.title)}">`
          : `<div class="w-full h-full flex items-center justify-center text-white/50"><i class="fas fa-book-open text-5xl"></i></div>`}
        <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
          <span class="bg-amber-500 text-white px-2 py-1 rounded text-xs font-bold">${escapeHtml(study.category || 'Estudo')}</span>
        </div>
      </div>
      <div class="p-4">
        <h4 class="font-bold text-gray-800 group-hover:text-amber-600 transition">${escapeHtml(study.title)}</h4>
        <p class="text-sm text-gray-500 mt-2 line-clamp-2">${escapeHtml(study.description || 'Sem descricao')}</p>
      </div>
    </div>
  `).join('');
}

function renderCoursesList(courses) {
  const completedContainer = document.getElementById('courses-completed');
  const inprogressContainer = document.getElementById('courses-inprogress');
  const notstartedContainer = document.getElementById('courses-notstarted');
  const completedSection = document.getElementById('courses-completed-section');
  const inprogressSection = document.getElementById('courses-inprogress-section');
  const notstartedSection = document.getElementById('courses-notstarted-section');
  const emptyState = document.getElementById('courses-empty');
  const carousels = document.getElementById('courses-carousels');

  if (!carousels) return;

  if (!courses || courses.length === 0) {
    if (completedSection) completedSection.classList.add('hidden');
    if (inprogressSection) inprogressSection.classList.add('hidden');
    if (notstartedSection) notstartedSection.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    if (carousels) carousels.classList.add('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');
  if (carousels) carousels.classList.remove('hidden');

  const completed = courses.filter(c => c.status === 'completed');
  const inprogress = courses.filter(c => c.status === 'in-progress');
  const notstarted = courses.filter(c => c.status === 'not-started');

  if (completedSection) completedSection.classList.toggle('hidden', completed.length === 0);
  if (inprogressSection) inprogressSection.classList.toggle('hidden', inprogress.length === 0);
  if (notstartedSection) notstartedSection.classList.toggle('hidden', notstarted.length === 0);

  if (completedContainer) completedContainer.innerHTML = completed.map(c => courseCarouselCard(c, 'Revisar')).join('');
  if (inprogressContainer) inprogressContainer.innerHTML = inprogress.map(c => courseCarouselCard(c, 'Continuar')).join('');
  if (notstartedContainer) notstartedContainer.innerHTML = notstarted.map(c => courseCarouselCard(c, 'Assistir')).join('');
}

function renderStudiesList(studies) {
  const container = document.getElementById('studies-list');
  if (!container) return;
  if (!studies || studies.length === 0) {
    container.innerHTML = `
      <div class="min-w-[300px] flex-shrink-0 w-full text-center py-8 bg-white rounded-xl border border-dashed border-gray-300">
        <i class="fas fa-book-open text-4xl text-gray-300 mb-3"></i>
        <p class="text-gray-500">Nenhum estudo disponível.</p>
      </div>`;
    return;
  }
  container.innerHTML = studies.map(study => `
    <div class="min-w-[300px] flex-shrink-0 snap-start bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition cursor-pointer group border border-gray-100" onclick="if(!getCurrentUserInfo().isLoggedIn){openModal('login-modal');return;} openStudyModal('${encodeURIComponent(JSON.stringify(study))}')">
      <div class="relative h-40 bg-gradient-to-br from-amber-500 to-amber-600 overflow-hidden">
        ${study.cover_url 
          ? `<img src="${study.cover_url}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500" alt="${escapeHtml(study.title)}">`
          : `<div class="w-full h-full flex items-center justify-center text-white/50"><i class="fas fa-book-open text-5xl"></i></div>`}
        <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
          <span class="bg-amber-500 text-white px-2 py-1 rounded text-xs font-bold">${escapeHtml(study.category || 'Estudo')}</span>
        </div>
      </div>
      <div class="p-4">
        <h4 class="font-bold text-gray-800 group-hover:text-amber-600 transition">${escapeHtml(study.title)}</h4>
        <p class="text-sm text-gray-500 mt-2 line-clamp-2">${escapeHtml(study.description || 'Sem descricao')}</p>
      </div>
    </div>
  `).join('');
}

function normalizeLessons(lessons) {
  if (!lessons) return [];
  if (Array.isArray(lessons)) {
    return lessons.map(normalizeLesson).filter(function(lesson) { return lesson.url; });
  }
  if (typeof lessons === 'string') {
    try {
      return normalizeLessons(JSON.parse(lessons));
    } catch (e) {
      const url = lessons.trim();
      return url ? [{ title: '', url: url }] : [];
    }
  }
  return [];
}

function normalizeLesson(lesson) {
  if (!lesson) return { title: '', url: '' };
  if (typeof lesson === 'string') return { title: '', url: lesson.trim() };
  if (typeof lesson === 'object') {
    return {
      title: String(lesson.title || lesson.name || '').trim(),
      url: String(lesson.url || lesson.video_url || lesson.youtube_url || lesson.link || '').trim()
    };
  }
  return { title: '', url: '' };
}

function extractYouTubeID(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

async function getLessonProgress(courseId) {
  const userInfo = getCurrentUserInfo();
  if (!userInfo.isLoggedIn || !userInfo.user) return [];
  try {
    const { data, error } = await window.supabaseClient
      .from('user_lesson_progress')
      .select('lesson_index')
      .eq('user_id', userInfo.user.id)
      .eq('course_id', courseId);
    if (error) throw error;
    return data ? data.map(d => d.lesson_index) : [];
  } catch (e) {
    console.error('Erro ao buscar progresso:', e);
    return [];
  }
}

function isLessonCompleted(completedIndexes, index) {
  return completedIndexes.includes(index);
}

async function getAllLessonProgress() {
  const userInfo = getCurrentUserInfo();
  if (!userInfo.isLoggedIn || !userInfo.user) return [];
  try {
    const { data, error } = await window.supabaseClient
      .from('user_lesson_progress')
      .select('course_id, lesson_index')
      .eq('user_id', userInfo.user.id);
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Erro ao buscar progresso geral:', e);
    return [];
  }
}

async function toggleLessonComplete(courseId, index) {
  const userInfo = getCurrentUserInfo();
  if (!userInfo.isLoggedIn || !userInfo.user) {
    showToast('Faça login para salvar seu progresso.', 'warning');
    return;
  }
  try {
    const { data: existing, error: fetchError } = await window.supabaseClient
      .from('user_lesson_progress')
      .select('id')
      .eq('user_id', userInfo.user.id)
      .eq('course_id', courseId)
      .eq('lesson_index', index)
      .maybeSingle();
    if (fetchError) throw fetchError;

    if (existing) {
      const { error: delError } = await window.supabaseClient
        .from('user_lesson_progress')
        .delete()
        .eq('id', existing.id);
      if (delError) throw delError;
      showToast('Aula marcada como pendente.', 'info');
    } else {
      const totalLessons = currentOpenCourse && currentOpenCourse.id === courseId
        ? normalizeLessons(currentOpenCourse.lessons).length
        : 0;
      const completedBefore = await getLessonProgress(courseId);
      const { error: insError } = await window.supabaseClient
        .from('user_lesson_progress')
        .insert([{
          user_id: userInfo.user.id,
          course_id: courseId,
          lesson_index: index,
          completed: true,
          completed_at: new Date().toISOString()
        }]);
      if (insError) throw insError;
      if (window.ADPELJourney && typeof window.ADPELJourney.registerLessonWatched === 'function') {
        window.ADPELJourney.registerLessonWatched(courseId, index);
      }
      if (totalLessons > 0 && completedBefore.length + 1 >= totalLessons && window.ADPELJourney && typeof window.ADPELJourney.registerCourseCompleted === 'function') {
        window.ADPELJourney.registerCourseCompleted(courseId);
      }
      showToast('Aula concluída!', 'success');
    }

    if (currentOpenCourse && currentOpenCourse.id === courseId) {
      await renderCourseLessons(currentOpenCourse);
      await updateCertificateButton(courseId, normalizeLessons(currentOpenCourse.lessons).length);
    }
  } catch (e) {
    console.error('Erro ao atualizar progresso:', e);
    showToast('Erro ao salvar progresso.', 'error');
  }
}

async function renderCourseLessons(course) {
  const lessonsContainer = document.getElementById('course-lessons-container');
  const noLessonsEl = document.getElementById('course-no-lessons');
  const videoWrapper = document.getElementById('course-video-wrapper');
  const videoFrame = document.getElementById('course-video-frame');
  if (!lessonsContainer) return;

  lessonsContainer.innerHTML = '';
  if (noLessonsEl) noLessonsEl.classList.add('hidden');

  const lessons = normalizeLessons(course.lessons);
  if (lessons.length === 0) {
    if (noLessonsEl) noLessonsEl.classList.remove('hidden');
    return;
  }

  const completedIndexes = await getLessonProgress(course.id);

  lessons.forEach((lesson, index) => {
    const lessonTitle = lesson.title || `Aula ${index + 1}`;
    const lessonUrl = lesson.url;
    const videoId = extractYouTubeID(lessonUrl);
    const isYouTube = !!videoId;
    const isCompleted = isLessonCompleted(completedIndexes, index);

    const item = document.createElement('div');
    item.className = `flex items-center gap-3 p-3 rounded-lg border transition cursor-pointer select-none ${
      isCompleted ? 'bg-green-50 border-green-200 hover:bg-green-100' : 'bg-gray-50 border-gray-100 hover:bg-blue-50'
    }`;

    item.innerHTML = `
      <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition ${
        isCompleted ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
      }">
        <i class="fas fa-check text-xs"></i>
      </div>
      <div class="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 font-bold text-sm">${index + 1}</div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-gray-800 truncate">${escapeHtml(lessonTitle)}</p>
        <p class="text-xs ${isCompleted ? 'text-green-600 font-medium' : 'text-gray-500'}">${isCompleted ? 'Concluído' : 'Clique para assistir'}</p>
      </div>
    `;

    item.addEventListener('click', () => {
      if (isYouTube && videoWrapper) {
        videoWrapper.classList.remove('hidden');
        loadYouTubePlayer(videoId, course.id, index);
      } else {
        window.open(lessonUrl, '_blank');
      }
    });

    lessonsContainer.appendChild(item);
  });
}

async function openCourseModal(encodedCourse) {
  let course;
  try {
    course = JSON.parse(decodeURIComponent(encodedCourse));
  } catch (e) {
    console.error('Erro ao abrir curso:', e);
    return;
  }

  currentOpenCourse = course;

  const modal = document.getElementById('course-modal');
  const titleEl = document.getElementById('course-modal-title');
  const teacherEl = document.getElementById('course-modal-teacher');
  const descEl = document.getElementById('course-modal-description');
  const lessonsContainer = document.getElementById('course-lessons-container');
  const noLessonsEl = document.getElementById('course-no-lessons');
  const videoWrapper = document.getElementById('course-video-wrapper');

  if (titleEl) titleEl.textContent = course.title || 'Curso';
  if (teacherEl) teacherEl.textContent = course.teacher_name ? `Professor: ${course.teacher_name}` : 'Professor: A definir';
  if (descEl) descEl.textContent = course.description || 'Sem descrição disponível.';

  // Reset video
  if (videoWrapper) videoWrapper.classList.add('hidden');
  if (ytPlayer && ytPlayer.destroy) {
    ytPlayer.destroy();
    ytPlayer = null;
  }

  await renderCourseLessons(course);
  await updateCertificateButton(course.id, normalizeLessons(course.lessons).length);

  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    restorePageScroll();
  }
}

function closeCourseModal() {
  const modal = document.getElementById('course-modal');
  const videoWrapper = document.getElementById('course-video-wrapper');
  if (ytPlayer && ytPlayer.destroy) {
    ytPlayer.destroy();
    ytPlayer = null;
  }
  if (videoWrapper) videoWrapper.classList.add('hidden');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
  }
  currentCourseForPlayer = null;
  currentLessonIndexForPlayer = null;
  currentOpenCourse = null;
}

function loadYouTubePlayer(videoId, courseId, lessonIndex) {
  if (!window.YT || !window.YT.Player) {
    setTimeout(() => loadYouTubePlayer(videoId, courseId, lessonIndex), 500);
    return;
  }
  currentCourseForPlayer = courseId;
  currentLessonIndexForPlayer = lessonIndex;

  if (ytPlayer && ytPlayer.destroy) {
    ytPlayer.destroy();
  }
  const wrapper = document.getElementById('course-video-wrapper');
  if (wrapper) {
    wrapper.innerHTML = '<div id="yt-player" class="w-full h-full"></div>';
  }

  ytPlayer = new YT.Player('yt-player', {
    height: '100%',
    width: '100%',
    videoId: videoId,
    playerVars: {
      autoplay: 1,
      rel: 0,
      modestbranding: 1
    },
    events: {
      'onStateChange': onPlayerStateChange
    }
  });
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.ENDED) {
    if (currentCourseForPlayer !== null && currentLessonIndexForPlayer !== null) {
      toggleLessonComplete(currentCourseForPlayer, currentLessonIndexForPlayer);
    }
  }
}

async function updateCertificateButton(courseId, totalLessons) {
  const btn = document.getElementById('course-cert-btn');
  if (!btn) return;

  const completedIndexes = await getLessonProgress(courseId);
  const allCompleted = totalLessons > 0 && completedIndexes.length >= totalLessons;

  if (allCompleted) {
    btn.classList.remove('hidden', 'opacity-50', 'cursor-not-allowed');
    btn.classList.add('flex');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-award"></i> <span>Baixar Certificado</span>';
  } else {
    btn.classList.remove('hidden', 'flex');
    btn.classList.add('flex', 'opacity-50', 'cursor-not-allowed');
    btn.disabled = true;
    const remaining = totalLessons - completedIndexes.length;
    btn.innerHTML = `<i class="fas fa-lock"></i> <span>Certificado (${remaining} aula${remaining !== 1 ? 's' : ''} rest.)</span>`;
  }
}

async function downloadCertificate() {
  if (!currentOpenCourse) return;
  const lessons = normalizeLessons(currentOpenCourse.lessons);
  const completedIndexes = await getLessonProgress(currentOpenCourse.id);
  if (completedIndexes.length < lessons.length) {
    showToast('Complete todas as aulas para baixar o certificado.', 'warning');
    return;
  }

  const userInfo = getCurrentUserInfo();
  const userName = userInfo.profile?.full_name || userInfo.user?.email || 'Estudante';
  const today = new Date();
  const certTitle = currentOpenCourse.certificate_title || currentOpenCourse.title || 'Certificado de Conclusão';
  const certDesc = currentOpenCourse.certificate_description || `Concluiu o curso "${currentOpenCourse.title}" com êxito.`;

  const certificateData = {
    user_name: userName,
    course_title: currentOpenCourse.title,
    course_duration: currentOpenCourse.duration,
    description: certDesc,
    completed_at: today
  };

  // Salvar certificado no histórico do usuário
  try {
    if (userInfo.user) {
      // Verifica se certificado já foi emitido para não duplicar
      const { data: existingCert, error: checkError } = await window.supabaseClient
        .from('certificates')
        .select('id')
        .eq('user_id', userInfo.user.id)
        .eq('title', certTitle)
        .maybeSingle();

      if (checkError) {
        console.error('Erro ao verificar certificado existente:', checkError);
      }

      if (existingCert) {
        showToast('Certificado já foi emitido anteriormente.', 'info');
      } else {
        const { error } = await window.supabaseClient
          .from('certificates')
          .insert([{
            user_id: userInfo.user.id,
            course_id: currentOpenCourse.id,
            title: certTitle,
            description: certDesc,
            completed_at: today,
            certificate_data: certificateData
          }]);

        if (error) {
          console.error('Erro ao salvar certificado no histórico:', error);
          showToast('Erro ao salvar certificado no histórico.', 'error');
        } else {
          showToast('Certificado adicionado ao seu histórico!', 'success');
          if (currentSection === 'certificate') {
            await loadCertificatesData();
          }
        }
      }
    }
  } catch (e) {
    console.error('Erro ao salvar certificado no histórico:', e);
  }

  const logoUrl = 'https://huggingface.co/spaces/IzaqueE/deepsite-project-6tv0m/resolve/main/images/adpel.logo.png';
  const completedDate = today.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  const html = buildCertificateHTML({
    userName,
    certTitle,
    courseTitle: currentOpenCourse.title,
    description: certDesc,
    duration: currentOpenCourse.duration,
    completedDate,
    logoUrl
  });

  const certWindow = window.open('', '_blank');
  certWindow.document.write(html);
  certWindow.document.close();
}

function openStudyModal(encodedStudy) {
  let study;
  try {
    study = JSON.parse(decodeURIComponent(encodedStudy));
  } catch (e) {
    console.error('Erro ao abrir estudo:', e);
    return;
  }
  currentOpenStudy = study;

  const titleEl = document.getElementById('study-modal-title');
  const catEl = document.getElementById('study-modal-category');
  const descEl = document.getElementById('study-modal-description');
  const contentSection = document.getElementById('study-content-section');
  const contentDiv = document.getElementById('study-modal-content');
  const fileSection = document.getElementById('study-file-section');
  const fileLink = document.getElementById('study-file-link');
  const lessonsSection = document.getElementById('study-lessons-section');
  const lessonsContainer = document.getElementById('study-lessons-container');
  const noLessonsEl = document.getElementById('study-no-lessons');
  const videoWrapper = document.getElementById('study-video-wrapper');

  if (titleEl) titleEl.textContent = study.title || 'Estudo';
  if (catEl) catEl.textContent = study.category || 'Estudo';
  if (descEl) descEl.textContent = study.description || 'Sem descrição.';

  if (study.content && contentSection && contentDiv) {
    contentSection.classList.remove('hidden');
    contentDiv.innerHTML = study.content;
  } else if (contentSection) {
    contentSection.classList.add('hidden');
  }

  if (study.file_url && fileSection && fileLink) {
    fileSection.classList.remove('hidden');
    fileLink.href = study.file_url;
  } else if (fileSection) {
    fileSection.classList.add('hidden');
  }

  if (lessonsContainer) lessonsContainer.innerHTML = '';
  if (noLessonsEl) noLessonsEl.classList.add('hidden');
  if (videoWrapper) videoWrapper.classList.add('hidden');
  if (studyYtPlayer && studyYtPlayer.destroy) { studyYtPlayer.destroy(); studyYtPlayer = null; }

  const lessons = normalizeLessons(study.lessons);
  if (lessons.length > 0 && lessonsSection && lessonsContainer) {
    lessonsSection.classList.remove('hidden');
    lessons.forEach((lesson, index) => {
      const lessonTitle = lesson.title || `Aula ${index + 1}`;
      const lessonUrl = lesson.url;
      const videoId = extractYouTubeID(lessonUrl);
      const div = document.createElement('div');
      div.className = 'flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-amber-50 transition cursor-pointer';
      div.innerHTML = `
        <div class="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0 font-bold text-sm">${index + 1}</div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-800 truncate">${escapeHtml(lessonTitle)}</p>
          <p class="text-xs text-gray-500">${videoId ? 'Clique para assistir' : 'Clique para abrir'}</p>
        </div>
      `;
      div.addEventListener('click', () => {
        if (videoId && videoWrapper) {
          videoWrapper.classList.remove('hidden');
          loadStudyYouTubePlayer(videoId, study.id, index);
        } else {
          window.open(lessonUrl, '_blank');
        }
      });
      lessonsContainer.appendChild(div);
    });
  } else if (lessonsSection) {
    lessonsSection.classList.add('hidden');
  }

  const modal = document.getElementById('study-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    restorePageScroll();
  }
}

function closeStudyModal() {
  const modal = document.getElementById('study-modal');
  const videoWrapper = document.getElementById('study-video-wrapper');
  if (studyYtPlayer && studyYtPlayer.destroy) { studyYtPlayer.destroy(); studyYtPlayer = null; }
  if (videoWrapper) videoWrapper.classList.add('hidden');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
  }
  currentOpenStudy = null;
  currentStudyForPlayer = null;
  currentStudyLessonIndexForPlayer = null;
}

function loadStudyYouTubePlayer(videoId, studyId, lessonIndex) {
  if (!window.YT || !window.YT.Player) {
    setTimeout(() => loadStudyYouTubePlayer(videoId, studyId, lessonIndex), 500);
    return;
  }
  currentStudyForPlayer = studyId;
  currentStudyLessonIndexForPlayer = lessonIndex;
  if (studyYtPlayer && studyYtPlayer.destroy) studyYtPlayer.destroy();
  const wrapper = document.getElementById('study-video-wrapper');
  if (wrapper) {
    wrapper.innerHTML = '<div id="study-yt-player" class="w-full h-full"></div>';
  }
  studyYtPlayer = new YT.Player('study-yt-player', {
    height: '100%',
    width: '100%',
    videoId: videoId,
    playerVars: { autoplay: 1, rel: 0, modestbranding: 1 },
    events: {
      'onStateChange': (event) => {
        if (event.data === YT.PlayerState.ENDED) {
          showToast('Aula concluída!', 'success');
          if (window.ADPELJourney && typeof window.ADPELJourney.registerStudyCompleted === 'function') {
            window.ADPELJourney.registerStudyCompleted(studyId);
          }
        }
      }
    }
  });
}

// Bloquear orientação para landscape quando vídeo entrar em tela cheia
['fullscreenchange', 'webkitfullscreenchange'].forEach(eventName => {
  document.addEventListener(eventName, async () => {
    const fsElement = document.fullscreenElement || document.webkitFullscreenElement;
    const isCourseModalOpen = document.getElementById('course-modal') && !document.getElementById('course-modal').classList.contains('hidden');
    const isStudyModalOpen = document.getElementById('study-modal') && !document.getElementById('study-modal').classList.contains('hidden');

    if (fsElement && (isCourseModalOpen || isStudyModalOpen)) {
      if (screen.orientation && screen.orientation.lock) {
        try { await screen.orientation.lock('landscape'); } catch (e) { console.log('Orientação não pôde ser travada.'); }
      }
    } else if (!fsElement) {
      if (screen.orientation && screen.orientation.unlock) {
        try { await screen.orientation.unlock(); } catch (e) {}
      }
    }
  });
});

Object.assign(window, {
  loadCoursesData,
  loadStudiesData,
  renderFeaturedStudies,
  courseCarouselCard,
  renderCoursesList,
  renderStudiesList,
  normalizeLessons,
  normalizeLesson,
  extractYouTubeID,
  getLessonProgress,
  isLessonCompleted,
  getAllLessonProgress,
  toggleLessonComplete,
  renderCourseLessons,
  openCourseModal,
  closeCourseModal,
  loadYouTubePlayer,
  onPlayerStateChange,
  updateCertificateButton,
  downloadCertificate,
  openStudyModal,
  closeStudyModal,
  loadStudyYouTubePlayer
});
