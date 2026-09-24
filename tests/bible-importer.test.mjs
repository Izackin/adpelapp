import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  buildSampleReport,
  cleanUsfmVerse,
  decodeUtf8,
  emitSqlBatches,
  parseUsfm,
  validateDataset
} from '../scripts/import-bible-translation.mjs';

const metadata = {
  code: 'teste', name: 'Teste', short_name: 'TST', language: 'pt-BR', provider: 'Teste',
  source_type: 'local',
  license_type: 'CC BY 4.0', copyright_notice: 'Aviso integral', attribution: 'Atribuição integral',
  source_url: 'https://example.com/source', source_version: 'fixture 1', obtained_at: '2026-09-24',
  sha256: 'a'.repeat(64), expected_books: 1, expected_chapters: 1, expected_references: 2,
  classification: 'B', production_ready: false
};

const fixture = `\\id GEN fixture
\\c 1
\\p
\\v 1 No \\nd início\\nd* criou Deus \\f + \\fr 1.1 \\ft nota editorial\\f* os céus.
\\q1 e a terra.
\\v 2 Texto com \\it ênfase\\it* e UTF-8: João, ação, SABACTÂNI.`;

const parsed = parseUsfm(fixture, 'fixture');
assert.equal(parsed.bookId, 'GEN');
assert.deepEqual(parsed.verses.map(({ verse, text }) => ({ verse, text })), [
  { verse: 1, text: 'No início criou Deus os céus. e a terra.' },
  { verse: 2, text: 'Texto com ênfase e UTF-8: João, ação, SABACTÂNI.' }
]);
assert.equal(cleanUsfmVerse('Palavra \\add acrescentada\\add*.'), 'Palavra acrescentada.');
assert.throws(() => parseUsfm('\\id GEN\n\\c 1\n\\v 1 Texto \\zzz inválido', 'bad'), /marcador USFM desconhecido/);
assert.throws(() => parseUsfm('\\id GEN\n\\c 1\n\\v 1-2 Texto', 'range'), /versificação composta/);
assert.throws(() => parseUsfm('\\id XYZ\n\\c 1\n\\v 1 Texto', 'book'), /livro desconhecido/);
assert.throws(() => decodeUtf8(Uint8Array.from([0xc3, 0x28]), 'bad-utf8'), /UTF-8 válido/);

assert.deepEqual(validateDataset(metadata, parsed.verses), { books: 1, chapters: 1, references: 2, warnings: [] });
assert.throws(() => validateDataset({ ...metadata, source_type: 'remote' }, parsed.verses), /source_type deve ser local/);
assert.throws(() => validateDataset({ ...metadata, production_ready: true }, parsed.verses), /somente fonte classe A/);
assert.throws(() => validateDataset({ ...metadata, expected_references: 3 }, parsed.verses), /esperadas 3 referências/);
assert.throws(() => validateDataset(metadata, [...parsed.verses, parsed.verses[0]]), /referência duplicada/);
assert.throws(() => validateDataset(metadata, [...parsed.verses].reverse()), /ordem canônica/);
assert.throws(() => validateDataset(metadata, [{ ...parsed.verses[0], text: '' }, parsed.verses[1]]), /texto vazio/);
assert.throws(() => validateDataset(metadata, [{ ...parsed.verses[0], text: '<b>texto<\/b>' }, parsed.verses[1]]), /HTML residual/);
assert.throws(() => validateDataset(metadata, [{ ...parsed.verses[0], verse: 999 }, parsed.verses[1]]), /versículo impossível/);

const fullSampleFixture = [
  ['GEN',1],['PSA',23],['ISA',53],['MAT',5],['JHN',1],['JHN',3],['ROM',8],['1CO',13],['HEB',11],['REV',22]
].map(([book_id, chapter]) => ({ book_id, chapter, verse: 1, text: `${book_id} ${chapter}` }));
assert.equal(buildSampleReport(fullSampleFixture).length, 10);

const sqlDir = await mkdtemp(path.join(os.tmpdir(), 'adpel-import-test-'));
await emitSqlBatches(sqlDir, metadata, parsed.verses, 1);
const firstBatch = await readFile(path.join(sqlDir, '001-verses.sql'), 'utf8');
assert.match(firstBatch, /Conflito textual inesperado/);
assert.match(firstBatch, /on conflict .* do nothing/i);
assert.equal(await readFile(path.join(sqlDir, '001-verses.sql'), 'utf8'), firstBatch); // geração determinística/idempotente

console.log('Bible translation importer tests passed.');
