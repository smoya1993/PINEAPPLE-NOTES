/**
 * Controlador Principal del Editor de Texto Enriquecido
 */

import { SPECIAL_PAGES, CODE_LANGUAGES } from '../config/constants.js';
import { state } from '../core/state.js';
import { fsService } from '../services/fsService.js';
import { tasksView } from './tasksView.js';
import { meetingsView } from './meetingsView.js';
import { toolbar } from './toolbar.js';
import { sidebar } from './sidebar.js';
import { $, $$, esc, getDocStats, formatDate, formatDueDate } from '../utils/dom.js';
import { showPromptModal, showConfirmModal } from '../utils/modal.js';
import { toastSuccess } from '../utils/toast.js';

class EditorComponent {
  constructor() {
    this.editor = $('editor');
    this.titleInput = $('title');
    this.iconBtn = $('icon');
    this.favoriteBtn = $('favoriteBtn');
    this.crumbSpan = $('crumb');
    this.statsBar = null;
    this.selectedImg = null;
    this.imgBar = $('imgbar');

    this.init();
  }

  init() {
    this.createStatsBar();
    this.bindEvents();
  }

  createStatsBar() {
    if (!$('editorStatsBar')) {
      const bar = document.createElement('div');
      bar.id = 'editorStatsBar';
      bar.className = 'editor-stats-bar';
      bar.innerHTML = '<span id="docWordCount">0 palabras</span> · <span id="docCharCount">0 caracteres</span> · <span id="docReadingTime">1 min de lectura</span>';
      this.editor.parentElement.appendChild(bar);
      this.statsBar = bar;
    }
  }

  updateStats() {
    const page = state.getActivePage();
    const statsBar = $('editorStatsBar');
    if (!statsBar) return;

    if (page.id === SPECIAL_PAGES.MEETINGS_ID || page.id === SPECIAL_PAGES.TASKS_ID) {
      statsBar.style.display = 'none';
      return;
    }

    statsBar.style.display = 'flex';
    const stats = getDocStats(this.editor.innerHTML);
    $('docWordCount').textContent = `${stats.words} palabra${stats.words === 1 ? '' : 's'}`;
    $('docCharCount').textContent = `${stats.chars} caracter${stats.chars === 1 ? '' : 'es'}`;
    $('docReadingTime').textContent = `${stats.readingTimeMinutes} min de lectura aprox.`;
  }

  render() {
    const page = state.getActivePage();
    if (!page) return;

    // Actualizar título e icono
    this.titleInput.value = page.title || '';
    this.iconBtn.textContent = page.icon || '📄';
    this.updateFavoriteButton();

    // Actualizar Breadcrumbs con ancestros clicables
    this.renderBreadcrumbs(page);

    // Comprobar si es página especial
    const isSpecial = page.id === SPECIAL_PAGES.MEETINGS_ID || page.id === SPECIAL_PAGES.TASKS_ID;
    this.editor.setAttribute('contenteditable', isSpecial ? 'false' : 'true');

    if (page.id === SPECIAL_PAGES.MEETINGS_ID) {
      meetingsView.render(this.editor);
    } else if (page.id === SPECIAL_PAGES.TASKS_ID) {
      tasksView.render(this.editor);
    } else {
      this.editor.innerHTML = page.content || '<p><br></p>';
      this.bindEditorEnhancements();
    }

    this.updateStats();
    toolbar.updateActiveStates();
  }

  renderBreadcrumbs(page) {
    const crumbs = [];
    let current = page;
    const data = state.getData();

    while (current) {
      crumbs.unshift({ id: current.id, title: current.title || 'Sin título' });
      current = data.pages.find((x) => x.id === current.parentId);
    }

    this.crumbSpan.innerHTML = 'Pineapple Notes › ' + crumbs
      .map((c, i) => i === crumbs.length - 1
        ? `<b>${esc(c.title)}</b>`
        : `<span class="crumb-part" data-page-id="${c.id}">${esc(c.title)}</span>`)
      .join(' › ');

    $$('.crumb-part', this.crumbSpan).forEach((el) => {
      el.onclick = () => {
        state.setActivePageId(el.dataset.pageId);
      };
    });
  }

  updateFavoriteButton() {
    const page = state.getActivePage();
    const isFav = state.isFavorite(page?.id);
    this.favoriteBtn.textContent = isFav ? '★' : '☆';
    this.favoriteBtn.classList.toggle('active', isFav);
    this.favoriteBtn.title = isFav ? 'Quitar de Favoritos' : 'Añadir a Favoritos';
    this.favoriteBtn.setAttribute('aria-label', this.favoriteBtn.title);
  }

  sync() {
    const page = state.getActivePage();
    if (!page) return;

    page.title = this.titleInput.value;

    if (page.id !== SPECIAL_PAGES.MEETINGS_ID && page.id !== SPECIAL_PAGES.TASKS_ID) {
      this.normalizeBlocks();
      
      // Asegurar que el contenido del textarea de código esté sincronizado
      $$('.code-block', this.editor).forEach((block) => {
        const input = block.querySelector('.code-input');
        if (input) input.textContent = input.value;
      });

      page.content = this.editor.innerHTML;
    }

    page.updatedAt = Date.now();
    this.updateStats();
    sidebar.renderTree();
    fsService.scheduleSave();
  }

  normalizeBlocks() {
    // Evitar anidamientos erróneos producidos por execCommand
    $$('h1 h1, h1 h2, h1 p, h2 h1, h2 h2, h2 p', this.editor).forEach((inner) => {
      const outer = inner.parentElement;
      if (inner === outer) return;
      while (inner.firstChild) outer.insertBefore(inner.firstChild, inner);
      inner.remove();
    });

    $$('h1:empty, h2:empty', this.editor).forEach((h) => {
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      h.replaceWith(p);
    });
  }

  bindEditorEnhancements() {
    this.bindCodeBlocks();
    this.bindImportantBlocks();
    this.bindTaskWidgets();
    this.normalizeBlocks();
  }

  bindTaskWidgets() {
    $$('.task-widget-block', this.editor).forEach((block) => {
      let after = block.nextElementSibling;
      if (!after || !after.classList.contains('code-after')) {
        after = document.createElement('p');
        after.className = 'code-after';
        after.innerHTML = '<br>';
        block.after(after);
      }

      block.setAttribute('contenteditable', 'false');

      // Prevenir que clics y eventos de teclado dentro del widget interfieran con el contenteditable
      block.addEventListener('mousedown', (e) => e.stopPropagation());
      block.addEventListener('click', (e) => e.stopPropagation());
      block.addEventListener('keydown', (e) => e.stopPropagation());

      const delWidgetBtn = block.querySelector('.task-widget-delete');
      if (delWidgetBtn && !delWidgetBtn.__bound) {
        delWidgetBtn.__bound = true;
        delWidgetBtn.onclick = async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const confirmed = await showConfirmModal(
            'Eliminar Widget de Tareas',
            '¿Deseas eliminar este bloque de tareas de la nota?',
            'Eliminar',
            true
          );
          if (confirmed) {
            const nextAfter = block.nextElementSibling;
            block.remove();
            if (nextAfter?.classList.contains('code-after') && !nextAfter.textContent.trim()) {
              nextAfter.remove();
            }
            this.sync();
            this.editor.focus();
          }
        };
      }

      this.renderTaskWidgetBody(block);
    });
  }

  renderTaskWidgetBody(block) {
    const body = block.querySelector('.task-widget-body');
    if (!body) return;

    let tasks = [];
    try {
      tasks = JSON.parse(block.dataset.tasks || '[]');
    } catch {
      tasks = [];
    }

    const currentFilter = block.dataset.filter || 'pending';
    const pending = tasks.filter((x) => x.status !== 'done');
    const done = tasks.filter((x) => x.status === 'done');

    const rank = { high: 0, normal: 1, low: 2 };
    const all = [...tasks].sort((a, b) => {
      const doneDiff = (a.status === 'done') - (b.status === 'done');
      if (doneDiff !== 0) return doneDiff;
      const rankDiff = (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1);
      if (rankDiff !== 0) return rankDiff;
      const dateA = a.dueDate || '9999-99-99';
      const dateB = b.dueDate || '9999-99-99';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return b.createdAt - a.createdAt;
    });

    const visible = currentFilter === 'all'
      ? all
      : all.filter((x) => (x.status === 'done' ? 'done' : 'pending') === currentFilter);

    body.innerHTML = `
      <div class="todo-panel">
        <input class="widget-todo-title" placeholder="¿Qué tienes pendiente por hacer?" maxlength="240">
        <select class="widget-todo-priority">
          <option value="normal">Prioridad Normal</option>
          <option value="high">Prioridad Alta</option>
          <option value="low">Prioridad Baja</option>
        </select>
        <input class="widget-todo-due" type="date" title="Fecha límite">
        <button class="widget-todo-add" type="button">＋ Añadir</button>
        <input class="widget-todo-details todo-details" placeholder="Detalles o notas adicionales opcionales..." maxlength="1000">
      </div>
      <div class="todo-filters">
        <button type="button" data-wtf="pending" class="${currentFilter === 'pending' ? 'active' : ''}">Pendientes (${pending.length})</button>
        <button type="button" data-wtf="done" class="${currentFilter === 'done' ? 'active' : ''}">Completadas (${done.length})</button>
        <button type="button" data-wtf="all" class="${currentFilter === 'all' ? 'active' : ''}">Todas (${all.length})</button>
        <span class="todo-summary">${pending.length} pendiente${pending.length === 1 ? '' : 's'}</span>
      </div>
      <div class="widget-todo-list"></div>
    `;

    const titleInput = body.querySelector('.widget-todo-title');
    const prioritySelect = body.querySelector('.widget-todo-priority');
    const dueInput = body.querySelector('.widget-todo-due');
    const detailsInput = body.querySelector('.widget-todo-details');
    const addBtn = body.querySelector('.widget-todo-add');

    const handleAddTask = () => {
      const title = titleInput.value.trim();
      if (!title) return;

      const now = Date.now();
      tasks.push({
        id: 'wt_' + now.toString(36) + Math.random().toString(36).slice(2, 6),
        title: title,
        details: detailsInput.value.trim(),
        priority: prioritySelect.value || 'normal',
        dueDate: dueInput.value || '',
        status: 'pending',
        createdAt: now,
        completedAt: null
      });

      block.dataset.tasks = JSON.stringify(tasks);
      this.renderTaskWidgetBody(block);
      this.sync();
    };

    addBtn.onclick = handleAddTask;
    titleInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddTask();
      }
    };

    // Filtros de pestañas
    $$('[data-wtf]', body).forEach((btn) => {
      btn.onclick = () => {
        block.dataset.filter = btn.dataset.wtf;
        this.renderTaskWidgetBody(block);
      };
    });

    const list = body.querySelector('.widget-todo-list');
    if (!visible.length) {
      list.innerHTML = '<div class="todo-empty" style="padding: 24px 16px;">No hay tareas en esta vista.</div>';
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    visible.forEach((item) => {
      const card = document.createElement('div');
      const priority = item.priority || 'normal';
      const isDone = item.status === 'done';
      const isOverdue = !isDone && item.dueDate && item.dueDate < todayStr;

      card.className = `todo-item priority-${priority}${isDone ? ' done' : ''}`;

      const priorityLabel = priority === 'high' ? 'Alta' : priority === 'low' ? 'Baja' : 'Normal';

      card.innerHTML = `
        <div class="todo-item-title">${esc(item.title)}</div>
        ${item.details ? `<div class="todo-item-details">${esc(item.details)}</div>` : ''}
        <div class="todo-item-meta">
          <span class="todo-badge">Prioridad: ${priorityLabel}</span>
          ${item.dueDate ? `<span class="todo-badge ${isOverdue ? 'todo-overdue' : ''}">${isOverdue ? '⚠️ Vencida: ' : 'Fecha límite: '}${esc(formatDueDate(item.dueDate))}</span>` : ''}
          <span>Creada: ${esc(formatDate(item.createdAt))}</span>
          ${item.completedAt ? `<span>Completada: ${esc(formatDate(item.completedAt))}</span>` : ''}
        </div>
        <div class="todo-actions">
          <button data-wta="toggle" type="button">${isDone ? 'Marcar pendiente' : 'Marcar completada'}</button>
          <button data-wta="edit" type="button">Editar</button>
          <button data-wta="delete" type="button" class="todo-delete">Eliminar</button>
        </div>
      `;

      card.querySelector('[data-wta="toggle"]').onclick = () => {
        item.status = item.status === 'done' ? 'pending' : 'done';
        item.completedAt = item.status === 'done' ? Date.now() : null;
        block.dataset.tasks = JSON.stringify(tasks);
        this.renderTaskWidgetBody(block);
        this.sync();
      };

      card.querySelector('[data-wta="edit"]').onclick = async () => {
        const newTitle = await showPromptModal('Editar Tarea', 'Título de la tarea:', item.title);
        if (newTitle === null) return;
        if (!newTitle.trim()) return;

        const newDetails = await showPromptModal('Editar Tarea', 'Detalles o notas adicionales:', item.details || '');
        if (newDetails === null) return;

        item.title = newTitle.trim();
        item.details = newDetails.trim();
        block.dataset.tasks = JSON.stringify(tasks);
        this.renderTaskWidgetBody(block);
        this.sync();
      };

      card.querySelector('[data-wta="delete"]').onclick = async () => {
        const confirmed = await showConfirmModal(
          'Eliminar Tarea',
          `¿Deseas eliminar la tarea "${item.title}"?`,
          'Eliminar',
          true
        );
        if (confirmed) {
          tasks = tasks.filter((t) => t.id !== item.id);
          block.dataset.tasks = JSON.stringify(tasks);
          this.renderTaskWidgetBody(block);
          this.sync();
        }
      };

      list.appendChild(card);
    });
  }

  bindImportantBlocks() {
    $$('.important-callout', this.editor).forEach((block) => {
      if (block.__impBound) return;
      block.__impBound = true;
      block.setAttribute('contenteditable', 'false');

      const text = block.querySelector('.important-text');
      if (text) text.setAttribute('contenteditable', 'false');

      let del = block.querySelector('.important-delete');
      if (!del) {
        del = document.createElement('button');
        del.type = 'button';
        del.className = 'important-delete';
        del.title = 'Eliminar importante';
        del.textContent = '✕';
        block.appendChild(del);
      }

      del.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        block.remove();
        this.sync();
      };
    });
  }

  highlightCodeSyntax(raw, lang) {
    const langConfig = CODE_LANGUAGES[lang];
    const keywords = (langConfig?.keywords || '').split(' ').filter(Boolean);
    const kwRegex = keywords.length ? new RegExp(`\\b(${keywords.join('|')})\\b`, lang === 'sql' ? 'gi' : 'g') : null;

    let output = '';
    let lastIndex = 0;
    const tokenRegex = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*|`(?:\\.|[^`])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b/g;

    raw.replace(tokenRegex, (match, offset) => {
      let chunk = esc(raw.slice(lastIndex, offset));
      if (kwRegex) chunk = chunk.replace(kwRegex, '<span class="tok-k">$&</span>');
      output += chunk;

      const cls = /^(\/\*|\/\/|#)/.test(match)
        ? 'tok-c'
        : /^[`"']/.test(match)
        ? 'tok-s'
        : 'tok-n';

      output += `<span class="${cls}">${esc(match)}</span>`;
      lastIndex = offset + match.length;
    });

    let tail = esc(raw.slice(lastIndex));
    if (kwRegex) tail = tail.replace(kwRegex, '<span class="tok-k">$&</span>');
    output += tail;

    if (lang === 'html') {
      output = output.replace(/(&lt;\/?)([\w-]+)/g, '$1<span class="tok-t">$2</span>');
    }

    return output + (raw.endsWith('\n') ? '\n' : '');
  }

  updateCodeBlock(block) {
    const input = block.querySelector('.code-input');
    const view = block.querySelector('.code-view');
    const langSelect = block.querySelector('.code-lang');
    if (!input || !view || !langSelect) return;

    const lang = langSelect.value;
    view.innerHTML = this.highlightCodeSyntax(input.value, lang);
    view.scrollTop = input.scrollTop;
    view.scrollLeft = input.scrollLeft;
    input.textContent = input.value;
    block.dataset.language = lang;
  }

  bindCodeBlocks() {
    $$('.code-block', this.editor).forEach((block) => {
      let after = block.nextElementSibling;
      if (!after || !after.classList.contains('code-after')) {
        after = document.createElement('p');
        after.className = 'code-after';
        after.innerHTML = '<br>';
        block.after(after);
      }

      if (block.__pineappleCodeBound) return;
      block.__pineappleCodeBound = true;

      const head = block.querySelector('.code-head');
      head?.addEventListener('mousedown', (e) => e.stopPropagation());
      head?.addEventListener('click', (e) => e.stopPropagation());

      const input = block.querySelector('.code-input');
      const langSelect = block.querySelector('.code-lang');
      const copyBtn = block.querySelector('.code-copy');
      const delBtn = block.querySelector('.code-delete');

      if (input) {
        input.value = input.textContent || '';
        input.oninput = () => {
          this.updateCodeBlock(block);
          this.sync();
        };
        input.onscroll = () => this.updateCodeBlock(block);
        input.onkeydown = (e) => {
          e.stopPropagation();
          if (e.key === 'Tab') {
            e.preventDefault();
            input.setRangeText('  ', input.selectionStart, input.selectionEnd, 'end');
            this.updateCodeBlock(block);
            this.sync();
          }
        };
        ['beforeinput', 'keyup', 'paste'].forEach((ev) => {
          input.addEventListener(ev, (e) => e.stopPropagation());
        });
      }

      if (langSelect) {
        langSelect.onchange = () => {
          this.updateCodeBlock(block);
          this.sync();
        };
      }

      if (copyBtn) {
        copyBtn.onclick = async () => {
          if (!input) return;
          await navigator.clipboard.writeText(input.value);
          copyBtn.textContent = '¡Copiado!';
          setTimeout(() => (copyBtn.textContent = 'Copiar'), 1000);
          toastSuccess('Código copiado al portapapeles');
        };
      }

      if (delBtn) {
        delBtn.onclick = async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const confirmed = await showConfirmModal(
            'Eliminar Bloque de Código',
            '¿Deseas eliminar este bloque de código?',
            'Eliminar',
            true
          );
          if (confirmed) {
            const nextAfter = block.nextElementSibling;
            block.remove();
            if (nextAfter?.classList.contains('code-after') && !nextAfter.textContent.trim()) {
              nextAfter.remove();
            }
            this.sync();
            this.editor.focus();
          }
        };
      }

      this.updateCodeBlock(block);
    });
  }

  selectImage(img) {
    if (this.selectedImg) this.selectedImg.classList.remove('selected');
    this.selectedImg = img;

    if (!img) {
      this.imgBar.classList.remove('open');
      return;
    }

    img.classList.add('selected');
    const rect = img.getBoundingClientRect();
    this.imgBar.classList.add('open');
    this.imgBar.style.left = `${Math.max(10, rect.left)}px`;
    this.imgBar.style.top = `${Math.max(56, rect.top - 46)}px`;
    $('pct').textContent = `${Math.round(parseFloat(img.style.width) || 100)}%`;
  }

  bindEvents() {
    this.titleInput.addEventListener('input', () => this.sync());
    this.editor.addEventListener('input', () => {
      this.sync();
      toolbar.updateActiveStates();
    });

    // Icono emoji modal prompt
    this.iconBtn.onclick = async () => {
      const page = state.getActivePage();
      const newIcon = await showPromptModal('Icono de la nota', 'Introduce un emoji o símbolo para la nota:', page.icon || '📄');
      if (newIcon !== null) {
        page.icon = newIcon.trim() || '📄';
        this.render();
        this.sync();
      }
    };

    // Botón de Favorito
    this.favoriteBtn.onclick = () => {
      const page = state.getActivePage();
      state.toggleFavorite(page.id);
      this.updateFavoriteButton();
      sidebar.renderTree();
      fsService.scheduleSave();
    };

    // Tecla Tab en listas
    this.editor.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount || !this.editor.contains(sel.anchorNode)) return;
        const node = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
        const li = node.closest('li');
        if (li) {
          e.preventDefault();
          document.execCommand(e.shiftKey ? 'outdent' : 'indent', false, null);
          this.sync();
          toolbar.updateActiveStates();
        }
      }
    }, true);

    // Selección de imagen y click en el editor
    this.editor.onclick = (e) => {
      if (e.target.closest('.code-block, .important-callout')) return;
      if (e.target.tagName === 'IMG') {
        this.selectImage(e.target);
      } else {
        this.selectImage(null);
      }
      if (e.target.classList.contains('code-after')) {
        document.execCommand('formatBlock', false, 'p');
      }
      toolbar.updateActiveStates();
    };

    // Sincronizar barra de estado en selección
    ['keyup', 'mouseup', 'selectionchange'].forEach((ev) => {
      (ev === 'selectionchange' ? document : this.editor).addEventListener(ev, () => {
        toolbar.updateActiveStates();
      });
    });

    // Barra flotante de redimensionamiento de imágenes
    this.imgBar.onclick = (e) => {
      const btn = e.target.closest('button');
      if (!btn || !this.selectedImg) return;
      const zoom = btn.dataset.z;

      if (zoom === 'reset') {
        this.selectedImg.style.width = '100%';
      } else {
        const current = parseFloat(this.selectedImg.style.width) || 100;
        const next = Math.max(10, Math.min(100, current + Number(zoom)));
        this.selectedImg.style.width = `${next}%`;
      }

      $('pct').textContent = `${Math.round(parseFloat(this.selectedImg.style.width) || 100)}%`;
      this.sync();
    };
  }
}

export const editor = new EditorComponent();
