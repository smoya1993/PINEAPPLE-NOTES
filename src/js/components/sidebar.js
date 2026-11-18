/**
 * Componente de Barra Lateral: Bloque Tools, Widget de Cronómetro Activo,
 * Favoritos Plegables, Árbol de Páginas y Menú Contextual
 */

import { TOOL_PAGE_IDS, SPECIAL_PAGES } from '../config/constants.js';
import { state } from '../core/state.js';
import { fsService } from '../services/fsService.js';
import { timeService } from '../services/timeService.js';
import { $, esc, stripHtml } from '../utils/dom.js';
import { showConfirmModal } from '../utils/modal.js';
import { toastSuccess, toastWarning } from '../utils/toast.js';

class SidebarComponent {
  constructor() {
    this.menuPage = null;
    this.menuElement = $('menu');
    this.pagesContainer = $('pages');
    this.searchInput = $('search');

    this.initEvents();
  }

  initEvents() {
    this.searchInput.addEventListener('input', () => this.renderTree());

    // Cerrar menú al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (this.menuElement && !this.menuElement.contains(e.target) && !e.target.classList.contains('more')) {
        this.closeMenu();
      }
    });

    // Delegación de eventos del menú contextual
    if (this.menuElement) {
      this.menuElement.onclick = (e) => {
        const btn = e.target.closest('button');
        if (!btn || !this.menuPage) return;
        const action = btn.dataset.a;
        this.handleMenuAction(action, this.menuPage);
        this.closeMenu();
      };
    }
  }

  createNote(parentId = null) {
    const data = state.getData();
    const newNote = {
      id: 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      title: 'Sin título',
      icon: parentId ? '🗒️' : '📄',
      parentId: parentId,
      order: state.nextOrder(parentId),
      content: '<p><br></p>',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    data.pages.push(newNote);
    state.setActivePageId(newNote.id);
    fsService.scheduleSave();
    state.notify('note_created', { note: newNote });

    const titleInput = $('title');
    if (titleInput) {
      titleInput.focus();
      titleInput.select();
    }
  }

  openMenu(page, triggerButton) {
    this.menuPage = page;
    const favBtn = this.menuElement.querySelector('[data-a="fav"]');
    if (favBtn) {
      favBtn.textContent = state.isFavorite(page.id) ? '☆ Quitar de Favoritos' : '⭐ Añadir a Favoritos';
    }

    const rect = triggerButton.getBoundingClientRect();
    this.menuElement.classList.add('open');
    this.menuElement.style.left = `${Math.min(rect.left, window.innerWidth - 210)}px`;
    this.menuElement.style.top = `${Math.min(rect.bottom + 4, window.innerHeight - 240)}px`;
  }

  closeMenu() {
    if (this.menuElement) {
      this.menuElement.classList.remove('open');
    }
    this.menuPage = null;
  }

  async handleMenuAction(action, page) {
    const data = state.getData();

    switch (action) {
      case 'sub':
        this.createNote(page.id);
        break;

      case 'dup': {
        const copy = {
          ...page,
          id: 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          title: `${page.title} (copia)`,
          order: state.nextOrder(page.parentId),
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        data.pages.push(copy);
        state.setActivePageId(copy.id);
        fsService.scheduleSave();
        state.notify('note_duplicated', { copy });
        toastSuccess(`Nota "${copy.title}" duplicada`);
        break;
      }

      case 'fav':
        state.toggleFavorite(page.id);
        fsService.scheduleSave();
        break;

      case 'up':
        this.movePage(page, -1);
        break;

      case 'down':
        this.movePage(page, 1);
        break;

      case 'del':
        this.requestDelete(page);
        break;
    }
  }

  movePage(page, delta) {
    const siblings = state.siblings(page);
    const index = siblings.indexOf(page);
    const targetIndex = index + delta;

    if (targetIndex < 0 || targetIndex >= siblings.length) return;

    [siblings[index].order, siblings[targetIndex].order] = [
      siblings[targetIndex].order,
      siblings[index].order
    ];

    state.normalize();
    fsService.scheduleSave();
    this.renderTree();
  }

  async requestDelete(page) {
    const data = state.getData();
    if (data.pages.length === 1) {
      toastWarning('Debe existir al menos una nota.');
      return;
    }

    const idsToDelete = state.descendants(page.id);
    const count = idsToDelete.size;
    const msg =
      count > 1
        ? `Se eliminará “${page.title}” y sus ${count - 1} subnotas. Esta acción no se puede deshacer.`
        : `Se eliminará “${page.title}”. Esta acción no se puede deshacer.`;

    const confirmed = await showConfirmModal('Eliminar nota', msg, 'Eliminar', true);
    if (!confirmed) return;

    data.pages = data.pages.filter((x) => !idsToDelete.has(x.id));
    if (idsToDelete.has(data.activeId)) {
      data.activeId = data.pages[0]?.id || 'welcome';
    }

    state.normalize();
    fsService.scheduleSave();
    state.notify('note_deleted', { pageId: page.id });
    toastSuccess(`Nota "${page.title}" eliminada`);
  }

  pageMatchesSearch(page, query) {
    if (!query) return true;
    const haystack = `${page.title || ''} ${stripHtml(page.content || '')}`.toLowerCase();
    if (haystack.includes(query)) return true;
    return state
      .getData()
      .pages.filter((x) => x.parentId === page.id)
      .some((x) => this.pageMatchesSearch(x, query));
  }

  renderTree() {
    if (!this.pagesContainer) return;
    const query = this.searchInput.value.trim().toLowerCase();
    if (!query) state.expandActivePath();

    const data = state.getData();
    const activePage = state.getActivePage();
    const systemIds = new Set(TOOL_PAGE_IDS);

    const rootPages = data.pages
      .filter((p) => !systemIds.has(p.id) && (!p.parentId || !data.pages.some((x) => x.id === p.parentId)))
      .sort((a, b) => a.order - b.order);

    this.pagesContainer.innerHTML = '';

    const makeRow = (p, depth, context = 'normal') => {
      const children = data.pages
        .filter((x) => x.parentId === p.id && !systemIds.has(x.id))
        .sort((a, b) => a.order - b.order);
      const hasChildren = children.length > 0;
      const stateId = context === 'favorite' ? `fav:${p.id}` : p.id;
      const isOpen = query ? true : state.isExpanded(stateId);

      const row = document.createElement('div');
      row.className =
        `nav depth-${Math.min(depth, 3)}` +
        (p.id === activePage?.id ? ' active' : '') +
        (context === 'favorite' ? ' favorite-nav' : '') +
        (context === 'tool' ? ' tool-nav' : '');
      row.draggable = context === 'normal';

      row.innerHTML = `
        <button class="tree-toggle${hasChildren ? '' : ' placeholder'}" type="button" aria-label="${isOpen ? 'Contraer' : 'Expandir'}" title="${isOpen ? 'Contraer' : 'Expandir'}">${isOpen ? '▼' : '▶'}</button>
        <span class="nav-icon">${esc(p.icon || '📄')}</span>
        <span class="name">${esc(p.title || 'Sin título')}</span>
        <button class="more" type="button" title="Opciones">•••</button>
      `;

      const toggle = row.querySelector('.tree-toggle');
      toggle.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!hasChildren) return;
        state.toggleExpanded(stateId);
        this.renderTree();
      };

      row.onclick = (e) => {
        if (e.target.classList.contains('more')) {
          e.stopPropagation();
          this.openMenu(p, e.target);
        } else if (!e.target.closest('.tree-toggle')) {
          state.setActivePageId(p.id);
        }
      };

      if (context === 'normal') {
        row.ondragstart = (e) => {
          row.classList.add('dragging');
          e.dataTransfer.setData('text/plain', p.id);
        };
        row.ondragend = () => row.classList.remove('dragging');
        row.ondragover = (e) => {
          e.preventDefault();
          row.classList.add('over');
        };
        row.ondragleave = () => row.classList.remove('over');
        row.ondrop = (e) => {
          e.preventDefault();
          row.classList.remove('over');
          const draggedId = e.dataTransfer.getData('text/plain');
          const draggedPage = data.pages.find((x) => x.id === draggedId);
          if (
            !draggedPage ||
            draggedPage.id === p.id ||
            (draggedPage.parentId || null) !== (p.parentId || null)
          ) {
            return;
          }
          const siblings = state.siblings(p).filter((x) => x.id !== draggedPage.id);
          const targetIdx = siblings.findIndex((x) => x.id === p.id);
          siblings.splice(targetIdx, 0, draggedPage);
          siblings.forEach((x, idx) => (x.order = idx));
          state.normalize();
          fsService.scheduleSave();
          this.renderTree();
        };
      }

      return { row, children, isOpen };
    };

    const addRecursive = (p, depth, context = 'normal', target = this.pagesContainer) => {
      if (!this.pageMatchesSearch(p, query)) return;
      const built = makeRow(p, depth, context);
      target.appendChild(built.row);
      if (built.isOpen) {
        built.children.forEach((child) => addRecursive(child, depth + 1, context, target));
      }
    };

    // 1. Bloque Tools (Tareas, Temas Pendientes, Registro de tiempo)
    const toolsBlock = document.createElement('div');
    toolsBlock.className = 'tools-block';
    toolsBlock.innerHTML = '<div class="label">Tools</div>';
    this.pagesContainer.appendChild(toolsBlock);

    TOOL_PAGE_IDS.map((id) => data.pages.find((p) => p.id === id))
      .filter(Boolean)
      .forEach((p) => {
        toolsBlock.appendChild(makeRow(p, 0, 'tool').row);
      });

    // 2. Widget Flotante de Cronómetro Activo en Sidebar
    const timerWidget = document.createElement('div');
    timerWidget.id = 'activeTimerWidget';
    timerWidget.className = 'active-timer-widget' + (data.timeTimer ? '' : ' hidden');
    timerWidget.innerHTML = data.timeTimer
      ? `<div class="active-timer-title">⏱️ ${esc(data.timeTimer.activity || 'Actividad')}</div>
         <div class="active-timer-clock">${timeService.formatClock(timeService.timerElapsedMs())}</div>`
      : '';
    timerWidget.onclick = () => state.setActivePageId(SPECIAL_PAGES.TIME_ID);
    this.pagesContainer.appendChild(timerWidget);

    // 3. Sección de Favoritos Plegable
    const favorites = (data.favorites || [])
      .map((id) => data.pages.find((p) => p.id === id))
      .filter((p) => p && !systemIds.has(p.id))
      .filter((p) => this.pageMatchesSearch(p, query));

    const favCollapsed = state.isFavoritesCollapsed();
    const favWrap = document.createElement('div');
    favWrap.className = 'favorites-block';
    favWrap.innerHTML = `
      <div class="favorites-heading">
        <span class="favorites-chevron">${favCollapsed ? '›' : '⌄'}</span>
        <span>Favoritos</span>
        <span class="favorites-count">${favorites.length}</span>
      </div>
      <div class="favorites-content${favCollapsed ? ' collapsed' : ''}"></div>
    `;
    this.pagesContainer.appendChild(favWrap);

    favWrap.querySelector('.favorites-heading').onclick = () => {
      state.toggleFavoritesCollapsed();
      this.renderTree();
    };

    const favContent = favWrap.querySelector('.favorites-content');
    if (favorites.length) {
      favorites.forEach((p) => addRecursive(p, 0, 'favorite', favContent));
    } else {
      favContent.innerHTML =
        '<div class="favorite-empty">Usa ☆ junto al título o el menú ••• para añadir notas y carpetas.</div>';
    }

    // 4. Sección principal de Notas
    this.pagesContainer.insertAdjacentHTML('beforeend', '<div class="label">Notas</div>');
    rootPages.forEach((p) => addRecursive(p, 0, 'normal', this.pagesContainer));
  }
}

export const sidebar = new SidebarComponent();
