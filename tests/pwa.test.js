const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

function pngDimensions(filePath) {
  const buffer = fs.readFileSync(filePath);
  assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG');
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

const manifest = JSON.parse(read('manifest.json'));
assert.equal(manifest.name, 'ADPEL');
assert.equal(manifest.short_name, 'ADPEL');
assert.equal(manifest.start_url, './');
assert.equal(manifest.scope, './');
assert.equal(manifest.display, 'standalone');
assert.equal('orientation' in manifest, false);
assert.equal('screenshots' in manifest, false);

for (const icon of manifest.icons) {
  assert.doesNotMatch(icon.src, /^(?:https?:)?\/\//i);
  const iconPath = path.join(projectRoot, icon.src);
  assert.equal(fs.existsSync(iconPath), true, `Ícone ausente: ${icon.src}`);
  const [declaredWidth, declaredHeight] = icon.sizes.split('x').map(Number);
  assert.deepEqual(pngDimensions(iconPath), {
    width: declaredWidth,
    height: declaredHeight
  });
}

assert.equal(manifest.icons.some((icon) => icon.sizes === '192x192' && icon.purpose === 'any'), true);
assert.equal(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'any'), true);
assert.equal(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'maskable'), true);

const indexHtml = read('index.html');
assert.match(indexHtml, /apple-mobile-web-app-capable" content="yes"/);
assert.match(indexHtml, /apple-mobile-web-app-title" content="ADPEL"/);
assert.match(indexHtml, /apple-touch-icon" sizes="180x180" href="images\/apple-touch-icon\.png"/);
assert.match(indexHtml, /navigator\.serviceWorker\.register\('\.\/sw\.js'/);
assert.match(indexHtml, /updateViaCache: 'none'/);
assert.doesNotMatch(indexHtml, /Sempre mostra após 3 segundos/);
assert.doesNotMatch(indexHtml, /Acesso rápido e offline/);
assert.doesNotMatch(indexHtml, /huggingface\.co/);
assert.match(indexHtml, /href="bible\.html"/);
assert.match(indexHtml, /href="harpa\.html"/);
assert.match(indexHtml, /window\.location\.href='admin\.html'/);
assert.match(read('js/profile.js'), /certificate-print\.html\?id=/);

for (const htmlFile of ['index.html', 'bible.html', 'harpa.html', 'admin.html', 'certificate-print.html']) {
  const html = read(htmlFile);
  const faviconMatch = html.match(/rel="icon"[^>]+href="([^"]+)"/);
  assert.ok(faviconMatch, `Favicon ausente em ${htmlFile}`);
  assert.equal(fs.existsSync(path.join(projectRoot, faviconMatch[1])), true);
}

const offlineHtml = read('offline.html');
assert.match(offlineHtml, /Você está sem conexão/);
assert.match(offlineHtml, /addEventListener\('online'/);

const swSource = read('sw.js');
assert.doesNotMatch(swSource, /CACHE_VERSION/);
assert.match(swSource, /request\.method !== 'GET'/);
assert.match(swSource, /isSensitiveOrDynamicRequest/);
assert.match(swSource, /'\/auth\/v1\/'/);
assert.match(swSource, /'\/rest\/v1\/'/);
assert.match(swSource, /'\/storage\/v1\/'/);
assert.match(swSource, /'\/functions\/v1\/'/);
assert.match(swSource, /fetch\(request, \{ cache: 'no-store' \}\)/);
assert.match(swSource, /caches\.match\(OFFLINE_URL/);
assert.match(swSource, /event\.data\.type === 'SKIP_WAITING'/);

const handlers = {};
const stores = new Map();
let claimed = false;
let skippedWaiting = false;
let fetchHandler = async () => new Response('network', { status: 200 });
const origin = 'https://adpel.example';

function normalizeKey(request) {
  const value = typeof request === 'string' ? request : request.url;
  return new URL(value, origin + '/sw.js').href;
}

class MemoryCache {
  constructor() {
    this.entries = new Map();
  }

  async addAll(urls) {
    for (const url of urls) {
      const absoluteUrl = normalizeKey(url);
      const body = url === './offline.html' ? offlineHtml : `precache:${url}`;
      this.entries.set(absoluteUrl, new Response(body, { status: 200 }));
    }
  }

  async match(request) {
    const response = this.entries.get(normalizeKey(request));
    return response ? response.clone() : undefined;
  }

  async put(request, response) {
    this.entries.set(normalizeKey(request), response.clone());
  }

  async keys() {
    return [...this.entries.keys()].map((url) => ({ url }));
  }

  async delete(request) {
    return this.entries.delete(normalizeKey(request));
  }
}

const cacheApi = {
  async open(name) {
    if (!stores.has(name)) stores.set(name, new MemoryCache());
    return stores.get(name);
  },
  async keys() {
    return [...stores.keys()];
  },
  async delete(name) {
    return stores.delete(name);
  },
  async match(request, options = {}) {
    if (options.cacheName) {
      const cache = stores.get(options.cacheName);
      return cache ? cache.match(request) : undefined;
    }
    for (const cache of stores.values()) {
      const response = await cache.match(request);
      if (response) return response;
    }
    return undefined;
  }
};

const context = {
  URL,
  Response,
  Promise,
  Set,
  console,
  caches: cacheApi,
  fetch: (...args) => fetchHandler(...args),
  self: {
    location: { origin, href: origin + '/sw.js' },
    addEventListener(type, handler) {
      handlers[type] = handler;
    },
    skipWaiting() {
      skippedWaiting = true;
    },
    clients: {
      async claim() {
        claimed = true;
      }
    },
    registration: { showNotification: async () => {} }
  },
  clients: { matchAll: async () => [], openWindow: async () => {} }
};

vm.runInNewContext(swSource, context, { filename: 'sw.js' });

async function dispatchWaitable(type, extra = {}) {
  let completion;
  handlers[type]({
    ...extra,
    waitUntil(promise) {
      completion = Promise.resolve(promise);
    }
  });
  if (completion) await completion;
}

async function dispatchFetch(request) {
  let responsePromise;
  handlers.fetch({
    request,
    respondWith(promise) {
      responsePromise = Promise.resolve(promise);
    }
  });
  return responsePromise;
}

(async () => {
  await dispatchWaitable('install');
  assert.equal(stores.has('adpel-pwa-precache'), true);

  const precache = await cacheApi.open('adpel-pwa-precache');
  await precache.put(origin + '/obsolete.png', new Response('obsoleto', { status: 200 }));
  stores.set('adpel-pwa-v1.0.4', new MemoryCache());
  await dispatchWaitable('activate');
  assert.equal(stores.has('adpel-pwa-v1.0.4'), false);
  assert.equal(await precache.match(origin + '/obsolete.png'), undefined);
  assert.equal(claimed, true);

  await dispatchWaitable('message', { data: { type: 'SKIP_WAITING' } });
  assert.equal(skippedWaiting, true);

  fetchHandler = async () => new Response('html-atual', { status: 200 });
  let response = await dispatchFetch({
    url: origin + '/',
    method: 'GET',
    mode: 'navigate',
    destination: 'document'
  });
  assert.equal(await response.text(), 'html-atual');

  fetchHandler = async () => { throw new Error('offline'); };
  response = await dispatchFetch({
    url: origin + '/',
    method: 'GET',
    mode: 'navigate',
    destination: 'document'
  });
  assert.match(await response.text(), /Você está sem conexão/);

  response = await dispatchFetch({
    url: origin + '/images/icon-192.png',
    method: 'GET',
    mode: 'same-origin',
    destination: 'image'
  });
  assert.equal(await response.text(), 'precache:./images/icon-192.png');

  const runtime = await cacheApi.open('adpel-pwa-runtime');
  await runtime.put(origin + '/script.js', new Response('js-antigo', { status: 200 }));
  fetchHandler = async () => new Response('js-atual', { status: 200 });
  response = await dispatchFetch({
    url: origin + '/script.js',
    method: 'GET',
    mode: 'same-origin',
    destination: 'script'
  });
  assert.equal(await response.text(), 'js-atual');

  const externalResponse = await dispatchFetch({
    url: 'https://project.supabase.co/rest/v1/profiles',
    method: 'GET',
    mode: 'cors',
    destination: ''
  });
  assert.equal(externalResponse, undefined);

  const localApiResponse = await dispatchFetch({
    url: origin + '/api/private',
    method: 'GET',
    mode: 'same-origin',
    destination: ''
  });
  assert.equal(localApiResponse, undefined);

  const postResponse = await dispatchFetch({
    url: origin + '/submit',
    method: 'POST',
    mode: 'same-origin',
    destination: ''
  });
  assert.equal(postResponse, undefined);

  console.log('pwa: all assertions passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
