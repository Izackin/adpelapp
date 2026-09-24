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

const remainingRlsMigration = fs.readFileSync(
  path.join(
    projectRoot,
    'supabase',
    'migrations',
    '20260924123039_harden_remaining_rls_and_profile_privacy.sql'
  ),
  'utf8'
);
const publicProfilesInvokerMigration = fs.readFileSync(
  path.join(
    projectRoot,
    'supabase',
    'migrations',
    '20260924123815_make_public_profiles_view_security_invoker.sql'
  ),
  'utf8'
);
const authProfileReconciliationMigration = fs.readFileSync(
  path.join(
    projectRoot,
    'supabase',
    'migrations',
    '20260924130216_reconcile_auth_profile_registration.sql'
  ),
  'utf8'
);

assert.match(remainingRlsMigration, /push_subscriptions_insert_own[\s\S]*user_id = \(select auth\.uid\(\)\)/);
assert.match(remainingRlsMigration, /certificates_insert_own_or_master[\s\S]*user_id = \(select auth\.uid\(\)\)/);
assert.match(remainingRlsMigration, /app_updates_master_insert[\s\S]*is_admin_master\(\)/);
assert.match(remainingRlsMigration, /case when show_phone is true then phone else null end as phone/);
assert.match(remainingRlsMigration, /where coalesce\(show_public_profile, true\) is true/);
assert.match(publicProfilesInvokerMigration, /security_invoker = true/);
assert.match(publicProfilesInvokerMigration, /security definer[\s\S]*set search_path = pg_catalog/);
assert.match(publicProfilesInvokerMigration, /case when profile\.show_phone is true then profile\.phone else null end/);
assert.match(authProfileReconciliationMigration, /security definer[\s\S]*set search_path = pg_catalog/);
assert.match(authProfileReconciliationMigration, /insert into public\.profiles[\s\S]*'user'/);
assert.match(authProfileReconciliationMigration, /revoke all on function public\.handle_new_user\(\) from public, anon, authenticated/);
assert.match(authProfileReconciliationMigration, /new\.role := 'user'/);
assert.doesNotMatch(authProfileReconciliationMigration, /'member'/);
assert.equal(
  fs.existsSync(
    path.join(
      projectRoot,
      'supabase',
      'migrations',
      '20260710120000_fix_user_registration_profile_trigger.sql'
    )
  ),
  false
);

[
  path.join(projectRoot, 'js', 'community.js'),
  path.join(projectRoot, 'js', 'profile.js'),
  path.join(projectRoot, 'spiritual-progress.js')
].forEach((file) => {
  assert.match(fs.readFileSync(file, 'utf8'), /\.from\('public_profiles'\)/);
});

console.log('security-hardening: all assertions passed');
