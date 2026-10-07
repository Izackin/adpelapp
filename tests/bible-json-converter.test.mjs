import assert from 'node:assert/strict';
import {cleanSourceText,convertExplicitBooks,convertExplicitRows} from '../scripts/convert-bible-json.mjs';
assert.equal(cleanSourceText('Palavra <br> com <b>ênfase</b> &amp; fé.'),'Palavra com ênfase & fé.');
assert.equal(cleanSourceText('Deus criou.<sup>ⓐ</sup> E disse <sup>[1]</sup>Deus.'),'Deus criou. E disse Deus.');
assert.throws(()=>cleanSourceText('<script>erro</script>'),/HTML desconhecido/);
const rows=convertExplicitRows([{book:1,chapter:6,verse:21,text:'Texto 21'},{book:1,chapter:6,verse:19,text:'Texto que abrange 19 e 20.'}]);
assert.deepEqual(rows.map(v=>v.verse),[19,21]); // Never renumber a gap or invent verse 20.
assert.equal(rows[1].chapter,6);
assert.deepEqual(convertExplicitRows([{book:1,chapter:1,verse:1,text:'<br>'},{book:1,chapter:1,verse:2,text:'Palavra'}]).map(v=>v.verse),[2]);
const books=convertExplicitBooks([{nr:57,name:'Filemom',chapters:[{chapter:1,verses:[{chapter:1,verse:2,text:'Texto'}]}]}]);
assert.equal(books[0].book_id,'PHM');
assert.equal(books[0].verse,2);
assert.throws(()=>convertExplicitBooks([{code:'GEN',id:2,chapters:[]}]),/Identidade/);
assert.throws(()=>convertExplicitRows([{book:67,chapter:1,verse:1,text:'Texto'}]),/Livro desconhecido/);
console.log('Explicit Bible JSON converter tests passed.');
