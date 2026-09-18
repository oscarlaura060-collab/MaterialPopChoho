/* ==========================================================================
   CHOHO TASKS · dashboard.js
   Panel principal: KPIs, gráficos y sección "HOY".
   ========================================================================== */

(function (global) {
  'use strict';

  function render(container) {
    const tasks = Storage.getTasks();
    const s = Metrics.summary(tasks);
    const user = Auth.currentUser();

    container.innerHTML =
      '<div class="dash-hero">' +
        '<div><h2 class="dash-title">Hola, ' + H.escapeHtml((user && user.name.split(' ')[0]) || 'Óscar') + ' 👋</h2>' +
        '<p class="dash-sub">Este es tu centro de control. Así vas con tu trabajo hoy.</p></div>' +
        '<button class="btn btn-primary" id="dash-new-task">+ Nueva tarea</button>' +
      '</div>' +
      kpiCards(s) +
      '<div class="dash-grid">' +
        chartCard('Estado de tareas', 'chart-status', 'donut') +
        chartCard('Productividad · tareas completadas por semana', 'chart-productivity', 'bar') +
        chartCard('Cumplimiento · evolución mensual', 'chart-compliance', 'line') +
        chartCard('Tareas por proyecto', 'chart-projects', 'bar') +
      '</div>' +
      todaySection(tasks);

    // KPI card click -> navegar a tareas filtradas
    H.el('dash-new-task').addEventListener('click', () => Tasks.openTaskForm(null));

    H.qsa('.kpi-card[data-filter]', container).forEach(card => {
      card.addEventListener('click', () => {
        App.navigate('tareas', { status: card.getAttribute('data-filter') });
      });
    });

    H.qsa('.today-task', container).forEach(item =>
      item.addEventListener('click', () => Tasks.openTaskDetail(item.getAttribute('data-id'))));

    // Gráficos
    drawCharts(tasks);
  }

  function kpiCards(s) {
    const cards = [
      { label: 'Total de tareas', value: s.total, icon: '📋', cls: 'k-total', filter: '' },
      { label: 'Completadas', value: s.completadas, icon: '✅', cls: 'k-done', filter: 'completada' },
      { label: 'En progreso', value: s.en_progreso, icon: '🔄', cls: 'k-prog', filter: 'en_progreso' },
      { label: 'Pendientes', value: s.pendientes + s.en_espera, icon: '🕒', cls: 'k-pend', filter: 'pendiente' },
      { label: 'Vencidas', value: s.vencidas, icon: '⚠️', cls: 'k-over', filter: 'vencida' },
      { label: 'Cumplimiento', value: s.compliance + '%', icon: '🎯', cls: 'k-comp', filter: '' }
    ];
    return '<div class="kpi-row">' + cards.map(c =>
      '<div class="kpi-card ' + c.cls + '"' + (c.filter ? ' data-filter="' + c.filter + '"' : '') + '>' +
        '<div class="kpi-icon">' + c.icon + '</div>' +
        '<div class="kpi-body"><div class="kpi-value">' + c.value + '</div>' +
        '<div class="kpi-label">' + c.label + '</div></div>' +
      '</div>').join('') + '</div>';
  }

  function chartCard(title, canvasId, type) {
    return '<div class="card chart-card">' +
      '<div class="card-head"><h3>' + title + '</h3></div>' +
      '<div class="chart-holder"><canvas id="' + canvasId + '"></canvas></div></div>';
  }

  function drawCharts(tasks) {
    Charts.donut('chart-status', Metrics.statusBreakdown(tasks));

    const weeks = Metrics.completedByWeek(tasks, 8);
    Charts.bar('chart-productivity', weeks.map(w => w.label), weeks.map(w => w.count), '#22c1a4');

    const months = Metrics.complianceByMonth(tasks, 6);
    Charts.line('chart-compliance', months.map(m => m.label), months.map(m => m.value), '#4f6ef7');

    const proj = Metrics.byProject(tasks);
    Charts.bar('chart-projects', proj.map(p => p.label), proj.map(p => p.value), '#8b5cf6');
  }

  /* ------------------------------- HOY --------------------------------- */

  function todaySection(tasks) {
    const b = Metrics.todayBuckets(tasks);
    return '<div class="today-section">' +
      '<h3 class="section-title">🗓️ Hoy · ¿qué tengo que hacer?</h3>' +
      '<div class="today-grid">' +
        todayColumn('🔴 Atrasadas', b.overdue, 'col-over') +
        todayColumn('🟠 Vencen hoy', b.dueToday, 'col-today') +
        todayColumn('🟡 Próximas (3 días)', b.upcoming, 'col-soon') +
        todayColumn('⭐ Prioridad alta', b.highPriority, 'col-high') +
      '</div></div>';
  }

  function todayColumn(title, items, cls) {
    const body = items.length
      ? items.slice(0, 6).map(todayCard).join('')
      : '<div class="today-empty">Nada por aquí 🎉</div>';
    return '<div class="today-col ' + cls + '"><div class="today-col-head">' + title +
      '<span class="today-col-count">' + items.length + '</span></div>' +
      '<div class="today-col-body">' + body + '</div></div>';
  }

  function todayCard(t) {
    const days = H.daysUntil(t.dueDate);
    let due = H.formatDate(t.dueDate);
    if (days < 0) due = 'Venció hace ' + Math.abs(days) + 'd';
    else if (days === 0) due = 'Vence hoy';
    else due = 'En ' + days + 'd';
    return '<div class="today-task" data-id="' + t.id + '">' +
      '<div class="tt-top"><span class="prio-tag prio-' + t.priority + '">' + H.priorityLabel(t.priority) + '</span>' +
      '<span class="tt-pct">' + t.progress + '%</span></div>' +
      '<div class="tt-name">' + H.escapeHtml(t.name) + '</div>' +
      '<div class="tt-foot"><span>' + due + '</span></div>' +
      Tasks.progressBar(t.progress, 'sm') + '</div>';
  }

  global.Dashboard = { render };

})(window);
