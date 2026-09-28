const assert = require('node:assert/strict');
const core = require('../admin/member-data-core.js');

// CSV realista: BOM, ponto e vírgula, aspas, vírgula, quebra de linha e acentos.
const csv = '\uFEFFNome completo;E-mail;Telefone;Observações\r\n' +
  '"Ana, Maria"; ANA@EXEMPLO.COM ;"(11) 99999-0000";"Linha 1\nLinha 2"\r\n' +
  'João da Silva;joao@example.com;11988887777;"Disse ""sim"""';
const parsed = core.parseCsv(csv);
assert.deepEqual(parsed.headers, ['Nome completo', 'E-mail', 'Telefone', 'Observações']);
assert.equal(parsed.rows.length, 2);
assert.equal(parsed.rows[0][0], 'Ana, Maria');
assert.equal(parsed.rows[0][3], 'Linha 1\nLinha 2');
assert.equal(parsed.rows[1][3], 'Disse "sim"');

const commaCsv = 'Nome completo,Email\n"Souza, José",jose@example.com';
assert.equal(core.detectCsvDelimiter(commaCsv), ',');
assert.equal(core.parseCsv(commaCsv).rows[0][0], 'Souza, José');

// XLSX: datas tipadas, célula vazia, telefone numérico e serial do Excel.
const dateCell = new Date(2020, 4, 17);
const fakeXlsx = {
  read() { return { SheetNames: ['Membros'], Sheets: { Membros: {} } }; },
  utils: {
    sheet_to_json() {
      return [
        ['Nome', 'Nascimento', 'Telefone', 'Data de entrada'],
        ['Maria Ávila', dateCell, 11999990000, 45292],
        ['Carlos', '', '', '31/12/2023']
      ];
    }
  }
};
const workbook = core.parseWorkbook(new ArrayBuffer(4), fakeXlsx);
assert.equal(workbook.rows[0][1], dateCell);
assert.equal(workbook.rows[0][2], 11999990000);
assert.equal(core.normalizeDate(workbook.rows[0][3]).value, '2024-01-01');

assert.equal(core.normalizeDate('29/02/2024').value, '2024-02-29');
assert.equal(core.normalizeDate('29/02/2023').error, 'Data inválida');
assert.equal(core.normalizeDate('2026-9-8').value, '2026-09-08');
assert.equal(core.normalizeEmail(' TESTE@EXAMPLE.COM '), 'teste@example.com');
assert.equal(core.normalizePhoneDigits('(85) 9 9999-8888'), '85999998888');
assert.equal(core.normalizeBoolean('não').value, false);
assert.equal(core.normalizeBoolean('SIM').value, true);
assert.equal(core.normalizeStatus('Transferência').value, 'transferido');
assert.equal(core.normalizeRole('Líder').value, 'lider');

const headers = ['Nome', 'Nascimento', 'Telefone', 'E-mail', 'Situação', 'Cargo', 'Batizado'];
const mapping = core.suggestColumnMapping(headers);
assert.deepEqual(mapping, ['full_name', 'birth_date', 'phone', 'email', 'status', 'role', 'baptized']);
assert.deepEqual(core.mappingErrors(mapping), []);
assert.match(core.mappingErrors(['email', 'email'])[0], /mesmo campo/);

const existing = [{
  id: '11111111-1111-1111-1111-111111111111',
  full_name: 'João da Silva', birth_date: '1990-01-05', phone: '(11) 98888-7777',
  email: 'joao@example.com', status: 'afastado', role: 'pastor', baptized: true,
  baptism_date: '2010-03-10', address: 'Rua A', notes: 'Privado'
}];
const rows = [
  ['João da Silva', '05/01/1990', '', 'JOAO@example.com', 'Ativo', 'Membro', ''],
  ['Outro Nome', '', '11988887777', '', 'Ativo', 'Membro', 'Não'],
  ['Duplicado no arquivo', '01/01/2000', '11900001111', 'dup@example.com', 'Ativo', 'Membro', 'Sim'],
  ['Duplicado no arquivo', '01/01/2000', '', 'dup@example.com', 'Ativo', 'Membro', 'Sim'],
  ['', '31/02/2024', '', 'email-invalido', 'Desconhecido', 'Bispo', 'Talvez']
];
const analysis = core.analyzeRows(rows, mapping, existing, {});
assert.equal(analysis.summary.total, 5);
assert.equal(analysis.summary.duplicates, 3);
assert.equal(analysis.summary.ready, 1);
assert.equal(analysis.summary.errors, 1);
assert.equal(analysis.items[0].duplicate.reason, 'E-mail igual');
assert.equal(analysis.items[1].duplicate.reason, 'Telefone igual');
assert.equal(analysis.items[3].duplicate.existing._sourceRow, 4);
assert.deepEqual(Object.keys(analysis.unknowns.status), ['desconhecido']);
assert.deepEqual(Object.keys(analysis.unknowns.role), ['bispo']);

const mappedAnalysis = core.analyzeRows(rows, mapping, existing, {
  status: { desconhecido: 'afastado' }, role: { bispo: 'pastor' }
});
assert.equal(mappedAnalysis.items[4].errors.some((error) => error.code === 'unknown_status'), false);
assert.equal(mappedAnalysis.items[4].errors.some((error) => error.code === 'unknown_role'), false);
assert.equal(mappedAnalysis.items[4].errors.some((error) => error.code === 'required_full_name'), true);

// Atualização parcial não apaga valores existentes quando a planilha está vazia.
const incoming = analysis.items[0];
const merged = core.mergeMemberForUpdate(existing[0], incoming.member, incoming.provided);
assert.equal(merged.baptized, true);
assert.equal(merged.status, 'ativo');
assert.equal(merged.role, 'membro');
assert.equal(merged.address, 'Rua A');
assert.equal(merged.baptism_date, '2010-03-10');
assert.equal(merged.email, 'joao@example.com');

const blankDefaults = core.analyzeRows([
  ['João da Silva', '05/01/1990', '', 'JOAO@example.com', '', '', '']
], mapping, existing, {}).items[0];
const mergedBlankDefaults = core.mergeMemberForUpdate(existing[0], blankDefaults.member, blankDefaults.provided);
assert.equal(mergedBlankDefaults.status, 'afastado');
assert.equal(mergedBlankDefaults.role, 'pastor');
assert.equal(mergedBlankDefaults.baptized, true);

// Neutralização contra CSV/spreadsheet injection.
assert.equal(core.neutralizeSpreadsheetCell('=HYPERLINK("x")'), "'=HYPERLINK(\"x\")");
assert.equal(core.neutralizeSpreadsheetCell('+1+1'), "'+1+1");
const protectedCsv = core.rowsToCsv(['Nome'], [['=CMD()']], ';');
assert.match(protectedCsv, /'=CMD\(\)/);

// Volumes representativos ficam integralmente em memória e não tocam o banco.
[10, 100, 1000, 5000].forEach((size) => {
  const volumeRows = Array.from({ length: size }, (_, index) => [
    `Pessoa ${index}`, '01/01/1990', `859${String(index).padStart(8, '0')}`,
    `pessoa${index}@example.com`, 'ativo', 'membro', 'sim'
  ]);
  const result = core.analyzeRows(volumeRows, mapping, [], {});
  assert.equal(result.summary.total, size);
  assert.equal(result.summary.ready, size);
  assert.equal(result.summary.errors, 0);
  assert.equal(result.summary.duplicates, 0);
});

assert.deepEqual(core.chunk(Array.from({ length: 250 }, (_, index) => index), 100).map((part) => part.length), [100, 100, 50]);
assert.equal(core.presets.membros_web.available, false);
assert.match(core.presets.membros_web.reason, /arquivo real/i);

console.log('member-data-core: all assertions passed');
