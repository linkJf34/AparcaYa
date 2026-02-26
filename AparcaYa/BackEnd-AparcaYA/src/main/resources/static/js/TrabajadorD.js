// ==================== CONFIGURACIÓN GLOBAL ====================
const API_BASE_URL = '/api/trabajador';
const REGISTRO_URL = '/api/trabajador/registrar-entrada';
let currentRegistroId    = null;
let currentSalidaRegistroId = null;
let currentCobroRegistroId  = null;
let opcionesTarifa  = null;
let updateInterval  = null;
let timerIntervals  = {};

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
    } catch { return dateString; }
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
        animation: slideIn 0.3s ease-out; max-width: 400px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;

    const colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
    toast.style.backgroundColor = colors[type] || colors.info;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function formatMarcaName(marca) {
    const map = {
        'MERCEDES_BENZ':  'Mercedes-Benz',
        'LAND_ROVER':     'Land Rover',
        'GREAT_WALL':     'Great Wall',
        'BMW_MOTORRAD':   'BMW Motorrad',
        'HARLEY_DAVIDSON':'Harley-Davidson',
        'ROYAL_ENFIELD':  'Royal Enfield'
    };
    return map[marca] || marca.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
}

function actualizarMarcasEntrada() {
    const tipoSelect  = document.getElementById('tipoVehiculo');
    const marcaSelect = document.getElementById('marca');
    if (!tipoSelect || !marcaSelect) return;

    const tipo = tipoSelect.value;
    marcaSelect.innerHTML = '<option value="">Selecciona una marca</option>';

    if (tipo && marcasPorTipo[tipo]) {
        marcasPorTipo[tipo].forEach(marca => {
            const option = document.createElement('option');
            option.value       = marca;
            option.textContent = formatMarcaName(marca);
            marcaSelect.appendChild(option);
        });
    }
}

function limpiarFormularioEntrada() {
    ['nombre', 'telefono', 'correo', 'cedula', 'placa', 'color', 'anio', 'buscarPlaca']
        .forEach(id => setInputValue(id, ''));

    const tipoSelect = document.getElementById('tipoVehiculo');
    if (tipoSelect) tipoSelect.value = '';

    const marcaSelect = document.getElementById('marca');
    if (marcaSelect) marcaSelect.innerHTML = '<option value="">Selecciona una marca</option>';

    ['nombre', 'correo', 'telefono', 'cedula', 'placa', 'tipoVehiculo', 'marca'].forEach(fieldId => {
        const errorSpan   = document.getElementById(`${fieldId}-error`);
        const successSpan = document.getElementById(`${fieldId}-success`);
        if (errorSpan)   errorSpan.textContent   = '';
        if (successSpan) successSpan.textContent = '';

        const field = document.getElementById(fieldId);
        if (field) field.classList.remove('border-red-500', 'border-green-500');
    });
}

// ==================== VALIDACIÓN DE CAMPOS ====================
function validateFieldEntrada(fieldId) {
    const field       = document.getElementById(fieldId);
    const errorSpan   = document.getElementById(`${fieldId}-error`);
    const successSpan = document.getElementById(`${fieldId}-success`);
    if (!field) return true;

    let isValid = true;
    let message = '';
    const value = field.value.trim();

    switch(fieldId) {
        case 'nombre':
            if (!value)               { isValid = false; message = 'El nombre es obligatorio.'; }
            else if (value.length < 2){ isValid = false; message = 'Al menos 2 caracteres.'; }
            break;
        case 'correo':
            if (!value)                                        { isValid = false; message = 'El correo es obligatorio.'; }
            else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)){ isValid = false; message = 'Formato inválido.'; }
            break;
        case 'telefono':
            if (!value)                       { isValid = false; message = 'El teléfono es obligatorio.'; }
            else if (!/^[0-9]{10}$/.test(value)){ isValid = false; message = 'Debe tener 10 dígitos.'; }
            break;
        case 'cedula':
            if (!value)                       { isValid = false; message = 'La cédula es obligatoria.'; }
            else if (!/^[0-9]{10}$/.test(value)){ isValid = false; message = 'Debe tener 10 dígitos.'; }
            break;
        case 'placa':
            if (!value)                              { isValid = false; message = 'La placa es obligatoria.'; }
            else if (!/^[A-Z]{3}[0-9]{3}$/.test(value)){ isValid = false; message = 'Formato: ABC123'; }
            break;
        case 'tipoVehiculo':
            if (!value) { isValid = false; message = 'Selecciona el tipo.'; }
            break;
        case 'marca':
            if (!value) { isValid = false; message = 'Selecciona la marca.'; }
            break;
    }

    if (errorSpan)   errorSpan.textContent   = isValid ? '' : message;
    if (successSpan) successSpan.textContent = '';

    field.classList.toggle('border-red-500',  !isValid);
    field.classList.toggle('border-green-500', isValid && value !== '');

    return isValid;
}

function validateFormularioEntrada() {
    const campos = ['nombre', 'correo', 'telefono', 'cedula', 'placa', 'tipoVehiculo', 'marca'];
    let todosValidos = true;
    campos.forEach(campoId => {
        if (!validateFieldEntrada(campoId)) todosValidos = false;
    });
    return todosValidos;
}

// ==================== NAVEGACIÓN ====================
function initializeTabs() {
    // CAMBIO: '.sidebar-nav a' → '.aparca-sidebar-nav a'
    const navLinks = document.querySelectorAll('.aparca-sidebar-nav a');
    // CAMBIO: '.content-section' → '.aparca-content-section'
    const sections = document.querySelectorAll('.aparca-content-section');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            sections.forEach(s => s.classList.add('hidden'));

            link.classList.add('active');
            const tabId  = link.getAttribute('data-tab');
            const section = document.getElementById(tabId);

            if (section) {
                section.classList.remove('hidden');

                switch(tabId) {
                    case 'inicio':       loadIndicadores(); break;
                    case 'gestion':      loadVehiculosActivos(); loadPendientesCobro(); break;
                    case 'reservaciones':loadReservaciones(); break;
                }
            }
        });
    });
}

function initializeProfileMenu() {
    const btn      = document.getElementById('profileBtn');
    const dropdown = document.getElementById('profileDropdown');

    if (btn && dropdown) {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        });
        document.addEventListener('click', () => dropdown.classList.remove('show'));
    }
}

function handleLogout() {
    if (confirm('¿Cerrar sesión?')) {
        clearInterval(updateInterval);
        Object.values(timerIntervals).forEach(id => clearInterval(id));
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        window.location.href = '/login';
    }
}

function initializeMarcas() {
    const tipoSelect = document.getElementById('tipoVehiculo');
    if (tipoSelect) {
        tipoSelect.addEventListener('change', actualizarMarcasEntrada);
        actualizarMarcasEntrada();
    }
}

// ==================== INDICADORES ====================
async function loadIndicadores() {
    try {
        const response = await fetch(`${API_BASE_URL}/indicadores`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            }
        });

        if (!response.ok) throw new Error('Error');

        const data = await response.json();

        const elementos = {
            'ocupacionActual':    `${data.ocupacionActual}/${data.capacidadTotal}`,
            'porcentajeOcupacion':`${data.porcentajeOcupacion}%`,
            'cuposLibres':         data.cuposLibres,
            'vehiculosHoy':        data.vehiculosHoy,
            'ingresosDia':        `${formatNumber(data.ingresosDia)}`,
            'pendientesCobro':     data.pendientesCobro,
            'tarifaHora':         `${formatNumber(data.tarifaPlenaC || 0)}`,
            'sedeNombre':          data.sedeNombre || 'Parqueadero'
        };

        Object.entries(elementos).forEach(([id, valor]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = valor;
        });

        const card = document.getElementById('cardOcupacion');
        if (card) {
            if      (data.porcentajeOcupacion >= 90) card.style.backgroundColor = '#fecaca';
            else if (data.porcentajeOcupacion >= 70) card.style.backgroundColor = '#fef08a';
            else                                     card.style.backgroundColor = '#d0e8f2';
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

// ==================== FORMULARIO ENTRADA ====================
function initializeFormularioEntrada() {
    const registroForm = document.getElementById('registroEntradaForm');

    if (registroForm) {
        registroForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await registrarEntradaDirecto();
        });

        const campos = ['nombre', 'telefono', 'correo', 'cedula', 'placa', 'tipoVehiculo', 'marca'];
        campos.forEach(campoId => {
            const campo = document.getElementById(campoId);
            if (campo) {
                campo.addEventListener('blur',  () => validateFieldEntrada(campoId));
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

        const tipoVehiculo = document.getElementById('tipoVehiculo');
        if (tipoVehiculo) {
            tipoVehiculo.addEventListener('change', () => {
                actualizarMarcasEntrada();
                validateFieldEntrada('tipoVehiculo');
            });
        }

        const marca = document.getElementById('marca');
        if (marca) {
            marca.addEventListener('change', () => validateFieldEntrada('marca'));
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
            clienteNombre:   getInputValue('nombre'),
            clienteTelefono: getInputValue('telefono'),
            clienteEmail:    getInputValue('correo'),
            clienteCedula:   getInputValue('cedula'),
            vehiculoPlaca:   getInputValue('placa'),
            vehiculoTipo:    getInputValue('tipoVehiculo'),
            vehiculoMarca:   getInputValue('marca'),
            vehiculoColor:   getInputValue('color') || 'NO ESPECIFICADO',
            vehiculoAnio:    getInputValue('anio')  || '2020'
        };

        console.log('📋 Enviando datos:', datos);

        const response = await fetch(REGISTRO_URL, {
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

        const data = await response.json();
        console.log('✅ Respuesta exitosa:', data);

        showNotification('✅ Entrada registrada. Timer iniciado ⏱️', 'success');
        limpiarFormularioEntrada();

        setTimeout(() => {
            loadVehiculosActivos();
            loadIndicadores();
        }, 500);

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
        const response = await fetch(`${API_BASE_URL}/buscar-por-placa/${placa}`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            }
        });

        if (!response.ok) throw new Error('Error');

        const data = await response.json();

        if (data.encontrado) {
            setInputValue('nombre',   data.cliente.nombre);
            setInputValue('telefono', data.cliente.telefono);
            setInputValue('correo',   data.cliente.email);
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
        const response = await fetch(`${API_BASE_URL}/vehiculos-activos`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            }
        });

        if (!response.ok) throw new Error('Error al cargar vehículos');

        const vehiculos = await response.json();
        const tbody     = document.getElementById('vehiculosActivosBody');
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
                    <!-- CAMBIO: btn-warning → trab-btn-warning (mantiene btn-salida para delegación) -->
                    <button class="trab-btn-warning btn-salida" data-id="${v.registroId}">
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

        const response = await fetch(`${API_BASE_URL}/vehiculos-activos`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            }
        });

        if (!response.ok) throw new Error('Error al obtener datos');

        const vehiculos = await response.json();
        const vehiculo  = vehiculos.find(v => v.registroId === registroId);

        if (!vehiculo) {
            showNotification('❌ Vehículo no encontrado', 'error');
            return;
        }

        document.getElementById('salidaPlaca').textContent       = vehiculo.placa;
        document.getElementById('salidaCliente').textContent     = vehiculo.clienteNombre;
        document.getElementById('salidaHoraEntrada').textContent = formatDateTime(vehiculo.horaEntrada);
        document.getElementById('salidaTiempo').textContent      = vehiculo.tiempoTranscurrido;
        document.getElementById('salidaCobroEstimado').textContent =
            formatNumber(vehiculo.cobroEstimadoPlena);

        // CAMBIO: modal.style.display='block' → modal.classList.add('show')
        modal.classList.add('show');
        console.log('✅ Modal salida abierto');

    } catch (error) {
        console.error('❌ Error:', error);
        showNotification('❌ Error al abrir modal', 'error');
    }
}

function cerrarModalSalida() {
    const modal = document.getElementById('salidaModal');
    // CAMBIO: modal.style.display='none' → modal.classList.remove('show')
    if (modal) modal.classList.remove('show');
    currentSalidaRegistroId = null;
}

async function confirmarSalida() {
    if (!currentSalidaRegistroId) return;

    try {
        showNotification('⏳ Registrando salida...', 'info');

        const response = await fetch(`${API_BASE_URL}/registrar-salida/${currentSalidaRegistroId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error');
        }

        showNotification('✅ Salida registrada. Proceda a cobrar.', 'success');
        cerrarModalSalida();
        await loadVehiculosActivos();
        await loadPendientesCobro();
        await loadIndicadores();

    } catch (error) {
        console.error('Error:', error);
        showNotification('❌ ' + error.message, 'error');
    }
}

// ==================== PENDIENTES COBRO ====================
async function loadPendientesCobro() {
    try {
        const response = await fetch(`${API_BASE_URL}/vehiculos-pendientes-cobro`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error('Error');

        const pendientes = await response.json();
        const tbody      = document.getElementById('pendientesCobroBody');
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
                    <!-- CAMBIO: btn-success → trab-btn-success (mantiene btn-cobrar para delegación) -->
                    <button class="trab-btn-success btn-cobrar" data-id="${p.registroId}">
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
async function abrirModalCobro(registroId) {
    console.log('💰 Abriendo modal cobro para registro:', registroId);

    currentCobroRegistroId = registroId;

    const modal = document.getElementById('cobroModal');
    if (!modal) { console.error('❌ No existe #cobroModal'); return; }

    // CAMBIO: modal.classList.add('modal') eliminado (ya tiene la clase)
    // CAMBIO: modal.style.display='block' → modal.classList.add('show')
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';

    try {
        const response = await fetch(`${API_BASE_URL}/opciones-cobro/${registroId}`, {
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

        // CAMBIO: '.modal-content > div' → '.trab-modal-content > div'
        const modalBody = document.querySelector('#cobroModal .trab-modal-content > div:nth-child(2)');

        const existingSelector = document.getElementById('tarifaSelector');
        if (existingSelector) existingSelector.remove();

        const selectorHTML = `
            <div id="tarifaSelector" style="margin: 1.5rem 0; padding: 1rem; background: #f0f9ff; border-radius: 0.5rem;">
                <h3 style="margin-bottom: 1rem; color: #0369a1;">💰 Seleccione tarifa:</h3>
                ${data.opciones.map((op, i) => `
                    <label style="display:block; padding:1rem; margin-bottom:.75rem; background:white; border:2px solid #3b82f6; border-radius:.5rem; cursor:pointer;">
                        <input type="radio" name="tipoTarifa" value="${op.tipo}"
                            ${i === 0 ? 'checked' : ''}
                            onchange="actualizarPrecioCobro('${op.tipo}', ${op.precio})">
                        <strong>${op.nombre}</strong>
                        <div>${formatNumber(op.precio)} COP</div>
                    </label>
                `).join('')}
            </div>
        `;

        if (modalBody) modalBody.insertAdjacentHTML('beforeend', selectorHTML);

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
        // CAMBIO: modal.style.display/visibility/opacity → modal.classList.remove('show')
        modal.classList.remove('show');
        document.body.style.overflow = 'auto';
    }
    currentCobroRegistroId = null;
    opcionesTarifa = null;
    const selector = document.getElementById('tarifaSelector');
    if (selector) selector.remove();
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

        const response = await fetch(`${API_BASE_URL}/confirmar-cobro/${currentCobroRegistroId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                metodoPago: metodoPago,
                tipoTarifa: tipoTarifa.value
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error');
        }

        const data = await response.json();
        showNotification(`✅ Cobro: ${formatNumber(data.precio)} - ${data.tipoTarifaAplicada}`, 'success');
        cerrarModalCobro();
        await loadPendientesCobro();
        await loadIndicadores();

    } catch (error) {
        console.error('Error:', error);
        showNotification('❌ ' + error.message, 'error');
    }
}

// ==================== HISTORIAL ====================
async function loadHistorial() {
    try {
        const fecha  = document.getElementById('filtroFecha')?.value  || '';
        const estado = document.getElementById('filtroEstado')?.value || '';

        let url = `${API_BASE_URL}/historial`;
        const params = new URLSearchParams();
        if (fecha)  params.append('fecha', fecha);
        if (estado) params.append('estado', estado);
        if (params.toString()) url += '?' + params.toString();

        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            }
        });

        if (!response.ok) throw new Error('Error');

        const registros = await response.json();
        const tbody     = document.getElementById('historialBody');
        if (!tbody) return;

        if (registros.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Sin registros</td></tr>';
            return;
        }

        tbody.innerHTML = registros.map(r => {
            // CAMBIO: 'badge badge-*' → 'trab-badge trab-badge-*'
            let badge = '';
            if      (r.estado === 'ACTIVO')     badge = '<span class="trab-badge trab-badge-info">Activo</span>';
            else if (r.estado === 'FINALIZADO') badge = '<span class="trab-badge trab-badge-warning">Pendiente</span>';
            else if (r.estado === 'COBRADO')    badge = '<span class="trab-badge trab-badge-success">Cobrado</span>';
            else                                badge = '<span class="trab-badge trab-badge-danger">Cancelado</span>';

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
        const response = await fetch(`${API_BASE_URL}/reservaciones`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            }
        });

        if (!response.ok) throw new Error('Error');

        const reservas = await response.json();
        const tbody    = document.getElementById('reservacionesBody');
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
                <!-- CAMBIO: 'badge badge-info' → 'trab-badge trab-badge-info' -->
                <td><span class="trab-badge trab-badge-info">${r.cupo}</span></td>
                <td>
                    <!-- CAMBIO: btn-success/danger → trab-btn-* (mantiene btn-aceptar/rechazar) -->
                    <button class="trab-btn-success btn-aceptar" data-id="${r.id}">Aceptar</button>
                    <button class="trab-btn-danger  btn-rechazar" data-id="${r.id}">Rechazar</button>
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
        const response = await fetch(`${API_BASE_URL}/aceptar-reservacion/${id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            }
        });

        showNotification('✅ Reservación aceptada', 'success');
        await loadReservaciones();
        await loadVehiculosActivos();
        await loadIndicadores();

    } catch (error) {
        console.error('Error:', error);
        showNotification('❌ Error', 'error');
    }
}

async function rechazarReservacion(id) {
    if (!confirm('¿Rechazar reservación?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/rechazar-reservacion/${id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            }
        });

        if (!response.ok) throw new Error('Error');

        showNotification('✅ Reservación rechazada', 'success');
        await loadReservaciones();

    } catch (error) {
        console.error('Error:', error);
        showNotification('❌ Error', 'error');
    }
}

// ==================== PLANTILLAS EXCEL ====================
function descargarPlantillaCompleta() {
    if (typeof XLSX === 'undefined') {
        showNotification('❌ Error: Librería XLSX no está cargada.', 'error');
        return;
    }

    const wb = XLSX.utils.book_new();

    const datosMixtos = [
        ['Tipo', 'Dato1', 'Dato2', 'Dato3', 'Dato4', 'Dato5', 'Dato6'],
        ['Cliente', 'Juan Pérez Ejemplo',    '3001234589', 'juan.perez.nuevo@gmail.com',    '1234567899', '', ''],
        ['Cliente', 'María González Ejemplo','3007654321', 'maria.gonzalez.nueva@gmail.com','0987654322', '', ''],
        ['Cliente', 'Carlos López Ejemplo',  '3005432109', 'carlos.lopez.nuevo@gmail.com',  '1122334456', '', ''],
        ['Vehiculo', 'ABC123', 'CARRO',     'TOYOTA',    'Blanco', '2020', 'juan.perez.nuevo@gmail.com'],
        ['Vehiculo', 'XYZ789', 'MOTO',      'HONDA',     'Negro',  '2021', 'maria.gonzalez.nueva@gmail.com'],
        ['Vehiculo', 'DEF456', 'CARRO',     'CHEVROLET', 'Rojo',   '2019', 'carlos.lopez.nuevo@gmail.com']
    ];

    const wsDatos = XLSX.utils.aoa_to_sheet(datosMixtos);
    wsDatos['!cols'] = [
        { wch: 10 }, { wch: 25 }, { wch: 15 }, { wch: 30 },
        { wch: 15 }, { wch: 10 }, { wch: 30 }
    ];
    XLSX.utils.book_append_sheet(wb, wsDatos, 'Datos');

    const instrucciones = [
        ['INSTRUCCIONES PARA LA CARGA MASIVA'],
        [''],
        ['IMPORTANTE: Todo debe estar en UNA SOLA HOJA llamada "Datos"'],
        [''],
        ['FORMATO DE CLIENTES:'],
        ['Columnas: Tipo | Nombre | Teléfono | Email | Cédula'],
        [''],
        ['FORMATO DE VEHÍCULOS:'],
        ['Columnas: Tipo | Placa | TipoVeh | Marca | Color | Año | EmailCliente'],
        [''],
        ['TIPOS DE VEHÍCULO VÁLIDOS: CARRO, MOTO, BICICLETA, OTRO'],
        [''],
        ['IMPORTANTE: Evita duplicados (cédulas, emails y placas ya registradas)']
    ];

    const wsInstrucciones = XLSX.utils.aoa_to_sheet(instrucciones);
    wsInstrucciones['!cols'] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsInstrucciones, 'Instrucciones');

    XLSX.writeFile(wb, 'Plantilla_Carga_Masiva_Completa.xlsx');
    showNotification('✅ Plantilla completa descargada', 'success');
}

function descargarPlantillaVehiculosSolo() {
    if (typeof XLSX === 'undefined') {
        showNotification('❌ Error: Librería XLSX no está cargada.', 'error');
        return;
    }

    const wb = XLSX.utils.book_new();

    const datosVehiculos = [
        ['Tipo', 'Placa', 'Tipo Vehículo', 'Marca', 'Color', 'Año', 'Email Cliente'],
        ['Vehiculo', 'ABC123', 'CARRO',     'TOYOTA',    'Blanco', '2020', 'cliente1@gmail.com'],
        ['Vehiculo', 'XYZ789', 'MOTO',      'HONDA',     'Negro',  '2021', 'cliente2@gmail.com'],
        ['Vehiculo', 'DEF456', 'CARRO',     'CHEVROLET', 'Rojo',   '2019', 'cliente3@gmail.com'],
        ['Vehiculo', 'GHI789', 'BICICLETA', 'SUZUKI',    'Azul',   '2022', 'cliente1@gmail.com'],
        ['Vehiculo', 'JKL012', 'CARRO',     'MAZDA',     'Gris',   '2023', 'cliente2@gmail.com']
    ];

    const ws = XLSX.utils.aoa_to_sheet(datosVehiculos);
    ws['!cols'] = [
        { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 12 },
        { wch: 10 }, { wch: 8 },  { wch: 28 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');

    const referencia = [
        ['TIPOS DE VEHÍCULO: CARRO, MOTO, BICICLETA, OTRO'],
        [''],
        ['NOTA: El email del cliente debe existir en el sistema']
    ];
    const wsRef = XLSX.utils.aoa_to_sheet(referencia);
    wsRef['!cols'] = [{ wch: 50 }];
    XLSX.utils.book_append_sheet(wb, wsRef, 'Referencia');

    XLSX.writeFile(wb, 'Plantilla_Vehiculos.xlsx');
    showNotification('✅ Plantilla de vehículos descargada', 'success');
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

// ==================== CARGA MASIVA ====================
async function cargarExcel() {
    const fileInput = document.getElementById('excelFile');
    const file      = fileInput?.files[0];

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

        const response = await fetch(`${API_BASE_URL}/carga-masiva`, {
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
            ? `⚠️ Carga con ${data.errores.length} error(es). Total: ${data.totalRegistros || 0}`
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
            listaErrores.innerHTML = data.errores.map(e => `<li>${e}</li>`).join('');
        }
    } else {
        if (erroresContainer) erroresContainer.style.display = 'none';
    }

    if (tbody && data.registrosCargados) {
        tbody.innerHTML = data.registrosCargados.map(r => {
            if (r.tipo === 'Vehículo' || r.tipo === 'Vehiculo') {
                return `
                    <tr>
                        <!-- CAMBIO: 'badge badge-info' → 'trab-badge trab-badge-info' -->
                        <td><span class="trab-badge trab-badge-info">🚗 ${r.tipo}</span></td>
                        <td><strong>${r.placa || 'N/A'}</strong></td>
                        <td>
                            <strong>${r.marca || 'N/A'}</strong> ${r.tipoVehiculo || ''}<br>
                            <small style="color: #64748b;">Color: ${r.color || 'N/A'} - Año: ${r.año || 'N/A'}</small><br>
                            <small style="color: #64748b;">Propietario: ${r.propietario || 'N/A'}</small>
                        </td>
                        <td><span class="trab-badge trab-badge-success">✓ Registrado</span></td>
                    </tr>
                `;
            } else if (r.tipo === 'Cliente') {
                return `
                    <tr>
                        <td><span class="trab-badge trab-badge-success">🧑‍💼 ${r.tipo}</span></td>
                        <td><strong>${r.nombre || 'N/A'}</strong></td>
                        <td>
                            ${r.email || 'N/A'}<br>
                            <small style="color: #64748b;">Tel: ${r.telefono || 'N/A'} - Cédula: ${r.cedula || 'N/A'}</small>
                        </td>
                        <td><span class="trab-badge trab-badge-success">✓ Registrado</span></td>
                    </tr>
                `;
            }
            return '';
        }).join('');
    }
}

// ==================== DELEGACIÓN DE EVENTOS ====================
function setupGlobalEventDelegation() {
    console.log('🎯 Configurando delegación de eventos global');

    document.body.addEventListener('click', function(e) {
        if (e.target.closest('.btn-salida')) {
            e.preventDefault();
            const btn = e.target.closest('.btn-salida');
            const id  = parseInt(btn.dataset.id);
            console.log('🚪 Click SALIDA, ID:', id);
            abrirModalSalida(id);
            return;
        }
        if (e.target.closest('.btn-cobrar')) {
            e.preventDefault();
            const btn = e.target.closest('.btn-cobrar');
            const id  = parseInt(btn.dataset.id);
            console.log('💰 Click COBRAR, ID:', id);
            abrirModalCobro(id);
            return;
        }
        if (e.target.closest('.btn-aceptar')) {
            e.preventDefault();
            const btn = e.target.closest('.btn-aceptar');
            const id  = btn.dataset.id;
            console.log('✅ Click ACEPTAR, ID:', id);
            aceptarReservacion(id);
            return;
        }
        if (e.target.closest('.btn-rechazar')) {
            e.preventDefault();
            const btn = e.target.closest('.btn-rechazar');
            const id  = btn.dataset.id;
            console.log('❌ Click RECHAZAR, ID:', id);
            rechazarReservacion(id);
            return;
        }
    });
}

// ==================== EVENTOS GLOBALES ====================
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const cobro  = document.getElementById('cobroModal');
        const salida = document.getElementById('salidaModal');
        // CAMBIO: .style.display === 'block' → .classList.contains('show')
        if (cobro  && cobro.classList.contains('show'))  cerrarModalCobro();
        if (salida && salida.classList.contains('show')) cerrarModalSalida();
    }
});

window.addEventListener('click', (e) => {
    const cobro  = document.getElementById('cobroModal');
    const salida = document.getElementById('salidaModal');
    if (e.target === cobro)  cerrarModalCobro();
    if (e.target === salida) cerrarModalSalida();
});

// ==================== ESTILOS — Solo animaciones del toast ====================
function injectModalStyles() {
    if (document.getElementById('modal-styles')) return;

    const style = document.createElement('style');
    style.id = 'modal-styles';
    // CAMBIO: Solo se mantienen los keyframes del toast y las clases de validación.
    // Todo lo referente a .modal/.modal-content/.modal-header/.close fue eliminado
    // porque los modales en el HTML usan .trab-modal/.trab-modal-content/.trab-modal-header
    // cuyos estilos ya están en trabajador.css
    style.textContent = `
        @keyframes slideIn  { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(400px); opacity: 0; } }
        .border-red-500   { border-color: #ef4444 !important; box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1); }
        .border-green-500 { border-color: #10b981 !important; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1); }
    `;
    document.head.appendChild(style);
}

injectModalStyles();

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Inicializando Dashboard Trabajador AparcaYA...');

    initializeTabs();
    initializeProfileMenu();
    initializeFormularioEntrada();
    initializeMarcas();
    setupGlobalEventDelegation();
    loadIndicadores();

    updateInterval = setInterval(() => {
        loadIndicadores();
        // CAMBIO: '.sidebar-nav a.active' → '.aparca-sidebar-nav a.active'
        const activeTab = document.querySelector('.aparca-sidebar-nav a.active')?.getAttribute('data-tab');
        if (activeTab === 'gestion') {
            loadVehiculosActivos();
            loadPendientesCobro();
        }
    }, 30000);

    console.log('✅ Dashboard Trabajador inicializado correctamente');
});

console.log('✅ TrabajadorD.js CARGADO COMPLETAMENTE');