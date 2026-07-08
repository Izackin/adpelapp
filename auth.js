// auth.js - ADPEL Authentication Module v2.0.0

function safeErrorMsg(error) {
  if (!error) return 'Erro desconhecido';
  let msg = '';
  if (typeof error === 'string') {
    msg = error;
  } else if (error.message && typeof error.message === 'string') {
    msg = error.message;
  } else {
    msg = String(error);
  }
  if (!msg || msg === 'undefined' || msg === 'null' || msg === 'undefinednull') {
    return 'Erro ao fazer login';
  }
  msg = msg.replace(/undefinednull/gi, '').replace(/undefined/gi, '').replace(/null/gi, '').trim();
  if (msg.length === 0) return 'Erro ao fazer login';
  return msg;
}

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
});

let currentUser = null;
let currentProfile = null;
let _profileCache = null;
let _profileCacheTime = 0;
const PROFILE_CACHE_TTL = 30000; // 30 segundos

function cleanAuthText(value) {
  return String(value || '').replace(/undefinednull/gi, '').replace(/undefined/gi, '').replace(/\bnull\b/gi, '').trim();
}

function normalizeAuthResult(result) {
  if (!result) return null;
  return result.data && (result.data.user || result.data.session) ? result.data : result;
}

function isProfileColumnError(error) {
  const text = String(error && (error.message || error.details || error.hint || error.code) || '').toLowerCase();
  return text.indexOf('public_name') !== -1 ||
    text.indexOf('favorite_verse') !== -1 ||
    text.indexOf('ministry') !== -1 ||
    text.indexOf('phone') !== -1 ||
    text.indexOf('show_phone') !== -1 ||
    text.indexOf('show_public_profile') !== -1 ||
    text.indexOf('show_in_ranking') !== -1 ||
    text.indexOf('pgrst204') !== -1 ||
    text.indexOf('42703') !== -1;
}

async function upsertUserProfile(user, profileInput) {
  if (!window.supabaseClient || !user || !user.id) return null;
  const metadata = user.user_metadata || {};
  const input = profileInput || {};
  const hasExplicitInput = Object.keys(input).some(function(key) {
    return cleanAuthText(input[key]);
  });
  try {
    const existing = await window.supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (existing.data && !hasExplicitInput) return existing.data;
  } catch (existingError) {}

  const fullName = cleanAuthText(input.full_name || metadata.full_name || user.email || 'Membro');
  const profileData = {
    id: user.id,
    full_name: fullName,
    public_name: cleanAuthText(input.public_name || metadata.public_name || fullName) || null,
    phone: cleanAuthText(input.phone || metadata.phone) || null,
    ministry: cleanAuthText(input.ministry || metadata.ministry) || null,
    favorite_verse: cleanAuthText(input.favorite_verse || metadata.favorite_verse) || null,
    show_phone: false,
    show_public_profile: true,
    show_in_ranking: true,
    updated_at: new Date().toISOString()
  };

  try {
    const result = await window.supabaseClient
      .from('profiles')
      .upsert(profileData, { onConflict: 'id' })
      .select('*')
      .single();
    if (result.error) throw result.error;
    return result.data;
  } catch (error) {
    if (!isProfileColumnError(error)) throw error;
    const fallback = await window.supabaseClient
      .from('profiles')
      .upsert({ id: user.id, full_name: fullName }, { onConflict: 'id' })
      .select('*')
      .single();
    if (fallback.error) throw fallback.error;
    return fallback.data;
  }
}

async function initAuth() {
  // Forçar botão visível imediatamente (será corrigido pela updateAuthUI se necessário)
  var authButtons = document.getElementById('auth-buttons');
  if (authButtons) authButtons.classList.remove('hidden');
  
  // Verificar sessão atual
  try {
    const session = await ADPEL.auth.getSession();
    if (session && session.user) {
      currentUser = session.user;
      try {
        await upsertUserProfile(session.user);
        if (_profileCache && (Date.now() - _profileCacheTime < PROFILE_CACHE_TTL)) {
          currentProfile = _profileCache;
        } else {
          currentProfile = await ADPEL.profile.getProfile();
          _profileCache = currentProfile;
          _profileCacheTime = Date.now();
        }
      } catch (e) {
        console.warn('Perfil não encontrado ou erro ao carregar:', e);
        currentProfile = null;
      }
      updateAuthUI(true);
    } else {
      updateAuthUI(false);
    }
  } catch (e) {
    console.error('Erro ao verificar sessão:', e);
    // Em caso de erro, garantir que o botão fique visível
    updateAuthUI(false);
  }
  
  // Escutar mudanças de autenticação
  ADPEL.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      currentUser = session.user;
      try {
        await upsertUserProfile(session.user);
        currentProfile = await ADPEL.profile.getProfile();
        _profileCache = currentProfile;
        _profileCacheTime = Date.now();
      } catch (e) {
        console.warn('Perfil não encontrado após login:', e);
        currentProfile = null;
      }
      updateAuthUI(true);
      // Atualizar banner de boas-vindas
      if (typeof updateBannerWelcome === 'function') {
        updateBannerWelcome();
      }
      if (window.ADPELJourney && typeof window.ADPELJourney.init === 'function') {
        window.ADPELJourney.init();
      }
      if (typeof loadUserNotifications === 'function') {
        setTimeout(() => loadUserNotifications(), 400);
      }
      if (typeof initPushNotifications === 'function') {
        setTimeout(() => initPushNotifications(), 700);
      }
      // Resetar debounce da home para forçar recarregamento com novos dados do usuário
      _lastHomeLoad = 0;
      if (typeof verificarAtualizacoesPendentes === 'function') {
        setTimeout(() => verificarAtualizacoesPendentes(true), 800);
      }
      
      // Verificar se o email foi confirmado
      if (!session.user.email_confirmed_at && !session.user.confirmed_at) {
        showToast('Por favor, confirme seu email para acessar todos os recursos.', 'warning');
      } else {
        showToast('Login realizado com sucesso!', 'success');
      }
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      currentProfile = null;
      updateAuthUI(false);
      // Atualizar banner de boas-vindas
      if (typeof updateBannerWelcome === 'function') {
        updateBannerWelcome();
      }
      if (window.ADPELJourney && typeof window.ADPELJourney.renderJourneyWidgets === 'function') {
        window.ADPELJourney.renderJourneyWidgets(null);
      }
      if (typeof loadUserNotifications === 'function') {
        loadUserNotifications();
      }
      showToast('Você foi desconectado.', 'info');
    }
  });
  
  // Bind form events
  bindAuthForms();
}

function updateAuthUI(isLoggedIn) {
  // Atualizar banner de boas-vindas
  if (typeof updateBannerWelcome === 'function') {
    setTimeout(() => updateBannerWelcome(), 100);
  }
  if (window.ADPELJourney && typeof window.ADPELJourney.init === 'function') {
    setTimeout(() => window.ADPELJourney.init(), 150);
  }
  const authButtons = document.getElementById('auth-buttons');
  const userMenu = document.getElementById('user-menu');
  const adminLink = document.getElementById('admin-link');
  const adminLinkMobile = document.getElementById('admin-link-mobile');
  
  // Restrito ao perfil com role master.
  const isMaster = typeof isUserMaster === 'function'
    ? isUserMaster({ user: currentUser, profile: currentProfile })
    : currentProfile?.role === 'master';
  if (typeof adpelDebugLog === 'function') adpelDebugLog('updateAuthUI', { isLoggedIn: !!isLoggedIn, isMaster: !!isMaster });
  
  if (isLoggedIn && currentUser) {
    // Só esconde se realmente tiver um usuário logado
    if (authButtons) authButtons.classList.add('hidden');
    if (userMenu) {
      userMenu.classList.remove('hidden');
      const userNameEl = document.getElementById('user-name');
      if (userNameEl) userNameEl.textContent = currentProfile?.full_name || currentUser?.email || 'Usuário';
    }
    if (adminLink) adminLink.classList.toggle('hidden', !isMaster);
    if (adminLinkMobile) adminLinkMobile.classList.toggle('hidden', !isMaster);
  } else {
    // GARANTIR que o botão esteja visível SEMPRE quando não logado
    // (não mexe no onclick, apenas garante visibilidade)
    if (authButtons) {
      authButtons.classList.remove('hidden');
    }
    if (userMenu) userMenu.classList.add('hidden');
    if (adminLink) adminLink.classList.add('hidden');
    if (adminLinkMobile) adminLinkMobile.classList.add('hidden');
  }

  // Re-render seções dinâmicas apenas se necessário (evita fetch duplicado)
  if (isLoggedIn && currentUser) {
    const section = currentSection || 'home';
    if (typeof loadSectionData === 'function') loadSectionData(section);
  }
}

function bindAuthForms() {
  // Login form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      let email = document.getElementById('login-email').value.trim();
      let password = document.getElementById('login-password').value;
      
      // Sanitização contra valores corrompidos (ex: undefinednull)
      if (typeof email === 'string') {
        email = email.replace(/undefined|null/gi, '').trim();
      } else {
        email = '';
      }
      if (typeof password === 'string') {
        password = password.replace(/undefined|null/gi, '');
      } else {
        password = '';
      }
      
      if (!email || !password) {
        showToast('Preencha todos os campos.', 'error');
        return;
      }
      
      try {
        showLoading(true, 'login');
        const msgArea = document.getElementById('login-message-area');
        if (msgArea) msgArea.classList.add('hidden');
        
        const signInResult = await ADPEL.auth.signIn(email, password);
        const data = normalizeAuthResult(signInResult);
        const error = signInResult && signInResult.error;
        
        if (error) {
          showLoading(false, 'login');
          
          // Remove "undefinednull" e lixo do erro
          const errMsg = safeErrorMsg(error);
          
          // Mensagens de erro específicas
          if (errMsg.includes('Invalid login credentials') || errMsg.includes('User not found')) {
            if (msgArea) {
              msgArea.className = 'text-sm text-center p-3 rounded-lg bg-blue-50 text-blue-700 block';
              msgArea.innerHTML = `Este email não possui cadastro ou a senha está incorreta. <button type="button" onclick="closeModal('login-modal');openModal('register-modal')" class="font-bold underline hover:text-blue-900 ml-1">Criar conta</button>`;
            }
            showToast('Email ou senha incorretos. Verifique seus dados.', 'error');
          } else if (errMsg.includes('Email not confirmed')) {
            if (msgArea) {
              msgArea.className = 'text-sm text-center p-3 rounded-lg bg-yellow-50 text-yellow-700 block';
              msgArea.textContent = 'Email ainda não confirmado. Verifique sua caixa de entrada.';
            }
            showToast('Email ainda não confirmado. Verifique sua caixa de entrada.', 'warning');
          } else {
            if (msgArea) {
              msgArea.className = 'text-sm text-center p-3 rounded-lg bg-red-50 text-red-700 block';
              msgArea.textContent = 'Erro ao fazer login: ' + errMsg;
            }
            showToast('Erro ao fazer login: ' + errMsg, 'error');
          }
          
          // Força o modal a continuar visível mesmo se algo o escondeu
          const modal = document.getElementById('login-modal');
          if (modal && modal.classList.contains('hidden')) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
          }
          return;
        }
        
        showLoading(false, 'login');
        closeModal('login-modal');
        
        // Forçar atualização imediata da UI (caso o onAuthStateChange atrase)
        if (data && data.user) {
          currentUser = data.user;
          try {
            currentProfile = await ADPEL.profile.getProfile();
          } catch (e) {
            console.warn('Perfil não encontrado após login:', e);
            currentProfile = null;
          }
          updateAuthUI(true);
          // Atualizar banner de boas-vindas
          if (typeof updateBannerWelcome === 'function') {
            updateBannerWelcome();
          }
          if (typeof initPushNotifications === 'function') {
            setTimeout(() => initPushNotifications(), 700);
          }
          if (typeof adpelDebugLog === 'function') adpelDebugLog('Login OK', { isMaster: getCurrentUserInfo().isMaster });
          // Removido reload — UI já atualiza dinamicamente
        }
      } catch (error) {
        showLoading(false, 'login');
        showToast('Erro ao fazer login. Tente novamente.', 'error');
      }
    });
  }
  
  // Register form
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = cleanAuthText(document.getElementById('register-name').value);
      const publicName = cleanAuthText(document.getElementById('register-public-name')?.value || name);
      const phone = cleanAuthText(document.getElementById('register-phone')?.value || '');
      const ministry = cleanAuthText(document.getElementById('register-ministry')?.value || '');
      const favoriteVerse = cleanAuthText(document.getElementById('register-favorite-verse')?.value || '');
      const email = cleanAuthText(document.getElementById('register-email').value);
      const password = document.getElementById('register-password').value;
      const confirmPassword = document.getElementById('register-confirm').value;
      
      if (!name || !email || !password || !confirmPassword) {
        showToast('Preencha todos os campos.', 'error');
        return;
      }
      
      if (password !== confirmPassword) {
        showToast('As senhas não coincidem.', 'error');
        return;
      }
      
      if (password.length < 6) {
        showToast('A senha deve ter pelo menos 6 caracteres.', 'error');
        return;
      }
      
      // Validação de email básica
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showToast('Digite um email válido.', 'error');
        return;
      }
      
      try {
        showLoading(true, 'register');
        const signUpResult = await ADPEL.auth.signUp(email, password, name, {
          public_name: publicName,
          phone: phone,
          ministry: ministry,
          favorite_verse: favoriteVerse
        });
        const data = normalizeAuthResult(signUpResult);
        const error = signUpResult && signUpResult.error;
        
        if (error) {
          showLoading(false, 'register');
          
          // Mensagens de erro específicas para cadastro
          if (error.message.includes('already registered') || error.message.includes('already exists')) {
            showToast('Este email já está cadastrado. Faça login.', 'info');
          } else if (error.message.includes('Password should be at least')) {
            showToast('A senha precisa ter pelo menos 6 caracteres.', 'error');
          } else {
            showToast('Erro ao registrar: ' + error.message, 'error');
          }
          return;
        }
        
        if (data && data.user) {
          try {
            const createdProfile = await upsertUserProfile(data.user, {
              full_name: name,
              public_name: publicName,
              phone: phone,
              ministry: ministry,
              favorite_verse: favoriteVerse
            });
            if (createdProfile) {
              currentUser = data.user;
              currentProfile = createdProfile;
              _profileCache = createdProfile;
              _profileCacheTime = Date.now();
            }
          } catch (profileError) {
            console.warn('Cadastro criado, mas o perfil será completado no primeiro login:', profileError);
          }
        }

        showLoading(false, 'register');
        closeModal('register-modal');
        showToast(data && data.session ? 'Cadastro realizado com sucesso!' : 'Cadastro realizado! Verifique seu email e faça login.', 'success');
        setTimeout(() => {
          if (data && data.session) {
            updateAuthUI(true);
          } else {
            openModal('login-modal');
          }
        }, 300);
      } catch (error) {
        showLoading(false, 'register');
        showToast('Erro ao registrar. Tente novamente.', 'error');
      }
    });
  }
  
  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await ADPEL.auth.signOut();
        window.location.reload();
      } catch (error) {
        showToast('Erro ao sair: ' + error.message, 'error');
      }
    });
  }
}

// Modal functions (APENAS SE openModal AINDA NÃO EXISTIR)
if (typeof openModal === 'undefined') {
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      document.body.style.overflow = 'hidden';
    }
  }
}

if (typeof closeModal === 'undefined') {
  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      document.body.style.overflow = '';
    }
  }
}



// Loading state
function showLoading(show, formId) {
  const formSelector = formId === 'login' ? '#login-form' : formId === 'register' ? '#register-form' : `#${formId}`;
  const btn = document.querySelector(`${formSelector} button[type="submit"], ${formSelector} #login-submit-btn`);
  const spinner = document.querySelector(`#${formId} .spinner`);
  if (btn) {
    btn.disabled = show;
    btn.innerHTML = show 
      ? '<i class="fas fa-spinner fa-spin mr-2"></i> Aguarde...'
      : (formId === 'login' || formId === 'login-form' ? 'Entrar' : 'Criar Conta');
  }
}

// Get current user info
function getCurrentUserInfo() {
  const user = currentUser || null;
  const profile = currentProfile || null;
  const role = typeof getUserRole === 'function' ? getUserRole({ user, profile }) : String(profile && profile.role ? profile.role : '').toLowerCase();
  const isMaster = typeof isUserMaster === 'function' ? isUserMaster({ user, profile }) : role === 'master';
  return {
    user,
    profile,
    role,
    isLoggedIn: !!user,
    isMaster: isMaster
  };
}

// Password Reset
function toggleResetPassword(show) {
  const box = document.getElementById('reset-password-box');
  const submitBtn = document.getElementById('login-submit-btn');
  const registerText = document.getElementById('login-register-text');
  const msgArea = document.getElementById('login-message-area');
  if (box) box.classList.toggle('hidden', !show);
  if (submitBtn) submitBtn.classList.toggle('hidden', show);
  if (registerText) registerText.classList.toggle('hidden', show);
  if (msgArea && show) msgArea.classList.add('hidden');
}

async function sendPasswordReset() {
  const email = document.getElementById('reset-email')?.value.trim() || document.getElementById('login-email')?.value.trim();
  if (!email) {
    showToast('Digite um email válido.', 'error');
    return;
  }
  try {
    const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.href
    });
    if (error) throw error;
    showToast('Link de redefinição enviado! Verifique sua caixa de entrada.', 'success');
    toggleResetPassword(false);
  } catch (error) {
    showToast('Erro ao enviar link: ' + error.message, 'error');
  }
}
