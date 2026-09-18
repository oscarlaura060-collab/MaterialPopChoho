/* ==========================================================================
   CHOHO TASKS · kpis.js
   Módulo de indicadores con filtros dinámicos.
   ========================================================================== */

(function (global) {
  'use strict';

  let filters = {};

  function render(container) {
    container.innerHTML =
      '<div class="view-toolbar"><h2 class="view-title">📊 KPIs</h2>' +
        '<button class="btn btn-ghost" id="kpi-export">⬇️ Exportar KPIs (CSV)</button></div>' +
      filtersBar() +
      '<div id="kpi-content"></div>';

    wireFilters(container);
    H.el('kpi-export').addEventListener('click', exportKPIs);
    paint();
  }

  function filtersBar() {
    const tasks = Storage.getTasks();
    const projects = Storage.getProjects();
    const months = monthOptions(tasks);

    return '<div class="filters-bar card">' +
      selectFilter('month', 'Mes', months) +
      selectFilter('project', 'Proyecto', projects.map(p => [p.id, p.name])) +
      selectFilter('category', 'Categoría', Metrics.distinctValues(tasks, 'category').map(v => [v, v])) +
      selectFilter('priority', 'Prioridad', [['alta', 'Alta'], ['media', 'Media'], ['baja', 'Baja']]) +
      selectFilter('status', 'Estado', [['pendiente', 'Pendiente'], ['en_progreso', 'En progreso'], ['en_espera', 'En espera'], ['completada', 'Completada'], ['vencida', 'Vencida']]) +
      selectFilter('responsible', 'Responsable', Metrics.distinctValues(tasks, 'responsible').map(v => [v, v])) +
      selectFilter('client', 'Cliente', Metrics.distinctValues(tasks, 'client').map(v => [v, v])) +
      selectFilter('city', 'Ciudad', Metrics.distinctValues(tasks, 'city').map(v => [v, v])) +
      '<button class="btn btn-sm btn-ghost" id="kpi-clear">Limpiar</button>' +
    '</div>';
  }

  function monthOptions(tasks) {
    const set = new Set();
    tasks.forEach(t => { const k = H.monthKey(t.dueDate); if (k) set.add(k); });
    return Array.from(set).sort().reverse().map(k => {
      const [y, m] = k.split('-');
      return [k, H.monthName(Number(m) - 1) + ' ' + y];
    });
  }

  function selectFilter(name, label, options) {
    const opts = '<option value="">' + label + ': todos</option>' +
      options.map(o => '<option value="' + H.escapeHtml(o[0]) + '"' +
        (filters[name] === o[0] ? ' selected' : '') + '>' + H.escapeHtml(o[1]) + '</option>').join('');
    return '<select class="filter-select" data-filter="' + name + '">' + opts + '</select>';
  }

  function wireFilters(container) {
    H.qsa('.filter-select', container).forEach(sel => {
      sel.addEventListener('change', () => {
        const key = sel.getAttribute('data-filter');
        if (sel.value) filters[key] = sel.value; else delete filters[key];
        paint();
      });
    });
    H.el('kpi-clear').addEventListener('click', () => { filters = {}; render(container); });
  }

  function paint() {
    const tasks = Metrics.applyFilters(Storage.getTasks(), filters);
    const s = Metrics.summary(tasks);
    const tm = Metrics.timeMetrics(tasks);
    const content = H.el('kpi-content');

    content.innerHTML =
      group('Productividad', [
        metric('Total de tareas', s.total),
        metric('Completadas', s.completadas),
        metric('En progreso', s.en_progreso),
        metric('Vencidas', s.vencidas)
      ]) +
      group('Cumplimiento', [
        metric('% de cumplimiento', s.compliance + '%', 'k-comp'),
        metric('% entregadas a tiempo', s.onTimeRate + '%', 'k-done'),
        metric('% atrasadas', s.overdueRate + '%', 'k-over')
      ]) +
      group('Tiempo', [
        metric('Días promedio para completar', tm.avgCompletionDays + ' d'),
        metric('Tiempo promedio de retraso', tm.avgDelayDays + ' d'),
        metric('Tareas entregadas tarde', tm.lateCount)
      ]) +
      '<div class="kpi-charts dash-grid">' +
        chartCard('Actividades por proyecto', 'kpi-proj') +
        chartCard('Actividades por categoría', 'kpi-cat') +
        chartCard('Actividades por prioridad', 'kpi-prio') +
        chartCard('Estado de tareas', 'kpi-status') +
      '</div>';

    Charts.horizontalBar('kpi-proj', Metrics.byProject(tasks));
    const cats = Metrics.byCategory(tasks);
    Charts.bar('kpi-cat', cats.map(c => c.label), cats.map(c => c.value), '#0ea5e9');
    Charts.donut('kpi-prio', Metrics.byPriority(tasks));
    Charts.donut('kpi-status', Metrics.statusBreakdown(tasks));
  }

  function group(title, items) {
    return '<div class="kpi-group"><h3 class="kpi-group-title">' + title + '</h3>' +
      '<div class="kpi-metrics">' + items.join('') + '</div></div>';
  }
  function metric(label, value, cls) {
    return '<div class="metric-card ' + (cls || '') + '"><div class="metric-value">' + value +
      '</div><div class="metric-label">' + label + '</div></div>';
  }
  function chartCard(title, id) {
    return '<div class="card chart-card"><div class="card-head"><h3>' + title + '</h3></div>' +
      '<div class="chart-holder"><canvas id="' + id + '"></canvas></div></div>';
  }

  function exportKPIs() {
    const tasks = Metrics.applyFilters(Storage.getTasks(), filters);
    const s = Metrics.summary(tasks);
    const tm = Metrics.timeMetrics(tasks);
    const rows = [
      { indicador: 'Total de tareas', valor: s.total },
      { indicador: 'Completadas', valor: s.completadas },
      { indicador: 'En progreso', valor: s.en_progreso },
      { indicador: 'Pendientes', valor: s.pendientes + s.en_espera },
      { indicador: 'Vencidas', valor: s.vencidas },
      { indicador: '% cumplimiento', valor: s.compliance + '%' },
      { indicador: '% entregadas a tiempo', valor: s.onTimeRate + '%' },
      { indicador: '% atrasadas', valor: s.overdueRate + '%' },
      { indicador: 'Días promedio para completar', valor: tm.avgCompletionDays },
      { indicador: 'Tiempo promedio de retraso', valor: tm.avgDelayDays }
    ];
    H.download('choho-kpis.csv', H.toCSV(rows, [{ key: 'indicador', label: 'Indicador' }, { key: 'valor', label: 'Valor' }]), 'text/csv;charset=utf-8');
    UI.toast('KPIs exportados', 'success');
  }

  global.KPIs = { render };

})(window);
