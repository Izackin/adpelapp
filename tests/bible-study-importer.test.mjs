import assert from 'node:assert/strict';
import {parseLexicon,parseTagged,parseMorphology,plainStrong,chapterSql} from '../scripts/import-bible-study.mjs';
const greekLex=parseLexicon('G3056\tG3056 =\tG3056\tλόγος\tlogos\tG:N-M\tword\t<b>a saying</b>','grc',{G3056:'palavra'});
assert.equal(greekLex.get('G3056').metadata.definition_en,'a saying');
assert.equal(greekLex.get('G3056').gloss_pt,'palavra');
const hebLex=parseLexicon('H0430\tH0430G =\tH0430G\tאֱלֹהִים\telohim\tH:N-M\tGod\tRESTRICTED_CONTENT','he',{H430:'Deus'});
assert.equal(JSON.stringify([...hebLex.values()]).includes('RESTRICTED_CONTENT'),false);
assert.equal(plainStrong('H0430G'),'H430');assert.equal(plainStrong('G0746'),'G746');
const greek=parseTagged([
  'Jhn.1.1#01=N(K)O\tλόγος (logos)\tWord\tG3056=N-NSM\tλόγος=word\tNA27',
  'Jhn.1.1#02=K\tλόγος (logos)\tWord\tG3056=N-NSM\tλόγος=word\tTR'
].join('\n'),'grc',greekLex,{G3056:'palavra'});
assert.equal(greek.selected,1);assert.equal(greek.verses[0].tokens.length,1);
const supplied=parseTagged('Jhn.1.1#01=NKO\tὁ (ho)\t<the>\tG3588=T-NSM\tὁ=the','grc',greekLex);
assert.equal(supplied.verses[0].tokens[0].metadata.gloss_en,'<the>');
assert.throws(()=>parseTagged('Jhn.1.1#01=NKO\tbad\tWord\tG3056=N-NSM','grc',greekLex),/Forma grega/);
const line='Gen.1.1#01=L\tבְּ/רֵאשִׁ֖ית\tbe/reshit\tin/beginning\tH9003/{H7225G}\tHR/Ncfsa';
const heb=parseTagged(line,'he',new Map(),{H7225:'princípio'});
assert.equal(heb.verses[0].tokens[0].strong_number,'H7225');
assert.equal(heb.verses[0].tokens[0].metadata.components,'H9003/{H7225G}');
assert.equal(heb.verses[0].tokens[0].surface.includes('/'),false);
assert.throws(()=>parseTagged(line+'\n'+line,'he',new Map()),/duplicado/);
const merged=parseTagged(line.replace('Gen.1.1','1Sa.20.42')+'\n'+line.replace('Gen.1.1','1Sa.20.42(21.1)'),'he',new Map());
assert.equal(merged.verses.length,1);assert.equal(merged.verses[0].tokens[1].token_position,2);
assert.deepEqual(merged.verses[0].metadata.alternate_references,['(21.1)']);
const title=parseTagged(line.replace('Gen.1.1','Psa.3.0(3.1)'),'he',new Map());
assert.equal(title.verses[0].verse,0);
const aramaic=parseTagged(line.replace('Gen.1.1','Dan.2.4').replace('HR/Ncfsa','AR/Ncfsa'),'he',new Map());
assert.equal(aramaic.verses[0].language,'arc');
assert.equal(parseMorphology('N-NSM\tFunction=Noun; Case=Nominative; Number=Singular; Gender=Masculine','grc')[0].description_pt,'Classe=substantivo; Caso=nominativo; Número=singular; Gênero=masculino');
const sql=chapterSql(greek.verses);assert.match(sql,/on conflict\(original_verse_id,token_position\)/);assert.match(sql,/join saved/);
console.log('Bible study importer tests passed.');
