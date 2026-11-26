const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../admin.js'),'utf8');
let reads=[],tasks=[],fail=null,hold=false,pending=[];
const client={from(table){return{select(){return this;},order(){return this;},then(resolve){reads.push(table);const done=()=>resolve(table===fail?{error:new Error('network')}:{data:[{id:table,goal_id:table}],error:null});if(hold)pending.push(done);else done();}}}};
const el=()=>({inert:false,hidden:false,disabled:false,textContent:'',setAttribute(){},classList:{add(){},remove(){}}});
const elements=Object.fromEntries(['home','library','courses','church','agenda','notifications','system'].map(x=>['admin-view-'+x,el()]));
elements['admin-retry-view']=el();elements['admin-load-status']=el();elements['admin-refresh-button']=el();
const ctx={window:{supabaseClient:client,innerWidth:1024},document:{getElementById:id=>elements[id]||null,addEventListener(){},querySelectorAll(){return[];},querySelector(){return null;}},console:{log(){},warn(){},error(){}},showToast(){},
 async loadCourseAccessRequests(){assert.ok(ctx.coursesData.length);tasks.push('access');},
 async loadAdminDashboardData(){tasks.push('dashboard');},
 async loadChurchManagementData(snapshot){assert.equal(snapshot[0].id,'certificates');tasks.push('church');return true;},
 async loadGoogleCalendarStatus(){tasks.push('google');},
 async loadNotificationStats(){tasks.push('push-stats');},
 async loadAdminAutomationStatus(){tasks.push('automation-status');}};
vm.createContext(ctx);vm.runInContext(source,ctx);
async function ticks(){for(let i=0;i<40;i++)await Promise.resolve();}
(async()=>{
 await ctx.loadAdminView('home');assert.equal(reads.length,0);
 ctx.adminAccessReady=true;await ctx.loadAllData('home');
 assert.deepEqual(reads,['courses','events','members']);assert.deepEqual(tasks,['access','dashboard']);
 reads=[];tasks=[];
 await ctx.adminNavigateTo('library');assert.deepEqual(reads,['library_books']);
 await ctx.adminNavigateTo('library');assert.equal(reads.length,1);
 await ctx.loadAllData('library');assert.equal(reads.length,2);
 reads=[];await ctx.adminNavigateTo('church');assert.deepEqual(reads,['certificates']);assert.deepEqual(tasks,['church']);
 reads=[];tasks=[];await ctx.adminNavigateTo('notifications');assert.equal(reads.length,0);assert.deepEqual(tasks,['push-stats','automation-status']);
 reads=[];tasks=[];hold=true;const first=ctx.adminNavigateTo('agenda');await ticks();
 assert.equal(pending.length,2);assert.equal(elements['admin-view-agenda'].inert,true);
 const second=ctx.adminNavigateTo('courses');assert.equal(first,second);assert.equal(elements['admin-view-courses'].inert,true);
 hold=false;pending.splice(0).forEach(f=>f());await first;
 assert.deepEqual(reads,['events','event_attendances','courses']);assert.deepEqual(tasks,['google','access']);assert.equal(elements['admin-view-courses'].inert,false);
 fail='library_books';await ctx.adminNavigateTo('library');await ctx.loadAllData('library');assert.equal(elements['admin-retry-view'].hidden,false);assert.equal(ctx.adminViewFailed.library,true);
 fail=null;await ctx.loadAllData('library');assert.equal(elements['admin-retry-view'].hidden,true);assert.equal(ctx.adminViewFailed.library,false);
 console.log('admin selective loading: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
