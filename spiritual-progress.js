// ============================================================
// Minha Caminhada - progresso espiritual gamificado da ADPEL.
// Mantem a pontuacao no Supabase e falha de forma silenciosa
// quando a tabela ainda nao foi criada, para preservar o app.
// ============================================================

(function () {
  'use strict';

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
    { id: 'streak_7', title: '7 dias consecutivos', icon: 'fa-fire', earned: function (p) { return p.longest_streak >= 7 || p.streak_days >= 7; }, target: 7, field: 'streak_days' },
    { id: 'streak_30', title: '30 dias consecutivos', icon: 'fa-fire-flame-curved', earned: function (p) { return p.longest_streak >= 30 || p.streak_days >= 30; }, target: 30, field: 'streak_days' },
    { id: 'streak_100', title: '100 dias consecutivos', icon: 'fa-award', earned: function (p) { return p.longest_streak >= 100 || p.streak_days >= 100; }, target: 100, field: 'streak_days' }
  ];

  var currentProgressCache = null;
  var progressRequestPromise = null;
  var rankingCache = [];
  var progressTableUnavailable = false;
  var challengeTableUnavailable = false;
  var dailyChallengesCache = [];
  var dailyChallengesLoadError = null;
  var dailySummaryCache = {
    completed_count: 0,
    total_count: 0,
    day_completed: false,
    completion_xp: 0
  };

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
      courses_completed: 0,
      prayers_made: 0,
      offerings: 0,
      missions_completed: 0,
      level: 1,
      xp: 0,
      last_activity: null
    };
  }

  async function loadJourneyProfile(userId) {
    if (!userId || !window.supabaseClient) return null;
    var profileColumns = 'id, full_name, public_name, avatar_url';
    try {
      var result = await window.supabaseClient
        .from('profiles')
        .select(profileColumns)
        .eq('id', userId)
        .maybeSingle();
      if (result.error) throw result.error;
      return result.data || null;
    } catch (error) {
      console.warn('[Minha Caminhada] Nao foi possivel carregar o perfil:', error);
      return null;
    }
  }

  function applyJourneyProfile(progress, profile) {
    if (!progress || !profile) return progress;
    var avatar = profile.avatar_url || profile.photo_url || '';
    if (avatar) progress.avatar = avatar;
    progress.user_name = profile.public_name || profile.full_name || progress.user_name || 'Membro';
    return progress;
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

  function isMissingTableError(error) {
    var message = String(error && (error.message || error.details || error.code) || '').toLowerCase();
    return message.indexOf('spiritual_progress') !== -1 || message.indexOf('42p01') !== -1 || message.indexOf('does not exist') !== -1;
  }

  function isMissingChallengeTableError(error) {
    var message = String(error && (error.message || error.details || error.code) || '').toLowerCase();
    return message.indexOf('daily_challenges') !== -1 || message.indexOf('user_daily_challenges') !== -1 || message.indexOf('42p01') !== -1 || message.indexOf('does not exist') !== -1;
  }

  function getChallengeMeta(activityType) {
    var map = {
      daily_visit: { label: 'Concluída', icon: 'fa-fire' },
      verse_of_day_read: { label: 'Ver versículo', icon: 'fa-scroll' },
      bible_chapter_read: { label: 'Abrir Bíblia', icon: 'fa-book-bible' },
      hymn_opened: { label: 'Ir para Harpa', icon: 'fa-music' },
      lesson_watched: { label: 'Ver cursos', icon: 'fa-graduation-cap' },
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

  function getDailyChallengesErrorCategory(error, fallbackCategory) {
    var code = String(error && error.code || '').toLowerCase();
    var message = String(error && error.message || '').toLowerCase();
    var details = String(error && error.details || '').toLowerCase();
    var combined = code + ' ' + message + ' ' + details;

    if (Number(error && error.status) === 401 || Number(error && error.status) === 403 || code === '42501' || combined.indexOf('permission') !== -1 || combined.indexOf('not authorized') !== -1 || combined.indexOf('row-level security') !== -1 || combined.indexOf('rls') !== -1) {
      return 'RLS/permissão';
    }
    if (combined.indexOf('relationship') !== -1 || combined.indexOf('relation between') !== -1 || code === 'pgrst200' || code === 'pgrst201') {
      return 'relacionamento daily_challenges';
    }
    if (Number(error && error.status) === 0 || error && (error.name === 'TypeError' || combined.indexOf('failed to fetch') !== -1 || combined.indexOf('network') !== -1 || combined.indexOf('load failed') !== -1)) {
      return 'rede';
    }
    return fallbackCategory;
  }

  function handleDailyChallengesLoadError(stage, error, fallbackCategory) {
    var category = getDailyChallengesErrorCategory(error, fallbackCategory);
    dailyChallengesLoadError = { stage: stage, category: category };
    console.error('[Minha Caminhada] Falha nas missões diárias', {
      etapa: stage,
      categoria: category,
      code: error && error.code,
      message: error && error.message,
      details: error && error.details,
      hint: error && error.hint
    });
    return [];
  }

  async function applyMissionSnapshot(snapshot, userInfo) {
    var payload = snapshot || {};
    var progress = payload.progress || null;
    dailyChallengesCache = (payload.missions || []).map(normalizeChallenge);
    dailySummaryCache = {
      completed_count: Number(payload.completed_count) || 0,
      total_count: Number(payload.total_count) || dailyChallengesCache.length,
      day_completed: !!payload.day_completed,
      completion_xp: Number(payload.completion_xp) || 0
    };
    dailyChallengesLoadError = null;
    challengeTableUnavailable = false;

    if (!progress) return null;
    currentProgressCache = normalizeProgress(progress);
    if (userInfo && userInfo.user) {
      currentProgressCache = applyJourneyProfile(
        currentProgressCache,
        await loadJourneyProfile(userInfo.user.id)
      );
    }
    return currentProgressCache;
  }

  async function getOrCreateProgressInternal() {
    var userInfo = await resolveUserInfo();
    if (!userInfo.isLoggedIn || !userInfo.user || progressTableUnavailable || !window.supabaseClient) return null;

    try {
      var result = await window.supabaseClient.rpc('get_daily_missions');
      if (result.error) throw result.error;
      return await applyMissionSnapshot(result.data, userInfo);
    } catch (error) {
      if (isMissingTableError(error) || isMissingChallengeTableError(error)) {
        progressTableUnavailable = true;
        challengeTableUnavailable = true;
        console.warn('[Minha Caminhada] Estrutura segura de missões ainda não encontrada.');
        renderJourneyUnavailable();
        return null;
      }
      handleDailyChallengesLoadError('carregar missões', error, 'RPC get_daily_missions');
      return null;
    }
  }

  async function getOrCreateProgress() {
    if (progressRequestPromise) {
      return progressRequestPromise;
    }

    progressRequestPromise = getOrCreateProgressInternal();

    try {
      return await progressRequestPromise;
    } finally {
      progressRequestPromise = null;
    }
  }

  async function recordJourneyAction(activityType, sourceKey, options) {
    var userInfo = await resolveUserInfo();
    if (!userInfo.isLoggedIn || !userInfo.user || !window.supabaseClient) return currentProgressCache;
    var actionOptions = options || {};

    try {
      var result = await window.supabaseClient.rpc('record_journey_action', {
        action_type: activityType,
        source_key: sourceKey == null ? null : String(sourceKey)
      });
      if (result.error) throw result.error;
      var progress = await applyMissionSnapshot(result.data, userInfo);
      renderJourneyWidgets(progress);

      var reward = Number(result.data && result.data.xp_awarded) || 0;
      if (result.data && result.data.day_completed_now && typeof showToast === 'function') {
        showToast('Caminhada de hoje concluída! +' + Number(result.data.completion_xp || 0) + ' XP', 'success');
      } else if (reward > 0 && !actionOptions.silent && typeof showToast === 'function') {
        showToast('Missão concluída! +' + reward + ' XP', 'success');
      }
      return progress;
    } catch (error) {
      console.error('[Minha Caminhada] Não foi possível registrar a ação:', {
        activityType: activityType,
        code: error && error.code,
        message: error && error.message
      });
      return currentProgressCache;
    }
  }

  function registerDailyVisit() {
    return recordJourneyAction('daily_visit', null, { silent: true });
  }

  function registerVerseOfDayRead() {
    return recordJourneyAction('verse_of_day_read');
  }

  function registerBibleRead() {
    return recordJourneyAction('bible_open', null, { silent: true });
  }

  function registerChapterRead(bookId, chapter) {
    return recordJourneyAction('bible_chapter_read', String(bookId || '') + ':' + String(chapter || ''));
  }

  function registerBookCompleted(bookId) {
    return recordJourneyAction('bible_book_completed', String(bookId || ''));
  }

  function registerHymnOpened() {
    return recordJourneyAction('hymn_opened');
  }

  function registerCourseCompleted(courseId) {
    return recordJourneyAction('course_completed', String(courseId || ''));
  }

  function registerLessonWatched(courseId, lessonIndex) {
    return recordJourneyAction('lesson_watched', String(courseId || '') + ':' + String(lessonIndex));
  }

  function registerOffering() {
    return recordJourneyAction('offering_made');
  }

  function registerSpiritualActivity(activityType) {
    if (activityType === 'offering_made') return registerOffering();
    return currentProgressCache;
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
      var rows = (result.data || []).map(normalizeProgress);
      var userIds = rows.map(function (item) { return item.user_id; }).filter(Boolean);
      var profileMap = {};

      if (userIds.length) {
        try {
          var profilesResult = await window.supabaseClient
            .from('public_profiles')
            .select('id, full_name, public_name, avatar_url, bio, ministry, show_public_profile, show_in_ranking')
            .in('id', userIds);
          if (profilesResult.error) throw profilesResult.error;
          (profilesResult.data || []).forEach(function (profile) {
            profileMap[profile.id] = profile;
          });
        } catch (profileError) {
          var text = String(profileError && (profileError.message || profileError.details || profileError.code) || '').toLowerCase();
          var missingProfileColumns = text.indexOf('public_name') !== -1 || text.indexOf('avatar_url') !== -1 || text.indexOf('bio') !== -1 || text.indexOf('ministry') !== -1 || text.indexOf('show_public_profile') !== -1 || text.indexOf('show_in_ranking') !== -1 || text.indexOf('42703') !== -1 || text.indexOf('pgrst204') !== -1;
          if (missingProfileColumns) {
            try {
              var fallbackProfiles = await window.supabaseClient
                .from('public_profiles')
                .select('id, full_name')
                .in('id', userIds);
              if (!fallbackProfiles.error) {
                (fallbackProfiles.data || []).forEach(function (profile) {
                  profileMap[profile.id] = profile;
                });
              }
            } catch (fallbackError) {
              console.warn('[Minha Caminhada] Perfis indisponiveis para ranking:', fallbackError);
            }
          } else {
            console.warn('[Minha Caminhada] Nao foi possivel enriquecer ranking com perfis:', profileError);
          }
        }
      }

      rankingCache = rows.map(function (item) {
        var profile = profileMap[item.user_id] || {};
        return Object.assign({}, item, {
          public_name: profile.public_name || '',
          avatar_url: profile.avatar_url || item.avatar || '',
          bio: profile.bio || '',
          ministry: profile.ministry || '',
          show_public_profile: profile.show_public_profile,
          show_in_ranking: profile.show_in_ranking,
          user_name: profile.public_name || profile.full_name || item.user_name || 'Membro'
        });
      }).filter(function (item) {
        return item.show_in_ranking !== false;
      });
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
      card.innerHTML = '<div class="journey-empty-note text-center">Sua caminhada espiritual estará disponível em breve.</div>';
    }
  }

  function renderJourneyWidgets(progress) {
    renderJourneyCardPremium(progress);
    renderJourneyProfilePremium(progress);
    renderMedalsPremium(progress);
    renderDailyChallengesPremium(progress ? dailyChallengesCache : []);
  }

  function goToChallengeTarget(activityType) {
    if (activityType === 'verse_of_day_read') {
      if (typeof navigateTo === 'function') {
        navigateTo('home');
        setTimeout(function () {
          var verse = document.querySelector('.app-verse-card');
          if (verse) verse.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      } else {
        window.location.href = 'index.html#home';
      }
      return;
    }
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
    if (activityType === 'offering_made') {
      if (typeof openOfertaModal === 'function') openOfertaModal();
      else window.location.href = 'index.html#home';
    }
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
      var avatar = safeImageUrl(item.avatar_url || item.avatar || '');
      var initials = String(item.user_name || 'M').trim().charAt(0).toUpperCase();
      var click = item.user_id ? ' onclick="openPublicProfile(&quot;' + escapeHtml(item.user_id) + '&quot;)"' : '';
      var medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : String(index + 1);
      return [
        '<div class="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 cursor-pointer hover:border-emerald-200 hover:shadow-md transition"' + click + '>',
          '<div class="w-10 text-center text-xl font-bold text-gray-700">' + medal + '</div>',
          '<div class="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center overflow-hidden shrink-0 font-bold">',
            avatar ? '<img src="' + escapeHtml(avatar) + '" alt="' + escapeHtml(item.user_name || 'Membro') + '" class="w-full h-full object-cover">' : escapeHtml(initials),
          '</div>',
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

  function renderDailyChallengesPremium(challenges) {
    var container = document.getElementById('daily-challenges-content');
    if (!container) return;
    if (dailyChallengesLoadError) {
      container.innerHTML = '<div class="journey-empty-note">Não foi possível carregar suas missões agora. Tente novamente.</div>';
      return;
    }
    if (challengeTableUnavailable) {
      container.innerHTML = '<div class="journey-empty-note">Suas missões diárias estarão disponíveis em breve.</div>';
      return;
    }
    if (challenges === null) {
      container.innerHTML = '<div class="journey-empty-note">Suas missões diárias estarão disponíveis em breve.</div>';
      return;
    }
    var list = (challenges || dailyChallengesCache || []).slice(0, 4);
    if (!list.length) {
      container.innerHTML = '<div class="journey-empty-note">Nenhuma missão ativa para seu nível hoje.</div>';
      return;
    }

    container.innerHTML = list.map(function (challenge) {
      var percent = Math.min(100, Math.round((challenge.current_count / challenge.target_count) * 100));
      var meta = getChallengeMeta(challenge.activity_type);
      var button = challenge.completed
        ? '<button disabled class="journey-challenge-action is-done"><i class="fas fa-check"></i> Concluída</button>'
        : '<button onclick="ADPELJourney.goToChallengeTarget(&quot;' + escapeHtml(challenge.activity_type) + '&quot;)" class="journey-challenge-action"><i class="fas fa-arrow-right"></i> ' + escapeHtml(meta.label) + '</button>';
      return [
        '<article class="journey-challenge-card ' + (challenge.completed ? 'is-completed' : '') + '">',
          '<div class="journey-challenge-icon"><i class="fas ' + escapeHtml(challenge.icon || meta.icon) + '"></i></div>',
          '<div class="journey-challenge-main">',
            '<div class="journey-challenge-head">',
              '<div class="min-w-0">',
                '<h4>' + escapeHtml(challenge.title) + '</h4>',
                challenge.description ? '<p>' + escapeHtml(challenge.description) + '</p>' : '',
              '</div>',
              button,
            '</div>',
            '<div class="journey-challenge-progress">',
              '<div class="journey-progress-track"><div class="journey-progress-fill" style="width:' + percent + '%"></div></div>',
              '<span>' + challenge.current_count + '/' + challenge.target_count + '</span>',
            '</div>',
            '<div class="journey-challenge-reward"><i class="fas fa-star"></i> +' + challenge.xp_reward + ' XP</div>',
          '</div>',
        '</article>'
      ].join('');
    }).join('');
  }

  function renderJourneyCardPremium(progress) {
    var container = document.getElementById('journey-card-content');
    if (!container) return;
    var userInfo = getUserInfo();
    if (!userInfo.isLoggedIn) {
      container.innerHTML = '<div class="journey-empty-note text-center"><p>Entre para acompanhar sua caminhada espiritual.</p><button onclick="openModal(&quot;login-modal&quot;)" class="journey-challenge-action mt-3">Entrar</button></div>';
      return;
    }

    var safeProgress = normalizeProgress(progress || currentProgressCache);
    var level = getLevelInfo(safeProgress.xp);
    var nextMedal = getNextMedal(safeProgress);
    var avatar = safeImageUrl(safeProgress.avatar || '');
    var initials = String(safeProgress.user_name || 'M').trim().charAt(0).toUpperCase();
    var currentXp = Number(safeProgress.xp) || 0;
    var progressPoints = level.next ? currentXp + ' de ' + level.next.minXp + ' pontos' : currentXp + ' pontos';
    var progressStatus = level.next ? level.progressPercent + '% para o próximo nível' : 'Nível máximo alcançado';
    var completedCount = Number(dailySummaryCache.completed_count) || 0;
    var totalCount = Number(dailySummaryCache.total_count) || dailyChallengesCache.length;
    var dailyPercent = totalCount ? Math.min(100, Math.round((completedCount / totalCount) * 100)) : 0;
    var remaining = Math.max(0, totalCount - completedCount);
    var dailyMessage = dailySummaryCache.day_completed
      ? 'Você cumpriu todas as missões e preservou sua sequência.'
      : remaining === 1
        ? 'Falta apenas uma missão para completar sua caminhada de hoje.'
        : remaining > 1
          ? 'Faltam ' + remaining + ' missões para concluir o dia.'
          : 'Suas missões estão sendo preparadas.';
    var completionPanel = dailySummaryCache.day_completed
      ? [
          '<div class="journey-completion-card">',
            '<div class="journey-completion-icon"><i class="fas fa-check"></i></div>',
            '<div><p class="app-eyebrow">Dia concluído</p><h4>Caminhada de hoje concluída</h4><span>+' + dailySummaryCache.completion_xp + ' XP recebidos · ' + safeProgress.streak_days + ' dia' + (Number(safeProgress.streak_days) === 1 ? '' : 's') + ' de sequência</span></div>',
          '</div>'
        ].join('')
      : '';

    container.innerHTML = [
      '<div class="journey-shell">',
        '<section class="journey-daily-section journey-daily-section--primary">',
          '<div class="journey-section-head">',
            '<div><p class="app-eyebrow">Hoje</p><h3>Sua caminhada de hoje</h3></div>',
            '<strong class="journey-today-count">' + completedCount + ' de ' + totalCount + '</strong>',
          '</div>',
          '<div class="journey-today-progress" aria-label="' + dailyPercent + '% das missões concluídas">',
            '<div class="journey-progress-track"><div class="journey-progress-fill" style="width:' + dailyPercent + '%"></div></div>',
            '<span>' + dailyPercent + '%</span>',
          '</div>',
          '<p class="journey-today-message">' + escapeHtml(dailyMessage) + '</p>',
          completionPanel,
          '<div id="daily-challenges-content" class="journey-challenges-list">',
            '<div class="journey-empty-note">Carregando missões diárias...</div>',
          '</div>',
        '</section>',
        '<section class="journey-hero-card">',
          '<div class="journey-member-row">',
            '<div class="journey-avatar">',
              avatar ? '<img src="' + escapeHtml(avatar) + '" alt="' + escapeHtml(safeProgress.user_name || 'Perfil') + '">' : escapeHtml(initials),
            '</div>',
            '<div class="min-w-0">',
              '<strong>' + escapeHtml(safeProgress.user_name || 'Membro') + '</strong>',
              '<span class="journey-level-pill">Nível ' + level.level + ' · ' + escapeHtml(level.title) + '</span>',
            '</div>',
          '</div>',
          '<div class="journey-hero-copy">',
            '<p class="app-eyebrow">Minha Caminhada</p>',
            '<h3>Seu progresso nasce das ações de cada dia</h3>',
          '</div>',
        '</section>',
        '<div class="journey-stats-grid">',
          '<div class="journey-stat-card"><i class="fas fa-fire"></i><strong>' + safeProgress.streak_days + '</strong><span>Sequência</span><small>dias concluídos</small></div>',
          '<div class="journey-stat-card"><i class="fas fa-seedling"></i><strong>' + safeProgress.xp + '</strong><span>XP</span><small>ações validadas</small></div>',
          '<div class="journey-stat-card"><i class="fas fa-layer-group"></i><strong>' + level.level + '</strong><span>' + escapeHtml(level.title) + '</span><small>nível atual</small></div>',
        '</div>',
        '<section class="journey-progress-card">',
          '<div class="journey-progress-summary"><strong>' + escapeHtml(progressPoints) + '</strong><span>' + escapeHtml(progressStatus) + '</span></div>',
          '<div class="journey-progress-track"><div class="journey-progress-fill" style="width:' + level.progressPercent + '%"></div></div>',
          '<div class="journey-next-medal"><span>Próxima medalha</span><strong>' + escapeHtml(nextMedal ? nextMedal.title : 'Todas conquistadas') + '</strong></div>',
        '</section>',
        '<button onclick="navigateTo(&quot;ranking&quot;)" class="journey-secondary-action"><i class="fas fa-ranking-star"></i> Ver ranking e conquistas</button>',
      '</div>'
    ].join('');
  }

  function renderJourneyProfilePremium(progress) {
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
      '<div class="journey-stats-grid">',
        '<div class="journey-stat-card"><i class="fas fa-layer-group"></i><strong>' + level.level + '</strong><span>' + escapeHtml(level.title) + '</span></div>',
        '<div class="journey-stat-card"><i class="fas fa-seedling"></i><strong>' + safeProgress.total_points + '</strong><span>Pontos</span></div>',
        '<div class="journey-stat-card"><i class="fas fa-fire"></i><strong>' + safeProgress.streak_days + '</strong><span>Sequência</span></div>',
        '<div class="journey-stat-card"><i class="fas fa-chart-line"></i><strong>' + level.progressPercent + '%</strong><span>Evolução</span></div>',
      '</div>'
    ].join('');
  }

  function renderMedalsPremium(progress) {
    var container = document.getElementById('medals-grid');
    if (!container) return;
    if (!getUserInfo().isLoggedIn) {
      container.innerHTML = '';
      return;
    }
    var medals = getEarnedMedals(progress || currentProgressCache || {});
    container.innerHTML = medals.map(function (medal) {
      return [
        '<article class="journey-medal-card ' + (medal.earned ? 'is-earned' : '') + '">',
          '<div class="journey-medal-icon"><i class="fas ' + medal.icon + '"></i></div>',
          '<h4>' + escapeHtml(medal.title) + '</h4>',
          '<p>' + (medal.earned ? 'Conquistada' : 'Em andamento') + '</p>',
          medal.target ? '<div class="journey-progress-track"><div class="journey-progress-fill" style="width:' + medal.percent + '%"></div></div>' : '',
        '</article>'
      ].join('');
    }).join('');
  }

  async function renderRankingPremium() {
    var container = document.getElementById('ranking-list');
    if (!container) return;
    container.innerHTML = '<div class="journey-empty-note text-center">Carregando ranking...</div>';
    var ranking = await getRanking();
    if (!ranking.length) {
      container.innerHTML = '<div class="journey-empty-note text-center">Ranking ainda não disponível.</div>';
      return;
    }
    var userInfo = getUserInfo();

    container.innerHTML = ranking.map(function (item, index) {
      var level = getLevelInfo(item.xp);
      var avatar = safeImageUrl(item.avatar_url || item.avatar || '');
      var initials = String(item.user_name || 'M').trim().charAt(0).toUpperCase();
      var click = item.user_id ? ' onclick="openPublicProfile(&quot;' + escapeHtml(item.user_id) + '&quot;)"' : '';
      var medal = index === 0 ? '1' : index === 1 ? '2' : index === 2 ? '3' : String(index + 1);
      var current = userInfo.user && userInfo.user.id === item.user_id;
      return [
        '<article class="journey-ranking-item rank-' + (index + 1) + ' ' + (current ? 'is-current-user' : '') + '"' + click + '>',
          '<div class="journey-ranking-position">' + medal + '</div>',
          '<div class="journey-avatar">',
            avatar ? '<img src="' + escapeHtml(avatar) + '" alt="' + escapeHtml(item.user_name || 'Membro') + '">' : escapeHtml(initials),
          '</div>',
          '<div class="journey-ranking-copy">',
            '<h4>' + escapeHtml(item.user_name || 'Membro') + '</h4>',
            '<p>Nível ' + level.level + ' · ' + escapeHtml(level.title) + '</p>',
          '</div>',
          '<div class="journey-ranking-score">',
            '<strong>' + item.total_points + '</strong>',
            '<span>' + item.streak_days + ' dias</span>',
          '</div>',
        '</article>'
      ].join('');
    }).join('');
  }

  async function initJourney() {
    var progress = await getOrCreateProgress();
    if (!progress) {
      renderJourneyWidgets(null);
      return;
    }
    await registerDailyVisit();
  }

  window.ADPELJourney = {
    LEVELS: LEVELS,
    MEDALS: MEDALS,
    init: initJourney,
    renderJourneyWidgets: renderJourneyWidgets,
    renderRanking: renderRankingPremium,
    renderDailyChallenges: renderDailyChallengesPremium,
    goToChallengeTarget: goToChallengeTarget,
    recordAction: recordJourneyAction,
    registerDailyVisit: registerDailyVisit,
    registerVerseOfDayRead: registerVerseOfDayRead,
    registerBibleRead: registerBibleRead,
    registerChapterRead: registerChapterRead,
    registerBookCompleted: registerBookCompleted,
    registerCourseCompleted: registerCourseCompleted,
    registerLessonWatched: registerLessonWatched,
    registerOffering: registerOffering,
    registerSpiritualActivity: registerSpiritualActivity,
    registerHymnOpened: registerHymnOpened,
    getRanking: getRanking,
    getLevelInfo: getLevelInfo,
    getEarnedMedals: getEarnedMedals
  };

  window.registerVerseOfDayRead = registerVerseOfDayRead;
  window.registerBibleRead = registerBibleRead;
  window.registerChapterRead = registerChapterRead;
  window.registerBookCompleted = registerBookCompleted;
  window.registerCourseCompleted = registerCourseCompleted;
  window.registerLessonWatched = registerLessonWatched;
  window.registerOffering = registerOffering;
  window.registerSpiritualActivity = registerSpiritualActivity;
  window.getRanking = getRanking;
})();
