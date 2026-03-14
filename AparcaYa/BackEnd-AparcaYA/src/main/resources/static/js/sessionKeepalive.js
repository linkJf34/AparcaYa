(function iniciarKeepalive() {

    const INTERVALO_MS  = 10 * 60 * 1000;  // ping cada 10 min
    const PRIMER_PING   =  5 * 60 * 1000;  // primer ping a los 5 min

    async function ping() {
        try {
            const res = await fetch('/api/session/keepalive', {
                credentials: 'include',
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });

            // 401 = sesión realmente expiró → mostrar modal
            if (res.status === 401 &&
                typeof mostrarModalSesionExpirada === 'function') {
                mostrarModalSesionExpirada();
            }
        } catch (_) {
            // Error de red — el interceptor global ya lo maneja
        }
    }

    setTimeout(function() {
        ping();
        setInterval(ping, INTERVALO_MS);
    }, PRIMER_PING);

})();