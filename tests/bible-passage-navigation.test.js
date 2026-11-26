const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
const refs=require('../js/bible-references.js');
const editorial=['João 3:16','Jeremias 29:11','Isaías 41:10','Filipenses 4:13','Provérbios 3:5','Salmos 23:1','Romanos 8:28','Josué 1:9','Salmos 91:1','Mateus 6:33','Salmos 46:1','Romanos 12:12','Hebreus 11:1','2 Coríntios 5:7','Salmos 37:5','Provérbios 16:3','João 14:6','Mateus 11:28','Salmos 34:8','Romanos 15:13','Efésios 6:10','1 Pedro 5:7','Tiago 1:5','Isaías 40:31','Salmos 121:1','Gálatas 6:9','João 8:32','Provérbios 18:10','1 Tessalonicenses 5:16','1 Tessalonicenses 5:17'];
const slice=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);assert.ok(i>=0&&j>i);return s.slice(i,j);};
(async()=>{
 assert.equal(refs.books.length,66);
 for(const book of refs.books){
   const ref=refs.resume({last_book:book.id,last_chapter:1,last_verse:1});
   assert.equal(ref.book.name_pt,book.name_pt);
   assert.equal(refs.parseReference(book.name_pt+' 1:1').book.id,book.id);
   assert.equal(refs.readLink(refs.href(ref).split('?')[1]).reference.book.id,book.id);
 }
 for(const reference of editorial){
   const ref=refs.parseReference(reference);assert.ok(ref);
   assert.equal(refs.label(ref),reference);
   assert.equal(refs.label(refs.readLink(refs.href(ref).split('?')[1]).reference),reference);
 }
 assert.equal(refs.parseReference('Jó 3:1').book.id,'JOB');
 assert.equal(refs.parseReference('João 3:16').book.id,'JHN');
 assert.equal(refs.parseReference('Jo 3:16'),null);
 assert.equal(refs.parseReference('2 Co. 5:7').book.id,'2CO');
 assert.equal(refs.label(refs.parseReference('Jn 3:16–18 · ACF')),'João 3:16–18');
 assert.equal(refs.resume({last_book:'PHP',last_chapter:4,last_verse:13}).book.name_pt,'Filipenses');
 for(const query of ['book=XXX&chapter=1','book=JHN&chapter=22','book=JHN&chapter=-1','book=JHN&chapter=3&verse=0','book=JHN&chapter=3&verse=18&end=16','book=JHN&book=ROM&chapter=3','book=JHN&chapter=3&end=17'])assert.equal(refs.readLink(query).reference,null);
 assert.equal(refs.readLink('').requested,false);
 let attrs={'aria-disabled':'true'};const link={set href(v){attrs.href=v;},setAttribute(k,v){attrs[k]=v;},removeAttribute(k){delete attrs[k];}};
 const home=read('js/home.js');let prefs={last_book:'PHP',last_chapter:4,last_verse:13,translation_code:'acf'};
 const ctx={window:{ADPELBibleReferences:refs},document:{getElementById:()=>link},localStorage:{getItem:()=>JSON.stringify(prefs)}};
 vm.createContext(ctx);vm.runInContext(slice(home,'function updateVerseBibleLink','function trackVerseOfDayEngagement')+slice(home,'function getReadingPreferences','function renderReadingContinuation'),ctx);
 ctx.updateVerseBibleLink({reference:'2 Coríntios 5:7'});assert.equal(attrs.href,'bible.html?book=2CO&chapter=5&verse=7');assert.equal(attrs['aria-disabled'],undefined);
 ctx.updateVerseBibleLink({reference:'Inválida'});assert.equal(attrs.href,undefined);assert.equal(attrs['aria-disabled'],'true');
 assert.equal(ctx.getReadingPreferences().label,'Filipenses 4:13');assert.equal(ctx.getReadingPreferences().href,'bible.html?book=PHP&chapter=4&verse=13&translation=acf');
 prefs.last_book='XXX';assert.equal(ctx.getReadingPreferences(),null);
 const bible=read('js/bible.js'),calls=[],warnings=[];
 const state={books:refs.books,book:refs.resolveBook('GEN'),chapter:1,preferences:{last_book:'GEN',last_chapter:1,last_verse:1},translations:[{code:'acf'},{code:'nvi'}],translation:{code:'acf'}};
 const initCtx={references:refs,state,window:{location:{search:'?book=JHN&chapter=3&verse=16&end=18&translation=nvi'}},$:(id)=>id==='bible-book-select'?{}:null,ensureExperienceUI(){},resolveUser:async()=>{},loadPreferences:async()=>{},loadCatalog:async()=>{},bindEvents(){},loadPersonalData:async()=>{throw Error('private unavailable');},renderCatalog(){},loadChapter:async(...args)=>calls.push(args),registerBibleOpen(){},showMessage:m=>warnings.push(m),console:{warn(){},error(){}}};
 vm.createContext(initCtx);vm.runInContext(slice(bible,'  async function init()','  function registerBibleOpen()'),initCtx);
 await initCtx.init();assert.equal(calls.length,1);assert.equal(calls[0][0],'JHN');assert.equal(calls[0][1],3);assert.equal(calls[0][2],16);assert.equal(calls[0][3].verseEnd,18);assert.equal(state.translation.code,'nvi');
 initCtx.window.location.search='?book=JHN&chapter=99';await initCtx.init();assert.equal(calls[1][0],'GEN');assert.ok(warnings.length);
 let scrolled=null;const nodes=[15,16,17,18,19].map(n=>({dataset:{verse:String(n)},classList:{toggle(k,on){this[k]=on;}},scrollIntoView(){scrolled=n;}}));
 const focus={document:{querySelectorAll:()=>nodes},showMessage:m=>warnings.push(m)};vm.createContext(focus);vm.runInContext(slice(bible,'  function focusLinkedPassage','  function focusVerse'),focus);
 focus.focusLinkedPassage(16,18);assert.equal(scrolled,16);assert.deepEqual(nodes.map(n=>n.classList['reference-target']),[false,true,true,true,false]);
 for(const file of ['index.html','bible.html'])assert.ok(read(file).indexOf('js/bible-references.js')<read(file).indexOf('js/bible.js?'));
 console.log('Bible passage navigation and resume: PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
