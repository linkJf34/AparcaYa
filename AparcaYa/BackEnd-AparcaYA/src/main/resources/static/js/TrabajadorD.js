// ==================== CONFIGURACIÓN GLOBAL ====================
// ✅ FIX O-01: getToken() eliminado completamente.
//    La autenticación es por sesión de Spring Security — el navegador
//    envía la cookie de sesión automáticamente en cada fetch.
//    Los headers 'Authorization: Bearer ...' han sido quitados de
//    todos los fetches del archivo.
const API_BASE_URL = '/api/trabajador';
const REGISTRO_URL = '/api/trabajador/registrar-entrada';

let currentSalidaRegistroId = null;
let currentCobroRegistroId  = null;
let opcionesTarifa  = null;
let updateInterval  = null;
let timerIntervals  = {};

const marcasPorTipo = {
    CARRO: ["RENAULT","KIA","TOYOTA","CHEVROLET","MAZDA","NISSAN","VOLKSWAGEN","FORD","HYUNDAI","BMW","MERCEDES_BENZ","AUDI","PEUGEOT","CITROEN","FIAT","VOLVO","JEEP","LAND_ROVER","PORSCHE","FERRARI","LAMBORGHINI","TESLA","BYD","CHANGAN","GEELY","JAC","CHERY","GREAT_WALL","HAVAL","GWM","MITSUBISHI","SUBARU","ISUZU","SSANGYONG","MG","RAM","DFSK","FOTON","OTRO"],
    MOTO:  ["HONDA","YAMAHA","SUZUKI","KAWASAKI","BAJAJ","TVS","HERO","KTM","DUCATI","HARLEY_DAVIDSON","BMW_MOTORRAD","TRIUMPH","ROYAL_ENFIELD","AUTECO","AKT","VICTORY","APRILIA","BENELLI","HUSQVARNA","OTRO"],
    BICICLETA: ["TREK","SPECIALIZED","GIANT","SCOTT","CANNONDALE","ORBEA","GW","SHIMANO","BIANCHI","MERIDA","CUBE","BMC","FOCUS","OTRO"],
    OTRO: ["OTRO"]
};

// ==================== MODAL DE CONFIRMACIÓN ====================
// ✅ FIX O-02/O-03: Reemplaza todos los confirm() nativos del archivo.
// showConfirm() — usado en logout, aceptar/rechazar reservación.
function showConfirm(titulo, cuerpo, btnTexto = 'Confirmar', btnColor = 'danger') {
    return new Promise(resolve => {
        let overlay = document.getElementById('confirm-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'confirm-overlay';
            overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:1rem;';
            document.body.appendChild(overlay);
        }
        const btnColors = { danger: 'background:#dc2626;color:#fff', warning: 'background:#f59e0b;color:#fff' };
        overlay.innerHTML = `
            <div role="dialog" aria-modal="true"
                 style="background:#fff;border-radius:0.75rem;padding:2rem;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3);">
                <h3 style="font-size:1.125rem;font-weight:700;color:#0f172a;margin:0 0 0.75rem;">${titulo}</h3>
                <p style="font-size:0.875rem;color:#64748b;margin:0 0 1.5rem;line-height:1.6;">${cuerpo}</p>
                <div style="display:flex;justify-content:flex-end;gap:0.75rem;">
                    <button id="confirm-cancel" style="padding:0.5rem 1.25rem;border:1px solid #e2e8f0;border-radius:0.5rem;background:#fff;color:#374151;cursor:pointer;">Cancelar</button>
                    <button id="confirm-ok" style="padding:0.5rem 1.25rem;border:none;border-radius:0.5rem;${btnColors[btnColor]||btnColors.danger};cursor:pointer;font-weight:600;">${btnTexto}</button>
                </div>
            </div>`;
        overlay.style.display = 'flex';
        document.getElementById('confirm-ok').onclick     = () => { overlay.style.display = 'none'; resolve(true); };
        document.getElementById('confirm-cancel').onclick = () => { overlay.style.display = 'none'; resolve(false); };
    });
}

// ==================== UTILIDADES ====================
function setInputValue(id, value) { const el = document.getElementById(id); if (el) el.value = value || ''; }
function getInputValue(id)        { const el = document.getElementById(id); return el ? el.value.trim() : ''; }

function formatDateTime(dateString) {
    if (!dateString) return '-';
    try { return new Date(dateString).toLocaleString('es-CO', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }); }
    catch { return dateString; }
}

function formatNumber(number) {
    if (number == null) return '0';
    return Number(number).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function showNotification(message, type = 'info') {
    document.querySelectorAll('.toast-notification').forEach(t => t.remove());
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.style.cssText = `position:fixed;top:80px;right:20px;padding:1rem 1.5rem;border-radius:0.5rem;color:white;font-weight:600;z-index:9999;animation:slideIn 0.3s ease-out;max-width:400px;box-shadow:0 4px 12px rgba(0,0,0,0.15);`;
    const colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
    toast.style.backgroundColor = colors[type] || colors.info;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.animation = 'slideOut 0.3s ease-in'; setTimeout(() => toast.remove(), 300); }, 5000);
}

function formatMarcaName(marca) {
    const map = { 'MERCEDES_BENZ':'Mercedes-Benz','LAND_ROVER':'Land Rover','GREAT_WALL':'Great Wall','BMW_MOTORRAD':'BMW Motorrad','HARLEY_DAVIDSON':'Harley-Davidson','ROYAL_ENFIELD':'Royal Enfield' };
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
            const opt = document.createElement('option');
            opt.value = marca; opt.textContent = formatMarcaName(marca);
            marcaSelect.appendChild(opt);
        });
    }
}

function limpiarFormularioEntrada() {
    ['nombre','telefono','correo','cedula','placa','color','anio','buscarPlaca'].forEach(id => setInputValue(id, ''));
    const ts = document.getElementById('tipoVehiculo'); if (ts) ts.value = '';
    const ms = document.getElementById('marca'); if (ms) ms.innerHTML = '<option value="">Selecciona una marca</option>';
    ['nombre','correo','telefono','cedula','placa','tipoVehiculo','marca'].forEach(fId => {
        const err = document.getElementById(`${fId}-error`); if (err) err.textContent = '';
        const suc = document.getElementById(`${fId}-success`); if (suc) suc.textContent = '';
        const f   = document.getElementById(fId); if (f) f.classList.remove('border-red-500','border-green-500');
    });
}

// ==================== VALIDACIÓN ====================
function validateFieldEntrada(fieldId) {
    const field = document.getElementById(fieldId);
    const errorSpan = document.getElementById(`${fieldId}-error`);
    if (!field) return true;
    let isValid = true, message = '';
    const value = field.value.trim();
    switch(fieldId) {
        case 'nombre':       if (!value) { isValid=false; message='El nombre es obligatorio.'; } else if (value.length<2) { isValid=false; message='Al menos 2 caracteres.'; } break;
        case 'correo':       if (!value) { isValid=false; message='El correo es obligatorio.'; } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { isValid=false; message='Formato inválido.'; } break;
        case 'telefono':     if (!value) { isValid=false; message='El teléfono es obligatorio.'; } else if (!/^[0-9]{10}$/.test(value)) { isValid=false; message='Debe tener 10 dígitos.'; } break;
        case 'cedula':       if (!value) { isValid=false; message='La cédula es obligatoria.'; } else if (!/^[0-9]{10}$/.test(value)) { isValid=false; message='Debe tener 10 dígitos.'; } break;
        case 'placa':        if (!value) { isValid=false; message='La placa es obligatoria.'; } else if (!/^[A-Z]{3}[0-9]{3}$/.test(value)) { isValid=false; message='Formato: ABC123'; } break;
        case 'tipoVehiculo': if (!value) { isValid=false; message='Selecciona el tipo.'; } break;
        case 'marca':        if (!value) { isValid=false; message='Selecciona la marca.'; } break;
    }
    if (errorSpan) errorSpan.textContent = isValid ? '' : message;
    field.classList.toggle('border-red-500',  !isValid);
    field.classList.toggle('border-green-500', isValid && value !== '');
    return isValid;
}

function validateFormularioEntrada() {
    return ['nombre','correo','telefono','cedula','placa','tipoVehiculo','marca']
        .map(c => validateFieldEntrada(c)).every(v => v);
}

// ==================== NAVEGACIÓN ====================
function initializeTabs() {
    const navLinks = document.querySelectorAll('.aparca-sidebar-nav a');
    const sections = document.querySelectorAll('.aparca-content-section');
    navLinks.forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            sections.forEach(s => s.classList.add('hidden'));
            link.classList.add('active');
            const tabId   = link.getAttribute('data-tab');
            const section = document.getElementById(tabId);
            if (section) {
                section.classList.remove('hidden');
                if (tabId === 'inicio')        loadIndicadores();
                if (tabId === 'gestion')       { loadVehiculosActivos(); loadPendientesCobro(); }
                if (tabId === 'reservaciones') loadReservaciones();
            }
        });
    });
}

function initializeProfileMenu() {
    const btn = document.getElementById('profileBtn'), dropdown = document.getElementById('profileDropdown');
    if (btn && dropdown) {
        btn.addEventListener('click', e => { e.stopPropagation(); dropdown.classList.toggle('show'); });
        document.addEventListener('click', () => dropdown.classList.remove('show'));
    }
}

// ✅ FIX O-02: confirm() nativo reemplazado por showConfirm().
//    logout redirigía a /login directamente — el SecurityContext de Spring
//    quedaba activo. Ahora hace POST /logout para invalidar la sesión.
async function handleLogout() {
    const ok = await showConfirm('Cerrar sesión', '¿Estás seguro de que deseas cerrar sesión?', 'Cerrar sesión', 'danger');
    if (!ok) return;
    clearInterval(updateInterval);
    Object.values(timerIntervals).forEach(id => clearInterval(id));
    try {
        // POST /logout invalida el SecurityContext y la cookie de sesión
        const csrfToken = document.querySelector('meta[name="_csrf"]')?.getAttribute('content');
        const csrfHeader = document.querySelector('meta[name="_csrf_header"]')?.getAttribute('content');
        const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
        if (csrfToken && csrfHeader) headers[csrfHeader] = csrfToken;
        await fetch('/logout', { method: 'POST', headers, credentials: 'same-origin' });
    } catch (e) { /* Si falla el fetch, redirigimos igual */ }
    window.location.href = '/login';
}

function initializeMarcas() {
    const ts = document.getElementById('tipoVehiculo');
    if (ts) { ts.addEventListener('change', actualizarMarcasEntrada); actualizarMarcasEntrada(); }
}

// ==================== INDICADORES ====================
async function loadIndicadores() {
    try {
        // ✅ FIX O-01: Sin header Authorization
        const response = await fetch(`${API_BASE_URL}/indicadores`, {
            headers: { 'Content-Type': 'application/json' }
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
            'sedeNombre':          data.sedeNombre || 'Parqueadero'
        };
        Object.entries(elementos).forEach(([id, valor]) => { const el = document.getElementById(id); if (el) el.textContent = valor; });

        const tarifaDisplay = document.getElementById('tarifaDisplay');
        if (tarifaDisplay && data.tarifaPlenaC != null) {
            tarifaDisplay.innerHTML = `
                Carro plena: $${formatNumber(data.tarifaPlenaC)}<br>
                Carro/min: $${formatNumber(data.tarifaMinutoC)}<br>
                Moto plena: $${formatNumber(data.tarifaPlenaM)}<br>
                Moto/min: $${formatNumber(data.tarifaMinutoM)}`;
        }

        const card = document.getElementById('cardOcupacion');
        if (card) {
            if      (data.porcentajeOcupacion >= 90) card.style.backgroundColor = '#fecaca';
            else if (data.porcentajeOcupacion >= 70) card.style.backgroundColor = '#fef08a';
            else                                     card.style.backgroundColor = '#d0e8f2';
        }
    } catch (error) { console.error('Error indicadores:', error); }
}

// ==================== FORMULARIO ENTRADA ====================
function initializeFormularioEntrada() {
    const form = document.getElementById('registroEntradaForm');
    if (form) {
        form.addEventListener('submit', async e => { e.preventDefault(); await registrarEntradaDirecto(); });
        ['nombre','telefono','correo','cedula','placa','tipoVehiculo','marca'].forEach(campoId => {
            const campo = document.getElementById(campoId);
            if (campo) {
                campo.addEventListener('blur',  () => validateFieldEntrada(campoId));
                campo.addEventListener('input', () => { const err = document.getElementById(`${campoId}-error`); if (err && campo.value.trim()) { err.textContent = ''; campo.classList.remove('border-red-500'); } });
            }
        });
        const tel   = document.getElementById('telefono'); if (tel)   tel.addEventListener('input',   e => { e.target.value = e.target.value.replace(/[^0-9]/g,'').slice(0,10); });
        const ced   = document.getElementById('cedula');   if (ced)   ced.addEventListener('input',   e => { e.target.value = e.target.value.replace(/[^0-9]/g,'').slice(0,10); });
        const placa = document.getElementById('placa');    if (placa) placa.addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').substring(0,6); });
        const tv    = document.getElementById('tipoVehiculo'); if (tv) tv.addEventListener('change', () => { actualizarMarcasEntrada(); validateFieldEntrada('tipoVehiculo'); });
        const mk    = document.getElementById('marca');    if (mk) mk.addEventListener('change', () => validateFieldEntrada('marca'));
    }
    const buscar = document.getElementById('buscarPlaca');
    if (buscar) {
        buscar.addEventListener('input',    e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''); });
        buscar.addEventListener('keypress', e => { if (e.key === 'Enter') { e.preventDefault(); buscarPorPlacaIntegrado(); } });
    }
}

async function registrarEntradaDirecto() {
    if (!validateFormularioEntrada()) { showNotification('❌ Completa todos los campos correctamente', 'error'); return; }
    try {
        showNotification('⏳ Registrando entrada...', 'info');
        const datos = { clienteNombre: getInputValue('nombre'), clienteTelefono: getInputValue('telefono'), clienteEmail: getInputValue('correo'), clienteCedula: getInputValue('cedula'), vehiculoPlaca: getInputValue('placa'), vehiculoTipo: getInputValue('tipoVehiculo'), vehiculoMarca: getInputValue('marca'), vehiculoColor: getInputValue('color') || 'NO ESPECIFICADO', vehiculoAnio: getInputValue('anio') || '2020' };
        // ✅ FIX O-01: Sin header Authorization
        const response = await fetch(REGISTRO_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) });
        if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Error al registrar entrada'); }
        showNotification('✅ Entrada registrada. Timer iniciado ⏱️', 'success');
        limpiarFormularioEntrada();
        setTimeout(() => { loadVehiculosActivos(); loadIndicadores(); }, 500);
    } catch (error) { showNotification('❌ ' + error.message, 'error'); }
}

async function buscarPorPlacaIntegrado() {
    const placa = getInputValue('buscarPlaca');
    if (!placa || placa.length < 5) { showNotification('⚠️ Ingrese una placa válida', 'warning'); return; }
    try {
        const response = await fetch(`${API_BASE_URL}/buscar-por-placa/${placa}`, { headers: { 'Content-Type': 'application/json' } });
        if (!response.ok) throw new Error('Error');
        const data = await response.json();
        if (data.encontrado) {
            setInputValue('nombre',   data.cliente.nombre);   setInputValue('telefono', data.cliente.telefono);
            setInputValue('correo',   data.cliente.email);    setInputValue('cedula',   data.cliente.cedula || '');
            setInputValue('placa',    data.vehiculo.placa);   setInputValue('color',    data.vehiculo.color);
            const ts = document.getElementById('tipoVehiculo');
            if (ts) { ts.value = data.vehiculo.tipo; actualizarMarcasEntrada(); setTimeout(() => { const ms = document.getElementById('marca'); if (ms) ms.value = data.vehiculo.marca; }, 100); }
            if (data.vehiculo.anio) setInputValue('anio', data.vehiculo.anio);
            showNotification('✅ Vehículo encontrado', 'success');
        } else { limpiarFormularioEntrada(); setInputValue('placa', placa); showNotification('ℹ️ Vehículo nuevo. Complete los datos.', 'info'); }
    } catch (error) { showNotification('❌ Error al buscar', 'error'); }
}

// ==================== VEHÍCULOS ACTIVOS ====================
async function loadVehiculosActivos() {
    try {
        const response = await fetch(`${API_BASE_URL}/vehiculos-activos`, { headers: { 'Content-Type': 'application/json' } });
        if (!response.ok) throw new Error('Error');
        const vehiculos = await response.json();
        const tbody = document.getElementById('vehiculosActivosBody');
        if (!tbody) return;
        Object.values(timerIntervals).forEach(id => clearInterval(id));
        timerIntervals = {};
        if (vehiculos.length === 0) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No hay vehículos en el parqueadero</td></tr>'; return; }
        tbody.innerHTML = vehiculos.map(v => `
            <tr>
                <td><strong>${v.placa}</strong></td><td>${v.tipoVehiculo}</td>
                <td>${v.clienteNombre}</td><td>${v.clienteTelefono}</td>
                <td>${formatDateTime(v.horaEntrada)}</td>
                <td><span class="tiempo-activo" id="timer-${v.registroId}">${v.tiempoTranscurrido}</span></td>
                <td><div style="font-size:0.85rem;"><div><strong>Plena:</strong> $${formatNumber(v.cobroEstimadoPlena)}</div><div style="color:#059669;"><strong>Minuto:</strong> $${formatNumber(v.cobroEstimadoMinuto)}</div></div></td>
                <td><button class="trab-btn-warning btn-salida" data-id="${v.registroId}">🚪 Salida</button></td>
            </tr>`).join('');
        vehiculos.forEach(v => {
            const el = document.getElementById(`timer-${v.registroId}`); if (!el) return;
            let secs = v.segundosTranscurridos;
            timerIntervals[v.registroId] = setInterval(() => {
                secs++;
                const h = Math.floor(secs/3600), m = Math.floor((secs%3600)/60), s = secs%60;
                el.textContent = h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;
            }, 1000);
        });
    } catch (error) { showNotification('Error al cargar vehículos activos', 'error'); }
}

// ==================== MODAL SALIDA ====================
async function abrirModalSalida(registroId) {
    const modal = document.getElementById('salidaModal');
    if (!modal) { showNotification('❌ Error: Modal no encontrado', 'error'); return; }
    try {
        currentSalidaRegistroId = registroId;
        const response = await fetch(`${API_BASE_URL}/vehiculos-activos`, { headers: { 'Content-Type': 'application/json' } });
        if (!response.ok) throw new Error('Error al obtener datos');
        const vehiculos = await response.json();
        const v = vehiculos.find(v => v.registroId === registroId);
        if (!v) { showNotification('❌ Vehículo no encontrado', 'error'); return; }
        document.getElementById('salidaPlaca').textContent       = v.placa;
        document.getElementById('salidaCliente').textContent     = v.clienteNombre;
        document.getElementById('salidaHoraEntrada').textContent = formatDateTime(v.horaEntrada);
        document.getElementById('salidaTiempo').textContent      = v.tiempoTranscurrido;
        document.getElementById('salidaCobroEstimado').textContent = formatNumber(v.cobroEstimadoPlena);
        modal.classList.add('show');
    } catch (error) { showNotification('❌ Error al abrir modal', 'error'); }
}

function cerrarModalSalida() {
    const modal = document.getElementById('salidaModal');
    if (modal) modal.classList.remove('show');
    currentSalidaRegistroId = null;
}

async function confirmarSalida() {
    if (!currentSalidaRegistroId) return;
    try {
        showNotification('⏳ Registrando salida...', 'info');
        const response = await fetch(`${API_BASE_URL}/registrar-salida/${currentSalidaRegistroId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Error'); }
        showNotification('✅ Salida registrada. Proceda a cobrar.', 'success');
        cerrarModalSalida(); await loadVehiculosActivos(); await loadPendientesCobro(); await loadIndicadores();
    } catch (error) { showNotification('❌ ' + error.message, 'error'); }
}

// ==================== PENDIENTES COBRO ====================
async function loadPendientesCobro() {
    try {
        const response = await fetch(`${API_BASE_URL}/vehiculos-pendientes-cobro`, { headers: { 'Content-Type': 'application/json' } });
        if (!response.ok) throw new Error('Error');
        const pendientes = await response.json();
        const tbody = document.getElementById('pendientesCobroBody');
        if (!tbody) return;
        if (pendientes.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No hay pendientes</td></tr>'; return; }
        tbody.innerHTML = pendientes.map(p => `
            <tr>
                <td><strong>${p.placa}</strong></td><td>${p.clienteNombre}</td>
                <td>${formatDateTime(p.horaEntrada)}</td><td>${formatDateTime(p.horaSalida)}</td>
                <td>${p.tiempoTotal}</td>
                <td style="font-weight:700;color:#059669;">$${formatNumber(p.precio)}</td>
                <td><button class="trab-btn-success btn-cobrar" data-id="${p.registroId}">💰 Cobrar</button></td>
            </tr>`).join('');
    } catch (error) { console.error('Error pendientes:', error); }
}

// ==================== MODAL COBRO ====================
async function abrirModalCobro(registroId) {
    currentCobroRegistroId = registroId;
    const modal = document.getElementById('cobroModal');
    if (!modal) return;
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    try {
        const response = await fetch(`${API_BASE_URL}/opciones-cobro/${registroId}`, { headers: { 'Content-Type': 'application/json' } });
        if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Error'); }
        const data = await response.json();
        opcionesTarifa = data;
        document.getElementById('cobroCliente').textContent = data.clienteNombre;
        document.getElementById('cobroPlaca').textContent   = data.placa;
        document.getElementById('cobroTiempo').textContent  = data.tiempoTotal;
        const existing = document.getElementById('tarifaSelector');
        if (existing) existing.remove();
        const selectorHTML = `<div id="tarifaSelector" style="margin:1.5rem 0;padding:1rem;background:#f0f9ff;border-radius:0.5rem;"><h3 style="margin-bottom:1rem;color:#0369a1;">💰 Seleccione tarifa:</h3>${data.opciones.map((op,i) => `<label style="display:block;padding:1rem;margin-bottom:.75rem;background:white;border:2px solid #3b82f6;border-radius:.5rem;cursor:pointer;"><input type="radio" name="tipoTarifa" value="${op.tipo}" ${i===0?'checked':''} onchange="actualizarPrecioCobro('${op.tipo}',${op.precio})"><strong> ${op.nombre}</strong><div style="color:#059669;font-weight:700;margin-top:0.25rem;">$${formatNumber(op.precio)} COP</div><div style="font-size:0.8rem;color:#64748b;">${op.descripcion}</div></label>`).join('')}</div>`;
        const modalBody = document.querySelector('#cobroModal .trab-modal-content > div:nth-child(2)');
        if (modalBody) modalBody.insertAdjacentHTML('beforeend', selectorHTML);
        document.getElementById('cobroPrecio').textContent = formatNumber(data.opciones[0].precio);
    } catch (error) { showNotification('❌ ' + error.message, 'error'); }
}

function actualizarPrecioCobro(tipo, precio) { document.getElementById('cobroPrecio').textContent = formatNumber(precio); }

function cerrarModalCobro() {
    const modal = document.getElementById('cobroModal');
    if (modal) { modal.classList.remove('show'); document.body.style.overflow = 'auto'; }
    currentCobroRegistroId = null; opcionesTarifa = null;
    const sel = document.getElementById('tarifaSelector'); if (sel) sel.remove();
}

async function procesarCobro() {
    if (!currentCobroRegistroId) return;
    try {
        const metodoPago = document.getElementById('metodoPago').value;
        const tipoTarifa = document.querySelector('input[name="tipoTarifa"]:checked');
        if (!tipoTarifa) { showNotification('⚠️ Seleccione una tarifa', 'warning'); return; }
        showNotification('⏳ Procesando cobro...', 'info');
        const response = await fetch(`${API_BASE_URL}/confirmar-cobro/${currentCobroRegistroId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ metodoPago, tipoTarifa: tipoTarifa.value }) });
        if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Error'); }
        const data = await response.json();
        showNotification(`✅ Cobro: $${formatNumber(data.precio)} - ${data.tipoTarifaAplicada}`, 'success');
        cerrarModalCobro(); await loadPendientesCobro(); await loadIndicadores();
    } catch (error) { showNotification('❌ ' + error.message, 'error'); }
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
        const response = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
        if (!response.ok) throw new Error('Error');
        const registros = await response.json();
        const tbody = document.getElementById('historialBody');
        if (!tbody) return;
        if (registros.length === 0) { tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Sin registros</td></tr>'; return; }
        tbody.innerHTML = registros.map(r => {
            let badge = r.estado==='ACTIVO'?'<span class="trab-badge trab-badge-info">Activo</span>':r.estado==='FINALIZADO'?'<span class="trab-badge trab-badge-warning">Pendiente</span>':r.estado==='COBRADO'?'<span class="trab-badge trab-badge-success">Cobrado</span>':'<span class="trab-badge trab-badge-danger">Cancelado</span>';
            return `<tr><td><strong>${r.placa}</strong></td><td>${r.tipoVehiculo}</td><td>${r.clienteNombre}</td><td>${r.clienteTelefono}</td><td>${formatDateTime(r.horaEntrada)}</td><td>${r.horaSalida?formatDateTime(r.horaSalida):'-'}</td><td>${r.tiempoTotal}</td><td>${r.precio?'$'+formatNumber(r.precio):'-'}</td><td>${badge}</td></tr>`;
        }).join('');
    } catch (error) { console.error('Error historial:', error); }
}

// ==================== RESERVACIONES ====================
async function loadReservaciones() {
    try {
        const response = await fetch(`${API_BASE_URL}/reservaciones`, { headers: { 'Content-Type': 'application/json' } });
        if (!response.ok) throw new Error('Error');
        const reservas = await response.json();
        const tbody = document.getElementById('reservacionesBody');
        if (!tbody) return;
        if (reservas.length === 0) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Sin reservaciones</td></tr>'; return; }
        tbody.innerHTML = reservas.map(r => `
            <tr>
                <td>${r.clienteNombre}</td><td>${r.clienteTelefono}</td>
                <td><strong>${r.placa}</strong></td><td>${r.tipoVehiculo}</td>
                <td>${formatDateTime(r.horaInicio)}</td><td>${formatDateTime(r.horaFin)}</td>
                <td><span class="trab-badge trab-badge-info">${r.cupo}</span></td>
                <td>
                    <button class="trab-btn-success btn-aceptar"  data-id="${r.id}">Aceptar</button>
                    <button class="trab-btn-danger  btn-rechazar" data-id="${r.id}">Rechazar</button>
                </td>
            </tr>`).join('');
    } catch (error) { console.error('Error reservaciones:', error); }
}

// ✅ FIX O-03: confirm() nativo reemplazado por showConfirm()
async function aceptarReservacion(id) {
    const ok = await showConfirm('Aceptar reservación', '¿Confirmas que deseas aceptar esta reservación?', 'Aceptar', 'warning');
    if (!ok) return;
    try {
        await fetch(`${API_BASE_URL}/aceptar-reservacion/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        showNotification('✅ Reservación aceptada', 'success');
        await loadReservaciones(); await loadVehiculosActivos(); await loadIndicadores();
    } catch (error) { showNotification('❌ Error', 'error'); }
}

async function rechazarReservacion(id) {
    const ok = await showConfirm('Rechazar reservación', '¿Confirmas que deseas rechazar esta reservación?', 'Rechazar', 'danger');
    if (!ok) return;
    try {
        const response = await fetch(`${API_BASE_URL}/rechazar-reservacion/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        if (!response.ok) throw new Error('Error');
        showNotification('✅ Reservación rechazada', 'success'); await loadReservaciones();
    } catch (error) { showNotification('❌ Error', 'error'); }
}

// ==================== PLANTILLAS EXCEL ====================
function descargarPlantillaCompleta() {
    if (typeof XLSX === 'undefined') { showNotification('❌ Error: Librería XLSX no está cargada.', 'error'); return; }
    const wb = XLSX.utils.book_new();
    const wsDatos = XLSX.utils.aoa_to_sheet([
        ['Tipo','Dato1','Dato2','Dato3','Dato4','Dato5','Dato6'],
        ['Cliente','Juan Pérez Ejemplo','3001234589','juan.perez.nuevo@gmail.com','1234567899','',''],
        ['Cliente','María González Ejemplo','3007654321','maria.gonzalez.nueva@gmail.com','0987654322','',''],
        ['Vehiculo','ABC123','CARRO','TOYOTA','Blanco','2020','juan.perez.nuevo@gmail.com'],
        ['Vehiculo','XYZ789','MOTO','HONDA','Negro','2021','maria.gonzalez.nueva@gmail.com']
    ]);
    wsDatos['!cols'] = [{wch:10},{wch:25},{wch:15},{wch:30},{wch:15},{wch:10},{wch:30}];
    XLSX.utils.book_append_sheet(wb, wsDatos, 'Datos');
    const wsInst = XLSX.utils.aoa_to_sheet([
        ['INSTRUCCIONES PARA LA CARGA MASIVA'],[''],
        ['IMPORTANTE: Todo debe estar en UNA SOLA HOJA llamada "Datos"'],[''],
        ['FORMATO DE CLIENTES:'],['Columnas: Tipo | Nombre | Teléfono | Email | Cédula'],[''],
        ['FORMATO DE VEHÍCULOS:'],['Columnas: Tipo | Placa | TipoVeh | Marca | Color | Año | EmailCliente'],[''],
        ['TIPOS DE VEHÍCULO VÁLIDOS: CARRO, MOTO, BICICLETA, OTRO']
    ]);
    wsInst['!cols'] = [{wch:80}];
    XLSX.utils.book_append_sheet(wb, wsInst, 'Instrucciones');
    XLSX.writeFile(wb, 'Plantilla_Carga_Masiva_Completa.xlsx');
    showNotification('✅ Plantilla completa descargada', 'success');
}

function descargarPlantillaVehiculosSolo() {
    if (typeof XLSX === 'undefined') { showNotification('❌ Error: Librería XLSX no está cargada.', 'error'); return; }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
        ['Tipo','Placa','Tipo Vehículo','Marca','Color','Año','Email Cliente'],
        ['Vehiculo','ABC123','CARRO','TOYOTA','Blanco','2020','cliente1@gmail.com'],
        ['Vehiculo','XYZ789','MOTO','HONDA','Negro','2021','cliente2@gmail.com']
    ]);
    ws['!cols'] = [{wch:10},{wch:10},{wch:15},{wch:12},{wch:10},{wch:8},{wch:28}];
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    XLSX.writeFile(wb, 'Plantilla_Vehiculos.xlsx');
    showNotification('✅ Plantilla de vehículos descargada', 'success');
}

function mostrarArchivoSeleccionado() {
    const fi = document.getElementById('excelFile'), info = document.getElementById('archivoSeleccionado');
    if (fi?.files[0]) { const f = fi.files[0]; info.innerHTML = `📎 <strong>${f.name}</strong> (${(f.size/1024).toFixed(2)} KB)`; info.style.color = '#059669'; } else info.innerHTML = '';
}

// ==================== CARGA MASIVA ====================
async function cargarExcel() {
    const fileInput = document.getElementById('excelFile');
    const file = fileInput?.files[0];
    if (!file) { showNotification('⚠️ Por favor seleccione un archivo Excel', 'warning'); return; }
    if (!['xlsx','xls'].includes(file.name.split('.').pop().toLowerCase())) { showNotification('⚠️ El archivo debe ser formato Excel (.xlsx o .xls)', 'warning'); return; }
    try {
        const pc = document.getElementById('progressContainer'), pb = document.getElementById('progressBar'), pt = document.getElementById('progressText');
        if (pc) { pc.style.display='block'; pb.style.width='30%'; pb.textContent='30%'; pt.textContent='Subiendo archivo...'; }
        const formData = new FormData(); formData.append('file', file);
        // ✅ FIX O-01: Sin header Authorization
        const response = await fetch(`${API_BASE_URL}/carga-masiva`, { method: 'POST', body: formData });
        if (pb) { pb.style.width='70%'; pb.textContent='70%'; pt.textContent='Procesando datos...'; }
        if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || 'Error al procesar el archivo'); }
        const data = await response.json();
        if (pb) { pb.style.width='100%'; pb.textContent='100%'; pt.textContent='✅ Completado'; }
        mostrarResultadosCarga(data);
        showNotification(data.tieneErrores ? `⚠️ Carga con ${data.errores.length} error(es). Total: ${data.totalRegistros||0}` : `✅ Carga exitosa: ${data.totalRegistros||0} registros`, data.tieneErrores ? 'warning' : 'success');
        fileInput.value = ''; document.getElementById('archivoSeleccionado').innerHTML = '';
        setTimeout(() => { if (pc) pc.style.display='none'; }, 2000);
    } catch (error) { showNotification(`❌ Error: ${error.message}`, 'error'); const pc = document.getElementById('progressContainer'); if (pc) pc.style.display='none'; }
}

function mostrarResultadosCarga(data) {
    const rd = document.getElementById('resultadosCarga'); if (rd) rd.style.display = 'block';
    const resumen = document.getElementById('resumenCarga');
    if (resumen) resumen.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;"><div style="background:linear-gradient(135deg,#d1fae5,#a7f3d0);padding:1.5rem;border-radius:0.75rem;text-align:center;"><div style="font-size:2rem;font-weight:700;color:#065f46;">${data.clientesRegistrados||0}</div><div style="font-size:0.9rem;color:#047857;font-weight:600;">Clientes Registrados</div></div><div style="background:linear-gradient(135deg,#dbeafe,#bfdbfe);padding:1.5rem;border-radius:0.75rem;text-align:center;"><div style="font-size:2rem;font-weight:700;color:#1e40af;">${data.vehiculosRegistrados||0}</div><div style="font-size:0.9rem;color:#1e3a8a;font-weight:600;">Vehículos Registrados</div></div><div style="background:linear-gradient(135deg,#e0e7ff,#c7d2fe);padding:1.5rem;border-radius:0.75rem;text-align:center;"><div style="font-size:2rem;font-weight:700;color:#4338ca;">${data.totalRegistros||0}</div><div style="font-size:0.9rem;color:#3730a3;font-weight:600;">Total Registros</div></div></div>`;
    const ec = document.getElementById('erroresContainer'), le = document.getElementById('listaErrores');
    if (data.errores?.length > 0) { if (ec) ec.style.display='block'; if (le) le.innerHTML = data.errores.map(e => `<li>${e}</li>`).join(''); } else { if (ec) ec.style.display='none'; }
    const tbody = document.getElementById('resultadosCargaBody');
    if (tbody && data.registrosCargados) tbody.innerHTML = data.registrosCargados.map(r =>
        r.tipo==='Vehículo'||r.tipo==='Vehiculo'
            ? `<tr><td><span class="trab-badge trab-badge-info">🚗 ${r.tipo}</span></td><td><strong>${r.placa||'N/A'}</strong></td><td><strong>${r.marca||'N/A'}</strong> ${r.tipoVehiculo||''}<br><small style="color:#64748b;">Color: ${r.color||'N/A'} - Año: ${r.año||'N/A'}</small><br><small style="color:#64748b;">Propietario: ${r.propietario||'N/A'}</small></td><td><span class="trab-badge trab-badge-success">✓ Registrado</span></td></tr>`
            : r.tipo==='Cliente'
                ? `<tr><td><span class="trab-badge trab-badge-success">🧑‍💼 ${r.tipo}</span></td><td><strong>${r.nombre||'N/A'}</strong></td><td>${r.email||'N/A'}<br><small style="color:#64748b;">Tel: ${r.telefono||'N/A'} - Cédula: ${r.cedula||'N/A'}</small></td><td><span class="trab-badge trab-badge-success">✓ Registrado</span></td></tr>`
                : '').join('');
}

// ==================== DELEGACIÓN DE EVENTOS ====================
function setupGlobalEventDelegation() {
    document.body.addEventListener('click', function(e) {
        if (e.target.closest('.btn-salida'))  { e.preventDefault(); abrirModalSalida(parseInt(e.target.closest('.btn-salida').dataset.id));   return; }
        if (e.target.closest('.btn-cobrar'))  { e.preventDefault(); abrirModalCobro(parseInt(e.target.closest('.btn-cobrar').dataset.id));    return; }
        if (e.target.closest('.btn-aceptar')){ e.preventDefault(); aceptarReservacion(e.target.closest('.btn-aceptar').dataset.id);  return; }
        if (e.target.closest('.btn-rechazar')){ e.preventDefault(); rechazarReservacion(e.target.closest('.btn-rechazar').dataset.id); return; }
    });
}

// ==================== EVENTOS GLOBALES ====================
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        const cobro  = document.getElementById('cobroModal');
        const salida = document.getElementById('salidaModal');
        if (cobro  && cobro.classList.contains('show'))  cerrarModalCobro();
        if (salida && salida.classList.contains('show')) cerrarModalSalida();
    }
});

window.addEventListener('click', e => {
    const cobro  = document.getElementById('cobroModal');
    const salida = document.getElementById('salidaModal');
    if (e.target === cobro)  cerrarModalCobro();
    if (e.target === salida) cerrarModalSalida();
});

// ==================== ESTILOS ====================
function injectModalStyles() {
    if (document.getElementById('modal-styles')) return;
    const style = document.createElement('style');
    style.id = 'modal-styles';
    style.textContent = `
        @keyframes slideIn  { from{transform:translateX(400px);opacity:0;} to{transform:translateX(0);opacity:1;} }
        @keyframes slideOut { from{transform:translateX(0);opacity:1;} to{transform:translateX(400px);opacity:0;} }
        .border-red-500   { border-color:#ef4444!important;box-shadow:0 0 0 3px rgba(239,68,68,0.1); }
        .border-green-500 { border-color:#10b981!important;box-shadow:0 0 0 3px rgba(16,185,129,0.1); }
        .hidden { display:none!important; }
    `;
    document.head.appendChild(style);
}

injectModalStyles();

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
    initializeProfileMenu();
    initializeFormularioEntrada();
    initializeMarcas();
    setupGlobalEventDelegation();
    loadIndicadores();

    updateInterval = setInterval(() => {
        loadIndicadores();
        const activeTab = document.querySelector('.aparca-sidebar-nav a.active')?.getAttribute('data-tab');
        if (activeTab === 'gestion') { loadVehiculosActivos(); loadPendientesCobro(); }
    }, 30000);
});

console.log('✅ TrabajadorD.js cargado correctamente');