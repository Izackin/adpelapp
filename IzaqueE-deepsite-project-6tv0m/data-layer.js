// ADPEL Data Layer v3.1.0 — CORRIGIDO
// Sincronizado com Admin (Chaves: adpel_admin_courses, etc.)
// Corrigido: referência ADPEL_DATA_STORE, proteção undefined/null

const ADPEL_DATA_STORE = {
  courses: 'adpel_admin_courses',
  studies: 'adpel_admin_studies',
  library: 'adpel_admin_library',
  announcements: 'adpel_admin_announcements',
  events: 'adpel_admin_events'
};

function getAdpelData(key) {
  try {
    var stored = localStorage.getItem(key);
    if (!stored || stored === 'undefinednull' || stored === 'undefined') {
      localStorage.removeItem(key);
      return [];
    }
    var parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      localStorage.removeItem(key);
      return [];
    }
    // Proteção contra dados corrompidos com undefinednull
    var cleaned = parsed.filter(function(item) {
      if (!item || typeof item !== 'object') return false;
      var str = JSON.stringify(item);
      if (str.indexOf('undefinednull') !== -1 || str.indexOf(':null') !== -1 || str.indexOf('undefined') !== -1) {
        console.warn('[DataLayer] Removendo item corrompido em', key);
        return false;
      }
      return true;
    });
    if (cleaned.length !== parsed.length) {
      console.warn('[DataLayer] Salvando dados limpos para', key);
      saveAdpelData(key, cleaned);
    }
    return cleaned;
  } catch (e) {
    console.error('[DataLayer] Erro ao carregar', key, e);
    localStorage.removeItem(key);
    return [];
  }
}

function saveAdpelData(key, data) {
  if (!Array.isArray(data)) data = [];
  localStorage.setItem(key, JSON.stringify(data));
}

function removeAdpelData(key) {
  localStorage.removeItem(key);
}

function initializeAdpelData() {
  Object.values(ADPEL_DATA_STORE).forEach(function(key) {
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify([]));
    }
  });
  console.log('[DataLayer] Inicializado');
}

function syncAdpelData() {
  window.dispatchEvent(new CustomEvent('adpelDataSync', {
    detail: {
      courses: getAdpelData(ADPEL_DATA_STORE.courses),
      studies: getAdpelData(ADPEL_DATA_STORE.studies),
      library: getAdpelData(ADPEL_DATA_STORE.library),
      announcements: getAdpelData(ADPEL_DATA_STORE.announcements),
      events: getAdpelData(ADPEL_DATA_STORE.events)
    }
  }));
}

function clearCorruptedAdpelData() {
  Object.values(ADPEL_DATA_STORE).forEach(function(key) {
    var data = getAdpelData(key);
    saveAdpelData(key, data);
  });
  console.log('[DataLayer] Dados corrompidos limpos');
}

document.addEventListener('DOMContentLoaded', function() {
  initializeAdpelData();
  clearCorruptedAdpelData();
});

console.log('[DataLayer] v3.1.0 carregado');