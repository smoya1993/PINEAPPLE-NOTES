/**
 * Pineapple Notes Enterprise - Punto de Entrada y Orquestador Principal
 */

import { STORAGE_KEYS } from './config/constants.js';
import { state } from './core/state.js';
import { apiService } from './services/apiService.js';
import { authService } from './services/authService.js';
import { fsService } from './services/fsService.js';
import { storageService } from './services/storageService.js';
import { authView } from './components/authView.js';
import { sidebar } from './components/sidebar.js';
import { editor } from './components/editor.js';
import { toolbar } from './components/toolbar.js';
import { $ } from './utils/dom.js';
import { showShortcutsModal } from './utils/modal.js';
import { toastSuccess, toastError, toastInfo } from './utils/toast.js';

class Application {
  constructor() {
    const savedScale = localStorage.getItem(STORAGE_KEYS.SCALE) || localStorage.getItem(STORAGE_KEYS.LEGACY_SCALE);
    this.uiScale = Math.max(0.8, Math.min(1.4, parseFloat(savedScale) || 1));
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || localStorage.getItem(STORAGE_KEYS.LEGACY_THEME);
    this.darkMode = savedTheme ? savedTheme === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches;

    this.init();
  }

  async init() {
    this.applyThemeAndScale();
    this.bindGlobalEvents();
    this.bindStateEvents();

    // Renderizado inicial base
    editor.render();
    sidebar.renderTree();

    // Si la sesión caduca en mitad de uso, mostrar pantalla de login
    apiService.onUnauthorized = () => {
      fsService.updateConnectionUi(false, null);
      authView.show('Tu sesión ha expirado. Vuelve a iniciar sesión.');
    };

    // Inicializar formulario de autenticación
    authView.init(async (user) => {
      try {
        await fsService.loadWorkspace();
        toastSuccess(`Bienvenido, ${user.name || user.email}`);
      } catch (err) {
        toastError(`Error cargando workspace: ${err.message}`);
        authView.show('No se pudo cargar tu espacio desde PostgreSQL.');
      }
    });

    // Intentar restaurar sesión mediante cookie httpOnly refresh token
    const user = await authService.restoreSession();
    if (user) {
      authView.hide();
      try {
        await fsService.loadWorkspace();
      } catch (err) {
        toastError(`Error conectando con PostgreSQL: ${err.message}`);
        authView.show('Error cargando tus datos. Inicia sesión de nuevo.');
      }
    } else {
      fsService.updateConnectionUi(false, null);
      authView.show();
    }
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
    state.subscribe((event) => {
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

    // Botones principales
    $('new')?.addEventListener('click', () => sidebar.createNote());

    // Importar datos.json a PostgreSQL
    $('importJsonInput')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await fsService.importJsonFile(file);
      e.target.value = '';
    });

    // Cerrar sesión
    $('logoutBtn')?.addEventListener('click', async () => {
      editor.sync();
      await fsService.writeFile();
      await authService.logout();
      fsService.updateConnectionUi(false, null);
      authView.show();
      toastInfo('Sesión cerrada');
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
        toastSuccess('Sincronizado con PostgreSQL');
      }

      // Nueva nota con Ctrl + Shift + N / Alt + N
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
