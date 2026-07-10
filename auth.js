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

function getRegistrationErrorMessage(error) {
  const message = error && typeof error.message === 'string' ? error.message : '';
  const normalizedMessage = message.toLowerCase();
  const code = String(error && error.code ? error.code : '').toLowerCase();
  const status = Number(error && error.status ? error.status : 0);

  if (code === 'user_already_exists' || normalizedMessage.includes('already registered') || normalizedMessage.includes('already exists') || normalizedMessage.includes('already been registered')) {
    return 'Este e-mail já está cadastrado. Faça login ou recupere sua senha.';
  }
  if (code === 'weak_password' || normalizedMessage.includes('password should be at least') || normalizedMessage.includes('weak password')) {
    return 'A senha é muito fraca. Use pelo menos 6 caracteres.';
  }
  if (status === 429 || code.includes('rate_limit') || normalizedMessage.includes('rate limit') || normalizedMessage.includes('too many requests')) {
    return 'Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente.';
  }
  if (code === 'signup_disabled' || normalizedMessage.includes('signups not allowed') || normalizedMessage.includes('signup is disabled') || normalizedMessage.includes('email signups are disabled')) {
    return 'Novos cadastros estão desativados no momento. Entre em contato com a igreja.';
  }
  if (error && (error.name === 'TypeError' || normalizedMessage.includes('failed to fetch') || normalizedMessage.includes('network') || normalizedMessage.includes('load failed'))) {
    return 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.';
  }
  if (normalizedMessage.includes('database error saving new user') || normalizedMessage.includes('profile')) {
    return 'Sua conta não pôde ser concluída porque houve uma falha ao criar o perfil. Tente novamente ou fale com a igreja.';
  }
  if (code === 'unexpected_failure' || status >= 500 || normalizedMessage.includes('database') || normalizedMessage.includes('internal server error')) {
    return 'O servidor encontrou um erro interno. Tente novamente em alguns minutos.';
  }
  return 'Não foi possível realizar o cadastro. Tente novamente.';
}

function isExistingRegistrationResult(data) {
  return !!(
    data &&
    data.user &&
    Array.isArray(data.user.identities) &&
    data.user.identities.length === 0
  );
}

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
});

let currentUser = null;
let currentProfile = null;
let _profileCache = null;
let _profileCacheTime = 0;
const PROFILE_CACHE_TTL = 30000; // 30 segundos

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
        
        const { data, error } = await ADPEL.auth.signIn(email, password);
        
        if (error) {
          showLoading(false, 'login');
          
          // Remove "undefinednull" e lixo do erro
          const errMsg = safeErrorMsg(error);
          
          // Mensagens de erro específicas
          if (errMsg.includes('Invalid login credentials') || errMsg.includes('User not found')) {
            if (msgArea) {
              msgArea.className = 'text-sm text-center p-3 rounded-lg bg-blue-50 text-blue-700 block';
              msgArea.innerHTML = `Este email não possui cadastro ou a senha está incorreta. <button type="button" onclick="showRegisterModal(event)" class="font-bold underline hover:text-blue-900 ml-1">Criar conta</button>`;
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
      if (registerForm.dataset.submitting === 'true') return;

      const name = document.getElementById('register-name').value.trim();
      const email = document.getElementById('register-email').value.trim();
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

      registerForm.dataset.submitting = 'true';
      showLoading(true, 'register-form');

      try {
        const { data, error } = await ADPEL.auth.signUp(email, password, name);

        if (error) {
          console.error('Erro técnico ao cadastrar usuário:', error);
          showToast(getRegistrationErrorMessage(error), 'error');
          return;
        }

        if (!data || !data.user) {
          const invalidResultError = new Error('Supabase signUp retornou sucesso sem usuário.');
          console.error('Resposta técnica inesperada no cadastro:', invalidResultError, data);
          showToast('Não foi possível confirmar a criação da conta. Tente novamente.', 'error');
          return;
        }

        // Com confirmação de e-mail habilitada, o Supabase pode ocultar que o
        // endereço já existe retornando um usuário sem identidades vinculadas.
        if (isExistingRegistrationResult(data)) {
          console.error('Cadastro recusado: e-mail já cadastrado.', { userId: data.user.id });
          showToast('Este e-mail já está cadastrado. Faça login ou recupere sua senha.', 'info');
          return;
        }

        closeModal('register-modal');
        registerForm.reset();

        if (data.session) {
          currentUser = data.user;
          let profileError = null;

          try {
            currentProfile = await ADPEL.profile.getProfile();
            if (!currentProfile) {
              profileError = new Error('Perfil não encontrado após cadastro com sessão ativa.');
            }
          } catch (error) {
            profileError = error;
            currentProfile = null;
          }

          if (profileError) {
            console.error('Falha técnica ao carregar o perfil após o cadastro:', profileError);
          }

          _profileCache = currentProfile;
          _profileCacheTime = Date.now();
          updateAuthUI(true);

          if (profileError) {
            showToast('Conta criada e conectada, mas o perfil não pôde ser carregado. Fale com a igreja.', 'warning');
          } else {
            showToast('Cadastro realizado! Você já está conectado.', 'success');
          }
          return;
        }

        showToast('Cadastro realizado! Confirme seu e-mail antes de entrar.', 'success');
      } catch (error) {
        console.error('Erro técnico inesperado ao cadastrar usuário:', error);
        showToast(getRegistrationErrorMessage(error), 'error');
      } finally {
        registerForm.dataset.submitting = 'false';
        showLoading(false, 'register-form');
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

// Os modais globais são definidos somente em js/bootstrap.js.



// Loading state
function showLoading(show, formId) {
  const btn = document.querySelector(`#${formId} button[type="submit"]`);
  const spinner = document.querySelector(`#${formId} .spinner`);
  if (btn) {
    btn.disabled = show;
    btn.innerHTML = show 
      ? '<i class="fas fa-spinner fa-spin mr-2"></i> Aguarde...'
      : (formId === 'login-form' ? 'Entrar' : 'Criar Conta');
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
