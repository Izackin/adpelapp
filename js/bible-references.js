// Public canonical book metadata from migration 20260924140312; no private data or extra API reads.
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  if(root)root.ADPELBibleReferences=api;
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  const books=Object.freeze([
    ["GEN","Gênesis",50,["genesis","gn","gen"]],
    ["EXO","Êxodo",40,["exodo","ex","exo"]],
    ["LEV","Levítico",27,["levitico","lv","lev"]],
    ["NUM","Números",36,["numeros","nm","num"]],
    ["DEU","Deuteronômio",34,["deuteronomio","dt","deu"]],
    ["JOS","Josué",24,["josue","js","jos"]],
    ["JDG","Juízes",21,["juizes","jz","jdg"]],
    ["RUT","Rute",4,["rt","rut"]],
    ["1SA","1 Samuel",31,["1samuel","1 samuel","1sm","1sa"]],
    ["2SA","2 Samuel",24,["2samuel","2 samuel","2sm","2sa"]],
    ["1KI","1 Reis",22,["1reis","1 reis","1rs","1ki"]],
    ["2KI","2 Reis",25,["2reis","2 reis","2rs","2ki"]],
    ["1CH","1 Crônicas",29,["1cronicas","1 cronicas","1cr","1ch"]],
    ["2CH","2 Crônicas",36,["2cronicas","2 cronicas","2cr","2ch"]],
    ["EZR","Esdras",10,["ed","ezr"]],
    ["NEH","Neemias",13,["ne","neh"]],
    ["EST","Ester",10,["et","est"]],
    ["JOB","Jó",42,["jo","job"]],
    ["PSA","Salmos",150,["salmo","sl","ps","psa"]],
    ["PRO","Provérbios",31,["proverbios","pv","pro"]],
    ["ECC","Eclesiastes",12,["ec","ecc"]],
    ["SNG","Cantares",8,["cantico dos canticos","ct","sng"]],
    ["ISA","Isaías",66,["isaias","is","isa"]],
    ["JER","Jeremias",52,["jr","jer"]],
    ["LAM","Lamentações",5,["lamentacoes","lm","lam"]],
    ["EZK","Ezequiel",48,["ez","ezk"]],
    ["DAN","Daniel",12,["dn","dan"]],
    ["HOS","Oseias",14,["oseias","oséias","os","hos"]],
    ["JOL","Joel",3,["jl","jol"]],
    ["AMO","Amós",9,["amos","am","amo"]],
    ["OBA","Obadias",1,["ob","oba"]],
    ["JON","Jonas",4,["jnas","jon"]],
    ["MIC","Miqueias",7,["miqueias","miquéias","mq","mic"]],
    ["NAM","Naum",3,["na","nam"]],
    ["HAB","Habacuque",3,["hc","hab"]],
    ["ZEP","Sofonias",3,["sf","zep"]],
    ["HAG","Ageu",2,["ag","hag"]],
    ["ZEC","Zacarias",14,["zc","zec"]],
    ["MAL","Malaquias",4,["ml","mal"]],
    ["MAT","Mateus",28,["mt","mat"]],
    ["MRK","Marcos",16,["mc","mk","mrk"]],
    ["LUK","Lucas",24,["lc","lk","luk"]],
    ["JHN","João",21,["joao","joão","jo","jn","john","jhn"]],
    ["ACT","Atos",28,["atos dos apostolos","at","act"]],
    ["ROM","Romanos",16,["rm","rom"]],
    ["1CO","1 Coríntios",16,["1corintios","1 corintios","1co"]],
    ["2CO","2 Coríntios",13,["2corintios","2 corintios","2co"]],
    ["GAL","Gálatas",6,["galatas","gl","gal"]],
    ["EPH","Efésios",6,["efesios","ef","eph"]],
    ["PHP","Filipenses",4,["fp","fl","php"]],
    ["COL","Colossenses",4,["cl","col"]],
    ["1TH","1 Tessalonicenses",5,["1tessalonicenses","1 tessalonicenses","1ts","1th"]],
    ["2TH","2 Tessalonicenses",3,["2tessalonicenses","2 tessalonicenses","2ts","2th"]],
    ["1TI","1 Timóteo",6,["1timoteo","1 timoteo","1tm","1ti"]],
    ["2TI","2 Timóteo",4,["2timoteo","2 timoteo","2tm","2ti"]],
    ["TIT","Tito",3,["tt","tit"]],
    ["PHM","Filemom",1,["fm","phm"]],
    ["HEB","Hebreus",13,["hb","heb"]],
    ["JAS","Tiago",5,["tg","jas"]],
    ["1PE","1 Pedro",5,["1pedro","1 pedro","1pd","1pe"]],
    ["2PE","2 Pedro",3,["2pedro","2 pedro","2pd","2pe"]],
    ["1JN","1 João",5,["1joao","1 joão","1jo","1jn"]],
    ["2JN","2 João",1,["2joao","2 joão","2jo","2jn"]],
    ["3JN","3 João",1,["3joao","3 joão","3jo","3jn"]],
    ["JUD","Judas",1,["jd","jud"]],
    ["REV","Apocalipse",22,["ap","apocalipse","revelacao","rev"]]
  ].map(([id,name_pt,chapter_count,aliases])=>Object.freeze({id,name_pt,chapter_count,aliases:Object.freeze(aliases)})));
  const compact=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[.\s]/g,'');
  const exact=value=>String(value||'').normalize('NFC').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');
  function resolveBook(value,catalog=books){
    const input=exact(value);
    const direct=catalog.find(b=>exact(b.id)===input || exact(b.name_pt)===input);
    if(direct)return direct;
    const key=compact(value);
    if(!key)return null;
    const matches=catalog.filter(b=>[b.id,b.name_pt,...(b.aliases||[])].some(a=>compact(a)===key));
    return matches.length===1?matches[0]:null;
  }
  function positive(value){
    if(!/^\d+$/.test(String(value??'')))return null;
    const number=Number(value);
    return Number.isSafeInteger(number)&&number>=1&&number<=32767?number:null;
  }
  function validate(bookRef,chapterValue,startValue,endValue,catalog=books){
    const book=resolveBook(bookRef,catalog),chapter=positive(chapterValue);
    if(!book||!chapter||chapter>book.chapter_count)return null;
    const verseStart=startValue==null||startValue===''?null:positive(startValue);
    const verseEnd=endValue==null||endValue===''?verseStart:positive(endValue);
    if((startValue!=null&&startValue!==''&&!verseStart)||(endValue!=null&&endValue!==''&&(!verseStart||!verseEnd))||(verseStart&&verseEnd<verseStart))return null;
    return {book,chapter,verseStart,verseEnd};
  }
  function parseReference(value,catalog=books){
    const input=String(value||'').trim().replace(/^[—–-]\s*/,'').split(/\s*·\s*/)[0].trim();
    const match=input.match(/^(.+?)\s+(\d+)(?:\s*[:,]\s*(\d+)(?:\s*[-–—]\s*(\d+))?)?$/u);
    return match?validate(match[1],match[2],match[3],match[4],catalog):null;
  }
  function readLink(search,catalog=books){
    const params=new URLSearchParams(search||'');
    if(!['book','chapter','verse','end','translation'].some(k=>params.has(k)))return {requested:false,reference:null};
    if(['book','chapter','verse','end','translation'].some(k=>params.getAll(k).length>1))return {requested:true,reference:null};
    const reference=validate(params.get('book'),params.get('chapter'),params.get('verse'),params.get('end'),catalog);
    return {requested:true,reference,translation:params.get('translation')||null};
  }
  function href(reference,translation){
    if(!reference)return null;
    const validated=validate(reference.book.id,reference.chapter,reference.verseStart,reference.verseEnd);
    if(!validated)return null;
    const params=new URLSearchParams({book:validated.book.id,chapter:String(validated.chapter)});
    if(validated.verseStart)params.set('verse',String(validated.verseStart));
    if(validated.verseEnd>validated.verseStart)params.set('end',String(validated.verseEnd));
    if(typeof translation==='string'&&/^[a-z0-9][a-z0-9_-]{0,39}$/.test(translation))params.set('translation',translation);
    return 'bible.html?'+params.toString();
  }
  function label(ref){
    if(!ref)return '';
    return ref.book.name_pt+' '+ref.chapter+(ref.verseStart?':'+ref.verseStart+(ref.verseEnd>ref.verseStart?'–'+ref.verseEnd:''):'');
  }
  function resume(preferences){
    if(!preferences||typeof preferences!=='object')return null;
    const base=validate(preferences.last_book,preferences.last_chapter,null,null);
    if(!base)return null;
    const focused=validate(preferences.last_book,preferences.last_chapter,preferences.last_verse,null);
    return focused||base;
  }
  return Object.freeze({books,resolveBook,validate,parseReference,readLink,href,label,resume});
});
