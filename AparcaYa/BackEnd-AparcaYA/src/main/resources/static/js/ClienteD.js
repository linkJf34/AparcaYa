// ============================================================
// CLIENTED.JS — AparcaYA  v2.1
// Ruta: /js/ClienteD.js
//
// v2.1 — Fixes aplicados:
//   ✅ FIX-R1: crearReserva() usa GET /api/cupos/disponibles (era /api/cupos/sede/{id})
//              El endpoint anterior tenía @PreAuthorize(ADMIN/OPERARIO) → 403 para CLIENTE
//              El nuevo endpoint filtra por horario y es accesible para CLIENTE
//   ✅ FIX-R2: Formato ISO con segundos (:00) — LocalDateTime requiere HH:mm:ss
//              El calendario generaba "2026-03-19T14:30" → Jackson lo rechazaba con 400
//   ✅ FIX-P1: cambiarContrasena() usa POST /cliente/perfil/cambiar-password
//              El endpoint anterior (/perfil/actualizar) ignoraba los campos de contraseña
//   ✅ FIX-N1: TABS_LABELS definida una sola vez (eliminada del HTML el duplicado)
//
// v2.0 — Mejoras integradas:
//   ✅ FIX C-01: userId eliminado del body de reserva.
//   ✅ FIX C-03: cancelarReserva() lee data.message del backend.
//   ✅ FIX C-04: alert()/confirm() reemplazados por toasts y modal.
//   ✅ FIX JS:   crearReserva() envía vehiculoId en lugar de placa.
//   ✅ FIX LAYOUT: sidebar colapsable, handleLogout con POST /logout.
//   ✅ CLI-J03: crearReserva() verifica cuposRes.ok antes de parsear JSON.
//
//   ★ NUEVO v2.0:
//   ★ KPIs de inicio (reservas activas, total, último pago, sedes)
//   ★ Actividad reciente (últimas 5 reservas)
//   ★ Estado actual de reserva activa
//   ★ Dropdown de perfil mejorado (perfil + config + logout)
//   ★ Breadcrumb dinámico en header
//   ★ Módulo de configuración (nombre, teléfono, contraseña)
//   ★ Filtros de tabla — reservas (estado + fecha)
//   ★ Filtros de tabla — pagos (estado + fecha)
//   ★ Resumen de pagos (total pagado, pendientes)
//   ★ Acordeón FAQ en módulo de ayuda
//   ★ Toggle de visibilidad en campos contraseña
//   ★ Indicador de fortaleza de contraseña
//   ★ Contador de badge en pestañas
//   ★ navegarA() — función de navegación programática
// ============================================================


// ============================================================
// VARIABLES GLOBALES
// ============================================================
var map              = null;
var marcadores       = [];
var sedes            = [];
var sedeSeleccionada = null;

// Cache interno para filtros (se llena al cargar datos)
var _cacheReservas = [];
var _cachePagos    = [];

if (typeof window.sedesData !== 'undefined') {
    sedes = window.sedesData || [];
}

// ============================================================
// CSRF — No aplica en este proyecto
//
// El proyecto usa JWT (JwtAuthFilter) como mecanismo de
// autenticación. Con JWT, Spring Security tiene CSRF desactivado
// — por eso ${_csrf} es null en Thymeleaf y las metas CSRF
// causaban un error al renderizar el template.
//
// getCsrfHeaders() se mantiene como función vacía para que
// los fetch POST no fallen si en algún momento se reactiva CSRF.
// ============================================================
function getCsrfHeaders() {
    var csrfMeta   = document.querySelector('meta[name="_csrf"]');
    var csrfHMeta  = document.querySelector('meta[name="_csrf_header"]');
    var csrfToken  = csrfMeta  ? csrfMeta.getAttribute('content')  : null;
    var csrfHeader = csrfHMeta ? csrfHMeta.getAttribute('content') : null;
    if (csrfToken && csrfHeader) {
        var h = {};
        h[csrfHeader] = csrfToken;
        return h;
    }
    return {};
}


// ============================================================
// COORDENADAS POR BARRIO
// ============================================================
var COORDENADAS_BARRIOS = {
    'USAQUEN': {
        'Cedritos':              { lat: 4.71908, lon: -74.03555 },
        'Molinos Norte':         { lat: 4.69081, lon: -74.04020 },
        'La Calleja':            { lat: 4.70788, lon: -74.04912 },
        'Barrancas':             { lat: 4.73486, lon: -74.02579 },
        'Santa Bárbara':         { lat: 4.70209, lon: -74.03919 },
        'Santa Bárbara Central': { lat: 4.70209, lon: -74.03919 },
        'Usaquén':               { lat: 4.70500, lon: -74.03500 }
    },
    'CHAPINERO': {
        'Antiguo Country':        { lat: 4.67168, lon: -74.05732 },
        'El Chicó':               { lat: 4.67376, lon: -74.05172 },
        'Chicó':                  { lat: 4.67376, lon: -74.05172 },
        'Los Rosales':            { lat: 4.65978, lon: -74.04829 },
        'Rosales':                { lat: 4.65978, lon: -74.04829 },
        'La Cabrera':             { lat: 4.66918, lon: -74.05016 },
        'El Retiro':              { lat: 4.66670, lon: -74.05164 },
        'Lago Gaitán':            { lat: 4.66607, lon: -74.05877 },
        'El Lago':                { lat: 4.66607, lon: -74.05877 },
        'Chicó Reservado':        { lat: 4.67915, lon: -74.04257 },
        'Chicó Norte III Sector': { lat: 4.68316, lon: -74.05361 },
        'Chapinero Alto':         { lat: 4.65000, lon: -74.05500 }
    },
    'SANTA_FE': {
        'Las Aguas':        { lat: 4.60395, lon: -74.06942 },
        'La Perseverancia': { lat: 4.61348, lon: -74.06741 },
        'San Diego':        { lat: 4.61588, lon: -74.06484 }
    },
    'SUBA': {
        'Tibabuyes':   { lat: 4.74512, lon: -74.07855 },
        'Niza':        { lat: 4.72981, lon: -74.06324 },
        'Suba Centro': { lat: 4.74150, lon: -74.08160 },
        'La Campiña':  { lat: 4.75233, lon: -74.09041 }
    },
    'KENNEDY': {
        'Tintal':       { lat: 4.65380, lon: -74.15485 },
        'Timiza':       { lat: 4.62518, lon: -74.14894 },
        'Mandalay':     { lat: 4.64537, lon: -74.13489 },
        'Carvajal':     { lat: 4.61451, lon: -74.13925 },
        'Patio Bonito': { lat: 4.62797, lon: -74.14562 }
    }
};

var COORDENADAS_LOCALIDADES = {
    'USAQUEN':   { lat: 4.7110, lon: -74.0300 },
    'CHAPINERO': { lat: 4.6400, lon: -74.0620 },
    'SANTA_FE':  { lat: 4.6097, lon: -74.0730 },
    'SUBA':      { lat: 4.7500, lon: -74.0800 },
    'KENNEDY':   { lat: 4.6280, lon: -74.1550 }
};

// ✅ FIX-N1: TABS_LABELS definida UNA SOLA VEZ aquí.
// El bloque duplicado que existía en el script inline de DashboardCliente.html
// fue eliminado de ese archivo para evitar sobreescritura según orden de carga.
var TABS_LABELS = {
    'perfil':        'Inicio',
    'misreservas':   'Mis Reservas',
    'pagos':         'Pagos',
    'configuracion': 'Configuración',
    'ayuda':         'Ayuda'
};


// ============================================================
// SISTEMA DE NOTIFICACIONES — Toast
// ============================================================
function showToast(mensaje, tipo, duracion) {
    tipo     = tipo     || 'info';
    duracion = duracion || 4000;

    var contenedor = document.getElementById('toast-contenedor');
    if (!contenedor) {
        contenedor = document.createElement('div');
        contenedor.id = 'toast-contenedor';
        contenedor.style.cssText = [
            'position:fixed', 'top:1.5rem', 'right:1.5rem',
            'z-index:9999', 'display:flex', 'flex-direction:column', 'gap:0.5rem'
        ].join(';');
        document.body.appendChild(contenedor);
    }

    var palette = {
        success: 'background:#f0fdf4;border:1px solid #86efac;color:#166534',
        error:   'background:#fef2f2;border:1px solid #fca5a5;color:#991b1b',
        warning: 'background:#fffbeb;border:1px solid #fcd34d;color:#92400e',
        info:    'background:#eff6ff;border:1px solid #93c5fd;color:#1e40af'
    };
    var iconos = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

    var toast = document.createElement('div');
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    toast.style.cssText = [
        palette[tipo] || palette.info,
        'padding:0.75rem 1rem', 'border-radius:0.5rem',
        'box-shadow:0 4px 12px rgba(0,0,0,.1)', 'font-size:0.875rem',
        'display:flex', 'align-items:center', 'gap:0.5rem',
        'max-width:360px', 'transition:opacity 0.3s'
    ].join(';');
    toast.innerHTML = '<span>' + (iconos[tipo] || '') + '</span><span>' + mensaje + '</span>';
    contenedor.appendChild(toast);

    setTimeout(function() {
        toast.style.opacity = '0';
        setTimeout(function() { toast.remove(); }, 350);
    }, duracion);
}


// ============================================================
// SISTEMA DE NOTIFICACIONES — Confirm modal
// ============================================================
function showConfirm(titulo, cuerpo, btnTexto, btnColor) {
    btnTexto = btnTexto || 'Confirmar';
    btnColor = btnColor || 'danger';

    return new Promise(function(resolve) {
        var overlay = document.getElementById('confirm-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'confirm-overlay';
            overlay.style.cssText = [
                'position:fixed', 'inset:0', 'z-index:10000',
                'background:rgba(0,0,0,0.5)',
                'display:flex', 'align-items:center', 'justify-content:center',
                'padding:1rem'
            ].join(';');
            document.body.appendChild(overlay);
        }

        var btnColors = {
            danger:  'background:#dc2626;color:#fff',
            warning: 'background:#f59e0b;color:#fff'
        };

        overlay.innerHTML =
            '<div role="dialog" aria-modal="true"' +
            '     style="background:#fff;border-radius:0.75rem;padding:2rem;max-width:420px;' +
            '            width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3);">' +
            '    <h3 style="font-size:1.125rem;font-weight:700;color:#0f172a;margin:0 0 0.75rem;">' +
            '        ' + titulo +
            '    </h3>' +
            '    <p style="font-size:0.875rem;color:#64748b;margin:0 0 1.5rem;line-height:1.6;">' +
            '        ' + cuerpo +
            '    </p>' +
            '    <div style="display:flex;justify-content:flex-end;gap:0.75rem;">' +
            '        <button id="confirm-cancel"' +
            '                style="padding:0.5rem 1.25rem;border:1px solid #e2e8f0;' +
            '                       border-radius:0.5rem;background:#fff;color:#374151;cursor:pointer;">' +
            '            Cancelar' +
            '        </button>' +
            '        <button id="confirm-ok"' +
            '                style="padding:0.5rem 1.25rem;border:none;border-radius:0.5rem;' +
            '                       ' + (btnColors[btnColor] || btnColors.danger) + ';' +
            '                       cursor:pointer;font-weight:600;">' +
            '            ' + btnTexto +
            '        </button>' +
            '    </div>' +
            '</div>';

        overlay.style.display = 'flex';

        document.getElementById('confirm-ok').onclick     = function() { overlay.style.display = 'none'; resolve(true);  };
        document.getElementById('confirm-cancel').onclick = function() { overlay.style.display = 'none'; resolve(false); };
    });
}


// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    inicializarNavegacion();
    inicializarPerfilMenu();
    inicializarDatepickersFiltros(); // ✅ FIX-D1: conecta AparcaDatepicker a los filtros de fecha
    cargarDatosUsuario();
    cargarReservas();
    cargarSedesYMapa();
    inicializarBusquedaMapa();
    cargarPagos();
    cargarDatosConfiguracion();
    actualizarKPISedes();
});


// ============================================================
// NAVEGACIÓN — con breadcrumb y soporte para tab configuracion
// ============================================================
function inicializarNavegacion() {
    var links = document.querySelectorAll('.aparca-sidebar-nav a');
    links.forEach(function(link) {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            var targetTab = this.getAttribute('data-tab');

            document.querySelectorAll('.aparca-content-section')
                .forEach(function(s) { s.classList.add('hidden'); });

            var target = document.getElementById(targetTab);
            if (target) { target.classList.remove('hidden'); }

            links.forEach(function(l) {
                l.classList.remove('active');
                l.removeAttribute('aria-current');
            });
            this.classList.add('active');
            this.setAttribute('aria-current', 'page');

            // Breadcrumb — una sola llamada, el listener duplicado del HTML fue eliminado
            actualizarBreadcrumb(targetTab);

            // Invalidate mapa al volver a inicio
            if (targetTab === 'perfil' && map) {
                setTimeout(function() { map.invalidateSize(); }, 100);
            }

            // Cerrar dropdown si está abierto
            var dropdown = document.getElementById('profileDropdown');
            var btn      = document.getElementById('profileBtn');
            if (dropdown) { dropdown.classList.remove('show'); }
            if (btn)      { btn.setAttribute('aria-expanded', 'false'); }
        });
    });
}

// Navegación programática (usada por botones internos y dropdown)
function navegarA(tabId) {
    var link = document.querySelector('.aparca-sidebar-nav a[data-tab="' + tabId + '"]');
    if (link) { link.click(); }
}

// Actualiza el texto del breadcrumb en el header
function actualizarBreadcrumb(tabId) {
    var el = document.getElementById('breadcrumbCurrent');
    if (el) { el.textContent = TABS_LABELS[tabId] || tabId; }
}


// ============================================================
// MENÚ DE PERFIL — Dropdown mejorado
// ============================================================
function inicializarPerfilMenu() {
    var profileBtn      = document.getElementById('profileBtn');
    var profileDropdown = document.getElementById('profileDropdown');

    if (profileBtn && profileDropdown) {
        profileBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            var expanded = this.getAttribute('aria-expanded') === 'true';
            this.setAttribute('aria-expanded', String(!expanded));
            profileDropdown.classList.toggle('show');
        });

        document.addEventListener('click', function(e) {
            if (!profileBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
                profileDropdown.classList.remove('show');
                profileBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }
}


// ============================================================
// LOGOUT
// ============================================================
async function handleLogout() {
    var ok = await showConfirm(
        'Cerrar sesión',
        '¿Estás seguro de que deseas cerrar sesión?',
        'Cerrar sesión',
        'danger'
    );
    if (!ok) { return; }

    try {
        var headers = Object.assign(
            { 'Content-Type': 'application/x-www-form-urlencoded' },
            getCsrfHeaders()
        );
        await fetch('/logout', { method: 'POST', headers: headers, credentials: 'same-origin' });
    } catch (e) { /* Si falla el fetch, redirigimos igual */ }

    window.location.href = '/login';
}


// ============================================================
// DATOS DEL USUARIO — Llena nombre en todos los puntos de la UI
// ============================================================
async function cargarDatosUsuario() {
    try {
        var response = await fetch('/cliente/perfil');
        if (response.ok) {
            var usuario = await response.json();

            if (usuario && usuario.nombre) {
                var nom     = usuario.nombre;
                var inicial = nom.charAt(0).toUpperCase();

                // Título de bienvenida
                var welcomeH2 = document.getElementById('heroWelcomeTitle');
                if (welcomeH2) { welcomeH2.textContent = 'Bienvenido, ' + nom; }

                // Sidebar — nombre y avatar
                var usernameEl = document.getElementById('sidebarUsername');
                var avatarEl   = document.getElementById('sidebarAvatarInitial');
                if (usernameEl) { usernameEl.textContent = nom; }
                if (avatarEl)   { avatarEl.textContent   = inicial; }

                // Header — avatar y nombre
                var headerAvatar   = document.getElementById('headerAvatarInitial');
                var headerUsername = document.getElementById('headerUsername');
                if (headerAvatar)   { headerAvatar.textContent   = inicial; }
                if (headerUsername) { headerUsername.textContent = nom; }

                // Dropdown — avatar y nombre
                var dropAvatar   = document.getElementById('dropdownAvatarInitial');
                var dropUsername = document.getElementById('dropdownUsername');
                if (dropAvatar)   { dropAvatar.textContent   = inicial; }
                if (dropUsername) { dropUsername.textContent = nom; }

                // Hero avatar
                var heroAvatar = document.getElementById('heroAvatarInitial');
                if (heroAvatar) { heroAvatar.textContent = inicial; }

                // Correo en configuración
                var correoDisplay = document.getElementById('configCorreoDisplay');
                if (correoDisplay && usuario.correo) {
                    correoDisplay.textContent = usuario.correo;
                }
            }
        }
    } catch (error) {
        console.error('Error cargando datos del usuario:', error);
    }
}


// ============================================================
// RESERVAS — Carga y renderizado
// ============================================================
async function cargarReservas() {
    try {
        var response = await fetch('/cliente/reservas');
        if (response.ok) {
            var reservas = await response.json();
            _cacheReservas = reservas || [];
            actualizarTablaReservas(reservas);
            actualizarKPIsReservas(reservas);
            actualizarActividadReciente(reservas);
            actualizarEstadoActual(reservas);
            actualizarBadgeCount('reservasBadgeCount', reservas.length);
        }
    } catch (error) {
        console.error('Error cargando reservas:', error);
    }
}

function actualizarTablaReservas(reservas) {
    var tbody = document.getElementById('reservasTableBody');
    if (!tbody) { return; }

    if (!reservas || reservas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:1.5rem;color:#64748b;">No tienes reservas.</td></tr>';
        return;
    }

    tbody.innerHTML = reservas.map(function(reserva) {
        var fechaInicio = new Date(reserva.fechaInicio);
        var fechaFin    = new Date(reserva.fechaFin);
        var nombreSede  = (reserva.cupo && reserva.cupo.sede && reserva.cupo.sede.nombre)
            ? reserva.cupo.sede.nombre : 'Sede desconocida';

        var estadoBadges = {
            ACTIVA:     '<span style="background:#22c55e;color:white;padding:3px 10px;border-radius:12px;font-size:.78rem;font-weight:600;">Activa</span>',
            PENDIENTE:  '<span style="background:#f59e0b;color:white;padding:3px 10px;border-radius:12px;font-size:.78rem;font-weight:600;">Pendiente</span>',
            COMPLETADA: '<span style="background:#64748b;color:white;padding:3px 10px;border-radius:12px;font-size:.78rem;font-weight:600;">Completada</span>',
            CANCELADA:  '<span style="background:#ef4444;color:white;padding:3px 10px;border-radius:12px;font-size:.78rem;font-weight:600;">Cancelada</span>'
        };
        var estadoBadge = estadoBadges[reserva.estado] ||
            '<span style="background:#94a3b8;color:white;padding:3px 10px;border-radius:12px;font-size:.78rem;">' + reserva.estado + '</span>';

        var acciones = (reserva.estado === 'ACTIVA' || reserva.estado === 'PENDIENTE')
            ? '<button onclick="cancelarReserva(' + reserva.idReserva + ')"' +
            '        style="background:#ef4444;color:white;padding:4px 12px;border:none;' +
            '               border-radius:6px;cursor:pointer;font-weight:600;font-size:.78rem;">Cancelar</button>'
            : '<span style="color:#64748b;">—</span>';

        return '<tr>' +
            '<td>' + fechaInicio.toLocaleDateString('es-CO') + '</td>' +
            '<td>' + nombreSede + '</td>' +
            '<td>' + fechaInicio.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) + '</td>' +
            '<td>' + fechaFin.toLocaleTimeString('es-CO',   { hour: '2-digit', minute: '2-digit' }) + '</td>' +
            '<td>' + estadoBadge + '</td>' +
            '<td>' + acciones + '</td>' +
            '</tr>';
    }).join('');
}


// ============================================================
// CANCELAR RESERVA
// ============================================================
async function cancelarReserva(reservaId) {
    var confirmado = await showConfirm(
        'Cancelar reserva',
        '¿Estás seguro de que deseas cancelar esta reserva? Esta acción no se puede deshacer.',
        'Cancelar reserva',
        'danger'
    );
    if (!confirmado) { return; }

    try {
        var res  = await fetch('/cliente/reservas/' + reservaId + '/cancelar', {
            method:  'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, getCsrfHeaders())
        });
        var data = await res.json();

        if (res.ok && data.success) {
            showToast(data.message || 'Reserva cancelada correctamente', 'success');
            cargarReservas();
        } else {
            showToast(data.message || 'Error al cancelar la reserva', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Error de conexión', 'error');
    }
}


// ============================================================
// MAPA — Carga y marcadores
// ============================================================
async function cargarSedesYMapa() {
    if (!sedes.length) {
        try {
            var response = await fetch('/cliente/sedes');
            if (response.ok) {
                sedes = await response.json();
                window.sedesData = sedes;
            }
        } catch (error) {
            console.error('Error cargando sedes:', error);
        }
    }
    initMap();
    actualizarKPISedes();
}

function initMap() {
    var mapContainer = document.getElementById('map-container');
    if (!mapContainer || map) { return; }

    map = L.map('map-container').setView([4.6533, -74.0836], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    agregarMarcadores();
}

async function agregarMarcadores() {
    if (!map) return;
    marcadores.forEach(function(m) { m.remove(); });
    marcadores = [];

    for (var i = 0; i < sedes.length; i++) {
        var sede = sedes[i];

        var lat = sede.latitud;
        var lon = sede.longitud;

        if (!lat || !lon) {
            var coords = await geocodificarDireccion(
                sede.direccion, sede.localidad, sede.barrio
            );
            if (!coords) {
                console.warn('Sin coordenadas para sede:', sede.nombre);
                continue;
            }
            lat = coords.lat;
            lon = coords.lon;
        }

        var iconColor  = sede.estado === 'ACTIVO' ? '#7c3aed' : '#dc2626';
        var customIcon = L.divIcon({
            className: 'custom-marker',
            html: '<div style="background-color:' + iconColor + ';width:32px;height:32px;' +
                'border-radius:50% 50% 50% 0;transform:rotate(-45deg);' +
                'border:3px solid white;box-shadow:0 4px 8px rgba(0,0,0,0.3);">' +
                '<div style="transform:rotate(45deg);color:white;font-size:16px;' +
                'font-weight:bold;display:flex;align-items:center;' +
                'justify-content:center;height:100%;">P</div>' +
                '</div>',
            iconSize:    [32, 32],
            iconAnchor:  [16, 32],
            popupAnchor: [0, -32]
        });

        var marker = L.marker([lat, lon], { icon: customIcon }).addTo(map);

        marker.bindPopup(
            '<div style="min-width:200px;">' +
            '<h4 style="margin:0 0 8px;font-size:1rem;font-weight:700;color:#0f172a;">' +
            sede.nombre +
            '</h4>' +
            '<p style="margin:4px 0;color:#64748b;font-size:.875rem;">📍 ' + sede.direccion + '</p>' +
            '<p style="margin:4px 0;color:#64748b;font-size:.875rem;">🚗 Capacidad: ' + sede.capacidad + ' vehículos</p>' +
            '<button id="btn-sede-' + sede.idSede + '"' +
            '        style="margin-top:12px;width:100%;background:#7c3aed;color:white;' +
            '               border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:600;"' +
            '        onmouseover="this.style.background=\'#6d28d9\'"' +
            '        onmouseout="this.style.background=\'#7c3aed\'">' +
            '    Ver detalles completos' +
            '</button>' +
            '</div>',
            { maxWidth: 300 }
        );

        (function(s) {
            marker.on('popupopen', function() {
                setTimeout(function() {
                    var btn = document.getElementById('btn-sede-' + s.idSede);
                    if (btn) { btn.onclick = function() { mostrarDetallesSede(s.idSede); }; }
                }, 100);
            });
        })(sede);

        marcadores.push(marker);

        if (!sede.latitud || !sede.longitud) {
            await new Promise(function(resolve) { setTimeout(resolve, 1100); });
        }
    }

    if (marcadores.length > 0) {
        map.fitBounds(L.featureGroup(marcadores).getBounds().pad(0.1));
    }
}


// ============================================================
// GEOCODIFICACIÓN
// ============================================================
function obtenerCoordenadasPorBarrio(localidad, barrio) {
    if (!localidad || !barrio) { return null; }
    var localidadKey = localidad.toUpperCase().trim();
    var barrioNorm   = barrio.trim();

    if (COORDENADAS_BARRIOS[localidadKey]) {
        if (COORDENADAS_BARRIOS[localidadKey][barrioNorm]) {
            return COORDENADAS_BARRIOS[localidadKey][barrioNorm];
        }
        var bl      = barrioNorm.toLowerCase();
        var entries = Object.entries(COORDENADAS_BARRIOS[localidadKey]);
        for (var i = 0; i < entries.length; i++) {
            var nb     = entries[i][0];
            var coords = entries[i][1];
            if (nb.toLowerCase().includes(bl) || bl.includes(nb.toLowerCase())) {
                return coords;
            }
        }
    }
    return null;
}

function obtenerCoordenadasPorLocalidad(localidad) {
    var key = (localidad || '').toUpperCase().trim();
    if (COORDENADAS_LOCALIDADES[key]) {
        return {
            lat: COORDENADAS_LOCALIDADES[key].lat + (Math.random() - 0.5) * 0.015,
            lon: COORDENADAS_LOCALIDADES[key].lon + (Math.random() - 0.5) * 0.015
        };
    }
    return {
        lat: 4.6533 + (Math.random() - 0.5) * 0.08,
        lon: -74.0836 + (Math.random() - 0.5) * 0.08
    };
}

async function geocodificarDireccion(direccion, localidad, barrio) {
    var coordsBarrio = obtenerCoordenadasPorBarrio(localidad, barrio);
    if (coordsBarrio) {
        return {
            lat: coordsBarrio.lat + (Math.random() - 0.5) * 0.002,
            lon: coordsBarrio.lon + (Math.random() - 0.5) * 0.002
        };
    }
    return obtenerCoordenadasPorLocalidad(localidad);
}


// ============================================================
// ✅ FIX-D1: DATEPICKERS DE FILTROS — AparcaDatepicker
//
// Los botones "Desde" y "Hasta" en las secciones de Reservas y Pagos
// usaban inputs type="hidden" sin ningún listener conectado.
// Ahora se instancia AparcaDatepicker para cada uno, apuntando a los
// popups que se agregaron al HTML (popDesdeReserva, popHastaReserva, etc.)
//
// La función limpiar() de cada instancia se invoca desde
// limpiarFiltrosReservas() y limpiarFiltrosPagos() para resetear
// el label y el hidden junto con el estado interno del datepicker.
// ============================================================
var _dpDesdeReserva = null;
var _dpHastaReserva = null;
var _dpDesdePago    = null;
var _dpHastaPago    = null;

function inicializarDatepickersFiltros() {
    // Solo inicializar si AparcaDatepicker está disponible
    if (typeof AparcaDatepicker !== 'function') {
        console.warn('AparcaDatepicker no disponible — filtros de fecha desactivados');
        return;
    }

    // ── Filtro DESDE — Reservas ──────────────────────────────
    _dpDesdeReserva = new AparcaDatepicker({
        btnId:       'btnDesdeReserva',
        popupId:     'popDesdeReserva',
        labelId:     'lblDesdeReserva',
        hiddenId:    'filtroFechaDesdeReserva',
        gridId:      'gridDesdeReserva',
        mesId:       'mesDesdeReserva',
        prevId:      'prevDesdeReserva',
        nextId:      'nextDesdeReserva',
        placeholder: 'Fecha inicio',
        soloFuturo:  false,
        onConfirm:   function() { filtrarReservas(); }
    });

    // ── Filtro HASTA — Reservas ──────────────────────────────
    _dpHastaReserva = new AparcaDatepicker({
        btnId:       'btnHastaReserva',
        popupId:     'popHastaReserva',
        labelId:     'lblHastaReserva',
        hiddenId:    'filtroFechaHastaReserva',
        gridId:      'gridHastaReserva',
        mesId:       'mesHastaReserva',
        prevId:      'prevHastaReserva',
        nextId:      'nextHastaReserva',
        placeholder: 'Fecha fin',
        soloFuturo:  false,
        onConfirm:   function() { filtrarReservas(); }
    });

    // ── Filtro DESDE — Pagos ─────────────────────────────────
    _dpDesdePago = new AparcaDatepicker({
        btnId:       'btnDesdePago',
        popupId:     'popDesdePago',
        labelId:     'lblDesdePago',
        hiddenId:    'filtroFechaDesdePago',
        gridId:      'gridDesdePago',
        mesId:       'mesDesdePago',
        prevId:      'prevDesdePago',
        nextId:      'nextDesdePago',
        placeholder: 'Fecha inicio',
        soloFuturo:  false,
        onConfirm:   function() { filtrarPagos(); }
    });

    // ── Filtro HASTA — Pagos ─────────────────────────────────
    _dpHastaPago = new AparcaDatepicker({
        btnId:       'btnHastaPago',
        popupId:     'popHastaPago',
        labelId:     'lblHastaPago',
        hiddenId:    'filtroFechaHastaPago',
        gridId:      'gridHastaPago',
        mesId:       'mesHastaPago',
        prevId:      'prevHastaPago',
        nextId:      'nextHastaPago',
        placeholder: 'Fecha fin',
        soloFuturo:  false,
        onConfirm:   function() { filtrarPagos(); }
    });
}

// ============================================================
// BÚSQUEDA EN MAPA
// ============================================================
function inicializarBusquedaMapa() {
    var searchBtn   = document.getElementById('searchBtn');
    var searchInput = document.getElementById('searchInput');

    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', buscarDireccion);
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') { buscarDireccion(); }
        });
    }
}

async function buscarDireccion() {
    var searchInput = document.getElementById('searchInput');
    var direccion   = searchInput.value.trim();

    if (!direccion) {
        showToast('Por favor ingresa una dirección', 'warning');
        return;
    }

    try {
        var url = 'https://nominatim.openstreetmap.org/search?format=json' +
            '&q=' + encodeURIComponent(direccion + ', Bogotá, Colombia') + '&limit=1';

        var response = await fetch(url, { headers: { 'User-Agent': 'AparcaYA/1.0' } });

        if (response.ok) {
            var data = await response.json();
            if (data && data.length > 0) {
                var lat = parseFloat(data[0].lat);
                var lon = parseFloat(data[0].lon);
                map.setView([lat, lon], 15);
                L.marker([lat, lon]).addTo(map)
                    .bindPopup('📍 ' + data[0].display_name)
                    .openPopup();
            } else {
                showToast('No se encontró la dirección', 'warning');
            }
        }
    } catch (error) {
        console.error('Error en búsqueda:', error);
        showToast('Error al buscar la dirección', 'error');
    }
}


// ============================================================
// MODAL — DETALLES DE SEDE
// ============================================================
function mostrarDetallesSede(sedeId) {
    var sede = sedes.find(function(s) { return s.idSede === sedeId; });
    if (!sede) { return; }

    sedeSeleccionada = sede;
    document.getElementById('modalSedeTitle').textContent = sede.nombre;

    var estadoBadge = sede.estado === 'ACTIVO'
        ? '<span class="cli-badge cli-badge-activo">✓ Activa</span>'
        : '<span class="cli-badge cli-badge-inactivo">✗ Inactiva</span>';

    document.getElementById('modalSedeBody').innerHTML =
        '<div class="cliente-modal-sede-grid">' +
        '<div class="cliente-modal-sede-item cliente-modal-sede-full">' +
        '<div class="cliente-modal-sede-label">Estado</div>' +
        '<div class="cliente-modal-sede-value">' + estadoBadge + '</div>' +
        '</div>' +
        '<div class="cliente-modal-sede-item">' +
        '<div class="cliente-modal-sede-label">🚗 Capacidad</div>' +
        '<div class="cliente-modal-sede-value">' + sede.capacidad + ' vehículos</div>' +
        '</div>' +
        '<div class="cliente-modal-sede-item">' +
        '<div class="cliente-modal-sede-label">📍 Localidad</div>' +
        '<div class="cliente-modal-sede-value">' + (sede.localidad || 'N/A') + '</div>' +
        '</div>' +
        '<div class="cliente-modal-sede-item cliente-modal-sede-full">' +
        '<div class="cliente-modal-sede-label">🏘️ Barrio</div>' +
        '<div class="cliente-modal-sede-value">' + (sede.barrio || 'No especificado') + '</div>' +
        '</div>' +
        '<div class="cliente-modal-sede-item cliente-modal-sede-full">' +
        '<div class="cliente-modal-sede-label">📌 Dirección</div>' +
        '<div class="cliente-modal-sede-value">' + sede.direccion + '</div>' +
        '</div>' +
        '<div class="cliente-modal-sede-item cliente-modal-sede-full">' +
        '<div class="cliente-modal-sede-label">💰 Tarifas</div>' +
        '<div class="cliente-modal-sede-value cliente-modal-sede-tarifas">' +
        '<strong>🚗 Carros:</strong><br>' +
        '• Hora plena: $' + (sede.tarifaPlenaC  || 0).toLocaleString('es-CO') + ' COP<br>' +
        '• Por minuto: $' + (sede.tarifaMinutoC || 0).toLocaleString('es-CO') + ' COP<br>' +
        '<strong>🏍️ Motos:</strong><br>' +
        '• Hora plena: $' + (sede.tarifaPlenaM  || 0).toLocaleString('es-CO') + ' COP<br>' +
        '• Por minuto: $' + (sede.tarifaMinutoM || 0).toLocaleString('es-CO') + ' COP' +
        '</div>' +
        '</div>' +
        '<div class="cliente-modal-sede-item cliente-modal-sede-full">' +
        '<div class="cliente-modal-sede-label">🕐 Horario</div>' +
        '<div class="cliente-modal-sede-value">' + (sede.horarioSede || 'No especificado') + '</div>' +
        '</div>' +
        '</div>' +
        '<div class="cliente-modal-sede-actions">' +
        '<button onclick="abrirModalReserva()" class="cli-btn-confirm">Reservar Ahora</button>' +
        '<button onclick="cerrarModalSede()" class="cliente-modal-sede-btn-cerrar">Cerrar</button>' +
        '</div>';

    var modal = document.getElementById('modalSede');
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
}

function cerrarModalSede() {
    var modal = document.getElementById('modalSede');
    if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
    }
}


// ============================================================
// MODAL — RESERVA
// ============================================================
async function abrirModalReserva() {
    if (!sedeSeleccionada) { return; }

    cerrarModalSede();

    var sedeNombreEl = document.getElementById('reservaSedeNombre');
    if (sedeNombreEl) { sedeNombreEl.textContent = sedeSeleccionada.nombre; }

    // Limpiar campos ocultos de fecha
    var fechaInicioEl = document.getElementById('fechaInicio');
    var fechaFinEl    = document.getElementById('fechaFin');
    if (fechaInicioEl) { fechaInicioEl.value = ''; }
    if (fechaFinEl)    { fechaFinEl.value    = ''; }

    await cargarVehiculosSelect();

    var modal = document.getElementById('reservaModal');
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');

    // El onclick se asigna aquí para que siempre apunte a la función actualizada
    var reservarBtn = document.getElementById('reservarBtn');
    if (reservarBtn) { reservarBtn.onclick = crearReserva; }
}

async function cargarVehiculosSelect() {
    var selectVehiculo = document.getElementById('vehiculoSelect');
    if (!selectVehiculo) { return; }

    selectVehiculo.innerHTML = '<option value="">Cargando vehículos...</option>';

    try {
        var response = await fetch('/cliente/vehiculos');
        if (response.ok) {
            var vehiculos = await response.json();
            if (!vehiculos || vehiculos.length === 0) {
                selectVehiculo.innerHTML = '<option value="">No tienes vehículos registrados</option>';
            } else {
                selectVehiculo.innerHTML = '<option value="">Selecciona un vehículo</option>' +
                    vehiculos.map(function(v) {
                        return '<option value="' + v.idVehiculo + '">' +
                            v.placa + ' — ' + (v.marca || '') + ' ' + (v.modelo || '') +
                            '</option>';
                    }).join('');
            }
        } else {
            selectVehiculo.innerHTML = '<option value="">Error al cargar vehículos</option>';
        }
    } catch (e) {
        selectVehiculo.innerHTML = '<option value="">Error de conexión</option>';
    }
}

function cerrarReservaModal() {
    var modal = document.getElementById('reservaModal');
    if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
    }
}


// ============================================================
// CREAR RESERVA
//
// ✅ FIX-R1: Usa GET /api/cupos/disponibles?sedeId=&fechaInicio=&fechaFin=
// ✅ FIX-R2: Formato ISO con segundos (:00) para LocalDateTime
// ✅ FIX-R3: Diagnóstico detallado en consola para facilitar debugging
// ============================================================
async function crearReserva() {
    var fechaInicioEl  = document.getElementById('fechaInicio');
    var fechaFinEl     = document.getElementById('fechaFin');
    var vehiculoSelect = document.getElementById('vehiculoSelect');

    var fechaInicio = fechaInicioEl  ? fechaInicioEl.value  : '';
    var fechaFin    = fechaFinEl     ? fechaFinEl.value      : '';
    var vehiculoId  = vehiculoSelect ? vehiculoSelect.value  : '';

    // ── Validaciones frontend ────────────────────────────────
    if (!fechaInicio || !fechaFin) {
        showToast('Selecciona las fechas de inicio y fin', 'warning');
        return;
    }
    if (!vehiculoId) {
        showToast('Selecciona un vehículo', 'warning');
        return;
    }
    if (new Date(fechaFin) <= new Date(fechaInicio)) {
        showToast('La fecha de fin debe ser posterior a la de inicio', 'warning');
        return;
    }

    // ✅ FIX-R2: segundos requeridos por LocalDateTime
    if (fechaInicio.length === 16) { fechaInicio = fechaInicio + ':00'; }
    if (fechaFin.length    === 16) { fechaFin    = fechaFin    + ':00'; }

    // Bloquear botón durante el proceso
    var reservarBtn = document.getElementById('reservarBtn');
    if (reservarBtn) { reservarBtn.disabled = true; reservarBtn.textContent = 'Verificando...'; }

    try {
        // ── PASO 1: Consultar cupos disponibles ──────────────
        var params = new URLSearchParams({
            sedeId:      sedeSeleccionada.idSede,
            fechaInicio: fechaInicio,
            fechaFin:    fechaFin
        });

        var urlCupos = '/api/cupos/disponibles?' + params.toString();
        console.info('[ReservaFlow] GET', urlCupos);

        var cuposRes = await fetch(urlCupos);

        console.info('[ReservaFlow] cupos status:', cuposRes.status);

        if (cuposRes.status === 403) {
            showToast('Sin permisos para consultar disponibilidad (403). ' +
                'Verifica que tu sesión esté activa.', 'error');
            return;
        }

        if (!cuposRes.ok) {
            var cuposErrMsg = 'No se pudo consultar disponibilidad';
            try {
                var cuposErr = await cuposRes.json();
                console.warn('[ReservaFlow] error cupos:', cuposErr);
                if (cuposErr && cuposErr.message) { cuposErrMsg = cuposErr.message; }
            } catch (e) { /* respuesta no era JSON */ }
            showToast(cuposErrMsg, 'warning');
            return;
        }

        var cupos = await cuposRes.json();
        console.info('[ReservaFlow] cupos recibidos:', cupos.length, cupos);

        if (!cupos || cupos.length === 0) {
            showToast('No hay cupos disponibles en ese horario. ' +
                'Intenta con otro rango de tiempo.', 'warning');
            return;
        }

        // Tomar el primer cupo — la query del backend ya garantizó que
        // no tiene conflicto de horario en el rango solicitado.
        // No filtramos por estado === 'DISPONIBLE' aquí porque un cupo
        // puede estar marcado como RESERVADO en BD por una reserva anterior
        // ya finalizada/cancelada cuyo cupo no fue liberado correctamente,
        // pero la query NOT EXISTS ya verificó que no hay colisión de horario.
        var cupoDisponible = cupos[0];

        console.info('[ReservaFlow] cupo elegido:', cupoDisponible);

        // ── PASO 2: Crear la reserva ─────────────────────────
        var reservaData = {
            cupoId:      cupoDisponible.idCupo,
            vehiculoId:  parseInt(vehiculoId),
            fechaInicio: fechaInicio,
            fechaFin:    fechaFin
        };

        console.info('[ReservaFlow] POST /api/reservaciones', reservaData);
        if (reservarBtn) { reservarBtn.textContent = 'Creando reserva...'; }

        var response = await fetch('/api/reservaciones', {
            method:  'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, getCsrfHeaders()),
            body:    JSON.stringify(reservaData)
        });

        console.info('[ReservaFlow] reserva status:', response.status);

        var data = {};
        try { data = await response.json(); } catch (e) {}
        console.info('[ReservaFlow] reserva response:', data);

        if (response.ok) {
            showToast('¡Reserva creada! Está pendiente de aprobación.', 'success', 6000);
            cerrarReservaModal();
            cargarReservas();
        } else if (response.status === 403) {
            showToast('Sin permisos para crear la reserva. ' +
                'Verifica que tu sesión esté activa.', 'error');
        } else if (response.status === 409) {
            showToast(data.message || 'Conflicto de horario — el cupo ya fue reservado.', 'warning');
        } else {
            showToast(data.message || 'Error al crear la reserva (status ' + response.status + ')', 'error');
        }

    } catch (error) {
        console.error('[ReservaFlow] excepción:', error);
        showToast('Error de conexión al crear la reserva', 'error');
    } finally {
        if (reservarBtn) {
            reservarBtn.disabled = false;
            reservarBtn.textContent = 'Confirmar reserva';
        }
    }
}


// ============================================================
// PAGOS — Carga y renderizado
// ============================================================
async function cargarPagos() {
    try {
        var response = await fetch('/cliente/pagos');
        if (response.ok) {
            var pagos = await response.json();
            _cachePagos = pagos || [];
            actualizarTablaPagos(pagos);
            actualizarResumenPagos(pagos);
            actualizarKPIUltimoPago(pagos);
            actualizarBadgeCount('pagosBadgeCount', pagos.length);
        }
    } catch (error) {
        console.error('Error cargando pagos:', error);
    }
}

function actualizarTablaPagos(pagos) {
    var tbody = document.getElementById('pagosTableBody');
    if (!tbody) { return; }

    if (!pagos || pagos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:1.5rem;color:#64748b;">No tienes pagos registrados.</td></tr>';
        return;
    }

    tbody.innerHTML = pagos.map(function(pago) {
        var fechaPago    = new Date(pago.fechaPago);
        var estadoBadges = {
            PAGADO:      '<span style="background:#22c55e;color:white;padding:3px 10px;border-radius:12px;font-size:.78rem;font-weight:600;">Pagado</span>',
            PENDIENTE:   '<span style="background:#f59e0b;color:white;padding:3px 10px;border-radius:12px;font-size:.78rem;font-weight:600;">Pendiente</span>',
            RECHAZADO:   '<span style="background:#ef4444;color:white;padding:3px 10px;border-radius:12px;font-size:.78rem;font-weight:600;">Rechazado</span>',
            REEMBOLSADO: '<span style="background:#06b6d4;color:white;padding:3px 10px;border-radius:12px;font-size:.78rem;font-weight:600;">Reembolsado</span>'
        };
        var estadoBadge = estadoBadges[pago.estado] ||
            '<span style="background:#94a3b8;color:white;padding:3px 10px;border-radius:12px;font-size:.78rem;">' + pago.estado + '</span>';

        var idReserva = (pago.reservacion && pago.reservacion.idReserva)
            ? pago.reservacion.idReserva : 'N/A';
        var monto = pago.monto ? Number(pago.monto).toLocaleString('es-CO') : '0';

        return '<tr>' +
            '<td>' + fechaPago.toLocaleDateString('es-CO') + '</td>' +
            '<td>Reserva #' + idReserva + '</td>' +
            '<td>$' + monto + ' COP</td>' +
            '<td>' + (pago.metodoPago || 'N/A') + '</td>' +
            '<td>' + estadoBadge + '</td>' +
            '</tr>';
    }).join('');
}


// ============================================================
// CERRAR MODALES CON OVERLAY O ESCAPE
// ============================================================
document.addEventListener('click', function(e) {
    if (e.target.id === 'modalSede')    { cerrarModalSede();    }
    if (e.target.id === 'reservaModal') { cerrarReservaModal(); }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        cerrarModalSede();
        cerrarReservaModal();
    }
});


// ============================================================
// ★ KPIs — RESERVAS
// ============================================================
function actualizarKPIsReservas(reservas) {
    var activas = (reservas || []).filter(function(r) { return r.estado === 'ACTIVA'; }).length;
    var total   = (reservas || []).length;

    var elActivas = document.getElementById('kpiReservasActivas');
    var elTotal   = document.getElementById('kpiReservasTotal');
    if (elActivas) { elActivas.textContent = activas; }
    if (elTotal)   { elTotal.textContent   = total;   }
}

function actualizarKPISedes() {
    var el = document.getElementById('kpiSedes');
    if (!el) { return; }
    var numSedes = (window.sedesData && window.sedesData.length)
        ? window.sedesData.length : (sedes.length || '—');
    el.textContent = numSedes;
}

function actualizarKPIUltimoPago(pagos) {
    var el = document.getElementById('kpiUltimoPago');
    if (!el) { return; }

    var pagados = (pagos || []).filter(function(p) { return p.estado === 'PAGADO'; });
    if (pagados.length === 0) { el.textContent = '$0'; return; }

    pagados.sort(function(a, b) { return new Date(b.fechaPago) - new Date(a.fechaPago); });
    var ultimo = pagados[0];
    el.textContent = ultimo && ultimo.monto
        ? '$' + Number(ultimo.monto).toLocaleString('es-CO')
        : '—';
}


// ============================================================
// ★ ACTIVIDAD RECIENTE — últimas 5 reservas
// ============================================================
function actualizarActividadReciente(reservas) {
    var ul = document.getElementById('actividadReciente');
    if (!ul) { return; }

    if (!reservas || reservas.length === 0) {
        ul.innerHTML =
            '<li class="cli-activity-empty">' +
            '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"' +
            '     stroke-width="1.5" stroke="currentColor" style="width:18px;height:18px;">' +
            '    <path stroke-linecap="round" stroke-linejoin="round"' +
            '          d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>' +
            '</svg>No hay actividad reciente</li>';
        return;
    }

    var ordenadas = reservas.slice().sort(function(a, b) {
        return new Date(b.fechaInicio) - new Date(a.fechaInicio);
    });

    ul.innerHTML = ordenadas.slice(0, 5).map(function(r) {
        var fecha  = new Date(r.fechaInicio);
        var sede   = (r.cupo && r.cupo.sede && r.cupo.sede.nombre) ? r.cupo.sede.nombre : 'Sede';
        var estado = r.estado ? r.estado.toLowerCase() : 'finalizada';
        var labels = {
            activa: 'Activa', pendiente: 'Pendiente',
            completada: 'Completada', cancelada: 'Cancelada'
        };
        return '<li class="cli-activity-item">' +
            '<div class="cli-activity-dot ' + estado + '"></div>' +
            '<div class="cli-activity-info">' +
            '    <div class="cli-activity-sede">' + sede + '</div>' +
            '    <div class="cli-activity-fecha">' +
            fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) +
            '</div></div>' +
            '<div class="cli-activity-estado">' + (labels[estado] || estado) + '</div>' +
            '</li>';
    }).join('');
}


// ============================================================
// ★ ESTADO ACTUAL — primera reserva activa
// ============================================================
function actualizarEstadoActual(reservas) {
    var contenedor = document.getElementById('statusReservaContent');
    if (!contenedor) { return; }

    var activa = (reservas || []).find(function(r) { return r.estado === 'ACTIVA'; });

    if (!activa) {
        contenedor.innerHTML =
            '<div class="cli-status-empty">' +
            '    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"' +
            '         stroke-width="1.5" stroke="currentColor" style="width:36px;height:36px;opacity:.35;">' +
            '        <path stroke-linecap="round" stroke-linejoin="round"' +
            '              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25' +
            '              2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021' +
            '              18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0021 11.25v7.5"/>' +
            '    </svg>' +
            '    <p>No tienes reservas activas</p>' +
            '    <button class="cli-btn-sm-purple" onclick="navegarA(\'misreservas\')">' +
            '        Hacer una reserva' +
            '    </button>' +
            '</div>';
        return;
    }

    var fechaInicio = new Date(activa.fechaInicio);
    var fechaFin    = new Date(activa.fechaFin);
    var sede        = (activa.cupo && activa.cupo.sede && activa.cupo.sede.nombre)
        ? activa.cupo.sede.nombre : 'Sede';
    var opts        = { hour: '2-digit', minute: '2-digit' };

    contenedor.innerHTML =
        '<div class="cli-status-activa">' +
        '    <div class="cli-status-activa-label">Reserva activa</div>' +
        '    <div class="cli-status-activa-sede">' + sede + '</div>' +
        '    <div class="cli-status-activa-tiempo">' +
        '        ' + fechaInicio.toLocaleTimeString('es-CO', opts) +
        '        → ' + fechaFin.toLocaleTimeString('es-CO', opts) +
        '        &nbsp;·&nbsp;' +
        '        ' + fechaInicio.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) +
        '    </div>' +
        '</div>';
}


// ============================================================
// ★ BADGE CONTADOR en tabs
// ============================================================
function actualizarBadgeCount(elementId, count) {
    var el = document.getElementById(elementId);
    if (el) { el.textContent = count || 0; }
}


// ============================================================
// ★ RESUMEN DE PAGOS
// ============================================================
function actualizarResumenPagos(pagos) {
    var totalEl      = document.getElementById('totalPagado');
    var countEl      = document.getElementById('totalPagosCount');
    var pendientesEl = document.getElementById('pagosPendientesCount');
    if (!totalEl) { return; }

    var pagados    = (pagos || []).filter(function(p) { return p.estado === 'PAGADO';    });
    var pendientes = (pagos || []).filter(function(p) { return p.estado === 'PENDIENTE'; });
    var total      = pagados.reduce(function(sum, p) { return sum + (p.monto || 0); }, 0);

    totalEl.textContent      = '$' + Number(total).toLocaleString('es-CO') + ' COP';
    countEl.textContent      = pagados.length;
    pendientesEl.textContent = pendientes.length;
}


// ============================================================
// ★ FILTROS — RESERVAS
// ============================================================
function filtrarReservas() {
    if (!_cacheReservas.length) { return; }

    var estado = (document.getElementById('filtroEstadoReserva')     || {}).value || '';
    var desde  = (document.getElementById('filtroFechaDesdeReserva') || {}).value || '';
    var hasta  = (document.getElementById('filtroFechaHastaReserva') || {}).value || '';

    var filtradas = _cacheReservas.filter(function(r) {
        if (estado && r.estado !== estado) { return false; }
        if (desde || hasta) {
            var fechaR = new Date(r.fechaInicio);
            if (desde && fechaR < new Date(desde + 'T00:00:00')) { return false; }
            if (hasta && fechaR > new Date(hasta + 'T23:59:59')) { return false; }
        }
        return true;
    });

    var emptyState = document.getElementById('reservasEmptyState');
    var hayFiltros = estado || desde || hasta;

    if (hayFiltros && filtradas.length === 0 && _cacheReservas.length > 0) {
        var tbody = document.getElementById('reservasTableBody');
        if (tbody) { tbody.innerHTML = ''; }
        if (emptyState) { emptyState.classList.remove('hidden'); }
        return;
    }
    if (emptyState) { emptyState.classList.add('hidden'); }
    actualizarTablaReservas(filtradas);
}

function limpiarFiltrosReservas() {
    ['filtroEstadoReserva', 'filtroFechaDesdeReserva', 'filtroFechaHastaReserva']
        .forEach(function(id) { var el = document.getElementById(id); if (el) { el.value = ''; } });

    // ✅ FIX-D1: limpiar estado interno del datepicker (label + hidden + día seleccionado)
    if (_dpDesdeReserva) { _dpDesdeReserva.limpiar(); }
    if (_dpHastaReserva) { _dpHastaReserva.limpiar(); }

    var emptyState = document.getElementById('reservasEmptyState');
    if (emptyState) { emptyState.classList.add('hidden'); }
    actualizarTablaReservas(_cacheReservas);
}


// ============================================================
// ★ FILTROS — PAGOS
// ============================================================
function filtrarPagos() {
    if (!_cachePagos.length) { return; }

    var estado = (document.getElementById('filtroEstadoPago')     || {}).value || '';
    var desde  = (document.getElementById('filtroFechaDesdePago') || {}).value || '';
    var hasta  = (document.getElementById('filtroFechaHastaPago') || {}).value || '';

    var filtrados = _cachePagos.filter(function(p) {
        if (estado && p.estado !== estado) { return false; }
        if (desde || hasta) {
            var fechaP = new Date(p.fechaPago);
            if (desde && fechaP < new Date(desde + 'T00:00:00')) { return false; }
            if (hasta && fechaP > new Date(hasta + 'T23:59:59')) { return false; }
        }
        return true;
    });

    var emptyState = document.getElementById('pagosEmptyState');
    var hayFiltros = estado || desde || hasta;

    if (hayFiltros && filtrados.length === 0 && _cachePagos.length > 0) {
        var tbody = document.getElementById('pagosTableBody');
        if (tbody) { tbody.innerHTML = ''; }
        if (emptyState) { emptyState.classList.remove('hidden'); }
        return;
    }
    if (emptyState) { emptyState.classList.add('hidden'); }
    actualizarTablaPagos(filtrados);
}

function limpiarFiltrosPagos() {
    ['filtroEstadoPago', 'filtroFechaDesdePago', 'filtroFechaHastaPago']
        .forEach(function(id) { var el = document.getElementById(id); if (el) { el.value = ''; } });

    // ✅ FIX-D1: limpiar estado interno del datepicker (label + hidden + día seleccionado)
    if (_dpDesdePago) { _dpDesdePago.limpiar(); }
    if (_dpHastaPago) { _dpHastaPago.limpiar(); }

    var emptyState = document.getElementById('pagosEmptyState');
    if (emptyState) { emptyState.classList.add('hidden'); }
    actualizarTablaPagos(_cachePagos);
}


// ============================================================
// ★ CONFIGURACIÓN — Carga de datos del perfil
// ============================================================
async function cargarDatosConfiguracion() {
    try {
        var res = await fetch('/cliente/perfil');
        if (!res.ok) { return; }
        var usuario = await res.json();

        var nombreEl = document.getElementById('configNombre');
        var telEl    = document.getElementById('configTelefono');
        var correoEl = document.getElementById('configCorreoDisplay');

        if (nombreEl && usuario.nombre)   { nombreEl.value       = usuario.nombre;   }
        if (telEl    && usuario.telefono) { telEl.value          = usuario.telefono; }
        if (correoEl && usuario.correo)   { correoEl.textContent = usuario.correo;   }
    } catch (e) {
        console.error('Error cargando datos de configuración:', e);
    }
}


// ============================================================
// ★ CONFIGURACIÓN — Guardar perfil (nombre + teléfono)
// ============================================================
async function guardarPerfil() {
    var nombre = (document.getElementById('configNombre')   || {}).value || '';
    var tel    = (document.getElementById('configTelefono') || {}).value || '';
    var btn    = document.getElementById('btnGuardarPerfil');
    var msg    = document.getElementById('msgPerfil');

    if (!nombre.trim()) {
        mostrarConfigMsg(msg, 'El nombre no puede estar vacío', 'error');
        return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

    try {
        var res  = await fetch('/cliente/perfil/actualizar', {
            method:  'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, getCsrfHeaders()),
            body:    JSON.stringify({ nombre: nombre.trim(), telefono: tel.trim() })
        });
        var data = await res.json();

        if (res.ok && data.success) {
            mostrarConfigMsg(msg, data.message || 'Perfil actualizado correctamente', 'success');
            var nom     = nombre.trim();
            var inicial = nom.charAt(0).toUpperCase();
            ['sidebarUsername', 'headerUsername', 'dropdownUsername'].forEach(function(id) {
                var el = document.getElementById(id); if (el) { el.textContent = nom; }
            });
            ['sidebarAvatarInitial', 'heroAvatarInitial',
                'headerAvatarInitial',  'dropdownAvatarInitial'].forEach(function(id) {
                var el = document.getElementById(id); if (el) { el.textContent = inicial; }
            });
            var heroTitle = document.getElementById('heroWelcomeTitle');
            if (heroTitle) { heroTitle.textContent = 'Bienvenido, ' + nom; }
        } else {
            mostrarConfigMsg(msg, data.message || 'Error al actualizar el perfil', 'error');
        }
    } catch (e) {
        mostrarConfigMsg(msg, 'Error de conexión', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML =
                '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"' +
                '     stroke-width="2" stroke="currentColor" style="width:15px;height:15px;">' +
                '    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>' +
                '</svg> Guardar cambios';
        }
    }
}


// ============================================================
// ★ CONFIGURACIÓN — Cambiar contraseña
//
// ✅ FIX-P1: Usa POST /cliente/perfil/cambiar-password
//            El endpoint anterior (/perfil/actualizar) solo procesaba
//            campos "nombre" y "telefono" — los campos "passwordActual"
//            y "passwordNueva" eran ignorados silenciosamente.
//            El botón respondía success:true sin cambiar nada en BD.
// ============================================================
async function cambiarContrasena() {
    var actual   = (document.getElementById('configPassActual')  || {}).value || '';
    var nueva    = (document.getElementById('configPassNueva')   || {}).value || '';
    var confirma = (document.getElementById('configPassConfirm') || {}).value || '';
    var btn      = document.getElementById('btnCambiarPass');
    var msg      = document.getElementById('msgContrasena');

    if (!actual || !nueva || !confirma) {
        mostrarConfigMsg(msg, 'Completa todos los campos', 'error');
        return;
    }
    if (nueva.length < 8) {
        mostrarConfigMsg(msg, 'La contraseña debe tener al menos 8 caracteres', 'error');
        return;
    }
    if (nueva !== confirma) {
        mostrarConfigMsg(msg, 'Las contraseñas no coinciden', 'error');
        return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Actualizando...'; }

    try {
        // ✅ FIX-P1: endpoint correcto que verifica BCrypt y hashea la nueva contraseña
        var res  = await fetch('/cliente/perfil/cambiar-password', {
            method:  'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, getCsrfHeaders()),
            body:    JSON.stringify({ passwordActual: actual, passwordNueva: nueva })
        });
        var data = await res.json();

        if (res.ok && data.success) {
            mostrarConfigMsg(msg, 'Contraseña actualizada correctamente', 'success');
            ['configPassActual', 'configPassNueva', 'configPassConfirm'].forEach(function(id) {
                var el = document.getElementById(id); if (el) { el.value = ''; }
            });
            var strengthBar = document.getElementById('passStrengthBar');
            if (strengthBar) { strengthBar.classList.add('hidden'); }
        } else {
            mostrarConfigMsg(msg, data.message || 'Error al actualizar la contraseña', 'error');
        }
    } catch (e) {
        mostrarConfigMsg(msg, 'Error de conexión', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML =
                '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"' +
                '     stroke-width="2" stroke="currentColor" style="width:15px;height:15px;">' +
                '    <path stroke-linecap="round" stroke-linejoin="round"' +
                '          d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25' +
                '          2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25' +
                '          2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/>' +
                '</svg> Actualizar contraseña';
        }
    }
}

function mostrarConfigMsg(el, texto, tipo) {
    if (!el) { return; }
    el.textContent = texto;
    el.className   = 'cli-config-msg ' + tipo;
    el.classList.remove('hidden');
    setTimeout(function() { el.classList.add('hidden'); }, 4000);
}


// ============================================================
// ★ TOGGLE VISIBILIDAD CONTRASEÑA
// ============================================================
function togglePassword(inputId, btnEl) {
    var input = document.getElementById(inputId);
    if (!input) { return; }
    var esOculto = input.type === 'password';
    input.type   = esOculto ? 'text' : 'password';

    var svgVer =
        '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"' +
        '     stroke-width="1.5" stroke="currentColor" style="width:16px;height:16px;">' +
        '<path stroke-linecap="round" stroke-linejoin="round"' +
        '      d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5' +
        '      12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0' +
        '      0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0' +
        '      01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894' +
        '      7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242' +
        '      4.242L9.88 9.88"/></svg>';

    var svgOculto =
        '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"' +
        '     stroke-width="1.5" stroke="currentColor" style="width:16px;height:16px;">' +
        '<path stroke-linecap="round" stroke-linejoin="round"' +
        '      d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5' +
        '      12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639' +
        '      C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/>' +
        '<path stroke-linecap="round" stroke-linejoin="round"' +
        '      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>';

    btnEl.innerHTML = esOculto ? svgVer : svgOculto;
}


// ============================================================
// ★ INDICADOR DE FORTALEZA DE CONTRASEÑA
// ============================================================
function evaluarFortalezaPass(valor) {
    var barra = document.getElementById('passStrengthBar');
    var fill  = document.getElementById('passStrengthFill');
    var label = document.getElementById('passStrengthLabel');
    if (!barra || !fill || !label) { return; }

    if (!valor || valor.length === 0) { barra.classList.add('hidden'); return; }
    barra.classList.remove('hidden');

    var puntos = 0;
    if (valor.length >= 8)           { puntos++; }
    if (valor.length >= 12)          { puntos++; }
    if (/[A-Z]/.test(valor))         { puntos++; }
    if (/[0-9]/.test(valor))         { puntos++; }
    if (/[^A-Za-z0-9]/.test(valor))  { puntos++; }

    var niveles = [
        { ancho: '20%',  color: '#ef4444', texto: 'Muy débil'  },
        { ancho: '40%',  color: '#f97316', texto: 'Débil'      },
        { ancho: '60%',  color: '#eab308', texto: 'Media'      },
        { ancho: '80%',  color: '#22c55e', texto: 'Fuerte'     },
        { ancho: '100%', color: '#16a34a', texto: 'Muy fuerte' }
    ];

    var nivel = niveles[Math.min(puntos - 1, 4)] || niveles[0];
    fill.style.width           = nivel.ancho;
    fill.style.backgroundColor = nivel.color;
    label.textContent          = nivel.texto;
    label.style.color          = nivel.color;
}


// ============================================================
// ★ FAQ — ACORDEÓN
// ============================================================
function toggleFaq(btnEl) {
    var item = btnEl.closest('.cli-faq-item');
    var body = item ? item.querySelector('.cli-faq-body') : null;
    if (!item || !body) { return; }

    var estaAbierto = item.classList.contains('open');

    document.querySelectorAll('.cli-faq-item.open').forEach(function(el) {
        el.classList.remove('open');
        var b = el.querySelector('.cli-faq-body');
        if (b) { b.classList.remove('open'); }
    });

    if (!estaAbierto) {
        item.classList.add('open');
        body.classList.add('open');
    }
}


// ============================================================
// EXPONER FUNCIONES GLOBALES
// ============================================================
window.handleLogout           = handleLogout;
window.cancelarReserva        = cancelarReserva;
window.mostrarDetallesSede    = mostrarDetallesSede;
window.cerrarModalSede        = cerrarModalSede;
window.cerrarReservaModal     = cerrarReservaModal;
window.abrirModalReserva      = abrirModalReserva;
window.navegarA               = navegarA;
window.filtrarReservas        = filtrarReservas;
window.limpiarFiltrosReservas = limpiarFiltrosReservas;
window.filtrarPagos           = filtrarPagos;
window.limpiarFiltrosPagos    = limpiarFiltrosPagos;
window.guardarPerfil          = guardarPerfil;
window.cambiarContrasena      = cambiarContrasena;
window.togglePassword         = togglePassword;
window.evaluarFortalezaPass   = evaluarFortalezaPass;
window.toggleFaq              = toggleFaq;


// ============================================================
// ★ CALENDARIO DEL MODAL DE RESERVA
// Funciones: resvToggle(k), resvNav(k, delta), resvOk(k)
// Se engancha a abrirModalReserva() para limpiar al abrir.
// ============================================================
(function() {
    var MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
        'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

    function pad(n) { return String(n).padStart(2, '0'); }

    var _s = {
        inicio: { y: 0, m: 0, day: null, hr: 8,  mn: 0 },
        fin:    { y: 0, m: 0, day: null, hr: 9,  mn: 0 }
    };

    function initSelects(k) {
        var hr = document.getElementById(k === 'inicio' ? 'hrInicio' : 'hrFin');
        var mn = document.getElementById(k === 'inicio' ? 'mnInicio' : 'mnFin');
        if (!hr || !mn) { return; }
        hr.innerHTML = '';
        mn.innerHTML = '';
        for (var h = 0; h < 24; h++) {
            var o = document.createElement('option');
            o.value = h; o.textContent = pad(h);
            if (h === _s[k].hr) { o.selected = true; }
            hr.appendChild(o);
        }
        for (var m = 0; m < 60; m++) {
            var o = document.createElement('option');
            o.value = m; o.textContent = pad(m);
            if (m === _s[k].mn) { o.selected = true; }
            mn.appendChild(o);
        }
        hr.onchange = (function(key) { return function() { _s[key].hr = +this.value; }; })(k);
        mn.onchange = (function(key) { return function() { _s[key].mn = +this.value; }; })(k);
    }

    function renderGrid(k) {
        var s    = _s[k];
        var lbEl = document.getElementById(k === 'inicio' ? 'lblMesInicio' : 'lblMesFin');
        var grid = document.getElementById(k === 'inicio' ? 'gridInicio'   : 'gridFin');
        if (!lbEl || !grid) { return; }

        lbEl.textContent = MESES[s.m] + ' ' + s.y;
        grid.innerHTML   = '';

        var today    = new Date(); today.setHours(0, 0, 0, 0);
        var firstDay = new Date(s.y, s.m, 1).getDay();
        var offset   = firstDay === 0 ? 6 : firstDay - 1;
        var diasMes  = new Date(s.y, s.m + 1, 0).getDate();

        for (var i = 0; i < offset; i++) {
            var sp = document.createElement('span');
            sp.className = 'resv-day';
            sp.setAttribute('disabled', '');
            grid.appendChild(sp);
        }

        for (var d = 1; d <= diasMes; d++) {
            (function(dia) {
                var dt  = new Date(s.y, s.m, dia);
                var btn = document.createElement('button');
                btn.type        = 'button';
                btn.className   = 'resv-day';
                btn.textContent = dia;

                if (dt < today) { btn.setAttribute('disabled', ''); }
                if (dt.getTime() === today.getTime()) { btn.classList.add('resv-day-today'); }
                if (s.day && dt.getTime() === s.day.getTime()) { btn.classList.add('resv-day-sel'); }

                btn.onclick = function(e) {
                    e.stopPropagation();
                    if (dt < today) { return; }
                    s.day = dt;
                    renderGrid(k);
                };
                grid.appendChild(btn);
            })(d);
        }
    }

    window.resvToggle = function(k) {
        var other  = k === 'inicio' ? 'fin' : 'inicio';
        var popup  = document.getElementById(k === 'inicio' ? 'popInicio' : 'popFin');
        var popupO = document.getElementById(other === 'inicio' ? 'popInicio' : 'popFin');
        var trig   = document.getElementById(k === 'inicio' ? 'trigInicio' : 'trigFin');
        var trigO  = document.getElementById(other === 'inicio' ? 'trigInicio' : 'trigFin');

        if (popupO) { popupO.style.display = 'none'; }
        if (trigO)  { trigO.classList.remove('resv-open'); }
        if (!popup || !trig) { return; }

        var open = popup.style.display === 'block';
        if (open) {
            popup.style.display = 'none';
            trig.classList.remove('resv-open');
        } else {
            var rect = trig.getBoundingClientRect();
            var popW = 240;
            var top  = rect.bottom + 4;
            var left = rect.left;
            if (left + popW > window.innerWidth - 8) { left = rect.right - popW; }
            if (top  + 320 > window.innerHeight)     { top  = rect.top - 324;   }
            popup.style.top     = top  + 'px';
            popup.style.left    = left + 'px';
            popup.style.display = 'block';
            trig.classList.add('resv-open');
            renderGrid(k);
        }
    };

    window.resvNav = function(k, delta) {
        _s[k].m += delta;
        if (_s[k].m > 11) { _s[k].m = 0;  _s[k].y++; }
        if (_s[k].m < 0)  { _s[k].m = 11; _s[k].y--; }
        renderGrid(k);
    };

    window.resvOk = function(k) {
        var s = _s[k];
        if (!s.day) { return; }

        var hrEl = document.getElementById(k === 'inicio' ? 'hrInicio' : 'hrFin');
        var mnEl = document.getElementById(k === 'inicio' ? 'mnInicio' : 'mnFin');
        if (hrEl) { s.hr = +hrEl.value; }
        if (mnEl) { s.mn = +mnEl.value; }

        // ✅ FIX-R2: ISO con segundos (:00) — LocalDateTime requiere HH:mm:ss
        // Sin los segundos, Jackson lanza 400 Bad Request al deserializar
        var iso = s.day.getFullYear() + '-' +
            pad(s.day.getMonth() + 1) + '-' +
            pad(s.day.getDate()) + 'T' +
            pad(s.hr) + ':' + pad(s.mn) + ':00';

        var hiddenEl = document.getElementById(k === 'inicio' ? 'fechaInicio' : 'fechaFin');
        if (hiddenEl) { hiddenEl.value = iso; }

        var lblFecha = document.getElementById(k === 'inicio' ? 'lblFechaInicio' : 'lblFechaFin');
        var lblHora  = document.getElementById(k === 'inicio' ? 'lblHoraInicio'  : 'lblHoraFin');
        if (lblFecha) {
            lblFecha.textContent = s.day.toLocaleDateString('es-CO',
                { day: '2-digit', month: 'short', year: 'numeric' });
            lblFecha.classList.remove('resv-dt-ph');
        }
        if (lblHora) { lblHora.textContent = pad(s.hr) + ':' + pad(s.mn); }

        var popup = document.getElementById(k === 'inicio' ? 'popInicio' : 'popFin');
        var trig  = document.getElementById(k === 'inicio' ? 'trigInicio' : 'trigFin');
        if (popup) { popup.style.display = 'none'; }
        if (trig)  { trig.classList.remove('resv-open'); }

        if (k === 'inicio') {
            _s.fin.y  = s.day.getFullYear();
            _s.fin.m  = s.day.getMonth();
            _s.fin.hr = Math.min(s.hr + 1, 23);
            _s.fin.mn = s.mn;
            initSelects('fin');
            setTimeout(function() { window.resvToggle('fin'); }, 80);
        }
    };

    function resvReset() {
        var now = new Date();
        ['inicio', 'fin'].forEach(function(k) {
            _s[k].y   = now.getFullYear();
            _s[k].m   = now.getMonth();
            _s[k].day = null;
            _s[k].hr  = k === 'inicio' ? 8 : 9;
            _s[k].mn  = 0;

            var popup = document.getElementById(k === 'inicio' ? 'popInicio' : 'popFin');
            var trig  = document.getElementById(k === 'inicio' ? 'trigInicio' : 'trigFin');
            if (popup) { popup.style.display = 'none'; }
            if (trig)  { trig.classList.remove('resv-open'); }

            var lblF = document.getElementById(k === 'inicio' ? 'lblFechaInicio' : 'lblFechaFin');
            var lblH = document.getElementById(k === 'inicio' ? 'lblHoraInicio'  : 'lblHoraFin');
            if (lblF) { lblF.textContent = 'Seleccionar'; lblF.classList.add('resv-dt-ph'); }
            if (lblH) { lblH.textContent = 'Sin hora'; }

            initSelects(k);
        });
    }

    document.addEventListener('click', function(e) {
        ['inicio', 'fin'].forEach(function(k) {
            var popup = document.getElementById(k === 'inicio' ? 'popInicio' : 'popFin');
            var trig  = document.getElementById(k === 'inicio' ? 'trigInicio' : 'trigFin');
            if (!popup || popup.style.display !== 'block') { return; }
            if (popup.contains(e.target) || (trig && trig.contains(e.target))) { return; }
            popup.style.display = 'none';
            if (trig) { trig.classList.remove('resv-open'); }
        });
    });

    document.addEventListener('DOMContentLoaded', function() {
        initSelects('inicio');
        initSelects('fin');

        var _orig = window.abrirModalReserva;
        if (typeof _orig === 'function') {
            window.abrirModalReserva = async function() {
                await _orig.call(this);
                resvReset();
            };
        }
    });

})();