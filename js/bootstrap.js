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
    window.login = async function() {
      var email = (document.getElementById('login-email')?.value || '').replace(/undefined|null/gi, '').trim();
      var password = (document.getElementById('login-password')?.value || '').replace(/undefined|null/gi, '');
      if (!email || !password) {
        alert('Preencha todos os campos.');
        return;
      }
      if (!window.supabaseClient) {
        alert('Cliente não inicializado. Recarregue a página.');
        return;
      }
      try {
        const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
          alert('Erro ao fazer login: ' + (error.message || 'Erro desconhecido'));
          return;
        }
        window.location.reload();
      } catch (e) {
        alert('Erro ao fazer login. Tente novamente.');
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
