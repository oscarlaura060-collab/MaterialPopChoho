/* ==========================================================================
   CHOHO TASKS · calendar.js
   Calendario mensual. Muestra tareas según su fecha límite.
   ========================================================================== */

(function (global) {
  'use strict';

  let cursor = new Date();
  cursor.setDate(1);

  function render(container, filters) {
    const tasks = Metrics.applyFilters(Storage.getTasks(), filters || {});
    const year = cursor.getFullYear();
    const month = cursor.getMonth();

    // Mapa fecha(YYYY-MM-DD) -> tareas
    const map = {};
    tasks.forEach(t => {
      const key = H.toInputDate(t.dueDate);
      if (!key) return;
      (map[key] = map[key] || []).push(t);
    });

    const first = new Date(year, month, 1);
    const startDow = (first.getDay() + 6) % 7; // lunes=0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayKey = H.toInputDate(new Date());

    const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    let cells = dayNames.map(d => '<div class="cal-dow">' + d + '</div>').join('');

    for (let i = 0; i < startDow; i++) cells += '<div class="cal-cell empty"></div>';

    for (let day = 1; day <= daysInMonth; day++) {
      const key = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      const items = map[key] || [];
      const isToday = key === todayKey;
      const chips = items.slice(0, 3).map(t => {
        const eff = H.effectiveStatus(t);
        return '<div class="cal-chip cal-' + eff + '" data-id="' + t.id + '" title="' +
          H.escapeHtml(t.name) + '">' + H.escapeHtml(t.name) + '</div>';
      }).join('');
      const more = items.length > 3 ? '<div class="cal-more">+' + (items.length - 3) + ' más</div>' : '';
      cells += '<div class="cal-cell' + (isToday ? ' today' : '') + '">' +
        '<div class="cal-daynum">' + day + '</div>' + chips + more + '</div>';
    }

    container.innerHTML =
      '<div class="calendar">' +
        '<div class="cal-head">' +
          '<button class="icon-btn" id="cal-prev">‹</button>' +
          '<h3 class="cal-title">' + H.monthName(month) + ' ' + year + '</h3>' +
          '<button class="icon-btn" id="cal-next">›</button>' +
          '<button class="btn btn-sm btn-ghost" id="cal-today">Hoy</button>' +
        '</div>' +
        '<div class="cal-legend">' +
          legend('pendiente', 'Pendiente') + legend('en_progreso', 'En progreso') +
          legend('completada', 'Completada') + legend('vencida', 'Vencida') +
        '</div>' +
        '<div class="cal-grid">' + cells + '</div>' +
      '</div>';

    H.el('cal-prev').addEventListener('click', () => { cursor.setMonth(cursor.getMonth() - 1); render(container, filters); });
    H.el('cal-next').addEventListener('click', () => { cursor.setMonth(cursor.getMonth() + 1); render(container, filters); });
    H.el('cal-today').addEventListener('click', () => { cursor = new Date(); cursor.setDate(1); render(container, filters); });
    H.qsa('.cal-chip', container).forEach(c =>
      c.addEventListener('click', () => Tasks.openTaskDetail(c.getAttribute('data-id'))));
  }

  function legend(cls, label) {
    return '<span class="leg"><span class="leg-dot cal-' + cls + '"></span>' + label + '</span>';
  }

  global.CalendarView = { render };

})(window);
