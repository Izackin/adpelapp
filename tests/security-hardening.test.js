const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(projectRoot, 'js', 'permissions.js'), 'utf8');
const context = {
  URL,
  console,
  window: {
    location: {
      origin: 'https://app.adpel.example',
      protocol: 'https:'
    }
  }
};

vm.runInNewContext(source, context, { filename: 'js/permissions.js' });

const {
  escapeHtml,
  sanitizeUrl,
  safeExternalUrl,
  safeImageUrl,
  safeNavigationUrl,
  encodeInlineJson
} = context.window;

assert.equal(
  escapeHtml('<script>alert("x")</script> & \'teste\''),
  '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#039;teste&#039;'
);

[
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '"><img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
  "'><script>alert(1)</script>"
].forEach((payload) => {
  const escaped = escapeHtml(payload);
  assert.equal(escaped.includes('<script'), false);
  assert.equal(escaped.includes('<img'), false);
  assert.equal(escaped.includes('<svg'), false);
});

const communityTextPayloads = {
  post: '<script>alert(1)</script>',
  comment: '<img src=x onerror=alert(1)>',
  publicName: '\"><img src=x onerror=alert(1)>',
  bio: '<svg onload=alert(1)>',
  fullName: "'><script>alert(1)</script>"
};
Object.values(communityTextPayloads).forEach((payload) => {
  const escaped = escapeHtml(payload);
  assert.equal(/[<>]/.test(escaped), false);
});

assert.equal(escapeHtml('João oração 🙏 🔥'), 'João oração 🙏 🔥');
assert.equal(escapeHtml('Linha 1\nLinha 2'), 'Linha 1\nLinha 2');
assert.equal(safeExternalUrl('javascript:alert(1)'), '');
assert.equal(safeExternalUrl('JaVaScRiPt:alert(1)'), '');
assert.equal(safeExternalUrl('vbscript:msgbox(1)'), '');
assert.equal(safeExternalUrl('data:text/html,<script>alert(1)</script>'), '');
assert.equal(safeExternalUrl('https://example.com/path'), 'https://example.com/path');
assert.equal(safeExternalUrl('http://example.com/path'), 'http://example.com/path');
assert.equal(safeNavigationUrl('/biblioteca/livro.pdf'), '/biblioteca/livro.pdf');
assert.equal(safeNavigationUrl('#community'), '#community');
assert.equal(safeNavigationUrl('//evil.example/path'), '');
assert.equal(
  safeImageUrl('https://piqlrjzlepcpqootpyvq.supabase.co/storage/v1/object/public/avatars/user.webp'),
  'https://piqlrjzlepcpqootpyvq.supabase.co/storage/v1/object/public/avatars/user.webp'
);
assert.equal(safeImageUrl('blob:https://app.adpel.example/test'), '');
assert.equal(safeImageUrl('javascript:alert(1)'), '');
assert.equal(safeImageUrl('data:image/svg+xml,<svg onload=alert(1)>'), '');
assert.equal(
  safeImageUrl('blob:https://app.adpel.example/test', { allowBlob: true }),
  'blob:https://app.adpel.example/test'
);
assert.equal(safeExternalUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');

const encoded = encodeInlineJson({ title: "Igreja d'Água", payload: '"><svg onload=alert(1)>' });
assert.equal(encoded.includes("'"), false);
assert.deepEqual(JSON.parse(decodeURIComponent(encoded)), {
  title: "Igreja d'Água",
  payload: '"><svg onload=alert(1)>'
});

assert.equal(sanitizeUrl(' https://example.com/a?b=1 '), 'https://example.com/a?b=1');

console.log('security-hardening: all assertions passed');
