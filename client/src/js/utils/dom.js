/**
 * Utilidades del DOM, formateo, métricas y sanitización de seguridad
 */

export const $ = (id) => document.getElementById(id);
export const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

/**
 * Escapa caracteres HTML para prevenir inyecciones
 */
export function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

/**
 * Extrae texto plano de un fragmento HTML
 */
export function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  return div.textContent || div.innerText || '';
}

/**
 * Sanitiza HTML eliminando scripts, estilos, iframes y atributos 'on*'
 */
export function sanitizeInternalHtml(raw) {
  const template = document.createElement('template');
  template.innerHTML = raw || '';
  
  // Eliminar etiquetas potencialmente peligrosas
  template.content.querySelectorAll('script, style, iframe, object, embed, link, meta, base').forEach((n) => n.remove());
  
  // Limpiar atributos en línea 'on*'
  template.content.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((attr) => {
      if (/^on/i.test(attr.name) || /javascript:/i.test(attr.value)) {
        el.removeAttribute(attr.name);
      }
    });
    el.removeAttribute('data-bound');
    el.classList.remove('selected');
    if (el.matches('.code-block, .important-callout, .task-widget-block')) {
      el.setAttribute('contenteditable', 'false');
    }
  });

  return template.innerHTML;
}

/**
 * Formatea una marca de tiempo a fecha legible
 */
export function formatDate(timestamp) {
  if (!timestamp) return '';
  try {
    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(timestamp));
  } catch {
    return '';
  }
}

/**
 * Formatea una fecha límite (YYYY-MM-DD)
 */
export function formatDueDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'medium'
    }).format(new Date(dateStr + 'T12:00:00'));
  } catch {
    return dateStr;
  }
}

/**
 * Calcula estadísticas del documento (palabras, caracteres y tiempo de lectura)
 */
export function getDocStats(html) {
  const plain = stripHtml(html).trim();
  if (!plain) {
    return { words: 0, chars: 0, readingTimeMinutes: 0 };
  }
  const words = plain.split(/\s+/).filter(Boolean).length;
  const chars = plain.length;
  const readingTimeMinutes = Math.max(1, Math.ceil(words / 200));
  return { words, chars, readingTimeMinutes };
}

/**
 * Función debounce para limitar frecuencia de guardado
 */
export function debounce(fn, delay = 250) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
