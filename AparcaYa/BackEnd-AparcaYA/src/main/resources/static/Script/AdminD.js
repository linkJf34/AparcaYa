// ============================================
// CONFIGURACIÓN Y VARIABLES GLOBALES
// ============================================
const API_BASE_URL = '/admin/api';

const profileBtn = document.getElementById('profileBtn');
const profileDropdown = document.getElementById('profileDropdown');

// CAMBIO 1: 'nav.sidebar-nav a' → 'nav.aparca-sidebar-nav a'
// Razón: el HTML refactorizado usa class="aparca-sidebar-nav"
const navLinks = document.querySelectorAll('nav.aparca-sidebar-nav a');

// CAMBIO 2: 'section.content-section' → 'section.aparca-content-section'
// Razón: el HTML refactorizado usa class="aparca-content-section"
const sections = document.querySelectorAll('section.aparca-content-section');

let map = null;
let marcadores = [];
let usuarios = [];
let sedes = [];

// ============================================
// BASE DE DATOS DE COORDENADAS POR BARRIO
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
    'SAN_CRISTOBAL': {
        'San Blas': { lat: 4.56750, lon: -74.08570 },
        'San Cristóbal Norte': { lat: 4.56899, lon: -74.07589 },
        'La Victoria': { lat: 4.55229, lon: -74.09258 }
    },
    'USME': {
        'El Virrey': { lat: 4.50337, lon: -74.11264 },
        'Yomasa': { lat: 4.50786, lon: -74.10739 },
        'Usme Pueblo': { lat: 4.50500, lon: -74.11000 }
    },
    'TUNJUELITO': {
        'Parque El Tunal': { lat: 4.56980, lon: -74.12607 },
        'San Vicente': { lat: 4.57163, lon: -74.13528 },
        'Venecia': { lat: 4.58326, lon: -74.12687 }
    },
    'BOSA': {
        'Bosa Central': { lat: 4.62422, lon: -74.19751 },
        'Bosa Laureles': { lat: 4.62012, lon: -74.18435 },
        'El Porvenir': { lat: 4.61189, lon: -74.19077 }
    },
    'KENNEDY': {
        'Tintal': { lat: 4.65380, lon: -74.15485 },
        'Timiza': { lat: 4.62518, lon: -74.14894 },
        'Mandalay': { lat: 4.64537, lon: -74.13489 },
        'Carvajal': { lat: 4.61451, lon: -74.13925 },
        'Patio Bonito': { lat: 4.62797, lon: -74.14562 }
    },
    'FONTIBON': {
        'Capellanía': { lat: 4.70573, lon: -74.14212 },
        'Fontibón Centro': { lat: 4.70685, lon: -74.14830 },
        'Modelia': { lat: 4.70822, lon: -74.12956 }
    },
    'ENGATIVA': {
        'Ferias': { lat: 4.70242, lon: -74.11136 },
        'Boyacá Real': { lat: 4.70795, lon: -74.12487 },
        'Minuto de Dios': { lat: 4.70631, lon: -74.11425 }
    },
    'SUBA': {
        'Tibabuyes': { lat: 4.74512, lon: -74.07855 },
        'Niza': { lat: 4.72981, lon: -74.06324 },
        'Suba Centro': { lat: 4.74150, lon: -74.08160 },
        'La Campiña': { lat: 4.75233, lon: -74.09041 }
    },
    'BARRIOS_UNIDOS': {
        '7 de Agosto': { lat: 4.67722, lon: -74.08951 },
        'Doce de Octubre': { lat: 4.67485, lon: -74.08463 },
        'San Felipe': { lat: 4.67291, lon: -74.08274 }
    },
    'TEUSAQUILLO': {
        'La Soledad': { lat: 4.64485, lon: -74.07325 },
        'Quesada': { lat: 4.64371, lon: -74.06489 },
        'Campín': { lat: 4.66241, lon: -74.07652 }
    },
    'MARTIRES': {
        'Santa Isabel': { lat: 4.60992, lon: -74.07861 },
        'Eduardo Santos': { lat: 4.61134, lon: -74.06842 }
    },
    'ANTONIO_NARINO': {
        'Restrepo': { lat: 4.61108, lon: -74.10265 },
        'Eduardo Santos': { lat: 4.60732, lon: -74.09744 },
        'Policarpa': { lat: 4.60798, lon: -74.10476 }
    },
    'PUENTE_ARANDA': {
        'Ciudad Montes': { lat: 4.62874, lon: -74.11893 },
        'Torremolinos': { lat: 4.62412, lon: -74.11735 },
        'Salazar Gómez': { lat: 4.62651, lon: -74.12348 }
    },
    'CANDELARIA': {
        'La Catedral': { lat: 4.59864, lon: -74.07218 },
        'Egipto': { lat: 4.60112, lon: -74.07105 },
        'Las Aguas': { lat: 4.60395, lon: -74.06942 }
    },
    'RAFAEL_URIBE_URIBE': {
        'Bravo Páez': { lat: 4.59725, lon: -74.11987 },
        'Marruecos': { lat: 4.59788, lon: -74.12716 },
        'Quiroga': { lat: 4.58912, lon: -74.12698 }
    },
    'CIUDAD_BOLIVAR': {
        'Meissen': { lat: 4.58973, lon: -74.14761 },
        'Jerusalén': { lat: 4.59820, lon: -74.14217 },
        'Paraíso': { lat: 4.59884, lon: -74.15233 }
    },
    'SUMAPAZ': {
        'Nazareth': { lat: 4.32510, lon: -74.21243 },
        'Betania': { lat: 4.30987, lon: -74.19521 }
    }
};

// ============================================
// COORDENADAS CENTRALES POR LOCALIDAD (FALLBACK)
// ============================================
const COORDENADAS_LOCALIDADES = {
    'USAQUEN': { lat: 4.7110, lon: -74.0300 },
    'CHAPINERO': { lat: 4.6400, lon: -74.0620 },
    'SANTA_FE': { lat: 4.6097, lon: -74.0730 },
    'SAN_CRISTOBAL': { lat: 4.5700, lon: -74.0800 },
    'USME': { lat: 4.5100, lon: -74.1300 },
    'TUNJUELITO': { lat: 4.5800, lon: -74.1400 },
    'BOSA': { lat: 4.6200, lon: -74.1900 },
    'KENNEDY': { lat: 4.6280, lon: -74.1550 },
    'FONTIBON': { lat: 4.6800, lon: -74.1400 },
    'ENGATIVA': { lat: 4.7000, lon: -74.1100 },
    'SUBA': { lat: 4.7500, lon: -74.0800 },
    'BARRIOS_UNIDOS': { lat: 4.6700, lon: -74.0850 },
    'TEUSAQUILLO': { lat: 4.6400, lon: -74.0900 },
    'MARTIRES': { lat: 4.6000, lon: -74.0950 },
    'ANTONIO_NARINO': { lat: 4.5900, lon: -74.1100 },
    'PUENTE_ARANDA': { lat: 4.6200, lon: -74.1200 },
    'CANDELARIA': { lat: 4.5970, lon: -74.0730 },
    'RAFAEL_URIBE_URIBE': { lat: 4.5600, lon: -74.1200 },
    'CIUDAD_BOLIVAR': { lat: 4.5700, lon: -74.1800 },
    'SUMAPAZ': { lat: 4.2600, lon: -74.2900 }
};

// ============================================
// 1. OBTENER COORDENADAS POR BARRIO
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
                console.log(`📍 Match parcial de barrio: ${nombreBarrio}`);
                return coords;
            }
        }
    }

    return null;
}

// ============================================
// 2. OBTENER COORDENADAS POR LOCALIDAD (FALLBACK)
// ============================================
function obtenerCoordenadasPorLocalidad(localidad) {
    const localidadKey = (localidad || '').toUpperCase().trim();

    if (COORDENADAS_LOCALIDADES[localidadKey]) {
        return {
            lat: COORDENADAS_LOCALIDADES[localidadKey].lat + (Math.random() - 0.5) * 0.015,
            lon: COORDENADAS_LOCALIDADES[localidadKey].lon + (Math.random() - 0.5) * 0.015,
            fuente: 'localidad'
        };
    }

    console.log('📍 Usando centro de Bogotá (fallback final)');
    return {
        lat: 4.6533 + (Math.random() - 0.5) * 0.08,
        lon: -74.0836 + (Math.random() - 0.5) * 0.08,
        fuente: 'fallback'
    };
}

// ============================================
// 3. BUSCAR DIRECCIÓN ESPECÍFICA EN BARRIO
// ============================================
async function buscarDireccionEnBarrio(direccion, localidad, barrio, coordsBarrio) {
    try {
        const localidadFormateada = localidad
            ? localidad.replace(/_/g, ' ').toLowerCase()
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')
            : '';

        const estrategias = [
            `${direccion}, ${barrio}, ${localidadFormateada}, Bogotá, Colombia`,
            `${direccion}, ${barrio}, Bogotá, Colombia`,
            `${direccion}, ${localidadFormateada}, Bogotá, Colombia`,
            `${direccion}, Bogotá, Colombia`
        ];

        for (let i = 0; i < estrategias.length; i++) {
            const busqueda = estrategias[i];
            console.log(`  🔎 Estrategia ${i + 1}: ${busqueda}`);

            const latMin = coordsBarrio.lat - 0.018;
            const latMax = coordsBarrio.lat + 0.018;
            const lonMin = coordsBarrio.lon - 0.018;
            const lonMax = coordsBarrio.lon + 0.018;

            const url = `https://nominatim.openstreetmap.org/search?` +
                `format=json` +
                `&q=${encodeURIComponent(busqueda)}` +
                `&limit=5` +
                `&countrycodes=co` +
                `&bounded=1` +
                `&viewbox=${lonMin},${latMax},${lonMax},${latMin}` +
                `&addressdetails=1`;

            const response = await fetch(url, {
                headers: { 'User-Agent': 'AparcaYA/1.0 (admin@aparcaya.com)' }
            });

            if (response.ok) {
                const data = await response.json();

                if (data && data.length > 0) {
                    for (const resultado of data) {
                        const lat = parseFloat(resultado.lat);
                        const lon = parseFloat(resultado.lon);

                        const distancia = Math.sqrt(
                            Math.pow(lat - coordsBarrio.lat, 2) +
                            Math.pow(lon - coordsBarrio.lon, 2)
                        );

                        if (distancia < 0.018) {
                            console.log(`    ✅ Match a ${(distancia * 111).toFixed(2)}km del barrio`);
                            console.log(`    📌 ${resultado.display_name}`);
                            return {
                                lat: lat,
                                lon: lon,
                                fuente: 'direccion_especifica',
                                display_name: resultado.display_name
                            };
                        }
                    }
                }
            }

            if (i < estrategias.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 400));
            }
        }

    } catch (error) {
        console.warn('⚠️ Error buscando dirección específica:', error);
    }

    return null;
}

// ============================================
// 4. GEOCODIFICACIÓN GENERAL (SIN BARRIO)
// ============================================
async function geocodificarDireccionGeneral(direccion, localidad, barrio) {
    try {
        const localidadFormateada = localidad
            ? localidad.replace(/_/g, ' ').toLowerCase()
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')
            : '';

        const busqueda = `${direccion}, ${localidadFormateada}, Bogotá, Colombia`;
        console.log(`🌐 Geocodificación general: ${busqueda}`);

        const url = `https://nominatim.openstreetmap.org/search?` +
            `format=json` +
            `&q=${encodeURIComponent(busqueda)}` +
            `&limit=3` +
            `&countrycodes=co` +
            `&bounded=1` +
            `&viewbox=-74.25,4.45,-73.95,4.85`;

        const response = await fetch(url, {
            headers: { 'User-Agent': 'AparcaYA/1.0 (admin@aparcaya.com)' }
        });

        if (response.ok) {
            const data = await response.json();

            if (data && data.length > 0) {
                const resultado = data.find(r =>
                    r.display_name.toLowerCase().includes('bogotá') ||
                    r.display_name.toLowerCase().includes('bogota')
                ) || data[0];

                if (resultado) {
                    console.log(`✅ Geocodificación general exitosa`);
                    return {
                        lat: parseFloat(resultado.lat),
                        lon: parseFloat(resultado.lon),
                        fuente: 'api_general'
                    };
                }
            }
        }
    } catch (error) {
        console.warn('⚠️ Error en geocodificación general:', error);
    }

    return null;
}

// ============================================
// 5. GEOCODIFICACIÓN PRINCIPAL (FUNCIÓN PRINCIPAL)
// ============================================
async function geocodificarDireccion(direccion, localidad, barrio) {
    console.log(`🔍 Geocodificando: ${direccion}, Barrio: ${barrio}, Localidad: ${localidad}`);

    const coordsBarrio = obtenerCoordenadasPorBarrio(localidad, barrio);

    if (coordsBarrio) {
        console.log(`📍 Punto de referencia: ${barrio} (${coordsBarrio.lat}, ${coordsBarrio.lon})`);

        const coordsEspecificas = await buscarDireccionEnBarrio(direccion, localidad, barrio, coordsBarrio);

        if (coordsEspecificas) {
            console.log(`✅ Dirección específica encontrada con precisión de calle`);
            return coordsEspecificas;
        } else {
            console.log(`⚠️ No se encontró dirección específica, usando centro del barrio`);
            return {
                lat: coordsBarrio.lat + (Math.random() - 0.5) * 0.002,
                lon: coordsBarrio.lon + (Math.random() - 0.5) * 0.002,
                fuente: 'barrio'
            };
        }
    }

    console.log(`🌐 Intentando geocodificación general...`);
    const coordsGenerales = await geocodificarDireccionGeneral(direccion, localidad, barrio);

    if (coordsGenerales) {
        return coordsGenerales;
    }

    console.log(`📍 Usando coordenadas centrales de localidad: ${localidad}`);
    return obtenerCoordenadasPorLocalidad(localidad);
}


// ============================================
// INICIALIZACIÓN AL CARGAR LA PÁGINA
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard cargado correctamente');
    cargarIndicadores();
    cargarUsuarios();
    cargarSedes();
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
            profileBtn.setAttribute('aria-expanded', false);
        }
    });
}

// ============================================
// NAVEGACIÓN SIDEBAR
// ============================================
navLinks.forEach(link => {
    link.addEventListener('click', e => {
        e.preventDefault();
        console.log('Click en:', link.dataset.tab);

        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        const target = link.dataset.tab;
        sections.forEach(sec => {
            if (sec.id === target) {
                sec.classList.remove('hidden');
                console.log('Mostrando sección:', target);

                if (target === 'sedes' && !map) {
                    setTimeout(initMap, 100);
                }
                if (target === 'graficas') {
                    setTimeout(inicializarGraficas, 100);
                }
            } else {
                sec.classList.add('hidden');
            }
        });
    });
});


// ============================================
// CARGAR INDICADORES DEL DASHBOARD
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
    // CAMBIO 3: '.stats-card' → '.admin-stats-card'
    // Razón: el HTML refactorizado usa class="admin-stats-card"
    const cards = document.querySelectorAll('.admin-stats-card');
    if (!cards[index]) return;

    // CAMBIO 4: '.donut-text' → '.admin-donut-text'
    // Razón: el HTML refactorizado usa class="admin-donut-text"
    const textElement = cards[index].querySelector('.admin-donut-text');

    // CAMBIO 5: '.donut-segment' → '.admin-donut-segment'
    // Razón: el HTML refactorizado usa class="admin-donut-segment"
    const segmentElement = cards[index].querySelector('.admin-donut-segment');

    if (textElement) textElement.textContent = valor;
    if (segmentElement) {
        segmentElement.setAttribute('stroke-dasharray', `${porcentaje} 100`);
    }
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

        if (!usuarioId) {
            console.error('Usuario sin ID:', u);
            return '';
        }

        return `
        <tr>
            <td>${u.nombre || 'N/A'}</td>
            <td>${u.correo || 'N/A'}</td>
            <td>${u.telefono || 'N/A'}</td>
            <td>${u.rol ? u.rol.name || u.rol : 'N/A'}</td>
            <td>${u.estado || 'N/A'}</td>
            <td>
                <button class="btn-outline mr-2" onclick="editarUsuario(${usuarioId})">Editar</button>
                <button class="btn-danger" onclick="eliminarUsuario(${usuarioId})">Eliminar</button>
            </td>
        </tr>
        `;
    }).filter(Boolean).join('');
}

async function eliminarUsuario(id) {
    console.log('Eliminando usuario con ID:', id);

    if (!id) {
        alert('❌ ID de usuario inválido');
        console.error('ID recibido:', id);
        return;
    }

    const usuario = usuarios.find(u => {
        const usuarioId = u.id || u.idUsuario || u.usuario_id;
        return usuarioId == id;
    });

    if (!usuario) {
        alert('❌ Usuario no encontrado');
        console.error('Usuario no encontrado con ID:', id);
        return;
    }

    if (!confirm(`¿Estás seguro de eliminar a ${usuario.nombre}?\n\nEsta acción no se puede deshacer.`)) {
        return;
    }

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
        alert(`✅ ${data.mensaje || 'Usuario eliminado correctamente'}`);

        await cargarUsuarios();
        await cargarIndicadores();

    } catch (error) {
        console.error('Error eliminando usuario:', error);
        alert(`❌ No se pudo eliminar el usuario: ${error.message}`);
    }
}

// ============================================
// FUNCIÓN PARA ABRIR EL MODAL DE EDICIÓN
// ============================================
function editarUsuario(id) {
    console.log('Editando usuario con ID:', id);

    const usuario = usuarios.find(u => {
        const usuarioId = u.id || u.idUsuario || u.usuario_id;
        return usuarioId == id;
    });

    if (!usuario) {
        alert('❌ Usuario no encontrado');
        console.error('Usuario no encontrado con ID:', id);
        console.log('Usuarios disponibles:', usuarios);
        return;
    }

    document.getElementById('edit_usuario_id').value = id;
    document.getElementById('edit_nombre').value = usuario.nombre || '';
    document.getElementById('edit_email').value = usuario.correo || '';
    document.getElementById('edit_telefono').value = usuario.telefono || '';

    const rolValue = usuario.rol?.name || usuario.rol || 'CLIENTE';
    document.getElementById('edit_rol').value = rolValue;

    const estadoValue = (usuario.estado || 'ACTIVO').toUpperCase();
    document.getElementById('edit_estado').value = estadoValue;

    document.getElementById('modal_editar_usuario').showModal();
}

// ============================================
// FUNCIÓN PARA GUARDAR CAMBIOS DEL USUARIO
// ============================================
async function guardarEdicion() {
    const id = document.getElementById('edit_usuario_id').value;
    const nombre = document.getElementById('edit_nombre').value.trim();
    const email = document.getElementById('edit_email').value.trim();
    const telefono = document.getElementById('edit_telefono').value.trim();
    const rol = document.getElementById('edit_rol').value;
    const estado = document.getElementById('edit_estado').value;

    if (!nombre || !email || !rol) {
        alert('❌ Por favor completa todos los campos obligatorios');
        return;
    }

    if (!email.includes('@') || !email.includes('.')) {
        alert('❌ Por favor ingresa un email válido');
        return;
    }

    const usuarioActualizado = {
        nombre: nombre,
        correo: email,
        telefono: telefono || null,
        rol: rol,
        estado: estado
    };

    console.log('📤 Enviando datos:', usuarioActualizado);

    try {
        const response = await fetch(`${API_BASE_URL}/usuarios/actualizar/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(usuarioActualizado)
        });

        console.log('📥 Response status:', response.status);

        const data = await response.json();
        console.log('📥 Response data:', data);

        if (!response.ok) {
            throw new Error(data.mensaje || `Error ${response.status}: ${data.error || 'Error actualizando usuario'}`);
        }

        alert(`✅ ${data.mensaje || 'Usuario actualizado correctamente'}`);

        document.getElementById('modal_editar_usuario').close();

        await cargarUsuarios();
        await cargarIndicadores();

    } catch (error) {
        console.error('❌ Error completo:', error);
        alert(`❌ No se pudo actualizar el usuario: ${error.message}`);
    }
}

// ============================================
// FUNCIÓN PARA CERRAR MODAL DE EDICIÓN
// ============================================
function cerrarModalEdicion() {
    document.getElementById('modal_editar_usuario').close();
    document.getElementById('edit_usuario_id').value = '';
    document.getElementById('edit_nombre').value = '';
    document.getElementById('edit_email').value = '';
    document.getElementById('edit_telefono').value = '';
    document.getElementById('edit_rol').value = 'usuario';
    document.getElementById('edit_estado').value = 'activo';
}

// ============================================
// BÚSQUEDA Y FILTROS - USUARIOS (UNIFICADO)
// ============================================
const busquedaInput = document.getElementById('busquedaInput');
const filtroUnificado = document.getElementById('filtroUnificado');

if (busquedaInput) {
    busquedaInput.addEventListener('input', filtrarUsuarios);
}
if (filtroUnificado) {
    filtroUnificado.addEventListener('change', filtrarUsuarios);
}

function filtrarUsuarios() {
    const textoBusqueda = (busquedaInput?.value || '').toLowerCase();
    const filtroSeleccionado = filtroUnificado?.value || '';

    const usuariosFiltrados = usuarios.filter(usuario => {
        const nombre = (usuario.nombre || '').toLowerCase();
        const correo = (usuario.correo || '').toLowerCase();
        const rol = usuario.rol ? (usuario.rol.name || usuario.rol || '').toLowerCase() : '';
        const telefono = (usuario.telefono || '').toLowerCase();
        const estado = (usuario.estado || '').toLowerCase();

        const coincideTexto = nombre.includes(textoBusqueda) ||
            correo.includes(textoBusqueda) ||
            rol.includes(textoBusqueda) ||
            telefono.includes(textoBusqueda) ||
            estado.includes(textoBusqueda);

        let coincideFiltro = true;

        if (filtroSeleccionado) {
            const [tipo, valor] = filtroSeleccionado.split(':');

            if (tipo === 'estado') {
                coincideFiltro = estado === valor;
            } else if (tipo === 'rol') {
                const rolUsuario = usuario.rol ?
                    (usuario.rol.name || usuario.rol || '').toLowerCase() : '';
                coincideFiltro = rolUsuario === valor;
            }
        }

        return coincideTexto && coincideFiltro;
    });

    renderUsuarios(usuariosFiltrados);
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

        if (map) {
            agregarMarcadores();
        }

    } catch (error) {
        console.error('Error cargando sedes:', error);
    }
}

function renderSedes(sedesArray = sedes) {
    const tbody = document.getElementById('tbodySedes');
    if (!tbody) return;

    if (sedesArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500">No hay sedes registradas</td></tr>';
        return;
    }

    tbody.innerHTML = sedesArray.map(s => `
        <tr>
            <td>${s.nombre || 'N/A'}</td>
            <td>${s.direccion || 'N/A'}</td>
            <td>${s.capacidad || 'N/A'}</td>
            <td>${s.localidad || 'N/A'}</td>
            <td>${s.barrio || 'N/A'}</td>
            <td>${s.estado ? 'Activa' : 'Inactiva'}</td>
            <td>
                <button class="btn-outline mr-2" onclick="editarSede(${s.id})">Editar</button>
                <button class="btn-danger" onclick="eliminarSede(${s.id})">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

async function eliminarSede(id) {
    const sede = sedes.find(s => s.id === id);
    if (!sede) return;

    if (!confirm(`¿Estás seguro de eliminar ${sede.nombre}?`)) return;

    try {
        const response = await fetch(`${API_BASE_URL}/sedes/eliminar/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Error eliminando sede');

        const data = await response.json();
        alert(`✅ ${data.mensaje || 'Sede eliminada correctamente'}`);

        await cargarSedes();
        await cargarIndicadores();

    } catch (error) {
        console.error('Error eliminando sede:', error);
        alert('❌ No se pudo eliminar la sede');
    }
}

// ============================================
// FUNCIÓN PARA ABRIR EL MODAL DE EDICIÓN DE SEDE
// ============================================
function editarSede(id) {
    console.log('Editando sede con ID:', id);

    const sede = sedes.find(s => {
        const sedeId = s.id || s.idSede || s.sede_id;
        return sedeId == id;
    });

    if (!sede) {
        alert('❌ Sede no encontrada');
        console.error('Sede no encontrada con ID:', id);
        console.log('Sedes disponibles:', sedes);
        return;
    }

    document.getElementById('edit_sede_id').value = id;
    document.getElementById('edit_sede_nombre').value = sede.nombre || '';
    document.getElementById('edit_sede_direccion').value = sede.direccion || '';
    document.getElementById('edit_sede_capacidad').value = sede.capacidad || '';

    const estadoValue = (sede.estado || 'ACTIVO').toUpperCase();
    document.getElementById('edit_sede_estado').value = estadoValue;

    document.getElementById('modal_editar_sede').showModal();
}

// ============================================
// FUNCIÓN PARA GUARDAR CAMBIOS DE LA SEDE
// ============================================
async function guardarEdicionSede() {
    const id = document.getElementById('edit_sede_id').value;
    const nombre = document.getElementById('edit_sede_nombre').value.trim();
    const direccion = document.getElementById('edit_sede_direccion').value.trim();
    const capacidad = parseInt(document.getElementById('edit_sede_capacidad').value);
    const estado = document.getElementById('edit_sede_estado').value;

    if (!nombre || !direccion || !capacidad || !estado) {
        alert('❌ Por favor completa todos los campos obligatorios');
        return;
    }

    if (capacidad <= 0) {
        alert('❌ La capacidad debe ser mayor a 0');
        return;
    }

    const sedeActualizada = {
        nombre: nombre,
        direccion: direccion,
        capacidad: capacidad,
        estado: estado
    };

    console.log('📤 Enviando datos de sede:', sedeActualizada);

    try {
        const response = await fetch(`${API_BASE_URL}/sedes/actualizar/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sedeActualizada)
        });

        console.log('📥 Response status:', response.status);

        const data = await response.json();
        console.log('📥 Response data:', data);

        if (!response.ok) {
            throw new Error(data.mensaje || `Error ${response.status}: ${data.error || 'Error actualizando sede'}`);
        }

        alert(`✅ ${data.mensaje || 'Sede actualizada correctamente'}`);

        document.getElementById('modal_editar_sede').close();

        await cargarSedes();
        await cargarIndicadores();

    } catch (error) {
        console.error('❌ Error completo:', error);
        alert(`❌ No se pudo actualizar la sede: ${error.message}`);
    }
}

// ============================================
// FUNCIÓN PARA CERRAR EL MODAL DE SEDE
// ============================================
function cerrarModalEdicionSede() {
    document.getElementById('modal_editar_sede').close();
}

// ============================================
// BÚSQUEDA Y FILTROS - SEDES (UNIFICADO)
// ============================================
const busquedaSedes = document.getElementById('busquedaSedes');
const filtroUnificadoSedes = document.getElementById('filtroUnificadoSedes');

if (busquedaSedes) {
    busquedaSedes.addEventListener('input', filtrarSedes);
}
if (filtroUnificadoSedes) {
    filtroUnificadoSedes.addEventListener('change', filtrarSedes);
}

function filtrarSedes() {
    const textoBusqueda = (busquedaSedes?.value || '').toLowerCase();
    const filtroSeleccionado = filtroUnificadoSedes?.value || '';

    const sedesFiltradas = sedes.filter(sede => {
        const nombre = (sede.nombre || '').toLowerCase();
        const direccion = (sede.direccion || '').toLowerCase();
        const localidad = (sede.localidad || '').toLowerCase();
        const barrio = (sede.barrio || '').toLowerCase();
        const capacidad = String(sede.capacidad || '').toLowerCase();
        const estado = (sede.estado || '').toLowerCase();

        const coincideTexto = nombre.includes(textoBusqueda) ||
            direccion.includes(textoBusqueda) ||
            localidad.includes(textoBusqueda) ||
            barrio.includes(textoBusqueda) ||
            capacidad.includes(textoBusqueda) ||
            estado.includes(textoBusqueda);

        let coincideFiltro = true;

        if (filtroSeleccionado) {
            const [tipo, valor] = filtroSeleccionado.split(':');

            if (tipo === 'estado') {
                coincideFiltro = estado === valor;
            }
        }

        return coincideTexto && coincideFiltro;
    });

    renderSedes(sedesFiltradas);
}

// ============================================
// MAPA LEAFLET
// ============================================
function initMap() {
    // CAMBIO 6: 'map-container' → 'admin-map-container'
    // Razón: el HTML refactorizado usa id="admin-map-container"
    const mapContainer = document.getElementById('admin-map-container');
    if (!mapContainer || map) return;

    // CAMBIO 7: L.map('map-container') → L.map('admin-map-container')
    // Razón: Leaflet debe inicializarse con el mismo ID del elemento HTML
    map = L.map('admin-map-container').setView([4.6533, -74.0836], 12);

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

    console.log(`📌 Agregando ${sedes.length} marcadores al mapa...`);

    for (const sede of sedes) {
        const coords = await geocodificarDireccion(sede.direccion, sede.localidad, sede.barrio);

        if (coords) {
            const iconColor = sede.estado === 'ACTIVO' ? '#34a853' : '#dc2626';
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

            const marker = L.marker([coords.lat, coords.lon], { icon: customIcon })
                .addTo(map);

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
                        onclick="mostrarDetallesSede(${sede.id})"
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
                            transition: background 0.3s;
                        "
                        onmouseover="this.style.background='#0284c7'"
                        onmouseout="this.style.background='#00BFFF'"
                    >
                        Ver detalles completos
                    </button>
                </div>
            `;

            marker.bindPopup(popupContent, {
                maxWidth: 300,
                className: 'custom-popup'
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
// MODAL DE DETALLES DE SEDE
// ============================================
function mostrarDetallesSede(sedeId) {
    const sede = sedes.find(s => s.id === sedeId);
    if (!sede) return;

    const modalBody = document.getElementById('modalSedeBody');
    const modalTitle = document.getElementById('modalSedeTitle');

    modalTitle.textContent = sede.nombre;

    const estadoBadge = sede.estado === 'ACTIVO'
        ? '<span class="badge badge-activo">✓ Activa</span>'
        : '<span class="badge badge-inactivo">✗ Inactiva</span>';

    modalBody.innerHTML = `
        <div class="info-grid">
            <div class="info-item info-full">
                <div class="info-label">Estado</div>
                <div class="info-value">${estadoBadge}</div>
            </div>

            <div class="info-item">
                <div class="info-label">📋 NIT</div>
                <div class="info-value">${sede.nit || 'N/A'}</div>
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
                <div class="info-label">📌 Dirección Completa</div>
                <div class="info-value">${sede.direccion}</div>
            </div>

            <div class="info-item info-full">
                <div class="info-label">💰 Tarifas</div>
                <div class="info-value" style="line-height: 1.8;">
                    <strong>🚗 Carros:</strong><br>
                    &nbsp;&nbsp;• Tarifa hora plena: $${sede.tarifaPlenaC?.toLocaleString('es-CO') || 'N/A'} COP<br>
                    &nbsp;&nbsp;• Tarifa por minuto: $${sede.tarifaMinutoC?.toLocaleString('es-CO') || 'N/A'} COP<br>
                    <br>
                    <strong>🏍️ Motos:</strong><br>
                    &nbsp;&nbsp;• Tarifa hora plena: $${sede.tarifaPlenaM?.toLocaleString('es-CO') || 'N/A'} COP<br>
                    &nbsp;&nbsp;• Tarifa por minuto: $${sede.tarifaMinutoM?.toLocaleString('es-CO') || 'N/A'} COP
                </div>
            </div>

            <div class="info-item info-full">
                <div class="info-label">🕐 Horario de Atención</div>
                <div class="info-value">${sede.horarioSede || 'No especificado'}</div>
            </div>

            ${sede.latitud && sede.longitud ? `
            <div class="info-item info-full">
                <div class="info-label">🌍 Coordenadas</div>
                <div class="info-value">
                    Lat: ${sede.latitud.toFixed(6)}, Lng: ${sede.longitud.toFixed(6)}
                </div>
            </div>
            ` : ''}
        </div>

        <div style="margin-top: 1.5rem; display: flex; gap: 1rem; justify-content: flex-end;">
            <button
                class="btn-outline"
                onclick="editarSede(${sede.id}); cerrarModalSede();"
            >
                Editar Sede
            </button>
            <button
                class="btn-danger"
                onclick="if(confirm('¿Eliminar ${sede.nombre}?')) { eliminarSede(${sede.id}); cerrarModalSede(); }"
            >
                Eliminar
            </button>
        </div>
    `;

    const modal = document.getElementById('modalSede');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
}

function cerrarModalSede() {
    const modal = document.getElementById('modalSede');
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
}

document.getElementById('modalSede')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalSede') {
        cerrarModalSede();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        cerrarModalSede();
    }
});

// ============================================
// GRÁFICAS CON CHART.JS
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
        if (!response.ok) throw new Error('Error cargando gráfica de ingresos');

        const data = await response.json();

        if (chartIngresos) chartIngresos.destroy();

        const canvas = document.getElementById('chartIngresos');
        if (!canvas) return;

        chartIngresos = new Chart(canvas, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Ingresos ($)',
                    data: data.data,
                    borderColor: '#00BFFF',
                    backgroundColor: 'rgba(0,191,255,0.2)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { position: 'top' } }
            }
        });

    } catch (error) {
        console.error('Error cargando gráfica de ingresos:', error);
    }
}

async function cargarGraficaUsuarios() {
    try {
        const response = await fetch(`${API_BASE_URL}/grafica/usuarios-rol`);
        if (!response.ok) throw new Error('Error cargando gráfica de usuarios');

        const data = await response.json();

        if (chartUsuarios) chartUsuarios.destroy();

        const canvas = document.getElementById('chartUsuarios');
        if (!canvas) return;

        chartUsuarios = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Número de Usuarios',
                    data: data.data,
                    backgroundColor: ['#34a853', '#00bfa5', '#3b82f6'],
                    borderColor: ['#34a853', '#00bfa5', '#3b82f6'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { position: 'top' } }
            }
        });

    } catch (error) {
        console.error('Error cargando gráfica de usuarios:', error);
    }
}

async function cargarGraficaSedes() {
    try {
        const response = await fetch(`${API_BASE_URL}/grafica/sedes`);
        if (!response.ok) throw new Error('Error cargando gráfica de sedes');

        const data = await response.json();

        if (chartSedes) chartSedes.destroy();

        const canvas = document.getElementById('chartSedes');
        if (!canvas) return;

        chartSedes = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Capacidad',
                    data: data.data,
                    backgroundColor: '#f59e0b',
                    borderColor: '#f59e0b',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { position: 'top' } }
            }
        });

    } catch (error) {
        console.error('Error cargando gráfica de sedes:', error);
    }
}

// ============================================
// FUNCIONES PARA LOS GRÁFICOS DONUT
// ============================================

async function cargarEstadisticasDonut() {
    try {
        const response = await fetch(`${API_BASE_URL}/estadisticas/generales`);
        if (!response.ok) throw new Error('Error cargando estadísticas');

        const data = await response.json();

        // CAMBIO 8: '.usuario-segment' → '.admin-usuario-segment'
        // CAMBIO 9: '.cuota-segment'   → '.admin-cuota-segment'
        // CAMBIO 10: '.ingresos-segment' → '.admin-ingresos-segment'
        // Razón: el HTML refactorizado usa prefijo admin- en todas las clases de donut
        actualizarTextoDonut('.admin-usuario-segment', data.totalUsuarios || 7);
        actualizarTextoDonut('.admin-cuota-segment', data.totalSedes || 2);
        actualizarTextoDonut('.admin-ingresos-segment', formatearIngresos(data.ingresosTotal || 85000));

        animarDonut('.admin-usuario-segment', data.totalUsuarios, data.metaUsuarios || 10);
        animarDonut('.admin-cuota-segment', data.totalSedes, data.metaSedes || 5);
        animarDonut('.admin-ingresos-segment', data.ingresosTotal, data.metaIngresos || 100000);

    } catch (error) {
        console.error('Error cargando estadísticas donut:', error);
        cargarEstadisticasDefault();
    }
}

function cargarEstadisticasDefault() {
    actualizarTextoDonut('.admin-usuario-segment', 7);
    actualizarTextoDonut('.admin-cuota-segment', 2);
    actualizarTextoDonut('.admin-ingresos-segment', '85K');

    animarDonut('.admin-usuario-segment', 7, 10);
    animarDonut('.admin-cuota-segment', 2, 5);
    animarDonut('.admin-ingresos-segment', 85000, 100000);
}

function actualizarTextoDonut(selector, valor) {
    const circle = document.querySelector(selector);
    if (!circle) return;

    const container = circle.closest('.admin-donut-container');
    const textElement = container.querySelector('.admin-donut-text');

    if (textElement) {
        textElement.textContent = valor;
    }
}

function animarDonut(selector, valorActual, valorMaximo) {
    const circle = document.querySelector(selector);
    if (!circle) return;

    const porcentaje = Math.min((valorActual / valorMaximo) * 100, 100);
    const circumference = 2 * Math.PI * 15.9155;
    const fillAmount = (porcentaje / 100) * circumference;

    setTimeout(() => {
        circle.style.strokeDasharray = `${fillAmount} ${circumference}`;
    }, 100);
}

function formatearIngresos(valor) {
    if (valor >= 1000000) {
        return `$${(valor / 1000000).toFixed(1)}M`;
    } else if (valor >= 1000) {
        return `$${Math.round(valor / 1000)}K`;
    }
    return `$${valor}`;
}

document.addEventListener('DOMContentLoaded', function() {
    cargarEstadisticasDonut();
});

// ============================================
// GENERACIÓN DE REPORTES
// ============================================
async function generarPDF() {
    try {
        const response = await fetch('/admin/reporte/usuarios/pdf');
        const blob = await response.blob();

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_usuarios_${new Date().getTime()}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        alert('Error al generar el PDF');
        console.error(error);
    }
}

async function generarExcel() {
    try {
        const response = await fetch('/admin/reporte/usuarios/excel');
        const blob = await response.blob();

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_usuarios_${new Date().getTime()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        alert('Error al generar el Excel');
        console.error(error);
    }
}


// ==================== ENVÍO DE CORREOS ====================
function setupMailTabs() {
    // CAMBIO 11: '#correos .tabs button' → '#correos .aparca-tabs button'
    // Razón: el HTML refactorizado usa class="aparca-tabs" en vez de class="tabs"
    const tabsBtns = document.querySelectorAll('#correos .aparca-tabs button');
    const mailPanels = [
        document.getElementById('correoUnitario'),
        document.getElementById('correoMasivo')
    ];

    tabsBtns.forEach((btn, idx) => {
        btn.addEventListener('click', () => {
            tabsBtns.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });

            mailPanels.forEach(panel => panel.hidden = true);

            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
            mailPanels[idx].hidden = false;
        });
    });
}

function enviarCorreoUnitario() {
    console.log('📧 Enviando correo uno a uno...');

    const email = document.getElementById('emailSingle').value.trim();
    const subject = document.getElementById('subjectSingle').value.trim();
    const message = document.getElementById('messageSingle').value.trim();

    if (!email || !subject || !message) {
        alert('⚠️ Por favor, completa todos los campos.');
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert('⚠️ Por favor, ingresa un correo válido.');
        return;
    }

    const formData = new URLSearchParams();
    formData.append('correo', email);
    formData.append('asunto', subject);
    formData.append('mensaje', message);

    const button = event.target.querySelector('button[type="submit"]');
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span>Enviando...</span>';

    fetch('/admin/correo/unitario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
    })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                alert('✅ ' + data.message);
                document.getElementById('emailSingle').value = '';
                document.getElementById('subjectSingle').value = '';
                document.getElementById('messageSingle').value = '';
            } else {
                alert('❌ ' + data.message);
            }
        })
        .catch(error => {
            console.error('❌ Error enviando correo:', error);
            alert('❌ Error al enviar correo. Por favor, intenta de nuevo.');
        })
        .finally(() => {
            button.disabled = false;
            button.innerHTML = originalText;
        });
}

function enviarCorreoMasivo() {
    console.log('📧 Enviando correo masivo...');

    const emails = document.getElementById('emailsMassive').value.trim();
    const subject = document.getElementById('subjectMassive').value.trim();
    const message = document.getElementById('messageMassive').value.trim();

    if (!emails || !subject || !message) {
        alert('⚠️ Por favor, completa todos los campos.');
        return;
    }

    const emailList = emails.split(',').map(e => e.trim()).filter(e => e);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const invalidEmails = emailList.filter(email => !emailRegex.test(email));
    if (invalidEmails.length > 0) {
        alert('⚠️ Los siguientes correos no son válidos:\n' + invalidEmails.join(', '));
        return;
    }

    if (emailList.length === 0) {
        alert('⚠️ Por favor, ingresa al menos un correo válido.');
        return;
    }

    const formData = new URLSearchParams();
    emailList.forEach(email => {
        formData.append('seleccionados', email);
    });
    formData.append('asunto', subject);
    formData.append('mensaje', message);

    const button = event.target.querySelector('button[type="submit"]');
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span>Enviando...</span>';

    fetch('/admin/correo/masivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
    })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                alert('✅ ' + data.message);
                document.getElementById('emailsMassive').value = '';
                document.getElementById('subjectMassive').value = '';
                document.getElementById('messageMassive').value = '';
            } else {
                alert('❌ ' + data.message);
            }
        })
        .catch(error => {
            console.error('❌ Error enviando correos:', error);
            alert('❌ Error al enviar correos. Por favor, intenta de nuevo.');
        })
        .finally(() => {
            button.disabled = false;
            button.innerHTML = originalText;
        });
}

document.addEventListener('DOMContentLoaded', function() {
    setupMailTabs();

    const formUnitario = document.getElementById('formCorreoUnitario');
    if (formUnitario) {
        formUnitario.addEventListener('submit', function(e) {
            e.preventDefault();
            enviarCorreoUnitario();
        });
    }

    const formMasivo = document.getElementById('formCorreoMasivo');
    if (formMasivo) {
        formMasivo.addEventListener('submit', function(e) {
            e.preventDefault();
            enviarCorreoMasivo();
        });
    }
});

// ============================================
// EXPONER FUNCIONES GLOBALES
// ============================================
window.eliminarUsuario = eliminarUsuario;
window.editarUsuario = editarUsuario;
window.guardarEdicion = guardarEdicion;
window.cerrarModalEdicion = cerrarModalEdicion;
window.eliminarSede = eliminarSede;
window.editarSede = editarSede;
window.guardarEdicionSede = guardarEdicionSede;
window.cerrarModalEdicionSede = cerrarModalEdicionSede;
window.generarPDF = generarPDF;
window.generarExcel = generarExcel;
window.mostrarDetallesSede = mostrarDetallesSede;
window.cerrarModalSede = cerrarModalSede;

// ============================================
// FUNCIONES DEL MENÚ PERFIL
// ============================================
function cerrarSesion() {
    if (confirm('¿Estás seguro de cerrar sesión?')) {
        window.location.href = '/logout';
    }
}

function irConfiguracion() {
    const configLink = document.querySelector('[data-tab="configuracion"]');
    if (configLink) {
        configLink.click();
        profileDropdown.classList.remove('show');
    }
}

function irAyuda() {
    alert('Sección de ayuda\n\nPróximamente: documentación y tutoriales');
}