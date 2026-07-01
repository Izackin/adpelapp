// utils-notifications.js - Notificações Toast universais
// Variável global para elemento container
let notificationContainer = null;

function ensureNotificationContainer() {
  if (!notificationContainer) {
    notificationContainer = document.getElementById('notification-toast-container');
    if (!notificationContainer) {
      notificationContainer = document.createElement('div');
      notificationContainer.id = 'notification-toast-container';
      notificationContainer.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none';
      document.body.appendChild(notificationContainer);
    }
  }
  return notificationContainer;
}

function showToast(message, type = 'info') {
  ensureNotificationContainer();
  
  const colors = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800'
  };
  
  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    info: 'fa-info-circle',
    warning: 'fa-exclamation-triangle'
  };

  const container = ensureNotificationContainer();
  const toast = document.createElement('div');
  toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${colors[type] || colors.info} animate-fade-in pr-10`;
  toast.innerHTML = `
    <i class="fas ${icons[type] || icons.info} text-lg"></i>
    <p class="text-sm font-medium">${escapeHtml(message)}</p>
    <button onclick="this.parentElement.remove()" class="ml-auto hover:opacity-75"><i class="fas fa-times text-xs"></i></button>
  `;

  container.appendChild(toast);

  // Auto-remove em 5s
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 5000);
}

// Fallback para alert() se container não puder ser criado
if (!window.toast) {
  window.toast = showToast;
  window.alert = (msg) => {
    showToast(msg, 'warning');
  };
}