const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname,'../js/app-notifications.js'),'utf8');
let user={id:'u1'}, mode='ok', pending=[], confirm=false, writes=0;
const data=Array.from({length:25},(_,i)=>({id:'n'+i,recipient_id:'u1',title:'Aviso',read_at:i<20?'2026-01-01':null}));
const badge={textContent:'',classList:{add(){},remove(){}}};
const panel={innerHTML:'',classList:{add(){},remove(){}}};
const document={getElementById:id=>id==='notification-badge'?badge:id==='notifications-panel'?panel:null,addEventListener(){},visibilityState:'visible'};
const client={
  from(){return {count:false,uid:null,unread:false,visible:false,id:null,change:null,cap:Infinity,select(c,o){this.count=!!o?.head;return this;},eq(k,v){if(k==='recipient_id')this.uid=v;if(k==='id')this.id=v;return this;},is(k){if(k==='read_at')this.unread=true;if(k==='dismissed_at')this.visible=true;return this;},update(change){this.change=change;return this;},lte(){return this;},order(){return this;},limit(n){this.cap=n;return this;},
    then(resolve){
      const rows=data.filter(x=>x.recipient_id===this.uid&&(!this.unread||!x.read_at)&&(!this.visible||!x.dismissed_at)&&(!this.id||x.id===this.id));
      if(this.change&&mode!=='error'){writes++;rows.forEach(x=>Object.assign(x,this.change));}
      const result=mode==='error'?{error:new Error('network')}:
        this.count?{count:rows.length,data:null}:{data:rows.slice(0,this.cap)};
      if(mode==='pending')pending.push(()=>resolve(result));else resolve(result);
    }};},
  channel(){return {on(){return this;},subscribe(){return this;}};},removeChannel(){}
};
const context={window:{supabaseClient:client,location:{search:''},confirm:()=>confirm},document,URLSearchParams:class {get(){return null;}},
  getCurrentUserInfo:()=>user?{isLoggedIn:true,user}:{isLoggedIn:false},
  escapeHtml:s=>String(s||''), console:{warn(){}},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}};
vm.createContext(context);
vm.runInContext(source,context);
(async()=>{
  await context.loadUserNotifications();
  assert.equal(context.appNotificationsCache.length,20);
  assert.equal(context.appNotificationsUnread,5);
  assert.equal(badge.textContent,'5');
  assert.equal(context.appNotificationsHasMore,true);
  context.appNotificationsLimit=40;
  await context.loadUserNotifications();
  assert.equal(context.appNotificationsCache.length,25);
  assert.equal(context.appNotificationsHasMore,false);
  context.appNotificationsFilter='unread';
  await context.loadUserNotifications();
  assert.equal(context.appNotificationsCache.length,5);
  assert.ok(context.appNotificationsCache.every(x=>!x.read_at));
  context.appNotificationsPanelOpen=true;
  context.renderNotificationsPanel();
  assert.ok(panel.innerHTML.includes('Voltar ao aplicativo'));
  assert.ok(panel.innerHTML.includes('Limpar tudo'));
  assert.ok(!panel.innerHTML.includes('Mensagem de aniversário'));
  context.setNotificationsView('settings');
  assert.ok(panel.innerHTML.includes('Mensagem de aniversário'));
  context.setNotificationsView('inbox');
  await context.dismissAppNotifications('n20');
  assert.equal(writes,1);
  assert.equal(context.appNotificationsUnread,4);
  assert.equal(data.length,25);
  assert.ok(!context.appNotificationsCache.some(x=>x.id==='n20'));
  await context.dismissAppNotifications(null);
  assert.equal(writes,1);
  context.closeNotificationsPanel();
  assert.equal(panel.innerHTML,'');
  mode='error';await context.loadUserNotifications();
  assert.equal(context.appNotificationsCache.length,4);
  assert.equal(context.appNotificationsError,true);
  mode='pending';const old=context.loadUserNotifications();await Promise.resolve();await Promise.resolve();
  assert.equal(pending.length,2);
  user={id:'u2'};mode='ok';await context.loadUserNotifications();
  assert.equal(context.appNotificationsCache.length,0);
  assert.equal(context.appNotificationsUnread,0);
  pending.splice(0).forEach(f=>f());await old;
  assert.equal(context.appNotificationsCache.length,0);
  context.mergeRealtimeNotification({id:'wrong',recipient_id:'u1'});
  assert.equal(context.appNotificationsRefreshTimer,null);
  user=null;await context.loadUserNotifications();
  assert.equal(context.appNotificationsOwnerId,null);
  assert.equal(context.appNotificationsUnread,null);
  assert.equal(badge.textContent,'');
  console.log('notification inbox v2: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
