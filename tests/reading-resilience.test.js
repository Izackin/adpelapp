const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const block = (s,a,b) => { const i=s.indexOf(a), j=s.indexOf(b,i+1); assert.ok(i>=0&&j>i); return s.slice(i,j); };
async function testHarpa() {
  const source=read('harpa.html');
  const code=block(source,'    function readHarpaCache()','    function truncate(');
  const hymns=[{id:'1',hino:'Teste',verses:{'1':'Texto'}}];
  const storage=new Map();
  let requests=0, mode='ok', storageBroken=false, now=100000;
  const context={
    CACHE_KEY:'cache',CACHE_TIME_KEY:'time',CACHE_TTL:1000,HARPA_URL:'https://example.invalid/harpa.json',
    Date:{now:()=>now},console:{warn(){}},
    localStorage:{getItem:key=>{if(storageBroken)throw Error('denied');return storage.get(key)||null;},setItem:(key,v)=>{if(storageBroken)throw Error('denied');storage.set(key,v);}},
    fetch:async()=>{requests++; if(mode==='offline')throw Error('offline'); return {ok:true,json:async()=>mode==='empty'?[]:hymns};},
    normalizarHino:(h,id)=>({...h,id})
  };
  vm.createContext(context);
  vm.runInContext(code+'\nthis.load=carregarHarpa;',context);
  assert.equal((await context.load()).length,1);
  assert.equal(requests,1);
  assert.equal((await context.load()).length,1);
  assert.equal(requests,1);
  now+=2000;mode='offline';
  assert.equal((await context.load()).length,1);
  assert.equal(storage.get('time'),'100000');
  mode='empty';
  assert.equal((await context.load()).length,1);
  storage.set('cache','{bad json');mode='ok';
  assert.equal((await context.load()).length,1);
  storageBroken=true;
  assert.equal((await context.load()).length,1);
}
async function testBible() {
  const source=read('js/bible.js');
  const code=block(source,'  async function fetchLocalChapter()','  async function fetchExternalChapter()');
  let requests=0,now=1000, fail=false;
  const state={translation:{id:'a'},book:{id:'GEN'},chapter:1};
  const context={state,chapterCache:new Map(),CHAPTER_CACHE_TTL:300000,CHAPTER_CACHE_LIMIT:12,Date:{now:()=>now},
    client:()=>({from:()=>({select(){return this;},eq(){return this;},order(){requests++;return Promise.resolve(fail?{error:new Error('network')}:{data:[{verse:1,text:state.translation.id+':'+state.chapter}],error:null});}})})};
  vm.createContext(context);vm.runInContext(code+'\nthis.load=fetchLocalChapter;',context);
  const first=await context.load();first.data[0].text='mutated';
  assert.equal((await context.load()).data[0].text,'a:1');assert.equal(requests,1);
  state.translation.id='b';assert.equal((await context.load()).data[0].text,'b:1');assert.equal(requests,2);
  now+=300001;await context.load();assert.equal(requests,3);
  state.chapter=2;fail=true;await context.load();await context.load();assert.equal(requests,5);
  fail=false;for(let i=2;i<=20;i++){state.chapter=i;await context.load();}
  assert.equal(context.chapterCache.size,12);
  const annotations=block(source,'  async function loadPersonalChapterData()','  function renderAnnotations()');
  const pending=[];const annotated={user:{id:'u1'},book:{id:'GEN'},chapter:1,chapterRequest:1};
  const annoCtx={state:annotated,annotationRequest:0,renderAnnotations(){},
    client:()=>({from:()=>({select(){return this;},eq(field,value){if(field==='user_id')assert.equal(value,'u1');return this;},then(resolve){pending.push(resolve);}})})};
  vm.createContext(annoCtx);vm.runInContext(annotations+'\nthis.load=loadPersonalChapterData;',annoCtx);
  const old=annoCtx.load();await Promise.resolve();
  annotated.chapter=2;annotated.chapterRequest=2;
  const newer=annoCtx.load();await Promise.resolve();
  assert.equal(pending.length,6);
  pending.slice(3).forEach(resolve=>resolve({data:[{chapter:2}]}));await newer;
  pending.slice(0,3).forEach(resolve=>resolve({data:[{chapter:1}]}));await old;
  assert.equal(annotated.notes[0].chapter,2);
}
async function testPwa() {
  const source=read('sw.js');
  const code=block(source,'async function putInRuntimeCache(','async function handleNavigation(');
  const response={ok:true,type:'basic',clone(){return this;}};
  const context={RUNTIME_NAME:'runtime',MAX_RUNTIME_ENTRIES:80,console:{warn(){}},
    caches:{open:async()=>{throw Error('quota');},match:async()=>{throw Error('unavailable');}},
    fetch:async()=>response};
  vm.createContext(context);vm.runInContext(code+'\nthis.network=networkFirst;this.image=staleWhileRevalidate;',context);
  assert.equal(await context.network({}),response);
  assert.equal(await context.image({}),response);
}
(async()=>{await testHarpa();await testBible();await testPwa();console.log('reading resilience: PASS');})().catch(e=>{console.error(e);process.exitCode=1;});
