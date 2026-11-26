var currentSection = 'home';
var _lastHomeLoad = 0;
var _lastSectionLoads = {};
var SECTION_LOAD_DEBOUNCE = 2000;

function navigateTo(section, options) {
  var navigationOptions = options || {};
  const target = document.getElementById(section);
  if (!target || !['home','word','tutor','learn','community-hub','more','courses','library','certificate','cofres','ranking','bible','profile','community'].includes(section)) return;
  // Seções que exigem login
  var restrictedSections = ['courses', 'library', 'certificate', 'profile', 'community'];
  var userInfo = getCurrentUserInfo();

  if (restrictedSections.indexOf(section) !== -1 && !userInfo.isLoggedIn) {
    openModal('login-modal');
    if (window.ADPELAppShell) window.ADPELAppShell.setActive(currentSection);
    return;
  }

  const sections = ['home', 'word', 'tutor', 'learn', 'community-hub', 'more', 'courses', 'library', 'certificate', 'cofres', 'ranking', 'bible', 'profile', 'community'];
  sections.forEach(s => {
    const el = document.getElementById(s);
    if (el) el.classList.add('hidden');
  });
  const changed = currentSection !== section;
  target.classList.remove('hidden');
  currentSection = section;
  if (navigationOptions.updateHistory !== false) {
    var nextHash = '#' + section;
    if (window.location.hash !== nextHash) window.history.pushState({ section: section }, '', nextHash);
  }
  if (changed) window.scrollTo({ top: 0, behavior: 'instant' });
  loadSectionData(section);

  // Fechar sidebar mobile ao navegar
  if (window.innerWidth < 768) {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.add('hidden');
  }

  var activeContext = window.ADPELAppShell
    ? window.ADPELAppShell.contextForSection(section)
    : section;
  if (window.ADPELAppShell) window.ADPELAppShell.setActive(activeContext);
}

function loadSectionData(section) {
  // Home and agenda share a session-aware in-flight loader.
  if (section === 'home' || section === 'community-hub') return loadHomeData();
  const info = getCurrentUserInfo();
  const loadKey = section + ':' + (info.isLoggedIn && info.user ? info.user.id : 'guest');
  const now = Date.now();
  if (_lastSectionLoads[loadKey] && (now - _lastSectionLoads[loadKey] < SECTION_LOAD_DEBOUNCE)) {
    console.log(`⏭️ loadSectionData(${section}) debounce`);
    return;
  }
  _lastSectionLoads[loadKey] = now;
  switch(section) {
    case 'word': if (typeof renderReadingContinuation === 'function') renderReadingContinuation(); break;
    case 'tutor': if (window.ADPELTutor && typeof window.ADPELTutor.activate === 'function') window.ADPELTutor.activate(); break;
    case 'courses': loadCoursesData(); break;
    case 'library': loadLibraryData(); break;
    case 'certificate': loadCertificatesData(); break;
    case 'cofres': if (typeof loadCofresData === 'function') loadCofresData(); break;
    case 'ranking': if (window.ADPELJourney && typeof window.ADPELJourney.renderRanking === 'function') window.ADPELJourney.renderRanking(); break;
    case 'community': if (typeof loadCommunityData === 'function') loadCommunityData(); break;
    case 'bible': break; // busca manual pelo usuário
    case 'profile': loadProfileData(); break;
  }
}

function handleNavigationHash() {
  const hash = window.location.hash.replace('#', '') || 'home';
  if (hash && ['home','word','tutor','learn','community-hub','more','courses','library','certificate','cofres','ranking','profile','community'].includes(hash)) {
    navigateTo(hash, { updateHistory: false });
  }
}

function toggleMobileMenu(menuId) {
  const menu = document.getElementById(menuId);
  const otherId = menuId === 'menu-aprender' ? 'menu-culto' : 'menu-aprender';
  const other = document.getElementById(otherId);
  if (other) other.classList.add('hidden');
  if (menu) menu.classList.toggle('hidden');
}

function closeMobileSubmenus() {
  const m1 = document.getElementById('menu-aprender');
  const m2 = document.getElementById('menu-culto');
  if (m1) m1.classList.add('hidden');
  if (m2) m2.classList.add('hidden');
}

function initMobileNavInteractions() {
  const mobileNav = document.getElementById('mobile-nav');
  if (!mobileNav) return;

  document.addEventListener('click', (event) => {
    if (mobileNav.contains(event.target)) return;
    closeMobileSubmenus();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMobileSubmenus();
    }
  });
}

function initModalInteractions() {
  const modalIds = [
    'login-modal',
    'register-modal',
    'course-modal',
    'oferta-modal',
    'contribution-modal',
    'certificate-view-modal'
  ];

  modalIds.forEach((modalId) => {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeModalById(modalId);
      }
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    const openModal = modalIds
      .map((modalId) => document.getElementById(modalId))
      .filter((modal) => modal && !modal.classList.contains('hidden'))
      .pop();

    if (openModal) {
      closeModalById(openModal.id);
    }
  });
}

function closeModalById(modalId) {
  const closers = {
    'course-modal': 'closeCourseModal',
    'oferta-modal': 'closeOfertaModal',
    'contribution-modal': 'closeContributionModal',
    'certificate-view-modal': 'closeCertificateViewModal'
  };
  const closerName = closers[modalId];

  if (closerName && typeof window[closerName] === 'function') {
    window[closerName]();
    return;
  }

  if (typeof closeModal === 'function') {
    closeModal(modalId);
  }
}

function toggleSidebarGroup(groupId) {
  const el = document.getElementById(groupId);
  const icon = document.getElementById(groupId + '-icon');
  if (el) el.classList.toggle('hidden');
  if (icon) icon.classList.toggle('rotate-180');
}

function initNavigation(options) {
  var navigationOptions = options || {};
  window.addEventListener('hashchange', handleNavigationHash);
  window.addEventListener('popstate', handleNavigationHash);
  if (navigationOptions.handleInitialHash !== false && window.location.hash) handleNavigationHash();
  else if (window.ADPELAppShell) window.ADPELAppShell.setActive('home');
  initMobileNavInteractions();
  initModalInteractions();
}

Object.assign(window, {
  navigateTo,
  loadSectionData,
  handleNavigationHash,
  toggleMobileMenu,
  closeMobileSubmenus,
  initMobileNavInteractions,
  initModalInteractions,
  closeModalById,
  toggleSidebarGroup,
  initNavigation
});
