// ============================================================
// CHURCH MANAGEMENT - admin/church-management.js
// Members, movements, cash, certificates and reports.
// ============================================================

var churchModuleWarnings = [];

function churchToday() {
  return new Date().toISOString().slice(0, 10);
}

function churchCurrentMonthPrefix() {
  return churchToday().slice(0, 7);
}

function churchMoney(value) {
  return 'R$ ' + Number(value || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function churchText(value) {
  return String(value || '').trim();
}

function churchLabel(value) {
  return churchText(value).replace(/_/g, ' ').replace(/\b\w/g, function(letter) { return letter.toUpperCase(); });
}

function churchShowToast(message, type) {
  if (typeof showToast === 'function') {
    showToast(message, type || 'info');
  } else {
    console.log(message);
  }
}

async function churchFetchTable(tableName, orderColumn, ascending) {
  if (!window.supabaseClient) { return []; }

  try {
    var query = window.supabaseClient.from(tableName).select('*');
    if (orderColumn) {
      query = query.order(orderColumn, { ascending: ascending !== false });
    }
    var result = await query;
    if (result.error) {
      churchModuleWarnings.push(tableName);
      console.warn('Tabela indisponivel no modulo Gestao da Igreja:', tableName, result.error.message);
      return [];
    }
    return result.data || [];
  } catch (error) {
    churchModuleWarnings.push(tableName);
    console.warn('Erro ao carregar tabela do modulo Gestao da Igreja:', tableName, error);
    return [];
  }
}

async function loadChurchManagementData() {
  churchModuleWarnings = [];
  membersData = await churchFetchTable('members', 'full_name', true);
  memberMovementsData = await churchFetchTable('member_movements', 'movement_date', false);
  cashMovementsData = await churchFetchTable('cash_movements', 'movement_date', false);

  var allCertificates = await churchFetchTable('certificates', 'created_at', false);
  churchCertificatesData = allCertificates.filter(function(cert) {
    return !!(cert && cert.certificate_type);
  });

  renderChurchManagement();
  populateMemberSelects();

  if (churchModuleWarnings.length > 0) {
    renderChurchSetupWarning();
  }
}

function renderChurchSetupWarning() {
  var containers = [
    'church-dashboard-cards',
    'admin-members-list',
    'admin-member-movements-list',
    'admin-cash-movements-list',
    'admin-church-certificates-list',
    'church-reports-cards'
  ];
  var unique = [];
  for (var i = 0; i < churchModuleWarnings.length; i++) {
    if (unique.indexOf(churchModuleWarnings[i]) === -1) unique.push(churchModuleWarnings[i]);
  }
  var message = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-database text-2xl"></i></div><h3>Banco ainda nao preparado</h3><p>Execute o SQL entregue para criar ou atualizar: ' + escapeHtml(unique.join(', ')) + '.</p></div>';
  for (var c = 0; c < containers.length; c++) {
    var el = document.getElementById(containers[c]);
    if (el) el.innerHTML = message;
  }
}

function setChurchTab(tab) {
  var panels = document.querySelectorAll('.church-tab-panel');
  for (var i = 0; i < panels.length; i++) {
    panels[i].classList.add('hidden');
  }
  var active = document.getElementById('church-tab-' + tab);
  if (active) active.classList.remove('hidden');

  var buttons = document.querySelectorAll('.church-tab-btn');
  for (var b = 0; b < buttons.length; b++) {
    buttons[b].classList.remove('bg-adpel-600', 'text-white');
    buttons[b].classList.add('bg-gray-100', 'text-gray-700');
  }
  var activeButton = document.querySelector('[data-church-tab="' + tab + '"]');
  if (activeButton) {
    activeButton.classList.add('bg-adpel-600', 'text-white');
    activeButton.classList.remove('bg-gray-100', 'text-gray-700');
  }
}

function renderChurchManagement() {
  renderChurchDashboard();
  renderChurchMembers();
  renderMemberMovements();
  renderCashMovements();
  renderChurchCertificates();
  renderChurchReports();
}

function getChurchStats() {
  var month = churchCurrentMonthPrefix();
  var activeMembers = membersData.filter(function(member) { return member.status === 'ativo'; }).length;
  var newMembers = membersData.filter(function(member) { return String(member.entry_date || '').slice(0, 7) === month; }).length;
  var exits = memberMovementsData.filter(function(item) {
    var type = item.movement_type || item.type;
    return String(item.movement_date || '').slice(0, 7) === month && ['saida', 'transferencia', 'afastamento', 'falecimento'].indexOf(type) >= 0;
  }).length;
  var income = 0;
  var expense = 0;
  for (var i = 0; i < cashMovementsData.length; i++) {
    var amount = Number(cashMovementsData[i].amount || 0);
    if (cashMovementsData[i].type === 'entrada') income += amount;
    if (cashMovementsData[i].type === 'saida') expense += amount;
  }
  return {
    activeMembers: activeMembers,
    newMembers: newMembers,
    exits: exits,
    income: income,
    expense: expense,
    balance: income - expense,
    certificates: churchCertificatesData.length,
    birthdays: getBirthdayMembers().length
  };
}

function renderMetricCard(icon, label, value, colorClass) {
  return '<div class="bg-white p-4 md:p-5 rounded-xl border border-gray-200">' +
    '<div class="flex items-center justify-between gap-3">' +
    '<div><p class="text-xs text-gray-500 font-semibold uppercase tracking-wide">' + escapeHtml(label) + '</p>' +
    '<div class="text-2xl md:text-3xl font-bold text-gray-800 mt-2">' + escapeHtml(value) + '</div></div>' +
    '<div class="w-11 h-11 rounded-xl ' + colorClass + ' flex items-center justify-center text-white"><i class="fas fa-' + icon + '"></i></div>' +
    '</div></div>';
}

function renderChurchDashboard() {
  var stats = getChurchStats();
  var cards = document.getElementById('church-dashboard-cards');
  if (cards) {
    cards.innerHTML =
      renderMetricCard('users', 'Membros ativos', String(stats.activeMembers), 'bg-adpel-600') +
      renderMetricCard('user-plus', 'Novos no mes', String(stats.newMembers), 'bg-green-600') +
      renderMetricCard('user-minus', 'Saidas no mes', String(stats.exits), 'bg-red-600') +
      renderMetricCard('arrow-down', 'Entradas financeiras', churchMoney(stats.income), 'bg-emerald-600') +
      renderMetricCard('arrow-up', 'Saidas financeiras', churchMoney(stats.expense), 'bg-orange-600') +
      renderMetricCard('wallet', 'Saldo do caixa', churchMoney(stats.balance), stats.balance >= 0 ? 'bg-cyan-600' : 'bg-red-600') +
      renderMetricCard('award', 'Certificados emitidos', String(stats.certificates), 'bg-yellow-600') +
      renderMetricCard('birthday-cake', 'Aniversariantes', String(stats.birthdays), 'bg-purple-600');
  }

  var birthdays = document.getElementById('church-birthdays-list');
  if (birthdays) birthdays.innerHTML = renderBirthdayList();

  var cash = document.getElementById('church-cash-summary');
  if (cash) {
    cash.innerHTML =
      '<div class="flex justify-between p-3 rounded-lg bg-gray-50"><span>Entradas</span><strong class="text-green-500">' + churchMoney(stats.income) + '</strong></div>' +
      '<div class="flex justify-between p-3 rounded-lg bg-gray-50"><span>Saidas</span><strong class="text-red-500">' + churchMoney(stats.expense) + '</strong></div>' +
      '<div class="flex justify-between p-3 rounded-lg bg-gray-50"><span>Saldo</span><strong>' + churchMoney(stats.balance) + '</strong></div>';
  }
}

function getBirthdayMembers() {
  var month = new Date().getMonth() + 1;
  return membersData.filter(function(member) {
    if (!member.birth_date) return false;
    var parts = String(member.birth_date).split('-');
    return Number(parts[1]) === month;
  }).sort(function(a, b) {
    return String(a.birth_date || '').slice(8, 10).localeCompare(String(b.birth_date || '').slice(8, 10));
  });
}

function renderBirthdayList() {
  var birthdays = getBirthdayMembers();
  if (birthdays.length === 0) {
    return '<div class="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">Nenhum aniversariante neste mes.</div>';
  }
  var html = '';
  for (var i = 0; i < birthdays.length; i++) {
    var member = birthdays[i];
    html += '<div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">' +
      '<span class="font-medium text-gray-800">' + escapeHtml(member.full_name) + '</span>' +
      '<span class="text-sm text-gray-500">' + formatDate(member.birth_date) + '</span></div>';
  }
  return html;
}

function showBirthdayMembers() {
  var statusFilter = document.getElementById('member-status-filter');
  var search = document.getElementById('member-search');
  if (statusFilter) statusFilter.value = '';
  if (search) search.value = 'aniversariantes';
  renderChurchMembers(true);
}

function showMemberForm(member) {
  var container = document.getElementById('member-form-container');
  var title = document.getElementById('member-form-title');
  var form = document.getElementById('member-form');
  if (!container || !form) return;
  container.classList.remove('hidden');

  form.reset();
  document.getElementById('member-id').value = '';
  document.getElementById('member-status').value = 'ativo';
  document.getElementById('member-role').value = 'membro';
  document.getElementById('member-baptized').value = 'false';

  if (member) {
    if (title) title.textContent = 'Editar Membro';
    document.getElementById('member-id').value = member.id || '';
    document.getElementById('member-full-name').value = member.full_name || '';
    document.getElementById('member-birth-date').value = member.birth_date || '';
    document.getElementById('member-phone').value = member.phone || '';
    document.getElementById('member-email').value = member.email || '';
    document.getElementById('member-address').value = member.address || '';
    document.getElementById('member-entry-date').value = member.entry_date || '';
    document.getElementById('member-status').value = member.status || 'ativo';
    document.getElementById('member-role').value = member.role || 'membro';
    document.getElementById('member-baptized').value = member.baptized ? 'true' : 'false';
    document.getElementById('member-baptism-date').value = member.baptism_date || '';
    document.getElementById('member-notes').value = member.notes || '';
    document.getElementById('member-photo-url').value = member.photo_url || '';
  } else if (title) {
    title.textContent = 'Novo Membro';
  }
}

function hideMemberForm() {
  var container = document.getElementById('member-form-container');
  if (container) container.classList.add('hidden');
}

async function handleMemberSubmit(event) {
  event.preventDefault();
  var id = document.getElementById('member-id').value;
  var fullName = churchText(document.getElementById('member-full-name').value);
  if (!fullName) {
    churchShowToast('Informe o nome completo do membro.', 'error');
    return;
  }

  var data = {
    full_name: fullName,
    birth_date: document.getElementById('member-birth-date').value || null,
    phone: churchText(document.getElementById('member-phone').value) || null,
    email: churchText(document.getElementById('member-email').value) || null,
    address: churchText(document.getElementById('member-address').value) || null,
    entry_date: document.getElementById('member-entry-date').value || null,
    status: document.getElementById('member-status').value,
    role: document.getElementById('member-role').value,
    baptized: document.getElementById('member-baptized').value === 'true',
    baptism_date: document.getElementById('member-baptism-date').value || null,
    notes: churchText(document.getElementById('member-notes').value) || null,
    photo_url: churchText(document.getElementById('member-photo-url').value) || null
  };

  try {
    var result = id
      ? await window.supabaseClient.from('members').update(data).eq('id', id)
      : await window.supabaseClient.from('members').insert(data);
    if (result.error) throw result.error;
    await logChurchAudit(id ? 'member_updated' : 'member_created', 'members', id || null, data);
    churchShowToast(id ? 'Membro atualizado.' : 'Membro cadastrado.', 'success');
    hideMemberForm();
    await loadChurchManagementData();
  } catch (error) {
    churchShowToast('Erro ao salvar membro: ' + error.message, 'error');
  }
}

function renderChurchMembers(onlyBirthdays) {
  var container = document.getElementById('admin-members-list');
  if (!container) return;

  var search = churchText((document.getElementById('member-search') || {}).value).toLowerCase();
  var status = (document.getElementById('member-status-filter') || {}).value || '';
  var list = onlyBirthdays || search === 'aniversariantes' ? getBirthdayMembers() : membersData.slice();

  list = list.filter(function(member) {
    var matchesSearch = !search || search === 'aniversariantes' ||
      String(member.full_name || '').toLowerCase().indexOf(search) >= 0 ||
      String(member.phone || '').toLowerCase().indexOf(search) >= 0;
    var matchesStatus = !status || member.status === status;
    return matchesSearch && matchesStatus;
  });

  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-users text-2xl"></i></div><h3>Nenhum membro encontrado</h3><p>Cadastre membros ou ajuste os filtros.</p></div>';
    return;
  }

  var html = '';
  for (var i = 0; i < list.length; i++) {
    var member = list[i];
    var memberJson = encodeURIComponent(JSON.stringify(member));
    var phone = String(member.phone || '').replace(/\D/g, '');
    html += '<div class="p-4 bg-gray-50 rounded-lg border border-gray-100">' +
      '<div class="flex flex-col md:flex-row md:items-start justify-between gap-3">' +
      '<div class="flex gap-3 min-w-0">' +
      '<div class="w-12 h-12 rounded-xl bg-adpel-600 text-white flex items-center justify-center overflow-hidden shrink-0">' +
      (member.photo_url ? '<img src="' + escapeHtml(member.photo_url) + '" alt="" class="w-full h-full object-cover">' : '<i class="fas fa-user"></i>') +
      '</div><div class="min-w-0">' +
      '<h4 class="font-semibold text-gray-800 truncate">' + escapeHtml(member.full_name) + '</h4>' +
      '<p class="text-sm text-gray-500 mt-1">' + escapeHtml(member.phone || 'Sem telefone') + (member.email ? ' &bull; ' + escapeHtml(member.email) : '') + '</p>' +
      '<div class="flex flex-wrap gap-2 mt-2"><span class="text-xs bg-adpel-100 text-adpel-700 px-2 py-0.5 rounded">' + escapeHtml(churchLabel(member.status || 'ativo')) + '</span><span class="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">' + escapeHtml(churchLabel(member.role || 'membro')) + '</span>' + (member.baptized ? '<span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Batizado</span>' : '') + '</div>' +
      '</div></div>' +
      '<div class="flex flex-wrap md:justify-end gap-2">' +
      (phone ? '<a href="https://wa.me/55' + escapeHtml(phone) + '" target="_blank" rel="noopener" class="p-2 text-green-500 hover:bg-green-50 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"><i class="fab fa-whatsapp"></i></a>' : '') +
      '<button onclick="editMember(\'' + memberJson + '\')" class="p-2 text-adpel-500 hover:bg-adpel-50 rounded-lg min-w-[44px] min-h-[44px]"><i class="fas fa-edit"></i></button>' +
      '<button onclick="openMemberExit(\'' + member.id + '\')" class="p-2 text-orange-500 hover:bg-orange-50 rounded-lg min-w-[44px] min-h-[44px]" title="Registrar saida"><i class="fas fa-user-minus"></i></button>' +
      '</div></div></div>';
  }
  container.innerHTML = html;
}

function editMember(encodedMember) {
  try {
    showMemberForm(JSON.parse(decodeURIComponent(encodedMember)));
  } catch (error) {
    churchShowToast('Erro ao abrir membro.', 'error');
  }
}

function openMemberExit(memberId) {
  setChurchTab('movements');
  populateMemberSelects();
  document.getElementById('movement-member-id').value = memberId;
  document.getElementById('movement-type').value = 'saida';
  document.getElementById('movement-date').value = churchToday();
  document.getElementById('movement-reason').focus();
}

function populateMemberSelects() {
  var select = document.getElementById('movement-member-id');
  if (!select) return;
  var html = '<option value="">Selecione um membro</option>';
  for (var i = 0; i < membersData.length; i++) {
    html += '<option value="' + membersData[i].id + '">' + escapeHtml(membersData[i].full_name || 'Sem nome') + '</option>';
  }
  select.innerHTML = html;
}

async function handleMemberMovementSubmit(event) {
  event.preventDefault();
  var memberId = document.getElementById('movement-member-id').value;
  var type = document.getElementById('movement-type').value;
  if (!memberId || !type) {
    churchShowToast('Selecione o membro e o tipo de movimentacao.', 'error');
    return;
  }

  var data = {
    member_id: memberId,
    movement_type: type,
    movement_date: document.getElementById('movement-date').value || churchToday(),
    reason: churchText(document.getElementById('movement-reason').value) || null,
    responsible: churchText(document.getElementById('movement-responsible').value) || null
  };

  try {
    var result = await window.supabaseClient.from('member_movements').insert(data);
    if (result.error) throw result.error;

    var nextStatus = getStatusFromMovement(type);
    if (nextStatus) {
      var updateResult = await window.supabaseClient.from('members').update({ status: nextStatus }).eq('id', memberId);
      if (updateResult.error) throw updateResult.error;
    }

    await logChurchAudit('member_movement_created', 'member_movements', memberId, data);
    document.getElementById('member-movement-form').reset();
    document.getElementById('movement-date').value = churchToday();
    churchShowToast('Movimentacao registrada.', 'success');
    await loadChurchManagementData();
  } catch (error) {
    churchShowToast('Erro ao registrar movimentacao: ' + error.message, 'error');
  }
}

function getStatusFromMovement(type) {
  var map = {
    entrada: 'ativo',
    retorno: 'ativo',
    saida: 'removido',
    transferencia: 'transferido',
    afastamento: 'afastado',
    falecimento: 'falecido'
  };
  return map[type] || null;
}

function renderMemberMovements() {
  var container = document.getElementById('admin-member-movements-list');
  if (!container) return;
  if (memberMovementsData.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-exchange-alt text-2xl"></i></div><h3>Nenhuma movimentacao encontrada</h3><p>Registre entradas, saidas, transferencias e retornos.</p></div>';
    return;
  }

  var html = '';
  for (var i = 0; i < memberMovementsData.length; i++) {
    var item = memberMovementsData[i];
    var member = findMember(item.member_id);
    html += '<div class="p-4 bg-gray-50 rounded-lg border border-gray-100">' +
      '<div class="flex flex-col md:flex-row md:items-center justify-between gap-2">' +
      '<div><h4 class="font-semibold text-gray-800">' + escapeHtml(member ? member.full_name : 'Membro nao encontrado') + '</h4>' +
      '<p class="text-sm text-gray-500">' + escapeHtml(churchLabel(item.movement_type || item.type)) + ' &bull; ' + formatDate(item.movement_date) + '</p>' +
      (item.reason ? '<p class="text-sm text-gray-500 mt-1">' + escapeHtml(item.reason) + '</p>' : '') + '</div>' +
      (item.responsible ? '<span class="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">' + escapeHtml(item.responsible) + '</span>' : '') +
      '</div></div>';
  }
  container.innerHTML = html;
}

function findMember(id) {
  for (var i = 0; i < membersData.length; i++) {
    if (membersData[i].id === id) return membersData[i];
  }
  return null;
}

async function handleCashSubmit(event) {
  event.preventDefault();
  var id = document.getElementById('cash-id').value;
  var amount = Number(document.getElementById('cash-amount').value || 0);
  if (amount <= 0) {
    churchShowToast('O valor financeiro deve ser maior que zero.', 'error');
    return;
  }

  var data = {
    type: document.getElementById('cash-type').value,
    category: churchText(document.getElementById('cash-category').value),
    amount: amount,
    movement_date: document.getElementById('cash-date').value,
    payment_method: churchText(document.getElementById('cash-payment-method').value) || null,
    description: churchText(document.getElementById('cash-description').value) || null,
    responsible: churchText(document.getElementById('cash-responsible').value) || null
  };

  if (!data.category || !data.movement_date) {
    churchShowToast('Informe categoria e data.', 'error');
    return;
  }

  try {
    var result = id
      ? await window.supabaseClient.from('cash_movements').update(data).eq('id', id)
      : await window.supabaseClient.from('cash_movements').insert(data);
    if (result.error) throw result.error;
    await logChurchAudit(id ? 'cash_movement_updated' : 'cash_movement_created', 'cash_movements', id || null, data);
    resetCashForm();
    churchShowToast('Lancamento salvo.', 'success');
    await loadChurchManagementData();
  } catch (error) {
    churchShowToast('Erro ao salvar caixa: ' + error.message, 'error');
  }
}

function resetCashForm() {
  var form = document.getElementById('cash-movement-form');
  if (form) form.reset();
  var id = document.getElementById('cash-id');
  var date = document.getElementById('cash-date');
  if (id) id.value = '';
  if (date) date.value = churchToday();
}

function getFilteredCashMovements() {
  var start = (document.getElementById('cash-filter-start') || {}).value || '';
  var end = (document.getElementById('cash-filter-end') || {}).value || '';
  var type = (document.getElementById('cash-filter-type') || {}).value || '';
  var category = churchText((document.getElementById('cash-filter-category') || {}).value).toLowerCase();

  return cashMovementsData.filter(function(item) {
    var date = item.movement_date || '';
    if (start && date < start) return false;
    if (end && date > end) return false;
    if (type && item.type !== type) return false;
    if (category && String(item.category || '').toLowerCase().indexOf(category) < 0) return false;
    return true;
  });
}

function renderCashMovements() {
  var list = getFilteredCashMovements();
  var income = 0;
  var expense = 0;
  for (var i = 0; i < list.length; i++) {
    if (list[i].type === 'entrada') income += Number(list[i].amount || 0);
    if (list[i].type === 'saida') expense += Number(list[i].amount || 0);
  }

  var summary = document.getElementById('cash-summary-cards');
  if (summary) {
    summary.innerHTML =
      renderMetricCard('arrow-down', 'Entradas filtradas', churchMoney(income), 'bg-green-600') +
      renderMetricCard('arrow-up', 'Saidas filtradas', churchMoney(expense), 'bg-red-600') +
      renderMetricCard('wallet', 'Saldo filtrado', churchMoney(income - expense), income - expense >= 0 ? 'bg-cyan-600' : 'bg-red-600');
  }

  var container = document.getElementById('admin-cash-movements-list');
  if (!container) return;
  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-wallet text-2xl"></i></div><h3>Nenhum lancamento encontrado</h3><p>Cadastre entradas e saidas ou ajuste os filtros.</p></div>';
    return;
  }

  var html = '';
  for (var c = 0; c < list.length; c++) {
    var item = list[c];
    var isIncome = item.type === 'entrada';
    var isAppOffering = item.source === 'offering_app' || item.source === 'fundraising_contribution';
    var payer = item.payer_name || item.payer_email || item.responsible || '';
    html += '<div class="p-4 bg-gray-50 rounded-lg border border-gray-100">' +
      '<div class="flex flex-col md:flex-row md:items-center justify-between gap-2">' +
      '<div><h4 class="font-semibold text-gray-800">' + escapeHtml(item.category || 'Sem categoria') + '</h4>' +
      '<p class="text-sm text-gray-500">' + formatDate(item.movement_date) + (item.payment_method ? ' &bull; ' + escapeHtml(item.payment_method) : '') + (payer ? ' &bull; ' + escapeHtml(payer) : '') + '</p>' +
      (item.description ? '<p class="text-sm text-gray-500 mt-1">' + escapeHtml(item.description) + '</p>' : '') + '</div>' +
      '<div class="flex flex-wrap items-center md:justify-end gap-2">' +
      (isAppOffering ? '<span class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold">App</span>' : '') +
      (item.status ? '<span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">' + escapeHtml(churchLabel(item.status)) + '</span>' : '') +
      '<strong class="' + (isIncome ? 'text-green-500' : 'text-red-500') + '">' + (isIncome ? '+' : '-') + ' ' + churchMoney(item.amount) + '</strong>' +
      '</div>' +
      '</div></div>';
  }
  container.innerHTML = html;
}

function renderCertificateSpecificFields() {
  var type = document.getElementById('church-certificate-type').value;
  var container = document.getElementById('church-certificate-specific-fields');
  if (!container) return;

  if (type === 'batismo') {
    container.innerHTML =
      fieldHtml('cert-name', 'Nome', 'text', true) + fieldHtml('cert-age', 'Idade', 'number', false) +
      fieldHtml('cert-birth-date', 'Data de nascimento', 'date', false) + fieldHtml('cert-baptism-date', 'Data do batismo', 'date', true) +
      fieldHtml('cert-place', 'Local', 'text', false) + fieldHtml('cert-pastor', 'Pastor', 'text', false) +
      fieldHtml('cert-church', 'Igreja', 'text', false) + fieldHtml('cert-city', 'Cidade', 'text', false) +
      fieldHtml('cert-verse', 'Versiculo opcional', 'text', false, 'md:col-span-2');
    return;
  }

  if (type === 'apresentacao_bebe') {
    container.innerHTML =
      fieldHtml('cert-child-name', 'Nome da crianca', 'text', true) + fieldHtml('cert-birth-date', 'Data de nascimento', 'date', false) +
      fieldHtml('cert-father-name', 'Nome do pai', 'text', false) + fieldHtml('cert-mother-name', 'Nome da mae', 'text', false) +
      fieldHtml('cert-presentation-date', 'Data da apresentacao', 'date', true) + fieldHtml('cert-pastor', 'Pastor', 'text', false) +
      fieldHtml('cert-church', 'Igreja', 'text', false) + fieldHtml('cert-city', 'Cidade', 'text', false) +
      fieldHtml('cert-verse', 'Versiculo opcional', 'text', false, 'md:col-span-2');
    return;
  }

  if (type === 'curso') {
    container.innerHTML =
      fieldHtml('cert-name', 'Nome do aluno', 'text', true) +
      fieldHtml('cert-course-title', 'Nome do curso', 'text', true) +
      fieldHtml('cert-date', 'Data de conclusao', 'date', true) +
      fieldHtml('cert-pastor', 'Responsavel', 'text', false) +
      fieldHtml('cert-church', 'Igreja', 'text', false) +
      fieldHtml('cert-city', 'Cidade', 'text', false) +
      fieldHtml('cert-description-extra', 'Descricao do curso', 'text', false, 'md:col-span-2');
    return;
  }

  container.innerHTML =
    fieldHtml('cert-name', 'Nome', 'text', true) +
    fieldHtml('cert-date', 'Data', 'date', true) +
    fieldHtml('cert-church', 'Igreja', 'text', false) +
    fieldHtml('cert-city', 'Cidade', 'text', false) +
    fieldHtml('cert-description-extra', 'Descricao/Dados especificos', 'text', false, 'md:col-span-2');
}

function fieldHtml(id, label, type, required, extraClass) {
  return '<div class="' + (extraClass || '') + '"><label class="block text-sm font-medium text-gray-700 mb-1">' + escapeHtml(label) + (required ? ' <span class="text-red-500">*</span>' : '') + '</label><input type="' + type + '" id="' + id + '" ' + (required ? 'required ' : '') + 'class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none"></div>';
}

async function handleChurchCertificateSubmit(event) {
  event.preventDefault();
  var type = document.getElementById('church-certificate-type').value;
  var payload = collectCertificatePayload();
  var title = getCertificateTitle(type, payload);
  var completedAt = payload.baptism_date || payload.presentation_date || payload.date || churchToday();

  try {
    var data = {
      title: title,
      description: getCertificateDescription(type, payload),
      completed_at: completedAt,
      issued_at: completedAt,
      certificate_type: type,
      certificate_data: payload
    };
    var result = await window.supabaseClient.from('certificates').insert(data);
    if (result.error && String(result.error.message || '').toLowerCase().indexOf('issued_at') >= 0) {
      delete data.issued_at;
      result = await window.supabaseClient.from('certificates').insert(data);
    }
    if (result.error) throw result.error;
    await logChurchAudit('certificate_created', 'certificates', null, data);
    resetChurchCertificateForm();
    churchShowToast('Certificado salvo.', 'success');
    await loadChurchManagementData();
  } catch (error) {
    churchShowToast('Erro ao salvar certificado: ' + error.message, 'error');
  }
}

function collectCertificatePayload() {
  var ids = ['cert-name', 'cert-age', 'cert-birth-date', 'cert-baptism-date', 'cert-place', 'cert-pastor', 'cert-church', 'cert-city', 'cert-verse', 'cert-child-name', 'cert-father-name', 'cert-mother-name', 'cert-presentation-date', 'cert-date', 'cert-course-title', 'cert-description-extra'];
  var payload = {};
  for (var i = 0; i < ids.length; i++) {
    var el = document.getElementById(ids[i]);
    if (el) {
      var key = ids[i].replace('cert-', '').replace(/-/g, '_');
      payload[key] = churchText(el.value) || null;
    }
  }
  return payload;
}

function getCertificateTitle(type, payload) {
  var name = payload.name || payload.child_name || 'Sem nome';
  if (type === 'curso') return 'Certificado de Conclusao - ' + name;
  return churchLabel(type) + ' - ' + name;
}

function getCertificateDescription(type, payload) {
  if (type === 'curso') {
    return payload.course_title || payload.description_extra || 'Certificado de Conclusao';
  }
  return payload.description_extra || churchLabel(type);
}

function resetChurchCertificateForm() {
  var form = document.getElementById('church-certificate-form');
  if (form) form.reset();
  renderCertificateSpecificFields();
}

function renderChurchCertificates() {
  var container = document.getElementById('admin-church-certificates-list');
  if (!container) return;
  if (churchCertificatesData.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-award text-2xl"></i></div><h3>Nenhum certificado emitido</h3><p>Preencha o formulario para salvar o primeiro certificado.</p></div>';
    return;
  }

  var html = '';
  for (var i = 0; i < churchCertificatesData.length; i++) {
    var cert = churchCertificatesData[i];
    html += '<div class="p-4 bg-gray-50 rounded-lg border border-gray-100">' +
      '<div class="flex flex-col md:flex-row md:items-center justify-between gap-2">' +
      '<div><h4 class="font-semibold text-gray-800">' + escapeHtml(cert.title || 'Certificado') + '</h4>' +
      '<p class="text-sm text-gray-500">' + escapeHtml(churchLabel(cert.certificate_type || '')) + (cert.completed_at ? ' &bull; ' + formatDate(cert.completed_at) : '') + '</p></div>' +
      '<div class="flex flex-wrap md:justify-end gap-2">' +
      '<a href="certificate-print.html?id=' + encodeURIComponent(cert.id) + '" target="_blank" rel="noopener" class="px-3 py-2 text-sm font-semibold text-adpel-500 hover:bg-adpel-50 rounded-lg min-h-[40px] flex items-center gap-2"><i class="fas fa-print"></i> Visualizar/Imprimir</a>' +
      '<span class="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded flex items-center">Salvo</span>' +
      '</div>' +
      '</div></div>';
  }
  container.innerHTML = html;
}

function renderChurchReports() {
  var stats = getChurchStats();
  var removed = membersData.filter(function(member) { return member.status === 'removido'; }).length;
  var month = churchCurrentMonthPrefix();
  var monthIncome = 0;
  var monthExpense = 0;
  for (var i = 0; i < cashMovementsData.length; i++) {
    if (String(cashMovementsData[i].movement_date || '').slice(0, 7) !== month) continue;
    if (cashMovementsData[i].type === 'entrada') monthIncome += Number(cashMovementsData[i].amount || 0);
    if (cashMovementsData[i].type === 'saida') monthExpense += Number(cashMovementsData[i].amount || 0);
  }
  var container = document.getElementById('church-reports-cards');
  if (!container) return;
  container.innerHTML =
    renderMetricCard('users', 'Membros ativos', String(stats.activeMembers), 'bg-adpel-600') +
    renderMetricCard('user-slash', 'Membros removidos', String(removed), 'bg-red-600') +
    renderMetricCard('arrow-down', 'Entradas por mes', churchMoney(monthIncome), 'bg-green-600') +
    renderMetricCard('arrow-up', 'Saidas por mes', churchMoney(monthExpense), 'bg-orange-600') +
    renderMetricCard('award', 'Certificados emitidos', String(stats.certificates), 'bg-yellow-600') +
    renderMetricCard('birthday-cake', 'Aniversariantes do mes', String(stats.birthdays), 'bg-purple-600');
}

async function logChurchAudit(action, tableName, recordId, payload) {
  if (!window.supabaseClient) return;
  try {
    var sessionResult = await window.supabaseClient.auth.getSession();
    var userId = sessionResult && sessionResult.data && sessionResult.data.session ? sessionResult.data.session.user.id : null;
    await window.supabaseClient.from('audit_logs').insert({
      user_id: userId,
      action: action,
      table_name: tableName,
      record_id: recordId,
      payload: payload || {}
    });
  } catch (error) {
    console.warn('Audit log indisponivel:', error.message || error);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  var memberForm = document.getElementById('member-form');
  if (memberForm) memberForm.addEventListener('submit', handleMemberSubmit);

  var movementForm = document.getElementById('member-movement-form');
  if (movementForm) movementForm.addEventListener('submit', handleMemberMovementSubmit);

  var cashForm = document.getElementById('cash-movement-form');
  if (cashForm) cashForm.addEventListener('submit', handleCashSubmit);

  var certForm = document.getElementById('church-certificate-form');
  if (certForm) certForm.addEventListener('submit', handleChurchCertificateSubmit);

  var movementDate = document.getElementById('movement-date');
  if (movementDate) movementDate.value = churchToday();
  var cashDate = document.getElementById('cash-date');
  if (cashDate) cashDate.value = churchToday();
  renderCertificateSpecificFields();
});

console.log('church-management.js carregado');
