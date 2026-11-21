/**
 * Servicio de Persistencia en PostgreSQL vía API REST
 * Mantiene la misma interfaz pública (scheduleSave, writeFile, saveImage) para compatibilidad total con los componentes.
 */

import { STORAGE_KEYS, INITIAL_DATA } from '../config/constants.js';
import { state } from '../core/state.js';
import { apiService, API_BASE_URL } from './apiService.js';
import { authService } from './authService.js';
import { $ } from '../utils/dom.js';
import { toastSuccess, toastError } from '../utils/toast.js';

class CloudPersistenceService {
  constructor() {
    this.saveTimer = null;
    this.isSyncing = false;
    this.pendingSync = false;
    this.connected = false;
  }

  get isConnected() {
    return this.connected && authService.isAuthenticated;
  }

  updateConnectionUi(connected, user) {
    const conn = $('connection');
    const connText = $('connectionText');
    const status = $('status');
    const logoutBtn = $('logoutBtn');

    if (conn) conn.classList.toggle('visible', connected);
    if (connText) {
      connText.textContent = connected
        ? `${user?.name || user?.email || 'Usuario'} · PostgreSQL`
        : '';
    }
    if (logoutBtn) logoutBtn.hidden = !connected;
    if (status && !connected) {
      status.textContent = 'Sin sesión';
    }
  }

  async loadWorkspace() {
    const status = $('status');
    if (status) status.textContent = 'Cargando desde PostgreSQL...';

    const workspace = await apiService.get('/workspace');
    let dataToLoad = workspace;

    // Si es un usuario nuevo sin notas aún, inicializar con datos semilla y guardar
    const isEmptyWorkspace = !workspace?.pages || workspace.pages.length === 0;
    if (isEmptyWorkspace) {
      dataToLoad = structuredClone(INITIAL_DATA);
    }

    this.connected = true;
    state.setData(dataToLoad, 'folder_connected');
    this.updateConnectionUi(true, authService.getUser());

    if (isEmptyWorkspace) {
      await this.writeFile();
    } else if (status) {
      status.textContent = `Sincronizado (${new Date().toLocaleTimeString()})`;
    }

    return dataToLoad;
  }

  async writeFile() {
    if (!authService.isAuthenticated) return;

    if (this.isSyncing) {
      this.pendingSync = true;
      return;
    }

    this.isSyncing = true;
    const status = $('status');
    if (status) status.textContent = 'Guardando en PostgreSQL...';

    try {
      const payload = state.getData();
      await apiService.put('/workspace', payload);
      if (status) status.textContent = `Guardado (${new Date().toLocaleTimeString()})`;
    } catch (err) {
      console.error('Error sincronizando con PostgreSQL:', err);
      if (status) status.textContent = 'Error al sincronizar';
      toastError(`No se pudo guardar en PostgreSQL: ${err.message}`);
    } finally {
      this.isSyncing = false;
      if (this.pendingSync) {
        this.pendingSync = false;
        this.writeFile();
      }
    }
  }

  scheduleSave() {
    // Caché local inmediata para evitar pérdidas si se cierra la pestaña
    try {
      localStorage.setItem(STORAGE_KEYS.DATA, JSON.stringify(state.getData()));
    } catch {
      // Ignorar cuota de localStorage
    }

    const status = $('status');
    if (authService.isAuthenticated) {
      if (status) status.textContent = 'Cambios pendientes...';
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.writeFile(), 500);
    } else if (status) {
      status.textContent = 'Inicia sesión para sincronizar';
    }
  }

  async saveImage(file) {
    if (!authService.isAuthenticated) {
      throw new Error('Debes iniciar sesión para subir imágenes.');
    }

    const formData = new FormData();
    formData.append('image', file);

    const res = await apiService.post('/images', formData);
    // Devolver URL servible directamente por <img src="...">
    const base = API_BASE_URL.endsWith('/api')
      ? API_BASE_URL.slice(0, -4)
      : API_BASE_URL;
    return `${base}${res.url}`;
  }

  async importJsonFile(file) {
    if (!authService.isAuthenticated) {
      toastError('Inicia sesión primero para importar un respaldo JSON.');
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.pages)) {
        throw new Error('El archivo JSON no tiene una estructura válida de Pineapple Notes.');
      }

      state.setData(parsed, 'data_replaced');
      await this.writeFile();
      toastSuccess(`Importadas ${parsed.pages.length} notas a PostgreSQL`);
    } catch (err) {
      toastError(`Error al importar JSON: ${err.message}`);
    }
  }
}

export const fsService = new CloudPersistenceService();
