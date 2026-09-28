// ============================================================
// MEMBER IMPORT - CSV/XLSX mapping, preview and batch processing
// ============================================================

(function() {
  'use strict';

  var PAGE_SIZE = 50;
  var BATCH_SIZE = 100;
  var ALLOWED_FIELDS = ['full_name', 'birth_date', 'phone', 'email', 'address', 'entry_date', 'status', 'role', 'baptized', 'baptism_date', 'notes'];
  var state = resetState();

  function resetState() {
    return {
      step: 'file', fileName: '', source: 'generic', headers: [], rows: [], mapping: [],
      valueMappings: { status: {}, role: {} }, analysis: null, page: 1,
      duplicateStrategy: 'ignore', reviewActions: {}, running: false, progress: null, result: null
    };
  }

  function safe(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(String(value == null ? '' : value));
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(character) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character];
    });
  }

  function toast(message, type) {
    if (typeof churchShowToast === 'function') churchShowToast(message, type);
    else if (typeof showToast === 'function') showToast(message, type);
  }

  function core() {
    if (!window.ADPELMemberData) throw new Error('Núcleo de importação indisponível.');
    return window.ADPELMemberData;
  }

  function modal() { return document.getElementById('member-import-modal'); }
  function body() { return document.getElementById('member-import-body'); }

  window.showMemberImport = function() {
    state = resetState();
    var element = modal();
    if (!element) return;
    element.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    render();
  };

  window.hideMemberImport = function() {
    if (state.running) return toast('Aguarde o processamento do lote atual.', 'warning');
    var element = modal();
    if (element) element.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  };

  window.downloadMemberImportTemplate = function() {
    if (!window.XLSX) return toast('Biblioteca de planilhas indisponível.', 'error');
    var guide = [
      ['Modelo ADPEL para importação de membros'],
      ['Preencha a aba Membros. Apenas Nome completo é obrigatório.'],
      ['Datas aceitas: DD/MM/AAAA ou AAAA-MM-DD. Batizado: Sim ou Não.'],
      ['Status: ativo, afastado, transferido, falecido ou removido.'],
      ['Função/Cargo: visitante, membro, obreiro, lider, pastor, crianca ou jovem.']
    ];
    var workbook = window.XLSX.utils.book_new();
    var memberSheet = window.XLSX.utils.aoa_to_sheet([core().templateHeaders]);
    memberSheet['!cols'] = core().templateHeaders.map(function(header) { return { wch: Math.max(16, header.length + 3) }; });
    window.XLSX.utils.book_append_sheet(workbook, memberSheet, 'Membros');
    window.XLSX.utils.book_append_sheet(workbook, window.XLSX.utils.aoa_to_sheet(guide), 'Instruções');
    window.XLSX.writeFile(workbook, 'modelo-importacao-membros-adpel.xlsx', { compression: true });
  };

  window.handleMemberImportFile = async function(input) {
    var file = input && input.files ? input.files[0] : null;
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      input.value = '';
      return toast('O arquivo excede o limite de 15 MB.', 'error');
    }
    var extension = String(file.name.split('.').pop() || '').toLowerCase();
    if (['csv', 'xlsx'].indexOf(extension) === -1) {
      input.value = '';
      return toast('Use um arquivo CSV ou XLSX.', 'error');
    }
    try {
      var dataset;
      if (extension === 'csv') dataset = core().parseCsv(await file.text());
      else dataset = core().parseWorkbook(await file.arrayBuffer(), window.XLSX);
      if (!dataset.headers.length || !dataset.rows.length) throw new Error('O arquivo não possui registros para importar.');
      state.fileName = file.name;
      state.headers = dataset.headers;
      state.rows = dataset.rows;
      state.mapping = core().suggestColumnMapping(dataset.headers);
      state.step = 'mapping';
      render();
    } catch (error) {
      console.error('Falha ao ler arquivo de membros:', error);
      toast(error.message || 'Não foi possível ler o arquivo.', 'error');
    }
  };

  window.setMemberImportSource = function(value) { state.source = value || 'generic'; };

  window.setMemberImportMapping = function(index, value) {
    state.mapping[Number(index)] = value || '';
    renderMapping();
  };

  window.prepareMemberImportPreview = function() {
    var errors = core().mappingErrors(state.mapping);
    if (errors.length) return toast(errors[0], 'error');
    state.analysis = core().analyzeRows(state.rows, state.mapping, window.membersData || membersData || [], state.valueMappings);
    state.step = 'preview';
    state.page = 1;
    render();
  };

  window.setMemberValueMapping = function(type, encodedRawValue, mappedValue) {
    var rawValue = decodeURIComponent(encodedRawValue);
    if (!state.valueMappings[type]) state.valueMappings[type] = {};
    if (mappedValue) state.valueMappings[type][rawValue] = mappedValue;
    else delete state.valueMappings[type][rawValue];
    window.prepareMemberImportPreview();
  };

  window.setMemberDuplicateStrategy = function(value) {
    state.duplicateStrategy = value;
    renderPreview();
  };

  window.setMemberReviewAction = function(rowNumber, value) {
    state.reviewActions[String(rowNumber)] = value;
  };

  window.changeMemberImportPage = function(page) {
    var totalPages = Math.max(1, Math.ceil(state.analysis.items.length / PAGE_SIZE));
    state.page = Math.min(totalPages, Math.max(1, Number(page) || 1));
    renderPreview();
  };

  window.backMemberImportStep = function() {
    if (state.step === 'preview') state.step = 'mapping';
    else state.step = 'file';
    render();
  };

  function render() {
    if (!body()) return;
    if (state.step === 'mapping') return renderMapping();
    if (state.step === 'preview') return renderPreview();
    if (state.step === 'result') return renderResult();
    renderFile();
  }

  function stepHeader(current) {
    var steps = [['file', '1. Arquivo'], ['mapping', '2. Mapeamento'], ['preview', '3. Prévia'], ['result', '4. Resultado']];
    return '<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">' + steps.map(function(step) {
      var active = step[0] === current;
      return '<div class="rounded-lg px-3 py-2 text-xs font-semibold text-center ' + (active ? 'bg-adpel-600 text-white' : 'bg-gray-100 text-gray-500') + '">' + step[1] + '</div>';
    }).join('') + '</div>';
  }

  function renderFile() {
    body().innerHTML = stepHeader('file') +
      '<div class="space-y-5">' +
      '<div class="rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-900"><strong>Importação segura:</strong> o arquivo é lido no navegador. Nenhum registro é salvo antes da confirmação na prévia.</div>' +
      '<div><label class="block text-sm font-semibold text-gray-700 mb-2">Origem do arquivo</label><select onchange="setMemberImportSource(this.value)" class="w-full px-3 py-3 border rounded-lg min-h-[44px]"><option value="generic">Genérico (CSV/XLSX)</option><option value="adpel_template">Modelo ADPEL</option><option value="membros_web" disabled>Membros Web — aguardando amostra real</option></select></div>' +
      '<label class="block rounded-xl border-2 border-dashed border-gray-300 hover:border-adpel-500 p-8 text-center cursor-pointer bg-gray-50"><i class="fas fa-file-import text-3xl text-adpel-600 mb-3"></i><span class="block font-semibold text-gray-800">Selecionar CSV ou XLSX</span><span class="block text-sm text-gray-500 mt-1">Até milhares de linhas; processamento posterior em lotes</span><input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" class="hidden" onchange="handleMemberImportFile(this)"></label>' +
      '<button type="button" onclick="downloadMemberImportTemplate()" class="w-full sm:w-auto px-4 py-3 border border-adpel-600 text-adpel-700 rounded-lg font-semibold min-h-[44px]"><i class="fas fa-download mr-2"></i>Baixar modelo ADPEL</button>' +
      '</div>';
  }

  function mappingOptions(selected) {
    return '<option value="">Ignorar coluna</option>' + core().fields.map(function(field) {
      return '<option value="' + field.key + '"' + (selected === field.key ? ' selected' : '') + '>' + safe(field.label) + '</option>';
    }).join('');
  }

  function renderMapping() {
    var errors = core().mappingErrors(state.mapping);
    var rows = state.headers.map(function(header, index) {
      var sample = state.rows.slice(0, 3).map(function(row) { return safe(row[index]); }).filter(Boolean).join(' · ');
      return '<tr class="border-b"><td class="p-3 font-medium text-gray-800">' + safe(header) + '</td><td class="p-3 text-xs text-gray-500 max-w-[240px] truncate">' + (sample || '—') + '</td><td class="p-3"><select onchange="setMemberImportMapping(' + index + ',this.value)" class="w-full px-2 py-2 border rounded-lg">' + mappingOptions(state.mapping[index]) + '</select></td></tr>';
    }).join('');
    body().innerHTML = stepHeader('mapping') +
      '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4"><div><h4 class="font-bold text-gray-800">Mapeie as colunas</h4><p class="text-sm text-gray-500">' + safe(state.fileName) + ' · ' + state.rows.length + ' registros</p></div><span class="text-xs bg-gray-100 px-3 py-2 rounded-lg">Nome completo é obrigatório</span></div>' +
      (errors.length ? '<div class="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">' + errors.map(safe).join('<br>') + '</div>' : '') +
      '<div class="overflow-x-auto border rounded-xl"><table class="w-full text-sm min-w-[680px]"><thead class="bg-gray-50"><tr><th class="text-left p-3">Coluna</th><th class="text-left p-3">Amostra</th><th class="text-left p-3">Campo ADPEL</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="mt-5 flex flex-col-reverse sm:flex-row justify-between gap-2"><button onclick="backMemberImportStep()" class="px-4 py-3 border rounded-lg min-h-[44px]">Voltar</button><button onclick="prepareMemberImportPreview()" class="px-5 py-3 bg-adpel-600 text-white rounded-lg font-semibold min-h-[44px]">Validar e visualizar prévia</button></div>';
  }

  function unknownMappingHtml() {
    var groups = [];
    ['status', 'role'].forEach(function(type) {
      var values = state.analysis.unknowns[type] || {};
      Object.keys(values).forEach(function(raw) {
        var options = type === 'status' ? core().validStatuses : core().validRoles;
        var encodedRaw = encodeURIComponent(raw).replace(/'/g, '%27');
        groups.push('<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center"><span class="text-sm"><strong>' + safe(type === 'status' ? 'Status' : 'Função') + ':</strong> ' + safe(values[raw]) + '</span><select onchange="setMemberValueMapping(\'' + type + '\',\'' + encodedRaw + '\',this.value)" class="px-3 py-2 border rounded-lg"><option value="">Selecione a equivalência</option>' + options.map(function(option) { return '<option value="' + option + '">' + safe(option) + '</option>'; }).join('') + '</select></div>');
      });
    });
    return groups.length ? '<div class="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4"><h5 class="font-bold text-amber-900 mb-3">Valores que precisam de equivalência</h5><div class="space-y-3">' + groups.join('') + '</div></div>' : '';
  }

  function badge(item) {
    if (!item.valid) return '<span class="text-xs font-semibold bg-red-100 text-red-700 px-2 py-1 rounded">Erro</span>';
    if (item.duplicate) return '<span class="text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-1 rounded">' + (item.duplicate.kind === 'probable' ? 'Duplicado provável' : 'Possível duplicado') + '</span>';
    return '<span class="text-xs font-semibold bg-green-100 text-green-700 px-2 py-1 rounded">Pronto</span>';
  }

  function reviewControl(item) {
    if (!item.duplicate || state.duplicateStrategy !== 'review') return '';
    var canUpdate = item.duplicate.existing && item.duplicate.existing.id;
    return '<select onchange="setMemberReviewAction(' + item.rowNumber + ',this.value)" class="mt-2 px-2 py-1 border rounded text-xs"><option value="ignore">Ignorar</option>' + (canUpdate ? '<option value="update">Atualizar cadastro existente</option>' : '') + '</select>';
  }

  function renderPreview() {
    var analysis = state.analysis;
    var start = (state.page - 1) * PAGE_SIZE;
    var pageItems = analysis.items.slice(start, start + PAGE_SIZE);
    var totalPages = Math.max(1, Math.ceil(analysis.items.length / PAGE_SIZE));
    var rows = pageItems.map(function(item) {
      var details = item.errors.map(function(error) { return error.message; });
      if (item.duplicate) details.push(item.duplicate.reason + ': ' + (item.duplicate.existing.full_name || 'registro do arquivo'));
      return '<tr class="border-b align-top"><td class="p-3 text-gray-500">' + item.rowNumber + '</td><td class="p-3"><strong class="text-gray-800">' + safe(item.member.full_name || 'Sem nome') + '</strong><div class="text-xs text-gray-500">' + safe(item.member.email || item.member.phone || 'Sem contato') + '</div></td><td class="p-3">' + badge(item) + reviewControl(item) + '</td><td class="p-3 text-xs text-gray-600">' + safe(details.join(' · ') || 'Dados válidos') + '</td></tr>';
    }).join('');
    var summary = analysis.summary;
    body().innerHTML = stepHeader('preview') + unknownMappingHtml() +
      '<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">' +
      summaryCard('Total', summary.total, 'gray') + summaryCard('Prontos', summary.ready, 'green') + summaryCard('Duplicados', summary.duplicates, 'amber') + summaryCard('Com erro', summary.errors, 'red') + '</div>' +
      '<fieldset class="mb-4 border rounded-xl p-4"><legend class="px-2 font-bold text-sm text-gray-800">Tratamento de duplicidades</legend><div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">' +
      duplicateRadio('ignore', 'Ignorar', 'Mantém o cadastro existente') + duplicateRadio('update', 'Atualizar', 'Preenche campos informados sem apagar vazios') + duplicateRadio('review', 'Revisar manualmente', 'Escolha a ação em cada linha') + '</div></fieldset>' +
      '<div class="overflow-x-auto border rounded-xl"><table class="w-full text-sm min-w-[760px]"><thead class="bg-gray-50"><tr><th class="p-3 text-left">Linha</th><th class="p-3 text-left">Membro</th><th class="p-3 text-left">Situação</th><th class="p-3 text-left">Detalhes</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="mt-3 flex items-center justify-between text-sm"><button onclick="changeMemberImportPage(' + (state.page - 1) + ')" class="px-3 py-2 border rounded disabled:opacity-40" ' + (state.page <= 1 ? 'disabled' : '') + '>Anterior</button><span>Página ' + state.page + ' de ' + totalPages + '</span><button onclick="changeMemberImportPage(' + (state.page + 1) + ')" class="px-3 py-2 border rounded disabled:opacity-40" ' + (state.page >= totalPages ? 'disabled' : '') + '>Próxima</button></div>' +
      '<div class="mt-5 flex flex-col-reverse sm:flex-row justify-between gap-2"><button onclick="backMemberImportStep()" ' + (state.running ? 'disabled' : '') + ' class="px-4 py-3 border rounded-lg min-h-[44px] disabled:opacity-50">Voltar ao mapeamento</button><button onclick="confirmMemberImport()" ' + (state.running ? 'disabled' : '') + ' class="px-5 py-3 bg-green-600 text-white rounded-lg font-semibold min-h-[44px] disabled:opacity-60"><i class="fas ' + (state.running ? 'fa-spinner fa-spin' : 'fa-check') + ' mr-2"></i>' + (state.running && state.progress ? 'Importando ' + state.progress.done + ' de ' + state.progress.total : 'Confirmar importação') + '</button></div>';
  }

  function summaryCard(label, value, color) {
    return '<div class="rounded-xl bg-' + color + '-50 border border-' + color + '-200 p-3"><div class="text-2xl font-bold text-' + color + '-800">' + value + '</div><div class="text-xs text-' + color + '-700">' + label + '</div></div>';
  }

  function duplicateRadio(value, title, description) {
    return '<label class="flex gap-3 border rounded-lg p-3 cursor-pointer"><input type="radio" name="member-duplicate-strategy" value="' + value + '" onchange="setMemberDuplicateStrategy(this.value)" ' + (state.duplicateStrategy === value ? 'checked' : '') + '><span><strong class="block">' + title + '</strong><span class="text-xs text-gray-500">' + description + '</span></span></label>';
  }

  function cleanMember(member, includeId) {
    var clean = {};
    if (includeId && member.id) clean.id = member.id;
    ALLOWED_FIELDS.forEach(function(field) { clean[field] = member[field] === undefined ? null : member[field]; });
    clean.status = clean.status || 'ativo';
    clean.role = clean.role || 'membro';
    clean.baptized = clean.baptized === true;
    return clean;
  }

  function importAction(item) {
    if (!item.valid) return 'error';
    if (!item.duplicate) return 'insert';
    if (state.duplicateStrategy === 'ignore') return 'skip';
    if (state.duplicateStrategy === 'update') return item.duplicate.existing.id ? 'update' : 'skip';
    return state.reviewActions[String(item.rowNumber)] === 'update' && item.duplicate.existing.id ? 'update' : 'skip';
  }

  async function getCurrentUserId() {
    var result = await window.supabaseClient.auth.getSession();
    return result && result.data && result.data.session ? result.data.session.user.id : null;
  }

  async function processBatches(records, operation, failures, offset, total) {
    var batches = core().chunk(records, BATCH_SIZE);
    for (var i = 0; i < batches.length; i++) {
      var payload = batches[i].map(function(record) { return record.data; });
      var result = operation === 'insert'
        ? await window.supabaseClient.from('members').insert(payload)
        : await window.supabaseClient.from('members').upsert(payload, { onConflict: 'id' });
      if (result.error) {
        batches[i].forEach(function(record) {
          failures.push({ rowNumber: record.rowNumber, code: 'database_error', message: result.error.message });
        });
      }
      state.progress = { done: Math.min(total, offset + Math.min(records.length, (i + 1) * BATCH_SIZE)), total: total };
      renderPreview();
    }
  }

  window.confirmMemberImport = async function() {
    if (state.running || !state.analysis || !window.supabaseClient) return;
    var unresolved = Object.keys(state.analysis.unknowns.status || {}).length + Object.keys(state.analysis.unknowns.role || {}).length;
    if (unresolved) return toast('Defina as equivalências pendentes antes de importar.', 'error');
    state.running = true;
    renderPreview();
    var importId = null;
    var failures = [];
    try {
      var userId = await getCurrentUserId();
      if (!userId) throw new Error('Sessão administrativa expirada. Entre novamente.');
      var historyResult = await window.supabaseClient.from('member_imports').insert({
        source: state.source, file_name: state.fileName, total_rows: state.analysis.summary.total,
        valid_rows: state.analysis.summary.ready + state.analysis.summary.duplicates,
        duplicate_rows: state.analysis.summary.duplicates,
        status: 'processing', created_by: userId,
        metadata: { duplicate_strategy: state.duplicateStrategy, batch_size: BATCH_SIZE }
      }).select('id').single();
      if (historyResult.error) throw historyResult.error;
      importId = historyResult.data.id;

      var inserts = [];
      var updates = [];
      var skipped = 0;
      state.analysis.items.forEach(function(item) {
        var action = importAction(item);
        if (action === 'error') {
          item.errors.forEach(function(error) { failures.push({ rowNumber: item.rowNumber, code: error.code, message: error.message }); });
        } else if (action === 'skip') {
          skipped += 1;
        } else if (action === 'insert') {
          inserts.push({ rowNumber: item.rowNumber, data: cleanMember(item.member, false) });
        } else {
          var merged = core().mergeMemberForUpdate(item.duplicate.existing, item.member, item.provided);
          updates.push({ rowNumber: item.rowNumber, data: cleanMember(merged, true) });
        }
      });

      state.progress = { done: 0, total: inserts.length + updates.length };
      renderPreview();
      await processBatches(inserts, 'insert', failures, 0, state.progress.total);
      await processBatches(updates, 'update', failures, inserts.length, state.progress.total);
      var failedRows = {};
      failures.forEach(function(error) { failedRows[error.rowNumber] = true; });
      var successCount = inserts.concat(updates).filter(function(record) { return !failedRows[record.rowNumber]; }).length;

      if (failures.length) {
        var errorRows = failures.map(function(error) {
          return { import_id: importId, row_number: error.rowNumber, error_code: error.code, message: String(error.message).slice(0, 500) };
        });
        var errorBatches = core().chunk(errorRows, BATCH_SIZE);
        for (var e = 0; e < errorBatches.length; e++) await window.supabaseClient.from('member_import_errors').insert(errorBatches[e]);
      }

      var finalStatus = failures.length ? 'completed_with_errors' : 'completed';
      await window.supabaseClient.from('member_imports').update({
        imported_rows: Math.max(0, successCount), skipped_rows: skipped,
        error_rows: Object.keys(failedRows).length, status: finalStatus
      }).eq('id', importId);
      if (typeof logChurchAudit === 'function') {
        await logChurchAudit('members_bulk_imported', 'member_imports', importId, {
          source: state.source, total_rows: state.analysis.summary.total, imported_rows: successCount,
          skipped_rows: skipped, error_rows: Object.keys(failedRows).length
        });
      }
      state.result = {
        importId: importId, analyzed: state.analysis.summary.total, imported: successCount,
        skipped: skipped, errorRows: Object.keys(failedRows).length, failures: failures
      };
      state.step = 'result';
      if (typeof loadChurchManagementData === 'function') await loadChurchManagementData();
      render();
    } catch (error) {
      console.error('Falha na importação de membros:', error);
      if (importId) await window.supabaseClient.from('member_imports').update({ status: 'failed' }).eq('id', importId);
      toast(error.message || 'A importação não pôde ser concluída.', 'error');
    } finally {
      state.running = false;
      state.progress = null;
      if (state.step === 'preview') renderPreview();
    }
  };

  window.downloadMemberImportErrors = function() {
    if (!state.result || !state.result.failures.length) return;
    var matrix = [['Linha', 'Código', 'Erro']].concat(state.result.failures.map(function(error) {
      return [error.rowNumber, error.code, error.message];
    }));
    downloadText('erros-importacao-membros.csv', core().rowsToCsv(matrix[0], matrix.slice(1), ';'), 'text/csv;charset=utf-8');
  };

  function downloadText(name, content, type) {
    var blob = new Blob([String(content).charAt(0) === '\uFEFF' ? content : '\uFEFF' + content], { type: type });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function renderResult() {
    var result = state.result;
    body().innerHTML = stepHeader('result') +
      '<div class="text-center py-6"><div class="w-16 h-16 mx-auto rounded-full bg-green-100 text-green-700 flex items-center justify-center text-2xl"><i class="fas fa-check"></i></div><h4 class="text-xl font-bold text-gray-800 mt-4">Importação concluída</h4><p class="text-sm text-gray-500 mt-1">Histórico: ' + safe(result.importId) + '</p></div>' +
      '<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">' + summaryCard('Analisados', result.analyzed, 'gray') + summaryCard('Importados/atualizados', result.imported, 'green') + summaryCard('Duplicados ignorados', result.skipped, 'amber') + summaryCard('Não importados', result.errorRows, 'red') + '</div>' +
      '<div class="mt-6 flex flex-col sm:flex-row justify-end gap-2">' + (result.failures.length ? '<button onclick="downloadMemberImportErrors()" class="px-4 py-3 border border-red-300 text-red-700 rounded-lg min-h-[44px]"><i class="fas fa-file-csv mr-2"></i>Baixar erros</button>' : '') + '<button onclick="hideMemberImport()" class="px-5 py-3 bg-adpel-600 text-white rounded-lg min-h-[44px]">Concluir</button></div>';
  }
})();
