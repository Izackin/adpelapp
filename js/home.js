// Home module - optimized for the final ADPEL release.

const VERSE_CACHE_KEY = 'adpel:verse-of-day';

function updateBannerWelcome() {
  const title = document.getElementById('home-welcome-title');
  const subtitle = document.getElementById('home-welcome-subtitle');
  if (!title && !subtitle) return;

  const userInfo = typeof getCurrentUserInfo === 'function' ? getCurrentUserInfo() : { isLoggedIn: false };
  const profile = userInfo.profile || {};
  const user = userInfo.user || {};
  const name = profile.full_name || user.email || '';

  if (title) {
    title.textContent = userInfo.isLoggedIn && name ? 'Olá, ' + name : 'Olá, seja bem-vindo';
  }
  if (subtitle) {
    subtitle.textContent = userInfo.isLoggedIn
      ? 'Continue sua caminhada com fé, ensino e comunhão.'
      : 'Entre para acompanhar cursos, ofertas, conquistas e sua caminhada.';
  }
}

function getVerseCacheDate() {
  return new Date().toISOString().slice(0, 10);
}

function renderVerse(verse) {
  const textEl = document.getElementById('verse-text');
  const refEl = document.getElementById('verse-ref');
  if (textEl) textEl.textContent = verse?.text || 'Nenhum versículo disponível.';
  if (refEl) refEl.textContent = verse?.reference ? '— ' + verse.reference : '';
}

async function carregarVersiculoDoDia() {
  try {
    const today = getVerseCacheDate();
    const cached = localStorage.getItem(VERSE_CACHE_KEY);

    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.date === today && parsed?.verse) {
        renderVerse(parsed.verse);
        return;
      }
    }

    const diaAno = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
    );

    const { data, error } = await window.supabaseClient
      .from('verse_of_day')
      .select('id,text,reference')
      .order('id');

    if (error) {
      console.error('Erro ao buscar versículo do dia:', error);
      return;
    }

    if (!data || !data.length) {
      renderVerse(null);
      return;
    }

    const versiculo = data[diaAno % data.length];
    renderVerse(versiculo);

    localStorage.setItem(VERSE_CACHE_KEY, JSON.stringify({
      date: today,
      verse: versiculo
    }));
  } catch (error) {
    console.error('Erro em carregarVersiculoDoDia:', error);
  }
}

async function loadHomeData() {
  const now = Date.now();
  if (now - _lastHomeLoad < SECTION_LOAD_DEBOUNCE) {
    return;
  }
  _lastHomeLoad = now;

  try {
    const userInfo = getCurrentUserInfo();
    const versePromise = carregarVersiculoDoDia();
    const progressPromise = userInfo.isLoggedIn
      ? getAllLessonProgress().catch(error => {
          console.error('Erro ao carregar progresso:', error);
          return [];
        })
      : Promise.resolve([]);

    const [courses, events, announcements, allProgress] = await Promise.all([
      ADPEL.fetch.courses(),
      ADPEL.fetch.events(),
      ADPEL.fetch.announcements(),
      progressPromise
    ]);

    const progressMap = {};
    (allProgress || []).forEach(progress => {
      if (!progressMap[progress.course_id]) {
        progressMap[progress.course_id] = new Set();
      }
      progressMap[progress.course_id].add(progress.lesson_index);
    });

    const publishedCourses = (courses || [])
      .filter(course => course.is_published)
      .filter(isContentVisibleNow);

    const homeCourses = publishedCourses.map(course => {
      const lessons = normalizeLessons(course.lessons);
      const total = lessons.length;
      const completedSet = progressMap[course.id] || new Set();
      const completed = completedSet.size;
      let status = 'not-started';

      if (total === 0 || completed >= total) status = 'completed';
      else if (completed > 0) status = 'in-progress';

      return {
        ...course,
        totalLessons: total,
        completedLessons: completed,
        status
      };
    });

    renderContinueSection(homeCourses.filter(course => course.status === 'in-progress').slice(0, 4));
    renderFeaturedCourses(homeCourses.filter(course => course.is_featured).slice(0, 6));

    const futureEvents = (events || []).filter(isHomeEventVisible);
    const publishedAnnouncements = (announcements || [])
      .filter(announcement => announcement.is_published)
      .filter(isContentVisibleNow);
    const homeAgenda = buildUnifiedAgenda(futureEvents, publishedAnnouncements);

    const attendances = typeof fetchAttendancesForEvents === 'function'
      ? await fetchAttendancesForEvents(homeAgenda)
      : await fetchAllAttendances();

    const attendancesByEvent = {};
    (attendances || []).forEach(attendance => {
      if (!attendancesByEvent[attendance.event_id]) {
        attendancesByEvent[attendance.event_id] = [];
      }
      attendancesByEvent[attendance.event_id].push(attendance);
    });

    renderHomeEvents(homeAgenda, attendancesByEvent);

    const announcementsSection = document.getElementById('home-announcements-section');
    if (announcementsSection) {
      announcementsSection.classList.add('hidden');
    }

    await versePromise;
  } catch (error) {
    console.error('Erro ao carregar dados da home:', error);
  }
}

Object.assign(window, {
  updateBannerWelcome,
  carregarVersiculoDoDia,
  loadHomeData,
  renderContinueSection,
  renderFeaturedCourses
});

function renderContinueSection(courses) {
  const section = document.getElementById('continue-section');
  const container = document.getElementById('continue-grid');
  if (!section || !container) return;

  if (!courses || courses.length === 0) {
    section.classList.add('hidden');
    container.innerHTML = '';
    return;
  }

  section.classList.remove('hidden');
  container.innerHTML = courses.map(course => courseCarouselCard(course, 'Continuar')).join('');
}

function renderFeaturedCourses(courses) {
  const container = document.getElementById('featured-courses');
  const section = document.getElementById('featured-courses-section');
  if (!container) return;

  if (!courses || courses.length === 0) {
    if (section) section.classList.add('hidden');
    container.innerHTML = '';
    return;
  }

  if (section) section.classList.remove('hidden');
  container.innerHTML = courses.map(course => `
    <div class="min-w-[292px] max-w-[320px] flex-shrink-0 snap-start bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition group border border-gray-100">
      <div class="relative h-40 bg-gradient-to-br from-blue-500 to-blue-700 cursor-pointer" onclick="if(!getCurrentUserInfo().isLoggedIn){openModal('login-modal');return;} openCourseModal('${encodeURIComponent(JSON.stringify(course))}')">
        ${course.thumbnail_url
          ? `<img src="${course.thumbnail_url}" class="w-full h-full object-cover" alt="${escapeHtml(course.title)}" loading="lazy" decoding="async" width="320" height="160">`
          : `<div class="w-full h-full flex items-center justify-center text-white/50"><i class="fas fa-graduation-cap text-5xl"></i></div>`}
        <div class="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent"></div>
        <div class="absolute top-3 left-3 bg-amber-400 text-slate-950 px-2 py-1 rounded text-xs font-black shadow-sm">Destaque</div>
        <div class="absolute bottom-3 right-3 bg-white/90 px-2 py-1 rounded text-xs font-bold text-blue-700">${escapeHtml(course.category || 'Curso')}</div>
      </div>
      <div class="p-4">
        <h4 class="font-bold text-gray-800 group-hover:text-blue-600 transition cursor-pointer" onclick="if(!getCurrentUserInfo().isLoggedIn){openModal('login-modal');return;} openCourseModal('${encodeURIComponent(JSON.stringify(course))}')">${escapeHtml(course.title)}</h4>
        <p class="text-sm text-gray-500 mt-2 line-clamp-2">${escapeHtml(course.description || 'Sem descrição')}</p>
        <div class="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span class="flex items-center gap-1"><i class="fas fa-user-tie text-xs"></i> ${escapeHtml(course.teacher_name || 'A definir')}</span>
          <span class="flex items-center gap-1"><i class="fas fa-clock text-xs"></i> ${course.duration ? `${course.duration}h` : 'A definir'}</span>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <button onclick="if(!getCurrentUserInfo().isLoggedIn){openModal('login-modal');return;} openCourseModal('${encodeURIComponent(JSON.stringify(course))}')" class="py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">Assistir</button>
          <button onclick="navigateTo('courses')" class="py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition">Outros cursos</button>
        </div>
      </div>
    </div>
  `).join('');
}
