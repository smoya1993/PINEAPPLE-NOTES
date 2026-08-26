/**
 * Componente de Vista de Reuniones Internas (Puntos por Comentar)
 */

import { meetingService } from '../services/meetingService.js';
import { state } from '../core/state.js';
import { $, $$, esc, formatDate } from '../utils/dom.js';
import { showConfirmModal } from '../utils/modal.js';
import { toastWarning } from '../utils/toast.js';

class MeetingsViewComponent {
  constructor() {
    this.currentFilter = 'open'; // 'open' | 'done' | 'all'
  }

  render(container) {
    const all = [...meetingService.getMeetingItems()].sort((a, b) => b.createdAt - a.createdAt);
    const openItems = all.filter((x) => (x.status || 'open') === 'open');
    const doneItems = all.filter((x) => x.status === 'done');

    const visible = this.currentFilter === 'all'
      ? all
      : all.filter((x) => (x.status || 'open') === this.currentFilter);

    container.innerHTML = `
      <div class="meeting-help">
        <b>💬 Cosas que comentar en Reuniones</b><br>
        Selecciona cualquier texto en cualquier nota y pulsa el botón 💬 en la barra de herramientas. El fragmento se recopilará automáticamente aquí con un enlace a la nota de origen sin modificar el original.
      </div>
      <div class="meeting-filters">
        <button type="button" data-mf="open" class="${this.currentFilter === 'open' ? 'active' : ''}">Pendientes (${openItems.length})</button>
        <button type="button" data-mf="done" class="${this.currentFilter === 'done' ? 'active' : ''}">Tratados (${doneItems.length})</button>
        <button type="button" data-mf="all" class="${this.currentFilter === 'all' ? 'active' : ''}">Todos (${all.length})</button>
      </div>
      <div id="meetingList"></div>
    `;

    // Filtros de estado
    $$('[data-mf]', container).forEach((btn) => {
      btn.onclick = () => {
        this.currentFilter = btn.dataset.mf;
        this.render(container);
      };
    });

    const list = $('meetingList');
    if (!visible.length) {
      list.innerHTML = '<div class="meeting-empty">No hay temas en esta vista. ¡Todo listo para la reunión! 📋</div>';
      return;
    }

    const data = state.getData();

    visible.forEach((item) => {
      const sourcePage = data.pages.find((p) => p.id === item.sourcePageId);
      const card = document.createElement('div');
      const isDone = item.status === 'done';

      card.className = `meeting-item${isDone ? ' done' : ''}`;

      card.innerHTML = `
        <div class="meeting-source">
          ${esc(sourcePage?.icon || '📄')} ${esc(item.sourcePath || item.sourceTitle || 'Nota de origen')}
        </div>
        <div class="meeting-text">${item.html || esc(item.text || '')}</div>
        <div class="meeting-meta">Añadido: ${esc(formatDate(item.createdAt))}</div>
        <div class="meeting-actions">
          <button data-ma="open" type="button">Abrir nota original</button>
          <button data-ma="toggle" type="button">${isDone ? 'Marcar pendiente' : 'Marcar tratado'}</button>
          <button data-ma="delete" type="button" class="meeting-delete">Eliminar de la reunión</button>
        </div>
      `;

      card.querySelector('[data-ma="open"]').onclick = () => {
        if (!sourcePage) {
          toastWarning('La nota original ha sido eliminada.');
          return;
        }
        state.setActivePageId(sourcePage.id);
      };

      card.querySelector('[data-ma="toggle"]').onclick = () => {
        meetingService.toggleMeetingItemStatus(item.id);
        this.render(container);
      };

      card.querySelector('[data-ma="delete"]').onclick = async () => {
        const confirmed = await showConfirmModal(
          'Eliminar Asunto',
          '¿Deseas eliminar este asunto de la lista de reuniones? La nota original no sufrirá ninguna modificación.',
          'Eliminar',
          true
        );
        if (confirmed) {
          meetingService.deleteMeetingItem(item.id);
          this.render(container);
        }
      };

      list.appendChild(card);
    });
  }
}

export const meetingsView = new MeetingsViewComponent();
