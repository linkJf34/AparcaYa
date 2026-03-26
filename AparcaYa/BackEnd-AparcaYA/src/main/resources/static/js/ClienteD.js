'use strict';
// ============================================================
// CLIENTED.JS — AparcaYA  v3.0
// Ruta: /js/ClienteD.js
//
// v3.0 — Cambios sobre v2.2:
//   ✅ irAlMapa() agregada — botones "Nueva reserva" y
//      "Hacer reserva" redirigen al mapa de sedes
//   ✅ abrirModalReserva() conecta con resvValidarYConf
//      si Flatpickr está disponible, fallback a crearReserva
//   ✅ actualizarEstadoActual() — botón usa irAlMapa()
//   ✅ IIFE vacío del calendario eliminado
//   ✅ window.irAlMapa expuesto globalmente
//   ✅ Colores violeta preservados en todo el archivo
// ============================================================


// ============================================================
// VARIABLES GLOBALES
// ============================================================
var map              = null;
var marcadores       = [];
var sedes            = [];
var sedeSeleccionada = null;

var _cacheReservas = [];
var _cachePagos    = [];

if (typeof window.sedesData !== 'undefined') {
    sedes = window.sedesData || [];
}


// ============================================================
// CSRF
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

var TABS_LABELS = {
    'perfil':        'Inicio',
    'misreservas':   'Mis Reservas',
    'pagos':         'Pagos',
    'configuracion': 'Configuración',
    'ayuda':         'Ayuda'
};


// ============================================================
// NOTIFICACIONES — MIGRADO al helper centralizado
//
// showToast() y showConfirm() locales ELIMINADAS.
// Ahora usan las funciones de aparca-notifications.js:
//   showSuccess(), showError(), showWarning(), showInfo()  → toasts
//   showToast(msg, tipo)                                   → alias compatible
//   showConfirm({ title, body, btnTexto, btnColor })       → Promise<boolean>
//
// Alias de compatibilidad para llamadas con firma posicional:
// ============================================================
function showConfirm(titulo, cuerpo, btnTexto, btnColor) {
    if (typeof titulo === 'object') {
        return window.AparcaNotif
            ? window.AparcaNotif.showConfirm(titulo)
            : Promise.resolve(false);
    }
    return window.AparcaNotif
        ? window.AparcaNotif.showConfirm({
            title:    titulo,
            body:     cuerpo     || '',
            btnTexto: btnTexto   || 'Confirmar',
            btnColor: btnColor   || 'danger'
        })
        : Promise.resolve(false);
}


// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    inicializarNavegacion();
    inicializarPerfilMenu();
    inicializarDatepickersFiltros();
    cargarDatosUsuario();
    cargarReservas();
    cargarSedesYMapa();
    inicializarBusquedaMapa();
    cargarPagos();
    cargarDatosConfiguracion();
    actualizarKPISedes();
});


// ============================================================
// NAVEGACIÓN
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

            actualizarBreadcrumb(targetTab);

            if (targetTab === 'perfil' && map) {
                setTimeout(function() { map.invalidateSize(); }, 100);
            }

            var dropdown = document.getElementById('profileDropdown');
            var btn      = document.getElementById('profileBtn');
            if (dropdown) { dropdown.classList.remove('show'); }
            if (btn)      { btn.setAttribute('aria-expanded', 'false'); }
        });
    });
}

function navegarA(tabId) {
    var link = document.querySelector('.aparca-sidebar-nav a[data-tab="' + tabId + '"]');
    if (link) { link.click(); }
}

// ============================================================
// CAMBIO v3.0 — irAlMapa()
// Los botones "Nueva reserva" y "Hacer reserva" llevan al mapa
// de sedes en la sección Inicio, NO a Mis Reservas.
// Color del destello: violeta #7c3aed
// ============================================================
function irAlMapa() {
    var seccionActual = document.querySelector('.aparca-content-section:not(.hidden)');
    var esInicio = seccionActual && seccionActual.id === 'perfil';

    if (!esInicio) {
        var linkInicio = document.querySelector('.aparca-sidebar-nav a[data-tab="perfil"]');
        if (linkInicio) { linkInicio.click(); }
    }

    setTimeout(function() {
        var mapSection = document.querySelector('.cli-map-section');
        if (mapSection) {
            mapSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            mapSection.style.transition = 'box-shadow .25s';
            mapSection.style.boxShadow  = '0 0 0 3px #7c3aed, 0 8px 32px rgba(124,58,237,.22)';
            setTimeout(function() { mapSection.style.boxShadow = ''; }, 1800);
        }
        if (map) { map.invalidateSize(); }
    }, esInicio ? 20 : 120);
}

function actualizarBreadcrumb(tabId) {
    var el = document.getElementById('breadcrumbCurrent');
    if (el) { el.textContent = TABS_LABELS[tabId] || tabId; }
}


// ============================================================
// MENÚ DE PERFIL
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

    // Crear un form temporal y submitearlo — el browser maneja
    // el redirect HTML sin bloqueo de MIME type
    var form = document.createElement('form');
    form.method = 'POST';
    form.action = '/logout';

    // Incluir CSRF token si existe
    var csrfMeta  = document.querySelector('meta[name="_csrf"]');
    var csrfHMeta = document.querySelector('meta[name="_csrf_header"]');
    if (csrfMeta) {
        var input = document.createElement('input');
        input.type  = 'hidden';
        input.name  = csrfHMeta ? csrfHMeta.getAttribute('content') : '_csrf';
        input.value = csrfMeta.getAttribute('content');
        form.appendChild(input);
    }

    document.body.appendChild(form);
    form.submit();
}


// ============================================================
// DATOS DEL USUARIO
// ============================================================
async function cargarDatosUsuario() {
    try {
        var response = await fetch('/cliente/perfil');
        if (response.ok) {
            var usuario = await response.json();

            if (usuario && usuario.nombre) {
                var nom     = usuario.nombre;
                var inicial = nom.charAt(0).toUpperCase();

                var welcomeH2 = document.getElementById('heroWelcomeTitle');
                if (welcomeH2) { welcomeH2.textContent = 'Bienvenido, ' + nom; }

                var usernameEl = document.getElementById('sidebarUsername');
                var avatarEl   = document.getElementById('sidebarAvatarInitial');
                if (usernameEl) { usernameEl.textContent = nom;     }
                if (avatarEl)   { avatarEl.textContent   = inicial; }

                var headerAvatar   = document.getElementById('headerAvatarInitial');
                var headerUsername = document.getElementById('headerUsername');
                if (headerAvatar)   { headerAvatar.textContent   = inicial; }
                if (headerUsername) { headerUsername.textContent = nom;     }

                var dropAvatar   = document.getElementById('dropdownAvatarInitial');
                var dropUsername = document.getElementById('dropdownUsername');
                if (dropAvatar)   { dropAvatar.textContent   = inicial; }
                if (dropUsername) { dropUsername.textContent = nom;     }

                var heroAvatar = document.getElementById('heroAvatarInitial');
                if (heroAvatar) { heroAvatar.textContent = inicial; }

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
            showSuccess(data.message || 'Reserva cancelada correctamente');
            cargarReservas();
        } else {
            showError(data.message || 'Error al cancelar la reserva');
        }
    } catch (err) {
        console.error(err);
        showError('Error de conexión');
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
    if (!map) { return; }
    marcadores.forEach(function(m) { m.remove(); });
    marcadores = [];

    for (var i = 0; i < sedes.length; i++) {
        var sede = sedes[i];
        var lat  = sede.latitud;
        var lon  = sede.longitud;

        if (!lat || !lon) {
            var coords = await geocodificarDireccion(sede.direccion, sede.localidad, sede.barrio);
            if (!coords) { console.warn('Sin coordenadas para sede:', sede.nombre); continue; }
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
                'justify-content:center;height:100%;">P</div></div>',
            iconSize:    [32, 32],
            iconAnchor:  [16, 32],
            popupAnchor: [0, -32]
        });

        var svgPin =
            '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" ' +
            'viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" ' +
            'stroke-linecap="round" stroke-linejoin="round" ' +
            'style="display:inline;vertical-align:middle;margin-right:4px;flex-shrink:0;">' +
            '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0' +
            'C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>' +
            '<circle cx="12" cy="10" r="3"/></svg>';

        var svgCar =
            '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" ' +
            'viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" ' +
            'stroke-linecap="round" stroke-linejoin="round" ' +
            'style="display:inline;vertical-align:middle;margin-right:4px;flex-shrink:0;">' +
            '<path d="M5 17H3v-5l2-5h14l2 5v5h-2"/>' +
            '<circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/>' +
            '<path d="M5 12h14"/></svg>';

        var marker = L.marker([lat, lon], { icon: customIcon }).addTo(map);
        marker.bindPopup(
            '<div style="min-width:200px;">' +
            '<h4 style="margin:0 0 8px;font-size:1rem;font-weight:700;color:#0f172a;">' + sede.nombre + '</h4>' +
            '<p style="margin:4px 0;color:#64748b;font-size:.875rem;display:flex;align-items:center;">' +
            svgPin + sede.direccion + '</p>' +
            '<p style="margin:4px 0;color:#64748b;font-size:.875rem;display:flex;align-items:center;">' +
            svgCar + 'Capacidad: ' + sede.capacidad + ' vehículos</p>' +
            '<button id="btn-sede-' + sede.idSede + '"' +
            '        style="margin-top:12px;width:100%;background:#7c3aed;color:white;' +
            '               border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:600;"' +
            '        onmouseover="this.style.background=\'#6d28d9\'"' +
            '        onmouseout="this.style.background=\'#7c3aed\'">Ver detalles completos</button>' +
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
// DATEPICKERS DE FILTROS
// ============================================================
var _dpDesdeReserva = null;
var _dpHastaReserva = null;
var _dpDesdePago    = null;
var _dpHastaPago    = null;

function inicializarDatepickersFiltros() {
    if (typeof AparcaDatepicker !== 'function') {
        console.warn('AparcaDatepicker no disponible — filtros de fecha desactivados');
        return;
    }

    _dpDesdeReserva = new AparcaDatepicker({
        btnId: 'btnDesdeReserva', popupId: 'popDesdeReserva', labelId: 'lblDesdeReserva',
        hiddenId: 'filtroFechaDesdeReserva', gridId: 'gridDesdeReserva',
        mesId: 'mesDesdeReserva', prevId: 'prevDesdeReserva', nextId: 'nextDesdeReserva',
        placeholder: 'Fecha inicio', soloFuturo: false,
        onConfirm: function() { filtrarReservas(); }
    });

    _dpHastaReserva = new AparcaDatepicker({
        btnId: 'btnHastaReserva', popupId: 'popHastaReserva', labelId: 'lblHastaReserva',
        hiddenId: 'filtroFechaHastaReserva', gridId: 'gridHastaReserva',
        mesId: 'mesHastaReserva', prevId: 'prevHastaReserva', nextId: 'nextHastaReserva',
        placeholder: 'Fecha fin', soloFuturo: false,
        onConfirm: function() { filtrarReservas(); }
    });

    _dpDesdePago = new AparcaDatepicker({
        btnId: 'btnDesdePago', popupId: 'popDesdePago', labelId: 'lblDesdePago',
        hiddenId: 'filtroFechaDesdePago', gridId: 'gridDesdePago',
        mesId: 'mesDesdePago', prevId: 'prevDesdePago', nextId: 'nextDesdePago',
        placeholder: 'Fecha inicio', soloFuturo: false,
        onConfirm: function() { filtrarPagos(); }
    });

    _dpHastaPago = new AparcaDatepicker({
        btnId: 'btnHastaPago', popupId: 'popHastaPago', labelId: 'lblHastaPago',
        hiddenId: 'filtroFechaHastaPago', gridId: 'gridHastaPago',
        mesId: 'mesHastaPago', prevId: 'prevHastaPago', nextId: 'nextHastaPago',
        placeholder: 'Fecha fin', soloFuturo: false,
        onConfirm: function() { filtrarPagos(); }
    });
}


// ============================================================
// BÚSQUEDA EN MAPA — v2
// ============================================================

var _cliSearchDebounce = null;
var _cliLastNominatim  = 0;
var _cliMarkerBusqueda = null;

function inicializarBusquedaMapa() {
    var searchInput = document.getElementById('searchInput');
    var searchBtn   = document.getElementById('searchBtn');

    var dropdown = document.getElementById('searchDropdown');
    if (!dropdown && searchInput) {
        dropdown = document.createElement('div');
        dropdown.id = 'searchDropdown';
        dropdown.style.cssText =
            'position:absolute;top:100%;left:0;right:0;z-index:9999;' +
            'background:#fff;border:1.5px solid #e2e8f0;border-top:none;' +
            'border-radius:0 0 .625rem .625rem;' +
            'box-shadow:0 8px 24px rgba(0,0,0,.1);' +
            'display:none;max-height:280px;overflow-y:auto;';
        var wrapper = searchInput.closest('div') || searchInput.parentNode;
        if (wrapper) {
            wrapper.style.position = 'relative';
            wrapper.appendChild(dropdown);
        }
    }

    if (!document.getElementById('cli-search-style')) {
        var s = document.createElement('style');
        s.id = 'cli-search-style';
        s.textContent =
            '@keyframes cliSpin { to { transform: rotate(360deg); } }' +
            '.cli-search-item { cursor:pointer; transition:background .15s; }' +
            '.cli-search-item:hover,.cli-search-item.activo { background:#f0fdf4; }';
        document.head.appendChild(s);
    }

    if (searchInput) {
        searchInput.addEventListener('input', function() {
            clearTimeout(_cliSearchDebounce);
            var val = this.value.trim();
            _cliOcultarDropdown();
            if (val.length < 4) return;
            _cliSetDropdownCargando();
            _cliSearchDebounce = setTimeout(function() {
                _cliBuscarNominatim(val);
            }, 600);
        });

        searchInput.addEventListener('keydown', function(e) {
            var d      = document.getElementById('searchDropdown');
            var items  = d ? d.querySelectorAll('.cli-search-item') : [];
            var activo = d ? d.querySelector('.cli-search-item.activo') : null;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (activo) { activo.classList.remove('activo'); (activo.nextElementSibling || items[0]).classList.add('activo'); }
                else if (items[0]) items[0].classList.add('activo');
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (activo) { activo.classList.remove('activo'); if (activo.previousElementSibling) activo.previousElementSibling.classList.add('activo'); }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (activo) activo.click();
                else if (this.value.trim().length >= 3) { _cliSetDropdownCargando(); _cliBuscarNominatim(this.value.trim()); }
            } else if (e.key === 'Escape') {
                _cliOcultarDropdown();
            }
        });

        document.addEventListener('click', function(e) {
            var d = document.getElementById('searchDropdown');
            if (!searchInput.contains(e.target) && !(d && d.contains(e.target))) {
                _cliOcultarDropdown();
            }
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', buscarDireccion);
    }
}

function buscarDireccion() {
    var inp = document.getElementById('searchInput');
    var val = inp ? inp.value.trim() : '';
    if (val.length < 3) { showWarning('Por favor ingresá al menos 3 caracteres'); return; }
    clearTimeout(_cliSearchDebounce);
    _cliSetDropdownCargando();
    _cliBuscarNominatim(val);
}

function _cliSetDropdownCargando() {
    var d = document.getElementById('searchDropdown');
    if (!d) return;
    d.style.display = 'block';
    d.innerHTML =
        '<div style="padding:.75rem 1rem;color:#64748b;font-size:.82rem;' +
        'display:flex;align-items:center;gap:.5rem;">' +
        '<svg style="width:13px;height:13px;animation:cliSpin 1s linear infinite;flex-shrink:0;" ' +
        'xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">' +
        '<circle style="opacity:.25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>' +
        '<path style="opacity:.75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>' +
        'Buscando en Bogotá...</div>';
}

async function _cliBuscarNominatim(query) {
    var ahora  = Date.now();
    var espera = 1050 - (ahora - _cliLastNominatim);
    if (espera > 0) await new Promise(function(r) { setTimeout(r, espera); });
    _cliLastNominatim = Date.now();

    try {
        var params = new URLSearchParams({
            q:                 query + ', Bogotá, Colombia',
            format:            'json',
            limit:             '5',
            countrycodes:      'co',
            viewbox:           '-74.25,4.45,-73.95,4.85',
            bounded:           '1',
            'accept-language': 'es'
        });
        var resp = await fetch(
            'https://nominatim.openstreetmap.org/search?' + params.toString(),
            { headers: { 'User-Agent': 'AparcaYA/1.0' } }
        );
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        var data = await resp.json();
        _cliMostrarSugerencias(data);
    } catch (err) {
        console.warn('Búsqueda mapa cliente:', err);
        _cliOcultarDropdown();
        showWarning('No se pudo buscar la dirección. Verificá tu conexión.');
    }
}

function _cliMostrarSugerencias(resultados) {
    var dropdown = document.getElementById('searchDropdown');
    if (!dropdown) return;

    var dentroRango = resultados.filter(function(r) {
        var lat = parseFloat(r.lat), lon = parseFloat(r.lon);
        return lat >= 4.45 && lat <= 4.85 && lon >= -74.25 && lon <= -73.95;
    });

    if (dentroRango.length === 0) {
        dropdown.innerHTML =
            '<div style="padding:.875rem 1rem;">' +
            '<div style="color:#d97706;font-size:.82rem;font-weight:600;margin-bottom:.25rem;">Sin resultados en Bogotá</div>' +
            '<div style="color:#64748b;font-size:.77rem;">Intentá con otra dirección o referencia.</div></div>';
        dropdown.style.display = 'block';
        return;
    }

    dropdown.innerHTML =
        '<div style="padding:.35rem 1rem;font-size:.7rem;font-weight:700;color:#94a3b8;' +
        'text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #f1f5f9;">Resultados</div>';

    dentroRango.forEach(function(r) {
        var item = document.createElement('div');
        item.className = 'cli-search-item';
        item.style.cssText =
            'display:flex;align-items:flex-start;gap:.625rem;padding:.7rem 1rem;' +
            'border-bottom:1px solid #f8fffe;';

        var addr   = r.address || {};
        var titulo = [addr.road, addr.house_number].filter(Boolean).join(' ')
            || r.display_name.split(',')[0].trim();
        var sub    = addr.suburb || addr.neighbourhood || addr.quarter || 'Bogotá';

        item.innerHTML =
            '<div style="width:28px;height:28px;background:#f0fdf4;border-radius:50%;' +
            'display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:.1rem;">' +
            '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" ' +
            'stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
            'style="width:13px;height:13px;">' +
            '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0' +
            'C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg></div>' +
            '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:.85rem;font-weight:600;color:#1e293b;white-space:nowrap;' +
            'overflow:hidden;text-overflow:ellipsis;">' + titulo + '</div>' +
            '<div style="font-size:.73rem;color:#64748b;margin-top:.1rem;">' + sub + '</div></div>';

        item.addEventListener('mouseenter', function() {
            dropdown.querySelectorAll('.cli-search-item').forEach(function(el) { el.classList.remove('activo'); });
            item.classList.add('activo');
        });

        item.addEventListener('click', function() {
            var lat = parseFloat(r.lat), lon = parseFloat(r.lon);
            var inp = document.getElementById('searchInput');
            if (inp) inp.value = titulo;
            _cliOcultarDropdown();

            if (!map) return;
            map.setView([lat, lon], 17, { animate: true });

            if (_cliMarkerBusqueda) { _cliMarkerBusqueda.remove(); _cliMarkerBusqueda = null; }

            var pinIcon = L.divIcon({
                className: '',
                html: '<div style="width:28px;height:28px;background:#7c3aed;' +
                    'border-radius:50% 50% 50% 0;transform:rotate(-45deg);' +
                    'border:2px solid #fff;box-shadow:0 3px 10px rgba(124,58,237,.5);">' +
                    '<div style="width:7px;height:7px;background:#fff;border-radius:50%;' +
                    'position:absolute;top:50%;left:50%;' +
                    'transform:translate(-50%,-50%) rotate(45deg);"></div></div>',
                iconSize:    [28, 28],
                iconAnchor:  [14, 28],
                popupAnchor: [0, -32]
            });

            _cliMarkerBusqueda = L.marker([lat, lon], { icon: pinIcon }).addTo(map);
            _cliMarkerBusqueda.bindPopup(
                '<div style="font-size:.82rem;font-weight:600;color:#0f172a;padding:.2rem;">' +
                titulo + '</div>'
            ).openPopup();
        });

        dropdown.appendChild(item);
    });

    var footer = document.createElement('div');
    footer.style.cssText =
        'padding:.35rem 1rem;font-size:.68rem;color:#94a3b8;' +
        'text-align:center;border-top:1px solid #f1f5f9;';
    footer.textContent = '© OpenStreetMap contributors';
    dropdown.appendChild(footer);
    dropdown.style.display = 'block';
}

function _cliOcultarDropdown() {
    var d = document.getElementById('searchDropdown');
    if (d) { d.style.display = 'none'; d.innerHTML = ''; }
}


// ============================================================
// MODAL DETALLE SEDE
// ============================================================
function mostrarDetallesSede(sedeId) {
    var lista = (typeof window.sedesData !== 'undefined' && window.sedesData.length)
        ? window.sedesData : sedes;

    var sede = lista.find(function(s) { return s.idSede == sedeId || s.id == sedeId; });
    if (!sede) { return; }

    sedeSeleccionada = sede;

    var modal = document.getElementById('modalSede');
    if (!modal) { return; }

    var titleEl = document.getElementById('modalSedeTitle');
    if (titleEl) { titleEl.textContent = sede.nombre; }

    var estadoEl = document.getElementById('cli-detalle-estado');
    if (estadoEl) {
        estadoEl.textContent = sede.estado === 'ACTIVO' ? 'Disponible' : 'No disponible';
        estadoEl.className   = 'cli-sede-badge ' +
            (sede.estado === 'ACTIVO' ? 'cli-sede-badge--activo' : 'cli-sede-badge--inactivo');
    }

    function set(id, valor, fallback) {
        var el = document.getElementById(id);
        if (el) { el.textContent = valor || fallback || '—'; }
    }

    function fmt(v) { return v != null ? Number(v).toLocaleString('es-CO') : 'N/A'; }

    set('cli-detalle-direccion',       sede.direccion);
    set('cli-detalle-localidad',       sede.localidad);
    set('cli-detalle-barrio',          sede.barrio,      'No especificado');
    set('cli-detalle-capacidad',       sede.capacidad);
    set('cli-detalle-horario',         sede.horarioSede, 'No especificado');
    set('cli-detalle-tarifa-plena-c',  fmt(sede.tarifaPlenaC));
    set('cli-detalle-tarifa-minuto-c', fmt(sede.tarifaMinutoC));
    set('cli-detalle-tarifa-plena-m',  fmt(sede.tarifaPlenaM));
    set('cli-detalle-tarifa-minuto-m', fmt(sede.tarifaMinutoM));

    var btnReservar = document.getElementById('cli-detalle-btn-reservar');
    if (btnReservar) {
        btnReservar.disabled = (sede.estado !== 'ACTIVO');
        btnReservar.onclick  = function() {
            cerrarModalSede();
            abrirModalReserva();
        };
    }

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
// MODAL RESERVA
// ============================================================
async function abrirModalReserva() {
    if (!sedeSeleccionada) { return; }

    cerrarModalSede();

    var sedeNombreEl = document.getElementById('reservaSedeNombre');
    if (sedeNombreEl) { sedeNombreEl.textContent = sedeSeleccionada.nombre; }

    var fechaInicioEl = document.getElementById('fechaInicio');
    var fechaFinEl    = document.getElementById('fechaFin');
    if (fechaInicioEl) { fechaInicioEl.value = ''; }
    if (fechaFinEl)    { fechaFinEl.value    = ''; }

    await cargarVehiculosSelect();

    var modal = document.getElementById('reservaModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
    }

    // CAMBIO v3.0: conecta con resvValidarYConf si Flatpickr está cargado
    var reservarBtn = document.getElementById('reservarBtn');
    if (reservarBtn) {
        reservarBtn.onclick = typeof window.resvValidarYConf === 'function'
            ? window.resvValidarYConf
            : crearReserva;
    }
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
// ============================================================
async function crearReserva() {
    var fechaInicioEl  = document.getElementById('fechaInicio');
    var fechaFinEl     = document.getElementById('fechaFin');
    var vehiculoSelect = document.getElementById('vehiculoSelect');

    var fechaInicio = fechaInicioEl  ? fechaInicioEl.value  : '';
    var fechaFin    = fechaFinEl     ? fechaFinEl.value      : '';
    var vehiculoId  = vehiculoSelect ? vehiculoSelect.value  : '';

    if (!fechaInicio || !fechaFin) {
        showWarning('Selecciona las fechas de inicio y fin');
        return;
    }
    if (!vehiculoId) {
        showWarning('Selecciona un vehículo');
        return;
    }
    if (new Date(fechaFin) <= new Date(fechaInicio)) {
        showWarning('La fecha de fin debe ser posterior a la de inicio');
        return;
    }

    if (fechaInicio.length === 16) { fechaInicio = fechaInicio + ':00'; }
    if (fechaFin.length    === 16) { fechaFin    = fechaFin    + ':00'; }

    var reservarBtn = document.getElementById('reservarBtn');
    if (reservarBtn) { reservarBtn.disabled = true; reservarBtn.textContent = 'Verificando...'; }

    try {
        var params = new URLSearchParams({
            sedeId:      sedeSeleccionada.idSede,
            fechaInicio: fechaInicio,
            fechaFin:    fechaFin
        });

        var cuposRes = await fetch('/api/cupos/disponibles?' + params.toString());

        if (cuposRes.status === 403) {
            showError('Sin permisos para consultar disponibilidad. Verifica que tu sesión esté activa.');
            return;
        }
        if (!cuposRes.ok) {
            var cuposErrMsg = 'No se pudo consultar disponibilidad';
            try {
                var cuposErr = await cuposRes.json();
                if (cuposErr && cuposErr.message) { cuposErrMsg = cuposErr.message; }
            } catch (e) { /* no era JSON */ }
            showWarning(cuposErrMsg);
            return;
        }

        var cupos = await cuposRes.json();
        if (!cupos || cupos.length === 0) {
            showWarning('No hay cupos disponibles en ese horario. Intenta con otro rango de tiempo.');
            return;
        }

        var cupoDisponible = cupos[0];

        var reservaData = {
            cupoId:      cupoDisponible.idCupo,
            vehiculoId:  parseInt(vehiculoId),
            fechaInicio: fechaInicio,
            fechaFin:    fechaFin
        };

        if (reservarBtn) { reservarBtn.textContent = 'Creando reserva...'; }

        var response = await fetch('/api/reservaciones', {
            method:  'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, getCsrfHeaders()),
            body:    JSON.stringify(reservaData)
        });

        var data = {};
        try { data = await response.json(); } catch (e) {}

        if (response.ok) {
            // FIX: cerrar el modal PRIMERO, antes de cargarReservas()
            // para que no dependa de que la recarga sea exitosa
            cerrarReservaModal();
            showSuccess(data.message || '¡Reserva creada! Está pendiente de aprobación.');
            cargarReservas();
        } else if (response.status === 403) {
            showError('Sin permisos para crear la reserva. Verifica que tu sesión esté activa.');
        } else if (response.status === 409) {
            showWarning(data.message || 'Conflicto de horario — el cupo ya fue reservado.');
        } else {
            showError(data.message || 'Error al crear la reserva (status ' + response.status + ')');
        }

    } catch (error) {
        console.error('[ReservaFlow] excepción:', error);
        showError('Error de conexión al crear la reserva');
    } finally {
        if (reservarBtn) {
            reservarBtn.disabled    = false;
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
// KPIs
// ============================================================
function actualizarKPIsReservas(reservas) {
    var activas = (reservas || []).filter(function(r) { return r.estado === 'ACTIVA'; }).length;
    var total   = (reservas || []).length;
    var elA = document.getElementById('kpiReservasActivas');
    var elT = document.getElementById('kpiReservasTotal');
    if (elA) { elA.textContent = activas; }
    if (elT) { elT.textContent = total;   }
}

function actualizarKPISedes() {
    var el = document.getElementById('kpiSedes');
    if (!el) { return; }
    var n = (window.sedesData && window.sedesData.length)
        ? window.sedesData.length : (sedes.length || '—');
    el.textContent = n;
}

function actualizarKPIUltimoPago(pagos) {
    var el = document.getElementById('kpiUltimoPago');
    if (!el) { return; }
    var pagados = (pagos || []).filter(function(p) { return p.estado === 'PAGADO'; });
    if (pagados.length === 0) { el.textContent = '$0'; return; }
    pagados.sort(function(a, b) { return new Date(b.fechaPago) - new Date(a.fechaPago); });
    var u = pagados[0];
    el.textContent = u && u.monto ? '$' + Number(u.monto).toLocaleString('es-CO') : '—';
}


// ============================================================
// ACTIVIDAD RECIENTE
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
            '          d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' +
            'No hay actividad reciente</li>';
        return;
    }

    var ordenadas = reservas.slice().sort(function(a, b) {
        return new Date(b.fechaInicio) - new Date(a.fechaInicio);
    });

    var labels = { activa:'Activa', pendiente:'Pendiente', completada:'Completada', cancelada:'Cancelada' };

    ul.innerHTML = ordenadas.slice(0, 5).map(function(r) {
        var fecha  = new Date(r.fechaInicio);
        var sede   = (r.cupo && r.cupo.sede && r.cupo.sede.nombre) ? r.cupo.sede.nombre : 'Sede';
        var estado = r.estado ? r.estado.toLowerCase() : 'finalizada';
        return '<li class="cli-activity-item">' +
            '<div class="cli-activity-dot ' + estado + '"></div>' +
            '<div class="cli-activity-info">' +
            '<div class="cli-activity-sede">' + sede + '</div>' +
            '<div class="cli-activity-fecha">' +
            fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) +
            '</div></div>' +
            '<div class="cli-activity-estado">' + (labels[estado] || estado) + '</div>' +
            '</li>';
    }).join('');
}


// ============================================================
// ESTADO ACTUAL
// ============================================================
function actualizarEstadoActual(reservas) {
    var contenedor = document.getElementById('statusReservaContent');
    if (!contenedor) { return; }

    var activa = (reservas || []).find(function(r) { return r.estado === 'ACTIVA'; });

    if (!activa) {
        contenedor.innerHTML =
            '<div class="cli-status-empty">' +
            '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"' +
            '     stroke-width="1.5" stroke="currentColor" style="width:36px;height:36px;opacity:.35;">' +
            '    <path stroke-linecap="round" stroke-linejoin="round"' +
            '          d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25' +
            '          2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021' +
            '          18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0021 11.25v7.5"/>' +
            '</svg>' +
            '<p>No tienes reservas activas</p>' +
            '<button class="cli-btn-sm-purple" onclick="irAlMapa()">Hacer una reserva</button>' +
            '</div>';
        return;
    }

    var fechaInicio = new Date(activa.fechaInicio);
    var fechaFin    = new Date(activa.fechaFin);
    var sede        = (activa.cupo && activa.cupo.sede && activa.cupo.sede.nombre)
        ? activa.cupo.sede.nombre : 'Sede';
    var opts = { hour: '2-digit', minute: '2-digit' };

    contenedor.innerHTML =
        '<div class="cli-status-activa">' +
        '<div class="cli-status-activa-label">Reserva activa</div>' +
        '<div class="cli-status-activa-sede">' + sede + '</div>' +
        '<div class="cli-status-activa-tiempo">' +
        fechaInicio.toLocaleTimeString('es-CO', opts) +
        ' → ' + fechaFin.toLocaleTimeString('es-CO', opts) +
        ' &nbsp;·&nbsp; ' +
        fechaInicio.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) +
        '</div></div>';
}


// ============================================================
// BADGE CONTADOR
// ============================================================
function actualizarBadgeCount(elementId, count) {
    var el = document.getElementById(elementId);
    if (el) { el.textContent = count || 0; }
}


// ============================================================
// RESUMEN DE PAGOS
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
// FILTROS — RESERVAS
// ============================================================
function filtrarReservas() {
    if (!_cacheReservas.length) { return; }

    var estado = (document.getElementById('filtroEstadoReserva')     || {}).value || '';
    var desde  = (document.getElementById('filtroFechaDesdeReserva') || {}).value || '';
    var hasta  = (document.getElementById('filtroFechaHastaReserva') || {}).value || '';

    var filtradas = _cacheReservas.filter(function(r) {
        if (estado && r.estado !== estado) { return false; }
        if (desde || hasta) {
            var f = new Date(r.fechaInicio);
            if (desde && f < new Date(desde + 'T00:00:00')) { return false; }
            if (hasta && f > new Date(hasta + 'T23:59:59')) { return false; }
        }
        return true;
    });

    var emptyState = document.getElementById('reservasEmptyState');
    if ((estado || desde || hasta) && filtradas.length === 0 && _cacheReservas.length > 0) {
        var tb = document.getElementById('reservasTableBody');
        if (tb) { tb.innerHTML = ''; }
        if (emptyState) { emptyState.classList.remove('hidden'); }
        return;
    }
    if (emptyState) { emptyState.classList.add('hidden'); }
    actualizarTablaReservas(filtradas);
}

function limpiarFiltrosReservas() {
    ['filtroEstadoReserva', 'filtroFechaDesdeReserva', 'filtroFechaHastaReserva']
        .forEach(function(id) { var el = document.getElementById(id); if (el) { el.value = ''; } });
    if (_dpDesdeReserva) { _dpDesdeReserva.limpiar(); }
    if (_dpHastaReserva) { _dpHastaReserva.limpiar(); }
    var es = document.getElementById('reservasEmptyState');
    if (es) { es.classList.add('hidden'); }
    actualizarTablaReservas(_cacheReservas);
}


// ============================================================
// FILTROS — PAGOS
// ============================================================
function filtrarPagos() {
    if (!_cachePagos.length) { return; }

    var estado = (document.getElementById('filtroEstadoPago')     || {}).value || '';
    var desde  = (document.getElementById('filtroFechaDesdePago') || {}).value || '';
    var hasta  = (document.getElementById('filtroFechaHastaPago') || {}).value || '';

    var filtrados = _cachePagos.filter(function(p) {
        if (estado && p.estado !== estado) { return false; }
        if (desde || hasta) {
            var f = new Date(p.fechaPago);
            if (desde && f < new Date(desde + 'T00:00:00')) { return false; }
            if (hasta && f > new Date(hasta + 'T23:59:59')) { return false; }
        }
        return true;
    });

    var emptyState = document.getElementById('pagosEmptyState');
    if ((estado || desde || hasta) && filtrados.length === 0 && _cachePagos.length > 0) {
        var tb = document.getElementById('pagosTableBody');
        if (tb) { tb.innerHTML = ''; }
        if (emptyState) { emptyState.classList.remove('hidden'); }
        return;
    }
    if (emptyState) { emptyState.classList.add('hidden'); }
    actualizarTablaPagos(filtrados);
}

function limpiarFiltrosPagos() {
    ['filtroEstadoPago', 'filtroFechaDesdePago', 'filtroFechaHastaPago']
        .forEach(function(id) { var el = document.getElementById(id); if (el) { el.value = ''; } });
    if (_dpDesdePago) { _dpDesdePago.limpiar(); }
    if (_dpHastaPago) { _dpHastaPago.limpiar(); }
    var es = document.getElementById('pagosEmptyState');
    if (es) { es.classList.add('hidden'); }
    actualizarTablaPagos(_cachePagos);
}


// ============================================================
// CONFIGURACIÓN — Cargar datos
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
// CONFIGURACIÓN — Guardar perfil
// ============================================================
async function guardarPerfil() {
    var nombre = (document.getElementById('configNombre')   || {}).value || '';
    var tel    = (document.getElementById('configTelefono') || {}).value || '';
    var btn    = document.getElementById('btnGuardarPerfil');
    var msg    = document.getElementById('msgPerfil');

    if (!nombre.trim()) { mostrarConfigMsg(msg, 'El nombre no puede estar vacío', 'error'); return; }

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
            ['sidebarAvatarInitial','heroAvatarInitial','headerAvatarInitial','dropdownAvatarInitial']
                .forEach(function(id) {
                    var el = document.getElementById(id); if (el) { el.textContent = inicial; }
                });
            var h = document.getElementById('heroWelcomeTitle');
            if (h) { h.textContent = 'Bienvenido, ' + nom; }
        } else {
            mostrarConfigMsg(msg, data.message || 'Error al actualizar el perfil', 'error');
        }
    } catch (e) {
        mostrarConfigMsg(msg, 'Error de conexión', 'error');
    } finally {
        if (btn) {
            btn.disabled  = false;
            btn.innerHTML =
                '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"' +
                '     stroke-width="2" stroke="currentColor" style="width:15px;height:15px;">' +
                '    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>' +
                '</svg> Guardar cambios';
        }
    }
}


// ============================================================
// CONFIGURACIÓN — Cambiar contraseña
// ============================================================
async function cambiarContrasena() {
    var actual   = (document.getElementById('configPassActual')  || {}).value || '';
    var nueva    = (document.getElementById('configPassNueva')   || {}).value || '';
    var confirma = (document.getElementById('configPassConfirm') || {}).value || '';
    var btn      = document.getElementById('btnCambiarPass');
    var msg      = document.getElementById('msgContrasena');

    if (!actual || !nueva || !confirma) { mostrarConfigMsg(msg, 'Completa todos los campos', 'error'); return; }
    if (nueva.length < 8)               { mostrarConfigMsg(msg, 'La contraseña debe tener al menos 8 caracteres', 'error'); return; }
    if (nueva !== confirma)             { mostrarConfigMsg(msg, 'Las contraseñas no coinciden', 'error'); return; }

    if (btn) { btn.disabled = true; btn.textContent = 'Actualizando...'; }

    try {
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
            var sb = document.getElementById('passStrengthBar');
            if (sb) { sb.classList.add('hidden'); }
        } else {
            mostrarConfigMsg(msg, data.message || 'Error al actualizar la contraseña', 'error');
        }
    } catch (e) {
        mostrarConfigMsg(msg, 'Error de conexión', 'error');
    } finally {
        if (btn) {
            btn.disabled  = false;
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
// TOGGLE VISIBILIDAD CONTRASEÑA
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
// INDICADOR DE FORTALEZA DE CONTRASEÑA
// ============================================================
function evaluarFortalezaPass(valor) {
    var barra = document.getElementById('passStrengthBar');
    var fill  = document.getElementById('passStrengthFill');
    var label = document.getElementById('passStrengthLabel');
    if (!barra || !fill || !label) { return; }

    if (!valor || valor.length === 0) { barra.classList.add('hidden'); return; }
    barra.classList.remove('hidden');

    var puntos = 0;
    if (valor.length >= 8)          { puntos++; }
    if (valor.length >= 12)         { puntos++; }
    if (/[A-Z]/.test(valor))        { puntos++; }
    if (/[0-9]/.test(valor))        { puntos++; }
    if (/[^A-Za-z0-9]/.test(valor)) { puntos++; }

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
// FAQ — ACORDEÓN
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
window.irAlMapa               = irAlMapa;
window.filtrarReservas        = filtrarReservas;
window.limpiarFiltrosReservas = limpiarFiltrosReservas;
window.filtrarPagos           = filtrarPagos;
window.limpiarFiltrosPagos    = limpiarFiltrosPagos;
window.guardarPerfil          = guardarPerfil;
window.cambiarContrasena      = cambiarContrasena;
window.togglePassword         = togglePassword;
window.evaluarFortalezaPass   = evaluarFortalezaPass;
window.toggleFaq              = toggleFaq;