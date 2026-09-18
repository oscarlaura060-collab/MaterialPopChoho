/* ==========================================================================
   CHOHO TASKS · storage.js
   --------------------------------------------------------------------------
   Storage abstraction layer.

   Todo el acceso a datos de la aplicación pasa por este módulo. Hoy usa
   localStorage; mañana puede reemplazarse por Supabase sin tocar el resto
   de la aplicación, siempre que se mantenga la MISMA interfaz pública
   (Storage.createTask, Storage.getTasks, etc.).

   Guía de migración a Supabase:
     - Reemplazar las funciones _read/_write por llamadas al SDK de Supabase.
     - Convertir los métodos públicos a async (ya devuelven valores directos;
       basta con envolver el retorno en Promise.resolve para compatibilidad).
     - Mantener el mismo shape de objetos (task, project, update...).
   ========================================================================== */

(function (global) {
  'use strict';

  const KEYS = {
    tasks: 'choho.tasks',
    projects: 'choho.projects',
    users: 'choho.users',
    session: 'choho.session',
    settings: 'choho.settings',
    seeded: 'choho.seeded',
    share: 'choho.share.snapshot'
  };

  /* ----------------------------- utilidades ------------------------------ */

  function uid(prefix) {
    return (prefix || 'id') + '_' +
      Date.now().toString(36) + '_' +
      Math.random().toString(36).slice(2, 8);
  }

  function _read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null || raw === undefined) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      console.warn('[storage] no se pudo leer', key, err);
      return fallback;
    }
  }

  function _write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error('[storage] no se pudo escribir', key, err);
      return false;
    }
  }

  function nowISO() {
    return new Date().toISOString();
  }

  /* ------------------------------- TAREAS -------------------------------- */

  function getTasks() {
    return _read(KEYS.tasks, []);
  }

  function getTask(id) {
    return getTasks().find(t => t.id === id) || null;
  }

  function _saveTasks(tasks) {
    return _write(KEYS.tasks, tasks);
  }

  function createTask(data) {
    const tasks = getTasks();
    const task = normalizeTask(Object.assign({}, data, {
      id: uid('task'),
      createdAt: nowISO(),
      updatedAt: nowISO(),
      history: Array.isArray(data.history) ? data.history : [],
      evidence: Array.isArray(data.evidence) ? data.evidence : []
    }));
    tasks.push(task);
    _saveTasks(tasks);
    return task;
  }

  function updateTask(id, patch) {
    const tasks = getTasks();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    tasks[idx] = normalizeTask(Object.assign({}, tasks[idx], patch, {
      id: id,
      updatedAt: nowISO()
    }));
    _saveTasks(tasks);
    return tasks[idx];
  }

  function deleteTask(id) {
    const tasks = getTasks().filter(t => t.id !== id);
    return _saveTasks(tasks);
  }

  /* Añade una entrada al historial de seguimiento de una tarea */
  function addTaskUpdate(id, progress, comment) {
    const task = getTask(id);
    if (!task) return null;
    const entry = {
      id: uid('upd'),
      date: nowISO(),
      progress: clampProgress(progress),
      comment: (comment || '').trim()
    };
    const history = Array.isArray(task.history) ? task.history.slice() : [];
    history.push(entry);

    const patch = { history: history, progress: entry.progress };
    // Si el avance llega a 100, marcar completada automáticamente.
    if (entry.progress >= 100) {
      patch.status = 'completada';
      patch.completedAt = nowISO();
    } else if (task.status === 'completada' && entry.progress < 100) {
      patch.status = 'en_progreso';
      patch.completedAt = null;
    } else if (entry.progress > 0 && task.status === 'pendiente') {
      patch.status = 'en_progreso';
    }
    return updateTask(id, patch);
  }

  function addTaskEvidence(id, evidence) {
    const task = getTask(id);
    if (!task) return null;
    const list = Array.isArray(task.evidence) ? task.evidence.slice() : [];
    list.push(Object.assign({ id: uid('ev'), addedAt: nowISO() }, evidence));
    return updateTask(id, { evidence: list });
  }

  function clampProgress(v) {
    let n = Number(v);
    if (isNaN(n)) n = 0;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  /* Normaliza una tarea garantizando todos los campos esperados */
  function normalizeTask(t) {
    const status = t.status || 'pendiente';
    let progress = clampProgress(t.progress);
    if (status === 'completada') progress = 100;
    return {
      id: t.id,
      name: (t.name || '').trim(),
      description: t.description || '',
      purpose: t.purpose || '',            // ¿Para qué se realiza?
      expectedResult: t.expectedResult || '',
      projectId: t.projectId || '',
      category: t.category || 'General',
      priority: t.priority || 'media',     // baja | media | alta
      responsible: t.responsible || '',
      startDate: t.startDate || '',
      dueDate: t.dueDate || '',
      status: status,                      // pendiente|en_progreso|en_espera|completada
      progress: progress,
      client: t.client || '',
      city: t.city || '',
      notes: t.notes || '',
      evidenceLink: t.evidenceLink || '',
      evidence: Array.isArray(t.evidence) ? t.evidence : [],
      history: Array.isArray(t.history) ? t.history : [],
      createdAt: t.createdAt || nowISO(),
      updatedAt: t.updatedAt || nowISO(),
      completedAt: t.completedAt || null
    };
  }

  /* ----------------------------- PROYECTOS ------------------------------- */

  function getProjects() {
    return _read(KEYS.projects, []);
  }

  function getProject(id) {
    return getProjects().find(p => p.id === id) || null;
  }

  function _saveProjects(projects) {
    return _write(KEYS.projects, projects);
  }

  function createProject(data) {
    const projects = getProjects();
    const project = {
      id: uid('proj'),
      name: (data.name || '').trim(),
      description: data.description || '',
      color: data.color || pickColor(projects.length),
      createdAt: nowISO()
    };
    projects.push(project);
    _saveProjects(projects);
    return project;
  }

  function updateProject(id, patch) {
    const projects = getProjects();
    const idx = projects.findIndex(p => p.id === id);
    if (idx === -1) return null;
    projects[idx] = Object.assign({}, projects[idx], patch, { id: id });
    _saveProjects(projects);
    return projects[idx];
  }

  function deleteProject(id) {
    const projects = getProjects().filter(p => p.id !== id);
    _saveProjects(projects);
    // Desvincular tareas de este proyecto
    const tasks = getTasks().map(t =>
      t.projectId === id ? Object.assign({}, t, { projectId: '' }) : t);
    _saveTasks(tasks);
    return true;
  }

  const PALETTE = ['#4f6ef7', '#22c1a4', '#f5a623', '#ef476f',
                   '#8b5cf6', '#0ea5e9', '#f97316', '#10b981'];
  function pickColor(i) { return PALETTE[i % PALETTE.length]; }

  /* ------------------------------ USUARIOS ------------------------------- */
  // Autenticación LOCAL. NO es seguridad real; migrar a Supabase Auth.

  function getUsers() {
    return _read(KEYS.users, []);
  }

  function _saveUsers(users) {
    return _write(KEYS.users, users);
  }

  function findUserByEmail(email) {
    const e = (email || '').trim().toLowerCase();
    return getUsers().find(u => u.email.toLowerCase() === e) || null;
  }

  function createUser(user) {
    const users = getUsers();
    const record = {
      id: uid('user'),
      name: user.name || 'Usuario',
      role: user.role || '',
      email: (user.email || '').trim(),
      passwordHash: user.passwordHash || '',
      avatar: user.avatar || '',
      createdAt: nowISO()
    };
    users.push(record);
    _saveUsers(users);
    return record;
  }

  function updateUser(id, patch) {
    const users = getUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return null;
    users[idx] = Object.assign({}, users[idx], patch, { id: id });
    _saveUsers(users);
    return users[idx];
  }

  /* -------------------------- SESIÓN / SETTINGS -------------------------- */

  function getSession() { return _read(KEYS.session, null); }
  function setSession(s) { return _write(KEYS.session, s); }
  function clearSession() {
    try { localStorage.removeItem(KEYS.session); } catch (e) {}
  }

  function getSettings() {
    return _read(KEYS.settings, { theme: 'light' });
  }
  function setSettings(patch) {
    const s = Object.assign({}, getSettings(), patch);
    _write(KEYS.settings, s);
    return s;
  }

  /* ----------------------------- COMPARTIR ------------------------------- */

  function saveShareSnapshot(snapshot) {
    return _write(KEYS.share, snapshot);
  }
  function getShareSnapshot() {
    return _read(KEYS.share, null);
  }

  /* ------------------------------ RESET / IO ----------------------------- */

  function isSeeded() { return _read(KEYS.seeded, false) === true; }
  function markSeeded() { return _write(KEYS.seeded, true); }

  function resetAll() {
    Object.values(KEYS).forEach(k => {
      try { localStorage.removeItem(k); } catch (e) {}
    });
  }

  function exportAll() {
    return {
      tasks: getTasks(),
      projects: getProjects(),
      users: getUsers().map(u => Object.assign({}, u, { passwordHash: undefined })),
      exportedAt: nowISO()
    };
  }

  function importAll(data) {
    if (!data || typeof data !== 'object') return false;
    if (Array.isArray(data.tasks)) _saveTasks(data.tasks.map(normalizeTask));
    if (Array.isArray(data.projects)) _saveProjects(data.projects);
    return true;
  }

  /* ------------------------------ export --------------------------------- */

  global.Storage = {
    KEYS: KEYS,
    uid: uid,
    // tasks
    getTasks, getTask, createTask, updateTask, deleteTask,
    addTaskUpdate, addTaskEvidence, normalizeTask,
    // projects
    getProjects, getProject, createProject, updateProject, deleteProject,
    // users
    getUsers, findUserByEmail, createUser, updateUser,
    // session / settings
    getSession, setSession, clearSession, getSettings, setSettings,
    // share
    saveShareSnapshot, getShareSnapshot,
    // io
    isSeeded, markSeeded, resetAll, exportAll, importAll
  };

})(window);
