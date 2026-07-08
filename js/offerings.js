let ofertaValorSelecionado = 0;
let ofertaTipo = null; // 'livre' ou 'destinada'
let ofertaCofreSelecionado = null; // objeto do cofre escolhido
let ofertaIdRegistrado = null; // ID da contribuiÃ§Ã£o registrada
let ofertaEtapaAtual = 1; // 1=tipo, 2=cofres, 3=valor, 4=pix, 5=sucesso

function restorePageScroll() {
  document.body.style.overflow = '';
  document.body.classList.remove('overflow-hidden');
  document.documentElement.style.overflow = '';
  document.documentElement.classList.remove('overflow-hidden');
}

function openOfertaModal(options) {
  options = options || {};
  const modal = document.getElementById('oferta-modal');
  if (modal) {
    if (modal.parentElement !== document.body) {
      document.body.appendChild(modal);
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    restorePageScroll();
  }
  // Esconder footer no mobile para nÃ£o aparecer atrÃ¡s do modal
  const footer = document.querySelector('footer');
  if (footer) footer.classList.add('hidden');

  resetOfertaSelecao();
  mostrarEtapa('tipo');

  // Carregar cofres se necessÃ¡rio
  if (typeof loadCofresData === 'function' && (!Array.isArray(cofresData) || cofresData.length === 0)) {
    loadCofresData();
  }
}

function openOfertaModalForCofre(goalId) {
  const userInfo = getCurrentUserInfo();
  if (!userInfo.isLoggedIn) {
    showToast('Faca login para contribuir.', 'warning');
    openModal('login-modal');
    restorePageScroll();
    return;
  }
  const abrir = function() {
    openOfertaModal();
    abrirOfertaDestinadaParaCofre(goalId);
  };
  if (typeof loadCofresData === 'function' && (!Array.isArray(cofresData) || cofresData.length === 0)) {
    loadCofresData().then(abrir).catch(abrir);
  } else {
    abrir();
  }
}

function abrirOfertaDestinadaParaCofre(goalId) {
  ofertaTipo = 'destinada';
  renderCofresNoModal();
  selecionarCofreOferta(goalId);
}

function selecionarTipoOferta(tipo) {
  ofertaTipo = tipo;

  if (tipo === 'destinada') {
    // Mostrar etapa de cofres
    mostrarEtapa('cofres');
    renderCofresNoModal();
  } else {
    // Oferta livre: ir direto para valor
    mostrarEtapa('valor');
  }
}

function voltarEtapaTipo() {
  ofertaTipo = null;
  ofertaCofreSelecionado = null;
  mostrarEtapa('tipo');
}

function renderCofresNoModal() {
  var container = document.getElementById('oferta-cofres-lista');
  if (!container) return;

  // Usar cofresData do fundraising.js ou buscar
  var cofres = (typeof cofresData !== 'undefined' && Array.isArray(cofresData)) ? cofresData : [];

  if (cofres.length === 0) {
    container.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">Nenhum cofre ativo no momento.</p>';
    return;
  }

  container.innerHTML = cofres.map(function(cofre) {
    if (!cofre || !cofre.id) return '';
    var stats = (typeof cofresStats !== 'undefined' && cofresStats[cofre.id]) ? cofresStats[cofre.id] : {};
    var currentAmount = parseFloat(stats.current_amount) || 0;
    var targetAmount = parseFloat(cofre.target_amount) || 0;
    var progressPct = targetAmount > 0 ? Math.min(100, Math.round((currentAmount / targetAmount) * 100)) : 0;
    var isComplete = progressPct >= 100;

    var nomeSeguro = (cofre.name && cofre.name !== 'undefined' && cofre.name !== 'null') ? cofre.name : 'Cofre';

    return '<button onclick="selecionarCofreOferta(\'' + cofre.id + '\')" ' +
      'class="w-full p-3 border-2 border-gray-200 rounded-xl text-left hover:border-green-500 hover:bg-green-50 transition group" ' +
      (isComplete ? 'disabled' : '') + '>' +
      '<div class="flex items-center justify-between">' +
      '<div class="flex-1">' +
      '<p class="font-semibold text-gray-800 text-sm">' + escapeHtml(nomeSeguro) + '</p>' +
      '<div class="mt-1 w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">' +
      '<div class="h-1.5 rounded-full ' + (isComplete ? 'bg-gray-400' : 'bg-green-500') + '" style="width:' + progressPct + '%"></div>' +
      '</div>' +
      '<p class="text-xs text-gray-500 mt-1">R$ ' + (typeof formatBRL === 'function' ? formatBRL(currentAmount) : currentAmount.toFixed(2)) + ' / R$ ' + (typeof formatBRL === 'function' ? formatBRL(targetAmount) : targetAmount.toFixed(2)) + '</p>' +
      '</div>' +
      '<i class="fas fa-chevron-right text-gray-400 ml-2"></i>' +
      '</div>' +
      '</button>';
  }).join('');
}

function selecionarCofreOferta(cofreId) {
  // Buscar o cofre nos dados
  var cofres = (typeof cofresData !== 'undefined' && Array.isArray(cofresData)) ? cofresData : [];
  var cofre = cofres.find(function(c) { return c.id === cofreId; });
  if (!cofre) {
    showToast('Cofre nÃ£o encontrado.', 'error');
    return;
  }

  ofertaCofreSelecionado = cofre;
  // AvanÃ§ar para etapa de valor
  mostrarEtapa('valor');

  showToast('Cofre selecionado: ' + (cofre.name || 'Objetivo'), 'info');
}

function closeOfertaModal() {
  const modal = document.getElementById('oferta-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    restorePageScroll();
  }
  // Restaurar footer
  const footer = document.querySelector('footer');
  if (footer) footer.classList.remove('hidden');

  resetOfertaSelecao();
  // Garantir que volte para etapa tipo na prÃ³xima abertura
  mostrarEtapa('tipo');
}

function mostrarEtapa(etapa) {
  const etapas = {
    'tipo': document.getElementById('oferta-etapa-tipo'),
    'cofres': document.getElementById('oferta-etapa-cofres'),
    'valor': document.getElementById('oferta-etapa-valor'),
    'pix': document.getElementById('oferta-pix-container'),
    'sucesso': document.getElementById('oferta-sucesso')
  };

  // Esconder todas
  Object.values(etapas).forEach(el => { if (el) el.classList.add('hidden'); });

  // Mostrar a etapa desejada
  if (etapas[etapa]) {
    etapas[etapa].classList.remove('hidden');
    ofertaEtapaAtual = ['tipo','cofres','valor','pix','sucesso'].indexOf(etapa) + 1;
  }
}

function resetOfertaSelecao() {
  ofertaValorSelecionado = 0;
  ofertaTipo = null;
  ofertaCofreSelecionado = null;
  ofertaIdRegistrado = null;
  ofertaEtapaAtual = 1;

  document.querySelectorAll('.oferta-valor-btn').forEach(btn => {
    btn.classList.remove('border-green-500', 'bg-green-50', 'text-green-700');
    btn.classList.add('border-gray-200', 'text-gray-700');
  });
  const personalizado = document.getElementById('oferta-personalizado');
  if (personalizado) personalizado.value = '';
  const valorSelecionado = document.getElementById('oferta-valor-selecionado');
  if (valorSelecionado) valorSelecionado.classList.add('hidden');

  // Resetar Ã¡rea PIX
  const pixContainer = document.getElementById('oferta-pix-container');
  const pixQrcode = document.getElementById('pix-qrcode');
  const pixCodigo = document.getElementById('pix-codigo');
  const sucesso = document.getElementById('oferta-sucesso');
  if (pixContainer) pixContainer.classList.add('hidden');
  if (pixQrcode) pixQrcode.src = '';
  if (pixCodigo) pixCodigo.value = '';
  if (sucesso) sucesso.classList.add('hidden');

  atualizarBotaoOferta();
}

function selectOfertaValor(valor) {
  ofertaValorSelecionado = valor;
  document.getElementById('oferta-personalizado').value = '';

  document.querySelectorAll('.oferta-valor-btn').forEach(btn => {
    const btnValor = parseFloat(btn.getAttribute('data-valor'));
    if (btnValor === valor) {
      btn.classList.add('border-green-500', 'bg-green-50', 'text-green-700');
      btn.classList.remove('border-gray-200', 'text-gray-700');
    } else {
      btn.classList.remove('border-green-500', 'bg-green-50', 'text-green-700');
      btn.classList.add('border-gray-200', 'text-gray-700');
    }
  });

  mostrarValorSelecionado();
  atualizarBotaoOferta();
}

function onOfertaPersonalizadoChange() {
  const input = document.getElementById('oferta-personalizado');
  const val = parseFloat(input.value);
  if (!isNaN(val) && val > 0) {
    ofertaValorSelecionado = val;
    document.querySelectorAll('.oferta-valor-btn').forEach(btn => {
      btn.classList.remove('border-green-500', 'bg-green-50', 'text-green-700');
      btn.classList.add('border-gray-200', 'text-gray-700');
    });
    mostrarValorSelecionado();
    atualizarBotaoOferta();
  } else {
    ofertaValorSelecionado = 0;
    document.getElementById('oferta-valor-selecionado').classList.add('hidden');
    atualizarBotaoOferta();
  }
}

function mostrarValorSelecionado() {
  const display = document.getElementById('oferta-valor-display');
  const container = document.getElementById('oferta-valor-selecionado');
  if (display && container && ofertaValorSelecionado > 0) {
    display.textContent = `R$ ${ofertaValorSelecionado.toFixed(2).replace('.', ',')}`;
    container.classList.remove('hidden');
  }
}

function atualizarBotaoOferta() {
  const btn = document.getElementById('oferta-pagar-btn');
  if (!btn) return;
  if (ofertaValorSelecionado > 0) {
    btn.disabled = false;
    btn.className = 'w-full py-4 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 transition-all duration-300 shadow-md';
    btn.innerHTML = '<i class="fas fa-arrow-right mr-2"></i> Continuar para Pagamento';
  } else {
    btn.disabled = true;
    btn.className = 'w-full py-4 bg-gray-300 text-gray-500 rounded-xl font-bold text-lg transition-all duration-300 cursor-not-allowed';
    btn.innerHTML = '<i class="fas fa-lock mr-2"></i> Selecione um valor';
  }
}

async function processarOferta() {
  if (ofertaValorSelecionado <= 0) {
    showToast('Selecione um valor para ofertar.', 'warning');
    return;
  }

  // A oferta destinada tambem sera registrada somente ao confirmar pagamento.
  if (false && ofertaTipo === 'destinada' && ofertaCofreSelecionado) {
    const userInfo = getCurrentUserInfo();
    if (userInfo.isLoggedIn && userInfo.user) {
      try {
        const { data, error } = await window.supabaseClient
          .from('fundraising_contributions')
          .insert([{
            goal_id: ofertaCofreSelecionado.id,
            user_id: userInfo.user.id,
            amount: ofertaValorSelecionado,
            anonymous: false
          }])
          .select('id');

        if (error) throw error;

        if (data && data.length > 0) {
          ofertaIdRegistrado = data[0].id;
        }
      } catch (e) {
        console.error('Erro ao registrar oferta destinada:', e);
        // NÃ£o bloqueia - continua para gerar PIX mesmo se falhar registro
      }
    }
  }

  // Mostrar etapa PIX
  mostrarEtapa('pix');

  // Atualizar label do destino no container PIX
  const pixContainer = document.getElementById('oferta-pix-container');
  if (pixContainer) {
    // Adicionar label de destino se nÃ£o existir
    var destinoEl = document.getElementById('pix-destino-label');
    if (!destinoEl) {
      destinoEl = document.createElement('p');
      destinoEl.id = 'pix-destino-label';
      destinoEl.className = 'text-sm text-gray-600 text-center mb-2';
      pixContainer.insertBefore(destinoEl, pixContainer.firstChild);
    }
    if (ofertaTipo === 'destinada' && ofertaCofreSelecionado) {
      destinoEl.textContent = 'Destino: ' + (ofertaCofreSelecionado.name || 'Cofre');
    } else {
      destinoEl.textContent = 'Oferta Livre - ADPEL';
    }
  }

  // Gerar payload PIX (com identificador se for oferta destinada)
  var descricaoRaw = '';
  if (ofertaTipo === 'destinada' && ofertaCofreSelecionado) {
    var nomeCofre = String(ofertaCofreSelecionado.name || 'Cofre');
    // Limpar nome do cofre contra corrupÃ§Ã£o
    nomeCofre = nomeCofre
      .replace(/undefinednull/gi, '')
      .replace(/undefined/gi, '')
      .replace(/\bnull\b/gi, '')
      .trim();
    if (!nomeCofre || nomeCofre.length < 1) nomeCofre = 'Cofre';
    descricaoRaw = 'OFERTA ' + nomeCofre;
  } else {
    descricaoRaw = 'OFERTA ADPEL';
  }
  // Sanitizar descriÃ§Ã£o final (apenas alfanumÃ©rico, jÃ¡ serÃ¡ sanitizado em sanitizarTxId)
  var descricao = String(descricaoRaw)
    .replace(/undefinednull/gi, '')
    .replace(/undefined/gi, '')
    .replace(/\bnull\b/gi, '')
    .trim();
  if (!descricao || descricao.length < 2) descricao = 'OFERTAADPEL';

  const pixPayload = gerarPixPayload(ofertaValorSelecionado, descricao);

  // Exibir cÃ³digo PIX no textarea
  document.getElementById('pix-codigo').value = pixPayload;

  // Gerar QR Code
  const qrImage = document.getElementById('pix-qrcode');
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixPayload)}&margin=10`;
  qrImage.src = qrUrl;
  qrImage.alt = 'QR Code PIX';

  // Atualizar valor exibido
  document.getElementById('pix-valor-display').textContent = ofertaValorSelecionado.toFixed(2).replace('.', ',');

  showToast('QR Code PIX gerado com sucesso!', 'success');
}

// ==========================
// FUNÃ‡Ã•ES PIX - BR Code EMV
// ==========================

// ==========================
// CONSTANTES PIX (configure aqui)
// ==========================
const PIX_KEY  = 'adpel.ssantoandre@gmail.com';  // Chave PIX da igreja (email)
const PIX_NAME = 'ADPEL ASSEMBLEIA DE DEUS';     // MÃ¡ximo 25 caracteres, sem acentos
const PIX_CITY = 'GOIANIA';                      // Sem acentos, mÃ¡ximo 15 caracteres

function emv(id, value) {
   value = String(value)
       .normalize('NFC')
       .trim();
   const length = [...value].length;
   return (
       id +
       String(length).padStart(2, '0') +
       value
   );
}

function gerarPixPayload(valor, descricao) {

  const pixKey = PIX_KEY;

  const merchantNameClean = String(PIX_NAME)
    .normalize('NFC')
    .trim()
    .toUpperCase()
    .substring(0, 25);

  const cityClean = String(PIX_CITY)
    .normalize('NFC')
    .trim()
    .toUpperCase()
    .substring(0, 15);

  let payload =

    emv('00', '01') +

    emv(
      '26',
      emv('00', 'BR.GOV.BCB.PIX') +
      emv('01', pixKey)
    ) +

    emv('52', '0000') +
    emv('53', '986') +
    emv('54', Number(valor).toFixed(2)) +
    emv('58', 'BR') +
    emv('59', merchantNameClean) +
    emv('60', cityClean) +

    // TXID obrigatÃ³rio para maior compatibilidade
    emv(
      '62',
      emv('05', '***')
    );

  payload += '6304';

  payload += calcularCRC16(payload)
    .toUpperCase()
    .padStart(4, '0');

  return payload;
}

// FunÃ§Ã£o auxiliar para remover acentos
function removerAcentos(str) {
  if (!str) return '';
  return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function sanitizarTxId(descricao) {
   if (!descricao) return '';
   let limpo = removerAcentos(descricao);
   // Remove tudo que nÃ£o for letra, nÃºmero ou espaÃ§o
   limpo = limpo.replace(/[^A-Za-z0-9 ]/g, '');
   // Remove espaÃ§os extras
   limpo = limpo.replace(/\s+/g, ' ').trim();
   // Limita a 25 caracteres
   limpo = limpo.substring(0, 25);
   // Se ficou vazio, usa fallback
   if (limpo.length === 0) limpo = 'OFERTA' + Date.now().toString(36).substring(0, 10);
   return limpo.toUpperCase();
}

function calcularCRC16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc.toString(16)
    .padStart(4, '0')
    .toUpperCase();
}

function copiarPix() {
  const textarea = document.getElementById('pix-codigo');
  if (!textarea) return;

  textarea.select();
  textarea.setSelectionRange(0, 99999); // Mobile

  try {
    navigator.clipboard.writeText(textarea.value).then(() => {
      showToast('CÃ³digo PIX copiado! Cole no seu app bancÃ¡rio.', 'success');
    }).catch(() => {
      // Fallback para navegadores antigos
      document.execCommand('copy');
      showToast('CÃ³digo PIX copiado!', 'success');
    });
  } catch (e) {
    document.execCommand('copy');
    showToast('CÃ³digo PIX copiado!', 'success');
  }

  // Desselecionar
  window.getSelection().removeAllRanges();
}

function gerarCodigoReciboOferta() {
  return 'ADPEL-' + Date.now().toString(36).toUpperCase();
}

function isOfferingSchemaError(error) {
  const text = String(error && (error.message || error.details || error.hint || error.code) || '').toLowerCase();
  return text.indexOf('contribution_type') !== -1 ||
    text.indexOf('receipt_code') !== -1 ||
    text.indexOf('paid_at') !== -1 ||
    text.indexOf('status') !== -1 ||
    text.indexOf('42703') !== -1 ||
    text.indexOf('pgrst204') !== -1;
}

function isCashSourceSchemaError(error) {
  const text = String(error && (error.message || error.details || error.hint || error.code) || '').toLowerCase();
  return text.indexOf('source') !== -1 ||
    text.indexOf('source_id') !== -1 ||
    text.indexOf('payer_name') !== -1 ||
    text.indexOf('payer_email') !== -1 ||
    text.indexOf('payer_phone') !== -1 ||
    text.indexOf('status') !== -1 ||
    text.indexOf('42703') !== -1 ||
    text.indexOf('pgrst204') !== -1;
}

function isDuplicateCashMovementError(error) {
  const text = String(error && (error.message || error.details || error.hint || error.code) || '').toLowerCase();
  return text.indexOf('23505') !== -1 || text.indexOf('duplicate key') !== -1;
}

async function getOfferingPayerInfo(userId) {
  var info = { name: '', email: '', phone: '' };
  try {
    var sessionResult = await window.supabaseClient.auth.getSession();
    var user = sessionResult && sessionResult.data && sessionResult.data.session ? sessionResult.data.session.user : null;
    if (user) {
      info.email = user.email || '';
      info.name = user.user_metadata && user.user_metadata.full_name ? user.user_metadata.full_name : '';
    }
  } catch (error) {
    console.warn('Nao foi possivel ler sessao para oferta:', error);
  }

  if (userId) {
    try {
      var profileResult = await window.supabaseClient
        .from('profiles')
        .select('full_name, name, email, phone')
        .eq('id', userId)
        .single();
      if (!profileResult.error && profileResult.data) {
        info.name = profileResult.data.full_name || profileResult.data.name || info.name;
        info.email = profileResult.data.email || info.email;
        info.phone = profileResult.data.phone || info.phone;
      }
    } catch (error) {
      console.warn('Nao foi possivel carregar perfil para oferta:', error);
    }
  }

  return info;
}

async function createCashMovementFromOffering(offering) {
  if (!window.supabaseClient || !offering) return { success: false, skipped: true };

  var amount = Number(offering.amount || 0);
  if (!amount || amount <= 0) return { success: false, skipped: true };

  var source = offering.source || 'offering_app';
  var sourceId = offering.id || offering.source_id || null;
  var isGoal = !!(offering.goal_id || offering.goal_name);
  var goalName = offering.goal_name || (ofertaCofreSelecionado && ofertaCofreSelecionado.name) || '';
  var payer = await getOfferingPayerInfo(offering.user_id);
  var movementDate = String(offering.paid_at || offering.created_at || new Date().toISOString()).slice(0, 10);
  var category = isGoal ? 'Campanha/Cofre' : 'Oferta';
  var description = isGoal
    ? 'Contribuicao para cofre: ' + (goalName || 'Cofre')
    : 'Oferta registrada pelo app';

  var fullData = {
    type: 'entrada',
    category: category,
    amount: amount,
    movement_date: movementDate,
    payment_method: offering.payment_method || 'Pix',
    description: description,
    responsible: payer.name || payer.email || 'Usuario do app',
    created_by: offering.user_id || null,
    receipt_url: offering.receipt_url || null,
    source: source,
    source_id: sourceId,
    payer_name: payer.name || null,
    payer_email: payer.email || null,
    payer_phone: payer.phone || null,
    status: offering.status || 'confirmado'
  };

  if (sourceId) {
    var existing = await window.supabaseClient
      .from('cash_movements')
      .select('id')
      .eq('source', source)
      .eq('source_id', sourceId)
      .maybeSingle();
    if (!existing.error && existing.data) return { success: true, skipped: true, id: existing.data.id };
    if (existing.error && !isCashSourceSchemaError(existing.error)) throw existing.error;
  }

  var result = await window.supabaseClient
    .from('cash_movements')
    .insert([fullData]);

  if (result.error && isDuplicateCashMovementError(result.error)) {
    return { success: true, skipped: true };
  }

  if (result.error && isCashSourceSchemaError(result.error)) {
    var fallbackExisting = await window.supabaseClient
      .from('cash_movements')
      .select('id')
      .eq('type', 'entrada')
      .eq('amount', amount)
      .eq('movement_date', movementDate)
      .eq('created_by', offering.user_id)
      .eq('description', description)
      .maybeSingle();
    if (!fallbackExisting.error && fallbackExisting.data) {
      return { success: true, skipped: true, id: fallbackExisting.data.id };
    }

    result = await window.supabaseClient
      .from('cash_movements')
      .insert([{
        type: fullData.type,
        category: fullData.category,
        amount: fullData.amount,
        movement_date: fullData.movement_date,
        payment_method: fullData.payment_method,
        description: fullData.description + (sourceId ? ' | Ref: ' + sourceId : ''),
        responsible: fullData.responsible,
        created_by: fullData.created_by,
        receipt_url: fullData.receipt_url
      }]);
  }

  if (result.error) throw result.error;
  return { success: true, skipped: false };
}

async function registrarOfertaConfirmada() {
  if (ofertaIdRegistrado) return ofertaIdRegistrado;
  const userInfo = getCurrentUserInfo();
  if (!userInfo.isLoggedIn || !userInfo.user) {
    showToast('Faca login para registrar sua oferta.', 'warning');
    return null;
  }

  const isDestinada = ofertaTipo === 'destinada' && ofertaCofreSelecionado && ofertaCofreSelecionado.id;
  const payload = {
    goal_id: isDestinada ? ofertaCofreSelecionado.id : null,
    user_id: userInfo.user.id,
    amount: ofertaValorSelecionado,
    anonymous: false,
    contribution_type: isDestinada ? 'destinada' : 'livre',
    status: 'confirmed',
    receipt_code: gerarCodigoReciboOferta(),
    paid_at: new Date().toISOString()
  };

  let result = await window.supabaseClient
    .from('fundraising_contributions')
    .insert([payload])
    .select('*')
    .single();

  if (result.error && isOfferingSchemaError(result.error)) {
    console.warn('Banco local sem colunas novas de ofertas. Usando registro compativel:', result.error);
    result = await window.supabaseClient
      .from('fundraising_contributions')
      .insert([{
        goal_id: payload.goal_id,
        user_id: payload.user_id,
        amount: payload.amount,
        anonymous: payload.anonymous
      }])
      .select('*')
      .single();
  }

  if (result.error) throw result.error;
  var contribution = result.data || payload;
  ofertaIdRegistrado = contribution.id || contribution.receipt_code || payload.receipt_code;

  if (isDestinada) {
    await atualizarEstatisticasCofre(ofertaCofreSelecionado.id, ofertaValorSelecionado);
  }

  try {
    await createCashMovementFromOffering({
      id: contribution.id || null,
      source_id: contribution.id || null,
      source: 'fundraising_contribution',
      goal_id: payload.goal_id,
      goal_name: isDestinada && ofertaCofreSelecionado ? ofertaCofreSelecionado.name : '',
      user_id: payload.user_id,
      amount: payload.amount,
      status: 'confirmado',
      payment_method: 'Pix',
      paid_at: contribution.paid_at || payload.paid_at,
      created_at: contribution.created_at || payload.paid_at
    });
  } catch (cashError) {
    console.warn('Oferta registrada, mas nao entrou no caixa automaticamente:', cashError);
  }

  if (currentSection === 'profile') {
    renderProfileOfferings(userInfo);
  }

  return ofertaIdRegistrado;
}

async function atualizarEstatisticasCofre(goalId, amount) {
  // O banco atualiza fundraising_stats por trigger apos inserir em fundraising_contributions.
  // No frontend, apenas recarregamos os dados para refletir o novo progresso do cofre.
  if (!goalId) return;
  if (typeof loadCofresData === 'function') {
    await loadCofresData();
    return;
  }
  if (typeof renderCofresSection === 'function') renderCofresSection();
  if (typeof renderCofresNoModal === 'function') renderCofresNoModal();
}

async function confirmarPagamento() {
  try {
    await registrarOfertaConfirmada();
  } catch (e) {
    console.error('Erro ao registrar oferta confirmada:', e);
    showToast('Erro ao registrar oferta. Tente novamente.', 'error');
    return;
  }

  // Registrar oferta livre no banco (se nÃ£o foi registrada antes)
  if (false && ofertaTipo === 'livre' && !ofertaIdRegistrado) {
    const userInfo = getCurrentUserInfo();
    if (userInfo.isLoggedIn && userInfo.user) {
      try {
        // Para ofertas livres, registramos na tabela de contribuiÃ§Ãµes com goal_id null
        // ou podemos criar uma tabela separada no futuro
        const { data, error } = await window.supabaseClient
          .from('fundraising_contributions')
          .insert([{
            goal_id: null, // oferta livre (sem cofre)
            user_id: userInfo.user.id,
            amount: ofertaValorSelecionado,
            anonymous: false
          }])
          .select('id');

        if (error) {
          console.warn('Erro ao registrar oferta livre:', error);
          // NÃ£o bloqueia
        }

        if (data && data.length > 0) {
          ofertaIdRegistrado = data[0].id;
        }
      } catch (e) {
        console.error('Erro ao registrar oferta livre:', e);
      }
    }
  }

  // Exibir etapa de sucesso
  mostrarEtapa('sucesso');

  // Se for destinada, recarregar dados dos cofres
  if (ofertaTipo === 'destinada' && typeof loadCofresData === 'function') {
    await loadCofresData();
  }

  // Personalizar mensagem
  const msgEl = document.getElementById('oferta-sucesso-msg');
  const idEl = document.getElementById('oferta-id-registrado');

  if (msgEl) {
    if (ofertaTipo === 'destinada' && ofertaCofreSelecionado) {
      msgEl.textContent = 'Sua oferta foi destinada para "' + (ofertaCofreSelecionado.name || 'Cofre') + '". Deus abenÃ§oe!';
    } else {
      msgEl.textContent = '"Senhor, eu devolvo, porque sei que o Senhor me deu primeiro"';
    }
  }

  // Mostrar ID para referÃªncia futura (preparaÃ§Ã£o para API de verificaÃ§Ã£o)
  if (idEl && ofertaIdRegistrado) {
    idEl.textContent = 'Ref: ' + ofertaIdRegistrado;
  } else if (idEl) {
    idEl.textContent = '';
  }

  showToast('Deus abenÃ§oe sua oferta!', 'success');
  if (window.ADPELJourney && typeof window.ADPELJourney.registerSpiritualActivity === 'function') {
    window.ADPELJourney.registerSpiritualActivity('offering_made');
  } else if (window.ADPELJourney && typeof window.ADPELJourney.registerOffering === 'function') {
    window.ADPELJourney.registerOffering();
  }

  // TODO: Futuramente, aqui serÃ¡ feita a verificaÃ§Ã£o via API de pagamento
  // Exemplo:
  // await verificarPagamentoPIX(ofertaIdRegistrado);
  // ou webhook receberÃ¡ a confirmaÃ§Ã£o e atualizarÃ¡ o status no banco
}

Object.assign(window, {
  restorePageScroll,
  openOfertaModal,
  openOfertaModalForCofre,
  abrirOfertaDestinadaParaCofre,
  selecionarTipoOferta,
  voltarEtapaTipo,
  renderCofresNoModal,
  selecionarCofreOferta,
  closeOfertaModal,
  mostrarEtapa,
  resetOfertaSelecao,
  selectOfertaValor,
  onOfertaPersonalizadoChange,
  mostrarValorSelecionado,
  atualizarBotaoOferta,
  processarOferta,
  emv,
  gerarPixPayload,
  removerAcentos,
  sanitizarTxId,
  calcularCRC16,
  copiarPix,
  gerarCodigoReciboOferta,
  isOfferingSchemaError,
  isCashSourceSchemaError,
  isDuplicateCashMovementError,
  createCashMovementFromOffering,
  registrarOfertaConfirmada,
  atualizarEstatisticasCofre,
  confirmarPagamento
});
