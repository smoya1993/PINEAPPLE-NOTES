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
