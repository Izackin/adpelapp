const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

global.window = {};
global.document = { addEventListener() {} };
const { normalize, parseReference, makeReferenceLabel, clampFontSize, buildSelectionPayload } = require('../js/bible.js');

const books = [
  { id: 'GEN', name_pt: 'Gênesis', chapter_count: 50, aliases: ['genesis', 'gn'] },
  { id: 'JHN', name_pt: 'João', chapter_count: 21, aliases: ['joao', 'jn', 'john'] }
];

assert.equal(normalize('  João  '), 'joao');
assert.deepEqual(parseReference('João 3:16', books), { book: books[1], chapter: 3, verseStart: 16, verseEnd: 16 });
assert.deepEqual(parseReference('Jn 3:16-18', books), { book: books[1], chapter: 3, verseStart: 16, verseEnd: 18 });
assert.equal(parseReference('João 99', books), null);
assert.equal(makeReferenceLabel('João', 3, 16, 18), 'João 3:16–18');
assert.equal(clampFontSize(2), 14);
assert.equal(clampFontSize(99), 26);
assert.equal(clampFontSize(20), 20);

assert.deepEqual(buildSelectionPayload({
  book_id: 'JHN', book_name: 'João', chapter: 3, verse_start: 16, verse_end: 17
}, [
  { verse: 15, text: 'fora' }, { verse: 16, text: 'primeiro' }, { verse: 17, text: 'segundo' }
], 'onbv'), {
  translation_code: 'onbv', book_id: 'JHN', book_name: 'João', chapter: 3,
  verse_start: 16, verse_end: 17, text: 'primeiro segundo'
});

const source = read('js/bible.js');
assert.match(source, /bible_translations/);
assert.match(source, /translation_id/);
assert.match(source, /\.eq\('translation_id', state\.translation\.id\)/);
assert.match(source, /savePreferences\(\{ translation_code: state\.translation\.code \}\)/);
assert.match(source, /resultado\(s\) em \$\{state\.translation\.short_name\}/i);
assert.match(source, /window\.ADPELBibleProviders/);
assert.match(source, /getSelectionPayload/);
assert.match(source, /navigator\.share/);
assert.match(source, /user_bible_preferences/);
assert.match(source, /bible_completed_books/);
assert.equal((source.match(/registerChapterRead/g) || []).length, 2); // teste + chamada, sem carga automática
assert.doesNotMatch(source.slice(source.indexOf('async function loadChapter'), source.indexOf('function renderChapter')), /registerChapterRead|registerBookCompleted/);
assert.doesNotMatch(source, /service_role|SUPABASE_SERVICE_ROLE_KEY/);

for (const htmlFile of ['index.html', 'bible.html']) {
  const html = read(htmlFile);
  assert.match(html, /href="bible\.css"/);
  assert.match(html, /(?:src=")?js\/bible\.js(?:\?v=bible-2\.0)?/);
  assert.match(html, /id="bible-book-select"/);
  assert.match(html, /id="bible-search-input"/);
}
assert.doesNotMatch(read('bible.html'), /const bibleBooks|registerChapterRead/);

const migration = read('supabase/migrations/20260924140312_bible_2_multiversion_personal_study.sql');
for (const table of [
  'bible_books', 'bible_translations', 'bible_highlights', 'bible_notes',
  'bible_bookmarks', 'bible_reading_progress', 'bible_completed_books', 'user_bible_preferences'
]) assert.match(migration, new RegExp(`public\\.${table}`));

assert.match(migration, /is_canonical boolean not null default true/);
assert.match(migration, /Active Bible verses are public/);
assert.match(migration, /auth\.uid\(\)\) = user_id/);
assert.doesNotMatch(migration, /is_master|role\s*=\s*'master'/i);
assert.match(migration, /revoke all on public\.bible_books, public\.bible_translations, public\.bible_verses/);
assert.match(migration, /grant select on public\.bible_books, public\.bible_translations, public\.bible_verses/);
assert.match(migration, /unique \(user_id, book_id, chapter, verse_start, verse_end\)/);
assert.match(migration, /primary key \(user_id, book_id, chapter\)/);

const importer = read('scripts/import-bible-translation.mjs');
assert.match(importer, /--validate-only/);
assert.match(importer, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(importer, /is_active: translation\?\.is_active \|\| false/);
assert.match(importer, /referência duplicada/);

console.log('Bible ADPEL 2.0 tests passed.');
