document.addEventListener('DOMContentLoaded', async () => {
  await loadPublicApp();
});

function isVisibleByDate(item) {
  if (!window.ADPELDateUtils || typeof window.ADPELDateUtils.isWithinDateRange !== 'function') {
    return true;
  }
  return window.ADPELDateUtils.isWithinDateRange(item);
}

function isVisiblePublicEvent(item) {
  if (!window.ADPELDateUtils || typeof window.ADPELDateUtils.isWithinDateRange !== 'function') {
    return true;
  }
  return window.ADPELDateUtils.isWithinDateRange(
    item,
    window.ADPELDateUtils.startFields,
    window.ADPELDateUtils.endFields.concat(['event_date'])
  );
}

async function loadPublicApp() {
  try {
    const [
      homeSections,
      featuredCourses,
      courses,
      featuredStudies,
      studies,
      featuredBooks,
      books,
      certificates,
      announcements,
      events
    ] = await Promise.all([
      fetchHomeSections(),
      fetchFeaturedCourses(),
      fetchCourses(),
      fetchFeaturedStudies(),
      fetchStudies(),
      fetchFeaturedBooks(),
      fetchBooks(),
      fetchCertificates(),
      fetchAnnouncements(),
      fetchEvents()
    ]);

    renderHomeSections((homeSections || []).filter(isVisibleByDate));
    renderFeaturedCourses((featuredCourses || []).filter(isVisibleByDate));
    renderCourses((courses || []).filter(isVisibleByDate));
    renderFeaturedStudies((featuredStudies || []).filter(isVisibleByDate));
    renderStudies((studies || []).filter(isVisibleByDate));
    renderFeaturedBooks((featuredBooks || []).filter(isVisibleByDate));
    renderBooks((books || []).filter(isVisibleByDate));
    renderCertificates(certificates);
    renderAnnouncements((announcements || []).filter(isVisibleByDate));
    renderEvents((events || []).filter(isVisiblePublicEvent));
  } catch (error) {
    console.error('Erro ao carregar aplicação pública:', error);
  }
}

function renderHomeSections(items) {
  const container = document.getElementById('home-sections');
  if (!container) return;
  if (!items.length) {
    container.innerHTML = emptyState('Nenhuma seção da home cadastrada ainda.');
    return;
  }
  container.innerHTML = items.map(item => `
    <section class="bg-white rounded-2xl shadow-sm p-6">
      <h2 class="text-2xl font-bold text-gray-800">${escapeHtml(item.title || '')}</h2>
      <p class="text-gray-500 mt-2">${escapeHtml(item.subtitle || '')}</p>
      ${item.description ? `<p class="text-gray-600 mt-4">${escapeHtml(item.description)}</p>` : ''}
      ${item.image_url ? `<img src="${item.image_url}" alt="${escapeHtml(item.title || 'Imagem')}" class="w-full rounded-xl mt-4 object-cover">` : ''}
      ${(item.button_text && item.button_link) ? `
        <a href="${item.button_link}" class="inline-block mt-4 px-5 py-3 rounded-xl bg-blue-600 text-white font-semibold">
          ${escapeHtml(item.button_text)}
        </a>
      ` : ''}
    </section>
  `).join('');
}

function renderFeaturedCourses(items) {
  const container = document.getElementById('featured-courses');
  if (!container) return;
  if (!items.length) {
    container.innerHTML = emptyState('Nenhum curso em destaque no momento.');
    return;
  }
  container.innerHTML = items.map(course => courseCard(course)).join('');
}

function renderCourses(items) {
  const container = document.getElementById('courses-list');
  if (!container) return;
  if (!items.length) {
    container.innerHTML = emptyState('Nenhum curso disponível no momento.');
    return;
  }
  container.innerHTML = items.map(course => courseCard(course)).join('');
}

function renderFeaturedStudies(items) {
  const container = document.getElementById('featured-studies');
  if (!container) return;
  if (!items.length) {
    container.innerHTML = emptyState('Nenhum estudo em destaque no momento.');
    return;
  }
  container.innerHTML = items.map(study => studyCard(study)).join('');
}

function renderStudies(items) {
  const container = document.getElementById('studies-list');
  if (!container) return;
  if (!items.length) {
    container.innerHTML = emptyState('Nenhum estudo disponível no momento.');
    return;
  }
  container.innerHTML = items.map(study => studyCard(study)).join('');
}

function renderFeaturedBooks(items) {
  const container = document.getElementById('featured-books');
  if (!container) return;
  if (!items.length) {
    container.innerHTML = emptyState('Nenhum livro em destaque no momento.');
    return;
  }
  container.innerHTML = items.map(book => bookCard(book)).join('');
}

function renderBooks(items) {
  const container = document.getElementById('books-list');
  if (!container) return;
  if (!items.length) {
    container.innerHTML = emptyState('Nenhum livro disponível no momento.');
    return;
  }
  container.innerHTML = items.map(book => bookCard(book)).join('');
}

function renderCertificates(items) {
  const container = document.getElementById('certificates-list');
  if (!container) return;
  if (!items.length) {
    container.innerHTML = emptyState('Nenhum certificado disponível no momento.');
    return;
  }
  container.innerHTML = items.map(cert => `
    <article class="bg-white rounded-2xl shadow-sm p-6">
      <h3 class="text-lg font-bold text-gray-800">${escapeHtml(cert.title)}</h3>
      <p class="text-gray-500 mt-2">${escapeHtml(cert.description || 'Sem descrição.')}</p>
    </article>
  `).join('');
}

function renderAnnouncements(items) {
  const container = document.getElementById('announcements-list');
  if (!container) return;
  if (!items.length) {
    container.innerHTML = emptyState('Nenhum aviso disponível no momento.');
    return;
  }
  container.innerHTML = items.map(item => `
    <article class="bg-yellow-50 border border-yellow-200 rounded-2xl p-5">
      <h3 class="font-bold text-gray-800">${escapeHtml(item.title)}</h3>
      <p class="text-gray-600 mt-2">${escapeHtml(item.message || '')}</p>
    </article>
  `).join('');
}

function renderEvents(items) {
  const container = document.getElementById('events-list');
  if (!container) return;
  if (!items.length) {
    container.innerHTML = emptyState('Nenhum evento disponível no momento.');
    return;
  }
  container.innerHTML = items.map(event => `
    <article class="bg-white rounded-2xl shadow-sm p-6">
      <h3 class="font-bold text-gray-800">${escapeHtml(event.title)}</h3>
      <p class="text-gray-500 mt-2">${escapeHtml(event.description || '')}</p>
      <div class="mt-4 text-sm text-gray-600">
        <p><strong>Data:</strong> ${formatDate(event.event_date)}</p>
        <p><strong>Hora:</strong> ${escapeHtml(event.event_time || 'A definir')}</p>
        <p><strong>Local:</strong> ${escapeHtml(event.location || 'A definir')}</p>
      </div>
    </article>
  `).join('');
}

function courseCard(course) {
  return `
    <article class="bg-white rounded-2xl shadow-sm overflow-hidden">
      ${course.thumbnail_url ? `
        <img src="${course.thumbnail_url}" alt="${escapeHtml(course.title)}" class="w-full h-48 object-cover">
      ` : `
        <div class="w-full h-48 bg-gray-100 flex items-center justify-center text-gray-400">
          Sem capa
        </div>
      `}
      <div class="p-5">
        <h3 class="text-lg font-bold text-gray-800">${escapeHtml(course.title)}</h3>
        <p class="text-gray-500 mt-2">${escapeHtml(course.description || 'Sem descrição.')}</p>
        <div class="mt-4 text-sm text-gray-600 space-y-1">
          <p><strong>Professor:</strong> ${escapeHtml(course.teacher_name || 'A definir')}</p>
          <p><strong>Categoria:</strong> ${escapeHtml(course.category || 'Sem categoria')}</p>
          <p><strong>Duração:</strong> ${escapeHtml(course.duration || 'A definir')}</p>
        </div>
      </div>
    </article>
  `;
}

function studyCard(study) {
  return `
    <article class="bg-white rounded-2xl shadow-sm overflow-hidden">
      ${study.cover_url ? `
        <img src="${study.cover_url}" alt="${escapeHtml(study.title)}" class="w-full h-48 object-cover">
      ` : `
        <div class="w-full h-48 bg-gray-100 flex items-center justify-center text-gray-400">
          Sem capa
        </div>
      `}
      <div class="p-5">
        <h3 class="text-lg font-bold text-gray-800">${escapeHtml(study.title)}</h3>
        <p class="text-gray-500 mt-2">${escapeHtml(study.description || 'Sem descrição.')}</p>
        <p class="mt-4 text-sm text-gray-600"><strong>Categoria:</strong> ${escapeHtml(study.category || 'Sem categoria')}</p>
        <button onclick="if(typeof openStudyModal==='function'){openStudyModal('${encodeURIComponent(JSON.stringify(study))}')}else{console.error('openStudyModal não encontrado')}" class="mt-4 w-full py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition">
          Abrir Estudo
        </button>
      </div>
    </article>
  `;
}

function bookCard(book) {
  return `
    <article class="bg-white rounded-2xl shadow-sm overflow-hidden">
      ${book.cover_url ? `
        <img src="${book.cover_url}" alt="${escapeHtml(book.title)}" class="w-full h-56 object-cover">
      ` : `
        <div class="w-full h-56 bg-gray-100 flex items-center justify-center text-gray-400">
          Sem capa
        </div>
      `}
      <div class="p-5">
        <h3 class="text-lg font-bold text-gray-800">${escapeHtml(book.title)}</h3>
        <p class="text-gray-500 mt-2">${escapeHtml(book.description || 'Sem descrição.')}</p>
        <div class="mt-4 text-sm text-gray-600 space-y-1">
          <p><strong>Autor:</strong> ${escapeHtml(book.author || 'Não informado')}</p>
          <p><strong>Categoria:</strong> ${escapeHtml(book.category || 'Sem categoria')}</p>
        </div>
      </div>
    </article>
  `;
}

function emptyState(message) {
  return `
    <div class="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-500">
      <p class="text-lg font-medium">${escapeHtml(message)}</p>
    </div>
  `;
}

function formatDate(dateString) {
  if (!dateString) return 'A definir';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
