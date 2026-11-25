const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname,'../js/app-notifications.js'),'utf8');
let user={id:'u1'}, saved=new Map(), mode='ok', pending=[];
const context={window:{supabaseClient:{
  from(table){
    assert.equal(table,'event_reminder_preferences');
    return {
      select(){return this;},eq(k,v){this.uid=v;return this;},
      maybeSingle(){
        const data=saved.has(this.uid)?{enabled:saved.get(this.uid)}:null;
        if(mode==='pending')return new Promise(resolve=>pending.push(()=>resolve({data})));
        return Promise.resolve({data});
      },
      upsert(payload){
        assert.equal(payload.user_id,user.id);
        if(mode==='error')return Promise.resolve({error:new Error('network')});
        saved.set(payload.user_id,payload.enabled);return Promise.resolve({error:null});
      }
    };
  },removeChannel(){} }},
  document:{addEventListener(){},getElementById(){return null;}},
  getCurrentUserInfo:()=>user?{isLoggedIn:true,user}:{isLoggedIn:false},
  console:{warn(){}},clearTimeout(){},setTimeout(){return 1;},setInterval(){return 1;},clearInterval(){}};
vm.createContext(context);vm.runInContext(source,context);
(async()=>{
  context.resetAppNotificationSession('u1');
  await context.loadEventReminderPreference();
  assert.equal(context.eventReminderEnabled,false);
  assert.equal(saved.size,0);
  await context.toggleEventReminderPreference();
  assert.equal(saved.get('u1'),true);
  assert.equal(context.eventReminderEnabled,true);
  await context.toggleEventReminderPreference();
  assert.equal(saved.get('u1'),false);
  mode='error';await context.toggleEventReminderPreference();
  assert.equal(context.eventReminderError,true);
  assert.equal(context.eventReminderEnabled,null);
  mode='ok';await context.loadEventReminderPreference();
  assert.equal(context.eventReminderEnabled,false);
  saved.set('u1',true);mode='pending';
  const old=context.loadEventReminderPreference();
  assert.equal(pending.length,1);
  user={id:'u2'};context.resetAppNotificationSession('u2');mode='ok';
  await context.loadEventReminderPreference();
  pending[0]();await old;
  assert.equal(context.eventReminderEnabled,false);
  assert.equal(saved.has('u2'),false);
  console.log('event reminder preference: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
