'use strict';
// ==================== CONFIGURACIÓN GLOBAL ====================
var API_BASE_URL = '/api/trabajador';
var REGISTRO_URL = '/api/trabajador/registrar-entrada';

var currentSalidaRegistroId = null;
var currentCobroRegistroId  = null;
var opcionesTarifa          = null;
var updateInterval          = null;
var timerIntervals          = {};
var modoRapido              = false;

var marcasPorTipo = {
    CARRO: [
        'RENAULT','KIA','TOYOTA','CHEVROLET','MAZDA','NISSAN','VOLKSWAGEN','FORD',
        'HYUNDAI','BMW','MERCEDES_BENZ','AUDI','PEUGEOT','CITROEN','FIAT','VOLVO',
        'JEEP','LAND_ROVER','PORSCHE','FERRARI','LAMBORGHINI','TESLA','BYD','CHANGAN',
        'GEELY','JAC','CHERY','GREAT_WALL','HAVAL','GWM','MITSUBISHI','SUBARU',
        'ISUZU','SSANGYONG','MG','RAM','DFSK','FOTON','OTRO'
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

// ── SVG Lucide inline para inyección en innerHTML ────────────────
var SVG = {
    car: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;display:inline;vertical-align:middle;margin-right:.3rem;flex-shrink:0;">' +
        '<path d="M5 17H3v-5l2-5h14l2 5v5h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/><path d="M5 12h14"/></svg>',

    moto: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;display:inline;vertical-align:middle;margin-right:.3rem;flex-shrink:0;">' +
        '<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>',

    user: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;display:inline;vertical-align:middle;margin-right:.3rem;flex-shrink:0;">' +
        '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',

    file: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:inline;vertical-align:middle;margin-right:.35rem;flex-shrink:0;">' +
        '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>',

    zap: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;display:inline;vertical-align:middle;margin-right:.3rem;flex-shrink:0;">' +
        '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>',

    parking: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;display:inline;vertical-align:middle;margin-right:.3rem;flex-shrink:0;">' +
        '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/></svg>'
};


// ==================== NOTIFICACIONES ====================
// MIGRADO: showNotification() custom eliminada.
// Alias de compatibilidad — delega en el helper centralizado (aparca-notifications.js).
function showNotification(message, type) {
    showToast(message, type || 'info');
}

// MIGRADO: showConfirm() con overlay/innerHTML manual eliminado.
// Wrapper de compatibilidad — delega en showConfirm() del helper centralizado.
function showConfirm(titulo, cuerpo, btnTexto, btnColor) {
    if (typeof titulo === 'object') {
        return window.AparcaNotif
            ? window.AparcaNotif.showConfirm(titulo)
            : Promise.resolve(false);
    }
    return window.AparcaNotif
        ? window.AparcaNotif.showConfirm({
            title:    titulo,
            body:     cuerpo     || '',
            btnTexto: btnTexto   || 'Confirmar',
            btnColor: btnColor   || 'danger'
        })
        : Promise.resolve(false);
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
    } catch (e) { return dateString; }
}

function formatNumber(number) {
    if (number == null) { return '0'; }
    return Number(number).toLocaleString('es-CO', {
        minimumFractionDigits: 0, maximumFractionDigits: 0
    });
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
            opt.value = marca;
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
        var f = document.getElementById(fId);
        if (f) { f.classList.remove('border-red-500', 'border-green-500'); }
    });
}


// ==================== MODO RÁPIDO ====================
function toggleModoRegistro() {
    modoRapido = document.getElementById('modoRapidoToggle').checked;
    var campos = document.getElementById('camposCompletos');
    var badge  = document.getElementById('badgeModo');
    var slider = document.getElementById('toggleSlider');
    var knob   = document.getElementById('toggleKnob');
    var txt    = document.getElementById('btnRegistrarTexto');

    if (modoRapido) {
        if (campos) { campos.style.maxHeight = '0'; campos.style.opacity = '0'; }
        if (badge)  { badge.textContent = 'RÁPIDO'; badge.style.background = '#0d9488'; badge.style.color = 'white'; }
        if (slider) { slider.style.background = '#0d9488'; }
        if (knob)   { knob.style.transform = 'translateX(20px)'; }
        if (txt)    { txt.textContent = 'Registrar Rápido'; }
        ['nombre','correo','telefono','cedula','marca'].forEach(function(id) {
            var e = document.getElementById(id + '-error');
            var f = document.getElementById(id);
            if (e) { e.textContent = ''; }
            if (f) { f.classList.remove('border-red-500', 'border-green-500'); }
        });
    } else {
        if (campos) { campos.style.maxHeight = '800px'; campos.style.opacity = '1'; }
        if (badge)  { badge.textContent = 'COMPLETO'; badge.style.background = '#e2e8f0'; badge.style.color = '#475569'; }
        if (slider) { slider.style.background = '#cbd5e1'; }
        if (knob)   { knob.style.transform = 'translateX(0)'; }
        if (txt)    { txt.textContent = 'Registrar Entrada'; }
    }
}


// ==================== VALIDACIÓN ====================
function validateFieldEntrada(fieldId) {
    var field     = document.getElementById(fieldId);
    var errorSpan = document.getElementById(fieldId + '-error');
    if (!field) { return true; }
    var isValid = true, message = '', value = field.value.trim();
    switch (fieldId) {
        case 'nombre':
            if (!value)                { isValid = false; message = 'El nombre es obligatorio.'; }
            else if (value.length < 2) { isValid = false; message = 'Al menos 2 caracteres.'; }
            break;
        case 'correo':
            if (!value)                                          { isValid = false; message = 'El correo es obligatorio.'; }
            else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { isValid = false; message = 'Formato inválido.'; }
            break;
        case 'telefono':
            if (!value)                          { isValid = false; message = 'El teléfono es obligatorio.'; }
            else if (!/^[0-9]{10}$/.test(value)) { isValid = false; message = 'Debe tener 10 dígitos.'; }
            break;
        case 'cedula':
            if (!value)                          { isValid = false; message = 'La cédula es obligatoria.'; }
            else if (!/^[0-9]{10}$/.test(value)) { isValid = false; message = 'Debe tener 10 dígitos.'; }
            break;
        case 'placa':
            if (!value)                                  { isValid = false; message = 'La placa es obligatoria.'; }
            else if (!/^[A-Z]{3}[0-9]{3}$/.test(value)) { isValid = false; message = 'Formato: ABC123'; }
            break;
        case 'tipoVehiculo':
            if (!value) { isValid = false; message = 'Selecciona el tipo.'; }
            break;
        case 'marca':
            if (!value) { isValid = false; message = 'Selecciona la marca.'; }
            break;
        default: break;
    }
    if (errorSpan) { errorSpan.textContent = isValid ? '' : message; }
    field.classList.toggle('border-red-500',   !isValid);
    field.classList.toggle('border-green-500', isValid && value !== '');
    return isValid;
}

function validateFormularioEntrada() {
    var campos = modoRapido
        ? ['placa', 'tipoVehiculo']
        : ['nombre', 'correo', 'telefono', 'cedula', 'placa', 'tipoVehiculo', 'marca'];
    return campos.map(function(c) { return validateFieldEntrada(c); })
        .every(function(v) { return v; });
}


// ==================== INDICADORES ====================
async function loadIndicadores() {
    try {
        var response = await fetch(API_BASE_URL + '/indicadores', {
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) { throw new Error('Error al cargar indicadores'); }
        var d = await response.json();

        function set(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }

        set('sedeNombre',        d.sedeNombre || 'Parqueadero');
        set('ind-sede-nombre',   d.sedeNombre || '—');
        set('ind-ocupacion',     (d.ocupacionActual || 0) + ' veh.');
        set('ind-ocupacion-sub', 'de ' + (d.capacidadTotal || 0) + ' cupos totales');
        set('ind-cupos',         d.cuposLibres || 0);
        set('ind-cupos-sub',     'de ' + (d.capacidadTotal || 0) + ' totales');
        set('ind-ingresos',      '$' + formatNumber(d.ingresosDia || 0));
        set('ind-vehiculos-hoy', d.vehiculosHoy || 0);
        set('ind-pendientes',    d.pendientesCobro || 0);
        set('ind-porcentaje',    (d.porcentajeOcupacion || 0) + '%');

        var pct = d.porcentajeOcupacion || 0;
        var ic  = document.getElementById('ind-pct-icon');
        if (ic) {
            ic.className = 'ind-icon ' +
                (pct >= 90 ? 'ind-orange' : pct >= 70 ? 'ind-yellow' : 'ind-purple');
        }

        var tarifaDisplay = document.getElementById('tarifaDisplay');
        if (tarifaDisplay) {
            var pc = d.tarifaPlenaC  != null ? '$' + formatNumber(d.tarifaPlenaC)  : 'N/A';
            var mc = d.tarifaMinutoC != null ? '$' + formatNumber(d.tarifaMinutoC) : 'N/A';
            var pm = d.tarifaPlenaM  != null ? '$' + formatNumber(d.tarifaPlenaM)  : 'N/A';
            var mm = d.tarifaMinutoM != null ? '$' + formatNumber(d.tarifaMinutoM) : 'N/A';
            tarifaDisplay.innerHTML =
                '<span style="display:inline-flex;align-items:center;margin-right:1.5rem;">' +
                SVG.car +
                'Plena: <strong style="margin:0 .25rem;">' + pc +
                '</strong> &middot; /min: <strong style="margin-left:.25rem;">' + mc + '</strong>' +
                '</span>' +
                '<span style="display:inline-flex;align-items:center;">' +
                SVG.moto +
                'Plena: <strong style="margin:0 .25rem;">' + pm +
                '</strong> &middot; /min: <strong style="margin-left:.25rem;">' + mm + '</strong>' +
                '</span>';
        }
    } catch (error) {
        console.error('Error indicadores:', error);
    }
}


// ==================== NAVEGACIÓN ====================
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
            if (window.innerWidth < 768) { document.body.classList.add('sidebar-collapsed'); }
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
            btn.setAttribute('aria-expanded', dropdown.classList.contains('show') ? 'true' : 'false');
        });
        document.addEventListener('click', function() {
            dropdown.classList.remove('show');
            btn.setAttribute('aria-expanded', 'false');
        });
    }
}

function handleLogout() { logoutJWT(); }

function initializeMarcas() {
    var ts = document.getElementById('tipoVehiculo');
    if (ts) { ts.addEventListener('change', actualizarMarcasEntrada); actualizarMarcasEntrada(); }
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
                campo.addEventListener('blur',  function() { validateFieldEntrada(campoId); });
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
        if (tel) tel.addEventListener('input', function(e) { e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10); });
        var ced = document.getElementById('cedula');
        if (ced) ced.addEventListener('input', function(e) { e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10); });
        var plc = document.getElementById('placa');
        if (plc) plc.addEventListener('input', function(e) { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 6); });
        var tv = document.getElementById('tipoVehiculo');
        if (tv) tv.addEventListener('change', function() { actualizarMarcasEntrada(); validateFieldEntrada('tipoVehiculo'); });
        var mk = document.getElementById('marca');
        if (mk) mk.addEventListener('change', function() { validateFieldEntrada('marca'); });
    }
    var buscar = document.getElementById('buscarPlaca');
    if (buscar) {
        buscar.addEventListener('input',    function(e) { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
        buscar.addEventListener('keypress', function(e) { if (e.key === 'Enter') { e.preventDefault(); buscarPorPlacaIntegrado(); } });
    }
}

async function registrarEntradaDirecto() {
    if (!validateFormularioEntrada()) {
        showWarning(
            modoRapido
                ? 'Ingresa la placa y el tipo de vehículo'
                : 'Completa todos los campos correctamente'
        );
        return;
    }
    try {
        var placa = getInputValue('placa');
        var datos = {
            vehiculoPlaca: placa,
            vehiculoTipo:  getInputValue('tipoVehiculo'),
            vehiculoMarca: getInputValue('marca') || 'OTRO',
            vehiculoColor: getInputValue('color') || 'NO ESPECIFICADO',
            vehiculoAnio:  getInputValue('anio')  || '2020'
        };
        if (modoRapido) {
            datos.clienteNombre   = 'Visitante';
            datos.clienteTelefono = '';
            datos.clienteEmail    = placa.toLowerCase() + '@temp.aparcaya.co';
            datos.clienteCedula   = '';
            showInfo('Registrando entrada rápida...');
        } else {
            datos.clienteNombre   = getInputValue('nombre');
            datos.clienteTelefono = getInputValue('telefono');
            datos.clienteEmail    = getInputValue('correo');
            datos.clienteCedula   = getInputValue('cedula');
            showInfo('Registrando entrada...');
        }
        var response = await fetch(REGISTRO_URL, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(datos)
        });
        if (!response.ok) {
            var err = await response.json();
            throw new Error(err.error || 'Error al registrar entrada');
        }
        var result = await response.json();
        showSuccess(
            modoRapido
                ? 'Placa ' + placa + ' registrada. Cupo: ' + (result.cupo || 'S/A')
                : 'Entrada de ' + result.clienteNombre + '. Cupo: ' + (result.cupo || 'S/A')
        );
        limpiarFormularioEntrada();
        setTimeout(function() { loadVehiculosActivos(); loadIndicadores(); }, 400);
    } catch (error) {
        showError(error.message);
    }
}

async function buscarPorPlacaIntegrado() {
    var placa = getInputValue('buscarPlaca');
    if (!placa || placa.length < 5) { showWarning('Ingrese una placa válida'); return; }
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
                    if (ms) ms.value = data.vehiculo.marca;
                }, 100);
            }
            if (data.vehiculo.anio) { setInputValue('anio', data.vehiculo.anio); }
            if (modoRapido) {
                var tog = document.getElementById('modoRapidoToggle');
                if (tog) { tog.checked = false; toggleModoRegistro(); }
            }
            showSuccess('Vehículo encontrado — datos cargados');
        } else {
            limpiarFormularioEntrada();
            setInputValue('placa', placa);
            showInfo('Vehículo nuevo. Complete los datos.');
        }
    } catch (error) {
        showError('Error al buscar');
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
                '<td><div style="font-size:.82rem;line-height:1.6;">' +
                '<div><strong>Plena:</strong> $' + formatNumber(v.cobroEstimadoPlena) + '</div>' +
                '<div style="color:#059669;"><strong>Minuto:</strong> $' + formatNumber(v.cobroEstimadoMinuto) + '</div>' +
                '</div></td>' +
                '<td><button class="sede-btn-warning btn-salida" data-id="' + v.registroId + '" style="font-size:.8rem;padding:.35rem .75rem;">Salida</button></td>' +
                '</tr>';
        }).join('');

        vehiculos.forEach(function(v) {
            var el = document.getElementById('timer-' + v.registroId);
            if (!el) { return; }
            var secs = v.segundosTranscurridos || 0;
            timerIntervals[v.registroId] = setInterval(function() {
                secs++;
                var h = Math.floor(secs / 3600),
                    m = Math.floor((secs % 3600) / 60),
                    s = secs % 60;
                if (h > 0)      el.textContent = h + 'h ' + m + 'm ' + s + 's';
                else if (m > 0) el.textContent = m + 'm ' + s + 's';
                else            el.textContent = s + 's';
            }, 1000);
        });
    } catch (error) {
        showError('Error al cargar vehículos activos');
    }
}


// ==================== MODAL SALIDA ====================
async function abrirModalSalida(registroId) {
    var modal = document.getElementById('salidaModal');
    if (!modal) { showError('Error: Modal no encontrado'); return; }
    try {
        currentSalidaRegistroId = registroId;
        var response = await fetch(API_BASE_URL + '/vehiculos-activos', {
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) { throw new Error('Error al obtener datos'); }
        var vehiculos = await response.json();
        var v = vehiculos.find(function(x) { return x.registroId === registroId; });
        if (!v) {
            showWarning('Este vehículo ya no está activo. Actualizando lista...');
            await loadVehiculosActivos();
            return;
        }
        function set(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }
        set('salidaPlaca',       v.placa);
        set('salidaCliente',     v.clienteNombre);
        set('salidaHoraEntrada', formatDateTime(v.horaEntrada));
        set('salidaTiempo',      v.tiempoTranscurrido);
        var elCobro = document.getElementById('salidaCobroEstimado');
        if (elCobro) {
            elCobro.innerHTML =
                '<div class="trab-modal-cobro-estimado-row">' +
                '<strong>Plena:</strong><span>$' + formatNumber(v.cobroEstimadoPlena) + '</span>' +
                '</div>' +
                '<div class="trab-modal-cobro-estimado-row trab-modal-cobro-estimado-row--minuto">' +
                '<strong>Minuto:</strong><span>$' + formatNumber(v.cobroEstimadoMinuto) + '</span>' +
                '</div>';
        }
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
    } catch (error) {
        showError('Error al abrir modal de salida');
    }
}

function cerrarModalSalida() {
    var modal = document.getElementById('salidaModal');
    if (modal) { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
    currentSalidaRegistroId = null;
}

async function confirmarSalida() {
    if (!currentSalidaRegistroId) { return; }
    try {
        showInfo('Registrando salida...');
        var response = await fetch(
            API_BASE_URL + '/registrar-salida/' + currentSalidaRegistroId,
            { method: 'POST', headers: { 'Content-Type': 'application/json' } }
        );
        if (!response.ok) {
            var err = await response.json();
            throw new Error(err.error || 'Error');
        }
        showSuccess('Salida registrada. Proceda a cobrar.');
        cerrarModalSalida();
        await loadVehiculosActivos();
        await loadPendientesCobro();
        await loadIndicadores();
    } catch (error) {
        showError(error.message);
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
                '<td><button class="sede-btn-primary btn-cobrar" data-id="' + p.registroId + '" style="font-size:.8rem;padding:.35rem .75rem;">Cobrar</button></td>' +
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
    modal.classList.add('open');
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

        function set(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }
        set('cobroCliente', data.clienteNombre);
        set('cobroPlaca',   data.placa);
        set('cobroTiempo',  data.tiempoTotal);

        var container = document.getElementById('tarifaSelectorContainer');
        if (container) {
            container.innerHTML =
                '<div class="sede-modal-cobro-selector">' +
                '<p style="font-size:.85rem;font-weight:600;color:#0f766e;margin:0 0 .75rem;">Seleccione tarifa:</p>' +
                data.opciones.map(function(op, i) {
                    return '<label class="sede-modal-cobro-opcion">' +
                        '<input type="radio" name="tipoTarifa" value="' + op.tipo + '"' +
                        (i === 0 ? ' checked' : '') +
                        ' onchange="actualizarPrecioCobro(\'' + op.tipo + '\',' + op.precio + ')">' +
                        '<div><strong>' + op.nombre + '</strong>' +
                        '<div style="font-size:.8rem;color:#64748b;">' + (op.descripcion || '') + '</div>' +
                        '</div>' +
                        '<span style="color:#059669;font-weight:700;white-space:nowrap;">$' + formatNumber(op.precio) + ' COP</span>' +
                        '</label>';
                }).join('') + '</div>';
        }
        var ep = document.getElementById('cobroPrecio');
        if (ep && data.opciones[0]) { ep.textContent = formatNumber(data.opciones[0].precio); }
    } catch (error) {
        showError(error.message);
    }
}

function actualizarPrecioCobro(tipo, precio) {
    var el = document.getElementById('cobroPrecio');
    if (el) { el.textContent = formatNumber(precio); }
}

function cerrarModalCobro() {
    var modal = document.getElementById('cobroModal');
    if (modal) { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
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
        if (!tipoTarifa) { showWarning('Seleccione una tarifa'); return; }
        showInfo('Procesando cobro...');
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
        showSuccess('Cobro: $' + formatNumber(data.precio) + ' — ' + data.tipoTarifaAplicada);
        cerrarModalCobro();
        await loadPendientesCobro();
        await loadIndicadores();
    } catch (error) {
        showError(error.message);
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
        var response = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
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
            if      (r.estado === 'ACTIVO')     badge = '<span class="trab-badge trab-badge-info">Activo</span>';
            else if (r.estado === 'FINALIZADO') badge = '<span class="trab-badge trab-badge-warning">Pendiente</span>';
            else if (r.estado === 'COBRADO')    badge = '<span class="trab-badge trab-badge-success">Cobrado</span>';
            else                                badge = '<span class="trab-badge trab-badge-danger">Cancelado</span>';
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
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:1.5rem;color:#64748b;">Sin reservaciones activas</td></tr>';
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
                '<td>' + renderBadgeEstado(r.estado) + '</td>' +
                '<td>' + renderAccionesReserva(r.id, r.estado) + '</td>' +
                '</tr>';
        }).join('');
    } catch (error) {
        console.error('Error reservaciones:', error);
    }
}

// Badge de color por estado
function renderBadgeEstado(estado) {
    var map = {
        'PENDIENTE':  ['trab-badge-warning',  'Pendiente'],
        'ACEPTADA':   ['trab-badge-info',     'Aceptada'],
        'EN_CURSO':   ['trab-badge-success',  'En curso'],
        'COMPLETADA': ['trab-badge-primary',  'Completada'],
        'PAGADA':     ['trab-badge-success',  'Pagada'],
        'CANCELADA':  ['trab-badge-danger',   'Cancelada']
    };
    var cfg = map[estado] || ['trab-badge-danger', estado];
    return '<span class="trab-badge ' + cfg[0] + '">' + cfg[1] + '</span>';
}

// Botones según el estado actual — solo la acción válida siguiente
function renderAccionesReserva(id, estado) {
    switch (estado) {
        case 'PENDIENTE':
            return '<button class="sede-btn-success btn-aceptar" data-id="' + id + '" style="font-size:.8rem;padding:.35rem .75rem;margin-right:.25rem;">Aceptar</button>' +
                '<button class="sede-btn-danger btn-rechazar" data-id="' + id + '" style="font-size:.8rem;padding:.35rem .75rem;">Rechazar</button>';
        case 'ACEPTADA':
            return '<button class="sede-btn-primary btn-iniciar" data-id="' + id + '" style="font-size:.8rem;padding:.35rem .75rem;">Iniciar entrada</button>';
        case 'EN_CURSO':
            return '<button class="sede-btn-warning btn-completar" data-id="' + id + '" style="font-size:.8rem;padding:.35rem .75rem;">Registrar salida</button>';
        case 'COMPLETADA':
            return '<button class="sede-btn-success btn-cobrar-reserva" data-id="' + id + '" style="font-size:.8rem;padding:.35rem .75rem;">Cobrar</button>';
        default:
            return '<span style="color:#94a3b8;font-size:.8rem;">—</span>';
    }
}


async function rechazarReservacion(id) {
    var ok = await showConfirm(
        'Rechazar reservación',
        '¿Confirmas que deseas rechazar esta reservación?',
        'Rechazar', 'danger'
    );
    if (!ok) { return; }
    try {
        var response = await fetch('/api/reservaciones/' + id + '/cancelar', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            var err = await response.json();
            throw new Error(err.message || 'Error al rechazar');
        }
        showSuccess('Reservación rechazada');
        await loadReservaciones();
    } catch (error) {
        showError('Error al rechazar reservación');
    }
}

async function iniciarReservacion(id) {
    var ok = await showConfirm(
        'Iniciar reservación',
        '¿El vehículo ya ingresó físicamente al parqueadero?',
        'Confirmar entrada', 'warning'
    );
    if (!ok) { return; }
    try {
        var response = await fetch('/api/reservaciones/' + id + '/iniciar', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            var err = await response.json();
            throw new Error(err.message || 'Error');
        }
        showSuccess('Reservación iniciada — vehículo en curso');
        await loadReservaciones();
        await loadVehiculosActivos();
        await loadIndicadores();
    } catch (error) {
        showError(error.message);
    }
}

async function completarReservacion(id) {
    var ok = await showConfirm(
        'Registrar salida',
        '¿El vehículo ya salió del parqueadero?',
        'Confirmar salida', 'warning'
    );
    if (!ok) { return; }
    try {
        var response = await fetch('/api/reservaciones/' + id + '/completar', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            var err = await response.json();
            throw new Error(err.message || 'Error');
        }
        showSuccess('Salida registrada — reserva pendiente de cobro');
        await loadReservaciones();
        await loadPendientesCobro();
        await loadIndicadores();
    } catch (error) {
        showError(error.message);
    }
}

async function cobrarReservacion(id) {
    var metodoPago = 'EFECTIVO';
    // Si quieres selección de método, puedes abrir un SweetAlert aquí.
    // Por ahora confirma con método por defecto.
    var ok = await showConfirm(
        'Cobrar reservación',
        '¿Confirmas el cobro de esta reservación?',
        'Cobrar', 'warning'
    );
    if (!ok) { return; }
    try {
        var response = await fetch('/api/pagos/cobrar-reserva', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ idReserva: parseInt(id), metodoPago: metodoPago })
        });
        if (!response.ok) {
            var err = await response.json();
            throw new Error(err.message || 'Error al cobrar');
        }
        var data = await response.json();
        showSuccess('Cobro registrado — $' + formatNumber(data.monto));
        await loadReservaciones();
        await loadIndicadores();
    } catch (error) {
        showError(error.message);
    }
}


// ==================== PLANTILLAS EXCEL ====================
function descargarPlantillaCompleta() {
    if (typeof XLSX === 'undefined') { showError('Error: Librería XLSX no cargada.'); return; }
    var wb      = XLSX.utils.book_new();
    var wsDatos = XLSX.utils.aoa_to_sheet([
        ['Tipo','Dato1','Dato2','Dato3','Dato4','Dato5','Dato6'],
        ['Cliente','Juan Pérez Ejemplo','3001234589','juan.perez@gmail.com','1234567899','',''],
        ['Cliente','María González Ejemplo','3007654321','maria.gonzalez@gmail.com','0987654322','',''],
        ['Vehiculo','ABC123','CARRO','TOYOTA','Blanco','2020','juan.perez@gmail.com'],
        ['Vehiculo','XYZ789','MOTO','HONDA','Negro','2021','maria.gonzalez@gmail.com']
    ]);
    wsDatos['!cols'] = [{wch:10},{wch:25},{wch:15},{wch:30},{wch:15},{wch:10},{wch:30}];
    XLSX.utils.book_append_sheet(wb, wsDatos, 'Datos');
    var wsInst = XLSX.utils.aoa_to_sheet([
        ['INSTRUCCIONES PARA LA CARGA MASIVA'],[''],
        ['CLIENTES:  Tipo | Nombre | Teléfono | Email | Cédula'],
        ['VEHÍCULOS: Tipo | Placa | TipoVeh | Marca | Color | Año | EmailCliente'],[''],
        ['TIPOS VÁLIDOS: CARRO, MOTO, BICICLETA, OTRO'],
        ['ORDEN: primero los Clientes, luego los Vehículos']
    ]);
    wsInst['!cols'] = [{wch:80}];
    XLSX.utils.book_append_sheet(wb, wsInst, 'Instrucciones');
    XLSX.writeFile(wb, 'Plantilla_Carga_Masiva_Completa.xlsx');
    showSuccess('Plantilla completa descargada');
}

function descargarPlantillaVehiculosSolo() {
    if (typeof XLSX === 'undefined') { showError('Error: Librería XLSX no cargada.'); return; }
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet([
        ['Tipo','Placa','Tipo Vehículo','Marca','Color','Año','Email Cliente'],
        ['Vehiculo','ABC123','CARRO','TOYOTA','Blanco','2020','cliente1@gmail.com'],
        ['Vehiculo','XYZ789','MOTO','HONDA','Negro','2021','cliente2@gmail.com']
    ]);
    ws['!cols'] = [{wch:10},{wch:10},{wch:15},{wch:12},{wch:10},{wch:8},{wch:28}];
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    XLSX.writeFile(wb, 'Plantilla_Vehiculos.xlsx');
    showSuccess('Plantilla de vehículos descargada');
}

function mostrarArchivoSeleccionado() {
    var fi   = document.getElementById('excelFile');
    var info = document.getElementById('archivoSeleccionado');
    if (fi && fi.files[0]) {
        var f = fi.files[0];
        info.innerHTML =
            '<span style="display:inline-flex;align-items:center;gap:.35rem;color:#059669;font-weight:600;">' +
            SVG.file +
            '<strong>' + f.name + '</strong>' +
            '<span style="font-weight:400;color:#64748b;">(' + (f.size / 1024).toFixed(2) + ' KB)</span>' +
            '</span>';
    } else if (info) {
        info.innerHTML = '';
    }
}


// ==================== CARGA MASIVA ====================
async function cargarExcel() {
    var fileInput = document.getElementById('excelFile');
    var file      = fileInput ? fileInput.files[0] : null;
    if (!file) { showWarning('Por favor seleccione un archivo Excel'); return; }
    var ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') { showWarning('El archivo debe ser formato Excel (.xlsx o .xls)'); return; }
    var pc = document.getElementById('progressContainer');
    var pb = document.getElementById('progressBar');
    var pt = document.getElementById('progressText');
    try {
        if (pc) pc.style.display = 'block';
        if (pb) { pb.style.width = '30%'; pb.textContent = '30%'; }
        if (pt) pt.textContent = 'Subiendo archivo...';
        var formData = new FormData();
        formData.append('file', file);
        var response = await fetch(API_BASE_URL + '/carga-masiva', { method: 'POST', body: formData });
        if (pb) { pb.style.width = '70%'; pb.textContent = '70%'; }
        if (pt) pt.textContent = 'Procesando datos...';
        if (!response.ok) {
            var errData = {};
            try { errData = await response.json(); } catch(e2) {}
            throw new Error(errData.error || 'Error al procesar el archivo');
        }
        var data = await response.json();
        if (pb) { pb.style.width = '100%'; pb.textContent = '100%'; }
        if (pt) pt.textContent = 'Completado';
        mostrarResultadosCarga(data);
        if (data.tieneErrores) {
            showWarning('Carga con ' + data.errores.length + ' error(es). Total: ' + (data.totalRegistros || 0));
        } else {
            showSuccess('Carga exitosa: ' + (data.totalRegistros || 0) + ' registros');
        }
        fileInput.value = '';
        var ai = document.getElementById('archivoSeleccionado');
        if (ai) ai.innerHTML = '';
        setTimeout(function() { if (pc) pc.style.display = 'none'; }, 2000);
    } catch (error) {
        showError('Error: ' + error.message);
        if (pc) pc.style.display = 'none';
    }
}

function mostrarResultadosCarga(data) {
    var rd = document.getElementById('resultadosCarga');
    if (rd) rd.style.display = 'block';
    var resumen = document.getElementById('resumenCarga');
    if (resumen) {
        resumen.innerHTML =
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;">' +
            '<div style="background:linear-gradient(135deg,#d1fae5,#a7f3d0);padding:1.5rem;border-radius:.75rem;text-align:center;">' +
            '<div style="font-size:2rem;font-weight:700;color:#065f46;">' + (data.clientesRegistrados || 0) + '</div>' +
            '<div style="font-size:.88rem;color:#047857;font-weight:600;">Clientes</div></div>' +
            '<div style="background:linear-gradient(135deg,#dbeafe,#bfdbfe);padding:1.5rem;border-radius:.75rem;text-align:center;">' +
            '<div style="font-size:2rem;font-weight:700;color:#1e40af;">' + (data.vehiculosRegistrados || 0) + '</div>' +
            '<div style="font-size:.88rem;color:#1e3a8a;font-weight:600;">Vehículos</div></div>' +
            '<div style="background:linear-gradient(135deg,#e0e7ff,#c7d2fe);padding:1.5rem;border-radius:.75rem;text-align:center;">' +
            '<div style="font-size:2rem;font-weight:700;color:#4338ca;">' + (data.totalRegistros || 0) + '</div>' +
            '<div style="font-size:.88rem;color:#3730a3;font-weight:600;">Total</div></div>' +
            '</div>';
    }
    var ec = document.getElementById('erroresContainer');
    var le = document.getElementById('listaErrores');
    if (data.errores && data.errores.length > 0) {
        if (ec) ec.style.display = 'block';
        if (le) le.innerHTML = data.errores.map(function(e) { return '<li>' + e + '</li>'; }).join('');
    } else {
        if (ec) ec.style.display = 'none';
    }
    var tbody = document.getElementById('resultadosCargaBody');
    if (tbody && data.registrosCargados) {
        tbody.innerHTML = data.registrosCargados.map(function(r) {
            if (r.tipo === 'Vehículo' || r.tipo === 'Vehiculo') {
                return '<tr>' +
                    '<td><span class="trab-badge trab-badge-info" style="display:inline-flex;align-items:center;gap:.2rem;">' +
                    SVG.parking + r.tipo + '</span></td>' +
                    '<td><strong>' + (r.placa || 'N/A') + '</strong></td>' +
                    '<td><strong>' + (r.marca || 'N/A') + '</strong> ' + (r.tipoVehiculo || '') +
                    '<br><small style="color:#64748b;">Color: ' + (r.color || 'N/A') +
                    ' · Año: ' + (r.anio || 'N/A') + '</small>' +
                    '<br><small style="color:#64748b;">Propietario: ' + (r.propietario || 'N/A') + '</small></td>' +
                    '<td><span class="trab-badge trab-badge-success">Registrado</span></td>' +
                    '</tr>';
            }
            if (r.tipo === 'Cliente') {
                return '<tr>' +
                    '<td><span class="trab-badge trab-badge-success" style="display:inline-flex;align-items:center;gap:.2rem;">' +
                    SVG.user + r.tipo + '</span></td>' +
                    '<td><strong>' + (r.nombre || 'N/A') + '</strong></td>' +
                    '<td>' + (r.email || 'N/A') +
                    '<br><small style="color:#64748b;">Tel: ' + (r.telefono || 'N/A') +
                    ' · Cédula: ' + (r.cedula || 'N/A') + '</small></td>' +
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
        var salida        = e.target.closest('.btn-salida');
        var cobrar        = e.target.closest('.btn-cobrar');
        var aceptar       = e.target.closest('.btn-aceptar');
        var rechazar      = e.target.closest('.btn-rechazar');
        // NUEVOS
        var iniciar       = e.target.closest('.btn-iniciar');
        var completar     = e.target.closest('.btn-completar');
        var cobrarReserva = e.target.closest('.btn-cobrar-reserva');

        if (salida)        { e.preventDefault(); abrirModalSalida(parseInt(salida.dataset.id));        return; }
        if (cobrar)        { e.preventDefault(); abrirModalCobro(parseInt(cobrar.dataset.id));         return; }
        if (aceptar)       { e.preventDefault(); aceptarReservacion(aceptar.dataset.id);               return; }
        if (rechazar)      { e.preventDefault(); rechazarReservacion(rechazar.dataset.id);             return; }
        if (iniciar)       { e.preventDefault(); iniciarReservacion(iniciar.dataset.id);               return; }
        if (completar)     { e.preventDefault(); completarReservacion(completar.dataset.id);           return; }
        if (cobrarReserva) { e.preventDefault(); cobrarReservacion(cobrarReserva.dataset.id);          return; }
    });
}


// ==================== EVENTOS GLOBALES ====================
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
    if (e.target === cobro)  { cerrarModalCobro();  }
    if (e.target === salida) { cerrarModalSalida(); }
});

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
    updateInterval = setInterval(function() {
        loadIndicadores();
        var activeTab = document.querySelector('.aparca-sidebar-nav a.active');
        if (activeTab && activeTab.getAttribute('data-tab') === 'gestion') {
            loadVehiculosActivos();
            loadPendientesCobro();
        }
    }, 30000);
});


// ==================== EXPONER GLOBALES ====================
window.toggleModoRegistro              = toggleModoRegistro;
window.buscarPorPlacaIntegrado         = buscarPorPlacaIntegrado;
window.limpiarFormularioEntrada        = limpiarFormularioEntrada;
window.loadHistorial                   = loadHistorial;
window.loadReservaciones               = loadReservaciones;
window.cerrarModalSalida               = cerrarModalSalida;
window.confirmarSalida                 = confirmarSalida;
window.cerrarModalCobro                = cerrarModalCobro;
window.procesarCobro                   = procesarCobro;
window.actualizarPrecioCobro           = actualizarPrecioCobro;
window.handleLogout                    = handleLogout;
window.mostrarArchivoSeleccionado      = mostrarArchivoSeleccionado;
window.cargarExcel                     = cargarExcel;
window.descargarPlantillaCompleta      = descargarPlantillaCompleta;
window.descargarPlantillaVehiculosSolo = descargarPlantillaVehiculosSolo;
window.iniciarReservacion    = iniciarReservacion;
window.completarReservacion  = completarReservacion;
window.cobrarReservacion     = cobrarReservacion;
window.renderBadgeEstado     = renderBadgeEstado;
window.renderAccionesReserva = renderAccionesReserva;