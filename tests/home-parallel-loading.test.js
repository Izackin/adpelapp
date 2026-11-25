const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../js/home.js'), 'utf8');
const load = source.slice(source.indexOf('async function loadHomeData()'), source.indexOf('Object.assign(window, {', source.indexOf('async function loadHomeData()')));
assert.match(source, /\.from\('verse_of_day'\)\s*\.select\('text, reference'\)/);
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function runScenario(mode) {
  const calls = [];
  const course = { id: 'c1', is_published: true, is_featured: true, lessons: ['a','b'] };
  const pendingCourses = deferred(), pendingProgress = deferred();
  let session = mode === 'guest' ? null : 'u1';
  const state = { continue: null, featured: null, agenda: null };
  const ctx = {
    _lastHomeLoad: 0, SECTION_LOAD_DEBOUNCE: 2000,
    console: { log() {}, error() {} },
    carregarVersiculoDoDia() {},
    getCurrentUserInfo: () => session ? { isLoggedIn: true, user: { id: session } } : { isLoggedIn: false },
    ADPEL: { fetch: {
      courses() { calls.push('courses'); return pendingCourses.promise; },
      events() { calls.push('events'); return Promise.resolve([{id:'e1'}]); },
      announcements() { calls.push('announcements'); return Promise.resolve([]); }
    } },
    getAllLessonProgress() { calls.push('progress'); return pendingProgress.promise; },
    isContentVisibleNow: () => true, isHomeEventVisible: () => true,
    normalizeLessons: x => x,
    buildUnifiedAgenda: (events, announcements) => events.concat(announcements),
    fetchAttendancesForEvents: () => Promise.resolve([{ event_id:'e1', confirmed_count:3, has_confirmed:false }]),
    renderContinueSection: rows => { state.continue = rows; },
    renderFeaturedCourses: rows => { state.featured = rows; },
    renderHomeEvents() {},
    renderCommunityAgenda: (events, byEvent) => { state.agenda = { events, byEvent }; },
    document: { getElementById: () => null }
  };
  vm.createContext(ctx);
  const task = vm.runInContext(load + '\nloadHomeData();', ctx);
  // The private progress request must start before the course request resolves.
  assert.equal(JSON.stringify(calls), JSON.stringify(mode === 'guest'
    ? ['courses','events','announcements'] : ['courses','events','announcements','progress']));
  if (mode === 'switch') session = 'u2';
  if (mode === 'failure') pendingProgress.reject(new Error('simulated'));
  else pendingProgress.resolve([{course_id:'c1',lesson_index:0}]);
  pendingCourses.resolve([course]);
  await task;
  assert.equal(state.featured.length, 1);
  assert.equal(state.continue.length, mode === 'member' ? 1 : 0);
  assert.equal(state.agenda.events[0].id, 'e1');
  assert.equal(state.agenda.byEvent.e1[0].confirmed_count, 3);
}
(async () => {
  for (const scenario of ['member','guest','switch','failure']) await runScenario(scenario);
  console.log('home parallel loading: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
