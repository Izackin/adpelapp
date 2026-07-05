// Library module - extracted from script.js without behavior changes.

const bookUrls = {};

function cacheBookUrl(id, url) {
  if (id && url) bookUrls[id] = url;
}

async function readBook(id) {
  const url = bookUrls[id];
  if (url) {
    window.open(url, '_blank');
    return;
  }
  try {
    const { data, error } = await window.supabaseClient.from('library_books').select('file_url').eq('id', id).single();
    if (error) throw error;
    if (data?.file_url) {
      bookUrls[id] = data.file_url;
      window.open(data.file_url, '_blank');
    } else {
      showToast('Este livro não possui arquivo para leitura.', 'info');
    }
  } catch (e) {
    console.error(e);
    showToast('Erro ao abrir livro.', 'error');
  }
}

async function loadLibraryData() {
  try {
    const library = await ADPEL.fetch.library();
    renderBooksGrid((library || []).filter(b => b.is_published));
  } catch (e) {
    console.error(e);
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
    return `<div class="min-w-[260px] flex-shrink-0 snap-start bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition cursor-pointer group p-4">
      <div class="relative h-48 bg-gray-100 rounded-lg overflow-hidden mb-4">
        ${book.image 
          ? `<img src="${book.image}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500" alt="${escapeHtml(book.title)}" onerror="this.src='http://static.photos/book/200x300/1'">`
          : `<div class="w-full h-full flex items-center justify-center text-gray-400"><i class="fas fa-book text-5xl"></i></div>`}
      </div>
      <h4 class="font-bold text-gray-800 group-hover:text-blue-600 transition text-sm">${escapeHtml(book.title)}</h4>
      <p class="text-xs text-gray-500 mt-1">${escapeHtml(book.author || 'Autor desconhecido')}</p>
      <button onclick="if(!getCurrentUserInfo().isLoggedIn){openModal('login-modal');return;} readBook('${book.id}')" class="mt-3 w-full py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-blue-600 hover:text-white transition">Ler</button>
    </div>`;
  }).join('');
}

function renderBooksGrid(books) {
  const container = document.getElementById('books-grid');
  if (!container) return;
  if (!books || books.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
        <i class="fas fa-book text-4xl text-gray-300 mb-3"></i>
        <p class="text-gray-500">Nenhum livro disponivel na biblioteca.</p>
      </div>`;
    return;
  }
  container.innerHTML = books.map(book => {
    cacheBookUrl(book.id, book.file_url);
    return `<div class="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition cursor-pointer group p-4">
      <div class="relative h-56 bg-gray-100 rounded-lg overflow-hidden mb-4">
        ${book.image 
          ? `<img src="${book.image}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500" alt="${escapeHtml(book.title)}" onerror="this.src='http://static.photos/book/200x300/1'">`
          : `<div class="w-full h-full flex items-center justify-center text-gray-400"><i class="fas fa-book text-5xl"></i></div>`}
      </div>
      <h4 class="font-bold text-gray-800 group-hover:text-blue-600 transition">${escapeHtml(book.title)}</h4>
      <p class="text-sm text-gray-500 mt-1">${escapeHtml(book.author || 'Autor desconhecido')}</p>
      <p class="text-xs text-gray-400 mt-2">${escapeHtml(book.category || 'Sem categoria')}</p>
      <button onclick="if(!getCurrentUserInfo().isLoggedIn){openModal('login-modal');return;} readBook('${book.id}')" class="mt-4 w-full py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-blue-600 hover:text-white transition">Ler</button>
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
