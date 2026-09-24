const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(projectRoot, file), 'utf8');

const permissionsSource = read('js/permissions.js');
const context = {
  URL,
  console,
  window: { location: { origin: 'https://app.adpel.example' } }
};
vm.runInNewContext(permissionsSource, context, { filename: 'js/permissions.js' });

const course = {
  title: 'Igreja d\'Água "Viva" 🙏',
  description: 'Formação, oração e comunhão 🔥',
  lessons: [{ title: 'Aula "Um"', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }]
};
const encodedCourse = context.window.encodeInlineJson(course);
assert.equal(encodedCourse.includes("'"), false);
assert.deepEqual(JSON.parse(decodeURIComponent(encodedCourse)), course);

assert.equal(
  context.window.safeNavigationUrl('https://piqlrjzlepcpqootpyvq.supabase.co/storage/v1/object/public/uploads/book.pdf'),
  'https://piqlrjzlepcpqootpyvq.supabase.co/storage/v1/object/public/uploads/book.pdf'
);
assert.equal(
  context.window.safeExternalUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
);
assert.equal(context.window.safeExternalUrl('https://maps.google.com/?q=ADPEL'), 'https://maps.google.com/?q=ADPEL');
assert.equal(context.window.safeNavigationUrl('#community'), '#community');

const supabaseSource = read('supabase.js');
assert.match(supabaseSource, /from\('home_sections'\).*order\('display_order'/);
assert.doesNotMatch(supabaseSource, /from\('home_sections'\).*order\('order'/);

const communitySource = read('js/community.js');
assert.match(communitySource, /from\('community_posts'\)\s*\.delete\(\)/);
assert.doesNotMatch(communitySource, /update\(\{\s*status:\s*'removed'/);
assert.match(communitySource, /Excluir permanentemente esta publicação/);

const adminCommunitySource = read('admin/community-management.js');
assert.match(adminCommunitySource, /\.in\('status', \['published', 'hidden'\]\)/);
assert.match(adminCommunitySource, /Excluir permanentemente/);

assert.doesNotMatch(read('admin/crud-certificates.js'), /select\('id, full_name, email'\)/);
assert.doesNotMatch(read('certificate-print.js'), /select\('full_name, name, email'\)/);
assert.doesNotMatch(read('js/profile.js'), /select\([^\n]*photo_url/);
assert.doesNotMatch(read('js/community.js'), /select\([^\n]*photo_url/);
assert.doesNotMatch(read('spiritual-progress.js'), /select\([^\n]*photo_url/);

[
  'index.html',
  'admin.html',
  'bible.html',
  'harpa.html',
  'certificate-print.html'
].forEach((file) => {
  assert.match(
    read(file),
    /<link rel="icon" type="image\/png" sizes="32x32" href="images\/favicon-32\.png">/
  );
});

console.log('functional-consistency: all assertions passed');
