/**
 * Servicio de Temas Pendientes Centralizados (👁️)
 */

import { SPECIAL_PAGES, READONLY_SPECIAL_PAGE_IDS } from '../config/constants.js';
import { state } from '../core/state.js';
import { fsService } from './fsService.js';
import { $, sanitizeInternalHtml } from '../utils/dom.js';
import { toastSuccess, toastWarning } from '../utils/toast.js';

class TopicService {
  getTopicItems() {
    return state.getData().topicItems || [];
  }

  addTopicFromSelection() {
    state.ensureTopicStructure();
    const activePage = state.getActivePage();

    if (!activePage || READONLY_SPECIAL_PAGE_IDS.includes(activePage.id)) {
      toastWarning('Selecciona texto dentro de una nota de origen.');
      return false;
    }

    const sel = window.getSelection();
    const editor = $('editor');

    if (!sel || !sel.rangeCount || sel.isCollapsed || !editor.contains(sel.anchorNode)) {
      toastWarning('Selecciona primero una línea o fragmento de la nota.');
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
      id: 'topic_' + now.toString(36) + Math.random().toString(36).slice(2, 8),
      sourcePageId: activePage.id,
      sourceTitle: activePage.title || 'Sin título',
      sourcePath: state.getPageBreadcrumbPath(activePage),
      text: plain,
      html: sanitizeInternalHtml(box.innerHTML),
      comment: '',
      status: 'open',
      createdAt: now,
      updatedAt: now
    };

    const data = state.getData();
    data.topicItems.push(newItem);
    fsService.scheduleSave();
    state.notify('topic_item_added', { item: newItem });
    toastSuccess('Añadido a 👁️ Temas Pendientes.');
    return true;
  }

  updateTopicComment(itemId, comment) {
    const item = this.getTopicItems().find((x) => x.id === itemId);
    if (!item) return;
    item.comment = comment;
    item.updatedAt = Date.now();
    fsService.scheduleSave();
  }

  toggleTopicStatus(itemId) {
    const item = this.getTopicItems().find((x) => x.id === itemId);
    if (!item) return;
    item.status = item.status === 'done' ? 'open' : 'done';
    item.updatedAt = Date.now();
    fsService.scheduleSave();
    state.notify('topic_item_updated', { item });
  }

  deleteTopicItem(itemId) {
    const data = state.getData();
    data.topicItems = (data.topicItems || []).filter((x) => x.id !== itemId);
    fsService.scheduleSave();
    state.notify('topic_item_deleted', { itemId });
    toastSuccess('Tema pendiente eliminado');
  }
}

export const topicService = new TopicService();
