/**
 * Componente de Vista del Gestor de Tareas Personal (✅)
 * Incluye comentarios en tiempo real e integración con el cronómetro de tiempo
 */

import { taskService } from '../services/taskService.js';
import { timeService } from '../services/timeService.js';
import { $, $$, esc, formatDate, formatDueDate } from '../utils/dom.js';
import { showPromptModal, showConfirmModal } from '../utils/modal.js';
import { toastWarning } from '../utils/toast.js';

class TasksViewComponent {
  constructor() {
    this.taskFilter = 'pending'; // 'pending' | 'completed' | 'all'
  }

  render(container) {
    const all = [...taskService.getTasks()];
    const pending = all.filter((x) => !taskService.isCompleted(x));
    const completed = all.filter((x) => taskService.isCompleted(x));

    const rank = { high: 0, normal: 1, low: 2 };
    all.sort((a, b) => {
      const doneDiff = taskService.isCompleted(a) - taskService.isCompleted(b);
      if (doneDiff !== 0) return doneDiff;
      const rankDiff = (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1);
      if (rankDiff !== 0) return rankDiff;
      const dateA = a.dueDate || '9999-99-99';
      const dateB = b.dueDate || '9999-99-99';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return b.createdAt - a.createdAt;
    });

    const visible =
      this.taskFilter === 'all'
        ? all
        : all.filter((x) => (taskService.isCompleted(x) ? 'completed' : 'pending') === this.taskFilter);

    container.innerHTML = `
      <div class="task-board-help">
        <b>✔️ Tareas pendientes</b> · Crea tareas, asigna prioridad y fecha límite, y gestiona su estado sin mezclarlo con otras notas.
      </div>
      <div class="compact-task-form">
        <input id="compactTaskTitle" placeholder="¿Qué tienes que hacer?" maxlength="240" autofocus>
        <select id="compactTaskPriority">
          <option value="normal">Prioridad normal</option>
          <option value="high">Prioridad alta</option>
          <option value="low">Prioridad baja</option>
        </select>
        <input id="compactTaskDue" type="date" title="Fecha límite">
        <button id="compactTaskAdd" type="button">＋ Añadir</button>
        <input id="compactTaskDetails" class="task-description-input" placeholder="Descripción de la tarea" maxlength="1000">
      </div>
      <div class="compact-filters">
        <button type="button" data-ctf="pending" class="${this.taskFilter === 'pending' ? 'active' : ''}">Pendientes (${pending.length})</button>
        <button type="button" data-ctf="completed" class="${this.taskFilter === 'completed' ? 'active' : ''}">Completadas (${completed.length})</button>
        <button type="button" data-ctf="all" class="${this.taskFilter === 'all' ? 'active' : ''}">Todas (${all.length})</button>
        <span class="compact-count">${pending.length} pendiente${pending.length === 1 ? '' : 's'}</span>
      </div>
      <div id="compactTaskList"></div>
    `;

    const handleAdd = () => {
      const title = $('compactTaskTitle')?.value;
      const details = $('compactTaskDetails')?.value;
      const priority = $('compactTaskPriority')?.value;
      const dueDate = $('compactTaskDue')?.value;

      const added = taskService.addTask({ title, details, priority, dueDate });
      if (added) {
        this.render(container);
      }
    };

    $('compactTaskAdd').onclick = handleAdd;
    $('compactTaskTitle').onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAdd();
      }
    };

    $$('[data-ctf]', container).forEach((btn) => {
      btn.onclick = () => {
        this.taskFilter = btn.dataset.ctf;
        this.render(container);
      };
    });

    const list = $('compactTaskList');
    if (!visible.length) {
      list.innerHTML = '<div class="topic-empty">No hay tareas en esta vista.</div>';
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    visible.forEach((item) => {
      if (item.comment === undefined) item.comment = '';
      const priority = item.priority || 'normal';
      const isDone = taskService.isCompleted(item);
      const isOverdue = !isDone && item.dueDate && item.dueDate < todayStr;
      const priorityLabel = priority === 'high' ? 'Alta' : priority === 'low' ? 'Baja' : 'Normal';

      const card = document.createElement('div');
      card.className = `compact-task-card ${priority}${isDone ? ' done' : ''}`;

      card.innerHTML = `
        <div class="compact-task-title">${esc(item.title || 'Sin título')}</div>
        ${item.details ? `<div class="compact-task-details">${esc(item.details)}</div>` : ''}
        <div class="compact-task-meta">
          <span>Prioridad: ${priorityLabel}</span>
          ${item.dueDate ? `<span class="${isOverdue ? 'todo-overdue' : ''}">${isOverdue ? '⚠️ Vencida: ' : 'Fecha límite: '}${esc(formatDueDate(item.dueDate))}</span>` : ''}
          <span>Creada: ${esc(formatDate(item.createdAt))}</span>
          ${item.completedAt ? `<span>Completada: ${esc(formatDate(item.completedAt))}</span>` : ''}
        </div>
        <label class="item-comment-label">Comentario</label>
        <textarea class="item-comment" placeholder="Añade contexto, decisión o próximos pasos…">${esc(item.comment || '')}</textarea>
        <div class="compact-task-actions">
          <button type="button" data-cta="toggle">${isDone ? 'Marcar pendiente' : 'Marcar completada'}</button>
          <button type="button" data-cta="time" class="time-start-btn">Iniciar tiempo</button>
          <button type="button" data-cta="edit">Editar</button>
          <button type="button" data-cta="delete" class="danger">Eliminar</button>
        </div>
      `;

      const commentInput = card.querySelector('.item-comment');
      commentInput.oninput = () => {
        taskService.updateTaskComment(item.id, commentInput.value);
      };

      card.querySelector('[data-cta="time"]').onclick = () => {
        timeService.startTimerFrom(item.title || 'Tarea', item.priority || '');
      };

      card.querySelector('[data-cta="toggle"]').onclick = () => {
        taskService.toggleTaskStatus(item.id);
        this.render(container);
      };

      card.querySelector('[data-cta="edit"]').onclick = async () => {
        const newTitle = await showPromptModal('Editar Tarea', 'Título de la tarea:', item.title || '');
        if (newTitle === null) return;
        if (!newTitle.trim()) {
          toastWarning('El título no puede estar vacío.');
          return;
        }

        const newDetails = await showPromptModal('Editar Tarea', 'Descripción:', item.details || '');
        if (newDetails === null) return;

        taskService.updateTask(item.id, {
          title: newTitle,
          details: newDetails
        });
        this.render(container);
      };

      card.querySelector('[data-cta="delete"]').onclick = async () => {
        const confirmed = await showConfirmModal(
          'Eliminar Tarea',
          `¿Eliminar la tarea "${item.title}"?`,
          'Eliminar',
          true
        );
        if (confirmed) {
          taskService.deleteTask(item.id);
          this.render(container);
        }
      };

      list.appendChild(card);
    });
  }
}

export const tasksView = new TasksViewComponent();
