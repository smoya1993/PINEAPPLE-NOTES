/**
 * Sistema moderno de Notificaciones Toast empresariales no bloqueantes
 */

let toastContainer = null;

function ensureContainer() {
  if (!toastContainer || !document.body.contains(toastContainer)) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.setAttribute('aria-live', 'polite');
    toastContainer.setAttribute('aria-atomic', 'true');
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

/**
 * Muestra una notificación toast
 * @param {string} message 
 * @param {'info'|'success'|'warning'|'error'} type 
 * @param {number} duration en milisegundos (por defecto 3200ms)
 */
export function showToast(message, type = 'info', duration = 3200) {
  const container = ensureContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');

  const icons = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  };

  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <span class="toast-msg">${message}</span>
    <button type="button" class="toast-close" title="Cerrar">&times;</button>
  `;

  const removeToast = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px) scale(0.95)';
    setTimeout(() => toast.remove(), 200);
  };

  toast.querySelector('.toast-close').onclick = removeToast;

  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(removeToast, duration);
  }
}

export const toastSuccess = (msg, d) => showToast(msg, 'success', d);
export const toastInfo = (msg, d) => showToast(msg, 'info', d);
export const toastWarning = (msg, d) => showToast(msg, 'warning', d);
export const toastError = (msg, d) => showToast(msg, 'error', d);
