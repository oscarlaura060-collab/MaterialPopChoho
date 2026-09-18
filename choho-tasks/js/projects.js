/* ==========================================================================
   CHOHO TASKS · projects.js
   Módulo de proyectos: tarjetas con avance calculado automáticamente.
   ========================================================================== */

(function (global) {
  'use strict';

  function render(container) {
    const projects = Storage.getProjects();

    const cards = projects.map(p => {
      const st = Metrics.projectStats(p.id);
      return '<div class="card project-card" data-id="' + p.id + '">' +
        '<div class="pc-head"><span class="pc-dot" style="background:' + p.color + '"></span>' +
          '<h3>' + H.escapeHtml(p.name) + '</h3>' +
          '<button class="icon-btn danger pc-del" data-id="' + p.id + '" title="Eliminar proyecto">🗑️</button></div>' +
        (p.description ? '<p class="pc-desc">' + H.escapeHtml(p.description) + '</p>' : '') +
        '<div class="pc-stats">' +
          stat(st.total, 'Tareas') + stat(st.completadas, 'Completadas') +
          stat(st.en_progreso, 'En progreso') + stat(st.pendientes, 'Pendientes') +
        '</div>' +
        '<div class="pc-progress"><div class="pc-progress-top"><span>Avance</span><b>' + st.progress + '%</b></div>' +
          '<div class="progress"><div class="progress-fill" style="width:' + st.progress + '%;background:' + p.color + '"></div></div></div>' +
        (st.vencidas ? '<div class="pc-warn">⚠️ ' + st.vencidas + ' vencida(s)</div>' : '') +
      '</div>';
    }).join('');

    container.innerHTML =
      '<div class="view-toolbar"><h2 class="view-title">📁 Proyectos</h2>' +
        '<button class="btn btn-primary" id="new-project-btn">+ Nuevo proyecto</button></div>' +
      '<div class="projects-grid">' +
        (cards || '<div class="empty-state"><div class="empty-icon">📁</div><p>Aún no tienes proyectos.</p></div>') +
      '</div>';

    H.el('new-project-btn').addEventListener('click', () => openProjectForm(null));

    H.qsa('.project-card', container).forEach(card => {
      card.addEventListener('click', function (e) {
        const del = e.target.closest('.pc-del');
        if (del) { e.stopPropagation(); confirmDelete(del.getAttribute('data-id')); return; }
        App.navigate('tareas', { project: card.getAttribute('data-id') });
      });
    });
  }

  function stat(value, label) {
    return '<div class="pc-stat"><div class="pc-stat-val">' + value + '</div>' +
      '<div class="pc-stat-lbl">' + label + '</div></div>';
  }

  function openProjectForm(id) {
    const p = id ? Storage.getProject(id) : null;
    const form = document.createElement('form');
    form.id = 'project-form-el';
    form.innerHTML =
      '<label class="field"><span class="field-label">Nombre *</span>' +
        '<input name="name" required value="' + H.escapeHtml(p ? p.name : '') + '"></label>' +
      '<label class="field"><span class="field-label">Descripción</span>' +
        '<textarea name="description" rows="2">' + H.escapeHtml(p ? p.description : '') + '</textarea></label>' +
      '<label class="field"><span class="field-label">Color</span>' +
        '<input type="color" name="color" value="' + (p ? p.color : '#4f6ef7') + '"></label>';
    const footer = document.createElement('div');
    const cancel = document.createElement('button');
    cancel.type = 'button'; cancel.className = 'btn btn-ghost'; cancel.textContent = 'Cancelar';
    const save = document.createElement('button');
    save.type = 'submit'; save.className = 'btn btn-primary'; save.textContent = 'Guardar';
    save.setAttribute('form', 'project-form-el');
    footer.appendChild(cancel); footer.appendChild(save);

    const modal = UI.openModal({ title: p ? 'Editar proyecto' : 'Nuevo proyecto', size: 'sm', body: form, footer: footer });
    cancel.addEventListener('click', modal.close);
    form.addEventListener('submit', e => {
      e.preventDefault();
      const data = { name: form.name.value.trim(), description: form.description.value.trim(), color: form.color.value };
      if (!data.name) { UI.toast('El nombre es obligatorio', 'error'); return; }
      if (p) Storage.updateProject(p.id, data); else Storage.createProject(data);
      UI.toast('Proyecto guardado', 'success');
      modal.close(); App.refresh();
    });
  }

  function confirmDelete(id) {
    const p = Storage.getProject(id);
    if (!p) return;
    UI.confirm('¿Eliminar el proyecto "' + p.name + '"? Las tareas se conservarán pero quedarán sin proyecto.',
      { title: 'Eliminar proyecto', danger: true, okText: 'Eliminar' }).then(ok => {
        if (ok) { Storage.deleteProject(id); UI.toast('Proyecto eliminado', 'info'); App.refresh(); }
      });
  }

  global.Projects = { render, openProjectForm };

})(window);
