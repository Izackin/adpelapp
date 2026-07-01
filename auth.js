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
      // Resetar debounce da home para forçar recarregamento com novos dados do usuário
      _lastHomeLoad = 0;
      
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
  const authButtons = document.getElementById('auth-buttons');
  const userMenu = document.getElementById('user-menu');
  const adminLink = document.getElementById('admin-link');
  const adminLinkMobile = document.getElementById('admin-link-mobile');
  
  // Restrito ao email master@adpel.com ou role master
  const isMaster = (currentUser?.email?.toLowerCase() === 'master@adpel.com') || (currentProfile?.role === 'master');
  console.log('🔍 updateAuthUI:', { isLoggedIn, email: currentUser?.email, role: currentProfile?.role, isMaster });
  
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
          console.log('✅ Login OK. isMaster:', getCurrentUserInfo().isMaster);
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
      
      try {
        showLoading(true, 'register');
        const { data, error } = await ADPEL.auth.signUp(email, password, name);
        
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
        
        showLoading(false, 'register');
        closeModal('register-modal');
        showToast('Cadastro realizado com sucesso!', 'success');
        setTimeout(() => openModal('login-modal'), 300);
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
  const userEmail = user?.email ? user.email.toLowerCase() : '';
  const profileRole = profile && profile.role ? profile.role : '';
  const isMaster = (userEmail === 'master@adpel.com') || (profileRole === 'master');
  return {
    user,
    profile,
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