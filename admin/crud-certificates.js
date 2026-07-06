// ============================================================
// CRUD CERTIFICATES - admin/crud-certificates.js
// ============================================================

function showCertificateForm(cert) {
  var container = document.getElementById('certificate-form-container');
  var titleEl = document.getElementById('certificate-form-title');
  if (!container) { return; }

  container.classList.remove('hidden');
  loadUsersForCertSelect();

  if (cert) {
    titleEl.textContent = 'Editar Certificado';
    document.getElementById('certificate-id').value = cert.id || '';
    setTimeout(function() {
      var userSelect = document.getElementById('cert-user');
      if (userSelect) userSelect.value = cert.user_id || '';
    }, 500);
    document.getElementById('cert-title').value = cert.title || '';
    document.getElementById('cert-description').value = cert.description || '';
    document.getElementById('cert-completed').value = cert.completed_at || '';
  } else {
    titleEl.textContent = 'Novo Certificado';
    document.getElementById('certificate-form').reset();
    document.getElementById('certificate-id').value = '';
  }
}

function hideCertificateForm() {
  var container = document.getElementById('certificate-form-container');
  if (container) { container.classList.add('hidden'); }
}

async function loadUsersForCertSelect() {
  var select = document.getElementById('cert-user');
  if (!select || !window.supabaseClient) { return; }

  try {
    var result = await window.supabaseClient
      .from('profiles').select('id, full_name, email').order('full_name');

    if (result.data && result.data.length > 0) {
      var optionsHtml = '<option value="">Selecione um usuário...</option>';
      for (var i = 0; i < result.data.length; i++) {
        var p = result.data[i];
        optionsHtml += '<option value="' + p.id + '">' + escapeHtml(p.full_name || p.email) + '</option>';
      }
      select.innerHTML = optionsHtml;
    } else {
      select.innerHTML = '<option value="">Nenhum usuário encontrado</option>';
    }
  } catch (error) {
    console.error('Erro ao carregar usuários:', error);
    select.innerHTML = '<option value="">Erro ao carregar usuários</option>';
  }
}

async function handleCertificateSubmit(e) {
  e.preventDefault();

  var id = document.getElementById('certificate-id').value;
  var data = {
    user_id: document.getElementById('cert-user').value,
    title: document.getElementById('cert-title').value.trim(),
    description: document.getElementById('cert-description').value.trim(),
    completed_at: document.getElementById('cert-completed').value || null,
    certificate_type: 'curso'
  };

  try {
    var result;
    if (id) {
      result = await window.supabaseClient.from('certificates').update(data).eq('id', id);
    } else {
      result = await window.supabaseClient.from('certificates').insert(data);
    }
    if (result.error) { throw result.error; }
    if (typeof showToast === 'function') { showToast(id ? 'Certificado atualizado!' : 'Certificado criado!', 'success'); }
    hideCertificateForm();
    await loadAllData();
  } catch (error) {
    console.error('Erro ao salvar certificado:', error);
    if (typeof showToast === 'function') { showToast('Erro: ' + error.message, 'error'); }
  }
}

async function deleteCertificate(id) {
  if (!confirm('Tem certeza que deseja excluir este certificado?')) { return; }
  try {
    var result = await window.supabaseClient.from('certificates').delete().eq('id', id);
    if (result.error) { throw result.error; }
    if (typeof showToast === 'function') { showToast('Certificado excluído!', 'success'); }
    await loadAllData();
  } catch (error) {
    console.error('Erro ao excluir certificado:', error);
    if (typeof showToast === 'function') { showToast('Erro: ' + error.message, 'error'); }
  }
}

function renderAdminCertificates() {
  var container = document.getElementById('admin-certificates-list');
  if (!container) { return; }

  if (!Array.isArray(certificatesData) || certificatesData.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-certificate text-2xl"></i></div><h3>Nenhum certificado encontrado</h3><p>Clique em "Novo Certificado" para começar.</p></div>';
    return;
  }

  var html = '';
  for (var i = 0; i < certificatesData.length; i++) {
    var cert = certificatesData[i];
    if (!cert) continue;
    var certJson = encodeURIComponent(JSON.stringify(cert));
    html += '<div class="p-4 bg-gray-50 rounded-lg border border-gray-100">' +
      '<div class="flex items-start justify-between gap-3">' +
      '<div class="flex-1 min-w-0">' +
      '<h4 class="font-semibold text-gray-800 truncate">' + escapeHtml(cert.title || 'Sem título') + '</h4>' +
      '<p class="text-sm text-gray-500 mt-1">' + escapeHtml(cert.description || '') + '</p>' +
      (cert.completed_at ? '<p class="text-xs text-gray-400 mt-1">Concluído: ' + formatDate(cert.completed_at) + '</p>' : '') +
      '</div>' +
      '<div class="flex flex-wrap justify-end gap-2">' +
      '<a href="certificate-print.html?id=' + encodeURIComponent(cert.id) + '" target="_blank" rel="noopener" class="px-3 py-2 text-sm font-semibold text-adpel-500 hover:bg-adpel-50 rounded-lg min-h-[36px] flex items-center gap-2" title="Visualizar/Imprimir"><i class="fas fa-print"></i> Visualizar/Imprimir</a>' +
      '<button onclick="editCertificate(\'' + certJson + '\')" class="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg min-w-[36px] min-h-[36px]"><i class="fas fa-edit"></i></button>' +
      '<button onclick="deleteCertificate(\'' + cert.id + '\')" class="p-2 text-red-500 hover:bg-red-50 rounded-lg min-w-[36px] min-h-[36px]"><i class="fas fa-trash-alt"></i></button>' +
      '</div></div></div>';
  }
  container.innerHTML = html;
}

function editCertificate(encodedCert) {
  try {
    var cert = JSON.parse(decodeURIComponent(encodedCert));
    showCertificateForm(cert);
  } catch (e) {
    console.error('Erro ao editar certificado:', e);
    if (typeof showToast === 'function') { showToast('Erro ao abrir certificado para edição.', 'error'); }
  }
}

console.log('✅ crud-certificates.js carregado');
