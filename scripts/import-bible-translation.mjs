#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import process from 'node:process';

const datasetPath = process.argv.find((value) => !value.startsWith('--') && value !== process.argv[0] && value !== process.argv[1]);
const validateOnly = process.argv.includes('--validate-only');
const baseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!datasetPath) throw new Error('Uso: node scripts/import-bible-translation.mjs dataset.json [--validate-only]');
if (!baseUrl || !serviceKey) throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY somente no ambiente local.');

const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  const body = await response.text();
  return body ? JSON.parse(body) : null;
};

const source = JSON.parse(await readFile(datasetPath, 'utf8'));
const metadata = source.metadata || {};
const verses = source.verses;
const requiredMetadata = ['code', 'name', 'short_name', 'language', 'provider', 'license_type', 'attribution', 'source_url'];
for (const field of requiredMetadata) {
  if (!String(metadata[field] || '').trim()) throw new Error(`Metadado obrigatório ausente: ${field}`);
}
if (!/^[a-z0-9][a-z0-9_-]*$/.test(metadata.code)) throw new Error('metadata.code deve ser estável, minúsculo e sem espaços.');
if (metadata.source_type && metadata.source_type !== 'local') throw new Error('Este importador aceita apenas datasets locais.');
if (!Array.isArray(verses) || !verses.length) throw new Error('O dataset não possui versículos.');

const books = await request('bible_books?select=id,name_pt,chapter_count&order=book_order');
const bookById = new Map(books.map((book) => [book.id, book]));
const seen = new Set();
const problems = [];
const normalized = [];

for (let index = 0; index < verses.length; index += 1) {
  const item = verses[index];
  const book = bookById.get(String(item.book_id || '').toUpperCase());
  const chapter = Number(item.chapter);
  const verse = Number(item.verse);
  const text = typeof item.text === 'string' ? item.text : '';
  const location = `linha ${index + 1}`;
  if (!book) problems.push(`${location}: book_id inválido (${item.book_id})`);
  else if (!Number.isInteger(chapter) || chapter < 1 || chapter > book.chapter_count) problems.push(`${location}: capítulo inválido`);
  if (!Number.isInteger(verse) || verse < 1) problems.push(`${location}: versículo inválido`);
  if (!text.trim()) problems.push(`${location}: texto vazio`);
  const key = `${book?.id}:${chapter}:${verse}`;
  if (seen.has(key)) problems.push(`${location}: referência duplicada (${key})`);
  seen.add(key);
  if (book && Number.isInteger(chapter) && chapter > 0 && Number.isInteger(verse) && verse > 0 && text.trim()) {
    normalized.push({ book_id: book.id, book: book.name_pt, chapter, verse, text, is_canonical: true });
  }
}

const representedBooks = new Set(normalized.map((item) => item.book_id));
const expectedBooks = Number(metadata.expected_books || 66);
if (representedBooks.size !== expectedBooks) problems.push(`esperados ${expectedBooks} livros; encontrados ${representedBooks.size}`);
if (problems.length) throw new Error(`Dataset rejeitado (${problems.length} problema(s)):\n${problems.slice(0, 50).join('\n')}`);

console.log(`Validação concluída: ${normalized.length} versículos, ${representedBooks.size} livros, 0 duplicatas.`);
if (validateOnly) process.exit(0);

const translationPayload = {
  code: metadata.code,
  name: metadata.name,
  short_name: metadata.short_name,
  language: metadata.language,
  provider: metadata.provider,
  source_type: 'local',
  license_type: metadata.license_type,
  copyright_notice: metadata.copyright_notice || null,
  attribution: metadata.attribution,
  source_url: metadata.source_url,
  is_active: false,
  is_default: false,
  is_local: true
};
const [translation] = await request('bible_translations?on_conflict=code', {
  method: 'POST',
  headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
  body: JSON.stringify(translationPayload)
});

for (let offset = 0; offset < normalized.length; offset += 500) {
  const batch = normalized.slice(offset, offset + 500).map((item) => ({ ...item, translation_id: translation.id }));
  await request('bible_verses?on_conflict=translation_id,book_id,chapter,verse,is_canonical', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(batch)
  });
  console.log(`Importados ${Math.min(offset + batch.length, normalized.length)}/${normalized.length}`);
}

console.log(`Tradução ${metadata.code} importada inativa. Revise contagens, licença e amostras antes de ativar.`);
