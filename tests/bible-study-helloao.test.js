const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.resolve(__dirname,'../js/bible-study.js'),'utf8');
const catalog=require('../js/bible-references.js').books;
const license='https://creativecommons.org/licenses/by/4.0/';
const sample={dataset:{id:'open-cross-ref',licenseUrl:license},book:{id:'JHN'},chapter:{number:3,content:[
{verse:16,references:[{book:'ROM',chapter:5,verse:8,endVerse:9,score:3},{book:'ROM',chapter:5,verse:8,endVerse:9,score:5},{book:'BAD',chapter:1,verse:1},{book:'ROM',chapter:99,verse:1}]},
{verse:17,references:[{book:'ROM',chapter:5,verse:8,endVerse:9,score:4}]},
{verse:18,references:[{book:'GEN',chapter:1,verse:1,score:99}]}]}};
let calls=0,status=200,requestOptions;
const env={document:{addEventListener(){}},window:{},module:{exports:{}},AbortController,setTimeout,clearTimeout,fetch:async(url,opts)=>{calls++;requestOptions=opts;return {ok:status===200,status,text:async()=>JSON.stringify(sample)};}};
vm.createContext(env);vm.runInContext(src,env);
const {aoUrl,aoValidate,aoReferenceRows,aoReferenceMarkup,aoCommentMarkup,aoFetch}=env.module.exports;
const scope={start:16,end:17};
assert.equal(aoUrl('matthew-henry','JHN',3),'https://bible.helloao.org/api/c/matthew-henry/JHN/3.simple.json');
assert.throws(()=>aoUrl('../bad','JHN',3));assert.throws(()=>aoUrl('open-cross-ref','JHN',0));
assert.throws(()=>aoValidate({...sample,dataset:{...sample.dataset,licenseUrl:'https://example.com'}},'open-cross-ref','JHN',3));
assert.throws(()=>aoValidate(sample,'open-cross-ref','JHN',4));
const rows=aoReferenceRows(aoValidate(sample,'open-cross-ref','JHN',3),scope,catalog);
assert.equal(rows.length,1);assert.equal(rows[0].score,5);assert.equal(rows[0].from.join(','),'16,17');
const html=aoReferenceMarkup(sample,scope,catalog,'acf');
assert.match(html,/Romanos 5:8–9/);assert.match(html,/end=9/);assert.doesNotMatch(html,/Gênesis/);
const commentary={commentary:{id:'matthew-henry',licenseUrl:'https://creativecommons.org/publicdomain/mark/1.0/',language:'eng'},book:{id:'JHN'},chapter:{number:3,introduction:'<intro>',content:[{type:'verse',number:16,text:'<script>'},{type:'verse',number:1,text:'Other entry'}]}};
const comment=aoCommentMarkup(aoValidate(commentary,'matthew-henry','JHN',3),scope);
assert.match(comment,/&lt;script&gt;/);assert.doesNotMatch(comment,/<script>/);assert.match(comment,/Outras entradas do capítulo/);
(async()=>{
 await Promise.all([aoFetch('open-cross-ref','JHN',3),aoFetch('open-cross-ref','JHN',3)]);
 assert.equal(calls,1);assert.equal(requestOptions.credentials,'omit');assert.equal(requestOptions.referrerPolicy,'no-referrer');
 await aoFetch('open-cross-ref','JHN',3);assert.equal(calls,1);
 status=404;assert.equal(await aoFetch('open-cross-ref','JHN',4),null);
 status=500;await assert.rejects(aoFetch('open-cross-ref','JHN',4),/Fonte indisponível/);
 console.log('HelloAO contract, cache and failure: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
