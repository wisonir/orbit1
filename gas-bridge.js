/**
 * Orbit Assistant - Google Apps Script Polyfill / Bridge
 * Menghubungkan frontend mandiri ke backend Google Apps Script doPost().
 * URL backend dikonfigurasi langsung melalui config.js (window.DEFAULT_GAS_API_URL).
 */
(function() {
  window.getGasApiUrl = function() {
    return window.DEFAULT_GAS_API_URL || localStorage.getItem('orbit_gas_api_url') || '';
  };

  // Cek apakah sudah berjalan di lingkungan native Apps Script
  if (window.google && window.google.script && window.google.script.run && !window.__FORCE_BRIDGE__) {
    console.log('[Orbit Bridge] Berjalan di dalam native Google Apps Script iframe.');
    return;
  }

  console.log('[Orbit Bridge] Mengaktifkan Decoupled Bridge untuk Google Apps Script.');

  class ScriptRunProxy {
    constructor(successHandler, failureHandler, userObject) {
      this._successHandler = successHandler || null;
      this._failureHandler = failureHandler || null;
      this._userObject = userObject || null;
    }

    async _invoke(actionName, args) {
      const gasUrl = window.getGasApiUrl();

      if (!gasUrl) {
        const errorMsg = 'URL Web App Google Apps Script belum disetel di config.js (window.DEFAULT_GAS_API_URL kosong).';
        console.error('[Orbit Bridge]', errorMsg);
        if (this._failureHandler) {
          this._failureHandler(new Error(errorMsg), this._userObject);
        }
        return;
      }

      try {
        // text/plain agar browser TIDAK mengirimkan preflight OPTIONS (CORS Simple Request).
        // Google Apps Script merespons 302 redirect ke googleusercontent dengan Access-Control-Allow-Origin: *
        const response = await fetch(gasUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: JSON.stringify({
            action: actionName,
            args: args
          })
        });

        if (!response.ok) {
          throw new Error('HTTP ' + response.status + ' (' + response.statusText + ')');
        }

        const resData = await response.json();

        if (resData.status === 'success') {
          if (this._successHandler) {
            this._successHandler(resData.data, this._userObject);
          }
        } else {
          const errMsg = resData.message || ('Fungsi backend "' + actionName + '" gagal dieksekusi.');
          console.error('[Orbit Bridge Error]', errMsg);
          if (this._failureHandler) {
            this._failureHandler(new Error(errMsg), this._userObject);
          } else if (typeof showAppAlert === 'function') {
            showAppAlert('Terjadi Kendala', errMsg, 'error');
          }
        }
      } catch (err) {
        console.error('[Orbit Bridge] Gagal memanggil fungsi "' + actionName + '":', err);
        if (this._failureHandler) {
          this._failureHandler(err, this._userObject);
        } else if (typeof showAppAlert === 'function') {
          showAppAlert('Koneksi Gagal', err.message || 'Tidak dapat terhubung ke server Google Apps Script.', 'error');
        }
      }
    }
  }

  // Runner dengan Chaining Proxy yang benar
  function createRunner() {
    let successFn = null;
    let failureFn = null;
    let userObj = null;
    let proxyInstance;

    const builder = {
      withSuccessHandler: function(fn) {
        successFn = fn;
        return proxyInstance;
      },
      withFailureHandler: function(fn) {
        failureFn = fn;
        return proxyInstance;
      },
      withUserObject: function(obj) {
        userObj = obj;
        return proxyInstance;
      }
    };

    proxyInstance = new Proxy(builder, {
      get: function(target, prop) {
        if (prop in target) {
          return target[prop];
        }
        return function(...args) {
          const runnerInstance = new ScriptRunProxy(successFn, failureFn, userObj);
          return runnerInstance._invoke(prop, args);
        };
      }
    });

    return proxyInstance;
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};

  Object.defineProperty(window.google.script, 'run', {
    get: function() {
      return createRunner();
    },
    configurable: true
  });
})();
