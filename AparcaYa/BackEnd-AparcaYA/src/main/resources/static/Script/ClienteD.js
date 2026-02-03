// ============================================
// VARIABLES GLOBALES
// ============================================
let map = null;
let marcadores = [];
let sedes = [];
let sedeSeleccionada = null;
let ID_USUARIO_ACTUAL;

// Obtener datos del servidor
if (typeof DATOS_SERVIDOR !== 'undefined') {
    ID_USUARIO_ACTUAL = DATOS_SERVIDOR.userId;
    sedes = DATOS_SERVIDOR.sedes || [];
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
    'USAQUEN': { lat: 4.7110, lon: -74.0300 },
    'CHAPINERO': { lat: 4.6400, lon: -74.0620 },
    'SANTA_FE': { lat: 4.6097, lon: -74.0730 },
    'SUBA': { lat: 4.7500, lon: -74.0800 },
    'KENNEDY': { lat: 4.6280, lon: -74.1550 }
};

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Iniciando aplicación cliente...');
    console.log('Sedes cargadas:', sedes.length);

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
    document.querySelectorAll('nav.sidebar-nav a').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetTab = this.getAttribute('data-tab');

            document.querySelectorAll('.content-section').forEach(section => section.classList.add('hidden'));
            document.getElementById(targetTab)?.classList.remove('hidden');

            document.querySelectorAll('nav.sidebar-nav a').forEach(l => l.classList.remove('active'));
            this.classList.add('active');

            if (targetTab === 'perfil' && map) {
                setTimeout(() => map.invalidateSize(), 100);
            }
        });
    });
}

function inicializarPerfilMenu() {
    const profileBtn = document.getElementById('profileBtn');
    const profileDropdown = document.getElementById('profileDropdown');

    if (profileBtn && profileDropdown) {
        profileBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            profileDropdown.classList.toggle('show');
        });

        document.addEventListener('click', function(e) {
            if (!profileBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
                profileDropdown.classList.remove('show');
            }
        });
    }
}

// ============================================
// CARGAR DATOS DEL USUARIO
// ============================================
async function cargarDatosUsuario() {
    try {
        const response = await fetch(`/cliente/perfil`);
        if (response.ok) {
            const usuario = await response.json();
            if (usuario) {
                const welcomeH2 = document.querySelector('.welcome-section h2');
                if (welcomeH2) {
                    welcomeH2.textContent = `Bienvenido, ${usuario.nombre || 'Usuario'}`;
                }
            }
        }
    } catch (error) {
        console.error('Error cargando datos del usuario:', error);
    }
}

// ============================================
// CARGAR RESERVAS
// ============================================
async function cargarReservas() {
    try {
        const response = await fetch(`/cliente/reservas`);
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

    tbody.innerHTML = '';

    if (reservas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No tienes reservas.</td></tr>';
        return;
    }

    reservas.forEach(reserva => {
        const row = document.createElement('tr');
        const fechaInicio = new Date(reserva.fechaInicio);
        const fechaFin = new Date(reserva.fechaFin);

        let nombreSede = 'Sede desconocida';
        if (reserva.cupo && reserva.cupo.sede) {
            nombreSede = reserva.cupo.sede.nombre;
        }

        let estadoBadge = '';
        let acciones = '';

        switch(reserva.estado) {
            case 'ACTIVA':
                estadoBadge = '<span style="background:#22c55e;color:white;padding:4px 12px;border-radius:12px;font-size:0.85rem;font-weight:600;">✓ Activa</span>';
                acciones = `<button onclick="cancelarReserva(${reserva.idReserva})" style="background:#ef4444;color:white;padding:4px 12px;border:none;border-radius:6px;cursor:pointer;">Cancelar</button>`;
                break;
            case 'PENDIENTE':
                estadoBadge = '<span style="background:#f59e0b;color:white;padding:4px 12px;border-radius:12px;font-size:0.85rem;font-weight:600;">⏳ Pendiente</span>';
                acciones = `<button onclick="cancelarReserva(${reserva.idReserva})" style="background:#ef4444;color:white;padding:4px 12px;border:none;border-radius:6px;cursor:pointer;">Cancelar</button>`;
                break;
            case 'FINALIZADA':
                estadoBadge = '<span style="background:#64748b;color:white;padding:4px 12px;border-radius:12px;font-size:0.85rem;font-weight:600;">✓ Finalizada</span>';
                acciones = '<span style="color:#64748b;">—</span>';
                break;
            case 'CANCELADA':
                estadoBadge = '<span style="background:#ef4444;color:white;padding:4px 12px;border-radius:12px;font-size:0.85rem;font-weight:600;">✗ Cancelada</span>';
                acciones = '<span style="color:#64748b;">—</span>';
                break;
            case 'RECHAZADA':
                estadoBadge = '<span style="background:#dc2626;color:white;padding:4px 12px;border-radius:12px;font-size:0.85rem;font-weight:600;">✗ Rechazada</span>';
                acciones = '<span style="color:#64748b;">—</span>';
                break;
            default:
                estadoBadge = `<span style="background:#94a3b8;color:white;padding:4px 12px;border-radius:12px;font-size:0.85rem;font-weight:600;">${reserva.estado}</span>`;
                acciones = '<span style="color:#64748b;">—</span>';
        }

        row.innerHTML = `
            <td>${fechaInicio.toLocaleDateString('es-CO')}</td>
            <td>${nombreSede}</td>
            <td>${fechaInicio.toLocaleTimeString('es-CO', {hour: '2-digit', minute: '2-digit'})}</td>
            <td>${fechaFin.toLocaleTimeString('es-CO', {hour: '2-digit', minute: '2-digit'})}</td>
            <td>${estadoBadge}</td>
            <td>${acciones}</td>
        `;
        tbody.appendChild(row);
    });
}

function actualizarContadorReservas(reservas) {
    const activas = reservas.filter(r => r.estado === 'ACTIVA').length;
    const welcomeSection = document.querySelector('.welcome-section');
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
// ============================================
function cancelarReserva(reservaId) {
    if (!confirm('¿Estás seguro de cancelar esta reserva?')) return;

    fetch(`/cliente/reservas/${reservaId}/cancelar`, { method: 'POST' })
        .then(res => {
            if (res.ok) {
                alert('Reserva cancelada exitosamente');
                cargarReservas();
            } else {
                alert('Error al cancelar la reserva');
            }
        })
        .catch(err => {
            console.error(err);
            alert('Error de conexión');
        });
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
                console.log('📍 Sedes cargadas desde API:', sedes.length);
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

    console.log('🗺️ Inicializando mapa...');
    map = L.map('map-container').setView([4.6533, -74.0836], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    agregarMarcadores();
}

async function agregarMarcadores() {
    if (!map) return;

    marcadores.forEach(m => m.remove());
    marcadores = [];

    console.log(`📌 Agregando ${sedes.length} marcadores...`);

    for (const sede of sedes) {
        const coords = await geocodificarDireccion(sede.direccion, sede.localidad, sede.barrio);

        if (coords) {
            const iconColor = sede.estado === 'ACTIVO' ? '#00BFFF' : '#dc2626';
            const customIcon = L.divIcon({
                className: 'custom-marker',
                html: `
                    <div style="
                        background-color: ${iconColor};
                        width: 32px;
                        height: 32px;
                        border-radius: 50% 50% 50% 0;
                        transform: rotate(-45deg);
                        border: 3px solid white;
                        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                    ">
                        <div style="
                            transform: rotate(45deg);
                            color: white;
                            font-size: 16px;
                            font-weight: bold;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            height: 100%;
                        ">P</div>
                    </div>
                `,
                iconSize: [32, 32],
                iconAnchor: [16, 32],
                popupAnchor: [0, -32]
            });

            const marker = L.marker([coords.lat, coords.lon], { icon: customIcon }).addTo(map);

            const popupContent = `
                <div style="min-width: 200px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 1.125rem; font-weight: 700; color: #0f172a;">
                        ${sede.nombre}
                    </h4>
                    <p style="margin: 4px 0; color: #64748b; font-size: 0.875rem;">
                        📍 ${sede.direccion}
                    </p>
                    <p style="margin: 4px 0; color: #64748b; font-size: 0.875rem;">
                        🚗 Capacidad: ${sede.capacidad} vehículos
                    </p>
                    <button
                        id="btn-sede-${sede.idSede}"
                        style="
                            margin-top: 12px;
                            width: 100%;
                            background: #00BFFF;
                            color: white;
                            border: none;
                            padding: 8px 16px;
                            border-radius: 6px;
                            cursor: pointer;
                            font-weight: 600;
                        "
                        onmouseover="this.style.background='#0284c7'"
                        onmouseout="this.style.background='#00BFFF'"
                    >
                        Ver detalles completos
                    </button>
                </div>
            `;

            marker.bindPopup(popupContent, { maxWidth: 300 });

            // Agregar evento al botón cuando se abra el popup
            marker.on('popupopen', function() {
                setTimeout(() => {
                    const btn = document.getElementById(`btn-sede-${sede.idSede}`);
                    if (btn) {
                        btn.onclick = function() {
                            mostrarDetallesSede(sede.idSede);
                        };
                    }
                }, 100);
            });

            marcadores.push(marker);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    console.log(`✅ ${marcadores.length} marcadores agregados`);

    if (marcadores.length > 0) {
        const group = L.featureGroup(marcadores);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

// ============================================
// GEOCODIFICACIÓN
// ============================================
function obtenerCoordenadasPorBarrio(localidad, barrio) {
    if (!localidad || !barrio) return null;

    const localidadKey = localidad.toUpperCase().trim();
    const barrioNormalizado = barrio.trim();

    if (COORDENADAS_BARRIOS[localidadKey]) {
        if (COORDENADAS_BARRIOS[localidadKey][barrioNormalizado]) {
            return COORDENADAS_BARRIOS[localidadKey][barrioNormalizado];
        }

        const barrioLower = barrioNormalizado.toLowerCase();
        for (const [nombreBarrio, coords] of Object.entries(COORDENADAS_BARRIOS[localidadKey])) {
            if (nombreBarrio.toLowerCase().includes(barrioLower) ||
                barrioLower.includes(nombreBarrio.toLowerCase())) {
                console.log(`📍 Match parcial: ${nombreBarrio}`);
                return coords;
            }
        }
    }

    return null;
}

function obtenerCoordenadasPorLocalidad(localidad) {
    const localidadKey = (localidad || '').toUpperCase().trim();

    if (COORDENADAS_LOCALIDADES[localidadKey]) {
        return {
            lat: COORDENADAS_LOCALIDADES[localidadKey].lat + (Math.random() - 0.5) * 0.015,
            lon: COORDENADAS_LOCALIDADES[localidadKey].lon + (Math.random() - 0.5) * 0.015
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
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');

    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', buscarDireccion);
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') buscarDireccion();
        });
    }
}

async function buscarDireccion() {
    const searchInput = document.getElementById('searchInput');
    const direccion = searchInput.value.trim();

    if (!direccion) {
        alert('Por favor, ingresa una dirección');
        return;
    }

    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion + ', Bogotá, Colombia')}&limit=1`;
        const response = await fetch(url);

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
                alert('No se encontró la dirección');
            }
        }
    } catch (error) {
        console.error('Error en búsqueda:', error);
        alert('Error al buscar la dirección');
    }
}

// ============================================
// MODAL DE DETALLES
// ============================================
function mostrarDetallesSede(sedeId) {
    console.log('Mostrando detalles de sede:', sedeId);
    const sede = sedes.find(s => s.idSede === sedeId);
    if (!sede) {
        console.error('Sede no encontrada:', sedeId);
        return;
    }

    sedeSeleccionada = sede;

    document.getElementById('modalSedeTitle').textContent = sede.nombre;

    const estadoBadge = sede.estado === 'ACTIVO'
        ? '<span class="badge badge-activo">✓ Activa</span>'
        : '<span class="badge badge-inactivo">✗ Inactiva</span>';

    document.getElementById('modalSedeBody').innerHTML = `
        <div class="info-grid">
            <div class="info-item info-full">
                <div class="info-label">Estado</div>
                <div class="info-value">${estadoBadge}</div>
            </div>
            <div class="info-item">
                <div class="info-label">🚗 Capacidad</div>
                <div class="info-value">${sede.capacidad} vehículos</div>
            </div>
            <div class="info-item">
                <div class="info-label">📍 Localidad</div>
                <div class="info-value">${sede.localidad || 'N/A'}</div>
            </div>
            <div class="info-item info-full">
                <div class="info-label">🏘️ Barrio</div>
                <div class="info-value">${sede.barrio || 'No especificado'}</div>
            </div>
            <div class="info-item info-full">
                <div class="info-label">📌 Dirección</div>
                <div class="info-value">${sede.direccion}</div>
            </div>
            <div class="info-item info-full">
                <div class="info-label">💰 Tarifas</div>
                <div class="info-value" style="line-height: 1.8;">
                    <strong>🚗 Carros:</strong><br>
                    • Hora plena: $${(sede.tarifaPlenaC || 0).toLocaleString('es-CO')} COP<br>
                    • Por minuto: $${(sede.tarifaMinutoC || 0).toLocaleString('es-CO')} COP<br>
                    <br>
                    <strong>🏍️ Motos:</strong><br>
                    • Hora plena: $${(sede.tarifaPlenaM || 0).toLocaleString('es-CO')} COP<br>
                    • Por minuto: $${(sede.tarifaMinutoM || 0).toLocaleString('es-CO')} COP
                </div>
            </div>
            <div class="info-item info-full">
                <div class="info-label">🕐 Horario</div>
                <div class="info-value">${sede.horarioSede || 'No especificado'}</div>
            </div>
        </div>
        <div style="margin-top:1.5rem;display:flex;gap:1rem;justify-content:flex-end">
            <button onclick="abrirModalReserva()" style="background:#00BFFF;color:white;padding:0.75rem 1.5rem;border:none;border-radius:0.5rem;cursor:pointer;font-weight:600">Reservar Ahora</button>
            <button onclick="cerrarModalSede()" style="background:#64748b;color:white;padding:0.75rem 1.5rem;border:none;border-radius:0.5rem;cursor:pointer;font-weight:600">Cerrar</button>
        </div>
    `;

    document.getElementById('modalSede').classList.add('show');
}

function cerrarModalSede() {
    document.getElementById('modalSede').classList.remove('show');
}

// ============================================
// MODAL DE RESERVA
// ============================================
function abrirModalReserva() {
    if (!sedeSeleccionada) return;

    cerrarModalSede();
    document.getElementById('reservaSedeNombre').textContent = sedeSeleccionada.nombre;

    const ahora = new Date();
    ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
    const fechaMin = ahora.toISOString().slice(0, 16);

    document.getElementById('fechaInicio').min = fechaMin;
    document.getElementById('fechaFin').min = fechaMin;
    document.getElementById('fechaInicio').value = '';
    document.getElementById('fechaFin').value = '';
    document.getElementById('placa').value = '';

    document.getElementById('reservaModal').classList.add('show');

    document.getElementById('reservarBtn').onclick = crearReserva;
}

function cerrarReservaModal() {
    document.getElementById('reservaModal').classList.remove('show');
}

async function crearReserva() {
    const fechaInicio = document.getElementById('fechaInicio').value;
    const fechaFin = document.getElementById('fechaFin').value;
    const placa = document.getElementById('placa').value.trim().toUpperCase();

    if (!fechaInicio || !fechaFin || !placa) {
        alert('Por favor, completa todos los campos');
        return;
    }

    if (new Date(fechaFin) <= new Date(fechaInicio)) {
        alert('La fecha de fin debe ser posterior a la de inicio');
        return;
    }

    try {
        // Obtener cupos
        const cuposRes = await fetch(`/api/cupos/sede/${sedeSeleccionada.idSede}`);
        if (!cuposRes.ok) {
            alert('No hay cupos disponibles');
            return;
        }

        const cupos = await cuposRes.json();
        if (!cupos.length) {
            alert('No hay cupos disponibles');
            return;
        }

        // Crear reserva
        const reservaData = {
            cliente: { idUsuario: ID_USUARIO_ACTUAL },
            cupoId: cupos[0].idCupo,
            placa: placa,
            fechaInicio: fechaInicio,
            fechaFin: fechaFin
        };

        const response = await fetch('/api/reservaciones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reservaData)
        });

        if (response.ok) {
            alert('¡Reserva creada exitosamente! Está pendiente de aprobación.');
            cerrarReservaModal();
            cargarReservas();
        } else {
            const error = await response.text();
            alert('Error: ' + error);
        }
    } catch (error) {
        console.error(error);
        alert('Error de conexión');
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

    tbody.innerHTML = '';

    if (pagos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No tienes pagos registrados.</td></tr>';
        return;
    }

    pagos.forEach(pago => {
        const row = document.createElement('tr');
        const fechaPago = new Date(pago.fechaPago);

        let estadoBadge = '';
        switch(pago.estado) {
            case 'PAGADO':
                estadoBadge = '<span style="background:#22c55e;color:white;padding:4px 12px;border-radius:12px;font-size:0.85rem;font-weight:600;">✓ Pagado</span>';
                break;
            case 'PENDIENTE':
                estadoBadge = '<span style="background:#f59e0b;color:white;padding:4px 12px;border-radius:12px;font-size:0.85rem;font-weight:600;">⏳ Pendiente</span>';
                break;
            case 'RECHAZADO':
                estadoBadge = '<span style="background:#ef4444;color:white;padding:4px 12px;border-radius:12px;font-size:0.85rem;font-weight:600;">✗ Rechazado</span>';
                break;
            case 'REEMBOLSADO':
                estadoBadge = '<span style="background:#06b6d4;color:white;padding:4px 12px;border-radius:12px;font-size:0.85rem;font-weight:600;">↩ Reembolsado</span>';
                break;
            default:
                estadoBadge = <span style="background:#94a3b8;color:white;padding:4px 12px;border-radius:12px;font-size:0.85rem;font-weight:600;">${pago.estado}</span>;
        }
        row.innerHTML = `
        <td>${fechaPago.toLocaleDateString('es-CO')}</td>
        <td>Reserva #${pago.reservacion.idReserva}</td>
        <td>$${pago.monto.toLocaleString('es-CO')} COP</td>
        <td>${pago.metodoPago || 'N/A'}</td>
        <td>${estadoBadge}</td>
    `;
        tbody.appendChild(row);
    });
}
// Cerrar modales al hacer clic fuera
document.addEventListener('click', (e) => {
    if (e.target.id === 'modalSede') cerrarModalSede();
    if (e.target.id === 'reservaModal') cerrarReservaModal();
});