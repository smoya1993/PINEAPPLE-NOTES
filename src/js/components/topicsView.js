/**
 * Componente de Vista de Temas Pendientes Centralizados (👁️)
 */

import { state } from '../core/state.js';
import { topicService } from '../services/topicService.js';
import { timeService } from '../services/timeService.js';
import { $, $$, esc, formatDate } from '../utils/dom.js';
import { showConfirmModal } from '../utils/modal.js';
import { toastWarning } from '../utils/toast.js';

class TopicsViewComponent {
  constructor() {
    this.topicFilter = 'open'; // 'open' | 'done' | 'all'
    this.topicSourceFilter = 'all';
  }

  render(container) {
    const data = state.getData();
    const all = [...topicService.getTopicItems()].sort((a, b) => b.createdAt - a.createdAt);
    const sources = [...new Set(all.map((x) => x.sourcePageId))];

    const openCount = all.filter((x) => (x.status || 'open') === 'open').length;
    const doneCount = all.filter((x) => x.status === 'done').length;

    const filtered = all.filter(
      (x) =>
        (this.topicFilter === 'all' || (x.status || 'open') === this.topicFilter) &&
        (this.topicSourceFilter === 'all' || x.sourcePageId === this.topicSourceFilter)
    );

    container.innerHTML = `
      <div class="topic-help">
        <b>👁️ Temas Pendientes</b> · Esta nota es de solo lectura. Selecciona texto en cualquier nota y pulsa 👁️ para añadirlo aquí.
      </div>
      <div class="topic-filters">
        <button type="button" data-topic-filter="open" class="${this.topicFilter === 'open' ? 'active' : ''}">Pendientes (${openCount})</button>
        <button type="button" data-topic-filter="done" class="${this.topicFilter === 'done' ? 'active' : ''}">Tratados (${doneCount})</button>
        <button type="button" data-topic-filter="all" class="${this.topicFilter === 'all' ? 'active' : ''}">Todos (${all.length})</button>
        <select id="topicSourceSelect" class="topic-filter-select">
          <option value="all">Filtro Notas</option>
          ${sources
            .map((id) => {
              const p = data.pages.find((x) => x.id === id);
              return `<option value="${esc(id)}" ${this.topicSourceFilter === id ? 'selected' : ''}>${esc(p?.title || 'Nota eliminada')}</option>`;
            })
            .join('')}
        </select>
      </div>
      <div id="topicList"></div>
    `;

    $$('[data-topic-filter]', container).forEach((b) => {
      b.onclick = () => {
        this.topicFilter = b.dataset.topicFilter;
        this.render(container);
      };
    });

    const sourceSelect = container.querySelector('#topicSourceSelect');
    if (sourceSelect) {
      sourceSelect.onchange = (e) => {
        this.topicSourceFilter = e.target.value;
        this.render(container);
      };
    }

    const list = container.querySelector('#topicList');
    if (!filtered.length) {
      list.innerHTML = '<div class="topic-empty">No hay temas en esta vista.</div>';
      return;
    }

    filtered.forEach((item) => {
      if (item.comment === undefined) item.comment = '';
      const source = data.pages.find((p) => p.id === item.sourcePageId);
      const isDone = item.status === 'done';
      const card = document.createElement('div');
      card.className = `topic-card${isDone ? ' done' : ''}`;

      card.innerHTML = `
        <div class="topic-source">
          ${esc(source?.icon || '📄')} ${esc(item.sourcePath || item.sourceTitle || 'Nota eliminada')}
        </div>
        <div class="topic-text">${item.html || esc(item.text || '')}</div>
        <div class="topic-meta">Añadido: ${esc(formatDate(item.createdAt))}</div>
        <label class="item-comment-label">Comentario</label>
        <textarea class="item-comment" placeholder="Añade contexto, decisión o próximos pasos…">${esc(item.comment || '')}</textarea>
        <div class="topic-actions">
          <button type="button" data-topic-action="open">Abrir nota original</button>
          <button type="button" data-topic-action="time" class="time-start-btn">Iniciar tiempo</button>
          <button type="button" data-topic-action="toggle">${isDone ? 'Marcar pendiente' : 'Marcar tratado'}</button>
          <button type="button" data-topic-action="delete" class="danger">Eliminar</button>
        </div>
      `;

      card.querySelector('.item-comment').oninput = (e) => {
        topicService.updateTopicComment(item.id, e.target.value);
      };

      card.querySelector('[data-topic-action="time"]').onclick = () => {
        timeService.startTimerFrom(item.text || item.sourceTitle || 'Tema pendiente', '');
      };

      card.querySelector('[data-topic-action="open"]').onclick = () => {
        if (!source) {
          toastWarning('La nota original ya no existe.');
          return;
        }
        state.setActivePageId(source.id);
      };

      card.querySelector('[data-topic-action="toggle"]').onclick = () => {
        topicService.toggleTopicStatus(item.id);
        this.render(container);
      };

      card.querySelector('[data-topic-action="delete"]').onclick = async () => {
        const confirmed = await showConfirmModal(
          'Eliminar tema pendiente',
          '¿Eliminar este tema pendiente?',
          'Eliminar',
          true
        );
        if (confirmed) {
          topicService.deleteTopicItem(item.id);
          this.render(container);
        }
      };

      list.appendChild(card);
    });
  }
}

export const topicsView = new TopicsViewComponent();
