// ============================================================
// Minha Caminhada - progresso espiritual gamificado da ADPEL.
// Mantem a pontuacao no Supabase e falha de forma silenciosa
// quando a tabela ainda nao foi criada, para preservar o app.
// ============================================================

(function () {
  'use strict';

  var XP_ACTIONS = {
    bible_open: 2,
    chapter_read: 5,
    book_completed: 50,
    hymn_opened: 1,
    lesson_watched: 0,
    study_completed: 20,
    course_completed: 50,
    offering: 10,
    mission: 25
  };

  var LEVELS = [
    { level: 1, title: 'Discípulo', minXp: 0 },
    { level: 2, title: 'Servo', minXp: 100 },
    { level: 3, title: 'Obreiro', minXp: 250 },
    { level: 4, title: 'Evangelista', minXp: 500 },
    { level: 5, title: 'Cooperador', minXp: 850 },
    { level: 6, title: 'Diácono', minXp: 1300 },
    { level: 7, title: 'Presbítero', minXp: 1850 },
    { level: 8, title: 'Missionário', minXp: 2500 },
    { level: 9, title: 'Pastor', minXp: 3300 },
    { level: 10, title: 'Exemplo para o Rebanho', minXp: 4300 }
  ];

  var MEDALS = [
    { id: 'first_read', title: 'Primeira Leitura', icon: 'fa-book-bible', earned: function (p) { return p.bible_reads >= 1 || p.bible_chapters >= 1; } },
    { id: 'chapters_10', title: '10 capítulos', icon: 'fa-list-ol', earned: function (p) { return p.bible_chapters >= 10; }, target: 10, field: 'bible_chapters' },
    { id: 'chapters_100', title: '100 capítulos', icon: 'fa-book-open-reader', earned: function (p) { return p.bible_chapters >= 100; }, target: 100, field: 'bible_chapters' },
    { id: 'first_course', title: 'Primeiro Curso', icon: 'fa-graduation-cap', earned: function (p) { return p.courses_completed >= 1; } },
    { id: 'first_study', title: 'Primeiro Estudo', icon: 'fa-book-open', earned: function (p) { return p.studies_completed >= 1; } },
    { id: 'streak_7', title: '7 dias consecutivos', icon: 'fa-fire', earned: function (p) { return p.longest_streak >= 7 || p.streak_days >= 7; }, target: 7, field: 'streak_days' },
    { id: 'streak_30', title: '30 dias consecutivos', icon: 'fa-fire-flame-curved', earned: function (p) { return p.longest_streak >= 30 || p.streak_days >= 30; }, target: 30, field: 'streak_days' },
    { id: 'streak_100', title: '100 dias consecutivos', icon: 'fa-award', earned: function (p) { return p.longest_streak >= 100 || p.streak_days >= 100; }, target: 100, field: 'streak_days' }
  ];

  var ACTION_TO_ACTIVITY = {
    chapter_read: 'bible_chapter_read',
    hymn_opened: 'hymn_opened',
    lesson_watched: 'lesson_watched',
    study_completed: 'study_completed',
    offering: 'offering_made'
  };

  var currentProgressCache = null;
  var rankingCache = [];
  var progressTableUnavailable = false;
  var challengeTableUnavailable = false;
  var dailyChallengesCache = [];
  var eventMemory = {};

  function getUserInfo() {
    if (typeof getCurrentUserInfo !== 'function') return { isLoggedIn: false };
    return getCurrentUserInfo();
  }

  async function resolveUserInfo() {
    var existing = getUserInfo();
    if (existing.isLoggedIn && existing.user) return existing;
    if (!window.ADPEL || !window.ADPEL.auth || typeof window.ADPEL.auth.getSession !== 'function') {
      return existing;
    }

    try {
      var session = await window.ADPEL.auth.getSession();
      if (!session || !session.user) return existing;
      return {
        isLoggedIn: true,
        user: session.user,
        profile: {
          full_name: session.user.user_metadata && session.user.user_metadata.full_name
        },
        isMaster: false
      };
    } catch (error) {
      return existing;
    }
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function dateKey(date) {
    if (!date) return '';
    return String(date).slice(0, 10);
  }

  function daysBetween(a, b) {
    var first = new Date(a + 'T00:00:00');
    var second = new Date(b + 'T00:00:00');
    return Math.round((second.getTime() - first.getTime()) / 86400000);
  }

  function defaultProgress(userInfo) {
    var profile = userInfo.profile || {};
    var user = userInfo.user || {};
    return {
      user_id: user.id,
      user_name: profile.full_name || user.email || 'Membro',
      avatar: profile.avatar_url || profile.avatar || '',
      church_id: profile.church_id || null,
      total_points: 0,
      streak_days: 0,
      longest_streak: 0,
      bible_reads: 0,
      bible_chapters: 0,
      bible_books: 0,
      hymns_opened: 0,
      studies_completed: 0,
      courses_completed: 0,
      prayers_made: 0,
      offerings: 0,
      missions_completed: 0,
      level: 1,
      xp: 0,
      last_activity: null
    };
  }

  function normalizeProgress(progress) {
    var userInfo = getUserInfo();
    var base = defaultProgress(userInfo);
    return Object.assign(base, progress || {});
  }

  function getLevelInfo(xp) {
    var safeXp = Number(xp) || 0;
    var current = LEVELS[0];
    for (var i = 0; i < LEVELS.length; i++) {
      if (safeXp >= LEVELS[i].minXp) current = LEVELS[i];
    }
    var next = LEVELS.find(function (item) { return item.minXp > safeXp; }) || null;
    return {
      level: current.level,
      title: current.title,
      next: next,
      progressPercent: next ? Math.min(100, Math.round(((safeXp - current.minXp) / (next.minXp - current.minXp)) * 100)) : 100,
      remainingXp: next ? Math.max(0, next.minXp - safeXp) : 0
    };
  }

  function updateLevel(progress) {
    var info = getLevelInfo(progress.xp);
    progress.level = info.level;
    return progress;
  }

  function updateStreak(progress) {
    var today = todayKey();
    var last = dateKey(progress.last_activity);
    if (!last) {
      progress.streak_days = Math.max(1, Number(progress.streak_days) || 0);
    } else {
      var gap = daysBetween(last, today);
      if (gap === 1) {
        progress.streak_days = (Number(progress.streak_days) || 0) + 1;
      } else if (gap > 1) {
        progress.streak_days = 1;
      }
    }
    progress.last_activity = today;
    progress.longest_streak = Math.max(Number(progress.longest_streak) || 0, Number(progress.streak_days) || 0);
    return progress;
  }

  function updateXP(progress, amount) {
    var points = Number(amount) || 0;
    progress.xp = (Number(progress.xp) || 0) + points;
    progress.total_points = (Number(progress.total_points) || 0) + points;
    return updateLevel(progress);
  }

  function isMissingTableError(error) {
    var message = String(error && (error.message || error.details || error.code) || '').toLowerCase();
    return message.indexOf('spiritual_progress') !== -1 || message.indexOf('42p01') !== -1 || message.indexOf('does not exist') !== -1;
  }

  function isMissingChallengeTableError(error) {
    var message = String(error && (error.message || error.details || error.code) || '').toLowerCase();
    return message.indexOf('daily_challenges') !== -1 || message.indexOf('user_daily_challenges') !== -1 || message.indexOf('42p01') !== -1 || message.indexOf('does not exist') !== -1;
  }

  function hashString(value) {
    var hash = 0;
    var input = String(value || '');
    for (var i = 0; i < input.length; i++) {
      hash = ((hash << 5) - hash) + input.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function pickDailyChallenges(challenges, progress) {
    var seed = todayKey() + '_' + (progress.user_id || '') + '_' + (progress.level || 1);
    return (challenges || []).slice().sort(function (a, b) {
      return hashString(seed + '_' + a.id) - hashString(seed + '_' + b.id);
    }).slice(0, 3);
  }

  function getChallengeMeta(activityType) {
    var map = {
      bible_chapter_read: { label: 'Ir para Biblia', icon: 'fa-book-bible' },
      hymn_opened: { label: 'Ir para Harpa', icon: 'fa-music' },
      lesson_watched: { label: 'Ir para Cursos', icon: 'fa-graduation-cap' },
      study_completed: { label: 'Ir para Cursos', icon: 'fa-graduation-cap' },
      offering_made: { label: 'Ir para Ofertas', icon: 'fa-hand-holding-heart' }
    };
    return map[activityType] || { label: 'Ir para', icon: 'fa-arrow-right' };
  }

  function normalizeChallenge(row) {
    var challenge = row && (row.daily_challenges || row.challenge || row);
    challenge = challenge || {};
    return {
      id: row.id,
      challenge_id: row.challenge_id || challenge.id,
      title: challenge.title || 'Desafio diario',
      description: challenge.description || '',
      activity_type: challenge.activity_type || row.activity_type || '',
      icon: challenge.icon || getChallengeMeta(challenge.activity_type || row.activity_type).icon,
      xp_reward: Number(challenge.xp_reward) || 0,
      current_count: Number(row.current_count) || 0,
      target_count: Number(row.target_count || challenge.target_count) || 1,
      completed: !!row.completed,
      reward_claimed: !!row.reward_claimed
    };
  }

  async function getDailyChallenges(progress) {
    if (!progress || !window.supabaseClient || challengeTableUnavailable) return [];
    var today = todayKey();
    try {
      var existing = await window.supabaseClient
        .from('user_daily_challenges')
        .select('*, daily_challenges(*)')
        .eq('user_id', progress.user_id)
        .eq('challenge_date', today)
        .order('created_at', { ascending: true });

      if (existing.error) throw existing.error;
      var rows = (existing.data || []).slice(0, 3);
      if (rows.length >= 3) {
        dailyChallengesCache = rows.map(normalizeChallenge);
        return dailyChallengesCache;
      }

      var available = await window.supabaseClient
        .from('daily_challenges')
        .select('*')
        .eq('is_active', true)
        .lte('level_min', Number(progress.level) || 1)
        .gte('level_max', Number(progress.level) || 1);

      if (available.error) throw available.error;

      var existingIds = rows.map(function (row) { return row.challenge_id; });
      var missingPool = (available.data || []).filter(function (item) {
        return existingIds.indexOf(item.id) === -1;
      });
      var picked = pickDailyChallenges(missingPool, progress).slice(0, Math.max(0, 3 - rows.length));

      if (picked.length) {
        var inserts = picked.map(function (challenge) {
          return {
            user_id: progress.user_id,
            challenge_id: challenge.id,
            challenge_date: today,
            current_count: 0,
            target_count: Number(challenge.target_count) || 1,
            completed: false,
            reward_claimed: false
          };
        });
        var insert = await window.supabaseClient
          .from('user_daily_challenges')
          .insert(inserts);
        if (insert.error) throw insert.error;
        return getDailyChallenges(progress);
      }

      dailyChallengesCache = rows.map(normalizeChallenge);
      return dailyChallengesCache;
    } catch (error) {
      if (isMissingChallengeTableError(error)) {
        challengeTableUnavailable = true;
        renderDailyChallenges(null);
        return [];
      }
      console.error('[Minha Caminhada] Erro ao carregar desafios diarios:', error);
      return [];
    }
  }

  async function recordChallengeProgress(progress, activityType, count) {
    if (!progress || !activityType || challengeTableUnavailable || !window.supabaseClient) return progress;
    var challenges = await getDailyChallenges(progress);
    var matching = challenges.filter(function (challenge) {
      return challenge.activity_type === activityType && !challenge.completed;
    });
    if (!matching.length) return progress;

    var reward = 0;
    for (var i = 0; i < matching.length; i++) {
      var challenge = matching[i];
      var nextCount = Math.min(challenge.target_count, challenge.current_count + (Number(count) || 1));
      var completedNow = nextCount >= challenge.target_count;
      var shouldReward = completedNow && !challenge.reward_claimed;
      var update = await window.supabaseClient
        .from('user_daily_challenges')
        .update({
          current_count: nextCount,
          completed: completedNow,
          reward_claimed: challenge.reward_claimed || shouldReward,
          completed_at: completedNow ? new Date().toISOString() : null
        })
        .eq('id', challenge.id)
        .eq('user_id', progress.user_id)
        .select('*, daily_challenges(*)')
        .single();

      if (update.error) {
        if (isMissingChallengeTableError(update.error)) challengeTableUnavailable = true;
        console.error('[Minha Caminhada] Erro ao atualizar desafio:', update.error);
        continue;
      }
      if (shouldReward) reward += challenge.xp_reward;
    }

    if (reward > 0) {
      progress = updateXP(progress, reward);
      progress = await saveProgress(progress);
      if (typeof showToast === 'function') showToast('Desafio concluido! +' + reward + ' XP', 'success');
    }

    dailyChallengesCache = await getDailyChallenges(progress || currentProgressCache);
    renderDailyChallenges(dailyChallengesCache);
    return progress || currentProgressCache;
  }

  async function getOrCreateProgress() {
    var userInfo = await resolveUserInfo();
    if (!userInfo.isLoggedIn || !userInfo.user || progressTableUnavailable || !window.supabaseClient) return null;

    var user = userInfo.user;
    try {
      var result = await window.supabaseClient
        .from('spiritual_progress')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (result.error) throw result.error;
      if (result.data) {
        currentProgressCache = normalizeProgress(result.data);
        return currentProgressCache;
      }

      var newProgress = defaultProgress(userInfo);
      var insert = await window.supabaseClient
        .from('spiritual_progress')
        .insert([newProgress])
        .select('*')
        .single();

      if (insert.error) throw insert.error;
      currentProgressCache = normalizeProgress(insert.data);
      return currentProgressCache;
    } catch (error) {
      if (isMissingTableError(error)) {
        progressTableUnavailable = true;
        console.warn('[Minha Caminhada] Tabela spiritual_progress ainda nao encontrada.');
        renderJourneyUnavailable();
        return null;
      }
      console.error('[Minha Caminhada] Erro ao carregar progresso:', error);
      return null;
    }
  }

  async function saveProgress(progress) {
    if (!progress || !window.supabaseClient || progressTableUnavailable) return null;
    progress.updated_at = new Date().toISOString();

    try {
      var update = await window.supabaseClient
        .from('spiritual_progress')
        .update(progress)
        .eq('user_id', progress.user_id)
        .select('*')
        .single();

      if (update.error) throw update.error;
      currentProgressCache = normalizeProgress(update.data);
      renderJourneyWidgets(currentProgressCache);
      return currentProgressCache;
    } catch (error) {
      if (isMissingTableError(error)) progressTableUnavailable = true;
      console.error('[Minha Caminhada] Erro ao salvar progresso:', error);
      return null;
    }
  }

  function oncePerDay(key) {
    var userInfo = getUserInfo();
    var userId = userInfo.user && userInfo.user.id ? userInfo.user.id : 'anon';
    var storageKey = 'adpel_journey_' + userId + '_' + key;
    var today = todayKey();
    if (localStorage.getItem(storageKey) === today) return false;
    localStorage.setItem(storageKey, today);
    return true;
  }

  function rememberEvent(key) {
    var userInfo = getUserInfo();
    var userId = userInfo.user && userInfo.user.id ? userInfo.user.id : 'anon';
    var storageKey = 'adpel_journey_event_' + userId + '_' + key;
    if (eventMemory[storageKey] || localStorage.getItem(storageKey)) return false;
    eventMemory[storageKey] = true;
    localStorage.setItem(storageKey, '1');
    return true;
  }

  function rememberDailyEvent(key) {
    var userInfo = getUserInfo();
    var userId = userInfo.user && userInfo.user.id ? userInfo.user.id : 'anon';
    var storageKey = 'adpel_journey_daily_event_' + userId + '_' + key;
    var today = todayKey();
    if (localStorage.getItem(storageKey) === today) return false;
    localStorage.setItem(storageKey, today);
    return true;
  }

  async function applyProgress(action, options) {
    options = options || {};
    var progress = await getOrCreateProgress();
    if (!progress) return null;

    var shouldApplyBaseProgress = !options.uniqueKey || rememberEvent(options.uniqueKey);
    var saved = progress;

    if (shouldApplyBaseProgress) {
      progress = updateStreak(progress);
      progress = updateXP(progress, XP_ACTIONS[action] || 0);

      if (options.counter) {
        progress[options.counter] = (Number(progress[options.counter]) || 0) + (options.count || 1);
      }

      saved = await saveProgress(progress);
    }

    var activityType = ACTION_TO_ACTIVITY[action];
    var challengeKey = action + '_' + (options.uniqueKey || 'daily');
    if (activityType && rememberDailyEvent(challengeKey)) {
      return recordChallengeProgress(saved || progress, activityType, options.count || 1);
    }
    return saved;
  }

  async function registerBibleRead() {
    if (!oncePerDay('bible_open')) return currentProgressCache;
    return applyProgress('bible_open', { counter: 'bible_reads' });
  }

  async function registerChapterRead(book, chapter) {
    return applyProgress('chapter_read', {
      counter: 'bible_chapters',
      uniqueKey: 'chapter_' + String(book || '').toLowerCase() + '_' + String(chapter || '')
    });
  }

  async function registerBookCompleted(book) {
    return applyProgress('book_completed', {
      counter: 'bible_books',
      uniqueKey: 'book_' + String(book || '').toLowerCase()
    });
  }

  async function registerHymnOpened() {
    if (!oncePerDay('hymn_opened')) return currentProgressCache;
    return applyProgress('hymn_opened', { counter: 'hymns_opened' });
  }

  async function registerStudyCompleted(studyId) {
    return applyProgress('study_completed', {
      counter: 'studies_completed',
      uniqueKey: 'study_' + String(studyId || todayKey())
    });
  }

  async function registerCourseCompleted(courseId) {
    return applyProgress('course_completed', {
      counter: 'courses_completed',
      uniqueKey: 'course_' + String(courseId || todayKey())
    });
  }

  async function registerLessonWatched(courseId, lessonIndex) {
    return applyProgress('lesson_watched', {
      uniqueKey: 'lesson_' + String(courseId || 'course') + '_' + String(lessonIndex || 0)
    });
  }

  async function registerOffering() {
    return applyProgress('offering', { counter: 'offerings' });
  }

  async function registerSpiritualActivity(activityType) {
    if (activityType === 'offering_made') return registerOffering();
    return currentProgressCache;
  }

  async function registerChallengeProgress(activityType, count) {
    var progress = await getOrCreateProgress();
    if (!progress) return null;
    return recordChallengeProgress(progress, activityType, count || 1);
  }

  async function registerMission() {
    if (!oncePerDay('mission')) return currentProgressCache;
    return applyProgress('mission', { counter: 'missions_completed' });
  }

  async function completeDailyMission() {
    var before = currentProgressCache ? Number(currentProgressCache.missions_completed) || 0 : 0;
    var progress = await registerMission();
    var after = progress ? Number(progress.missions_completed) || 0 : before;
    if (typeof showToast === 'function') {
      showToast(after > before ? 'Missão diária registrada!' : 'Missão diária já registrada hoje.', after > before ? 'success' : 'info');
    }
  }

  async function getRanking() {
    if (!window.supabaseClient || progressTableUnavailable) return [];
    try {
      var result = await window.supabaseClient
        .from('spiritual_progress')
        .select('*')
        .order('total_points', { ascending: false })
        .limit(50);
      if (result.error) throw result.error;
      rankingCache = (result.data || []).map(normalizeProgress);
      return rankingCache;
    } catch (error) {
      if (isMissingTableError(error)) progressTableUnavailable = true;
      console.error('[Minha Caminhada] Erro ao carregar ranking:', error);
      return [];
    }
  }

  function getEarnedMedals(progress) {
    var safeProgress = normalizeProgress(progress || currentProgressCache || {});
    return MEDALS.map(function (medal) {
      var earned = medal.earned(safeProgress);
      var current = medal.field ? Number(safeProgress[medal.field]) || 0 : earned ? 1 : 0;
      return Object.assign({}, medal, {
        earned: earned,
        current: current,
        percent: medal.target ? Math.min(100, Math.round((current / medal.target) * 100)) : earned ? 100 : 0
      });
    });
  }

  function getNextMedal(progress) {
    return getEarnedMedals(progress).find(function (medal) { return !medal.earned; }) || null;
  }

  function renderJourneyUnavailable() {
    var card = document.getElementById('journey-card-content');
    if (card) {
      card.innerHTML = '<div class="text-center py-6"><p class="text-sm text-gray-500">Minha Caminhada sera ativada apos criar a tabela no Supabase.</p></div>';
    }
  }

  function renderJourneyWidgets(progress) {
    renderJourneyCard(progress);
    renderJourneyProfile(progress);
    renderMedals(progress);
    if (progress) {
      getDailyChallenges(progress).then(renderDailyChallenges);
    } else {
      renderDailyChallenges([]);
    }
  }

  function renderDailyChallenges(challenges) {
    var container = document.getElementById('daily-challenges-content');
    if (!container) return;
    if (challengeTableUnavailable) {
      container.innerHTML = '<div class="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">Desafios diarios serao ativados apos criar as tabelas no Supabase.</div>';
      return;
    }
    if (challenges === null) {
      container.innerHTML = '<div class="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">Desafios diarios ainda nao disponiveis.</div>';
      return;
    }
    var list = (challenges || dailyChallengesCache || []).slice(0, 3);
    if (!list.length) {
      container.innerHTML = '<div class="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">Nenhum desafio ativo para seu nivel hoje.</div>';
      return;
    }

    container.innerHTML = list.map(function (challenge) {
      var percent = Math.min(100, Math.round((challenge.current_count / challenge.target_count) * 100));
      var meta = getChallengeMeta(challenge.activity_type);
      var button = challenge.completed
        ? '<button disabled class="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-default inline-flex items-center gap-1"><i class="fas fa-check"></i> Concluido</button>'
        : '<button onclick="ADPELJourney.goToChallengeTarget(&quot;' + escapeHtml(challenge.activity_type) + '&quot;)" class="px-3 py-2 rounded-lg bg-adpel-700 text-white text-xs font-bold hover:bg-adpel-800 transition inline-flex items-center gap-1"><i class="fas fa-arrow-right"></i> ' + escapeHtml(meta.label) + '</button>';
      return [
        '<div class="border rounded-xl p-3 shadow-sm ' + (challenge.completed ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200') + '">',
          '<div class="flex items-start gap-3">',
            '<div class="w-10 h-10 rounded-xl ' + (challenge.completed ? 'bg-emerald-600 text-white' : 'bg-adpel-700 text-white') + ' flex items-center justify-center shrink-0 shadow-sm">',
              '<i class="fas ' + escapeHtml(challenge.icon || meta.icon) + '"></i>',
            '</div>',
            '<div class="flex-1 min-w-0">',
              '<div class="flex items-start justify-between gap-3">',
                '<div class="min-w-0">',
                  '<h4 class="font-bold text-gray-900 text-sm leading-snug">' + escapeHtml(challenge.title) + '</h4>',
                  challenge.description ? '<p class="text-xs text-gray-600 mt-1 leading-relaxed">' + escapeHtml(challenge.description) + '</p>' : '',
                '</div>',
                button,
              '</div>',
              '<div class="mt-3 flex items-center gap-3">',
                '<div class="flex-1 h-2.5 rounded-full bg-gray-200 overflow-hidden"><div class="h-full ' + (challenge.completed ? 'bg-emerald-600' : 'bg-adpel-700') + ' rounded-full" style="width:' + percent + '%"></div></div>',
                '<span class="text-xs font-bold text-gray-700 whitespace-nowrap">' + challenge.current_count + '/' + challenge.target_count + '</span>',
              '</div>',
              '<p class="text-xs text-emerald-700 font-bold mt-2"><i class="fas fa-star mr-1"></i>+' + challenge.xp_reward + ' XP</p>',
            '</div>',
          '</div>',
        '</div>'
      ].join('');
    }).join('');
  }

  function goToChallengeTarget(activityType) {
    if (activityType === 'bible_chapter_read') {
      if (typeof navigateTo === 'function') {
        navigateTo('bible');
        if (typeof abrirBiblia === 'function') setTimeout(abrirBiblia, 150);
        return;
      }
      window.location.href = 'index.html#bible';
      return;
    }
    if (activityType === 'hymn_opened') {
      window.location.href = 'harpa.html';
      return;
    }
    if (activityType === 'lesson_watched') {
      if (typeof navigateTo === 'function') navigateTo('courses');
      else window.location.href = 'index.html#courses';
      return;
    }
    if (activityType === 'study_completed') {
      if (typeof navigateTo === 'function') navigateTo('courses');
      else window.location.href = 'index.html#courses';
      return;
    }
    if (activityType === 'offering_made') {
      if (typeof openOfertaModal === 'function') openOfertaModal();
      else window.location.href = 'index.html#home';
    }
  }

  function renderJourneyCard(progress) {
    var container = document.getElementById('journey-card-content');
    if (!container) return;
    var userInfo = getUserInfo();
    if (!userInfo.isLoggedIn) {
      container.innerHTML = '<div class="text-center py-6"><p class="text-sm text-gray-500 mb-4">Entre para acompanhar sua caminhada espiritual.</p><button onclick="openModal(&quot;login-modal&quot;)" class="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition">Entrar</button></div>';
      return;
    }

    var safeProgress = normalizeProgress(progress || currentProgressCache);
    var level = getLevelInfo(safeProgress.xp);
    var nextMedal = getNextMedal(safeProgress);
    var avatar = safeProgress.avatar;
    var initials = String(safeProgress.user_name || 'M').trim().charAt(0).toUpperCase();

    container.innerHTML = [
      '<div class="flex items-center gap-4">',
        '<div class="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center overflow-hidden font-bold text-xl">',
          avatar ? '<img src="' + escapeHtml(avatar) + '" alt="' + escapeHtml(safeProgress.user_name || 'Perfil') + '" class="w-full h-full object-cover">' : initials,
        '</div>',
        '<div class="min-w-0 flex-1">',
          '<p class="text-sm text-gray-500">Minha Caminhada</p>',
          '<h3 class="text-lg font-bold text-gray-800 truncate">' + escapeHtml(safeProgress.user_name || 'Membro') + '</h3>',
          '<p class="text-sm text-emerald-600 font-semibold">Nível ' + level.level + ' - ' + escapeHtml(level.title) + '</p>',
        '</div>',
      '</div>',
      '<div class="mt-4 grid grid-cols-3 gap-3 text-center">',
        '<div class="bg-gray-50 rounded-lg p-3"><p class="text-xl font-bold text-gray-800">' + safeProgress.xp + '</p><p class="text-xs text-gray-500">XP</p></div>',
        '<div class="bg-gray-50 rounded-lg p-3"><p class="text-xl font-bold text-gray-800">' + safeProgress.streak_days + '</p><p class="text-xs text-gray-500">Sequência</p></div>',
        '<div class="bg-gray-50 rounded-lg p-3"><p class="text-xl font-bold text-gray-800">' + safeProgress.total_points + '</p><p class="text-xs text-gray-500">Pontos</p></div>',
      '</div>',
      '<div class="mt-4">',
        '<div class="flex justify-between text-xs text-gray-500 mb-1"><span>Progresso do nível</span><span>' + level.progressPercent + '%</span></div>',
        '<div class="h-2 rounded-full bg-gray-100 overflow-hidden"><div class="h-full bg-emerald-500 rounded-full" style="width:' + level.progressPercent + '%"></div></div>',
      '</div>',
      '<div class="mt-4 flex items-center justify-between gap-3 text-sm">',
        '<span class="text-gray-500">Próxima medalha</span>',
        '<span class="font-semibold text-gray-800 text-right">' + escapeHtml(nextMedal ? nextMedal.title : 'Todas conquistadas') + '</span>',
      '</div>',
      '<div class="mt-5 pt-4 border-t border-gray-100">',
        '<div class="flex items-center justify-between mb-3">',
          '<h3 class="font-bold text-gray-800 text-sm">Desafios de hoje</h3>',
          '<span class="text-xs text-gray-500">max. 3</span>',
        '</div>',
        '<div id="daily-challenges-content" class="space-y-3">',
          '<div class="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">Carregando desafios diarios...</div>',
        '</div>',
      '</div>',
      '<div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">',
        '<button onclick="ADPELJourney.completeDailyMission()" class="w-full py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition">Missão diária</button>',
        '<button onclick="navigateTo(&quot;ranking&quot;)" class="w-full py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-200 transition">Ver Ranking</button>',
      '</div>'
    ].join('');
  }

  function renderJourneyProfile(progress) {
    var container = document.getElementById('profile-journey-content');
    if (!container) return;
    var userInfo = getUserInfo();
    if (!userInfo.isLoggedIn) {
      container.innerHTML = '';
      return;
    }
    var safeProgress = normalizeProgress(progress || currentProgressCache);
    var level = getLevelInfo(safeProgress.xp);
    container.innerHTML = [
      '<div class="grid grid-cols-2 md:grid-cols-4 gap-4">',
        metricCard('Nível', level.level + ' - ' + level.title),
        metricCard('XP', safeProgress.xp),
        metricCard('Sequência', safeProgress.streak_days + ' dia' + (safeProgress.streak_days !== 1 ? 's' : '')),
        metricCard('Pontos', safeProgress.total_points),
      '</div>'
    ].join('');
  }

  function metricCard(label, value) {
    return '<div class="text-center p-4 bg-gray-50 rounded-xl"><p class="text-xl font-bold text-gray-800">' + escapeHtml(value) + '</p><p class="text-xs text-gray-500">' + escapeHtml(label) + '</p></div>';
  }

  function renderMedals(progress) {
    var container = document.getElementById('medals-grid');
    if (!container) return;
    if (!getUserInfo().isLoggedIn) {
      container.innerHTML = '';
      return;
    }
    var medals = getEarnedMedals(progress || currentProgressCache || {});
    container.innerHTML = medals.map(function (medal) {
      return [
        '<div class="bg-white rounded-xl border ' + (medal.earned ? 'border-emerald-200' : 'border-gray-100 opacity-70') + ' p-4">',
          '<div class="w-10 h-10 rounded-full ' + (medal.earned ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400') + ' flex items-center justify-center mb-3">',
            '<i class="fas ' + medal.icon + '"></i>',
          '</div>',
          '<h4 class="font-bold text-gray-800 text-sm">' + escapeHtml(medal.title) + '</h4>',
          '<p class="text-xs text-gray-500 mt-1">' + (medal.earned ? 'Conquistada' : 'Em andamento') + '</p>',
        '</div>'
      ].join('');
    }).join('');
  }

  async function renderRanking() {
    var container = document.getElementById('ranking-list');
    if (!container) return;
    container.innerHTML = '<div class="text-center py-8 text-gray-500">Carregando ranking...</div>';
    var ranking = await getRanking();
    if (!ranking.length) {
      container.innerHTML = '<div class="text-center py-8 text-gray-500">Ranking ainda não disponível.</div>';
      return;
    }

    container.innerHTML = ranking.map(function (item, index) {
      var level = getLevelInfo(item.xp);
      var medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : String(index + 1);
      return [
        '<div class="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">',
          '<div class="w-10 text-center text-xl font-bold text-gray-700">' + medal + '</div>',
          '<div class="flex-1 min-w-0">',
            '<h4 class="font-bold text-gray-800 truncate">' + escapeHtml(item.user_name || 'Membro') + '</h4>',
            '<p class="text-xs text-gray-500">Nível ' + level.level + ' - ' + escapeHtml(level.title) + '</p>',
          '</div>',
          '<div class="text-right">',
            '<p class="font-bold text-gray-800">' + item.total_points + '</p>',
            '<p class="text-xs text-gray-500">' + item.streak_days + ' dias</p>',
          '</div>',
        '</div>'
      ].join('');
    }).join('');
  }

  async function initJourney() {
    var progress = await getOrCreateProgress();
    renderJourneyWidgets(progress);
  }

  window.ADPELJourney = {
    XP_ACTIONS: XP_ACTIONS,
    LEVELS: LEVELS,
    MEDALS: MEDALS,
    init: initJourney,
    renderJourneyWidgets: renderJourneyWidgets,
    renderRanking: renderRanking,
    renderDailyChallenges: renderDailyChallenges,
    goToChallengeTarget: goToChallengeTarget,
    registerBibleRead: registerBibleRead,
    registerChapterRead: registerChapterRead,
    registerBookCompleted: registerBookCompleted,
    registerStudyCompleted: registerStudyCompleted,
    registerCourseCompleted: registerCourseCompleted,
    registerLessonWatched: registerLessonWatched,
    registerOffering: registerOffering,
    registerSpiritualActivity: registerSpiritualActivity,
    registerChallengeProgress: registerChallengeProgress,
    registerMission: registerMission,
    completeDailyMission: completeDailyMission,
    registerHymnOpened: registerHymnOpened,
    updateXP: updateXP,
    updateLevel: updateLevel,
    updateStreak: updateStreak,
    getRanking: getRanking,
    getLevelInfo: getLevelInfo,
    getEarnedMedals: getEarnedMedals
  };

  window.registerBibleRead = registerBibleRead;
  window.registerChapterRead = registerChapterRead;
  window.registerBookCompleted = registerBookCompleted;
  window.registerStudyCompleted = registerStudyCompleted;
  window.registerCourseCompleted = registerCourseCompleted;
  window.registerLessonWatched = registerLessonWatched;
  window.registerOffering = registerOffering;
  window.registerSpiritualActivity = registerSpiritualActivity;
  window.registerChallengeProgress = registerChallengeProgress;
  window.registerMission = registerMission;
  window.updateXP = updateXP;
  window.updateLevel = updateLevel;
  window.updateStreak = updateStreak;
  window.getRanking = getRanking;
})();
