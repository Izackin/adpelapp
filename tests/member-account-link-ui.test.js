const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../admin/member-account-links.js'),'utf8');
function el(tag){return {tag,children:[],textContent:'',value:'',classList:{add(){},remove(){}},setAttribute(){},addEventListener(){},appendChild(x){this.children.push(x)},replaceChildren(...x){this.children=x}};}
const body=el('div'),modal=el('div');
let link=null,confirm=false,writes=0,mode='ok';
const accounts=[{id:'u1',full_name:'Conta 1'},{id:'u2',full_name:'Conta 2'}];
const client={from(table){return {filters:{},action:'read',select(){return this},eq(k,v){this.filters[k]=v;return this},order(){return this},limit(){return this},maybeSingle(){return Promise.resolve({data:link,error:null})},insert(v){this.action='insert';this.payload=v;return this},delete(){this.action='delete';return this},then(resolve){if(this.action!=='read'){writes++;if(mode==='error')return resolve({error:{code:'23505'}});link=this.action==='insert'?this.payload:null;return resolve({data:[{member_id:'m1'}]});}return resolve({data:accounts.filter(a=>!this.filters.id||a.id===this.filters.id)});}};}};
const ctx={document:{createElement:el,getElementById:id=>id==='member-account-body'?body:id==='member-account-modal'?modal:null,addEventListener(){}},window:{supabaseClient:client,confirm:()=>confirm},membersData:[{id:'m1',full_name:'Membro 1'}],churchShowToast(){},console};
vm.createContext(ctx);vm.runInContext(source,ctx);
(async()=>{
 await ctx.openMemberAccountLink('m1');
 assert.equal(ctx.memberAccountState.accounts.length,2);
 await ctx.changeMemberAccountLink('m1','u1',false);assert.equal(writes,0);
 confirm=true;
 await ctx.changeMemberAccountLink('m1','unknown',false);assert.equal(writes,0);
 await ctx.changeMemberAccountLink('m1','u1',false);assert.equal(writes,1);assert.equal(ctx.memberAccountState.link.user_id,'u1');
 await ctx.changeMemberAccountLink('m1','u2',true);assert.equal(writes,1);
 await ctx.changeMemberAccountLink('m1','u1',true);assert.equal(writes,2);assert.equal(ctx.memberAccountState.link,null);
 mode='error';await ctx.changeMemberAccountLink('m1','u2',false);assert.equal(ctx.memberAccountState.link,null);assert.equal(ctx.memberAccountState.busy,false);
 ctx.closeMemberAccountLink();assert.equal(ctx.memberAccountState.memberId,null);assert.equal(body.children.length,0);
 console.log('member account link UI: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
