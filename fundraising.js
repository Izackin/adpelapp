// ============================================================
// fundraising.js - Cofres de Objetivos (Oferta Destinada)
// ADPEL Digital Platform - Módulo Separado
// ============================================================

let cofresData = [];
let cofresStats = {};
let currentContributionGoalId = null;
let userCofreContributions = {};

// ==========================
// LOAD DATA
// ==========================

async function loadCofresData() {
  try {
    if (!window.supabaseClient) {
      console.warn('[Cofres] Supabase client não disponível');
      cofresData = [];
      cofresStats = {};
      renderCofresSection();
      return;
    }

    const { data: goals, error: goalsError } = await window.supabaseClient
      .from('fundraising_goals')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (goalsError) throw goalsError;
    
    // Proteção contra dados corrompidos
    cofresData = (goals || []).filter(function(g) {
      return g && g.id && g.name && g.name !== 'undefined' && g.name !== 'null';
    });

    const { data: stats, error: statsError } = await window.supabaseClient
      .from('fundraising_stats')
      .select('*');

    if (statsError) throw statsError;

    cofresStats = {};
    (stats || []).forEach(function(s) {
      if (s && s.goal_id) {
        cofresStats[s.goal_id] = s;
      }
    });

    userCofreContributions = {};
    var userInfo = (typeof getCurrentUserInfo === 'function') ? getCurrentUserInfo() : { isLoggedIn: false };
    if (userInfo.isLoggedIn && userInfo.user && userInfo.user.id) {
      var contributionsResult = await window.supabaseClient
        .from('fundraising_contributions')
        .select('goal_id, amount, created_at, paid_at, status')
        .eq('user_id', userInfo.user.id)
        .not('goal_id', 'is', null)
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false })
        .limit(200);

      if (contributionsResult.error && typeof isOfferingSchemaError === 'function' && isOfferingSchemaError(contributionsResult.error)) {
        contributionsResult = await window.supabaseClient
          .from('fundraising_contributions')
          .select('goal_id, amount, created_at')
          .eq('user_id', userInfo.user.id)
          .not('goal_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(200);
      }

      if (!contributionsResult.error && Array.isArray(contributionsResult.data)) {
        contributionsResult.data.forEach(function(item) {
          if (!item || !item.goal_id) return;
          if (!userCofreContributions[item.goal_id]) {
            userCofreContributions[item.goal_id] = { total: 0, count: 0, latest: null };
          }
          userCofreContributions[item.goal_id].total += Number(item.amount || 0);
          userCofreContributions[item.goal_id].count += 1;
          userCofreContributions[item.goal_id].latest = userCofreContributions[item.goal_id].latest || (item.paid_at || item.created_at || null);
        });
      } else if (contributionsResult.error) {
        console.warn('[Cofres] Nao foi possivel carregar ofertas do usuario:', contributionsResult.error);
      }
    }

    renderCofresSection();
  } catch (e) {
    console.error('[Cofres] Erro ao carregar:', e);
    cofresData = [];
    cofresStats = {};
    userCofreContributions = {};
    renderCofresSection();
  }
}

// ==========================
// RENDER SECTION
// ==========================

function renderCofresSection() {
  var container = document.getElementById('cofres-list');
  if (!container) return;
  var isLoggedIn = getCurrentUserInfo().isLoggedIn;

  // Proteção contra dados corrompidos
  if (!Array.isArray(cofresData)) cofresData = [];
  if (typeof cofresStats !== 'object' || cofresStats === null) cofresStats = {};

  if (!cofresData.length) {
    container.innerHTML =
      '<div class="col-span-full text-center py-12" style="background:rgba(15,23,42,0.6);border-radius:1rem;border:1px solid rgba(6,182,212,0.2);backdrop-filter:blur(10px);">' +
        '<div style="width:5rem;height:5rem;background:linear-gradient(135deg,#16a34a,#059669);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;box-shadow:0 0 15px rgba(22,163,74,0.4);">' +
          '<i class="fas fa-piggy-bank text-2xl"></i>' +
        '</div>' +
        '<p class="text-gray-400 font-medium">Nenhum cofre ativo no momento.</p>' +
        '<p class="text-sm text-gray-500 mt-2">Novos objetivos aparecerão aqui.</p>' +
      '</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < cofresData.length; i++) {
    var goal = cofresData[i];
    // Proteção contra dados corrompidos
    if (!goal || !goal.id) continue;
    var goalName = (goal.name && goal.name !== 'undefined' && goal.name !== 'null') ? goal.name : 'Cofre';
    var goalDesc = (goal.description && goal.description !== 'undefined' && goal.description !== 'null') ? goal.description : '';
    var goalImage = (goal.image_url && goal.image_url !== 'undefined' && goal.image_url !== 'null') ? goal.image_url : '';
    var stats = cofresStats[goal.id] || {};
    var currentAmount = parseFloat(stats.current_amount) || 0;
    var targetAmount = parseFloat(goal.target_amount) || 0;
    var remaining = Math.max(0, targetAmount - currentAmount);
    var progressPct = targetAmount > 0 ? Math.min(100, Math.round((currentAmount / targetAmount) * 100)) : 0;
    var contributors = parseInt(stats.contributor_count, 10) || 0;
    var userContribution = userCofreContributions[goal.id] || null;
    var isComplete = progressPct >= 100;
    var goalEndDate = (goal.end_date && goal.end_date !== 'undefined' && goal.end_date !== 'null') ? goal.end_date : '';

    html += '<div class="bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-lg transition group border border-gray-100">';

    // Imagem
    if (goalImage) {
      html += '<div class="relative h-48 overflow-hidden">' +
        '<img src="' + escapeHtml(goalImage) + '" alt="' + escapeHtml(goalName) + '" class="w-full h-full object-cover group-hover:scale-105 transition duration-500" onerror="this.style.display=\'none\'">' +
        '<div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>' +
        '<div class="absolute bottom-3 left-3 right-3">' +
          '<h3 class="font-bold text-white text-lg truncate">' + escapeHtml(goalName) + '</h3>' +
        '</div>';
      if (isComplete) {
        html += '<div class="absolute top-3 right-3 bg-green-500 text-white px-2 py-1 rounded text-xs font-bold shadow-sm">✅ Alcançado!</div>';
      }
      html += '</div>';
    }

    html += '<div class="p-5">';

    if (!goalImage) {
      html += '<h3 class="font-bold text-gray-800 text-lg mb-2">' + escapeHtml(goalName) + '</h3>';
    }

    if (goalDesc) {
      html += '<p class="text-sm text-gray-500 mb-4 line-clamp-2">' + escapeHtml(goalDesc) + '</p>';
    }

    // Barra de progresso
    html += '<div class="mb-3">' +
      '<div class="flex justify-between text-xs mb-1">' +
        '<span class="text-green-400 font-bold">R$ ' + formatBRL(currentAmount) + '</span>' +
        '<span class="text-gray-500">Meta: R$ ' + formatBRL(targetAmount) + '</span>' +
      '</div>' +
      '<div class="w-full bg-gray-200/50 rounded-full h-3 overflow-hidden">' +
        '<div class="h-3 rounded-full transition-all duration-700 ' + (isComplete ? 'bg-green-500' : 'bg-gradient-to-r from-green-500 to-emerald-400') + '" style="width: ' + progressPct + '%"></div>' +
      '</div>' +
      '<div class="flex justify-between text-xs mt-1.5">' +
        '<span class="' + (isComplete ? 'text-green-400 font-bold' : 'text-adpel-400') + '">' + progressPct + '% alcançado</span>' +
        (!isComplete ? '<span class="text-amber-400">Faltam: R$ ' + formatBRL(remaining) + '</span>' : '') +
      '</div>' +
    '</div>';

    html += '<p class="text-xs text-gray-400 mb-3"><i class="fas fa-users mr-1"></i> ' + contributors + ' pessoa' + (contributors !== 1 ? 's' : '') + ' contribuíram</p>';

    if (isLoggedIn && userContribution && userContribution.total > 0) {
      html += '<div class="mb-3 rounded-xl border border-green-100 bg-green-50 p-3">' +
        '<p class="text-xs font-bold text-green-700 flex items-center gap-1"><i class="fas fa-check-circle"></i> Voce ja ofertou neste cofre</p>' +
        '<p class="text-sm text-gray-700 mt-1">Total: <strong>R$ ' + formatBRL(userContribution.total) + '</strong> em ' + userContribution.count + ' oferta' + (userContribution.count !== 1 ? 's' : '') + '.</p>' +
        '<button onclick="navigateTo(\'profile\')" class="mt-2 text-xs font-bold text-green-700 hover:text-green-900 underline">Ver minhas ofertas</button>' +
      '</div>';
    }

    if (goalEndDate) {
      html += '<p class="text-xs text-gray-500 mb-3"><i class="fas fa-calendar mr-1"></i> Encerra em: ' + formatCofreDate(goalEndDate) + '</p>';
    }

    // Botão
    if (isComplete) {
      html += '<div class="w-full py-2.5 bg-green-100 text-green-700 rounded-xl text-sm font-bold text-center"><i class="fas fa-check-circle mr-1"></i> Meta alcançada! Glória a Deus!</div>';
    } else {
      html += '<button onclick="openOfertaModalForCofre(\'' + goal.id + '\')" class="w-full py-2.5 bg-gradient-to-r from-green-600 to-emerald-500 text-white rounded-xl text-sm font-bold hover:from-green-700 hover:to-emerald-600 transition flex items-center justify-center gap-2 shadow-sm">' +
        '<i class="fas fa-heart"></i> Contribuir</button>';
    }

    html += '</div></div>';
  }

  container.innerHTML = html;

  // Blur overlay para não-logados
  if (!isLoggedIn) {
    container.classList.add('blur-overlay');
  } else {
    container.classList.remove('blur-overlay');
  }
}

// ==========================
// CONTRIBUTION MODAL
// ==========================

function openContributionModal(goalId, goalName, targetAmount) {
  if (typeof openOfertaModalForCofre === 'function') {
    openOfertaModalForCofre(goalId);
    return;
  }

  var userInfo = getCurrentUserInfo();
  if (!userInfo.isLoggedIn) {
    showToast('Faça login para contribuir.', 'warning');
    openModal('login-modal');
    return;
  }

  // Proteção contra parâmetros inválidos
  if (!goalId) {
    showToast('Erro: cofre não identificado.', 'error');
    return;
  }

  currentContributionGoalId = goalId;
  var safeName = (goalName && goalName !== 'undefined' && goalName !== 'null') ? goalName : 'Cofre';
  var safeTarget = parseFloat(targetAmount) || 0;
  var modal = document.getElementById('contribution-modal');
  if (modal) {
    document.getElementById('contribution-goal-name').textContent = safeName;
    document.getElementById('contribution-target-display').textContent = formatBRL(safeTarget);
    document.getElementById('contribution-amount').value = '';
    document.getElementById('contribution-anonymous').checked = false;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = '';
  }
}

function closeContributionModal() {
  var modal = document.getElementById('contribution-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
  }
  currentContributionGoalId = null;
}

async function handleContribution(e) {
  e.preventDefault();

  if (!currentContributionGoalId) {
    showToast('Erro: cofre não identificado.', 'error');
    return;
  }

  var amountInput = document.getElementById('contribution-amount');
  var anonymousCheckbox = document.getElementById('contribution-anonymous');
  var amount = parseFloat(amountInput.value);
  var anonymous = anonymousCheckbox.checked;

  if (!amount || amount <= 0) {
    showToast('Informe um valor válido.', 'error');
    return;
  }

  var userInfo = getCurrentUserInfo();
  if (!userInfo.isLoggedIn || !userInfo.user) {
    showToast('Faça login para contribuir.', 'warning');
    return;
  }

  try {
    var { error } = await window.supabaseClient
      .from('fundraising_contributions')
      .insert([{
        goal_id: currentContributionGoalId,
        user_id: userInfo.user.id,
        amount: amount,
        anonymous: anonymous
      }]);

    if (error) throw error;

    showToast('Contribuição de R$ ' + formatBRL(amount) + ' registrada! Deus abençoe!', 'success');
    closeContributionModal();
    await loadCofresData();
  } catch (err) {
    console.error('Erro ao registrar contribuição:', err);
    showToast('Erro ao registrar contribuição. Tente novamente.', 'error');
  }
}

// ==========================
// HELPERS
// ==========================

function formatBRL(value) {
  return Number(value || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatCofreDate(dateString) {
  if (!dateString || dateString === 'undefined' || dateString === 'null') return '';
  var s = String(dateString).trim();
  if (s === '' || s === 'undefined' || s === 'null') return '';
  var parts = s.split('-');
  if (parts.length !== 3) return s;
  return parts[2] + '/' + parts[1] + '/' + parts[0];
}

// ==========================
// INIT
// ==========================

document.addEventListener('DOMContentLoaded', function() {
  var form = document.getElementById('contribution-form');
  if (form) {
    form.addEventListener('submit', handleContribution);
  }
});

// Fechar modal ao clicar fora
document.addEventListener('click', function(e) {
  var modal = document.getElementById('contribution-modal');
  if (modal && !modal.classList.contains('hidden') && e.target === modal) {
    closeContributionModal();
  }
});

// ==========================
// FALLBACK: Se a tabela fundraising_goals não existir,
// renderiza estado vazio sem erro
// ==========================
window.addEventListener('error', function(e) {
  if (e.message && e.message.indexOf('fundraising') !== -1) {
    console.warn('[Cofres] Erro capturado, usando fallback vazio');
    cofresData = [];
    cofresStats = {};
    renderCofresSection();
  }
});

console.log('✅ fundraising.js carregado');
