/**
 * Componente de Vista del Gestor de Tareas Personal
 */

import { taskService } from '../services/taskService.js';
import { $, $$, esc, formatDate, formatDueDate } from '../utils/dom.js';
import { showPromptModal, showConfirmModal } from '../utils/modal.js';

class TasksViewComponent {
  constructor() {
    this.currentFilter = 'pending'; // 'pending' | 'done' | 'all'
  }

  render(container) {
    const all = [...taskService.getTasks()];
    const pending = all.filter((x) => x.status !== 'done');
    const done = all.filter((x) => x.status === 'done');

    const rank = { high: 0, normal: 1, low: 2 };
    all.sort((a, b) => {
      const doneDiff = (a.status === 'done') - (b.status === 'done');
      if (doneDiff !== 0) return doneDiff;
      const rankDiff = (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1);
      if (rankDiff !== 0) return rankDiff;
      const dateA = a.dueDate || '9999-99-99';
      const dateB = b.dueDate || '9999-99-99';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return b.createdAt - a.createdAt;
    });

    const visible = this.currentFilter === 'all'
      ? all
      : all.filter((x) => (x.status === 'done' ? 'done' : 'pending') === this.currentFilter);

    container.innerHTML = `
      <div class="meeting-help">
        <b>✅ Tareas Raúl</b><br>
        Añade tareas, asigna prioridad y fecha límite, y gestiona su estado sin mezclarlo con el contenido de otras notas.
      </div>
      <div class="todo-panel">
        <input id="todoTitle" placeholder="¿Qué tienes pendiente por hacer?" maxlength="240" autofocus>
        <select id="todoPriority">
          <option value="normal">Prioridad Normal</option>
          <option value="high">Prioridad Alta</option>
          <option value="low">Prioridad Baja</option>
        </select>
        <input id="todoDue" type="date" title="Fecha límite">
        <button id="todoAddBtn" type="button">＋ Añadir</button>
        <input id="todoDetails" class="todo-details" placeholder="Detalles o notas adicionales opcionales..." maxlength="1000">
      </div>
      <div class="todo-filters">
        <button type="button" data-tf="pending" class="${this.currentFilter === 'pending' ? 'active' : ''}">Pendientes (${pending.length})</button>
        <button type="button" data-tf="done" class="${this.currentFilter === 'done' ? 'active' : ''}">Completadas (${done.length})</button>
        <button type="button" data-tf="all" class="${this.currentFilter === 'all' ? 'active' : ''}">Todas (${all.length})</button>
        <span class="todo-summary">${pending.length} pendiente${pending.length === 1 ? '' : 's'}</span>
      </div>
      <div id="todoList"></div>
    `;

    // Eventos de creación
    const handleAdd = () => {
      const title = $('todoTitle')?.value;
      const details = $('todoDetails')?.value;
      const priority = $('todoPriority')?.value;
      const dueDate = $('todoDue')?.value;

      const added = taskService.addTask({ title, details, priority, dueDate });
      if (added) {
        this.render(container);
      }
    };

    $('todoAddBtn').onclick = handleAdd;
    $('todoTitle').onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAdd();
      }
    };

    // Eventos de pestañas de filtro
    $$('[data-tf]', container).forEach((btn) => {
      btn.onclick = () => {
        this.currentFilter = btn.dataset.tf;
        this.render(container);
      };
    });

    // Renderizado de tarjetas
    const list = $('todoList');
    if (!visible.length) {
      list.innerHTML = '<div class="todo-empty">No hay tareas en esta vista. ¡Todo al día! 🎉</div>';
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    visible.forEach((task) => {
      const card = document.createElement('div');
      const priority = task.priority || 'normal';
      const isDone = task.status === 'done';
      const isOverdue = !isDone && task.dueDate && task.dueDate < todayStr;

      card.className = `todo-item priority-${priority}${isDone ? ' done' : ''}`;

      const priorityLabel = priority === 'high' ? 'Alta' : priority === 'low' ? 'Baja' : 'Normal';

      card.innerHTML = `
        <div class="todo-item-title">${esc(task.title)}</div>
        ${task.details ? `<div class="todo-item-details">${esc(task.details)}</div>` : ''}
        <div class="todo-item-meta">
          <span class="todo-badge">Prioridad: ${priorityLabel}</span>
          ${task.dueDate ? `<span class="todo-badge ${isOverdue ? 'todo-overdue' : ''}">${isOverdue ? '⚠️ Vencida: ' : 'Fecha límite: '}${esc(formatDueDate(task.dueDate))}</span>` : ''}
          <span>Creada: ${esc(formatDate(task.createdAt))}</span>
          ${task.completedAt ? `<span>Completada: ${esc(formatDate(task.completedAt))}</span>` : ''}
        </div>
        <div class="todo-actions">
          <button data-ta="toggle" type="button">${isDone ? 'Marcar pendiente' : 'Marcar completada'}</button>
          <button data-ta="edit" type="button">Editar</button>
          <button data-ta="delete" type="button" class="todo-delete">Eliminar</button>
        </div>
      `;

      card.querySelector('[data-ta="toggle"]').onclick = () => {
        taskService.toggleTaskStatus(task.id);
        this.render(container);
      };

      card.querySelector('[data-ta="edit"]').onclick = async () => {
        const newTitle = await showPromptModal('Editar Tarea', 'Título de la tarea:', task.title);
        if (newTitle === null) return;
        if (!newTitle.trim()) {
          alert('El título no puede estar vacío.');
          return;
        }

        const newDetails = await showPromptModal('Editar Tarea', 'Detalles o notas adicionales:', task.details || '');
        if (newDetails === null) return;

        taskService.updateTask(task.id, {
          title: newTitle,
          details: newDetails
        });
        this.render(container);
      };

      card.querySelector('[data-ta="delete"]').onclick = async () => {
        const confirmed = await showConfirmModal(
          'Eliminar Tarea',
          `¿Deseas eliminar la tarea "${task.title}"?`,
          'Eliminar',
          true
        );
        if (confirmed) {
          taskService.deleteTask(task.id);
          this.render(container);
        }
      };

      list.appendChild(card);
    });
  }
}

export const tasksView = new TasksViewComponent();
