/**
 * Servicio de Puntos a Tratar en Reuniones Internas
 */

import { SPECIAL_PAGES } from '../config/constants.js';
import { state } from '../core/state.js';
import { fsService } from './fsService.js';
import { sanitizeInternalHtml } from '../utils/dom.js';
import { toastSuccess, toastWarning } from '../utils/toast.js';

class MeetingService {
  getMeetingItems() {
    return state.getData().meetingItems || [];
  }

  getSourcePath(page) {
    const data = state.getData();
    const names = [];
    let p = page;
    while (p) {
      names.unshift(p.title || 'Sin título');
      p = data.pages.find((x) => x.id === p.parentId);
    }
    return names.join(' › ');
  }

  addMeetingSnippetFromSelection() {
    state.ensureMeetingStructure();
    const activePage = state.getActivePage();

    if (activePage.id === SPECIAL_PAGES.MEETINGS_ID) {
      toastWarning('Selecciona texto dentro de una nota de origen (no en la lista de reuniones).');
      return false;
    }

    const sel = window.getSelection();
    const editor = document.getElementById('editor');

    if (!sel || !sel.rangeCount || sel.isCollapsed || !editor.contains(sel.anchorNode)) {
      toastWarning('Selecciona primero un párrafo o línea de texto en el editor.');
      return false;
    }

    const range = sel.getRangeAt(0);
    const box = document.createElement('div');
    box.appendChild(range.cloneContents());
    const plain = (box.textContent || sel.toString()).trim();

    if (!plain) {
      toastWarning('La selección está vacía.');
      return false;
    }

    const now = Date.now();
    const newItem = {
      id: 'mi_' + now.toString(36) + Math.random().toString(36).slice(2, 8),
      sourcePageId: activePage.id,
      sourceTitle: activePage.title || 'Sin título',
      sourcePath: this.getSourcePath(activePage),
      text: plain,
      html: sanitizeInternalHtml(box.innerHTML),
      status: 'open',
      createdAt: now,
      updatedAt: now
    };

    const data = state.getData();
    data.meetingItems.push(newItem);
    fsService.scheduleSave();
    state.notify('meeting_item_added', { item: newItem });
    toastSuccess('Punto añadido a 💬 Reuniones internas · Cosas que comentar');
    return true;
  }

  toggleMeetingItemStatus(itemId) {
    const data = state.getData();
    const item = data.meetingItems.find((x) => x.id === itemId);
    if (!item) return;

    item.status = item.status === 'done' ? 'open' : 'done';
    item.updatedAt = Date.now();

    fsService.scheduleSave();
    state.notify('meeting_item_updated', { item });
  }

  deleteMeetingItem(itemId) {
    const data = state.getData();
    data.meetingItems = data.meetingItems.filter((x) => x.id !== itemId);
    fsService.scheduleSave();
    state.notify('meeting_item_deleted', { itemId });
    toastSuccess('Punto eliminado de la reunión');
  }
}

export const meetingService = new MeetingService();
