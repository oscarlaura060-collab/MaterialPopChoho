/* ==========================================================================
   CHOHO TASKS · ui.js
   Componentes de interfaz compartidos: toasts, modales, confirmaciones.
   ========================================================================== */

(function (global) {
  'use strict';

  /* ------------------------------ TOASTS -------------------------------- */

  function ensureToastHost() {
    let host = H.el('toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toast-host';
      host.className = 'toast-host';
      document.body.appendChild(host);
    }
    return host;
  }

  function toast(message, type) {
    const host = ensureToastHost();
    const t = document.createElement('div');
    t.className = 'toast toast-' + (type || 'info');
    const icons = { success: '✅', error: '⛔', info: 'ℹ️', warn: '⚠️' };
    t.innerHTML = '<span class="toast-icon">' + (icons[type] || icons.info) +
      '</span><span>' + H.escapeHtml(message) + '</span>';
    host.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 300);
    }, 3200);
  }

  /* ------------------------------ MODAL --------------------------------- */

  function ensureModalHost() {
    let host = H.el('modal-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'modal-host';
      document.body.appendChild(host);
    }
    return host;
  }

  // opts: { title, body (HTML string or Node), size ('sm'|'md'|'lg'), footer, onOpen }
  function openModal(opts) {
    const host = ensureModalHost();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'modal modal-' + (opts.size || 'md');

    const header = document.createElement('div');
    header.className = 'modal-header';
    header.innerHTML = '<h3 class="modal-title">' + H.escapeHtml(opts.title || '') + '</h3>';
    const close = document.createElement('button');
    close.className = 'modal-close';
    close.setAttribute('aria-label', 'Cerrar');
    close.innerHTML = '&times;';
    header.appendChild(close);

    const body = document.createElement('div');
    body.className = 'modal-body';
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body instanceof Node) body.appendChild(opts.body);

    modal.appendChild(header);
    modal.appendChild(body);

    if (opts.footer) {
      const footer = document.createElement('div');
      footer.className = 'modal-footer';
      if (typeof opts.footer === 'string') footer.innerHTML = opts.footer;
      else if (opts.footer instanceof Node) footer.appendChild(opts.footer);
      modal.appendChild(footer);
    }

    overlay.appendChild(modal);
    host.appendChild(overlay);
    document.body.classList.add('modal-open');

    function destroy() {
      overlay.classList.remove('show');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => {
        overlay.remove();
        if (!host.querySelector('.modal-overlay')) {
          document.body.classList.remove('modal-open');
        }
      }, 200);
    }
    function onKey(e) { if (e.key === 'Escape') destroy(); }

    close.addEventListener('click', destroy);
    overlay.addEventListener('mousedown', function (e) {
      if (e.target === overlay) destroy();
    });
    document.addEventListener('keydown', onKey);

    requestAnimationFrame(() => overlay.classList.add('show'));

    const api = { close: destroy, el: modal, body: body };
    if (typeof opts.onOpen === 'function') opts.onOpen(api);
    return api;
  }

  // Confirmación con promesa
  function confirm(message, opts) {
    opts = opts || {};
    return new Promise(resolve => {
      const footer = document.createElement('div');
      const cancel = document.createElement('button');
      cancel.className = 'btn btn-ghost';
      cancel.textContent = opts.cancelText || 'Cancelar';
      const ok = document.createElement('button');
      ok.className = 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary');
      ok.textContent = opts.okText || 'Confirmar';
      footer.appendChild(cancel);
      footer.appendChild(ok);

      const m = openModal({
        title: opts.title || 'Confirmar',
        size: 'sm',
        body: '<p class="confirm-text">' + H.escapeHtml(message) + '</p>',
        footer: footer
      });
      cancel.addEventListener('click', () => { m.close(); resolve(false); });
      ok.addEventListener('click', () => { m.close(); resolve(true); });
    });
  }

  global.UI = { toast, openModal, confirm };

})(window);
