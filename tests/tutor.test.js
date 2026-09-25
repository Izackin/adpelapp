const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

global.window = {};
const tutor = require('../js/tutor.js');

assert.equal(tutor.MAX_QUESTION_CHARS, 4000);
assert.equal(tutor.friendlyError('AUTH_REQUIRED'), 'Entre novamente para continuar usando o Tutor.');
assert.equal(tutor.friendlyError('HOURLY_LIMIT_REACHED').includes('limite'), true);
assert.equal(tutor.friendlyError('REQUEST_TIMEOUT').includes('demorando'), true);
assert.equal(tutor.sourceClassLabel('official_local'), 'Documento oficial ADPEL');
assert.equal(tutor.normalizeCitationId('【F12】'), 'F12');
assert.equal(tutor.normalizeCitationId('[B1]'), 'B1');

const bibleContext = {
  book_id: 'JHN', book_name: 'João', chapter: 3,
  verse_start: 16, verse_end: 18, translation_code: 'acf'
};
assert.deepEqual(tutor.normalizeBibleContext(bibleContext), bibleContext);
assert.equal(tutor.normalizeBibleContext({ ...bibleContext, chapter: 0 }), null);
assert.deepEqual(tutor.buildRequestBody('  Explique este trecho  ', bibleContext), {
  question: 'Explique este trecho',
  translation_code: 'acf',
  bible_reference: bibleContext
});
assert.deepEqual(tutor.buildRequestBody('Pergunta sem passagem'), { question: 'Pergunta sem passagem' });
assert.equal(tutor.bibleReferenceLabel(bibleContext), 'João 3:16–18 · ACF');

const safeBlocks = tutor.parseSafeBlocks('# Título\n\n<script>alert(1)</script> **seguro** 【F1】\n\n- item');
assert.deepEqual(safeBlocks.map((block) => block.type), ['heading', 'paragraph', 'unordered-list']);
assert.equal(safeBlocks[1].text.includes('<script>alert(1)</script>'), true);

const source = read('js/tutor.js');
const index = read('index.html');
const navigation = read('js/navigation.js');
const appShell = read('js/app-shell.js');
const auth = read('auth.js');
const bible = read('js/bible.js');
const css = read('tutor.css');

assert.match(source, /functions\.invoke\('tutor-teologico'/);
assert.match(source, /supabaseClient\.auth\.getSession\(\)/);
assert.match(source, /document\.createTextNode/);
assert.match(source, /textContent/);
assert.match(source, /replaceChildren/);
assert.doesNotMatch(source, /innerHTML|localStorage|sessionStorage/);
assert.doesNotMatch(source, /ia-chat|openrouter|service[_-]?role|SUPABASE_SERVICE_ROLE_KEY/i);
assert.doesNotMatch(source, /similarity|authority|usage|cost|model/i);

assert.match(index, /id="tutor"/);
assert.match(index, /onclick="navigateTo\('tutor'\)"/);
assert.match(index, /src="js\/tutor\.js"/);
assert.match(index, /href="tutor\.css"/);
assert.match(index, /maxlength="4000"/);
assert.match(index, /id="tutor-submit" class="tutor-submit"/);
assert.match(index, /id="tutor-live-status"[^>]*aria-live="polite"/);
assert.match(index, /data-tutor-action="login"/);
assert.match(navigation, /case 'tutor'/);
assert.match(navigation, /'word','tutor','learn'/);
assert.match(appShell, /tutor: 'word'/);
assert.equal([...appShell.matchAll(/label: '([^']+)'/g)].length, 5);
assert.match(auth, /ADPELTutor\.handleAuthChange/);

assert.match(bible, /data-bible-action="tutor"/);
assert.match(bible, /openTutorForSelection/);
assert.match(bible, /book_id: selection\.book_id/);
assert.match(bible, /translation_code: selection\.translation_code/);
assert.doesNotMatch(bible.slice(bible.indexOf('function openTutorForSelection'), bible.indexOf('function renderProgress')), /text:\s*selection\.text/);

assert.match(css, /env\(safe-area-inset-bottom\)/);
assert.match(css, /focus-visible/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /min-height: 44px/);

console.log('tutor: all assertions passed');
