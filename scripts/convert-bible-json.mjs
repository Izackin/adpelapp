#!/usr/bin/env node
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { BIBLE_BOOKS, decodeUtf8, sha256File, validateDataset, buildSampleReport } from './import-bible-translation.mjs';

const byCode = new Map(BIBLE_BOOKS.map(b => [b.id,b]));

export function cleanSourceText(text) {
  if (typeof text !== 'string') throw new Error('Texto bíblico inválido');
  // Bolls uses superscript elements for editorial note calls. They are not
  // words of the verse; source files retain the complete original markup.
  text=text.replace(/<sup>[^<]*<\/sup>/gi,'');
  for (const tag of text.matchAll(/<[^>]*>/g)) {
    if (!/^<(?:br\s*\/?|\/?b|\/?i)>$/i.test(tag[0])) throw new Error(`HTML desconhecido: ${tag[0]}`);
  }
  const entities={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '};
  return text.replace(/<br\s*\/?>/gi,' ').replace(/<\/?(?:b|i)>/gi,'').replace(/&([^;\s]+);/g,(_,e)=>{
    if(Object.hasOwn(entities,e)) return entities[e];
    if(/^#(?:\d+|x[0-9a-f]+)$/i.test(e)) {
      const n=e[1].toLowerCase()==='x'?parseInt(e.slice(2),16):Number(e.slice(1));
      if(n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)) return String.fromCodePoint(n);
    }
    throw new Error(`Entidade desconhecida: &${e};`);
  }).replace(/\s+/g,' ').trim();
}

export function convertExplicitBooks(books) {
  const verses=[];
  for(const b of books) {
    const book=b.code?byCode.get(b.code):BIBLE_BOOKS[Number(b.nr)-1];
    if(!book) throw new Error('Livro desconhecido');
    if(b.id && Number(b.id)!==book.order || b.nr && Number(b.nr)!==book.order) throw new Error('Identidade do livro divergente');
    for(const c of b.chapters) for(const v of c.verses) {
      const chapter=Number(c.number??c.chapter);
      if(v.chapter && Number(v.chapter)!==chapter) throw new Error('Capítulo do versículo divergente');
      verses.push({book_id:book.id,book:book.name,chapter,verse:Number(v.number??v.verse),text:cleanSourceText(v.text),is_canonical:true});
    }
  }
  return verses.sort((a,b)=>byCode.get(a.book_id).order-byCode.get(b.book_id).order||a.chapter-b.chapter||a.verse-b.verse);
}

export function convertExplicitRows(rows) {
  return rows.flatMap(v=>{
    const book=BIBLE_BOOKS[Number(v.book)-1];
    if(!book) throw new Error('Livro desconhecido');
    const text=cleanSourceText(v.text);
    // Formatting-only source placeholders carry no biblical words. Keep the
    // original numbers of following rows; never fill or renumber this gap.
    if(!text && /^(?:\s|<br\s*\/?>)*$/i.test(v.text)) return [];
    return [{book_id:book.id,book:book.name,chapter:Number(v.chapter),verse:Number(v.verse),text,is_canonical:true}];
  }).sort((a,b)=>byCode.get(a.book_id).order-byCode.get(b.book_id).order||a.chapter-b.chapter||a.verse-b.verse);
}

async function main() {
  const [source,metadataPath,output] = process.argv.slice(2);
  if(!source||!metadataPath||!output) throw new Error('Uso: node scripts/convert-bible-json.mjs FONTE METADADOS.json SAIDA.json');
  const metadata=JSON.parse(await readFile(metadataPath,'utf8'));
  let verses;
  if(metadata.format==='canonical-books') {
    const books=[];
    const hash=createHash('sha256');
    for(const f of (await readdir(source)).filter(f=>/\.json$/.test(f)).sort()) {
      const bytes=await readFile(path.join(source,f));
      hash.update(f);hash.update(bytes);
      const b=JSON.parse(decodeUtf8(bytes,f));
      if(b.code&&b.chapters) books.push(b);
    }
    if(hash.digest('hex')!==metadata.sha256) throw new Error('Checksum do diretório divergente');
    verses=convertExplicitBooks(books);
  } else {
    if(await sha256File(source)!==metadata.sha256) throw new Error('Checksum divergente');
    const data=JSON.parse(decodeUtf8(await readFile(source),source));
    verses=metadata.format==='bolls-rows'?convertExplicitRows(data):convertExplicitBooks(data.books);
  }
  const report={translation:metadata.code,...validateDataset(metadata,verses),samples:buildSampleReport(verses)};
  await writeFile(output,JSON.stringify({metadata,verses})+'\n','utf8');
  console.log(JSON.stringify(report,null,2));
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) main().catch(e=>{console.error(e.message);process.exitCode=1;});
