// ==========================
// BIBLE SEARCH
// ==========================

async function buscarBiblia() {
  const input = document.getElementById('bible-search-input');
  const termo = input ? input.value.trim() : '';
  if (!termo) return;

  const loadingEl = document.getElementById('bible-loading');
  const resultsEl = document.getElementById('bible-results');
  const emptyEl = document.getElementById('bible-empty');
  const errorEl = document.getElementById('bible-error');

  if (loadingEl) loadingEl.classList.remove('hidden');
  if (resultsEl) resultsEl.innerHTML = '';
  if (emptyEl) emptyEl.classList.add('hidden');
  if (errorEl) {
    errorEl.classList.add('hidden');
    errorEl.textContent = '';
  }

  try {
    let data = [];
    // Tentar identificar referencia biblica: Livro Cap[:Vers]
    // Ex: Joao 3, Joao 3:16, 1 Joao 3:16
    const refRegex = /^(\d?(?:\s)?[A-Za-zÀ-ú]+)\s+(\d+)(?::(\d+))?$/;
    const match = termo.match(refRegex);

    if (match) {
      const book = match[1].trim();
      const chapter = parseInt(match[2], 10);
      const verse = match[3] ? parseInt(match[3], 10) : null;

      let q = window.supabaseClient
        .from('bible_verses')
        .select('*')
        .ilike('book', `%${book}%`)
        .eq('chapter', chapter)
        .limit(20);
      if (verse !== null) q = q.eq('verse', verse);
      const { data: refData, error } = await q;
      if (error) throw error;
      data = refData || [];
    }

    // Se nao achou como referencia, buscar por texto ou nome de livro
    if (data.length === 0) {
      const { data: textData, error } = await window.supabaseClient
        .from('bible_verses')
        .select('*')
        .or(`book.ilike.%${termo}%,text.ilike.%${termo}%`)
        .limit(20);
      if (error) throw error;
      data = textData || [];
    }

    renderBibleResults(data);
  } catch (e) {
    console.error('Erro na busca biblica:', e);
    mostrarResultadosBiblia();
    if (errorEl) {
      errorEl.textContent = 'Erro ao buscar na Bíblia. Tente novamente.';
      errorEl.classList.remove('hidden');
    }
  } finally {
    if (loadingEl) loadingEl.classList.add('hidden');
  }
}

function renderBibleResults(results) {
  const container = document.getElementById('bible-results');
  const emptyEl = document.getElementById('bible-empty');
  if (!container) return;

  if (!results || results.length === 0) {
    container.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('hidden');
    mostrarResultadosBiblia();
    return;
  }

  if (emptyEl) emptyEl.classList.add('hidden');
  mostrarResultadosBiblia();

  container.innerHTML = results.map(v => `
    <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-lg transition group">
      <div class="flex items-start justify-between gap-3 mb-2">
        <h4 class="font-bold text-adpel-700 text-sm uppercase tracking-wide">${escapeHtml(v.book)} ${escapeHtml(v.chapter)}:${escapeHtml(v.verse)}</h4>
        <span class="text-[10px] bg-adpel-50 text-adpel-700 px-2 py-0.5 rounded border border-adpel-100">ACF</span>
      </div>
      <p class="text-gray-600 text-base leading-relaxed">${escapeHtml(v.text)}</p>
    </div>
  `).join('');
}

// ==========================
// BIBLE READER FUNCTIONS
// ==========================

const bibleBooks = [
  "Gênesis","Êxodo","Levítico","Números","Deuteronômio","Josué","Juízes","Rute","1 Samuel","2 Samuel","1 Reis","2 Reis","1 Crônicas","2 Crônicas","Esdras","Neemias","Ester","Jó","Salmos","Provérbios","Eclesiastes","Cantares","Isaías","Jeremias","Lamentações","Ezequiel","Daniel","Oséias","Joel","Amós","Obadias","Jonas","Miquéias","Naum","Habacuque","Sofonias","Ageu","Zacarias","Malaquias",
  "Mateus","Marcos","Lucas","João","Atos","Romanos","1 Coríntios","2 Coríntios","Gálatas","Efésios","Filipenses","Colossenses","1 Tessalonicenses","2 Tessalonicenses","1 Timóteo","2 Timóteo","Tito","Filemom","Hebreus","Tiago","1 Pedro","2 Pedro","1 João","2 João","3 João","Judas","Apocalipse"
];

let currentBibleBook = null;
let currentBibleChapter = null;

function populateBibleBooks() {
  const select = document.getElementById('bible-book-select');
  if (!select) return;
  if (select.options.length > 1) return;
  select.innerHTML = '<option value="">Selecione o Livro</option>';
  bibleBooks.forEach(book => {
    const option = document.createElement('option');
    option.value = book;
    option.textContent = book;
    select.appendChild(option);
  });
}

function abrirBiblia() {
  const cover = document.getElementById('bible-cover');
  const reader = document.getElementById('bible-reader');
  if (cover) cover.classList.add('hidden');
  if (reader) reader.classList.remove('hidden');
  populateBibleBooks();
  mostrarPaginaBiblia();
  if (window.ADPELJourney && typeof window.ADPELJourney.registerBibleRead === 'function') {
    window.ADPELJourney.registerBibleRead();
  }
  if (!currentBibleBook) {
    const select = document.getElementById('bible-book-select');
    if (select) {
      select.value = bibleBooks[0];
      mudarLivroBiblia(bibleBooks[0]);
    }
  }
}

function voltarCapaBiblia() {
  const cover = document.getElementById('bible-cover');
  const reader = document.getElementById('bible-reader');
  if (cover) cover.classList.remove('hidden');
  if (reader) reader.classList.add('hidden');
}

function mostrarPaginaBiblia() {
  const page = document.getElementById('bible-page');
  const results = document.getElementById('bible-search-results');
  const searchStatus = document.getElementById('bible-search-status');
  if (page) page.classList.remove('hidden');
  if (results) results.classList.add('hidden');
  if (searchStatus) searchStatus.classList.add('hidden');
}

function mostrarResultadosBiblia() {
  const page = document.getElementById('bible-page');
  const results = document.getElementById('bible-search-results');
  if (page) page.classList.add('hidden');
  if (results) results.classList.remove('hidden');
}

function voltarLeituraBiblia() {
  mostrarPaginaBiblia();
  const input = document.getElementById('bible-search-input');
  if (input) input.value = '';
}

async function mudarLivroBiblia(book) {
  if (!book) return;
  currentBibleBook = book;
  currentBibleChapter = 1;
  await carregarCapitulo(book, 1);
}

function renderChapterButtons(maxChapter) {
  const container = document.getElementById('bible-chapter-selector');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 1; i <= maxChapter; i++) {
    const btn = document.createElement('button');
    btn.className = `chapter-btn ${i === currentBibleChapter ? 'active' : ''}`;
    btn.textContent = i;
    btn.onclick = () => carregarCapitulo(currentBibleBook, i);
    container.appendChild(btn);
  }
}

async function carregarCapitulo(book, chapter) {
  if (!book || !chapter) return;
  currentBibleBook = book;
  currentBibleChapter = parseInt(chapter, 10);

  const content = document.getElementById('bible-verses-content');
  const currentBookEl = document.getElementById('bible-current-book');
  const currentChapterEl = document.getElementById('bible-current-chapter');
  const loading = document.getElementById('bible-page-loading');
  const prevBtn = document.getElementById('btn-capitulo-ant');
  const nextBtn = document.getElementById('btn-capitulo-prox');

  if (loading) loading.classList.remove('hidden');
  if (content) content.innerHTML = '';
  if (currentBookEl) currentBookEl.textContent = book;
  if (currentChapterEl) currentChapterEl.textContent = `Capítulo ${currentBibleChapter}`;

  try {
    const { data: verses, error } = await window.supabaseClient
      .from('bible_verses')
      .select('*')
      .eq('book', book)
      .eq('chapter', currentBibleChapter)
      .order('verse', { ascending: true });

    if (error) throw error;

    if (content) {
      if (verses && verses.length > 0) {
        content.innerHTML = verses.map(v =>
          `<p><span class="verse-num">${v.verse}</span>${escapeHtml(v.text)}</p>`
        ).join('');
      } else {
        content.innerHTML = '<p class="text-center text-[#8c7a6a] italic mt-8">Nenhum versículo encontrado para este capítulo.</p>';
      }
    }

    const { data: chapterData, error: chError } = await window.supabaseClient
      .from('bible_verses')
      .select('chapter')
      .eq('book', book)
      .order('chapter', { ascending: false })
      .limit(1);

    let maxChapter = 1;
    if (!chError && chapterData && chapterData.length > 0) {
      maxChapter = chapterData[0].chapter;
    }

    renderChapterButtons(maxChapter);
    if (window.ADPELJourney && typeof window.ADPELJourney.registerChapterRead === 'function') {
      window.ADPELJourney.registerChapterRead(book, currentBibleChapter);
      if (currentBibleChapter >= maxChapter && typeof window.ADPELJourney.registerBookCompleted === 'function') {
        window.ADPELJourney.registerBookCompleted(book);
      }
    }

    if (prevBtn) prevBtn.disabled = currentBibleChapter <= 1;
    if (nextBtn) nextBtn.disabled = currentBibleChapter >= maxChapter;

    const select = document.getElementById('bible-book-select');
    if (select) select.value = book;
  } catch (e) {
    console.error('Erro ao carregar capítulo:', e);
    if (content) content.innerHTML = '<p class="text-center text-red-600 italic mt-8">Erro ao carregar capítulo. Tente novamente.</p>';
  } finally {
    if (loading) loading.classList.add('hidden');
  }
}

function capituloAnterior() {
  if (currentBibleBook && currentBibleChapter > 1) {
    carregarCapitulo(currentBibleBook, currentBibleChapter - 1);
  }
}

function proximoCapitulo() {
  if (currentBibleBook) {
    carregarCapitulo(currentBibleBook, currentBibleChapter + 1);
  }
}

Object.assign(window, {
  buscarBiblia,
  renderBibleResults,
  populateBibleBooks,
  abrirBiblia,
  voltarCapaBiblia,
  mostrarPaginaBiblia,
  mostrarResultadosBiblia,
  voltarLeituraBiblia,
  mudarLivroBiblia,
  carregarCapitulo,
  capituloAnterior,
  proximoCapitulo
});
