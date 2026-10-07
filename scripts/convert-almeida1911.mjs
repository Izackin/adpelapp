#!/usr/bin/env node
// Adapter for the pinned Project Gutenberg #62383 HTML, not arbitrary HTML.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BIBLE_BOOKS, decodeUtf8, sha256File, validateDataset, buildSampleReport } from './import-bible-translation.mjs';

const PREFIXES = 'Gen Exo Lev Num Deu Jos Jui Ruth ISam IISam IReis IIReis IChr IIChr Esd Neh Est Job Psa Pro Ecc Can Isa Jer Lam Eze Dan Ose Joel Amos Oba Jon Miq Nah Hab Sof Agg Zac Mal Mat Mar Luc Joao Act Rom ICor IICor Gal Eph IPhi Col IThe IIThe ITim IITim Tito IIPhi Heb Thi IPed IIPed IJoao IIJoao IIIJoao Jud Apo'.split(' ');
const BOOKS = new Map(PREFIXES.map((prefix, i) => [prefix, BIBLE_BOOKS[i]]));

function decodeEntities(text) {
  const names = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return text.replace(/&([^;\s]+);/g, (_, entity) => {
    if (Object.hasOwn(names, entity)) return names[entity];
    if (/^#(?:\d+|x[0-9a-f]+)$/i.test(entity)) {
      const number = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      if (number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff)) return String.fromCodePoint(number);
    }
    throw new Error(`Entidade HTML desconhecida: &${entity};`);
  });
}

export function parseAlmeida1911(html) {
  const verses = [];
  for (const paragraph of html.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/g)) {
    const id = paragraph[1].match(/\bid="([^"]+)"/)?.[1];
    if (!id || !/\d+-\d+$/.test(id)) continue;
    const reference = id.match(/^([A-Za-z]+)(\d+)-(\d+)$/);
    const book = reference && BOOKS.get(reference[1]);
    if (!book) throw new Error(`Referência histórica desconhecida: ${id}`);
    const chapter = Number(reference[2]);
    const verse = Number(reference[3]);
    let text = paragraph[2]
      .replace(/<a\b[^>]*\bclass="fnanchor pginternal"[^>]*>[\s\S]*?<\/a>/g, '')
      .replace(/<span class="pagenum">[\s\S]*?<\/span>/g, '');
    // Lamentations prints acrostic letter headings before the numbering.
    // Remove only that editorial heading, preserving small caps in verse text.
    if (book.id === 'LAM') text = text.replace(/^\s*<span class="smcap">(?:Aleph|Beth|Gimel|Daleth|He|Vau|Zain|Heth|Teth|Jod|Caph|Lamed|Mem|Nun|Samech|Ain|Pe|Tsade|Koph|Coph|Resch|Schin|Tau)\.<\/span>\s*/, '');
    // Only the source's exact inline structures are accepted. Do not silently
    // strip an unknown element or editorial block into the canonical text.
    for (const tag of text.matchAll(/<[^>]*>/g)) {
      if (!/^(?:<\/?i>|<span class="(?:first|smcap)">|<\/span>|<a id="(?:FNanchor|ENanchor)_\d+">|<\/a>)$/.test(tag[0])) {
        throw new Error(`${id}: marcação HTML não suportada (${tag[0]})`);
      }
    }
    text = decodeEntities(text.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
    const number = text.match(/^(\d+)\s+/);
    // In this edition the decorated first number is the CHAPTER number,
    // while subsequent paragraphs print the verse number.
    const chapterNumber = /<span class="first">/.test(paragraph[2]);
    if (chapterNumber && verse !== 1) throw new Error(`${id}: número de capítulo fora do primeiro versículo`);
    // The pinned source misprints 31 at Mar4-34. Its HTML ID and adjacent
    // references identify verse 34. Keep its words; record the source anomaly.
    const sourceMisprint = id === 'Mar4-34' && number?.[1] === '31' && !chapterNumber;
    if (!number || (!sourceMisprint && Number(number[1]) !== (chapterNumber ? chapter : verse))) throw new Error(`${id}: número impresso diverge da referência`);
    text = text.slice(number[0].length);
    verses.push({ book_id: book.id, book: book.name, chapter, verse, text, is_canonical: true });
  }
  if (!verses.length) throw new Error('Nenhum versículo histórico encontrado');
  return verses;
}

async function main() {
  const [source, output] = process.argv.slice(2);
  if (!source || !output || process.argv.length !== 4) throw new Error('Uso: node scripts/convert-almeida1911.mjs FONTE.html SAIDA.json');
  if (path.resolve(source) === path.resolve(output)) throw new Error('A saída não pode substituir a fonte');
  const manifest = JSON.parse(await readFile(new URL('./bible-translation-sources.json', import.meta.url), 'utf8'));
  const metadata = manifest.almeida1911;
  const actualHash = await sha256File(source);
  if (actualHash !== metadata.sha256) throw new Error(`Checksum da fonte divergente: ${actualHash}`);
  const verses = parseAlmeida1911(decodeUtf8(await readFile(source), source));
  const report = { source_sha256: actualHash, ...validateDataset(metadata, verses), source_anomalies: ['Mar4-34: a fonte imprime 31, mas identifica o parágrafo como versículo 34; palavras preservadas.'], samples: buildSampleReport(verses) };
  await writeFile(output, JSON.stringify({ metadata, verses }, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
