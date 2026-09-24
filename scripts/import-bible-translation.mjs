#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const BOOK_DATA = [
  ['GEN','Gênesis',50],['EXO','Êxodo',40],['LEV','Levítico',27],['NUM','Números',36],['DEU','Deuteronômio',34],['JOS','Josué',24],['JDG','Juízes',21],['RUT','Rute',4],['1SA','1 Samuel',31],['2SA','2 Samuel',24],['1KI','1 Reis',22],['2KI','2 Reis',25],['1CH','1 Crônicas',29],['2CH','2 Crônicas',36],['EZR','Esdras',10],['NEH','Neemias',13],['EST','Ester',10],['JOB','Jó',42],['PSA','Salmos',150],['PRO','Provérbios',31],['ECC','Eclesiastes',12],['SNG','Cantares',8],['ISA','Isaías',66],['JER','Jeremias',52],['LAM','Lamentações',5],['EZK','Ezequiel',48],['DAN','Daniel',12],['HOS','Oseias',14],['JOL','Joel',3],['AMO','Amós',9],['OBA','Obadias',1],['JON','Jonas',4],['MIC','Miqueias',7],['NAM','Naum',3],['HAB','Habacuque',3],['ZEP','Sofonias',3],['HAG','Ageu',2],['ZEC','Zacarias',14],['MAL','Malaquias',4],['MAT','Mateus',28],['MRK','Marcos',16],['LUK','Lucas',24],['JHN','João',21],['ACT','Atos',28],['ROM','Romanos',16],['1CO','1 Coríntios',16],['2CO','2 Coríntios',13],['GAL','Gálatas',6],['EPH','Efésios',6],['PHP','Filipenses',4],['COL','Colossenses',4],['1TH','1 Tessalonicenses',5],['2TH','2 Tessalonicenses',3],['1TI','1 Timóteo',6],['2TI','2 Timóteo',4],['TIT','Tito',3],['PHM','Filemom',1],['HEB','Hebreus',13],['JAS','Tiago',5],['1PE','1 Pedro',5],['2PE','2 Pedro',3],['1JN','1 João',5],['2JN','2 João',1],['3JN','3 João',1],['JUD','Judas',1],['REV','Apocalipse',22]
];
export const BIBLE_BOOKS = BOOK_DATA.map(([id, name, chapterCount], index) => ({ id, name, chapterCount, order: index + 1 }));
const BOOK_BY_ID = new Map(BIBLE_BOOKS.map((book) => [book.id, book]));

const LINE_TEXT_MARKERS = new Set(['p','m','q','q1','q2','q3','q4','li','li1','li2','li3','li4','lf','pi','pi1','pi2','pi3','mi','nb','pc','pr','cls']);
const LINE_DISCARD_MARKERS = new Set(['id','ide','h','h1','h2','h3','toc1','toc2','toc3','mt','mt1','mt2','mt3','mte','mte1','mte2','s','s1','s2','s3','s4','sr','r','d','sp','qa','b','lh','cl','cp','rem','sts','restore']);
const INLINE_KEEP_MARKERS = new Set(['add','bd','bdit','bk','dc','em','it','k','litl','nd','no','ord','pn','pro','qt','sc','sig','sls','sup','tl','wj','+add','+bd','+it','+nd','+qt','+wj']);
const NOTE_MARKERS = new Set(['f','fe','ef','x','ex']);
const NOTE_SUBMARKERS = new Set(['fr','fk','fq','fqa','fl','ft','fw','fp','fv','fdc','fm','xo','xk','xq','xt','+xt','xta','xop','xot','xnt','xdc']);
const SPECIAL_MARKERS = new Set(['c','v','ca','va','vp','w','wg','wh','wa','fig','rq','qt-s','qt-e']);
const ALL_ALLOWED_MARKERS = new Set([...LINE_TEXT_MARKERS, ...LINE_DISCARD_MARKERS, ...INLINE_KEEP_MARKERS, ...NOTE_MARKERS, ...NOTE_SUBMARKERS, ...SPECIAL_MARKERS]);
const SAMPLE_CHAPTERS = [['GEN',1],['PSA',23],['ISA',53],['MAT',5],['JHN',1],['JHN',3],['ROM',8],['1CO',13],['HEB',11],['REV',22]];

function normalizeWhitespace(value) {
  return value.replace(/[\t\f\v ]+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();
}

function markerNames(value) {
  return [...value.matchAll(/\\([A-Za-z0-9]+(?:-[se])?|\+[A-Za-z0-9]+)/g)].map((match) => match[1]);
}

export function cleanUsfmVerse(raw, location = 'versículo') {
  for (const marker of markerNames(raw)) if (!ALL_ALLOWED_MARKERS.has(marker)) throw new Error(`${location}: marcador USFM desconhecido (\\${marker})`);
  let text = raw;
  text = text.replace(/\\(?:f|fe|ef|x|ex)\s+[\s\S]*?\\(?:f|fe|ef|x|ex)\*/g, ' ');
  text = text.replace(/\\(?:fig|rq)\s+[\s\S]*?\\(?:fig|rq)\*/g, ' ');
  text = text.replace(/\\w\s+([^|\\]+)(?:\|[^\\]*?)?\\w\*/g, '$1');
  text = text.replace(/\\(?:wg|wh|wa)\s+([^|\\]+)(?:\|[^\\]*?)?\\(?:wg|wh|wa)\*/g, '$1');
  text = text.replace(/\\(?:qt-[se])\b/g, '');
  text = text.replace(/\\(?:\+)?(?:add|bd|bdit|bk|dc|em|it|k|litl|nd|no|ord|pn|pro|qt|sc|sig|sls|sup|tl|wj)\*?/g, '');
  text = text.replace(/\\(?:ca|va|vp)\s+[^\\]*?\\(?:ca|va|vp)\*/g, '');
  if (/\\[A-Za-z+]/.test(text)) throw new Error(`${location}: marcador USFM residual após conversão`);
  return normalizeWhitespace(text);
}

function parseVerseNumber(label, location) {
  if (/^\d+$/.test(label)) return Number(label);
  if (/^\d+(?:-\d+|[a-z])$/i.test(label)) throw new Error(`${location}: versificação composta (${label}) não cabe no modelo inteiro atual; importação interrompida`);
  throw new Error(`${location}: identificador de versículo inválido (${label})`);
}

export function parseUsfm(content, sourceName = 'USFM') {
  const lines = String(content).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const idMatch = lines.find((line) => /^\\id\s+/.test(line.trim()))?.trim().match(/^\\id\s+([A-Z0-9]{3})\b/);
  if (!idMatch) throw new Error(`${sourceName}: marcador \\id ausente ou inválido`);
  const bookId = idMatch[1];
  if (!BOOK_BY_ID.has(bookId)) throw new Error(`${sourceName}: livro desconhecido (${bookId})`);
  let chapter = null;
  let current = null;
  const verses = [];
  const finishVerse = () => {
    if (!current) return;
    const location = `${bookId} ${current.chapter}:${current.verse}`;
    const text = cleanUsfmVerse(current.fragments.join(' '), location);
    verses.push({ book_id: bookId, book: BOOK_BY_ID.get(bookId).name, chapter: current.chapter, verse: current.verse, text, is_canonical: true });
    current = null;
  };
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    let line = lines[lineIndex].trim();
    if (!line) continue;
    const location = `${sourceName}:${lineIndex + 1}`;
    const leading = line.match(/^\\([^\s]+)\s*(.*)$/s);
    if (!leading) { if (current) current.fragments.push(line); continue; }
    let marker = leading[1];
    let rest = leading[2];
    if (LINE_TEXT_MARKERS.has(marker) && /^\\v\s+/.test(rest)) {
      const nested = rest.match(/^\\([^\s]+)\s*(.*)$/s);
      marker = nested[1]; rest = nested[2];
    }
    if (marker === 'id') continue;
    if (marker === 'c') {
      finishVerse();
      const match = rest.match(/^(\d+)\b/);
      if (!match) throw new Error(`${location}: capítulo inválido`);
      chapter = Number(match[1]);
      continue;
    }
    if (marker === 'v') {
      finishVerse();
      if (!chapter) throw new Error(`${location}: versículo antes do capítulo`);
      const match = rest.match(/^(\S+)\s*(.*)$/s);
      if (!match) throw new Error(`${location}: versículo sem identificador`);
      current = { chapter, verse: parseVerseNumber(match[1], location), fragments: [match[2]] };
      continue;
    }
    if (!ALL_ALLOWED_MARKERS.has(marker)) throw new Error(`${location}: marcador USFM desconhecido (\\${marker})`);
    if (LINE_TEXT_MARKERS.has(marker)) {
      if (current && rest) current.fragments.push(rest);
    } else if (!LINE_DISCARD_MARKERS.has(marker) && current) current.fragments.push(line);
  }
  finishVerse();
  return { bookId, verses };
}

export function decodeUtf8(bytes, sourceName = 'arquivo') {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new Error(`${sourceName}: arquivo não é UTF-8 válido`); }
}

async function readUtf8(file) {
  const bytes = await readFile(file);
  try { return decodeUtf8(bytes, file); }
  catch { throw new Error(`${file}: arquivo não é UTF-8 válido`); }
}

async function findUsfmFiles(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await findUsfmFiles(target));
    else if (entry.isFile() && /\.usfm$/i.test(entry.name)) found.push(target);
  }
  return found;
}

export async function loadUsfmDirectory(directory) {
  if (!(await stat(directory)).isDirectory()) throw new Error(`Fonte USFM não é diretório: ${directory}`);
  const files = await findUsfmFiles(directory);
  if (!files.length) throw new Error(`Nenhum arquivo .usfm encontrado em ${directory}`);
  const parsed = [];
  for (const file of files) parsed.push(parseUsfm(await readUtf8(file), file));
  parsed.sort((a, b) => BOOK_BY_ID.get(a.bookId).order - BOOK_BY_ID.get(b.bookId).order);
  return parsed.flatMap((book) => book.verses);
}

export function validateDataset(metadata, verses) {
  const problems = [];
  const warnings = [];
  const required = ['code','name','short_name','language','provider','source_type','license_type','copyright_notice','attribution','source_url','source_version','obtained_at','sha256'];
  for (const field of required) if (!String(metadata[field] ?? '').trim()) problems.push(`metadado obrigatório ausente: ${field}`);
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(metadata.code || '')) problems.push('code deve ser minúsculo, estável e sem espaços');
  if (metadata.source_type !== 'local') problems.push('source_type deve ser local');
  if (!['A','B','C','D'].includes(metadata.classification)) problems.push('classification deve ser A, B, C ou D');
  if (typeof metadata.production_ready !== 'boolean') problems.push('production_ready deve ser booleano');
  if (metadata.production_ready && metadata.classification !== 'A') problems.push('somente fonte classe A pode estar pronta para produção');
  if (!/^https:\/\//.test(metadata.source_url || '')) problems.push('source_url deve usar HTTPS');
  if (!/^[a-f0-9]{64}$/.test(metadata.sha256 || '')) problems.push('sha256 inválido');
  if (!Array.isArray(verses) || !verses.length) problems.push('dataset sem versículos');
  const seen = new Set();
  const books = new Set();
  const chapters = new Set();
  const perChapter = new Map();
  let previousOrder = -1;
  for (let index = 0; index < (verses || []).length; index += 1) {
    const item = verses[index];
    const book = BOOK_BY_ID.get(item.book_id);
    const location = `registro ${index + 1}`;
    if (!book) { problems.push(`${location}: livro desconhecido (${item.book_id})`); continue; }
    if (!Number.isInteger(item.chapter) || item.chapter < 1 || item.chapter > book.chapterCount) problems.push(`${location}: capítulo impossível (${item.chapter})`);
    if (!Number.isInteger(item.verse) || item.verse < 1 || item.verse > 200) problems.push(`${location}: versículo impossível (${item.verse})`);
    if (typeof item.text !== 'string' || !item.text.trim()) problems.push(`${location}: texto vazio`);
    if (/\uFFFD|Ã[§£¡©³ªµº]|Â[©® ]|â€/.test(item.text || '')) problems.push(`${location}: possível encoding corrompido`);
    if (/\\[A-Za-z+]/.test(item.text || '')) problems.push(`${location}: marcador USFM residual`);
    if (/<\/?[A-Za-z][^>]*>/.test(item.text || '')) problems.push(`${location}: HTML residual`);
    const key = `${item.book_id}:${item.chapter}:${item.verse}`;
    if (seen.has(key)) problems.push(`${location}: referência duplicada (${key})`);
    const currentOrder = book.order * 1_000_000 + Number(item.chapter) * 1_000 + Number(item.verse);
    if (currentOrder < previousOrder) problems.push(`${location}: referências fora da ordem canônica`);
    previousOrder = currentOrder;
    seen.add(key); books.add(item.book_id); chapters.add(`${item.book_id}:${item.chapter}`);
    const chapterKey = `${item.book_id}:${item.chapter}`;
    if (!perChapter.has(chapterKey)) perChapter.set(chapterKey, []);
    perChapter.get(chapterKey).push(item.verse);
  }
  const expectedBooks = Number(metadata.expected_books || 66);
  if (books.size !== expectedBooks) problems.push(`esperados ${expectedBooks} livros; encontrados ${books.size}`);
  if (metadata.expected_chapters && chapters.size !== Number(metadata.expected_chapters)) problems.push(`esperados ${metadata.expected_chapters} capítulos; encontrados ${chapters.size}`);
  if (metadata.expected_references && seen.size !== Number(metadata.expected_references)) problems.push(`esperadas ${metadata.expected_references} referências; encontradas ${seen.size}`);
  if (expectedBooks === 66) {
    for (const book of BIBLE_BOOKS) {
      if (!books.has(book.id)) problems.push(`livro esperado ausente: ${book.id}`);
      for (let chapter = 1; chapter <= book.chapterCount; chapter += 1) if (!chapters.has(`${book.id}:${chapter}`)) problems.push(`capítulo esperado ausente: ${book.id} ${chapter}`);
    }
  }
  for (const [chapterKey, numbers] of perChapter) {
    const sorted = [...numbers].sort((a, b) => a - b);
    const gaps = sorted.filter((number, index) => index && number > sorted[index - 1] + 1);
    if (gaps.length) warnings.push(`${chapterKey}: versificação possui lacuna(s); preservada sem preenchimento artificial`);
  }
  if (problems.length) throw new Error(`Dataset rejeitado (${problems.length} problema(s)):\n${problems.slice(0, 80).join('\n')}`);
  return { books: books.size, chapters: chapters.size, references: seen.size, warnings };
}

export function buildSampleReport(verses) {
  return SAMPLE_CHAPTERS.map(([bookId, chapter]) => {
    const rows = verses.filter((item) => item.book_id === bookId && item.chapter === chapter);
    const serialized = JSON.stringify(rows.map(({ verse, text }) => ({ verse, text })));
    if (serialized !== JSON.stringify(JSON.parse(serialized)) || !rows.length) throw new Error(`Amostra inválida: ${bookId} ${chapter}`);
    return { reference: `${bookId} ${chapter}`, verses: rows.length, sha256: createHash('sha256').update(serialized).digest('hex') };
  });
}

export async function sha256File(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

function sqlLiteral(value) { return `'${String(value).replaceAll("'", "''")}'`; }

export async function emitSqlBatches(directory, metadata, verses, batchSize = 1000) {
  await mkdir(directory, { recursive: true });
  const columns = ['code','name','short_name','language','provider','source_type','license_type','copyright_notice','attribution','source_url'];
  const values = columns.map((column) => sqlLiteral(metadata[column])).join(', ');
  const update = columns.filter((column) => column !== 'code').map((column) => `${column}=excluded.${column}`).join(', ');
  await writeFile(path.join(directory, '000-translation.sql'), `insert into public.bible_translations (${columns.join(', ')}, is_active, is_default, is_local)\nvalues (${values}, false, false, true)\non conflict (code) do update set ${update}, updated_at=now();\n`, 'utf8');
  for (let offset = 0; offset < verses.length; offset += batchSize) {
    const payload = JSON.stringify(verses.slice(offset, offset + batchSize).map(({ book_id, book, chapter, verse, text }) => ({ book_id, book, chapter, verse, text })));
    const sql = `do $import$\ndeclare payload jsonb := $json$${payload}$json$::jsonb; translation uuid;\nbegin\n  select id into strict translation from public.bible_translations where code=${sqlLiteral(metadata.code)};\n  if exists (select 1 from jsonb_to_recordset(payload) as x(book_id text, book text, chapter smallint, verse smallint, text text) join public.bible_verses v on v.translation_id=translation and v.book_id=x.book_id and v.chapter=x.chapter and v.verse=x.verse and v.is_canonical where v.text is distinct from x.text) then raise exception 'Conflito textual inesperado em ${metadata.code}'; end if;\n  insert into public.bible_verses (translation_id, book_id, book, chapter, verse, text, is_canonical)\n  select translation, x.book_id, x.book, x.chapter, x.verse, x.text, true from jsonb_to_recordset(payload) as x(book_id text, book text, chapter smallint, verse smallint, text text)\n  on conflict (translation_id, book_id, chapter, verse, is_canonical) do nothing;\nend\n$import$;\n`;
    await writeFile(path.join(directory, `${String(offset / batchSize + 1).padStart(3, '0')}-verses.sql`), sql, 'utf8');
  }
  await writeFile(path.join(directory, '997-post-import.sql'), `do $verify$\nbegin\n  if (select count(*) from public.bible_verses v join public.bible_translations t on t.id=v.translation_id where t.code=${sqlLiteral(metadata.code)} and v.is_canonical) <> ${Number(metadata.expected_references)} then raise exception 'Contagem de referências inválida'; end if;\n  if (select count(distinct v.book_id) from public.bible_verses v join public.bible_translations t on t.id=v.translation_id where t.code=${sqlLiteral(metadata.code)} and v.is_canonical) <> ${Number(metadata.expected_books)} then raise exception 'Contagem de livros inválida'; end if;\n  if (select count(distinct (v.book_id,v.chapter)) from public.bible_verses v join public.bible_translations t on t.id=v.translation_id where t.code=${sqlLiteral(metadata.code)} and v.is_canonical) <> ${Number(metadata.expected_chapters)} then raise exception 'Contagem de capítulos inválida'; end if;\n  if exists (select 1 from public.bible_verses v join public.bible_translations t on t.id=v.translation_id where t.code=${sqlLiteral(metadata.code)} and v.is_canonical and (btrim(v.text)='' or v.text like '%�%' or v.text ~ '<\\/?[A-Za-z][^>]*>')) then raise exception 'Texto vazio, encoding ou HTML residual'; end if;\n  if exists (select 1 from public.bible_verses v join public.bible_translations t on t.id=v.translation_id where t.code=${sqlLiteral(metadata.code)} and v.is_canonical group by v.book_id,v.chapter,v.verse having count(*)>1) then raise exception 'Referência canônica duplicada'; end if;\nend\n$verify$;\n`, 'utf8');
  const sampleRows = verses.filter((item) => SAMPLE_CHAPTERS.some(([bookId, chapter]) => item.book_id === bookId && item.chapter === chapter)).map(({ book_id, chapter, verse, text }) => ({ book_id, chapter, verse, text }));
  const samplePayload = JSON.stringify(sampleRows);
  await writeFile(path.join(directory, '998-verify-samples.sql'), `do $samples$\ndeclare payload jsonb := $json$${samplePayload}$json$::jsonb; translation uuid;\nbegin\n  select id into strict translation from public.bible_translations where code=${sqlLiteral(metadata.code)};\n  if exists (select 1 from jsonb_to_recordset(payload) as x(book_id text, chapter smallint, verse smallint, text text) left join public.bible_verses v on v.translation_id=translation and v.book_id=x.book_id and v.chapter=x.chapter and v.verse=x.verse and v.is_canonical where v.id is null or v.text is distinct from x.text) then raise exception 'Amostra importada diverge da fonte em ${metadata.code}'; end if;\nend\n$samples$;\n`, 'utf8');
  if (metadata.classification === 'A' && metadata.production_ready) {
    await writeFile(path.join(directory, '999-activate.sql'), `do $activate$\nbegin\n  if (select count(*) from public.bible_verses v join public.bible_translations t on t.id=v.translation_id where t.code=${sqlLiteral(metadata.code)} and v.is_canonical) <> ${Number(metadata.expected_references)} then raise exception 'Contagem de referências inválida'; end if;\n  if (select count(distinct v.book_id) from public.bible_verses v join public.bible_translations t on t.id=v.translation_id where t.code=${sqlLiteral(metadata.code)} and v.is_canonical) <> ${Number(metadata.expected_books)} then raise exception 'Contagem de livros inválida'; end if;\n  if (select count(distinct (v.book_id,v.chapter)) from public.bible_verses v join public.bible_translations t on t.id=v.translation_id where t.code=${sqlLiteral(metadata.code)} and v.is_canonical) <> ${Number(metadata.expected_chapters)} then raise exception 'Contagem de capítulos inválida'; end if;\n  update public.bible_translations set is_active=true where code=${sqlLiteral(metadata.code)};\nend\n$activate$;\n`,'utf8');
  }
}

async function importWithRest(metadata, verses) {
  const baseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY somente no ambiente seguro do operador.');
  const request = async (resource, options = {}) => {
    const response = await fetch(`${baseUrl}/rest/v1/${resource}`, { ...options, headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', ...(options.headers || {}) } });
    if (!response.ok) throw new Error(`Supabase respondeu ${response.status}: ${await response.text()}`);
    const body = await response.text(); return body ? JSON.parse(body) : null;
  };
  const existing = await request(`bible_translations?select=*&code=eq.${encodeURIComponent(metadata.code)}`);
  let translation = existing[0];
  if (translation) {
    const remote = [];
    for (let offset = 0;; offset += 1000) {
      const page = await request(`bible_verses?select=book_id,chapter,verse,text&translation_id=eq.${translation.id}&is_canonical=eq.true&limit=1000&offset=${offset}`);
      remote.push(...page); if (page.length < 1000) break;
    }
    const source = new Map(verses.map((item) => [`${item.book_id}:${item.chapter}:${item.verse}`, item.text]));
    for (const item of remote) {
      const key = `${item.book_id}:${item.chapter}:${item.verse}`;
      if (!source.has(key) || source.get(key) !== item.text) throw new Error(`Conflito inesperado no banco: ${key}`);
    }
  }
  const payload = { code: metadata.code, name: metadata.name, short_name: metadata.short_name, language: metadata.language, provider: metadata.provider, source_type: 'local', license_type: metadata.license_type, copyright_notice: metadata.copyright_notice, attribution: metadata.attribution, source_url: metadata.source_url, is_active: translation?.is_active || false, is_default: false, is_local: true };
  if (!translation) [translation] = await request('bible_translations', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) });
  else [translation] = await request(`bible_translations?id=eq.${translation.id}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) });
  for (let offset = 0; offset < verses.length; offset += 500) {
    const batch = verses.slice(offset, offset + 500).map((item) => ({ ...item, translation_id: translation.id }));
    await request('bible_verses?on_conflict=translation_id,book_id,chapter,verse,is_canonical', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(batch) });
    console.log(`Importados ${Math.min(offset + batch.length, verses.length)}/${verses.length}`);
  }
  console.log(`Tradução ${metadata.code} importada. Ative somente após validar banco e frontend.`);
}

function option(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null; }

async function main() {
  const positional = process.argv.slice(2).find((value, index, values) => !value.startsWith('--') && (index === 0 || !values[index - 1].startsWith('--')));
  const sourcePath = option('--source') || positional;
  const manifestPath = option('--manifest') || path.join(path.dirname(fileURLToPath(import.meta.url)), 'bible-translation-sources.json');
  const translationCode = option('--translation');
  if (!sourcePath) throw new Error('Uso: node scripts/import-bible-translation.mjs --source DIRETÓRIO --translation CODIGO [--archive PACOTE.zip] [--validate-only|--sql-dir DIRETÓRIO|--import]');
  let metadata; let verses;
  if (/\.json$/i.test(sourcePath) && !translationCode) {
    const source = JSON.parse(await readUtf8(sourcePath)); metadata = source.metadata; verses = source.verses;
  } else {
    if (!translationCode) throw new Error('--translation é obrigatório para fonte USFM.');
    const manifest = JSON.parse(await readUtf8(manifestPath)); metadata = manifest[translationCode];
    if (!metadata) throw new Error(`Tradução não encontrada no manifesto: ${translationCode}`);
    if (metadata.format !== 'usfm') throw new Error(`Formato não suportado: ${metadata.format}`);
    verses = await loadUsfmDirectory(sourcePath);
  }
  const archive = option('--archive');
  if (archive) {
    const actual = await sha256File(archive);
    if (actual !== metadata.sha256) throw new Error(`Checksum divergente: esperado ${metadata.sha256}; obtido ${actual}`);
  }
  const result = validateDataset(metadata, verses);
  const samples = buildSampleReport(verses);
  console.log(JSON.stringify({ translation: metadata.code, ...result, samples }, null, 2));
  const sqlDirectory = option('--sql-dir');
  if (sqlDirectory) {
    const batchSize = Number(option('--batch-size') || 1000);
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5000) throw new Error('--batch-size deve ser inteiro entre 1 e 5000.');
    await emitSqlBatches(sqlDirectory, metadata, verses, batchSize);
    console.log(`Lotes SQL gerados em ${sqlDirectory}`); return;
  }
  if (process.argv.includes('--import')) { await importWithRest(metadata, verses); return; }
  if (!process.argv.includes('--validate-only')) console.log('Validação concluída sem escrita. Use --import ou --sql-dir explicitamente.');
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCli) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
