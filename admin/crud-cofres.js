// ============================================================
// CRUD COFRES - admin/crud-cofres.js
// ============================================================

function showCofreForm(cofre) {
  var container = document.getElementById('cofre-form-container');
  var titleEl = document.getElementById('cofre-form-title');
  if (!container) { return; }

  container.classList.remove('hidden');

  if (cofre) {
    titleEl.textContent = 'Editar Cofre';
    document.getElementById('cofre-id').value = cofre.id || '';
    document.getElementById('cofre-name').value = cofre.name || '';
    document.getElementById('cofre-target').value = cofre.target_amount || '';
    document.getElementById('cofre-description').value = cofre.description || '';
    document.getElementById('cofre-image').value = cofre.image_url || '';
    document.getElementById('cofre-end-date').value = cofre.end_date || '';
    document.getElementById('cofre-active').checked = cofre.is_active !== false;
  } else {
    titleEl.textContent = 'Novo Cofre';
    document.getElementById('cofre-form').reset();
    document.getElementById('cofre-id').value = '';
    document.getElementById('cofre-active').checked = true;
  }
}

function hideCofreForm() {
  var container = document.getElementById('cofre-form-container');
  if (container) { container.classList.add('hidden'); }
}

async function handleCofreSubmit(e) {
  e.preventDefault();

  var id = document.getElementById('cofre-id').value;
  var data = {
    name: document.getElementById('cofre-name').value.trim(),
    target_amount: parseFloat(document.getElementById('cofre-target').value) || 0,
    description: document.getElementById('cofre-description').value.trim(),
    image_url: document.getElementById('cofre-image').value.trim(),
    end_date: document.getElementById('cofre-end-date').value || null,
    is_active: document.getElementById('cofre-active').checked
  };

  try {
    var result;
    if (id) {
      result = await window.supabaseClient.from('fundraising_goals').update(data).eq('id', id);
    } else {
      result = await window.supabaseClient.from('fundraising_goals').insert(data);
    }
    if (result.error) { throw result.error; }
    if (typeof showToast === 'function') { showToast(id ? 'Cofre atualizado!' : 'Cofre criado!', 'success'); }
    hideCofreForm();
    await loadAllData();
  } catch (error) {
    console.error('Erro ao salvar cofre:', error);
    if (typeof showToast === 'function') { showToast('Erro: ' + error.message, 'error'); }
  }
}

async function deleteCofre(id) {
  if (!confirm('Tem certeza que deseja excluir este cofre? Todas as contribuições serão removidas.')) { return; }
  try {
    var result = await window.supabaseClient.from('fundraising_goals').delete().eq('id', id);
    if (result.error) { throw result.error; }
    if (typeof showToast === 'function') { showToast('Cofre excluído!', 'success'); }
    await loadAllData();
  } catch (error) {
    console.error('Erro ao excluir cofre:', error);
    if (typeof showToast === 'function') { showToast('Erro: ' + error.message, 'error'); }
  }
}

function renderAdminCofres() {
  var container = document.getElementById('admin-cofres-list');
  if (!container) { return; }

  if (!Array.isArray(cofresData) || cofresData.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-piggy-bank text-2xl"></i></div><h3>Nenhum cofre encontrado</h3><p>Clique em "Criar Cofre" para começar.</p></div>';
    return;
  }

  var html = '';
  for (var i = 0; i < cofresData.length; i++) {
    var cofre = cofresData[i];
    if (!cofre) continue;
    var stats = cofresStatsData[cofre.id] || {};
    var currentAmount = parseFloat(stats.current_amount) || 0;
    var targetAmount = parseFloat(cofre.target_amount) || 0;
    var progressPct = targetAmount > 0 ? Math.min(100, Math.round((currentAmount / targetAmount) * 100)) : 0;

    // Make a clean copy for editing that won't pollute the original
    var cleanCofre = {
      id: cofre.id,
      name: cofre.name || '',
      target_amount: cofre.target_amount || 0,
      description: cofre.description || '',
      image_url: cofre.image_url || '',
      end_date: cofre.end_date || '',
      is_active: cofre.is_active !== false
    };
    var cofreJson = encodeURIComponent(JSON.stringify(cleanCofre));

    html += '<div class="p-4 bg-gray-50 rounded-lg border border-gray-100">' +
      '<div class="flex items-start justify-between gap-3">' +
      '<div class="flex-1 min-w-0">' +
      '<h4 class="font-semibold text-gray-800 truncate">' + escapeHtml(cofre.name || 'Sem nome') + '</h4>' +
      '<p class="text-sm text-gray-500 mt-1">' + escapeHtml(cofre.description || '') + '</p>' +
      '<div class="mt-2">' +
      '<div class="flex justify-between text-xs mb-1">' +
      '<span class="text-green-600 font-bold">R$ ' + formatBRL(currentAmount) + '</span>' +
      '<span class="text-gray-500">Meta: R$ ' + formatBRL(targetAmount) + '</span>' +
      '</div>' +
      '<div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">' +
      '<div class="h-2 rounded-full bg-green-500" style="width: ' + progressPct + '%"></div>' +
      '</div>' +
      '<p class="text-xs text-gray-400 mt-1">' + progressPct + '% alcançado</p>' +
      '</div>' +
      '<div class="flex gap-2 mt-2">' +
      (cofre.is_active !== false ? '<span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Ativo</span>' : '<span class="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded">Inativo</span>') +
      (cofre.end_date ? '<span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Até ' + formatDate(cofre.end_date) + '</span>' : '') +
      '</div></div>' +
      '<div class="flex gap-2">' +
      '<button onclick="editCofre(\'' + cofreJson + '\')" class="p-2 text-green-600 hover:bg-green-50 rounded-lg min-w-[36px] min-h-[36px]"><i class="fas fa-edit"></i></button>' +
      '<button onclick="deleteCofre(\'' + cofre.id + '\')" class="p-2 text-red-500 hover:bg-red-50 rounded-lg min-w-[36px] min-h-[36px]"><i class="fas fa-trash-alt"></i></button>' +
      '</div></div></div>';
  }
  container.innerHTML = html;
}

function editCofre(encodedCofre) {
  try {
    var cofre = JSON.parse(decodeURIComponent(encodedCofre));
    showCofreForm(cofre);
  } catch (e) {
    console.error('Erro ao editar cofre:', e);
    if (typeof showToast === 'function') { showToast('Erro ao abrir cofre para edição.', 'error'); }
  }
}

function formatBRL(value) {
  return Number(value || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

console.log('✅ crud-cofres.js carregado');