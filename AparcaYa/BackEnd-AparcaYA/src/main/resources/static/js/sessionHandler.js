// ==================== MANEJO DE SESIÓN EXPIRADA ====================
//
// FIX BUG #4:
// La detección anterior usaba text.includes('login') || text.includes('Login')
// lo que disparaba el modal ante cualquier HTML que contuviera esa palabra
// (páginas de error 500, mensajes de validación, etc.).
//
// Corrección: buscar marcadores únicos del formulario de login de Spring Security,
// que solo aparecen en la página /login real:
//   - action="/login"  → atributo del <form> del login
//   - id="loginForm"   → id del formulario (si el HTML lo define)
//   - name="_spring_security_remember_me" → campo oculto de Spring Security
//
// Si la respuesta redirige a /login (response.redirected) también se captura.
// ===========================================================================

const originalFetch = window.fetch;

window.fetch = async function(...args) {
    let response;
    try {
        const [input, init = {}] = args;
        const initConCredentials = {
            ...init,
            credentials: init.credentials ?? 'include'  // respeta si ya viene definido
        };
        response = await originalFetch(input, initConCredentials);

    } catch (networkError) {
        // Error de red real (servidor caído, sin conexión) — no tratar como sesión expirada
        throw networkError;
    }

    // 1. Redirección explícita al login — caso más común con Spring Security
    if (response.redirected && response.url.includes('/login')) {
        mostrarModalSesionExpirada();
        return response;
    }

    // 2. Respuesta HTML cuando se esperaba JSON — sesión expirada devuelve la página de login
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
        try {
            const clone = response.clone();
            const text  = await clone.text();

            // FIX: marcadores únicos del formulario de login de Spring Security.
            // Evita falsos positivos en páginas de error que contengan la palabra "login".
            const esLoginPage =
                text.includes('action="/login"')                      ||
                text.includes("action='/login'")                      ||
                text.includes('name="_spring_security_remember_me"')  ||
                text.includes('id="loginForm"');

            if (esLoginPage) {
                mostrarModalSesionExpirada();
            }
        } catch (parseError) {
            // No se pudo leer el cuerpo — ignorar silenciosamente
        }
    }

    return response;
};

// ==================== MODAL DE SESIÓN EXPIRADA ====================
function mostrarModalSesionExpirada() {
    // Evita mostrar el modal dos veces si ya está presente
    if (document.getElementById('session-expired-modal')) { return; }

    var modal = document.createElement('div');
    modal.id = 'session-expired-modal';
    modal.style.cssText =
        'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.7);' +
        'display:flex;align-items:center;justify-content:center;padding:1rem;';

    modal.innerHTML =
        '<div style="background:#fff;border-radius:0.75rem;padding:2rem;max-width:400px;' +
        'width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3);text-align:center;">' +

        '<div style="font-size:3rem;margin-bottom:1rem;">⏱️</div>' +

        '<h3 style="font-size:1.25rem;font-weight:700;color:#0f172a;margin:0 0 0.75rem;">' +
        'Sesión expirada' +
        '</h3>' +

        '<p style="font-size:0.875rem;color:#64748b;margin:0 0 1.5rem;line-height:1.6;">' +
        'Tu sesión ha expirado o fue iniciada en otro dispositivo. ' +
        'Por favor inicia sesión nuevamente.' +
        '</p>' +

        '<button onclick="window.location.href=\'/login\'" ' +
        'style="padding:0.75rem 2rem;border:none;border-radius:0.5rem;' +
        'background:#0f766e;color:#fff;cursor:pointer;font-weight:600;' +
        'font-size:1rem;width:100%;">' +
        'Iniciar sesión' +
        '</button>' +

        '</div>';

    document.body.appendChild(modal);
}