/* ==========================================================================
   CHOHO TASKS · tasks.js
   Gestión de tareas: lista, kanban, formulario, detalle y seguimiento.
   ========================================================================== */

(function (global) {
  'use strict';

  let currentView = 'lista';       // lista | kanban | calendario
  let currentFilters = {};

  /* ------------------------- helpers de render ------------------------- */

  function projectName(id) {
    const p = Storage.getProject(id);
    return p ? p.name : 'Sin proyecto';
  }
  function projectColor(id) {
    const p = Storage.getProject(id);
    return p ? p.color : '#94a3b8';
  }

  function statusBadge(task) {
    const eff = H.effectiveStatus(task);
    return '<span class="badge badge-status status-' + eff + '">' +
      H.statusLabel(eff) + '</span>';
  }
  function priorityBadge(task) {
    return '<span class="badge badge-priority prio-' + task.priority + '">' +
      '<span class="dot"></span>' + H.priorityLabel(task.priority) + '</span>';
  }
  function progressBar(v, cls) {
    v = H.clamp(Number(v) || 0, 0, 100);
    return '<div class="progress ' + (cls || '') + '"><div class="progress-fill" style="width:' +
      v + '%"></div></div>';
  }
  function dueChip(task) {
    const days = H.daysUntil(task.dueDate);
    if (days === null) return '<span class="due-chip">Sin fecha</span>';
    let cls = 'due-ok', txt = H.formatDate(task.dueDate);
    if (task.status === 'completada') { cls = 'due-done'; }
    else if (days < 0) { cls = 'due-late'; txt = 'Venció hace ' + Math.abs(days) + 'd'; }
    else if (days === 0) { cls = 'due-today'; txt = 'Vence hoy'; }
    else if (days <= 3) { cls = 'due-soon'; txt = 'En ' + days + 'd'; }
    return '<span class="due-chip ' + cls + '">📅 ' + txt + '</span>';
  }

  /* ============================= LISTA ================================= */

  function renderList(container, filters) {
    currentFilters = filters || {};
    const tasks = Metrics.applyFilters(Storage.getTasks(), currentFilters);
    tasks.sort((a, b) => {
      const da = H.daysUntil(a.dueDate), db = H.daysUntil(b.dueDate);
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });

    if (!tasks.length) {
      container.innerHTML = emptyState('No hay tareas que coincidan con los filtros.');
      return;
    }

    const rows = tasks.map(t => {
      return '<tr data-id="' + t.id + '" class="task-row">' +
        '<td><div class="cell-name"><span class="proj-dot" style="background:' +
          projectColor(t.projectId) + '"></span><div>' +
          '<div class="t-name">' + H.escapeHtml(t.name) + '</div>' +
          '<div class="t-sub">' + H.escapeHtml(projectName(t.projectId)) +
          (t.client ? ' · ' + H.escapeHtml(t.client) : '') + '</div></div></div></td>' +
        '<td>' + priorityBadge(t) + '</td>' +
        '<td>' + statusBadge(t) + '</td>' +
        '<td class="col-progress">' + progressBar(t.progress) +
          '<span class="progress-num">' + t.progress + '%</span></td>' +
        '<td>' + dueChip(t) + '</td>' +
        '<td class="col-actions">' +
          '<button class="icon-btn" data-act="progress" title="Actualizar progreso">📈</button>' +
          '<button class="icon-btn" data-act="edit" title="Editar">✏️</button>' +
          '<button class="icon-btn danger" data-act="delete" title="Eliminar">🗑️</button>' +
        '</td></tr>';
    }).join('');

    container.innerHTML =
      '<div class="table-wrap"><table class="task-table">' +
      '<thead><tr><th>Tarea</th><th>Prioridad</th><th>Estado</th>' +
      '<th>Avance</th><th>Fecha límite</th><th></th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';

    H.qsa('.task-row', container).forEach(row => {
      row.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-act]');
        const id = row.getAttribute('data-id');
        if (btn) {
          e.stopPropagation();
          const act = btn.getAttribute('data-act');
          if (act === 'progress') openProgressModal(id);
          else if (act === 'edit') openTaskForm(id);
          else if (act === 'delete') confirmDelete(id);
          return;
        }
        openTaskDetail(id);
      });
    });
  }

  function emptyState(msg, action) {
    return '<div class="empty-state"><div class="empty-icon">🗂️</div><p>' +
      H.escapeHtml(msg) + '</p>' + (action || '') + '</div>';
  }

  /* ============================= KANBAN =============================== */

  const KANBAN_COLS = [
    { key: 'pendiente', label: 'Pendiente' },
    { key: 'en_progreso', label: 'En progreso' },
    { key: 'en_espera', label: 'En espera' },
    { key: 'completada', label: 'Completada' }
  ];

  function renderKanban(container, filters) {
    currentFilters = filters || {};
    const tasks = Metrics.applyFilters(Storage.getTasks(), currentFilters);

    const cols = KANBAN_COLS.map(col => {
      const items = tasks.filter(t => t.status === col.key);
      const cards = items.map(kanbanCard).join('') ||
        '<div class="kanban-empty">Sin tareas</div>';
      return '<div class="kanban-col" data-status="' + col.key + '">' +
        '<div class="kanban-col-head"><span class="kanban-col-title col-' + col.key + '">' +
          col.label + '</span><span class="kanban-count">' + items.length + '</span></div>' +
        '<div class="kanban-list" data-status="' + col.key + '">' + cards + '</div></div>';
    }).join('');

    container.innerHTML = '<div class="kanban-board">' + cols + '</div>';
    wireKanbanDnD(container);
  }

  function kanbanCard(t) {
    return '<div class="kanban-card" draggable="true" data-id="' + t.id + '">' +
      '<div class="kc-top">' + priorityBadge(t) +
        '<span class="proj-dot" style="background:' + projectColor(t.projectId) + '"></span></div>' +
      '<div class="kc-name">' + H.escapeHtml(t.name) + '</div>' +
      '<div class="kc-proj">' + H.escapeHtml(projectName(t.projectId)) + '</div>' +
      progressBar(t.progress, 'sm') +
      '<div class="kc-foot">' + dueChip(t) +
        '<span class="kc-resp" title="' + H.escapeHtml(t.responsible) + '">' +
        H.escapeHtml(H.initials(t.responsible)) + '</span></div></div>';
  }

  function wireKanbanDnD(container) {
    let dragId = null;

    H.qsa('.kanban-card', container).forEach(card => {
      card.addEventListener('dragstart', e => {
        dragId = card.getAttribute('data-id');
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', dragId); } catch (err) {}
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
      card.addEventListener('click', () => openTaskDetail(card.getAttribute('data-id')));
    });

    H.qsa('.kanban-list', container).forEach(list => {
      list.addEventListener('dragover', e => {
        e.preventDefault();
        list.classList.add('drag-over');
      });
      list.addEventListener('dragleave', () => list.classList.remove('drag-over'));
      list.addEventListener('drop', e => {
        e.preventDefault();
        list.classList.remove('drag-over');
        const id = dragId || (e.dataTransfer && e.dataTransfer.getData('text/plain'));
        const status = list.getAttribute('data-status');
        if (!id || !status) return;
        const patch = { status: status };
        if (status === 'completada') { patch.progress = 100; patch.completedAt = new Date().toISOString(); }
        else if (Storage.getTask(id).status === 'completada') { patch.completedAt = null; }
        Storage.updateTask(id, patch);
        UI.toast('Tarea movida a "' + H.statusLabel(status) + '"', 'success');
        App.refresh();
      });
    });
  }

  /* ========================= FORMULARIO =============================== */

  function openTaskForm(id) {
    const task = id ? Storage.getTask(id) : null;
    const projects = Storage.getProjects();
    const projOptions = projects.map(p =>
      '<option value="' + p.id + '"' + (task && task.projectId === p.id ? ' selected' : '') +
      '>' + H.escapeHtml(p.name) + '</option>').join('');

    const t = task || {};
    const form = document.createElement('form');
    form.className = 'task-form';
    form.innerHTML =
      field('Nombre de tarea *', '<input name="name" required maxlength="140" value="' +
        H.escapeHtml(t.name || '') + '" placeholder="Ej: Gestionar instalación de avisos">') +
      field('Descripción', '<textarea name="description" rows="2" placeholder="Detalle de la tarea">' +
        H.escapeHtml(t.description || '') + '</textarea>') +
      '<div class="form-highlight">' +
        field('¿Para qué se realiza? *', '<textarea name="purpose" rows="2" required placeholder="El propósito: para qué haces esta actividad">' +
          H.escapeHtml(t.purpose || '') + '</textarea>') +
        field('Resultado esperado *', '<textarea name="expectedResult" rows="2" required placeholder="Qué resultado concreto esperas obtener">' +
          H.escapeHtml(t.expectedResult || '') + '</textarea>') +
      '</div>' +
      '<div class="form-grid">' +
        field('Proyecto', '<select name="projectId"><option value="">Sin proyecto</option>' + projOptions + '</select>') +
        field('Categoría', '<input name="category" list="cat-list" value="' + H.escapeHtml(t.category || 'General') + '">') +
        field('Prioridad', selectOptions('priority', [['baja', 'Baja'], ['media', 'Media'], ['alta', 'Alta']], t.priority || 'media')) +
        field('Responsable', '<input name="responsible" value="' + H.escapeHtml(t.responsible || (Auth.currentUser() ? Auth.currentUser().name : '')) + '">') +
        field('Fecha de inicio', '<input type="date" name="startDate" value="' + H.toInputDate(t.startDate) + '">') +
        field('Fecha límite', '<input type="date" name="dueDate" value="' + H.toInputDate(t.dueDate) + '">') +
        field('Estado', selectOptions('status', [['pendiente', 'Pendiente'], ['en_progreso', 'En progreso'], ['en_espera', 'En espera'], ['completada', 'Completada']], t.status || 'pendiente')) +
        field('% de avance', '<input type="number" name="progress" min="0" max="100" step="5" value="' + (t.progress != null ? t.progress : 0) + '">') +
        field('Cliente', '<input name="client" value="' + H.escapeHtml(t.client || '') + '">') +
        field('Ciudad', '<input name="city" value="' + H.escapeHtml(t.city || '') + '">') +
      '</div>' +
      field('Observaciones', '<textarea name="notes" rows="2">' + H.escapeHtml(t.notes || '') + '</textarea>') +
      field('Link de evidencia', '<input type="url" name="evidenceLink" placeholder="https://..." value="' + H.escapeHtml(t.evidenceLink || '') + '">') +
      '<datalist id="cat-list">' + categoryDatalist() + '</datalist>';

    const footer = document.createElement('div');
    const cancel = document.createElement('button');
    cancel.type = 'button'; cancel.className = 'btn btn-ghost'; cancel.textContent = 'Cancelar';
    const save = document.createElement('button');
    save.type = 'submit'; save.className = 'btn btn-primary';
    save.textContent = task ? 'Guardar cambios' : 'Crear tarea';
    save.setAttribute('form', 'task-form-el');
    footer.appendChild(cancel); footer.appendChild(save);
    form.id = 'task-form-el';

    const modal = UI.openModal({
      title: task ? 'Editar tarea' : 'Nueva tarea',
      size: 'lg', body: form, footer: footer
    });
    cancel.addEventListener('click', modal.close);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const data = readForm(form);
      if (!data.name.trim()) { UI.toast('El nombre es obligatorio', 'error'); return; }
      if (data.startDate && data.dueDate && H.parseDate(data.dueDate) < H.parseDate(data.startDate)) {
        UI.toast('La fecha límite no puede ser anterior al inicio', 'error'); return;
      }
      data.progress = H.clamp(Number(data.progress) || 0, 0, 100);
      if (data.status === 'completada') { data.progress = 100; data.completedAt = new Date().toISOString(); }
      if (task) {
        Storage.updateTask(task.id, data);
        UI.toast('Tarea actualizada', 'success');
      } else {
        Storage.createTask(data);
        UI.toast('Tarea creada', 'success');
      }
      modal.close();
      App.refresh();
    });
  }

  function field(label, control) {
    return '<label class="field"><span class="field-label">' + label + '</span>' + control + '</label>';
  }
  function selectOptions(name, pairs, selected) {
    return '<select name="' + name + '">' + pairs.map(p =>
      '<option value="' + p[0] + '"' + (p[0] === selected ? ' selected' : '') + '>' + p[1] + '</option>'
    ).join('') + '</select>';
  }
  function categoryDatalist() {
    const cats = new Set(['General', 'Instalación', 'Logística', 'Compras', 'Diseño', 'Reporte', 'Auditoría']);
    Storage.getTasks().forEach(t => { if (t.category) cats.add(t.category); });
    return Array.from(cats).map(c => '<option value="' + H.escapeHtml(c) + '">').join('');
  }
  function readForm(form) {
    const data = {};
    Array.from(form.elements).forEach(el => {
      if (el.name) data[el.name] = el.value;
    });
    return data;
  }

  /* ====================== ACTUALIZAR PROGRESO ========================= */

  function openProgressModal(id) {
    const task = Storage.getTask(id);
    if (!task) return;
    const wrap = document.createElement('div');
    wrap.className = 'progress-modal';
    wrap.innerHTML =
      '<div class="pm-task">' + H.escapeHtml(task.name) + '</div>' +
      '<label class="field"><span class="field-label">Porcentaje de avance</span>' +
        '<div class="range-row"><input type="range" id="pm-range" min="0" max="100" step="5" value="' + task.progress + '">' +
        '<span class="range-val" id="pm-val">' + task.progress + '%</span></div></label>' +
      '<label class="field"><span class="field-label">Comentario</span>' +
        '<textarea id="pm-comment" rows="3" placeholder="Ej: Se solicitaron las cotizaciones a los proveedores."></textarea></label>' +
      '<p class="pm-date">Fecha: ' + H.formatDateTime(new Date().toISOString()) + '</p>' +
      historyBlock(task);

    const footer = document.createElement('div');
    const cancel = document.createElement('button');
    cancel.className = 'btn btn-ghost'; cancel.textContent = 'Cancelar';
    const save = document.createElement('button');
    save.className = 'btn btn-primary'; save.textContent = 'Guardar actualización';
    footer.appendChild(cancel); footer.appendChild(save);

    const modal = UI.openModal({ title: 'Actualizar progreso', size: 'md', body: wrap, footer: footer });
    const range = H.el('pm-range'), val = H.el('pm-val');
    range.addEventListener('input', () => { val.textContent = range.value + '%'; });
    cancel.addEventListener('click', modal.close);
    save.addEventListener('click', () => {
      const comment = H.el('pm-comment').value;
      Storage.addTaskUpdate(id, Number(range.value), comment);
      UI.toast('Progreso actualizado', 'success');
      modal.close();
      App.refresh();
    });
  }

  function historyBlock(task) {
    const hist = (task.history || []).slice().sort((a, b) =>
      H.parseDate(b.date) - H.parseDate(a.date));
    if (!hist.length) return '<div class="history"><h4>Historial</h4><p class="muted">Sin actualizaciones aún.</p></div>';
    const items = hist.map(h =>
      '<li class="history-item"><div class="hi-date">' + H.formatDate(h.date) + '</div>' +
      '<div class="hi-body"><span class="hi-progress">' + h.progress + '%</span>' +
      '<span class="hi-comment">' + H.escapeHtml(h.comment || '—') + '</span></div></li>').join('');
    return '<div class="history"><h4>Historial</h4><ul class="history-list">' + items + '</ul></div>';
  }

  /* ========================= DETALLE ================================== */

  function openTaskDetail(id) {
    const task = Storage.getTask(id);
    if (!task) return;
    const eff = H.effectiveStatus(task);
    const wrap = document.createElement('div');
    wrap.className = 'task-detail';

    const evidences = (task.evidence || []).map(ev =>
      '<li>🔗 <a href="' + H.escapeHtml(ev.url || '#') + '" target="_blank" rel="noopener">' +
      H.escapeHtml(ev.label || ev.url) + '</a></li>').join('');
    const linkEv = task.evidenceLink
      ? '<li>🔗 <a href="' + H.escapeHtml(task.evidenceLink) + '" target="_blank" rel="noopener">' +
        H.escapeHtml(task.evidenceLink) + '</a></li>' : '';

    wrap.innerHTML =
      '<div class="detail-head">' +
        '<div class="detail-badges">' + priorityBadge(task) + statusBadge(task) + '</div>' +
        '<div class="detail-meta">' +
          '<span><b>Proyecto:</b> ' + H.escapeHtml(projectName(task.projectId)) + '</span>' +
          '<span><b>Responsable:</b> ' + H.escapeHtml(task.responsible || '—') + '</span>' +
          '<span><b>Fecha límite:</b> ' + H.formatDate(task.dueDate) + '</span>' +
          (task.client ? '<span><b>Cliente:</b> ' + H.escapeHtml(task.client) + '</span>' : '') +
          (task.city ? '<span><b>Ciudad:</b> ' + H.escapeHtml(task.city) + '</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="detail-progress"><div class="dp-label">Avance <b>' + task.progress + '%</b></div>' +
        progressBar(task.progress) + '</div>' +
      detailSection('¿Para qué?', task.purpose) +
      detailSection('Resultado esperado', task.expectedResult) +
      detailSection('Descripción', task.description) +
      detailSection('Observaciones', task.notes) +
      ((evidences || linkEv) ? '<div class="detail-block"><h4>Evidencias</h4><ul class="evidence-list">' +
        linkEv + evidences + '</ul></div>' : '') +
      '<div class="detail-block add-evidence">' +
        '<input type="url" id="ev-url" placeholder="https://enlace-de-evidencia">' +
        '<input type="text" id="ev-label" placeholder="Descripción (opcional)">' +
        '<button class="btn btn-sm btn-ghost" id="ev-add">Agregar evidencia</button></div>' +
      historyBlock(task);

    const footer = document.createElement('div');
    footer.className = 'detail-footer';
    const prog = document.createElement('button');
    prog.className = 'btn btn-primary'; prog.textContent = '📈 Actualizar progreso';
    const edit = document.createElement('button');
    edit.className = 'btn btn-ghost'; edit.textContent = '✏️ Editar';
    footer.appendChild(edit); footer.appendChild(prog);

    const modal = UI.openModal({ title: task.name, size: 'lg', body: wrap, footer: footer });
    prog.addEventListener('click', () => { modal.close(); openProgressModal(id); });
    edit.addEventListener('click', () => { modal.close(); openTaskForm(id); });

    H.el('ev-add').addEventListener('click', () => {
      const url = H.el('ev-url').value.trim();
      if (!url) { UI.toast('Ingresa un enlace', 'warn'); return; }
      Storage.addTaskEvidence(id, { url: url, label: H.el('ev-label').value.trim() });
      UI.toast('Evidencia agregada', 'success');
      modal.close();
      openTaskDetail(id);
    });
    // silenciar variable eff no usada si no aplica
    void eff;
  }

  function detailSection(title, content) {
    if (!content) return '';
    return '<div class="detail-block"><h4>' + title + '</h4><p>' +
      H.escapeHtml(content).replace(/\n/g, '<br>') + '</p></div>';
  }

  /* ========================== ELIMINAR ================================ */

  function confirmDelete(id) {
    const task = Storage.getTask(id);
    if (!task) return;
    UI.confirm('¿Eliminar la tarea "' + task.name + '"? Esta acción no se puede deshacer.',
      { title: 'Eliminar tarea', danger: true, okText: 'Eliminar' })
      .then(ok => {
        if (ok) {
          Storage.deleteTask(id);
          UI.toast('Tarea eliminada', 'info');
          App.refresh();
        }
      });
  }

  /* ============================ VISTA ================================= */

  function render(container, filters) {
    currentFilters = filters || {};
    const view = document.createElement('div');
    view.className = 'tasks-view';
    view.innerHTML =
      '<div class="view-toolbar">' +
        '<div class="seg-control" role="tablist">' +
          segBtn('lista', '📋 Lista') + segBtn('kanban', '📌 Kanban') + segBtn('calendario', '📅 Calendario') +
        '</div>' +
        '<div class="toolbar-right">' +
          '<input type="search" class="mini-search" id="tasks-search" placeholder="Filtrar tareas...">' +
          '<button class="btn btn-primary" id="new-task-btn">+ Nueva tarea</button>' +
        '</div>' +
      '</div>' +
      '<div id="tasks-body" class="tasks-body"></div>';
    container.innerHTML = '';
    container.appendChild(view);

    H.qsa('.seg-control .seg-btn', view).forEach(btn => {
      btn.addEventListener('click', () => {
        currentView = btn.getAttribute('data-view');
        H.qsa('.seg-control .seg-btn', view).forEach(b => b.classList.toggle('active', b === btn));
        paint();
      });
    });
    H.el('new-task-btn').addEventListener('click', () => openTaskForm(null));
    H.el('tasks-search').addEventListener('input', H.debounce(function (e) {
      currentFilters = Object.assign({}, currentFilters, { search: e.target.value });
      paint();
    }, 200));

    function paint() {
      const body = H.el('tasks-body');
      if (currentView === 'lista') renderList(body, currentFilters);
      else if (currentView === 'kanban') renderKanban(body, currentFilters);
      else CalendarView.render(body, currentFilters);
    }
    // set active seg
    H.qsa('.seg-control .seg-btn', view).forEach(b =>
      b.classList.toggle('active', b.getAttribute('data-view') === currentView));
    paint();
  }

  function segBtn(view, label) {
    return '<button class="seg-btn" data-view="' + view + '" role="tab">' + label + '</button>';
  }

  function setView(v) {
    if (['lista', 'kanban', 'calendario'].indexOf(v) !== -1) currentView = v;
  }

  global.Tasks = {
    render, renderList, renderKanban, setView,
    openTaskForm, openTaskDetail, openProgressModal, confirmDelete,
    // helpers reutilizables
    statusBadge, priorityBadge, progressBar, dueChip, projectName, projectColor
  };

})(window);
