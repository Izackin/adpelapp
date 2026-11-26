const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../admin/member-intakes.js'),'utf8');
function el(tag){return {tag,children:[],textContent:'',value:'',addEventListener(){},appendChild(x){this.children.push(x)},replaceChildren(...x){this.children=x}};}
const root=el('div'), kind=el('select'), status=el('select');
let row={user_id:'u1',member_id:'m1',full_name:'Pessoa teste',email:'test@example.invalid',whatsapp:'62999999999',declared_type:'visitante',contact_allowed:false,review_required:false,followup_status:'novo',congregations:{name:'ADPEL SANTO ANDRÉ'}};
let writes=0, filters=[];
const client={from(table){assert.equal(table,'member_registration_intakes');return {change:null,select(){return this},order(){return this},eq(k,v){filters.push(['eq',k,v]);return this},is(k,v){filters.push(['is',k,v]);return this},neq(k,v){filters.push(['neq',k,v]);return this},update(v){this.change=v;return this},range(){return this},then(resolve){if(this.change){writes++;row.followup_status=this.change.followup_status;return resolve({data:[{user_id:'u1'}]});}return resolve({data:[row]});}};}};
const ctx={document:{addEventListener(){},createElement:el,getElementById:id=>({'member-intake-list':root,'member-intake-kind':kind,'member-intake-status':status}[id])},window:{supabaseClient:client},churchShowToast(){}};
vm.createContext(ctx);vm.runInContext(source,ctx);
(async()=>{
 ctx.memberIntakeOpen=true;ctx.memberIntakeMemberId='m1';
 await ctx.loadMemberIntakes();assert.equal(root.children.length,1);
 assert.ok(filters.some(x=>x[0]==='eq'&&x[1]==='member_id'&&x[2]==='m1'));
 assert.equal(root.children[0].children.some(x=>x.tag==='a'),false);
 row.contact_allowed=true;await ctx.loadMemberIntakes();
 assert.equal(root.children[0].children.find(x=>x.tag==='a').href,'https://wa.me/5562999999999');
 await ctx.saveMemberIntakeStatus('u1','invalid');assert.equal(writes,0);
 await ctx.saveMemberIntakeStatus('u1','em_acompanhamento');assert.equal(writes,1);assert.equal(row.followup_status,'em_acompanhamento');
 ctx.memberIntakeMemberId=null;filters=[];await ctx.loadMemberIntakes();
 assert.ok(filters.some(x=>x[0]==='is'&&x[1]==='member_id'&&x[2]===null));
 assert.ok(filters.some(x=>x[0]==='neq'&&x[1]==='followup_status'&&x[2]==='concluido'));
 console.log('member intake UI: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
