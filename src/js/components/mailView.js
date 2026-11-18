/**
 * Componente de Vista de Correos Marcados WAF (📧)
 */

import { mailService } from '../services/mailService.js';
import { timeService } from '../services/timeService.js';
import { $$, esc } from '../utils/dom.js';
import { showConfirmModal } from '../utils/modal.js';

class MailViewComponent {
  constructor() {
    this.mailFilter = 'pending'; // 'pending' | 'reviewed' | 'all'
  }

  render(container) {
    const all = [...mailService.getMailItems()].sort(
      (a, b) => new Date(b.receivedDateTime || b.importedAt) - new Date(a.receivedDateTime || a.importedAt)
    );
    const pendingCount = all.filter((x) => (x.status || 'pending') === 'pending').length;
    const reviewedCount = all.filter((x) => x.status === 'reviewed').length;

    const visible =
      this.mailFilter === 'all' ? all : all.filter((x) => (x.status || 'pending') === this.mailFilter);

    container.innerHTML = `
      <div class="mail-help">
        <b>📧 Correos marcados WAF</b><br>
        Los archivos JSON se importan desde <b>inbox</b>, se deduplican por Outlook Message ID y después se mueven a <b>processed</b>.
      </div>
      <div class="mail-filters">
        <button type="button" data-mail-filter="pending" class="${this.mailFilter === 'pending' ? 'active' : ''}">Pendientes (${pendingCount})</button>
        <button type="button" data-mail-filter="reviewed" class="${this.mailFilter === 'reviewed' ? 'active' : ''}">Revisados (${reviewedCount})</button>
        <button type="button" data-mail-filter="all" class="${this.mailFilter === 'all' ? 'active' : ''}">Todos (${all.length})</button>
      </div>
      <div id="mailList"></div>
    `;

    $$('[data-mail-filter]', container).forEach((b) => {
      b.onclick = () => {
        this.mailFilter = b.dataset.mailFilter;
        this.render(container);
      };
    });

    const list = container.querySelector('#mailList');
    if (!visible.length) {
      list.innerHTML =
        '<div class="mail-empty">No hay correos en esta vista. Pulsa “Sincronizar correos” para leer la carpeta inbox.</div>';
      return;
    }

    visible.forEach((item) => {
      const isReviewed = item.status === 'reviewed';
      const card = document.createElement('div');
      card.className = `mail-card${isReviewed ? ' reviewed' : ''}`;

      card.innerHTML = `
        <div class="mail-subject">${esc(item.subject || '(Sin asunto)')}</div>
        <div class="mail-meta">
          <span>De: ${esc(item.fromName || item.fromAddress || 'Desconocido')}</span>
          ${item.fromName && item.fromAddress ? `<span>${esc(item.fromAddress)}</span>` : ''}
          <span>${esc(mailService.formatMailDate(item.receivedDateTime))}</span>
          <span>${esc(item.category || 'WAF')}</span>
        </div>
        <div class="mail-preview">${esc(item.bodyPreview || 'Sin vista previa')}</div>
        <textarea class="mail-notes" placeholder="Mis notas…">${esc(item.notes || '')}</textarea>
        <div class="mail-actions">
          <button type="button" data-mail-action="time" class="time-start-btn">Iniciar tiempo</button>
          <button type="button" data-mail-action="toggle">${isReviewed ? 'Marcar pendiente' : 'Marcar revisado'}</button>
          <button type="button" data-mail-action="delete" class="danger">Eliminar de Pineapple Notes</button>
        </div>
      `;

      const notes = card.querySelector('.mail-notes');
      notes.oninput = () => {
        mailService.updateMailNotes(item.id, notes.value);
      };

      card.querySelector('[data-mail-action="time"]').onclick = () => {
        timeService.startTimerFrom(item.subject || 'Correo WAF', 'Correos');
      };

      card.querySelector('[data-mail-action="toggle"]').onclick = () => {
        mailService.toggleMailStatus(item.id);
        this.render(container);
      };

      card.querySelector('[data-mail-action="delete"]').onclick = async () => {
        const confirmed = await showConfirmModal(
          'Eliminar correo',
          '¿Eliminar este correo de Pineapple Notes? El archivo procesado no se borrará.',
          'Eliminar',
          true
        );
        if (confirmed) {
          mailService.deleteMailItem(item.id);
          this.render(container);
        }
      };

      list.appendChild(card);
    });
  }
}

export const mailView = new MailViewComponent();
