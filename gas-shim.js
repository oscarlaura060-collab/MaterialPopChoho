/**
 * gas-shim.js
 * Reemplaza la API `google.script.run` de Google Apps Script por llamadas
 * fetch() al backend serverless de Vercel (/api/rpc). Gracias a esto, todo el
 * código de frontend heredado (app.js y campo.js) funciona SIN cambios.
 *
 * Uso (idéntico a Apps Script):
 *   google.script.run
 *     .withSuccessHandler(function (res) { ... })
 *     .withFailureHandler(function (err) { ... })
 *     .nombreDeLaFuncion(arg1, arg2);
 */
(function () {
  var ENDPOINT = '/api/rpc';

  function crearRunner() {
    var successCb = null;
    var failCb = null;

    var handler = {
      withSuccessHandler: function (cb) {
        successCb = cb;
        return proxy;
      },
      withFailureHandler: function (cb) {
        failCb = cb;
        return proxy;
      },
    };

    function invocar(fn, args) {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fn: fn, args: args }),
      })
        .then(function (r) {
          return r.json().then(function (j) {
            if (!r.ok || (j && j.error)) {
              throw new Error((j && j.error) || 'HTTP ' + r.status);
            }
            return j.data;
          });
        })
        .then(function (data) {
          if (successCb) successCb(data);
        })
        .catch(function (err) {
          if (failCb) failCb(err);
          else console.error('[rpc:' + fn + ']', err);
        });
    }

    var proxy = new Proxy(handler, {
      get: function (target, prop) {
        if (prop in target) return target[prop];
        // Cualquier otra propiedad se interpreta como una función del servidor.
        return function () {
          var args = Array.prototype.slice.call(arguments);
          invocar(String(prop), args);
        };
      },
    });

    return proxy;
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  Object.defineProperty(window.google.script, 'run', {
    configurable: true,
    get: function () {
      return crearRunner();
    },
  });
})();
