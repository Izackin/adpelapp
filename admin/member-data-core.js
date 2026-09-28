(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ADPELMemberData = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';

  var FIELD_DEFINITIONS = [
    { key: 'full_name', label: 'Nome completo', aliases: ['nome', 'nome completo', 'membro', 'nome do membro'] },
    { key: 'birth_date', label: 'Data de nascimento', aliases: ['nascimento', 'data nascimento', 'data de nascimento', 'aniversario'] },
    { key: 'phone', label: 'Telefone', aliases: ['telefone', 'celular', 'whatsapp', 'fone', 'contato'] },
    { key: 'email', label: 'E-mail', aliases: ['email', 'e-mail'] },
    { key: 'address', label: 'Endereço', aliases: ['endereco', 'logradouro'] },
    { key: 'entry_date', label: 'Data de entrada', aliases: ['entrada', 'admissao', 'data de admissao', 'recebimento', 'data de recebimento'] },
    { key: 'status', label: 'Status', aliases: ['status', 'situacao'] },
    { key: 'role', label: 'Função/Cargo', aliases: ['funcao', 'cargo', 'cargo eclesiastico'] },
    { key: 'baptized', label: 'Batizado', aliases: ['batizado', 'batismo', 'e batizado'] },
    { key: 'baptism_date', label: 'Data do batismo', aliases: ['data batismo', 'data de batismo', 'data do batismo'] },
    { key: 'notes', label: 'Observações', aliases: ['observacoes', 'notas', 'observacao'] }
  ];

  var TEMPLATE_HEADERS = FIELD_DEFINITIONS.map(function(field) { return field.label; });
  var VALID_STATUSES = ['ativo', 'afastado', 'transferido', 'falecido', 'removido'];
  var VALID_ROLES = ['visitante', 'membro', 'obreiro', 'lider', 'pastor', 'crianca', 'jovem'];
  var MEMBER_IMPORT_PRESETS = {
    generic: { id: 'generic', label: 'Genérico', available: true },
    adpel_template: { id: 'adpel_template', label: 'Modelo ADPEL', available: true },
    membros_web: { id: 'membros_web', label: 'Membros Web', available: false, reason: 'Pendente de arquivo real de exemplo.' }
  };

  var STATUS_ALIASES = {
    'ativo': 'ativo',
    'membro ativo': 'ativo',
    'afastado': 'afastado',
    'transferido': 'transferido',
    'transferencia': 'transferido',
    'falecido': 'falecido',
    'obito': 'falecido',
    'removido': 'removido',
    'excluido': 'removido'
  };

  var ROLE_ALIASES = {
    'visitante': 'visitante',
    'membro': 'membro',
    'obreiro': 'obreiro',
    'lider': 'lider',
    'pastor': 'pastor',
    'crianca': 'crianca',
    'jovem': 'jovem'
  };

  function asText(value) {
    if (value === null || value === undefined) return '';
    return String(value);
  }

  function normalizeComparison(value) {
    return asText(value)
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  function normalizeName(value) {
    return asText(value).trim().replace(/\s+/g, ' ');
  }

  function normalizeEmail(value) {
    return asText(value).trim().toLowerCase();
  }

  function isValidEmail(value) {
    if (!value) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
  }

  function normalizePhoneDigits(value) {
    return asText(value).replace(/\D/g, '');
  }

  function isValidDateParts(year, month, day) {
    var date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function datePartsToIso(year, month, day) {
    if (!isValidDateParts(year, month, day)) return null;
    return String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  }

  function excelSerialToIso(serial) {
    if (!Number.isFinite(serial) || serial <= 0 || serial > 2958465) return null;
    var wholeDays = Math.floor(serial);
    var date = new Date(Date.UTC(1899, 11, 30) + wholeDays * 86400000);
    return datePartsToIso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  function normalizeDate(value) {
    if (value === null || value === undefined || value === '') return { value: null, error: null };
    if (value instanceof Date && !isNaN(value.getTime())) {
      return { value: datePartsToIso(value.getFullYear(), value.getMonth() + 1, value.getDate()), error: null };
    }
    if (typeof value === 'number') {
      var excelDate = excelSerialToIso(value);
      return excelDate ? { value: excelDate, error: null } : { value: null, error: 'Data inválida' };
    }

    var text = asText(value).trim();
    if (!text) return { value: null, error: null };
    var isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
      var iso = datePartsToIso(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
      return iso ? { value: iso, error: null } : { value: null, error: 'Data inválida' };
    }
    var brMatch = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (brMatch) {
      var br = datePartsToIso(Number(brMatch[3]), Number(brMatch[2]), Number(brMatch[1]));
      return br ? { value: br, error: null } : { value: null, error: 'Data inválida' };
    }
    return { value: null, error: 'Data inválida' };
  }

  function normalizeBoolean(value) {
    if (value === null || value === undefined || value === '') return { value: false, error: null, wasBlank: true };
    if (typeof value === 'boolean') return { value: value, error: null, wasBlank: false };
    if (typeof value === 'number') {
      if (value === 1) return { value: true, error: null, wasBlank: false };
      if (value === 0) return { value: false, error: null, wasBlank: false };
    }
    var normalized = normalizeComparison(value);
    if (['sim', 'yes', 'true', '1', 'batizado'].indexOf(normalized) >= 0) {
      return { value: true, error: null, wasBlank: false };
    }
    if (['nao', 'no', 'false', '0', 'nao batizado'].indexOf(normalized) >= 0) {
      return { value: false, error: null, wasBlank: false };
    }
    return { value: null, error: 'Valor de batismo não reconhecido', wasBlank: false };
  }

  function mapEnumeratedValue(value, aliases, validValues, customMap) {
    var normalized = normalizeComparison(value);
    if (!normalized) return { value: null, raw: '', error: null };
    var custom = customMap && customMap[normalized];
    var mapped = custom || aliases[normalized] || null;
    if (mapped && validValues.indexOf(mapped) >= 0) return { value: mapped, raw: normalized, error: null };
    return { value: null, raw: normalized, error: 'Valor não reconhecido' };
  }

  function normalizeStatus(value, customMap) {
    var result = mapEnumeratedValue(value, STATUS_ALIASES, VALID_STATUSES, customMap);
    if (!result.raw) result.value = 'ativo';
    return result;
  }

  function normalizeRole(value, customMap) {
    var result = mapEnumeratedValue(value, ROLE_ALIASES, VALID_ROLES, customMap);
    if (!result.raw) result.value = 'membro';
    return result;
  }

  function buildAliasIndex() {
    var index = {};
    FIELD_DEFINITIONS.forEach(function(field) {
      field.aliases.concat([field.label]).forEach(function(alias) {
        index[normalizeComparison(alias)] = field.key;
      });
    });
    return index;
  }

  var ALIAS_INDEX = buildAliasIndex();

  function suggestColumnMapping(headers) {
    var used = {};
    return headers.map(function(header) {
      var key = ALIAS_INDEX[normalizeComparison(header)] || '';
      if (key && used[key]) return '';
      if (key) used[key] = true;
      return key;
    });
  }

  function mappingErrors(mapping) {
    var used = {};
    var errors = [];
    mapping.forEach(function(field, index) {
      if (!field) return;
      if (used[field] !== undefined) {
        errors.push('As colunas ' + (used[field] + 1) + ' e ' + (index + 1) + ' apontam para o mesmo campo.');
      } else {
        used[field] = index;
      }
    });
    if (used.full_name === undefined) errors.push('Mapeie uma coluna para Nome completo.');
    return errors;
  }

  function countDelimiterInFirstRecord(text, delimiter) {
    var quoted = false;
    var count = 0;
    for (var i = 0; i < text.length; i++) {
      var character = text[i];
      if (character === '"') {
        if (quoted && text[i + 1] === '"') { i += 1; continue; }
        quoted = !quoted;
      } else if (!quoted && character === delimiter) {
        count += 1;
      } else if (!quoted && (character === '\n' || character === '\r')) {
        break;
      }
    }
    return count;
  }

  function detectCsvDelimiter(text) {
    return countDelimiterInFirstRecord(text, ';') > countDelimiterInFirstRecord(text, ',') ? ';' : ',';
  }

  function parseCsvMatrix(input, delimiter) {
    var text = asText(input).replace(/^\uFEFF/, '');
    var selectedDelimiter = delimiter || detectCsvDelimiter(text);
    var matrix = [];
    var row = [];
    var field = '';
    var quoted = false;

    for (var i = 0; i < text.length; i++) {
      var character = text[i];
      if (quoted) {
        if (character === '"' && text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else if (character === '"') {
          quoted = false;
        } else {
          field += character;
        }
      } else if (character === '"' && field === '') {
        quoted = true;
      } else if (character === selectedDelimiter) {
        row.push(field);
        field = '';
      } else if (character === '\n' || character === '\r') {
        if (character === '\r' && text[i + 1] === '\n') i += 1;
        row.push(field);
        matrix.push(row);
        row = [];
        field = '';
      } else {
        field += character;
      }
    }
    if (field !== '' || row.length > 0) {
      row.push(field);
      matrix.push(row);
    }
    return matrix;
  }

  function matrixToDataset(matrix) {
    var safeMatrix = Array.isArray(matrix) ? matrix : [];
    if (!safeMatrix.length) return { headers: [], rows: [] };
    var headers = safeMatrix[0].map(function(header, index) {
      var value = asText(header).replace(/^\uFEFF/, '').trim();
      return value || 'Coluna ' + (index + 1);
    });
    var rows = safeMatrix.slice(1).filter(function(row) {
      return row.some(function(value) { return value !== null && value !== undefined && asText(value).trim() !== ''; });
    }).map(function(row) {
      var normalizedRow = [];
      for (var i = 0; i < headers.length; i++) normalizedRow.push(row[i] === undefined ? '' : row[i]);
      return normalizedRow;
    });
    return { headers: headers, rows: rows };
  }

  function parseCsv(input) {
    return matrixToDataset(parseCsvMatrix(input));
  }

  function parseWorkbook(arrayBuffer, xlsx) {
    if (!xlsx || typeof xlsx.read !== 'function' || !xlsx.utils) throw new Error('Biblioteca XLSX indisponível.');
    var workbook = xlsx.read(arrayBuffer, { type: 'array', cellDates: true, raw: true });
    var sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error('A planilha não possui abas.');
    var matrix = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: true });
    return matrixToDataset(matrix);
  }

  function collectMappedValues(row, mapping) {
    var values = {};
    mapping.forEach(function(field, index) {
      if (field) values[field] = row[index];
    });
    return values;
  }

  function hasCellValue(value) {
    return value !== null && value !== undefined && asText(value).trim() !== '';
  }

  function issue(code, message) {
    return { code: code, message: message, severity: 'error' };
  }

  function normalizeMemberRow(row, mapping, rowNumber, valueMappings) {
    var raw = collectMappedValues(row, mapping);
    var errors = [];
    var unknowns = [];
    var name = normalizeName(raw.full_name);
    var email = normalizeEmail(raw.email);
    var birthDate = normalizeDate(raw.birth_date);
    var entryDate = normalizeDate(raw.entry_date);
    var baptismDate = normalizeDate(raw.baptism_date);
    var baptized = normalizeBoolean(raw.baptized);
    var status = normalizeStatus(raw.status, valueMappings && valueMappings.status);
    var role = normalizeRole(raw.role, valueMappings && valueMappings.role);

    if (!name) errors.push(issue('required_full_name', 'Nome obrigatório não informado'));
    if (birthDate.error) errors.push(issue('invalid_birth_date', 'Data de nascimento inválida'));
    if (entryDate.error) errors.push(issue('invalid_entry_date', 'Data de entrada inválida'));
    if (baptismDate.error) errors.push(issue('invalid_baptism_date', 'Data de batismo inválida'));
    if (email && !isValidEmail(email)) errors.push(issue('invalid_email', 'E-mail inválido'));
    if (baptized.error) errors.push(issue('invalid_baptized', baptized.error));
    if (status.error) {
      errors.push(issue('unknown_status', 'Status não reconhecido: ' + asText(raw.status).trim()));
      unknowns.push({ type: 'status', value: status.raw, original: asText(raw.status).trim() });
    }
    if (role.error) {
      errors.push(issue('unknown_role', 'Função/Cargo não reconhecida: ' + asText(raw.role).trim()));
      unknowns.push({ type: 'role', value: role.raw, original: asText(raw.role).trim() });
    }

    return {
      rowNumber: rowNumber,
      raw: raw,
      member: {
        full_name: name,
        birth_date: birthDate.value,
        phone: normalizeName(raw.phone) || null,
        email: email || null,
        address: normalizeName(raw.address) || null,
        entry_date: entryDate.value,
        status: status.value,
        role: role.value,
        baptized: baptized.value,
        baptism_date: baptismDate.value,
        notes: normalizeName(raw.notes) || null
      },
      provided: FIELD_DEFINITIONS.reduce(function(result, field) {
        result[field.key] = hasCellValue(raw[field.key]);
        return result;
      }, {}),
      comparison: {
        email: email,
        phone: normalizePhoneDigits(raw.phone),
        name: normalizeComparison(name),
        birthDate: birthDate.value
      },
      errors: errors,
      unknowns: unknowns,
      valid: errors.length === 0
    };
  }

  function comparisonForExisting(member) {
    return {
      email: normalizeEmail(member.email),
      phone: normalizePhoneDigits(member.phone),
      name: normalizeComparison(member.full_name),
      birthDate: member.birth_date || null
    };
  }

  function buildDuplicateIndexes(existingMembers) {
    var indexes = { email: {}, phone: {}, nameBirth: {} };
    (existingMembers || []).forEach(function(member) {
      var comparison = comparisonForExisting(member);
      if (comparison.email && !indexes.email[comparison.email]) indexes.email[comparison.email] = member;
      if (comparison.phone && !indexes.phone[comparison.phone]) indexes.phone[comparison.phone] = member;
      if (comparison.name && comparison.birthDate) {
        var key = comparison.name + '|' + comparison.birthDate;
        if (!indexes.nameBirth[key]) indexes.nameBirth[key] = member;
      }
    });
    return indexes;
  }

  function findDuplicate(comparison, indexes) {
    if (comparison.email && indexes.email[comparison.email]) {
      return { kind: 'probable', reason: 'E-mail igual', existing: indexes.email[comparison.email] };
    }
    if (comparison.phone && indexes.phone[comparison.phone]) {
      return { kind: 'probable', reason: 'Telefone igual', existing: indexes.phone[comparison.phone] };
    }
    var nameBirthKey = comparison.name && comparison.birthDate ? comparison.name + '|' + comparison.birthDate : '';
    if (nameBirthKey && indexes.nameBirth[nameBirthKey]) {
      return { kind: 'possible', reason: 'Nome e data de nascimento iguais', existing: indexes.nameBirth[nameBirthKey] };
    }
    return null;
  }

  function addToDuplicateIndexes(item, indexes) {
    var marker = { id: null, full_name: item.member.full_name, _sourceRow: item.rowNumber };
    if (item.comparison.email && !indexes.email[item.comparison.email]) indexes.email[item.comparison.email] = marker;
    if (item.comparison.phone && !indexes.phone[item.comparison.phone]) indexes.phone[item.comparison.phone] = marker;
    if (item.comparison.name && item.comparison.birthDate) {
      var key = item.comparison.name + '|' + item.comparison.birthDate;
      if (!indexes.nameBirth[key]) indexes.nameBirth[key] = marker;
    }
  }

  function analyzeRows(rows, mapping, existingMembers, valueMappings) {
    var indexes = buildDuplicateIndexes(existingMembers || []);
    var items = [];
    var unknownMap = { status: {}, role: {} };
    for (var i = 0; i < rows.length; i++) {
      var item = normalizeMemberRow(rows[i], mapping, i + 2, valueMappings || {});
      item.duplicate = item.valid ? findDuplicate(item.comparison, indexes) : null;
      item.unknowns.forEach(function(unknown) {
        unknownMap[unknown.type][unknown.value] = unknown.original;
      });
      items.push(item);
      if (item.valid && !item.duplicate) addToDuplicateIndexes(item, indexes);
    }
    var summary = items.reduce(function(result, item) {
      result.total += 1;
      if (!item.valid) result.errors += 1;
      else if (item.duplicate) result.duplicates += 1;
      else result.ready += 1;
      return result;
    }, { total: 0, ready: 0, duplicates: 0, errors: 0 });
    return { items: items, summary: summary, unknowns: unknownMap };
  }

  function mergeMemberForUpdate(existing, incoming, provided) {
    var result = Object.assign({}, existing);
    var fields = ['full_name', 'birth_date', 'phone', 'email', 'address', 'entry_date', 'status', 'role', 'baptized', 'baptism_date', 'notes'];
    fields.forEach(function(field) {
      if (provided && provided[field] === false) return;
      var value = incoming[field];
      if (value !== null && value !== undefined && value !== '') result[field] = value;
    });
    return result;
  }

  function chunk(items, size) {
    var chunks = [];
    var chunkSize = Math.max(1, Number(size) || 100);
    for (var i = 0; i < items.length; i += chunkSize) chunks.push(items.slice(i, i + chunkSize));
    return chunks;
  }

  function neutralizeSpreadsheetCell(value) {
    if (value === null || value === undefined) return '';
    var text = asText(value);
    return /^[=+\-@]/.test(text) ? "'" + text : text;
  }

  function csvEscape(value, delimiter) {
    var safe = neutralizeSpreadsheetCell(value);
    if (safe.indexOf('"') >= 0 || safe.indexOf('\n') >= 0 || safe.indexOf('\r') >= 0 || safe.indexOf(delimiter) >= 0) {
      return '"' + safe.replace(/"/g, '""') + '"';
    }
    return safe;
  }

  function rowsToCsv(headers, rows, delimiter) {
    var selectedDelimiter = delimiter || ';';
    var lines = [headers.map(function(value) { return csvEscape(value, selectedDelimiter); }).join(selectedDelimiter)];
    rows.forEach(function(row) {
      lines.push(row.map(function(value) { return csvEscape(value, selectedDelimiter); }).join(selectedDelimiter));
    });
    return '\uFEFF' + lines.join('\r\n');
  }

  function memberToExportRow(member) {
    return [
      member.full_name || '', member.birth_date || '', member.phone || '', member.email || '',
      member.address || '', member.entry_date || '', member.status || '', member.role || '',
      member.baptized ? 'Sim' : 'Não', member.baptism_date || '', member.notes || ''
    ].map(neutralizeSpreadsheetCell);
  }

  function filterMembers(members, filters) {
    var selected = filters || {};
    return (members || []).filter(function(member) {
      if (selected.status && member.status !== selected.status) return false;
      if (selected.role && member.role !== selected.role) return false;
      if (selected.baptized === 'true' && !member.baptized) return false;
      if (selected.baptized === 'false' && member.baptized) return false;
      if (selected.entryStart && (!member.entry_date || member.entry_date < selected.entryStart)) return false;
      if (selected.entryEnd && (!member.entry_date || member.entry_date > selected.entryEnd)) return false;
      return true;
    });
  }

  return {
    fields: FIELD_DEFINITIONS,
    templateHeaders: TEMPLATE_HEADERS,
    validStatuses: VALID_STATUSES,
    validRoles: VALID_ROLES,
    presets: MEMBER_IMPORT_PRESETS,
    normalizeComparison: normalizeComparison,
    normalizeName: normalizeName,
    normalizeEmail: normalizeEmail,
    normalizePhoneDigits: normalizePhoneDigits,
    normalizeDate: normalizeDate,
    normalizeBoolean: normalizeBoolean,
    normalizeStatus: normalizeStatus,
    normalizeRole: normalizeRole,
    suggestColumnMapping: suggestColumnMapping,
    mappingErrors: mappingErrors,
    detectCsvDelimiter: detectCsvDelimiter,
    parseCsvMatrix: parseCsvMatrix,
    parseCsv: parseCsv,
    matrixToDataset: matrixToDataset,
    parseWorkbook: parseWorkbook,
    normalizeMemberRow: normalizeMemberRow,
    analyzeRows: analyzeRows,
    mergeMemberForUpdate: mergeMemberForUpdate,
    chunk: chunk,
    neutralizeSpreadsheetCell: neutralizeSpreadsheetCell,
    rowsToCsv: rowsToCsv,
    memberToExportRow: memberToExportRow,
    filterMembers: filterMembers
  };
});
