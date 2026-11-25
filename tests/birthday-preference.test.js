const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname,'../js/app-notifications.js'),'utf8');
let user={id:'u1'}, saved=new Map(), mode='ok', pending=[];
const context={window:{supabaseClient:{
  from(table){
    assert.equal(table,'birthday_reminder_preferences');
    return {
      select(){return this;},delete(){this.removing=true;return this;},
      eq(k,v){this.uid=v;if(this.removing){saved.delete(v);return Promise.resolve({error:null});}return this;},
      maybeSingle(){
        const data=saved.get(this.uid)||null;
        if(mode==='pending')return new Promise(resolve=>pending.push(()=>resolve({data})));
        return Promise.resolve({data});
      },
      upsert(payload){
        assert.equal(payload.user_id,user.id);
        if(mode==='error')return Promise.resolve({error:new Error('network')});
        saved.set(payload.user_id,{birth_day:payload.birth_day,birth_month:payload.birth_month});return Promise.resolve({error:null});
      }
    };
  },removeChannel(){} }},
  document:{addEventListener(){},getElementById(){return null;}},
  getCurrentUserInfo:()=>user?{isLoggedIn:true,user}:{isLoggedIn:false},
  console:{warn(){}},clearTimeout(){},setTimeout(){return 1;},setInterval(){return 1;},clearInterval(){}};
vm.createContext(context);vm.runInContext(source,context);
(async()=>{
  context.resetAppNotificationSession('u1');
  await context.loadBirthdayPreference();
  assert.equal(context.birthdayPreference,null);
  assert.equal(saved.size,0);
  context.setBirthdayDraft('day','31');context.setBirthdayDraft('month','4');
  await context.saveBirthdayPreference(false);
  assert.equal(saved.size,0);
  context.setBirthdayDraft('day','29');context.setBirthdayDraft('month','2');
  await context.saveBirthdayPreference(false);
  assert.equal(saved.get('u1').birth_day,29);
  assert.equal(saved.get('u1').birth_month,2);
  await context.saveBirthdayPreference(true);
  assert.equal(saved.size,0);
  assert.equal(context.birthdayPreference,null);
  context.setBirthdayDraft('day','10');context.setBirthdayDraft('month','5');
  mode='error';await context.saveBirthdayPreference(false);
  assert.equal(context.birthdayReady,false);
  assert.equal(saved.size,0);
  saved.set('u1',{birth_day:29,birth_month:2});mode='pending';
  const old=context.loadBirthdayPreference();assert.equal(pending.length,1);
  user={id:'u2'};context.resetAppNotificationSession('u2');mode='ok';
  await context.loadBirthdayPreference();pending[0]();await old;
  assert.equal(context.birthdayPreference,null);
  assert.equal(context.birthdayDraftDay,'');
  console.log('birthday preference: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
