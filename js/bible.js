(function () {
  'use strict';

  const STORAGE_KEY = 'adpel_bible_preferences_v2';
  const COLORS = ['yellow', 'green', 'blue', 'pink'];
  const state = {
    books: [], translations: [], book: null, chapter: 1, translation: null,
    verses: [], selection: null, selectionAnchor: null, user: null,
    highlights: [], notes: [], bookmarks: [], progress: new Map(),
    preferences: { translation_code: 'acf', font_size: 18, last_book: null, last_chapter: null, last_verse: null }
  };

  const $ = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value == null ? '' : value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  const normalize = (value) => String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const clampFontSize = (value) => Math.min(26, Math.max(14, Number(value) || 18));
  const makeReferenceLabel = (bookName, chapter, start, end = start) =>
    `${bookName} ${chapter}:${start}${end > start ? `–${end}` : ''}`;

  function parseReference(term, books = state.books) {
    const match = String(term || '').trim().match(/^(.+?)\s+(\d+)(?::(\d+)(?:\s*[-–]\s*(\d+))?)?$/u);
    if (!match) return null;
    const requested = normalize(match[1]);
    const book = books.find((item) => [item.id, item.name_pt, ...(item.aliases || [])]
      .some((alias) => normalize(alias) === requested));
    if (!book) return null;
    const chapter = Number(match[2]);
    const verseStart = match[3] ? Number(match[3]) : null;
    const verseEnd = match[4] ? Number(match[4]) : verseStart;
    if (chapter < 1 || chapter > book.chapter_count || (verseStart !== null && verseStart < 1)) return null;
    return { book, chapter, verseStart, verseEnd };
  }

  function buildSelectionPayload(selection = state.selection, verses = state.verses) {
    if (!selection) return null;
    return {
      translation_code: state.translation?.code || 'acf',
      book_id: selection.book_id,
      book_name: selection.book_name,
      chapter: selection.chapter,
      verse_start: selection.verse_start,
      verse_end: selection.verse_end,
      text: verses.filter((verse) => verse.verse >= selection.verse_start && verse.verse <= selection.verse_end)
        .map((verse) => verse.text).join(' ')
    };
  }

  function client() {
    if (!window.supabaseClient) throw new Error('Supabase indisponível.');
    return window.supabaseClient;
  }

  function showMessage(message, type = 'info') {
    if (typeof window.showToast === 'function') return window.showToast(message, type);
    let toast = $('bible-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'bible-toast';
      toast.className = 'bible-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.dataset.type = type;
    toast.classList.add('visible');
    clearTimeout(showMessage.timer);
    showMessage.timer = setTimeout(() => toast.classList.remove('visible'), 3500);
  }

  async function resolveUser() {
    try {
      const { data } = await client().auth.getSession();
      state.user = data?.session?.user || null;
    } catch (_) { state.user = null; }
    return state.user;
  }

  async function requireUser() {
    if (state.user) return true;
    if (await resolveUser()) {
      await loadPreferences();
      await loadPersonalData();
      await loadPersonalChapterData();
      return true;
    }
    showMessage('Entre na ADPEL para salvar seu estudo e progresso.', 'info');
    if (typeof window.openModal === 'function' && $('login-modal')) window.openModal('login-modal');
    else $('bible-auth-invite')?.classList.add('visible');
    return false;
  }

  function localPreferences() {
    try { return { ...state.preferences, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
    catch (_) { return { ...state.preferences }; }
  }

  async function loadPreferences() {
    state.preferences = localPreferences();
    if (!state.user) return;
    const { data, error } = await client().from('user_bible_preferences').select('*').eq('user_id', state.user.id).maybeSingle();
    if (!error && data) state.preferences = { ...state.preferences, ...data };
  }

  async function savePreferences(patch) {
    state.preferences = { ...state.preferences, ...patch, font_size: clampFontSize(patch.font_size ?? state.preferences.font_size) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      translation_code: state.preferences.translation_code,
      font_size: state.preferences.font_size,
      last_book: state.preferences.last_book,
      last_chapter: state.preferences.last_chapter,
      last_verse: state.preferences.last_verse
    }));
    applyFontSize();
    if (!state.user) return;
    const payload = {
      user_id: state.user.id,
      translation_code: state.preferences.translation_code,
      font_size: state.preferences.font_size,
      last_book: state.preferences.last_book,
      last_chapter: state.preferences.last_chapter,
      last_verse: state.preferences.last_verse
    };
    const { error } = await client().from('user_bible_preferences').upsert(payload, { onConflict: 'user_id' });
    if (error) console.error('Não foi possível sincronizar preferências bíblicas:', error.message);
  }

  function applyFontSize() {
    const content = $('bible-verses-content');
    if (content) content.style.setProperty('--bible-font-size', `${clampFontSize(state.preferences.font_size)}px`);
    const label = $('bible-font-size-label');
    if (label) label.textContent = `${clampFontSize(state.preferences.font_size)}px`;
  }

  function ensureExperienceUI() {
    const reader = $('bible-reader') || document.querySelector('main');
    if (!reader || $('bible-experience-actions')) return;
    const toolbar = $('bible-book-select')?.closest('.flex.flex-col') || $('bible-book-select')?.parentElement?.parentElement;
    const actions = document.createElement('div');
    actions.id = 'bible-experience-actions';
    actions.className = 'bible-experience-actions';
    actions.innerHTML = `
      <select id="bible-translation-select" aria-label="Tradução bíblica"></select>
      <div class="bible-font-controls" aria-label="Tamanho do texto">
        <button type="button" data-bible-action="font-down" aria-label="Diminuir fonte">A−</button>
        <span id="bible-font-size-label">18px</span>
        <button type="button" data-bible-action="font-up" aria-label="Aumentar fonte">A+</button>
      </div>
      <button type="button" data-bible-action="library-notes"><i class="fas fa-note-sticky"></i><span>Minhas notas</span></button>
      <button type="button" data-bible-action="library-bookmarks"><i class="fas fa-bookmark"></i><span>Favoritos</span></button>
      <button type="button" data-bible-action="rights"><i class="fas fa-circle-info"></i><span>Versões e direitos</span></button>`;
    (toolbar || reader).appendChild(actions);

    const page = $('bible-page');
    if (page) {
      const info = document.createElement('div');
      info.id = 'bible-personal-status';
      info.className = 'bible-personal-status';
      info.innerHTML = `
        <button id="bible-continue-card" type="button" class="bible-continue-card hidden"></button>
        <div id="bible-progress-summary" class="bible-progress-summary">Entre para acompanhar sua leitura.</div>
        <button id="bible-read-toggle" type="button" class="bible-read-toggle"><i class="far fa-circle-check"></i> Marcar capítulo como lido</button>`;
      page.insertBefore(info, page.firstChild);
    }

    document.body.insertAdjacentHTML('beforeend', `
      <div id="bible-selection-menu" class="bible-sheet" role="dialog" aria-modal="true" aria-label="Ações da seleção">
        <div class="bible-sheet-handle"></div><strong id="bible-selection-label"></strong>
        <div id="bible-highlight-colors" class="bible-color-row hidden">${COLORS.map((color) => `<button data-highlight-color="${color}" class="bible-color-${color}" aria-label="Destaque ${color}"></button>`).join('')}<button data-bible-action="remove-highlight">Remover</button></div>
        <div class="bible-sheet-actions"><button data-bible-action="highlight"><i class="fas fa-highlighter"></i> Destacar</button><button data-bible-action="note"><i class="fas fa-note-sticky"></i> Nota</button><button data-bible-action="bookmark"><i class="far fa-bookmark"></i> Favoritar</button><button data-bible-action="share"><i class="fas fa-share-nodes"></i> Compartilhar</button></div>
        <button class="bible-sheet-close" data-bible-action="clear-selection">Fechar</button>
      </div>
      <div id="bible-modal-backdrop" class="bible-modal-backdrop hidden"></div>
      <section id="bible-note-modal" class="bible-modal hidden" role="dialog" aria-modal="true" aria-labelledby="bible-note-title">
        <h3 id="bible-note-title">Nota bíblica</h3><p id="bible-note-reference"></p>
        <textarea id="bible-note-content" maxlength="5000" rows="8" placeholder="Escreva sua reflexão pessoal..."></textarea>
        <div class="bible-modal-actions"><button data-bible-action="delete-note" class="danger">Excluir</button><button data-bible-action="close-modal">Cancelar</button><button data-bible-action="save-note" class="primary">Salvar</button></div>
      </section>
      <section id="bible-library-modal" class="bible-modal bible-library-modal hidden" role="dialog" aria-modal="true" aria-labelledby="bible-library-title">
        <div class="bible-modal-heading"><h3 id="bible-library-title">Meu estudo bíblico</h3><button data-bible-action="close-modal" aria-label="Fechar">×</button></div>
        <input id="bible-library-search" type="search" placeholder="Buscar nas referências e notas">
        <div id="bible-library-list" class="bible-library-list"></div>
      </section>
      <section id="bible-rights-modal" class="bible-modal hidden" role="dialog" aria-modal="true" aria-labelledby="bible-rights-title">
        <div class="bible-modal-heading"><h3 id="bible-rights-title">Versões e direitos</h3><button data-bible-action="close-modal" aria-label="Fechar">×</button></div>
        <div id="bible-rights-list" class="bible-rights-list"></div>
      </section>
      <div id="bible-auth-invite" class="bible-sheet"><strong>Salve seu estudo</strong><p>Entre na ADPEL para sincronizar notas, destaques, favoritos e progresso.</p><a href="index.html#bible">Ir para o login</a><button class="bible-sheet-close" data-bible-action="close-auth">Continuar lendo</button></div>`);
  }

  async function loadCatalog() {
    const [{ data: books, error: booksError }, { data: translations, error: translationsError }] = await Promise.all([
      client().from('bible_books').select('id,name_pt,testament,book_order,chapter_count,aliases').order('book_order'),
      client().from('bible_translations').select('*').eq('is_active', true).order('is_default', { ascending: false }).order('name')
    ]);
    if (booksError || translationsError) throw booksError || translationsError;
    state.books = books || [];
    state.translations = translations || [];
    state.translation = state.translations.find((item) => item.code === state.preferences.translation_code)
      || state.translations.find((item) => item.code === 'acf') || state.translations[0];
    state.book = state.books.find((item) => item.id === state.preferences.last_book) || state.books[0];
    state.chapter = Math.min(Number(state.preferences.last_chapter) || 1, state.book?.chapter_count || 1);
    renderCatalog();
  }

  function renderCatalog() {
    const bookSelect = $('bible-book-select');
    if (bookSelect) {
      bookSelect.innerHTML = state.books.map((book) => `<option value="${book.id}">${escapeHtml(book.name_pt)}</option>`).join('');
      bookSelect.value = state.book?.id || '';
    }
    const translationSelect = $('bible-translation-select');
    if (translationSelect) {
      translationSelect.innerHTML = state.translations.map((item) => `<option value="${escapeHtml(item.code)}">${escapeHtml(item.short_name)} · ${escapeHtml(item.name)}</option>`).join('');
      translationSelect.value = state.translation?.code || 'acf';
    }
    renderChapterButtons();
    renderRights();
    renderContinueCard();
    applyFontSize();
  }

  function renderChapterButtons() {
    const container = $('bible-chapter-selector');
    if (!container || !state.book) return;
    container.innerHTML = Array.from({ length: state.book.chapter_count }, (_, index) => {
      const chapter = index + 1;
      const read = state.progress.get(`${state.book.id}:${chapter}`)?.is_read;
      return `<button type="button" class="chapter-btn${chapter === state.chapter ? ' active' : ''}${read ? ' read' : ''}" data-chapter="${chapter}" aria-label="Capítulo ${chapter}${read ? ', lido' : ''}">${chapter}</button>`;
    }).join('');
  }

  function renderContinueCard() {
    const card = $('bible-continue-card');
    if (!card || !state.preferences.last_book || !state.preferences.last_chapter) return;
    const book = state.books.find((item) => item.id === state.preferences.last_book);
    if (!book) return;
    card.textContent = `Continuar em ${book.name_pt} ${state.preferences.last_chapter}`;
    card.classList.remove('hidden');
    card.dataset.book = book.id;
    card.dataset.chapter = String(state.preferences.last_chapter);
  }

  async function fetchLocalChapter() {
    return client().from('bible_verses').select('book_id,chapter,verse,text')
      .eq('translation_id', state.translation.id).eq('book_id', state.book.id)
      .eq('chapter', state.chapter).eq('is_canonical', true).order('verse');
  }

  async function fetchExternalChapter() {
    const adapter = window.ADPELBibleProviders?.[state.translation.provider];
    if (!adapter?.getChapter) throw new Error('Esta versão ainda não possui um provedor configurado.');
    return { data: await adapter.getChapter({ translation: state.translation, book: state.book, chapter: state.chapter }), error: null };
  }

  async function loadChapter(bookRef = state.book?.id, chapter = state.chapter, verseToFocus = null) {
    const book = state.books.find((item) => item.id === bookRef || item.name_pt === bookRef);
    if (!book) return;
    state.book = book;
    state.chapter = Math.min(Math.max(1, Number(chapter) || 1), book.chapter_count);
    clearSelection();
    $('bible-page-loading')?.classList.remove('hidden');
    $('bible-page')?.classList.remove('hidden');
    $('bible-search-results')?.classList.add('hidden');
    try {
      const { data, error } = state.translation.source_type === 'local' ? await fetchLocalChapter() : await fetchExternalChapter();
      if (error) throw error;
      state.verses = data || [];
      renderChapter();
      await loadPersonalChapterData();
      await savePreferences({ translation_code: state.translation.code, last_book: book.id, last_chapter: state.chapter, last_verse: verseToFocus });
      if (verseToFocus) focusVerse(verseToFocus);
    } catch (error) {
      console.error('Erro ao carregar capítulo:', error);
      if ($('bible-verses-content')) $('bible-verses-content').innerHTML = `<p class="bible-error-message">${escapeHtml(error.message || 'Erro ao carregar capítulo.')}</p>`;
    } finally { $('bible-page-loading')?.classList.add('hidden'); }
  }

  function renderChapter() {
    if ($('bible-current-book')) $('bible-current-book').textContent = state.book.name_pt;
    if ($('bible-current-chapter')) $('bible-current-chapter').textContent = `Capítulo ${state.chapter} · ${state.translation.short_name}`;
    const content = $('bible-verses-content');
    if (content) content.innerHTML = state.verses.length ? state.verses.map((verse) =>
      `<button type="button" class="bible-verse" data-verse="${verse.verse}" aria-pressed="false"><sup>${verse.verse}</sup><span>${escapeHtml(verse.text)}</span></button>`
    ).join('') : '<p class="bible-empty-message">Nenhum versículo disponível neste capítulo.</p>';
    if ($('bible-book-select')) $('bible-book-select').value = state.book.id;
    const previous = $('btn-capitulo-ant');
    const next = $('btn-capitulo-prox');
    if (previous) previous.disabled = state.chapter <= 1;
    if (next) next.disabled = state.chapter >= state.book.chapter_count;
    renderChapterButtons();
    renderProgress();
  }

  async function loadPersonalData() {
    if (!state.user) return;
    const { data, error } = await client().from('bible_reading_progress').select('book_id,chapter,is_read,first_read_at');
    if (!error) state.progress = new Map((data || []).map((item) => [`${item.book_id}:${item.chapter}`, item]));
    renderProgress();
  }

  async function loadPersonalChapterData() {
    if (!state.user) { state.highlights = []; state.notes = []; state.bookmarks = []; renderAnnotations(); return; }
    const filter = (query) => query.eq('book_id', state.book.id).eq('chapter', state.chapter);
    const [highlights, notes, bookmarks] = await Promise.all([
      filter(client().from('bible_highlights').select('*')),
      filter(client().from('bible_notes').select('*')),
      filter(client().from('bible_bookmarks').select('*'))
    ]);
    state.highlights = highlights.data || [];
    state.notes = notes.data || [];
    state.bookmarks = bookmarks.data || [];
    renderAnnotations();
  }

  function renderAnnotations() {
    document.querySelectorAll('.bible-verse').forEach((element) => {
      const number = Number(element.dataset.verse);
      const highlight = state.highlights.find((item) => number >= item.verse_start && number <= item.verse_end);
      element.dataset.highlight = highlight?.color || '';
      element.classList.toggle('has-note', state.notes.some((item) => number >= item.verse_start && number <= item.verse_end));
      element.classList.toggle('bookmarked', state.bookmarks.some((item) => number >= item.verse_start && number <= item.verse_end));
    });
  }

  function selectVerse(number) {
    if (!state.selectionAnchor) state.selectionAnchor = number;
    else if (number === state.selectionAnchor && state.selection?.verse_start === number && state.selection?.verse_end === number) {
      clearSelection(); return;
    }
    const start = Math.min(state.selectionAnchor, number);
    const end = Math.max(state.selectionAnchor, number);
    state.selection = { book_id: state.book.id, book_name: state.book.name_pt, chapter: state.chapter, verse_start: start, verse_end: end };
    document.querySelectorAll('.bible-verse').forEach((element) => {
      const selected = Number(element.dataset.verse) >= start && Number(element.dataset.verse) <= end;
      element.classList.toggle('selected', selected);
      element.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
    if ($('bible-selection-label')) $('bible-selection-label').textContent = makeReferenceLabel(state.book.name_pt, state.chapter, start, end);
    $('bible-selection-menu')?.classList.add('visible');
    $('bible-highlight-colors')?.classList.add('hidden');
  }

  function clearSelection() {
    state.selection = null;
    state.selectionAnchor = null;
    document.querySelectorAll('.bible-verse.selected').forEach((element) => {
      element.classList.remove('selected'); element.setAttribute('aria-pressed', 'false');
    });
    $('bible-selection-menu')?.classList.remove('visible');
  }

  function selectionMatch(item) {
    const selection = state.selection;
    return selection && item.book_id === selection.book_id && item.chapter === selection.chapter
      && item.verse_start === selection.verse_start && item.verse_end === selection.verse_end;
  }

  async function setHighlight(color) {
    if (!state.selection || !await requireUser()) return;
    const existing = state.highlights.find(selectionMatch);
    const payload = { user_id: state.user.id, book_id: state.selection.book_id, chapter: state.selection.chapter, verse_start: state.selection.verse_start, verse_end: state.selection.verse_end, color, translation_code: state.translation.code };
    const query = existing ? client().from('bible_highlights').update({ color, translation_code: state.translation.code }).eq('id', existing.id)
      : client().from('bible_highlights').insert(payload);
    const { error } = await query;
    if (error) return showMessage('Não foi possível salvar o destaque.', 'error');
    await loadPersonalChapterData();
    showMessage('Destaque salvo.', 'success');
  }

  async function removeHighlight() {
    if (!state.selection || !await requireUser()) return;
    const ids = state.highlights.filter((item) => item.verse_start <= state.selection.verse_end && item.verse_end >= state.selection.verse_start).map((item) => item.id);
    if (!ids.length) return showMessage('Esta seleção não possui destaque.', 'info');
    const { error } = await client().from('bible_highlights').delete().in('id', ids);
    if (error) return showMessage('Não foi possível remover o destaque.', 'error');
    await loadPersonalChapterData();
    showMessage('Destaque removido.', 'success');
  }

  async function openNote(item = null) {
    if (!await requireUser()) return;
    if (item) state.selection = { book_id: item.book_id, book_name: state.books.find((book) => book.id === item.book_id)?.name_pt || item.book_id, chapter: item.chapter, verse_start: item.verse_start, verse_end: item.verse_end };
    if (!state.selection) return;
    const existing = item || state.notes.find(selectionMatch);
    $('bible-note-modal').dataset.noteId = existing?.id || '';
    $('bible-note-reference').textContent = makeReferenceLabel(state.selection.book_name, state.selection.chapter, state.selection.verse_start, state.selection.verse_end);
    $('bible-note-content').value = existing?.content || '';
    document.querySelector('[data-bible-action="delete-note"]')?.classList.toggle('hidden', !existing);
    openModal('bible-note-modal');
  }

  async function saveNote() {
    const content = $('bible-note-content').value.trim();
    if (!content) return showMessage('Escreva uma nota antes de salvar.', 'error');
    const noteId = $('bible-note-modal').dataset.noteId;
    const payload = { user_id: state.user.id, book_id: state.selection.book_id, chapter: state.selection.chapter, verse_start: state.selection.verse_start, verse_end: state.selection.verse_end, translation_code: state.translation.code, content };
    const { error } = noteId ? await client().from('bible_notes').update({ content, translation_code: state.translation.code }).eq('id', noteId)
      : await client().from('bible_notes').insert(payload);
    if (error) return showMessage('Não foi possível salvar a nota.', 'error');
    closeModals(); await loadPersonalChapterData(); showMessage('Nota salva.', 'success');
  }

  async function deleteNote() {
    const noteId = $('bible-note-modal').dataset.noteId;
    if (!noteId || !confirm('Excluir esta nota pessoal?')) return;
    const { error } = await client().from('bible_notes').delete().eq('id', noteId);
    if (error) return showMessage('Não foi possível excluir a nota.', 'error');
    closeModals(); await loadPersonalChapterData(); showMessage('Nota excluída.', 'success');
  }

  async function toggleBookmark() {
    if (!state.selection || !await requireUser()) return;
    const existing = state.bookmarks.find(selectionMatch);
    const payload = { user_id: state.user.id, book_id: state.selection.book_id, chapter: state.selection.chapter, verse_start: state.selection.verse_start, verse_end: state.selection.verse_end, translation_code: state.translation.code };
    const { error } = existing ? await client().from('bible_bookmarks').delete().eq('id', existing.id)
      : await client().from('bible_bookmarks').insert(payload);
    if (error) return showMessage('Não foi possível atualizar o favorito.', 'error');
    await loadPersonalChapterData(); showMessage(existing ? 'Favorito removido.' : 'Referência salva.', 'success');
  }

  async function shareSelection() {
    const payload = buildSelectionPayload();
    if (!payload) return;
    const text = `“${payload.text}”\n${makeReferenceLabel(payload.book_name, payload.chapter, payload.verse_start, payload.verse_end)} — ${state.translation.short_name}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Bíblia ADPEL', text });
      else { await navigator.clipboard.writeText(text); showMessage('Texto e referência copiados.', 'success'); }
    } catch (error) { if (error.name !== 'AbortError') showMessage('Não foi possível compartilhar.', 'error'); }
  }

  function renderProgress() {
    const summary = $('bible-progress-summary');
    const toggle = $('bible-read-toggle');
    if (!summary || !state.book) return;
    if (!state.user) { summary.textContent = 'Entre para acompanhar sua leitura.'; if (toggle) toggle.dataset.read = 'false'; return; }
    const bookRead = [...state.progress.values()].filter((item) => item.book_id === state.book.id && item.is_read).length;
    const totalRead = [...state.progress.values()].filter((item) => item.is_read).length;
    const totalChapters = state.books.reduce((sum, book) => sum + book.chapter_count, 0);
    summary.innerHTML = `<strong>${escapeHtml(state.book.name_pt)}</strong> ${bookRead}/${state.book.chapter_count} capítulos · Bíblia ${totalRead}/${totalChapters}`;
    const currentRead = Boolean(state.progress.get(`${state.book.id}:${state.chapter}`)?.is_read);
    if (toggle) {
      toggle.dataset.read = String(currentRead);
      toggle.innerHTML = currentRead ? '<i class="fas fa-circle-check"></i> Capítulo lido · desfazer' : '<i class="far fa-circle-check"></i> Marcar capítulo como lido';
    }
    renderChapterButtons();
  }

  async function toggleRead() {
    if (!await requireUser()) return;
    const key = `${state.book.id}:${state.chapter}`;
    const existing = state.progress.get(key);
    const nowRead = !existing?.is_read;
    let firstEver = false;
    let error;
    if (!existing) {
      firstEver = true;
      ({ error } = await client().from('bible_reading_progress').insert({ user_id: state.user.id, book_id: state.book.id, chapter: state.chapter, is_read: true }));
    } else {
      ({ error } = await client().from('bible_reading_progress').update({ is_read: nowRead, read_at: new Date().toISOString() }).eq('book_id', state.book.id).eq('chapter', state.chapter));
    }
    if (error) return showMessage('Não foi possível atualizar o progresso.', 'error');
    state.progress.set(key, { ...existing, book_id: state.book.id, chapter: state.chapter, is_read: nowRead });
    if (firstEver && window.ADPELJourney?.registerChapterRead) window.ADPELJourney.registerChapterRead(state.book.name_pt, state.chapter);
    if (nowRead) await recordBookCompletionIfNeeded();
    renderProgress();
    showMessage(nowRead ? 'Capítulo marcado como lido.' : 'Marcação de leitura removida.', 'success');
  }

  async function recordBookCompletionIfNeeded() {
    const count = [...state.progress.values()].filter((item) => item.book_id === state.book.id && item.is_read).length;
    if (count !== state.book.chapter_count) return;
    const { error } = await client().from('bible_completed_books').insert({ user_id: state.user.id, book_id: state.book.id });
    if (!error && window.ADPELJourney?.registerBookCompleted) window.ADPELJourney.registerBookCompleted(state.book.name_pt);
    if (!error) showMessage(`${state.book.name_pt} concluído!`, 'success');
    else if (error.code !== '23505') console.error('Não foi possível registrar a conclusão do livro:', error.message);
  }

  async function searchBible() {
    const term = $('bible-search-input')?.value.trim();
    if (!term) return;
    $('bible-search-results')?.classList.remove('hidden');
    $('bible-page')?.classList.add('hidden');
    $('bible-loading')?.classList.remove('hidden');
    $('bible-error')?.classList.add('hidden');
    $('bible-empty')?.classList.add('hidden');
    try {
      const reference = parseReference(term);
      let query = client().from('bible_verses').select('book_id,chapter,verse,text')
        .eq('translation_id', state.translation.id).eq('is_canonical', true).limit(40);
      if (reference) {
        query = query.eq('book_id', reference.book.id).eq('chapter', reference.chapter);
        if (reference.verseStart) query = query.gte('verse', reference.verseStart).lte('verse', reference.verseEnd);
      } else query = query.ilike('text', `%${term.replace(/[%_]/g, '')}%`);
      const { data, error } = await query.order('book_id').order('chapter').order('verse');
      if (error) throw error;
      renderSearchResults(data || []);
    } catch (error) {
      console.error('Erro na busca bíblica:', error);
      if ($('bible-error-text')) $('bible-error-text').textContent = 'Erro ao buscar na Bíblia. Tente novamente.';
      $('bible-error')?.classList.remove('hidden');
    } finally { $('bible-loading')?.classList.add('hidden'); }
  }

  function renderSearchResults(results) {
    if ($('bible-search-count')) $('bible-search-count').textContent = `${results.length} resultado(s) em ${state.translation.short_name}`;
    $('bible-empty')?.classList.toggle('hidden', results.length > 0);
    const container = $('bible-results');
    if (!container) return;
    container.innerHTML = results.map((verse) => {
      const book = state.books.find((item) => item.id === verse.book_id);
      return `<button type="button" class="bible-search-result" data-open-book="${verse.book_id}" data-open-chapter="${verse.chapter}" data-open-verse="${verse.verse}"><strong>${escapeHtml(book?.name_pt || verse.book_id)} ${verse.chapter}:${verse.verse}</strong><span>${escapeHtml(verse.text)}</span><small>${escapeHtml(state.translation.short_name)}</small></button>`;
    }).join('');
  }

  async function openLibrary(type) {
    if (!await requireUser()) return;
    const isNotes = type === 'notes';
    const table = isNotes ? 'bible_notes' : 'bible_bookmarks';
    const { data, error } = await client().from(table).select('*').order('created_at', { ascending: false });
    if (error) return showMessage('Não foi possível abrir seus dados.', 'error');
    $('bible-library-modal').dataset.type = type;
    $('bible-library-title').textContent = isNotes ? 'Minhas notas' : 'Meus favoritos';
    renderLibrary(data || [], isNotes);
    openModal('bible-library-modal');
  }

  function renderLibrary(items, isNotes) {
    const filter = normalize($('bible-library-search')?.value);
    const visible = items.filter((item) => {
      const book = state.books.find((entry) => entry.id === item.book_id);
      return !filter || normalize(`${book?.name_pt} ${item.chapter} ${item.content || ''}`).includes(filter);
    });
    $('bible-library-modal')._items = items;
    $('bible-library-list').innerHTML = visible.length ? visible.map((item) => {
      const book = state.books.find((entry) => entry.id === item.book_id);
      return `<article><button data-open-personal="${item.id}"><strong>${escapeHtml(makeReferenceLabel(book?.name_pt || item.book_id, item.chapter, item.verse_start, item.verse_end))}</strong>${isNotes ? `<span>${escapeHtml(item.content.slice(0, 180))}</span>` : ''}<small>${escapeHtml(item.translation_code?.toUpperCase() || '')} · ${new Date(item.created_at).toLocaleDateString('pt-BR')}</small></button>${isNotes ? `<button data-edit-note="${item.id}" aria-label="Editar nota"><i class="fas fa-pen"></i></button>` : ''}</article>`;
    }).join('') : '<p class="bible-empty-message">Nada salvo aqui ainda.</p>';
  }

  function renderRights() {
    if (!$('bible-rights-list')) return;
    $('bible-rights-list').innerHTML = state.translations.map((item) => `<article><h4>${escapeHtml(item.name)} (${escapeHtml(item.short_name)})</h4><p><strong>Licença:</strong> ${escapeHtml(item.license_type)}</p>${item.copyright_notice ? `<p>${escapeHtml(item.copyright_notice)}</p>` : ''}${item.attribution ? `<p><strong>Atribuição:</strong> ${escapeHtml(item.attribution)}</p>` : ''}${item.source_url ? `<a href="${escapeHtml(item.source_url)}" target="_blank" rel="noopener noreferrer">Fonte oficial</a>` : ''}</article>`).join('');
  }

  function openModal(id) { $('bible-modal-backdrop')?.classList.remove('hidden'); $(id)?.classList.remove('hidden'); }
  function closeModals() { $('bible-modal-backdrop')?.classList.add('hidden'); document.querySelectorAll('.bible-modal').forEach((modal) => modal.classList.add('hidden')); }
  function focusVerse(number) { const element = document.querySelector(`.bible-verse[data-verse="${Number(number)}"]`); element?.scrollIntoView({ behavior: 'smooth', block: 'center' }); if (element) selectVerse(Number(number)); }

  async function navigatePersonal(item, edit = false) {
    closeModals();
    await loadChapter(item.book_id, item.chapter, item.verse_start);
    if (edit) await openNote(item);
  }

  function bindEvents() {
    document.addEventListener('click', async (event) => {
      const verse = event.target.closest('.bible-verse');
      if (verse) return selectVerse(Number(verse.dataset.verse));
      const chapter = event.target.closest('[data-chapter]');
      if (chapter) return loadChapter(state.book.id, Number(chapter.dataset.chapter));
      const result = event.target.closest('[data-open-book]');
      if (result) return loadChapter(result.dataset.openBook, Number(result.dataset.openChapter), Number(result.dataset.openVerse));
      const color = event.target.closest('[data-highlight-color]');
      if (color) return setHighlight(color.dataset.highlightColor);
      const action = event.target.closest('[data-bible-action]')?.dataset.bibleAction;
      if (!action) return;
      const actions = {
        'font-down': () => savePreferences({ font_size: state.preferences.font_size - 2 }),
        'font-up': () => savePreferences({ font_size: state.preferences.font_size + 2 }),
        'library-notes': () => openLibrary('notes'), 'library-bookmarks': () => openLibrary('bookmarks'),
        rights: () => openModal('bible-rights-modal'), highlight: () => $('bible-highlight-colors')?.classList.toggle('hidden'),
        'remove-highlight': removeHighlight, note: () => openNote(), bookmark: toggleBookmark, share: shareSelection,
        'clear-selection': clearSelection, 'save-note': saveNote, 'delete-note': deleteNote,
        'close-modal': closeModals, 'close-auth': () => $('bible-auth-invite')?.classList.remove('visible')
      };
      await actions[action]?.();
    });
    $('bible-book-select')?.addEventListener('change', (event) => loadChapter(event.target.value, 1));
    $('bible-translation-select')?.addEventListener('change', async (event) => {
      state.translation = state.translations.find((item) => item.code === event.target.value) || state.translation;
      await savePreferences({ translation_code: state.translation.code }); await loadChapter();
    });
    $('bible-search-input')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') searchBible(); });
    $('bible-read-toggle')?.addEventListener('click', toggleRead);
    $('bible-continue-card')?.addEventListener('click', (event) => loadChapter(event.currentTarget.dataset.book, Number(event.currentTarget.dataset.chapter)));
    $('bible-modal-backdrop')?.addEventListener('click', closeModals);
    $('bible-library-search')?.addEventListener('input', () => renderLibrary($('bible-library-modal')._items || [], $('bible-library-modal').dataset.type === 'notes'));
    $('bible-library-list')?.addEventListener('click', (event) => {
      const open = event.target.closest('[data-open-personal]');
      const edit = event.target.closest('[data-edit-note]');
      const id = open?.dataset.openPersonal || edit?.dataset.editNote;
      if (!id) return;
      const item = ($('bible-library-modal')._items || []).find((entry) => entry.id === id);
      if (item) navigatePersonal(item, Boolean(edit));
    });
  }

  async function init() {
    if (!$('bible-book-select')) return;
    ensureExperienceUI();
    await resolveUser();
    await loadPreferences();
    try {
      await loadCatalog();
      bindEvents();
      await loadPersonalData();
      if (!$('bible-cover')) {
        await loadChapter(state.book.id, state.chapter);
        registerBibleOpen();
      }
    } catch (error) {
      console.error('Falha ao iniciar Bíblia ADPEL:', error);
      showMessage('Não foi possível iniciar a Bíblia. Tente novamente.', 'error');
    }
  }

  function registerBibleOpen() {
    if (registerBibleOpen.done) return;
    registerBibleOpen.done = true;
    if (window.ADPELJourney?.registerBibleRead) window.ADPELJourney.registerBibleRead();
  }
  async function abrirBiblia() {
    $('bible-cover')?.classList.add('hidden');
    $('bible-reader')?.classList.remove('hidden');
    $('bible-page')?.classList.remove('hidden');
    await loadChapter(state.book.id, state.chapter);
    registerBibleOpen();
  }
  function voltarCapaBiblia() { $('bible-reader')?.classList.add('hidden'); $('bible-cover')?.classList.remove('hidden'); }
  function voltarLeituraBiblia() { $('bible-search-results')?.classList.add('hidden'); $('bible-page')?.classList.remove('hidden'); }
  function capituloAnterior() { if (state.chapter > 1) loadChapter(state.book.id, state.chapter - 1); }
  function proximoCapitulo() { if (state.chapter < state.book.chapter_count) loadChapter(state.book.id, state.chapter + 1); }
  function toggleFullscreen() { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); }

  Object.assign(window, {
    abrirBiblia, voltarCapaBiblia, voltarLeituraBiblia, capituloAnterior, proximoCapitulo, toggleFullscreen,
    buscarBiblia: searchBible, carregarCapitulo: loadChapter,
    mudarLivroBiblia: (book) => loadChapter(book, 1)
  });
  window.ADPELBible = { getSelectionPayload: buildSelectionPayload, openReference: loadChapter, parseReference };
  if (typeof module !== 'undefined' && module.exports) module.exports = { normalize, parseReference, makeReferenceLabel, clampFontSize, buildSelectionPayload };
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', init);
})();
