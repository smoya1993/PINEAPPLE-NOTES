/**
 * Servicio de Registro de Tiempo, Cronómetro Activo, Resúmenes Semanales (Jira) y Exportación CSV
 */

import { SPECIAL_PAGES, READONLY_SPECIAL_PAGE_IDS } from '../config/constants.js';
import { state } from '../core/state.js';
import { fsService } from './fsService.js';
import { $ } from '../utils/dom.js';
import { showConfirmModal } from '../utils/modal.js';
import { toastSuccess, toastWarning } from '../utils/toast.js';

class TimeService {
  constructor() {
    this.timeClockTimer = null;
    this.timeReminderTimer = null;
  }

  pad2(n) {
    return String(n).padStart(2, '0');
  }

  localDateKey(d = new Date()) {
    return `${d.getFullYear()}-${this.pad2(d.getMonth() + 1)}-${this.pad2(d.getDate())}`;
  }

  parseDuration(value, unit = 'minutes') {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 0;
    if (/^\d+(?:[.,]\d+)?$/.test(raw)) {
      const n = parseFloat(raw.replace(',', '.'));
      return Math.round(n * (unit === 'hours' ? 60 : 1));
    }
    let mins = 0;
    const h = raw.match(/(\d+(?:[.,]\d+)?)\s*h/);
    const mi = raw.match(/(\d+)\s*m/);
    if (h) mins += parseFloat(h[1].replace(',', '.')) * 60;
    if (mi) mins += parseInt(mi[1], 10);
    return Math.round(mins);
  }

  formatDuration(mins) {
    const mTotal = Math.max(0, Math.round(Number(mins) || 0));
    const h = Math.floor(mTotal / 60);
    const m = mTotal % 60;
    return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
  }

  formatClock(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = total % 60;
    return `${this.pad2(h)}:${this.pad2(m)}:${this.pad2(sec)}`;
  }

  timerElapsedMs() {
    const t = state.getData().timeTimer;
    if (!t) return 0;
    return Number(t.accumulatedMs || 0) + (t.status === 'running' ? Date.now() - Number(t.startedAt || Date.now()) : 0);
  }

  roundedTimerMinutes(ms) {
    const exact = ms / 60000;
    const mode = state.getData().timeSettings?.rounding || 'minute';
    if (mode === 'five') return Math.max(1, Math.round(exact / 5) * 5);
    if (mode === 'fifteen') return Math.max(1, Math.round(exact / 15) * 15);
    if (mode === 'exact') return Math.max(1, Math.ceil(exact));
    return Math.max(1, Math.round(exact));
  }

  addTimeEntry({ activity, minutes, project = '', category = '', date = this.localDateKey(), source = '' }) {
    if (!activity?.trim() || !minutes) return null;
    const entry = {
      id: 'te_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      activity: activity.trim(),
      minutes: Math.max(1, Math.round(minutes)),
      project: project || '',
      category: category || '',
      date: date || this.localDateKey(),
      source: source || 'manual',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    state.getData().timeEntries.push(entry);
    fsService.scheduleSave();
    state.notify('time_updated', { entry });
    return entry;
  }

  startTimerFrom(activity, project = '') {
    const data = state.getData();
    if (data.timeTimer) {
      toastWarning('Ya hay un cronómetro activo. Finalízalo o descártalo antes de iniciar otro.');
      state.setActivePageId(SPECIAL_PAGES.TIME_ID);
      return false;
    }

    data.timeTimer = {
      activity: String(activity || 'Actividad').trim(),
      project: String(project || ''),
      category: '',
      status: 'running',
      startedAt: Date.now(),
      accumulatedMs: 0,
      createdAt: Date.now()
    };

    fsService.scheduleSave();
    this.startTimeClock();
    state.notify('timer_changed', { timer: data.timeTimer });
    toastSuccess(`Cronómetro iniciado: ${data.timeTimer.activity}`);
    return true;
  }

  startTimeFromCurrentNote() {
    const activePage = state.getActivePage();
    if (!activePage) return;

    if (READONLY_SPECIAL_PAGE_IDS.includes(activePage.id)) {
      state.setActivePageId(SPECIAL_PAGES.TIME_ID);
      return;
    }

    this.startTimerFrom(state.getPageBreadcrumbPath(activePage), '');
  }

  pauseResumeTimer() {
    const t = state.getData().timeTimer;
    if (!t) return;
    if (t.status === 'running') {
      t.accumulatedMs = this.timerElapsedMs();
      t.status = 'paused';
      t.startedAt = null;
    } else {
      t.status = 'running';
      t.startedAt = Date.now();
    }
    fsService.scheduleSave();
    state.notify('timer_changed', { timer: t });
  }

  async finishTimer() {
    const data = state.getData();
    const t = data.timeTimer;
    if (!t) return;
    const elapsed = this.timerElapsedMs();

    if (elapsed >= 9 * 3600000) {
      const ok = await showConfirmModal(
        'Cronómetro prolongado',
        'El cronómetro supera las 9 horas. ¿Quieres guardarlo igualmente?',
        'Guardar tiempo',
        false
      );
      if (!ok) return;
    }

    const mins = this.roundedTimerMinutes(elapsed);
    this.addTimeEntry({
      activity: t.activity,
      minutes: mins,
      project: t.project,
      category: t.category,
      date: this.localDateKey(),
      source: 'timer'
    });

    data.timeTimer = null;
    fsService.scheduleSave();
    state.notify('timer_changed', { timer: null });
    toastSuccess(`Tiempo registrado (${this.formatDuration(mins)})`);
  }

  async discardTimer() {
    const data = state.getData();
    if (!data.timeTimer) return;
    const ok = await showConfirmModal(
      'Descartar cronómetro',
      '¿Descartar el cronómetro activo sin guardar tiempo?',
      'Descartar',
      true
    );
    if (!ok) return;

    data.timeTimer = null;
    fsService.scheduleSave();
    state.notify('timer_changed', { timer: null });
  }

  startTimeClock() {
    if (this.timeClockTimer) clearInterval(this.timeClockTimer);
    this.timeClockTimer = setInterval(() => {
      const timer = state.getData().timeTimer;
      const clockEl = $('timerClock');
      if (clockEl && timer) {
        clockEl.textContent = this.formatClock(this.timerElapsedMs());
      }
      const widgetEl = $('activeTimerWidget');
      if (widgetEl && timer) {
        widgetEl.classList.remove('hidden');
        const wc = widgetEl.querySelector('.active-timer-clock');
        if (wc) wc.textContent = this.formatClock(this.timerElapsedMs());
      }
    }, 1000);
  }

  startTimeReminders() {
    if (this.timeReminderTimer) clearInterval(this.timeReminderTimer);
    const settings = state.getData().timeSettings;
    if (!settings?.remindersEnabled) return;

    this.timeReminderTimer = setInterval(() => {
      const data = state.getData();
      if (data.timeTimer) return;
      const last = Math.max(0, ...data.timeEntries.map((e) => e.createdAt || 0));
      const idle = (Date.now() - last) / 60000;
      if (
        idle >= Number(data.timeSettings.idleReminderMinutes || 90) &&
        state.getActivePage()?.id === SPECIAL_PAGES.TIME_ID
      ) {
        const host = $('timeViewHost');
        if (host && !host.querySelector('.time-reminder')) {
          host.insertAdjacentHTML(
            'afterbegin',
            `<div class="time-reminder">No has registrado actividad en los últimos ${Math.round(idle)} minutos. Puedes añadir tiempo manualmente o iniciar el cronómetro.</div>`
          );
        }
      }
    }, 60000);
  }

  stopTimers() {
    if (this.timeClockTimer) clearInterval(this.timeClockTimer);
    if (this.timeReminderTimer) clearInterval(this.timeReminderTimer);
  }

  weekStartKey(value = this.localDateKey()) {
    const d = new Date(value + 'T12:00:00');
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return this.localDateKey(d);
  }

  weekRange(start) {
    const a = new Date(start + 'T12:00:00');
    const b = new Date(a);
    b.setDate(a.getDate() + 6);
    return { start: this.localDateKey(a), end: this.localDateKey(b) };
  }

  entriesForWeek(start) {
    const r = this.weekRange(start);
    return (state.getData().timeEntries || []).filter((e) => e.date >= r.start && e.date <= r.end);
  }

  dateLabel(key) {
    try {
      return new Intl.DateTimeFormat('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(new Date(key + 'T12:00:00'));
    } catch {
      return key;
    }
  }

  buildDailySummary(entries) {
    const groups = {};
    entries.forEach((e) => (groups[e.date] ??= []).push(e));
    const body = Object.keys(groups)
      .sort()
      .map((date) => {
        const list = groups[date];
        const total = list.reduce((a, e) => a + e.minutes, 0);
        const dayName = this.dateLabel(date).split(',')[0];
        return (
          `${this.dateLabel(date)}\n` +
          list.map((e) => `- ${e.activity}: ${this.formatDuration(e.minutes)}`).join('\n') +
          `\nTotal ${dayName}: ${this.formatDuration(total)}`
        );
      })
      .join('\n\n');

    const weekTotal = entries.length
      ? `\n\nTotal semanal: ${this.formatDuration(entries.reduce((a, e) => a + e.minutes, 0))}`
      : '';
    return body + weekTotal;
  }

  buildGroupedSummary(entries) {
    const groups = {};
    entries.forEach((e) => {
      groups[e.activity] = (groups[e.activity] || 0) + e.minutes;
    });
    const body = Object.entries(groups)
      .sort((a, b) => b[1] - a[1])
      .map(([name, min]) => `${name}: ${this.formatDuration(min)}`)
      .join('\n');

    const weekTotal = entries.length
      ? `\n\nTotal semanal: ${this.formatDuration(entries.reduce((a, e) => a + e.minutes, 0))}`
      : '';
    return body + weekTotal;
  }

  async copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      const status = $('status');
      if (status) status.textContent = `${label} copiado`;
      toastSuccess(`${label} copiado al portapapeles`);
    } catch {
      prompt('Copia el contenido:', text);
    }
  }

  exportTimeCsv(entries, weekKey = this.weekStartKey()) {
    const rows = [
      ['Fecha', 'Actividad', 'Duración minutos', 'Duración', 'Proyecto', 'Categoría']
    ].concat(
      entries.map((e) => [
        e.date,
        e.activity,
        e.minutes,
        this.formatDuration(e.minutes),
        e.project || '',
        e.category || ''
      ])
    );

    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `registro-tiempo-${this.weekStartKey(weekKey)}.csv`;
    a.click();
    toastSuccess('CSV de registro de tiempo exportado');
  }
}

export const timeService = new TimeService();
