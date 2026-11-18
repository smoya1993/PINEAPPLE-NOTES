/**
 * Servicio del Sistema de Archivos Local (File System Access API + IndexedDB)
 * Soporta datos.json, images/, inbox/ y processed/
 */

import { INDEXED_DB, STORAGE_KEYS, INITIAL_DATA } from '../config/constants.js';
import { state } from '../core/state.js';
import { $ } from '../utils/dom.js';
import { toastSuccess, toastError } from '../utils/toast.js';

class FileSystemService {
  constructor() {
    this.rootDirHandle = null;
    this.dataHandle = null;
    this.imagesDirHandle = null;
    this.inboxDirHandle = null;
    this.processedDirHandle = null;
    this.saveTimer = null;
  }

  get isConnected() {
    return !!this.dataHandle;
  }

  async openDatabase(dbName = INDEXED_DB.DB_NAME) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, INDEXED_DB.VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(INDEXED_DB.STORE_NAME)) {
          req.result.createObjectStore(INDEXED_DB.STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async rememberFolder(handle) {
    try {
      const db = await this.openDatabase(INDEXED_DB.DB_NAME);
      await new Promise((resolve, reject) => {
        const tx = db.transaction(INDEXED_DB.STORE_NAME, 'readwrite');
        tx.objectStore(INDEXED_DB.STORE_NAME).put(handle, INDEXED_DB.KEY);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (e) {
      console.warn('No se pudo recordar la carpeta en IndexedDB:', e);
    }
  }

  async recallFolderFromDb(dbName) {
    try {
      const db = await this.openDatabase(dbName);
      const handle = await new Promise((resolve, reject) => {
        const tx = db.transaction(INDEXED_DB.STORE_NAME, 'readonly');
        const req = tx.objectStore(INDEXED_DB.STORE_NAME).get(INDEXED_DB.KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return handle;
    } catch {
      return null;
    }
  }

  async recallFolder() {
    const primary = await this.recallFolderFromDb(INDEXED_DB.DB_NAME);
    if (primary) return primary;
    const enterprise = await this.recallFolderFromDb(INDEXED_DB.ENTERPRISE_DB_NAME);
    if (enterprise) return enterprise;
    return await this.recallFolderFromDb(INDEXED_DB.LEGACY_DB_NAME);
  }

  async connectFolder(directoryHandle) {
    const imagesHandle = await directoryHandle.getDirectoryHandle('images', { create: true });
    const inboxHandle = await directoryHandle.getDirectoryHandle('inbox', { create: true });
    const processedHandle = await directoryHandle.getDirectoryHandle('processed', { create: true });
    const dataFileHandle = await directoryHandle.getFileHandle('datos.json', { create: true });

    const file = await dataFileHandle.getFile();
    const text = await file.text();
    let loadedData = state.getData();

    if (text.trim()) {
      try {
        loadedData = JSON.parse(text);
      } catch {
        throw new Error('datos.json contiene JSON no válido. El archivo no se ha sobrescrito.');
      }

      if (!loadedData || !Array.isArray(loadedData.pages)) {
        throw new Error('datos.json no tiene una estructura válida de Pineapple Notes.');
      }

      if (!loadedData.pages.length) {
        loadedData = structuredClone(INITIAL_DATA);
      }
    }

    this.rootDirHandle = directoryHandle;
    this.imagesDirHandle = imagesHandle;
    this.inboxDirHandle = inboxHandle;
    this.processedDirHandle = processedHandle;
    this.dataHandle = dataFileHandle;

    state.setData(loadedData, 'folder_connected');

    // Actualizar UI de conexión
    const conn = $('connection');
    const connText = $('connectionText');
    const gate = $('folderGate');
    const status = $('status');

    if (conn) conn.classList.add('visible');
    if (connText) connText.textContent = `${this.rootDirHandle.name} · datos, imágenes y correo`;
    if (gate) {
      gate.classList.add('hidden');
      gate.classList.remove('restoring');
    }

    if (!text.trim() || !state.getData().pages.length) {
      await this.writeFile();
    } else if (status) {
      status.textContent = 'Cargado desde datos.json';
    }

    toastSuccess(`Carpeta vinculada: ${this.rootDirHandle.name}`);
  }

  async restoreFolder(requestAccess = false) {
    const gate = $('folderGate');
    if (gate) gate.classList.add('restoring');

    try {
      const handle = await this.recallFolder();
      if (!handle) return false;

      let permission = handle.queryPermission
        ? await handle.queryPermission({ mode: 'readwrite' })
        : 'prompt';

      if (permission !== 'granted' && requestAccess && handle.requestPermission) {
        permission = await handle.requestPermission({ mode: 'readwrite' });
      }

      if (permission !== 'granted') return false;

      await this.connectFolder(handle);
      return true;
    } catch (e) {
      console.warn('No se pudo reconectar automáticamente la carpeta', e);
      return false;
    } finally {
      if (gate) gate.classList.remove('restoring');
    }
  }

  async selectFolderPrompt() {
    if (!window.showDirectoryPicker) {
      toastError('Esta función necesita Microsoft Edge o Google Chrome actualizado.');
      return;
    }

    const triggerButtons = [$('folder'), $('gateFolderBtn')].filter(Boolean);
    triggerButtons.forEach((b) => {
      b.disabled = true;
      b.dataset.oldText = b.textContent;
      b.textContent = 'Abriendo…';
    });

    try {
      const selected = await window.showDirectoryPicker({
        id: 'pineapple-notes-shared-root',
        mode: 'readwrite'
      });

      let permission = 'granted';
      if (selected.queryPermission) {
        permission = await selected.queryPermission({ mode: 'readwrite' });
      }
      if (permission !== 'granted' && selected.requestPermission) {
        permission = await selected.requestPermission({ mode: 'readwrite' });
      }

      if (permission !== 'granted') {
        throw new Error('No se concedió permiso de lectura y escritura.');
      }

      await this.rememberFolder(selected);
      await this.connectFolder(selected);
    } catch (e) {
      if (e.name !== 'AbortError') {
        toastError(`No se pudo cargar la carpeta: ${e.message || e}`);
      }
    } finally {
      triggerButtons.forEach((b) => {
        b.disabled = false;
        b.textContent = b.dataset.oldText || 'Abrir carpeta';
      });
    }
  }

  async writeFile() {
    if (!this.dataHandle) return;
    try {
      const writable = await this.dataHandle.createWritable();
      await writable.write(JSON.stringify(state.getData(), null, 2));
      await writable.close();
      const status = $('status');
      if (status) status.textContent = 'Guardado en datos.json';
    } catch (err) {
      console.error('Error escribiendo datos.json', err);
      const status = $('status');
      if (status) status.textContent = 'Error al guardar en disco';
      toastError('No se pudo escribir en datos.json');
    }
  }

  scheduleSave() {
    try {
      const serialized = JSON.stringify(state.getData());
      localStorage.setItem(STORAGE_KEYS.DATA, serialized);
      localStorage.setItem(STORAGE_KEYS.ENTERPRISE_DATA, serialized);
    } catch {}

    const status = $('status');
    if (this.dataHandle) {
      if (status) status.textContent = 'Guardando...';
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.writeFile(), 250);
    } else if (status) {
      status.textContent = 'Sin carpeta vinculada';
    }
  }

  generateImageName(file) {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const ext = (file.name?.split('.').pop() || 'png').toLowerCase();
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}-${String(d.getMilliseconds()).padStart(3, '0')}.${ext}`;
  }

  async saveImage(file) {
    if (!this.imagesDirHandle) {
      throw new Error('Primero abre la carpeta.');
    }

    const filename = this.generateImageName(file);
    const fileHandle = await this.imagesDirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();
    return `images/${filename}`;
  }
}

export const fsService = new FileSystemService();
