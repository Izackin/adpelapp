//=============================================================== script.js - ADPEL Digital Platform v3.1.0
//============== Núcleo de inicialização e helpers compartilhados

function loadReleasePolishStyles() {
  if (document.querySelector('link[data-adpel-release-polish]')) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'release-polish.css';
  link.dataset.adpelReleasePolish = 'true';
  document.head.appendChild(link);
}

async function waitForAuthBootstrap(timeoutMs = 2000) {
  const startedAt = Date.now();

  while (typeof currentUser === 'undefined' && Date.now() - startedAt < timeoutMs) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  loadReleasePolishStyles();

  if (typeof initNavigation === 'function') {
    initNavigation();
  }

  await waitForAuthBootstrap();
  await initApp();

  if (typeof updateBannerWelcome === 'function') {
    updateBannerWelcome();
  }
});

async function initApp() {
  await loadHomeData();

  if (window.ADPELJourney && typeof window.ADPELJourney.init === 'function') {
    window.ADPELJourney.init().catch(error => {
      console.error('Erro ao iniciar jornada:', error);
    });
  }

  if (typeof verificarAtualizacoesPendentes === 'function') {
    verificarAtualizacoesPendentes();
  }
}

function isContentVisibleNow(item) {
  if (!window.ADPELDateUtils || typeof window.ADPELDateUtils.isWithinDateRange !== 'function') {
    return true;
  }
  return window.ADPELDateUtils.isWithinDateRange(item);
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

function parseLocalDate(dateString) {
  if (!dateString) return null;
  const s = String(dateString).trim().toLowerCase();
  if (s === 'null' || s === 'undefined' || s === '') return null;
  const parts = s.split('T')[0].split('-');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return new Date(year, month, day);
}

function formatDate(isoString) {
  if (!isoString) return '';
  const s = String(isoString).trim().toLowerCase();
  if (s === 'null' || s === 'undefined' || s === '') return '';
  const dateOnly = s.split('T')[0];
  const parts = dateOnly.split('-');
  if (parts.length !== 3) return '';
  const year = parts[0] || '';
  const month = parts[1] || '';
  const day = parts[2] || '';
  if (!year || !month || !day) return '';
  return `${day}/${month}/${year}`;
}

function getMonthName(monthStr) {
  if (!monthStr) return '';
  const s = String(monthStr).trim().toLowerCase();
  if (s === 'null' || s === 'undefined' || s === '') return '';
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const idx = parseInt(s, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= months.length) return '';
  return months[idx];
}

function scrollContainer(id, amount) {
  const el = document.getElementById(id);
  if (el) el.scrollBy({ left: amount, behavior: 'smooth' });
}

Object.assign(window, {
  initApp,
  isContentVisibleNow,
  escapeHtml,
  parseLocalDate,
  formatDate,
  getMonthName,
  scrollContainer
});
