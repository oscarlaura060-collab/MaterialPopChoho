/* ==========================================================================
   CHOHO TASKS · auth.js
   --------------------------------------------------------------------------
   Autenticación LOCAL de demostración.

   ⚠️  AVISO DE SEGURIDAD
   Este sistema guarda las credenciales en el navegador (localStorage) usando
   un hash NO criptográfico. Sirve únicamente para una aplicación PERSONAL y
   local. NO debe considerarse seguridad real para una aplicación pública.
   Para producción, migrar a Supabase Auth (auth.signInWithPassword, etc.).
   ========================================================================== */

(function (global) {
  'use strict';

  // Usuario semilla por defecto (credenciales de demostración).
  const DEFAULT_USER = {
    name: 'Óscar Mora',
    role: 'Coordinador de Trade Marketing',
    email: 'demo@choho.app',
    password: 'choho123',            // solo para siembra inicial
    avatar: ''
  };

  function ensureDefaultUser() {
    if (Storage.getUsers().length === 0) {
      Storage.createUser({
        name: DEFAULT_USER.name,
        role: DEFAULT_USER.role,
        email: DEFAULT_USER.email,
        passwordHash: H.simpleHash(DEFAULT_USER.password)
      });
    }
  }

  function login(email, password, remember) {
    const user = Storage.findUserByEmail(email);
    if (!user) {
      return { ok: false, error: 'No existe una cuenta con ese correo.' };
    }
    if (user.passwordHash !== H.simpleHash(password)) {
      return { ok: false, error: 'Contraseña incorrecta.' };
    }
    Storage.setSession({
      userId: user.id,
      remember: !!remember,
      startedAt: new Date().toISOString()
    });
    return { ok: true, user: user };
  }

  function logout() {
    Storage.clearSession();
  }

  function currentUser() {
    const s = Storage.getSession();
    if (!s || !s.userId) return null;
    return Storage.getUsers().find(u => u.id === s.userId) || null;
  }

  function isAuthenticated() {
    return !!currentUser();
  }

  function changePassword(newPassword) {
    const u = currentUser();
    if (!u) return false;
    Storage.updateUser(u.id, { passwordHash: H.simpleHash(newPassword) });
    return true;
  }

  // Recuperación de contraseña (demo): restablece a la contraseña por defecto.
  function resetPasswordDemo(email) {
    const user = Storage.findUserByEmail(email);
    if (!user) return { ok: false, error: 'No existe una cuenta con ese correo.' };
    Storage.updateUser(user.id, { passwordHash: H.simpleHash(DEFAULT_USER.password) });
    return { ok: true };
  }

  global.Auth = {
    DEFAULT_USER,
    ensureDefaultUser, login, logout, currentUser,
    isAuthenticated, changePassword, resetPasswordDemo
  };

})(window);
