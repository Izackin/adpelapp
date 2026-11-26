const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../admin.js'),'utf8');
let requests=[],pending=[],certSnapshots=[],warnings=[],renderOrder=[],mode='hold',failedTable=null;
const client={from(table){return{select(){return this;},order(){return this;},then(resolve){requests.push(table);const finish=()=>resolve(table===failedTable?{error:{message:'simulated'}}:{data:[{id:table,goal_id:table}],error:null});if(mode==='hold')pending.push(finish);else finish();}}}};
const elements={'admin-load-status':{textContent:'',setAttribute(){}},'admin-refresh-button':{disabled:false},'admin-dashboard-updated':{textContent:''}};
const ctx={window:{supabaseClient:client},document:{getElementById:id=>elements[id]||null,addEventListener(){},querySelectorAll(){return[];},querySelector(){return null;}},console:{warn(){},error(){},log(){}},showToast:x=>warnings.push(x),
 renderAdminCourses(){renderOrder.push('courses');},renderAdminAgenda(){renderOrder.push('agenda');},renderAdminCofres(){renderOrder.push('cofres');},
 async loadCourseAccessRequests(){assert.ok(ctx.coursesData.length);renderOrder.push('course_access');},
 async loadChurchManagementData(snapshot){certSnapshots.push(snapshot);renderOrder.push('church');},
 async loadAdminDashboardData(){renderOrder.push('dashboard');}};
vm.createContext(ctx);vm.runInContext(source,ctx);
async function ticks(n=30){for(let i=0;i<n;i++)await Promise.resolve();}
(async()=>{
 await ctx.loadAllData();assert.equal(requests.length,0);
 ctx.adminAccessReady=true;
 const first=ctx.loadAllData();await ticks();
 assert.equal(pending.length,5);assert.equal(elements['admin-refresh-button'].disabled,true);
 const second=ctx.loadAllData();assert.equal(first,second);await ticks();assert.equal(pending.length,5);
 pending.splice(0).forEach(f=>f());await ticks();
 assert.equal(pending.length,4);assert.ok(renderOrder.includes('agenda'));
 mode='auto';pending.splice(0).forEach(f=>f());await first;
 assert.equal(requests.length,18);assert.equal(requests.filter(x=>x==='certificates').length,2);
 assert.equal(certSnapshots.length,2);assert.equal(certSnapshots[0][0].id,'certificates');
 assert.ok(renderOrder.indexOf('courses')<renderOrder.indexOf('course_access'));
 assert.ok(renderOrder.indexOf('church')<renderOrder.indexOf('dashboard'));
 assert.equal(elements['admin-refresh-button'].disabled,false);
 assert.equal(ctx.adminLoadPromise,null);
 const prior=ctx.coursesData;
 failedTable='courses';await ctx.loadAllData();
 assert.equal(ctx.coursesData,prior);assert.ok(warnings.some(x=>x.includes('cursos')));
 assert.equal(elements['admin-dashboard-updated'].textContent,'Atualização parcial');
 console.log('admin load lifecycle: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
