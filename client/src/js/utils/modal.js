/**
 * Controlador de diálogos modales accesibles
 */

import { $, esc } from './dom.js';

let activeResolve = null;

/**
 * Muestra un diálogo modal de confirmación
 * @param {string} title 
 * @param {string} message 
 * @param {string} confirmText 
 * @param {boolean} isDanger 
 * @returns {Promise<boolean>}
 */
export function showConfirmModal(title, message, confirmText = 'Confirmar', isDanger = false) {
  return new Promise((resolve) => {
    const bg = $('modalBg');
    const modal = bg.querySelector('.modal');
    
    modal.innerHTML = `
      <h2>${esc(title)}</h2>
      <p id="modalDesc">${esc(message)}</p>
      <div class="actions">
        <button id="modalCancelBtn" class="btn" type="button">Cancelar</button>
        <button id="modalConfirmBtn" class="btn ${isDanger ? 'red' : 'primary'}" type="button">${esc(confirmText)}</button>
      </div>
    `;

    const close = (result) => {
      bg.style.display = 'none';
      document.removeEventListener('keydown', onKeyDown);
      resolve(result);
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') close(false);
    };

    $('modalCancelBtn').onclick = () => close(false);
    $('modalConfirmBtn').onclick = () => close(true);
    bg.onclick = (e) => {
      if (e.target === bg) close(false);
    };

    document.addEventListener('keydown', onKeyDown);
    bg.style.display = 'flex';
    $('modalConfirmBtn').focus();
  });
}

/**
 * Muestra un diálogo modal con campo de entrada
 * @param {string} title 
 * @param {string} label 
 * @param {string} defaultValue 
 * @returns {Promise<string|null>}
 */
export function showPromptModal(title, label, defaultValue = '') {
  return new Promise((resolve) => {
    const bg = $('modalBg');
    const modal = bg.querySelector('.modal');

    modal.innerHTML = `
      <h2>${esc(title)}</h2>
      <div class="modal-body">
        <label for="promptInput" style="font-size:13.5px;color:var(--text-secondary);">${esc(label)}</label>
        <input id="promptInput" class="modal-input" value="${esc(defaultValue)}" autofocus />
      </div>
      <div class="actions">
        <button id="promptCancelBtn" class="btn" type="button">Cancelar</button>
        <button id="promptSubmitBtn" class="btn primary" type="button">Aceptar</button>
      </div>
    `;

    const input = $('promptInput');

    const close = (val) => {
      bg.style.display = 'none';
      document.removeEventListener('keydown', onKeyDown);
      resolve(val);
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') close(null);
      if (e.key === 'Enter') close(input.value);
    };

    $('promptCancelBtn').onclick = () => close(null);
    $('promptSubmitBtn').onclick = () => close(input.value);
    bg.onclick = (e) => {
      if (e.target === bg) close(null);
    };

    document.addEventListener('keydown', onKeyDown);
    bg.style.display = 'flex';
    input.focus();
    input.select();
  });
}

/**
 * Muestra el modal de ayuda con todos los atajos de teclado
 */
export function showShortcutsModal() {
  const bg = $('modalBg');
  const modal = bg.querySelector('.modal');

  modal.innerHTML = `
    <h2>⌨️ Atajos de Teclado Empresariales</h2>
    <div class="modal-body" style="font-size:13px;line-height:1.8;">
      <div style="display:grid;grid-template-columns:140px 1fr;gap:6px;border-bottom:1px solid var(--line);padding-bottom:8px;margin-bottom:8px;">
        <b>Ctrl + S</b> <span>Guardar nota actual en disco</span>
        <b>Ctrl + N</b> <span>Crear nueva nota</span>
        <b>Ctrl + F</b> <span>Foco en buscador de notas</span>
        <b>Ctrl + B</b> <span>Negrita</span>
        <b>Ctrl + I</b> <span>Cursiva</span>
        <b>Ctrl + U</b> <span>Subrayado</span>
        <b>Tab / Shift+Tab</b> <span>Aumentar / reducir sangría en listas o código</span>
        <b>Escape</b> <span>Cerrar diálogos y menús</span>
      </div>
      <p style="margin:0;color:var(--muted);font-size:12px;">Pineapple Notes guarda de forma continua tus cambios automáticamente.</p>
    </div>
    <div class="actions">
      <button id="shortcutsCloseBtn" class="btn primary" type="button">Entendido</button>
    </div>
  `;

  const close = () => {
    bg.style.display = 'none';
  };

  $('shortcutsCloseBtn').onclick = close;
  bg.onclick = (e) => {
    if (e.target === bg) close();
  };

  bg.style.display = 'flex';
  $('shortcutsCloseBtn').focus();
}

const ICON_LIBRARY = [
  {
    id: 'notes',
    label: 'Notas',
    icons: ['📝', '📄', '🗒️', '📓', '📔', '📒', '📕', '📗', '📘', '📙', '📚', '📖', '📋', '✍️', '📌', '📍', '📎', '🔖', '🏷️', '📁', '📂', '🗂️', '🗃️', '🗄️']
  },
  {
    id: 'work',
    label: 'Trabajo',
    icons: ['✅', '📅', '🗓️', '💬', '💭', '🤝', '👥', '👤', '💼', '📊', '📈', '📉', '🎯', '🚀', '💡', '📣', '🔔', '⏱️', '⏳', '🏆', '🎓', '🧠', '💰', '🛒']
  },
  {
    id: 'tech',
    label: 'Tech',
    icons: ['💻', '🖥️', '📱', '⌨️', '⚙️', '🛠️', '🔧', '🔨', '🧪', '🐛', '⚡', '🌐', '☁️', '🔗', '🔒', '🔓', '🔑', '📡', '🤖', '🧩', '📦', '🚀', '🔍', '🧭']
  },
  {
    id: 'symbols',
    label: 'Símbolos',
    icons: ['⭐', '🌟', '✨', '🔥', '❤️', '🧡', '💛', '💚', '💙', '💜', '🟢', '🟡', '🔴', '🔵', '🟣', '⚫', '⚪', '⚠️', '❗', '❓', 'ℹ️', '➕', '✔️', '❌']
  },
  {
    id: 'lifestyle',
    label: 'Otros',
    icons: ['🍍', '🏠', '🏢', '🌍', '✈️', '🚗', '🎨', '🎵', '📷', '🎬', '🎮', '☕', '🍕', '🌱', '🌿', '☀️', '🌙', '🌈', '🎉', '🎁', '🛡️', '⚖️', '🏥', '🏋️']
  }
];

/**
 * Muestra un modal selector de iconos con campo personalizado + galería categorizada
 * @param {string} defaultValue
 * @returns {Promise<string|null>}
 */
export function showIconPickerModal(defaultValue = '📄') {
  return new Promise((resolve) => {
    const bg = $('modalBg');
    const modal = bg.querySelector('.modal');
    let activeCategory = 'all';

    const allIcons = [...new Set(ICON_LIBRARY.flatMap((c) => c.icons))];

    modal.innerHTML = `
      <h2>Icono de la nota</h2>
      <div class="modal-body">
        <label for="iconInput" style="font-size:13.5px;color:var(--text-secondary);">Introduce un emoji o elige uno de la galería:</label>
        <div class="icon-input-row">
          <span id="iconPreview" class="icon-preview" aria-hidden="true">${esc(defaultValue || '📄')}</span>
          <input id="iconInput" class="modal-input" value="${esc(defaultValue || '📄')}" autofocus />
          <button id="toggleIconGalleryBtn" class="btn icon-gallery-toggle" type="button" title="Mostrar u ocultar galería de iconos">🎨 Iconos</button>
        </div>

        <div id="iconGalleryPanel" class="icon-gallery-panel">
          <div class="icon-tabs" role="tablist">
            <button type="button" class="icon-tab active" data-cat="all">Todos</button>
            ${ICON_LIBRARY.map((c) => `<button type="button" class="icon-tab" data-cat="${c.id}">${esc(c.label)}</button>`).join('')}
          </div>
          <div id="iconGrid" class="icon-grid" role="listbox" aria-label="Iconos disponibles"></div>
        </div>
      </div>
      <div class="actions">
        <button id="iconCancelBtn" class="btn" type="button">Cancelar</button>
        <button id="iconSubmitBtn" class="btn primary" type="button">Aceptar</button>
      </div>
    `;

    const input = $('iconInput');
    const preview = $('iconPreview');
    const grid = $('iconGrid');
    const panel = $('iconGalleryPanel');
    const toggleBtn = $('toggleIconGalleryBtn');

    const renderGrid = () => {
      const icons = activeCategory === 'all'
        ? allIcons
        : (ICON_LIBRARY.find((c) => c.id === activeCategory)?.icons || allIcons);
      const current = input.value.trim();

      grid.innerHTML = icons
        .map(
          (ico) =>
            `<button type="button" class="icon-cell${ico === current ? ' selected' : ''}" data-icon="${esc(ico)}" title="${esc(ico)}">${esc(ico)}</button>`
        )
        .join('');
    };

    const close = (val) => {
      bg.style.display = 'none';
      document.removeEventListener('keydown', onKeyDown);
      resolve(val);
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') close(null);
      if (e.key === 'Enter' && document.activeElement === input) close(input.value);
    };

    input.addEventListener('input', () => {
      preview.textContent = input.value.trim() || '📄';
      renderGrid();
    });

    toggleBtn.onclick = () => {
      panel.hidden = !panel.hidden;
    };

    modal.querySelectorAll('.icon-tab').forEach((tab) => {
      tab.onclick = () => {
        activeCategory = tab.dataset.cat;
        modal.querySelectorAll('.icon-tab').forEach((t) => t.classList.toggle('active', t === tab));
        renderGrid();
      };
    });

    grid.onclick = (e) => {
      const btn = e.target.closest('.icon-cell');
      if (!btn) return;
      const chosen = btn.dataset.icon;
      input.value = chosen;
      preview.textContent = chosen;
      renderGrid();
    };

    grid.ondblclick = (e) => {
      const btn = e.target.closest('.icon-cell');
      if (!btn) return;
      close(btn.dataset.icon);
    };

    $('iconCancelBtn').onclick = () => close(null);
    $('iconSubmitBtn').onclick = () => close(input.value);
    bg.onclick = (e) => {
      if (e.target === bg) close(null);
    };

    renderGrid();
    document.addEventListener('keydown', onKeyDown);
    bg.style.display = 'flex';
    input.focus();
    input.select();
  });
}
