const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../js/home.js'),'utf8');
const load=source.slice(source.indexOf('var homeLoadState ='),source.indexOf('Object.assign(window, {',source.indexOf('var homeLoadState =')));
assert.match(source,/\.from\('verse_of_day'\)\s*\.select\('text, reference'\)/);
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
async function ticks(){for(let i=0;i<24;i++)await Promise.resolve();}
async function runScenario(mode){
 const calls=[],course={id:'c1',is_published:true,is_featured:true,lesson_count:2};
 let session=mode==='guest'?null:'u1',pendingCourses=deferred(),pendingProgress=deferred();
 const state={continue:null,featured:null,agenda:null};
 const ctx={_lastHomeLoad:0,SECTION_LOAD_DEBOUNCE:2000,console:{log(){},error(){}},carregarVersiculoDoDia(){calls.push('verse');return true;},
 getCurrentUserInfo:()=>session?{isLoggedIn:true,user:{id:session}}:{isLoggedIn:false},
 ADPEL:{fetch:{courses(){calls.push('courses');return pendingCourses.promise;},events(){calls.push('events');return Promise.resolve([{id:'e1'}]);},announcements(){calls.push('announcements');return Promise.resolve([]);}}},
 getAllLessonProgress(){calls.push('progress');return pendingProgress.promise;},
 isContentVisibleNow:()=>true,isHomeEventVisible:()=>true,normalizeLessons:x=>x||[],
 buildUnifiedAgenda:(events,announcements)=>events.concat(announcements),
 fetchAttendancesForEvents:()=>Promise.resolve([{event_id:'e1',confirmed_count:3,has_confirmed:false}]),
 renderContinueSection:rows=>{state.continue=rows;},renderFeaturedCourses:rows=>{state.featured=rows;},renderHomeEvents(){},
 renderCommunityAgenda:(events,byEvent)=>{state.agenda={events,byEvent};},document:{getElementById:()=>null}};
 vm.createContext(ctx);vm.runInContext(load,ctx);
 const first=ctx.loadHomeData();const second=ctx.loadHomeData();assert.equal(first,second);
 await ticks();assert.equal(calls.filter(x=>x==='courses').length,1);assert.equal(calls.filter(x=>x==='progress').length,mode==='guest'?0:1);
 // Agenda renders before the unresolved course request.
 assert.equal(state.agenda.events[0].id,'e1');assert.equal(state.agenda.byEvent.e1[0].confirmed_count,3);
 if(mode==='switch'){
   const oldCourses=pendingCourses,oldProgress=pendingProgress;
   session='u2';pendingCourses=deferred();pendingProgress=deferred();
   const newer=ctx.loadHomeData();await ticks();
   pendingCourses.resolve([course]);pendingProgress.resolve([]);await newer;
   oldCourses.resolve([course]);oldProgress.resolve([{course_id:'c1',lesson_index:0}]);await first;
   assert.equal(state.continue.length,0);assert.equal(state.featured.length,1);
 }else{
   if(mode==='failure')pendingProgress.reject(Error('simulated'));
   else pendingProgress.resolve([{course_id:'c1',lesson_index:0}]);
   pendingCourses.resolve([course]);await first;
   assert.equal(state.featured.length,1);assert.equal(state.continue.length,mode==='member'?1:0);
   if(mode==='member'){assert.equal(state.continue[0].totalLessons,2);assert.equal(state.continue[0].completedLessons,1);}
 }
}
(async()=>{for(const mode of ['member','guest','switch','failure'])await runScenario(mode);console.log('home parallel loading: PASS');})().catch(e=>{console.error(e);process.exitCode=1;});
