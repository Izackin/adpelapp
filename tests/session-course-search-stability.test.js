const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
function slice(s,a,b){const i=s.indexOf(a),j=s.indexOf(b,i);assert.ok(i>=0&&j>i);return s.slice(i,j);}
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};}
async function ticks(){for(let i=0;i<40;i++)await Promise.resolve();}
(async()=>{
 const auth=read('auth.js'),old=deferred(),fresh=deferred();let profile=old;
 const ctx={ADPEL:{profile:{getProfile:()=>profile.promise}},console:{warn(){}}};
 vm.createContext(ctx);
 vm.runInContext(slice(auth,'let currentUser = null;','async function initAuth()')+'\n'+slice(auth,'function getCurrentUserInfo()','// Password Reset'),ctx);
 const oldGen=ctx.setAuthSessionUser({id:'a'}),pendingOld=ctx.refreshAuthProfile('a',oldGen);
 const newGen=ctx.setAuthSessionUser({id:'b'});profile=fresh;const pendingNew=ctx.refreshAuthProfile('b',newGen);
 fresh.resolve({id:'b',role:'user'});assert.equal(await pendingNew,true);
 old.resolve({id:'a',role:'master'});assert.equal(await pendingOld,false);
 assert.equal(ctx.getCurrentUserInfo().profile.id,'b');assert.equal(ctx.getCurrentUserInfo().isMaster,false);
 profile=deferred();const pending=ctx.refreshAuthProfile('b',newGen);ctx.setAuthSessionUser(null);profile.resolve({id:'b',role:'master'});
 assert.equal(await pending,false);assert.equal(ctx.getCurrentUserInfo().profile,null);
 const next=ctx.setAuthSessionUser({id:'c'});profile=deferred();const mismatch=ctx.refreshAuthProfile('c',next);profile.resolve({id:'b',role:'master'});
 await mismatch;assert.equal(ctx.getCurrentUserInfo().profile,null);
 const source=read('js/courses.js');let existing={id:'row',completed:true},writes=[],watched=0,finished=0,hold=null,uid='u',renders=0;
 const query={select(){return this;},eq(){return this;},maybeSingle(){return hold?hold.promise:Promise.resolve({data:existing});},delete(){writes.push('delete');existing=null;return this;},update(){writes.push('update');existing={id:'row',completed:true};return this;},insert(){writes.push('insert');existing={id:'row',completed:true};return Promise.resolve({error:null});},then(resolve){resolve({error:null});}};
 const courseCtx={currentOpenCourse:{id:'c',lessons:['a','b']},getCurrentUserInfo:()=>({isLoggedIn:true,user:{id:uid}}),window:{supabaseClient:{from:()=>query},ADPELJourney:{registerLessonWatched(){watched++;},registerCourseCompleted(){finished++;}}},normalizeLessons:x=>x,getLessonProgress:async()=>[0],renderCourseLessons:async()=>{renders++;},updateCertificateButton:async()=>{},showToast(){},console:{error(){}}};
 vm.createContext(courseCtx);vm.runInContext(slice(source,'const lessonProgressPending=','async function renderCourseLessons'),courseCtx);
 await courseCtx.toggleLessonComplete('c',1,{completeOnly:true});assert.equal(writes.length,0);
 existing=null;hold=deferred();const first=courseCtx.toggleLessonComplete('c',1,{completeOnly:true}),second=courseCtx.toggleLessonComplete('c',1,{completeOnly:true});hold.resolve({data:null});hold=null;await Promise.all([first,second]);assert.deepEqual(writes,['insert']);assert.equal(watched,1);assert.equal(finished,1);
 await courseCtx.toggleLessonComplete('c',1,{completeOnly:true});assert.equal(writes.length,1);
 await courseCtx.toggleLessonComplete('c',1);assert.deepEqual(writes,['insert','delete']);
 existing={id:'row',completed:false};await courseCtx.toggleLessonComplete('c',1,{completeOnly:true});assert.deepEqual(writes,['insert','delete','update']);
 hold=deferred();const stale=courseCtx.toggleLessonComplete('c',0,{completeOnly:true});uid='other';hold.resolve({data:null});hold=null;await stale;assert.equal(writes.length,3);
 assert.match(source,/toggleLessonComplete\(currentCourseForPlayer,currentLessonIndexForPlayer,\{completeOnly:true\}\)/);
 const bible=read('js/bible.js');let term='primeira',rendered=[],requests=[],loading=false;
 const searchCtx={clearSelection(){},state:{translation:{id:'acf'}},$:(id)=>id==='bible-search-input'?{value:term}:id==='bible-loading'?{classList:{add(){loading=false;},remove(){loading=true;}}}:null,parseReference:()=>null,client:()=>({from(){const task=deferred();requests.push(task);return{select(){return this;},eq(){return this;},limit(){return this;},ilike(){return this;},order(){return this;},then(resolve){task.promise.then(resolve);}};}}),renderSearchResults:rows=>rendered.push(rows),console:{error(){}}};
 vm.createContext(searchCtx);vm.runInContext(slice(bible,'  let searchRequest = 0;','  const state =')+slice(bible,'  async function searchBible()','  function renderSearchResults'),searchCtx);
 const p1=searchCtx.searchBible();term='segunda';const p2=searchCtx.searchBible();
 requests[0].resolve({data:['antiga']});await p1;assert.equal(rendered.length,0);assert.equal(loading,true);
 requests[1].resolve({data:['nova']});await p2;assert.deepEqual(rendered,[['nova']]);assert.equal(loading,false);
 const p3=searchCtx.searchBible();searchCtx.invalidateBibleSearch();requests[2].resolve({data:['obsoleta']});await p3;assert.equal(rendered.length,1);
 console.log('Session, lesson completion and Bible search stability: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
