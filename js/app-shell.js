(function () {
  'use strict';

  var destinations = [
    { id: 'home', label: 'Início', icon: 'fa-house' },
    { id: 'word', label: 'Palavra', icon: 'fa-book-bible' },
    { id: 'learn', label: 'Aprender', icon: 'fa-graduation-cap' },
    { id: 'community-hub', label: 'Comunidade', icon: 'fa-people-group' },
    { id: 'more', label: 'Mais', icon: 'fa-bars' }
  ];

  var sectionContexts = {
    home: 'home',
    word: 'word',
    bible: 'word',
    tutor: 'word',
    studies: 'word',
    learn: 'learn',
    courses: 'learn',
    certificate: 'learn',
    'community-hub': 'community-hub',
    community: 'community-hub',
    more: 'more',
    library: 'more',
    cofres: 'more',
    ranking: 'more',
    profile: 'more'
  };

  function isMainPage() {
    var page = window.location.pathname.split('/').pop();
    return !page || page === 'index.html';
  }

  function pageContext() {
    var explicit = document.body && document.body.dataset.appContext;
    if (explicit) return explicit;
    var page = window.location.pathname.split('/').pop();
    if (page === 'bible.html' || page === 'harpa.html') return 'word';
    var hash = window.location.hash.replace('#', '');
    return sectionContexts[hash] || 'home';
  }

  function linkFor(destination) {
    return isMainPage() ? '#' + destination.id : 'index.html#' + destination.id;
  }

  function setActive(context) {
    var activeContext = sectionContexts[context] || context || pageContext();
    document.querySelectorAll('[data-app-destination]').forEach(function (item) {
      var active = item.dataset.appDestination === activeContext;
      item.classList.toggle('is-active', active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }

  function renderBottomNavigation() {
    var nav = document.getElementById('mobile-nav');
    if (!nav) return;
    nav.className = 'app-bottom-nav';
    nav.setAttribute('aria-label', 'Navegação principal');
    nav.innerHTML = destinations.map(function (destination) {
      return '<a class="app-bottom-nav__item" data-app-destination="' + destination.id + '" data-section="' + destination.id + '" href="' + linkFor(destination) + '">' +
        '<i class="fas ' + destination.icon + '" aria-hidden="true"></i>' +
        '<span>' + destination.label + '</span>' +
      '</a>';
    }).join('');

    if (isMainPage()) {
      nav.addEventListener('click', function (event) {
        var link = event.target.closest('[data-section]');
        if (!link || typeof window.navigateTo !== 'function') return;
        event.preventDefault();
        window.navigateTo(link.dataset.section);
      });
    }

    document.body.classList.add('has-app-bottom-nav');
    setActive(pageContext());
  }

  function watchVirtualKeyboard() {
    if (!window.visualViewport) return;
    var update = function () {
      var keyboardLikelyOpen = window.visualViewport.height < window.innerHeight * 0.72;
      document.body.classList.toggle('app-keyboard-open', keyboardLikelyOpen);
    };
    window.visualViewport.addEventListener('resize', update);
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderBottomNavigation();
    watchVirtualKeyboard();
  });
  window.addEventListener('hashchange', function () { setActive(pageContext()); });

  window.ADPELAppShell = {
    destinations: destinations,
    contextForSection: function (section) { return sectionContexts[section] || section; },
    setActive: setActive
  };
})();
