// ============================================
// CLIENTED.JS — AparcaYA
// Ruta: /js/ClienteD.js
//
// CAMBIOS APLICADOS:
// ✅ FIX C-01: userId eliminado de sessionStorage — ya no se usa
//             para construir el body de la reserva. El backend
//             obtiene el usuario autenticado de SecurityContextHolder.
// ✅ FIX C-03: cancelarReserva() lee data.message del backend
//             en lugar de mostrar string hardcodeado.
// ✅ FIX C-04: 11 alert()/confirm() reemplazados por toasts y
//             modal de confirmación (mismo sistema que AdminD.js).
// ✅ FIX JS:   crearReserva() envía vehiculoId en lugar de placa.
//             La placa está en Vehiculo, no en Reservacion/Cupo.
//             El modal ahora tiene un select de vehículos del cliente.
// ============================================

// ============================================
// VARIABLES GLOBALES
// ============================================
let map = null;
let marcadores = [];
let sedes = [];
let sedeSeleccionada = null;

// ✅ FIX C-01: ID_USUARIO_ACTUAL eliminado.
// Ya no se envía en el body — el backend lo lee de SecurityContextHolder.
// window.userId sigue disponible si se necesita para display (nombre, etc.)

if (typeof window.sedesData !== 'undefined') {
    sedes = window.sedesData || [];
}

// ============================================
// COORDENADAS POR BARRIO
// ============================================
const COORDENADAS_BARRIOS = {
    'USAQUEN': {
        'Cedritos': { lat: 4.71908, lon: -74.03555 },
        'Molinos Norte': { lat: 4.69081, lon: -74.04020 },
        'La Calleja': { lat: 4.70788, lon: -74.04912 },
        'Barrancas': { lat: 4.73486, lon: -74.02579 },
        'Santa Bárbara': { lat: 4.70209, lon: -74.03919 },
        'Santa Bárbara Central': { lat: 4.70209, lon: -74.03919 },
        'Usaquén': { lat: 4.70500, lon: -74.03500 }
    },
    'CHAPINERO': {
        'Antiguo Country': { lat: 4.67168, lon: -74.05732 },
        'El Chicó': { lat: 4.67376, lon: -74.05172 },
        'Chicó': { lat: 4.67376, lon: -74.05172 },
        'Los Rosales': { lat: 4.65978, lon: -74.04829 },
        'Rosales': { lat: 4.65978, lon: -74.04829 },
        'La Cabrera': { lat: 4.66918, lon: -74.05016 },
        'El Retiro': { lat: 4.66670, lon: -74.05164 },
        'Lago Gaitán': { lat: 4.66607, lon: -74.05877 },
        'El Lago': { lat: 4.66607, lon: -74.05877 },
        'Chicó Reservado': { lat: 4.67915, lon: -74.04257 },
        'Chicó Norte III Sector': { lat: 4.68316, lon: -74.05361 },
        'Chapinero Alto': { lat: 4.65000, lon: -74.05500 }
    },
    'SANTA_FE': {
        'Las Aguas': { lat: 4.60395, lon: -74.06942 },
        'La Perseverancia': { lat: 4.61348, lon: -74.06741 },
        'San Diego': { lat: 4.61588, lon: -74.06484 }
    },
    'SUBA': {
        'Tibabuyes': { lat: 4.74512, lon: -74.07855 },
        'Niza': { lat: 4.72981, lon: -74.06324 },
        'Suba Centro': { lat: 4.74150, lon: -74.08160 },
        'La Campiña': { lat: 4.75233, lon: -74.09041 }
    },
    'KENNEDY': {
        'Tintal': { lat: 4.65380, lon: -74.15485 },
        'Timiza': { lat: 4.62518, lon: -74.14894 },
        'Mandalay': { lat: 4.64537, lon: -74.13489 },
        'Carvajal': { lat: 4.61451, lon: -74.13925 },
        'Patio Bonito': { lat: 4.62797, lon: -74.14562 }
    }
};

const COORDENADAS_LOCALIDADES = {
    'USAQUEN':   { lat: 4.7110, lon: -74.0300 },
    'CHAPINERO': { lat: 4.6400, lon: -74.0620 },
    'SANTA_FE':  { lat: 4.6097, lon: -74.0730 },
    'SUBA':      { lat: 4.7500, lon: -74.0800 },
    'KENNEDY':   { lat: 4.6280, lon: -74.1550 }
};

// ============================================
// SISTEMA DE NOTIFICACIONES
// ✅ FIX C-04: Reemplaza los 11 alert()/confirm() del código original.
// Consistente con AdminD.js y loginD.js.
// ============================================

function showToast(mensaje, tipo = 'info', duracion = 4000) {
    let contenedor = document.getElementById('toast-contenedor');
    if (!contenedor) {
        contenedor = document.createElement('div');
        contenedor.id = 'toast-contenedor';
        contenedor.style.cssText = [
            'position:fixed', 'top:1.5rem', 'right:1.5rem',
            'z-index:9999', 'display:flex', 'flex-direction:column', 'gap:0.5rem'
        ].join(';');
        document.body.appendChild(contenedor);
    }

    const palette = {
        success: 'background:#f0fdf4;border:1px solid #86efac;color:#166534',
        error:   'background:#fef2f2;border:1px solid #fca5a5;color:#991b1b',
        warning: 'background:#fffbeb;border:1px solid #fcd34d;color:#92400e',
        info:    'background:#eff6ff;border:1px solid #93c5fd;color:#1e40af'
    };
    const iconos = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

    const toast = document.createElement('div');
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    toast.style.cssText = [
        palette[tipo] || palette.info,
        'padding:0.75rem 1rem', 'border-radius:0.5rem',
        'box-shadow:0 4px 12px rgba(0,0,0,.1)', 'font-size:0.875rem',
        'display:flex', 'align-items:center', 'gap:0.5rem',
        'max-width:360px', 'transition:opacity 0.3s'
    ].join(';');
    toast.innerHTML = `<span>${iconos[tipo] || ''}</span><span>${mensaje}</span>`;
    contenedor.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 350);
    }, duracion);
}

function showConfirm(titulo, cuerpo, btnTexto = 'Confirmar', btnColor = 'danger') {
    return new Promise(resolve => {
        let overlay = document.getElementById('confirm-overlay');
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

        const btnColors = {
            danger:  'background:#dc2626;color:#fff',
            warning: 'background:#f59e0b;color:#fff'
        };

        overlay.innerHTML = `
            <div role="dialog" aria-modal="true"
                 style="background:#fff;border-radius:0.75rem;padding:2rem;max-width:420px;
                        width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3);">
                <h3 style="font-size:1.125rem;font-weight:700;color:#0f172a;margin:0 0 0.75rem;">
                    ${titulo}
                </h3>
                <p style="font-size:0.875rem;color:#64748b;margin:0 0 1.5rem;line-height:1.6;">
                    ${cuerpo}
                </p>
                <div style="display:flex;justify-content:flex-end;gap:0.75rem;">
                    <button id="confirm-cancel"
                            style="padding:0.5rem 1.25rem;border:1px solid #e2e8f0;
                                   border-radius:0.5rem;background:#fff;color:#374151;cursor:pointer;">
                        Cancelar
                    </button>
                    <button id="confirm-ok"
                            style="padding:0.5rem 1.25rem;border:none;border-radius:0.5rem;
                                   ${btnColors[btnColor] || btnColors.danger};
                                   cursor:pointer;font-weight:600;">
                        ${btnTexto}
                    </button>
                </div>
            </div>`;
        overlay.style.display = 'flex';

        document.getElementById('confirm-ok').onclick     = () => { overlay.style.display = 'none'; resolve(true);  };
        document.getElementById('confirm-cancel').onclick = () => { overlay.style.display = 'none'; resolve(false); };
    });
}

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', function () {
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
    document.querySelectorAll('.aparca-sidebar-nav a').forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const targetTab = this.getAttribute('data-tab');

            document.querySelectorAll('.aparca-content-section')
                .forEach(s => s.classList.add('hidden'));
            document.getElementById(targetTab)?.classList.remove('hidden');

            document.querySelectorAll('.aparca-sidebar-nav a')
                .forEach(l => { l.classList.remove('active'); l.removeAttribute('aria-current'); });
            this.classList.add('active');
            this.setAttribute('aria-current', 'page');

            if (targetTab === 'perfil' && map) setTimeout(() => map.invalidateSize(), 100);
        });
    });
}

function inicializarPerfilMenu() {
    const profileBtn      = document.getElementById('profileBtn');
    const profileDropdown = document.getElementById('profileDropdown');

    if (profileBtn && profileDropdown) {
        profileBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            const expanded = this.getAttribute('aria-expanded') === 'true';
            this.setAttribute('aria-expanded', !expanded);
            profileDropdown.classList.toggle('show');
        });

        document.addEventListener('click', function (e) {
            if (!profileBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
                profileDropdown.classList.remove('show');
                profileBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }
}

// ============================================
// DATOS DEL USUARIO
// ============================================
async function cargarDatosUsuario() {
    try {
        const response = await fetch('/cliente/perfil');
        if (response.ok) {
            const usuario = await response.json();
            const welcomeH2 = document.querySelector('.cli-welcome-section h2');
            if (welcomeH2 && usuario?.nombre) {
                welcomeH2.textContent = `Bienvenido, ${usuario.nombre}`;
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
        const response = await fetch('/cliente/reservas');
        if (response.ok) {
            const reservas = await response.json();
            actualizarTablaReservas(reservas);
            actualizarContadorReservas(reservas);
        }
    } catch (error) {
        console.error('Error cargando reservas:', error);
    }
}

function actualizarTablaReservas(reservas) {
    const tbody = document.querySelector('#reservasTableBody');
    if (!tbody) return;

    if (reservas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No tienes reservas.</td></tr>';
        return;
    }

    tbody.innerHTML = reservas.map(reserva => {
        const fechaInicio = new Date(reserva.fechaInicio);
        const fechaFin    = new Date(reserva.fechaFin);

        const nombreSede = reserva.cupo?.sede?.nombre || 'Sede desconocida';

        const estadoBadges = {
            ACTIVA:     '<span style="background:#22c55e;color:white;padding:4px 12px;border-radius:12px;font-size:0.85rem;font-weight:600;">✓ Activa</span>',
            PENDIENTE:  '<span style="background:#f59e0b;color:white;padding:4px 12px;border-radius:12px;font-size:0.85rem;font-weight:600;">⏳ Pendiente</span>',
            FINALIZADA: '<span style="background:#64748b;color:white;padding:4px 12px;border-radius:12px;font-size:0.85rem;font-weight:600;">✓ Finalizada</span>',
            CANCELADA:  '<span style="background:#ef4444;color:white;padding:4px 12px;border-radius:12px;font-size:0.85rem;font-weight:600;">✗ Cancelada</span>',
            RECHAZADA:  '<span style="background:#dc2626;color:white;padding:4px 12px;border-radius:12px;font-size:0.85rem;font-weight:600;">✗ Rechazada</span>'
        };

        const estadoBadge = estadoBadges[reserva.estado] ||
            `<span style="background:#94a3b8;color:white;padding:4px 12px;border-radius:12px;font-size:0.85rem;">${reserva.estado}</span>`;

        const acciones = (reserva.estado === 'ACTIVA' || reserva.estado === 'PENDIENTE')
            ? `<button onclick="cancelarReserva(${reserva.idReserva})"
                       style="background:#ef4444;color:white;padding:4px 12px;border:none;
                              border-radius:6px;cursor:pointer;">Cancelar</button>`
            : '<span style="color:#64748b;">—</span>';

        return `<tr>
            <td>${fechaInicio.toLocaleDateString('es-CO')}</td>
            <td>${nombreSede}</td>
            <td>${fechaInicio.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</td>
            <td>${fechaFin.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</td>
            <td>${estadoBadge}</td>
            <td>${acciones}</td>
        </tr>`;
    }).join('');
}

function actualizarContadorReservas(reservas) {
    const activas = reservas.filter(r => r.estado === 'ACTIVA').length;
    const welcomeSection = document.querySelector('.cli-welcome-section');
    if (!welcomeSection) return;

    let contador = welcomeSection.querySelector('.reservas-contador');
    if (!contador) {
        contador = document.createElement('p');
        contador.className = 'reservas-contador';
        contador.style.cssText = 'margin-top:1rem;font-size:1.125rem;color:#0369a1;font-weight:600;';
        welcomeSection.appendChild(contador);
    }
    contador.innerHTML = `🚗 Tienes <strong>${activas}</strong> reserva${activas !== 1 ? 's' : ''} activa${activas !== 1 ? 's' : ''}`;
}

// ============================================
// CANCELAR RESERVA
//
// ✅ FIX C-03: Lee data.message del backend para mostrar el motivo real.
// ✅ FIX C-04: confirm() nativo reemplazado por modal de confirmación.
// ============================================
async function cancelarReserva(reservaId) {
    const confirmado = await showConfirm(
        'Cancelar reserva',
        '¿Estás seguro de que deseas cancelar esta reserva?<br>Esta acción no se puede deshacer.',
        'Cancelar reserva',
        'danger'
    );
    if (!confirmado) return;

    try {
        const res  = await fetch(`/cliente/reservas/${reservaId}/cancelar`, { method: 'POST' });
        const data = await res.json();

        if (res.ok && data.success) {
            showToast(data.message || 'Reserva cancelada correctamente', 'success');
            cargarReservas();
        } else {
            // ✅ FIX C-03: muestra el motivo real del backend
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
            const response = await fetch('/cliente/sedes');
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
    const mapContainer = document.getElementById('map-container');
    if (!mapContainer || map) return;

    map = L.map('map-container').setView([4.6533, -74.0836], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors', maxZoom: 19
    }).addTo(map);

    agregarMarcadores();
}

async function agregarMarcadores() {
    if (!map) return;
    marcadores.forEach(m => m.remove());
    marcadores = [];

    for (const sede of sedes) {
        const coords = await geocodificarDireccion(sede.direccion, sede.localidad, sede.barrio);
        if (!coords) continue;

        const iconColor = sede.estado === 'ACTIVO' ? '#00BFFF' : '#dc2626';
        const customIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background-color:${iconColor};width:32px;height:32px;
                        border-radius:50% 50% 50% 0;transform:rotate(-45deg);
                        border:3px solid white;box-shadow:0 4px 8px rgba(0,0,0,0.3);">
                       <div style="transform:rotate(45deg);color:white;font-size:16px;
                                   font-weight:bold;display:flex;align-items:center;
                                   justify-content:center;height:100%;">P</div>
                   </div>`,
            iconSize: [32,32], iconAnchor: [16,32], popupAnchor: [0,-32]
        });

        const marker = L.marker([coords.lat, coords.lon], { icon: customIcon }).addTo(map);

        marker.bindPopup(`
            <div style="min-width:200px;">
                <h4 style="margin:0 0 8px;font-size:1.125rem;font-weight:700;color:#0f172a;">
                    ${sede.nombre}
                </h4>
                <p style="margin:4px 0;color:#64748b;font-size:0.875rem;">📍 ${sede.direccion}</p>
                <p style="margin:4px 0;color:#64748b;font-size:0.875rem;">🚗 Capacidad: ${sede.capacidad} vehículos</p>
                <button id="btn-sede-${sede.idSede}"
                        style="margin-top:12px;width:100%;background:#00BFFF;color:white;
                               border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:600;"
                        onmouseover="this.style.background='#0284c7'"
                        onmouseout="this.style.background='#00BFFF'">
                    Ver detalles completos
                </button>
            </div>`, { maxWidth: 300 });

        marker.on('popupopen', function () {
            setTimeout(() => {
                const btn = document.getElementById(`btn-sede-${sede.idSede}`);
                if (btn) btn.onclick = () => mostrarDetallesSede(sede.idSede);
            }, 100);
        });

        marcadores.push(marker);
        await new Promise(resolve => setTimeout(resolve, 1500));
    }

    if (marcadores.length > 0) {
        map.fitBounds(L.featureGroup(marcadores).getBounds().pad(0.1));
    }
}

// ============================================
// GEOCODIFICACIÓN
// ============================================
function obtenerCoordenadasPorBarrio(localidad, barrio) {
    if (!localidad || !barrio) return null;
    const localidadKey = localidad.toUpperCase().trim();
    const barrioNorm   = barrio.trim();

    if (COORDENADAS_BARRIOS[localidadKey]) {
        if (COORDENADAS_BARRIOS[localidadKey][barrioNorm]) return COORDENADAS_BARRIOS[localidadKey][barrioNorm];
        const bl = barrioNorm.toLowerCase();
        for (const [nb, coords] of Object.entries(COORDENADAS_BARRIOS[localidadKey])) {
            if (nb.toLowerCase().includes(bl) || bl.includes(nb.toLowerCase())) return coords;
        }
    }
    return null;
}

function obtenerCoordenadasPorLocalidad(localidad) {
    const key = (localidad || '').toUpperCase().trim();
    if (COORDENADAS_LOCALIDADES[key]) {
        return {
            lat: COORDENADAS_LOCALIDADES[key].lat + (Math.random() - 0.5) * 0.015,
            lon: COORDENADAS_LOCALIDADES[key].lon + (Math.random() - 0.5) * 0.015
        };
    }
    return { lat: 4.6533 + (Math.random() - 0.5) * 0.08, lon: -74.0836 + (Math.random() - 0.5) * 0.08 };
}

async function geocodificarDireccion(direccion, localidad, barrio) {
    const coordsBarrio = obtenerCoordenadasPorBarrio(localidad, barrio);
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
    const searchBtn   = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');

    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', buscarDireccion);
        searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') buscarDireccion(); });
    }
}

async function buscarDireccion() {
    const searchInput = document.getElementById('searchInput');
    const direccion   = searchInput.value.trim();

    if (!direccion) {
        showToast('Por favor ingresa una dirección', 'warning');
        return;
    }

    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json` +
            `&q=${encodeURIComponent(direccion + ', Bogotá, Colombia')}&limit=1`;

        const response = await fetch(url, { headers: { 'User-Agent': 'AparcaYA/1.0' } });

        if (response.ok) {
            const data = await response.json();
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                map.setView([lat, lon], 15);
                L.marker([lat, lon]).addTo(map)
                    .bindPopup(`📍 ${data[0].display_name}`)
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
// MODAL DE DETALLES DE SEDE
// ============================================
function mostrarDetallesSede(sedeId) {
    const sede = sedes.find(s => s.idSede === sedeId);
    if (!sede) return;

    sedeSeleccionada = sede;
    document.getElementById('modalSedeTitle').textContent = sede.nombre;

    const estadoBadge = sede.estado === 'ACTIVO'
        ? '<span class="cli-badge cli-badge-activo">✓ Activa</span>'
        : '<span class="cli-badge cli-badge-inactivo">✗ Inactiva</span>';

    document.getElementById('modalSedeBody').innerHTML = `
        <div class="cliente-modal-sede-grid">
            <div class="cliente-modal-sede-item cliente-modal-sede-full">
                <div class="cliente-modal-sede-label">Estado</div>
                <div class="cliente-modal-sede-value">${estadoBadge}</div>
            </div>
            <div class="cliente-modal-sede-item">
                <div class="cliente-modal-sede-label">🚗 Capacidad</div>
                <div class="cliente-modal-sede-value">${sede.capacidad} vehículos</div>
            </div>
            <div class="cliente-modal-sede-item">
                <div class="cliente-modal-sede-label">📍 Localidad</div>
                <div class="cliente-modal-sede-value">${sede.localidad || 'N/A'}</div>
            </div>
            <div class="cliente-modal-sede-item cliente-modal-sede-full">
                <div class="cliente-modal-sede-label">🏘️ Barrio</div>
                <div class="cliente-modal-sede-value">${sede.barrio || 'No especificado'}</div>
            </div>
            <div class="cliente-modal-sede-item cliente-modal-sede-full">
                <div class="cliente-modal-sede-label">📌 Dirección</div>
                <div class="cliente-modal-sede-value">${sede.direccion}</div>
            </div>
            <div class="cliente-modal-sede-item cliente-modal-sede-full">
                <div class="cliente-modal-sede-label">💰 Tarifas</div>
                <div class="cliente-modal-sede-value cliente-modal-sede-tarifas">
                    <strong>🚗 Carros:</strong>
                    • Hora plena: $${(sede.tarifaPlenaC || 0).toLocaleString('es-CO')} COP<br>
                    • Por minuto: $${(sede.tarifaMinutoC || 0).toLocaleString('es-CO')} COP<br>
                    <strong>🏍️ Motos:</strong>
                    • Hora plena: $${(sede.tarifaPlenaM || 0).toLocaleString('es-CO')} COP<br>
                    • Por minuto: $${(sede.tarifaMinutoM || 0).toLocaleString('es-CO')} COP
                </div>
            </div>
            <div class="cliente-modal-sede-item cliente-modal-sede-full">
                <div class="cliente-modal-sede-label">🕐 Horario</div>
                <div class="cliente-modal-sede-value">${sede.horarioSede || 'No especificado'}</div>
            </div>
        </div>
        <div class="cliente-modal-sede-actions">
            <button onclick="abrirModalReserva()" class="cli-btn-confirm">Reservar Ahora</button>
            <button onclick="cerrarModalSede()" class="cliente-modal-sede-btn-cerrar">Cerrar</button>
        </div>`;

    const modal = document.getElementById('modalSede');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
}

function cerrarModalSede() {
    const modal = document.getElementById('modalSede');
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
}

// ============================================
// MODAL DE RESERVA
//
// ✅ FIX JS: Reemplaza el campo "placa" (string suelto) por un select
//           de vehículos del cliente. La placa está en Vehiculo,
//           no en Reservacion ni en Cupo.
// ============================================
async function abrirModalReserva() {
    if (!sedeSeleccionada) return;

    cerrarModalSede();
    document.getElementById('reservaSedeNombre').textContent = sedeSeleccionada.nombre;

    const ahora = new Date();
    ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
    const fechaMin = ahora.toISOString().slice(0, 16);

    document.getElementById('fechaInicio').min   = fechaMin;
    document.getElementById('fechaFin').min      = fechaMin;
    document.getElementById('fechaInicio').value = '';
    document.getElementById('fechaFin').value    = '';

    // Cargar vehículos del cliente para el select
    await cargarVehiculosSelect();

    const modal = document.getElementById('reservaModal');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');

    document.getElementById('reservarBtn').onclick = crearReserva;
}

async function cargarVehiculosSelect() {
    const selectVehiculo = document.getElementById('vehiculoSelect');
    if (!selectVehiculo) return;

    selectVehiculo.innerHTML = '<option value="">Cargando vehículos...</option>';

    try {
        const response = await fetch('/cliente/vehiculos');
        if (response.ok) {
            const vehiculos = await response.json();
            if (vehiculos.length === 0) {
                selectVehiculo.innerHTML = '<option value="">No tienes vehículos registrados</option>';
            } else {
                selectVehiculo.innerHTML = '<option value="">Selecciona un vehículo</option>' +
                    vehiculos.map(v =>
                        `<option value="${v.idVehiculo}">${v.placa} — ${v.marca || ''} ${v.modelo || ''}</option>`
                    ).join('');
            }
        } else {
            selectVehiculo.innerHTML = '<option value="">Error al cargar vehículos</option>';
        }
    } catch (e) {
        selectVehiculo.innerHTML = '<option value="">Error de conexión</option>';
    }
}

function cerrarReservaModal() {
    const modal = document.getElementById('reservaModal');
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
}

async function crearReserva() {
    const fechaInicio  = document.getElementById('fechaInicio').value;
    const fechaFin     = document.getElementById('fechaFin').value;
    const vehiculoId   = document.getElementById('vehiculoSelect')?.value;

    if (!fechaInicio || !fechaFin || !vehiculoId) {
        showToast('Por favor completa todos los campos', 'warning');
        return;
    }

    if (new Date(fechaFin) <= new Date(fechaInicio)) {
        showToast('La fecha de fin debe ser posterior a la de inicio', 'warning');
        return;
    }

    try {
        // Obtener cupo disponible de la sede
        const cuposRes = await fetch(`/api/cupos/sede/${sedeSeleccionada.idSede}`);
        if (!cuposRes.ok) {
            showToast('No hay cupos disponibles', 'warning');
            return;
        }

        const cupos = await cuposRes.json();
        const cupoDisponible = cupos.find(c => c.estado === 'DISPONIBLE');

        if (!cupoDisponible) {
            showToast('No hay cupos disponibles en este momento', 'warning');
            return;
        }

        // ✅ FIX C-01: cliente no se envía en el body.
        //             El backend obtiene el usuario de SecurityContextHolder.
        // ✅ FIX JS:   vehiculoId en lugar de placa — coincide con la entidad Reservacion.
        const reservaData = {
            cupoId:      cupoDisponible.idCupo,
            vehiculoId:  parseInt(vehiculoId),
            fechaInicio: fechaInicio,
            fechaFin:    fechaFin
        };

        const response = await fetch('/api/reservaciones', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(reservaData)
        });

        if (response.ok) {
            showToast('¡Reserva creada! Está pendiente de aprobación.', 'success', 6000);
            cerrarReservaModal();
            cargarReservas();
        } else {
            const data = await response.json();
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
        const response = await fetch('/cliente/pagos');
        if (response.ok) {
            const pagos = await response.json();
            actualizarTablaPagos(pagos);
        }
    } catch (error) {
        console.error('Error cargando pagos:', error);
    }
}

function actualizarTablaPagos(pagos) {
    const tbody = document.querySelector('#pagosTableBody');
    if (!tbody) return;

    if (pagos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No tienes pagos registrados.</td></tr>';
        return;
    }

    tbody.innerHTML = pagos.map(pago => {
        const fechaPago = new Date(pago.fechaPago);

        const estadoBadges = {
            PAGADO:      '<span style="background:#22c55e;color:white;padding:4px 12px;border-radius:12px;font-size:0.85rem;font-weight:600;">✓ Pagado</span>',
            PENDIENTE:   '<span style="background:#f59e0b;color:white;padding:4px 12px;border-radius:12px;font-size:0.85rem;font-weight:600;">⏳ Pendiente</span>',
            RECHAZADO:   '<span style="background:#ef4444;color:white;padding:4px 12px;border-radius:12px;font-size:0.85rem;font-weight:600;">✗ Rechazado</span>',
            REEMBOLSADO: '<span style="background:#06b6d4;color:white;padding:4px 12px;border-radius:12px;font-size:0.85rem;font-weight:600;">↩ Reembolsado</span>'
        };

        const estadoBadge = estadoBadges[pago.estado] ||
            `<span style="background:#94a3b8;color:white;padding:4px 12px;border-radius:12px;font-size:0.85rem;">${pago.estado}</span>`;

        return `<tr>
            <td>${fechaPago.toLocaleDateString('es-CO')}</td>
            <td>Reserva #${pago.reservacion?.idReserva || 'N/A'}</td>
            <td>$${pago.monto?.toLocaleString('es-CO')} COP</td>
            <td>${pago.metodoPago || 'N/A'}</td>
            <td>${estadoBadge}</td>
        </tr>`;
    }).join('');
}

// ============================================
// CERRAR MODALES CON OVERLAY O ESCAPE
// ============================================
document.addEventListener('click', e => {
    if (e.target.id === 'modalSede')    cerrarModalSede();
    if (e.target.id === 'reservaModal') cerrarReservaModal();
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        cerrarModalSede();
        cerrarReservaModal();
    }
});

// ============================================
// EXPONER FUNCIONES GLOBALES
// ============================================
window.closeModalSede    = cerrarModalSede;
window.closeReservaModal = cerrarReservaModal;
window.cancelarReserva   = cancelarReserva;
window.mostrarDetallesSede = mostrarDetallesSede;