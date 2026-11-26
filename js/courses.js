// Courses module - extracted from script.js without behavior changes.

let ytPlayer = null;

let currentCourseForPlayer = null;

let currentLessonIndexForPlayer = null;

let currentOpenCourse = null;

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

function courseCarouselCard(course, actionLabel) {
  const lessonsTotal = typeof course.totalLessons === 'number'
    ? course.totalLessons
    : normalizeLessons(course.lessons).length;
  const lessonsDone = typeof course.completedLessons === 'number' ? course.completedLessons : 0;
  const progress = lessonsTotal > 0 ? Math.min(100, Math.round((lessonsDone / lessonsTotal) * 100)) : 100;
  const courseData = encodeInlineJson(course);
  const thumbnailUrl = safeImageUrl(course.thumbnail_url);

  return `
    <div class="min-w-[292px] max-w-[320px] flex-shrink-0 snap-start bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition group border border-gray-100">
      <div class="relative h-40 bg-gradient-to-br from-blue-500 to-blue-700 cursor-pointer" onclick="if(!getCurrentUserInfo().isLoggedIn){openModal('login-modal');return;} openCourseModal('${courseData}')">
        ${thumbnailUrl
          ? `<img src="${escapeHtml(thumbnailUrl)}" class="w-full h-full object-cover" alt="${escapeHtml(course.title)}">`
          : `<div class="w-full h-full flex items-center justify-center text-white/50"><i class="fas fa-graduation-cap text-5xl"></i></div>`}
        <div class="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent"></div>
        <div class="absolute bottom-3 right-3 bg-white/90 px-2 py-1 rounded text-xs font-bold text-blue-700">${escapeHtml(course.category || 'Curso')}</div>
      </div>
      <div class="p-4">
        <h4 class="font-bold text-gray-800 group-hover:text-blue-600 transition cursor-pointer" onclick="if(!getCurrentUserInfo().isLoggedIn){openModal('login-modal');return;} openCourseModal('${courseData}')">${escapeHtml(course.title)}</h4>
        <p class="text-sm text-gray-500 mt-2 line-clamp-2">${escapeHtml(course.description || 'Sem descricao')}</p>
        <div class="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span class="flex items-center gap-1"><i class="fas fa-user-tie text-xs"></i> ${escapeHtml(course.teacher_name || 'A definir')}</span>
          <span class="flex items-center gap-1"><i class="fas fa-clock text-xs"></i> ${course.duration ? `${course.duration}h` : 'A definir'}</span>
        </div>
        <div class="mt-4">
          <div class="flex justify-between text-xs text-gray-500 mb-1">
            <span>${lessonsDone}/${lessonsTotal} aulas</span>
            <span>${progress}%</span>
          </div>
          <div class="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div class="h-1.5 bg-blue-600 rounded-full" style="width:${progress}%"></div>
          </div>
        </div>
        <button onclick="if(!getCurrentUserInfo().isLoggedIn){openModal('login-modal');return;} openCourseModal('${courseData}')" class="mt-4 w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">${escapeHtml(actionLabel || 'Assistir')}</button>
      </div>
    </div>
  `;
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

function parseYouTubeStartTime(value) {
  if (!value) return 0;
  const text = String(value).trim().toLowerCase();
  if (/^\d+$/.test(text)) return Number(text);
  const match = text.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!match) return 0;
  return (Number(match[1]) || 0) * 3600 + (Number(match[2]) || 0) * 60 + (Number(match[3]) || 0);
}

function normalizeYouTubeUrl(url) {
  if (!url) return null;
  const rawUrl = String(url).trim();
  if (!rawUrl) return null;

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (error) {
    return null;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;

  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const pathParts = parsed.pathname.split('/').filter(Boolean);
  let videoId = '';

  if (hostname === 'youtu.be') {
    videoId = pathParts[0] || '';
  } else if (hostname === 'youtube.com' || hostname === 'm.youtube.com' || hostname === 'music.youtube.com') {
    if (pathParts[0] === 'watch') {
      videoId = parsed.searchParams.get('v') || '';
    } else if (['embed', 'shorts', 'live', 'v'].includes(pathParts[0])) {
      videoId = pathParts[1] || '';
    }
  }

  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;

  const startSeconds = parseYouTubeStartTime(parsed.searchParams.get('t') || parsed.searchParams.get('start'));
  const watchUrl = new URL('https://www.youtube.com/watch');
  watchUrl.searchParams.set('v', videoId);
  if (startSeconds > 0) watchUrl.searchParams.set('t', String(startSeconds));

  return {
    videoId,
    startSeconds,
    watchUrl: watchUrl.toString(),
    embedUrl: `https://www.youtube.com/embed/${videoId}`
  };
}

function extractYouTubeID(url) {
  const normalized = normalizeYouTubeUrl(url);
  return normalized ? normalized.videoId : null;
}

function getYouTubePlayerOrigin() {
  if (!window.location || !/^https?:$/.test(window.location.protocol)) return '';
  return window.location.origin;
}

function buildYouTubeEmbedUrl(video) {
  const embedUrl = new URL(video.embedUrl);
  embedUrl.searchParams.set('enablejsapi', '1');
  embedUrl.searchParams.set('autoplay', '1');
  embedUrl.searchParams.set('rel', '0');
  embedUrl.searchParams.set('playsinline', '1');
  if (video.startSeconds > 0) embedUrl.searchParams.set('start', String(video.startSeconds));
  const origin = getYouTubePlayerOrigin();
  if (origin) embedUrl.searchParams.set('origin', origin);
  return embedUrl.toString();
}

function renderYouTubeFallback(wrapper, video) {
  if (!wrapper) return;
  wrapper.replaceChildren();

  const content = document.createElement('div');
  content.className = 'w-full h-full min-h-[220px] flex flex-col items-center justify-center gap-3 bg-slate-950 text-white text-center p-6';

  const icon = document.createElement('i');
  icon.className = 'fab fa-youtube text-4xl text-red-500';
  const message = document.createElement('p');
  message.className = 'font-medium';
  message.textContent = 'Não foi possível reproduzir este vídeo aqui.';
  content.append(icon, message);

  if (video && video.watchUrl) {
    const link = document.createElement('a');
    link.href = video.watchUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition';
    link.textContent = 'Assistir no YouTube';
    content.appendChild(link);
  }

  wrapper.appendChild(content);
}

function createYouTubeIframe(wrapper, iframeId, video, title) {
  wrapper.replaceChildren();
  const iframe = document.createElement('iframe');
  iframe.id = iframeId;
  iframe.src = buildYouTubeEmbedUrl(video);
  iframe.title = title;
  iframe.className = 'w-full h-full border-0';
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  iframe.allowFullscreen = true;
  wrapper.appendChild(iframe);
  return iframe;
}

async function getLessonProgress(courseId) {
  const userInfo = getCurrentUserInfo();
  if (!userInfo.isLoggedIn || !userInfo.user) return [];
  try {
    const { data, error } = await window.supabaseClient
      .from('user_lesson_progress')
      .select('lesson_index')
      .eq('completed', true)
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
      .eq('completed', true)
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
    const youtubeVideo = normalizeYouTubeUrl(lessonUrl);
    const isYouTube = !!youtubeVideo;
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
        loadYouTubePlayer(youtubeVideo, course.id, index, lessonTitle);
      } else {
        if (videoWrapper) {
          videoWrapper.classList.remove('hidden');
          renderYouTubeFallback(videoWrapper, null);
        }
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

function loadYouTubePlayer(video, courseId, lessonIndex, lessonTitle, attempt) {
  const normalizedVideo = typeof video === 'string'
    ? normalizeYouTubeUrl(/^[A-Za-z0-9_-]{11}$/.test(video) ? `https://youtu.be/${video}` : video)
    : video;
  const wrapper = document.getElementById('course-video-wrapper');
  if (!normalizedVideo || !wrapper) {
    renderYouTubeFallback(wrapper, normalizedVideo);
    return;
  }

  const currentAttempt = Number(attempt) || 0;
  if (!window.YT || !window.YT.Player) {
    if (currentAttempt >= 20) {
      renderYouTubeFallback(wrapper, normalizedVideo);
      return;
    }
    setTimeout(() => loadYouTubePlayer(normalizedVideo, courseId, lessonIndex, lessonTitle, currentAttempt + 1), 500);
    return;
  }
  currentCourseForPlayer = courseId;
  currentLessonIndexForPlayer = lessonIndex;

  if (ytPlayer && ytPlayer.destroy) {
    ytPlayer.destroy();
  }
  const iframe = createYouTubeIframe(wrapper, 'yt-player', normalizedVideo, `Aula em vídeo: ${lessonTitle || 'Curso'}`);

  ytPlayer = new YT.Player(iframe, {
    events: {
      'onStateChange': onPlayerStateChange,
      'onError': (event) => {
        console.warn('Falha no player do YouTube:', { code: event.data, videoId: normalizedVideo.videoId });
        if (ytPlayer && ytPlayer.destroy) ytPlayer.destroy();
        ytPlayer = null;
        renderYouTubeFallback(wrapper, normalizedVideo);
      }
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
  if (currentOpenCourse?.id !== courseId) return;
  const validCompleted = new Set(completedIndexes.filter(index => Number.isInteger(index) && index >= 0 && index < totalLessons));
  const allCompleted = totalLessons > 0 && validCompleted.size === totalLessons;

  if (allCompleted) {
    btn.classList.remove('hidden', 'opacity-50', 'cursor-not-allowed');
    btn.classList.add('flex');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-award"></i> <span>Baixar Certificado</span>';
  } else {
    btn.classList.remove('hidden', 'flex');
    btn.classList.add('flex', 'opacity-50', 'cursor-not-allowed');
    btn.disabled = true;
    const remaining = totalLessons - validCompleted.size;
    btn.innerHTML = `<i class="fas fa-lock"></i> <span>Certificado (${remaining} aula${remaining !== 1 ? 's' : ''} rest.)</span>`;
  }
}

let certificateIssueBusy = false;
async function downloadCertificate() {
  if (!currentOpenCourse || certificateIssueBusy) return;
  const courseId = currentOpenCourse.id;
  const userInfo = getCurrentUserInfo();
  if (!userInfo.isLoggedIn || !userInfo.user || !window.supabaseClient) {
    showToast('Entre na sua conta para emitir o certificado.', 'warning');
    return;
  }
  const uid = userInfo.user.id;
  const button = document.getElementById('course-cert-btn');
  certificateIssueBusy = true;
  if (button) button.disabled = true;
  try {
    const client = window.supabaseClient;
    const readIssued = () => client.from('certificates').select('*').eq('user_id',uid).eq('course_id',courseId).order('created_at',{ascending:true}).limit(1).maybeSingle();
    let result = await readIssued();
    if (result.error) throw result.error;
    if (!result.data) {
      // Keep master users' own learning flow consistent with ordinary users.
      const course = currentOpenCourse;
      if (course?.id !== courseId || getCurrentUserInfo().user?.id !== uid) return;
      const total = normalizeLessons(course.lessons).length;
      const done = new Set((await getLessonProgress(courseId)).filter(i => Number.isInteger(i) && i >= 0 && i < total));
      if (getCurrentUserInfo().user?.id !== uid || currentOpenCourse?.id !== courseId) return;
      if (total < 1 || done.size !== total) {
        showToast('Complete todas as aulas para baixar o certificado.','warning');
        return;
      }
      const title = course.certificate_title || course.title || 'Certificado de conclusão';
      const description = course.certificate_description || 'Concluiu o curso "' + course.title + '" com êxito.';
      const issued = await client.from('certificates').insert({
        user_id:uid, course_id:courseId, title, description, certificate_type:'curso',
        certificate_data:{user_name:userInfo.profile?.full_name || userInfo.user.email || 'Estudante',course_title:course.title,course_duration:course.duration,description}
      }).select('*').single();
      if (issued.error && issued.error.code === '23505') result = await readIssued();
      else result = issued;
    }
    if (result.error || !result.data || !result.data.id) throw result.error || new Error('Emissão não confirmada.');
    if (getCurrentUserInfo().user?.id !== uid || currentOpenCourse?.id !== courseId) return;
    // Render exclusively from the persisted certificate; never print a client-generated fallback.
    renderIssuedCertificate(result.data);
    showToast('Certificado disponível no seu histórico.', 'success');
  } catch (error) {
    console.warn('Emissão do certificado não confirmada:',error);
    showToast(error && error.code === '42501' ? 'Conclua todas as aulas e confira seu acesso e nome no perfil.' : 'Não foi possível emitir o certificado. Tente novamente.','warning');
  } finally {
    certificateIssueBusy=false;
    if (button && currentOpenCourse?.id === courseId) {
      try { await updateCertificateButton(courseId,normalizeLessons(currentOpenCourse.lessons).length); } catch (error) { button.disabled=false; }
    }
  }
}

// Bloquear orientação para landscape quando vídeo entrar em tela cheia
['fullscreenchange', 'webkitfullscreenchange'].forEach(eventName => {
  document.addEventListener(eventName, async () => {
    const fsElement = document.fullscreenElement || document.webkitFullscreenElement;
    const isCourseModalOpen = document.getElementById('course-modal') && !document.getElementById('course-modal').classList.contains('hidden');
    if (fsElement && isCourseModalOpen) {
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
  courseCarouselCard,
  renderCoursesList,
  normalizeLessons,
  normalizeLesson,
  normalizeYouTubeUrl,
  extractYouTubeID,
  buildYouTubeEmbedUrl,
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
  downloadCertificate
});
