/* ==========================================================================
   CHOHO TASKS · reports.js
   Informe de gestión, exportaciones (CSV/PDF) y compartir seguimiento.
   ========================================================================== */

(function (global) {
  'use strict';

  function render(container) {
    const months = monthOptions();
    container.innerHTML =
      '<div class="view-toolbar"><h2 class="view-title">📈 Informes</h2></div>' +
      '<div class="card report-config">' +
        '<div class="rc-row">' +
          '<label class="field"><span class="field-label">Periodo</span>' +
            '<select id="rep-period">' +
              '<option value="month">Mes</option>' +
              '<option value="week">Semana (7 días)</option>' +
              '<option value="custom">Rango personalizado</option>' +
              '<option value="all">Todo</option>' +
            '</select></label>' +
          '<label class="field" id="rep-month-wrap"><span class="field-label">Mes</span>' +
            '<select id="rep-month">' + months.map(m => '<option value="' + m[0] + '">' + m[1] + '</option>').join('') + '</select></label>' +
          '<label class="field hidden" id="rep-from-wrap"><span class="field-label">Desde</span><input type="date" id="rep-from"></label>' +
          '<label class="field hidden" id="rep-to-wrap"><span class="field-label">Hasta</span><input type="date" id="rep-to"></label>' +
          '<button class="btn btn-primary" id="rep-generate">Generar informe</button>' +
        '</div>' +
      '</div>' +
      '<div class="export-row card">' +
        '<span class="export-title">Exportaciones rápidas</span>' +
        '<button class="btn btn-ghost btn-sm" id="exp-tasks-csv">⬇️ Exportar tareas (Excel/CSV)</button>' +
        '<button class="btn btn-ghost btn-sm" id="exp-tasks-pdf">📄 Exportar tareas (PDF)</button>' +
      '</div>' +
      '<div id="report-output"></div>';

    const period = H.el('rep-period');
    period.addEventListener('change', togglePeriodInputs);
    H.el('rep-generate').addEventListener('click', generate);
    H.el('exp-tasks-csv').addEventListener('click', exportTasksCSV);
    H.el('exp-tasks-pdf').addEventListener('click', () => printReport('tasks'));
    togglePeriodInputs();
  }

  function togglePeriodInputs() {
    const p = H.el('rep-period').value;
    H.el('rep-month-wrap').classList.toggle('hidden', p !== 'month');
    H.el('rep-from-wrap').classList.toggle('hidden', p !== 'custom');
    H.el('rep-to-wrap').classList.toggle('hidden', p !== 'custom');
  }

  function monthOptions() {
    const set = new Set();
    Storage.getTasks().forEach(t => { const k = H.monthKey(t.dueDate); if (k) set.add(k); });
    const cur = H.monthKey(new Date().toISOString());
    if (cur) set.add(cur);
    return Array.from(set).sort().reverse().map(k => {
      const [y, m] = k.split('-');
      return [k, H.monthName(Number(m) - 1) + ' ' + y];
    });
  }

  function currentFilters() {
    const p = H.el('rep-period').value;
    if (p === 'month') return { month: H.el('rep-month').value, _label: labelForMonth(H.el('rep-month').value) };
    if (p === 'week') {
      const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 6);
      return { from: H.toInputDate(from), to: H.toInputDate(to), _label: 'Últimos 7 días' };
    }
    if (p === 'custom') {
      const f = H.el('rep-from').value, t = H.el('rep-to').value;
      return { from: f, to: t, _label: (f ? H.formatDate(f) : '...') + ' — ' + (t ? H.formatDate(t) : '...') };
    }
    return { _label: 'Todo el periodo' };
  }

  function labelForMonth(k) {
    if (!k) return '';
    const [y, m] = k.split('-');
    return H.monthName(Number(m) - 1) + ' ' + y;
  }

  function generate() {
    const filters = currentFilters();
    const tasks = Metrics.applyFilters(Storage.getTasks(), filters);
    const html = buildReportHtml(tasks, filters._label, true);
    H.el('report-output').innerHTML = html;
    drawReportCharts(tasks);
    const dl = H.el('report-pdf-btn');
    if (dl) dl.addEventListener('click', () => printReport('report'));
    UI.toast('Informe generado', 'success');
  }

  // buildReportHtml también usado por la vista compartida (readonly)
  function buildReportHtml(tasks, periodLabel, editable) {
    const s = Metrics.summary(tasks);
    const user = Auth.currentUser() || Auth.DEFAULT_USER;
    const done = tasks.filter(t => t.status === 'completada');
    const pending = tasks.filter(t => t.status !== 'completada');

    const activityRows = done.slice(0, 30).map(t =>
      '<tr><td>' + H.escapeHtml(t.name) + '</td><td>' + H.escapeHtml(Tasks.projectName(t.projectId)) +
      '</td><td>' + H.formatDate(t.completedAt || t.dueDate) + '</td><td>' + t.progress + '%</td></tr>').join('') ||
      '<tr><td colspan="4" class="muted">Sin actividades completadas en el periodo.</td></tr>';

    const pendingRows = pending.slice(0, 30).map(t =>
      '<tr><td>' + H.escapeHtml(t.name) + '</td><td>' + H.escapeHtml(Tasks.projectName(t.projectId)) +
      '</td><td>' + H.statusLabel(H.effectiveStatus(t)) + '</td><td>' + H.formatDate(t.dueDate) + '</td><td>' + t.progress + '%</td></tr>').join('') ||
      '<tr><td colspan="5" class="muted">Sin pendientes 🎉</td></tr>';

    return '<div class="report-doc" id="report-doc">' +
      '<div class="report-header">' +
        '<div><div class="report-brand">CHOHO <span>TASKS</span></div>' +
        '<h1>Informe de gestión</h1>' +
        '<p class="report-person">' + H.escapeHtml(user.name) + (user.role ? ' · ' + H.escapeHtml(user.role) : '') + '</p>' +
        '<p class="report-period">' + H.escapeHtml(periodLabel || '') + '</p></div>' +
        (editable ? '<button class="btn btn-primary no-print" id="report-pdf-btn">📄 Exportar PDF</button>' : '') +
      '</div>' +
      '<h2 class="report-sec">Resumen</h2>' +
      '<div class="report-summary">' +
        rItem('Total actividades', s.total) + rItem('Completadas', s.completadas) +
        rItem('En progreso', s.en_progreso) + rItem('Pendientes', s.pendientes + s.en_espera) +
        rItem('Vencidas', s.vencidas) + rItem('Cumplimiento', s.compliance + '%', 'accent') +
      '</div>' +
      '<div class="report-charts">' +
        '<div class="report-chart"><h3>Estado</h3><div class="chart-holder sm"><canvas id="rep-chart-status"></canvas></div></div>' +
        '<div class="report-chart"><h3>Por proyecto</h3><div class="chart-holder sm"><canvas id="rep-chart-proj"></canvas></div></div>' +
      '</div>' +
      '<h2 class="report-sec">Principales actividades</h2>' +
      '<table class="report-table"><thead><tr><th>Actividad</th><th>Proyecto</th><th>Fecha</th><th>Avance</th></tr></thead><tbody>' +
        activityRows + '</tbody></table>' +
      '<h2 class="report-sec">Pendientes</h2>' +
      '<table class="report-table"><thead><tr><th>Actividad</th><th>Proyecto</th><th>Estado</th><th>Fecha límite</th><th>Avance</th></tr></thead><tbody>' +
        pendingRows + '</tbody></table>' +
      '<h2 class="report-sec">Resultados y conclusiones</h2>' +
      (editable
        ? '<textarea id="report-conclusion" class="report-conclusion" rows="4" placeholder="Escribe aquí tus conclusiones y resultados del periodo..."></textarea>'
        : '<p class="report-conclusion-ro" id="report-conclusion-ro"></p>') +
      '</div>';
  }

  function rItem(label, value, cls) {
    return '<div class="report-kpi ' + (cls || '') + '"><div class="rk-value">' + value +
      '</div><div class="rk-label">' + label + '</div></div>';
  }

  // Dibujar los gráficos del informe (después de insertar el HTML)
  function drawReportCharts(tasks) {
    Charts.donut('rep-chart-status', Metrics.statusBreakdown(tasks));
    Charts.horizontalBar('rep-chart-proj', Metrics.byProject(tasks));
  }

  /* --------------------------- EXPORTACIONES --------------------------- */

  function exportTasksCSV() {
    const tasks = Storage.getTasks();
    const rows = tasks.map(t => ({
      nombre: t.name, proyecto: Tasks.projectName(t.projectId), categoria: t.category,
      prioridad: H.priorityLabel(t.priority), estado: H.statusLabel(H.effectiveStatus(t)),
      avance: t.progress + '%', responsable: t.responsible, cliente: t.client, ciudad: t.city,
      inicio: t.startDate, limite: t.dueDate, proposito: t.purpose, resultado: t.expectedResult
    }));
    const cols = [
      { key: 'nombre', label: 'Nombre' }, { key: 'proyecto', label: 'Proyecto' },
      { key: 'categoria', label: 'Categoría' }, { key: 'prioridad', label: 'Prioridad' },
      { key: 'estado', label: 'Estado' }, { key: 'avance', label: 'Avance' },
      { key: 'responsable', label: 'Responsable' }, { key: 'cliente', label: 'Cliente' },
      { key: 'ciudad', label: 'Ciudad' }, { key: 'inicio', label: 'Inicio' },
      { key: 'limite', label: 'Fecha límite' }, { key: 'proposito', label: '¿Para qué?' },
      { key: 'resultado', label: 'Resultado esperado' }
    ];
    H.download('choho-tareas.csv', H.toCSV(rows, cols), 'text/csv;charset=utf-8');
    UI.toast('Tareas exportadas', 'success');
  }

  // Imilprimir a PDF usando el diálogo del navegador (sin librerías externas).
  function printReport(kind) {
    let tasks, label;
    if (kind === 'report') {
      const f = currentFilters(); tasks = Metrics.applyFilters(Storage.getTasks(), f); label = f._label;
    } else { tasks = Storage.getTasks(); label = 'Listado completo de tareas'; }

    const conclusionEl = H.el('report-conclusion');
    const conclusion = conclusionEl ? conclusionEl.value : '';
    const html = buildPrintDocument(tasks, label, conclusion);

    const win = window.open('', '_blank');
    if (!win) { UI.toast('Permite las ventanas emergentes para exportar PDF', 'warn'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  }

  function buildPrintDocument(tasks, label, conclusion) {
    const s = Metrics.summary(tasks);
    const user = Auth.currentUser() || Auth.DEFAULT_USER;
    const rows = tasks.map(t =>
      '<tr><td>' + H.escapeHtml(t.name) + '</td><td>' + H.escapeHtml(Tasks.projectName(t.projectId)) +
      '</td><td>' + H.statusLabel(H.effectiveStatus(t)) + '</td><td>' + t.progress + '%</td><td>' +
      H.formatDate(t.dueDate) + '</td></tr>').join('');

    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe CHOHO TASKS</title>' +
      '<style>' +
      'body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1e293b;margin:32px;}' +
      '.brand{font-weight:800;color:#4f6ef7;font-size:20px;letter-spacing:1px}' +
      'h1{margin:4px 0}h2{border-bottom:2px solid #eef1f8;padding-bottom:6px;margin-top:28px;color:#334155}' +
      '.person{color:#64748b}.period{color:#94a3b8;margin-top:2px}' +
      '.summary{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0}' +
      '.kpi{border:1px solid #e2e8f0;border-radius:10px;padding:12px 18px;min-width:120px}' +
      '.kpi .v{font-size:24px;font-weight:800}.kpi .l{color:#64748b;font-size:12px}' +
      '.kpi.accent{background:#4f6ef7;color:#fff;border:none}.kpi.accent .l{color:#dbe4ff}' +
      'table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px}' +
      'th,td{border:1px solid #e2e8f0;padding:8px;text-align:left}th{background:#f8fafc}' +
      '.concl{margin-top:12px;white-space:pre-wrap;border:1px solid #e2e8f0;border-radius:10px;padding:14px;min-height:60px}' +
      '@media print{body{margin:12mm}}' +
      '</style></head><body>' +
      '<div class="brand">CHOHO TASKS</div><h1>Informe de gestión</h1>' +
      '<div class="person">' + H.escapeHtml(user.name) + (user.role ? ' · ' + H.escapeHtml(user.role) : '') + '</div>' +
      '<div class="period">' + H.escapeHtml(label || '') + ' · Generado el ' + H.formatDate(new Date().toISOString()) + '</div>' +
      '<h2>Resumen</h2><div class="summary">' +
        pk('Total', s.total) + pk('Completadas', s.completadas) + pk('En progreso', s.en_progreso) +
        pk('Pendientes', s.pendientes + s.en_espera) + pk('Vencidas', s.vencidas) +
        pk('Cumplimiento', s.compliance + '%', true) +
      '</div>' +
      '<h2>Actividades</h2><table><thead><tr><th>Actividad</th><th>Proyecto</th><th>Estado</th><th>Avance</th><th>Fecha límite</th></tr></thead><tbody>' +
        (rows || '<tr><td colspan="5">Sin actividades</td></tr>') + '</tbody></table>' +
      '<h2>Resultados y conclusiones</h2><div class="concl">' + (H.escapeHtml(conclusion) || 'Sin conclusiones registradas.') + '</div>' +
      '</body></html>';
  }

  function pk(l, v, accent) {
    return '<div class="kpi' + (accent ? ' accent' : '') + '"><div class="v">' + v + '</div><div class="l">' + l + '</div></div>';
  }

  global.Reports = { render, drawReportCharts, buildReportHtml, exportTasksCSV, printReport };

})(window);
