/**
 * Componente de Vista del Registro de Tiempo (⏱️)
 * Incluye Vista Diaria, Cronómetro Activo, Resumen Semanal (Jira) y Opciones
 */

import { state } from '../core/state.js';
import { fsService } from '../services/fsService.js';
import { timeService } from '../services/timeService.js';
import { $, $$, esc } from '../utils/dom.js';
import { showPromptModal, showConfirmModal } from '../utils/modal.js';
import { toastSuccess, toastWarning } from '../utils/toast.js';

class TimeViewComponent {
  constructor() {
    this.timeView = 'today'; // 'today' | 'week' | 'settings'
  }

  renderTimeEntry(e) {
    return `
      <div class="time-entry" data-time-id="${esc(e.id)}">
        <div class="time-entry-main">
          <div class="time-entry-title">${esc(e.activity)}</div>
          <div class="time-duration">${timeService.formatDuration(e.minutes)}</div>
        </div>
        <div class="time-entry-meta">${esc([e.project, e.category].filter(Boolean).join(' · ') || 'Sin categoría')}</div>
        <div class="time-entry-actions">
          <button type="button" data-time-action="edit">Editar</button>
          <button type="button" data-time-action="duplicate">Duplicar</button>
          <button type="button" data-time-action="move">Mover de día</button>
          <button type="button" data-time-action="delete" class="danger">Eliminar</button>
        </div>
      </div>
    `;
  }

  bindTimeEntries(host, container) {
    const data = state.getData();
    $$('[data-time-id]', host).forEach((card) => {
      const e = data.timeEntries.find((x) => x.id === card.dataset.timeId);
      if (!e) return;

      card.querySelector('[data-time-action="edit"]').onclick = async () => {
        const activity = await showPromptModal('Editar registro', 'Actividad:', e.activity);
        if (activity === null || !activity.trim()) return;

        const duration = await showPromptModal(
          'Editar registro',
          'Duración (ej. 1h 30m o 90m):',
          timeService.formatDuration(e.minutes)
        );
        if (duration === null) return;

        const mins = timeService.parseDuration(duration);
        if (!mins) {
          toastWarning('Duración no válida.');
          return;
        }

        const project = await showPromptModal('Editar registro', 'Proyecto (opcional):', e.project || '');
        if (project === null) return;

        const category = await showPromptModal('Editar registro', 'Categoría (opcional):', e.category || '');
        if (category === null) return;

        e.activity = activity.trim();
        e.minutes = mins;
        e.project = project.trim();
        e.category = category.trim();
        e.updatedAt = Date.now();
        fsService.scheduleSave();
        this.render(container);
      };

      card.querySelector('[data-time-action="duplicate"]').onclick = () => {
        timeService.addTimeEntry({
          ...e,
          date: timeService.localDateKey()
        });
        toastSuccess('Registro duplicado en el día de hoy');
        this.render(container);
      };

      card.querySelector('[data-time-action="move"]').onclick = async () => {
        const d = await showPromptModal('Mover de día', 'Nueva fecha (AAAA-MM-DD):', e.date);
        if (d === null) return;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d.trim())) {
          toastWarning('Formato de fecha no válido. Usa AAAA-MM-DD.');
          return;
        }
        e.date = d.trim();
        e.updatedAt = Date.now();
        fsService.scheduleSave();
        this.render(container);
      };

      card.querySelector('[data-time-action="delete"]').onclick = async () => {
        const ok = await showConfirmModal(
          'Eliminar registro',
          `¿Eliminar el registro "${e.activity}" (${timeService.formatDuration(e.minutes)})?`,
          'Eliminar',
          true
        );
        if (!ok) return;
        data.timeEntries = data.timeEntries.filter((x) => x.id !== e.id);
        fsService.scheduleSave();
        this.render(container);
      };
    });
  }

  render(container) {
    const data = state.getData();
    const today = timeService.localDateKey();
    const timer = data.timeTimer;
    const week = timeService.weekStartKey(today);
    const entries = [...(data.timeEntries || [])].sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt
    );

    container.innerHTML = `
      <div class="time-shell">
        <div class="time-intro">
          <b>⏱️ Registro de tiempo</b> · Registra actividades manualmente, usa el cronómetro y genera un resumen semanal listo para copiar en Jira.
        </div>
        <div class="time-tabs">
          <button type="button" data-tv="today">Vista diaria</button>
          <button type="button" data-tv="week">Resumen semanal</button>
          <button type="button" data-tv="settings">Opciones</button>
        </div>
        <div id="timeViewHost"></div>
      </div>
    `;

    $$('[data-tv]', container).forEach((b) => {
      b.classList.toggle('active', b.dataset.tv === this.timeView);
      b.onclick = () => {
        this.timeView = b.dataset.tv;
        this.render(container);
      };
    });

    const host = container.querySelector('#timeViewHost');

    if (this.timeView === 'today') {
      host.innerHTML = `
        <div class="time-manual">
          <input id="timeActivity" placeholder="Actividad">
          <input id="timeDuration" placeholder="15m / 1h 30m">
          <input id="timeProject" list="timeProjects" placeholder="Proyecto">
          <select id="timeCategory">
            <option value="">Sin categoría</option>
            ${(data.timeSettings?.categories || []).map((x) => `<option>${esc(x)}</option>`).join('')}
          </select>
          <button id="timeAdd" type="button" class="time-primary">＋ Añadir</button>
          <input id="timeDate" type="date" value="${today}">
          <datalist id="timeProjects">
            ${(data.timeSettings?.projects || []).map((x) => `<option value="${esc(x)}">`).join('')}
          </datalist>
          <div class="time-help">Formatos aceptados: 15m, 50m, 1h, 1h 30m o 90m.</div>
        </div>
        <div class="time-timer-card">
          <input id="timerActivity" placeholder="¿Qué vas a hacer?" value="${esc(timer?.activity || '')}">
          <input id="timerProject" list="timeProjects" placeholder="Proyecto" value="${esc(timer?.project || '')}">
          ${
            timer
              ? `<div class="timer-display">
                  <div class="timer-name">⏱️ ${esc(timer.activity)}</div>
                  <div id="timerClock" class="timer-clock">${timeService.formatClock(timeService.timerElapsedMs())}</div>
                  <div class="timer-actions">
                    <button id="timerPause" type="button">${timer.status === 'running' ? 'Pausar' : 'Reanudar'}</button>
                    <button id="timerFinish" type="button" class="time-primary">Finalizar</button>
                    <button id="timerDiscard" type="button">Descartar</button>
                  </div>
                </div>`
              : `<button id="timerStart" type="button" class="time-primary">▶ Iniciar cronómetro</button>`
          }
        </div>
        <div id="timeDays"></div>
      `;

      const handleManualAdd = () => {
        const activity = $('timeActivity')?.value?.trim();
        if (!activity) {
          toastWarning('Escribe la actividad a registrar.');
          return;
        }
        const mins = timeService.parseDuration($('timeDuration')?.value);
        if (!mins) {
          toastWarning('Introduce una duración válida, por ejemplo 15m, 1h o 1h 30m.');
          return;
        }
        timeService.addTimeEntry({
          activity,
          minutes: mins,
          project: $('timeProject')?.value || '',
          category: $('timeCategory')?.value || '',
          date: $('timeDate')?.value || today,
          source: 'manual'
        });
        toastSuccess('Tiempo añadido');
        this.render(container);
      };

      host.querySelector('#timeAdd').onclick = handleManualAdd;
      host.querySelector('#timeDuration').onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleManualAdd();
        }
      };

      if (timer) {
        host.querySelector('#timerPause').onclick = () => {
          timeService.pauseResumeTimer();
          this.render(container);
        };
        host.querySelector('#timerFinish').onclick = async () => {
          await timeService.finishTimer();
          this.render(container);
        };
        host.querySelector('#timerDiscard').onclick = async () => {
          await timeService.discardTimer();
          this.render(container);
        };
      } else {
        const handleStartTimer = () => {
          const activity = $('timerActivity')?.value?.trim();
          if (!activity) {
            toastWarning('Escribe la actividad antes de iniciar el cronómetro.');
            return;
          }
          timeService.startTimerFrom(activity, $('timerProject')?.value || '');
          this.render(container);
        };
        host.querySelector('#timerStart').onclick = handleStartTimer;
        host.querySelector('#timerActivity').onkeydown = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleStartTimer();
          }
        };
      }

      const days = host.querySelector('#timeDays');
      const groups = {};
      entries.forEach((e) => (groups[e.date] ??= []).push(e));

      if (Object.keys(groups).length) {
        days.innerHTML = Object.keys(groups)
          .sort()
          .reverse()
          .map(
            (date) => `
            <section class="time-day">
              <div class="time-day-head">
                <span>${esc(timeService.dateLabel(date))}</span>
                <span>Total ${timeService.formatDuration(groups[date].reduce((a, e) => a + e.minutes, 0))}</span>
              </div>
              ${groups[date].map((entry) => this.renderTimeEntry(entry)).join('')}
            </section>
          `
          )
          .join('');
      } else {
        days.innerHTML = '<div class="time-empty">Todavía no hay registros de tiempo.</div>';
      }

      this.bindTimeEntries(days, container);
    } else if (this.timeView === 'week') {
      const weekly = timeService.entriesForWeek(week);
      const daily = timeService.buildDailySummary(weekly);
      const grouped = timeService.buildGroupedSummary(weekly);
      const range = timeService.weekRange(week);

      host.innerHTML = `
        <div class="time-summary-card">
          <div class="time-summary-controls">
            <label for="timeWeek">Semana</label>
            <input id="timeWeek" type="date" value="${week}">
            <span>${esc(range.start)} - ${esc(range.end)}</span>
          </div>
          <div class="time-summary-grid">
            <div class="time-summary-box">
              <h3>Resumen por día</h3>
              <div id="dailySummary" class="time-summary-text">${esc(daily || 'Sin registros esta semana.')}</div>
            </div>
            <div class="time-summary-box">
              <h3>Resumen agrupado</h3>
              <div id="groupedSummary" class="time-summary-text">${esc(grouped || 'Sin registros esta semana.')}</div>
            </div>
          </div>
          <div class="time-actions">
            <button id="copyDaily" type="button">Copiar por días</button>
            <button id="copyGrouped" type="button">Copiar agrupado</button>
            <button id="copyJira" type="button" class="time-primary">Copiar para Jira</button>
            <button id="exportTimeCsv" type="button">Exportar CSV</button>
          </div>
        </div>
      `;

      host.querySelector('#timeWeek').onchange = (e) => {
        const start = timeService.weekStartKey(e.target.value);
        const list = timeService.entriesForWeek(start);
        const d = timeService.buildDailySummary(list);
        const g = timeService.buildGroupedSummary(list);
        const r = timeService.weekRange(start);

        e.target.value = start;
        host.querySelector('.time-summary-controls span').textContent = `${r.start} - ${r.end}`;
        host.querySelector('#dailySummary').textContent = d || 'Sin registros esta semana.';
        host.querySelector('#groupedSummary').textContent = g || 'Sin registros esta semana.';
      };

      host.querySelector('#copyDaily').onclick = () =>
        timeService.copyText(host.querySelector('#dailySummary').textContent, 'Resumen por días');
      host.querySelector('#copyGrouped').onclick = () =>
        timeService.copyText(host.querySelector('#groupedSummary').textContent, 'Resumen agrupado');
      host.querySelector('#copyJira').onclick = () =>
        timeService.copyText(host.querySelector('#dailySummary').textContent, 'Resumen para Jira');
      host.querySelector('#exportTimeCsv').onclick = () => {
        const wk = timeService.weekStartKey(host.querySelector('#timeWeek').value);
        timeService.exportTimeCsv(timeService.entriesForWeek(wk), wk);
      };
    } else {
      const settings = data.timeSettings;
      host.innerHTML = `
        <div class="time-settings">
          <div class="time-setting-row">
            <label for="roundingMode">Redondeo del cronómetro</label>
            <select id="roundingMode">
              <option value="minute">Al minuto más cercano</option>
              <option value="five">Bloques de 5 minutos</option>
              <option value="fifteen">Bloques de 15 minutos</option>
              <option value="exact">Minuto superior</option>
            </select>
          </div>
          <div class="time-setting-row">
            <label for="remindersEnabled">Recordatorios discretos</label>
            <input id="remindersEnabled" type="checkbox" ${settings.remindersEnabled ? 'checked' : ''}>
            <input id="idleMinutes" type="number" min="30" step="15" value="${settings.idleReminderMinutes || 90}">
            <span>minutos</span>
          </div>
          <div class="time-setting-row">
            <label for="projectsList">Proyectos frecuentes</label>
            <input id="projectsList" value="${esc((settings.projects || []).join(', '))}" style="flex:1">
          </div>
          <div class="time-setting-row">
            <label for="categoriesList">Categorías</label>
            <input id="categoriesList" value="${esc((settings.categories || []).join(', '))}" style="flex:1">
          </div>
          <button id="saveTimeSettings" type="button" class="time-primary">Guardar opciones</button>
          <div class="time-setting-note">
            Los avisos solo aparecen mientras Pineapple Notes está abierto. El navegador controla el aviso al cerrar una pestaña con un cronómetro activo.
          </div>
        </div>
      `;

      host.querySelector('#roundingMode').value = settings.rounding || 'minute';
      host.querySelector('#saveTimeSettings').onclick = () => {
        settings.rounding = host.querySelector('#roundingMode').value;
        settings.remindersEnabled = host.querySelector('#remindersEnabled').checked;
        settings.idleReminderMinutes = Math.max(30, Number(host.querySelector('#idleMinutes').value) || 90);
        settings.projects = host
          .querySelector('#projectsList')
          .value.split(',')
          .map((x) => x.trim())
          .filter(Boolean);
        settings.categories = host
          .querySelector('#categoriesList')
          .value.split(',')
          .map((x) => x.trim())
          .filter(Boolean);

        fsService.scheduleSave();
        timeService.startTimeReminders();
        const status = $('status');
        if (status) status.textContent = 'Opciones de tiempo guardadas';
        toastSuccess('Opciones de tiempo guardadas');
      };
    }

    timeService.startTimeClock();
  }
}

export const timeView = new TimeViewComponent();
