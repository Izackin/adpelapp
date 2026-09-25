(function () {
  'use strict';

  const MAX_QUESTION_CHARS = 4000;
  const ERROR_MESSAGES = {
    AUTH_REQUIRED: 'Entre novamente para continuar usando o Tutor.',
    AUTH_INVALID: 'Entre novamente para continuar usando o Tutor.',
    HOURLY_LIMIT_REACHED: 'Você atingiu o limite de estudos deste período. Tente novamente mais tarde.',
    DAILY_LIMIT_REACHED: 'Você atingiu o limite diário do Tutor. Volte amanhã para continuar seus estudos.',
    QUESTION_REQUIRED: 'Escreva uma pergunta antes de enviar.',
    QUESTION_TOO_LONG: 'Sua pergunta ficou muito longa. Resuma um pouco e tente novamente.',
    RETRIEVAL_TEMPORARILY_UNAVAILABLE: 'Não foi possível consultar as fontes neste momento. Tente novamente.',
    TUTOR_TEMPORARILY_UNAVAILABLE: 'O Tutor está temporariamente indisponível. Tente novamente em alguns instantes.',
    REQUEST_TIMEOUT: 'A resposta está demorando mais que o esperado. Tente novamente.',
    INTERNAL_ERROR: 'Não foi possível concluir sua pergunta.'
  };
  const SOURCE_CLASS_LABELS = {
    official_local: 'Documento oficial ADPEL',
    official_denominational: 'Documento oficial CONAMAD',
    official_institutional: 'Documento institucional',
    denominational_reference: 'Referência denominacional',
    selected_theology: 'Aprofundamento teológico'
  };
  const GENERIC_SUGGESTIONS = [
    'Explique João 1:1',
    'O que a ADPEL ensina sobre os dons espirituais?',
    'Explique o batismo no Espírito Santo',
    'Compare diferentes interpretações de um tema bíblico',
    'Como posso entender melhor esta passagem?'
  ];
  const BIBLE_SUGGESTIONS = [
    'Explique este trecho',
    'Qual é o contexto?',
    'Qual é uma aplicação possível?',
    'Como a ADPEL interpreta este tema?'
  ];
  const state = {
    initialized: false,
    urlContextRead: false,
    authenticated: false,
    busy: false,
    bibleContext: null,
    history: [],
    nextId: 1
  };

  const $ = (id) => typeof document === 'undefined' ? null : document.getElementById(id);

  function friendlyError(code) {
    return ERROR_MESSAGES[String(code || '').toUpperCase()] || 'Não foi possível concluir sua pergunta.';
  }

  function sourceClassLabel(sourceClass) {
    return SOURCE_CLASS_LABELS[String(sourceClass || '').toLowerCase()] || '';
  }

  function normalizeCitationId(value) {
    const match = String(value || '').toUpperCase().match(/^[【\[]?([FB]\d+)[】\]]?$/);
    return match ? match[1] : '';
  }

  function normalizeBibleContext(value) {
    if (!value || typeof value !== 'object') return null;
    const bookId = String(value.book_id || '').toUpperCase().trim();
    const bookName = String(value.book_name || '').trim().slice(0, 80);
    const translationCode = String(value.translation_code || 'acf').toLowerCase().trim();
    const chapter = Number(value.chapter);
    const verseStart = Number(value.verse_start);
    const verseEnd = Number(value.verse_end ?? value.verse_start);
    if (!/^[A-Z0-9]{2,8}$/.test(bookId) || !bookName) return null;
    if (!/^[a-z0-9_-]{2,20}$/.test(translationCode)) return null;
    if (!Number.isInteger(chapter) || chapter < 1 || chapter > 150) return null;
    if (!Number.isInteger(verseStart) || !Number.isInteger(verseEnd) || verseStart < 1 || verseEnd < verseStart || verseEnd > 200) return null;
    return {
      book_id: bookId,
      book_name: bookName,
      chapter,
      verse_start: verseStart,
      verse_end: verseEnd,
      translation_code: translationCode
    };
  }

  function bibleReferenceLabel(context) {
    if (!context) return '';
    const range = context.verse_end > context.verse_start
      ? `${context.verse_start}–${context.verse_end}`
      : String(context.verse_start);
    return `${context.book_name} ${context.chapter}:${range} · ${context.translation_code.toUpperCase()}`;
  }

  function buildRequestBody(question, context) {
    const body = { question: String(question || '').trim() };
    const normalized = normalizeBibleContext(context);
    if (normalized) {
      body.translation_code = normalized.translation_code;
      body.bible_reference = { ...normalized };
    }
    return body;
  }

  function parseSafeBlocks(value) {
    const lines = String(value || '').replace(/\r\n?/g, '\n').split('\n');
    const blocks = [];
    let paragraph = [];
    let list = null;

    function flushParagraph() {
      if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join(' ').trim() });
      paragraph = [];
    }
    function flushList() {
      if (list && list.items.length) blocks.push(list);
      list = null;
    }

    lines.forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line) {
        flushParagraph();
        flushList();
        return;
      }
      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        flushParagraph(); flushList();
        blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
        return;
      }
      const unordered = line.match(/^[-*]\s+(.+)$/);
      const ordered = line.match(/^\d+[.)]\s+(.+)$/);
      if (unordered || ordered) {
        flushParagraph();
        const type = ordered ? 'ordered-list' : 'unordered-list';
        if (!list || list.type !== type) { flushList(); list = { type, items: [] }; }
        list.items.push((ordered || unordered)[1]);
        return;
      }
      const quote = line.match(/^>\s*(.+)$/);
      if (quote) {
        flushParagraph(); flushList();
        blocks.push({ type: 'quote', text: quote[1] });
        return;
      }
      flushList();
      paragraph.push(line);
    });
    flushParagraph();
    flushList();
    return blocks;
  }

  function appendInlineContent(parent, value, referenceTargets) {
    const text = String(value || '');
    const pattern = /(\*\*[^*\n]+\*\*|【[FB]\d+】)/g;
    let cursor = 0;
    for (const match of text.matchAll(pattern)) {
      if (match.index > cursor) parent.appendChild(document.createTextNode(text.slice(cursor, match.index)));
      const token = match[0];
      if (token.startsWith('**')) {
        const strong = document.createElement('strong');
        strong.textContent = token.slice(2, -2);
        parent.appendChild(strong);
      } else {
        const citationId = normalizeCitationId(token);
        const targetId = referenceTargets[citationId];
        if (targetId) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = `tutor-citation tutor-citation--${citationId.startsWith('B') ? 'bible' : 'source'}`;
          button.dataset.tutorSourceTarget = targetId;
          button.textContent = citationId;
          button.setAttribute('aria-label', `Ir para a fonte ${citationId}`);
          parent.appendChild(button);
        } else {
          const span = document.createElement('span');
          span.className = 'tutor-citation tutor-citation--unavailable';
          span.textContent = citationId || token;
          parent.appendChild(span);
        }
      }
      cursor = match.index + token.length;
    }
    if (cursor < text.length) parent.appendChild(document.createTextNode(text.slice(cursor)));
  }

  function renderSafeAnswer(container, answer, referenceTargets) {
    container.replaceChildren();
    parseSafeBlocks(answer).forEach((block) => {
      let element;
      if (block.type === 'heading') element = document.createElement(block.level === 1 ? 'h4' : block.level === 2 ? 'h5' : 'h6');
      else if (block.type === 'quote') element = document.createElement('blockquote');
      else if (block.type === 'ordered-list' || block.type === 'unordered-list') {
        element = document.createElement(block.type === 'ordered-list' ? 'ol' : 'ul');
        block.items.forEach((item) => {
          const li = document.createElement('li');
          appendInlineContent(li, item, referenceTargets);
          element.appendChild(li);
        });
        container.appendChild(element);
        return;
      } else element = document.createElement('p');
      appendInlineContent(element, block.text, referenceTargets);
      container.appendChild(element);
    });
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = String(text);
    return element;
  }

  function sourcePages(source) {
    const start = Number(source?.page_start);
    const end = Number(source?.page_end);
    if (!Number.isFinite(start) || start < 1) return '';
    return Number.isFinite(end) && end > start ? `p. ${start}–${end}` : `p. ${start}`;
  }

  function createSourceCard(source, responseId) {
    const citationId = normalizeCitationId(source?.id);
    if (!citationId || !citationId.startsWith('F')) return null;
    const article = createElement('article', 'tutor-source-card');
    article.id = `tutor-response-${responseId}-source-${citationId}`;
    article.tabIndex = -1;

    const heading = createElement('div', 'tutor-source-card__heading');
    heading.appendChild(createElement('span', 'tutor-source-id', citationId));
    if (source.institution) heading.appendChild(createElement('span', 'tutor-source-institution', source.institution));
    article.appendChild(heading);
    article.appendChild(createElement('h5', '', source.title || 'Fonte consultada'));

    const classification = sourceClassLabel(source.source_class);
    if (classification) article.appendChild(createElement('p', 'tutor-source-class', classification));
    const details = [source.section, source.topic, sourcePages(source)].filter(Boolean);
    if (details.length) article.appendChild(createElement('p', 'tutor-source-meta', details.join(' · ')));
    return article;
  }

  function createBibleCard(bibleSource, responseId) {
    if (!bibleSource || typeof bibleSource !== 'object') return null;
    const article = createElement('article', 'tutor-bible-source');
    article.id = `tutor-response-${responseId}-source-B1`;
    article.tabIndex = -1;
    article.appendChild(createElement('p', 'tutor-bible-source__eyebrow', 'Bíblia'));
    article.appendChild(createElement('h4', '', bibleSource.reference || 'Referência bíblica'));
    const translation = [bibleSource.translation_name, bibleSource.translation].filter(Boolean).join(' · ');
    if (translation) article.appendChild(createElement('p', 'tutor-bible-source__translation', translation));
    const verses = createElement('div', 'tutor-bible-source__verses');
    (Array.isArray(bibleSource.verses) ? bibleSource.verses : []).forEach((verse) => {
      const paragraph = document.createElement('p');
      const number = createElement('strong', '', verse?.verse ?? '');
      paragraph.appendChild(number);
      paragraph.appendChild(document.createTextNode(` ${String(verse?.text || '')}`));
      verses.appendChild(paragraph);
    });
    article.appendChild(verses);
    return article;
  }

  function createLoadingCard(item) {
    const article = createElement('article', 'tutor-study-card tutor-study-card--loading');
    article.appendChild(createElement('p', 'tutor-study-label', 'Pergunta'));
    article.appendChild(createElement('h3', 'tutor-study-question', item.question));
    const status = createElement('div', 'tutor-loading');
    status.setAttribute('role', 'status');
    const spinner = createElement('span', 'tutor-loading__spinner');
    spinner.setAttribute('aria-hidden', 'true');
    status.append(spinner, document.createTextNode('Consultando fontes...'));
    article.appendChild(status);
    return article;
  }

  function createErrorCard(item) {
    const article = createElement('article', 'tutor-study-card tutor-study-card--error');
    article.appendChild(createElement('p', 'tutor-study-label', 'Pergunta'));
    article.appendChild(createElement('h3', 'tutor-study-question', item.question));
    const error = createElement('div', 'tutor-response-error');
    error.setAttribute('role', 'alert');
    error.appendChild(createElement('i', 'fas fa-circle-exclamation'));
    error.appendChild(createElement('p', '', item.error));
    article.appendChild(error);
    return article;
  }

  function createStudyCard(item) {
    if (item.status === 'loading') return createLoadingCard(item);
    if (item.status === 'error') return createErrorCard(item);

    const article = createElement('article', 'tutor-study-card');
    article.appendChild(createElement('p', 'tutor-study-label', 'Pergunta'));
    article.appendChild(createElement('h3', 'tutor-study-question', item.question));

    const validSources = (Array.isArray(item.sources) ? item.sources : [])
      .filter((source) => normalizeCitationId(source?.id).startsWith('F'));
    const referenceTargets = {};
    validSources.forEach((source) => {
      const id = normalizeCitationId(source.id);
      referenceTargets[id] = `tutor-response-${item.id}-source-${id}`;
    });
    if (item.bibleSource) referenceTargets.B1 = `tutor-response-${item.id}-source-B1`;

    article.appendChild(createElement('p', 'tutor-study-label tutor-study-label--answer', 'Resposta'));
    const answer = createElement('div', 'tutor-answer-content');
    renderSafeAnswer(answer, item.answer, referenceTargets);
    article.appendChild(answer);

    const bibleCard = createBibleCard(item.bibleSource, item.id);
    if (bibleCard) article.appendChild(bibleCard);

    if (validSources.length) {
      const details = createElement('details', 'tutor-sources');
      const summary = createElement('summary', '', `Fontes consultadas (${validSources.length})`);
      const sourceList = createElement('div', 'tutor-source-list');
      validSources.forEach((source) => {
        const card = createSourceCard(source, item.id);
        if (card) sourceList.appendChild(card);
      });
      details.append(summary, sourceList);
      article.appendChild(details);
    }

    const actions = createElement('div', 'tutor-study-actions');
    const copy = createElement('button', 'tutor-text-action', 'Copiar resposta');
    copy.type = 'button';
    copy.dataset.tutorCopy = String(item.id);
    const again = createElement('button', 'tutor-text-action', 'Nova pergunta');
    again.type = 'button';
    again.dataset.tutorAction = 'new-question';
    actions.append(copy, again);
    article.appendChild(actions);
    return article;
  }

  function renderHistory() {
    const history = $('tutor-history');
    const empty = $('tutor-empty-state');
    if (!history || !empty) return;
    history.replaceChildren(...state.history.map(createStudyCard));
    empty.classList.toggle('hidden', state.history.length > 0);
  }

  function renderSuggestions() {
    const container = $('tutor-suggestions');
    if (!container) return;
    const suggestions = state.bibleContext ? BIBLE_SUGGESTIONS : GENERIC_SUGGESTIONS;
    container.replaceChildren(...suggestions.map((suggestion) => {
      const button = createElement('button', 'tutor-suggestion', suggestion);
      button.type = 'button';
      button.dataset.tutorSuggestion = suggestion;
      return button;
    }));
  }

  function renderBibleContext() {
    const panel = $('tutor-bible-context');
    const label = $('tutor-bible-context-label');
    const textarea = $('tutor-question');
    if (!panel || !label || !textarea) return;
    panel.classList.toggle('hidden', !state.bibleContext);
    label.textContent = bibleReferenceLabel(state.bibleContext);
    textarea.placeholder = state.bibleContext
      ? 'O que você gostaria de saber sobre este trecho?'
      : 'Pergunte sobre uma passagem, doutrina ou tema...';
    renderSuggestions();
  }

  function renderAuthState(message) {
    const gate = $('tutor-auth-gate');
    const workspace = $('tutor-workspace');
    const messageElement = $('tutor-auth-message');
    if (!gate || !workspace) return;
    gate.classList.toggle('hidden', state.authenticated);
    workspace.classList.toggle('hidden', !state.authenticated);
    if (messageElement) messageElement.textContent = message || 'Entre na sua conta para utilizar o Tutor Teológico.';
  }

  function setLiveStatus(message) {
    const live = $('tutor-live-status');
    if (live) live.textContent = message || '';
  }

  function setFormError(message) {
    const error = $('tutor-form-error');
    if (!error) return;
    error.textContent = message || '';
    error.classList.toggle('hidden', !message);
  }

  function setBusy(busy) {
    state.busy = busy;
    const button = $('tutor-submit');
    const textarea = $('tutor-question');
    if (button) {
      button.disabled = busy;
      button.classList.toggle('is-loading', busy);
      const label = button.querySelector('span');
      if (label) label.textContent = busy ? 'Consultando...' : 'Enviar';
    }
    if (textarea) textarea.readOnly = busy;
  }

  function updateCounter() {
    const textarea = $('tutor-question');
    const counter = $('tutor-counter');
    if (!textarea || !counter) return;
    const length = textarea.value.length;
    counter.textContent = `${length}/${MAX_QUESTION_CHARS}`;
    counter.classList.toggle('hidden', length < 3500);
  }

  async function hasAuthenticatedSession() {
    try {
      if (!window.supabaseClient) return false;
      const { data, error } = await window.supabaseClient.auth.getSession();
      return !error && Boolean(data?.session?.user);
    } catch (_) {
      return false;
    }
  }

  async function extractErrorCode(error, data) {
    if (data?.error) return String(data.error).toUpperCase();
    const context = error?.context;
    if (context && typeof context.json === 'function') {
      try {
        const response = typeof context.clone === 'function' ? context.clone() : context;
        const payload = await response.json();
        if (payload?.error || payload?.code) return String(payload.error || payload.code).toUpperCase();
      } catch (_) {}
    }
    const code = String(error?.code || '').toUpperCase();
    if (ERROR_MESSAGES[code]) return code;
    const message = String(error?.message || '').toUpperCase();
    if (message.includes('TIMEOUT') || message.includes('ABORT')) return 'REQUEST_TIMEOUT';
    if (message.includes('401') || message.includes('JWT')) return 'AUTH_INVALID';
    return 'INTERNAL_ERROR';
  }

  async function submitQuestion(questionOverride) {
    if (state.busy) return;
    const textarea = $('tutor-question');
    const question = String(questionOverride ?? textarea?.value ?? '').trim();
    setFormError('');
    if (!state.authenticated || !await hasAuthenticatedSession()) {
      state.authenticated = false;
      renderAuthState('Entre na sua conta para utilizar o Tutor Teológico.');
      setLiveStatus('É necessário entrar para usar o Tutor.');
      return;
    }
    if (!question) return setFormError(friendlyError('QUESTION_REQUIRED'));
    if (question.length > MAX_QUESTION_CHARS) return setFormError(friendlyError('QUESTION_TOO_LONG'));

    const item = { id: state.nextId++, question, status: 'loading' };
    state.history.push(item);
    if (textarea) textarea.value = '';
    updateCounter();
    setBusy(true);
    setLiveStatus('Consultando fontes...');
    renderHistory();
    requestAnimationFrame(() => $('tutor-history')?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'start' }));

    try {
      const { data, error } = await window.supabaseClient.functions.invoke('tutor-teologico', {
        body: buildRequestBody(question, state.bibleContext)
      });
      if (error || !data?.ok || typeof data.answer !== 'string') {
        const code = await extractErrorCode(error, data);
        item.status = 'error';
        item.error = friendlyError(code);
        if (code === 'AUTH_REQUIRED' || code === 'AUTH_INVALID') {
          state.authenticated = false;
          renderAuthState(item.error);
        }
        console.error('[Tutor] Falha na Edge Function:', code);
        setLiveStatus(item.error);
      } else {
        item.status = 'success';
        item.answer = data.answer;
        item.sources = Array.isArray(data.sources) ? data.sources : [];
        item.bibleSource = data.bible_source || null;
        setLiveStatus('Resposta pronta.');
      }
    } catch (error) {
      const code = await extractErrorCode(error, null);
      item.status = 'error';
      item.error = friendlyError(code);
      console.error('[Tutor] Falha inesperada:', code);
      setLiveStatus(item.error);
    } finally {
      setBusy(false);
      renderHistory();
    }
  }

  function cleanTutorQueryParams() {
    try {
      const url = new URL(window.location.href);
      ['tutor', 'book_id', 'book_name', 'chapter', 'verse_start', 'verse_end', 'translation_code']
        .forEach((key) => url.searchParams.delete(key));
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    } catch (_) {}
  }

  function readBibleContextFromUrl() {
    if (state.urlContextRead || typeof window === 'undefined') return;
    state.urlContextRead = true;
    const params = new URLSearchParams(window.location.search);
    if (params.get('tutor') !== '1') return;
    state.bibleContext = normalizeBibleContext({
      book_id: params.get('book_id'),
      book_name: params.get('book_name'),
      chapter: params.get('chapter'),
      verse_start: params.get('verse_start'),
      verse_end: params.get('verse_end'),
      translation_code: params.get('translation_code')
    });
  }

  function removeBibleContext() {
    state.bibleContext = null;
    cleanTutorQueryParams();
    renderBibleContext();
    $('tutor-question')?.focus();
  }

  function openWithBibleContext(context) {
    const normalized = normalizeBibleContext(context);
    if (!normalized) return false;
    state.bibleContext = normalized;
    renderBibleContext();
    if (typeof window.navigateTo === 'function' && $('tutor')) window.navigateTo('tutor');
    return true;
  }

  async function copyResponse(id) {
    const item = state.history.find((entry) => entry.id === Number(id));
    if (!item?.answer) return;
    try {
      await navigator.clipboard.writeText(item.answer);
      if (typeof window.showToast === 'function') window.showToast('Resposta copiada.', 'success');
      setLiveStatus('Resposta copiada.');
    } catch (_) {
      if (typeof window.showToast === 'function') window.showToast('Não foi possível copiar a resposta.', 'error');
      setLiveStatus('Não foi possível copiar a resposta.');
    }
  }

  function handleTutorClick(event) {
    const suggestion = event.target.closest('[data-tutor-suggestion]');
    if (suggestion && !state.busy) {
      const textarea = $('tutor-question');
      if (textarea) { textarea.value = suggestion.dataset.tutorSuggestion; updateCounter(); textarea.focus(); }
      return;
    }
    const citation = event.target.closest('[data-tutor-source-target]');
    if (citation) {
      const target = document.getElementById(citation.dataset.tutorSourceTarget);
      const details = target?.closest('details');
      if (details) details.open = true;
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target?.focus({ preventScroll: true });
      return;
    }
    const copy = event.target.closest('[data-tutor-copy]');
    if (copy) return copyResponse(copy.dataset.tutorCopy);
    const action = event.target.closest('[data-tutor-action]')?.dataset.tutorAction;
    if (action === 'back') window.navigateTo?.('word');
    if (action === 'login') (window.openLogin || (() => window.openModal?.('login-modal')))();
    if (action === 'remove-context') removeBibleContext();
    if (action === 'new-question') { $('tutor-question')?.focus(); $('tutor-composer')?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }
  }

  function init() {
    if (state.initialized || !$('tutor')) return;
    state.initialized = true;
    readBibleContextFromUrl();
    renderBibleContext();
    renderHistory();
    $('tutor')?.addEventListener('click', handleTutorClick);
    $('tutor-form')?.addEventListener('submit', (event) => { event.preventDefault(); submitQuestion(); });
    $('tutor-question')?.addEventListener('input', updateCounter);
    $('tutor-question')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.ctrlKey) { event.preventDefault(); $('tutor-form')?.requestSubmit(); }
    });
  }

  async function activate() {
    init();
    state.authenticated = await hasAuthenticatedSession();
    renderAuthState();
    renderBibleContext();
    if (state.authenticated && !state.history.length) setLiveStatus('Tutor pronto para uma nova pergunta.');
  }

  function handleAuthChange(isLoggedIn) {
    state.authenticated = Boolean(isLoggedIn);
    if (!state.authenticated) state.history = [];
    renderHistory();
    renderAuthState();
  }

  const publicApi = {
    activate,
    handleAuthChange,
    openWithBibleContext,
    submitQuestion
  };
  if (typeof window !== 'undefined') window.ADPELTutor = publicApi;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      MAX_QUESTION_CHARS,
      friendlyError,
      sourceClassLabel,
      normalizeCitationId,
      normalizeBibleContext,
      bibleReferenceLabel,
      buildRequestBody,
      parseSafeBlocks
    };
  }
})();
