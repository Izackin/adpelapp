const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const index = read('index.html');
const shell = read('js/app-shell.js');
const shellCss = read('app-shell.css');
const navigation = read('js/navigation.js');
const home = read('js/home.js');
const agenda = read('js/agenda.js');
const auth = read('auth.js');
const bootstrap = read('script.js');

const destinationLabels = [...shell.matchAll(/label: '([^']+)'/g)].map((match) => match[1]);
assert.deepEqual(destinationLabels, ['Início', 'Palavra', 'Aprender', 'Comunidade', 'Mais']);
assert.match(shell, /setAttribute\('aria-current', 'page'\)/);
assert.match(shell, /visualViewport/);

for (const id of ['home', 'word', 'learn', 'community-hub', 'more']) {
  assert.match(index, new RegExp(`id="${id}"`));
}
assert.match(index, /id="mobile-nav" aria-label="Navegação principal"/);
assert.doesNotMatch(index, /data-group="culto"/);
assert.match(index, /id="admin-link-mobile" class="app-hub-section hidden"/);
assert.doesNotMatch(index, /desktop-primary-nav/);
assert.match(index, /onclick="openOfertaModal\(\)"/);
assert.match(auth, /adminLinkMobile\.classList\.toggle\('hidden', !isMaster\)/);

assert.match(navigation, /case 'studies': loadStudiesData\(\)/);
assert.doesNotMatch(navigation, /section === 'studies'\) section = 'courses'/);
assert.match(navigation, /history\.pushState/);
assert.match(navigation, /window\.addEventListener\('popstate'/);
assert.match(navigation, /handleInitialHash !== false/);
assert.match(auth, /window\.ADPELAuthReady = initAuth\(\)/);
assert.match(bootstrap, /await waitForAuthBootstrap\(\)/);
assert.match(bootstrap, /handleNavigationHash\(\)/);

assert.match(home, /Promise\.allSettled/);
assert.match(home, /renderContinueSection\(inProgressCourses\.slice\(0, 1\)\)/);
assert.match(home, /renderFeaturedCourses\(featuredCourses\.slice\(0, 1\)\)/);
assert.match(home, /loadDeterministicBibleVerse/);
assert.match(home, /adpel_bible_preferences_v2/);
assert.doesNotMatch(home, /profile\.full_name \|\| user\.email/);
assert.match(agenda, /replace\(\/\[\^a-zA-Z0-9_-\]\/g, ''\)/);
assert.match(agenda, /Nenhum evento programado no momento/);

assert.match(shellCss, /env\(safe-area-inset-bottom/);
assert.match(shellCss, /min-height: 3\.65rem/);
assert.match(shellCss, /#sidebar\.hidden \{ display: block; \}/);
assert.match(shellCss, /prefers-reduced-motion/);
assert.match(shellCss, /focus-visible/);

for (const file of ['bible.html', 'harpa.html']) {
  const html = read(file);
  assert.match(html, /data-app-context="word"/);
  assert.match(html, /src="js\/app-shell\.js"/);
  assert.match(html, /href="app-shell\.css"/);
  assert.match(html, /id="mobile-nav"/);
}

assert.equal(fs.statSync(path.join(root, 'js/offerings.js')).size > 0, true);
console.log('navigation-ux: all assertions passed');
