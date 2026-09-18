/* ==========================================================================
   CHOHO TASKS · notifications.js
   Centro de notificaciones derivado del estado de las tareas.
   ========================================================================== */

(function (global) {
  'use strict';

  // Calcula las notificaciones actuales a partir de las tareas.
  function compute() {
    const tasks = Storage.getTasks();
    const notes = [];
    const overdue = [], dueTomorrow = [], stale = [], recentDone = [];
    const now = H.today();

    tasks.forEach(t => {
      if (t.status === 'completada') {
        if (t.completedAt) {
          const days = Math.round((now - H.startOfDay(H.parseDate(t.completedAt))) / H.MS_DAY);
          if (days <= 2) recentDone.push(t);
        }
        return;
      }
      const d = H.daysUntil(t.dueDate);
      if (d !== null && d < 0) overdue.push(t);
      else if (d === 1) dueTomorrow.push(t);
      // Sin actualizar hace más de 3 días
      const upd = H.parseDate(t.updatedAt);
      if (upd) {
        const sinceUpdate = Math.round((now - H.startOfDay(upd)) / H.MS_DAY);
        if (sinceUpdate > 3) stale.push(t);
      }
    });

    if (overdue.length) notes.push(note('over', '🔴', overdue.length + ' tarea(s) vencida(s)', overdue));
    if (dueTomorrow.length) notes.push(note('soon', '🟠', dueTomorrow.length + ' tarea(s) vencen mañana', dueTomorrow));
    if (stale.length) notes.push(note('stale', '🟡', stale.length + ' tarea(s) llevan más de 3 días sin actualizar', stale));
    if (recentDone.length) notes.push(note('done', '🟢', recentDone.length + ' actividad(es) completada(s) recientemente', recentDone));

    return notes;
  }

  function note(type, icon, text, tasks) {
    return { type, icon, text, tasks };
  }

  function count() {
    const notes = compute();
    // Contar las "accionables" (no las verdes)
    return notes.filter(n => n.type !== 'done').reduce((a, n) => a + n.tasks.length, 0);
  }

  function updateBadge() {
    const badge = H.el('notif-badge');
    if (!badge) return;
    const c = count();
    badge.textContent = c;
    badge.classList.toggle('hidden', c === 0);
  }

  function render(container) {
    const notes = compute();
    container.innerHTML =
      '<div class="view-toolbar"><h2 class="view-title">🔔 Notificaciones</h2></div>' +
      (notes.length
        ? '<div class="notif-list">' + notes.map(renderNote).join('') + '</div>'
        : '<div class="empty-state"><div class="empty-icon">🔔</div><p>Todo al día. No hay notificaciones.</p></div>');

    H.qsa('.notif-task', container).forEach(el =>
      el.addEventListener('click', () => Tasks.openTaskDetail(el.getAttribute('data-id'))));
  }

  function renderNote(n) {
    const items = n.tasks.slice(0, 8).map(t =>
      '<li class="notif-task" data-id="' + t.id + '"><span>' + H.escapeHtml(t.name) + '</span>' +
      '<span class="notif-due">' + (t.dueDate ? H.formatDate(t.dueDate) : '') + '</span></li>').join('');
    return '<div class="notif-card notif-' + n.type + '">' +
      '<div class="notif-head"><span class="notif-icon">' + n.icon + '</span><h3>' + H.escapeHtml(n.text) + '</h3></div>' +
      '<ul class="notif-tasks">' + items + '</ul></div>';
  }

  global.Notifications = { compute, count, updateBadge, render };

})(window);
