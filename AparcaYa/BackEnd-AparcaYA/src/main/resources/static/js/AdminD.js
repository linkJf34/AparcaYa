// ============================================
// ADMIND.JS — AparcaYA
// Ruta: /js/AdminD.js
// ============================================
// CAMBIOS v3:
//   - Gráficas: paleta mejorada, dona para usuarios, barras horiz. para sedes
//   - Gráfica nueva: Estado de Correos (dona)
//   - PDF/Excel movidos a sección de gráficas (exportarGraficaPDF / exportarGraficaCSV)
//   - Selector de plantillas de correo integrado
//   - Historial de correos con filtros integrado
//   - KPIs de correos integrados
//   - Toda la lógica de negocio existente sin modificaciones
// ============================================

// ============================================
// CONFIGURACIÓN Y VARIABLES GLOBALES
// ============================================
const API_BASE_URL = '/admin/api';

const profileBtn      = document.getElementById('profileBtn');
const profileDropdown = document.getElementById('profileDropdown');
const navLinks        = document.querySelectorAll('nav.aparca-sidebar-nav a');
const sections        = document.querySelectorAll('section.aparca-content-section');

let map        = null;
let marcadores = [];
let usuarios   = [];
let sedes      = [];

// Instancias de Chart.js — accesibles para exportación
let chartIngresos, chartUsuarios, chartSedes, chartCorreosEstado;

// Estado del módulo de correos
const EMAIL_MOD = { plantillaActiva: null, plantillaActivaMasivo: null };

// ============================================
// PALETA DE COLORES MEJORADA
// ============================================
const PALETA = {
    indigo:   '#6366f1',
    indigoA:  'rgba(99,102,241,0.82)',
    amber:    '#f59e0b',
    amberA:   'rgba(245,158,11,0.82)',
    emerald:  '#10b981',
    emeraldA: 'rgba(16,185,129,0.82)',
    sky:      '#0ea5e9',
    skyA:     'rgba(14,165,233,0.82)',
    rose:     '#f43f5e',
    roseA:    'rgba(244,63,94,0.82)',
    slate:    '#64748b',
    slateA:   'rgba(100,116,139,0.55)',
};

const ROL_CFG = {
    ADMIN:              { label: 'Admin',      color: PALETA.indigoA,  border: PALETA.indigo  },
    ADMINISTRADOR_SEDE: { label: 'Admin Sede', color: PALETA.amberA,   border: PALETA.amber   },
    OPERARIO:           { label: 'Operario',   color: PALETA.emeraldA, border: PALETA.emerald },
    CLIENTE:            { label: 'Cliente',    color: PALETA.skyA,     border: PALETA.sky     }
};

// Opciones base compartidas para Chart.js
const BASE_CHART_OPTS = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { labels: { font: { size: 12 }, padding: 14, boxWidth: 10, boxHeight: 10 } },
        tooltip: { padding: 10, cornerRadius: 6, titleFont: { size: 13 }, bodyFont: { size: 12 } }
    },
    scales: {
        x: { grid: { display: false },          ticks: { font: { size: 11 } } },
        y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 11 }, precision: 0 }, beginAtZero: true }
    }
};

// ============================================
// HELPERS — abrir/cerrar modales propios
// ============================================
function abrirModal(id) {
    var m = document.getElementById(id);
    if (!m) return;
    m.classList.add('show');
    m.setAttribute('aria-hidden', 'false');
}

function cerrarModal(id) {
    var m = document.getElementById(id);
    if (!m) return;
    m.classList.remove('show');
    m.setAttribute('aria-hidden', 'true');
}

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    cargarIndicadores();
    cargarUsuarios();
    cargarSedes();
    cargarEstadisticasDonut();
    setupMailTabs();
    inicializarSelectorPlantillas();
    cargarContadoresCorreos();
    cargarHistorialCorreos();
    vincularFiltrosHistorial();

    const formUnitario = document.getElementById('formCorreoUnitario');
    if (formUnitario) {
        formUnitario.addEventListener('submit', function(e) { e.preventDefault(); enviarCorreoUnitario(this); });
    }
    const formMasivo = document.getElementById('formCorreoMasivo');
    if (formMasivo) {
        formMasivo.addEventListener('submit', function(e) { e.preventDefault(); enviarCorreoMasivo(this); });
    }

    // Cerrar modales al hacer clic en el overlay
    ['modal_editar_usuario', 'modal_editar_sede', 'modalSede'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', function(e) {
                if (e.target === el) {
                    if (id === 'modal_editar_usuario') cerrarModalEdicion();
                    else if (id === 'modal_editar_sede') cerrarModalEdicionSede();
                    else cerrarModalSede();
                }
            });
        }
    });

    // Badge en tiempo real mientras el admin escribe manualmente
    var textarea = document.getElementById('emailsMassive');
    if (textarea) textarea.addEventListener('input', _adminActualizarBadge);

    // Filtros de gráficas
    vincularFiltrosGraficas();
});

// Escape cierra cualquier modal abierto
document.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape') return;
    cerrarModalSede();
    cerrarModalEdicion();
    cerrarModalEdicionSede();
});

// ============================================
// MENÚ PERFIL DROPDOWN
// ============================================
if (profileBtn && profileDropdown) {
    profileBtn.addEventListener('click', () => {
        const expanded = profileBtn.getAttribute('aria-expanded') === 'true';
        profileBtn.setAttribute('aria-expanded', !expanded);
        profileDropdown.classList.toggle('show');
    });
    document.addEventListener('click', e => {
        if (!profileBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
            profileDropdown.classList.remove('show');
            profileBtn.setAttribute('aria-expanded', 'false');
        }
    });
}

// ============================================
// NAVEGACIÓN SIDEBAR
// ============================================
navLinks.forEach(link => {
    link.addEventListener('click', e => {
        e.preventDefault();
        navLinks.forEach(l => { l.classList.remove('active'); l.removeAttribute('aria-current'); });
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');

        const target = link.dataset.tab;
        sections.forEach(sec => {
            if (sec.id === target) {
                sec.classList.remove('hidden');
                if (target === 'sedes'   && !map) setTimeout(initMap, 100);
                if (target === 'graficas')        setTimeout(inicializarGraficas, 100);
            } else {
                sec.classList.add('hidden');
            }
        });

        if (window.innerWidth < 640) document.body.classList.add('sidebar-collapsed');
    });
});

// ============================================
// INDICADORES
// ============================================
async function cargarIndicadores() {
    try {
        const [indResp, rolesResp] = await Promise.all([
            fetch(`${API_BASE_URL}/indicadores`),
            fetch(`${API_BASE_URL}/indicadores/ingresos-por-rol`)
        ]);
        if (!indResp.ok || !rolesResp.ok) throw new Error('Error cargando indicadores');

        const data  = await indResp.json();
        const roles = await rolesResp.json();

        actualizarIndicador(0, data.totalUsuarios, data.porcentajeUsuarios);
        actualizarIndicador(1, data.totalSedes,    data.porcentajeSedes);

        const kpiTotal   = document.getElementById('kpiUsuariosTotal');
        const kpiActivos = document.getElementById('kpiUsuariosActivos');
        const kpiSTotal  = document.getElementById('kpiSedesTotal');
        if (kpiTotal)   kpiTotal.textContent   = data.totalUsuarios;
        if (kpiActivos) kpiActivos.textContent  = data.usuariosActivos;
        if (kpiSTotal)  kpiSTotal.textContent   = data.totalSedes;

        renderIngresosPorRol(roles.porRol);
    } catch (error) {
        console.error('Error cargando indicadores:', error);
    }
}

const ROL_LABELS = {
    ADMIN:              'Admin',
    ADMINISTRADOR_SEDE: 'Admin Sede',
    OPERARIO:           'Operario',
    CLIENTE:            'Cliente'
};

const ROL_COLORS = {
    ADMIN:              '#6366f1',
    ADMINISTRADOR_SEDE: '#f59e0b',
    OPERARIO:           '#10b981',
    CLIENTE:            '#3b82f6'
};

function renderIngresosPorRol(porRol) {
    const container = document.getElementById('ingresosPorRolContainer');
    if (!container || !porRol) return;
    const total = Object.values(porRol).reduce((a, b) => a + b, 0);
    if (total === 0) {
        container.innerHTML = '<p class="admin-roles-empty">Sin usuarios registrados</p>';
        return;
    }
    container.innerHTML = Object.entries(porRol).map(([rol, cantidad]) => {
        const pct   = total > 0 ? Math.round((cantidad / total) * 100) : 0;
        const color = ROL_COLORS[rol] || '#94a3b8';
        const label = ROL_LABELS[rol] || rol;
        return `
        <div class="admin-rol-row">
            <span class="admin-rol-badge" style="background:${color}20;color:${color}">${label}</span>
            <div class="admin-rol-bar-wrap">
                <div class="admin-rol-bar" style="width:${pct}%;background:${color}"></div>
            </div>
            <span class="admin-rol-count">${cantidad}</span>
        </div>`;
    }).join('');
}

function actualizarIndicador(index, valor, porcentaje) {
    const cards = document.querySelectorAll('.admin-stats-card');
    if (!cards[index]) return;
    const textEl    = cards[index].querySelector('.admin-donut-text');
    const segmentEl = cards[index].querySelector('.admin-donut-segment');
    if (textEl)    textEl.textContent = valor;
    if (segmentEl) segmentEl.setAttribute('stroke-dasharray', `${porcentaje} 100`);
}

// ============================================
// GESTIÓN DE USUARIOS
// ============================================
async function cargarUsuarios() {
    try {
        const response = await fetch(`${API_BASE_URL}/usuarios`);
        if (!response.ok) throw new Error('Error cargando usuarios');
        usuarios = await response.json();
        renderUsuarios(usuarios);
    } catch (error) {
        console.error('Error cargando usuarios:', error);
        showToast('Error al cargar usuarios', 'error');
    }
}

function renderUsuarios(usuariosArray = usuarios) {
    const tbody = document.getElementById('tbodyUsuarios');
    if (!tbody) return;
    if (usuariosArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500">No hay usuarios registrados</td></tr>';
        return;
    }
    tbody.innerHTML = usuariosArray.map(u => {
        const usuarioId = u.id || u.idUsuario || u.usuario_id;
        if (!usuarioId) { console.error('Usuario sin ID:', u); return ''; }
        return `
        <tr>
            <td>${u.nombre   || 'N/A'}</td>
            <td>${u.correo   || 'N/A'}</td>
            <td>${u.telefono || 'N/A'}</td>
            <td>${u.rol ? (u.rol.name || u.rol) : 'N/A'}</td>
            <td>${u.estado   || 'N/A'}</td>
            <td>
                <button class="aparca-btn-outline mr-2" onclick="editarUsuario(${usuarioId})">Editar</button>
                <button class="admin-modal-sede-btn-danger" onclick="eliminarUsuario(${usuarioId})">Eliminar</button>
            </td>
        </tr>`;
    }).filter(Boolean).join('');
}

async function eliminarUsuario(id) {
    if (!id) { showToast('ID de usuario inválido', 'error'); return; }
    const usuario = usuarios.find(u => {
        const usuarioId = u.id || u.idUsuario || u.usuario_id;
        return usuarioId == id;
    });
    if (!usuario) { showToast('Usuario no encontrado', 'error'); return; }

    const confirmado = await showDeleteConfirm(usuario.nombre, 'usuario');
    if (!confirmado) return;

    try {
        const response = await fetch(`${API_BASE_URL}/usuarios/eliminar/${id}`, {
            method: 'DELETE', headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.mensaje || 'Error eliminando usuario');
        }
        const data = await response.json();
        showToast(data.mensaje || 'Usuario eliminado correctamente', 'success');
        await cargarUsuarios();
        await cargarIndicadores();
    } catch (error) {
        console.error('Error eliminando usuario:', error);
        showToast(`No se pudo eliminar el usuario: ${error.message}`, 'error');
    }
}

function editarUsuario(id) {
    const usuario = usuarios.find(u => {
        const usuarioId = u.id || u.idUsuario || u.usuario_id;
        return usuarioId == id;
    });
    if (!usuario) { showToast('Usuario no encontrado', 'error'); return; }

    document.getElementById('edit_usuario_id').value = id;
    document.getElementById('edit_nombre').value     = usuario.nombre   || '';
    document.getElementById('edit_email').value      = usuario.correo   || '';
    document.getElementById('edit_telefono').value   = usuario.telefono || '';
    document.getElementById('edit_rol').value        = usuario.rol?.name || usuario.rol || 'CLIENTE';
    document.getElementById('edit_estado').value     = (usuario.estado  || 'ACTIVO').toUpperCase();

    abrirModal('modal_editar_usuario');
}

async function guardarEdicion() {
    const id       = document.getElementById('edit_usuario_id').value;
    const nombre   = document.getElementById('edit_nombre').value.trim();
    const email    = document.getElementById('edit_email').value.trim();
    const telefono = document.getElementById('edit_telefono').value.trim();
    const rol      = document.getElementById('edit_rol').value;
    const estado   = document.getElementById('edit_estado').value;

    if (!nombre || !email || !rol) {
        showToast('Por favor completa todos los campos obligatorios', 'warning'); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('Por favor ingresa un correo válido', 'warning'); return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/usuarios/actualizar/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, correo: email, telefono: telefono || null, rol, estado })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.mensaje || `Error ${response.status}`);

        showToast(data.mensaje || 'Usuario actualizado correctamente', 'success');
        cerrarModalEdicion();
        await cargarUsuarios();
        await cargarIndicadores();
    } catch (error) {
        console.error('Error actualizando usuario:', error);
        showToast(`No se pudo actualizar el usuario: ${error.message}`, 'error');
    }
}

function cerrarModalEdicion() {
    cerrarModal('modal_editar_usuario');
    ['edit_usuario_id','edit_nombre','edit_email','edit_telefono'].forEach(id => {
        var el = document.getElementById(id); if (el) el.value = '';
    });
    var rol    = document.getElementById('edit_rol');    if (rol)    rol.value    = 'CLIENTE';
    var estado = document.getElementById('edit_estado'); if (estado) estado.value = 'ACTIVO';
}

// ============================================
// BÚSQUEDA Y FILTROS — USUARIOS
// ============================================
const busquedaInput   = document.getElementById('busquedaInput');
const filtroUnificado = document.getElementById('filtroUnificado');
if (busquedaInput)   busquedaInput.addEventListener('input',   filtrarUsuarios);
if (filtroUnificado) filtroUnificado.addEventListener('change', filtrarUsuarios);

function filtrarUsuarios() {
    const textoBusqueda      = (busquedaInput?.value || '').toLowerCase();
    const filtroSeleccionado = filtroUnificado?.value || '';

    renderUsuarios(usuarios.filter(usuario => {
        const nombre   = (usuario.nombre   || '').toLowerCase();
        const correo   = (usuario.correo   || '').toLowerCase();
        const rol      = usuario.rol ? (usuario.rol.name || usuario.rol || '').toLowerCase() : '';
        const telefono = (usuario.telefono || '').toLowerCase();
        const estado   = (usuario.estado   || '').toLowerCase();

        const coincideTexto = nombre.includes(textoBusqueda) || correo.includes(textoBusqueda) ||
            rol.includes(textoBusqueda) || telefono.includes(textoBusqueda) ||
            estado.includes(textoBusqueda);

        let coincideFiltro = true;
        if (filtroSeleccionado) {
            const [tipo, valor] = filtroSeleccionado.split(':');
            if (tipo === 'estado') coincideFiltro = estado === valor;
            else if (tipo === 'rol') coincideFiltro = rol === valor;
        }
        return coincideTexto && coincideFiltro;
    }));
}

// ============================================
// GESTIÓN DE SEDES
// ============================================
async function cargarSedes() {
    try {
        const response = await fetch(`${API_BASE_URL}/sedes`);
        if (!response.ok) throw new Error('Error cargando sedes');
        sedes = await response.json();
        renderSedes(sedes);
        if (map) agregarMarcadores();
    } catch (error) {
        console.error('Error cargando sedes:', error);
        showToast('Error al cargar sedes', 'error');
    }
}

function renderSedes(sedesArray = sedes) {
    const tbody = document.getElementById('tbodySedes');
    if (!tbody) return;
    if (sedesArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500">No hay sedes registradas</td></tr>';
        return;
    }
    tbody.innerHTML = sedesArray.map(s => `
        <tr>
            <td>${s.nombre    || 'N/A'}</td>
            <td>${s.direccion || 'N/A'}</td>
            <td>${s.capacidad || 'N/A'}</td>
            <td>${s.localidad || 'N/A'}</td>
            <td>${s.barrio    || 'N/A'}</td>
            <td>${s.estado === 'ACTIVO' ? 'Activa' : 'Inactiva'}</td>
            <td>
                <button class="aparca-btn-outline mr-2" onclick="editarSede(${s.id})">Editar</button>
                <button class="admin-modal-sede-btn-danger" onclick="eliminarSede(${s.id})">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

async function eliminarSede(id) {
    if (!id) { showToast('ID de sede inválido', 'error'); return; }
    const sede = sedes.find(s => s.id == id);
    if (!sede) { showToast('Sede no encontrada', 'error'); return; }

    const confirmado = await showDeleteConfirm(sede.nombre, 'sede');
    if (!confirmado) return;

    try {
        const response = await fetch(`${API_BASE_URL}/sedes/eliminar/${id}`, { method: 'DELETE' });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.mensaje || 'Error eliminando sede');
        }
        const data = await response.json();
        showToast(data.mensaje || 'Sede eliminada correctamente', 'success');
        await cargarSedes();
        await cargarIndicadores();
    } catch (error) {
        console.error('Error eliminando sede:', error);
        showToast(`No se pudo eliminar la sede: ${error.message}`, 'error');
    }
}

function editarSede(id) {
    const sede = sedes.find(s => s.id == id);
    if (!sede) { showToast('Sede no encontrada', 'error'); return; }

    document.getElementById('edit_sede_id').value        = id;
    document.getElementById('edit_sede_nombre').value    = sede.nombre    || '';
    document.getElementById('edit_sede_direccion').value = sede.direccion || '';
    document.getElementById('edit_sede_capacidad').value = sede.capacidad || '';
    document.getElementById('edit_sede_estado').value    = (sede.estado   || 'ACTIVO').toUpperCase();

    abrirModal('modal_editar_sede');
}

async function guardarEdicionSede() {
    const id        = document.getElementById('edit_sede_id').value;
    const nombre    = document.getElementById('edit_sede_nombre').value.trim();
    const direccion = document.getElementById('edit_sede_direccion').value.trim();
    const capacidad = parseInt(document.getElementById('edit_sede_capacidad').value);
    const estado    = document.getElementById('edit_sede_estado').value;

    if (!nombre || !direccion || !capacidad || !estado) {
        showToast('Por favor completa todos los campos obligatorios', 'warning'); return;
    }
    if (capacidad <= 0) {
        showToast('La capacidad debe ser mayor a 0', 'warning'); return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/sedes/actualizar/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, direccion, capacidad, estado })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.mensaje || `Error ${response.status}`);

        showToast(data.mensaje || 'Sede actualizada correctamente', 'success');
        cerrarModalEdicionSede();
        await cargarSedes();
        await cargarIndicadores();
    } catch (error) {
        console.error('Error actualizando sede:', error);
        showToast(`No se pudo actualizar la sede: ${error.message}`, 'error');
    }
}

function cerrarModalEdicionSede() {
    cerrarModal('modal_editar_sede');
}

// ============================================
// BÚSQUEDA Y FILTROS — SEDES
// ============================================
const busquedaSedes        = document.getElementById('busquedaSedes');
const filtroUnificadoSedes = document.getElementById('filtroUnificadoSedes');
if (busquedaSedes)        busquedaSedes.addEventListener('input',   filtrarSedes);
if (filtroUnificadoSedes) filtroUnificadoSedes.addEventListener('change', filtrarSedes);

function filtrarSedes() {
    const textoBusqueda      = (busquedaSedes?.value || '').toLowerCase();
    const filtroSeleccionado = filtroUnificadoSedes?.value || '';

    renderSedes(sedes.filter(sede => {
        const nombre    = (sede.nombre    || '').toLowerCase();
        const direccion = (sede.direccion || '').toLowerCase();
        const localidad = (sede.localidad || '').toLowerCase();
        const barrio    = (sede.barrio    || '').toLowerCase();
        const capacidad = String(sede.capacidad || '').toLowerCase();
        const estado    = (sede.estado    || '').toLowerCase();

        const coincideTexto = nombre.includes(textoBusqueda) || direccion.includes(textoBusqueda) ||
            localidad.includes(textoBusqueda) || barrio.includes(textoBusqueda) ||
            capacidad.includes(textoBusqueda) || estado.includes(textoBusqueda);

        let coincideFiltro = true;
        if (filtroSeleccionado) {
            const [tipo, valor] = filtroSeleccionado.split(':');
            if (tipo === 'estado') coincideFiltro = estado === valor;
        }
        return coincideTexto && coincideFiltro;
    }));
}

// ============================================
// MAPA LEAFLET
// ============================================
function initMap() {
    const mapContainer = document.getElementById('admin-map-container');
    if (!mapContainer || map) return;
    map = L.map('admin-map-container').setView([4.6533, -74.0836], 12);
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
        let lat = sede.latitud;
        let lon = sede.longitud;

        if (!lat || !lon) {
            const coords = await geocodificarFallback(sede.direccion, sede.localidad, sede.barrio);
            if (!coords) { console.warn(`Sin coordenadas para sede: ${sede.nombre} — se omite del mapa`); continue; }
            lat = coords.lat;
            lon = coords.lon;
        }

        const iconColor  = sede.estado === 'ACTIVO' ? '#34a853' : '#dc2626';
        const customIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background-color:${iconColor};width:32px;height:32px;
                        border-radius:50% 50% 50% 0;transform:rotate(-45deg);
                        border:3px solid white;box-shadow:0 4px 8px rgba(0,0,0,0.3);">
                       <div style="transform:rotate(45deg);color:white;font-size:16px;
                                   font-weight:bold;display:flex;align-items:center;
                                   justify-content:center;height:100%;">P</div>
                   </div>`,
            iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32]
        });

        const marker = L.marker([lat, lon], { icon: customIcon }).addTo(map);
        marker.bindPopup(`
            <div style="min-width:200px;">
                <h4 style="margin:0 0 8px;font-size:1.125rem;font-weight:700;color:#0f172a;">
                    ${sede.nombre}
                </h4>
                <p style="margin:4px 0;color:#64748b;font-size:0.875rem;display:flex;align-items:center;gap:6px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none"
                         viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
                         stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
                        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
                        <circle cx="12" cy="10" r="3"/>
                    </svg>
                    ${sede.direccion}
                </p>
                <p style="margin:4px 0;color:#64748b;font-size:0.875rem;display:flex;align-items:center;gap:6px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none"
                         viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
                         stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
                        <path d="M19 17H5v0a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2z"/>
                        <circle cx="7.5" cy="17" r="1.5"/><circle cx="16.5" cy="17" r="1.5"/>
                        <path d="M5 9h14M9 9V7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                    </svg>
                    Capacidad: ${sede.capacidad} vehículos
                </p>
                <button onclick="mostrarDetallesSede(${sede.id})"
                        style="margin-top:12px;width:100%;background:#1e40af;color:white;
                               border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:600;"
                        onmouseover="this.style.background='#1e3a8a'"
                        onmouseout="this.style.background='#1e40af'">
                    Ver detalles completos
                </button>
            </div>`, { maxWidth: 300 });

        marcadores.push(marker);
    }

    if (marcadores.length > 0) {
        map.fitBounds(L.featureGroup(marcadores).getBounds().pad(0.1));
    }
}

async function geocodificarFallback(direccion, localidad, barrio) {
    if (!direccion) return null;

    const localidadFmt = localidad
        ? localidad.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
        : '';

    const queries = [
        barrio && localidadFmt ? `${direccion}, ${barrio}, ${localidadFmt}, Bogotá, Colombia` : null,
        localidadFmt           ? `${direccion}, ${localidadFmt}, Bogotá, Colombia`             : null,
        `${direccion}, Bogotá, Colombia`
    ].filter(Boolean);

    for (let i = 0; i < queries.length; i++) {
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&limit=3` +
                `&countrycodes=co&q=${encodeURIComponent(queries[i])}`;
            const res  = await fetch(url, { headers: { 'User-Agent': 'AparcaYA/1.0' } });
            if (!res.ok) continue;
            const data = await res.json();
            if (!data || data.length === 0) continue;
            const resultado = data.find(r => r.display_name.toLowerCase().includes('bogot')) || data[0];
            if (resultado) return { lat: parseFloat(resultado.lat), lon: parseFloat(resultado.lon) };
        } catch (e) {
            console.warn('geocodificarFallback error en query:', queries[i], e);
        }
        if (i < queries.length - 1) await new Promise(r => setTimeout(r, 1100));
    }
    return null;
}

// ============================================
// MODAL DETALLE DE SEDE
// ============================================
function mostrarDetallesSede(sedeId) {
    const sede = sedes.find(s => s.id == sedeId);
    if (!sede) return;

    document.getElementById('modalSedeTitle').textContent = sede.nombre;

    const badgeEl = document.getElementById('detalle-sede-estado');
    if (badgeEl) {
        badgeEl.textContent = sede.estado === 'ACTIVO' ? 'Activa' : 'Inactiva';
        badgeEl.className   = 'admin-badge ' + (sede.estado === 'ACTIVO' ? 'admin-badge-activo' : 'admin-badge-inactivo');
    }

    const set = (id, valor, fallback) => {
        const el = document.getElementById(id);
        if (el) el.textContent = valor || fallback || '—';
    };

    set('detalle-sede-nit',           sede.nit);
    set('detalle-sede-capacidad',     sede.capacidad);
    set('detalle-sede-localidad',     sede.localidad);
    set('detalle-sede-barrio',        sede.barrio,      'No especificado');
    set('detalle-sede-direccion',     sede.direccion);
    set('detalle-sede-horario',       sede.horarioSede, 'No especificado');

    const fmt = v => v != null ? v.toLocaleString('es-CO') : 'N/A';
    set('detalle-sede-tarifa-plena-c',  fmt(sede.tarifaPlenaC));
    set('detalle-sede-tarifa-minuto-c', fmt(sede.tarifaMinutoC));
    set('detalle-sede-tarifa-plena-m',  fmt(sede.tarifaPlenaM));
    set('detalle-sede-tarifa-minuto-m', fmt(sede.tarifaMinutoM));

    const btnEditar   = document.getElementById('detalle-sede-btn-editar');
    const btnEliminar = document.getElementById('detalle-sede-btn-eliminar');
    if (btnEditar)   btnEditar.onclick   = () => { editarSede(sede.id);  cerrarModalSede(); };
    if (btnEliminar) btnEliminar.onclick = () => { cerrarModalSede(); eliminarSede(sede.id); };

    abrirModal('modalSede');
}

function cerrarModalSede() {
    cerrarModal('modalSede');
}

// ============================================
// GRÁFICAS — v3 con paleta mejorada
// ============================================
async function inicializarGraficas() {
    await cargarGraficaIngresos();
    await cargarGraficaUsuarios();
    await cargarGraficaSedes();
    await cargarGraficaCorreos();
}

async function cargarGraficaIngresos() {
    try {
        const response = await fetch(`${API_BASE_URL}/grafica/accesos`);
        if (!response.ok) throw new Error('Error cargando gráfica de accesos');
        const data = await response.json();

        // KPIs
        const kpiActual   = document.getElementById('kpiIngresosActual');
        const kpiAnterior = document.getElementById('kpiIngresosAnterior');
        const kpiAnio     = document.getElementById('kpiIngresosAnio');
        if (kpiAnterior) kpiAnterior.textContent = (data.mesAnterior || 0).toLocaleString('es-CO');
        if (kpiAnio)     kpiAnio.textContent     = (data.acumuladoAnio || 0).toLocaleString('es-CO');
        if (kpiActual) {
            const signo  = data.variacion >= 0 ? '+' : '';
            const sufijo = data.variacion !== 0 ? ` (${signo}${data.variacion}%)` : '';
            kpiActual.textContent = (data.mesActual || 0).toLocaleString('es-CO') + sufijo;
            kpiActual.className   = 'admin-kpi-value';
            if (data.variacion > 0)      kpiActual.classList.add('positive');
            else if (data.variacion < 0) kpiActual.classList.add('negative');
            else                         kpiActual.classList.add('accent');
        }

        // Leyenda por rol
        const legendContainer = document.getElementById('legendAccesos');
        if (legendContainer && data.porRol) {
            legendContainer.innerHTML = Object.entries(data.porRol)
                .filter(([rol]) => ROL_CFG[rol])
                .map(([rol, serie]) => {
                    const cfg   = ROL_CFG[rol];
                    const total = serie.reduce((a, b) => a + b, 0);
                    return `<span class="admin-legend-item">
                        <span class="admin-legend-dot" style="background:${cfg.border}"></span>
                        ${cfg.label} <strong>${total.toLocaleString('es-CO')}</strong>
                    </span>`;
                }).join('');
        }

        if (chartIngresos) chartIngresos.destroy();
        const canvas = document.getElementById('chartIngresos');
        if (!canvas) return;

        const datasets = Object.entries(ROL_CFG).map(([rol, cfg]) => ({
            label:           cfg.label,
            data:            data.porRol?.[rol] || Array(12).fill(0),
            backgroundColor: cfg.color,
            borderColor:     cfg.border,
            borderWidth:     1,
            borderRadius:    3,
            stack:           'accesos'
        }));

        chartIngresos = new Chart(canvas, {
            type: 'bar',
            data: { labels: data.labels, datasets },
            options: {
                ...BASE_CHART_OPTS,
                plugins: {
                    ...BASE_CHART_OPTS.plugins,
                    legend: { display: false },
                    tooltip: {
                        ...BASE_CHART_OPTS.plugins.tooltip,
                        callbacks: {
                            label:  ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString('es-CO')} accesos`,
                            footer: items => 'Total mes: ' + items.reduce((s, i) => s + i.parsed.y, 0).toLocaleString('es-CO')
                        }
                    }
                },
                scales: {
                    x: { ...BASE_CHART_OPTS.scales.x, stacked: true },
                    y: { ...BASE_CHART_OPTS.scales.y, stacked: true }
                }
            }
        });
    } catch (e) {
        console.error('Error gráfica accesos:', e);
        ['kpiIngresosActual','kpiIngresosAnterior','kpiIngresosAnio']
            .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '0'; });
    }
}

async function cargarGraficaUsuarios() {
    try {
        const response = await fetch(`${API_BASE_URL}/grafica/usuarios-rol`);
        if (!response.ok) throw new Error();
        const data = await response.json();

        if (chartUsuarios) chartUsuarios.destroy();
        const canvas = document.getElementById('chartUsuarios');
        if (!canvas) return;

        const colores  = data.labels.map(l => ROL_CFG[l]?.color  || PALETA.slateA);
        const bordes   = data.labels.map(l => ROL_CFG[l]?.border || PALETA.slate);
        const total    = data.data.reduce((a, b) => a + b, 0);

        const kpiT = document.getElementById('kpiUsuariosTotal');
        if (kpiT) kpiT.textContent = total.toLocaleString('es-CO');

        chartUsuarios = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: data.labels.map(l => ROL_CFG[l]?.label || ROL_LABELS[l] || l),
                datasets: [{
                    data:            data.data,
                    backgroundColor: colores,
                    borderColor:     bordes,
                    borderWidth:     2,
                    hoverOffset:     6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '62%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { font: { size: 11 }, padding: 10, boxWidth: 10, boxHeight: 10 }
                    },
                    tooltip: {
                        ...BASE_CHART_OPTS.plugins.tooltip,
                        callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} usuarios` }
                    }
                }
            }
        });
    } catch (e) { console.error('Error gráfica usuarios:', e); }
}

async function cargarGraficaSedes() {
    try {
        const response = await fetch(`${API_BASE_URL}/grafica/sedes`);
        if (!response.ok) throw new Error();
        const data = await response.json();

        if (chartSedes) chartSedes.destroy();
        const canvas = document.getElementById('chartSedes');
        if (!canvas) return;

        const capacidadTotal = data.data.reduce((a, b) => a + b, 0);
        const maxVal         = Math.max(...data.data);
        const colores        = data.data.map(v => v === maxVal ? PALETA.amberA : 'rgba(245,158,11,0.38)');

        const kpiCap = document.getElementById('kpiSedesCapacidad');
        const kpiST  = document.getElementById('kpiSedesTotal');
        if (kpiCap) kpiCap.textContent = capacidadTotal.toLocaleString('es-CO');
        if (kpiST)  kpiST.textContent  = data.labels.length;

        chartSedes = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label:           'Capacidad (vehículos)',
                    data:            data.data,
                    backgroundColor: colores,
                    borderColor:     PALETA.amber,
                    borderWidth:     1,
                    borderRadius:    5,
                    borderSkipped:   false
                }]
            },
            options: {
                ...BASE_CHART_OPTS,
                indexAxis: 'y',
                plugins: {
                    ...BASE_CHART_OPTS.plugins,
                    legend: { display: false },
                    tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x} vehículos` } }
                },
                scales: {
                    x: { ...BASE_CHART_OPTS.scales.x, grid: { color: 'rgba(0,0,0,0.04)' } },
                    y: { ...BASE_CHART_OPTS.scales.y, grid: { display: false } }
                }
            }
        });
    } catch (e) { console.error('Error gráfica sedes:', e); }
}

// NUEVA — Gráfica de estado de correos
async function cargarGraficaCorreos() {
    const canvas = document.getElementById('chartCorreosEstado');
    if (!canvas) return;

    try {
        const resp = await fetch(`${API_BASE_URL}/correos/estadisticas`);
        if (!resp.ok) return;
        const data = await resp.json();

        const enviados   = Number(data.totalEnviados   || 0);
        const errores    = Number(data.totalErrores    || 0);
        const pendientes = Number(data.totalPendientes || 0);

        // KPIs de la tarjeta de gráfica (ids con sufijo 2 para no colisionar con los de la sección correos)
        const kpiE = document.getElementById('kpiCorreosEnviados2');
        const kpiR = document.getElementById('kpiCorreosErrores2');
        if (kpiE) kpiE.textContent = enviados.toLocaleString('es-CO');
        if (kpiR) kpiR.textContent = errores.toLocaleString('es-CO');

        if (chartCorreosEstado) chartCorreosEstado.destroy();

        chartCorreosEstado = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels:   ['Enviados', 'Errores', 'Pendientes'],
                datasets: [{
                    data:            [enviados, errores, pendientes],
                    backgroundColor: [PALETA.emeraldA, PALETA.roseA,    PALETA.amberA ],
                    borderColor:     [PALETA.emerald,  PALETA.rose,     PALETA.amber  ],
                    borderWidth:     2,
                    hoverOffset:     5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10 } },
                    tooltip: { ...BASE_CHART_OPTS.plugins.tooltip }
                }
            }
        });
    } catch (e) { console.warn('Error gráfica correos:', e); }
}

// ============================================
// FILTROS DE GRÁFICAS
// ============================================
function vincularFiltrosGraficas() {
    const btnAplicar = document.getElementById('btnAplicarFiltroGraficas');
    if (btnAplicar) {
        btnAplicar.addEventListener('click', async () => {
            await inicializarGraficas();
            showToast('Gráficas actualizadas', 'info');
        });
    }
    const btnLimpiar = document.getElementById('btnLimpiarFiltroGraficas');
    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', () => {
            ['filtroGraficaDesde','filtroGraficaHasta','filtroGraficaSede'].forEach(id => {
                const el = document.getElementById(id); if (el) el.value = '';
            });
            inicializarGraficas();
        });
    }
}

// ============================================
// EXPORTACIÓN DE GRÁFICAS (PDF y CSV)
// ============================================
function exportarGraficaPDF(canvasId, titulo) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) { showToast('Gráfica no disponible', 'warning'); return; }

    const imgSrc = canvas.toDataURL('image/png', 1.0);
    const win    = window.open('', '_blank');
    if (!win) { showToast('Permite ventanas emergentes para exportar', 'warning'); return; }

    win.document.write(`<!DOCTYPE html><html><head><title>${titulo}</title>
        <style>body{margin:24px;font-family:system-ui,sans-serif;}h2{font-size:18px;color:#1e293b;margin-bottom:16px;font-weight:600;}img{max-width:100%;border:1px solid #e2e8f0;border-radius:8px;}p{margin-top:12px;font-size:12px;color:#94a3b8;}</style>
        </head><body>
        <h2>${titulo}</h2>
        <img src="${imgSrc}">
        <p>AparcaYA Parking Tech — Exportado el ${new Date().toLocaleString('es-CO')}</p>
        <script>window.onload=()=>{window.print();}<\/script>
        </body></html>`);
    win.document.close();
}

function exportarGraficaCSV(canvasId, nombre) {
    const chart = [chartIngresos, chartUsuarios, chartSedes, chartCorreosEstado]
        .filter(Boolean)
        .find(c => c.canvas?.id === canvasId);

    if (!chart) { showToast('Datos no disponibles para exportar', 'warning'); return; }

    const labels   = chart.data.labels   || [];
    const datasets = chart.data.datasets || [];
    const cabecera = ['Etiqueta', ...datasets.map(d => d.label || 'Valor')].join(',');
    const filas    = labels.map((lbl, i) =>
        [lbl, ...datasets.map(d => d.data?.[i] ?? 0)].join(',')
    );

    const csv  = [cabecera, ...filas].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${nombre}_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Archivo CSV descargado', 'success');
}

// ============================================
// DONUTS
// ============================================
async function cargarEstadisticasDonut() {
    try {
        const response = await fetch(`${API_BASE_URL}/estadisticas/generales`);
        if (!response.ok) throw new Error();
        const data = await response.json();
        animarDonut('.admin-usuario-segment',  data.totalUsuarios,      data.metaUsuarios  || 50);
        animarDonut('.admin-cuota-segment',    data.totalSedes,         data.metaSedes     || 10);
        animarDonut('.admin-ingresos-segment', data.ingresosTotal || 0, data.metaIngresos  || 100000);
    } catch (e) {
        console.error('Error donuts:', e);
        cargarEstadisticasDefault();
    }
}

function cargarEstadisticasDefault() {
    actualizarTextoDonut('.admin-usuario-segment',  0);
    actualizarTextoDonut('.admin-cuota-segment',    0);
    actualizarTextoDonut('.admin-ingresos-segment', '$0');
    animarDonut('.admin-usuario-segment',  0, 50);
    animarDonut('.admin-cuota-segment',    0, 10);
    animarDonut('.admin-ingresos-segment', 0, 100000);
}

function actualizarTextoDonut(selector, valor) {
    const circle    = document.querySelector(selector);
    if (!circle) return;
    const container = circle.closest('.admin-donut-container');
    const textEl    = container?.querySelector('.admin-donut-text');
    if (textEl) textEl.textContent = valor;
}

function animarDonut(selector, valorActual, valorMaximo) {
    const circle = document.querySelector(selector);
    if (!circle) return;
    const porcentaje    = Math.min((valorActual / valorMaximo) * 100, 100);
    const circumference = 2 * Math.PI * 15.9155;
    setTimeout(() => {
        circle.style.strokeDasharray = `${(porcentaje / 100) * circumference} ${circumference}`;
    }, 100);
}

// ============================================
// REPORTES
// ============================================
async function generarPDF() {
    try {
        const response    = await fetch('/admin/reporte/usuarios/pdf');
        if (!response.ok) throw new Error('Error generando PDF');
        const contentType = response.headers.get('Content-Type') || '';
        if (contentType.includes('text/html')) {
            showToast('Tu sesión expiró. Por favor inicia sesión nuevamente.', 'warning', 5000);
            setTimeout(() => { window.location.href = '/login'; }, 2000);
            return;
        }
        const blob = await response.blob();
        const url  = window.URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = `reporte_usuarios_${Date.now()}.pdf`;
        document.body.appendChild(a); a.click();
        window.URL.revokeObjectURL(url); document.body.removeChild(a);
        showToast('PDF generado correctamente', 'success');
    } catch (error) { showToast('Error al generar el PDF', 'error'); console.error(error); }
}

async function generarExcel() {
    try {
        const response    = await fetch('/admin/reporte/usuarios/excel');
        if (!response.ok) throw new Error('Error generando Excel');
        const contentType = response.headers.get('Content-Type') || '';
        if (contentType.includes('text/html')) {
            showToast('Tu sesión expiró. Por favor inicia sesión nuevamente.', 'warning', 5000);
            setTimeout(() => { window.location.href = '/login'; }, 2000);
            return;
        }
        const blob = await response.blob();
        const url  = window.URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = `reporte_usuarios_${Date.now()}.xlsx`;
        document.body.appendChild(a); a.click();
        window.URL.revokeObjectURL(url); document.body.removeChild(a);
        showToast('Excel generado correctamente', 'success');
    } catch (error) { showToast('Error al generar el Excel', 'error'); console.error(error); }
}

// ============================================
// ENVÍO DE CORREOS
// ============================================
function setupMailTabs() {
    const tabsBtns   = document.querySelectorAll('#correos .aparca-tabs button');
    const mailPanels = [
        document.getElementById('correoUnitario'),
        document.getElementById('correoMasivo')
    ];
    tabsBtns.forEach((btn, idx) => {
        btn.addEventListener('click', () => {
            tabsBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
            mailPanels.forEach(p => p.hidden = true);
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
            mailPanels[idx].hidden = false;
        });
    });
}

function setBtnLoadingMail(btn, state, textoOriginal) {
    if (state) {
        btn.disabled = true;
        btn.dataset.originalText = btn.innerHTML;
        btn.innerHTML = '<span>Enviando...</span>';
    } else {
        btn.disabled  = false;
        btn.innerHTML = textoOriginal || btn.dataset.originalText || 'Enviar';
    }
}

function enviarCorreoUnitario(form) {
    const email   = document.getElementById('emailSingle').value.trim();
    const subject = document.getElementById('subjectSingle').value.trim();
    const message = document.getElementById('messageSingle').value.trim();

    if (!email || !subject || !message) { showToast('Por favor completa todos los campos', 'warning'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Por favor ingresa un correo válido', 'warning'); return; }

    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    setBtnLoadingMail(btn, true);

    // Si hay plantilla activa usar el endpoint con plantilla, si no el unitario normal
    const endpoint  = EMAIL_MOD.plantillaActiva ? '/admin/correo/con-plantilla' : '/admin/correo/unitario';
    const formData  = new URLSearchParams();
    formData.append('correo',  email);
    formData.append('asunto',  subject);
    formData.append('mensaje', message);
    if (EMAIL_MOD.plantillaActiva) formData.append('tipoPlantilla', EMAIL_MOD.plantillaActiva);

    fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
    })
        .then(r => r.json())
        .then(data => {
            if (data.status === 'success') {
                showToast(data.message, 'success');
                ['emailSingle','subjectSingle','messageSingle'].forEach(id => {
                    var el = document.getElementById(id); if (el) el.value = '';
                });
                // Limpiar plantilla seleccionada
                EMAIL_MOD.plantillaActiva = null;
                document.querySelectorAll('[data-plantilla]').forEach(c => c.classList.remove('plantilla-activa'));
                const badge = document.getElementById('plantillaSeleccionadaBadge');
                if (badge) badge.style.display = 'none';
                // Refrescar historial
                setTimeout(cargarHistorialCorreos, 800);
            } else {
                showToast(data.message || 'Error al enviar correo', 'error');
            }
        })
        .catch(() => showToast('Error de conexión. Intenta de nuevo.', 'error'))
        .finally(() => setBtnLoadingMail(btn, false, originalText));
}

function enviarCorreoMasivo(form) {
    const emails  = document.getElementById('emailsMassive').value.trim();
    const subject = document.getElementById('subjectMassive').value.trim();
    const message = document.getElementById('messageMassive').value.trim();

    if (!emails || !subject || !message) { showToast('Por favor completa todos los campos', 'warning'); return; }

    const emailList     = emails.split(',').map(e => e.trim()).filter(e => e);
    const invalidEmails = emailList.filter(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

    if (invalidEmails.length > 0) { showToast(`Correos inválidos: ${invalidEmails.join(', ')}`, 'error', 6000); return; }
    if (emailList.length === 0)   { showToast('Ingresa al menos un correo válido', 'warning'); return; }

    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    setBtnLoadingMail(btn, true);

    // Si hay plantilla activa en masivo usar endpoint con plantilla
    // endpoint siempre es masivo — tipoPlantilla se pasa como param opcional
    const formData  = new URLSearchParams();
    emailList.forEach(email => formData.append('seleccionados', email));
    formData.append('asunto',  subject);
    formData.append('mensaje', message);
    if (EMAIL_MOD.plantillaActivaMasivo) formData.append('tipoPlantilla', EMAIL_MOD.plantillaActivaMasivo);

    fetch('/admin/correo/masivo', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
    })
        .then(r => r.json())
        .then(data => {
            if (data.status === 'success') {
                showToast(data.message, 'success');
                ['emailsMassive','subjectMassive','messageMassive'].forEach(id => {
                    var el = document.getElementById(id); if (el) el.value = '';
                });
                EMAIL_MOD.plantillaActivaMasivo = null;
                document.querySelectorAll('[data-plantilla-masivo]').forEach(c => c.classList.remove('plantilla-activa'));
                const badgeM = document.getElementById('plantillaSeleccionadaBadgeMasivo');
                if (badgeM) badgeM.style.display = 'none';
                setTimeout(cargarHistorialCorreos, 800);
            } else {
                showToast(data.message || 'Error al enviar correos', 'error');
            }
        })
        .catch(() => showToast('Error de conexión. Intenta de nuevo.', 'error'))
        .finally(() => setBtnLoadingMail(btn, false, originalText));
}

// ============================================
// SELECTOR DE PLANTILLAS DE CORREO
// ============================================
function inicializarSelectorPlantillas() {
    document.querySelectorAll('[data-plantilla]').forEach(card => {
        card.addEventListener('click', () => seleccionarPlantilla(card));
    });
}

async function seleccionarPlantilla(card) {
    const tipo = card.dataset.plantilla;
    if (!tipo) return;

    document.querySelectorAll('[data-plantilla]').forEach(c => {
        c.classList.remove('plantilla-activa');
        c.setAttribute('aria-pressed', 'false');
    });
    card.classList.add('plantilla-activa');
    card.setAttribute('aria-pressed', 'true');

    EMAIL_MOD.plantillaActiva = tipo;

    const labels = {
        BIENVENIDA:   'Bienvenida',
        RECORDATORIO: 'Recordatorio',
        PROMOCION:    'Promocion',
        NOTIFICACION: 'Notificacion'
    };

    const badge = document.getElementById('plantillaSeleccionadaBadge');
    if (badge) {
        badge.textContent  = labels[tipo] || tipo;
        badge.style.display = 'inline';
    }

    // Cargar preview del servidor solo si los campos están vacíos
    try {
        const resp = await fetch(`${API_BASE_URL}/correos/plantilla-preview?tipo=${tipo}`);
        if (!resp.ok) return;
        const data = await resp.json();

        const subjectField = document.getElementById('subjectSingle');
        const messageField = document.getElementById('messageSingle');
        if (subjectField && !subjectField.value.trim()) subjectField.value = data.asunto;
        if (messageField && !messageField.value.trim()) messageField.value = data.mensaje;
    } catch (e) {
        console.warn('No se pudo cargar preview de plantilla:', e);
    }
}

// Selector de plantillas para envío MASIVO
async function seleccionarPlantillaMasivo(card) {
    const tipo = card.dataset.plantillaMasivo;
    if (!tipo) return;

    document.querySelectorAll('[data-plantilla-masivo]').forEach(c => {
        c.classList.remove('plantilla-activa');
        c.setAttribute('aria-pressed', 'false');
    });
    card.classList.add('plantilla-activa');
    card.setAttribute('aria-pressed', 'true');

    EMAIL_MOD.plantillaActivaMasivo = tipo;

    const labels = {
        BIENVENIDA:   'Bienvenida',
        RECORDATORIO: 'Recordatorio',
        PROMOCION:    'Promocion',
        NOTIFICACION: 'Notificacion'
    };

    const badge = document.getElementById('plantillaSeleccionadaBadgeMasivo');
    if (badge) {
        badge.textContent   = labels[tipo] || tipo;
        badge.style.display = 'inline';
    }

    // Cargar preview solo si los campos están vacíos
    try {
        const resp = await fetch(`${API_BASE_URL}/correos/plantilla-preview?tipo=${tipo}`);
        if (!resp.ok) return;
        const data = await resp.json();

        const subjectField = document.getElementById('subjectMassive');
        const messageField = document.getElementById('messageMassive');
        if (subjectField && !subjectField.value.trim()) subjectField.value = data.asunto;
        if (messageField && !messageField.value.trim()) messageField.value = data.mensaje;
    } catch (e) {
        console.warn('No se pudo cargar preview de plantilla masiva:', e);
    }
}

// ============================================
// KPIs DE CORREOS
// ============================================
async function cargarContadoresCorreos() {
    try {
        const resp = await fetch(`${API_BASE_URL}/correos/estadisticas`);
        if (!resp.ok) return;
        const data = await resp.json();

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = (val ?? 0).toLocaleString('es-CO'); };
        set('kpiCorreosEnviados',   data.totalEnviados);
        set('kpiCorreosPendientes', data.totalPendientes);
        set('kpiCorreosErrores',    data.totalErrores);
        set('kpiCorreosTotal',      data.total);
    } catch (e) {
        console.warn('No se pudieron cargar contadores de correos:', e);
    }
}

// ============================================
// HISTORIAL DE CORREOS CON FILTROS
// ============================================
async function cargarHistorialCorreos(filtros = {}) {
    const tbody = document.getElementById('tbodyHistorialCorreos');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:16px;font-size:13px;">Cargando...</td></tr>';

    const params = new URLSearchParams();
    if (filtros.estado) params.set('estado', filtros.estado);
    if (filtros.tipo)   params.set('tipo',   filtros.tipo);
    if (filtros.desde)  params.set('desde',  filtros.desde);
    if (filtros.hasta)  params.set('hasta',  filtros.hasta);

    try {
        const resp = await fetch(`${API_BASE_URL}/correos/historial?${params}`);
        if (!resp.ok) throw new Error(`Error ${resp.status}`);
        const logs = await resp.json();

        const contEl = document.getElementById('historialContador');
        if (contEl) contEl.textContent = logs.length;

        if (!logs || logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:20px;font-size:13px;">Sin registros para los filtros seleccionados</td></tr>';
            return;
        }

        const ESTADO_CFG = {
            ENVIADO:   { clase: 'enviado',   label: 'Enviado'   },
            ERROR:     { clase: 'error',     label: 'Error'     },
            PENDIENTE: { clase: 'pendiente', label: 'Pendiente' }
        };

        const TIPO_LABELS_H = {
            BIENVENIDA: 'Bienvenida', RECORDATORIO: 'Recordatorio',
            PROMOCION:  'Promocion',  NOTIFICACION: 'Notificacion', CUSTOM: 'Personalizado'
        };

        tbody.innerHTML = logs.map(log => {
            const cfg   = ESTADO_CFG[log.estado] || { clase: '', label: log.estado };
            const fecha = log.fechaEnvio
                ? new Date(log.fechaEnvio).toLocaleString('es-CO', { dateStyle:'short', timeStyle:'short' })
                : '—';
            const errorTip = log.mensajeError
                ? `<span title="${_esc(log.mensajeError)}" style="cursor:help;color:#dc2626;font-size:11px;margin-left:4px;">ver error</span>`
                : '';

            return `<tr>
                <td style="padding:9px 12px;font-size:13px;color:#334155;">${_esc(log.destinatario)}</td>
                <td style="padding:9px 12px;font-size:13px;color:#475569;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${_esc(log.asunto)}">${_esc(log.asunto)}</td>
                <td style="padding:9px 12px;">
                    <span style="font-size:11px;background:#f1f5f9;color:#64748b;padding:2px 8px;border-radius:999px;">
                        ${TIPO_LABELS_H[log.tipo] || log.tipo}
                    </span>
                </td>
                <td style="padding:9px 12px;">
                    <span class="historial-badge ${cfg.clase}">${cfg.label}</span>${errorTip}
                </td>
                <td style="padding:9px 12px;font-size:12px;color:#94a3b8;">${fecha}</td>
            </tr>`;
        }).join('');

    } catch (e) {
        console.error('Error cargando historial:', e);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#ef4444;padding:16px;font-size:13px;">Error al cargar el historial</td></tr>';
    }
}

function vincularFiltrosHistorial() {
    const btnFiltrar = document.getElementById('btnFiltrarHistorial');
    if (btnFiltrar) {
        btnFiltrar.addEventListener('click', () => {
            cargarHistorialCorreos({
                estado: document.getElementById('filtroHistorialEstado')?.value || '',
                tipo:   document.getElementById('filtroHistorialTipo')?.value   || '',
                desde:  document.getElementById('filtroHistorialDesde')?.value  || '',
                hasta:  document.getElementById('filtroHistorialHasta')?.value  || ''
            });
        });
    }
    const btnLimpiar = document.getElementById('btnLimpiarHistorial');
    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', () => {
            ['filtroHistorialEstado','filtroHistorialTipo',
                'filtroHistorialDesde', 'filtroHistorialHasta'].forEach(id => {
                const el = document.getElementById(id); if (el) el.value = '';
            });
            cargarHistorialCorreos();
        });
    }
}

// ============================================
// MÓDULO FILTRO DESTINATARIOS
// ============================================
let _adminDestinatariosCache = [];

async function adminCargarDestinatarios() {
    const rol      = document.getElementById('adminFiltroRol')?.value;
    const estadoEl = document.getElementById('adminEstadoFiltro');
    const listaEl  = document.getElementById('adminListaDestinatarios');
    const tablaEl  = document.getElementById('adminTablaDestinatarios');
    const contEl   = document.getElementById('adminContadorLista');
    const btnEl    = document.getElementById('btnAdminCargar');

    if (!rol) { showToast('Selecciona un grupo primero', 'warning'); return; }

    if (estadoEl) estadoEl.textContent = 'Consultando base de datos...';
    if (listaEl)  listaEl.style.display = 'none';
    if (btnEl)    { btnEl.disabled = true; btnEl.textContent = 'Cargando...'; }

    const endpoints = {
        clientes:     `${API_BASE_URL}/correos/clientes`,
        sedes:        `${API_BASE_URL}/correos/sedes`,
        trabajadores: `${API_BASE_URL}/correos/trabajadores`
    };

    try {
        const response = await fetch(endpoints[rol]);
        if (!response.ok) throw new Error(`Error ${response.status}`);
        const datos = await response.json();
        _adminDestinatariosCache = datos;

        if (datos.length === 0) {
            if (estadoEl) estadoEl.textContent = 'No se encontraron usuarios en este grupo.';
            if (listaEl)  listaEl.style.display = 'none';
            return;
        }

        if (tablaEl) {
            tablaEl.innerHTML = datos.map(d => `
                <label style="display:flex;align-items:center;gap:.75rem;padding:.6rem .75rem;
                               cursor:pointer;border-bottom:1px solid #f1f5f9;transition:background .15s;"
                       onmouseover="this.style.background='#f8fafc'"
                       onmouseout="this.style.background='transparent'">
                    <input type="checkbox" class="admin-dest-check" data-correo="${d.correo}"
                           style="width:16px;height:16px;cursor:pointer;accent-color:#1e40af;" checked/>
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:600;font-size:.875rem;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${d.nombre || '(sin nombre)'}</div>
                        <div style="font-size:.8rem;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${d.correo}</div>
                    </div>
                    <span style="font-size:.72rem;background:#dbeafe;color:#1e40af;border-radius:9999px;padding:.15rem .5rem;white-space:nowrap;">${_adminRolLabel(d.rol)}</span>
                </label>
            `).join('');
        }

        if (contEl)   contEl.textContent = `${datos.length} usuario(s) encontrado(s)`;
        if (estadoEl) estadoEl.textContent = '';
        if (listaEl)  listaEl.style.display = 'block';

    } catch (e) {
        console.error('adminCargarDestinatarios:', e);
        if (estadoEl) estadoEl.textContent = 'Error al consultar. Intenta de nuevo.';
        showToast('Error al consultar destinatarios', 'error');
    } finally {
        if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Consultar'; }
    }
}

function _adminRolLabel(rol) {
    const map = { CLIENTE:'Cliente', ADMINISTRADOR_SEDE:'Admin Sede', OPERARIO:'Operario' };
    return map[rol] || rol;
}

function adminSeleccionarTodos(estado) {
    document.querySelectorAll('.admin-dest-check').forEach(cb => { cb.checked = estado; });
}

function adminAgregarSeleccionados() {
    const seleccionados = [...document.querySelectorAll('.admin-dest-check:checked')]
        .map(cb => cb.dataset.correo).filter(Boolean);

    if (seleccionados.length === 0) { showToast('No hay destinatarios seleccionados', 'warning'); return; }

    const textarea = document.getElementById('emailsMassive');
    if (!textarea) return;

    const existentes = textarea.value.split(',').map(e => e.trim()).filter(Boolean);
    const nuevos     = seleccionados.filter(e => !existentes.includes(e));
    const todos      = [...existentes, ...nuevos].filter(Boolean);

    textarea.value = todos.join(', ');
    _adminActualizarBadge();
    showToast(`${nuevos.length} correo(s) agregado(s) al envío`, 'success');

    const lista = document.getElementById('adminListaDestinatarios');
    if (lista) lista.style.display = 'none';
    const estadoEl = document.getElementById('adminEstadoFiltro');
    if (estadoEl) estadoEl.textContent = `${seleccionados.length} destinatario(s) cargados desde base de datos.`;
}

function _adminActualizarBadge() {
    const textarea = document.getElementById('emailsMassive');
    const badge    = document.getElementById('adminBadgeConteo');
    if (!textarea || !badge) return;
    const count = textarea.value.split(',').map(e => e.trim())
        .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)).length;
    badge.textContent   = count;
    badge.style.display = count > 0 ? 'inline' : 'none';
}

// ============================================
// HELPERS INTERNOS
// ============================================
function _esc(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ============================================
// FUNCIONES DEL MENÚ PERFIL
// ============================================
function cerrarSesion()  { logoutJWT(); }

function irConfiguracion() {
    const configLink = document.querySelector('[data-tab="configuracion"]');
    if (configLink) {
        configLink.click();
        profileDropdown.classList.remove('show');
        profileBtn.setAttribute('aria-expanded', 'false');
    }
}

function irAyuda() {
    showToast('Sección de ayuda — documentación y tutoriales próximamente', 'info', 5000);
    profileDropdown.classList.remove('show');
    profileBtn.setAttribute('aria-expanded', 'false');
}

// ============================================
// DRAWER LATERAL
// ============================================
function toggleSidebar() {
    const collapsed = document.body.classList.toggle('sidebar-collapsed');
    const btn       = document.getElementById('sidebarToggleBtn');
    if (btn) btn.setAttribute('aria-label', collapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral');
    try { localStorage.setItem('sidebar-collapsed', collapsed ? '1' : '0'); } catch(e) {}
}

(function restaurarSidebar() {
    try {
        if (localStorage.getItem('sidebar-collapsed') === '1') {
            document.body.classList.add('sidebar-collapsed');
            const btn = document.getElementById('sidebarToggleBtn');
            if (btn) btn.setAttribute('aria-label', 'Expandir menú lateral');
        }
    } catch(e) {}
})();

// ============================================
// EXPONER FUNCIONES GLOBALES
// ============================================
window.eliminarUsuario           = eliminarUsuario;
window.editarUsuario             = editarUsuario;
window.guardarEdicion            = guardarEdicion;
window.cerrarModalEdicion        = cerrarModalEdicion;
window.eliminarSede              = eliminarSede;
window.editarSede                = editarSede;
window.guardarEdicionSede        = guardarEdicionSede;
window.cerrarModalEdicionSede    = cerrarModalEdicionSede;
window.generarPDF                = generarPDF;
window.generarExcel              = generarExcel;
window.mostrarDetallesSede       = mostrarDetallesSede;
window.cerrarModalSede           = cerrarModalSede;
window.toggleSidebar             = toggleSidebar;
window.adminCargarDestinatarios  = adminCargarDestinatarios;
window.adminSeleccionarTodos     = adminSeleccionarTodos;
window.adminAgregarSeleccionados = adminAgregarSeleccionados;
window.seleccionarPlantilla      = seleccionarPlantilla;
window.seleccionarPlantillaMasivo = seleccionarPlantillaMasivo;
window.cargarHistorialCorreos    = cargarHistorialCorreos;
window.exportarGraficaPDF        = exportarGraficaPDF;
window.exportarGraficaCSV        = exportarGraficaCSV;