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
  bindAuthForms();
  window.ADPELAuthReady = initAuth();
});

let currentUser = null;
let currentProfile = null;
let _profileCache = null;
let _profileCacheTime = 0;
const PROFILE_CACHE_TTL = 30000; // 30 segundos
let authSessionGeneration=0;
function setAuthSessionUser(user){
  const next=user||null;
  if((currentUser?.id||null)!==(next?.id||null)){
    ++authSessionGeneration;
    currentProfile=null;
    _profileCache=null;
    _profileCacheTime=0;
  }
  currentUser=next;
  return authSessionGeneration;
}
function isAuthSessionCurrent(uid,generation){
  return currentUser?.id===uid && authSessionGeneration===generation;
}
async function refreshAuthProfile(uid,generation,allowCache=false){
  if(!isAuthSessionCurrent(uid,generation))return false;
  let profile=null;
  try{
    profile=allowCache&&_profileCache?.id===uid&&Date.now()-_profileCacheTime<PROFILE_CACHE_TTL
      ?_profileCache:await ADPEL.profile.getProfile();
    if(profile&&profile.id!==uid)throw new Error('Perfil não corresponde à sessão atual.');
  }catch(error){
    console.warn('Não foi possível carregar o perfil:',error);
    profile=null;
  }
  if(!isAuthSessionCurrent(uid,generation))return false;
  currentProfile=profile;
  _profileCache=profile;
  _profileCacheTime=Date.now();
  return true;
}

async function initAuth() {
  // Forçar botão visível imediatamente (será corrigido pela updateAuthUI se necessário)
  var authButtons = document.getElementById('auth-buttons');
  if (authButtons) authButtons.classList.remove('hidden');
  
  // Verificar sessão atual
  try {
    const session = await ADPEL.auth.getSession();
    if (session && session.user) {
      const uid=session.user.id;
      const generation=setAuthSessionUser(session.user);
      if(!await refreshAuthProfile(uid,generation,true))return;
      updateAuthUI(true,{skipSectionLoad:true});
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
      const previousUserId = currentUser && currentUser.id;
      const uid=session.user.id;
      const generation=setAuthSessionUser(session.user);
      if(previousUserId!==uid){
        if(previousUserId&&typeof closeCourseModal==='function')closeCourseModal();
        updateAuthUI(true,{skipSectionLoad:true,skipJourneyInit:true});
        if(previousUserId&&typeof navigateTo==='function'&&typeof currentSection!=='undefined'&&['courses','library','certificate','profile','community','tutor'].includes(currentSection))navigateTo('home');
      }
      if (previousUserId !== currentUser.id && typeof resetAppNotificationSession === 'function') {
        resetAppNotificationSession(currentUser.id);
      }
      if(!await refreshAuthProfile(uid,generation))return;
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
      setAuthSessionUser(null);
      if(typeof closeCourseModal==='function')closeCourseModal();
      if (window.ADPELJourney?.resetSession) window.ADPELJourney.resetSession();
      if (typeof hidePushPermissionPrompt === 'function') {
        hidePushPermissionPrompt(false);
      }
      updateAuthUI(false);
      if(typeof navigateTo==='function' && typeof currentSection!=='undefined' && ['courses','library','certificate','profile','community','tutor'].includes(currentSection))navigateTo('home');
      else if(typeof loadHomeData==='function' && typeof currentSection!=='undefined' && ['home','community-hub'].includes(currentSection))loadHomeData(true);
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
  
  // Form events are bound before session bootstrap.
}

function updateAuthUI(isLoggedIn, options) {
  // Atualizar banner de boas-vindas
  if (typeof updateBannerWelcome === 'function') {
    setTimeout(() => updateBannerWelcome(), 100);
  }
  if (!options?.skipJourneyInit && window.ADPELJourney && typeof window.ADPELJourney.init === 'function') {
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

  if (window.ADPELTutor && typeof window.ADPELTutor.handleAuthChange === 'function') {
    window.ADPELTutor.handleAuthChange(Boolean(isLoggedIn && currentUser));
  }

  // Re-render seções dinâmicas apenas se necessário (evita fetch duplicado)
  if (isLoggedIn && currentUser && !options?.skipSectionLoad) {
    const section = currentSection || 'home';
    if (typeof loadSectionData === 'function') loadSectionData(section);
  }
}

function buildRegistrationDetails(input) {
  let phone = String(input.whatsapp || '').replace(/\D/g, '');
  if ((phone.length === 12 || phone.length === 13) && phone.startsWith('55')) phone = phone.slice(2);
  if (!/^[1-9]\d{9,10}$/.test(phone)) throw new Error('Informe um WhatsApp válido com DDD.');
  if (input.congregation !== 'adpel-santo-andre' || !['membro','visitante'].includes(input.kind)) throw new Error('Selecione a congregação e sua participação.');
  if (!input.privacyAck) throw new Error('Confirme a finalidade do cadastro.');
  let birth = String(input.birthDate || '');
  if (birth) {
    const date = new Date(birth + 'T00:00:00Z');
    const today = new Date();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || isNaN(date.getTime()) || date.toISOString().slice(0,10) !== birth || date > today || date.getUTCFullYear() < today.getUTCFullYear()-120) throw new Error('Informe uma data de nascimento válida.');
  }
  return {registration_version:'1',congregation_slug:input.congregation,declared_type:input.kind,registration_whatsapp:phone,registration_birth_date:birth,registration_privacy_ack:true,registration_contact_allowed:input.contactAllowed===true};
}

function bindAuthForms() {
  // Login form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (typeof window.login === 'function') window.login();
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

      let registration;
      try {
        if (name.length < 2 || name.length > 120) throw new Error('Informe um nome entre 2 e 120 caracteres.');
        registration = buildRegistrationDetails({
          congregation: document.getElementById('register-congregation').value,
          kind: document.getElementById('register-kind').value,
          whatsapp: document.getElementById('register-whatsapp').value,
          birthDate: document.getElementById('register-birth-date').value,
          privacyAck: document.getElementById('register-privacy-ack').checked,
          contactAllowed: document.getElementById('register-contact-allowed').checked
        });
      } catch (error) {
        showToast(error.message,'error');
        return;
      }
      registerForm.dataset.submitting = 'true';
      showLoading(true, 'register-form');

      try {
        const { data, error } = await ADPEL.auth.signUp(email, password, name, registration);

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
          const activeSession=await ADPEL.auth.getSession();
          if(activeSession?.user?.id!==data.user.id)return;
          const generation=setAuthSessionUser(activeSession.user);
          if(!await refreshAuthProfile(data.user.id,generation))return;
          const profileError=!currentProfile;
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
        if (typeof removeCurrentPushSubscription === 'function') {
          try {
            await removeCurrentPushSubscription();
          } catch (pushError) {
            console.warn('Não foi possível remover a inscrição push durante a saída:', pushError);
          }
        }
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
  const profile = currentProfile?.id===user?.id ? currentProfile : null;
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
