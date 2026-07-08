async function loadProfileData() {
  const userInfo = getCurrentUserInfo();
  renderProfile(userInfo);
  if (window.ADPELJourney && typeof window.ADPELJourney.init === 'function') {
    await window.ADPELJourney.init();
  }
  renderProfileTabContent(currentProfileTab || 'summary');
}

let selectedAvatarFile = null;
let selectedAvatarPreviewUrl = '';
let currentProfileTab = 'summary';
let currentProfileUserInfo = null;

function normalizeInstagram(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.indexOf('instagram.com') >= 0) return raw;
  return raw.charAt(0) === '@' ? raw : '@' + raw;
}

function isProfileSchemaError(error) {
  const text = String(error && (error.message || error.details || error.hint || error.code) || '').toLowerCase();
  return text.indexOf('public_name') !== -1 ||
    text.indexOf('bio') !== -1 ||
    text.indexOf('avatar_url') !== -1 ||
    text.indexOf('photo_url') !== -1 ||
    text.indexOf('favorite_verse') !== -1 ||
    text.indexOf('ministry') !== -1 ||
    text.indexOf('instagram') !== -1 ||
    text.indexOf('show_public_profile') !== -1 ||
    text.indexOf('show_in_ranking') !== -1 ||
    text.indexOf('42703') !== -1 ||
    text.indexOf('pgrst204') !== -1;
}

function renderProfile(userInfo) {
  const container = document.getElementById('profile-content');
  if (!container) return;
  currentProfileUserInfo = userInfo;
  const oldJourney = document.getElementById('profile-journey-content');
  if (oldJourney && oldJourney.parentElement) oldJourney.parentElement.classList.add('hidden');
  const oldMedals = document.getElementById('medals-grid');
  if (oldMedals && oldMedals.parentElement) oldMedals.parentElement.classList.add('hidden');

  if (!userInfo.isLoggedIn) {
    container.innerHTML = [
      '<div class="profile-shell">',
      '<div class="profile-section-card text-center">',
        '<div class="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">',
          '<i class="fas fa-user-circle text-5xl text-gray-400"></i>',
        '</div>',
        '<h3 class="text-xl font-bold text-gray-800">Visitante</h3>',
        '<p class="text-gray-500 mt-2">Faça login para acessar sua central pessoal.</p>',
        '<button onclick="openModal(&quot;login-modal&quot;)" class="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition min-h-[44px]">Fazer Login</button>',
      '</div>',
      '</div>'
    ].join('');
    return;
  }

  const profile = userInfo.profile || {};
  const user = userInfo.user || {};
  const rawName = profile.public_name || profile.full_name || user.email || 'Usuario';
  const displayName = escapeHtml(rawName);
  const displayEmail = escapeHtml(user.email || '');
  const roleLabel = userInfo.isMaster ? 'Administrador' : 'Membro';
  const avatar = profile.avatar_url || profile.photo_url || profile.avatar || '';
  const initials = String(rawName || 'M').trim().charAt(0).toUpperCase();

  container.innerHTML = [
    '<div class="profile-shell">',
      '<section class="profile-cover">',
        '<div class="profile-cover-main">',
          '<div class="profile-avatar-xl">',
          avatar ? '<img src="' + escapeHtml(avatar) + '" alt="' + displayName + '" class="w-full h-full object-cover">' : escapeHtml(initials),
          '</div>',
          '<div class="profile-cover-info">',
            '<span class="profile-role-badge">' + escapeHtml(roleLabel) + '</span>',
            '<h3>' + displayName + '</h3>',
            profile.ministry ? '<p class="profile-ministry"><i class="fas fa-hands-praying"></i> ' + escapeHtml(profile.ministry) + '</p>' : '<p class="profile-ministry">Membro ADPEL</p>',
            '<p id="profile-cover-level" class="profile-cover-level hidden"></p>',
            '<p class="profile-owner-email"><i class="fas fa-envelope"></i> ' + displayEmail + '</p>',
          '</div>',
        '</div>',
        '<div class="profile-cover-actions">',
          '<button onclick="openEditProfileModal()" class="profile-cover-btn primary"><i class="fas fa-pen"></i> Editar perfil</button>',
          '<button onclick="openPublicProfile(&quot;' + escapeHtml(user.id) + '&quot;)" class="profile-cover-btn ghost"><i class="fas fa-eye"></i> Ver como público</button>',
        '</div>',
      '</section>',
      '<nav class="profile-tabs" aria-label="Seções do perfil">',
        profileTabButton('summary', 'Resumo', 'fa-id-card'),
        profileTabButton('journey', 'Jornada', 'fa-seedling'),
        profileTabButton('offerings', 'Contribuições', 'fa-heart'),
        profileTabButton('certificates', 'Certificados', 'fa-certificate'),
        profileTabButton('privacy', 'Privacidade', 'fa-shield-halved'),
      '</nav>',
      '<section id="profile-tab-content"></section>',
    '</div>'
  ].join('');
  renderProfileCoverJourney(user.id);
  renderProfileTabContent(currentProfileTab || 'summary');
}

async function renderProfileCoverJourney(userId) {
  const levelEl = document.getElementById('profile-cover-level');
  if (!levelEl || !userId || !window.supabaseClient) return;
  try {
    const result = await window.supabaseClient
      .from('spiritual_progress')
      .select('xp')
      .eq('user_id', userId)
      .maybeSingle();
    if (result.error || !result.data) return;
    const level = publicProfileLevelInfo(result.data.xp || 0);
    levelEl.classList.remove('hidden');
    levelEl.innerHTML = '<i class="fas fa-seedling"></i> Nível ' + escapeHtml(level.level) + ' · ' + escapeHtml(level.title);
  } catch (error) {
    console.warn('Não foi possível carregar o nível do perfil:', error);
  }
}

function profileTabButton(tab, label, icon) {
  const active = currentProfileTab === tab;
  return '<button onclick="setProfileTab(&quot;' + tab + '&quot;)" class="profile-tab-btn ' + (active ? 'is-active' : '') + '"><i class="fas ' + icon + '"></i><span>' + escapeHtml(label) + '</span></button>';
}

function setProfileTab(tabName) {
  currentProfileTab = tabName || 'summary';
  const userInfo = currentProfileUserInfo || getCurrentUserInfo();
  renderProfile(userInfo);
}

function renderProfileTabContent(tabName) {
  const container = document.getElementById('profile-tab-content');
  const userInfo = currentProfileUserInfo || getCurrentUserInfo();
  if (!container || !userInfo || !userInfo.isLoggedIn) return;
  const tab = tabName || currentProfileTab || 'summary';
  if (tab === 'journey') { renderProfileJourneyTab(container, userInfo); return; }
  if (tab === 'offerings') {
    container.innerHTML = '<div id="profile-offerings-content"></div>';
    renderProfileOfferings(userInfo);
    return;
  }
  if (tab === 'certificates') { renderProfileCertificatesTab(container, userInfo); return; }
  if (tab === 'privacy') { renderProfilePrivacyTab(container, userInfo); return; }
  renderProfileSummaryTab(container, userInfo);
}

function renderProfileSummaryTab(container, userInfo) {
  const profile = userInfo.profile || {};
  const instagram = normalizeInstagram(profile.instagram || '');
  const phoneState = profile.phone
    ? (profile.show_phone === true ? 'Visível no perfil público' : 'Oculto no perfil público')
    : 'Telefone não informado';
  container.innerHTML = [
    '<div class="profile-section-grid">',
      '<article class="profile-section-card">',
        '<div class="profile-section-head"><div><p class="app-eyebrow">Sobre</p><h3>Resumo do membro</h3></div><i class="fas fa-id-card"></i></div>',
        profile.bio ? '<p class="profile-bio-text">' + escapeHtml(profile.bio) + '</p>' : '<p class="profile-muted-box">Adicione uma bio curta para apresentar sua caminhada à igreja.</p>',
        '<div class="profile-info-list">',
          profile.favorite_verse ? profileInfoItem('Versículo favorito', profile.favorite_verse, 'fa-book-bible') : '',
          profile.ministry ? profileInfoItem('Ministério/função', profile.ministry, 'fa-hands-praying') : '',
          instagram ? profileInfoItem('Instagram', instagram, 'fa-instagram', true) : '',
          profile.phone ? profileInfoItem('Telefone privado', profile.phone + ' · ' + phoneState, 'fa-phone') : profileInfoItem('Telefone', phoneState, 'fa-phone'),
        '</div>',
      '</article>',
      '<article class="profile-section-card">',
        '<div class="profile-section-head"><div><p class="app-eyebrow">Identidade pública</p><h3>Como você aparece</h3></div><i class="fas fa-users"></i></div>',
        '<div class="profile-privacy-stack">',
          privacyStatusLine('Perfil público', profile.show_public_profile !== false, 'Ativo', 'Inativo'),
          privacyStatusLine('Ranking', profile.show_in_ranking !== false, 'Aparece', 'Oculto'),
          privacyStatusLine('Telefone', profile.show_phone === true, 'Público', 'Oculto'),
        '</div>',
        '<button onclick="openEditProfileModal()" class="profile-inline-action"><i class="fas fa-sliders"></i> Editar preferências</button>',
      '</article>',
    '</div>'
  ].join('');
}

function profileInfoItem(label, value, icon, brand) {
  return '<div class="profile-info-item"><i class="' + (brand ? 'fab' : 'fas') + ' ' + icon + '"></i><div><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div></div>';
}

function privacyStatusLine(label, active, activeText, inactiveText) {
  return '<div class="profile-privacy-card"><span>' + escapeHtml(label) + '</span><strong class="' + (active ? 'is-on' : 'is-off') + '">' + escapeHtml(active ? activeText : inactiveText) + '</strong></div>';
}

async function renderProfileJourneyTab(container, userInfo) {
  container.innerHTML = '<div class="profile-section-card"><p class="text-sm text-gray-500">Carregando jornada...</p></div>';
  try {
    const result = await window.supabaseClient
      .from('spiritual_progress')
      .select('*')
      .eq('user_id', userInfo.user.id)
      .maybeSingle();
    const progress = result && !result.error && result.data ? result.data : {};
    const level = publicProfileLevelInfo(progress.xp || 0);
    const medals = publicProfileMedals(progress).slice(0, 6);
    container.innerHTML = [
      '<div class="profile-section-card">',
        '<div class="profile-section-head"><div><p class="app-eyebrow">Minha Caminhada</p><h3>Nível ' + level.level + ' · ' + escapeHtml(level.title) + '</h3></div><i class="fas fa-seedling"></i></div>',
        '<div class="profile-stat-grid">',
          profileStatCard('XP', progress.xp || 0, 'fa-bolt'),
          profileStatCard('Pontos', progress.total_points || 0, 'fa-star'),
          profileStatCard('Sequência', (progress.streak_days || 0) + ' dias', 'fa-fire'),
        '</div>',
        medals.length ? '<div class="profile-medal-row">' + medals.map(function(medal) { return '<span><i class="fas ' + escapeHtml(medal.icon) + '"></i>' + escapeHtml(medal.title) + '</span>'; }).join('') + '</div>' : '<p class="profile-muted-box">Suas medalhas principais aparecerão aqui.</p>',
        '<button onclick="navigateTo(&quot;ranking&quot;)" class="profile-inline-action"><i class="fas fa-ranking-star"></i> Ver jornada completa</button>',
      '</div>'
    ].join('');
  } catch (error) {
    container.innerHTML = '<div class="profile-section-card"><p class="profile-muted-box">Sua jornada aparecerá aqui quando estiver disponível.</p></div>';
  }
}

function profileStatCard(label, value, icon) {
  return '<div><i class="fas ' + icon + '"></i><strong>' + escapeHtml(value) + '</strong><span>' + escapeHtml(label) + '</span></div>';
}

async function renderProfileCertificatesTab(container, userInfo) {
  container.innerHTML = '<div class="profile-section-card"><p class="text-sm text-gray-500">Carregando certificados...</p></div>';
  try {
    const certificates = typeof ADPEL !== 'undefined' && ADPEL.fetch && ADPEL.fetch.certificates
      ? await ADPEL.fetch.certificates()
      : [];
    if (!certificates || !certificates.length) {
      container.innerHTML = '<div class="profile-section-card text-center"><div class="profile-empty-icon"><i class="fas fa-certificate"></i></div><h3>Seus certificados aparecerão aqui.</h3><p class="text-sm text-gray-500 mt-2">Ao concluir cursos, seus certificados ficam reunidos nesta aba.</p></div>';
      return;
    }
    container.innerHTML = '<div class="profile-section-card"><div class="profile-section-head"><div><p class="app-eyebrow">Conquistas acadêmicas</p><h3>Certificados</h3></div><i class="fas fa-certificate"></i></div><div class="profile-certificate-list">' + certificates.map(profileCertificateItem).join('') + '</div></div>';
  } catch (error) {
    container.innerHTML = '<div class="profile-section-card text-center"><div class="profile-empty-icon"><i class="fas fa-certificate"></i></div><h3>Seus certificados aparecerão aqui.</h3><p class="text-sm text-gray-500 mt-2">Não foi possível carregar agora.</p></div>';
  }
}

function profileCertificateItem(cert) {
  const title = cert.title || 'Certificado';
  const date = formatDate(cert.completed_at || cert.issued_at || cert.created_at || '');
  return [
    '<div class="profile-certificate-item">',
      '<div><strong>' + escapeHtml(title) + '</strong><span>' + escapeHtml(date || 'Data não informada') + '</span></div>',
      '<a href="certificate-print.html?id=' + encodeURIComponent(cert.id) + '" target="_blank" rel="noopener"><i class="fas fa-print"></i> Visualizar</a>',
    '</div>'
  ].join('');
}

function renderProfilePrivacyTab(container, userInfo) {
  const profile = userInfo.profile || {};
  container.innerHTML = [
    '<div class="profile-section-card">',
      '<div class="profile-section-head"><div><p class="app-eyebrow">Privacidade</p><h3>Preferências de exposição</h3></div><i class="fas fa-shield-halved"></i></div>',
      '<div class="profile-privacy-stack">',
        privacyStatusLine('Perfil público', profile.show_public_profile !== false, 'Ativo', 'Inativo'),
        privacyStatusLine('Aparecer no ranking', profile.show_in_ranking !== false, 'Ativo', 'Oculto'),
        privacyStatusLine('Telefone no perfil público', profile.show_phone === true, 'Visível', 'Oculto'),
      '</div>',
      '<p class="profile-muted-box">Seu email nunca aparece no perfil público. O telefone só aparece se você permitir.</p>',
      '<button onclick="openEditProfileModal()" class="profile-inline-action"><i class="fas fa-pen"></i> Editar preferências</button>',
    '</div>'
  ].join('');
}

function ensureProfileModal(id) {
  let modal = document.getElementById(id);
  if (!modal) {
    modal = document.createElement('div');
    modal.id = id;
    modal.className = 'hidden fixed inset-0 z-[80] items-start sm:items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto p-4';
    document.body.appendChild(modal);
  }
  return modal;
}

function checkedAttr(value, fallback) {
  const resolved = value == null ? fallback : value;
  return resolved !== false ? 'checked' : '';
}

function profileField(id, label, value, type) {
  return '<div><label class="block text-sm font-bold text-gray-700 mb-1">' + escapeHtml(label) + '</label><input id="' + id + '" type="' + type + '" value="' + escapeHtml(value) + '" class="w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"></div>';
}

function profileTextarea(id, label, value, rows) {
  return '<label class="block text-sm font-bold text-gray-700 mb-1">' + escapeHtml(label) + '</label><textarea id="' + id + '" rows="' + rows + '" maxlength="320" class="w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-y">' + escapeHtml(value) + '</textarea><p class="text-xs text-gray-500 mt-1">Até 320 caracteres.</p>';
}

function profileCheckbox(id, label, checked) {
  return '<label class="flex items-start gap-3 rounded-xl bg-gray-50 border border-gray-100 p-3 text-sm text-gray-700"><input id="' + id + '" type="checkbox" ' + checked + ' class="mt-1 rounded text-blue-600 focus:ring-blue-500"><span>' + escapeHtml(label) + '</span></label>';
}

function openEditProfileModal() {
  const userInfo = getCurrentUserInfo();
  if (!userInfo || !userInfo.isLoggedIn || !userInfo.user) {
    showToast('Faça login para editar seu perfil.', 'warning');
    return;
  }
  const profile = userInfo.profile || {};
  selectedAvatarFile = null;
  selectedAvatarPreviewUrl = profile.avatar_url || '';
  const modal = ensureProfileModal('edit-profile-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  modal.innerHTML = [
    '<div class="profile-edit-modal bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden my-4">',
      '<div class="profile-edit-header">',
        '<div class="flex items-start justify-between gap-4">',
          '<div><h3 class="text-2xl font-bold">Editar perfil</h3><p class="text-blue-100 text-sm mt-1">Atualize sua bio pública e preferências de privacidade.</p></div>',
          '<button onclick="closeEditProfileModal()" class="w-11 h-11 rounded-xl bg-white/10 hover:bg-white/20 min-h-[44px]"><i class="fas fa-times"></i></button>',
        '</div>',
      '</div>',
      '<form onsubmit="handleProfileSubmit(event)" class="profile-edit-form">',
        '<section class="profile-edit-block">',
          '<h4>Foto e nome</h4>',
          '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">',
            profileField('profile-public-name', 'Nome público', profile.public_name || profile.full_name || '', 'text'),
          '</div>',
          '<div class="flex flex-col sm:flex-row sm:items-center gap-4">',
            '<div id="avatar-preview" class="w-24 h-24 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center overflow-hidden shrink-0 text-2xl font-bold">',
              profile.avatar_url ? '<img src="' + escapeHtml(profile.avatar_url) + '" alt="Avatar atual" class="w-full h-full object-cover">' : '<i class="fas fa-user"></i>',
            '</div>',
            '<div class="flex-1 min-w-0">',
              '<label class="block text-sm font-bold text-gray-700 mb-2">Foto do perfil</label>',
              '<input id="profile-avatar-file" type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onchange="handleAvatarFileChange(event)" class="w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white">',
              '<p class="text-xs text-gray-500 mt-2">Use uma foto clara. Ela poderá aparecer no ranking e na sua BIO pública. JPG, PNG ou WEBP até 2MB.</p>',
            '</div>',
          '</div>',
        '</section>',
        '<section class="profile-edit-block">',
          '<h4>Sobre mim</h4>',
          profileTextarea('profile-bio', 'Bio curta', profile.bio || '', 3),
          '<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">',
            profileField('profile-favorite-verse', 'Versículo favorito', profile.favorite_verse || '', 'text'),
            profileField('profile-ministry', 'Ministério/função', profile.ministry || '', 'text'),
          '</div>',
        '</section>',
        '<section class="profile-edit-block">',
          '<h4>Contato</h4>',
          '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">',
            profileField('profile-phone', 'Telefone', profile.phone || '', 'tel'),
            profileField('profile-instagram', 'Instagram', profile.instagram || '', 'text'),
          '</div>',
        '</section>',
        '<section class="profile-edit-block">',
          '<h4>Privacidade</h4>',
          '<div class="grid grid-cols-1 gap-3">',
            profileCheckbox('profile-show-phone', 'Mostrar telefone no perfil público', checkedAttr(profile.show_phone, false)),
            profileCheckbox('profile-show-public', 'Mostrar meu perfil público', checkedAttr(profile.show_public_profile, true)),
            profileCheckbox('profile-show-ranking', 'Aparecer no ranking', checkedAttr(profile.show_in_ranking, true)),
          '</div>',
        '</section>',
        '<div class="profile-edit-actions">',
          '<button type="button" onclick="closeEditProfileModal()" class="px-5 py-3 border border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-50 min-h-[44px]">Cancelar</button>',
          '<button type="submit" class="px-5 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 min-h-[44px]"><i class="fas fa-save mr-2"></i>Salvar perfil</button>',
        '</div>',
      '</form>',
    '</div>'
  ].join('');
}

function handleAvatarFileChange(event) {
  const input = event.target;
  const file = input && input.files && input.files[0] ? input.files[0] : null;
  selectedAvatarFile = null;
  if (!file) return;

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const name = String(file.name || '').toLowerCase();
  const validExtension = /\.(jpg|jpeg|png|webp)$/.test(name);
  if (allowedTypes.indexOf(file.type) === -1 || !validExtension) {
    input.value = '';
    showToast('Envie apenas imagens JPG, PNG ou WEBP.', 'warning');
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    input.value = '';
    showToast('A imagem deve ter no maximo 2MB.', 'warning');
    return;
  }

  selectedAvatarFile = file;
  if (selectedAvatarPreviewUrl && selectedAvatarPreviewUrl.indexOf('blob:') === 0) {
    URL.revokeObjectURL(selectedAvatarPreviewUrl);
  }
  selectedAvatarPreviewUrl = URL.createObjectURL(file);
  const preview = document.getElementById('avatar-preview');
  if (preview) {
    preview.innerHTML = '<img src="' + escapeHtml(selectedAvatarPreviewUrl) + '" alt="Preview do avatar" class="w-full h-full object-cover">';
  }
}

function resizeAvatarImage(file) {
  return new Promise(function(resolve, reject) {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = function() {
      URL.revokeObjectURL(url);
      const maxSize = 512;
      let width = image.width;
      let height = image.height;
      if (width > height && width > maxSize) {
        height = Math.round((height * maxSize) / width);
        width = maxSize;
      } else if (height >= width && height > maxSize) {
        width = Math.round((width * maxSize) / height);
        height = maxSize;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0, width, height);

      canvas.toBlob(function(webpBlob) {
        if (!webpBlob) {
          reject(new Error('Não foi possível processar a imagem em WEBP.'));
          return;
        }
        resolve({ blob: webpBlob, extension: 'webp', contentType: 'image/webp' });
      }, 'image/webp', 0.8);
    };
    image.onerror = function() {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível ler a imagem selecionada.'));
    };
    image.src = url;
  });
}

async function uploadProfileAvatar(file, userId) {
  if (!window.supabaseClient || !window.supabaseClient.storage) {
    throw new Error('Supabase Storage indisponível.');
  }
  const resized = await resizeAvatarImage(file);
  if (resized.blob.size > 2 * 1024 * 1024) {
    throw new Error('A imagem processada ficou acima de 2MB.');
  }
  const path = userId + '/avatar.webp';
  const result = await window.supabaseClient.storage
    .from('avatars')
    .upload(path, resized.blob, {
      cacheControl: '3600',
      upsert: true,
      contentType: resized.contentType
    });

  if (result.error) {
    throw result.error;
  }

  return getAvatarPublicUrl(path) + '?v=' + Date.now();
}

function getAvatarPublicUrl(path) {
  const result = window.supabaseClient.storage
    .from('avatars')
    .getPublicUrl(path);
  return result && result.data ? result.data.publicUrl : '';
}

function isAvatarUploadError(error) {
  const text = String(error && (error.message || error.details || error.hint || error.code) || '').toLowerCase();
  return text.indexOf('bucket') !== -1 ||
    text.indexOf('storage') !== -1 ||
    text.indexOf('avatars') !== -1 ||
    text.indexOf('not found') !== -1 ||
    text.indexOf('row-level security') !== -1 ||
    text.indexOf('permission') !== -1 ||
    text.indexOf('unauthorized') !== -1;
}

function closeEditProfileModal() {
  const modal = document.getElementById('edit-profile-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function handleProfileSubmit(event) {
  event.preventDefault();
  const userInfo = getCurrentUserInfo();
  if (!userInfo || !userInfo.isLoggedIn || !userInfo.user || !window.supabaseClient) return;

  const updates = {
    public_name: document.getElementById('profile-public-name').value.trim() || null,
    bio: document.getElementById('profile-bio').value.trim().slice(0, 320) || null,
    avatar_url: (userInfo.profile && userInfo.profile.avatar_url) || null,
    favorite_verse: document.getElementById('profile-favorite-verse').value.trim() || null,
    ministry: document.getElementById('profile-ministry').value.trim() || null,
    phone: document.getElementById('profile-phone').value.trim() || null,
    instagram: document.getElementById('profile-instagram').value.trim() || null,
    show_phone: document.getElementById('profile-show-phone').checked,
    show_public_profile: document.getElementById('profile-show-public').checked,
    show_in_ranking: document.getElementById('profile-show-ranking').checked,
    updated_at: new Date().toISOString()
  };

  try {
    if (selectedAvatarFile) {
      showToast('Enviando foto do perfil...', 'info');
      updates.avatar_url = await uploadProfileAvatar(selectedAvatarFile, userInfo.user.id);
      if (!updates.avatar_url) throw new Error('Não foi possível obter a URL pública do avatar.');
    }

    const result = await window.supabaseClient
      .from('profiles')
      .update(updates)
      .eq('id', userInfo.user.id)
      .select('*')
      .single();
    if (result.error) throw result.error;

    try {
      if (window.supabaseClient.auth && typeof window.supabaseClient.auth.updateUser === 'function') {
        await window.supabaseClient.auth.updateUser({ data: { full_name: updates.public_name || (userInfo.profile && userInfo.profile.full_name) || '' } });
      }
    } catch (metadataError) {
      console.warn('Não foi possível atualizar metadata do usuário:', metadataError);
    }

    userInfo.profile = Object.assign({}, userInfo.profile || {}, result.data || updates);
    if (typeof currentProfile !== 'undefined') currentProfile = userInfo.profile;
    closeEditProfileModal();
    selectedAvatarFile = null;
    renderProfile(userInfo);
    renderProfileTabContent(currentProfileTab || 'summary');
    showToast('Perfil atualizado com sucesso!', 'success');
  } catch (error) {
    console.error('Erro ao salvar perfil:', error);
    if (isProfileSchemaError(error)) {
      showToast('Execute o SQL de perfil público no Supabase antes de salvar estes campos.', 'warning');
    } else if (isAvatarUploadError(error)) {
      showToast('Não foi possível enviar a foto. Crie o bucket público "avatars" no Supabase Storage e confira as permissões.', 'warning');
    } else {
      showToast('Erro ao salvar perfil. Tente novamente.', 'error');
    }
  }
}

function publicProfileLevelInfo(xp) {
  const levels = window.ADPELJourney && window.ADPELJourney.LEVELS ? window.ADPELJourney.LEVELS : [
    { level: 1, title: 'Discípulo', minXp: 0 }
  ];
  const safeXp = Number(xp) || 0;
  let current = levels[0];
  for (let i = 0; i < levels.length; i++) {
    if (safeXp >= levels[i].minXp) current = levels[i];
  }
  return current;
}

function publicProfileMedals(progress) {
  const medals = window.ADPELJourney && window.ADPELJourney.MEDALS ? window.ADPELJourney.MEDALS : [];
  return medals.filter(function(medal) {
    try { return medal.earned(progress || {}); } catch (e) { return false; }
  }).slice(0, 4);
}

function openPublicProfile(userId) {
  const modal = ensureProfileModal('public-profile-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  modal.innerHTML = '<div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 my-4 text-center"><p class="text-gray-500">Carregando perfil...</p></div>';
  loadPublicProfile(userId);
}

function closePublicProfile() {
  const modal = document.getElementById('public-profile-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function loadPublicProfile(userId) {
  const modal = ensureProfileModal('public-profile-modal');
  if (!userId || !window.supabaseClient) {
    modal.innerHTML = publicProfileMessage('Perfil indisponível', 'Não foi possível identificar este membro.');
    return;
  }

  try {
    let profileResult = await window.supabaseClient
      .from('profiles')
        .select('id, full_name, public_name, bio, avatar_url, photo_url, favorite_verse, ministry, phone, instagram, show_phone, show_public_profile')
      .eq('id', userId)
      .single();
    if (profileResult.error && isProfileSchemaError(profileResult.error)) {
      profileResult = await window.supabaseClient
        .from('profiles')
        .select('id, full_name, public_name, bio, avatar_url, favorite_verse, ministry, phone, instagram, show_phone, show_public_profile')
        .eq('id', userId)
        .single();
      if (profileResult.error && isProfileSchemaError(profileResult.error)) {
        profileResult = await window.supabaseClient
          .from('profiles')
          .select('id, full_name, photo_url')
          .eq('id', userId)
          .single();
      }
      if (profileResult.error && isProfileSchemaError(profileResult.error)) {
        profileResult = await window.supabaseClient
          .from('profiles')
          .select('id, full_name')
          .eq('id', userId)
          .single();
      }
    }
    if (profileResult.error) throw profileResult.error;

    const progressResult = await window.supabaseClient
      .from('spiritual_progress')
      .select('*')
      .eq('user_id', userId)
      .single();

    renderPublicProfile(profileResult.data || {}, progressResult.error ? null : progressResult.data);
  } catch (error) {
    console.error('Erro ao carregar perfil público:', error);
    modal.innerHTML = publicProfileMessage('Perfil não encontrado', 'Não foi possível carregar os dados deste membro.');
  }
}

function publicProfileMessage(title, message) {
  return [
    '<div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden my-4">',
      '<div class="p-6 text-right"><button onclick="closePublicProfile()" class="w-11 h-11 rounded-xl bg-gray-100 text-gray-700 min-h-[44px]"><i class="fas fa-times"></i></button></div>',
      '<div class="px-6 pb-8 text-center">',
        '<div class="w-16 h-16 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-4"><i class="fas fa-lock text-2xl"></i></div>',
        '<h3 class="text-xl font-bold text-gray-900">' + escapeHtml(title) + '</h3>',
        '<p class="text-gray-500 mt-2">' + escapeHtml(message) + '</p>',
      '</div>',
    '</div>'
  ].join('');
}

function renderPublicProfile(profile, progress) {
  const modal = ensureProfileModal('public-profile-modal');
  if (profile.show_public_profile === false) {
    modal.innerHTML = publicProfileMessage('Perfil privado', 'Este membro optou por manter o perfil privado.');
    return;
  }

  const safeProgress = progress || {};
  const name = profile.public_name || profile.full_name || safeProgress.user_name || 'Membro';
  const avatar = profile.avatar_url || profile.photo_url || safeProgress.avatar || '';
  const level = publicProfileLevelInfo(safeProgress.xp);
  const medals = publicProfileMedals(safeProgress);
  const initials = String(name).trim().charAt(0).toUpperCase();
  const instagram = normalizeInstagram(profile.instagram || '');

  modal.innerHTML = [
    '<div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden my-4 max-h-[92vh] overflow-y-auto">',
      '<div class="bg-gradient-to-r from-blue-800 via-blue-700 to-emerald-600 p-6 text-white relative">',
        '<button onclick="closePublicProfile()" class="absolute top-4 right-4 w-11 h-11 rounded-xl bg-white/10 hover:bg-white/20 min-h-[44px]"><i class="fas fa-times"></i></button>',
        '<div class="flex flex-col items-center text-center pt-4">',
          '<div class="w-28 h-28 rounded-full bg-white/15 border-4 border-white/30 flex items-center justify-center overflow-hidden text-4xl font-bold">',
            avatar ? '<img src="' + escapeHtml(avatar) + '" alt="' + escapeHtml(name) + '" class="w-full h-full object-cover">' : escapeHtml(initials),
          '</div>',
          '<h3 class="text-2xl font-bold mt-4">' + escapeHtml(name) + '</h3>',
          '<p class="text-blue-100 text-sm mt-1">Nível ' + level.level + ' - ' + escapeHtml(level.title) + '</p>',
        '</div>',
      '</div>',
      '<div class="p-6 space-y-4">',
        '<div class="grid grid-cols-3 gap-3 text-center">',
          publicStat('XP', safeProgress.xp || 0),
          publicStat('Pontos', safeProgress.total_points || 0),
          publicStat('Sequência', (safeProgress.streak_days || 0) + 'd'),
        '</div>',
        profile.bio ? '<div class="bg-gray-50 rounded-xl p-4"><p class="text-sm text-gray-700 leading-relaxed">' + escapeHtml(profile.bio) + '</p></div>' : '',
        profile.favorite_verse ? '<div class="bg-blue-50 border border-blue-100 rounded-xl p-4"><p class="text-xs font-bold text-blue-700 uppercase mb-1">Versiculo favorito</p><p class="font-semibold text-gray-800">' + escapeHtml(profile.favorite_verse) + '</p></div>' : '',
        '<div class="flex flex-wrap gap-2">',
          profile.ministry ? '<span class="px-3 py-1 rounded-full bg-green-50 text-green-700 text-sm font-bold"><i class="fas fa-hands-praying mr-1"></i>' + escapeHtml(profile.ministry) + '</span>' : '',
          instagram ? '<span class="px-3 py-1 rounded-full bg-pink-50 text-pink-700 text-sm font-bold"><i class="fab fa-instagram mr-1"></i>' + escapeHtml(instagram) + '</span>' : '',
          profile.show_phone === true && profile.phone ? '<span class="px-3 py-1 rounded-full bg-gray-50 text-gray-700 text-sm font-bold"><i class="fas fa-phone mr-1"></i>' + escapeHtml(profile.phone) + '</span>' : '',
        '</div>',
        medals.length ? '<div><h4 class="font-bold text-gray-800 mb-2">Medalhas</h4><div class="grid grid-cols-2 gap-2">' + medals.map(function(medal) { return '<div class="bg-yellow-50 border border-yellow-100 rounded-xl p-3 text-sm font-bold text-yellow-800"><i class="fas ' + escapeHtml(medal.icon) + ' mr-1"></i>' + escapeHtml(medal.title) + '</div>'; }).join('') + '</div></div>' : '',
      '</div>',
    '</div>'
  ].join('');
}

function publicStat(label, value) {
  return '<div class="bg-gray-50 rounded-xl p-3"><p class="text-xl font-bold text-gray-900">' + escapeHtml(value) + '</p><p class="text-xs text-gray-500">' + escapeHtml(label) + '</p></div>';
}

async function renderProfileOfferings(userInfo) {
  const container = document.getElementById('profile-offerings-content');
  if (!container) return;
  if (!userInfo || !userInfo.isLoggedIn || !userInfo.user || !window.supabaseClient) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '<div class="profile-section-card"><p class="text-sm text-gray-500">Carregando contribuições...</p></div>';
  try {
    let result = await window.supabaseClient
      .from('fundraising_contributions')
      .select('*, fundraising_goals(name)')
      .eq('user_id', userInfo.user.id)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false })
      .limit(100);
    if (result.error && isOfferingSchemaError(result.error)) {
      result = await window.supabaseClient
        .from('fundraising_contributions')
        .select('*, fundraising_goals(name)')
        .eq('user_id', userInfo.user.id)
        .order('created_at', { ascending: false })
        .limit(100);
    }
    if (result.error) throw result.error;

    const offerings = result.data || [];
    const now = new Date();
    const startWeek = new Date(now);
    startWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    startWeek.setHours(0, 0, 0, 0);
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startYear = new Date(now.getFullYear(), 0, 1);
    const sumSince = (date) => offerings.reduce((total, item) => {
      const created = new Date(item.paid_at || item.created_at || 0);
      return created >= date ? total + Number(item.amount || 0) : total;
    }, 0);
    const total = offerings.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const goalNames = Array.from(new Set(offerings
      .filter(item => item.goal_id)
      .map(item => item.fundraising_goals && item.fundraising_goals.name ? item.fundraising_goals.name : 'Cofre')));
    const latest = offerings.slice(0, 5);

    container.innerHTML = [
      '<div class="profile-section-card profile-offering-card">',
        '<div class="profile-offering-head">',
          '<div>',
            '<p class="app-eyebrow">Contribuições</p>',
            '<h3><i class="fas fa-heart"></i> Minhas ofertas</h3>',
            '<p>Seu histórico de contribuições confirmadas.</p>',
          '</div>',
          '<button onclick="openOfferingReportModal()" class="profile-inline-action"><i class="fas fa-file-lines"></i> Relatório</button>',
        '</div>',
        '<div class="profile-offering-metrics">',
          offeringMetricCard('Esta semana', sumSince(startWeek), 'fa-heart'),
          offeringMetricCard('Este mês', sumSince(startMonth), 'fa-calendar-days'),
          offeringMetricCard('Este ano', sumSince(startYear), 'fa-seedling'),
          offeringMetricCard('Total geral', total, 'fa-hands-praying'),
        '</div>',
        '<div class="profile-stat-grid mt-4">',
          profileStatCard('Ofertas', offerings.length, 'fa-receipt'),
          profileStatCard('Cofres ajudados', goalNames.length, 'fa-vault'),
          profileStatCard('Total ofertado', 'R$ ' + formatBRL(total), 'fa-hand-holding-heart'),
        '</div>',
        '<div class="profile-offering-list">',
          '<h4>Últimas ofertas</h4>',
          latest.length ? latest.map(offeringHistoryItem).join('') : '<p class="profile-muted-box">Nenhuma oferta confirmada ainda.</p>',
        '</div>',
        '<div class="profile-offering-list">',
          '<h4>Cofres ajudados</h4>',
          goalNames.length ? '<div class="profile-chip-row">' + goalNames.map(name => '<span>' + escapeHtml(name) + '</span>').join('') + '</div>' : '<p class="profile-muted-box">Nenhum cofre ajudado ainda.</p>',
        '</div>',
      '</div>'
    ].join('');

    window.ADPELOfferingReportData = { userInfo: userInfo, offerings: offerings, total: total, goalNames: goalNames };
  } catch (error) {
    console.error('Erro ao carregar ofertas do perfil:', error);
    container.innerHTML = '<div class="profile-section-card"><p class="profile-muted-box">Não foi possível carregar suas ofertas agora.</p></div>';
  }
}

function offeringMetricCard(label, value, icon) {
  return '<div class="profile-offering-metric"><div><i class="fas ' + icon + '"></i>' + escapeHtml(label) + '</div><strong>R$ ' + formatBRL(value) + '</strong></div>';
}

function offeringHistoryItem(item) {
  const goal = item.fundraising_goals && item.fundraising_goals.name ? item.fundraising_goals.name : 'Oferta Livre';
  const date = formatDate(item.paid_at || item.created_at || '');
  return '<div class="profile-offering-row"><div><strong>' + escapeHtml(goal) + '</strong><span>' + escapeHtml(date) + '</span></div><p>R$ ' + formatBRL(item.amount) + '</p></div>';
}

function openOfferingReportModal() {
  const data = window.ADPELOfferingReportData;
  if (!data) return;
  const name = escapeHtml((data.userInfo.profile && (data.userInfo.profile.public_name || data.userInfo.profile.full_name)) || (data.userInfo.user && data.userInfo.user.email) || 'Membro');
  const modalId = 'offering-report-modal';
  let modal = document.getElementById(modalId);
  if (!modal) {
    modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4';
    document.body.appendChild(modal);
  }
  modal.innerHTML = [
    '<div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">',
      '<div class="bg-gradient-to-r from-green-700 to-emerald-500 p-6 text-white">',
        '<h3 class="text-2xl font-bold flex items-center gap-2"><i class="fas fa-file-lines"></i> Relatório de ofertas</h3>',
        '<p class="text-green-100 text-sm mt-1">Resumo das suas contribuições confirmadas.</p>',
      '</div>',
      '<div class="p-6 space-y-4" id="offering-report-print-area">',
        '<div><p class="text-xs text-gray-500">Nome</p><p class="font-bold text-gray-900">' + name + '</p></div>',
        '<div><p class="text-xs text-gray-500">Periodo</p><p class="font-bold text-gray-900">Historico disponivel</p></div>',
        '<div class="grid grid-cols-2 gap-3">',
          '<div class="bg-gray-50 rounded-xl p-4"><p class="text-xs text-gray-500">Total ofertado</p><p class="text-xl font-bold text-green-700">R$ ' + formatBRL(data.total) + '</p></div>',
          '<div class="bg-gray-50 rounded-xl p-4"><p class="text-xs text-gray-500">Quantidade</p><p class="text-xl font-bold text-gray-900">' + data.offerings.length + '</p></div>',
        '</div>',
        '<div><p class="text-xs text-gray-500">Cofres ajudados</p><p class="font-bold text-gray-900">' + (data.goalNames.length ? escapeHtml(data.goalNames.join(', ')) : 'Nenhum cofre destinado') + '</p></div>',
        '<p class="text-sm text-gray-600 bg-green-50 border border-green-100 rounded-xl p-4">Suas contribuições ajudam a manter a obra, fortalecer famílias e expandir o Reino de Deus.</p>',
      '</div>',
      '<div class="px-6 pb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">',
        '<button onclick="printOfferingReport()" class="py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition min-h-[44px]"><i class="fas fa-print mr-2"></i>Imprimir / Salvar PDF</button>',
        '<button onclick="closeOfferingReportModal()" class="py-3 border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition min-h-[44px]">Fechar</button>',
      '</div>',
    '</div>'
  ].join('');
  restorePageScroll();
}

function closeOfferingReportModal() {
  const modal = document.getElementById('offering-report-modal');
  if (modal) modal.remove();
  restorePageScroll();
}

function printOfferingReport() {
  window.print();
}

Object.assign(window, {
  loadProfileData,
  renderProfile,
  setProfileTab,
  renderProfileTabContent,
  renderProfileOfferings,
  offeringMetricCard,
  offeringHistoryItem,
  openOfferingReportModal,
  closeOfferingReportModal,
  printOfferingReport,
  openEditProfileModal,
  closeEditProfileModal,
  handleAvatarFileChange,
  resizeAvatarImage,
  uploadProfileAvatar,
  getAvatarPublicUrl,
  handleProfileSubmit,
  openPublicProfile,
  closePublicProfile,
  loadPublicProfile,
  renderPublicProfile
});
