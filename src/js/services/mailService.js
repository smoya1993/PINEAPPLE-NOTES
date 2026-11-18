/**
 * Servicio de Sincronización e Integración de Correos Marcados WAF (OneDrive / Outlook JSON)
 */

import { SPECIAL_PAGES } from '../config/constants.js';
import { state } from '../core/state.js';
import { fsService } from './fsService.js';
import { $ } from '../utils/dom.js';
import { toastSuccess, toastWarning, toastError } from '../utils/toast.js';

class MailService {
  constructor() {
    this.mailSyncTimer = null;
    this.mailSyncRunning = false;
    this.lastMailSyncAt = null;
  }

  getMailItems() {
    return state.getData().mailItems || [];
  }

  mailKey(item) {
    return String(item.outlookMessageId || item.messageId || item.id || '').trim();
  }

  formatMailDate(value) {
    if (!value) return '';
    try {
      return new Intl.DateTimeFormat('es-ES', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(new Date(value));
    } catch {
      return String(value);
    }
  }

  normalizeMail(raw, fileName) {
    const item = Array.isArray(raw) ? raw[0] : raw;
    if (!item || typeof item !== 'object') {
      throw new Error('El JSON no contiene un objeto de correo');
    }
    const key = this.mailKey(item);
    if (!key) {
      throw new Error('Falta outlookMessageId');
    }

    return {
      id: 'mail_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      schemaVersion: item.schemaVersion || 1,
      source: item.source || 'Outlook',
      category: item.category || 'WAF',
      subject: String(item.subject || '(Sin asunto)'),
      fromAddress: String(item.fromAddress?.address || item.fromAddress?.Address || item.fromAddress || ''),
      fromName: String(item.fromName || item.fromAddress?.name || item.fromAddress?.Name || ''),
      receivedDateTime: item.receivedDateTime || '',
      bodyPreview: String(item.bodyPreview || ''),
      outlookMessageId: key,
      status: item.status === 'reviewed' ? 'reviewed' : 'pending',
      notes: String(item.notes || ''),
      importedAt: item.importedAt || new Date().toISOString(),
      sourceFile: fileName,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  async archiveInboxFile(name, file) {
    const processedDir = fsService.processedDirHandle;
    const inboxDir = fsService.inboxDirHandle;
    if (!processedDir || !inboxDir) return;

    const target = await processedDir.getFileHandle(name, { create: true });
    const w = await target.createWritable();
    await w.write(await file.arrayBuffer());
    await w.close();
    await inboxDir.removeEntry(name);
  }

  updateMailSyncStatus(message = '') {
    const el = $('mailSyncStatus');
    if (!el) return;
    if (message) {
      el.textContent = message;
      return;
    }
    el.textContent = this.lastMailSyncAt
      ? `Sincronización automática cada 60 segundos · Última: ${new Intl.DateTimeFormat('es-ES', {
          timeStyle: 'medium'
        }).format(this.lastMailSyncAt)}`
      : 'Sincronización automática cada 60 segundos';
  }

  startMailAutoSync() {
    if (this.mailSyncTimer) clearInterval(this.mailSyncTimer);
    this.mailSyncTimer = setInterval(() => {
      if (document.visibilityState === 'visible' && fsService.inboxDirHandle && fsService.processedDirHandle) {
        this.syncMailInbox({ silent: true });
      }
    }, 60000);
  }

  stopMailAutoSync() {
    if (this.mailSyncTimer) clearInterval(this.mailSyncTimer);
  }

  async syncMailInbox(options = {}) {
    const silent = !!options.silent;
    if (this.mailSyncRunning) return;

    const inboxDir = fsService.inboxDirHandle;
    const processedDir = fsService.processedDirHandle;

    if (!inboxDir || !processedDir) {
      if (!silent) {
        toastWarning('Primero abre la carpeta privada de Pineapple Notes. Debe contener inbox y processed.');
      }
      return;
    }

    this.mailSyncRunning = true;
    const btn = $('mailSyncBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Sincronizando…';
    }
    this.updateMailSyncStatus('Sincronizando correos…');

    let imported = 0;
    let duplicates = 0;
    const errors = [];
    const data = state.getData();

    try {
      for await (const [name, handle] of inboxDir.entries()) {
        if (handle.kind !== 'file' || !name.toLowerCase().endsWith('.json')) continue;
        try {
          const file = await handle.getFile();
          const rawText = (await file.text()).replace(/^\uFEFF/, '');
          const raw = JSON.parse(rawText);
          const item = this.normalizeMail(raw, name);
          const key = this.mailKey(item);
          const exists =
            data.mailItems.some((x) => this.mailKey(x) === key) || Boolean(data.mailStates?.[key]);

          if (exists) {
            duplicates++;
          } else {
            data.mailItems.push(item);
            if (!data.mailStates) data.mailStates = {};
            data.mailStates[key] = {
              importedAt: new Date().toISOString(),
              sourceFile: name
            };
            imported++;
          }

          await this.archiveInboxFile(name, file);
        } catch (e) {
          errors.push(`${name}: ${e.message || e}`);
        }
      }

      this.lastMailSyncAt = new Date();
      if (imported || duplicates) {
        fsService.scheduleSave();
      }

      if (state.getActivePage()?.id === SPECIAL_PAGES.MAIL_ID && (imported || duplicates)) {
        state.notify('mail_items_synced', { imported, duplicates });
      }

      this.updateMailSyncStatus();

      if (!silent) {
        let msg = `Importados: ${imported}. Duplicados omitidos: ${duplicates}.`;
        if (errors.length) {
          msg += ` Errores: ${errors.length} (los archivos con error permanecen en inbox).`;
          toastWarning(msg);
        } else {
          toastSuccess(msg);
        }
      }
    } catch (e) {
      this.updateMailSyncStatus(`Error de sincronización: ${e.message || e}`);
      if (!silent) {
        toastError(`No se pudieron sincronizar los correos: ${e.message || e}`);
      }
    } finally {
      this.mailSyncRunning = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = '📥 Sincronizar correos';
      }
    }
  }

  updateMailNotes(itemId, notes) {
    const item = this.getMailItems().find((x) => x.id === itemId);
    if (!item) return;
    item.notes = notes;
    item.updatedAt = Date.now();
    fsService.scheduleSave();
  }

  toggleMailStatus(itemId) {
    const item = this.getMailItems().find((x) => x.id === itemId);
    if (!item) return;
    item.status = item.status === 'reviewed' ? 'pending' : 'reviewed';
    item.updatedAt = Date.now();
    fsService.scheduleSave();
    state.notify('mail_item_updated', { item });
  }

  deleteMailItem(itemId) {
    const data = state.getData();
    data.mailItems = (data.mailItems || []).filter((x) => x.id !== itemId);
    fsService.scheduleSave();
    state.notify('mail_item_deleted', { itemId });
    toastSuccess('Correo eliminado de Pineapple Notes');
  }
}

export const mailService = new MailService();
