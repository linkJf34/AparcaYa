// ==================== CONFIGURACIÓN GLOBAL ====================
const API_BASE_URL = '/api/sede';
const API_TRABAJADOR_URL = '/api/trabajador';

// Variables globales Sede
let usuariosData = [];
let sedesData = [];
let currentTab = 'usuarios';

// Variables globales Trabajador
let currentRegistroId = null;
let currentSalidaRegistroId = null;
let currentCobroRegistroId = null;
let opcionesTarifa = null;
let updateInterval = null;
let timerIntervals = {};

// Datos de marcas por tipo de vehículo
const marcasPorTipo = {
    CARRO: [
        "RENAULT", "KIA", "TOYOTA", "CHEVROLET", "MAZDA", "NISSAN", "VOLKSWAGEN",
        "FORD", "HYUNDAI", "BMW", "MERCEDES_BENZ", "AUDI", "PEUGEOT", "CITROEN",
        "FIAT", "VOLVO", "JEEP", "LAND_ROVER", "PORSCHE", "FERRARI", "LAMBORGHINI",
        "TESLA", "BYD", "CHANGAN", "GEELY", "JAC", "CHERY", "GREAT_WALL", "HAVAL",
        "GWM", "MITSUBISHI", "SUBARU", "ISUZU", "SSANGYONG", "MG", "RAM", "DFSK",
        "FOTON", "OTRO"
    ],
    MOTO: [
        "HONDA", "YAMAHA", "SUZUKI", "KAWASAKI", "BAJAJ", "TVS", "HERO", "KTM",
        "DUCATI", "HARLEY_DAVIDSON", "BMW_MOTORRAD", "TRIUMPH", "ROYAL_ENFIELD",
        "AUTECO", "AKT", "VICTORY", "APRILIA", "BENELLI", "HUSQVARNA", "OTRO"
    ],
    BICICLETA: [
        "TREK", "SPECIALIZED", "GIANT", "SCOTT", "CANNONDALE", "ORBEA", "GW",
        "SHIMANO", "BIANCHI", "MERIDA", "CUBE", "BMC", "FOCUS", "OTRO"
    ],
    OTRO: ["OTRO"]
};

// ==================== UTILIDADES ====================
function getToken() {
    return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
}

function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
}

function getInputValue(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleString('es-CO', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    } catch {
        return dateString;
    }
}

function formatNumber(number) {
    if (number == null) return '0';
    return Number(number).toLocaleString('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}

function showNotification(message, type = 'info') {
    const existing = document.querySelectorAll('.toast-notification');
    existing.forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.style.cssText = `
        position: fixed; top: 80px; right: 20px; padding: 1rem 1.5rem;
        border-radius: 0.5rem; color: white; font-weight: 600; z-index: 9999;
        animation: aparca-slideUp 0.3s ease-out; max-width: 400px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;

    const colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
    toast.style.backgroundColor = colors[type] || colors.info;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease-in';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function formatMarcaName(marca) {
    const map = {
        'MERCEDES_BENZ': 'Mercedes-Benz', 'LAND_ROVER': 'Land Rover',
        'GREAT_WALL': 'Great Wall', 'BMW_MOTORRAD': 'BMW Motorrad',
        'HARLEY_DAVIDSON': 'Harley-Davidson', 'ROYAL_ENFIELD': 'Royal Enfield'
    };
    return map[marca] || marca.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
}

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Inicializando Dashboard Sede AparcaYA...');
    initializeApp();
    initializeTrabajadorFeatures();
    injectAdditionalStyles();
});

function initializeApp() {
    setupEventListeners();
    cargarUsuarios();
    cargarSedes();
    setupSidebarToggle();
    setupProfileMenu();
}

function initializeTrabajadorFeatures() {
    initializeFormularioEntrada();
    initializeMarcas();
    setupGlobalEventDelegation();

    updateInterval = setInterval(() => {
        const activeTab = document.querySelector('.aparca-sidebar-nav a.active')?.getAttribute('data-tab');
        if (activeTab === 'gestion') {
            loadVehiculosActivos();
            loadPendientesCobro();
        }
    }, 30000);
}

// ==================== NAVEGACIÓN ====================
function setupEventListeners() {
    document.querySelectorAll('.aparca-sidebar-nav a').forEach(link => {
        link.addEventListener('click', handleNavigation);
    });

    document.getElementById('btnUsuarios')?.addEventListener('click', () => switchToTab('usuarios'));
    document.getElementById('btnSedes')?.addEventListener('click', () => switchToTab('sedes'));

    document.getElementById('tab-mailuno')?.addEventListener('click', () => switchMailTab('uno'));
    document.getElementById('tab-mailmasivo')?.addEventListener('click', () => switchMailTab('masivo'));

    document.getElementById('busquedaInput')?.addEventListener('input', filtrarDatos);
    document.getElementById('filtroEstado')?.addEventListener('change', filtrarDatos);
}

function handleNavigation(e) {
    e.preventDefault();

    document.querySelectorAll('.aparca-sidebar-nav a').forEach(link => {
        link.classList.remove('active');
    });
    e.currentTarget.classList.add('active');

    const tab = e.currentTarget.getAttribute('data-tab');

    document.querySelectorAll('.aparca-content-section').forEach(section => {
        section.classList.add('hidden');
    });
    document.getElementById(tab)?.classList.remove('hidden');

    switch(tab) {
        case 'gestion':
            loadVehiculosActivos();
            loadPendientesCobro();
            break;
        case 'historial':
            loadHistorial();
            break;
        case 'reservaciones':
            loadReservaciones();
            break;
    }
}

function switchToTab(tab) {
    currentTab = tab;

    document.querySelectorAll('.sede-tabs button').forEach(btn => {
        btn.classList.remove('active');
    });

    if (tab === 'usuarios') {
        document.getElementById('btnUsuarios').classList.add('active');
        document.getElementById('tablaUsuarios').classList.remove('hidden');
        document.getElementById('tablaSedes').classList.add('hidden');
    } else {
        document.getElementById('btnSedes').classList.add('active');
        document.getElementById('tablaUsuarios').classList.add('hidden');
        document.getElementById('tablaSedes').classList.remove('hidden');
    }
    filtrarDatos();
}

function switchMailTab(tipo) {
    document.querySelectorAll('#correo .sede-tabs button').forEach(btn => {
        btn.classList.remove('active');
    });

    if (tipo === 'uno') {
        document.getElementById('tab-mailuno').classList.add('active');
        document.getElementById('correoUno').removeAttribute('hidden');
        document.getElementById('correoMasivo').setAttribute('hidden', '');
    } else {
        document.getElementById('tab-mailmasivo').classList.add('active');
        document.getElementById('correoUno').setAttribute('hidden', '');
        document.getElementById('correoMasivo').removeAttribute('hidden');
    }
}

// ==================== CARGA DE DATOS SEDE ====================
async function cargarUsuarios() {
    try {
        const response = await fetch(`${API_BASE_URL}/usuarios`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        if (response.ok) {
            usuariosData = await response.json();
            mostrarUsuarios(usuariosData);
        } else {
            console.error('Error al cargar usuarios:', response.status);
            showNotification('No se pudieron cargar los usuarios', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error de conexión al cargar usuarios', 'error');
    }
}

async function cargarSedes() {
    try {
        const response = await fetch(`${API_BASE_URL}/sedes`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        if (response.ok) {
            sedesData = await response.json();
            mostrarSedes(sedesData);
        } else {
            console.error('Error al cargar sedes:', response.status);
            showNotification('No se pudieron cargar las sedes', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error de conexión al cargar sedes', 'error');
    }
}

// ==================== VISUALIZACIÓN DE DATOS ====================
function mostrarUsuarios(usuarios) {
    const tbody = document.getElementById('usuariosTableBody');
    if (!tbody) return;

    if (usuarios.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #64748b;">No hay clientes registrados</td></tr>';
        return;
    }

    tbody.innerHTML = usuarios.map(usuario => `
        <tr>
            <td>${usuario.nombre || 'N/A'}</td>
            <td>${usuario.correo || 'N/A'}</td>
            <td><span class="sede-badge sede-badge-info">${usuario.rol || 'N/A'}</span></td>
            <td>
                <span class="sede-badge ${usuario.estado === 'ACTIVO' ? 'sede-badge-success' : 'sede-badge-danger'}">
                    ${usuario.estado || 'N/A'}
                </span>
            </td>
            <td>
                <button class="sede-btn-icon sede-btn-edit" onclick="editarUsuario(${usuario.id})" title="Editar">✏️</button>
                <button class="sede-btn-icon sede-btn-delete" onclick="eliminarUsuario(${usuario.id})" title="Eliminar">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function mostrarSedes(sedes) {
    const tbody = document.getElementById('sedesTableBody');
    if (!tbody) return;

    if (sedes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #64748b;">No tiene sede asignada</td></tr>';
        return;
    }

    tbody.innerHTML = sedes.map(sede => `
        <tr>
            <td>${sede.nombre || 'N/A'}</td>
            <td>${sede.direccion || 'N/A'}</td>
            <td>${sede.capacidad || 0}</td>
            <td>
                <span class="sede-badge ${sede.estado === 'ACTIVO' ? 'sede-badge-success' : 'sede-badge-danger'}">
                    ${sede.estado || 'N/A'}
                </span>
            </td>
            <td>
                <button class="sede-btn-icon sede-btn-edit" onclick="editarSede(${sede.id})" title="Editar">✏️</button>
            </td>
        </tr>
    `).join('');
}

// ==================== FILTRADO ====================
function filtrarDatos() {
    const busqueda = document.getElementById('busquedaInput')?.value.toLowerCase() || '';
    const estado = document.getElementById('filtroEstado')?.value.toLowerCase() || '';

    if (currentTab === 'usuarios') {
        const usuariosFiltrados = usuariosData.filter(usuario => {
            const matchBusqueda = !busqueda ||
                (usuario.nombre?.toLowerCase().includes(busqueda) ||
                    usuario.correo?.toLowerCase().includes(busqueda) ||
                    usuario.rol?.toLowerCase().includes(busqueda));
            const matchEstado = !estado || usuario.estado?.toLowerCase() === estado;
            return matchBusqueda && matchEstado;
        });
        mostrarUsuarios(usuariosFiltrados);
    } else {
        const sedesFiltradas = sedesData.filter(sede => {
            const matchBusqueda = !busqueda ||
                (sede.nombre?.toLowerCase().includes(busqueda) ||
                    sede.direccion?.toLowerCase().includes(busqueda));
            const matchEstado = !estado || sede.estado?.toLowerCase() === estado;
            return matchBusqueda && matchEstado;
        });
        mostrarSedes(sedesFiltradas);
    }
}

// ==================== MARCAS DE VEHÍCULOS ====================
function actualizarMarcasEntrada() {
    const tipoSelect = document.getElementById('tipoVehiculo');
    const marcaSelect = document.getElementById('marca');
    if (!tipoSelect || !marcaSelect) return;

    const tipo = tipoSelect.value;
    marcaSelect.innerHTML = '<option value="">Selecciona una marca</option>';

    if (tipo && marcasPorTipo[tipo]) {
        marcasPorTipo[tipo].forEach(marca => {
            const option = document.createElement('option');
            option.value = marca;
            option.textContent = formatMarcaName(marca);
            marcaSelect.appendChild(option);
        });
    }
}

function initializeMarcas() {
    const tipoSelect = document.getElementById('tipoVehiculo');
    if (tipoSelect) {
        tipoSelect.addEventListener('change', actualizarMarcasEntrada);
        actualizarMarcasEntrada();
    }
}

// ==================== VALIDACIÓN DE FORMULARIO ====================
function validateFieldEntrada(fieldId) {
    const field = document.getElementById(fieldId);
    const errorSpan = document.getElementById(`${fieldId}-error`);
    if (!field) return true;

    let isValid = true;
    let message = '';
    const value = field.value.trim();

    switch(fieldId) {
        case 'nombre':
            if (!value) { isValid = false; message = 'El nombre es obligatorio.'; }
            else if (value.length < 2) { isValid = false; message = 'Al menos 2 caracteres.'; }
            break;
        case 'correo1':
            if (!value) { isValid = false; message = 'El correo es obligatorio.'; }
            else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { isValid = false; message = 'Formato inválido.'; }
            break;
        case 'telefono':
            if (!value) { isValid = false; message = 'El teléfono es obligatorio.'; }
            else if (!/^[0-9]{10}$/.test(value)) { isValid = false; message = 'Debe tener 10 dígitos.'; }
            break;
        case 'cedula':
            if (!value) { isValid = false; message = 'La cédula es obligatoria.'; }
            else if (!/^[0-9]{10}$/.test(value)) { isValid = false; message = 'Debe tener 10 dígitos.'; }
            break;
        case 'placa':
            if (!value) { isValid = false; message = 'La placa es obligatoria.'; }
            else if (!/^[A-Z]{3}[0-9]{3}$/.test(value)) { isValid = false; message = 'Formato: ABC123'; }
            break;
        case 'tipoVehiculo':
            if (!value) { isValid = false; message = 'Selecciona el tipo.'; }
            break;
        case 'marca':
            if (!value) { isValid = false; message = 'Selecciona la marca.'; }
            break;
    }

    if (errorSpan) errorSpan.textContent = isValid ? '' : message;
    field.classList.toggle('border-red-500', !isValid);
    field.classList.toggle('border-green-500', isValid && value !== '');

    return isValid;
}

function validateFormularioEntrada() {
    const campos = ['nombre', 'correo1', 'telefono', 'cedula', 'placa', 'tipoVehiculo', 'marca'];
    let todosValidos = true;
    campos.forEach(campoId => {
        if (!validateFieldEntrada(campoId)) todosValidos = false;
    });
    return todosValidos;
}

function limpiarFormularioEntrada() {
    ['nombre', 'telefono', 'correo1', 'cedula', 'placa', 'color', 'anio', 'buscarPlaca'].forEach(id => setInputValue(id, ''));

    const tipoSelect = document.getElementById('tipoVehiculo');
    if (tipoSelect) tipoSelect.value = '';

    const marcaSelect = document.getElementById('marca');
    if (marcaSelect) marcaSelect.innerHTML = '<option value="">Selecciona una marca</option>';

    ['nombre', 'correo1', 'telefono', 'cedula', 'placa', 'tipoVehiculo', 'marca'].forEach(fieldId => {
        const errorSpan = document.getElementById(`${fieldId}-error`);
        if (errorSpan) errorSpan.textContent = '';
        const field = document.getElementById(fieldId);
        if (field) field.classList.remove('border-red-500', 'border-green-500');
    });
}

// ==================== FORMULARIO ENTRADA ====================
function initializeFormularioEntrada() {
    const registroForm = document.getElementById('registroEntradaForm');

    if (registroForm) {
        registroForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await registrarEntradaDirecto();
        });

        const campos = ['nombre', 'telefono', 'correo1', 'cedula', 'placa', 'tipoVehiculo', 'marca'];
        campos.forEach(campoId => {
            const campo = document.getElementById(campoId);
            if (campo) {
                campo.addEventListener('blur', () => validateFieldEntrada(campoId));
                campo.addEventListener('input', () => {
                    const errorSpan = document.getElementById(`${campoId}-error`);
                    if (errorSpan && campo.value.trim()) {
                        errorSpan.textContent = '';
                        campo.classList.remove('border-red-500');
                    }
                });
            }
        });

        const telefonoInput = document.getElementById('telefono');
        if (telefonoInput) {
            telefonoInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
            });
        }

        const cedulaInput = document.getElementById('cedula');
        if (cedulaInput) {
            cedulaInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
            });
        }

        const placaInput = document.getElementById('placa');
        if (placaInput) {
            placaInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 6);
            });
        }
    }

    const buscarPlacaInput = document.getElementById('buscarPlaca');
    if (buscarPlacaInput) {
        buscarPlacaInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        });
        buscarPlacaInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); buscarPorPlacaIntegrado(); }
        });
    }
}

async function registrarEntradaDirecto() {
    console.log('🔄 Registrando entrada en parqueadero...');

    if (!validateFormularioEntrada()) {
        showNotification('❌ Completa todos los campos correctamente', 'error');
        return;
    }

    try {
        showNotification('⏳ Registrando entrada...', 'info');

        const datos = {
            clienteNombre:    getInputValue('nombre'),
            clienteTelefono:  getInputValue('telefono'),
            clienteEmail:     getInputValue('correo1'),
            clienteCedula:    getInputValue('cedula'),
            vehiculoPlaca:    getInputValue('placa'),
            vehiculoTipo:     getInputValue('tipoVehiculo'),
            vehiculoMarca:    getInputValue('marca'),
            vehiculoColor:    getInputValue('color') || 'NO ESPECIFICADO',
            vehiculoAnio:     getInputValue('anio') || '2020'
        };

        const response = await fetch(`${API_TRABAJADOR_URL}/registrar-entrada`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify(datos)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al registrar entrada');
        }

        showNotification('✅ Entrada registrada. Timer iniciado ⏱️', 'success');
        limpiarFormularioEntrada();
        setTimeout(() => { loadVehiculosActivos(); }, 500);

    } catch (error) {
        console.error('❌ Error:', error);
        showNotification('❌ ' + error.message, 'error');
    }
}

async function buscarPorPlacaIntegrado() {
    const placa = getInputValue('buscarPlaca');

    if (!placa || placa.length < 5) {
        showNotification('⚠️ Ingrese una placa válida', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_TRABAJADOR_URL}/buscar-por-placa/${placa}`, {
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }
        });

        if (!response.ok) throw new Error('Error');

        const data = await response.json();

        if (data.encontrado) {
            setInputValue('nombre',   data.cliente.nombre);
            setInputValue('telefono', data.cliente.telefono);
            setInputValue('correo1',  data.cliente.email);
            setInputValue('cedula',   data.cliente.cedula || '');
            setInputValue('placa',    data.vehiculo.placa);
            setInputValue('color',    data.vehiculo.color);

            const tipoSelect = document.getElementById('tipoVehiculo');
            if (tipoSelect) {
                tipoSelect.value = data.vehiculo.tipo;
                actualizarMarcasEntrada();
                setTimeout(() => {
                    const marcaSelect = document.getElementById('marca');
                    if (marcaSelect) marcaSelect.value = data.vehiculo.marca;
                }, 100);
            }

            if (data.vehiculo.anio) setInputValue('anio', data.vehiculo.anio);
            showNotification('✅ Vehículo encontrado', 'success');
        } else {
            limpiarFormularioEntrada();
            setInputValue('placa', placa);
            showNotification('ℹ️ Vehículo nuevo. Complete los datos.', 'info');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('❌ Error al buscar', 'error');
    }
}

// ==================== VEHÍCULOS ACTIVOS ====================
async function loadVehiculosActivos() {
    try {
        const response = await fetch(`${API_TRABAJADOR_URL}/vehiculos-activos`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }
        });

        if (!response.ok) throw new Error('Error al cargar vehículos');

        const vehiculos = await response.json();
        const tbody = document.getElementById('vehiculosActivosBody');
        if (!tbody) return;

        Object.values(timerIntervals).forEach(id => clearInterval(id));
        timerIntervals = {};

        if (vehiculos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No hay vehículos en el parqueadero</td></tr>';
            return;
        }

        tbody.innerHTML = vehiculos.map(v => `
            <tr>
                <td><strong>${v.placa}</strong></td>
                <td>${v.tipoVehiculo}</td>
                <td>${v.clienteNombre}</td>
                <td>${v.clienteTelefono}</td>
                <td>${formatDateTime(v.horaEntrada)}</td>
                <td>
                    <span class="tiempo-activo" id="timer-${v.registroId}">
                        ${v.tiempoTranscurrido}
                    </span>
                </td>
                <td>
                    <div style="font-size: 0.85rem;">
                        <div><strong>Plena:</strong> $${formatNumber(v.cobroEstimadoPlena)}</div>
                        <div style="color: #059669;"><strong>Minuto:</strong> $${formatNumber(v.cobroEstimadoMinuto)}</div>
                    </div>
                </td>
                <td>
                    <button class="sede-btn-warning sede-btn-salida" data-id="${v.registroId}">
                        🚪 Salida
                    </button>
                </td>
            </tr>
        `).join('');

        vehiculos.forEach(v => {
            const timerElement = document.getElementById(`timer-${v.registroId}`);
            if (!timerElement) return;

            let segundosBase = v.segundosTranscurridos;
            timerIntervals[v.registroId] = setInterval(() => {
                segundosBase++;
                const horas    = Math.floor(segundosBase / 3600);
                const minutos  = Math.floor((segundosBase % 3600) / 60);
                const segundos = segundosBase % 60;

                let texto = '';
                if (horas > 0)        texto = `${horas}h ${minutos}m ${segundos}s`;
                else if (minutos > 0) texto = `${minutos}m ${segundos}s`;
                else                  texto = `${segundos}s`;

                timerElement.textContent = texto;
            }, 1000);
        });

        console.log('✅ Vehículos activos cargados');

    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al cargar vehículos activos', 'error');
    }
}

// ==================== MODAL SALIDA ====================
// ✅ CAMBIO: modal ya existe en el DOM vía Thymeleaf (sede-modal-salida.html)
// ✅ CAMBIO: .modal → .sede-modal-dinamico (clase en CSS propio)
async function abrirModalSalida(registroId) {
    console.log('🚪 Abriendo modal salida para registro:', registroId);

    const modal = document.getElementById('salidaModal');
    if (!modal) {
        console.error('❌ No se encontró el elemento #salidaModal en el DOM');
        showNotification('❌ Error: Modal no encontrado', 'error');
        return;
    }

    try {
        currentSalidaRegistroId = registroId;

        const response = await fetch(`${API_TRABAJADOR_URL}/vehiculos-activos`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }
        });

        if (!response.ok) throw new Error('Error al obtener datos');

        const vehiculos = await response.json();
        const vehiculo = vehiculos.find(v => v.registroId === registroId);

        if (!vehiculo) {
            showNotification('❌ Vehículo no encontrado', 'error');
            return;
        }

        document.getElementById('salidaPlaca').textContent       = vehiculo.placa;
        document.getElementById('salidaCliente').textContent     = vehiculo.clienteNombre;
        document.getElementById('salidaHoraEntrada').textContent = formatDateTime(vehiculo.horaEntrada);
        document.getElementById('salidaTiempo').textContent      = vehiculo.tiempoTranscurrido;

        document.getElementById('salidaCobroEstimado').innerHTML = `
            <div class="sede-modal-salida-row">
                <strong>Plena:</strong>
                <span>$${formatNumber(vehiculo.cobroEstimadoPlena)}</span>
            </div>
            <div class="sede-modal-salida-row" style="color: #059669;">
                <strong>Minuto:</strong>
                <span>$${formatNumber(vehiculo.cobroEstimadoMinuto)}</span>
            </div>
        `;

        // ✅ CAMBIO: display:block + visibility:visible → CSS controla el overlay
        modal.style.display    = 'block';
        modal.style.visibility = 'visible';
        modal.style.opacity    = '1';
        modal.setAttribute('aria-hidden', 'false');

        console.log('✅ Modal salida abierto');

    } catch (error) {
        console.error('❌ Error:', error);
        showNotification('❌ Error al abrir modal', 'error');
    }
}

function cerrarModalSalida() {
    const modal = document.getElementById('salidaModal');
    if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
    }
    currentSalidaRegistroId = null;
}

async function confirmarSalida() {
    if (!currentSalidaRegistroId) return;

    try {
        showNotification('⏳ Registrando salida...', 'info');

        const response = await fetch(`${API_TRABAJADOR_URL}/registrar-salida/${currentSalidaRegistroId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error');
        }

        showNotification('✅ Salida registrada. Proceda a cobrar.', 'success');
        cerrarModalSalida();
        await loadVehiculosActivos();
        await loadPendientesCobro();

    } catch (error) {
        console.error('Error:', error);
        showNotification('❌ ' + error.message, 'error');
    }
}

// ==================== PENDIENTES COBRO ====================
async function loadPendientesCobro() {
    try {
        const response = await fetch(`${API_TRABAJADOR_URL}/vehiculos-pendientes-cobro`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error('Error');

        const pendientes = await response.json();
        const tbody = document.getElementById('pendientesCobroBody');
        if (!tbody) return;

        if (pendientes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No hay pendientes</td></tr>';
            return;
        }

        tbody.innerHTML = pendientes.map(p => `
            <tr>
                <td><strong>${p.placa}</strong></td>
                <td>${p.clienteNombre}</td>
                <td>${formatDateTime(p.horaEntrada)}</td>
                <td>${formatDateTime(p.horaSalida)}</td>
                <td>${p.tiempoTotal}</td>
                <td style="font-weight: 700; color: #059669;">$${formatNumber(p.precio)}</td>
                <td>
                    <button class="sede-btn-success sede-btn-cobrar" data-id="${p.registroId}">
                        💰 Cobrar
                    </button>
                </td>
            </tr>
        `).join('');

        console.log('✅ Pendientes de cobro cargados');

    } catch (error) {
        console.error('Error:', error);
    }
}

// ==================== MODAL COBRO ====================
// ✅ CAMBIO: modal ya existe en el DOM vía Thymeleaf (sede-modal-cobro.html)
// ✅ CAMBIO: selector '#cobroModal .modal-content > div:nth-child(2)'
//    → '#tarifaSelectorContainer' (div dedicado en el fragmento HTML)
async function abrirModalCobro(registroId) {
    console.log('💰 Abriendo modal cobro para registro:', registroId);
    currentCobroRegistroId = registroId;

    const modal = document.getElementById('cobroModal');
    if (!modal) { console.error('❌ No existe #cobroModal'); return; }

    modal.style.display    = 'block';
    modal.style.visibility = 'visible';
    modal.style.opacity    = '1';
    modal.setAttribute('aria-hidden', 'false');

    try {
        const response = await fetch(`${API_TRABAJADOR_URL}/opciones-cobro/${registroId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al cargar opciones');
        }

        const data = await response.json();
        opcionesTarifa = data;

        document.getElementById('cobroCliente').textContent = data.clienteNombre;
        document.getElementById('cobroPlaca').textContent   = data.placa;
        document.getElementById('cobroTiempo').textContent  = data.tiempoTotal;

        // ✅ CAMBIO: ya no busca el contenedor por nth-child ni elimina #tarifaSelector
        // Usa #tarifaSelectorContainer definido en el fragmento HTML
        const container = document.getElementById('tarifaSelectorContainer');
        if (container) {
            // ✅ CAMBIO: clases .modal-content inline → .sede-modal-cobro-selector y .sede-modal-cobro-opcion
            container.innerHTML = `
                <div class="sede-modal-cobro-selector">
                    <h3>💰 Seleccione tarifa:</h3>
                    ${data.opciones.map((op, i) => `
                        <label class="sede-modal-cobro-opcion">
                            <input type="radio" name="tipoTarifa" value="${op.tipo}"
                                ${i === 0 ? 'checked' : ''}
                                onchange="actualizarPrecioCobro('${op.tipo}', ${op.precio})">
                            <strong>${op.nombre}</strong>
                            <div>$${formatNumber(op.precio)} COP</div>
                        </label>
                    `).join('')}
                </div>
            `;
        }

        const opcionDefault = data.opciones[0];
        document.getElementById('cobroPrecio').textContent = formatNumber(opcionDefault.precio);

        console.log('✅ Modal cobro abierto');

    } catch (error) {
        console.error('❌ Error:', error.message);
        showNotification('❌ ' + error.message, 'error');
    }
}

function actualizarPrecioCobro(tipo, precio) {
    document.getElementById('cobroPrecio').textContent = formatNumber(precio);
}

function cerrarModalCobro() {
    const modal = document.getElementById('cobroModal');
    if (modal) {
        modal.style.display    = 'none';
        modal.style.visibility = 'hidden';
        modal.style.opacity    = '0';
        modal.setAttribute('aria-hidden', 'true');
    }
    currentCobroRegistroId = null;
    opcionesTarifa = null;

    // ✅ CAMBIO: limpia el container dedicado en lugar de buscar #tarifaSelector
    const container = document.getElementById('tarifaSelectorContainer');
    if (container) container.innerHTML = '';
}

async function procesarCobro() {
    if (!currentCobroRegistroId) return;

    try {
        const metodoPago = document.getElementById('metodoPago').value;
        const tipoTarifa = document.querySelector('input[name="tipoTarifa"]:checked');

        if (!tipoTarifa) {
            showNotification('⚠️ Seleccione una tarifa', 'warning');
            return;
        }

        showNotification('⏳ Procesando cobro...', 'info');

        const response = await fetch(`${API_TRABAJADOR_URL}/confirmar-cobro/${currentCobroRegistroId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ metodoPago: metodoPago, tipoTarifa: tipoTarifa.value })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error');
        }

        const data = await response.json();
        showNotification(`✅ Cobro: $${formatNumber(data.precio)} - ${data.tipoTarifaAplicada}`, 'success');
        cerrarModalCobro();
        await loadPendientesCobro();

    } catch (error) {
        console.error('Error:', error);
        showNotification('❌ ' + error.message, 'error');
    }
}

// ==================== HISTORIAL ====================
async function loadHistorial() {
    try {
        const fecha  = document.getElementById('filtroFecha')?.value  || '';
        const estado = document.getElementById('filtroEstado1')?.value || '';

        let url = `${API_TRABAJADOR_URL}/historial`;
        const params = new URLSearchParams();
        if (fecha)  params.append('fecha', fecha);
        if (estado) params.append('estado', estado);
        if (params.toString()) url += '?' + params.toString();

        const response = await fetch(url, {
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }
        });

        if (!response.ok) throw new Error('Error');

        const registros = await response.json();
        const tbody = document.getElementById('historialBody');
        if (!tbody) return;

        if (registros.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Sin registros</td></tr>';
            return;
        }

        tbody.innerHTML = registros.map(r => {
            let badge = '';
            if      (r.estado === 'ACTIVO')     badge = '<span class="sede-badge sede-badge-info">Activo</span>';
            else if (r.estado === 'FINALIZADO') badge = '<span class="sede-badge sede-badge-warning">Pendiente</span>';
            else if (r.estado === 'COBRADO')    badge = '<span class="sede-badge sede-badge-success">Cobrado</span>';
            else                                badge = '<span class="sede-badge sede-badge-danger">Cancelado</span>';

            return `
                <tr>
                    <td><strong>${r.placa}</strong></td>
                    <td>${r.tipoVehiculo}</td>
                    <td>${r.clienteNombre}</td>
                    <td>${r.clienteTelefono}</td>
                    <td>${formatDateTime(r.horaEntrada)}</td>
                    <td>${r.horaSalida ? formatDateTime(r.horaSalida) : '-'}</td>
                    <td>${r.tiempoTotal}</td>
                    <td>${r.precio ? '$' + formatNumber(r.precio) : '-'}</td>
                    <td>${badge}</td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error:', error);
    }
}

// ==================== RESERVACIONES ====================
async function loadReservaciones() {
    try {
        const response = await fetch(`${API_TRABAJADOR_URL}/reservaciones`, {
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }
        });

        if (!response.ok) throw new Error('Error');

        const reservas = await response.json();
        const tbody = document.getElementById('reservacionesBody');
        if (!tbody) return;

        if (reservas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Sin reservaciones</td></tr>';
            return;
        }

        tbody.innerHTML = reservas.map(r => `
            <tr>
                <td>${r.clienteNombre}</td>
                <td>${r.clienteTelefono}</td>
                <td><strong>${r.placa}</strong></td>
                <td>${r.tipoVehiculo}</td>
                <td>${formatDateTime(r.horaInicio)}</td>
                <td>${formatDateTime(r.horaFin)}</td>
                <td><span class="sede-badge sede-badge-info">${r.cupo}</span></td>
                <td>
                    <button class="sede-btn-success sede-btn-aceptar" data-id="${r.id}">Aceptar</button>
                    <button class="sede-btn-danger sede-btn-rechazar" data-id="${r.id}">Rechazar</button>
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error:', error);
    }
}

async function aceptarReservacion(id) {
    if (!confirm('¿Aceptar reservación?')) return;

    try {
        const response = await fetch(`${API_TRABAJADOR_URL}/aceptar-reservacion/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }
        });

        showNotification('✅ Reservación aceptada', 'success');
        await loadReservaciones();
        await loadVehiculosActivos();

    } catch (error) {
        console.error('Error:', error);
        showNotification('❌ Error', 'error');
    }
}

async function rechazarReservacion(id) {
    if (!confirm('¿Rechazar reservación?')) return;

    try {
        const response = await fetch(`${API_TRABAJADOR_URL}/rechazar-reservacion/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }
        });

        if (!response.ok) throw new Error('Error');

        showNotification('✅ Reservación rechazada', 'success');
        await loadReservaciones();

    } catch (error) {
        console.error('Error:', error);
        showNotification('❌ Error', 'error');
    }
}

// ==================== CARGA MASIVA ====================
async function cargarExcel() {
    const fileInput = document.getElementById('excelFile');
    const file = fileInput?.files[0];

    if (!file) {
        showNotification('⚠️ Por favor seleccione un archivo Excel', 'warning');
        return;
    }

    const extension = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls'].includes(extension)) {
        showNotification('⚠️ El archivo debe ser formato Excel (.xlsx o .xls)', 'warning');
        return;
    }

    try {
        const progressContainer = document.getElementById('progressContainer');
        const progressBar       = document.getElementById('progressBar');
        const progressText      = document.getElementById('progressText');

        if (progressContainer) {
            progressContainer.style.display = 'block';
            progressBar.style.width         = '30%';
            progressBar.textContent         = '30%';
            progressText.textContent        = 'Subiendo archivo...';
        }

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_TRABAJADOR_URL}/carga-masiva`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${getToken()}` },
            body: formData
        });

        if (progressBar) {
            progressBar.style.width  = '70%';
            progressBar.textContent  = '70%';
            progressText.textContent = 'Procesando datos...';
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Error al procesar el archivo');
        }

        const data = await response.json();

        if (progressBar) {
            progressBar.style.width  = '100%';
            progressBar.textContent  = '100%';
            progressText.textContent = '✅ Completado';
        }

        mostrarResultadosCarga(data);

        const mensaje = data.tieneErrores
            ? `⚠️ Carga completada con ${data.errores.length} error(es). Total: ${data.totalRegistros || 0}`
            : `✅ Carga exitosa: ${data.totalRegistros || 0} registros`;

        showNotification(mensaje, data.tieneErrores ? 'warning' : 'success');

        fileInput.value = '';
        document.getElementById('archivoSeleccionado').innerHTML = '';

        setTimeout(() => {
            if (progressContainer) progressContainer.style.display = 'none';
        }, 2000);

    } catch (error) {
        console.error('Error:', error);
        showNotification(`❌ Error: ${error.message}`, 'error');
        const progressContainer = document.getElementById('progressContainer');
        if (progressContainer) progressContainer.style.display = 'none';
    }
}

function mostrarResultadosCarga(data) {
    const resultadosDiv    = document.getElementById('resultadosCarga');
    const resumenDiv       = document.getElementById('resumenCarga');
    const tbody            = document.getElementById('resultadosCargaBody');
    const erroresContainer = document.getElementById('erroresContainer');
    const listaErrores     = document.getElementById('listaErrores');

    if (resultadosDiv) resultadosDiv.style.display = 'block';

    if (resumenDiv) {
        resumenDiv.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                <div style="background: linear-gradient(135deg, #d1fae5, #a7f3d0); padding: 1.5rem; border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 2rem; font-weight: 700; color: #065f46;">${data.clientesRegistrados || 0}</div>
                    <div style="font-size: 0.9rem; color: #047857; font-weight: 600;">Clientes Registrados</div>
                </div>
                <div style="background: linear-gradient(135deg, #dbeafe, #bfdbfe); padding: 1.5rem; border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 2rem; font-weight: 700; color: #1e40af;">${data.vehiculosRegistrados || 0}</div>
                    <div style="font-size: 0.9rem; color: #1e3a8a; font-weight: 600;">Vehículos Registrados</div>
                </div>
                <div style="background: linear-gradient(135deg, #e0e7ff, #c7d2fe); padding: 1.5rem; border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 2rem; font-weight: 700; color: #4338ca;">${data.totalRegistros || 0}</div>
                    <div style="font-size: 0.9rem; color: #3730a3; font-weight: 600;">Total Registros</div>
                </div>
            </div>
        `;
    }

    if (data.errores && data.errores.length > 0) {
        if (erroresContainer) erroresContainer.style.display = 'block';
        if (listaErrores) {
            listaErrores.innerHTML = data.errores.map(error => `<li>${error}</li>`).join('');
        }
    } else {
        if (erroresContainer) erroresContainer.style.display = 'none';
    }

    if (tbody && data.registrosCargados) {
        tbody.innerHTML = data.registrosCargados.map(r => {
            if (r.tipo === 'Vehículo' || r.tipo === 'Vehiculo') {
                return `
                    <tr>
                        <td><span class="sede-badge sede-badge-info">🚗 ${r.tipo}</span></td>
                        <td><strong>${r.placa || 'N/A'}</strong></td>
                        <td>
                            <strong>${r.marca || 'N/A'}</strong> ${r.tipoVehiculo || ''}<br>
                            <small style="color: #64748b;">Color: ${r.color || 'N/A'} - Año: ${r.año || 'N/A'}</small><br>
                            <small style="color: #64748b;">Propietario: ${r.propietario || 'N/A'}</small>
                        </td>
                        <td><span class="sede-badge sede-badge-success">✓ Registrado</span></td>
                    </tr>
                `;
            } else if (r.tipo === 'Cliente') {
                return `
                    <tr>
                        <td><span class="sede-badge sede-badge-success">🧑‍💼 ${r.tipo}</span></td>
                        <td><strong>${r.nombre || 'N/A'}</strong></td>
                        <td>
                            ${r.email || 'N/A'}<br>
                            <small style="color: #64748b;">Tel: ${r.telefono || 'N/A'} - Cédula: ${r.cedula || 'N/A'}</small>
                        </td>
                        <td><span class="sede-badge sede-badge-success">✓ Registrado</span></td>
                    </tr>
                `;
            }
            return '';
        }).join('');
    }
}

function descargarPlantillaCompleta() {
    if (typeof XLSX === 'undefined') {
        showNotification('❌ Error: Librería XLSX no está cargada. Recarga la página.', 'error');
        return;
    }

    const wb = XLSX.utils.book_new();

    const datosClientes = [
        ['Tipo', 'Nombre', 'Teléfono', 'Email', 'Cédula'],
        ['Cliente', 'Juan Pérez Ejemplo', '0987654321', 'juan.perez.nuevo@gmail.com', '1234567899'],
        ['Cliente', 'María González Ejemplo', '0986543210', 'maria.gonzalez.nueva@gmail.com', '0987654322']
    ];

    const wsClientes = XLSX.utils.aoa_to_sheet(datosClientes);
    wsClientes['!cols'] = [{ wch: 10 }, { wch: 20 }, { wch: 12 }, { wch: 28 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsClientes, 'Clientes');

    const datosVehiculos = [
        ['Tipo', 'Placa', 'Tipo Vehículo', 'Marca', 'Color', 'Año', 'Email Cliente'],
        ['Vehiculo', 'ABC123', 'CARRO', 'TOYOTA', 'Blanco', '2020', 'juan.perez.nuevo@gmail.com']
    ];

    const wsVehiculos = XLSX.utils.aoa_to_sheet(datosVehiculos);
    wsVehiculos['!cols'] = [{ wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(wb, wsVehiculos, 'Vehículos');

    XLSX.writeFile(wb, 'Plantilla_Carga_Masiva_Completa.xlsx');
    showNotification('✅ Plantilla completa descargada', 'success');
}

function mostrarArchivoSeleccionado() {
    const fileInput = document.getElementById('excelFile');
    const infoDiv   = document.getElementById('archivoSeleccionado');

    if (fileInput?.files[0]) {
        const file = fileInput.files[0];
        const size = (file.size / 1024).toFixed(2);
        infoDiv.innerHTML = `📎 Archivo seleccionado: <strong>${file.name}</strong> (${size} KB)`;
        infoDiv.style.color = '#059669';
    } else {
        infoDiv.innerHTML = '';
    }
}

// ==================== DELEGACIÓN DE EVENTOS ====================
function setupGlobalEventDelegation() {
    document.body.addEventListener('click', function(e) {
        // ✅ CAMBIO: .btn-salida → .sede-btn-salida
        if (e.target.closest('.sede-btn-salida')) {
            e.preventDefault();
            const btn = e.target.closest('.sede-btn-salida');
            abrirModalSalida(parseInt(btn.dataset.id));
            return;
        }
        // ✅ CAMBIO: .btn-cobrar → .sede-btn-cobrar
        if (e.target.closest('.sede-btn-cobrar')) {
            e.preventDefault();
            const btn = e.target.closest('.sede-btn-cobrar');
            abrirModalCobro(parseInt(btn.dataset.id));
            return;
        }
        // ✅ CAMBIO: .btn-aceptar → .sede-btn-aceptar
        if (e.target.closest('.sede-btn-aceptar')) {
            e.preventDefault();
            const btn = e.target.closest('.sede-btn-aceptar');
            aceptarReservacion(btn.dataset.id);
            return;
        }
        // ✅ CAMBIO: .btn-rechazar → .sede-btn-rechazar
        if (e.target.closest('.sede-btn-rechazar')) {
            e.preventDefault();
            const btn = e.target.closest('.sede-btn-rechazar');
            rechazarReservacion(btn.dataset.id);
            return;
        }
    });
}

// ==================== GESTIÓN TRABAJADORES ====================
function openRegistrarTrabajadorModal() {
    const modal = document.getElementById('registrarTrabajadorModal');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    modal.offsetHeight; // Forzar reflow para animación
}

function closeRegistrarTrabajadorModal() {
    const modal = document.getElementById('registrarTrabajadorModal');
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');

    setTimeout(() => {
        document.getElementById('trabajadorNombre').value    = '';
        document.getElementById('trabajadorCorreo').value    = '';
        document.getElementById('trabajadorTelefono').value  = '';
        document.getElementById('trabajadorCedula').value    = '';
        document.getElementById('trabajadorContrasena').value = '';
    }, 300);
}

document.getElementById('registrarTrabajadorModal')?.addEventListener('click', function(e) {
    if (e.target === this) { closeRegistrarTrabajadorModal(); }
});

async function registrarTrabajador() {
    const datos = {
        nombre:    document.getElementById('trabajadorNombre').value.trim(),
        correo:    document.getElementById('trabajadorCorreo').value.trim(),
        telefono:  document.getElementById('trabajadorTelefono').value.trim(),
        cedula:    document.getElementById('trabajadorCedula').value.trim(),
        contrasena: document.getElementById('trabajadorContrasena').value
    };

    if (!datos.nombre || !datos.correo) {
        alert('Por favor complete los campos obligatorios: Nombre y Correo');
        return;
    }

    if (datos.contrasena && datos.contrasena.length < 6) {
        alert('La contraseña debe tener al menos 6 caracteres');
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(datos.correo)) {
        alert('Por favor ingrese un correo electrónico válido');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/registrar-trabajador`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify(datos)
        });

        if (response.ok) {
            const result = await response.json();
            showNotification(result.mensaje || 'Trabajador registrado exitosamente', 'success');
            closeRegistrarTrabajadorModal();
            cargarUsuarios();
        } else {
            const error = await response.json();
            showNotification(error.error || 'Error al registrar trabajador', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error de conexión al registrar trabajador', 'error');
    }
}

// ==================== REPORTES ====================
async function generarPDF() {
    try {
        const response = await fetch(`${API_BASE_URL}/reporte/usuarios/pdf`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        if (response.ok) {
            const blob = await response.blob();
            const url  = window.URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = `reporte_clientes_${new Date().getTime()}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showNotification('PDF generado exitosamente', 'success');
        } else {
            throw new Error('Error al generar PDF');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al generar el reporte PDF', 'error');
    }
}

async function generarExcel() {
    try {
        const response = await fetch(`${API_BASE_URL}/reporte/usuarios/excel`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        if (response.ok) {
            const blob = await response.blob();
            const url  = window.URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = `reporte_clientes_${new Date().getTime()}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showNotification('Excel generado exitosamente', 'success');
        } else {
            throw new Error('Error al generar Excel');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al generar el reporte Excel', 'error');
    }
}

// ==================== EDICIÓN Y ELIMINACIÓN ====================
async function editarUsuario(id) {
    showNotification('Función de edición en desarrollo', 'info');
}

async function eliminarUsuario(id) {
    if (!confirm('¿Está seguro de que desea eliminar este usuario?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/usuarios/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        if (response.ok) {
            showNotification('Usuario eliminado correctamente', 'success');
            cargarUsuarios();
        } else {
            throw new Error('Error al eliminar usuario');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al eliminar el usuario', 'error');
    }
}

async function editarSede(id) {
    showNotification('Función de edición en desarrollo', 'info');
}

// ==================== ENVÍO DE CORREOS ====================
async function enviarCorreoUno() {
    const datos = {
        email:   document.getElementById('emailSingle').value,
        subject: document.getElementById('subjectSingle').value,
        message: document.getElementById('messageSingle').value
    };

    if (!datos.email || !datos.subject || !datos.message) {
        showNotification('Por favor complete todos los campos', 'warning');
        return;
    }

    showNotification('Correo enviado exitosamente (función en desarrollo)', 'info');
}

async function enviarCorreoMasivo() {
    const datos = {
        emails:  document.getElementById('emailsMassive').value.split(',').map(e => e.trim()),
        subject: document.getElementById('subjectMassive').value,
        message: document.getElementById('messageMassive').value
    };

    if (!datos.emails.length || !datos.subject || !datos.message) {
        showNotification('Por favor complete todos los campos', 'warning');
        return;
    }

    showNotification(`Correo enviado a ${datos.emails.length} destinatarios (función en desarrollo)`, 'info');
}

// ==================== UI HELPERS ====================
function setupSidebarToggle() {
    const toggleBtn = document.getElementById('sidebarToggle');
    const sidebar   = document.getElementById('sidebar');
    const header    = document.getElementById('pageHeader');
    const main      = document.getElementById('mainContent');

    toggleBtn?.addEventListener('click', () => {
        // .sede-sidebar.hidden → translateX(-100%) definido en sede.css
        sidebar.classList.toggle('hidden');
        header.classList.toggle('sidebar-hidden');
        main.classList.toggle('sidebar-hidden');
    });
}

function setupProfileMenu() {
    const profileBtn = document.getElementById('profileBtn');
    const dropdown   = document.getElementById('profileDropdown');

    profileBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('show');
    });

    document.addEventListener('click', () => {
        dropdown?.classList.remove('show');
    });
}

// ==================== EVENTOS GLOBALES ====================
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const cobro  = document.getElementById('cobroModal');
        const salida = document.getElementById('salidaModal');
        if (cobro  && cobro.style.display  === 'block') cerrarModalCobro();
        if (salida && salida.style.display === 'block') cerrarModalSalida();
    }
});

window.addEventListener('click', (e) => {
    const cobro  = document.getElementById('cobroModal');
    const salida = document.getElementById('salidaModal');
    if (e.target === cobro)  cerrarModalCobro();
    if (e.target === salida) cerrarModalSalida();

    const modal = document.getElementById('registrarTrabajadorModal');
    if (e.target === modal) closeRegistrarTrabajadorModal();
});

// ==================== ESTILOS ADICIONALES ====================
// ✅ CAMBIO: injectModalStyles() ELIMINADO — los estilos de .modal viven
//   en /css/modals/sede-modal-dinamico.css importado en el HTML.
//
// ✅ CAMBIO: createModals() ELIMINADO — los modales #salidaModal y
//   #cobroModal viven en fragmentos Thymeleaf integrados en sede.html.
//
// injectAdditionalStyles() CONSERVADO — contiene estilos de utilidades
// (.sede-btn-icon, .sede-badge, etc.) que no son exclusivos de ningún modal.
function injectAdditionalStyles() {
    if (document.getElementById('additional-styles')) return;

    const style = document.createElement('style');
    style.id = 'additional-styles';
    style.textContent = `
        /* Botones de icono en tablas */
        .sede-btn-icon {
            background: transparent; border: none; cursor: pointer;
            padding: 0.5rem; border-radius: 0.375rem; transition: all 0.2s;
            display: inline-flex; align-items: center; justify-content: center;
        }
        .sede-btn-edit:hover   { background-color: #dbeafe; }
        .sede-btn-delete:hover { background-color: #fee2e2; }

        /* Botón amarillo/warning para salida */
        .sede-btn-warning {
            background-color: #f59e0b; color: white; padding: 0.5rem 1.5rem;
            border-radius: 0.375rem; border: none; cursor: pointer;
            transition: all 0.3s; font-weight: 600;
            display: inline-flex; align-items: center; gap: 0.5rem;
        }
        .sede-btn-warning:hover { background-color: #d97706; transform: translateY(-2px); }

        /* Badges de estado en tablas */
        .sede-badge {
            padding: 0.25rem 0.75rem; border-radius: 9999px;
            font-size: 0.75rem; font-weight: 600; display: inline-block;
        }
        .sede-badge-info    { background-color: #dbeafe; color: #1e40af; }
        .sede-badge-success { background-color: #d1fae5; color: #065f46; }
        .sede-badge-danger  { background-color: #fee2e2; color: #991b1b; }
        .sede-badge-warning { background-color: #fef3c7; color: #92400e; }

        /* Toast notifications */
        @keyframes aparca-slideUp {
            from { transform: translateX(400px); opacity: 0; }
            to   { transform: translateX(0); opacity: 1; }
        }

        /* Clases de validación de formulario */
        .border-red-500   { border-color: #ef4444 !important; box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1); }
        .border-green-500 { border-color: #10b981 !important; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1); }

        .hidden { display: none !important; }
    `;
    document.head.appendChild(style);
}

console.log('✅ sedeD.js cargado correctamente');