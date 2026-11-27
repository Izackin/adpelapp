const assert=require('node:assert/strict');
const {normalizeBatch,batchPrompt,starterBatch,chapterModels,validateBatchInDatabase}=require('../admin/crud-bible-study.js');
const books=[{id:'PHP',name_pt:'Filipenses',chapter_count:4}];
const pack=[...starterBatch,chapterModels.find(x=>x.book_id==='PHP'&&x.chapter===4)];
const rows=normalizeBatch(JSON.stringify(pack.map(x=>({...x,is_active:true,id:'bad',metadata:{ai_assisted:false},source_code:'bad'}))),books,'Revisor');
assert.equal(rows.length,4);
assert.ok(rows.every(x=>!x.is_active&&x.metadata.ai_assisted&&x.source_code==='adpel-editorial'&&!x.id&&x.author_name==='Revisor'));
for(const bad of [[],[pack[0],pack[0]],[{...pack[0],chapter:5}],[{...pack[0],content:'RESUMO'}],[{...pack[0],verse_start:2}]])assert.throws(()=>normalizeBatch(JSON.stringify(bad),books,'Revisor'));
assert.throws(()=>normalizeBatch(JSON.stringify(pack),books,''));
assert.throws(()=>normalizeBatch('not JSON',books,'Revisor'));
assert.match(batchPrompt(books[0],1,4),/PHP/);
let mismatch=false,duplicate=2;
global.window={supabaseClient:{from(table){
 const filters={};
 const q={select(){return q},eq(k,v){filters[k]=v;return q},order(){return q},maybeSingle:async()=>({data:{id:'acf'}}),limit:async()=>{
 if(table==='bible_verses')return {data:Array.from({length:rows.find(x=>x.chapter===filters.chapter).verse_end-(mismatch?1:0)},(_,i)=>({verse:i+1}))};
 if(table==='bible_commentaries')return {data:filters.chapter===duplicate?[{id:'existing'}]:[]};
 throw Error('Unexpected table');
 }};
 return q;
}}};
(async()=>{
 const result=await validateBatchInDatabase(rows);
 assert.equal(result.filter(x=>x.duplicate).length,1);
 assert.equal(result.filter(x=>!x.duplicate).length,3);
 mismatch=true;
 await assert.rejects(validateBatchInDatabase(rows),/intervalo não corresponde/);
 console.log('Editorial batch validation: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
