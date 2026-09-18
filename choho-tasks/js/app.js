/* ==========================================================================
   CHOHO TASKS · app.js
   Controlador principal: autenticación, navegación, búsqueda, tema, perfil.
   ========================================================================== */

(function (global) {
  'use strict';

  let currentRoute = 'dashboard';
  let pendingFilters = null;

  const ROUTES = {
    dashboard:      { title: 'Dashboard',      render: c => Dashboard.render(c) },
    tareas:         { title: 'Mis tareas',     render: c => { Tasks.setView('lista'); Tasks.render(c, pendingFilters); } },
    kanban:         { title: 'Kanban',         render: c => { Tasks.setView('kanban'); Tasks.render(c, pendingFilters); } },
    calendario:     { title: 'Calendario',     render: c => { Tasks.setView('calendario'); Tasks.render(c, pendingFilters); } },
    proyectos:      { title: 'Proyectos',      render: c => Projects.render(c) },
    kpis:           { title: 'KPIs',           render: c => KPIs.render(c) },
    informes:       { title: 'Informes',       render: c => Reports.render(c) },
    notificaciones: { title: 'Notificaciones', render: c => Notifications.render(c) },
    perfil:         { title: 'Mi perfil',      render: c => renderProfile(c) },
    config:         { title: 'Configuración',  render: c => renderSettings(c) }
  };

  /* =============================== INIT =============================== */

  function init() {
    Auth.ensureDefaultUser();
    Seed.seed();
    applyTheme(Storage.getSettings().theme || 'light');

    if (Auth.isAuthenticated()) showApp();
    else showAuth();
  }

  /* ============================== AUTH =============================== */

  function showAuth() {
    H.el('auth-screen').classList.remove('hidden');
    H.el('app-shell').classList.add('hidden');
    wireLogin();
  }

  function wireLogin() {
    const form = H.el('login-form');
    if (!form || form._wired) return;
    form._wired = true;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const email = H.el('login-email').value.trim();
      const pass = H.el('login-password').value;
      const remember = H.el('login-remember').checked;
      const res = Auth.login(email, pass, remember);
      const err = H.el('login-error');
      if (!res.ok) { err.textContent = res.error; err.classList.remove('hidden'); return; }
      err.classList.add('hidden');
      showApp();
      UI.toast('Bienvenido, ' + res.user.name.split(' ')[0], 'success');
    });

    H.el('login-forgot').addEventListener('click', function (e) {
      e.preventDefault();
      const email = H.el('login-email').value.trim();
      if (!email) { UI.toast('Escribe tu correo primero', 'warn'); return; }
      const res = Auth.resetPasswordDemo(email);
      if (res.ok) UI.toast('Contraseña restablecida a la de demostración (choho123)', 'info');
      else UI.toast(res.error, 'error');
    });

    const toggle = H.el('login-toggle-pass');
    if (toggle) toggle.addEventListener('click', function () {
      const inp = H.el('login-password');
      inp.type = inp.type === 'password' ? 'text' : 'password';
      toggle.textContent = inp.type === 'password' ? '👁️' : '🙈';
    });

    // Pista de credenciales de demostración
    const hint = H.el('login-demo');
    if (hint) hint.addEventListener('click', function () {
      H.el('login-email').value = Auth.DEFAULT_USER.email;
      H.el('login-password').value = Auth.DEFAULT_USER.password;
    });
  }

  function showApp() {
    H.el('auth-screen').classList.add('hidden');
    H.el('app-shell').classList.remove('hidden');
    wireShell();
    renderUserChip();
    Notifications.updateBadge();
    navigate(currentRoute || 'dashboard');
  }

  function logout() {
    Auth.logout();
    Charts.destroyAll();
    currentRoute = 'dashboard';
    showAuth();
  }

  /* ============================== SHELL ============================== */

  function wireShell() {
    const shell = H.el('app-shell');
    if (shell._wired) return;
    shell._wired = true;

    H.qsa('.nav-item', shell).forEach(item => {
      item.addEventListener('click', () => {
        navigate(item.getAttribute('data-route'));
        closeSidebarMobile();
      });
    });

    H.el('logout-btn').addEventListener('click', logout);
    H.el('theme-toggle').addEventListener('click', toggleTheme);
    H.el('sidebar-toggle').addEventListener('click', toggleSidebarMobile);
    H.el('menu-btn').addEventListener('click', toggleSidebarMobile);

    const search = H.el('global-search');
    search.addEventListener('input', H.debounce(e => globalSearch(e.target.value), 220));
    search.addEventListener('keydown', e => { if (e.key === 'Escape') { search.value = ''; hideSearchResults(); } });
    document.addEventListener('click', e => {
      if (!e.target.closest('.search-box')) hideSearchResults();
    });

    H.el('quick-new').addEventListener('click', () => Tasks.openTaskForm(null));
    H.el('share-btn').addEventListener('click', openShare);
    H.el('notif-bell').addEventListener('click', () => navigate('notificaciones'));

    // overlay móvil
    const overlay = H.el('sidebar-overlay');
    if (overlay) overlay.addEventListener('click', closeSidebarMobile);
  }

  /* =========================== NAVEGACIÓN ============================ */

  function navigate(route, filters) {
    if (!ROUTES[route]) route = 'dashboard';
    currentRoute = route;
    pendingFilters = filters || null;

    H.qsa('.nav-item').forEach(i =>
      i.classList.toggle('active', i.getAttribute('data-route') === route ||
        (route === 'kanban' && i.getAttribute('data-route') === 'kanban') ));
    // Marcar activo correctamente para tareas/kanban/calendario
    H.qsa('.nav-item').forEach(i => i.classList.toggle('active', i.getAttribute('data-route') === route));

    H.el('header-title').textContent = ROUTES[route].title;
    Charts.destroyAll();

    const container = H.el('view-container');
    container.innerHTML = '';
    container.scrollTop = 0;
    try {
      ROUTES[route].render(container);
    } catch (err) {
      console.error('[app] error al renderizar', route, err);
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Ocurrió un error al cargar esta sección.</p></div>';
    }
    Notifications.updateBadge();
  }

  // Vuelve a dibujar la vista actual (tras cambios de datos)
  function refresh() {
    navigate(currentRoute, pendingFilters);
  }

  /* ============================= BÚSQUEDA =========================== */

  function globalSearch(query) {
    const box = H.el('search-results');
    const q = (query || '').trim().toLowerCase();
    if (!q) { hideSearchResults(); return; }

    const tasks = Storage.getTasks().filter(t =>
      [t.name, t.client, t.city, t.category, t.responsible, t.description]
        .join(' ').toLowerCase().indexOf(q) !== -1).slice(0, 8);
    const projects = Storage.getProjects().filter(p =>
      p.name.toLowerCase().indexOf(q) !== -1).slice(0, 4);

    let html = '';
    if (projects.length) {
      html += '<div class="sr-group"><div class="sr-label">Proyectos</div>' +
        projects.map(p => '<div class="sr-item" data-type="project" data-id="' + p.id + '">' +
          '<span class="sr-icon">📁</span>' + H.escapeHtml(p.name) + '</div>').join('') + '</div>';
    }
    if (tasks.length) {
      html += '<div class="sr-group"><div class="sr-label">Tareas</div>' +
        tasks.map(t => '<div class="sr-item" data-type="task" data-id="' + t.id + '">' +
          '<span class="sr-icon">📋</span><span class="sr-text">' + H.escapeHtml(t.name) +
          '<small>' + H.escapeHtml(Tasks.projectName(t.projectId)) + '</small></span></div>').join('') + '</div>';
    }
    if (!html) html = '<div class="sr-empty">Sin resultados para "' + H.escapeHtml(query) + '"</div>';

    box.innerHTML = html;
    box.classList.remove('hidden');

    H.qsa('.sr-item', box).forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id');
        if (item.getAttribute('data-type') === 'task') Tasks.openTaskDetail(id);
        else navigate('tareas', { project: id });
        H.el('global-search').value = '';
        hideSearchResults();
      });
    });
  }

  function hideSearchResults() {
    const box = H.el('search-results');
    if (box) box.classList.add('hidden');
  }

  /* ============================== TEMA ============================== */

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = H.el('theme-toggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  function toggleTheme() {
    const next = (Storage.getSettings().theme === 'dark') ? 'light' : 'dark';
    Storage.setSettings({ theme: next });
    applyTheme(next);
    // redibujar gráficos con nuevos colores
    if (['dashboard', 'kpis', 'informes'].indexOf(currentRoute) !== -1) refresh();
  }

  /* =========================== SIDEBAR MÓVIL ======================== */

  function toggleSidebarMobile() {
    H.el('app-shell').classList.toggle('sidebar-open');
  }
  function closeSidebarMobile() {
    H.el('app-shell').classList.remove('sidebar-open');
  }

  /* ============================== PERFIL ============================ */

  function renderUserChip() {
    const u = Auth.currentUser();
    if (!u) return;
    const chip = H.el('user-chip');
    if (chip) {
      chip.innerHTML = avatarHtml(u, 32) + '<span class="uc-name">' + H.escapeHtml(u.name) + '</span>';
      chip.onclick = () => navigate('perfil');
    }
  }

  function avatarHtml(u, size) {
    if (u.avatar) return '<img class="avatar" style="width:' + size + 'px;height:' + size + 'px" src="' + H.escapeHtml(u.avatar) + '" alt="">';
    return '<span class="avatar avatar-initials" style="width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size / 2.5) + 'px">' +
      H.escapeHtml(H.initials(u.name)) + '</span>';
  }

  function renderProfile(container) {
    const u = Auth.currentUser();
    container.innerHTML =
      '<div class="view-toolbar"><h2 class="view-title">👤 Mi perfil</h2></div>' +
      '<div class="card profile-card">' +
        '<div class="profile-top">' + avatarHtml(u, 84) +
          '<div><h3>' + H.escapeHtml(u.name) + '</h3><p class="muted">' + H.escapeHtml(u.role || '') +
          '</p><p class="muted">' + H.escapeHtml(u.email) + '</p></div></div>' +
        '<form id="profile-form" class="profile-form">' +
          '<label class="field"><span class="field-label">Nombre</span><input name="name" value="' + H.escapeHtml(u.name) + '"></label>' +
          '<label class="field"><span class="field-label">Cargo</span><input name="role" value="' + H.escapeHtml(u.role || '') + '"></label>' +
          '<label class="field"><span class="field-label">Correo</span><input type="email" name="email" value="' + H.escapeHtml(u.email) + '"></label>' +
          '<label class="field"><span class="field-label">Foto de perfil (URL)</span><input name="avatar" placeholder="https://..." value="' + H.escapeHtml(u.avatar || '') + '"></label>' +
          '<label class="field"><span class="field-label">Nueva contraseña (opcional)</span><input type="password" name="password" placeholder="Dejar en blanco para no cambiar"></label>' +
          '<button class="btn btn-primary" type="submit">Guardar perfil</button>' +
        '</form>' +
      '</div>';

    H.el('profile-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const f = e.target;
      const patch = { name: f.name.value.trim(), role: f.role.value.trim(), email: f.email.value.trim(), avatar: f.avatar.value.trim() };
      if (!patch.name || !patch.email) { UI.toast('Nombre y correo son obligatorios', 'error'); return; }
      Storage.updateUser(u.id, patch);
      if (f.password.value) Auth.changePassword(f.password.value);
      UI.toast('Perfil actualizado', 'success');
      renderUserChip();
      refresh();
    });
  }

  /* =========================== CONFIGURACIÓN ======================== */

  function renderSettings(container) {
    const theme = Storage.getSettings().theme || 'light';
    container.innerHTML =
      '<div class="view-toolbar"><h2 class="view-title">⚙️ Configuración</h2></div>' +
      '<div class="card settings-card">' +
        '<div class="setting-row"><div><b>Tema</b><p class="muted">Claro u oscuro</p></div>' +
          '<button class="btn btn-ghost" id="set-theme">' + (theme === 'dark' ? '☀️ Cambiar a claro' : '🌙 Cambiar a oscuro') + '</button></div>' +
        '<div class="setting-row"><div><b>Exportar datos</b><p class="muted">Copia de seguridad en JSON</p></div>' +
          '<button class="btn btn-ghost" id="set-export">⬇️ Exportar</button></div>' +
        '<div class="setting-row"><div><b>Importar datos</b><p class="muted">Restaurar desde un archivo JSON</p></div>' +
          '<label class="btn btn-ghost">⬆️ Importar<input type="file" id="set-import" accept="application/json" hidden></label></div>' +
        '<div class="setting-row"><div><b>Cargar datos de demostración</b><p class="muted">Reinicia con las tareas de ejemplo</p></div>' +
          '<button class="btn btn-ghost" id="set-demo">🔄 Recargar demo</button></div>' +
        '<div class="setting-row danger-row"><div><b>Borrar todo</b><p class="muted">Elimina tareas, proyectos y sesión</p></div>' +
          '<button class="btn btn-danger" id="set-reset">🗑️ Borrar todo</button></div>' +
      '</div>' +
      '<div class="card security-note">' +
        '<h4>🔐 Nota de seguridad</h4>' +
        '<p>Esta aplicación funciona de forma <b>100% local</b> en tu navegador (localStorage). ' +
        'El inicio de sesión es un mecanismo local de demostración y <b>no debe considerarse seguridad real</b> ' +
        'para un entorno público.</p>' +
      '</div>';

    H.el('set-theme').addEventListener('click', toggleTheme);
    H.el('set-export').addEventListener('click', () => {
      H.download('choho-backup.json', JSON.stringify(Storage.exportAll(), null, 2), 'application/json');
      UI.toast('Copia exportada', 'success');
    });
    H.el('set-import').addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          Storage.importAll(JSON.parse(reader.result));
          UI.toast('Datos importados', 'success');
          refresh();
        } catch (err) { UI.toast('Archivo inválido', 'error'); }
      };
      reader.readAsText(file);
    });
    H.el('set-demo').addEventListener('click', () => {
      UI.confirm('Esto reemplazará tus datos actuales con los de demostración. ¿Continuar?',
        { title: 'Recargar demo', danger: true, okText: 'Recargar' }).then(ok => {
          if (!ok) return;
          const users = Storage.getUsers();
          Storage.resetAll();
          users.forEach(Storage.createUser);
          Seed.seed();
          UI.toast('Datos de demostración cargados', 'success');
          navigate('dashboard');
        });
    });
    H.el('set-reset').addEventListener('click', () => {
      UI.confirm('¿Borrar TODOS los datos? Esta acción no se puede deshacer.',
        { title: 'Borrar todo', danger: true, okText: 'Borrar todo' }).then(ok => {
          if (!ok) return;
          Storage.resetAll();
          UI.toast('Datos borrados', 'info');
          init();
        });
    });
  }

  /* ========================= COMPARTIR SEGUIMIENTO ================== */

  function openShare() {
    const tasks = Storage.getTasks();
    const user = Auth.currentUser() || Auth.DEFAULT_USER;
    const s = Metrics.summary(tasks);
    const periodLabel = H.monthName(new Date().getMonth()) + ' ' + new Date().getFullYear();

    // Guardar un snapshot de solo lectura para share.html
    Storage.saveShareSnapshot({
      user: { name: user.name, role: user.role },
      periodLabel: periodLabel,
      generatedAt: new Date().toISOString(),
      summary: s,
      status: Metrics.statusBreakdown(tasks),
      projects: Metrics.byProject(tasks),
      tasks: tasks.map(t => ({
        name: t.name, project: Tasks.projectName(t.projectId), status: H.effectiveStatus(t),
        statusLabel: H.statusLabel(H.effectiveStatus(t)), progress: t.progress,
        priority: H.priorityLabel(t.priority), dueDate: t.dueDate
      }))
    });

    const body = document.createElement('div');
    body.innerHTML =
      '<p>Se generó una <b>vista de solo lectura</b> de tu seguimiento. Quien la consulte ' +
      '<b>no podrá modificar nada</b>.</p>' +
      '<div class="share-preview">' +
        '<div class="sp-row"><b>' + H.escapeHtml(user.name) + '</b> · ' + H.escapeHtml(periodLabel) + '</div>' +
        '<div class="sp-kpis">' +
          '<span>' + s.total + ' actividades</span>' +
          '<span>' + s.completadas + ' completadas</span>' +
          '<span>' + s.compliance + '% cumplimiento</span>' +
        '</div>' +
      '</div>' +
      '<p class="muted small">La vista se abre desde <code>share.html</code> y lee el último seguimiento guardado en este navegador.</p>';

    const footer = document.createElement('div');
    const open = document.createElement('button');
    open.className = 'btn btn-primary'; open.textContent = '🔗 Abrir vista compartida';
    const copy = document.createElement('button');
    copy.className = 'btn btn-ghost'; copy.textContent = '📋 Copiar enlace';
    footer.appendChild(copy); footer.appendChild(open);

    const modal = UI.openModal({ title: 'Compartir seguimiento', size: 'md', body: body, footer: footer });
    open.addEventListener('click', () => { window.open('share.html', '_blank'); });
    copy.addEventListener('click', () => {
      const url = new URL('share.html', window.location.href).href;
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(
        () => UI.toast('Enlace copiado', 'success'),
        () => UI.toast(url, 'info'));
      else UI.toast(url, 'info');
    });
  }

  global.App = { init, navigate, refresh, logout };

  document.addEventListener('DOMContentLoaded', init);

})(window);
