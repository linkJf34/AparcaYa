// ==================== CONFIGURACIÓN GLOBAL ====================
// Autenticación por sesión de Spring Security — sin header Authorization.
const API_BASE_URL = '/api/sede';

let usuariosData = [];
let sedesData    = [];
let currentTab   = 'usuarios';
let currentSalidaRegistroId = null;
let currentCobroRegistroId  = null;
let opcionesTarifa  = null;
let updateInterval  = null;
let timerIntervals  = {};

const marcasPorTipo = {
    CARRO:     ['RENAULT','KIA','TOYOTA','CHEVROLET','MAZDA','NISSAN','VOLKSWAGEN','FORD','HYUNDAI',
        'BMW','MERCEDES_BENZ','AUDI','PEUGEOT','CITROEN','FIAT','VOLVO','JEEP','LAND_ROVER',
        'PORSCHE','FERRARI','LAMBORGHINI','TESLA','BYD','CHANGAN','GEELY','JAC','CHERY',
        'GREAT_WALL','HAVAL','GWM','MITSUBISHI','SUBARU','ISUZU','SSANGYONG','MG','RAM',
        'DFSK','FOTON','OTRO'],
    MOTO:      ['HONDA','YAMAHA','SUZUKI','KAWASAKI','BAJAJ','TVS','HERO','KTM','DUCATI',
        'HARLEY_DAVIDSON','BMW_MOTORRAD','TRIUMPH','ROYAL_ENFIELD','AUTECO','AKT',
        'VICTORY','APRILIA','BENELLI','HUSQVARNA','OTRO'],
    BICICLETA: ['TREK','SPECIALIZED','GIANT','SCOTT','CANNONDALE','ORBEA','GW','SHIMANO',
        'BIANCHI','MERIDA','CUBE','BMC','FOCUS','OTRO'],
    OTRO:      ['OTRO']
};

// ==================== NOTIFICACIONES ====================
function showNotification(message, type) {
    if (type === undefined) { type = 'info'; }
    document.querySelectorAll('.toast-notification').forEach(function(t) { t.remove(); });
    var toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.style.cssText = 'position:fixed;top:80px;right:20px;padding:1rem 1.5rem;border-radius:0.5rem;color:white;font-weight:600;z-index:9999;animation:aparca-slideUp 0.3s ease-out;max-width:400px;box-shadow:0 4px 12px rgba(0,0,0,0.15);';
    var colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#14b8a6' };
    toast.style.backgroundColor = colors[type] || colors.info;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function() {
        toast.style.opacity    = '0';
        toast.style.transition = 'opacity 0.3s ease-in';
        setTimeout(function() { toast.remove(); }, 300);
    }, 5000);
}

// ==================== MODAL CONFIRMACIÓN ====================
function showConfirm(titulo, cuerpo, btnTexto, btnColor) {
    if (btnTexto === undefined) { btnTexto = 'Confirmar'; }
    if (btnColor === undefined) { btnColor = 'danger'; }
    return new Promise(function(resolve) {
        var overlay = document.getElementById('confirm-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'confirm-overlay';
            overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:1rem;';
            document.body.appendChild(overlay);
        }
        var btnColors = { danger: 'background:#dc2626;color:#fff', warning: 'background:#f59e0b;color:#fff' };
        overlay.innerHTML =
            '<div role="dialog" aria-modal="true" style="background:#fff;border-radius:0.75rem;padding:2rem;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3);">' +
            '<h3 style="font-size:1.125rem;font-weight:700;color:#0f172a;margin:0 0 0.75rem;">' + titulo + '</h3>' +
            '<p style="font-size:0.875rem;color:#64748b;margin:0 0 1.5rem;line-height:1.6;">' + cuerpo + '</p>' +
            '<div style="display:flex;justify-content:flex-end;gap:0.75rem;">' +
            '<button id="confirm-cancel" style="padding:0.5rem 1.25rem;border:1px solid #e2e8f0;border-radius:0.5rem;background:#fff;color:#374151;cursor:pointer;">Cancelar</button>' +
            '<button id="confirm-ok" style="padding:0.5rem 1.25rem;border:none;border-radius:0.5rem;' + (btnColors[btnColor] || btnColors.danger) + ';cursor:pointer;font-weight:600;">' + btnTexto + '</button>' +
            '</div>' +
            '</div>';
        overlay.style.display = 'flex';
        document.getElementById('confirm-ok').onclick     = function() { overlay.style.display = 'none'; resolve(true);  };
        document.getElementById('confirm-cancel').onclick = function() { overlay.style.display = 'none'; resolve(false); };
    });
}

// ==================== MODAL EDICIÓN ====================
function showEditModal(titulo, campos) {
    return new Promise(function(resolve) {
        var overlay = document.getElementById('edit-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'edit-overlay';
            overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:1rem;';
            document.body.appendChild(overlay);
        }
        var inputsHtml = campos.map(function(c) {
            var input;
            if (c.type === 'select') {
                input = '<select id="edit-field-' + c.key + '" style="width:100%;padding:0.5rem;border:1px solid #d1d5db;border-radius:0.375rem;">' +
                    c.options.map(function(o) {
                        return '<option value="' + o + '"' + (o === c.value ? ' selected' : '') + '>' + o + '</option>';
                    }).join('') +
                    '</select>';
            } else {
                input = '<input id="edit-field-' + c.key + '" type="' + (c.type || 'text') + '" value="' + (c.value || '') + '" style="width:100%;padding:0.5rem;border:1px solid #d1d5db;border-radius:0.375rem;">';
            }
            return '<div style="margin-bottom:1rem;">' +
                '<label style="display:block;font-size:0.875rem;font-weight:600;color:#374151;margin-bottom:0.25rem;">' + c.label + '</label>' +
                input +
                '</div>';
        }).join('');
        overlay.innerHTML =
            '<div role="dialog" aria-modal="true" style="background:#fff;border-radius:0.75rem;padding:2rem;max-width:480px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3);max-height:90vh;overflow-y:auto;">' +
            '<h3 style="font-size:1.125rem;font-weight:700;color:#0f172a;margin:0 0 1.5rem;">' + titulo + '</h3>' +
            inputsHtml +
            '<div style="display:flex;justify-content:flex-end;gap:0.75rem;margin-top:1.5rem;">' +
            '<button id="edit-cancel" style="padding:0.5rem 1.25rem;border:1px solid #e2e8f0;border-radius:0.5rem;background:#fff;color:#374151;cursor:pointer;">Cancelar</button>' +
            '<button id="edit-ok" style="padding:0.5rem 1.25rem;border:none;border-radius:0.5rem;background:#0f766e;color:#fff;cursor:pointer;font-weight:600;">Guardar</button>' +
            '</div>' +
            '</div>';
        overlay.style.display = 'flex';
        document.getElementById('edit-ok').onclick = function() {
            var resultado = {};
            campos.forEach(function(c) {
                resultado[c.key] = document.getElementById('edit-field-' + c.key).value;
            });
            overlay.style.display = 'none';
            resolve(resultado);
        };
        document.getElementById('edit-cancel').onclick = function() {
            overlay.style.display = 'none';
            resolve(null);
        };
    });
}

// ==================== UTILIDADES ====================
function setInputValue(id, value) {
    var el = document.getElementById(id);
    if (el) { el.value = value || ''; }
}

function getInputValue(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
}

function formatDateTime(dateString) {
    if (!dateString) { return '-'; }
    try {
        return new Date(dateString).toLocaleString('es-CO', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    } catch (e) {
        return dateString;
    }
}

function formatNumber(number) {
    if (number == null) { return '0'; }
    return Number(number).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatMarcaName(marca) {
    var map = {
        'MERCEDES_BENZ': 'Mercedes-Benz', 'LAND_ROVER': 'Land Rover',
        'GREAT_WALL': 'Great Wall', 'BMW_MOTORRAD': 'BMW Motorrad',
        'HARLEY_DAVIDSON': 'Harley-Davidson', 'ROYAL_ENFIELD': 'Royal Enfield'
    };
    return map[marca] || marca.split('_').map(function(w) {
        return w.charAt(0) + w.slice(1).toLowerCase();
    }).join(' ');
}

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    initializeTrabajadorFeatures();
    injectAdditionalStyles();
    cargarEstadisticas();
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
    updateInterval = setInterval(function() {
        var activeTab = document.querySelector('.aparca-sidebar-nav a.active');
        if (activeTab && activeTab.getAttribute('data-tab') === 'gestion') {
            loadVehiculosActivos();
            loadPendientesCobro();
        }
    }, 30000);
}

// ==================== ESTADÍSTICAS / DONUTS ====================
async function cargarEstadisticas() {
    try {
        var response = await fetch(API_BASE_URL + '/estadisticas');
        if (!response.ok) { return; }
        var data = await response.json();
        var pctActivos = data.totalUsuarios > 0
            ? Math.round((data.usuariosActivos / data.totalUsuarios) * 100) : 0;
        var pctSedes = data.capacidadTotal > 0
            ? Math.min(Math.round((data.sedesActivas / (data.totalSedes || 1)) * 100), 100) : 0;
        var indicadores = document.querySelector('.user-indicators');
        if (indicadores) {
            var segs  = indicadores.querySelectorAll('.donut-segment');
            var texts = indicadores.querySelectorAll('.donut-text');
            if (segs[0])  { segs[0].setAttribute('stroke-dasharray',  pctActivos + ' 100'); }
            if (texts[0]) { texts[0].textContent = pctActivos + '%'; }
            if (segs[1])  { segs[1].setAttribute('stroke-dasharray',  pctSedes   + ' 100'); }
            if (texts[1]) { texts[1].textContent = pctSedes + '%'; }
        }
    } catch (e) {
        console.error('Error cargando estadísticas:', e);
    }
}

// ==================== NAVEGACIÓN ====================
function setupEventListeners() {
    document.querySelectorAll('.aparca-sidebar-nav a').forEach(function(link) {
        link.addEventListener('click', handleNavigation);
    });

    var btnUsuarios   = document.getElementById('btnUsuarios');
    var btnSedes      = document.getElementById('btnSedes');
    var tabMailUno    = document.getElementById('tab-mailuno');
    var tabMailMasivo = document.getElementById('tab-mailmasivo');
    var busquedaInput = document.getElementById('busquedaInput');
    var filtroEstado  = document.getElementById('filtroEstado');

    if (btnUsuarios)   { btnUsuarios.addEventListener('click',   function() { switchToTab('usuarios'); }); }
    if (btnSedes)      { btnSedes.addEventListener('click',      function() { switchToTab('sedes');    }); }
    if (tabMailUno)    { tabMailUno.addEventListener('click',    function() { switchMailTab('uno');    }); }
    if (tabMailMasivo) { tabMailMasivo.addEventListener('click', function() { switchMailTab('masivo'); }); }
    if (busquedaInput) { busquedaInput.addEventListener('input', filtrarDatos); }
    if (filtroEstado)  { filtroEstado.addEventListener('change', filtrarDatos); }

    var modalTrabajador = document.getElementById('registrarTrabajadorModal');
    if (modalTrabajador) {
        modalTrabajador.addEventListener('click', function(e) {
            if (e.target === this) { closeRegistrarTrabajadorModal(); }
        });
    }
}

function handleNavigation(e) {
    e.preventDefault();
    document.querySelectorAll('.aparca-sidebar-nav a').forEach(function(l) {
        l.classList.remove('active');
    });
    e.currentTarget.classList.add('active');
    var tab = e.currentTarget.getAttribute('data-tab');
    document.querySelectorAll('.aparca-content-section').forEach(function(s) {
        s.classList.add('hidden');
    });
    var section = document.getElementById(tab);
    if (section) { section.classList.remove('hidden'); }
    if (tab === 'gestion')       { loadVehiculosActivos(); loadPendientesCobro(); }
    if (tab === 'historial')     { loadHistorial(); }
    if (tab === 'reservaciones') { loadReservaciones(); }
    if (window.innerWidth < 640) { document.body.classList.add('sidebar-collapsed'); }
}

function switchToTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.sede-tabs button').forEach(function(btn) {
        btn.classList.remove('active');
    });
    var btnUsuarios = document.getElementById('btnUsuarios');
    var btnSedes    = document.getElementById('btnSedes');
    var tablaU      = document.getElementById('tablaUsuarios');
    var tablaS      = document.getElementById('tablaSedes');
    if (tab === 'usuarios') {
        if (btnUsuarios) { btnUsuarios.classList.add('active'); }
        if (tablaU)      { tablaU.classList.remove('hidden'); }
        if (tablaS)      { tablaS.classList.add('hidden'); }
    } else {
        if (btnSedes) { btnSedes.classList.add('active'); }
        if (tablaU)   { tablaU.classList.add('hidden'); }
        if (tablaS)   { tablaS.classList.remove('hidden'); }
    }
    filtrarDatos();
}

function switchMailTab(tipo) {
    document.querySelectorAll('#correo .sede-tabs button').forEach(function(btn) {
        btn.classList.remove('active');
    });
    var tabUno    = document.getElementById('tab-mailuno');
    var tabMasivo = document.getElementById('tab-mailmasivo');
    var correoUno = document.getElementById('correoUno');
    var correoMas = document.getElementById('correoMasivo');
    if (tipo === 'uno') {
        if (tabUno)    { tabUno.classList.add('active'); }
        if (correoUno) { correoUno.removeAttribute('hidden'); }
        if (correoMas) { correoMas.setAttribute('hidden', ''); }
    } else {
        if (tabMasivo) { tabMasivo.classList.add('active'); }
        if (correoUno) { correoUno.setAttribute('hidden', ''); }
        if (correoMas) { correoMas.removeAttribute('hidden'); }
    }
}

// ==================== CARGA DE DATOS ====================
async function cargarUsuarios() {
    try {
        var response = await fetch(API_BASE_URL + '/usuarios');
        if (response.ok) {
            usuariosData = await response.json();
            mostrarUsuarios(usuariosData);
        } else {
            showNotification('No se pudieron cargar los usuarios', 'error');
        }
    } catch (e) {
        showNotification('Error de conexión al cargar usuarios', 'error');
    }
}

async function cargarSedes() {
    try {
        var response = await fetch(API_BASE_URL + '/sedes');
        if (response.ok) {
            sedesData = await response.json();
            mostrarSedes(sedesData);
        } else {
            showNotification('No se pudieron cargar las sedes', 'error');
        }
    } catch (e) {
        showNotification('Error de conexión al cargar sedes', 'error');
    }
}

// ==================== VISUALIZACIÓN ====================
function mostrarUsuarios(usuarios) {
    var tbody = document.getElementById('usuariosTableBody');
    if (!tbody) { return; }
    if (usuarios.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#64748b;">No hay clientes registrados</td></tr>';
        return;
    }
    tbody.innerHTML = usuarios.map(function(u) {
        return '<tr>' +
            '<td>' + (u.nombre || 'N/A') + '</td>' +
            '<td>' + (u.correo || 'N/A') + '</td>' +
            '<td><span class="sede-badge sede-badge-info">' + (u.rol || 'N/A') + '</span></td>' +
            '<td><span class="sede-badge ' + (u.estado === 'ACTIVO' ? 'sede-badge-success' : 'sede-badge-danger') + '">' + (u.estado || 'N/A') + '</span></td>' +
            '<td>' +
            '<button class="sede-btn-icon sede-btn-edit"   onclick="editarUsuario('  + u.id + ')" title="Editar">✏️</button>'  +
            '<button class="sede-btn-icon sede-btn-delete" onclick="eliminarUsuario(' + u.id + ')" title="Eliminar">🗑️</button>' +
            '</td>' +
            '</tr>';
    }).join('');
}

function mostrarSedes(sedes) {
    var tbody = document.getElementById('sedesTableBody');
    if (!tbody) { return; }
    if (sedes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#64748b;">No tiene sede asignada</td></tr>';
        return;
    }
    tbody.innerHTML = sedes.map(function(s) {
        return '<tr>' +
            '<td>' + (s.nombre    || 'N/A') + '</td>' +
            '<td>' + (s.direccion || 'N/A') + '</td>' +
            '<td>' + (s.capacidad || 0)     + '</td>' +
            '<td><span class="sede-badge ' + (s.estado === 'ACTIVO' ? 'sede-badge-success' : 'sede-badge-danger') + '">' + (s.estado || 'N/A') + '</span></td>' +
            '<td><button class="sede-btn-icon sede-btn-edit" onclick="editarSede(' + s.id + ')" title="Editar">✏️</button></td>' +
            '</tr>';
    }).join('');
}

// ==================== FILTRADO ====================
function filtrarDatos() {
    var busquedaEl = document.getElementById('busquedaInput');
    var estadoEl   = document.getElementById('filtroEstado');
    var busqueda   = busquedaEl ? busquedaEl.value.toLowerCase() : '';
    var estado     = estadoEl  ? estadoEl.value.toLowerCase()   : '';
    if (currentTab === 'usuarios') {
        mostrarUsuarios(usuariosData.filter(function(u) {
            var matchB = !busqueda || [u.nombre, u.correo, u.rol].some(function(v) {
                return v && v.toLowerCase().includes(busqueda);
            });
            var matchE = !estado || (u.estado && u.estado.toLowerCase() === estado);
            return matchB && matchE;
        }));
    } else {
        mostrarSedes(sedesData.filter(function(s) {
            var matchB = !busqueda || [s.nombre, s.direccion].some(function(v) {
                return v && v.toLowerCase().includes(busqueda);
            });
            var matchE = !estado || (s.estado && s.estado.toLowerCase() === estado);
            return matchB && matchE;
        }));
    }
}

// ==================== MARCAS ====================
function actualizarMarcasEntrada() {
    var tipoSelect  = document.getElementById('tipoVehiculo');
    var marcaSelect = document.getElementById('marca');
    if (!tipoSelect || !marcaSelect) { return; }
    var tipo = tipoSelect.value;
    marcaSelect.innerHTML = '<option value="">Selecciona una marca</option>';
    if (tipo && marcasPorTipo[tipo]) {
        marcasPorTipo[tipo].forEach(function(marca) {
            var opt = document.createElement('option');
            opt.value       = marca;
            opt.textContent = formatMarcaName(marca);
            marcaSelect.appendChild(opt);
        });
    }
}

function initializeMarcas() {
    var tipoSelect = document.getElementById('tipoVehiculo');
    if (tipoSelect) {
        tipoSelect.addEventListener('change', actualizarMarcasEntrada);
        actualizarMarcasEntrada();
    }
}

// ==================== VALIDACIÓN ====================
function validateFieldEntrada(fieldId) {
    var field     = document.getElementById(fieldId);
    var errorSpan = document.getElementById(fieldId + '-error');
    if (!field) { return true; }
    var isValid = true;
    var message = '';
    var value   = field.value.trim();
    switch (fieldId) {
        case 'nombre':
            if (!value)           { isValid = false; message = 'El nombre es obligatorio.'; }
            else if (value.length < 2) { isValid = false; message = 'Al menos 2 caracteres.'; }
            break;
        case 'correo1':
            if (!value)           { isValid = false; message = 'El correo es obligatorio.'; }
            else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { isValid = false; message = 'Formato inválido.'; }
            break;
        case 'telefono':
            if (!value)           { isValid = false; message = 'El teléfono es obligatorio.'; }
            else if (!/^[0-9]{10}$/.test(value)) { isValid = false; message = 'Debe tener 10 dígitos.'; }
            break;
        case 'cedula':
            if (!value)           { isValid = false; message = 'La cédula es obligatoria.'; }
            else if (!/^[0-9]{10}$/.test(value)) { isValid = false; message = 'Debe tener 10 dígitos.'; }
            break;
        case 'placa':
            if (!value)           { isValid = false; message = 'La placa es obligatoria.'; }
            else if (!/^[A-Z]{3}[0-9]{3}$/.test(value)) { isValid = false; message = 'Formato: ABC123'; }
            break;
        case 'tipoVehiculo':
            if (!value)           { isValid = false; message = 'Selecciona el tipo.'; }
            break;
        case 'marca':
            if (!value)           { isValid = false; message = 'Selecciona la marca.'; }
            break;
    }
    if (errorSpan) { errorSpan.textContent = isValid ? '' : message; }
    field.classList.toggle('border-red-500',   !isValid);
    field.classList.toggle('border-green-500',  isValid && value !== '');
    return isValid;
}

function validateFormularioEntrada() {
    return ['nombre', 'correo1', 'telefono', 'cedula', 'placa', 'tipoVehiculo', 'marca']
        .map(function(c) { return validateFieldEntrada(c); })
        .every(function(v) { return v; });
}

function limpiarFormularioEntrada() {
    ['nombre', 'telefono', 'correo1', 'cedula', 'placa', 'color', 'anio', 'buscarPlaca']
        .forEach(function(id) { setInputValue(id, ''); });
    var t = document.getElementById('tipoVehiculo');
    if (t) { t.value = ''; }
    var m = document.getElementById('marca');
    if (m) { m.innerHTML = '<option value="">Selecciona una marca</option>'; }
    ['nombre', 'correo1', 'telefono', 'cedula', 'placa', 'tipoVehiculo', 'marca'].forEach(function(fId) {
        var err = document.getElementById(fId + '-error');
        if (err) { err.textContent = ''; }
        var f = document.getElementById(fId);
        if (f) { f.classList.remove('border-red-500', 'border-green-500'); }
    });
}

// ==================== FORMULARIO ENTRADA ====================
function initializeFormularioEntrada() {
    var form = document.getElementById('registroEntradaForm');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            await registrarEntradaDirecto();
        });
        ['nombre', 'telefono', 'correo1', 'cedula', 'placa', 'tipoVehiculo', 'marca'].forEach(function(campoId) {
            var campo = document.getElementById(campoId);
            if (campo) {
                campo.addEventListener('blur', function() { validateFieldEntrada(campoId); });
                campo.addEventListener('input', function() {
                    var err = document.getElementById(campoId + '-error');
                    if (err && campo.value.trim()) {
                        err.textContent = '';
                        campo.classList.remove('border-red-500');
                    }
                });
            }
        });
        var tel = document.getElementById('telefono');
        if (tel) {
            tel.addEventListener('input', function(e) {
                e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
            });
        }
        var ced = document.getElementById('cedula');
        if (ced) {
            ced.addEventListener('input', function(e) {
                e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
            });
        }
        var plc = document.getElementById('placa');
        if (plc) {
            plc.addEventListener('input', function(e) {
                e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 6);
            });
        }
    }
    var buscar = document.getElementById('buscarPlaca');
    if (buscar) {
        buscar.addEventListener('input', function(e) {
            e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        });
        buscar.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); buscarPorPlacaIntegrado(); }
        });
    }
}

async function registrarEntradaDirecto() {
    if (!validateFormularioEntrada()) {
        showNotification('Completa todos los campos correctamente', 'error');
        return;
    }
    try {
        showNotification('Registrando entrada...', 'info');
        var datos = {
            clienteNombre:   getInputValue('nombre'),
            clienteTelefono: getInputValue('telefono'),
            clienteEmail:    getInputValue('correo1'),
            clienteCedula:   getInputValue('cedula'),
            vehiculoPlaca:   getInputValue('placa'),
            vehiculoTipo:    getInputValue('tipoVehiculo'),
            vehiculoMarca:   getInputValue('marca'),
            vehiculoColor:   getInputValue('color') || 'NO ESPECIFICADO',
            vehiculoAnio:    getInputValue('anio')  || '2020'
        };
        var response = await fetch(API_BASE_URL + '/registrar-entrada', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        if (!response.ok) {
            var err = await response.json();
            throw new Error(err.error || 'Error al registrar entrada');
        }
        showNotification('Entrada registrada. Timer iniciado', 'success');
        limpiarFormularioEntrada();
        setTimeout(function() { loadVehiculosActivos(); }, 500);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function buscarPorPlacaIntegrado() {
    var placa = getInputValue('buscarPlaca');
    if (!placa || placa.length < 5) {
        showNotification('Ingrese una placa válida', 'warning');
        return;
    }
    try {
        var response = await fetch(API_BASE_URL + '/buscar-por-placa/' + placa, {
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) { throw new Error('Error'); }
        var data = await response.json();
        if (data.encontrado) {
            setInputValue('nombre',   data.cliente.nombre);
            setInputValue('telefono', data.cliente.telefono);
            setInputValue('correo1',  data.cliente.email);
            setInputValue('cedula',   data.cliente.cedula || '');
            setInputValue('placa',    data.vehiculo.placa);
            setInputValue('color',    data.vehiculo.color);
            var tipoSelect = document.getElementById('tipoVehiculo');
            if (tipoSelect) {
                tipoSelect.value = data.vehiculo.tipo;
                actualizarMarcasEntrada();
                setTimeout(function() {
                    var m = document.getElementById('marca');
                    if (m) { m.value = data.vehiculo.marca; }
                }, 100);
            }
            if (data.vehiculo.anio) { setInputValue('anio', data.vehiculo.anio); }
            showNotification('Vehículo encontrado', 'success');
        } else {
            limpiarFormularioEntrada();
            setInputValue('placa', placa);
            showNotification('Vehículo nuevo. Complete los datos.', 'info');
        }
    } catch (e) {
        showNotification('Error al buscar', 'error');
    }
}

// ==================== VEHÍCULOS ACTIVOS ====================
async function loadVehiculosActivos() {
    try {
        var response = await fetch(API_BASE_URL + '/vehiculos-activos', {
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) { throw new Error('Error'); }
        var vehiculos = await response.json();
        var tbody = document.getElementById('vehiculosActivosBody');
        if (!tbody) { return; }

        Object.values(timerIntervals).forEach(function(id) { clearInterval(id); });
        timerIntervals = {};

        if (vehiculos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No hay vehículos en el parqueadero</td></tr>';
            return;
        }
        tbody.innerHTML = vehiculos.map(function(v) {
            return '<tr>' +
                '<td><strong>' + v.placa + '</strong></td>' +
                '<td>' + v.tipoVehiculo  + '</td>' +
                '<td>' + v.clienteNombre + '</td>' +
                '<td>' + v.clienteTelefono + '</td>' +
                '<td>' + formatDateTime(v.horaEntrada) + '</td>' +
                '<td><span class="tiempo-activo" id="timer-' + v.registroId + '">' + v.tiempoTranscurrido + '</span></td>' +
                '<td><div style="font-size:0.85rem;">' +
                '<div><strong>Plena:</strong> $' + formatNumber(v.cobroEstimadoPlena) + '</div>' +
                '<div style="color:#059669;"><strong>Minuto:</strong> $' + formatNumber(v.cobroEstimadoMinuto) + '</div>' +
                '</div></td>' +
                '<td><button class="sede-btn-warning sede-btn-salida" data-id="' + v.registroId + '">Salida</button></td>' +
                '</tr>';
        }).join('');

        vehiculos.forEach(function(v) {
            var el = document.getElementById('timer-' + v.registroId);
            if (!el) { return; }
            var secs = v.segundosTranscurridos;
            timerIntervals[v.registroId] = setInterval(function() {
                secs++;
                var h   = Math.floor(secs / 3600);
                var min = Math.floor((secs % 3600) / 60);
                var s   = secs % 60;
                if (h > 0)        { el.textContent = h + 'h ' + min + 'm ' + s + 's'; }
                else if (min > 0) { el.textContent = min + 'm ' + s + 's'; }
                else              { el.textContent = s + 's'; }
            }, 1000);
        });
    } catch (e) {
        showNotification('Error al cargar vehículos activos', 'error');
    }
}

// ==================== MODAL SALIDA ====================
// BUG #1 CORREGIDO: API_TRABAJADOR_URL → API_BASE_URL
// BUG #2 CORREGIDO: display:'block' → classList.add('open')
async function abrirModalSalida(registroId) {
    var modal = document.getElementById('salidaModal');
    if (!modal) { showNotification('Error: Modal no encontrado', 'error'); return; }
    try {
        currentSalidaRegistroId = registroId;

        // FIX #1: usa API_BASE_URL (no la variable comentada API_TRABAJADOR_URL)
        var response = await fetch(API_BASE_URL + '/vehiculos-activos', {
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) { throw new Error('Error al obtener datos'); }
        var vehiculos = await response.json();
        var v = vehiculos.find(function(x) { return x.registroId === registroId; });
        if (!v) { showNotification('Vehículo no encontrado', 'error'); return; }

        var elPlaca   = document.getElementById('salidaPlaca');
        var elCliente = document.getElementById('salidaCliente');
        var elEntrada = document.getElementById('salidaHoraEntrada');
        var elTiempo  = document.getElementById('salidaTiempo');
        var elCobro   = document.getElementById('salidaCobroEstimado');

        if (elPlaca)   { elPlaca.textContent   = v.placa; }
        if (elCliente) { elCliente.textContent = v.clienteNombre; }
        if (elEntrada) { elEntrada.textContent = formatDateTime(v.horaEntrada); }
        if (elTiempo)  { elTiempo.textContent  = v.tiempoTranscurrido; }
        if (elCobro) {
            elCobro.innerHTML =
                '<div class="sede-modal-salida-row"><strong>Plena:</strong><span>$' + formatNumber(v.cobroEstimadoPlena) + '</span></div>' +
                '<div class="sede-modal-salida-row"><strong>Minuto:</strong><span style="color:#059669;">$' + formatNumber(v.cobroEstimadoMinuto) + '</span></div>';
        }

        // FIX #2: abre con clase .open (el overlay usa display:flex via CSS)
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
    } catch (e) {
        showNotification('Error al abrir modal de salida', 'error');
    }
}

function cerrarModalSalida() {
    var modal = document.getElementById('salidaModal');
    if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
    }
    currentSalidaRegistroId = null;
}

async function confirmarSalida() {
    if (!currentSalidaRegistroId) { return; }
    try {
        showNotification('Registrando salida...', 'info');
        var response = await fetch(API_BASE_URL + '/registrar-salida/' + currentSalidaRegistroId, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            var err = await response.json();
            throw new Error(err.error || 'Error');
        }
        showNotification('Salida registrada. Proceda a cobrar.', 'success');
        cerrarModalSalida();
        await loadVehiculosActivos();
        await loadPendientesCobro();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// ==================== PENDIENTES COBRO ====================
async function loadPendientesCobro() {
    try {
        var response = await fetch(API_BASE_URL + '/vehiculos-pendientes-cobro', {
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) { throw new Error('Error'); }
        var pendientes = await response.json();
        var tbody = document.getElementById('pendientesCobroBody');
        if (!tbody) { return; }
        if (pendientes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No hay pendientes</td></tr>';
            return;
        }
        tbody.innerHTML = pendientes.map(function(p) {
            return '<tr>' +
                '<td><strong>' + p.placa + '</strong></td>' +
                '<td>' + p.clienteNombre + '</td>' +
                '<td>' + formatDateTime(p.horaEntrada) + '</td>' +
                '<td>' + formatDateTime(p.horaSalida)  + '</td>' +
                '<td>' + p.tiempoTotal + '</td>' +
                '<td style="font-weight:700;color:#059669;">$' + formatNumber(p.precio) + '</td>' +
                '<td><button class="sede-btn-success sede-btn-cobrar" data-id="' + p.registroId + '">Cobrar</button></td>' +
                '</tr>';
        }).join('');
    } catch (error) {
        console.error('Error pendientes cobro:', error);
    }
}

// ==================== MODAL COBRO ====================
// BUG #2 CORREGIDO: display:'block' → classList.add('open')
async function abrirModalCobro(registroId) {
    currentCobroRegistroId = registroId;
    var modal = document.getElementById('cobroModal');
    if (!modal) { return; }

    // FIX: abre con clase .open antes de la llamada async
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');

    try {
        var response = await fetch(API_BASE_URL + '/opciones-cobro/' + registroId, {
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            var err = await response.json();
            throw new Error(err.error || 'Error');
        }
        var data = await response.json();
        opcionesTarifa = data;

        var elCliente = document.getElementById('cobroCliente');
        var elPlaca   = document.getElementById('cobroPlaca');
        var elTiempo  = document.getElementById('cobroTiempo');
        var container = document.getElementById('tarifaSelectorContainer');
        var elPrecio  = document.getElementById('cobroPrecio');

        if (elCliente) { elCliente.textContent = data.clienteNombre; }
        if (elPlaca)   { elPlaca.textContent   = data.placa; }
        if (elTiempo)  { elTiempo.textContent  = data.tiempoTotal; }

        if (container) {
            container.innerHTML =
                '<div class="sede-modal-cobro-selector">' +
                '<p>Seleccione tarifa:</p>' +
                data.opciones.map(function(op, i) {
                    return '<label class="sede-modal-cobro-opcion">' +
                        '<input type="radio" name="tipoTarifa" value="' + op.tipo + '"' + (i === 0 ? ' checked' : '') +
                        ' onchange="actualizarPrecioCobro(\'' + op.tipo + '\',' + op.precio + ')">' +
                        '<strong>' + op.nombre + '</strong>' +
                        '<div>$' + formatNumber(op.precio) + ' COP</div>' +
                        '</label>';
                }).join('') +
                '</div>';
        }
        if (elPrecio && data.opciones[0]) { elPrecio.textContent = formatNumber(data.opciones[0].precio); }
    } catch (error) {
        showNotification(error.message, 'error');
        cerrarModalCobro();
    }
}

function actualizarPrecioCobro(tipo, precio) {
    var el = document.getElementById('cobroPrecio');
    if (el) { el.textContent = formatNumber(precio); }
}

function cerrarModalCobro() {
    var modal = document.getElementById('cobroModal');
    if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
    }
    currentCobroRegistroId = null;
    opcionesTarifa = null;
    var container = document.getElementById('tarifaSelectorContainer');
    if (container) { container.innerHTML = ''; }
}

async function procesarCobro() {
    if (!currentCobroRegistroId) { return; }
    try {
        var metodoPagoEl = document.getElementById('metodoPago');
        var metodoPago   = metodoPagoEl ? metodoPagoEl.value : 'EFECTIVO';
        var tipoTarifa   = document.querySelector('input[name="tipoTarifa"]:checked');
        if (!tipoTarifa) { showNotification('Seleccione una tarifa', 'warning'); return; }
        showNotification('Procesando cobro...', 'info');
        var response = await fetch(API_BASE_URL + '/confirmar-cobro/' + currentCobroRegistroId, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ metodoPago: metodoPago, tipoTarifa: tipoTarifa.value })
        });
        if (!response.ok) {
            var err = await response.json();
            throw new Error(err.error || 'Error');
        }
        var data = await response.json();
        showNotification('Cobro: $' + formatNumber(data.precio) + ' - ' + data.tipoTarifaAplicada, 'success');
        cerrarModalCobro();
        await loadPendientesCobro();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// ==================== HISTORIAL ====================
async function loadHistorial() {
    try {
        var fechaEl  = document.getElementById('filtroFecha');
        var estadoEl = document.getElementById('filtroEstado1');
        var fecha    = fechaEl  ? fechaEl.value  : '';
        var estado   = estadoEl ? estadoEl.value : '';
        var url    = API_BASE_URL + '/historial';
        var params = new URLSearchParams();
        if (fecha)  { params.append('fecha',  fecha);  }
        if (estado) { params.append('estado', estado); }
        if (params.toString()) { url += '?' + params.toString(); }

        var response = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
        if (!response.ok) { throw new Error('Error'); }
        var registros = await response.json();
        var tbody = document.getElementById('historialBody');
        if (!tbody) { return; }
        if (registros.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Sin registros</td></tr>';
            return;
        }
        tbody.innerHTML = registros.map(function(r) {
            var badge;
            if      (r.estado === 'ACTIVO')     { badge = '<span class="sede-badge sede-badge-info">Activo</span>';       }
            else if (r.estado === 'FINALIZADO') { badge = '<span class="sede-badge sede-badge-warning">Pendiente</span>'; }
            else if (r.estado === 'COBRADO')    { badge = '<span class="sede-badge sede-badge-success">Cobrado</span>';   }
            else                                { badge = '<span class="sede-badge sede-badge-danger">Cancelado</span>';  }
            return '<tr>' +
                '<td><strong>' + r.placa + '</strong></td>' +
                '<td>' + r.tipoVehiculo + '</td>' +
                '<td>' + r.clienteNombre + '</td>' +
                '<td>' + r.clienteTelefono + '</td>' +
                '<td>' + formatDateTime(r.horaEntrada) + '</td>' +
                '<td>' + (r.horaSalida ? formatDateTime(r.horaSalida) : '-') + '</td>' +
                '<td>' + r.tiempoTotal + '</td>' +
                '<td>' + (r.precio ? '$' + formatNumber(r.precio) : '-') + '</td>' +
                '<td>' + badge + '</td>' +
                '</tr>';
        }).join('');
    } catch (error) {
        console.error('Error historial:', error);
    }
}

// ==================== RESERVACIONES ====================
async function loadReservaciones() {
    try {
        var response = await fetch(API_BASE_URL + '/reservaciones', {
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) { throw new Error('Error'); }
        var reservas = await response.json();
        var tbody = document.getElementById('reservacionesBody');
        if (!tbody) { return; }
        if (reservas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Sin reservaciones</td></tr>';
            return;
        }
        tbody.innerHTML = reservas.map(function(r) {
            return '<tr>' +
                '<td>' + r.clienteNombre + '</td>' +
                '<td>' + r.clienteTelefono + '</td>' +
                '<td><strong>' + r.placa + '</strong></td>' +
                '<td>' + r.tipoVehiculo + '</td>' +
                '<td>' + formatDateTime(r.horaInicio) + '</td>' +
                '<td>' + formatDateTime(r.horaFin)    + '</td>' +
                '<td><span class="sede-badge sede-badge-info">' + r.cupo + '</span></td>' +
                '<td>' +
                '<button class="sede-btn-success sede-btn-aceptar"  data-id="' + r.id + '">Aceptar</button> ' +
                '<button class="sede-btn-danger  sede-btn-rechazar" data-id="' + r.id + '">Rechazar</button>' +
                '</td>' +
                '</tr>';
        }).join('');
    } catch (error) {
        console.error('Error reservaciones:', error);
    }
}

async function aceptarReservacion(id) {
    var ok = await showConfirm('Aceptar reservación', '¿Confirmas que deseas aceptar esta reservación?', 'Aceptar', 'warning');
    if (!ok) { return; }
    try {
        await fetch(API_BASE_URL + '/aceptar-reservacion/' + id, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }
        });
        showNotification('Reservación aceptada', 'success');
        await loadReservaciones();
        await loadVehiculosActivos();
    } catch (e) {
        showNotification('Error', 'error');
    }
}

async function rechazarReservacion(id) {
    var ok = await showConfirm('Rechazar reservación', '¿Confirmas que deseas rechazar esta reservación?', 'Rechazar', 'danger');
    if (!ok) { return; }
    try {
        var response = await fetch(API_BASE_URL + '/rechazar-reservacion/' + id, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) { throw new Error('Error'); }
        showNotification('Reservación rechazada', 'success');
        await loadReservaciones();
    } catch (e) {
        showNotification('Error', 'error');
    }
}

// ==================== CARGA MASIVA ====================
async function cargarExcel() {
    var fileInput = document.getElementById('excelFile');
    var file = fileInput ? fileInput.files[0] : null;
    if (!file) { showNotification('Por favor seleccione un archivo Excel', 'warning'); return; }
    var ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls'].includes(ext)) { showNotification('El archivo debe ser formato Excel (.xlsx o .xls)', 'warning'); return; }

    var pc = document.getElementById('progressContainer');
    var pb = document.getElementById('progressBar');
    var pt = document.getElementById('progressText');
    try {
        if (pc) { pc.style.display = 'block'; }
        if (pb) { pb.style.width = '30%'; pb.textContent = '30%'; }
        if (pt) { pt.textContent = 'Subiendo archivo...'; }
        var formData = new FormData();
        formData.append('file', file);
        var response = await fetch(API_BASE_URL + '/carga-masiva', { method: 'POST', body: formData });
        if (pb) { pb.style.width = '70%'; pb.textContent = '70%'; }
        if (pt) { pt.textContent = 'Procesando datos...'; }
        if (!response.ok) {
            var errData = {};
            try { errData = await response.json(); } catch (e2) {}
            throw new Error(errData.error || 'Error al procesar el archivo');
        }
        var data = await response.json();
        if (pb) { pb.style.width = '100%'; pb.textContent = '100%'; }
        if (pt) { pt.textContent = 'Completado'; }
        mostrarResultadosCarga(data);
        showNotification(
            data.tieneErrores
                ? 'Carga completada con ' + data.errores.length + ' error(es)'
                : 'Carga exitosa: ' + (data.totalRegistros || 0) + ' registros',
            data.tieneErrores ? 'warning' : 'success'
        );
        fileInput.value = '';
        var archivoInfo = document.getElementById('archivoSeleccionado');
        if (archivoInfo) { archivoInfo.innerHTML = ''; }
        setTimeout(function() { if (pc) { pc.style.display = 'none'; } }, 2000);
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
        if (pc) { pc.style.display = 'none'; }
    }
}

function mostrarResultadosCarga(data) {
    var rd = document.getElementById('resultadosCarga');
    if (rd) { rd.style.display = 'block'; }
    var resumen = document.getElementById('resumenCarga');
    if (resumen) {
        resumen.innerHTML =
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;">' +
            '<div style="background:linear-gradient(135deg,#d1fae5,#a7f3d0);padding:1.5rem;border-radius:0.75rem;text-align:center;">' +
            '<div style="font-size:2rem;font-weight:700;color:#065f46;">'  + (data.clientesRegistrados  || 0) + '</div>' +
            '<div style="font-size:0.9rem;color:#047857;font-weight:600;">Clientes Registrados</div>' +
            '</div>' +
            '<div style="background:linear-gradient(135deg,#ccfbf1,#99f6e4);padding:1.5rem;border-radius:0.75rem;text-align:center;">' +
            '<div style="font-size:2rem;font-weight:700;color:#0f766e;">'  + (data.vehiculosRegistrados || 0) + '</div>' +
            '<div style="font-size:0.9rem;color:#0d9488;font-weight:600;">Vehículos Registrados</div>' +
            '</div>' +
            '<div style="background:linear-gradient(135deg,#e0f2f1,#b2dfdb);padding:1.5rem;border-radius:0.75rem;text-align:center;">' +
            '<div style="font-size:2rem;font-weight:700;color:#00695c;">'  + (data.totalRegistros       || 0) + '</div>' +
            '<div style="font-size:0.9rem;color:#00796b;font-weight:600;">Total Registros</div>' +
            '</div>' +
            '</div>';
    }
    var ec = document.getElementById('erroresContainer');
    var le = document.getElementById('listaErrores');
    if (data.errores && data.errores.length > 0) {
        if (ec) { ec.style.display = 'block'; }
        if (le) { le.innerHTML = data.errores.map(function(e) { return '<li>' + e + '</li>'; }).join(''); }
    } else {
        if (ec) { ec.style.display = 'none'; }
    }
    var tbody = document.getElementById('resultadosCargaBody');
    if (tbody && data.registrosCargados) {
        tbody.innerHTML = data.registrosCargados.map(function(r) {
            if (r.tipo === 'Vehículo' || r.tipo === 'Vehiculo') {
                return '<tr>' +
                    '<td><span class="sede-badge sede-badge-info">🚗 ' + r.tipo + '</span></td>' +
                    '<td><strong>' + (r.placa || 'N/A') + '</strong></td>' +
                    '<td><strong>' + (r.marca || 'N/A') + '</strong> ' + (r.tipoVehiculo || '') +
                    '<br><small style="color:#64748b;">Color: ' + (r.color || 'N/A') + ' - Año: ' + (r.anio || 'N/A') + '</small>' +
                    '<br><small style="color:#64748b;">Propietario: ' + (r.propietario || 'N/A') + '</small></td>' +
                    '<td><span class="sede-badge sede-badge-success">✓ Registrado</span></td>' +
                    '</tr>';
            }
            if (r.tipo === 'Cliente') {
                return '<tr>' +
                    '<td><span class="sede-badge sede-badge-success">👤 ' + r.tipo + '</span></td>' +
                    '<td><strong>' + (r.nombre || 'N/A') + '</strong></td>' +
                    '<td>' + (r.email || 'N/A') +
                    '<br><small style="color:#64748b;">Tel: ' + (r.telefono || 'N/A') + ' - Cédula: ' + (r.cedula || 'N/A') + '</small></td>' +
                    '<td><span class="sede-badge sede-badge-success">✓ Registrado</span></td>' +
                    '</tr>';
            }
            return '';
        }).join('');
    }
}

function descargarPlantillaCompleta() {
    if (typeof XLSX === 'undefined') { showNotification('Error: Librería XLSX no está cargada', 'error'); return; }
    var wb  = XLSX.utils.book_new();
    var wsC = XLSX.utils.aoa_to_sheet([
        ['Tipo', 'Nombre', 'Teléfono', 'Email', 'Cédula'],
        ['Cliente', 'Juan Pérez', '0987654321', 'juan@gmail.com', '1234567899']
    ]);
    wsC['!cols'] = [{wch:10},{wch:20},{wch:12},{wch:28},{wch:12}];
    XLSX.utils.book_append_sheet(wb, wsC, 'Clientes');
    var wsV = XLSX.utils.aoa_to_sheet([
        ['Tipo', 'Placa', 'Tipo Vehículo', 'Marca', 'Color', 'Año', 'Email Cliente'],
        ['Vehiculo', 'ABC123', 'CARRO', 'TOYOTA', 'Blanco', '2020', 'juan@gmail.com']
    ]);
    wsV['!cols'] = [{wch:10},{wch:10},{wch:15},{wch:12},{wch:10},{wch:8},{wch:28}];
    XLSX.utils.book_append_sheet(wb, wsV, 'Vehículos');
    XLSX.writeFile(wb, 'Plantilla_Carga_Masiva_Completa.xlsx');
    showNotification('Plantilla descargada', 'success');
}

function descargarPlantillaVehiculosSolo() {
    if (typeof XLSX === 'undefined') { showNotification('Error: Librería XLSX no está cargada', 'error'); return; }
    var wb  = XLSX.utils.book_new();
    var wsV = XLSX.utils.aoa_to_sheet([
        ['Tipo', 'Placa', 'Tipo Vehículo', 'Marca', 'Color', 'Año', 'Email Cliente'],
        ['Vehiculo', 'ABC123', 'CARRO', 'TOYOTA', 'Blanco', '2020', 'juan@gmail.com']
    ]);
    wsV['!cols'] = [{wch:10},{wch:10},{wch:15},{wch:12},{wch:10},{wch:8},{wch:28}];
    XLSX.utils.book_append_sheet(wb, wsV, 'Vehículos');
    XLSX.writeFile(wb, 'Plantilla_Solo_Vehiculos.xlsx');
    showNotification('Plantilla descargada', 'success');
}

function mostrarArchivoSeleccionado() {
    var fi   = document.getElementById('excelFile');
    var info = document.getElementById('archivoSeleccionado');
    if (fi && fi.files[0]) {
        var f = fi.files[0];
        info.innerHTML = '📎 <strong>' + f.name + '</strong> (' + (f.size / 1024).toFixed(2) + ' KB)';
        info.style.color = '#059669';
    } else if (info) {
        info.innerHTML = '';
    }
}

// ==================== DELEGACIÓN DE EVENTOS ====================
function setupGlobalEventDelegation() {
    document.body.addEventListener('click', function(e) {
        var salida   = e.target.closest('.sede-btn-salida');
        var cobrar   = e.target.closest('.sede-btn-cobrar');
        var aceptar  = e.target.closest('.sede-btn-aceptar');
        var rechazar = e.target.closest('.sede-btn-rechazar');
        if (salida)   { e.preventDefault(); abrirModalSalida(parseInt(salida.dataset.id));   return; }
        if (cobrar)   { e.preventDefault(); abrirModalCobro(parseInt(cobrar.dataset.id));    return; }
        if (aceptar)  { e.preventDefault(); aceptarReservacion(aceptar.dataset.id);          return; }
        if (rechazar) { e.preventDefault(); rechazarReservacion(rechazar.dataset.id);        return; }
    });
}

// ==================== GESTIÓN TRABAJADORES ====================
function openRegistrarTrabajadorModal() {
    var modal = document.getElementById('registrarTrabajadorModal');
    if (modal) {
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
    }
}

function closeRegistrarTrabajadorModal() {
    var modal = document.getElementById('registrarTrabajadorModal');
    if (modal) {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
        setTimeout(function() {
            ['trabajadorNombre', 'trabajadorCorreo', 'trabajadorTelefono',
                'trabajadorCedula', 'trabajadorContrasena'].forEach(function(id) {
                var el = document.getElementById(id);
                if (el) { el.value = ''; }
            });
        }, 300);
    }
}

async function registrarTrabajador() {
    var nombreEl     = document.getElementById('trabajadorNombre');
    var correoEl     = document.getElementById('trabajadorCorreo');
    var telefonoEl   = document.getElementById('trabajadorTelefono');
    var cedulaEl     = document.getElementById('trabajadorCedula');
    var contrasenaEl = document.getElementById('trabajadorContrasena');
    var datos = {
        nombre:     nombreEl     ? nombreEl.value.trim()     : '',
        correo:     correoEl     ? correoEl.value.trim()     : '',
        telefono:   telefonoEl   ? telefonoEl.value.trim()   : '',
        cedula:     cedulaEl     ? cedulaEl.value.trim()     : '',
        contrasena: contrasenaEl ? contrasenaEl.value        : ''
    };
    if (!datos.nombre || !datos.correo) {
        showNotification('Complete los campos obligatorios: Nombre y Correo', 'warning');
        return;
    }
    if (!datos.contrasena || datos.contrasena.length < 8) {
        showNotification('La contraseña debe tener al menos 8 caracteres', 'warning');
        return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo)) {
        showNotification('Ingrese un correo electrónico válido', 'warning');
        return;
    }
    try {
        var response = await fetch(API_BASE_URL + '/registrar-trabajador', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        if (response.ok) {
            var r = await response.json();
            showNotification(r.mensaje || 'Trabajador registrado exitosamente', 'success');
            closeRegistrarTrabajadorModal();
            cargarUsuarios();
        } else {
            var err = await response.json();
            showNotification(err.error || 'Error al registrar trabajador', 'error');
        }
    } catch (e) {
        showNotification('Error de conexión al registrar trabajador', 'error');
    }
}

// ==================== REPORTES ====================
async function generarPDF() {
    try {
        var response = await fetch(API_BASE_URL + '/reporte/usuarios/pdf');
        if (!response.ok) { throw new Error('Error al generar PDF'); }
        var blob = await response.blob();
        var url  = window.URL.createObjectURL(blob);
        var a    = document.createElement('a');
        a.href = url; a.download = 'reporte_clientes_' + Date.now() + '.pdf';
        document.body.appendChild(a); a.click();
        window.URL.revokeObjectURL(url); document.body.removeChild(a);
        showNotification('PDF generado exitosamente', 'success');
    } catch (e) {
        showNotification('Error al generar el reporte PDF', 'error');
    }
}

async function generarExcel() {
    try {
        var response = await fetch(API_BASE_URL + '/reporte/usuarios/excel');
        if (!response.ok) { throw new Error('Error al generar Excel'); }
        var blob = await response.blob();
        var url  = window.URL.createObjectURL(blob);
        var a    = document.createElement('a');
        a.href = url; a.download = 'reporte_clientes_' + Date.now() + '.xlsx';
        document.body.appendChild(a); a.click();
        window.URL.revokeObjectURL(url); document.body.removeChild(a);
        showNotification('Excel generado exitosamente', 'success');
    } catch (e) {
        showNotification('Error al generar el reporte Excel', 'error');
    }
}

// ==================== EDICIÓN Y ELIMINACIÓN ====================
async function editarUsuario(id) {
    var u = usuariosData.find(function(x) { return x.id === id; });
    if (!u) { showNotification('Usuario no encontrado', 'error'); return; }
    var resultado = await showEditModal('Editar Usuario', [
        { key: 'nombre',   label: 'Nombre',   value: u.nombre   || '' },
        { key: 'correo',   label: 'Correo',   value: u.correo   || '', type: 'email' },
        { key: 'telefono', label: 'Teléfono', value: u.telefono || '' },
        { key: 'estado',   label: 'Estado',   value: u.estado   || 'ACTIVO', type: 'select', options: ['ACTIVO', 'INACTIVO'] }
    ]);
    if (!resultado) { return; }
    try {
        var response = await fetch(API_BASE_URL + '/usuarios/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre: resultado.nombre.trim(), correo: resultado.correo.trim(),
                telefono: resultado.telefono.trim(), estado: resultado.estado
            })
        });
        if (response.ok) {
            showNotification('Usuario actualizado correctamente', 'success');
            await cargarUsuarios();
        } else {
            var err = await response.json();
            showNotification(err.error || 'Error al actualizar', 'error');
        }
    } catch (e) {
        showNotification('Error de conexión', 'error');
    }
}

async function eliminarUsuario(id) {
    var u      = usuariosData.find(function(x) { return x.id === id; });
    var nombre = u ? u.nombre : 'ID ' + id;
    var ok = await showConfirm(
        'Eliminar usuario',
        '¿Estás seguro de eliminar a <strong>' + nombre + '</strong>?<br>Esta acción no se puede deshacer.'
    );
    if (!ok) { return; }
    try {
        var response = await fetch(API_BASE_URL + '/usuarios/' + id, { method: 'DELETE' });
        if (response.ok) {
            showNotification('Usuario eliminado correctamente', 'success');
            cargarUsuarios();
        } else {
            throw new Error('Error al eliminar usuario');
        }
    } catch (e) {
        showNotification('Error al eliminar el usuario', 'error');
    }
}

async function editarSede(id) {
    var s = sedesData.find(function(x) { return x.id === id; });
    if (!s) { showNotification('Sede no encontrada', 'error'); return; }
    var resultado = await showEditModal('Editar Sede', [
        { key: 'nombre',    label: 'Nombre',    value: s.nombre    || '' },
        { key: 'direccion', label: 'Dirección', value: s.direccion || '' },
        { key: 'capacidad', label: 'Capacidad', value: s.capacidad || '', type: 'number' },
        { key: 'estado',    label: 'Estado',    value: s.estado    || 'ACTIVO', type: 'select', options: ['ACTIVO', 'INACTIVO'] }
    ]);
    if (!resultado) { return; }
    if (isNaN(parseInt(resultado.capacidad)) || parseInt(resultado.capacidad) <= 0) {
        showNotification('La capacidad debe ser un número mayor a 0', 'warning');
        return;
    }
    try {
        var response = await fetch(API_BASE_URL + '/sedes/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre: resultado.nombre.trim(), direccion: resultado.direccion.trim(),
                capacidad: parseInt(resultado.capacidad), estado: resultado.estado
            })
        });
        if (response.ok) {
            showNotification('Sede actualizada correctamente', 'success');
            await cargarSedes();
        } else {
            var err = await response.json();
            showNotification(err.error || 'Error al actualizar sede', 'error');
        }
    } catch (e) {
        showNotification('Error de conexión', 'error');
    }
}

// ==================== CORREOS ====================
async function enviarCorreoUno() {
    var emailEl   = document.getElementById('emailSingle');
    var subjectEl = document.getElementById('subjectSingle');
    var messageEl = document.getElementById('messageSingle');
    var email   = emailEl   ? emailEl.value.trim()   : '';
    var subject = subjectEl ? subjectEl.value.trim() : '';
    var message = messageEl ? messageEl.value.trim() : '';
    if (!email || !subject || !message) { showNotification('Por favor complete todos los campos', 'warning'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showNotification('Por favor ingrese un correo válido', 'warning'); return; }
    var btn = document.querySelector('#correoUno button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
    var formData = new URLSearchParams();
    formData.append('correo', email); formData.append('asunto', subject); formData.append('mensaje', message);
    try {
        var response = await fetch(API_BASE_URL + '/correo/unitario', {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString()
        });
        var data = await response.json();
        if (data.status === 'success') {
            showNotification(data.message, 'success');
            ['emailSingle', 'subjectSingle', 'messageSingle'].forEach(function(id) {
                var el = document.getElementById(id); if (el) { el.value = ''; }
            });
        } else { showNotification(data.message || 'Error al enviar correo', 'error'); }
    } catch (e) { showNotification('Error de conexión', 'error'); }
    finally { if (btn) { btn.disabled = false; btn.textContent = 'Enviar Correo'; } }
}

async function enviarCorreoMasivo() {
    var emailsEl  = document.getElementById('emailsMassive');
    var subjectEl = document.getElementById('subjectMassive');
    var messageEl = document.getElementById('messageMassive');
    var emailsRaw = emailsEl  ? emailsEl.value.trim()  : '';
    var subject   = subjectEl ? subjectEl.value.trim() : '';
    var message   = messageEl ? messageEl.value.trim() : '';
    if (!emailsRaw || !subject || !message) { showNotification('Por favor complete todos los campos', 'warning'); return; }
    var emailList = emailsRaw.split(',').map(function(e) { return e.trim(); }).filter(function(e) { return e; });
    var invalid   = emailList.filter(function(e) { return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); });
    if (invalid.length > 0) { showNotification('Correos inválidos: ' + invalid.join(', '), 'error'); return; }
    if (emailList.length === 0) { showNotification('Ingresa al menos un correo válido', 'warning'); return; }
    var btn = document.querySelector('#correoMasivo button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
    var formData = new URLSearchParams();
    emailList.forEach(function(e) { formData.append('seleccionados', e); });
    formData.append('asunto', subject); formData.append('mensaje', message);
    try {
        var response = await fetch(API_BASE_URL + '/correo/masivo', {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString()
        });
        var data = await response.json();
        if (data.status === 'success') {
            showNotification(data.message, 'success');
            ['emailsMassive', 'subjectMassive', 'messageMassive'].forEach(function(id) {
                var el = document.getElementById(id); if (el) { el.value = ''; }
            });
        } else { showNotification(data.message || 'Error al enviar correos', 'error'); }
    } catch (e) { showNotification('Error de conexión', 'error'); }
    finally { if (btn) { btn.disabled = false; btn.textContent = 'Enviar Masivamente'; } }
}

// ============================================
// MÓDULO FILTRO DESTINATARIOS — DASHBOARD SEDE
// Solo clientes y trabajadores de la sede propia.
// Otras sedes y admins del sistema NO aparecen.
// ============================================

let _sedeDestinatariosCache = [];

async function sedeCargarDestinatarios() {
    const rol      = document.getElementById('sedeFiltroRol')?.value;
    const estadoEl = document.getElementById('sedeEstadoFiltro');
    const listaEl  = document.getElementById('sedeListaDestinatarios');
    const tablaEl  = document.getElementById('sedeTablaDestinatarios');
    const contEl   = document.getElementById('sedeContadorLista');
    const btnEl    = document.getElementById('btnSedeCargar');

    if (!rol) {
        showNotification('Selecciona un grupo primero', 'warning');
        return;
    }

    // Estado visual de carga
    if (estadoEl) estadoEl.textContent = 'Consultando base de datos...';
    if (listaEl)  listaEl.style.display = 'none';
    if (btnEl)    { btnEl.disabled = true; btnEl.textContent = 'Cargando...'; }

    const endpoints = {
        clientes:     `${API_BASE_URL}/correos/clientes`,
        trabajadores: `${API_BASE_URL}/correos/trabajadores`
    };

    try {
        const response = await fetch(endpoints[rol]);
        if (!response.ok) throw new Error(`Error ${response.status}`);
        const datos = await response.json();
        _sedeDestinatariosCache = datos;

        if (datos.length === 0) {
            if (estadoEl) estadoEl.textContent =
                rol === 'trabajadores'
                    ? 'No hay trabajadores asignados a tu sede.'
                    : 'No se encontraron clientes registrados.';
            if (listaEl) listaEl.style.display = 'none';
            return;
        }

        // Renderizar filas con checkbox
        if (tablaEl) {
            tablaEl.innerHTML = datos.map(d => `
                <label style="display:flex; align-items:center; gap:0.75rem;
                               padding:0.6rem 0.75rem; cursor:pointer;
                               border-bottom:1px solid #f1f5f9;
                               transition:background 0.15s;"
                       onmouseover="this.style.background='#f0fdf9'"
                       onmouseout="this.style.background='transparent'">
                    <input type="checkbox"
                           class="sede-dest-check"
                           data-correo="${d.correo}"
                           style="width:16px;height:16px;cursor:pointer;accent-color:#0d9488;"
                           checked/>
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:600; font-size:0.875rem; color:#1e293b;
                                    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            ${d.nombre || '(sin nombre)'}
                        </div>
                        <div style="font-size:0.8rem; color:#64748b;
                                    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            ${d.correo}
                        </div>
                    </div>
                    <span style="font-size:0.72rem; background:#ccfbf1; color:#0f766e;
                                 border-radius:9999px; padding:0.15rem 0.5rem; white-space:nowrap;">
                        ${d.rol === 'OPERARIO' ? 'Operario' : 'Cliente'}
                    </span>
                </label>
            `).join('');
        }

        if (contEl)   contEl.textContent = `${datos.length} usuario(s) encontrado(s)`;
        if (estadoEl) estadoEl.textContent = '';
        if (listaEl)  listaEl.style.display = 'block';

    } catch (e) {
        console.error('sedeCargarDestinatarios:', e);
        if (estadoEl) estadoEl.textContent = 'Error al consultar. Intenta de nuevo.';
        showNotification('Error al consultar destinatarios', 'error');
    } finally {
        if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Consultar'; }
    }
}

function sedeSeleccionarTodos(estado) {
    document.querySelectorAll('.sede-dest-check')
        .forEach(cb => { cb.checked = estado; });
}

function sedeAgregarSeleccionados() {
    const seleccionados = [...document.querySelectorAll('.sede-dest-check:checked')]
        .map(cb => cb.dataset.correo)
        .filter(Boolean);

    if (seleccionados.length === 0) {
        showNotification('No hay destinatarios seleccionados', 'warning');
        return;
    }

    const textarea = document.getElementById('emailsMassive');
    if (!textarea) return;

    // Fusiona sin duplicar con lo que ya existe en el textarea
    const existentes = textarea.value
        .split(',')
        .map(e => e.trim())
        .filter(Boolean);

    const nuevos = seleccionados.filter(e => !existentes.includes(e));
    const todos  = [...existentes, ...nuevos].filter(Boolean);

    textarea.value = todos.join(', ');
    _sedeActualizarBadge();

    showNotification(`${nuevos.length} correo(s) agregado(s) al envío`, 'success');

    // Colapsa el panel de selección tras agregar
    const lista = document.getElementById('sedeListaDestinatarios');
    if (lista) lista.style.display = 'none';
    const estadoEl = document.getElementById('sedeEstadoFiltro');
    if (estadoEl) estadoEl.textContent =
        `✓ ${seleccionados.length} destinatario(s) cargados desde BD.`;
}

function _sedeActualizarBadge() {
    const textarea = document.getElementById('emailsMassive');
    const badge    = document.getElementById('sedeBadgeConteo');
    if (!textarea || !badge) return;

    const count = textarea.value
        .split(',')
        .map(e => e.trim())
        .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
        .length;

    badge.textContent   = count;
    badge.style.display = count > 0 ? 'inline' : 'none';
}

// Badge en tiempo real mientras escribe manualmente
document.addEventListener('DOMContentLoaded', () => {
    const textarea = document.getElementById('emailsMassive');
    if (textarea) textarea.addEventListener('input', _sedeActualizarBadge);
});



// ==================== UI HELPERS ====================
function setupSidebarToggle() {
    // no-op: el toggle vive en DashboardSede.html (inline script + onclick)
}

function setupProfileMenu() {
    var profileBtn = document.getElementById('profileBtn');
    var dropdown   = document.getElementById('profileDropdown');
    if (profileBtn && dropdown) {
        profileBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            dropdown.classList.toggle('show');
            profileBtn.setAttribute('aria-expanded', dropdown.classList.contains('show') ? 'true' : 'false');
        });
        document.addEventListener('click', function() {
            dropdown.classList.remove('show');
            profileBtn.setAttribute('aria-expanded', 'false');
        });
    }
}

function cerrarSesion() {
    if (updateInterval) { clearInterval(updateInterval); }
    Object.values(timerIntervals).forEach(function(id) { clearInterval(id); });
    window.location.href = '/logout';
}

function irConfiguracion() { window.location.href = '/configuracion/sede'; }

function irAyuda()         { showNotification('Sección de ayuda próximamente', 'info'); }

// ==================== ESCAPE Y CLIC FUERA ====================
// BUG #2 CORREGIDO: verifica classList.contains('open') en lugar de style.display
document.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape') { return; }
    var cobro  = document.getElementById('cobroModal');
    var salida = document.getElementById('salidaModal');
    if (cobro  && cobro.classList.contains('open'))  { cerrarModalCobro();  }
    if (salida && salida.classList.contains('open')) { cerrarModalSalida(); }
});

window.addEventListener('click', function(e) {
    var cobro  = document.getElementById('cobroModal');
    var salida = document.getElementById('salidaModal');
    var modal  = document.getElementById('registrarTrabajadorModal');
    // Clic en el overlay (fuera de la caja) cierra el modal
    if (cobro  && e.target === cobro)  { cerrarModalCobro();  }
    if (salida && e.target === salida) { cerrarModalSalida(); }
    if (modal  && e.target === modal)  { closeRegistrarTrabajadorModal(); }
});

window.addEventListener('beforeunload', function() {
    if (updateInterval) { clearInterval(updateInterval); }
    Object.values(timerIntervals).forEach(function(id) { clearInterval(id); });
});

// ==================== ESTILOS ADICIONALES ====================
function injectAdditionalStyles() {
    if (document.getElementById('sede-additional-styles')) { return; }
    var style = document.createElement('style');
    style.id = 'sede-additional-styles';
    style.textContent =
        '.sede-btn-icon{background:transparent;border:none;cursor:pointer;padding:0.4rem;border-radius:0.375rem;transition:all 0.2s;display:inline-flex;align-items:center;justify-content:center;}' +
        '.sede-btn-edit:hover{background-color:#ccfbf1;}' +
        '.sede-btn-delete:hover{background-color:#fee2e2;}' +
        '.sede-btn-warning{background-color:#f59e0b;color:white;padding:0.4rem 1rem;border-radius:0.375rem;border:none;cursor:pointer;transition:all 0.2s;font-weight:600;display:inline-flex;align-items:center;gap:0.4rem;font-size:0.85rem;}' +
        '.sede-btn-warning:hover{background-color:#d97706;transform:translateY(-1px);}' +
        '@keyframes aparca-slideUp{from{transform:translateX(400px);opacity:0;}to{transform:translateX(0);opacity:1;}}' +
        '.hidden{display:none!important;}';
    document.head.appendChild(style);
}

// Fallback global para toggleSidebar
if (typeof window.toggleSidebar === 'undefined') {
    window.toggleSidebar = function() {
        var collapsed = document.body.classList.toggle('sidebar-collapsed');
        var btn = document.getElementById('sidebarToggleBtn');
        if (btn) { btn.setAttribute('aria-label', collapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'); }
        try { localStorage.setItem('sede-sidebar-collapsed', collapsed ? '1' : '0'); } catch (e) {}
    };
}

// Exponer como globales para los onclick del HTML
window.sedeCargarDestinatarios  = sedeCargarDestinatarios;
window.sedeSeleccionarTodos     = sedeSeleccionarTodos;
window.sedeAgregarSeleccionados = sedeAgregarSeleccionados;

console.log('SedeD.js v2 — cargado correctamente');