/* ==========================================================================
   CHOHO TASKS · metrics.js
   Cálculo de indicadores, filtros y agregaciones sobre las tareas.
   Usado por Dashboard, KPIs, Informes y Compartir.
   ========================================================================== */

(function (global) {
  'use strict';

  /* --------------------------- FILTROS --------------------------------- */

  // filters: { from, to, project, category, priority, status, responsible, client, city, month, week, search }
  function applyFilters(tasks, filters) {
    filters = filters || {};
    return tasks.filter(t => {
      const eff = H.effectiveStatus(t);

      if (filters.project && t.projectId !== filters.project) return false;
      if (filters.category && t.category !== filters.category) return false;
      if (filters.priority && t.priority !== filters.priority) return false;
      if (filters.responsible && t.responsible !== filters.responsible) return false;
      if (filters.client && t.client !== filters.client) return false;
      if (filters.city && t.city !== filters.city) return false;
      if (filters.status) {
        if (filters.status === 'vencida') { if (eff !== 'vencida') return false; }
        else if (t.status !== filters.status) return false;
      }
      if (filters.month) {
        if (H.monthKey(t.dueDate) !== filters.month &&
            H.monthKey(t.startDate) !== filters.month) return false;
      }
      if (filters.week) {
        if (H.weekKey(t.dueDate) !== filters.week) return false;
      }
      if (filters.from) {
        const ref = H.parseDate(t.dueDate) || H.parseDate(t.startDate);
        if (!ref || ref < H.parseDate(filters.from)) return false;
      }
      if (filters.to) {
        const ref = H.parseDate(t.dueDate) || H.parseDate(t.startDate);
        if (!ref || ref > H.parseDate(filters.to)) return false;
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const hay = [t.name, t.description, t.purpose, t.expectedResult,
                     t.client, t.city, t.category, t.notes, t.responsible]
          .join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  /* --------------------------- RESUMEN --------------------------------- */

  function summary(tasks) {
    const s = {
      total: tasks.length,
      completadas: 0,
      en_progreso: 0,
      pendientes: 0,
      en_espera: 0,
      vencidas: 0,
      onTime: 0,        // completadas dentro de plazo
      lateCompleted: 0, // completadas con retraso
      avgProgress: 0
    };
    let progressSum = 0;
    tasks.forEach(t => {
      const eff = H.effectiveStatus(t);
      progressSum += Number(t.progress) || 0;
      if (t.status === 'completada') {
        s.completadas++;
        const done = t.completedAt ? H.parseDate(t.completedAt) : null;
        const due = H.parseDate(t.dueDate);
        if (done && due && H.startOfDay(done) > H.startOfDay(due)) s.lateCompleted++;
        else s.onTime++;
      } else if (eff === 'vencida') {
        s.vencidas++;
        if (t.status === 'en_progreso') s.en_progreso++;
        else if (t.status === 'en_espera') s.en_espera++;
        else s.pendientes++;
      } else if (t.status === 'en_progreso') s.en_progreso++;
      else if (t.status === 'en_espera') s.en_espera++;
      else s.pendientes++;
    });
    s.avgProgress = tasks.length ? Math.round(progressSum / tasks.length) : 0;
    // Cumplimiento = completadas / total
    s.compliance = H.pct(s.completadas, s.total);
    // % entregadas a tiempo (sobre completadas)
    s.onTimeRate = s.completadas ? H.pct(s.onTime, s.completadas) : 0;
    s.lateRate = s.completadas ? H.pct(s.lateCompleted, s.completadas) : 0;
    // % atrasadas sobre total
    s.overdueRate = H.pct(s.vencidas, s.total);
    return s;
  }

  /* ------------------------ TIEMPOS PROMEDIO --------------------------- */

  function timeMetrics(tasks) {
    let completeDays = [], lateDays = [];
    tasks.forEach(t => {
      if (t.status === 'completada' && t.completedAt) {
        const start = H.parseDate(t.startDate) || H.parseDate(t.createdAt);
        const done = H.parseDate(t.completedAt);
        if (start && done) {
          const days = Math.max(0, Math.round((H.startOfDay(done) - H.startOfDay(start)) / H.MS_DAY));
          completeDays.push(days);
        }
        const due = H.parseDate(t.dueDate);
        if (due && done && H.startOfDay(done) > H.startOfDay(due)) {
          lateDays.push(Math.round((H.startOfDay(done) - H.startOfDay(due)) / H.MS_DAY));
        }
      }
    });
    const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    return {
      avgCompletionDays: avg(completeDays),
      avgDelayDays: avg(lateDays),
      lateCount: lateDays.length
    };
  }

  /* --------------------------- AGRUPACIONES ---------------------------- */

  function countBy(tasks, keyFn) {
    const map = {};
    tasks.forEach(t => {
      const k = keyFn(t) || '—';
      map[k] = (map[k] || 0) + 1;
    });
    return map;
  }

  function byProject(tasks) {
    const projects = Storage.getProjects();
    const map = countBy(tasks, t => t.projectId || 'sin');
    return projects.map(p => ({ label: p.name, value: map[p.id] || 0, color: p.color }))
      .concat(map['sin'] ? [{ label: 'Sin proyecto', value: map['sin'], color: '#94a3b8' }] : [])
      .filter(x => x.value > 0);
  }

  function byCategory(tasks) {
    const map = countBy(tasks, t => t.category);
    return Object.keys(map).map(k => ({ label: k, value: map[k] }));
  }

  function byPriority(tasks) {
    const order = ['alta', 'media', 'baja'];
    const map = countBy(tasks, t => t.priority);
    return order.filter(k => map[k]).map(k => ({
      label: H.priorityLabel(k), value: map[k], color: H.PRIORITY_COLORS[k]
    }));
  }

  // Reparto MUTUAMENTE EXCLUYENTE para gráficos (las porciones suman el total):
  // una tarea vencida se cuenta solo como "vencida", no también en su estado base.
  function statusBreakdown(tasks) {
    let completadas = 0, enProgreso = 0, pendientes = 0, vencidas = 0;
    tasks.forEach(t => {
      const eff = H.effectiveStatus(t);
      if (t.status === 'completada') completadas++;
      else if (eff === 'vencida') vencidas++;
      else if (t.status === 'en_progreso') enProgreso++;
      else pendientes++; // pendiente + en_espera (no vencidas)
    });
    return [
      { key: 'completada', label: 'Completadas', value: completadas, color: H.STATUS_COLORS.completada },
      { key: 'en_progreso', label: 'En progreso', value: enProgreso, color: H.STATUS_COLORS.en_progreso },
      { key: 'pendiente', label: 'Pendientes', value: pendientes, color: H.STATUS_COLORS.pendiente },
      { key: 'vencida', label: 'Vencidas', value: vencidas, color: H.STATUS_COLORS.vencida }
    ];
  }

  // Completadas por semana (últimas N semanas)
  function completedByWeek(tasks, weeks) {
    weeks = weeks || 8;
    const buckets = [];
    const base = H.today();
    // Lunes de esta semana
    const dow = (base.getDay() + 6) % 7;
    const monday = new Date(base); monday.setDate(base.getDate() - dow);
    for (let i = weeks - 1; i >= 0; i--) {
      const start = new Date(monday); start.setDate(monday.getDate() - i * 7);
      const end = new Date(start); end.setDate(start.getDate() + 6);
      buckets.push({ start, end, label: start.getDate() + '/' + (start.getMonth() + 1), count: 0, key: H.weekKey(start) });
    }
    tasks.forEach(t => {
      if (t.status !== 'completada' || !t.completedAt) return;
      const done = H.parseDate(t.completedAt);
      if (!done) return;
      const b = buckets.find(bk => H.startOfDay(done) >= H.startOfDay(bk.start) &&
                                    H.startOfDay(done) <= H.startOfDay(bk.end));
      if (b) b.count++;
    });
    return buckets;
  }

  // Evolución del cumplimiento por mes (últimos N meses)
  function complianceByMonth(tasks, months) {
    months = months || 6;
    const buckets = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0'),
        label: H.monthName(dt.getMonth()).slice(0, 3),
        total: 0, done: 0
      });
    }
    tasks.forEach(t => {
      const k = H.monthKey(t.dueDate) || H.monthKey(t.startDate);
      const b = buckets.find(bk => bk.key === k);
      if (b) {
        b.total++;
        if (t.status === 'completada') b.done++;
      }
    });
    return buckets.map(b => ({
      label: b.label,
      value: b.total ? Math.round((b.done / b.total) * 100) : 0
    }));
  }

  /* --------------------------- "HOY" ----------------------------------- */

  function todayBuckets(tasks) {
    const dueToday = [], overdue = [], upcoming = [], highPriority = [];
    tasks.forEach(t => {
      if (t.status === 'completada') return;
      const days = H.daysUntil(t.dueDate);
      if (days === null) return;
      if (days < 0) overdue.push(t);
      else if (days === 0) dueToday.push(t);
      else if (days <= 3) upcoming.push(t);
      if (t.priority === 'alta' && days >= 0) highPriority.push(t);
    });
    const byDue = (a, b) => (H.daysUntil(a.dueDate) - H.daysUntil(b.dueDate));
    return {
      dueToday: dueToday.sort(byDue),
      overdue: overdue.sort(byDue),
      upcoming: upcoming.sort(byDue),
      highPriority: highPriority.sort(byDue)
    };
  }

  /* ------------------------- OPCIONES DE FILTRO ------------------------ */

  function distinctValues(tasks, key) {
    const set = new Set();
    tasks.forEach(t => { if (t[key]) set.add(t[key]); });
    return Array.from(set).sort();
  }

  /* --------------------------- PROYECTOS ------------------------------- */

  function projectStats(projectId) {
    const tasks = Storage.getTasks().filter(t => t.projectId === projectId);
    const s = summary(tasks);
    // Avance general = promedio de avance de las tareas
    const progress = tasks.length
      ? Math.round(tasks.reduce((a, t) => a + (Number(t.progress) || 0), 0) / tasks.length)
      : 0;
    return {
      total: s.total,
      completadas: s.completadas,
      en_progreso: s.en_progreso,
      pendientes: s.pendientes + s.en_espera,
      vencidas: s.vencidas,
      progress: progress
    };
  }

  global.Metrics = {
    applyFilters, summary, timeMetrics, countBy,
    byProject, byCategory, byPriority, statusBreakdown,
    completedByWeek, complianceByMonth, todayBuckets,
    distinctValues, projectStats
  };

})(window);
