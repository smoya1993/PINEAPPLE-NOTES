/**
 * Gestor de Estado Centralizado y Reactivo con Sistema Pub/Sub
 */

import {
  STORAGE_KEYS,
  SPECIAL_PAGES,
  TOOL_PAGE_IDS,
  READONLY_SPECIAL_PAGE_IDS,
  DEFAULT_TIME_SETTINGS,
  INITIAL_DATA
} from '../config/constants.js';

class StateStore {
  constructor() {
    this.subscribers = new Set();
    this.expandedPages = this.loadExpandedPages();
    this.favoritesCollapsed = localStorage.getItem(STORAGE_KEYS.FAVORITES_COLLAPSED) === '1';
    this.data = this.loadInitialData();
    this.normalize();
  }

  loadInitialData() {
    try {
      const stored =
        localStorage.getItem(STORAGE_KEYS.DATA) ||
        localStorage.getItem(STORAGE_KEYS.ENTERPRISE_DATA) ||
        localStorage.getItem(STORAGE_KEYS.LEGACY_DATA);
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
      const stored =
        localStorage.getItem(STORAGE_KEYS.EXPANDED) ||
        localStorage.getItem(STORAGE_KEYS.ENTERPRISE_EXPANDED) ||
        localStorage.getItem(STORAGE_KEYS.LEGACY_EXPANDED);
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

  isFavoritesCollapsed() {
    return this.favoritesCollapsed;
  }

  toggleFavoritesCollapsed() {
    this.favoritesCollapsed = !this.favoritesCollapsed;
    try {
      localStorage.setItem(STORAGE_KEYS.FAVORITES_COLLAPSED, this.favoritesCollapsed ? '1' : '0');
    } catch {}
    this.notify('tree_toggle', { key: 'favorites' });
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

  isToolPage(id) {
    return TOOL_PAGE_IDS.includes(id);
  }

  isReadonlySpecialPage(id) {
    return READONLY_SPECIAL_PAGE_IDS.includes(id);
  }

  getPageBreadcrumbPath(page) {
    const names = [];
    let p = page;
    while (p) {
      names.unshift(p.title || 'Sin título');
      p = this.data.pages.find((x) => x.id === p.parentId);
    }
    return names.join(' › ');
  }

  nextOrder(parentId) {
    const siblings = this.data.pages.filter((x) => (x.parentId || null) === (parentId || null));
    return siblings.length ? Math.max(...siblings.map((x) => x.order)) + 1 : 0;
  }

  siblings(page) {
    const toolIds = new Set(TOOL_PAGE_IDS);
    return this.data.pages
      .filter((x) => !toolIds.has(x.id) && (x.parentId || null) === (page.parentId || null))
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

  ensureTimeStructure() {
    if (!Array.isArray(this.data.timeEntries)) this.data.timeEntries = [];
    if (!this.data.timeTimer || typeof this.data.timeTimer !== 'object') this.data.timeTimer = null;
    if (!this.data.timeSettings || typeof this.data.timeSettings !== 'object') {
      this.data.timeSettings = structuredClone(DEFAULT_TIME_SETTINGS);
    } else {
      this.data.timeSettings = {
        ...structuredClone(DEFAULT_TIME_SETTINGS),
        ...this.data.timeSettings,
        categories: Array.isArray(this.data.timeSettings.categories)
          ? this.data.timeSettings.categories
          : structuredClone(DEFAULT_TIME_SETTINGS.categories),
        projects: Array.isArray(this.data.timeSettings.projects)
          ? this.data.timeSettings.projects
          : structuredClone(DEFAULT_TIME_SETTINGS.projects)
      };
    }

    let p = this.data.pages.find((x) => x.id === SPECIAL_PAGES.TIME_ID);
    if (!p) {
      const now = Date.now();
      p = {
        id: SPECIAL_PAGES.TIME_ID,
        title: 'Registro de tiempo',
        icon: '⏱️',
        parentId: null,
        order: this.nextOrder(null),
        content: '<p>Registro de tiempo.</p>',
        createdAt: now,
        updatedAt: now
      };
      this.data.pages.push(p);
    } else {
      p.title = 'Registro de tiempo';
      p.icon = '⏱️';
      p.parentId = null;
    }
  }

  ensureTopicStructure() {
    if (!Array.isArray(this.data.topicItems)) this.data.topicItems = [];
    let p = this.data.pages.find((x) => x.id === SPECIAL_PAGES.TOPICS_ID);
    if (!p) {
      const now = Date.now();
      p = {
        id: SPECIAL_PAGES.TOPICS_ID,
        title: 'Temas Pendientes',
        icon: '👁️',
        parentId: null,
        order: this.nextOrder(null),
        content: '<p>Temas pendientes centralizados.</p>',
        createdAt: now,
        updatedAt: now
      };
      this.data.pages.push(p);
    } else {
      p.title = 'Temas Pendientes';
      p.icon = '👁️';
      p.parentId = null;
    }
  }

  ensureTaskStructure() {
    if (!Array.isArray(this.data.taskItems)) this.data.taskItems = [];

    // Migrar 'tareas-raul' legacy a 'tareas' si existe
    const legacyTaskPage = this.data.pages.find((x) => x.id === SPECIAL_PAGES.LEGACY_TASKS_ID);
    const currentTaskPage = this.data.pages.find((x) => x.id === SPECIAL_PAGES.TASKS_ID);

    if (legacyTaskPage && !currentTaskPage) {
      legacyTaskPage.id = SPECIAL_PAGES.TASKS_ID;
      if (this.data.activeId === SPECIAL_PAGES.LEGACY_TASKS_ID) {
        this.data.activeId = SPECIAL_PAGES.TASKS_ID;
      }
    } else if (legacyTaskPage && currentTaskPage) {
      this.data.pages = this.data.pages.filter((x) => x.id !== SPECIAL_PAGES.LEGACY_TASKS_ID);
      if (this.data.activeId === SPECIAL_PAGES.LEGACY_TASKS_ID) {
        this.data.activeId = SPECIAL_PAGES.TASKS_ID;
      }
    }

    let p = this.data.pages.find((x) => x.id === SPECIAL_PAGES.TASKS_ID);
    if (!p) {
      const now = Date.now();
      p = {
        id: SPECIAL_PAGES.TASKS_ID,
        title: 'Tareas',
        icon: '✅',
        parentId: null,
        order: this.nextOrder(null),
        content: '<p>Gestor personal de tareas.</p>',
        createdAt: now,
        updatedAt: now
      };
      this.data.pages.push(p);
    } else {
      p.title = 'Tareas';
      p.icon = '✅';
      p.parentId = null;
    }
  }

  ensureMailStructure() {
    if (!Array.isArray(this.data.mailItems)) this.data.mailItems = [];
    if (!this.data.mailStates || typeof this.data.mailStates !== 'object') this.data.mailStates = {};

    let p = this.data.pages.find((x) => x.id === SPECIAL_PAGES.MAIL_ID);
    if (!p) {
      const now = Date.now();
      p = {
        id: SPECIAL_PAGES.MAIL_ID,
        title: 'Correos marcados WAF',
        icon: '📧',
        parentId: null,
        order: this.nextOrder(null),
        content: '<p>Correos importados desde la carpeta inbox.</p>',
        createdAt: now,
        updatedAt: now
      };
      this.data.pages.push(p);
    } else {
      p.title = 'Correos marcados WAF';
      p.icon = '📧';
    }
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

  normalize() {
    this.ensureTimeStructure();
    this.ensureTopicStructure();
    this.ensureTaskStructure();
    this.ensureMailStructure();

    if (!Array.isArray(this.data.meetingItems)) this.data.meetingItems = [];
    if (!Array.isArray(this.data.favorites)) this.data.favorites = [];
    const toolIds = new Set(TOOL_PAGE_IDS);
    this.data.favorites = [...new Set(this.data.favorites)].filter(
      (id) => !toolIds.has(id) && this.data.pages.some((p) => p.id === id)
    );

    this.ensureMeetingStructure();

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
