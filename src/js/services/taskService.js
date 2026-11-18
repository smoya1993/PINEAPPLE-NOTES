/**
 * Servicio del Gestor de Tareas Personal
 */

import { state } from '../core/state.js';
import { fsService } from './fsService.js';
import { toastSuccess, toastWarning } from '../utils/toast.js';

class TaskService {
  getTasks() {
    return state.getData().taskItems || [];
  }

  isCompleted(task) {
    return task.status === 'completed' || task.status === 'done';
  }

  getMetrics() {
    const all = this.getTasks();
    const pending = all.filter((x) => !this.isCompleted(x));
    const completed = all.filter((x) => this.isCompleted(x));
    const today = new Date().toISOString().slice(0, 10);
    const overdue = pending.filter((x) => x.dueDate && x.dueDate < today);

    return {
      total: all.length,
      pendingCount: pending.length,
      doneCount: completed.length,
      overdueCount: overdue.length
    };
  }

  addTask({ title, details = '', priority = 'normal', dueDate = '' }) {
    const cleanTitle = title?.trim();
    if (!cleanTitle) {
      toastWarning('Escribe el título de la tarea.');
      return null;
    }

    const now = Date.now();
    const newTask = {
      id: 'task_' + now.toString(36) + Math.random().toString(36).slice(2, 8),
      title: cleanTitle,
      details: details?.trim() || '',
      comment: '',
      priority: ['high', 'normal', 'low'].includes(priority) ? priority : 'normal',
      dueDate: dueDate || '',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      completedAt: null
    };

    const data = state.getData();
    data.taskItems.push(newTask);
    fsService.scheduleSave();
    state.notify('task_added', { task: newTask });
    toastSuccess('Tarea añadida');
    return newTask;
  }

  toggleTaskStatus(taskId) {
    const data = state.getData();
    const task = data.taskItems.find((t) => t.id === taskId);
    if (!task) return;

    const completed = !this.isCompleted(task);
    task.status = completed ? 'completed' : 'pending';
    task.completedAt = completed ? Date.now() : null;
    task.updatedAt = Date.now();

    fsService.scheduleSave();
    state.notify('task_updated', { task });
  }

  updateTaskComment(taskId, comment) {
    const data = state.getData();
    const task = data.taskItems.find((t) => t.id === taskId);
    if (!task) return;

    task.comment = comment;
    task.updatedAt = Date.now();
    fsService.scheduleSave();
  }

  updateTask(taskId, { title, details, priority, dueDate }) {
    const data = state.getData();
    const task = data.taskItems.find((t) => t.id === taskId);
    if (!task) return false;

    if (title !== undefined) task.title = title.trim();
    if (details !== undefined) task.details = details.trim();
    if (priority !== undefined) task.priority = priority;
    if (dueDate !== undefined) task.dueDate = dueDate;
    task.updatedAt = Date.now();

    fsService.scheduleSave();
    state.notify('task_updated', { task });
    toastSuccess('Tarea actualizada');
    return true;
  }

  deleteTask(taskId) {
    const data = state.getData();
    data.taskItems = data.taskItems.filter((t) => t.id !== taskId);
    fsService.scheduleSave();
    state.notify('task_deleted', { taskId });
    toastSuccess('Tarea eliminada');
  }
}

export const taskService = new TaskService();
