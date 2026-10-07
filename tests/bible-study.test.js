const assert=require('node:assert/strict');
global.window={};global.document={addEventListener(){}};
const {plainStrong,morphologyParts,safeUrl}=require('../js/bible-study.js');
assert.equal(plainStrong('H0430G'),'H430');assert.equal(plainStrong('invalid'),null);
assert.deepEqual(morphologyParts('HTd/Ncfsa','he'),['HTd','HNcfsa']);
assert.deepEqual(morphologyParts('AC/Sp3mp','arc'),['AC','ASp3mp']);
assert.deepEqual(morphologyParts('N-NSM','grc'),['N-NSM']);
assert.equal(safeUrl('javascript:alert(1)'),null);assert.equal(safeUrl('https://www.stepbible.org'),'https://www.stepbible.org/');
console.log('Bible study helpers tests passed.');
