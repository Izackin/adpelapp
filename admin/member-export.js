// ============================================================
// MEMBER EXPORT - filtered CSV/XLSX with formula injection guard
// ============================================================

(function() {
  'use strict';

  function element(id) { return document.getElementById(id); }
  function core() { return window.ADPELMemberData; }
  function members() { return window.membersData || []; }

  window.showMemberExport = function() {
    var modal = element('member-export-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    updateMemberExportCount();
  };

  window.hideMemberExport = function() {
    var modal = element('member-export-modal');
    if (modal) modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  };

  function filters() {
    return {
      status: element('member-export-status').value,
      role: element('member-export-role').value,
      baptized: element('member-export-baptized').value,
      entryStart: element('member-export-entry-start').value,
      entryEnd: element('member-export-entry-end').value
    };
  }

  function selectedMembers() {
    return core().filterMembers(members(), filters());
  }

  window.updateMemberExportCount = function() {
    var output = element('member-export-count');
    if (output) output.textContent = selectedMembers().length + ' membro(s) serão exportados';
  };

  function downloadBlob(name, blob) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function fileDate() {
    var now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  }

  async function audit(format, count) {
    if (typeof logChurchAudit !== 'function') return;
    await logChurchAudit('members_exported', 'members', null, {
      format: format,
      count: count,
      filters: filters()
    });
  }

  window.exportMembersCsv = async function() {
    var list = selectedMembers();
    if (!list.length) return churchShowToast('Nenhum membro corresponde aos filtros.', 'warning');
    var rows = list.map(core().memberToExportRow);
    var csv = core().rowsToCsv(core().templateHeaders, rows, ';');
    downloadBlob('membros-adpel-' + fileDate() + '.csv', new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    await audit('csv', list.length);
    churchShowToast('Arquivo CSV gerado com sucesso.', 'success');
  };

  function spreadsheetDate(value) {
    if (!value) return '';
    var parts = String(value).split('-');
    if (parts.length !== 3) return core().neutralizeSpreadsheetCell(value);
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function xlsxRow(member) {
    return [
      core().neutralizeSpreadsheetCell(member.full_name || ''), spreadsheetDate(member.birth_date),
      core().neutralizeSpreadsheetCell(member.phone || ''), core().neutralizeSpreadsheetCell(member.email || ''),
      core().neutralizeSpreadsheetCell(member.address || ''), spreadsheetDate(member.entry_date),
      core().neutralizeSpreadsheetCell(member.status || ''), core().neutralizeSpreadsheetCell(member.role || ''),
      member.baptized ? 'Sim' : 'Não', spreadsheetDate(member.baptism_date),
      core().neutralizeSpreadsheetCell(member.notes || '')
    ];
  }

  window.exportMembersXlsx = async function() {
    if (!window.XLSX) return churchShowToast('Biblioteca de planilhas indisponível.', 'error');
    var list = selectedMembers();
    if (!list.length) return churchShowToast('Nenhum membro corresponde aos filtros.', 'warning');
    var matrix = [core().templateHeaders].concat(list.map(xlsxRow));
    var worksheet = window.XLSX.utils.aoa_to_sheet(matrix, { cellDates: true });
    worksheet['!cols'] = core().templateHeaders.map(function(header, index) {
      return { wch: [30, 16, 18, 28, 34, 16, 16, 18, 12, 16, 36][index] || Math.max(15, header.length) };
    });
    ['B', 'F', 'J'].forEach(function(column) {
      for (var row = 2; row <= list.length + 1; row++) {
        var cell = worksheet[column + row];
        if (cell && cell.t === 'd') cell.z = 'dd/mm/yyyy';
      }
    });
    worksheet['!autofilter'] = { ref: 'A1:K' + (list.length + 1) };
    var workbook = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(workbook, worksheet, 'Membros');
    window.XLSX.writeFile(workbook, 'membros-adpel-' + fileDate() + '.xlsx', { compression: true });
    await audit('xlsx', list.length);
    churchShowToast('Planilha XLSX gerada com sucesso.', 'success');
  };
})();
