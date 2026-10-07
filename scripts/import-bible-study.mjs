#!/usr/bin/env node
// Sources are fetched separately; never commit downloaded corpora or credentials.
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BIBLE_BOOKS } from './import-bible-translation.mjs';

const BOOK_IDS = ['Gen','Exo','Lev','Num','Deu','Jos','Jdg','Rut','1Sa','2Sa','1Ki','2Ki','1Ch','2Ch','Ezr','Neh','Est','Job','Psa','Pro','Ecc','Sng','Isa','Jer','Lam','Ezk','Dan','Hos','Jol','Amo','Oba','Jon','Mic','Nam','Hab','Zep','Hag','Zec','Mal','Mat','Mrk','Luk','Jhn','Act','Rom','1Co','2Co','Gal','Eph','Php','Col','1Th','2Th','1Ti','2Ti','Tit','Phm','Heb','Jas','1Pe','2Pe','1Jn','2Jn','3Jn','Jud','Rev'];
const BOOKS = new Map(BOOK_IDS.map((id,i)=>[id,BIBLE_BOOKS[i]]));
export const plainStrong = (s) => { const m=String(s||'').match(/^([GH])(\d+)/); return m ? m[1]+Number(m[2]) : null; };
const cleanText = (s) => String(s||'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').trim();
export function parseLexicon(content, language, glosses={}) {
  const result=new Map();
  for(const line of content.replace(/^\uFEFF/,'').split(/\r?\n/)) {
    const f=line.split('\t');
    if(!/^[GH]\d+/.test(f[0])) continue;
    const extended=f[1]?.match(/^([GH]\d+[a-zA-Z]*)\b/)?.[1];
    if(!extended) throw new Error('Entrada lexical inválida: '+f[0]);
    // G2199H is a person relation with no written lemma, not a lexical word.
    if(!f[3]) { if(extended==='G2199H') continue; throw new Error('Lema ausente: '+extended); }
    if(result.has(extended)) throw new Error('Strong estendido duplicado: '+extended);
    result.set(extended,{
      source_code:'stepbible',strong_number:extended,language:language==='he' && f[5]?.startsWith('A:')?'arc':language,
      lemma:f[3].normalize('NFC'),transliteration:f[4]||null,part_of_speech:f[5]||null,
      gloss_pt:glosses[plainStrong(extended)]||null,definition_short_pt:null,definition_long_pt:null,
      // TBESH's Meaning column requires separate permission. DO NOT import it.
      metadata:{gloss_en:cleanText(f[6]),...(language==='grc'?{definition_en:cleanText(f[7])}:{}),standard_strong:plainStrong(f[0]),...(glosses[plainStrong(extended)]?{gloss_pt_origin:'ADPEL: adaptação editorial da glossa breve; não é definição exaustiva'}:{})}
    });
  }
  return result;
}
export function parseTagged(content, kind, lexicon, glosses={}) {
  const verses=new Map(); const seen=new Set(); let selected=0;
  for(const line of content.replace(/^\uFEFF/,'').split(/\r?\n/)) {
    if(!/^[1-3]?[A-Z][a-z]+\.\d+\.\d+/.test(line)) continue;
    const f=line.split('\t');
    const m=f[0].match(/^([1-3]?[A-Z][a-z]+)\.(\d+)\.(\d+)([^#]*)#(\d+)=([^\t]+)$/);
    if(!m) throw new Error('Referência desconhecida: '+f[0]);
    const main=m[6].replace(/\([^)]*\)/g,'');
    if(kind==='grc'?!/N/i.test(main):!/^[LQ]/.test(main)) continue;
    if(seen.has(f[0])) throw new Error('Token de fonte duplicado: '+f[0]);
    seen.add(f[0]);
    const book=BOOKS.get(m[1]); const chapter=Number(m[2]),verse=Number(m[3]);
    if(!book || chapter<1 || chapter>book.chapterCount || verse<0 || verse===0&&book.id!=='PSA') throw new Error('Referência fora do catálogo: '+f[0]);
    const key=`${book.id}:${chapter}:${verse}`;
    if(!verses.has(key)) verses.set(key,{source_code:'stepbible',book_id:book.id,chapter,verse,language:kind==='grc'?'grc':'he',tokens:[],metadata:{basis:kind==='grc'?'TAGNT: texto principal N (NA27); grafia/pontuação STEP':'TAHOT: texto principal L/Q; acréscimos X excluídos',versification:'STEP/NRSV',alternate_references:[]}});
    const v=verses.get(key);
    if(m[4] && !v.metadata.alternate_references.includes(m[4])) v.metadata.alternate_references.push(m[4]);
    let surface,transliteration,morphology,strong,lemma,glossEn;
    if(kind==='grc') {
      const g=f[1].match(/^(.*?)\s+\(([^()]*)\)$/u);
      if(!g) throw new Error('Forma grega desconhecida: '+f[0]);
      surface=g[1];transliteration=g[2];
      const tag=f[3].match(/^(G\d+[a-zA-Z]*)=(.+)$/);
      if(!tag) throw new Error('Tag grega desconhecida: '+f[0]);
      strong=tag[1];morphology=tag[2];lemma=f[4].split('=')[0];glossEn=f[2];
    } else {
      if(!f[1] && f[2]?.trim()==='[ ]' && /^Q/.test(main)) {
        (v.metadata.empty_qere_readings ||= []).push(f[0]);
        continue; // Written Ketiv omitted by the explicitly empty spoken Qere.
      }
      // Retain a whole Hebrew word, including prefixes/suffixes. Root Strong is explicit.
      surface=f[1].replaceAll('/','').replaceAll('\\','');
      transliteration=f[2];morphology=f[5];
      strong=f[4].match(/\{(H\d+[a-zA-Z]*)\}/)?.[1]||f[4].match(/H\d+[a-zA-Z]*/)?.[0];
      lemma=lexicon.get(strong)?.lemma||f[11]?.match(new RegExp(`${strong}=([^=/{\\}]+)=`))?.[1]||null;glossEn=f[3];
      if(/^A/.test(morphology)) v.language='arc';
    }
    if(!surface||!strong) throw new Error('Token incompleto: '+f[0]);
    const lex=lexicon.get(strong);
    v.tokens.push({token_position:v.tokens.length+1,token_type:'word',surface:surface.normalize('NFC'),
      // Resolve lexical fields through the FK instead of duplicating them on 440k words.
      lemma:lex?null:lemma?.normalize('NFC'),transliteration,strong_number:plainStrong(strong),
      morphology_code:morphology||null,gloss_pt:glosses[plainStrong(strong)]||null,
      lexicon_strong:strong,metadata:{gloss_en:glossEn.trim(),...(kind!=='grc'?{components:f[4]}:{}),...(m[4]?{source_reference:f[0].split('#')[0]}:{})}});
    selected++;
  }
  return {verses:[...verses.values()].map(v=>({...v,text_original:v.tokens.map(t=>t.surface).join(' ')})),selected};
}

const MORPH_TERMS={Function:'Classe',Case:'Caso',Number:'Número',Gender:'Gênero',Tense:'Tempo',Voice:'Voz',Mood:'Modo',Person:'Pessoa',Form:'Forma',State:'Estado',Stem:'Tema verbal',Action:'Ação',Noun:'substantivo',Verb:'verbo',Adjective:'adjetivo',Adverb:'advérbio',Article:'artigo',Preposition:'preposição',Conjunction:'conjunção',Particle:'partícula',Pronoun:'pronome',Personal:'pessoal',Possessive:'possessivo',Reflexive:'reflexivo',Demonstrative:'demonstrativo',Relative:'relativo',Interrogative:'interrogativo',Indefinite:'indefinido',Reciprocal:'recíproco',Nominative:'nominativo',Genitive:'genitivo',Dative:'dativo',Accusative:'acusativo',Vocative:'vocativo',Singular:'singular',Plural:'plural',Dual:'dual',Masculine:'masculino',Feminine:'feminino',Neuter:'neutro',Common:'comum',Active:'ativa',Passive:'passiva',Middle:'média',Deponent:'depoente',Indicative:'indicativo',Subjunctive:'subjuntivo',Imperative:'imperativo',Optative:'optativo',Infinitive:'infinitivo',Participle:'particípio',Present:'presente',Imperfect:'imperfeito',Aorist:'aoristo',Future:'futuro',Perfect:'perfeito',Pluperfect:'mais-que-perfeito',First:'primeira',Second:'segunda',Third:'terceira',Absolute:'absoluto',Construct:'construto',Determined:'determinado',Sequential:'sequencial',Negative:'negativa',Indeclinable:'indeclinável',Proper:'próprio',Simple:'simples',Intensive:'intensiva',Causative:'causativa',hence:'portanto',OR:'ou',WITH:'com',JOINED:'unido',TO:'a'};
Object.assign(MORPH_TERMS,{Past:'passado',Name:'nome próprio',Gentilic:'gentílico',Consecutive:'consecutivo',Jussive:'jussivo',Cohortative:'coortativo',Either:'uma das duas',Extra:'característica adicional',type:'tipo',resultive:'resultativa',transtive:'transitiva',declarative:'declarativa',iterative:'iterativa',Determinate:'determinado',Suffix:'sufixo',Prefix:'prefixo',Interjection:'interjeição',Numeral:'numeral',Cardinal:'cardinal',Ordinal:'ordinal'});
const MORPH_LOWER=new Map(Object.entries(MORPH_TERMS).map(([k,v])=>[k.toLowerCase(),v]));
export const translateMorphology = (s) => s.replace(/\b[A-Za-z]+\b/g,w=>MORPH_TERMS[w]||MORPH_LOWER.get(w.toLowerCase())||w).replace(/1st/g,'1ª').replace(/2nd/g,'2ª').replace(/3rd/g,'3ª');
export function parseMorphology(content,language) {
  const rows=new Map();
  for(const line of content.replace(/^\uFEFF/,'').split(/\r?\n/)) {
    const [code,description]=line.split('\t');
    if(!description?.trim().startsWith('Function=')) continue;
    if(rows.has(code)) throw new Error('Morfologia duplicada: '+code);
    rows.set(code,{source_code:'stepbible',language,code,description_en:description.trim(),description_pt:translateMorphology(description.trim())});
  }
  return [...rows.values()];
}
const sqlString=s=>"'"+String(s).replaceAll("'","''")+"'";
const jsonSql=obj=>sqlString(JSON.stringify(obj))+'::jsonb';
export function chapterSql(verses) {
  // Data-modifying CTE ensures FK links use returned rows in the same transaction.
  const payload=verses.map(v=>({...v,tokens:v.tokens.map(t=>[t.token_position,t.surface,t.lemma,t.transliteration,t.strong_number,t.lexicon_strong,t.morphology_code,t.gloss_pt,t.metadata])}));
  return `begin;\nwith payload as (select value as j from jsonb_array_elements(${jsonSql(payload)})),
  saved as (insert into public.bible_original_verses(source_code,book_id,chapter,verse,language,text_original,metadata)
    select j->>'source_code',j->>'book_id',(j->>'chapter')::smallint,(j->>'verse')::smallint,j->>'language',j->>'text_original',j->'metadata' from payload
    on conflict(source_code,book_id,chapter,verse) do update set text_original=excluded.text_original,metadata=excluded.metadata,language=excluded.language
    returning id,source_code,book_id,chapter,verse)
  insert into public.bible_original_tokens(original_verse_id,token_position,token_type,surface,lemma,transliteration,strong_number,lexicon_entry_id,morphology_code,gloss_pt,metadata)
  select v.id,(t->>0)::smallint,'word',t->>1,t->>2,t->>3,t->>4,l.id,t->>6,t->>7,t->8
  from payload p join saved v on v.source_code=p.j->>'source_code' and v.book_id=p.j->>'book_id' and v.chapter=(p.j->>'chapter')::int and v.verse=(p.j->>'verse')::int
  cross join lateral jsonb_array_elements(p.j->'tokens') t left join public.bible_lexicon_entries l on l.source_code=v.source_code and l.strong_number=t->>5
  on conflict(original_verse_id,token_position) do update set surface=excluded.surface,lemma=excluded.lemma,transliteration=excluded.transliteration,strong_number=excluded.strong_number,lexicon_entry_id=excluded.lexicon_entry_id,morphology_code=excluded.morphology_code,gloss_pt=excluded.gloss_pt,metadata=excluded.metadata;
  commit;`;
}
function tableSql(table,rows) {
  const keys=Object.keys(rows[0]);
  return `insert into public.${table}(${keys.join(',')}) select ${keys.join(',')} from jsonb_populate_recordset(null::public.${table},${jsonSql(rows)}) on conflict(${table==='bible_morphology_codes'?'source_code,language,code':'source_code,strong_number'}) do update set ${keys.filter(k=>k!=='source_code'&&k!=='strong_number'&&k!=='code'&&k!=='language').map(k=>`${k}=excluded.${k}`).join(',')};`;
}
export function editorialSql(data) {
  const comments=data.commentaries.map(c=>({...c,source_code:'adpel-editorial',is_active:false}));
  return `begin;
    insert into public.bible_study_sources(code,name,description,license_type,attribution,is_active) values
    ('adpel-editorial','Comentários da igreja','Conteúdo editorial local.','Autoria local','Autores identificados em cada comentário',true),
    ('adpel-references','Referências de estudo','Relações temáticas entre passagens bíblicas.','Autoria local','Referências editoriais ADPEL',true)
    on conflict(code) do nothing;
    insert into public.bible_commentaries(source_code,book_id,chapter,verse_start,verse_end,title,content,category,author_name,is_active,metadata)
    select x.source_code,x.book_id,x.chapter,x.verse_start,x.verse_end,x.title,x.content,x.category,x.author_name,x.is_active,x.metadata
    from jsonb_populate_recordset(null::public.bible_commentaries,${jsonSql(comments)}) x
    where not exists(select 1 from public.bible_commentaries b where b.source_code=x.source_code and b.book_id=x.book_id and b.chapter=x.chapter and b.verse_start=x.verse_start and b.metadata->>'seed'=x.metadata->>'seed');
    insert into public.bible_cross_references(source_code,from_book_id,from_chapter,from_verse,to_book_id,to_chapter,to_verse,relation_type,weight,metadata)
    select x.source_code,x.from_book_id,x.from_chapter,x.from_verse,x.to_book_id,x.to_chapter,x.to_verse,x.relation_type,x.weight,x.metadata
    from jsonb_populate_recordset(null::public.bible_cross_references,${jsonSql(data.references)}) x
    where not exists(select 1 from public.bible_cross_references b where b.source_code=x.source_code and b.from_book_id=x.from_book_id and b.from_chapter=x.from_chapter and b.from_verse=x.from_verse and b.to_book_id=x.to_book_id and b.to_chapter=x.to_chapter and b.to_verse=x.to_verse);
    commit;`;
}
export async function buildImport(sourceDir,outputDir,scope='all') {
  const manifest=JSON.parse(await readFile(new URL('./bible-study-sources.json',import.meta.url),'utf8'));
  const glosses=JSON.parse(await readFile(new URL('./bible-study-glosses.json',import.meta.url),'utf8'));
  const contents=new Map();
  for(const file of manifest.files) {
    const bytes=await readFile(path.join(sourceDir,file.path));
    if(createHash('sha256').update(bytes).digest('hex')!==file.sha256) throw new Error('Checksum diferente: '+file.path);
    contents.set(file.kind, (contents.get(file.kind)||[]).concat(bytes.toString('utf8')));
  }
  const greek=parseLexicon(contents.get('lexicon-grc')[0],'grc',glosses),hebrew=parseLexicon(contents.get('lexicon-he')[0],'he',glosses);
  const lexicon=[...greek.values(),...hebrew.values()];
  let verses=[];
  for(const text of contents.get('text-grc')) verses.push(...parseTagged(text,'grc',greek,glosses).verses);
  for(const text of contents.get('text-he')) verses.push(...parseTagged(text,'he',hebrew,glosses).verses);
  if(scope==='pilot') verses=verses.filter(v=>v.chapter===1 && ['GEN','JHN'].includes(v.book_id) || v.book_id==='DAN'&&v.chapter===2);
  else if(scope==='nt') verses=verses.filter(v=>v.language==='grc');
  else if(scope!=='all') throw new Error('Escopo inválido');
  verses.sort((a,b)=>BIBLE_BOOKS.findIndex(x=>x.id===a.book_id)-BIBLE_BOOKS.findIndex(x=>x.id===b.book_id)||a.chapter-b.chapter||a.verse-b.verse);
  const unique=new Set();
  for(const v of verses) {const ref=`${v.book_id}:${v.chapter}:${v.verse}`;if(unique.has(ref))throw new Error('Referência duplicada '+ref);unique.add(ref);}
  const morphology=[...parseMorphology(contents.get('morphology-grc')[0],'grc'),...parseMorphology(contents.get('morphology-he')[0],'he')];
  await mkdir(outputDir,{recursive:true});
  let seq=0; const writeBatch=async sql=>writeFile(path.join(outputDir,`${String(seq++).padStart(4,'0')}.sql`),sql);
  for(let i=0;i<lexicon.length;i+=150) await writeBatch(tableSql('bible_lexicon_entries',lexicon.slice(i,i+150)));
  for(let i=0;i<morphology.length;i+=200) await writeBatch(tableSql('bible_morphology_codes',morphology.slice(i,i+200)));
  // Bounded batches of complete verses; never truncate a chapter at the API's default 1000 rows.
  for(let i=0;i<verses.length;i+=150) await writeBatch(chapterSql(verses.slice(i,i+150)));
  const report={scope,revision:manifest.revision,books:new Set(verses.map(v=>v.book_id)).size,chapters:new Set(verses.map(v=>v.book_id+':'+v.chapter)).size,verses:verses.length,tokens:verses.reduce((n,v)=>n+v.tokens.length,0),lexicon:lexicon.length,morphology:morphology.length,batches:seq,coverage:verses.reduce((a,v)=>{a[v.book_id]=(a[v.book_id]||0)+1;return a;},{})};
  await writeFile(path.join(outputDir,'report.json'),JSON.stringify(report,null,2));
  return report;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const arg=k=>process.argv[process.argv.indexOf(k)+1];
  if(process.argv.includes('--editorial-sql')){
    const data=JSON.parse(await readFile(new URL('./bible-study-editorial.json',import.meta.url),'utf8'));
    await writeFile(arg('--editorial-sql'),editorialSql(data));process.exit(0);
  }
  if(!process.argv.includes('--source')||!process.argv.includes('--sql-dir')) {console.error('node scripts/import-bible-study.mjs --source STEP_REPO --sql-dir OUTSIDE_GIT [--scope pilot|nt|all]');process.exit(1);}
  try {console.log(JSON.stringify(await buildImport(arg('--source'),arg('--sql-dir'),process.argv.includes('--scope')?arg('--scope'):'all'),null,2));}catch(e){console.error(e.message);process.exit(1);}
}
