// ============================================================
// MEMBER REPORTS - indicators and client-side PDF generation
// ============================================================

(function() {
  'use strict';

  var MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  function members() { return window.membersData || []; }
  function element(id) { return document.getElementById(id); }
  function safe(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(String(value == null ? '' : value));
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(character) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character];
    });
  }
  function label(value) {
    if (typeof churchLabel === 'function') return churchLabel(value);
    return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, function(letter) { return letter.toUpperCase(); });
  }
  function todayIso() {
    var now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  }
  function currentMonth() { return todayIso().slice(0, 7); }
  function dateParts(value) {
    var match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) } : null;
  }
  function formatDateBr(value) {
    var parts = dateParts(value);
    return parts ? String(parts.day).padStart(2, '0') + '/' + String(parts.month).padStart(2, '0') + '/' + parts.year : '—';
  }

  function birthdayDistance(value, reference) {
    var parts = dateParts(value);
    if (!parts) return null;
    var start = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
    var next = new Date(reference.getFullYear(), parts.month - 1, parts.day);
    if (next < start) next = new Date(reference.getFullYear() + 1, parts.month - 1, parts.day);
    return Math.round((next - start) / 86400000);
  }

  function compute(list) {
    var now = new Date();
    var monthPrefix = currentMonth();
    var stats = {
      total: list.length, active: 0, inactive: 0, newThisMonth: 0, baptized: 0,
      birthdaysToday: 0, birthdays7Days: 0, birthdaysMonth: 0,
      statuses: {}, roles: {}, months: {}
    };
    list.forEach(function(member) {
      var status = member.status || 'não informado';
      var role = member.role || 'não informado';
      stats.statuses[status] = (stats.statuses[status] || 0) + 1;
      stats.roles[role] = (stats.roles[role] || 0) + 1;
      if (status === 'ativo') stats.active += 1;
      else stats.inactive += 1;
      if (member.baptized) stats.baptized += 1;
      if (String(member.entry_date || '').slice(0, 7) === monthPrefix) stats.newThisMonth += 1;
      if (member.entry_date) {
        var entryMonth = String(member.entry_date).slice(0, 7);
        stats.months[entryMonth] = (stats.months[entryMonth] || 0) + 1;
      }
      var birth = dateParts(member.birth_date);
      if (birth) {
        var distance = birthdayDistance(member.birth_date, now);
        if (distance === 0) stats.birthdaysToday += 1;
        if (distance !== null && distance >= 1 && distance <= 7) stats.birthdays7Days += 1;
        if (birth.month === now.getMonth() + 1) stats.birthdaysMonth += 1;
      }
    });
    return stats;
  }

  function metric(icon, title, value, color) {
    if (typeof renderMetricCard === 'function') return renderMetricCard(icon, title, String(value), color);
    return '<div class="rounded-xl p-4 bg-white border"><strong>' + safe(value) + '</strong><span>' + safe(title) + '</span></div>';
  }

  function distribution(title, values) {
    var keys = Object.keys(values).sort(function(a, b) { return values[b] - values[a]; });
    var rows = keys.length ? keys.map(function(key) {
      return '<div class="flex items-center justify-between py-2 border-b last:border-0"><span class="text-sm text-gray-600">' + safe(label(key)) + '</span><strong class="text-gray-800">' + values[key] + '</strong></div>';
    }).join('') : '<p class="text-sm text-gray-500">Sem dados.</p>';
    return '<div class="bg-white rounded-xl border border-gray-200 p-4 md:p-5"><h4 class="font-bold text-gray-800 mb-2">' + safe(title) + '</h4>' + rows + '</div>';
  }

  function monthlyTable(months) {
    var keys = Object.keys(months).sort().slice(-12).reverse();
    var rows = keys.length ? keys.map(function(key) {
      var parts = key.split('-');
      return '<tr class="border-b"><td class="py-2 pr-4">' + MONTH_NAMES[Number(parts[1]) - 1] + '/' + parts[0] + '</td><td class="py-2 text-right font-semibold">' + months[key] + '</td></tr>';
    }).join('') : '<tr><td class="py-3 text-gray-500" colspan="2">Sem datas de entrada.</td></tr>';
    return '<div class="bg-white rounded-xl border border-gray-200 p-4 md:p-5"><h4 class="font-bold text-gray-800 mb-2">Entradas por período</h4><table class="w-full text-sm"><tbody>' + rows + '</tbody></table></div>';
  }

  function renderReports() {
    var stats = compute(members());
    var monthPrefix = currentMonth();
    var monthIncome = 0;
    var monthExpense = 0;
    (window.cashMovementsData || []).forEach(function(item) {
      if (String(item.movement_date || '').slice(0, 7) !== monthPrefix) return;
      if (item.type === 'entrada') monthIncome += Number(item.amount || 0);
      if (item.type === 'saida') monthExpense += Number(item.amount || 0);
    });
    var money = typeof churchMoney === 'function' ? churchMoney : function(value) { return 'R$ ' + Number(value || 0).toFixed(2).replace('.', ','); };
    var cards = element('church-reports-cards');
    if (cards) cards.innerHTML =
      metric('user-check', 'Ativos', stats.active, 'bg-green-600') +
      metric('user-slash', 'Removidos', stats.statuses.removido || 0, 'bg-red-600') +
      metric('arrow-down', 'Entradas financeiras no mês', money(monthIncome), 'bg-green-600') +
      metric('arrow-up', 'Saídas financeiras no mês', money(monthExpense), 'bg-orange-600') +
      metric('award', 'Certificados emitidos', (window.churchCertificatesData || []).length, 'bg-yellow-600') +
      metric('birthday-cake', 'Aniversários no mês', stats.birthdaysMonth, 'bg-purple-600') +
      metric('users', 'Total de membros', stats.total, 'bg-slate-600') +
      metric('user-clock', 'Afastados', stats.statuses.afastado || 0, 'bg-orange-600') +
      metric('people-arrows', 'Transferidos', stats.statuses.transferido || 0, 'bg-cyan-600') +
      metric('user-plus', 'Novos no mês', stats.newThisMonth, 'bg-blue-600') +
      metric('water', 'Batizados', stats.baptized, 'bg-cyan-600') +
      metric('tint-slash', 'Não batizados', stats.total - stats.baptized, 'bg-gray-600') +
      metric('birthday-cake', 'Aniversários hoje', stats.birthdaysToday, 'bg-purple-600') +
      metric('calendar-week', 'Aniversários em 7 dias', stats.birthdays7Days, 'bg-pink-600');
    var details = element('member-report-details');
    if (details) details.innerHTML = distribution('Distribuição por status', stats.statuses) + distribution('Distribuição por função/cargo', stats.roles) + monthlyTable(stats.months);
  }

  function pdfFilters() {
    return {
      status: element('member-report-status') ? element('member-report-status').value : '',
      role: element('member-report-role') ? element('member-report-role').value : '',
      baptized: element('member-report-baptized') ? element('member-report-baptized').value : ''
    };
  }

  function pdfMembers() {
    return window.ADPELMemberData.filterMembers(members(), pdfFilters()).slice().sort(function(a, b) {
      return String(a.full_name || '').localeCompare(String(b.full_name || ''), 'pt-BR');
    });
  }

  function pdfText(value) {
    return String(value == null ? '' : value).replace(/[\u2013\u2014]/g, '-').replace(/\u2022/g, '-');
  }

  function createPdf(title, subtitle) {
    if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('Gerador de PDF indisponível.');
    var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    doc.setProperties({ title: title, subject: 'Relatório administrativo ADPEL', author: 'ADPEL Digital' });
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(17);
    doc.text(pdfText(title), 14, 13);
    doc.setFontSize(9);
    doc.text(pdfText(subtitle), 14, 20);
    doc.setTextColor(31, 41, 55);
    return { doc: doc, y: 36 };
  }

  function ensurePage(context, needed) {
    if (context.y + needed <= 282) return;
    context.doc.addPage();
    context.y = 18;
  }

  function addSection(context, title, lines) {
    ensurePage(context, 12 + lines.length * 6);
    context.doc.setFont('helvetica', 'bold');
    context.doc.setFontSize(12);
    context.doc.text(pdfText(title), 14, context.y);
    context.y += 7;
    context.doc.setFont('helvetica', 'normal');
    context.doc.setFontSize(9);
    lines.forEach(function(line) {
      ensurePage(context, 6);
      context.doc.text(pdfText(line), 17, context.y);
      context.y += 6;
    });
    context.y += 3;
  }

  function filterDescription() {
    var filters = pdfFilters();
    var applied = [];
    if (filters.status) applied.push('status: ' + label(filters.status));
    if (filters.role) applied.push('função: ' + label(filters.role));
    if (filters.baptized) applied.push('batizado: ' + (filters.baptized === 'true' ? 'Sim' : 'Não'));
    return applied.length ? applied.join(' | ') : 'sem filtros';
  }

  function generalPdf(list) {
    var stats = compute(list);
    var context = createPdf('Relatório geral de membros', 'Gerado em ' + new Date().toLocaleString('pt-BR') + ' | ' + filterDescription());
    addSection(context, 'Indicadores', [
      'Total: ' + stats.total, 'Ativos: ' + stats.active, 'Inativos/outros: ' + stats.inactive,
      'Novos no mês: ' + stats.newThisMonth, 'Batizados: ' + stats.baptized, 'Não batizados: ' + (stats.total - stats.baptized),
      'Aniversários hoje: ' + stats.birthdaysToday, 'Próximos 7 dias: ' + stats.birthdays7Days, 'No mês: ' + stats.birthdaysMonth
    ]);
    addSection(context, 'Por status', Object.keys(stats.statuses).sort().map(function(key) { return label(key) + ': ' + stats.statuses[key]; }));
    addSection(context, 'Por função/cargo', Object.keys(stats.roles).sort().map(function(key) { return label(key) + ': ' + stats.roles[key]; }));
    addSection(context, 'Entradas por período', Object.keys(stats.months).sort().slice(-12).reverse().map(function(key) { return key + ': ' + stats.months[key]; }));
    return context.doc;
  }

  function listPdf(list) {
    var context = createPdf('Lista de membros', 'Gerado em ' + new Date().toLocaleString('pt-BR') + ' | ' + filterDescription());
    context.doc.setFontSize(9);
    list.forEach(function(member, index) {
      var lines = context.doc.splitTextToSize(
        (index + 1) + '. ' + pdfText(member.full_name || 'Sem nome') + '\n' +
        'Status: ' + label(member.status) + ' | Função: ' + label(member.role) + ' | Batizado: ' + (member.baptized ? 'Sim' : 'Não') + '\n' +
        'Nascimento: ' + formatDateBr(member.birth_date) + ' | Entrada: ' + formatDateBr(member.entry_date) + '\n' +
        'Telefone: ' + (member.phone || '—') + ' | E-mail: ' + (member.email || '—') + '\n' +
        'Endereço: ' + (member.address || '—'), 180
      );
      ensurePage(context, lines.length * 4.5 + 5);
      context.doc.setFont('helvetica', 'normal');
      context.doc.text(lines, 14, context.y);
      context.y += lines.length * 4.5 + 5;
    });
    return context.doc;
  }

  function birthdaysPdf(list) {
    var month = element('member-report-birthday-month') ? Number(element('member-report-birthday-month').value) : new Date().getMonth() + 1;
    var birthdays = list.filter(function(member) {
      var parts = dateParts(member.birth_date);
      return parts && parts.month === month;
    }).sort(function(a, b) { return dateParts(a.birth_date).day - dateParts(b.birth_date).day; });
    var context = createPdf('Aniversariantes - ' + MONTH_NAMES[month - 1], 'Gerado em ' + new Date().toLocaleString('pt-BR') + ' | ' + filterDescription());
    addSection(context, 'Aniversariantes (' + birthdays.length + ')', birthdays.map(function(member) {
      var parts = dateParts(member.birth_date);
      return String(parts.day).padStart(2, '0') + '/' + String(parts.month).padStart(2, '0') + ' - ' + member.full_name + ' - ' + (member.phone || 'sem telefone');
    }));
    return context.doc;
  }

  window.generateMemberPdf = async function() {
    try {
      var type = element('member-report-type').value;
      var list = pdfMembers();
      if (!list.length) return churchShowToast('Nenhum membro corresponde aos filtros do relatório.', 'warning');
      var doc = type === 'list' ? listPdf(list) : type === 'birthdays' ? birthdaysPdf(list) : generalPdf(list);
      doc.save('relatorio-membros-' + type + '-' + todayIso() + '.pdf');
      if (typeof logChurchAudit === 'function') await logChurchAudit('members_report_generated', 'members', null, { type: type, count: list.length, filters: pdfFilters() });
      churchShowToast('PDF gerado com sucesso.', 'success');
    } catch (error) {
      console.error('Falha ao gerar relatório de membros:', error);
      churchShowToast(error.message || 'Não foi possível gerar o PDF.', 'error');
    }
  };

  window.ADPELMemberReports = { compute: compute, render: renderReports };

  document.addEventListener('DOMContentLoaded', function() {
    var monthSelect = element('member-report-birthday-month');
    if (monthSelect) monthSelect.value = String(new Date().getMonth() + 1);
  });
})();
