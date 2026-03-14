// ==================== CONFIGURACIÓN GLOBAL ====================
// Autenticación por sesión de Spring Security.
// El navegador envía la cookie automáticamente en cada fetch.
var API_BASE_URL = '/api/trabajador';
var REGISTRO_URL = '/api/trabajador/registrar-entrada';

var currentSalidaRegistroId = null;
var currentCobroRegistroId  = null;
var opcionesTarifa          = null;
var updateInterval          = null;
var timerIntervals          = {};

var marcasPorTipo = {
    CARRO: [
        'RENAULT','KIA','TOYOTA','CHEVROLET','MAZDA','NISSAN','VOLKSWAGEN','FORD','HYUNDAI',
        'BMW','MERCEDES_BENZ','AUDI','PEUGEOT','CITROEN','FIAT','VOLVO','JEEP','LAND_ROVER',
        'PORSCHE','FERRARI','LAMBORGHINI','TESLA','BYD','CHANGAN','GEELY','JAC','CHERY',
        'GREAT_WALL','HAVAL','GWM','MITSUBISHI','SUBARU','ISUZU','SSANGYONG','MG','RAM',
        'DFSK','FOTON','OTRO'
    ],
    MOTO: [
        'HONDA','YAMAHA','SUZUKI','KAWASAKI','BAJAJ','TVS','HERO','KTM','DUCATI',
        'HARLEY_DAVIDSON','BMW_MOTORRAD','TRIUMPH','ROYAL_ENFIELD','AUTECO','AKT',
        'VICTORY','APRILIA','BENELLI','HUSQVARNA','OTRO'
    ],
    BICICLETA: [
        'TREK','SPECIALIZED','GIANT','SCOTT','CANNONDALE','ORBEA','GW','SHIMANO',
        'BIANCHI','MERIDA','CUBE','BMC','FOCUS','OTRO'
    ],
    OTRO: ['OTRO']
};


// ==================== MODAL DE CONFIRMACIÓN ====================
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
        var btnColors = {
            danger:  'background:#dc2626;color:#fff',
            warning: 'background:#f59e0b;color:#fff'
        };
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
    return Number(number).toLocaleString('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}

function showNotification(message, type) {
    if (type === undefined) { type = 'info'; }
    document.querySelectorAll('.toast-notification').forEach(function(t) { t.remove(); });
    var toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.style.cssText = 'position:fixed;top:80px;right:20px;padding:1rem 1.5rem;border-radius:0.5rem;color:white;font-weight:600;z-index:9999;animation:trabSlideIn 0.3s ease-out;max-width:400px;box-shadow:0 4px 12px rgba(0,0,0,0.15);';
    var colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
    toast.style.backgroundColor = colors[type] || colors.info;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function() {
        toast.style.opacity    = '0';
        toast.style.transition = 'opacity 0.3s ease-in';
        setTimeout(function() { toast.remove(); }, 300);
    }, 5000);
}

function formatMarcaName(marca) {
    var map = {
        'MERCEDES_BENZ':   'Mercedes-Benz',
        'LAND_ROVER':      'Land Rover',
        'GREAT_WALL':      'Great Wall',
        'BMW_MOTORRAD':    'BMW Motorrad',
        'HARLEY_DAVIDSON': 'Harley-Davidson',
        'ROYAL_ENFIELD':   'Royal Enfield'
    };
    return map[marca] || marca.split('_').map(function(w) {
        return w.charAt(0) + w.slice(1).toLowerCase();
    }).join(' ');
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

function limpiarFormularioEntrada() {
    ['nombre','telefono','correo','cedula','placa','color','anio','buscarPlaca']
        .forEach(function(id) { setInputValue(id, ''); });
    var ts = document.getElementById('tipoVehiculo');
    if (ts) { ts.value = ''; }
    var ms = document.getElementById('marca');
    if (ms) { ms.innerHTML = '<option value="">Selecciona una marca</option>'; }
    ['nombre','correo','telefono','cedula','placa','tipoVehiculo','marca'].forEach(function(fId) {
        var err = document.getElementById(fId + '-error');
        if (err) { err.textContent = ''; }
        var suc = document.getElementById(fId + '-success');
        if (suc) { suc.textContent = ''; }
        var f = document.getElementById(fId);
        if (f) { f.classList.remove('border-red-500', 'border-green-500'); }
    });
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
            if (!value)            { isValid = false; message = 'El nombre es obligatorio.'; }
            else if (value.length < 2) { isValid = false; message = 'Al menos 2 caracteres.'; }
            break;
        case 'correo':
            if (!value)                                     { isValid = false; message = 'El correo es obligatorio.'; }
            else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { isValid = false; message = 'Formato inválido.'; }
            break;
        case 'telefono':
            if (!value)                        { isValid = false; message = 'El teléfono es obligatorio.'; }
            else if (!/^[0-9]{10}$/.test(value)) { isValid = false; message = 'Debe tener 10 dígitos.'; }
            break;
        case 'cedula':
            if (!value)                        { isValid = false; message = 'La cédula es obligatoria.'; }
            else if (!/^[0-9]{10}$/.test(value)) { isValid = false; message = 'Debe tener 10 dígitos.'; }
            break;
        case 'placa':
            if (!value)                              { isValid = false; message = 'La placa es obligatoria.'; }
            else if (!/^[A-Z]{3}[0-9]{3}$/.test(value)) { isValid = false; message = 'Formato: ABC123'; }
            break;
        case 'tipoVehiculo':
            if (!value) { isValid = false; message = 'Selecciona el tipo.'; }
            break;
        case 'marca':
            if (!value) { isValid = false; message = 'Selecciona la marca.'; }
            break;
        default:
            break;
    }
    if (errorSpan) { errorSpan.textContent = isValid ? '' : message; }
    field.classList.toggle('border-red-500',   !isValid);
    field.classList.toggle('border-green-500', isValid && value !== '');
    return isValid;
}

function validateFormularioEntrada() {
    return ['nombre','correo','telefono','cedula','placa','tipoVehiculo','marca']
        .map(function(c) { return validateFieldEntrada(c); })
        .every(function(v) { return v; });
}


// ==================== NAVEGACIÓN ====================
// FIX: sections.forEach oculta todas las secciones antes de mostrar
// la activa — sin esto varias quedaban visibles simultáneamente.
function initializeTabs() {
    var navLinks = document.querySelectorAll('.aparca-sidebar-nav a');
    var sections = document.querySelectorAll('.aparca-content-section');

    navLinks.forEach(function(link) {
        link.addEventListener('click', function(e) {
            e.preventDefault();

            navLinks.forEach(function(l) { l.classList.remove('active'); });
            sections.forEach(function(s) { s.classList.add('hidden'); });

            link.classList.add('active');
            var tabId   = link.getAttribute('data-tab');
            var section = document.getElementById(tabId);
            if (section) {
                section.classList.remove('hidden');
                if (tabId === 'inicio')        { loadIndicadores(); }
                if (tabId === 'gestion')       { loadVehiculosActivos(); loadPendientesCobro(); }
                if (tabId === 'reservaciones') { loadReservaciones(); }
            }

            // En mobile cierra el sidebar al navegar
            if (window.innerWidth < 768) {
                var sidebar = document.querySelector('.aparca-sidebar');
                if (sidebar) { sidebar.style.transform = 'translateX(-100%)'; }
            }
        });
    });
}

function initializeProfileMenu() {
    var btn      = document.getElementById('profileBtn');
    var dropdown = document.getElementById('profileDropdown');
    if (btn && dropdown) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            dropdown.classList.toggle('show');
            btn.setAttribute('aria-expanded',
                dropdown.classList.contains('show') ? 'true' : 'false');
        });
        document.addEventListener('click', function() {
            dropdown.classList.remove('show');
            btn.setAttribute('aria-expanded', 'false');
        });
    }
}

// POST /logout invalida el SecurityContext de Spring
async function handleLogout() {
    var ok = await showConfirm(
        'Cerrar sesión',
        '¿Estás seguro de que deseas cerrar sesión?',
        'Cerrar sesión',
        'danger'
    );
    if (!ok) { return; }
    if (updateInterval) { clearInterval(updateInterval); }
    Object.values(timerIntervals).forEach(function(id) { clearInterval(id); });
    try {
        var csrfMeta   = document.querySelector('meta[name="_csrf"]');
        var csrfHMeta  = document.querySelector('meta[name="_csrf_header"]');
        var csrfToken  = csrfMeta  ? csrfMeta.getAttribute('content')  : null;
        var csrfHeader = csrfHMeta ? csrfHMeta.getAttribute('content') : null;
        var headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
        if (csrfToken && csrfHeader) { headers[csrfHeader] = csrfToken; }
        await fetch('/logout', { method: 'POST', headers: headers, credentials: 'same-origin' });
    } catch (e) { /* Si falla el fetch, redirigimos igual */ }
    window.location.href = '/login';
}

function initializeMarcas() {
    var ts = document.getElementById('tipoVehiculo');
    if (ts) {
        ts.addEventListener('change', actualizarMarcasEntrada);
        actualizarMarcasEntrada();
    }
}


// ==================== INDICADORES ====================
async function loadIndicadores() {
    try {
        var response = await fetch(API_BASE_URL + '/indicadores', {
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) { throw new Error('Error'); }
        var data = await response.json();

        // FIX: ingresosDia incluye signo $ — la card no lo pone en el HTML
        var elementos = {
            'sedeNombre':          data.sedeNombre        || 'Parqueadero',
            'ocupacionActual':     data.ocupacionActual   + '/' + data.capacidadTotal,
            'porcentajeOcupacion': data.porcentajeOcupacion + '%',
            'cuposLibres':         data.cuposLibres,
            'vehiculosHoy':        data.vehiculosHoy,
            'ingresosDia':         '$' + formatNumber(data.ingresosDia),
            'pendientesCobro':     data.pendientesCobro
        };
        Object.keys(elementos).forEach(function(id) {
            var el = document.getElementById(id);
            if (el) { el.textContent = elementos[id]; }
        });

        var tarifaDisplay = document.getElementById('tarifaDisplay');
        if (tarifaDisplay && data.tarifaPlenaC != null) {
            tarifaDisplay.innerHTML =
                'Carro plena: $'  + formatNumber(data.tarifaPlenaC)  + '<br>' +
                'Carro/min: $'    + formatNumber(data.tarifaMinutoC) + '<br>' +
                'Moto plena: $'   + formatNumber(data.tarifaPlenaM)  + '<br>' +
                'Moto/min: $'     + formatNumber(data.tarifaMinutoM);
        }

        // Color del card de ocupación según porcentaje
        var card = document.getElementById('cardOcupacion');
        if (card) {
            card.classList.remove('ocupacion-alta', 'ocupacion-media', 'ocupacion-libre');
            if      (data.porcentajeOcupacion >= 90) { card.classList.add('ocupacion-alta');  }
            else if (data.porcentajeOcupacion >= 70) { card.classList.add('ocupacion-media'); }
            else                                     { card.classList.add('ocupacion-libre'); }
        }
    } catch (error) {
        console.error('Error indicadores:', error);
    }
}


// ==================== FORMULARIO ENTRADA ====================
function initializeFormularioEntrada() {
    var form = document.getElementById('registroEntradaForm');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            await registrarEntradaDirecto();
        });

        ['nombre','telefono','correo','cedula','placa','tipoVehiculo','marca'].forEach(function(campoId) {
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
        var tv = document.getElementById('tipoVehiculo');
        if (tv) {
            tv.addEventListener('change', function() {
                actualizarMarcasEntrada();
                validateFieldEntrada('tipoVehiculo');
            });
        }
        var mk = document.getElementById('marca');
        if (mk) {
            mk.addEventListener('change', function() { validateFieldEntrada('marca'); });
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
            clienteEmail:    getInputValue('correo'),
            clienteCedula:   getInputValue('cedula'),
            vehiculoPlaca:   getInputValue('placa'),
            vehiculoTipo:    getInputValue('tipoVehiculo'),
            vehiculoMarca:   getInputValue('marca'),
            vehiculoColor:   getInputValue('color') || 'NO ESPECIFICADO',
            vehiculoAnio:    getInputValue('anio')  || '2020'
        };
        var response = await fetch(REGISTRO_URL, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(datos)
        });
        if (!response.ok) {
            var err = await response.json();
            throw new Error(err.error || 'Error al registrar entrada');
        }
        showNotification('Entrada registrada. Timer iniciado', 'success');
        limpiarFormularioEntrada();
        setTimeout(function() { loadVehiculosActivos(); loadIndicadores(); }, 500);
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
            setInputValue('correo',   data.cliente.email);
            setInputValue('cedula',   data.cliente.cedula || '');
            setInputValue('placa',    data.vehiculo.placa);
            setInputValue('color',    data.vehiculo.color);
            var ts = document.getElementById('tipoVehiculo');
            if (ts) {
                ts.value = data.vehiculo.tipo;
                actualizarMarcasEntrada();
                setTimeout(function() {
                    var ms = document.getElementById('marca');
                    if (ms) { ms.value = data.vehiculo.marca; }
                }, 100);
            }
            if (data.vehiculo.anio) { setInputValue('anio', data.vehiculo.anio); }
            showNotification('Vehículo encontrado', 'success');
        } else {
            limpiarFormularioEntrada();
            setInputValue('placa', placa);
            showNotification('Vehículo nuevo. Complete los datos.', 'info');
        }
    } catch (error) {
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

        // Limpiar timers anteriores antes de actualizar
        Object.values(timerIntervals).forEach(function(id) { clearInterval(id); });
        timerIntervals = {};

        if (vehiculos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:1.5rem;color:#64748b;">No hay vehículos en el parqueadero</td></tr>';
            return;
        }

        tbody.innerHTML = vehiculos.map(function(v) {
            return '<tr>' +
                '<td><strong>' + v.placa + '</strong></td>' +
                '<td>' + v.tipoVehiculo + '</td>' +
                '<td>' + v.clienteNombre + '</td>' +
                '<td>' + v.clienteTelefono + '</td>' +
                '<td>' + formatDateTime(v.horaEntrada) + '</td>' +
                '<td><span class="tiempo-activo" id="timer-' + v.registroId + '">' + v.tiempoTranscurrido + '</span></td>' +
                '<td>' +
                    '<div style="font-size:0.82rem;line-height:1.6;">' +
                        '<div><strong>Plena:</strong> $' + formatNumber(v.cobroEstimadoPlena) + '</div>' +
                        '<div style="color:#059669;"><strong>Minuto:</strong> $' + formatNumber(v.cobroEstimadoMinuto) + '</div>' +
                    '</div>' +
                '</td>' +
                '<td>' +
                    '<button class="sede-btn-success btn-salida" data-id="' + v.registroId + '" style="font-size:0.8rem;padding:0.35rem 0.75rem;">Salida</button>' +
                '</td>' +
            '</tr>';
        }).join('');

        // Iniciar temporizadores en tiempo real
        vehiculos.forEach(function(v) {
            var el = document.getElementById('timer-' + v.registroId);
            if (!el) { return; }
            var secs = v.segundosTranscurridos || 0;
            timerIntervals[v.registroId] = setInterval(function() {
                secs++;
                var h = Math.floor(secs / 3600);
                var m = Math.floor((secs % 3600) / 60);
                var s = secs % 60;
                if (h > 0)       { el.textContent = h + 'h ' + m + 'm ' + s + 's'; }
                else if (m > 0)  { el.textContent = m + 'm ' + s + 's'; }
                else             { el.textContent = s + 's'; }
            }, 1000);
        });
    } catch (error) {
        showNotification('Error al cargar vehículos activos', 'error');
    }
}


// ==================== MODAL SALIDA ====================
async function abrirModalSalida(registroId) {
    var modal = document.getElementById('salidaModal');
    if (!modal) { showNotification('Error: Modal no encontrado', 'error'); return; }
    try {
        currentSalidaRegistroId = registroId;
        var response = await fetch(API_BASE_URL + '/vehiculos-activos', {
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) { throw new Error('Error al obtener datos'); }
        var vehiculos = await response.json();
        var v = vehiculos.find(function(x) { return x.registroId === registroId; });
        if (!v) {
            showNotification('Este vehículo ya no está activo. Actualizando lista...', 'warning');
            await loadVehiculosActivos();
            return;
        }

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
                '<div class="sede-modal-salida-row" style="color:#059669;"><strong>Minuto:</strong><span>$' + formatNumber(v.cobroEstimadoMinuto) + '</span></div>';
        }

        modal.style.display    = 'flex';
        modal.style.visibility = 'visible';
        modal.style.opacity    = '1';
        modal.setAttribute('aria-hidden', 'false');
    } catch (error) {
        showNotification('Error al abrir modal', 'error');
    }
}

function cerrarModalSalida() {
    var modal = document.getElementById('salidaModal');
    if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
    }
    currentSalidaRegistroId = null;
}

async function confirmarSalida() {
    if (!currentSalidaRegistroId) { return; }
    try {
        showNotification('Registrando salida...', 'info');
        var response = await fetch(API_BASE_URL + '/registrar-salida/' + currentSalidaRegistroId, {
            method:  'POST',
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
        await loadIndicadores();
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
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:1.5rem;color:#64748b;">No hay pendientes</td></tr>';
            return;
        }
        tbody.innerHTML = pendientes.map(function(p) {
            return '<tr>' +
                '<td><strong>' + p.placa + '</strong></td>' +
                '<td>' + p.clienteNombre + '</td>' +
                '<td>' + formatDateTime(p.horaEntrada) + '</td>' +
                '<td>' + formatDateTime(p.horaSalida) + '</td>' +
                '<td>' + p.tiempoTotal + '</td>' +
                '<td style="font-weight:700;color:#059669;">$' + formatNumber(p.precio) + '</td>' +
                '<td>' +
                    '<button class="sede-btn-primary btn-cobrar" data-id="' + p.registroId + '" style="font-size:0.8rem;padding:0.35rem 0.75rem;">Cobrar</button>' +
                '</td>' +
            '</tr>';
        }).join('');
    } catch (error) {
        console.error('Error pendientes cobro:', error);
    }
}


// ==================== MODAL COBRO ====================
async function abrirModalCobro(registroId) {
    currentCobroRegistroId = registroId;
    var modal = document.getElementById('cobroModal');
    if (!modal) { return; }
    modal.style.display    = 'flex';
    modal.style.visibility = 'visible';
    modal.style.opacity    = '1';
    modal.setAttribute('aria-hidden', 'false');
    try {
        var response = await fetch(API_BASE_URL + '/opciones-cobro/' + registroId, {
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            var errD = await response.json();
            throw new Error(errD.error || 'Error');
        }
        var data = await response.json();
        opcionesTarifa = data;

        var elCliente   = document.getElementById('cobroCliente');
        var elPlaca     = document.getElementById('cobroPlaca');
        var elTiempo    = document.getElementById('cobroTiempo');
        var elPrecio    = document.getElementById('cobroPrecio');
        var container   = document.getElementById('tarifaSelectorContainer');

        if (elCliente) { elCliente.textContent = data.clienteNombre; }
        if (elPlaca)   { elPlaca.textContent   = data.placa; }
        if (elTiempo)  { elTiempo.textContent  = data.tiempoTotal; }

        if (container) {
            container.innerHTML = '<div class="sede-modal-cobro-selector">' +
                '<p style="font-size:0.85rem;font-weight:600;color:#0f766e;margin:0 0 0.75rem;">Seleccione tarifa:</p>' +
                data.opciones.map(function(op, i) {
                    return '<label class="sede-modal-cobro-opcion">' +
                        '<input type="radio" name="tipoTarifa" value="' + op.tipo + '"' +
                        (i === 0 ? ' checked' : '') +
                        ' onchange="actualizarPrecioCobro(\'' + op.tipo + '\',' + op.precio + ')">' +
                        '<div>' +
                            '<strong>' + op.nombre + '</strong>' +
                            '<div style="font-size:0.8rem;color:#64748b;">' + (op.descripcion || '') + '</div>' +
                        '</div>' +
                        '<span style="color:#059669;font-weight:700;white-space:nowrap;">$' + formatNumber(op.precio) + ' COP</span>' +
                    '</label>';
                }).join('') +
            '</div>';
        }

        if (elPrecio && data.opciones[0]) {
            elPrecio.textContent = formatNumber(data.opciones[0].precio);
        }
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function actualizarPrecioCobro(tipo, precio) {
    var el = document.getElementById('cobroPrecio');
    if (el) { el.textContent = formatNumber(precio); }
}

function cerrarModalCobro() {
    var modal = document.getElementById('cobroModal');
    if (modal) {
        modal.style.display    = 'none';
        modal.style.visibility = 'hidden';
        modal.style.opacity    = '0';
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
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ metodoPago: metodoPago, tipoTarifa: tipoTarifa.value })
        });
        if (!response.ok) {
            var err = await response.json();
            throw new Error(err.error || 'Error');
        }
        var data = await response.json();
        showNotification('Cobro: $' + formatNumber(data.precio) + ' - ' + data.tipoTarifaAplicada, 'success');
        cerrarModalCobro();
        await loadPendientesCobro();
        await loadIndicadores();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}


// ==================== HISTORIAL ====================
async function loadHistorial() {
    try {
        var fechaEl  = document.getElementById('filtroFecha');
        var estadoEl = document.getElementById('filtroEstado');
        var fecha    = fechaEl  ? fechaEl.value  : '';
        var estado   = estadoEl ? estadoEl.value : '';
        var url      = API_BASE_URL + '/historial';
        var params   = new URLSearchParams();
        if (fecha)  { params.append('fecha',  fecha);  }
        if (estado) { params.append('estado', estado); }
        if (params.toString()) { url += '?' + params.toString(); }

        var response = await fetch(url, {
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) { throw new Error('Error'); }
        var registros = await response.json();
        var tbody = document.getElementById('historialBody');
        if (!tbody) { return; }
        if (registros.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:1.5rem;color:#64748b;">Sin registros</td></tr>';
            return;
        }
        tbody.innerHTML = registros.map(function(r) {
            var badge;
            if      (r.estado === 'ACTIVO')     { badge = '<span class="trab-badge trab-badge-info">Activo</span>'; }
            else if (r.estado === 'FINALIZADO') { badge = '<span class="trab-badge trab-badge-warning">Pendiente</span>'; }
            else if (r.estado === 'COBRADO')    { badge = '<span class="trab-badge trab-badge-success">Cobrado</span>'; }
            else                                { badge = '<span class="trab-badge trab-badge-danger">Cancelado</span>'; }
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
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:1.5rem;color:#64748b;">Sin reservaciones pendientes</td></tr>';
            return;
        }
        tbody.innerHTML = reservas.map(function(r) {
            return '<tr>' +
                '<td>' + r.clienteNombre + '</td>' +
                '<td>' + r.clienteTelefono + '</td>' +
                '<td><strong>' + r.placa + '</strong></td>' +
                '<td>' + r.tipoVehiculo + '</td>' +
                '<td>' + formatDateTime(r.horaInicio) + '</td>' +
                '<td>' + formatDateTime(r.horaFin) + '</td>' +
                '<td><span class="trab-badge trab-badge-info">' + r.cupo + '</span></td>' +
                '<td>' +
                    '<button class="sede-btn-success btn-aceptar"  data-id="' + r.id + '" style="font-size:0.8rem;padding:0.35rem 0.75rem;margin-right:0.25rem;">Aceptar</button>' +
                    '<button class="sede-btn-danger  btn-rechazar" data-id="' + r.id + '" style="font-size:0.8rem;padding:0.35rem 0.75rem;">Rechazar</button>' +
                '</td>' +
            '</tr>';
        }).join('');
    } catch (error) {
        console.error('Error reservaciones:', error);
    }
}

async function aceptarReservacion(id) {
    var ok = await showConfirm(
        'Aceptar reservación',
        '¿Confirmas que deseas aceptar esta reservación?',
        'Aceptar',
        'warning'
    );
    if (!ok) { return; }
    try {
        var response = await fetch(API_BASE_URL + '/aceptar-reservacion/' + id, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            var err = await response.json();
            throw new Error(err.error || 'Error al aceptar la reservación');
        }
        showNotification('Reservación aceptada', 'success');
        await loadReservaciones();
        await loadVehiculosActivos();
        await loadIndicadores();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function rechazarReservacion(id) {
    var ok = await showConfirm(
        'Rechazar reservación',
        '¿Confirmas que deseas rechazar esta reservación?',
        'Rechazar',
        'danger'
    );
    if (!ok) { return; }
    try {
        var response = await fetch(API_BASE_URL + '/rechazar-reservacion/' + id, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) { throw new Error('Error'); }
        showNotification('Reservación rechazada', 'success');
        await loadReservaciones();
    } catch (error) {
        showNotification('Error', 'error');
    }
}


// ==================== PLANTILLAS EXCEL ====================
function descargarPlantillaCompleta() {
    if (typeof XLSX === 'undefined') {
        showNotification('Error: Librería XLSX no cargada.', 'error');
        return;
    }
    var wb     = XLSX.utils.book_new();
    var wsDatos = XLSX.utils.aoa_to_sheet([
        ['Tipo','Dato1','Dato2','Dato3','Dato4','Dato5','Dato6'],
        ['Cliente','Juan Pérez Ejemplo','3001234589','juan.perez@gmail.com','1234567899','',''],
        ['Cliente','María González Ejemplo','3007654321','maria.gonzalez@gmail.com','0987654322','',''],
        ['Vehiculo','ABC123','CARRO','TOYOTA','Blanco','2020','juan.perez@gmail.com'],
        ['Vehiculo','XYZ789','MOTO','HONDA','Negro','2021','maria.gonzalez@gmail.com']
    ]);
    var sHdr = { font:{bold:true,color:{rgb:'FFFFFF'},sz:11}, fill:{fgColor:{rgb:'1E3A5F'}}, alignment:{horizontal:'center',vertical:'center',wrapText:true} };
    var sCli = { font:{color:{rgb:'065F46'},sz:10},           fill:{fgColor:{rgb:'D1FAE5'}}, alignment:{horizontal:'left',vertical:'center'} };
    var sVeh = { font:{color:{rgb:'1E3A8A'},sz:10},           fill:{fgColor:{rgb:'DBEAFE'}}, alignment:{horizontal:'left',vertical:'center'} };
    ['A1','B1','C1','D1','E1','F1','G1'].forEach(function(r) { if (wsDatos[r]) { wsDatos[r].s = sHdr; } });
    ['A2','B2','C2','D2','E2','F2','G2','A3','B3','C3','D3','E3','F3','G3'].forEach(function(r) { if (wsDatos[r]) { wsDatos[r].s = sCli; } });
    ['A4','B4','C4','D4','E4','F4','G4','A5','B5','C5','D5','E5','F5','G5'].forEach(function(r) { if (wsDatos[r]) { wsDatos[r].s = sVeh; } });
    wsDatos['!cols'] = [{wch:10},{wch:25},{wch:15},{wch:30},{wch:15},{wch:10},{wch:30}];
    wsDatos['!rows'] = [{ hpt: 22 }];
    XLSX.utils.book_append_sheet(wb, wsDatos, 'Datos');

    var wsInst = XLSX.utils.aoa_to_sheet([
        ['INSTRUCCIONES PARA LA CARGA MASIVA'], [''],
        ['Todo debe estar en UNA SOLA HOJA llamada "Datos"'], [''],
        ['CLIENTES:  Tipo | Nombre | Teléfono | Email | Cédula'],
        ['VEHÍCULOS: Tipo | Placa | TipoVeh | Marca | Color | Año | EmailCliente'], [''],
        ['TIPOS VÁLIDOS: CARRO, MOTO, BICICLETA, OTRO'],
        ['ORDEN: primero los Clientes, luego los Vehículos']
    ]);
    wsInst['!cols'] = [{wch:80}];
    XLSX.utils.book_append_sheet(wb, wsInst, 'Instrucciones');
    XLSX.writeFile(wb, 'Plantilla_Carga_Masiva_Completa.xlsx');
    showNotification('Plantilla completa descargada', 'success');
}

function descargarPlantillaVehiculosSolo() {
    if (typeof XLSX === 'undefined') {
        showNotification('Error: Librería XLSX no cargada.', 'error');
        return;
    }
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet([
        ['Tipo','Placa','Tipo Vehículo','Marca','Color','Año','Email Cliente'],
        ['Vehiculo','ABC123','CARRO','TOYOTA','Blanco','2020','cliente1@gmail.com'],
        ['Vehiculo','XYZ789','MOTO','HONDA','Negro','2021','cliente2@gmail.com']
    ]);
    var sHdr2 = { font:{bold:true,color:{rgb:'FFFFFF'},sz:11}, fill:{fgColor:{rgb:'1E3A5F'}}, alignment:{horizontal:'center',vertical:'center'} };
    var sDat2 = { font:{color:{rgb:'1E3A8A'},sz:10},           fill:{fgColor:{rgb:'DBEAFE'}}, alignment:{horizontal:'left',vertical:'center'} };
    ['A1','B1','C1','D1','E1','F1','G1'].forEach(function(r) { if (ws[r]) { ws[r].s = sHdr2; } });
    ['A2','B2','C2','D2','E2','F2','G2','A3','B3','C3','D3','E3','F3','G3'].forEach(function(r) { if (ws[r]) { ws[r].s = sDat2; } });
    ws['!cols'] = [{wch:10},{wch:10},{wch:15},{wch:12},{wch:10},{wch:8},{wch:28}];
    ws['!rows'] = [{ hpt: 22 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    XLSX.writeFile(wb, 'Plantilla_Vehiculos.xlsx');
    showNotification('Plantilla de vehículos descargada', 'success');
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


// ==================== CARGA MASIVA ====================
async function cargarExcel() {
    var fileInput = document.getElementById('excelFile');
    var file      = fileInput ? fileInput.files[0] : null;
    if (!file) {
        showNotification('Por favor seleccione un archivo Excel', 'warning');
        return;
    }
    var ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
        showNotification('El archivo debe ser formato Excel (.xlsx o .xls)', 'warning');
        return;
    }
    var pc = document.getElementById('progressContainer');
    var pb = document.getElementById('progressBar');
    var pt = document.getElementById('progressText');
    try {
        if (pc) { pc.style.display = 'block'; }
        if (pb) { pb.style.width = '30%'; pb.textContent = '30%'; }
        if (pt) { pt.textContent = 'Subiendo archivo...'; }

        var formData = new FormData();
        formData.append('file', file);
        var response = await fetch(API_BASE_URL + '/carga-masiva', {
            method: 'POST',
            body:   formData
        });

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
                ? 'Carga con ' + data.errores.length + ' error(es). Total: ' + (data.totalRegistros || 0)
                : 'Carga exitosa: ' + (data.totalRegistros || 0) + ' registros',
            data.tieneErrores ? 'warning' : 'success'
        );
        fileInput.value = '';
        var ai = document.getElementById('archivoSeleccionado');
        if (ai) { ai.innerHTML = ''; }
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
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;">' +
                '<div style="background:linear-gradient(135deg,#d1fae5,#a7f3d0);padding:1.5rem;border-radius:0.75rem;text-align:center;">' +
                    '<div style="font-size:2rem;font-weight:700;color:#065f46;">' + (data.clientesRegistrados || 0) + '</div>' +
                    '<div style="font-size:0.88rem;color:#047857;font-weight:600;">Clientes Registrados</div>' +
                '</div>' +
                '<div style="background:linear-gradient(135deg,#dbeafe,#bfdbfe);padding:1.5rem;border-radius:0.75rem;text-align:center;">' +
                    '<div style="font-size:2rem;font-weight:700;color:#1e40af;">' + (data.vehiculosRegistrados || 0) + '</div>' +
                    '<div style="font-size:0.88rem;color:#1e3a8a;font-weight:600;">Vehículos Registrados</div>' +
                '</div>' +
                '<div style="background:linear-gradient(135deg,#e0e7ff,#c7d2fe);padding:1.5rem;border-radius:0.75rem;text-align:center;">' +
                    '<div style="font-size:2rem;font-weight:700;color:#4338ca;">' + (data.totalRegistros || 0) + '</div>' +
                    '<div style="font-size:0.88rem;color:#3730a3;font-weight:600;">Total Registros</div>' +
                '</div>' +
            '</div>';
    }

    var ec = document.getElementById('erroresContainer');
    var le = document.getElementById('listaErrores');
    if (data.errores && data.errores.length > 0) {
        if (ec) { ec.style.display = 'block'; }
        if (le) {
            le.innerHTML = data.errores.map(function(e) {
                return '<li>' + e + '</li>';
            }).join('');
        }
    } else {
        if (ec) { ec.style.display = 'none'; }
    }

    var tbody = document.getElementById('resultadosCargaBody');
    if (tbody && data.registrosCargados) {
        // FIX: r.anio (sin tilde) — consistente con el backend
        tbody.innerHTML = data.registrosCargados.map(function(r) {
            if (r.tipo === 'Vehículo' || r.tipo === 'Vehiculo') {
                return '<tr>' +
                    '<td><span class="trab-badge trab-badge-info">🚗 ' + r.tipo + '</span></td>' +
                    '<td><strong>' + (r.placa || 'N/A') + '</strong></td>' +
                    '<td>' +
                        '<strong>' + (r.marca || 'N/A') + '</strong> ' + (r.tipoVehiculo || '') +
                        '<br><small style="color:#64748b;">Color: ' + (r.color || 'N/A') + ' · Año: ' + (r.anio || 'N/A') + '</small>' +
                        '<br><small style="color:#64748b;">Propietario: ' + (r.propietario || 'N/A') + '</small>' +
                    '</td>' +
                    '<td><span class="trab-badge trab-badge-success">Registrado</span></td>' +
                '</tr>';
            }
            if (r.tipo === 'Cliente') {
                return '<tr>' +
                    '<td><span class="trab-badge trab-badge-success">👤 ' + r.tipo + '</span></td>' +
                    '<td><strong>' + (r.nombre || 'N/A') + '</strong></td>' +
                    '<td>' +
                        (r.email || 'N/A') +
                        '<br><small style="color:#64748b;">Tel: ' + (r.telefono || 'N/A') + ' · Cédula: ' + (r.cedula || 'N/A') + '</small>' +
                    '</td>' +
                    '<td><span class="trab-badge trab-badge-success">Registrado</span></td>' +
                '</tr>';
            }
            return '';
        }).join('');
    }
}


// ==================== DELEGACIÓN DE EVENTOS ====================
function setupGlobalEventDelegation() {
    document.body.addEventListener('click', function(e) {
        var salida   = e.target.closest('.btn-salida');
        var cobrar   = e.target.closest('.btn-cobrar');
        var aceptar  = e.target.closest('.btn-aceptar');
        var rechazar = e.target.closest('.btn-rechazar');
        if (salida)   { e.preventDefault(); abrirModalSalida(parseInt(salida.dataset.id));   return; }
        if (cobrar)   { e.preventDefault(); abrirModalCobro(parseInt(cobrar.dataset.id));    return; }
        if (aceptar)  { e.preventDefault(); aceptarReservacion(aceptar.dataset.id);          return; }
        if (rechazar) { e.preventDefault(); rechazarReservacion(rechazar.dataset.id);        return; }
    });
}


// ==================== EVENTOS GLOBALES ====================
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        var cobro  = document.getElementById('cobroModal');
        var salida = document.getElementById('salidaModal');
        if (cobro  && cobro.style.display  === 'flex') { cerrarModalCobro();  }
        if (salida && salida.style.display === 'flex') { cerrarModalSalida(); }
    }
});

window.addEventListener('click', function(e) {
    var cobro  = document.getElementById('cobroModal');
    var salida = document.getElementById('salidaModal');
    if (e.target === cobro)  { cerrarModalCobro();  }
    if (e.target === salida) { cerrarModalSalida(); }
});

// FIX: limpiar timers al cerrar la página — evita memory leak
window.addEventListener('beforeunload', function() {
    if (updateInterval) { clearInterval(updateInterval); }
    Object.values(timerIntervals).forEach(function(id) { clearInterval(id); });
});


// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', function() {
    initializeTabs();
    initializeProfileMenu();
    initializeFormularioEntrada();
    initializeMarcas();
    setupGlobalEventDelegation();
    loadIndicadores();

    // Actualización automática cada 30 segundos
    updateInterval = setInterval(function() {
        loadIndicadores();
        var activeTab = document.querySelector('.aparca-sidebar-nav a.active');
        if (activeTab && activeTab.getAttribute('data-tab') === 'gestion') {
            loadVehiculosActivos();
            loadPendientesCobro();
        }
    }, 30000);
});

console.log('TrabajadorD.js cargado correctamente');