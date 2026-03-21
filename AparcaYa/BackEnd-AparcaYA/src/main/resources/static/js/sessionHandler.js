// ============================================================
// sessionHandler.js — AparcaYA
// Gestión de JWT: almacenamiento, envío automático en fetch,
// detección de token expirado y logout.
// ============================================================

const TokenManager = {

    KEY: 'aparca_jwt',

    get() {
        return sessionStorage.getItem(this.KEY);
    },

    set(token) {
        sessionStorage.setItem(this.KEY, token);
    },

    remove() {
        sessionStorage.removeItem(this.KEY);
    },

    exists() {
        return !!this.get();
    }
};

// ============================================================
// Interceptor global de fetch — añade Authorization header
// automáticamente a todas las peticiones al propio dominio.
// Peticiones a dominios externos (Nominatim, CDNs) no se tocan.
// ============================================================
(function interceptarFetch() {
    const originalFetch = window.fetch;

    window.fetch = async function(...args) {
        const [input, init = {}] = args;

        // Determinar si es petición al propio servidor
        const url = typeof input === 'string' ? input : input.url;
        const esLocal = !url.startsWith('http') ||
            url.startsWith(window.location.origin);

        const token = TokenManager.get();

        // Solo añadir Authorization si es local y hay token
        const initFinal = esLocal && token ? {
            ...init,
            headers: {
                ...init.headers,
                'Authorization': 'Bearer ' + token
            }
        } : init;

        let response;
        try {
            response = await originalFetch(input, initFinal);
        } catch (networkError) {
            throw networkError;
        }

        if (response.status === 401 && esLocal) {
            if (!url.includes('/api/auth/login')) {
                // Verificar si el token sigue siendo válido localmente
                const token = TokenManager.get();
                if (token) {
                    try {
                        const payload = JSON.parse(atob(token.split('.')[1]));
                        const expirado = payload.exp < Math.floor(Date.now() / 1000);
                        if (expirado) {
                            TokenManager.remove();
                            mostrarModalSesionExpirada();
                        }
                        // Si no está expirado, ignorar el 401 — fue temporal
                    } catch (e) {
                        TokenManager.remove();
                        mostrarModalSesionExpirada();
                    }
                } else {
                    mostrarModalSesionExpirada();
                }
            }
        }

        return response;
    };
})();

// ============================================================
// Modal de sesión expirada
// ============================================================
function mostrarModalSesionExpirada() {
    if (document.getElementById('session-expired-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'session-expired-modal';
    modal.style.cssText =
        'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.7);' +
        'display:flex;align-items:center;justify-content:center;padding:1rem;';

    modal.innerHTML =
        '<div style="background:#fff;border-radius:0.75rem;padding:2rem;' +
        'max-width:400px;width:100%;text-align:center;">' +
        '<div style="font-size:3rem;margin-bottom:1rem;">⏱️</div>' +
        '<h3 style="font-size:1.25rem;font-weight:700;margin:0 0 0.75rem;">Sesión expirada</h3>' +
        '<p style="font-size:0.875rem;color:#64748b;margin:0 0 1.5rem;">Tu sesión ha expirado. Por favor inicia sesión nuevamente.</p>' +
        '<button onclick="window.location.href=\'/login\'" ' +
        'style="padding:0.75rem 2rem;border:none;border-radius:0.5rem;' +
        'background:#0f766e;color:#fff;cursor:pointer;font-weight:600;' +
        'font-size:1rem;width:100%;">Iniciar sesión</button>' +
        '</div>';

    document.body.appendChild(modal);
}

// ============================================================
// Logout — borra token y redirige
// ============================================================
function logoutJWT() {
    TokenManager.remove();
    window.location.href = '/login';
}

// ============================================================
// Keepalive — ping cada 10 min para verificar token activo
// ============================================================
//(function iniciarKeepalive() {
//  const INTERVALO = 10 * 60 * 1000;
//   const PRIMER    =  5 * 60 * 1000;

//async function ping() {
//if (!TokenManager.exists()) return;
//try {
//const res = await fetch('/api/session/keepalive', {
//headers: { 'X-Requested-With': 'XMLHttpRequest' }
//});
// El interceptor ya maneja el 401
// } catch (_) {}
//}
//setTimeout(() => {
//ping();
//setInterval(ping, INTERVALO);
//}, PRIMER);
//})();