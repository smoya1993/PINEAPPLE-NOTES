/**
 * Componente de Barra de Herramientas WYSIWYG
 */

import { PASTEL_COLORS, CODE_LANGUAGES } from '../config/constants.js';
import { fsService } from '../services/fsService.js';
import { meetingService } from '../services/meetingService.js';
import { $, $$, esc } from '../utils/dom.js';
import { showPromptModal } from '../utils/modal.js';
import { toastSuccess, toastError, toastWarning } from '../utils/toast.js';

class ToolbarComponent {
  constructor() {
    this.toolbar = $('toolbar');
    this.highlightBtn = $('highlightBtn');
    this.highlightMenu = $('highlightMenu');
    this.highlightSwatch = $('highlightSwatch');
    this.savedEditorRange = null;
    this.savedHighlightRange = null;

    this.init();
  }

  init() {
    this.renderHighlightColors();
    this.bindEvents();
  }

  renderHighlightColors() {
    if (!this.highlightMenu) return;
    this.highlightMenu.innerHTML = '';

    PASTEL_COLORS.forEach(({ color, label }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.highlight = color;
      btn.style.background = color;
      btn.title = label;
      this.highlightMenu.appendChild(btn);
    });

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.dataset.highlight = 'transparent';
    clearBtn.className = 'clear-highlight';
    clearBtn.textContent = 'Sin color';
    this.highlightMenu.appendChild(clearBtn);
  }

  rememberEditorRange() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const editor = $('editor');
    if (editor && editor.contains(range.commonAncestorContainer)) {
      this.savedEditorRange = range.cloneRange();
    }
  }

  restoreEditorRange() {
    if (!this.savedEditorRange) return false;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(this.savedEditorRange);
    return true;
  }

  applyInlineFormat(command) {
    this.restoreEditorRange();
    $('editor').focus();
    document.execCommand(command, false, null);
    this.rememberEditorRange();
    this.updateActiveStates();
  }

  applyBlockFormat(tag) {
    this.restoreEditorRange();
    $('editor').focus();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    document.execCommand('formatBlock', false, tag);
    this.rememberEditorRange();
    this.updateActiveStates();
  }

  rememberHighlightSelection() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const editor = $('editor');
    if (editor && editor.contains(range.commonAncestorContainer) && !range.collapsed) {
      this.savedHighlightRange = range.cloneRange();
    }
  }

  applyHighlight(color) {
    const range = this.savedHighlightRange || (window.getSelection()?.rangeCount ? window.getSelection().getRangeAt(0) : null);
    if (!range || range.collapsed) {
      toastWarning('Selecciona primero el texto que deseas resaltar.');
      return;
    }

    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    if (color === 'transparent') {
      const highlights = $$('span.pastel-highlight', $('editor'));
      highlights.filter((node) => {
        try { return range.intersectsNode(node); } catch { return false; }
      }).forEach((node) => {
        const parent = node.parentNode;
        while (node.firstChild) parent.insertBefore(node.firstChild, node);
        node.remove();
        parent.normalize();
      });
    } else {
      const span = document.createElement('span');
      span.className = 'pastel-highlight';
      span.style.backgroundColor = color;
      try {
        range.surroundContents(span);
      } catch {
        const frag = range.extractContents();
        span.appendChild(frag);
        range.insertNode(span);
      }
    }

    this.savedHighlightRange = null;
    this.highlightMenu.classList.remove('open');
    this.updateActiveStates();
  }

  async insertTable() {
    this.restoreEditorRange();
    $('editor').focus();

    const rowsInput = await showPromptModal('Insertar Tabla', 'Número de filas de datos:', '3');
    if (rowsInput === null) return;
    const colsInput = await showPromptModal('Insertar Tabla', 'Número de columnas:', '4');
    if (colsInput === null) return;

    let rows = parseInt(rowsInput, 10) || 3;
    let cols = parseInt(colsInput, 10) || 4;
    rows = Math.max(1, Math.min(50, rows));
    cols = Math.max(1, Math.min(20, cols));

    let head = '<tr>';
    for (let c = 1; c <= cols; c++) head += `<th>Columna ${c}</th>`;
    head += '</tr>';

    let body = '';
    for (let r = 0; r < rows; r++) {
      body += '<tr>';
      for (let c = 0; c < cols; c++) body += '<td><br></td>';
      body += '</tr>';
    }

    const tableHtml = `<div class="pineapple-table-wrap pina-table-wrap"><table class="pineapple-table pina-table"><thead>${head}</thead><tbody>${body}</tbody></table></div><p><br></p>`;
    document.execCommand('insertHTML', false, tableHtml);
  }

  insertCodeBlock() {
    const codeHtml = `
      <div class="code-block" contenteditable="false">
        <div class="code-head">
          <select class="code-lang">
            ${Object.entries(CODE_LANGUAGES)
              .map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`)
              .join('')}
          </select>
          <span class="spacer"></span>
          <button class="code-copy" type="button">Copiar</button>
          <button class="code-delete" type="button" title="Eliminar bloque">✕</button>
        </div>
        <div class="code-area">
          <pre class="code-view"></pre>
          <textarea class="code-input" spellcheck="false">// Escribe o pega tu código aquí</textarea>
        </div>
      </div>
      <p class="code-after"><br></p>
    `;

    $('editor').focus();
    document.execCommand('insertHTML', false, codeHtml);
  }

  insertImportantCallout() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);

    let content = 'Importante';
    if (!range.collapsed) {
      const box = document.createElement('div');
      box.appendChild(range.cloneContents());
      content = box.innerHTML || 'Importante';
      range.deleteContents();
    }

    const callout = document.createElement('div');
    callout.className = 'important-callout';
    callout.setAttribute('contenteditable', 'false');
    callout.innerHTML = `
      <span class="important-icon" aria-hidden="true">!</span>
      <span class="important-text" contenteditable="false">${content}</span>
      <button type="button" class="important-delete" title="Eliminar importante" aria-label="Eliminar importante">✕</button>
    `;

    range.collapse(true);
    range.insertNode(callout);
    callout.insertAdjacentHTML('afterend', '<p><br></p>');
  }

  insertTaskWidget() {
    this.restoreEditorRange();
    $('editor').focus();
    const widgetId = 'tw_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const widgetHtml = `
      <div class="task-widget-block" data-widget-id="${widgetId}" data-filter="pending" data-tasks="[]" contenteditable="false">
        <div class="task-widget-head">
          <span class="task-widget-title">✅ Tareas / To-Do List</span>
          <span class="spacer"></span>
          <button type="button" class="task-widget-delete" title="Eliminar widget de tareas">✕</button>
        </div>
        <div class="task-widget-body"></div>
      </div>
      <p class="code-after"><br></p>
    `;

    document.execCommand('insertHTML', false, widgetHtml);
    import('./editor.js').then(({ editor }) => {
      editor.bindTaskWidgets();
      editor.sync();
    });
  }

  async handleImageUpload(file) {
    if (!file) return;
    try {
      const imagePath = await fsService.saveImage(file);
      $('editor').focus();
      document.execCommand('insertImage', false, imagePath);
      const images = $$('img', $('editor'));
      const lastImg = images[images.length - 1];
      if (lastImg) lastImg.style.width = '100%';
      toastSuccess('Imagen guardada y agregada a la nota');
    } catch (err) {
      toastError(`Error al subir imagen: ${err.message}`);
    }
  }

  updateActiveStates() {
    const sel = window.getSelection();
    const editor = $('editor');
    const inside = sel && sel.rangeCount && editor.contains(sel.getRangeAt(0).commonAncestorContainer);

    // Comandos de formato inline
    $$('[data-cmd]', this.toolbar).forEach((b) => {
      const cmd = b.dataset.cmd;
      const isActive = inside && cmd !== 'removeFormat' && document.queryCommandState(cmd);
      b.classList.toggle('active', !!isActive);
    });

    // Bloques (h1, h2, p, blockquote)
    const block = inside ? this.getCurrentBlockTag(sel.anchorNode) : '';
    $$('[data-block]', this.toolbar).forEach((b) => {
      b.classList.toggle('active', inside && block === b.dataset.block);
    });

    // Callout
    const node = sel?.anchorNode?.nodeType === 3 ? sel.anchorNode.parentElement : sel?.anchorNode;
    const isImportant = !!node?.closest?.('.important-callout');
    const impBtn = $('importantBtn');
    if (impBtn) impBtn.classList.toggle('active', isImportant);

    // Resaltado
    const highlightColor = inside ? this.getCurrentHighlightColor(sel.anchorNode) : '';
    const isHighlighted = !!highlightColor && !['transparent', 'rgba(0, 0, 0, 0)', 'rgb(255, 255, 255)'].includes(highlightColor);
    if (this.highlightBtn) this.highlightBtn.classList.toggle('active', isHighlighted);
    if (isHighlighted && this.highlightSwatch) {
      this.highlightSwatch.style.background = highlightColor;
    }
  }

  getCurrentBlockTag(node) {
    let el = node?.nodeType === 3 ? node.parentElement : node;
    const block = el?.closest?.('h1, h2, p, blockquote, li, div');
    return block?.tagName?.toLowerCase() || 'p';
  }

  getCurrentHighlightColor(node) {
    let el = node?.nodeType === 3 ? node.parentElement : node;
    const span = el?.closest?.('span.pastel-highlight');
    return span?.style?.backgroundColor || '';
  }

  bindEvents() {
    // Recordar rango de selección al interactuar con la barra
    $$('button, label', this.toolbar).forEach((el) => {
      el.addEventListener('mousedown', (e) => {
        this.rememberEditorRange();
        if (el.tagName === 'BUTTON') e.preventDefault();
      });
    });

    // Formatos inline
    $$('[data-cmd]', this.toolbar).forEach((btn) => {
      btn.onclick = () => this.applyInlineFormat(btn.dataset.cmd);
    });

    // Formatos de bloque
    $$('[data-block]', this.toolbar).forEach((btn) => {
      btn.onclick = () => this.applyBlockFormat(btn.dataset.block);
    });

    // Botones especiales
    $('importantBtn').onclick = () => this.insertImportantCallout();
    $('meetingBtn').onclick = () => meetingService.addMeetingSnippetFromSelection();
    $('tableBtn').onclick = () => this.insertTable();
    $('codeBtn').onclick = () => this.insertCodeBlock();
    $('taskWidgetBtn')?.addEventListener('click', () => this.insertTaskWidget());

    // Input de imagen
    const imgInput = $('imgInput');
    if (imgInput) {
      imgInput.onchange = (e) => {
        if (e.target.files[0]) this.handleImageUpload(e.target.files[0]);
        e.target.value = '';
      };
    }

    // Menú de resaltador pastel
    this.highlightBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.rememberHighlightSelection();
    });

    this.highlightBtn.onclick = (e) => {
      e.stopPropagation();
      this.highlightMenu.classList.toggle('open');
    };

    this.highlightMenu.addEventListener('mousedown', (e) => e.preventDefault());
    this.highlightMenu.onclick = (e) => {
      e.stopPropagation();
      const target = e.target.closest('[data-highlight]');
      if (target) this.applyHighlight(target.dataset.highlight);
    };

    // Cerrar menú de resaltador al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (this.highlightMenu && !this.highlightMenu.contains(e.target) && !this.highlightBtn.contains(e.target)) {
        this.highlightMenu.classList.remove('open');
      }
    });
  }
}

export const toolbar = new ToolbarComponent();
