/**
 * Gestor de Estado Centralizado y Reactivo con Sistema Pub/Sub
 */

import { STORAGE_KEYS, SPECIAL_PAGES, INITIAL_DATA } from '../config/constants.js';

class StateStore {
  constructor() {
    this.subscribers = new Set();
    this.expandedPages = this.loadExpandedPages();
    this.data = this.loadInitialData();
    this.normalize();
  }

  loadInitialData() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.DATA) || localStorage.getItem(STORAGE_KEYS.LEGACY_DATA);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && Array.isArray(parsed.pages) && parsed.pages.length) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error al leer datos locales, usando semilla inicial', e);
    }
    return structuredClone(INITIAL_DATA);
  }

  loadExpandedPages() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.EXPANDED) || localStorage.getItem(STORAGE_KEYS.LEGACY_EXPANDED);
      return new Set(JSON.parse(stored) || []);
    } catch {
      return new Set();
    }
  }

  saveExpandedPages() {
    try {
      localStorage.setItem(STORAGE_KEYS.EXPANDED, JSON.stringify([...this.expandedPages]));
    } catch (e) {
      console.warn('No se pudo guardar el estado del árbol', e);
    }
  }

  isExpanded(key) {
    return this.expandedPages.has(key);
  }

  toggleExpanded(key) {
    if (this.expandedPages.has(key)) {
      this.expandedPages.delete(key);
    } else {
      this.expandedPages.add(key);
    }
    this.saveExpandedPages();
    this.notify('tree_toggle', { key });
  }

  expandActivePath() {
    let p = this.getActivePage();
    while (p?.parentId) {
      this.expandedPages.add(p.parentId);
      p = this.data.pages.find((x) => x.id === p.parentId);
    }
    this.saveExpandedPages();
  }

  subscribe(listener) {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  notify(event, payload = {}) {
    for (const sub of this.subscribers) {
      try {
        sub(event, payload, this.data);
      } catch (err) {
        console.error('Error en listener de estado:', err);
      }
    }
  }

  getData() {
    return this.data;
  }

  setData(newData, notifyEvent = 'data_replaced') {
    this.data = newData;
    this.normalize();
    this.notify(notifyEvent);
  }

  getActivePage() {
    return this.data.pages.find((p) => p.id === this.data.activeId) || this.data.pages[0];
  }

  setActivePageId(id) {
    if (this.data.activeId !== id) {
      this.data.activeId = id;
      this.expandActivePath();
      this.notify('active_page_changed', { id });
    }
  }

  nextOrder(parentId) {
    const siblings = this.data.pages.filter((x) => (x.parentId || null) === (parentId || null));
    return siblings.length ? Math.max(...siblings.map((x) => x.order)) + 1 : 0;
  }

  siblings(page) {
    return this.data.pages
      .filter((x) => (x.parentId || null) === (page.parentId || null))
      .sort((a, b) => a.order - b.order);
  }

  descendants(id) {
    const out = new Set([id]);
    let more = true;
    while (more) {
      more = false;
      this.data.pages.forEach((x) => {
        if (out.has(x.parentId) && !out.has(x.id)) {
          out.add(x.id);
          more = true;
        }
      });
    }
    return out;
  }

  isFavorite(id) {
    return Array.isArray(this.data.favorites) && this.data.favorites.includes(id);
  }

  toggleFavorite(pageId) {
    if (!pageId || pageId === 'favoritos') return false;
    if (!Array.isArray(this.data.favorites)) this.data.favorites = [];
    
    if (this.isFavorite(pageId)) {
      this.data.favorites = this.data.favorites.filter((id) => id !== pageId);
    } else {
      this.data.favorites.push(pageId);
    }
    this.notify('favorites_changed', { pageId });
    return true;
  }

  ensureMeetingStructure() {
    const now = Date.now();
    let meetings = this.data.pages.find((p) => p.id === 'reuniones');
    if (!meetings) {
      meetings = {
        id: 'reuniones',
        title: 'Reuniones',
        icon: '📅',
        parentId: null,
        order: this.nextOrder(null),
        content: '<p>Notas, acuerdos y acciones de reuniones.</p>',
        createdAt: now,
        updatedAt: now
      };
      this.data.pages.push(meetings);
    }

    let internal = this.data.pages.find((p) => p.id === 'reuniones-internas-deloitte');
    if (!internal) {
      internal = {
        id: 'reuniones-internas-deloitte',
        title: 'Internas Deloitte',
        icon: '🏠',
        parentId: meetings.id,
        order: this.nextOrder(meetings.id),
        content: '<p></p>',
        createdAt: now,
        updatedAt: now
      };
      this.data.pages.push(internal);
    } else if (internal.parentId !== meetings.id) {
      internal.parentId = meetings.id;
    }

    let page = this.data.pages.find((p) => p.id === SPECIAL_PAGES.MEETINGS_ID);
    if (!page) {
      page = {
        id: SPECIAL_PAGES.MEETINGS_ID,
        title: 'Reuniones internas · Cosas que comentar',
        icon: '💬',
        parentId: null,
        order: this.nextOrder(null),
        content: '<p>Esta página se genera automáticamente.</p>',
        createdAt: now,
        updatedAt: now
      };
      this.data.pages.push(page);
    } else {
      page.title = 'Reuniones internas · Cosas que comentar';
      page.icon = '💬';
      if (page.parentId !== null) {
        page.parentId = null;
        page.order = this.nextOrder(null);
      }
    }
  }

  ensureTasksStructure() {
    const now = Date.now();
    let page = this.data.pages.find((p) => p.id === SPECIAL_PAGES.TASKS_ID);
    let home = this.data.pages.find((p) => p.id === 'inicio');

    if (!page) {
      this.data.pages
        .filter((p) => p.parentId === null && p.order >= 1)
        .forEach((p) => p.order++);

      page = {
        id: SPECIAL_PAGES.TASKS_ID,
        title: 'Tareas Raúl',
        icon: '✅',
        parentId: null,
        order: home ? 1 : 0,
        content: '<p>Gestor personal de tareas.</p>',
        createdAt: now,
        updatedAt: now
      };
      this.data.pages.push(page);
    } else {
      page.title = 'Tareas Raúl';
      page.icon = '✅';
      page.parentId = null;
    }
  }

  normalize() {
    if (!Array.isArray(this.data.meetingItems)) this.data.meetingItems = [];
    if (!Array.isArray(this.data.taskItems)) this.data.taskItems = [];

    if (!Array.isArray(this.data.favorites)) this.data.favorites = [];
    this.data.favorites = [...new Set(this.data.favorites)].filter((id) =>
      this.data.pages.some((p) => p.id === id)
    );

    // Asegurar que activeId apunta a una página existente
    if (this.data.pages.length && !this.data.pages.some((p) => p.id === this.data.activeId)) {
      this.data.activeId = this.data.pages[0].id;
    }

    // Reordenar páginas para garantizar secuencias válidas por nivel
    const groups = {};
    this.data.pages.forEach((p, i) => {
      p.order = Number.isFinite(p.order) ? p.order : i;
      (groups[p.parentId || '_'] ??= []).push(p);
    });

    Object.values(groups).forEach((group) => {
      group
        .sort((a, b) => a.order - b.order)
        .forEach((p, i) => {
          p.order = i;
        });
    });
  }
}

export const state = new StateStore();
