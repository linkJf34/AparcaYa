// ============================================
// ADMIND.JS — AparcaYA
// Ruta: /js/AdminD.js
//
// CAMBIOS APLICADOS EN ESTA VERSIÓN:
// ✅ SA-01: showToast() reemplazada por SweetAlert2 toast
// ✅ SA-01: showConfirm() reemplazada por SweetAlert2 modal
//           Ambas funciones mantienen FIRMA IDÉNTICA —
//           todo el código existente funciona sin cambios.
// ✅ S-03:  toggleSidebar() — sidebar colapsable con persistencia en localStorage
//           para el control del drawer lateral en tablet/mobile.
//
// SIN CAMBIOS EN:
// - Lógica de usuarios, sedes, mapa, gráficas, correos
// - Nombres de variables y funciones
// - Flujos de fetch y manejo de errores
// - Funciones del menú de perfil
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

// ============================================
// SISTEMA DE NOTIFICACIONES — SweetAlert2
//
// ✅ SA-01 FIX: Reemplaza la implementación manual anterior.
//
// FIRMA IDÉNTICA A LA VERSIÓN ANTERIOR:
//   showToast(mensaje, tipo, duracion)
//   showConfirm(titulo, cuerpo, btnTexto, btnColor) → Promise<boolean>
//
// Todo el código que llama a estas funciones sigue
// funcionando exactamente igual, sin ningún cambio.
// ============================================

/**
 * Toast flotante con SweetAlert2.
 * Tipos: 'success' | 'error' | 'warning' | 'info'
 * Misma firma que la versión anterior.
 */
function showToast(mensaje, tipo = 'info', duracion = 4000) {
    // Mapeo de tipos propios → iconos de SweetAlert2
    const iconMap = {
        success: 'success',
        error:   'error',
        warning: 'warning',
        info:    'info'
    };

    Swal.mixin({
        toast:             true,
        position:          'top-end',
        showConfirmButton: false,
        timer:             duracion,
        timerProgressBar:  true,
        // Pausa el timer si el usuario pasa el ratón por el toast
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    }).fire({
        icon:  iconMap[tipo] || 'info',
        title: mensaje
    });
}

/**
 * Modal de confirmación con SweetAlert2.
 * Retorna Promise<boolean> — misma firma que la versión anterior.
 * Todos los `await showConfirm(...)` existentes funcionan igual.
 */
async function showConfirm(titulo, cuerpo, btnTexto = 'Eliminar', btnColor = 'danger') {
    const colorMap = {
        danger:  '#dc2626',
        warning: '#f59e0b'
    };

    const result = await Swal.fire({
        title:              titulo,
        html:               cuerpo,
        icon:               btnColor === 'warning' ? 'warning' : 'question',
        showCancelButton:   true,
        confirmButtonText:  btnTexto,
        cancelButtonText:   'Cancelar',
        confirmButtonColor: colorMap[btnColor] || colorMap.danger,
        cancelButtonColor:  '#6b7280',
        reverseButtons:     true,
        // Foco en Cancelar por seguridad en acciones destructivas
        focusCancel:        true,
        customClass: {
            popup:         'swal-aparca-popup',
            title:         'swal-aparca-title',
            htmlContainer: 'swal-aparca-body'
        }
    });

    // Mantiene exactamente el mismo valor boolean que retornaba antes
    return result.isConfirmed;
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

    const formUnitario = document.getElementById('formCorreoUnitario');
    if (formUnitario) {
        formUnitario.addEventListener('submit', function (e) {
            e.preventDefault();
            enviarCorreoUnitario(this);
        });
    }

    const formMasivo = document.getElementById('formCorreoMasivo');
    if (formMasivo) {
        formMasivo.addEventListener('submit', function (e) {
            e.preventDefault();
            enviarCorreoMasivo(this);
        });
    }
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
                if (target === 'sedes' && !map) setTimeout(initMap, 100);
                if (target === 'graficas') setTimeout(inicializarGraficas, 100);
            } else {
                sec.classList.add('hidden');
            }
        });

        // En mobile colapsa el sidebar al navegar para ganar espacio
        if (window.innerWidth < 640) {
            document.body.classList.add('sidebar-collapsed');
        }
    });
});

// ============================================
// INDICADORES
// ============================================
async function cargarIndicadores() {
    try {
        const response = await fetch(`${API_BASE_URL}/indicadores`);
        if (!response.ok) throw new Error('Error cargando indicadores');
        const data = await response.json();
        actualizarIndicador(0, data.totalUsuarios, data.porcentajeUsuarios);
        actualizarIndicador(1, data.totalSedes, data.porcentajeSedes);
        actualizarIndicador(2, `${(data.ingresosTotales / 1000).toFixed(0)}K`, data.porcentajeIngresos);
    } catch (error) {
        console.error('Error cargando indicadores:', error);
    }
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
            <td>${u.nombre  || 'N/A'}</td>
            <td>${u.correo  || 'N/A'}</td>
            <td>${u.telefono|| 'N/A'}</td>
            <td>${u.rol ? (u.rol.name || u.rol) : 'N/A'}</td>
            <td>${u.estado  || 'N/A'}</td>
            <td>
                <button class="aparca-btn-outline mr-2" onclick="editarUsuario(${usuarioId})">Editar</button>
                <button class="admin-modal-sede-btn-danger" onclick="eliminarUsuario(${usuarioId})">Eliminar</button>
            </td>
        </tr>`;
    }).filter(Boolean).join('');
}

async function eliminarUsuario(id) {
    if (!id) {
        showToast('ID de usuario inválido', 'error');
        return;
    }

    const usuario = usuarios.find(u => {
        const usuarioId = u.id || u.idUsuario || u.usuario_id;
        return usuarioId == id;
    });

    if (!usuario) {
        showToast('Usuario no encontrado', 'error');
        return;
    }

    const confirmado = await showConfirm(
        'Eliminar usuario',
        `¿Estás seguro de eliminar a <strong>${usuario.nombre}</strong>?<br>Esta acción no se puede deshacer.`
    );
    if (!confirmado) return;

    try {
        const response = await fetch(`${API_BASE_URL}/usuarios/eliminar/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
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

    if (!usuario) {
        showToast('Usuario no encontrado', 'error');
        return;
    }

    document.getElementById('edit_usuario_id').value = id;
    document.getElementById('edit_nombre').value     = usuario.nombre   || '';
    document.getElementById('edit_email').value      = usuario.correo   || '';
    document.getElementById('edit_telefono').value   = usuario.telefono || '';
    document.getElementById('edit_rol').value        = usuario.rol?.name || usuario.rol || 'CLIENTE';
    document.getElementById('edit_estado').value     = (usuario.estado || 'ACTIVO').toUpperCase();

    document.getElementById('modal_editar_usuario').showModal();
}

async function guardarEdicion() {
    const id       = document.getElementById('edit_usuario_id').value;
    const nombre   = document.getElementById('edit_nombre').value.trim();
    const email    = document.getElementById('edit_email').value.trim();
    const telefono = document.getElementById('edit_telefono').value.trim();
    const rol      = document.getElementById('edit_rol').value;
    const estado   = document.getElementById('edit_estado').value;

    if (!nombre || !email || !rol) {
        showToast('Por favor completa todos los campos obligatorios', 'warning');
        return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('Por favor ingresa un correo válido', 'warning');
        return;
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
        document.getElementById('modal_editar_usuario').close();
        await cargarUsuarios();
        await cargarIndicadores();

    } catch (error) {
        console.error('Error actualizando usuario:', error);
        showToast(`No se pudo actualizar el usuario: ${error.message}`, 'error');
    }
}

function cerrarModalEdicion() {
    document.getElementById('modal_editar_usuario').close();
    ['edit_usuario_id','edit_nombre','edit_email','edit_telefono'].forEach(id => {
        document.getElementById(id).value = '';
    });
    document.getElementById('edit_rol').value    = 'CLIENTE';
    document.getElementById('edit_estado').value = 'ACTIVO';
}

// ============================================
// BÚSQUEDA Y FILTROS — USUARIOS
// ============================================
const busquedaInput   = document.getElementById('busquedaInput');
const filtroUnificado = document.getElementById('filtroUnificado');
if (busquedaInput)   busquedaInput.addEventListener('input',  filtrarUsuarios);
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
    if (!id) {
        showToast('ID de sede inválido', 'error');
        return;
    }

    const sede = sedes.find(s => s.id == id);
    if (!sede) {
        showToast('Sede no encontrada', 'error');
        return;
    }

    const confirmado = await showConfirm(
        'Eliminar sede',
        `¿Estás seguro de eliminar <strong>${sede.nombre}</strong>?<br>Esta acción no se puede deshacer.`
    );
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
    if (!sede) {
        showToast('Sede no encontrada', 'error');
        return;
    }

    document.getElementById('edit_sede_id').value        = id;
    document.getElementById('edit_sede_nombre').value    = sede.nombre    || '';
    document.getElementById('edit_sede_direccion').value = sede.direccion || '';
    document.getElementById('edit_sede_capacidad').value = sede.capacidad || '';
    document.getElementById('edit_sede_estado').value    = (sede.estado   || 'ACTIVO').toUpperCase();

    document.getElementById('modal_editar_sede').showModal();
}

async function guardarEdicionSede() {
    const id        = document.getElementById('edit_sede_id').value;
    const nombre    = document.getElementById('edit_sede_nombre').value.trim();
    const direccion = document.getElementById('edit_sede_direccion').value.trim();
    const capacidad = parseInt(document.getElementById('edit_sede_capacidad').value);
    const estado    = document.getElementById('edit_sede_estado').value;

    if (!nombre || !direccion || !capacidad || !estado) {
        showToast('Por favor completa todos los campos obligatorios', 'warning');
        return;
    }
    if (capacidad <= 0) {
        showToast('La capacidad debe ser mayor a 0', 'warning');
        return;
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
        document.getElementById('modal_editar_sede').close();
        await cargarSedes();
        await cargarIndicadores();

    } catch (error) {
        console.error('Error actualizando sede:', error);
        showToast(`No se pudo actualizar la sede: ${error.message}`, 'error');
    }
}

function cerrarModalEdicionSede() {
    document.getElementById('modal_editar_sede').close();
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
            if (!coords) {
                console.warn(`Sin coordenadas para sede: ${sede.nombre} — se omite del mapa`);
                continue;
            }
            lat = coords.lat;
            lon = coords.lon;
        }

        const iconColor = sede.estado === 'ACTIVO' ? '#34a853' : '#dc2626';
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
                <p style="margin:4px 0;color:#64748b;font-size:0.875rem;">📍 ${sede.direccion}</p>
                <p style="margin:4px 0;color:#64748b;font-size:0.875rem;">🚗 Capacidad: ${sede.capacidad} vehículos</p>
                <button onclick="mostrarDetallesSede(${sede.id})"
                        style="margin-top:12px;width:100%;background:#00BFFF;color:white;
                               border:none;padding:8px 16px;border-radius:6px;cursor:pointer;
                               font-weight:600;"
                        onmouseover="this.style.background='#0284c7'"
                        onmouseout="this.style.background='#00BFFF'">
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
        ? localidad.replace(/_/g, ' ').toLowerCase()
            .replace(/\b\w/g, c => c.toUpperCase())
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

            const res = await fetch(url, {
                headers: { 'User-Agent': 'AparcaYA/1.0' }
            });

            if (!res.ok) continue;

            const data = await res.json();
            if (!data || data.length === 0) continue;

            const resultado = data.find(r =>
                r.display_name.toLowerCase().includes('bogot')
            ) || data[0];

            if (resultado) {
                return {
                    lat: parseFloat(resultado.lat),
                    lon: parseFloat(resultado.lon)
                };
            }
        } catch (e) {
            console.warn('geocodificarFallback error en query:', queries[i], e);
        }

        if (i < queries.length - 1) {
            await new Promise(r => setTimeout(r, 1100));
        }
    }

    return null;
}

// ============================================
// MODAL DETALLE DE SEDE
// ============================================
function mostrarDetallesSede(sedeId) {
    const sede = sedes.find(s => s.id == sedeId);
    if (!sede) return;

    const modalBody  = document.getElementById('modalSedeBody');
    const modalTitle = document.getElementById('modalSedeTitle');
    modalTitle.textContent = sede.nombre;

    const estadoBadge = sede.estado === 'ACTIVO'
        ? '<span class="admin-badge admin-badge-activo">✓ Activa</span>'
        : '<span class="admin-badge admin-badge-inactivo">✗ Inactiva</span>';

    modalBody.innerHTML = `
        <div class="admin-info-grid">
            <div class="admin-info-item admin-info-full">
                <div class="admin-info-label">Estado</div>
                <div class="admin-info-value">${estadoBadge}</div>
            </div>
            <div class="admin-info-item">
                <div class="admin-info-label">📋 NIT</div>
                <div class="admin-info-value">${sede.nit || 'N/A'}</div>
            </div>
            <div class="admin-info-item">
                <div class="admin-info-label">🚗 Capacidad</div>
                <div class="admin-info-value">${sede.capacidad} vehículos</div>
            </div>
            <div class="admin-info-item">
                <div class="admin-info-label">📍 Localidad</div>
                <div class="admin-info-value">${sede.localidad || 'N/A'}</div>
            </div>
            <div class="admin-info-item admin-info-full">
                <div class="admin-info-label">🏘️ Barrio</div>
                <div class="admin-info-value">${sede.barrio || 'No especificado'}</div>
            </div>
            <div class="admin-info-item admin-info-full">
                <div class="admin-info-label">📌 Dirección</div>
                <div class="admin-info-value">${sede.direccion}</div>
            </div>
            <div class="admin-info-item admin-info-full">
                <div class="admin-info-label">💰 Tarifas</div>
                <div class="admin-info-value admin-modal-sede-tarifas">
                    <strong>🚗 Carros:</strong>
                    &nbsp;&nbsp;• Hora plena: $${sede.tarifaPlenaC?.toLocaleString('es-CO') || 'N/A'} COP<br>
                    &nbsp;&nbsp;• Por minuto: $${sede.tarifaMinutoC?.toLocaleString('es-CO') || 'N/A'} COP<br>
                    <strong>🏍️ Motos:</strong>
                    &nbsp;&nbsp;• Hora plena: $${sede.tarifaPlenaM?.toLocaleString('es-CO') || 'N/A'} COP<br>
                    &nbsp;&nbsp;• Por minuto: $${sede.tarifaMinutoM?.toLocaleString('es-CO') || 'N/A'} COP
                </div>
            </div>
            <div class="admin-info-item admin-info-full">
                <div class="admin-info-label">🕐 Horario</div>
                <div class="admin-info-value">${sede.horarioSede || 'No especificado'}</div>
            </div>
        </div>
        <div class="admin-modal-sede-actions">
            <button class="aparca-btn-outline" onclick="editarSede(${sede.id}); cerrarModalSede();">Editar Sede</button>
            <button class="admin-modal-sede-btn-danger"
                    onclick="cerrarModalSede(); eliminarSede(${sede.id});">
                Eliminar
            </button>
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

document.getElementById('modalSede')?.addEventListener('click', e => {
    if (e.target.id === 'modalSede') cerrarModalSede();
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') cerrarModalSede();
});

// ============================================
// GRÁFICAS
// ============================================
let chartIngresos, chartUsuarios, chartSedes;

async function inicializarGraficas() {
    await cargarGraficaIngresos();
    await cargarGraficaUsuarios();
    await cargarGraficaSedes();
}

async function cargarGraficaIngresos() {
    try {
        const response = await fetch(`${API_BASE_URL}/grafica/ingresos`);
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (chartIngresos) chartIngresos.destroy();
        const canvas = document.getElementById('chartIngresos');
        if (!canvas) return;
        chartIngresos = new Chart(canvas, {
            type: 'line',
            data: { labels: data.labels, datasets: [{ label: 'Ingresos ($)', data: data.data,
                    borderColor: '#00BFFF', backgroundColor: 'rgba(0,191,255,0.2)', fill: true, tension: 0.4 }] },
            options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'top' } } }
        });
    } catch (e) { console.error('Error gráfica ingresos:', e); }
}

async function cargarGraficaUsuarios() {
    try {
        const response = await fetch(`${API_BASE_URL}/grafica/usuarios-rol`);
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (chartUsuarios) chartUsuarios.destroy();
        const canvas = document.getElementById('chartUsuarios');
        if (!canvas) return;
        chartUsuarios = new Chart(canvas, {
            type: 'bar',
            data: { labels: data.labels, datasets: [{ label: 'Número de Usuarios', data: data.data,
                    backgroundColor: ['#34a853','#00bfa5','#3b82f6'], borderWidth: 1 }] },
            options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'top' } } }
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
        chartSedes = new Chart(canvas, {
            type: 'bar',
            data: { labels: data.labels, datasets: [{ label: 'Capacidad', data: data.data,
                    backgroundColor: '#f59e0b', borderWidth: 1 }] },
            options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'top' } } }
        });
    } catch (e) { console.error('Error gráfica sedes:', e); }
}

// ============================================
// DONUTS
// ============================================
async function cargarEstadisticasDonut() {
    try {
        const response = await fetch(`${API_BASE_URL}/estadisticas/generales`);
        if (!response.ok) throw new Error();
        const data = await response.json();
        // Texto numérico gestionado exclusivamente por cargarIndicadores()
        // para evitar sobreescritura no determinística del mismo elemento.
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

function formatearIngresos(valor) {
    if (valor >= 1000000) return `$${(valor / 1000000).toFixed(1)}M`;
    if (valor >= 1000)    return `$${Math.round(valor / 1000)}K`;
    return `$${valor}`;
}

// ============================================
// REPORTES
// ============================================
async function generarPDF() {
    try {
        const response = await fetch('/admin/reporte/usuarios/pdf');
        if (!response.ok) throw new Error('Error generando PDF');
        // Sesión expirada: Spring Security devuelve HTML del login en lugar del PDF
        const contentType = response.headers.get('Content-Type') || '';
        if (contentType.includes('text/html')) {
            showToast('Tu sesión expiró. Por favor inicia sesión nuevamente.', 'warning', 5000);
            setTimeout(() => { window.location.href = '/login'; }, 2000);
            return;
        }
        const blob = await response.blob();
        const url  = window.URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url;
        a.download = `reporte_usuarios_${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showToast('PDF generado correctamente', 'success');
    } catch (error) {
        showToast('Error al generar el PDF', 'error');
        console.error(error);
    }
}

async function generarExcel() {
    try {
        const response = await fetch('/admin/reporte/usuarios/excel');
        if (!response.ok) throw new Error('Error generando Excel');
        // Sesión expirada: Spring Security devuelve HTML del login en lugar del Excel
        const contentType = response.headers.get('Content-Type') || '';
        if (contentType.includes('text/html')) {
            showToast('Tu sesión expiró. Por favor inicia sesión nuevamente.', 'warning', 5000);
            setTimeout(() => { window.location.href = '/login'; }, 2000);
            return;
        }
        const blob = await response.blob();
        const url  = window.URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url;
        a.download = `reporte_usuarios_${Date.now()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showToast('Excel generado correctamente', 'success');
    } catch (error) {
        showToast('Error al generar el Excel', 'error');
        console.error(error);
    }
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

    const formData = new URLSearchParams();
    formData.append('correo', email);
    formData.append('asunto', subject);
    formData.append('mensaje', message);

    fetch('/admin/correo/unitario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
    })
        .then(r => r.json())
        .then(data => {
            if (data.status === 'success') {
                showToast(data.message, 'success');
                document.getElementById('emailSingle').value   = '';
                document.getElementById('subjectSingle').value = '';
                document.getElementById('messageSingle').value = '';
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

    if (invalidEmails.length > 0) {
        showToast(`Correos inválidos: ${invalidEmails.join(', ')}`, 'error', 6000);
        return;
    }
    if (emailList.length === 0) { showToast('Ingresa al menos un correo válido', 'warning'); return; }

    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    setBtnLoadingMail(btn, true);

    const formData = new URLSearchParams();
    emailList.forEach(email => formData.append('seleccionados', email));
    formData.append('asunto', subject);
    formData.append('mensaje', message);

    fetch('/admin/correo/masivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
    })
        .then(r => r.json())
        .then(data => {
            if (data.status === 'success') {
                showToast(data.message, 'success');
                document.getElementById('emailsMassive').value  = '';
                document.getElementById('subjectMassive').value = '';
                document.getElementById('messageMassive').value = '';
            } else {
                showToast(data.message || 'Error al enviar correos', 'error');
            }
        })
        .catch(() => showToast('Error de conexión. Intenta de nuevo.', 'error'))
        .finally(() => setBtnLoadingMail(btn, false, originalText));
}

// ============================================
// FUNCIONES DEL MENÚ PERFIL
// ============================================
function cerrarSesion() {
    showConfirm('Cerrar sesión', '¿Estás seguro de cerrar tu sesión?', 'Cerrar sesión', 'warning')
        .then(confirmado => {
            if (confirmado) window.location.href = '/logout';
        });
}

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
// DRAWER LATERAL — S-03 FIX
// Control del sidebar en tablet/mobile.
// Funciones separadas del resto de la lógica.
// ============================================

/**
 * Colapsa o expande el sidebar lateral.
 * Alterna la clase 'sidebar-collapsed' en <body>.
 * El estado se persiste en localStorage.
 */
function toggleSidebar() {
    const collapsed = document.body.classList.toggle('sidebar-collapsed');
    const btn       = document.getElementById('sidebarToggleBtn');
    if (btn) {
        btn.setAttribute('aria-label', collapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral');
    }
    try { localStorage.setItem('sidebar-collapsed', collapsed ? '1' : '0'); } catch(e) {}
}

// Restaura estado del sidebar al cargar la página
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
window.eliminarUsuario        = eliminarUsuario;
window.editarUsuario          = editarUsuario;
window.guardarEdicion         = guardarEdicion;
window.cerrarModalEdicion     = cerrarModalEdicion;
window.eliminarSede           = eliminarSede;
window.editarSede             = editarSede;
window.guardarEdicionSede     = guardarEdicionSede;
window.cerrarModalEdicionSede = cerrarModalEdicionSede;
window.generarPDF             = generarPDF;
window.generarExcel           = generarExcel;
window.mostrarDetallesSede    = mostrarDetallesSede;
window.cerrarModalSede        = cerrarModalSede;
window.toggleSidebar          = toggleSidebar;