// ==================== CONFIGURACIÓN GLOBAL ====================
// ✅ Autenticación por sesión de Spring Security.
//    Sin header Authorization en los fetches.
const API_BASE_URL       = '/api/sede';
const API_TRABAJADOR_URL = '/api/trabajador';

let usuariosData = [];
let sedesData    = [];
let currentTab   = 'usuarios';
let currentSalidaRegistroId = null;
let currentCobroRegistroId  = null;
let opcionesTarifa  = null;
let updateInterval  = null;
let timerIntervals  = {};

const marcasPorTipo = {
    CARRO:     ["RENAULT","KIA","TOYOTA","CHEVROLET","MAZDA","NISSAN","VOLKSWAGEN","FORD","HYUNDAI","BMW","MERCEDES_BENZ","AUDI","PEUGEOT","CITROEN","FIAT","VOLVO","JEEP","LAND_ROVER","PORSCHE","FERRARI","LAMBORGHINI","TESLA","BYD","CHANGAN","GEELY","JAC","CHERY","GREAT_WALL","HAVAL","GWM","MITSUBISHI","SUBARU","ISUZU","SSANGYONG","MG","RAM","DFSK","FOTON","OTRO"],
    MOTO:      ["HONDA","YAMAHA","SUZUKI","KAWASAKI","BAJAJ","TVS","HERO","KTM","DUCATI","HARLEY_DAVIDSON","BMW_MOTORRAD","TRIUMPH","ROYAL_ENFIELD","AUTECO","AKT","VICTORY","APRILIA","BENELLI","HUSQVARNA","OTRO"],
    BICICLETA: ["TREK","SPECIALIZED","GIANT","SCOTT","CANNONDALE","ORBEA","GW","SHIMANO","BIANCHI","MERIDA","CUBE","BMC","FOCUS","OTRO"],
    OTRO:      ["OTRO"]
};

// ==================== NOTIFICACIONES ====================
function showNotification(message, type = 'info') {
    document.querySelectorAll('.toast-notification').forEach(t => t.remove());
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.style.cssText = `position:fixed;top:80px;right:20px;padding:1rem 1.5rem;border-radius:0.5rem;color:white;font-weight:600;z-index:9999;animation:aparca-slideUp 0.3s ease-out;max-width:400px;box-shadow:0 4px 12px rgba(0,0,0,0.15);`;
    const colors = { success:'#10b981', error:'#ef4444', warning:'#f59e0b', info:'#14b8a6' };
    toast.style.backgroundColor = colors[type] || colors.info;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease-in';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// ==================== MODAL CONFIRMACIÓN ====================
function showConfirm(titulo, cuerpo, btnTexto = 'Confirmar', btnColor = 'danger') {
    return new Promise(resolve => {
        let overlay = document.getElementById('confirm-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'confirm-overlay';
            overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:1rem;';
            document.body.appendChild(overlay);
        }
        const btnColors = { danger:'background:#dc2626;color:#fff', warning:'background:#f59e0b;color:#fff' };
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
        document.getElementById('confirm-ok').onclick     = () => { overlay.style.display='none'; resolve(true);  };
        document.getElementById('confirm-cancel').onclick = () => { overlay.style.display='none'; resolve(false); };
    });
}

// ==================== MODAL EDICIÓN ====================
function showEditModal(titulo, campos) {
    return new Promise(resolve => {
        let overlay = document.getElementById('edit-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'edit-overlay';
            overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:1rem;';
            document.body.appendChild(overlay);
        }
        const inputsHtml = campos.map(c => `
            <div style="margin-bottom:1rem;">
                <label style="display:block;font-size:0.875rem;font-weight:600;color:#374151;margin-bottom:0.25rem;">${c.label}</label>
                ${c.type === 'select'
            ? `<select id="edit-field-${c.key}" style="width:100%;padding:0.5rem;border:1px solid #d1d5db;border-radius:0.375rem;">
                           ${c.options.map(o => `<option value="${o}" ${o===c.value?'selected':''}>${o}</option>`).join('')}
                       </select>`
            : `<input id="edit-field-${c.key}" type="${c.type||'text'}" value="${c.value||''}"
                             style="width:100%;padding:0.5rem;border:1px solid #d1d5db;border-radius:0.375rem;">`
        }
            </div>`).join('');
        overlay.innerHTML = `
            <div role="dialog" aria-modal="true"
                 style="background:#fff;border-radius:0.75rem;padding:2rem;max-width:480px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3);max-height:90vh;overflow-y:auto;">
                <h3 style="font-size:1.125rem;font-weight:700;color:#0f172a;margin:0 0 1.5rem;">${titulo}</h3>
                ${inputsHtml}
                <div style="display:flex;justify-content:flex-end;gap:0.75rem;margin-top:1.5rem;">
                    <button id="edit-cancel" style="padding:0.5rem 1.25rem;border:1px solid #e2e8f0;border-radius:0.5rem;background:#fff;color:#374151;cursor:pointer;">Cancelar</button>
                    <button id="edit-ok" style="padding:0.5rem 1.25rem;border:none;border-radius:0.5rem;background:#0f766e;color:#fff;cursor:pointer;font-weight:600;">Guardar</button>
                </div>
            </div>`;
        overlay.style.display = 'flex';
        document.getElementById('edit-ok').onclick = () => {
            const resultado = {};
            campos.forEach(c => { resultado[c.key] = document.getElementById(`edit-field-${c.key}`).value; });
            overlay.style.display = 'none';
            resolve(resultado);
        };
        document.getElementById('edit-cancel').onclick = () => { overlay.style.display='none'; resolve(null); };
    });
}

// ==================== UTILIDADES ====================
function setInputValue(id, value) { const el=document.getElementById(id); if(el) el.value=value||''; }
function getInputValue(id)        { const el=document.getElementById(id); return el ? el.value.trim() : ''; }

function formatDateTime(dateString) {
    if (!dateString) return '-';
    try { return new Date(dateString).toLocaleString('es-CO',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}); }
    catch { return dateString; }
}

function formatNumber(number) {
    if (number==null) return '0';
    return Number(number).toLocaleString('es-CO',{minimumFractionDigits:0,maximumFractionDigits:0});
}

function formatMarcaName(marca) {
    const map={'MERCEDES_BENZ':'Mercedes-Benz','LAND_ROVER':'Land Rover','GREAT_WALL':'Great Wall','BMW_MOTORRAD':'BMW Motorrad','HARLEY_DAVIDSON':'Harley-Davidson','ROYAL_ENFIELD':'Royal Enfield'};
    return map[marca]||marca.split('_').map(w=>w.charAt(0)+w.slice(1).toLowerCase()).join(' ');
}

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', () => {
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
    updateInterval = setInterval(() => {
        const activeTab = document.querySelector('.aparca-sidebar-nav a.active')?.getAttribute('data-tab');
        if (activeTab==='gestion') { loadVehiculosActivos(); loadPendientesCobro(); }
    }, 30000);
}

// ==================== ESTADÍSTICAS / DONUTS ====================
async function cargarEstadisticas() {
    try {
        const response = await fetch(`${API_BASE_URL}/estadisticas`);
        if (!response.ok) return;
        const data = await response.json();

        const pctActivos = data.totalUsuarios > 0
            ? Math.round((data.usuariosActivos / data.totalUsuarios) * 100) : 0;
        const pctSedes   = data.capacidadTotal > 0
            ? Math.min(Math.round((data.sedesActivas/(data.totalSedes||1))*100),100) : 0;

        const segs  = document.querySelectorAll('.donut-segment');
        const texts = document.querySelectorAll('.donut-text');
        if (segs[0])  segs[0].setAttribute('stroke-dasharray', `${pctActivos} 100`);
        if (texts[0]) texts[0].textContent = `${pctActivos}%`;
        if (segs[1])  segs[1].setAttribute('stroke-dasharray', `${pctSedes} 100`);
        if (texts[1]) texts[1].textContent = `${pctSedes}%`;
    } catch(e) { console.error('Error cargando estadísticas:', e); }
}

// ==================== NAVEGACIÓN ====================
function setupEventListeners() {
    document.querySelectorAll('.aparca-sidebar-nav a').forEach(link =>
        link.addEventListener('click', handleNavigation));
    document.getElementById('btnUsuarios')?.addEventListener('click',  () => switchToTab('usuarios'));
    document.getElementById('btnSedes')?.addEventListener('click',     () => switchToTab('sedes'));
    document.getElementById('tab-mailuno')?.addEventListener('click',    () => switchMailTab('uno'));
    document.getElementById('tab-mailmasivo')?.addEventListener('click', () => switchMailTab('masivo'));
    document.getElementById('busquedaInput')?.addEventListener('input',  filtrarDatos);
    document.getElementById('filtroEstado')?.addEventListener('change',  filtrarDatos);
    document.getElementById('correoUno')?.querySelector('form')
        ?.addEventListener('submit', e => { e.preventDefault(); enviarCorreoUno(); });
    document.getElementById('correoMasivo')?.querySelector('form')
        ?.addEventListener('submit', e => { e.preventDefault(); enviarCorreoMasivo(); });
    document.getElementById('registrarTrabajadorModal')?.addEventListener('click', function(e) {
        if (e.target === this) closeRegistrarTrabajadorModal();
    });
}

function handleNavigation(e) {
    e.preventDefault();
    document.querySelectorAll('.aparca-sidebar-nav a').forEach(l => l.classList.remove('active'));
    e.currentTarget.classList.add('active');
    const tab = e.currentTarget.getAttribute('data-tab');
    document.querySelectorAll('.aparca-content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(tab)?.classList.remove('hidden');
    if (tab==='gestion')       { loadVehiculosActivos(); loadPendientesCobro(); }
    if (tab==='historial')     loadHistorial();
    if (tab==='reservaciones') loadReservaciones();
    // En mobile colapsa el sidebar para dar espacio
    if (window.innerWidth < 640) document.body.classList.add('sidebar-collapsed');
}

function switchToTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.sede-tabs button').forEach(btn => btn.classList.remove('active'));
    if (tab==='usuarios') {
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
    document.querySelectorAll('#correo .sede-tabs button').forEach(btn => btn.classList.remove('active'));
    if (tipo==='uno') {
        document.getElementById('tab-mailuno').classList.add('active');
        document.getElementById('correoUno').removeAttribute('hidden');
        document.getElementById('correoMasivo').setAttribute('hidden','');
    } else {
        document.getElementById('tab-mailmasivo').classList.add('active');
        document.getElementById('correoUno').setAttribute('hidden','');
        document.getElementById('correoMasivo').removeAttribute('hidden');
    }
}

// ==================== CARGA DE DATOS ====================
async function cargarUsuarios() {
    try {
        const response = await fetch(`${API_BASE_URL}/usuarios`);
        if (response.ok) { usuariosData = await response.json(); mostrarUsuarios(usuariosData); }
        else showNotification('No se pudieron cargar los usuarios','error');
    } catch (e) { showNotification('Error de conexión al cargar usuarios','error'); }
}

async function cargarSedes() {
    try {
        const response = await fetch(`${API_BASE_URL}/sedes`);
        if (response.ok) { sedesData = await response.json(); mostrarSedes(sedesData); }
        else showNotification('No se pudieron cargar las sedes','error');
    } catch (e) { showNotification('Error de conexión al cargar sedes','error'); }
}

// ==================== VISUALIZACIÓN ====================
function mostrarUsuarios(usuarios) {
    const tbody = document.getElementById('usuariosTableBody');
    if (!tbody) return;
    if (usuarios.length===0) { tbody.innerHTML='<tr><td colspan="5" style="text-align:center;color:#64748b;">No hay clientes registrados</td></tr>'; return; }
    tbody.innerHTML = usuarios.map(u => `
        <tr>
            <td>${u.nombre||'N/A'}</td>
            <td>${u.correo||'N/A'}</td>
            <td><span class="sede-badge sede-badge-info">${u.rol||'N/A'}</span></td>
            <td><span class="sede-badge ${u.estado==='ACTIVO'?'sede-badge-success':'sede-badge-danger'}">${u.estado||'N/A'}</span></td>
            <td>
                <button class="sede-btn-icon sede-btn-edit"   onclick="editarUsuario(${u.id})"   title="Editar">✏️</button>
                <button class="sede-btn-icon sede-btn-delete" onclick="eliminarUsuario(${u.id})" title="Eliminar">🗑️</button>
            </td>
        </tr>`).join('');
}

function mostrarSedes(sedes) {
    const tbody = document.getElementById('sedesTableBody');
    if (!tbody) return;
    if (sedes.length===0) { tbody.innerHTML='<tr><td colspan="5" style="text-align:center;color:#64748b;">No tiene sede asignada</td></tr>'; return; }
    tbody.innerHTML = sedes.map(s => `
        <tr>
            <td>${s.nombre||'N/A'}</td>
            <td>${s.direccion||'N/A'}</td>
            <td>${s.capacidad||0}</td>
            <td><span class="sede-badge ${s.estado==='ACTIVO'?'sede-badge-success':'sede-badge-danger'}">${s.estado||'N/A'}</span></td>
            <td><button class="sede-btn-icon sede-btn-edit" onclick="editarSede(${s.id})" title="Editar">✏️</button></td>
        </tr>`).join('');
}

// ==================== FILTRADO ====================
function filtrarDatos() {
    const busqueda = document.getElementById('busquedaInput')?.value.toLowerCase()||'';
    const estado   = document.getElementById('filtroEstado')?.value.toLowerCase()||'';
    if (currentTab==='usuarios') {
        mostrarUsuarios(usuariosData.filter(u => {
            const matchB = !busqueda||[u.nombre,u.correo,u.rol].some(v=>v?.toLowerCase().includes(busqueda));
            const matchE = !estado  ||u.estado?.toLowerCase()===estado;
            return matchB && matchE;
        }));
    } else {
        mostrarSedes(sedesData.filter(s => {
            const matchB = !busqueda||[s.nombre,s.direccion].some(v=>v?.toLowerCase().includes(busqueda));
            const matchE = !estado  ||s.estado?.toLowerCase()===estado;
            return matchB && matchE;
        }));
    }
}

// ==================== MARCAS ====================
function actualizarMarcasEntrada() {
    const tipoSelect=document.getElementById('tipoVehiculo'), marcaSelect=document.getElementById('marca');
    if (!tipoSelect||!marcaSelect) return;
    const tipo=tipoSelect.value;
    marcaSelect.innerHTML='<option value="">Selecciona una marca</option>';
    if (tipo&&marcasPorTipo[tipo]) {
        marcasPorTipo[tipo].forEach(marca => {
            const opt=document.createElement('option');
            opt.value=marca; opt.textContent=formatMarcaName(marca);
            marcaSelect.appendChild(opt);
        });
    }
}

function initializeMarcas() {
    const tipoSelect=document.getElementById('tipoVehiculo');
    if (tipoSelect) { tipoSelect.addEventListener('change',actualizarMarcasEntrada); actualizarMarcasEntrada(); }
}

// ==================== VALIDACIÓN ====================
function validateFieldEntrada(fieldId) {
    const field=document.getElementById(fieldId), errorSpan=document.getElementById(`${fieldId}-error`);
    if (!field) return true;
    let isValid=true, message='';
    const value=field.value.trim();
    switch(fieldId) {
        case 'nombre':       if (!value){isValid=false;message='El nombre es obligatorio.';}else if(value.length<2){isValid=false;message='Al menos 2 caracteres.';} break;
        case 'correo1':      if (!value){isValid=false;message='El correo es obligatorio.';}else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)){isValid=false;message='Formato inválido.';} break;
        case 'telefono':     if (!value){isValid=false;message='El teléfono es obligatorio.';}else if(!/^[0-9]{10}$/.test(value)){isValid=false;message='Debe tener 10 dígitos.';} break;
        case 'cedula':       if (!value){isValid=false;message='La cédula es obligatoria.';}else if(!/^[0-9]{10}$/.test(value)){isValid=false;message='Debe tener 10 dígitos.';} break;
        case 'placa':        if (!value){isValid=false;message='La placa es obligatoria.';}else if(!/^[A-Z]{3}[0-9]{3}$/.test(value)){isValid=false;message='Formato: ABC123';} break;
        case 'tipoVehiculo': if (!value){isValid=false;message='Selecciona el tipo.';} break;
        case 'marca':        if (!value){isValid=false;message='Selecciona la marca.';} break;
    }
    if (errorSpan) errorSpan.textContent=isValid?'':message;
    field.classList.toggle('border-red-500',  !isValid);
    field.classList.toggle('border-green-500', isValid && value!=='');
    return isValid;
}

function validateFormularioEntrada() {
    return ['nombre','correo1','telefono','cedula','placa','tipoVehiculo','marca']
        .map(c=>validateFieldEntrada(c)).every(v=>v);
}

function limpiarFormularioEntrada() {
    ['nombre','telefono','correo1','cedula','placa','color','anio','buscarPlaca'].forEach(id=>setInputValue(id,''));
    const t=document.getElementById('tipoVehiculo'); if(t) t.value='';
    const m=document.getElementById('marca'); if(m) m.innerHTML='<option value="">Selecciona una marca</option>';
    ['nombre','correo1','telefono','cedula','placa','tipoVehiculo','marca'].forEach(fId=>{
        const err=document.getElementById(`${fId}-error`); if(err) err.textContent='';
        const f=document.getElementById(fId); if(f) f.classList.remove('border-red-500','border-green-500');
    });
}

// ==================== FORMULARIO ENTRADA ====================
function initializeFormularioEntrada() {
    const form=document.getElementById('registroEntradaForm');
    if (form) {
        form.addEventListener('submit', async e=>{ e.preventDefault(); await registrarEntradaDirecto(); });
        ['nombre','telefono','correo1','cedula','placa','tipoVehiculo','marca'].forEach(campoId=>{
            const campo=document.getElementById(campoId);
            if (campo) {
                campo.addEventListener('blur',  ()=>validateFieldEntrada(campoId));
                campo.addEventListener('input', ()=>{ const err=document.getElementById(`${campoId}-error`); if(err&&campo.value.trim()){err.textContent='';campo.classList.remove('border-red-500');} });
            }
        });
        const tel=document.getElementById('telefono'); if(tel) tel.addEventListener('input',e=>{e.target.value=e.target.value.replace(/[^0-9]/g,'').slice(0,10);});
        const ced=document.getElementById('cedula');   if(ced) ced.addEventListener('input',e=>{e.target.value=e.target.value.replace(/[^0-9]/g,'').slice(0,10);});
        const plc=document.getElementById('placa');    if(plc) plc.addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').substring(0,6);});
    }
    const buscar=document.getElementById('buscarPlaca');
    if (buscar) {
        buscar.addEventListener('input',   e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'');});
        buscar.addEventListener('keypress',e=>{if(e.key==='Enter'){e.preventDefault();buscarPorPlacaIntegrado();}});
    }
}

async function registrarEntradaDirecto() {
    if (!validateFormularioEntrada()) { showNotification('❌ Completa todos los campos correctamente','error'); return; }
    try {
        showNotification('⏳ Registrando entrada...','info');
        const datos={clienteNombre:getInputValue('nombre'),clienteTelefono:getInputValue('telefono'),clienteEmail:getInputValue('correo1'),clienteCedula:getInputValue('cedula'),vehiculoPlaca:getInputValue('placa'),vehiculoTipo:getInputValue('tipoVehiculo'),vehiculoMarca:getInputValue('marca'),vehiculoColor:getInputValue('color')||'NO ESPECIFICADO',vehiculoAnio:getInputValue('anio')||'2020'};
        const response=await fetch(`${API_TRABAJADOR_URL}/registrar-entrada`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(datos)});
        if (!response.ok) { const err=await response.json(); throw new Error(err.error||'Error al registrar entrada'); }
        showNotification('✅ Entrada registrada. Timer iniciado ⏱️','success');
        limpiarFormularioEntrada();
        setTimeout(()=>loadVehiculosActivos(),500);
    } catch(error) { showNotification('❌ '+error.message,'error'); }
}

async function buscarPorPlacaIntegrado() {
    const placa=getInputValue('buscarPlaca');
    if (!placa||placa.length<5) { showNotification('⚠️ Ingrese una placa válida','warning'); return; }
    try {
        const response=await fetch(`${API_TRABAJADOR_URL}/buscar-por-placa/${placa}`,{headers:{'Content-Type':'application/json'}});
        if (!response.ok) throw new Error('Error');
        const data=await response.json();
        if (data.encontrado) {
            setInputValue('nombre',data.cliente.nombre); setInputValue('telefono',data.cliente.telefono);
            setInputValue('correo1',data.cliente.email); setInputValue('cedula',data.cliente.cedula||'');
            setInputValue('placa',data.vehiculo.placa); setInputValue('color',data.vehiculo.color);
            const tipoSelect=document.getElementById('tipoVehiculo');
            if (tipoSelect) { tipoSelect.value=data.vehiculo.tipo; actualizarMarcasEntrada(); setTimeout(()=>{ const m=document.getElementById('marca'); if(m) m.value=data.vehiculo.marca; },100); }
            if (data.vehiculo.anio) setInputValue('anio',data.vehiculo.anio);
            showNotification('✅ Vehículo encontrado','success');
        } else { limpiarFormularioEntrada(); setInputValue('placa',placa); showNotification('ℹ️ Vehículo nuevo. Complete los datos.','info'); }
    } catch (e) { showNotification('❌ Error al buscar','error'); }
}

// ==================== VEHÍCULOS ACTIVOS ====================
async function loadVehiculosActivos() {
    try {
        const response=await fetch(`${API_TRABAJADOR_URL}/vehiculos-activos`,{headers:{'Content-Type':'application/json'}});
        if (!response.ok) throw new Error('Error');
        const vehiculos=await response.json();
        const tbody=document.getElementById('vehiculosActivosBody');
        if (!tbody) return;
        Object.values(timerIntervals).forEach(id=>clearInterval(id));
        timerIntervals={};
        if (vehiculos.length===0) { tbody.innerHTML='<tr><td colspan="8" style="text-align:center;">No hay vehículos en el parqueadero</td></tr>'; return; }
        tbody.innerHTML=vehiculos.map(v=>`
            <tr>
                <td><strong>${v.placa}</strong></td><td>${v.tipoVehiculo}</td>
                <td>${v.clienteNombre}</td><td>${v.clienteTelefono}</td>
                <td>${formatDateTime(v.horaEntrada)}</td>
                <td><span class="tiempo-activo" id="timer-${v.registroId}">${v.tiempoTranscurrido}</span></td>
                <td><div style="font-size:0.85rem;"><div><strong>Plena:</strong> $${formatNumber(v.cobroEstimadoPlena)}</div><div style="color:#059669;"><strong>Minuto:</strong> $${formatNumber(v.cobroEstimadoMinuto)}</div></div></td>
                <td><button class="sede-btn-warning sede-btn-salida" data-id="${v.registroId}">🚪 Salida</button></td>
            </tr>`).join('');
        vehiculos.forEach(v=>{
            const el=document.getElementById(`timer-${v.registroId}`); if(!el) return;
            let secs=v.segundosTranscurridos;
            timerIntervals[v.registroId]=setInterval(()=>{
                secs++; const h=Math.floor(secs/3600),m=Math.floor((secs%3600)/60),s=secs%60;
                el.textContent=h>0?`${h}h ${m}m ${s}s`:m>0?`${m}m ${s}s`:`${s}s`;
            },1000);
        });
    } catch (e) { showNotification('Error al cargar vehículos activos','error'); }
}

// ==================== MODAL SALIDA ====================
async function abrirModalSalida(registroId) {
    const modal=document.getElementById('salidaModal');
    if (!modal) { showNotification('❌ Error: Modal no encontrado','error'); return; }
    try {
        currentSalidaRegistroId=registroId;
        const response=await fetch(`${API_TRABAJADOR_URL}/vehiculos-activos`,{headers:{'Content-Type':'application/json'}});
        if (!response.ok) throw new Error('Error al obtener datos');
        const vehiculos=await response.json();
        const v=vehiculos.find(v=>v.registroId===registroId);
        if (!v) { showNotification('❌ Vehículo no encontrado','error'); return; }
        document.getElementById('salidaPlaca').textContent       = v.placa;
        document.getElementById('salidaCliente').textContent     = v.clienteNombre;
        document.getElementById('salidaHoraEntrada').textContent = formatDateTime(v.horaEntrada);
        document.getElementById('salidaTiempo').textContent      = v.tiempoTranscurrido;
        document.getElementById('salidaCobroEstimado').innerHTML = `<div class="sede-modal-salida-row"><strong>Plena:</strong><span>$${formatNumber(v.cobroEstimadoPlena)}</span></div><div class="sede-modal-salida-row" style="color:#059669;"><strong>Minuto:</strong><span>$${formatNumber(v.cobroEstimadoMinuto)}</span></div>`;
        modal.style.display='block'; modal.style.visibility='visible'; modal.style.opacity='1';
        modal.setAttribute('aria-hidden','false');
    } catch (e) { showNotification('❌ Error al abrir modal','error'); }
}

function cerrarModalSalida() {
    const modal=document.getElementById('salidaModal');
    if (modal) { modal.style.display='none'; modal.setAttribute('aria-hidden','true'); }
    currentSalidaRegistroId=null;
}

async function confirmarSalida() {
    if (!currentSalidaRegistroId) return;
    try {
        showNotification('⏳ Registrando salida...','info');
        const response=await fetch(`${API_TRABAJADOR_URL}/registrar-salida/${currentSalidaRegistroId}`,{method:'POST',headers:{'Content-Type':'application/json'}});
        if (!response.ok) { const err=await response.json(); throw new Error(err.error||'Error'); }
        showNotification('✅ Salida registrada. Proceda a cobrar.','success');
        cerrarModalSalida(); await loadVehiculosActivos(); await loadPendientesCobro();
    } catch(error) { showNotification('❌ '+error.message,'error'); }
}

// ==================== PENDIENTES COBRO ====================
async function loadPendientesCobro() {
    try {
        const response=await fetch(`${API_TRABAJADOR_URL}/vehiculos-pendientes-cobro`,{headers:{'Content-Type':'application/json'}});
        if (!response.ok) throw new Error('Error');
        const pendientes=await response.json();
        const tbody=document.getElementById('pendientesCobroBody');
        if (!tbody) return;
        if (pendientes.length===0) { tbody.innerHTML='<tr><td colspan="7" style="text-align:center;">No hay pendientes</td></tr>'; return; }
        tbody.innerHTML=pendientes.map(p=>`
            <tr>
                <td><strong>${p.placa}</strong></td><td>${p.clienteNombre}</td>
                <td>${formatDateTime(p.horaEntrada)}</td><td>${formatDateTime(p.horaSalida)}</td>
                <td>${p.tiempoTotal}</td>
                <td style="font-weight:700;color:#059669;">$${formatNumber(p.precio)}</td>
                <td><button class="sede-btn-success sede-btn-cobrar" data-id="${p.registroId}">💰 Cobrar</button></td>
            </tr>`).join('');
    } catch(error) { console.error('Error:',error); }
}

// ==================== MODAL COBRO ====================
async function abrirModalCobro(registroId) {
    currentCobroRegistroId=registroId;
    const modal=document.getElementById('cobroModal');
    if (!modal) return;
    modal.style.display='block'; modal.style.visibility='visible'; modal.style.opacity='1';
    modal.setAttribute('aria-hidden','false');
    try {
        const response=await fetch(`${API_TRABAJADOR_URL}/opciones-cobro/${registroId}`,{headers:{'Content-Type':'application/json'}});
        if (!response.ok) { const err=await response.json(); throw new Error(err.error||'Error'); }
        const data=await response.json();
        opcionesTarifa=data;
        document.getElementById('cobroCliente').textContent=data.clienteNombre;
        document.getElementById('cobroPlaca').textContent  =data.placa;
        document.getElementById('cobroTiempo').textContent =data.tiempoTotal;
        const container=document.getElementById('tarifaSelectorContainer');
        if (container) container.innerHTML=`<div class="sede-modal-cobro-selector"><h3>💰 Seleccione tarifa:</h3>${data.opciones.map((op,i)=>`<label class="sede-modal-cobro-opcion"><input type="radio" name="tipoTarifa" value="${op.tipo}" ${i===0?'checked':''} onchange="actualizarPrecioCobro('${op.tipo}',${op.precio})"><strong>${op.nombre}</strong><div>$${formatNumber(op.precio)} COP</div></label>`).join('')}</div>`;
        document.getElementById('cobroPrecio').textContent=formatNumber(data.opciones[0].precio);
    } catch(error) { showNotification('❌ '+error.message,'error'); }
}

function actualizarPrecioCobro(tipo,precio) { document.getElementById('cobroPrecio').textContent=formatNumber(precio); }

function cerrarModalCobro() {
    const modal=document.getElementById('cobroModal');
    if (modal) { modal.style.display='none'; modal.style.visibility='hidden'; modal.style.opacity='0'; modal.setAttribute('aria-hidden','true'); }
    currentCobroRegistroId=null; opcionesTarifa=null;
    const container=document.getElementById('tarifaSelectorContainer'); if(container) container.innerHTML='';
}

async function procesarCobro() {
    if (!currentCobroRegistroId) return;
    try {
        const metodoPago=document.getElementById('metodoPago').value;
        const tipoTarifa=document.querySelector('input[name="tipoTarifa"]:checked');
        if (!tipoTarifa) { showNotification('⚠️ Seleccione una tarifa','warning'); return; }
        showNotification('⏳ Procesando cobro...','info');
        const response=await fetch(`${API_TRABAJADOR_URL}/confirmar-cobro/${currentCobroRegistroId}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({metodoPago,tipoTarifa:tipoTarifa.value})});
        if (!response.ok) { const err=await response.json(); throw new Error(err.error||'Error'); }
        const data=await response.json();
        showNotification(`✅ Cobro: $${formatNumber(data.precio)} - ${data.tipoTarifaAplicada}`,'success');
        cerrarModalCobro(); await loadPendientesCobro();
    } catch(error) { showNotification('❌ '+error.message,'error'); }
}

// ==================== HISTORIAL ====================
async function loadHistorial() {
    try {
        const fecha=document.getElementById('filtroFecha')?.value||'';
        const estado=document.getElementById('filtroEstado1')?.value||'';
        let url=`${API_TRABAJADOR_URL}/historial`;
        const params=new URLSearchParams();
        if (fecha)  params.append('fecha',fecha);
        if (estado) params.append('estado',estado);
        if (params.toString()) url+='?'+params.toString();
        const response=await fetch(url,{headers:{'Content-Type':'application/json'}});
        if (!response.ok) throw new Error('Error');
        const registros=await response.json();
        const tbody=document.getElementById('historialBody');
        if (!tbody) return;
        if (registros.length===0) { tbody.innerHTML='<tr><td colspan="9" style="text-align:center;">Sin registros</td></tr>'; return; }
        tbody.innerHTML=registros.map(r=>{
            let badge=r.estado==='ACTIVO'?'<span class="sede-badge sede-badge-info">Activo</span>':r.estado==='FINALIZADO'?'<span class="sede-badge sede-badge-warning">Pendiente</span>':r.estado==='COBRADO'?'<span class="sede-badge sede-badge-success">Cobrado</span>':'<span class="sede-badge sede-badge-danger">Cancelado</span>';
            return `<tr><td><strong>${r.placa}</strong></td><td>${r.tipoVehiculo}</td><td>${r.clienteNombre}</td><td>${r.clienteTelefono}</td><td>${formatDateTime(r.horaEntrada)}</td><td>${r.horaSalida?formatDateTime(r.horaSalida):'-'}</td><td>${r.tiempoTotal}</td><td>${r.precio?'$'+formatNumber(r.precio):'-'}</td><td>${badge}</td></tr>`;
        }).join('');
    } catch(error) { console.error('Error:',error); }
}

// ==================== RESERVACIONES ====================
async function loadReservaciones() {
    try {
        const response=await fetch(`${API_TRABAJADOR_URL}/reservaciones`,{headers:{'Content-Type':'application/json'}});
        if (!response.ok) throw new Error('Error');
        const reservas=await response.json();
        const tbody=document.getElementById('reservacionesBody');
        if (!tbody) return;
        if (reservas.length===0) { tbody.innerHTML='<tr><td colspan="8" style="text-align:center;">Sin reservaciones</td></tr>'; return; }
        tbody.innerHTML=reservas.map(r=>`
            <tr><td>${r.clienteNombre}</td><td>${r.clienteTelefono}</td><td><strong>${r.placa}</strong></td><td>${r.tipoVehiculo}</td><td>${formatDateTime(r.horaInicio)}</td><td>${formatDateTime(r.horaFin)}</td><td><span class="sede-badge sede-badge-info">${r.cupo}</span></td>
            <td><button class="sede-btn-success sede-btn-aceptar"  data-id="${r.id}">✅ Aceptar</button>
                <button class="sede-btn-danger  sede-btn-rechazar" data-id="${r.id}">❌ Rechazar</button></td></tr>`).join('');
    } catch(error) { console.error('Error:',error); }
}

async function aceptarReservacion(id) {
    const ok=await showConfirm('Aceptar reservación','¿Confirmas que deseas aceptar esta reservación?','Aceptar','warning');
    if (!ok) return;
    try {
        await fetch(`${API_TRABAJADOR_URL}/aceptar-reservacion/${id}`,{method:'POST',headers:{'Content-Type':'application/json'}});
        showNotification('✅ Reservación aceptada','success');
        await loadReservaciones(); await loadVehiculosActivos();
    } catch (e) { showNotification('❌ Error','error'); }
}

async function rechazarReservacion(id) {
    const ok=await showConfirm('Rechazar reservación','¿Confirmas que deseas rechazar esta reservación?','Rechazar','danger');
    if (!ok) return;
    try {
        const response=await fetch(`${API_TRABAJADOR_URL}/rechazar-reservacion/${id}`,{method:'POST',headers:{'Content-Type':'application/json'}});
        if (!response.ok) throw new Error('Error');
        showNotification('✅ Reservación rechazada','success'); await loadReservaciones();
    } catch (e) { showNotification('❌ Error','error'); }
}

// ==================== CARGA MASIVA ====================
async function cargarExcel() {
    const fileInput=document.getElementById('excelFile'), file=fileInput?.files[0];
    if (!file) { showNotification('⚠️ Por favor seleccione un archivo Excel','warning'); return; }
    const ext=file.name.split('.').pop().toLowerCase();
    if (!['xlsx','xls'].includes(ext)) { showNotification('⚠️ El archivo debe ser formato Excel (.xlsx o .xls)','warning'); return; }
    try {
        const pc=document.getElementById('progressContainer'),pb=document.getElementById('progressBar'),pt=document.getElementById('progressText');
        if (pc) { pc.style.display='block'; pb.style.width='30%'; pb.textContent='30%'; pt.textContent='Subiendo archivo...'; }
        const formData=new FormData(); formData.append('file',file);
        const response=await fetch(`${API_TRABAJADOR_URL}/carga-masiva`,{method:'POST',body:formData});
        if (pb) { pb.style.width='70%'; pb.textContent='70%'; pt.textContent='Procesando datos...'; }
        if (!response.ok) { const err=await response.json().catch(()=>({})); throw new Error(err.error||'Error al procesar el archivo'); }
        const data=await response.json();
        if (pb) { pb.style.width='100%'; pb.textContent='100%'; pt.textContent='✅ Completado'; }
        mostrarResultadosCarga(data);
        showNotification(data.tieneErrores?`⚠️ Carga completada con ${data.errores.length} error(es)`:`✅ Carga exitosa: ${data.totalRegistros||0} registros`,data.tieneErrores?'warning':'success');
        fileInput.value=''; document.getElementById('archivoSeleccionado').innerHTML='';
        setTimeout(()=>{ if(pc) pc.style.display='none'; },2000);
    } catch(error) { showNotification(`❌ Error: ${error.message}`,'error'); const pc=document.getElementById('progressContainer'); if(pc) pc.style.display='none'; }
}

function mostrarResultadosCarga(data) {
    const rd=document.getElementById('resultadosCarga'); if(rd) rd.style.display='block';
    const resumen=document.getElementById('resumenCarga');
    if (resumen) resumen.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;"><div style="background:linear-gradient(135deg,#d1fae5,#a7f3d0);padding:1.5rem;border-radius:0.75rem;text-align:center;"><div style="font-size:2rem;font-weight:700;color:#065f46;">${data.clientesRegistrados||0}</div><div style="font-size:0.9rem;color:#047857;font-weight:600;">Clientes Registrados</div></div><div style="background:linear-gradient(135deg,#ccfbf1,#99f6e4);padding:1.5rem;border-radius:0.75rem;text-align:center;"><div style="font-size:2rem;font-weight:700;color:#0f766e;">${data.vehiculosRegistrados||0}</div><div style="font-size:0.9rem;color:#0d9488;font-weight:600;">Vehículos Registrados</div></div><div style="background:linear-gradient(135deg,#e0f2f1,#b2dfdb);padding:1.5rem;border-radius:0.75rem;text-align:center;"><div style="font-size:2rem;font-weight:700;color:#00695c;">${data.totalRegistros||0}</div><div style="font-size:0.9rem;color:#00796b;font-weight:600;">Total Registros</div></div></div>`;
    const ec=document.getElementById('erroresContainer'),le=document.getElementById('listaErrores');
    if (data.errores?.length>0) { if(ec) ec.style.display='block'; if(le) le.innerHTML=data.errores.map(e=>`<li>${e}</li>`).join(''); } else { if(ec) ec.style.display='none'; }
    const tbody=document.getElementById('resultadosCargaBody');
    if (tbody&&data.registrosCargados) tbody.innerHTML=data.registrosCargados.map(r=>r.tipo==='Vehículo'||r.tipo==='Vehiculo'?`<tr><td><span class="sede-badge sede-badge-info">🚗 ${r.tipo}</span></td><td><strong>${r.placa||'N/A'}</strong></td><td><strong>${r.marca||'N/A'}</strong> ${r.tipoVehiculo||''}<br><small style="color:#64748b;">Color: ${r.color||'N/A'} - Año: ${r.año||'N/A'}</small><br><small style="color:#64748b;">Propietario: ${r.propietario||'N/A'}</small></td><td><span class="sede-badge sede-badge-success">✓ Registrado</span></td></tr>`:r.tipo==='Cliente'?`<tr><td><span class="sede-badge sede-badge-success">🧑‍💼 ${r.tipo}</span></td><td><strong>${r.nombre||'N/A'}</strong></td><td>${r.email||'N/A'}<br><small style="color:#64748b;">Tel: ${r.telefono||'N/A'} - Cédula: ${r.cedula||'N/A'}</small></td><td><span class="sede-badge sede-badge-success">✓ Registrado</span></td></tr>':'').join('');
}

function descargarPlantillaCompleta() {
    if (typeof XLSX==='undefined') { showNotification('❌ Error: Librería XLSX no está cargada','error'); return; }
    const wb=XLSX.utils.book_new();
    const wsC=XLSX.utils.aoa_to_sheet([['Tipo','Nombre','Teléfono','Email','Cédula'],['Cliente','Juan Pérez','0987654321','juan@gmail.com','1234567899']]);
    wsC['!cols']=[{wch:10},{wch:20},{wch:12},{wch:28},{wch:12}];
    XLSX.utils.book_append_sheet(wb,wsC,'Clientes');
    const wsV=XLSX.utils.aoa_to_sheet([['Tipo','Placa','Tipo Vehículo','Marca','Color','Año','Email Cliente'],['Vehiculo','ABC123','CARRO','TOYOTA','Blanco','2020','juan@gmail.com']]);
    wsV['!cols']=[{wch:10},{wch:10},{wch:15},{wch:12},{wch:10},{wch:8},{wch:28}];
    XLSX.utils.book_append_sheet(wb,wsV,'Vehículos');
    XLSX.writeFile(wb,'Plantilla_Carga_Masiva_Completa.xlsx');
    showNotification('✅ Plantilla descargada','success');
}

function descargarPlantillaVehiculosSolo() {
    if (typeof XLSX==='undefined') { showNotification('❌ Error: Librería XLSX no está cargada','error'); return; }
    const wb=XLSX.utils.book_new();
    const wsV=XLSX.utils.aoa_to_sheet([['Tipo','Placa','Tipo Vehículo','Marca','Color','Año','Email Cliente'],['Vehiculo','ABC123','CARRO','TOYOTA','Blanco','2020','juan@gmail.com']]);
    wsV['!cols']=[{wch:10},{wch:10},{wch:15},{wch:12},{wch:10},{wch:8},{wch:28}];
    XLSX.utils.book_append_sheet(wb,wsV,'Vehículos');
    XLSX.writeFile(wb,'Plantilla_Solo_Vehiculos.xlsx');
    showNotification('✅ Plantilla descargada','success');
}

function mostrarArchivoSeleccionado() {
    const fi=document.getElementById('excelFile'),info=document.getElementById('archivoSeleccionado');
    if (fi?.files[0]) { const f=fi.files[0]; info.innerHTML=`📎 <strong>${f.name}</strong> (${(f.size/1024).toFixed(2)} KB)`; info.style.color='#059669'; } else info.innerHTML='';
}

// ==================== DELEGACIÓN DE EVENTOS ====================
function setupGlobalEventDelegation() {
    document.body.addEventListener('click', function(e) {
        if (e.target.closest('.sede-btn-salida'))  { e.preventDefault(); abrirModalSalida(parseInt(e.target.closest('.sede-btn-salida').dataset.id));  return; }
        if (e.target.closest('.sede-btn-cobrar'))  { e.preventDefault(); abrirModalCobro(parseInt(e.target.closest('.sede-btn-cobrar').dataset.id));    return; }
        if (e.target.closest('.sede-btn-aceptar')) { e.preventDefault(); aceptarReservacion(e.target.closest('.sede-btn-aceptar').dataset.id);          return; }
        if (e.target.closest('.sede-btn-rechazar')){ e.preventDefault(); rechazarReservacion(e.target.closest('.sede-btn-rechazar').dataset.id);        return; }
    });
}

// ==================== GESTIÓN TRABAJADORES ====================
function openRegistrarTrabajadorModal() {
    const modal=document.getElementById('registrarTrabajadorModal');
    if (modal) { modal.classList.add('show'); modal.setAttribute('aria-hidden','false'); }
}

function closeRegistrarTrabajadorModal() {
    const modal=document.getElementById('registrarTrabajadorModal');
    if (modal) {
        modal.classList.remove('show'); modal.setAttribute('aria-hidden','true');
        setTimeout(()=>{
            ['trabajadorNombre','trabajadorCorreo','trabajadorTelefono','trabajadorCedula','trabajadorContrasena']
                .forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
        },300);
    }
}

// listener movido a setupEventListeners()

async function registrarTrabajador() {
    const datos={
        nombre:     document.getElementById('trabajadorNombre').value.trim(),
        correo:     document.getElementById('trabajadorCorreo').value.trim(),
        telefono:   document.getElementById('trabajadorTelefono').value.trim(),
        cedula:     document.getElementById('trabajadorCedula').value.trim(),
        contrasena: document.getElementById('trabajadorContrasena').value
    };
    if (!datos.nombre||!datos.correo) { showNotification('Por favor complete los campos obligatorios: Nombre y Correo','warning'); return; }
    if (!datos.contrasena||datos.contrasena.length<8) { showNotification('La contraseña es obligatoria y debe tener al menos 8 caracteres','warning'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo)) { showNotification('Por favor ingrese un correo electrónico válido','warning'); return; }
    try {
        const response=await fetch(`${API_BASE_URL}/registrar-trabajador`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(datos)});
    if (response.ok) { const r=await response.json(); showNotification(r.mensaje||'Trabajador registrado exitosamente','success'); closeRegistrarTrabajadorModal(); cargarUsuarios(); }
    else { const err=await response.json(); showNotification(err.error||'Error al registrar trabajador','error'); }
} catch (e) { showNotification('Error de conexión al registrar trabajador','error'); }
}

// ==================== REPORTES ====================
async function generarPDF() {
    try {
        const response=await fetch(`${API_BASE_URL}/reporte/usuarios/pdf`);
        if (!response.ok) throw new Error('Error al generar PDF');
        const blob=await response.blob(),url=window.URL.createObjectURL(blob),a=document.createElement('a');
        a.href=url; a.download=`reporte_clientes_${Date.now()}.pdf`;
        document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); document.body.removeChild(a);
        showNotification('PDF generado exitosamente','success');
    } catch (e) { showNotification('Error al generar el reporte PDF','error'); }
}

async function generarExcel() {
    try {
        const response=await fetch(`${API_BASE_URL}/reporte/usuarios/excel`);
        if (!response.ok) throw new Error('Error al generar Excel');
        const blob=await response.blob(),url=window.URL.createObjectURL(blob),a=document.createElement('a');
        a.href=url; a.download=`reporte_clientes_${Date.now()}.xlsx`;
        document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); document.body.removeChild(a);
        showNotification('Excel generado exitosamente','success');
    } catch (e) { showNotification('Error al generar el reporte Excel','error'); }
}

// ==================== EDICIÓN Y ELIMINACIÓN ====================
async function editarUsuario(id) {
    const u=usuariosData.find(u=>u.id===id);
    if (!u) { showNotification('❌ Usuario no encontrado','error'); return; }
    const resultado=await showEditModal('Editar Usuario',[
        {key:'nombre',   label:'Nombre',   value:u.nombre  ||''},
        {key:'correo',   label:'Correo',   value:u.correo  ||'', type:'email'},
        {key:'telefono', label:'Teléfono', value:u.telefono||''},
        {key:'estado',   label:'Estado',   value:u.estado  ||'ACTIVO', type:'select', options:['ACTIVO','INACTIVO']}
    ]);
    if (!resultado) return;
    try {
        const response=await fetch(`${API_BASE_URL}/usuarios/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:resultado.nombre.trim(),correo:resultado.correo.trim(),telefono:resultado.telefono.trim(),estado:resultado.estado})});
        if (response.ok) { showNotification('✅ Usuario actualizado correctamente','success'); await cargarUsuarios(); }
        else { const err=await response.json(); showNotification('❌ '+(err.error||'Error al actualizar'),'error'); }
    } catch (e) { showNotification('❌ Error de conexión','error'); }
}

async function eliminarUsuario(id) {
    const u=usuariosData.find(u=>u.id===id);
    const nombre=u?.nombre||`ID ${id}`;
    const ok=await showConfirm('Eliminar usuario',`¿Estás seguro de eliminar a <strong>${nombre}</strong>?<br>Esta acción no se puede deshacer.`);
    if (!ok) return;
    try {
        const response=await fetch(`${API_BASE_URL}/usuarios/${id}`,{method:'DELETE'});
        if (response.ok) { showNotification('Usuario eliminado correctamente','success'); cargarUsuarios(); }
        else throw new Error('Error al eliminar usuario');
    } catch (e) { showNotification('Error al eliminar el usuario','error'); }
}

async function editarSede(id) {
    const s=sedesData.find(s=>s.id===id);
    if (!s) { showNotification('❌ Sede no encontrada','error'); return; }
    const resultado=await showEditModal('Editar Sede',[
        {key:'nombre',    label:'Nombre',    value:s.nombre   ||''},
        {key:'direccion', label:'Dirección', value:s.direccion||''},
        {key:'capacidad', label:'Capacidad', value:s.capacidad||'', type:'number'},
        {key:'estado',    label:'Estado',    value:s.estado   ||'ACTIVO', type:'select', options:['ACTIVO','INACTIVO']}
    ]);
    if (!resultado) return;
    if (isNaN(parseInt(resultado.capacidad))||parseInt(resultado.capacidad)<=0) {
        showNotification('⚠️ La capacidad debe ser un número mayor a 0','warning'); return;
    }
    try {
        const response=await fetch(`${API_BASE_URL}/sedes/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:resultado.nombre.trim(),direccion:resultado.direccion.trim(),capacidad:parseInt(resultado.capacidad),estado:resultado.estado})});
        if (response.ok) { showNotification('✅ Sede actualizada correctamente','success'); await cargarSedes(); }
        else { const err=await response.json(); showNotification('❌ '+(err.error||'Error al actualizar sede'),'error'); }
    } catch (e) { showNotification('❌ Error de conexión','error'); }
}

// ==================== CORREOS ====================
async function enviarCorreoUno() {
    const email=document.getElementById('emailSingle').value.trim();
    const subject=document.getElementById('subjectSingle').value.trim();
    const message=document.getElementById('messageSingle').value.trim();
    if (!email||!subject||!message) { showNotification('Por favor complete todos los campos','warning'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showNotification('Por favor ingrese un correo válido','warning'); return; }
    const btn=document.querySelector('#correoUno button[type="submit"]');
    if (btn) { btn.disabled=true; btn.textContent='Enviando...'; }
    const formData=new URLSearchParams();
    formData.append('correo',email); formData.append('asunto',subject); formData.append('mensaje',message);
    try {
        const response=await fetch(`${API_BASE_URL}/correo/unitario`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:formData.toString()});
        const data=await response.json();
        if (data.status==='success') {
            showNotification(data.message,'success');
            ['emailSingle','subjectSingle','messageSingle'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
        } else { showNotification(data.message||'Error al enviar correo','error'); }
    } catch (e) { showNotification('Error de conexión','error'); }
    finally { if (btn) { btn.disabled=false; btn.textContent='Enviar Correo'; } }
}

async function enviarCorreoMasivo() {
    const emailsRaw=document.getElementById('emailsMassive').value.trim();
    const subject=document.getElementById('subjectMassive').value.trim();
    const message=document.getElementById('messageMassive').value.trim();
    if (!emailsRaw||!subject||!message) { showNotification('Por favor complete todos los campos','warning'); return; }
    const emailList=emailsRaw.split(',').map(e=>e.trim()).filter(e=>e);
    const invalidEmails=emailList.filter(e=>!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (invalidEmails.length>0) { showNotification(`Correos inválidos: ${invalidEmails.join(', ')}`,'error'); return; }
    if (emailList.length===0) { showNotification('Ingresa al menos un correo válido','warning'); return; }
    const btn=document.querySelector('#correoMasivo button[type="submit"]');
    if (btn) { btn.disabled=true; btn.textContent='Enviando...'; }
    const formData=new URLSearchParams();
    emailList.forEach(e=>formData.append('seleccionados',e));
    formData.append('asunto',subject); formData.append('mensaje',message);
    try {
        const response=await fetch(`${API_BASE_URL}/correo/masivo`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:formData.toString()});
        const data=await response.json();
        if (data.status==='success') {
            showNotification(data.message,'success');
            ['emailsMassive','subjectMassive','messageMassive'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
        } else { showNotification(data.message||'Error al enviar correos','error'); }
    } catch (e) { showNotification('Error de conexión','error'); }
    finally { if (btn) { btn.disabled=false; btn.textContent='Enviar Masivamente'; } }
}

// ==================== UI HELPERS ====================

/**
 * setupSidebarToggle — NO-OP
 * El sidebar colapsable ahora se maneja con toggleSidebar() en Sede.html.
 * Esta función se mantiene por compatibilidad con initializeApp().
 */
function setupSidebarToggle() {
    // no-op: el toggle vive en Sede.html (inline script + onclick)
}

function setupProfileMenu() {
    const profileBtn=document.getElementById('profileBtn');
    const dropdown  =document.getElementById('profileDropdown');
    profileBtn?.addEventListener('click', e => {
        e.stopPropagation();
        dropdown.classList.toggle('show');
        profileBtn.setAttribute('aria-expanded',
            dropdown.classList.contains('show') ? 'true' : 'false');
    });
    document.addEventListener('click', () => {
        dropdown?.classList.remove('show');
        profileBtn?.setAttribute('aria-expanded','false');
    });
}

function cerrarSesion()    { window.location.href='/logout'; }
function irConfiguracion() { showNotification('Sección de configuración próximamente','info'); }
function irAyuda()         { showNotification('Sección de ayuda próximamente','info'); }

// Cerrar modales con Escape
document.addEventListener('keydown', e => {
    if (e.key==='Escape') {
        const cobro =document.getElementById('cobroModal');
        const salida=document.getElementById('salidaModal');
        if (cobro  && cobro.style.display==='block')  cerrarModalCobro();
        if (salida && salida.style.display==='block') cerrarModalSalida();
    }
});

// Cerrar modales al hacer clic fuera
window.addEventListener('click', e => {
    const cobro =document.getElementById('cobroModal');
    const salida=document.getElementById('salidaModal');
    if (e.target===cobro)  cerrarModalCobro();
    if (e.target===salida) cerrarModalSalida();
    const modal=document.getElementById('registrarTrabajadorModal');
    if (e.target===modal) closeRegistrarTrabajadorModal();
});

// ==================== ESTILOS ADICIONALES ====================
function injectAdditionalStyles() {
    if (document.getElementById('sede-additional-styles')) return;
    const style=document.createElement('style');
    style.id='sede-additional-styles';
    style.textContent=`
        .sede-btn-icon { background:transparent;border:none;cursor:pointer;padding:0.4rem;border-radius:0.375rem;transition:all 0.2s;display:inline-flex;align-items:center;justify-content:center; }
        .sede-btn-edit:hover   { background-color:#ccfbf1; }
        .sede-btn-delete:hover { background-color:#fee2e2; }
        .sede-btn-warning { background-color:#f59e0b;color:white;padding:0.4rem 1rem;border-radius:0.375rem;border:none;cursor:pointer;transition:all 0.2s;font-weight:600;display:inline-flex;align-items:center;gap:0.4rem;font-size:0.85rem; }
        .sede-btn-warning:hover { background-color:#d97706;transform:translateY(-1px); }
        @keyframes aparca-slideUp { from{transform:translateX(400px);opacity:0;} to{transform:translateX(0);opacity:1;} }
        .hidden { display:none!important; }
    `;
    document.head.appendChild(style);
}

// Exponer toggleSidebar como fallback global
window.toggleSidebar = window.toggleSidebar || function() {
    const collapsed = document.body.classList.toggle('sidebar-collapsed');
    try { localStorage.setItem('sede-sidebar-collapsed', collapsed ? '1' : '0'); } catch(e) {}
};

console.log('✅ SedeD.js cargado correctamente');