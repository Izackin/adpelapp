// Library module - extracted from script.js without behavior changes.

const bookUrls = {};

function cacheBookUrl(id, url) {
  const safeUrl = safeNavigationUrl(url);
  if (id && safeUrl) bookUrls[id] = safeUrl;
}

async function readBook(id) {
  const url = bookUrls[id];
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  try {
    const { data, error } = await window.supabaseClient.from('library_books').select('file_url').eq('id', id).single();
    if (error) throw error;
    if (data?.file_url) {
      const safeUrl = safeNavigationUrl(data.file_url);
      if (!safeUrl) throw new Error('URL do livro não permitida.');
      bookUrls[id] = safeUrl;
      window.open(safeUrl, '_blank', 'noopener,noreferrer');
    } else {
      showToast('Este livro não possui arquivo para leitura.', 'info');
    }
  } catch (e) {
    console.error(e);
    showToast('Erro ao abrir livro.', 'error');
  }
}

let libraryCatalog = [];
let libraryOwner = null;
let libraryRequest = 0;
let libraryLoading = false;
function librarySearchText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}
function librarySession() {
  const info = getCurrentUserInfo();
  return info.isLoggedIn && info.user ? info.user.id : null;
}
function filterLibraryCatalog() {
  if (libraryLoading || !libraryOwner || libraryOwner !== librarySession()) return;
  const search = librarySearchText((document.getElementById('library-search') || {}).value);
  const category = (document.getElementById('library-category') || {}).value || '';
  const rows = libraryCatalog.filter(book => (!category || librarySearchText(book.category) === category) &&
    (!search || librarySearchText([book.title,book.author,book.category].join(' ')).includes(search)));
  const count = document.getElementById('library-count');
  if (count) count.textContent = rows.length + (rows.length === 1 ? ' livro' : ' livros');
  renderBooksGrid(rows, Boolean(search || category));
}
function renderLibraryCategories() {
  const select = document.getElementById('library-category');
  if (!select) return;
  const previous = select.value;
  const categories = new Map();
  libraryCatalog.forEach(book => {
    const label = String(book.category || '').trim();
    const key = librarySearchText(label);
    if (key && !categories.has(key)) categories.set(key,label);
  });
  const all = document.createElement('option');
  all.value = ''; all.textContent = 'Todas as categorias';
  select.replaceChildren(all);
  Array.from(categories.entries()).sort((a,b)=>a[1].localeCompare(b[1],'pt-BR')).forEach(([key,label])=>{
    const option = document.createElement('option');
    option.value = key; option.textContent = label; select.appendChild(option);
  });
  select.value = categories.has(previous) ? previous : '';
}
async function loadLibraryData() {
  const owner = librarySession(), request = ++libraryRequest;
  const loading = document.getElementById('library-loading');
  const grid = document.getElementById('books-grid');
  const count = document.getElementById('library-count');
  libraryLoading = true;
  if (owner !== libraryOwner) {
    libraryCatalog = []; libraryOwner = owner;
    Object.keys(bookUrls).forEach(key => delete bookUrls[key]);
  }
  if (grid) grid.replaceChildren();
  if (count) count.textContent = '';
  if (!owner) { libraryLoading=false; return; }
  if (loading) { loading.textContent='Carregando biblioteca…'; loading.classList.remove('hidden'); }
  try {
    const library = await ADPEL.fetch.library();
    if (request !== libraryRequest || owner !== librarySession()) return;
    libraryCatalog = (library || []).filter(b => b.is_published);
    libraryLoading = false;
    renderLibraryCategories();
    filterLibraryCatalog();
    if (loading) loading.classList.add('hidden');
  } catch (e) {
    console.error(e);
    if (request === libraryRequest && owner === librarySession()) {
      libraryLoading=false;
      if (loading) loading.textContent='Não foi possível carregar a biblioteca. Volte à tela para tentar novamente.';
    }
  }
}

function renderFeaturedBooks(books) {
  const container = document.getElementById('featured-books');
  if (!container) return;
  if (!books || books.length === 0) {
    container.innerHTML = `
      <div class="min-w-[260px] flex-shrink-0 w-full text-center py-8 bg-white rounded-xl border border-dashed border-gray-300">
        <i class="fas fa-book text-4xl text-gray-300 mb-3"></i>
        <p class="text-gray-500">Nenhum livro em destaque.</p>
      </div>`;
    return;
  }
  container.innerHTML = books.map(book => {
    cacheBookUrl(book.id, book.file_url);
    const imageUrl = safeImageUrl(book.image);
    return `<div class="min-w-[260px] flex-shrink-0 snap-start bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition cursor-pointer group p-4">
      <div class="relative h-48 bg-gray-100 rounded-lg overflow-hidden mb-4">
        ${imageUrl
          ? `<img src="${escapeHtml(imageUrl)}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500" alt="${escapeHtml(book.title)}" onerror="this.src='https://static.photos/book/200x300/1'">`
          : `<div class="w-full h-full flex items-center justify-center text-gray-400"><i class="fas fa-book text-5xl"></i></div>`}
      </div>
      <h4 class="font-bold text-gray-800 group-hover:text-blue-600 transition text-sm">${escapeHtml(book.title)}</h4>
      <p class="text-xs text-gray-500 mt-1">${escapeHtml(book.author || 'Autor desconhecido')}</p>
      <button onclick="if(!getCurrentUserInfo().isLoggedIn){openModal('login-modal');return;} readBook('${book.id}')" class="mt-3 w-full py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-blue-600 hover:text-white transition">Ler</button>
    </div>`;
  }).join('');
}

function renderBooksGrid(books, filtered) {
  const container = document.getElementById('books-grid');
  if (!container) return;
  if (!books || books.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
        <i class="fas fa-book text-4xl text-gray-300 mb-3"></i>
        <p class="text-gray-500">${filtered ? 'Nenhum livro encontrado. Experimente outro termo ou categoria.' : 'Nenhum livro disponível na biblioteca.'}</p>
      </div>`;
    return;
  }
  container.innerHTML = books.map(book => {
    cacheBookUrl(book.id, book.file_url);
    const imageUrl = safeImageUrl(book.image);
    return `<div class="app-library-card bg-white rounded-xl overflow-hidden group p-3">
      <div class="app-library-cover relative bg-gray-100 rounded-lg overflow-hidden mb-3">
        ${imageUrl
          ? `<img src="${escapeHtml(imageUrl)}" class="w-full h-full object-cover" loading="lazy" decoding="async" alt="${escapeHtml(book.title)}" onerror="this.onerror=null;this.hidden=true">`
          : `<div class="w-full h-full flex items-center justify-center text-gray-400"><i class="fas fa-book text-5xl"></i></div>`}
      </div>
      <h4 class="font-bold text-gray-800 group-hover:text-blue-600 transition">${escapeHtml(book.title)}</h4>
      <p class="text-sm text-gray-500 mt-1">${escapeHtml(book.author || 'Autor desconhecido')}</p>
      <p class="text-xs text-gray-400 mt-2">${escapeHtml(book.category || 'Sem categoria')}</p>
      <button onclick="if(!getCurrentUserInfo().isLoggedIn){openModal('login-modal');return;} readBook('${escapeHtml(encodeURIComponent(String(book.id || '')).replaceAll("'",'%27'))}')" class="app-primary-action mt-4 w-full">Ler livro</button>
    </div>`;
  }).join('');
}

Object.assign(window, {
  cacheBookUrl,
  readBook,
  loadLibraryData,
  renderFeaturedBooks,
  renderBooksGrid
});
