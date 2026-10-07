import assert from 'node:assert/strict';
import { parseAlmeida1911 } from '../scripts/convert-almeida1911.mjs';

const fixture = `<h2 id="GEN">GENESIS.</h2><p id="Gen1-1"><span class="first">1</span> No <a id="FNanchor_1"></a><a class="fnanchor pginternal" href="#Footnote_1">[1]</a>
principio creou <i>Deus</i> os céus <span class="pagenum"><a id="Page_1">[1]</a></span> e a terra.</p>
<div class="footnotes"><p>Nota editorial que não deve entrar.</p></div>
<p id="Gen1-2">2 E a terra era sem fórma &amp; vasia.</p>`;
const verses = parseAlmeida1911(fixture);
assert.equal(verses.length, 2);
assert.equal(verses[0].text, 'No principio creou Deus os céus e a terra.');
assert.equal(verses[1].text, 'E a terra era sem fórma & vasia.');
assert.equal(verses[0].book_id, 'GEN');
assert.equal(parseAlmeida1911('<p id="Gen2-1"><span class="first">2</span> Assim os céus.</p>')[0].text, 'Assim os céus.');
assert.throws(() => parseAlmeida1911('<p id="Gen2-2"><span class="first">2</span> Texto.</p>'), /fora do primeiro/);
assert.equal(parseAlmeida1911('<p id="Lam2-1"><span class="smcap">Aleph.</span> <span class="first">2</span> Como cobriu.</p>')[0].text, 'Como cobriu.');
assert.equal(parseAlmeida1911('<p id="Gen1-1">1 <span class="smcap">SENHOR</span>.</p>')[0].text, 'SENHOR.');
assert.equal(parseAlmeida1911('<p id="Mar4-34">31 E sem parabolas.</p>')[0].verse, 34);
assert.equal(parseAlmeida1911('<p id="IIPhi1-1">1 Paulo.</p>')[0].book_id, 'PHM');
assert.equal(parseAlmeida1911('<p id="IPhi1-1">1 Paulo.</p>')[0].book_id, 'PHP');
assert.throws(() => parseAlmeida1911('<p id="Foo1-1">1 Texto.</p>'), /desconhecida/);
assert.throws(() => parseAlmeida1911('<p id="Gen1-1">2 Texto.</p>'), /número impresso/);
assert.throws(() => parseAlmeida1911('<p id="Gen1-1">1 <script>texto</script>.</p>'), /não suportada/);
assert.throws(() => parseAlmeida1911('<p id="Gen1-1">1 &desconhecida;</p>'), /Entidade HTML/);
assert.throws(() => parseAlmeida1911('<p>Sem referências</p>'), /Nenhum versículo/);
console.log('Almeida 1911 converter tests passed.');
