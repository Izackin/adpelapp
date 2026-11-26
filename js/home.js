// Home module - extracted from script.js without behavior changes.

function updateBannerWelcome() {
  const title = document.getElementById('home-welcome-title');
  const subtitle = document.getElementById('home-welcome-subtitle');
  if (!title && !subtitle) return;

  const userInfo = typeof getCurrentUserInfo === 'function' ? getCurrentUserInfo() : { isLoggedIn: false };
  const profile = userInfo.profile || {};
  const fullName = profile.public_name || profile.full_name || '';
  const firstName = String(fullName).trim().split(/\s+/)[0] || '';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  if (title) {
    title.textContent = userInfo.isLoggedIn && firstName ? greeting + ', ' + firstName : greeting;
  }
  if (subtitle) {
    subtitle.textContent = userInfo.isLoggedIn
      ? 'Que bom ter você por aqui.'
      : 'Encontre a Bíblia, a agenda e os recursos da ADPEL.';
  }

  const initials = document.getElementById('home-avatar-initials');
  const shortcut = document.getElementById('home-profile-shortcut');
  const avatarUrl = typeof safeImageUrl === 'function' ? safeImageUrl(profile.avatar_url) : '';
  if (shortcut) shortcut.setAttribute('aria-label', userInfo.isLoggedIn ? 'Abrir meu perfil' : 'Entrar na ADPEL');
  if (initials) {
    initials.textContent = firstName ? firstName.slice(0, 2).toUpperCase() : 'AD';
    var existingImage = initials.parentElement.querySelector('img');
    if (existingImage) existingImage.remove();
    initials.classList.remove('hidden');
    if (avatarUrl) {
      var image = document.createElement('img');
      image.src = avatarUrl;
      image.alt = '';
      image.width = 46;
      image.height = 46;
      initials.classList.add('hidden');
      initials.parentElement.prepend(image);
    }
  }
}

async function loadDeterministicBibleVerse(dayIndex) {
  const references = [
    ['GEN', 1, 1], ['PSA', 23, 1], ['PRO', 3, 5], ['ISA', 41, 10],
    ['MAT', 5, 14], ['JHN', 3, 16], ['ROM', 8, 28]
  ];
  const selected = references[dayIndex % references.length];
  const translationResult = await window.supabaseClient
    .from('bible_translations')
    .select('id, short_name')
    .eq('is_default', true)
    .eq('is_active', true)
    .maybeSingle();
  if (translationResult.error || !translationResult.data) return null;
  const verseResult = await window.supabaseClient
    .from('bible_verses')
    .select('book, chapter, verse, text')
    .eq('translation_id', translationResult.data.id)
    .eq('book_id', selected[0])
    .eq('chapter', selected[1])
    .eq('verse', selected[2])
    .eq('is_canonical', true)
    .maybeSingle();
  if (verseResult.error || !verseResult.data) return null;
  return {
    text: verseResult.data.text,
    reference: `${verseResult.data.book} ${verseResult.data.chapter}:${verseResult.data.verse} · ${translationResult.data.short_name}`
  };
}

var homeVerseRequest = null;
var homeVerseDate = '';
function carregarVersiculoDoDia() {
  const today = new Date().toDateString();
  if (homeVerseRequest) return homeVerseRequest;
  if (homeVerseDate === today) return Promise.resolve(true);
  homeVerseRequest = fetchDailyVerse().then(ok => {
    if (ok) homeVerseDate = today;
    return ok;
  }).finally(() => { homeVerseRequest = null; });
  return homeVerseRequest;
}
async function fetchDailyVerse() {
  try {
    const diaAno = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
    );
    const { data, error } = await window.supabaseClient
      .from('verse_of_day')
      .select('text, reference')
      .order('id');

    const textEl = document.getElementById('verse-text');
    const refEl = document.getElementById('verse-ref');
    if (error) console.warn('Versículo editorial indisponível; usando Bíblia local.', error);
    const versiculo = data && data.length
      ? data[diaAno % data.length]
      : await loadDeterministicBibleVerse(diaAno);
    if (!versiculo) throw new Error('Nenhum versículo disponível na base local.');

    if (textEl) textEl.textContent = versiculo.text || '';
    if (refEl) refEl.textContent = versiculo.reference ? '— ' + versiculo.reference : '';
    trackVerseOfDayEngagement();
    return true;
  } catch (e) {
    console.error('Erro em carregarVersiculoDoDia:', e);
    const textEl = document.getElementById('verse-text');
    const refEl = document.getElementById('verse-ref');
    if (textEl) textEl.textContent = 'Não foi possível carregar o versículo agora.';
    if (refEl) refEl.textContent = '';
    return false;
  }
}

function trackVerseOfDayEngagement() {
  const card = document.querySelector('.app-verse-card');
  if (!card || card.dataset.journeyTracking === 'ready') return;
  card.dataset.journeyTracking = 'ready';

  let readingTimer = null;
  let recorded = false;
  const stopTimer = () => {
    if (readingTimer) window.clearTimeout(readingTimer);
    readingTimer = null;
  };
  const recordReading = () => {
    if (recorded || !window.ADPELJourney?.registerVerseOfDayRead) return;
    recorded = true;
    stopTimer();
    window.ADPELJourney.registerVerseOfDayRead();
  };
  const startTimer = () => {
    if (recorded || readingTimer || document.visibilityState !== 'visible') return;
    readingTimer = window.setTimeout(recordReading, 4000);
  };

  const bibleLink = card.querySelector('a[href="bible.html"]');
  if (bibleLink) bibleLink.addEventListener('click', recordReading, { once: true });

  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.65);
    if (visible) startTimer();
    else stopTimer();
  }, { threshold: [0.65] });
  observer.observe(card);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') startTimer();
    else stopTimer();
  });
}

// A single in-flight load per session; older responses cannot overwrite a newer session.
var homeLoadState = { owner: undefined, request: 0, pending: null, loadedAt: 0 };
function homeSessionId() {
  const info = getCurrentUserInfo();
  return info.isLoggedIn && info.user ? info.user.id : null;
}
function homeStatus(message, retry) {
  const status = document.getElementById('home-content-status');
  const text = document.getElementById('home-content-status-text');
  const button = document.getElementById('home-retry-button');
  if (status) status.hidden = !message;
  if (text) text.textContent = message || '';
  if (button) button.hidden = !retry;
}
function loadHomeData(force) {
  const owner = homeSessionId();
  const changed = homeLoadState.owner !== owner;
  if (!changed && homeLoadState.pending) return homeLoadState.pending;
  if (!force && !changed && Date.now() - homeLoadState.loadedAt < SECTION_LOAD_DEBOUNCE) return Promise.resolve();
  const request = ++homeLoadState.request;
  homeLoadState.owner = owner;
  if (changed) {
    homeLoadState.loadedAt = 0;
    // Clear session-specific progress and attendance immediately.
    renderContinueSection([]);
    renderHomeEvents([]);
    if (typeof renderCommunityAgenda === 'function') renderCommunityAgenda([]);
  }
  homeStatus('Atualizando conteúdo…',false);
  _lastHomeLoad = Date.now();
  const current = () => homeLoadState.request === request && homeSessionId() === owner;
  const settle = fn => Promise.resolve().then(fn);
  const publicVerse = settle(carregarVersiculoDoDia);
  const courseTask = Promise.allSettled([
    settle(() => ADPEL.fetch.courses()),
    owner ? settle(getAllLessonProgress) : Promise.resolve([])
  ]).then(results => {
    if (!current()) return false;
    if (results[0].status !== 'fulfilled') return false;
    const courses = results[0].value || [];
    const allProgress = results[1].status === 'fulfilled' ? results[1].value : [];
    const progressMap = {};
    if (Array.isArray(allProgress)) allProgress.forEach(p => {
      if (!progressMap[p.course_id]) progressMap[p.course_id] = new Set();
      progressMap[p.course_id].add(p.lesson_index);
    });
    const publishedCourses = courses.filter(c => c.is_published).filter(isContentVisibleNow);
    const homeCourses = publishedCourses.map(course => {
      const count = course.lesson_count;
      const total = count != null && Number.isInteger(Number(count)) && Number(count) >= 0
        ? Number(count) : normalizeLessons(course.lessons).length;
      const completed = Math.min(total, (progressMap[course.id] || new Set()).size);
      const status = total === 0 || completed >= total ? 'completed' : completed > 0 ? 'in-progress' : 'not-started';
      return { ...course, totalLessons: total, completedLessons: completed, status };
    });
    const inProgressCourses = homeCourses.filter(c => c.status === 'in-progress');
    const featuredCourses = homeCourses.filter(c => c.is_featured);
    renderContinueSection(inProgressCourses.slice(0, 1));
    renderFeaturedCourses(featuredCourses.slice(0, 1));
    return results[1].status === 'fulfilled';
  });
  const agendaTask = Promise.allSettled([
    settle(() => ADPEL.fetch.events()),
    settle(() => ADPEL.fetch.announcements())
  ]).then(async results => {
    if (!current()) return false;
    if (results.every(result => result.status !== 'fulfilled')) return false;
    const events = results[0].status === 'fulfilled' ? results[0].value || [] : [];
    const announcements = results[1].status === 'fulfilled' ? results[1].value || [] : [];
    const futureEvents = events.filter(isHomeEventVisible);
    const publishedAnnouncements = announcements.filter(a => a.is_published).filter(isContentVisibleNow);
    const homeAgenda = buildUnifiedAgenda(futureEvents, publishedAnnouncements);
    // Preserve real attendance counts; the agenda block is independent of courses.
    const attendances = typeof fetchAttendancesForEvents === 'function'
      ? await fetchAttendancesForEvents(homeAgenda) : await fetchAllAttendances();
    if (!current()) return false;
    const attendancesByEvent = {};
    (attendances || []).forEach(a => {
      if (!attendancesByEvent[a.event_id]) attendancesByEvent[a.event_id] = [];
      attendancesByEvent[a.event_id].push(a);
    });
    renderHomeEvents(futureEvents.slice(0, 1), attendancesByEvent);
    if (typeof renderCommunityAgenda === 'function') renderCommunityAgenda(homeAgenda, attendancesByEvent);
    return results.every(result => result.status === 'fulfilled');
  });
  const pending = Promise.allSettled([courseTask, agendaTask, publicVerse]).then(results => {
    if (!current()) return;
    const partial = results.some(result => result.status === 'rejected' || result.value === false);
    homeLoadState.loadedAt = partial ? 0 : Date.now();
    homeStatus(partial ? 'Alguns conteúdos não puderam ser atualizados.' : '',partial);
  }).finally(() => {
    if (homeLoadState.request === request) homeLoadState.pending = null;
  });
  homeLoadState.pending = pending;
  return pending;
}

Object.assign(window, {
  updateBannerWelcome,
  carregarVersiculoDoDia,
  loadHomeData,
  renderContinueSection,
  renderFeaturedCourses,
  renderReadingContinuation
});

function renderContinueSection(courses) {
  const section = document.getElementById('continue-section');
  const container = document.getElementById('continue-grid');
  if (!section || !container) return;

  if (!courses || courses.length === 0) {
    renderReadingContinuation(true);
    return;
  }

  section.classList.remove('hidden');
  const action = document.getElementById('continue-all-action');
  if (action) {
    action.textContent = 'Ver cursos';
    action.onclick = function () { navigateTo('courses'); };
  }
  container.innerHTML = courses.map(course => courseCarouselCard(course, 'Continuar')).join('');
}

function getReadingPreferences() {
  try {
    const preferences = JSON.parse(localStorage.getItem('adpel_bible_preferences_v2') || '{}');
    const book = /^[A-Z0-9]{3}$/.test(String(preferences.last_book || '')) ? preferences.last_book : '';
    const chapter = Number(preferences.last_chapter);
    if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > 150) return null;
    return { book, chapter };
  } catch (error) {
    return null;
  }
}

function renderReadingContinuation(useHomeFallback) {
  const preferences = getReadingPreferences();
  const wordContainer = document.getElementById('word-continue-reading');
  if (wordContainer) {
    wordContainer.classList.toggle('hidden', !preferences);
    wordContainer.replaceChildren();
    if (preferences) {
      const card = document.createElement('div');
      card.className = 'app-context-card';
      const label = document.createElement('p');
      label.className = 'app-context-card__label';
      label.textContent = 'Continue sua leitura';
      const title = document.createElement('h3');
      title.textContent = `Última leitura: ${preferences.book} ${preferences.chapter}`;
      const link = document.createElement('a');
      link.href = 'bible.html';
      link.className = 'app-secondary-action';
      link.textContent = 'Abrir Bíblia';
      card.append(label, title, link);
      wordContainer.append(card);
    }
  }

  if (!useHomeFallback) return;
  const section = document.getElementById('continue-section');
  const container = document.getElementById('continue-grid');
  if (!section || !container) return;
  section.classList.toggle('hidden', !preferences);
  container.replaceChildren();
  if (!preferences) return;
  const card = document.createElement('div');
  card.className = 'app-context-card';
  const label = document.createElement('p');
  label.className = 'app-context-card__label';
  label.textContent = 'Sua última leitura';
  const title = document.createElement('h3');
  title.textContent = `${preferences.book} ${preferences.chapter}`;
  const description = document.createElement('p');
  description.textContent = 'Retome o capítulo salvo na Bíblia ADPEL.';
  card.append(label, title, description);
  container.append(card);
  const action = document.getElementById('continue-all-action');
  if (action) {
    action.textContent = 'Abrir Bíblia';
    action.onclick = function () { window.location.href = 'bible.html'; };
  }
}

function renderFeaturedCourses(courses) {
  const container = document.getElementById('featured-courses');
  const section = document.getElementById('featured-courses-section');
  if (!container) return;
  if (!courses || courses.length === 0) {
    if (section) section.classList.add('hidden');
    return;
  }
  if (section) section.classList.remove('hidden');
  container.innerHTML = courses.map((course) => {
    const courseData = encodeInlineJson(course);
    return `
      <article class="app-context-card">
        <p class="app-context-card__label">${escapeHtml(course.category || 'Curso')}</p>
        <h3>${escapeHtml(course.title)}</h3>
        <p>${escapeHtml(course.description || 'Novo conteúdo disponível na área de formação.')}</p>
        <p class="mt-2 text-xs font-bold ${course.is_paid ? 'text-amber-300' : 'text-emerald-300'}">
          ${course.is_paid
            ? '<i class="fas fa-lock mr-1"></i>' + escapeHtml(typeof window.formatCoursePrice === 'function' ? window.formatCoursePrice(course.price_cents) : 'Curso pago')
            : '<i class="fas fa-unlock mr-1"></i>Gratuito'}
        </p>
        <button onclick="if(!getCurrentUserInfo().isLoggedIn){openModal('login-modal');return;} openCourseModal('${courseData}')" class="app-primary-action mt-3">Conhecer curso</button>
      </article>
  `;
  }).join('');
}
