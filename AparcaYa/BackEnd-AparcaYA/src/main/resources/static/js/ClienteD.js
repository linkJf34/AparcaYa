// ============================================
// CLIENTED.JS — AparcaYA
// Ruta: /js/ClienteD.js
//
// ✅ FIX C-01: userId eliminado del body de reserva.
// ✅ FIX C-03: cancelarReserva() lee data.message del backend.
// ✅ FIX C-04: alert()/confirm() reemplazados por toasts y modal.
// ✅ FIX JS:   crearReserva() envía vehiculoId en lugar de placa.
// ✅ FIX LAYOUT: sidebar colapsable, handleLogout con POST /logout.
// ✅ CLI-J03: crearReserva() verifica cuposRes.ok antes de parsear JSON.
// ============================================


// ============================================
// VARIABLES GLOBALES
// ============================================
var map = null;
var marcadores = [];
var sedes = [];
var sedeSeleccionada = null;

if (typeof window.sedesData !== 'undefined') {
    sedes = window.sedesData || [];
}


// ============================================
// COORDENADAS POR BARRIO
// ============================================
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


// ============================================
// SISTEMA DE NOTIFICACIONES
// ============================================
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


// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    inicializarNavegacion();
    inicializarPerfilMenu();
    cargarDatosUsuario();
    cargarReservas();
    cargarSedesYMapa();
    inicializarBusquedaMapa();
    cargarPagos();
});


// ============================================
// NAVEGACIÓN
// ============================================
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

            if (targetTab === 'perfil' && map) {
                setTimeout(function() { map.invalidateSize(); }, 100);
            }
        });
    });
}

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


// ============================================
// LOGOUT
// ============================================
async function handleLogout() {
    var ok = await showConfirm(
        'Cerrar sesión',
        '¿Estás seguro de que deseas cerrar sesión?',
        'Cerrar sesión',
        'danger'
    );
    if (!ok) { return; }

    try {
        var csrfMeta   = document.querySelector('meta[name="_csrf"]');
        var csrfHMeta  = document.querySelector('meta[name="_csrf_header"]');
        var csrfToken  = csrfMeta  ? csrfMeta.getAttribute('content')  : null;
        var csrfHeader = csrfHMeta ? csrfHMeta.getAttribute('content') : null;
        var headers    = { 'Content-Type': 'application/x-www-form-urlencoded' };
        if (csrfToken && csrfHeader) { headers[csrfHeader] = csrfToken; }
        await fetch('/logout', { method: 'POST', headers: headers, credentials: 'same-origin' });
    } catch (e) { /* Si falla el fetch, redirigimos igual */ }

    window.location.href = '/login';
}


// ============================================
// DATOS DEL USUARIO
// ============================================
async function cargarDatosUsuario() {
    try {
        var response = await fetch('/cliente/perfil');
        if (response.ok) {
            var usuario = await response.json();
            var welcomeH2 = document.querySelector('.cli-welcome-section h2');
            if (welcomeH2 && usuario && usuario.nombre) {
                welcomeH2.textContent = 'Bienvenido, ' + usuario.nombre;
            }
            var usernameEl = document.getElementById('sidebarUsername');
            var avatarEl   = document.getElementById('sidebarAvatarInitial');
            if (usernameEl && usuario && usuario.nombre) {
                usernameEl.textContent = usuario.nombre;
            }
            if (avatarEl && usuario && usuario.nombre) {
                avatarEl.textContent = usuario.nombre.charAt(0).toUpperCase();
            }
        }
    } catch (error) {
        console.error('Error cargando datos del usuario:', error);
    }
}


// ============================================
// RESERVAS
// ============================================
async function cargarReservas() {
    try {
        var response = await fetch('/cliente/reservas');
        if (response.ok) {
            var reservas = await response.json();
            actualizarTablaReservas(reservas);
            actualizarContadorReservas(reservas);
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
        // ✅ CLI-C01: el backend ya garantiza cupo.sede.nombre en la proyección.
        //            El guard defensivo se mantiene por robustez.
        var nombreSede = (reserva.cupo && reserva.cupo.sede && reserva.cupo.sede.nombre)
            ? reserva.cupo.sede.nombre : 'Sede desconocida';

        var estadoBadges = {
            ACTIVA:     '<span style="background:#22c55e;color:white;padding:3px 10px;border-radius:12px;font-size:0.8rem;font-weight:600;">✓ Activa</span>',
            PENDIENTE:  '<span style="background:#f59e0b;color:white;padding:3px 10px;border-radius:12px;font-size:0.8rem;font-weight:600;">⏳ Pendiente</span>',
            FINALIZADA: '<span style="background:#64748b;color:white;padding:3px 10px;border-radius:12px;font-size:0.8rem;font-weight:600;">✓ Finalizada</span>',
            CANCELADA:  '<span style="background:#ef4444;color:white;padding:3px 10px;border-radius:12px;font-size:0.8rem;font-weight:600;">✗ Cancelada</span>',
            RECHAZADA:  '<span style="background:#dc2626;color:white;padding:3px 10px;border-radius:12px;font-size:0.8rem;font-weight:600;">✗ Rechazada</span>'
        };

        var estadoBadge = estadoBadges[reserva.estado] ||
            '<span style="background:#94a3b8;color:white;padding:3px 10px;border-radius:12px;font-size:0.8rem;">' + reserva.estado + '</span>';

        var acciones = (reserva.estado === 'ACTIVA' || reserva.estado === 'PENDIENTE')
            ? '<button onclick="cancelarReserva(' + reserva.idReserva + ')"' +
            '        style="background:#ef4444;color:white;padding:4px 12px;border:none;' +
            '               border-radius:6px;cursor:pointer;font-weight:600;font-size:0.8rem;">Cancelar</button>'
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

function actualizarContadorReservas(reservas) {
    var activas = reservas.filter(function(r) { return r.estado === 'ACTIVA'; }).length;
    var welcomeSection = document.querySelector('.cli-welcome-section');
    if (!welcomeSection) { return; }

    var contador = welcomeSection.querySelector('.reservas-contador');
    if (!contador) {
        contador = document.createElement('p');
        contador.className = 'reservas-contador';
        contador.style.cssText = 'margin-top:1rem;font-size:1rem;color:#6d28d9;font-weight:600;';
        welcomeSection.appendChild(contador);
    }
    contador.innerHTML = '🚗 Tienes <strong>' + activas + '</strong> reserva' +
        (activas !== 1 ? 's' : '') + ' activa' + (activas !== 1 ? 's' : '');
}


// ============================================
// CANCELAR RESERVA
// ============================================
async function cancelarReserva(reservaId) {
    var confirmado = await showConfirm(
        'Cancelar reserva',
        '¿Estás seguro de que deseas cancelar esta reserva? Esta acción no se puede deshacer.',
        'Cancelar reserva',
        'danger'
    );
    if (!confirmado) { return; }

    try {
        var res  = await fetch('/cliente/reservas/' + reservaId + '/cancelar', { method: 'POST' });
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


// ============================================
// MAPA
// ============================================
async function cargarSedesYMapa() {
    if (!sedes.length) {
        try {
            var response = await fetch('/cliente/sedes');
            if (response.ok) {
                sedes = await response.json();
            }
        } catch (error) {
            console.error('Error cargando sedes:', error);
        }
    }
    initMap();
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
        var coords = await geocodificarDireccion(sede.direccion, sede.localidad, sede.barrio);
        if (!coords) { continue; }

        var iconColor = sede.estado === 'ACTIVO' ? '#7c3aed' : '#dc2626';
        var customIcon = L.divIcon({
            className: 'custom-marker',
            html: '<div style="background-color:' + iconColor + ';width:32px;height:32px;' +
                '            border-radius:50% 50% 50% 0;transform:rotate(-45deg);' +
                '            border:3px solid white;box-shadow:0 4px 8px rgba(0,0,0,0.3);">' +
                '    <div style="transform:rotate(45deg);color:white;font-size:16px;' +
                '               font-weight:bold;display:flex;align-items:center;' +
                '               justify-content:center;height:100%;">P</div>' +
                '</div>',
            iconSize:    [32, 32],
            iconAnchor:  [16, 32],
            popupAnchor: [0, -32]
        });

        var marker = L.marker([coords.lat, coords.lon], { icon: customIcon }).addTo(map);

        marker.bindPopup(
            '<div style="min-width:200px;">' +
            '    <h4 style="margin:0 0 8px;font-size:1rem;font-weight:700;color:#0f172a;">' +
            '        ' + sede.nombre +
            '    </h4>' +
            '    <p style="margin:4px 0;color:#64748b;font-size:0.875rem;">📍 ' + sede.direccion + '</p>' +
            '    <p style="margin:4px 0;color:#64748b;font-size:0.875rem;">🚗 Capacidad: ' + sede.capacidad + ' vehículos</p>' +
            '    <button id="btn-sede-' + sede.idSede + '"' +
            '            style="margin-top:12px;width:100%;background:#7c3aed;color:white;' +
            '                   border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:600;"' +
            '            onmouseover="this.style.background=\'#6d28d9\'"' +
            '            onmouseout="this.style.background=\'#7c3aed\'">' +
            '        Ver detalles completos' +
            '    </button>' +
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
        // ✅ CLI-J02 (parcial): delay reducido a 300ms por sede.
        // El delay original de 1500ms causaba 15s de espera con 10 sedes.
        // 300ms es suficiente para respetar el rate-limit de Nominatim
        // cuando se usa geocodificación por coordenadas locales (sin llamada real a la API).
        await new Promise(function(resolve) { setTimeout(resolve, 300); });
    }

    if (marcadores.length > 0) {
        map.fitBounds(L.featureGroup(marcadores).getBounds().pad(0.1));
    }
}


// ============================================
// GEOCODIFICACIÓN
// ============================================
function obtenerCoordenadasPorBarrio(localidad, barrio) {
    if (!localidad || !barrio) { return null; }
    var localidadKey = localidad.toUpperCase().trim();
    var barrioNorm   = barrio.trim();

    if (COORDENADAS_BARRIOS[localidadKey]) {
        if (COORDENADAS_BARRIOS[localidadKey][barrioNorm]) {
            return COORDENADAS_BARRIOS[localidadKey][barrioNorm];
        }
        var bl = barrioNorm.toLowerCase();
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


// ============================================
// BÚSQUEDA EN MAPA
// ============================================
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


// ============================================
// MODAL DETALLES DE SEDE
// ============================================
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


// ============================================
// MODAL DE RESERVA
// ============================================
async function abrirModalReserva() {
    if (!sedeSeleccionada) { return; }

    cerrarModalSede();

    var sedeNombreEl = document.getElementById('reservaSedeNombre');
    if (sedeNombreEl) { sedeNombreEl.textContent = sedeSeleccionada.nombre; }

    var ahora = new Date();
    ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
    var fechaMin = ahora.toISOString().slice(0, 16);

    var fechaInicioEl = document.getElementById('fechaInicio');
    var fechaFinEl    = document.getElementById('fechaFin');
    if (fechaInicioEl) { fechaInicioEl.min = fechaMin; fechaInicioEl.value = ''; }
    if (fechaFinEl)    { fechaFinEl.min    = fechaMin; fechaFinEl.value    = ''; }

    await cargarVehiculosSelect();

    var modal = document.getElementById('reservaModal');
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');

    var reservarBtn = document.getElementById('reservarBtn');
    if (reservarBtn) { reservarBtn.onclick = crearReserva; }
}

// ✅ CLI-C03: ahora llama a GET /cliente/vehiculos que sí existe.
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

async function crearReserva() {
    var fechaInicioEl  = document.getElementById('fechaInicio');
    var fechaFinEl     = document.getElementById('fechaFin');
    var vehiculoSelect = document.getElementById('vehiculoSelect');

    var fechaInicio = fechaInicioEl  ? fechaInicioEl.value  : '';
    var fechaFin    = fechaFinEl     ? fechaFinEl.value      : '';
    var vehiculoId  = vehiculoSelect ? vehiculoSelect.value  : '';

    if (!fechaInicio || !fechaFin || !vehiculoId) {
        showToast('Por favor completa todos los campos', 'warning');
        return;
    }

    if (new Date(fechaFin) <= new Date(fechaInicio)) {
        showToast('La fecha de fin debe ser posterior a la de inicio', 'warning');
        return;
    }

    try {
        var cuposRes = await fetch('/api/cupos/sede/' + sedeSeleccionada.idSede);

        // ✅ CLI-J03: verificar ok antes de parsear JSON.
        // Antes: si la respuesta era 403/404 con HTML, response.json()
        //        lanzaba SyntaxError y el catch mostraba 'Error de conexión'
        //        sin indicar la causa real.
        // Ahora: se lee el mensaje del backend si es JSON, o se muestra
        //        un mensaje genérico si la respuesta es HTML de error.
        if (!cuposRes.ok) {
            var cuposErrMsg = 'No hay cupos disponibles en este momento';
            try {
                var cuposErr = await cuposRes.json();
                if (cuposErr && cuposErr.message) { cuposErrMsg = cuposErr.message; }
            } catch (e) { /* respuesta no era JSON — usar mensaje genérico */ }
            showToast(cuposErrMsg, 'warning');
            return;
        }

        var cupos = await cuposRes.json();
        var cupoDisponible = cupos.find(function(c) { return c.estado === 'DISPONIBLE'; });

        if (!cupoDisponible) {
            showToast('No hay cupos disponibles en este momento', 'warning');
            return;
        }

        // FIX C-01: cliente no se envía en el body.
        // FIX JS:   vehiculoId en lugar de placa.
        var reservaData = {
            cupoId:      cupoDisponible.idCupo,
            vehiculoId:  parseInt(vehiculoId),
            fechaInicio: fechaInicio,
            fechaFin:    fechaFin
        };

        var response = await fetch('/api/reservaciones', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(reservaData)
        });

        if (response.ok) {
            showToast('¡Reserva creada! Está pendiente de aprobación.', 'success', 6000);
            cerrarReservaModal();
            cargarReservas();
        } else {
            var data = await response.json();
            showToast(data.message || 'Error al crear la reserva', 'error');
        }
    } catch (error) {
        console.error(error);
        showToast('Error de conexión', 'error');
    }
}


// ============================================
// PAGOS
// ============================================
async function cargarPagos() {
    try {
        var response = await fetch('/cliente/pagos');
        if (response.ok) {
            var pagos = await response.json();
            actualizarTablaPagos(pagos);
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
        var fechaPago = new Date(pago.fechaPago);

        var estadoBadges = {
            PAGADO:      '<span style="background:#22c55e;color:white;padding:3px 10px;border-radius:12px;font-size:0.8rem;font-weight:600;">✓ Pagado</span>',
            PENDIENTE:   '<span style="background:#f59e0b;color:white;padding:3px 10px;border-radius:12px;font-size:0.8rem;font-weight:600;">⏳ Pendiente</span>',
            RECHAZADO:   '<span style="background:#ef4444;color:white;padding:3px 10px;border-radius:12px;font-size:0.8rem;font-weight:600;">✗ Rechazado</span>',
            REEMBOLSADO: '<span style="background:#06b6d4;color:white;padding:3px 10px;border-radius:12px;font-size:0.8rem;font-weight:600;">↩ Reembolsado</span>'
        };

        var estadoBadge = estadoBadges[pago.estado] ||
            '<span style="background:#94a3b8;color:white;padding:3px 10px;border-radius:12px;font-size:0.8rem;">' + pago.estado + '</span>';

        // ✅ CLI-C02: el backend proyecta reservacion.idReserva directamente.
        var idReserva = (pago.reservacion && pago.reservacion.idReserva)
            ? pago.reservacion.idReserva : 'N/A';
        var monto = pago.monto ? pago.monto.toLocaleString('es-CO') : '0';

        return '<tr>' +
            '<td>' + fechaPago.toLocaleDateString('es-CO') + '</td>' +
            '<td>Reserva #' + idReserva + '</td>' +
            '<td>$' + monto + ' COP</td>' +
            '<td>' + (pago.metodoPago || 'N/A') + '</td>' +
            '<td>' + estadoBadge + '</td>' +
            '</tr>';
    }).join('');
}


// ============================================
// CERRAR MODALES CON OVERLAY O ESCAPE
// ============================================
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


// ============================================
// EXPONER FUNCIONES GLOBALES
// ============================================
window.handleLogout        = handleLogout;
window.cancelarReserva     = cancelarReserva;
window.mostrarDetallesSede = mostrarDetallesSede;
window.cerrarModalSede     = cerrarModalSede;
window.cerrarReservaModal  = cerrarReservaModal;
window.abrirModalReserva   = abrirModalReserva;