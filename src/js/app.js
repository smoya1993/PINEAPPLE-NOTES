/**
 * Pineapple Notes Enterprise - Punto de Entrada y Orquestador Principal
 */

import { STORAGE_KEYS } from './config/constants.js';
import { state } from './core/state.js';
import { fsService } from './services/fsService.js';
import { storageService } from './services/storageService.js';
import { sidebar } from './components/sidebar.js';
import { editor } from './components/editor.js';
import { toolbar } from './components/toolbar.js';
import { $ } from './utils/dom.js';
import { showShortcutsModal } from './utils/modal.js';
import { toastInfo, toastSuccess } from './utils/toast.js';

class Application {
  constructor() {
    const savedScale = localStorage.getItem(STORAGE_KEYS.SCALE) || localStorage.getItem(STORAGE_KEYS.LEGACY_SCALE);
    this.uiScale = Math.max(0.8, Math.min(1.4, parseFloat(savedScale) || 1));
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || localStorage.getItem(STORAGE_KEYS.LEGACY_THEME);
    this.darkMode = savedTheme ? savedTheme === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches;

    this.init();
  }

  init() {
    this.applyThemeAndScale();
    this.bindGlobalEvents();
    this.bindStateEvents();

    // Renderizado inicial
    editor.render();
    sidebar.renderTree();

    // Intentar reconectar carpeta de datos guardada
    fsService.restoreFolder(false).then((connected) => {
      if (!connected) {
        const status = $('status');
        if (status) status.textContent = 'Pulsa Seleccionar carpeta para reconectar disco';
      }
    });
  }

  applyThemeAndScale() {
    document.documentElement.style.setProperty('--editor-scale', this.uiScale);
    document.documentElement.classList.toggle('dark', this.darkMode);

    const zoomLabel = $('zoomValue');
    const themeBtn = $('themeToggle');

    if (zoomLabel) zoomLabel.textContent = `${Math.round(this.uiScale * 100)}%`;
    if (themeBtn) themeBtn.textContent = this.darkMode ? '☀ Claro' : '◐ Oscuro';
  }

  changeScale(delta) {
    this.uiScale = Math.max(0.8, Math.min(1.4, Math.round((this.uiScale + delta) * 10) / 10));
    localStorage.setItem(STORAGE_KEYS.SCALE, this.uiScale);
    this.applyThemeAndScale();
  }

  toggleTheme() {
    this.darkMode = !this.darkMode;
    localStorage.setItem(STORAGE_KEYS.THEME, this.darkMode ? 'dark' : 'light');
    this.applyThemeAndScale();
  }

  bindStateEvents() {
    state.subscribe((event, payload) => {
      if (['active_page_changed', 'folder_connected', 'data_replaced'].includes(event)) {
        editor.render();
        sidebar.renderTree();
      } else if (['favorites_changed', 'tree_toggle', 'note_created', 'note_duplicated', 'note_deleted'].includes(event)) {
        sidebar.renderTree();
        editor.updateFavoriteButton();
      }
    });
  }

  bindGlobalEvents() {
    // Zoom y tema
    $('fontDown')?.addEventListener('click', () => this.changeScale(-0.1));
    $('fontUp')?.addEventListener('click', () => this.changeScale(0.1));
    $('zoomValue')?.addEventListener('click', () => {
      this.uiScale = 1;
      localStorage.setItem(STORAGE_KEYS.SCALE, 1);
      this.applyThemeAndScale();
    });
    $('themeToggle')?.addEventListener('click', () => this.toggleTheme());

    // Botones de acción principales
    $('new')?.addEventListener('click', () => sidebar.createNote());
    $('folder')?.addEventListener('click', () => fsService.selectFolderPrompt());
    $('gateFolderBtn')?.addEventListener('click', async () => {
      const reconnected = await fsService.restoreFolder(true);
      if (!reconnected) {
        await fsService.selectFolderPrompt();
      }
    });

    // Menú exportar
    $('export')?.addEventListener('click', () => storageService.exportJsonBackup());
    $('exportMd')?.addEventListener('click', () => storageService.exportActivePageToMarkdown());
    $('exportPdf')?.addEventListener('click', () => storageService.exportActivePageToPdf());

    // Atajos de teclado globales
    window.addEventListener('keydown', (e) => {
      // Guardar con Ctrl + S / Cmd + S
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        editor.sync();
        fsService.writeFile();
        toastSuccess('Nota guardada en disco');
      }

      // Nueva nota con Ctrl + N / Alt + N
      if ((e.altKey && e.key.toLowerCase() === 'n') || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n')) {
        e.preventDefault();
        sidebar.createNote();
      }

      // Buscar con Ctrl + F (cuando no estamos editando texto interno de código)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && !e.target.closest('.code-input')) {
        e.preventDefault();
        const search = $('search');
        if (search) {
          search.focus();
          search.select();
        }
      }

      // Modal de atajos con F1 o Ctrl + /
      if (e.key === 'F1' || ((e.ctrlKey || e.metaKey) && e.key === '/')) {
        e.preventDefault();
        showShortcutsModal();
      }
    });

    // Guardar estado al salir o recargar la ventana
    window.addEventListener('beforeunload', () => {
      editor.sync();
    });
  }
}

// Inicializar la aplicación al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  window.__PINEAPPLE_APP__ = new Application();
});
