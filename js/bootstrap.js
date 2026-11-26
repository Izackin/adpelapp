window.openModal = function(modalId) {
      var modal = document.getElementById(modalId);
      if (!modal) return;

      modal.classList.remove('hidden');
      modal.classList.add('flex');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-open');
    };
    window.closeModal = function(modalId) {
      var modal = document.getElementById(modalId);
      if (!modal) return;

      modal.classList.add('hidden');
      modal.classList.remove('flex');
      modal.setAttribute('aria-hidden', 'true');
      if (modalId === 'login-modal' || modalId === 'register-modal') resetAuthPasswordVisibility(modal);

      var anotherModalOpen = document.querySelector('#login-modal:not(.hidden), #register-modal:not(.hidden)');
      if (!anotherModalOpen) document.body.classList.remove('modal-open');
    };
    window.toggleSidebar = function() {
      var sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.toggle('hidden');
    };
    window.showToast = function(message, type) {
      if (typeof window._showToast === 'function') {
        window._showToast(message, type);
      } else {
        alert(message);
      }
    };
    window.openLogin = function() {
      var modal = document.getElementById('login-modal');
      if (modal) {
        // Mover para filho direto do body (escapa containers limitadores)
        if (modal.parentElement !== document.body) {
          document.body.appendChild(modal);
        }
        window.openModal('login-modal');
        window.setTimeout(function() {
          var firstInput = document.getElementById('login-email');
          if (firstInput) firstInput.focus();
        }, 50);
      } else {
        console.error('❌ Modal #login-modal não encontrado');
      }
    };
    window.showRegisterModal = function(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }

      var registerModal = document.getElementById('register-modal');

      if (!registerModal) {
        console.error('Modal #register-modal não encontrado');
        return;
      }

      if (registerModal.parentElement !== document.body) {
        document.body.appendChild(registerModal);
      }

      window.closeModal('login-modal');
      window.openModal('register-modal');

      window.setTimeout(function() {
        var firstInput = document.getElementById('register-name');
        if (firstInput) firstInput.focus();
      }, 50);
    };
    window.showLoginModal = function(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }

      window.closeModal('register-modal');
      window.openModal('login-modal');

      var firstInput = document.getElementById('login-email');
      if (firstInput) window.setTimeout(function() { firstInput.focus(); }, 50);
    };
    var authLoginBusy = false;
    window.toggleAuthPassword = function(id, button) {
      if (!['login-password','register-password','register-confirm'].includes(id)) return;
      var input = document.getElementById(id);
      if (!input || !button) return;
      var visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(visible));
      button.setAttribute('aria-label', visible ? 'Ocultar senha' : 'Mostrar senha');
      var icon = button.querySelector('i');
      if (icon) icon.className = visible ? 'fas fa-eye-slash' : 'fas fa-eye';
    };
    function resetAuthPasswordVisibility(modal) {
      if (!modal || !modal.querySelectorAll) return;
      modal.querySelectorAll('.auth-password-toggle').forEach(function(button) {
        var input = document.getElementById(button.getAttribute('aria-controls'));
        if (input && input.type === 'text') window.toggleAuthPassword(input.id, button);
      });
    }
    window.login = async function() {
      if (authLoginBusy) return;
      var email = (document.getElementById('login-email')?.value || '').trim();
      // Passwords are opaque: never remove literal substrings or trim them.
      var password = document.getElementById('login-password')?.value || '';
      var button = document.getElementById('login-submit-btn');
      var message = document.getElementById('login-message-area');
      function errorText(text) {
        if (message) {
          message.textContent = text;
          message.className = 'auth-login-message text-sm p-3 rounded-lg';
        } else if (typeof window.showToast === 'function') window.showToast(text,'error');
      }
      if (!email || !password) { errorText('Preencha seu e-mail e sua senha.'); return; }
      if (!window.supabaseClient) { errorText('Não foi possível conectar. Recarregue a página.'); return; }
      authLoginBusy = true;
      if (button) { button.disabled=true; button.textContent='Entrando…'; }
      if (message) message.classList.add('hidden');
      var success = false;
      try {
        var result = await window.supabaseClient.auth.signInWithPassword({email:email,password:password});
        if (result.error) throw result.error;
        if (!result.data || !result.data.session) throw new Error('Sessão indisponível');
        success = true;
        window.location.reload();
      } catch (error) {
        success = false;
        var code = String(error && error.code || '');
        var detail = String(error && error.message || '').toLowerCase();
        errorText(code === 'email_not_confirmed' || detail.includes('email not confirmed')
          ? 'O servidor exige a confirmação deste e-mail. Fale com a igreja se precisar de ajuda.'
          : code === 'invalid_credentials' || detail.includes('invalid login credentials')
          ? 'E-mail ou senha incorretos. Confira os dados ou recupere sua senha.'
          : Number(error && error.status) === 429
          ? 'Muitas tentativas. Tente novamente em alguns minutos.'
          : 'Não foi possível entrar agora. Verifique sua conexão e tente novamente.');
      } finally {
        if (!success) {
          authLoginBusy=false;
          if (button) { button.disabled=false;button.textContent='Entrar'; }
        }
      }
    };
    // Mover modais para filho direto do body ao carregar
    document.addEventListener('DOMContentLoaded', function() {
      // Login modal
      var loginModal = document.getElementById('login-modal');
      if (loginModal && loginModal.parentElement !== document.body) {
        document.body.appendChild(loginModal);
        console.log('✅ #login-modal movido para filho direto do body');
      }

      var registerModal = document.getElementById('register-modal');
      if (registerModal && registerModal.parentElement !== document.body) {
        document.body.appendChild(registerModal);
        console.log('#register-modal movido para filho direto do body');
      }
      
      // Oferta modal: reestruturar (pix e sucesso para fora de etapa-valor) e mover para body
      var ofertaModal = document.getElementById('oferta-modal');
      if (ofertaModal) {
        var etapaValor = document.getElementById('oferta-etapa-valor');
        var pixContainer = document.getElementById('oferta-pix-container');
        var sucessoContainer = document.getElementById('oferta-sucesso');
        var parentDiv = etapaValor ? etapaValor.parentNode : null;
        
        if (parentDiv && etapaValor) {
          // Mover pix-container para após etapaValor (transforma em sibling)
          if (pixContainer && etapaValor.contains(pixContainer)) {
            parentDiv.insertBefore(pixContainer, etapaValor.nextSibling);
          }
          // Mover sucesso para após pixContainer
          if (sucessoContainer && etapaValor.contains(sucessoContainer)) {
            var refNode = (pixContainer && pixContainer.parentElement === parentDiv)
              ? pixContainer.nextSibling
              : etapaValor.nextSibling;
            parentDiv.insertBefore(sucessoContainer, refNode);
          }
        }
        
        // Mover modal para filho direto do body (escapa containers limitadores)
        if (ofertaModal.parentElement !== document.body) {
          document.body.appendChild(ofertaModal);
        }
        console.log('✅ #oferta-modal reestruturado e movido para filho direto do body');
      }

      if (!window.__adpelAuthModalEventsBound) {
        window.__adpelAuthModalEventsBound = true;
        document.addEventListener('keydown', function(event) {
          if (event.key !== 'Escape') return;
          if (!document.getElementById('login-modal')?.classList.contains('hidden')) window.closeModal('login-modal');
          if (!document.getElementById('register-modal')?.classList.contains('hidden')) window.closeModal('register-modal');
        });
      }
    });
    console.log('✅ Funções globais carregadas (openModal, closeModal, toggleSidebar, login)');
