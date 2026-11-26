const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
const src=read('js/courses.js');
const code=src.slice(src.indexOf('let certificateIssueBusy ='),src.indexOf('// Bloquear orientação'));
const button={disabled:false};
let fail=true,rendered=[],inserted=0,stored=null,owner='u',messages=[];
const record={id:'id',user_id:'u',course_id:'c',title:'Do banco'};
const query={select(){return this;},eq(){return this;},order(){return this;},limit(){return this;},maybeSingle(){return Promise.resolve({data:stored,error:null});},insert(){inserted++;return this;},single(){return Promise.resolve(fail?{error:{code:'42501'}}:{data:record,error:null});}};
const ctx={currentOpenCourse:{id:'c',title:'Curso',lessons:['a','b']},getCurrentUserInfo:()=>({isLoggedIn:true,user:{id:owner},profile:{full_name:'Teste'}}),window:{supabaseClient:{from:()=>query}},document:{getElementById:()=>button},normalizeLessons:x=>x,getLessonProgress:()=>Promise.resolve([0,1]),updateCertificateButton(){button.disabled=false;},renderIssuedCertificate:r=>rendered.push(r),showToast:m=>messages.push(m),console:{warn(){}}};
vm.createContext(ctx);vm.runInContext(code,ctx);
(async()=>{
 await ctx.downloadCertificate();assert.equal(rendered.length,0);assert.equal(inserted,1);assert.equal(button.disabled,false);
 fail=false;await ctx.downloadCertificate();assert.equal(rendered[0],record);assert.equal(inserted,2);
 stored=record;await ctx.downloadCertificate();assert.equal(rendered.length,2);assert.equal(inserted,2);
 const certificates=read('js/certificates.js');assert.match(certificates,/Registro ADPEL:/);assert.match(certificates,/escapeHtml\(safeDuration\)/);assert.match(certificates,/eq\('id',cert.id\).eq\('user_id',info.user.id\)/);
 assert.match(read('admin/crud-library.js'),/storage.from\('library-files'\).upload/);
 console.log('certificate frontend integrity: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
