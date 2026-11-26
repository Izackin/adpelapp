const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
const day=()=>{const d=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const p=Object.fromEntries(d.map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;};
const snapshot=(uid,xp)=>({progress:{user_id:uid,xp,total_points:xp},missions:[],mission_date:day()});
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
async function ticks(){for(let i=0;i<40;i++)await Promise.resolve();}
(async()=>{
 let uid='u1',calls=[],profiles=0,held=null,clock=Date.now();
 const context={console:{error(){},warn(){}},document:{getElementById:()=>null},getCurrentUserInfo:()=>uid?{isLoggedIn:true,user:{id:uid},profile:{id:uid,full_name:'Test'}}:{isLoggedIn:false},window:{supabaseClient:{rpc(name,args){const owner=uid;calls.push({name,args,owner});if(held){const h=held;held=null;return h.promise;}return Promise.resolve({data:snapshot(owner,10),error:null});},from(){profiles++;throw Error('profile should be reused');}}}};
 vm.runInNewContext(read('spiritual-progress.js'),context);
 const journey=context.window.ADPELJourney;
 const first=await Promise.all([journey.init(),journey.init(),journey.init()]);
 assert.equal(calls.length,1);assert.equal(calls[0].name,'record_journey_action');assert.equal(calls[0].args.action_type,'daily_visit');assert.equal(first[0].user_id,'u1');assert.equal(profiles,0);
 await journey.init();assert.equal(calls.length,1);
 const a=deferred();held=a;
 const one=journey.recordAction('bible_open');const two=journey.recordAction('hymn_opened');
 await ticks();assert.equal(calls.length,2);
 a.resolve({data:snapshot('u1',20),error:null});await one;await two;assert.equal(calls.length,3);assert.equal(calls[2].args.action_type,'hymn_opened');
 const slow=deferred();held=slow;const old=journey.recordAction('bible_open');await ticks();
 uid=null;journey.resetSession();uid='u2';const newer=await journey.init();assert.equal(newer.user_id,'u2');
 slow.resolve({data:snapshot('u1',999),error:null});assert.equal(await old,null);assert.equal((await journey.init()).user_id,'u2');
 // Separate Bible/Harpa pages still resolve the SDK session if auth.js is absent.
 let standaloneCalls=0;const standalone={console:{error(){},warn(){}},document:{getElementById:()=>null},window:{ADPEL:{auth:{getSession:async()=>({user:{id:'standalone'}})}},supabaseClient:{rpc(){standaloneCalls++;return Promise.resolve({data:snapshot('standalone',12),error:null});},from(){return{select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{id:'standalone',full_name:'Test'},error:null})};}}}};
 vm.runInNewContext(read('spiritual-progress.js'),standalone);const standaloneResult=await standalone.window.ADPELJourney.recordAction('bible_open');assert.equal(standaloneResult.user_id,'standalone');assert.equal(standaloneCalls,1);
 const src=read('supabase.js');const code=src.slice(src.indexOf('async function fetchEvents('),src.indexOf('async function fetchCourses('));
 let queryCalls=[],fail=false;
 const query={select(){return this;},eq(k,v){queryCalls.push([k,v]);return this;},or(v){queryCalls.push(['or',v]);return this;},order(){return Promise.resolve(fail?{error:Error('network')}:{data:[{id:'e'}],error:null});}};
 const agenda={supabase:{from(n){assert.equal(n,'events');return query;}},console:{error(){}}};vm.createContext(agenda);vm.runInContext(code,agenda);
 await agenda.fetchEvents();assert.equal(queryCalls.length,0);await agenda.fetchEvents({upcoming:true,strict:true});assert.equal(queryCalls[0][0],'is_active');assert.equal(queryCalls[1][0],'is_published');assert.match(queryCalls[2][1],/^end_date\.gte\.\d{4}-\d{2}-\d{2},and\(end_date\.is\.null,event_date\.gte\.\d{4}-\d{2}-\d{2}\)$/);
 fail=true;await assert.rejects(()=>agenda.fetchEvents({upcoming:true,strict:true}));assert.equal((await agenda.fetchEvents()).length,0);
 console.log('public performance: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
