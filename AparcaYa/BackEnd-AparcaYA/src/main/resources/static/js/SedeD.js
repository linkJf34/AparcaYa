'use strict';
// ==================== CONFIG GLOBAL ====================
const API_BASE_URL = '/api/sede';

let usuariosData   = [];
let sedesData      = [];
let currentTab     = 'usuarios';
let currentSalidaRegistroId = null;
let currentCobroRegistroId  = null;
let opcionesTarifa  = null;
let updateInterval  = null;
let timerIntervals  = {};
let modoRapido      = false;
let chartIngresos   = null;
let chartOcupacion  = null;

// Estado del filtro de período
let periodoActual = 'hoy';
let periodoDesde  = null;
let periodoHasta  = null;

const marcasPorTipo = {
    CARRO:['RENAULT','KIA','TOYOTA','CHEVROLET','MAZDA','NISSAN','VOLKSWAGEN','FORD','HYUNDAI',
        'BMW','MERCEDES_BENZ','AUDI','PEUGEOT','CITROEN','FIAT','VOLVO','JEEP','LAND_ROVER',
        'PORSCHE','FERRARI','LAMBORGHINI','TESLA','BYD','CHANGAN','GEELY','JAC','CHERY',
        'GREAT_WALL','HAVAL','GWM','MITSUBISHI','SUBARU','ISUZU','SSANGYONG','MG','RAM',
        'DFSK','FOTON','OTRO'],
    MOTO:['HONDA','YAMAHA','SUZUKI','KAWASAKI','BAJAJ','TVS','HERO','KTM','DUCATI',
        'HARLEY_DAVIDSON','BMW_MOTORRAD','TRIUMPH','ROYAL_ENFIELD','AUTECO','AKT',
        'VICTORY','APRILIA','BENELLI','HUSQVARNA','OTRO'],
    BICICLETA:['TREK','SPECIALIZED','GIANT','SCOTT','CANNONDALE','ORBEA','GW','SHIMANO',
        'BIANCHI','MERIDA','CUBE','BMC','FOCUS','OTRO'],
    OTRO:['OTRO']
};

// ==================== NOTIFICACIONES ====================
function showNotification(msg, type) {
    if (!type) type = 'info';
    document.querySelectorAll('.toast-notification').forEach(function(t){t.remove();});
    var toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.style.cssText = 'position:fixed;top:80px;right:20px;padding:1rem 1.5rem;' +
        'border-radius:.5rem;color:white;font-weight:600;z-index:9999;' +
        'animation:aparca-slideUp .3s ease-out;max-width:400px;' +
        'box-shadow:0 4px 12px rgba(0,0,0,.15);';
    var colors = {success:'#10b981',error:'#ef4444',warning:'#f59e0b',info:'#14b8a6'};
    toast.style.backgroundColor = colors[type] || colors.info;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function(){
        toast.style.opacity='0'; toast.style.transition='opacity .3s ease-in';
        setTimeout(function(){toast.remove();},300);
    },5000);
}

// ==================== MODAL CONFIRMACIÓN ====================
function showConfirm(titulo, cuerpo, btnTexto, btnColor) {
    if (!btnTexto) btnTexto='Confirmar'; if (!btnColor) btnColor='danger';
    return new Promise(function(resolve){
        var overlay = document.getElementById('confirm-overlay');
        if (!overlay){overlay=document.createElement('div');overlay.id='confirm-overlay';
            overlay.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:1rem;';
            document.body.appendChild(overlay);}
        var bc={danger:'background:#dc2626;color:#fff',warning:'background:#f59e0b;color:#fff'};
        overlay.innerHTML='<div role="dialog" aria-modal="true" style="background:#fff;border-radius:.75rem;padding:2rem;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3);">' +
            '<h3 style="font-size:1.125rem;font-weight:700;color:#0f172a;margin:0 0 .75rem;">'+titulo+'</h3>' +
            '<p style="font-size:.875rem;color:#64748b;margin:0 0 1.5rem;line-height:1.6;">'+cuerpo+'</p>' +
            '<div style="display:flex;justify-content:flex-end;gap:.75rem;">' +
            '<button id="confirm-cancel" style="padding:.5rem 1.25rem;border:1px solid #e2e8f0;border-radius:.5rem;background:#fff;color:#374151;cursor:pointer;">Cancelar</button>' +
            '<button id="confirm-ok" style="padding:.5rem 1.25rem;border:none;border-radius:.5rem;'+(bc[btnColor]||bc.danger)+';cursor:pointer;font-weight:600;">'+btnTexto+'</button></div></div>';
        overlay.style.display='flex';
        document.getElementById('confirm-ok').onclick=function(){overlay.style.display='none';resolve(true);};
        document.getElementById('confirm-cancel').onclick=function(){overlay.style.display='none';resolve(false);};
    });
}

// ==================== MODAL EDICIÓN ====================
function showEditModal(titulo, campos) {
    return new Promise(function(resolve){
        var overlay = document.getElementById('edit-overlay');
        if (!overlay){overlay=document.createElement('div');overlay.id='edit-overlay';
            overlay.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:1rem;';
            document.body.appendChild(overlay);}
        var inputs = campos.map(function(c){
            var inp = c.type==='select'
                ? '<select id="edit-field-'+c.key+'" style="width:100%;padding:.5rem;border:1px solid #d1d5db;border-radius:.375rem;">'+c.options.map(function(o){return '<option value="'+o+'"'+(o===c.value?' selected':'')+'>'+o+'</option>';}).join('')+'</select>'
                : '<input id="edit-field-'+c.key+'" type="'+(c.type||'text')+'" value="'+(c.value||'')+'" style="width:100%;padding:.5rem;border:1px solid #d1d5db;border-radius:.375rem;">';
            return '<div style="margin-bottom:1rem;"><label style="display:block;font-size:.875rem;font-weight:600;color:#374151;margin-bottom:.25rem;">'+c.label+'</label>'+inp+'</div>';
        }).join('');
        overlay.innerHTML='<div role="dialog" aria-modal="true" style="background:#fff;border-radius:.75rem;padding:2rem;max-width:480px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3);max-height:90vh;overflow-y:auto;">' +
            '<h3 style="font-size:1.125rem;font-weight:700;color:#0f172a;margin:0 0 1.5rem;">'+titulo+'</h3>'+inputs+
            '<div style="display:flex;justify-content:flex-end;gap:.75rem;margin-top:1.5rem;">' +
            '<button id="edit-cancel" style="padding:.5rem 1.25rem;border:1px solid #e2e8f0;border-radius:.5rem;background:#fff;color:#374151;cursor:pointer;">Cancelar</button>' +
            '<button id="edit-ok" style="padding:.5rem 1.25rem;border:none;border-radius:.5rem;background:#0f766e;color:#fff;cursor:pointer;font-weight:600;">Guardar</button></div></div>';
        overlay.style.display='flex';
        document.getElementById('edit-ok').onclick=function(){
            var res={};campos.forEach(function(c){res[c.key]=document.getElementById('edit-field-'+c.key).value;});
            overlay.style.display='none';resolve(res);};
        document.getElementById('edit-cancel').onclick=function(){overlay.style.display='none';resolve(null);};
    });
}

// ==================== UTILIDADES ====================
function setInputValue(id,v){var el=document.getElementById(id);if(el)el.value=v||'';}
function getInputValue(id){var el=document.getElementById(id);return el?el.value.trim():'';}

function formatDateTime(s){
    if (!s) return '-';
    try{return new Date(s).toLocaleString('es-CO',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}
    catch(e){return s;}
}
function formatNumber(n){
    if (n==null) return '0';
    return Number(n).toLocaleString('es-CO',{minimumFractionDigits:0,maximumFractionDigits:0});
}
function formatMarcaName(m){
    var map={'MERCEDES_BENZ':'Mercedes-Benz','LAND_ROVER':'Land Rover','GREAT_WALL':'Great Wall',
        'BMW_MOTORRAD':'BMW Motorrad','HARLEY_DAVIDSON':'Harley-Davidson','ROYAL_ENFIELD':'Royal Enfield'};
    return map[m]||m.split('_').map(function(w){return w.charAt(0)+w.slice(1).toLowerCase();}).join(' ');
}

// ==================== CÁLCULO DE RANGO DE FECHAS ====================
function calcularRangoFechas(periodo) {
    var hoy   = new Date();
    var yyyy  = hoy.getFullYear();
    var mm    = String(hoy.getMonth()+1).padStart(2,'0');
    var dd    = String(hoy.getDate()).padStart(2,'0');
    var hoyStr= yyyy+'-'+mm+'-'+dd;
    switch (periodo) {
        case 'hoy':
            return {desde:hoyStr, hasta:hoyStr, label:'Hoy ('+hoyStr+')'};
        case 'semana': {
            var offset = hoy.getDay()===0 ? -6 : 1-hoy.getDay();
            var lunes  = new Date(hoy); lunes.setDate(hoy.getDate()+offset);
            var lStr   = lunes.toISOString().split('T')[0];
            return {desde:lStr, hasta:hoyStr, label:'Esta semana ('+lStr+' → '+hoyStr+')'};
        }
        case 'mes': {
            var pmes = yyyy+'-'+mm+'-01';
            return {desde:pmes, hasta:hoyStr, label:'Este mes ('+pmes+' → '+hoyStr+')'};
        }
        case 'anio': {
            var panio = yyyy+'-01-01';
            return {desde:panio, hasta:hoyStr, label:'Este año ('+yyyy+')'};
        }
        case 'custom': {
            var d = periodoDesde||hoyStr, h = periodoHasta||hoyStr;
            return {desde:d, hasta:h, label:'Personalizado: '+d+' → '+h};
        }
        default:
            return {desde:hoyStr, hasta:hoyStr, label:'Hoy'};
    }
}

(function verificarAutenticacion() {
    const token = sessionStorage.getItem('aparca_jwt');
    if (!token) { window.location.href = '/login'; return; }
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const ahora   = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < ahora) {
            localStorage.removeItem('aparca_jwt');
            window.location.href = '/login';
        }
    } catch (e) {
        localStorage.removeItem('aparca_jwt');
        window.location.href = '/login';
    }
})();

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', function(){
    initializeApp();
    initializeTrabajadorFeatures();
    injectAdditionalStyles();
    cargarEstadisticas();
    cargarBannerSede();
    initModalConfigTabs();
    var desdeEl=document.getElementById('periodoDesde');
    var hastaEl=document.getElementById('periodoHasta');
    if (desdeEl) desdeEl.addEventListener('change', onPeriodoCustomChange);
    if (hastaEl) hastaEl.addEventListener('change', onPeriodoCustomChange);

    // Cerrar al clic fuera
    var modalRS = document.getElementById('registrarSedeModal');
    if (modalRS) {
        modalRS.addEventListener('click', function(e) {
            if (e.target === modalRS) cerrarModalRegistrarSede();
        });
    }

    // Preview inicial del horario del modal registrar sede
    rsActualizarHorario();
});

function initializeApp(){
    setupEventListeners();
    cargarUsuarios();
    cargarSedes();
    setupSidebarToggle();
    setupProfileMenu();
}

function initializeTrabajadorFeatures(){
    initializeFormularioEntrada();
    initializeMarcas();
    setupGlobalEventDelegation();
    updateInterval = setInterval(function(){
        var a=document.querySelector('.aparca-sidebar-nav a.active');
        if (a && a.getAttribute('data-tab')==='gestion'){loadVehiculosActivos();loadPendientesCobro();}
    },30000);
    setInterval(cargarEstadisticas,60000);
}

// ==================== BANNER SEDE CON IMAGEN ====================
async function cargarBannerSede(){
    try {
        var res = await fetch(API_BASE_URL+'/sedes');
        if (!res.ok) return;
        var sedes = await res.json();
        if (!sedes||!sedes.length) return;
        var s = sedes[0];
        function set(id,v){var el=document.getElementById(id);if(el)el.textContent=v||'—';}
        set('sedeHeaderNombre',    s.nombre);
        set('sedeHeaderDireccion', s.direccion);
        set('sedeHeaderEstado',    s.estado);
        set('ind-sede-nombre',     s.nombre);
        if (s.imagenSede){
            var img         = document.getElementById('sedeHeaderImg');
            var placeholder = document.getElementById('sedeHeaderPlaceholder');
            if (img){
                img.src = '/'+s.imagenSede;
                img.style.display='block';
                img.onerror=function(){img.style.display='none';if(placeholder)placeholder.style.display='flex';};
            }
            if (placeholder) placeholder.style.display='none';
        }
    } catch(e){console.warn('Banner sede:',e);}
}

// ==================== INDICADORES ====================
async function cargarEstadisticas(){
    try {
        var res = await fetch(API_BASE_URL+'/indicadores');
        if (!res.ok) return;
        var d = await res.json();
        function set(id,v){var el=document.getElementById(id);if(el)el.textContent=v;}
        set('ind-ocupacion',     (d.ocupacionActual||0)+' veh.');
        set('ind-ocupacion-sub', 'de '+(d.capacidadTotal||0)+' cupos totales');
        set('ind-cupos',         d.cuposLibres||0);
        set('ind-cupos-sub',     'de '+(d.capacidadTotal||0)+' totales');
        set('ind-ingresos',      '$'+formatNumber(d.ingresosDia||0));
        set('ind-vehiculos-hoy', d.vehiculosHoy||0);
        set('ind-pendientes',    d.pendientesCobro||0);
        set('ind-porcentaje',    (d.porcentajeOcupacion||0)+'%');
        set('ind-sede-nombre',   d.sedeNombre||'—');
        var pct=d.porcentajeOcupacion||0;
        var ic=document.getElementById('ind-pct-icon');
        if (ic) ic.className='ind-icon '+(pct>=90?'ind-orange':pct>=70?'ind-yellow':'ind-purple');
    } catch(e){console.error('Indicadores:',e);}
}

// ==================== FILTRO DE PERÍODO ====================
function setPeriodo(tipo){
    periodoActual = tipo;
    if (tipo==='custom'){
        var d=document.getElementById('periodoDesde');
        var h=document.getElementById('periodoHasta');
        periodoDesde = d?d.value:null;
        periodoHasta = h?h.value:null;
        if (!periodoDesde||!periodoHasta){showNotification('Selecciona ambas fechas','warning');return;}
        if (periodoDesde>periodoHasta){showNotification('La fecha de inicio no puede ser mayor que la fecha fin','warning');return;}
    }
    ['hoy','semana','mes','anio'].forEach(function(p){
        var btn=document.getElementById('btn-periodo-'+p);
        if (btn) btn.classList.toggle('active', p===tipo);
    });
    cargarGraficas();
}

function onPeriodoCustomChange(){
    var d=document.getElementById('periodoDesde');
    var h=document.getElementById('periodoHasta');
    if (d&&h&&d.value&&h.value) setPeriodo('custom');
}

// ==================== GRÁFICAS ====================
async function cargarGraficas(){
    try {
        var rango  = calcularRangoFechas(periodoActual);
        var url    = API_BASE_URL+'/graficas?desde='+rango.desde+'&hasta='+rango.hasta;
        var res    = await fetch(url);
        if (!res.ok) throw new Error('Error al cargar gráficas');
        var data   = await res.json();
        function set(id,v){var el=document.getElementById(id);if(el)el.textContent=v;}
        set('ingresosHoy',  '$'+formatNumber(data.ingresosHoy||0));
        set('ingresosMes',  '$'+formatNumber(data.ingresosMes||0));
        set('ingresosAnio', '$'+formatNumber(data.ingresosAnio||0));
        set('ingresosPeriodo','$'+formatNumber(data.ingresosRango||0));
        set('labelPeriodo', rango.label);
        set('graficaTituloPeriodo','— '+rango.label);
        set('reportePeriodoLabel', rango.label);
        renderChartIngresos(data, rango);
        renderChartOcupacion(data);
    } catch(e){
        console.error('Gráficas:',e);
        showNotification('Error al cargar los datos de gráficas','error');
    }
}

function renderChartIngresos(data, rango){
    var canvas=document.getElementById('chartIngresos'); if(!canvas) return;
    if (chartIngresos){chartIngresos.destroy();chartIngresos=null;}
    var labels, valores;
    if (data.serieRango&&data.serieRango.length>0){
        labels  = data.serieRango.map(function(p){var pts=p.fecha.split('-');return pts[2]+'/'+pts[1];});
        valores = data.serieRango.map(function(p){return parseFloat(p.ingresos||0);});
    } else {
        labels  = ['Hoy','Este Mes','Este Año'];
        valores = [parseFloat(data.ingresosHoy||0),parseFloat(data.ingresosMes||0),parseFloat(data.ingresosAnio||0)];
    }
    chartIngresos = new Chart(canvas,{
        type:'bar',
        data:{labels:labels, datasets:[{
                label:'Ingresos (COP)', data:valores,
                backgroundColor:'#0d9488', borderColor:'#0d9488',
                borderWidth:2, borderRadius:8, borderSkipped:false
            }]},
        options:{responsive:true,
            plugins:{legend:{display:false},
                tooltip:{callbacks:{label:function(ctx){return ' $'+ctx.parsed.y.toLocaleString('es-CO');}}}},
            scales:{
                y:{beginAtZero:true,
                    ticks:{callback:function(v){return '$'+v.toLocaleString('es-CO');}},
                    grid:{color:'#f1f5f9'}},
                x:{grid:{display:false},
                    ticks:{maxRotation:labels.length>10?45:0,font:{size:labels.length>15?9:11}}}
            }}
    });
}

function renderChartOcupacion(data){
    var canvas=document.getElementById('chartOcupacion'); if(!canvas) return;
    if (chartOcupacion){chartOcupacion.destroy();chartOcupacion=null;}
    var oc=data.ocupacion||{};
    var car=oc.carro||{activos:0,capacidad:0};
    var mot=oc.moto||{activos:0,capacidad:0};
    var bic=oc.bicicleta||{activos:0,capacidad:0};
    chartOcupacion = new Chart(canvas,{
        type:'bar',
        data:{
            labels:['\uD83D\uDE97 Carros','\uD83C\uDFCD\uFE0F Motos','\uD83D\uDEB2 Bicicletas'],
            datasets:[
                {label:'Ocupados',    data:[car.activos,mot.activos,bic.activos],
                    backgroundColor:'#0d9488',borderRadius:6,borderSkipped:false},
                {label:'Disponibles', data:[Math.max(0,car.capacidad-car.activos),Math.max(0,mot.capacidad-mot.activos),Math.max(0,bic.capacidad-bic.activos)],
                    backgroundColor:'#ccfbf1',borderRadius:6,borderSkipped:false}
            ]
        },
        options:{responsive:true,
            plugins:{legend:{display:true,position:'bottom',labels:{boxWidth:14,font:{size:12}}},
                tooltip:{callbacks:{label:function(ctx){return ' '+ctx.dataset.label+': '+ctx.parsed.y+' cupos';}}}},
            scales:{x:{stacked:true,grid:{display:false}},
                y:{stacked:true,beginAtZero:true,ticks:{precision:0},grid:{color:'#f1f5f9'}}}}
    });
}

// ==================== REPORTES ESTADÍSTICOS ====================
async function exportarReportePDF(){
    var rango=calcularRangoFechas(periodoActual);
    try {
        var res=await fetch(API_BASE_URL+'/reporte/estadistico/pdf?desde='+rango.desde+'&hasta='+rango.hasta);
        if (!res.ok) throw new Error('Error al generar PDF');
        var blob=await res.blob();
        var a=document.createElement('a');
        a.href=window.URL.createObjectURL(blob);
        a.download='reporte_'+rango.desde+'_'+rango.hasta+'.pdf';
        document.body.appendChild(a);a.click();
        window.URL.revokeObjectURL(a.href);document.body.removeChild(a);
        showNotification('Reporte PDF generado correctamente','success');
    } catch(e){showNotification('Error al generar el reporte PDF','error');}
}

async function exportarReporteExcel(){
    var rango=calcularRangoFechas(periodoActual);
    try {
        var res=await fetch(API_BASE_URL+'/reporte/estadistico/excel?desde='+rango.desde+'&hasta='+rango.hasta);
        if (!res.ok) throw new Error('Error al generar Excel');
        var blob=await res.blob();
        var a=document.createElement('a');
        a.href=window.URL.createObjectURL(blob);
        a.download='reporte_'+rango.desde+'_'+rango.hasta+'.xlsx';
        document.body.appendChild(a);a.click();
        window.URL.revokeObjectURL(a.href);document.body.removeChild(a);
        showNotification('Reporte Excel generado correctamente','success');
    } catch(e){showNotification('Error al generar el reporte Excel','error');}
}

// ==================== HISTORIAL — limpiar filtro ====================
function limpiarFiltroHistorial(){
    var f=document.getElementById('filtroFecha');
    var e=document.getElementById('filtroEstado1');
    if (f) f.value=''; if (e) e.value='';
    var tb=document.getElementById('historialBody');
    if (tb) tb.innerHTML='<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:2rem;">Seleccione filtros y presione Filtrar</td></tr>';
}

// ==================== NAVEGACIÓN ====================
function setupEventListeners(){
    document.querySelectorAll('.aparca-sidebar-nav a').forEach(function(link){
        link.addEventListener('click',handleNavigation);
    });
    var map={'btnUsuarios':function(){switchToTab('usuarios');},'btnSedes':function(){switchToTab('sedes');},'tab-mailuno':function(){switchMailTab('uno');},'tab-mailmasivo':function(){switchMailTab('masivo');}};
    Object.keys(map).forEach(function(id){var el=document.getElementById(id);if(el)el.addEventListener('click',map[id]);});
    var bi=document.getElementById('busquedaInput');
    var fe=document.getElementById('filtroEstado');
    if (bi) bi.addEventListener('input',filtrarDatos);
    if (fe) fe.addEventListener('change',filtrarDatos);
    var mt=document.getElementById('registrarTrabajadorModal');
    if (mt) mt.addEventListener('click',function(e){if(e.target===this)closeRegistrarTrabajadorModal();});
}

function handleNavigation(e){
    e.preventDefault();
    document.querySelectorAll('.aparca-sidebar-nav a').forEach(function(l){l.classList.remove('active');});
    e.currentTarget.classList.add('active');
    var tab=e.currentTarget.getAttribute('data-tab');
    document.querySelectorAll('.aparca-content-section').forEach(function(s){s.classList.add('hidden');});
    var sec=document.getElementById(tab); if(sec) sec.classList.remove('hidden');
    if (tab==='gestion'){loadVehiculosActivos();loadPendientesCobro();}
    if (tab==='historial') loadHistorial();
    if (tab==='reservaciones') loadReservaciones();
    if (tab==='graficas') cargarGraficas();
    if (window.innerWidth<640) document.body.classList.add('sidebar-collapsed');
}

function switchToTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.sede-tabs button').forEach(function(b) { b.classList.remove('active'); });
    var bu=document.getElementById('btnUsuarios'), bs=document.getElementById('btnSedes');
    var tablaU=document.getElementById('tablaUsuarios'), tablaS=document.getElementById('tablaSedes');
    var btnT=document.getElementById('btnAbrirRegistrarTrabajador'), btnS=document.getElementById('btnAbrirRegistrarSede');
    if (tab === 'usuarios') {
        if (bu) bu.classList.add('active');
        if (tablaU) tablaU.classList.remove('hidden');
        if (tablaS) tablaS.classList.add('hidden');
        if (btnT) btnT.style.display = '';
        if (btnS) btnS.style.display = 'none';
    } else {
        if (bs) bs.classList.add('active');
        if (tablaU) tablaU.classList.add('hidden');
        if (tablaS) tablaS.classList.remove('hidden');
        if (btnT) btnT.style.display = 'none';
        if (btnS) btnS.style.display = '';
    }
    filtrarDatos();
}

function switchMailTab(tipo){
    document.querySelectorAll('#correo .sede-tabs button').forEach(function(b){b.classList.remove('active');});
    var tu=document.getElementById('tab-mailuno'),tm=document.getElementById('tab-mailmasivo');
    var cu=document.getElementById('correoUno'), cm=document.getElementById('correoMasivo');
    if (tipo==='uno'){if(tu)tu.classList.add('active');if(cu)cu.removeAttribute('hidden');if(cm)cm.setAttribute('hidden','');}
    else{if(tm)tm.classList.add('active');if(cu)cu.setAttribute('hidden','');if(cm)cm.removeAttribute('hidden');}
}

// ==================== CARGA DE DATOS ====================
async function cargarUsuarios(){
    try{var r=await fetch(API_BASE_URL+'/usuarios');if(r.ok){usuariosData=await r.json();mostrarUsuarios(usuariosData);}
    else showNotification('No se pudieron cargar los usuarios','error');}
    catch(e){showNotification('Error de conexión al cargar usuarios','error');}
}
async function cargarSedes(){
    try{var r=await fetch(API_BASE_URL+'/sedes');if(r.ok){sedesData=await r.json();mostrarSedes(sedesData);}
    else showNotification('No se pudieron cargar las sedes','error');}
    catch(e){showNotification('Error de conexión al cargar sedes','error');}
}

// ==================== VISUALIZACIÓN ====================
function mostrarUsuarios(usuarios){
    var tb=document.getElementById('usuariosTableBody'); if(!tb) return;
    if (!usuarios.length){tb.innerHTML='<tr><td colspan="5" style="text-align:center;color:#64748b;">No hay usuarios registrados</td></tr>';return;}
    tb.innerHTML=usuarios.map(function(u){
        return '<tr><td>'+(u.nombre||'N/A')+'</td><td>'+(u.correo||'N/A')+'</td>' +
            '<td>'+(u.telefono||'N/A')+'</td>' +
            '<td><span class="sede-badge sede-badge-info">'+(u.rol||'N/A')+'</span></td>' +
            '<td><span class="sede-badge '+(u.estado==='ACTIVO'?'sede-badge-success':'sede-badge-danger')+'">'+(u.estado||'N/A')+'</span></td></tr>';
    }).join('');
}

function mostrarSedes(sedes){
    var tb=document.getElementById('sedesTableBody'); if(!tb) return;
    if (!sedes.length){tb.innerHTML='<tr><td colspan="5" style="text-align:center;color:#64748b;">No tiene sede asignada</td></tr>';return;}
    tb.innerHTML=sedes.map(function(s){
        var pct=s.capacidad>0?Math.round(((s.ocupacionActual||0)/s.capacidad)*100):0;
        var bc=pct>80?'#ef4444':pct>50?'#f59e0b':'#10b981';
        return '<tr>' +
            '<td><strong>'+(s.nombre||'N/A')+'</strong><div style="font-size:.75rem;color:#64748b;margin-top:2px;">'+(s.direccion||'')+'</div></td>' +
            '<td>'+(s.capacidad||0)+' cupos</td>' +
            '<td><div style="display:flex;align-items:center;gap:.5rem;">' +
            '<div style="flex:1;background:#f1f5f9;border-radius:9999px;height:8px;overflow:hidden;">' +
            '<div style="width:'+pct+'%;height:100%;background:'+bc+';border-radius:9999px;transition:width .6s;"></div></div>' +
            '<span style="font-size:.75rem;font-weight:700;color:#374151;min-width:32px;">'+pct+'%</span></div></td>' +
            '<td><span class="sede-badge '+(s.estado==='ACTIVO'?'sede-badge-success':'sede-badge-danger')+'">'+(s.estado||'N/A')+'</span></td>' +
            '<td><button class="sede-btn-primary" style="font-size:.8rem;padding:.4rem .875rem;white-space:nowrap;" onclick="gestionarSede('+s.id+')">⚙️ Gestionar</button></td>' +
            '</tr>';
    }).join('');
}

function gestionarSede(id){
    var l=document.querySelector('.aparca-sidebar-nav a[data-tab="gestion"]');
    if(l) l.click();
}

// ==================== FILTRADO ====================
function filtrarDatos(){
    var bi=document.getElementById('busquedaInput');
    var fe=document.getElementById('filtroEstado');
    var b=bi?bi.value.toLowerCase():'', e=fe?fe.value.toLowerCase():'';
    if (currentTab==='usuarios'){
        mostrarUsuarios(usuariosData.filter(function(u){
            var mb=!b||[u.nombre,u.correo,u.rol].some(function(v){return v&&v.toLowerCase().includes(b);});
            var me=!e||(u.estado&&u.estado.toLowerCase()===e);
            return mb&&me;}));
    } else {
        mostrarSedes(sedesData.filter(function(s){
            var mb=!b||[s.nombre,s.direccion].some(function(v){return v&&v.toLowerCase().includes(b);});
            var me=!e||(s.estado&&s.estado.toLowerCase()===e);
            return mb&&me;}));
    }
}

// ==================== MARCAS ====================
function actualizarMarcasEntrada(){
    var ts=document.getElementById('tipoVehiculo'), ms=document.getElementById('marca');
    if (!ts||!ms) return;
    var tipo=ts.value;
    ms.innerHTML='<option value="">Selecciona una marca</option>';
    if (tipo&&marcasPorTipo[tipo]){
        marcasPorTipo[tipo].forEach(function(m){
            var o=document.createElement('option');
            o.value=m; o.textContent=formatMarcaName(m); ms.appendChild(o);
        });
    }
}
function initializeMarcas(){
    var ts=document.getElementById('tipoVehiculo');
    if (ts){ts.addEventListener('change',actualizarMarcasEntrada);actualizarMarcasEntrada();}
}

// ==================== VALIDACIÓN ====================
function validateFieldEntrada(fId){
    var f=document.getElementById(fId), err=document.getElementById(fId+'-error');
    if (!f) return true;
    var ok=true, msg='', v=f.value.trim();
    switch(fId){
        case 'nombre':      if (!v){ok=false;msg='El nombre es obligatorio.';}else if(v.length<2){ok=false;msg='Al menos 2 caracteres.';} break;
        case 'correo1':     if (!v){ok=false;msg='El correo es obligatorio.';}else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)){ok=false;msg='Formato inválido.';} break;
        case 'telefono':    if (!v){ok=false;msg='El teléfono es obligatorio.';}else if(!/^[0-9]{10}$/.test(v)){ok=false;msg='Debe tener 10 dígitos.';} break;
        case 'cedula':      if (!v){ok=false;msg='La cédula es obligatoria.';}else if(!/^[0-9]{10}$/.test(v)){ok=false;msg='Debe tener 10 dígitos.';} break;
        case 'placa':       if (!v){ok=false;msg='La placa es obligatoria.';}else if(!/^[A-Z]{3}[0-9]{3}$/.test(v)){ok=false;msg='Formato: ABC123';} break;
        case 'tipoVehiculo':if (!v){ok=false;msg='Selecciona el tipo.';} break;
        case 'marca':       if (!v){ok=false;msg='Selecciona la marca.';} break;
    }
    if (err) err.textContent=ok?'':msg;
    f.classList.toggle('border-red-500',!ok);
    f.classList.toggle('border-green-500',ok&&v!=='');
    return ok;
}
function validateFormularioEntrada(){
    var campos=modoRapido?['placa','tipoVehiculo']:['nombre','correo1','telefono','cedula','placa','tipoVehiculo','marca'];
    return campos.map(validateFieldEntrada).every(Boolean);
}
function limpiarFormularioEntrada(){
    ['nombre','telefono','correo1','cedula','placa','color','anio','buscarPlaca'].forEach(function(id){setInputValue(id,'');});
    var t=document.getElementById('tipoVehiculo');if(t)t.value='';
    var m=document.getElementById('marca');if(m)m.innerHTML='<option value="">Selecciona una marca</option>';
    ['nombre','correo1','telefono','cedula','placa','tipoVehiculo','marca'].forEach(function(id){
        var e=document.getElementById(id+'-error');if(e)e.textContent='';
        var f=document.getElementById(id);if(f)f.classList.remove('border-red-500','border-green-500');
    });
}

// ==================== MODO RÁPIDO ====================
function toggleModoRegistro(){
    modoRapido=document.getElementById('modoRapidoToggle').checked;
    var campos=document.getElementById('camposCompletos');
    var badge=document.getElementById('badgeModo');
    var slider=document.getElementById('toggleSlider');
    var knob=document.getElementById('toggleKnob');
    var txt=document.getElementById('btnRegistrarTexto');
    if (modoRapido){
        if(campos){campos.style.maxHeight='0';campos.style.opacity='0';}
        if(badge){badge.textContent='⚡ RÁPIDO';badge.style.background='#0d9488';badge.style.color='white';}
        if(slider)slider.style.background='#0d9488';
        if(knob)knob.style.transform='translateX(20px)';
        if(txt)txt.textContent='⚡ Registrar Rápido';
        ['nombre','correo1','telefono','cedula','marca'].forEach(function(id){
            var e=document.getElementById(id+'-error');var f=document.getElementById(id);
            if(e)e.textContent='';if(f)f.classList.remove('border-red-500','border-green-500');
        });
    } else {
        if(campos){campos.style.maxHeight='800px';campos.style.opacity='1';}
        if(badge){badge.textContent='COMPLETO';badge.style.background='#e2e8f0';badge.style.color='#475569';}
        if(slider)slider.style.background='#cbd5e1';
        if(knob)knob.style.transform='translateX(0)';
        if(txt)txt.textContent='Registrar Entrada';
    }
}

// ==================== FORMULARIO ENTRADA ====================
function initializeFormularioEntrada(){
    var form=document.getElementById('registroEntradaForm');
    if (form){
        form.addEventListener('submit',async function(e){e.preventDefault();await registrarEntradaDirecto();});
        ['nombre','telefono','correo1','cedula','placa','tipoVehiculo','marca'].forEach(function(cId){
            var c=document.getElementById(cId);
            if(c){
                c.addEventListener('blur',function(){validateFieldEntrada(cId);});
                c.addEventListener('input',function(){var e=document.getElementById(cId+'-error');if(e&&c.value.trim()){e.textContent='';c.classList.remove('border-red-500');}});
            }
        });
        var tel=document.getElementById('telefono');if(tel)tel.addEventListener('input',function(e){e.target.value=e.target.value.replace(/[^0-9]/g,'').slice(0,10);});
        var ced=document.getElementById('cedula');  if(ced)ced.addEventListener('input',function(e){e.target.value=e.target.value.replace(/[^0-9]/g,'').slice(0,10);});
        var plc=document.getElementById('placa');   if(plc)plc.addEventListener('input',function(e){e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').substring(0,6);});
    }
    var bp=document.getElementById('buscarPlaca');
    if(bp){
        bp.addEventListener('input',function(e){e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'');});
        bp.addEventListener('keypress',function(e){if(e.key==='Enter'){e.preventDefault();buscarPorPlacaIntegrado();}});
    }
}

async function registrarEntradaDirecto(){
    if (!validateFormularioEntrada()){showNotification(modoRapido?'Ingresa la placa y el tipo de vehículo':'Completa todos los campos requeridos','error');return;}
    try {
        var placa=getInputValue('placa'), tipo=getInputValue('tipoVehiculo');
        var datos={vehiculoPlaca:placa,vehiculoTipo:tipo,
            vehiculoMarca:getInputValue('marca')||'OTRO',
            vehiculoColor:getInputValue('color')||'NO ESPECIFICADO',
            vehiculoAnio:getInputValue('anio')||'2020'};
        if (modoRapido){
            datos.clienteNombre='Visitante';datos.clienteTelefono='';
            datos.clienteEmail=placa.toLowerCase()+'@temp.aparcaya.co';datos.clienteCedula='';
            showNotification('Registrando entrada rápida...','info');
        } else {
            datos.clienteNombre=getInputValue('nombre');datos.clienteTelefono=getInputValue('telefono');
            datos.clienteEmail=getInputValue('correo1');datos.clienteCedula=getInputValue('cedula');
            showNotification('Registrando entrada...','info');
        }
        var r=await fetch(API_BASE_URL+'/registrar-entrada',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(datos)});
        if (!r.ok){var err=await r.json();throw new Error(err.error||'Error al registrar entrada');}
        var result=await r.json();
        showNotification(modoRapido?'⚡ Placa '+placa+' registrada. Cupo: '+(result.cupo||'S/A'):'✅ Entrada de '+result.clienteNombre+'. Cupo: '+(result.cupo||'S/A'),'success');
        limpiarFormularioEntrada();
        setTimeout(function(){loadVehiculosActivos();},400);
    } catch(e){showNotification(e.message,'error');}
}

async function buscarPorPlacaIntegrado(){
    var placa=getInputValue('buscarPlaca');
    if (!placa||placa.length<5){showNotification('Ingrese una placa válida','warning');return;}
    try {
        var r=await fetch(API_BASE_URL+'/buscar-por-placa/'+placa,{headers:{'Content-Type':'application/json'}});
        if (!r.ok) throw new Error('Error');
        var data=await r.json();
        if (data.encontrado){
            setInputValue('nombre',data.cliente.nombre);setInputValue('telefono',data.cliente.telefono);
            setInputValue('correo1',data.cliente.email);setInputValue('cedula',data.cliente.cedula||'');
            setInputValue('placa',data.vehiculo.placa);setInputValue('color',data.vehiculo.color);
            var ts=document.getElementById('tipoVehiculo');
            if(ts){ts.value=data.vehiculo.tipo;actualizarMarcasEntrada();setTimeout(function(){var m=document.getElementById('marca');if(m)m.value=data.vehiculo.marca;},100);}
            if(data.vehiculo.anio)setInputValue('anio',data.vehiculo.anio);
            if(modoRapido){var tog=document.getElementById('modoRapidoToggle');if(tog){tog.checked=false;toggleModoRegistro();}}
            showNotification('✅ Vehículo encontrado — datos cargados','success');
        } else {
            limpiarFormularioEntrada();setInputValue('placa',placa);
            showNotification('Vehículo nuevo. Complete los datos.','info');
        }
    } catch(e){showNotification('Error al buscar','error');}
}

// ==================== VEHÍCULOS ACTIVOS ====================
async function loadVehiculosActivos(){
    try {
        var r=await fetch(API_BASE_URL+'/vehiculos-activos',{headers:{'Content-Type':'application/json'}});
        if (!r.ok) throw new Error('Error');
        var vehiculos=await r.json();
        var tb=document.getElementById('vehiculosActivosBody'); if(!tb) return;
        Object.values(timerIntervals).forEach(function(id){clearInterval(id);}); timerIntervals={};
        if (!vehiculos.length){tb.innerHTML='<tr><td colspan="8" style="text-align:center;">No hay vehículos en el parqueadero</td></tr>';return;}
        tb.innerHTML=vehiculos.map(function(v){
            return '<tr><td><strong>'+v.placa+'</strong></td><td>'+v.tipoVehiculo+'</td>' +
                '<td>'+v.clienteNombre+'</td><td>'+v.clienteTelefono+'</td>' +
                '<td>'+formatDateTime(v.horaEntrada)+'</td>' +
                '<td><span class="tiempo-activo" id="timer-'+v.registroId+'">'+v.tiempoTranscurrido+'</span></td>' +
                '<td><div style="font-size:.85rem;"><div><strong>Plena:</strong> $'+formatNumber(v.cobroEstimadoPlena)+'</div>' +
                '<div style="color:#059669;"><strong>Minuto:</strong> $'+formatNumber(v.cobroEstimadoMinuto)+'</div></div></td>' +
                '<td><button class="sede-btn-warning sede-btn-salida" data-id="'+v.registroId+'">Salida</button></td></tr>';
        }).join('');
        vehiculos.forEach(function(v){
            var el=document.getElementById('timer-'+v.registroId); if(!el) return;
            var secs=v.segundosTranscurridos;
            timerIntervals[v.registroId]=setInterval(function(){
                secs++; var h=Math.floor(secs/3600),m=Math.floor((secs%3600)/60),s=secs%60;
                if(h>0)el.textContent=h+'h '+m+'m '+s+'s';
                else if(m>0)el.textContent=m+'m '+s+'s';
                else el.textContent=s+'s';
            },1000);
        });
    } catch(e){showNotification('Error al cargar vehículos activos','error');}
}

// ==================== MODAL SALIDA ====================
async function abrirModalSalida(registroId){
    var modal=document.getElementById('salidaModal');
    if(!modal){showNotification('Error: Modal no encontrado','error');return;}
    try {
        currentSalidaRegistroId=registroId;
        var r=await fetch(API_BASE_URL+'/vehiculos-activos',{headers:{'Content-Type':'application/json'}});
        if(!r.ok) throw new Error('Error');
        var vehiculos=await r.json();
        var v=vehiculos.find(function(x){return x.registroId===registroId;});
        if(!v){showNotification('Vehículo no encontrado','error');return;}
        function set(id,v){var el=document.getElementById(id);if(el)el.textContent=v;}
        set('salidaPlaca',v.placa);set('salidaCliente',v.clienteNombre);
        set('salidaHoraEntrada',formatDateTime(v.horaEntrada));set('salidaTiempo',v.tiempoTranscurrido);
        var ec=document.getElementById('salidaCobroEstimado');
        if(ec)ec.innerHTML='<div class="sede-modal-salida-row"><strong>Plena:</strong><span>$'+formatNumber(v.cobroEstimadoPlena)+'</span></div>' +
            '<div class="sede-modal-salida-row"><strong>Minuto:</strong><span style="color:#059669;">$'+formatNumber(v.cobroEstimadoMinuto)+'</span></div>';
        modal.classList.add('open');modal.setAttribute('aria-hidden','false');
    } catch(e){showNotification('Error al abrir modal de salida','error');}
}
function cerrarModalSalida(){
    var m=document.getElementById('salidaModal');
    if(m){m.classList.remove('open');m.setAttribute('aria-hidden','true');}
    currentSalidaRegistroId=null;
}
async function confirmarSalida(){
    if(!currentSalidaRegistroId) return;
    try {
        showNotification('Registrando salida...','info');
        var r=await fetch(API_BASE_URL+'/registrar-salida/'+currentSalidaRegistroId,{method:'POST',headers:{'Content-Type':'application/json'}});
        if(!r.ok){var err=await r.json();throw new Error(err.error||'Error');}
        showNotification('Salida registrada. Proceda a cobrar.','success');
        cerrarModalSalida();await loadVehiculosActivos();await loadPendientesCobro();
    } catch(e){showNotification(e.message,'error');}
}

// ==================== PENDIENTES COBRO ====================
async function loadPendientesCobro(){
    try {
        var r=await fetch(API_BASE_URL+'/vehiculos-pendientes-cobro',{headers:{'Content-Type':'application/json'}});
        if(!r.ok) throw new Error('Error');
        var pendientes=await r.json();
        var tb=document.getElementById('pendientesCobroBody'); if(!tb) return;
        if(!pendientes.length){tb.innerHTML='<tr><td colspan="7" style="text-align:center;">No hay pendientes</td></tr>';return;}
        tb.innerHTML=pendientes.map(function(p){
            return '<tr><td><strong>'+p.placa+'</strong></td><td>'+p.clienteNombre+'</td>' +
                '<td>'+formatDateTime(p.horaEntrada)+'</td><td>'+formatDateTime(p.horaSalida)+'</td>' +
                '<td>'+p.tiempoTotal+'</td>' +
                '<td style="font-weight:700;color:#059669;">$'+formatNumber(p.precio)+'</td>' +
                '<td><button class="sede-btn-success sede-btn-cobrar" data-id="'+p.registroId+'">Cobrar</button></td></tr>';
        }).join('');
    } catch(e){console.error('Pendientes cobro:',e);}
}

// ==================== MODAL COBRO ====================
async function abrirModalCobro(registroId){
    currentCobroRegistroId=registroId;
    var modal=document.getElementById('cobroModal'); if(!modal) return;
    modal.classList.add('open');modal.setAttribute('aria-hidden','false');
    try {
        var r=await fetch(API_BASE_URL+'/opciones-cobro/'+registroId,{headers:{'Content-Type':'application/json'}});
        if(!r.ok){var err=await r.json();throw new Error(err.error||'Error');}
        var data=await r.json();
        opcionesTarifa=data;
        function set(id,v){var el=document.getElementById(id);if(el)el.textContent=v;}
        set('cobroCliente',data.clienteNombre);set('cobroPlaca',data.placa);set('cobroTiempo',data.tiempoTotal);
        var cont=document.getElementById('tarifaSelectorContainer');
        if(cont){cont.innerHTML='<div class="sede-modal-cobro-selector"><p>Seleccione tarifa:</p>' +
            data.opciones.map(function(op,i){
                return '<label class="sede-modal-cobro-opcion"><input type="radio" name="tipoTarifa" value="'+op.tipo+'"'+(i===0?' checked':'')+' onchange="actualizarPrecioCobro(\''+op.tipo+'\','+op.precio+')"><strong>'+op.nombre+'</strong><div>$'+formatNumber(op.precio)+' COP</div></label>';
            }).join('')+'</div>';}
        var ep=document.getElementById('cobroPrecio');if(ep&&data.opciones[0])ep.textContent=formatNumber(data.opciones[0].precio);
    } catch(e){showNotification(e.message,'error');cerrarModalCobro();}
}
function actualizarPrecioCobro(tipo,precio){var el=document.getElementById('cobroPrecio');if(el)el.textContent=formatNumber(precio);}
function cerrarModalCobro(){
    var m=document.getElementById('cobroModal');
    if(m){m.classList.remove('open');m.setAttribute('aria-hidden','true');}
    currentCobroRegistroId=null;opcionesTarifa=null;
    var c=document.getElementById('tarifaSelectorContainer');if(c)c.innerHTML='';
}
async function procesarCobro(){
    if(!currentCobroRegistroId) return;
    try {
        var mp=document.getElementById('metodoPago');
        var metodoPago=mp?mp.value:'EFECTIVO';
        var tt=document.querySelector('input[name="tipoTarifa"]:checked');
        if(!tt){showNotification('Seleccione una tarifa','warning');return;}
        showNotification('Procesando cobro...','info');
        var r=await fetch(API_BASE_URL+'/confirmar-cobro/'+currentCobroRegistroId,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({metodoPago:metodoPago,tipoTarifa:tt.value})});
        if(!r.ok){var err=await r.json();throw new Error(err.error||'Error');}
        var data=await r.json();
        showNotification('Cobro: $'+formatNumber(data.precio)+' - '+data.tipoTarifaAplicada,'success');
        cerrarModalCobro();await loadPendientesCobro();
    } catch(e){showNotification(e.message,'error');}
}

// ==================== HISTORIAL ====================
async function loadHistorial(){
    try {
        var fe=document.getElementById('filtroFecha');
        var es=document.getElementById('filtroEstado1');
        var fecha=fe?fe.value:'', estado=es?es.value:'';
        var url=API_BASE_URL+'/historial', params=new URLSearchParams();
        if(fecha)params.append('fecha',fecha);
        if(estado)params.append('estado',estado);
        if(params.toString())url+='?'+params.toString();
        var r=await fetch(url,{headers:{'Content-Type':'application/json'}});
        if(!r.ok) throw new Error('Error');
        var registros=await r.json();
        var tb=document.getElementById('historialBody'); if(!tb) return;
        if(!registros.length){tb.innerHTML='<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:2rem;">Sin registros para los filtros seleccionados</td></tr>';return;}
        tb.innerHTML=registros.map(function(r){
            var badge=r.estado==='ACTIVO'?'<span class="sede-badge sede-badge-info">Activo</span>':
                r.estado==='FINALIZADO'?'<span class="sede-badge sede-badge-warning">Pendiente</span>':
                    r.estado==='COBRADO'?'<span class="sede-badge sede-badge-success">Cobrado</span>':
                        '<span class="sede-badge sede-badge-danger">Cancelado</span>';
            return '<tr><td><strong>'+r.placa+'</strong></td><td>'+r.tipoVehiculo+'</td>' +
                '<td>'+r.clienteNombre+'</td><td>'+r.clienteTelefono+'</td>' +
                '<td>'+formatDateTime(r.horaEntrada)+'</td>' +
                '<td>'+(r.horaSalida?formatDateTime(r.horaSalida):'-')+'</td>' +
                '<td>'+r.tiempoTotal+'</td>' +
                '<td>'+(r.precio?'$'+formatNumber(r.precio):'-')+'</td>' +
                '<td>'+badge+'</td></tr>';
        }).join('');
    } catch(e){console.error('Historial:',e);}
}

// ==================== RESERVACIONES ====================
async function loadReservaciones(){
    try {
        var r=await fetch(API_BASE_URL+'/reservaciones',{headers:{'Content-Type':'application/json'}});
        if(!r.ok) throw new Error('Error');
        var reservas=await r.json();
        var tb=document.getElementById('reservacionesBody'); if(!tb) return;
        if(!reservas.length){tb.innerHTML='<tr><td colspan="8" style="text-align:center;">Sin reservaciones pendientes</td></tr>';return;}
        tb.innerHTML=reservas.map(function(r){
            return '<tr><td>'+r.clienteNombre+'</td><td>'+r.clienteTelefono+'</td>' +
                '<td><strong>'+r.placa+'</strong></td><td>'+r.tipoVehiculo+'</td>' +
                '<td>'+formatDateTime(r.horaInicio)+'</td><td>'+formatDateTime(r.horaFin)+'</td>' +
                '<td><span class="sede-badge sede-badge-info">'+r.cupo+'</span></td>' +
                '<td><button class="sede-btn-success sede-btn-aceptar" data-id="'+r.id+'">Aceptar</button> ' +
                '<button class="sede-btn-danger sede-btn-rechazar" data-id="'+r.id+'">Rechazar</button></td></tr>';
        }).join('');
    } catch(e){console.error('Reservaciones:',e);}
}

async function aceptarReservacion(id){
    var ok=await showConfirm('Aceptar reservación','¿Confirmas aceptar esta reservación?','Aceptar','warning');
    if(!ok) return;
    try {
        var r=await fetch(API_BASE_URL+'/aceptar-reservacion/'+id,{method:'POST',headers:{'Content-Type':'application/json'}});
        if(!r.ok) throw new Error('Error');
        showNotification('Reservación aceptada','success');
        await loadReservaciones();await loadVehiculosActivos();
    } catch(e){showNotification('Error al aceptar reservación','error');}
}

async function rechazarReservacion(id){
    var ok=await showConfirm('Rechazar reservación','¿Confirmas rechazar esta reservación?','Rechazar','danger');
    if(!ok) return;
    try {
        var r=await fetch(API_BASE_URL+'/rechazar-reservacion/'+id,{method:'POST',headers:{'Content-Type':'application/json'}});
        if(!r.ok) throw new Error('Error');
        showNotification('Reservación rechazada','success');await loadReservaciones();
    } catch(e){showNotification('Error al rechazar reservación','error');}
}

// ==================== CARGA MASIVA ====================
async function cargarExcel(){
    var fi=document.getElementById('excelFile');
    var file=fi?fi.files[0]:null;
    if(!file){showNotification('Por favor seleccione un archivo Excel','warning');return;}
    var ext=file.name.split('.').pop().toLowerCase();
    if(!['xlsx','xls'].includes(ext)){showNotification('El archivo debe ser formato Excel','warning');return;}
    var pc=document.getElementById('progressContainer'),pb=document.getElementById('progressBar'),pt=document.getElementById('progressText');
    try {
        if(pc)pc.style.display='block';if(pb){pb.style.width='30%';pb.textContent='30%';}if(pt)pt.textContent='Subiendo archivo...';
        var formData=new FormData();formData.append('file',file);
        var r=await fetch(API_BASE_URL+'/carga-masiva',{method:'POST',body:formData});
        if(pb){pb.style.width='70%';pb.textContent='70%';}if(pt)pt.textContent='Procesando...';
        if(!r.ok){var ed={};try{ed=await r.json();}catch(e2){}throw new Error(ed.error||'Error al procesar');}
        var data=await r.json();
        if(pb){pb.style.width='100%';pb.textContent='100%';}if(pt)pt.textContent='Completado';
        mostrarResultadosCarga(data);
        showNotification(data.tieneErrores?'Carga completada con '+data.errores.length+' error(es)':'Carga exitosa: '+(data.totalRegistros||0)+' registros',data.tieneErrores?'warning':'success');
        fi.value='';var ai=document.getElementById('archivoSeleccionado');if(ai)ai.innerHTML='';
        setTimeout(function(){if(pc)pc.style.display='none';},2000);
    } catch(e){showNotification('Error: '+e.message,'error');if(pc)pc.style.display='none';}
}

function mostrarResultadosCarga(data){
    var rd=document.getElementById('resultadosCarga');if(rd)rd.style.display='block';
    var res=document.getElementById('resumenCarga');
    if(res)res.innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;">' +
        '<div style="background:linear-gradient(135deg,#d1fae5,#a7f3d0);padding:1.5rem;border-radius:.75rem;text-align:center;"><div style="font-size:2rem;font-weight:700;color:#065f46;">'+(data.clientesRegistrados||0)+'</div><div style="color:#047857;font-weight:600;">Clientes</div></div>' +
        '<div style="background:linear-gradient(135deg,#ccfbf1,#99f6e4);padding:1.5rem;border-radius:.75rem;text-align:center;"><div style="font-size:2rem;font-weight:700;color:#0f766e;">'+(data.vehiculosRegistrados||0)+'</div><div style="color:#0d9488;font-weight:600;">Vehículos</div></div>' +
        '<div style="background:linear-gradient(135deg,#e0f2f1,#b2dfdb);padding:1.5rem;border-radius:.75rem;text-align:center;"><div style="font-size:2rem;font-weight:700;color:#00695c;">'+(data.totalRegistros||0)+'</div><div style="color:#00796b;font-weight:600;">Total</div></div></div>';
    var ec=document.getElementById('erroresContainer'),le=document.getElementById('listaErrores');
    if(data.errores&&data.errores.length){if(ec)ec.style.display='block';if(le)le.innerHTML=data.errores.map(function(e){return '<li>'+e+'</li>';}).join('');}
    else{if(ec)ec.style.display='none';}
    var tb=document.getElementById('resultadosCargaBody');
    if(tb&&data.registrosCargados)tb.innerHTML=data.registrosCargados.map(function(r){
        if(r.tipo==='Vehículo'||r.tipo==='Vehiculo')return '<tr><td><span class="sede-badge sede-badge-info">🚗 '+r.tipo+'</span></td><td><strong>'+(r.placa||'N/A')+'</strong></td><td><strong>'+(r.marca||'N/A')+'</strong> '+(r.tipoVehiculo||'')+'<br><small style="color:#64748b;">Color: '+(r.color||'N/A')+' - Año: '+(r.anio||'N/A')+'</small><br><small style="color:#64748b;">Propietario: '+(r.propietario||'N/A')+'</small></td><td><span class="sede-badge sede-badge-success">✓</span></td></tr>';
        if(r.tipo==='Cliente')return '<tr><td><span class="sede-badge sede-badge-success">👤 '+r.tipo+'</span></td><td><strong>'+(r.nombre||'N/A')+'</strong></td><td>'+(r.email||'N/A')+'<br><small style="color:#64748b;">Tel: '+(r.telefono||'N/A')+'</small></td><td><span class="sede-badge sede-badge-success">✓</span></td></tr>';
        return '';
    }).join('');
}

function descargarPlantillaCompleta(){
    if(typeof XLSX==='undefined'){showNotification('Error: Librería XLSX no está cargada','error');return;}
    var wb=XLSX.utils.book_new();
    var wsC=XLSX.utils.aoa_to_sheet([['Tipo','Nombre','Teléfono','Email','Cédula'],['Cliente','Juan Pérez','0987654321','juan@gmail.com','1234567899']]);
    wsC['!cols']=[{wch:10},{wch:20},{wch:12},{wch:28},{wch:12}];XLSX.utils.book_append_sheet(wb,wsC,'Clientes');
    var wsV=XLSX.utils.aoa_to_sheet([['Tipo','Placa','Tipo Vehículo','Marca','Color','Año','Email Cliente'],['Vehiculo','ABC123','CARRO','TOYOTA','Blanco','2020','juan@gmail.com']]);
    wsV['!cols']=[{wch:10},{wch:10},{wch:15},{wch:12},{wch:10},{wch:8},{wch:28}];XLSX.utils.book_append_sheet(wb,wsV,'Vehículos');
    XLSX.writeFile(wb,'Plantilla_Carga_Masiva_Completa.xlsx');
    showNotification('✅ Plantilla descargada','success');
}

function descargarPlantillaVehiculosSolo(){
    if(typeof XLSX==='undefined'){showNotification('Error: Librería XLSX no está cargada','error');return;}
    var wb=XLSX.utils.book_new();
    var wsV=XLSX.utils.aoa_to_sheet([['Tipo','Placa','Tipo Vehículo','Marca','Color','Año','Email Cliente'],['Vehiculo','ABC123','CARRO','TOYOTA','Blanco','2020','juan@gmail.com']]);
    wsV['!cols']=[{wch:10},{wch:10},{wch:15},{wch:12},{wch:10},{wch:8},{wch:28}];XLSX.utils.book_append_sheet(wb,wsV,'Vehículos');
    XLSX.writeFile(wb,'Plantilla_Solo_Vehiculos.xlsx');
    showNotification('✅ Plantilla descargada','success');
}

function mostrarArchivoSeleccionado(){
    var fi=document.getElementById('excelFile'),info=document.getElementById('archivoSeleccionado');
    if(fi&&fi.files[0]){var f=fi.files[0];info.innerHTML='📎 <strong>'+f.name+'</strong> ('+(f.size/1024).toFixed(2)+' KB)';info.style.color='#059669';}
    else if(info)info.innerHTML='';
}

// ==================== DELEGACIÓN DE EVENTOS ====================
function setupGlobalEventDelegation(){
    document.body.addEventListener('click',function(e){
        var sal=e.target.closest('.sede-btn-salida'),cob=e.target.closest('.sede-btn-cobrar');
        var ace=e.target.closest('.sede-btn-aceptar'),rec=e.target.closest('.sede-btn-rechazar');
        if(sal){e.preventDefault();abrirModalSalida(parseInt(sal.dataset.id));return;}
        if(cob){e.preventDefault();abrirModalCobro(parseInt(cob.dataset.id));return;}
        if(ace){e.preventDefault();aceptarReservacion(ace.dataset.id);return;}
        if(rec){e.preventDefault();rechazarReservacion(rec.dataset.id);return;}
    });
}

// ==================== TRABAJADORES ====================
function openRegistrarTrabajadorModal(){
    var m=document.getElementById('registrarTrabajadorModal');
    if(m){m.classList.add('show');m.setAttribute('aria-hidden','false');}
}
function closeRegistrarTrabajadorModal(){
    var m=document.getElementById('registrarTrabajadorModal');
    if(m){
        m.classList.remove('show');m.setAttribute('aria-hidden','true');
        setTimeout(function(){['trabajadorNombre','trabajadorCorreo','trabajadorTelefono','trabajadorCedula','trabajadorContrasena'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});},300);
    }
}
async function registrarTrabajador(){
    var datos={
        nombre:(document.getElementById('trabajadorNombre')||{}).value||'',
        correo:(document.getElementById('trabajadorCorreo')||{}).value||'',
        telefono:(document.getElementById('trabajadorTelefono')||{}).value||'',
        cedula:(document.getElementById('trabajadorCedula')||{}).value||'',
        contrasena:(document.getElementById('trabajadorContrasena')||{}).value||''
    };
    if(!datos.nombre||!datos.correo){showNotification('Complete Nombre y Correo','warning');return;}
    if(!datos.contrasena||datos.contrasena.length<8){showNotification('La contraseña debe tener al menos 8 caracteres','warning');return;}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo)){showNotification('Ingrese un correo válido','warning');return;}
    try {
        var r=await fetch(API_BASE_URL+'/registrar-trabajador',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(datos)});
        if(r.ok){var res=await r.json();showNotification(res.mensaje||'Trabajador registrado exitosamente','success');closeRegistrarTrabajadorModal();cargarUsuarios();}
        else{var err=await r.json();showNotification(err.error||'Error al registrar trabajador','error');}
    } catch(e){showNotification('Error de conexión al registrar trabajador','error');}
}

// ==================== CORREOS ====================
async function enviarCorreoUno(){
    var email=(document.getElementById('emailSingle')||{}).value?.trim()||'';
    var subject=(document.getElementById('subjectSingle')||{}).value?.trim()||'';
    var message=(document.getElementById('messageSingle')||{}).value?.trim()||'';
    if(!email||!subject||!message){showNotification('Complete todos los campos','warning');return;}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){showNotification('Correo inválido','warning');return;}
    var btn=document.querySelector('#correoUno button[type="submit"]');
    if(btn){btn.disabled=true;btn.textContent='Enviando...';}
    var fd=new URLSearchParams();fd.append('correo',email);fd.append('asunto',subject);fd.append('mensaje',message);
    try {
        var r=await fetch(API_BASE_URL+'/correo/unitario',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:fd.toString()});
        var data=await r.json();
        if(data.status==='success'){showNotification(data.message,'success');['emailSingle','subjectSingle','messageSingle'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});}
        else showNotification(data.message||'Error al enviar correo','error');
    } catch(e){showNotification('Error de conexión','error');}
    finally{if(btn){btn.disabled=false;btn.textContent='Enviar Correo';}}
}

async function enviarCorreoMasivo(){
    var emailsRaw=(document.getElementById('emailsMassive')||{}).value?.trim()||'';
    var subject=(document.getElementById('subjectMassive')||{}).value?.trim()||'';
    var message=(document.getElementById('messageMassive')||{}).value?.trim()||'';
    if(!emailsRaw||!subject||!message){showNotification('Complete todos los campos','warning');return;}
    var list=emailsRaw.split(',').map(function(e){return e.trim();}).filter(Boolean);
    var invalid=list.filter(function(e){return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);});
    if(invalid.length){showNotification('Correos inválidos: '+invalid.join(', '),'error');return;}
    if(!list.length){showNotification('Ingresa al menos un correo','warning');return;}
    var btn=document.querySelector('#correoMasivo button[type="submit"]');
    if(btn){btn.disabled=true;btn.textContent='Enviando...';}
    var fd=new URLSearchParams();list.forEach(function(e){fd.append('seleccionados',e);});fd.append('asunto',subject);fd.append('mensaje',message);
    try {
        var r=await fetch(API_BASE_URL+'/correo/masivo',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:fd.toString()});
        var data=await r.json();
        if(data.status==='success'){showNotification(data.message,'success');['emailsMassive','subjectMassive','messageMassive'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});}
        else showNotification(data.message||'Error al enviar correos','error');
    } catch(e){showNotification('Error de conexión','error');}
    finally{if(btn){btn.disabled=false;btn.textContent='Enviar Masivamente';}}
}

// ==================== FILTRO DESTINATARIOS ====================
var _sedeDestinatariosCache=[];

async function sedeCargarDestinatarios(){
    var rol=(document.getElementById('sedeFiltroRol')||{}).value||'';
    var estEl=document.getElementById('sedeEstadoFiltro');
    var listEl=document.getElementById('sedeListaDestinatarios');
    var tabEl=document.getElementById('sedeTablaDestinatarios');
    var cntEl=document.getElementById('sedeContadorLista');
    var btnEl=document.getElementById('btnSedeCargar');
    if(!rol){showNotification('Selecciona un grupo primero','warning');return;}
    if(estEl)estEl.textContent='Consultando...';
    if(listEl)listEl.style.display='none';
    if(btnEl){btnEl.disabled=true;btnEl.textContent='Cargando...';}
    var ep={clientes:API_BASE_URL+'/correos/clientes',trabajadores:API_BASE_URL+'/correos/trabajadores'};
    try {
        var r=await fetch(ep[rol]);if(!r.ok)throw new Error('Error '+r.status);
        var datos=await r.json();_sedeDestinatariosCache=datos;
        if(!datos.length){if(estEl)estEl.textContent=rol==='trabajadores'?'No hay trabajadores asignados.':'No se encontraron clientes.';if(listEl)listEl.style.display='none';return;}
        if(tabEl)tabEl.innerHTML=datos.map(function(d){
            return '<label style="display:flex;align-items:center;gap:.75rem;padding:.6rem .75rem;cursor:pointer;border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background=\'#f0fdf9\'" onmouseout="this.style.background=\'transparent\'">' +
                '<input type="checkbox" class="sede-dest-check" data-correo="'+d.correo+'" style="width:16px;height:16px;cursor:pointer;accent-color:#0d9488;" checked/>' +
                '<div style="flex:1;min-width:0;"><div style="font-weight:600;font-size:.875rem;color:#1e293b;">'+(d.nombre||'(sin nombre)')+'</div>' +
                '<div style="font-size:.8rem;color:#64748b;">'+d.correo+'</div></div>' +
                '<span style="font-size:.72rem;background:#ccfbf1;color:#0f766e;border-radius:9999px;padding:.15rem .5rem;">'+(d.rol==='OPERARIO'?'Operario':'Cliente')+'</span></label>';
        }).join('');
        if(cntEl)cntEl.textContent=datos.length+' usuario(s) encontrado(s)';
        if(estEl)estEl.textContent='';if(listEl)listEl.style.display='block';
    } catch(e){if(estEl)estEl.textContent='Error al consultar. Intenta de nuevo.';showNotification('Error al consultar destinatarios','error');}
    finally{if(btnEl){btnEl.disabled=false;btnEl.textContent='Consultar';}}
}

function sedeSeleccionarTodos(estado){document.querySelectorAll('.sede-dest-check').forEach(function(cb){cb.checked=estado;});}

function sedeAgregarSeleccionados(){
    var sel=[];document.querySelectorAll('.sede-dest-check:checked').forEach(function(cb){if(cb.dataset.correo)sel.push(cb.dataset.correo);});
    if(!sel.length){showNotification('No hay destinatarios seleccionados','warning');return;}
    var ta=document.getElementById('emailsMassive');if(!ta)return;
    var ex=ta.value.split(',').map(function(e){return e.trim();}).filter(Boolean);
    var nuevos=sel.filter(function(e){return!ex.includes(e);});
    ta.value=ex.concat(nuevos).filter(Boolean).join(', ');
    _sedeActualizarBadge();
    showNotification(nuevos.length+' correo(s) agregado(s) al envío','success');
    var l=document.getElementById('sedeListaDestinatarios');if(l)l.style.display='none';
    var e=document.getElementById('sedeEstadoFiltro');if(e)e.textContent='✓ '+sel.length+' destinatario(s) cargados.';
}

function _sedeActualizarBadge(){
    var ta=document.getElementById('emailsMassive'),b=document.getElementById('sedeBadgeConteo');
    if(!ta||!b)return;
    var c=ta.value.split(',').map(function(e){return e.trim();}).filter(function(e){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);}).length;
    b.textContent=c;b.style.display=c>0?'inline':'none';
}

document.addEventListener('DOMContentLoaded',function(){
    var ta=document.getElementById('emailsMassive');
    if(ta)ta.addEventListener('input',_sedeActualizarBadge);
});

// ==================== MODAL CONFIGURACIÓN ====================
function initModalConfigTabs(){
    document.querySelectorAll('.cfg-modal-tab').forEach(function(btn){
        btn.addEventListener('click',function(){
            var panel=this.getAttribute('data-cfg-panel');
            document.querySelectorAll('.cfg-modal-tab').forEach(function(b){b.classList.remove('active');b.setAttribute('aria-selected','false');});
            document.querySelectorAll('.cfg-panel').forEach(function(p){p.classList.remove('active');});
            this.classList.add('active');this.setAttribute('aria-selected','true');
            var el=document.getElementById(panel);if(el)el.classList.add('active');
        });
    });
}

function abrirModalConfiguracion(){
    var dd=document.getElementById('profileDropdown');if(dd)dd.classList.remove('show');
    var ov=document.getElementById('cfgModalOverlay');
    if(ov){ov.classList.add('open');ov.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';cfgCargarDatos();}
}
function cerrarModalConfiguracion(){
    var ov=document.getElementById('cfgModalOverlay');
    if(ov){ov.classList.remove('open');ov.setAttribute('aria-hidden','true');document.body.style.overflow='';}
}
function cfgClickFuera(e){if(e.target===document.getElementById('cfgModalOverlay'))cerrarModalConfiguracion();}

document.addEventListener('keydown',function(e){
    if(e.key!=='Escape')return;
    var ov=document.getElementById('cfgModalOverlay'),co=document.getElementById('cobroModal'),sa=document.getElementById('salidaModal');
    if(ov&&ov.classList.contains('open')){cerrarModalConfiguracion();return;}
    if(co&&co.classList.contains('open')){cerrarModalCobro();return;}
    if(sa&&sa.classList.contains('open')){cerrarModalSalida();return;}
    // También cerrar modal registrar sede con Escape
    var rs=document.getElementById('registrarSedeModal');
    if(rs&&rs.classList.contains('show')){cerrarModalRegistrarSede();return;}
});

async function cfgCargarDatos(){
    try {
        var r=await fetch(API_BASE_URL+'/mi-configuracion');
        if(!r.ok) throw new Error('Error');
        var d=await r.json();
        function set(id,v){var el=document.getElementById(id);if(el)el.value=v||'';}
        set('cfg-nombre',d.nombre);set('cfg-nit',d.nit);set('cfg-direccion',d.direccion);
        set('cfg-telefono',d.telefonoSede);set('cfg-correo',d.correoSede);set('cfg-horario',d.horarioSede);
        set('cfg-tarifaPlenaC',d.tarifaPlenaC);set('cfg-tarifaPlenaM',d.tarifaPlenaM);
        set('cfg-tarifaMinutoC',d.tarifaMinutoC);set('cfg-tarifaMinutoM',d.tarifaMinutoM);
        cfgActualizarPreview();
        set('cfg-cuposCarro',d.cuposCarro||0);set('cfg-cuposMoto',d.cuposMoto||0);
        set('cfg-cuposBicicleta',d.cuposBicicleta||0);set('cfg-capacidadTotal',d.capacidad);
        cfgActualizarBarra();
        var img=document.getElementById('cfgImgPreviewEl'),ph=document.getElementById('cfgImgPlaceholder');
        if(d.imagenSede&&img){img.src='/'+d.imagenSede;img.style.display='block';if(ph)ph.style.display='none';}
        cargarBannerSede();
    } catch(e){showNotification('Error al cargar la configuración','error');}
}

function cfgActualizarPreview(){
    function gv(id){var el=document.getElementById(id);return el?parseFloat(el.value)||0:0;}
    var pc=gv('cfg-tarifaPlenaC'),pm=gv('cfg-tarifaPlenaM'),mc=gv('cfg-tarifaMinutoC'),mm=gv('cfg-tarifaMinutoM');
    function fmt(v){return v>0?'$'+formatNumber(v):'—';}
    function set(id,v){var el=document.getElementById(id);if(el)el.textContent=v;}
    set('prev-plena-c',fmt(pc));set('prev-plena-m',fmt(pm));
    set('prev-min-c',fmt(mc*60));set('prev-min-m',fmt(mm*60));
}

function cfgActualizarBarra(){
    function gi(id){var el=document.getElementById(id);return el?parseInt(el.value)||0:0;}
    var c=gi('cfg-cuposCarro'),m=gi('cfg-cuposMoto'),b=gi('cfg-cuposBicicleta'),total=c+m+b;
    function set(id,v){var el=document.getElementById(id);if(el)el.textContent=v;}
    set('leg-carro',c);set('leg-moto',m);set('leg-bicicleta',b);set('leg-total',total);
    if(total>0){
        function sw(id,pct){var el=document.getElementById(id);if(el)el.style.width=pct+'%';}
        sw('bar-carro',Math.round((c/total)*100));sw('bar-moto',Math.round((m/total)*100));sw('bar-bicicleta',Math.round((b/total)*100));
    }
}

async function cfgGuardarInformacion(){
    var nombre=(document.getElementById('cfg-nombre')||{}).value?.trim()||'';
    var direccion=(document.getElementById('cfg-direccion')||{}).value?.trim()||'';
    var correo=(document.getElementById('cfg-correo')||{}).value?.trim()||'';
    ['err-nombre','err-direccion','err-correo'].forEach(function(id){var el=document.getElementById(id);if(el)el.textContent='';});
    var valido=true;
    if(!nombre){var el=document.getElementById('err-nombre');if(el)el.textContent='El nombre es obligatorio';valido=false;}
    if(!direccion){var el=document.getElementById('err-direccion');if(el)el.textContent='La dirección es obligatoria';valido=false;}
    if(correo&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)){var el=document.getElementById('err-correo');if(el)el.textContent='Formato de correo inválido';valido=false;}
    if(!valido)return;
    try {
        var fd=new FormData();fd.append('nombre',nombre);fd.append('direccion',direccion);
        var tel=(document.getElementById('cfg-telefono')||{}).value?.trim()||'';
        var hor=(document.getElementById('cfg-horario')||{}).value?.trim()||'';
        if(tel)fd.append('telefonoSede',tel);if(correo)fd.append('correoSede',correo);if(hor)fd.append('horarioSede',hor);
        var r=await fetch(API_BASE_URL+'/mi-configuracion',{method:'PUT',body:fd});
        if(!r.ok)throw new Error('Error al guardar');
        showNotification('Información actualizada correctamente','success');
        cargarBannerSede();cargarSedes();cargarEstadisticas();
    } catch(e){showNotification('Error al guardar la información','error');}
}

async function cfgGuardarTarifas(){
    function gv(id){var el=document.getElementById(id);return el?parseFloat(el.value):null;}
    var pc=gv('cfg-tarifaPlenaC'),pm=gv('cfg-tarifaPlenaM'),mc=gv('cfg-tarifaMinutoC'),mm=gv('cfg-tarifaMinutoM');
    var valido=true;
    [['cfg-tarifaPlenaC','err-tarifaPlenaC',pc],['cfg-tarifaPlenaM','err-tarifaPlenaM',pm],
        ['cfg-tarifaMinutoC','err-tarifaMinutoC',mc],['cfg-tarifaMinutoM','err-tarifaMinutoM',mm]].forEach(function(it){
        var el=document.getElementById(it[1]);if(el)el.textContent='';
        if(it[2]===null||isNaN(it[2])||it[2]<0){if(el)el.textContent='Valor inválido';valido=false;}
    });
    if(!valido)return;
    try {
        var fd=new FormData();fd.append('tarifaPlenaC',pc);fd.append('tarifaPlenaM',pm);fd.append('tarifaMinutoC',mc);fd.append('tarifaMinutoM',mm);
        var r=await fetch(API_BASE_URL+'/mi-configuracion',{method:'PUT',body:fd});
        if(!r.ok)throw new Error('Error');showNotification('Tarifas actualizadas correctamente','success');
    } catch(e){showNotification('Error al guardar las tarifas','error');}
}

async function cfgGuardarCupos(){
    function gi(id){var el=document.getElementById(id);return el?parseInt(el.value)||0:0;}
    var c=gi('cfg-cuposCarro'),m=gi('cfg-cuposMoto'),b=gi('cfg-cuposBicicleta');
    try {
        var fd=new FormData();fd.append('cuposCarro',c);fd.append('cuposMoto',m);fd.append('cuposBicicleta',b);
        var r=await fetch(API_BASE_URL+'/mi-configuracion',{method:'PUT',body:fd});
        if(!r.ok)throw new Error('Error');showNotification('Cupos actualizados correctamente','success');
    } catch(e){showNotification('Error al guardar los cupos','error');}
}

function cfgPrevisualizarImagen(input){
    if(!input.files||!input.files[0])return;
    var file=input.files[0];
    if(file.size>5*1024*1024){showNotification('La imagen no puede superar 5 MB','error');input.value='';return;}
    var n=document.getElementById('cfg-img-nombre');if(n)n.textContent=file.name;
    var reader=new FileReader();
    reader.onload=function(e){
        var img=document.getElementById('cfgImgPreviewEl'),ph=document.getElementById('cfgImgPlaceholder');
        if(img){img.src=e.target.result;img.style.display='block';}if(ph)ph.style.display='none';
    };
    reader.readAsDataURL(file);
    var btn=document.getElementById('btn-guardar-img');if(btn)btn.disabled=false;
}

async function cfgGuardarImagen(){
    var input=document.getElementById('cfgImagenInput');
    if(!input||!input.files[0]){showNotification('Selecciona una imagen primero','warning');return;}
    try {
        var fd=new FormData();fd.append('imagen',input.files[0]);
        var r=await fetch(API_BASE_URL+'/mi-configuracion',{method:'PUT',body:fd});
        if(!r.ok)throw new Error('Error');
        showNotification('Imagen actualizada correctamente','success');
        var btn=document.getElementById('btn-guardar-img');if(btn)btn.disabled=true;
        cargarBannerSede();
    } catch(e){showNotification('Error al subir la imagen','error');}
}

function cfgEvaluarFortaleza(valor){
    var fill=document.getElementById('cfgStrengthFill'),lbl=document.getElementById('cfgStrengthLabel');
    if(!fill||!lbl)return;
    var score=0;
    if(valor.length>=8)score++;if(/[A-Z]/.test(valor))score++;if(/[0-9]/.test(valor))score++;if(/[^A-Za-z0-9]/.test(valor))score++;
    var niveles=[{pct:'0%',color:'#e5e7eb',texto:''},{pct:'25%',color:'#ef4444',texto:'Débil'},
        {pct:'50%',color:'#f59e0b',texto:'Regular'},{pct:'75%',color:'#3b82f6',texto:'Buena'},
        {pct:'100%',color:'#10b981',texto:'Fuerte'}];
    var nv=niveles[score]||niveles[0];
    fill.style.width=nv.pct;fill.style.background=nv.color;lbl.textContent=nv.texto;lbl.style.color=nv.color;
}

function cfgLimpiarContrasena(){
    ['cfg-passActual','cfg-passNueva','cfg-passConfirmar'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
    ['err-passActual','err-passNueva','err-passConfirmar'].forEach(function(id){var el=document.getElementById(id);if(el)el.textContent='';});
    var f=document.getElementById('cfgStrengthFill');if(f)f.style.width='0%';
    var l=document.getElementById('cfgStrengthLabel');if(l)l.textContent='';
}

async function cfgCambiarContrasena(){
    var actual=(document.getElementById('cfg-passActual')||{}).value||'';
    var nueva=(document.getElementById('cfg-passNueva')||{}).value||'';
    var conf=(document.getElementById('cfg-passConfirmar')||{}).value||'';
    ['err-passActual','err-passNueva','err-passConfirmar'].forEach(function(id){var el=document.getElementById(id);if(el)el.textContent='';});
    var valido=true;
    if(!actual){var el=document.getElementById('err-passActual');if(el)el.textContent='Ingresa tu contraseña actual';valido=false;}
    if(!nueva||nueva.length<8){var el=document.getElementById('err-passNueva');if(el)el.textContent='Mínimo 8 caracteres';valido=false;}
    if(nueva!==conf){var el=document.getElementById('err-passConfirmar');if(el)el.textContent='Las contraseñas no coinciden';valido=false;}
    if(!valido)return;
    try {
        var r=await fetch(API_BASE_URL+'/cambiar-contrasena',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({contrasenaActual:actual,contrasenaNueva:nueva,confirmar:conf})});
        var data=await r.json();
        if(!r.ok)throw new Error(data.error||'Error al cambiar contraseña');
        showNotification('Contraseña actualizada correctamente','success');cfgLimpiarContrasena();
    } catch(e){showNotification(e.message,'error');}
}

// ==================== UI HELPERS ====================
function setupSidebarToggle(){}

function setupProfileMenu(){
    var pb=document.getElementById('profileBtn'),dd=document.getElementById('profileDropdown');
    if(pb&&dd){
        pb.addEventListener('click',function(e){
            e.stopPropagation();dd.classList.toggle('show');
            pb.setAttribute('aria-expanded',dd.classList.contains('show')?'true':'false');
        });
        document.addEventListener('click',function(){dd.classList.remove('show');pb.setAttribute('aria-expanded','false');});
    }
}

function cerrarSesion()  { logoutJWT(); }
function irAyuda(){showNotification('Sección de ayuda próximamente','info');}

window.addEventListener('click',function(e){
    var co=document.getElementById('cobroModal'),sa=document.getElementById('salidaModal'),mt=document.getElementById('registrarTrabajadorModal');
    if(co&&e.target===co)cerrarModalCobro();
    if(sa&&e.target===sa)cerrarModalSalida();
    if(mt&&e.target===mt)closeRegistrarTrabajadorModal();
});
window.addEventListener('beforeunload',function(){
    if(updateInterval)clearInterval(updateInterval);
    Object.values(timerIntervals).forEach(function(id){clearInterval(id);});
    if(chartIngresos)chartIngresos.destroy();
    if(chartOcupacion)chartOcupacion.destroy();
});

// ==================== ESTILOS ADICIONALES ====================
function injectAdditionalStyles(){
    if(document.getElementById('sede-additional-styles'))return;
    var style=document.createElement('style');
    style.id='sede-additional-styles';
    style.textContent=
        '.sede-btn-icon{background:transparent;border:none;cursor:pointer;padding:.4rem;border-radius:.375rem;transition:all .2s;display:inline-flex;align-items:center;justify-content:center;}' +
        '.sede-btn-edit:hover{background-color:#ccfbf1;}.sede-btn-delete:hover{background-color:#fee2e2;}' +
        '.sede-btn-warning{background-color:#f59e0b;color:white;padding:.4rem 1rem;border-radius:.375rem;border:none;cursor:pointer;transition:all .2s;font-weight:600;display:inline-flex;align-items:center;gap:.4rem;font-size:.85rem;}' +
        '.sede-btn-warning:hover{background-color:#d97706;transform:translateY(-1px);}' +
        '@keyframes aparca-slideUp{from{transform:translateX(400px);opacity:0;}to{transform:translateX(0);opacity:1;}}' +
        '@keyframes rs-spin{to{transform:rotate(360deg);}}' +
        '.hidden{display:none!important;}';
    document.head.appendChild(style);
}


// ================================================================
// ═══════════════════════════════════════════════════════════════
//  SISTEMA DE MAPA — REGISTRAR SEDE
//  Nominatim (OSM) · Sin API key · Autocompletado · GPS
//  Marcador draggable · Reverse geocoding · Iconos Lucide
// ═══════════════════════════════════════════════════════════════
// ================================================================

var RS_BARRIOS = {
    USAQUEN:           ['Santa Bárbara','Cedritos','Usaquén','La Calleja','Molinos Norte','Barrancas','Country Club'],
    CHAPINERO:         ['Chicó','El Lago','Rosales','Chapinero Alto','Antiguo Country','La Cabrera'],
    SANTA_FE:          ['Las Aguas','La Perseverancia','San Diego','La Candelaria','Las Cruces'],
    SAN_CRISTOBAL:     ['San Cristóbal Norte','San Blas','La Victoria','20 de Julio','Altamira'],
    USME:              ['Usme Pueblo','Yomasa','El Virrey','Gran Yomasa','Alfonso López'],
    TUNJUELITO:        ['Parque El Tunal','San Vicente','Venecia','Abraham Lincoln','San Benito'],
    BOSA:              ['Bosa Central','Bosa Laureles','El Porvenir','San Bernardino','Apogeo'],
    KENNEDY:           ['Tintal','Timiza','Mandalay','Carvajal','Patio Bonito','Kennedy Central','Techo'],
    FONTIBON:          ['Capellanía','Fontibón Centro','Modelia','Granjas de Techo','Ciudad Salitre'],
    ENGATIVA:          ['Ferias','Boyacá Real','Minuto de Dios','Bolivia','Las Ferias'],
    SUBA:              ['Tibabuyes','Niza','Suba Centro','La Campiña','La Alhambra','El Rincón','Lisboa'],
    BARRIOS_UNIDOS:    ['7 de Agosto','Doce de Octubre','San Felipe','Los Andes','Los Alcázares'],
    TEUSAQUILLO:       ['La Soledad','Quesada','Campín','Palermo','Nicolás de Federmán'],
    MARTIRES:          ['Santa Isabel','Eduardo Santos','La Sabana'],
    ANTONIO_NARINO:    ['Restrepo','Eduardo Santos','Policarpa','Country Sur'],
    PUENTE_ARANDA:     ['Ciudad Montes','Torremolinos','Salazar Gómez','Muzú','Zona Industrial'],
    CANDELARIA:        ['La Catedral','Egipto','Las Aguas','Belén'],
    RAFAEL_URIBE_URIBE:['Bravo Páez','Marruecos','Quiroga','Marco Fidel Suárez','Diana Turbay'],
    CIUDAD_BOLIVAR:    ['Meissen','Jerusalén','Paraíso','Arborizadora','El Lucero','Ismael Perdomo'],
    SUMAPAZ:           ['Nazareth','Betania','San Juan de Sumapaz']
};

var RS_CENTROIDES_LOCALIDADES = {
    'USAQUEN':            [4.7110, -74.0300],
    'CHAPINERO':          [4.6400, -74.0620],
    'SANTA_FE':           [4.6097, -74.0730],
    'SAN_CRISTOBAL':      [4.5700, -74.0800],
    'USME':               [4.5100, -74.1300],
    'TUNJUELITO':         [4.5800, -74.1400],
    'BOSA':               [4.6200, -74.1900],
    'KENNEDY':            [4.6280, -74.1550],
    'FONTIBON':           [4.6800, -74.1400],
    'ENGATIVA':           [4.7000, -74.1100],
    'SUBA':               [4.7500, -74.0800],
    'BARRIOS_UNIDOS':     [4.6700, -74.0850],
    'TEUSAQUILLO':        [4.6400, -74.0900],
    'MARTIRES':           [4.6000, -74.0950],
    'ANTONIO_NARINO':     [4.5900, -74.1100],
    'PUENTE_ARANDA':      [4.6200, -74.1200],
    'CANDELARIA':         [4.5970, -74.0730],
    'RAFAEL_URIBE_URIBE': [4.5600, -74.1200],
    'CIUDAD_BOLIVAR':     [4.5700, -74.1800],
    'SUMAPAZ':            [4.2600, -74.2900]
};

var rsMap              = null;
var rsMarcador         = null;
var rsUbicacionOk      = false;
var rsAutocompDebounce = null;
var rsLastNominatim    = 0;
var rsIconoSede        = null;
var rsIconoSedeDrag    = null;

function rsCrearIcono() {
    if (!rsIconoSede && typeof L !== 'undefined') {
        rsIconoSede = L.divIcon({
            className: '',
            html: '<div style="width:34px;height:34px;background:linear-gradient(135deg,#134e4a,#0d9488);border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 4px 16px rgba(13,148,136,.5);position:relative;">' +
                '<div style="width:9px;height:9px;background:#fff;border-radius:50%;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(45deg);"></div></div>',
            iconSize:   [34, 34],
            iconAnchor: [17, 34],
            popupAnchor:[0, -38]
        });
    }
    return rsIconoSede;
}

function rsCrearIconoDrag() {
    if (!rsIconoSedeDrag && typeof L !== 'undefined') {
        rsIconoSedeDrag = L.divIcon({
            className: '',
            html: '<div style="width:34px;height:34px;background:linear-gradient(135deg,#065f46,#059669);border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 4px 20px rgba(5,150,105,.6);position:relative;">' +
                '<div style="width:9px;height:9px;background:#fff;border-radius:50%;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(45deg);"></div></div>',
            iconSize:   [34, 34],
            iconAnchor: [17, 34],
            popupAnchor:[0, -38]
        });
    }
    return rsIconoSedeDrag;
}

function rsInicializarMapa() {
    if (rsMap) return;
    var container = document.getElementById('rsMapContainer');
    if (!container || typeof L === 'undefined') return;

    rsMap = L.map('rsMapContainer', {
        zoomControl: true, attributionControl: true, scrollWheelZoom: true
    }).setView([4.6533, -74.0836], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(rsMap);

    rsMap.on('click', function(e) {
        rsColocarMarcador(e.latlng.lat, e.latlng.lng, true);
    });
}

function rsColocarMarcador(lat, lon, hacerReverseGeo) {
    if (!rsMap) return;
    var latlng = L.latLng(lat, lon);

    if (rsMarcador) {
        rsMarcador.setLatLng(latlng);
    } else {
        rsMarcador = L.marker(latlng, {
            draggable: true,
            icon:      rsCrearIcono(),
            title:     'Arrastrá para ajustar la posición exacta'
        }).addTo(rsMap);

        rsMarcador.bindPopup(
            '<div style="font-family:inherit;font-size:.8rem;text-align:center;padding:.25rem;">' +
            '<strong style="color:#0f766e;display:block;margin-bottom:.2rem;">📍 Nueva Sede</strong>' +
            '<span style="color:#64748b;">Arrastrá para ajustar</span></div>'
        ).openPopup();

        rsMarcador.on('drag', function(e) {
            rsMarcador.setIcon(rsCrearIconoDrag());
            var pos = e.target.getLatLng();
            rsSetMapStatus(pos.lat.toFixed(5) + ', ' + pos.lng.toFixed(5), 'dragging');
        });

        rsMarcador.on('dragend', function(e) {
            rsMarcador.setIcon(rsCrearIcono());
            var pos = e.target.getLatLng();
            rsGuardarCoordenadas(pos.lat, pos.lng);
            rsReverseGeocodificar(pos.lat, pos.lng);
        });
    }

    rsMap.setView(latlng, 17, { animate: true });
    rsGuardarCoordenadas(lat, lon);
    rsMarcarUbicacionConfirmada();
    if (hacerReverseGeo) rsReverseGeocodificar(lat, lon);
}

function rsGuardarCoordenadas(lat, lon) {
    var elLat = document.getElementById('rsLatitud');
    var elLon = document.getElementById('rsLongitud');
    if (elLat) elLat.value = parseFloat(lat).toFixed(7);
    if (elLon) elLon.value = parseFloat(lon).toFixed(7);
}

function rsSetMapStatus(html, tipo) {
    var el = document.getElementById('rsMapStatus');
    if (!el) return;
    var colores = { ok:'#059669', pending:'#d97706', error:'#dc2626', loading:'#0d9488', dragging:'#0d9488' };
    el.innerHTML   = html;
    el.style.color = colores[tipo] || '#64748b';
}

function rsMarcarUbicacionConfirmada() {
    rsUbicacionOk = true;
    rsSetMapStatus('✅ Ubicación confirmada — podés continuar', 'ok');
    var badge = document.getElementById('rsUbicacionBadge');
    if (badge) {
        badge.style.display    = 'flex';
        badge.style.background = '#f0fdf4';
        badge.style.border     = '1.5px solid #86efac';
        badge.style.color      = '#166534';
        badge.innerHTML        = '✅ Ubicación confirmada — podés continuar';
    }
}

function rsDesconfirmarUbicacion() {
    rsUbicacionOk = false;
    rsSetMapStatus('Ajustá la ubicación en el mapa', 'pending');
    var badge = document.getElementById('rsUbicacionBadge');
    if (badge && badge.style.display !== 'none') {
        badge.style.background = '#fffbeb';
        badge.style.border     = '1.5px solid #fcd34d';
        badge.style.color      = '#92400e';
        badge.innerHTML        = '⚠️ Dirección modificada — volvé a buscar o ajustá el pin';
    }
}

function rsNormalizarDireccion(dir) {
    return dir
        .replace('#', '')
        .replace(/\bKra?\.?\b/gi, 'Carrera').replace(/\bCra\.?\b/gi, 'Carrera').replace(/\bCr\.?\b/gi, 'Carrera')
        .replace(/\bCll\.?\b/gi, 'Calle').replace(/\bCl\.?\b/gi, 'Calle')
        .replace(/\bDg\.?\b/gi, 'Diagonal').replace(/\bTrv?\.?\b/gi, 'Transversal').replace(/\bAv\.?\b/gi, 'Avenida')
        .replace(/\s{2,}/g, ' ').trim();
}

async function rsGeocodificarDireccion(direccion, localidad, barrio) {
    var ahora = Date.now();
    var espera = 1050 - (ahora - rsLastNominatim);
    if (espera > 0) await new Promise(function(r) { setTimeout(r, espera); });
    rsLastNominatim = Date.now();

    var dirNorm = rsNormalizarDireccion(direccion);
    var locFmt  = localidad
        ? localidad.split('_').map(function(w) { return w.charAt(0) + w.slice(1).toLowerCase(); }).join(' ')
        : '';

    var query = [dirNorm, barrio, locFmt, 'Bogotá', 'Colombia'].filter(Boolean).join(', ');
    var params = new URLSearchParams({ q:query, format:'json', limit:'5', countrycode:'co', viewbox:'-74.25,4.45,-73.95,4.85', bounded:'1', 'accept-language':'es' });

    var resp = await fetch('https://nominatim.openstreetmap.org/search?' + params.toString(),
        { headers: { 'User-Agent': 'AparcaYA/1.0 (registro sede Bogota)' } });
    if (!resp.ok) throw new Error('Nominatim HTTP ' + resp.status);
    return await resp.json();
}

async function rsReverseGeocodificar(lat, lon) {
    rsSetMapStatus('Obteniendo dirección...', 'loading');
    var ahora = Date.now();
    var espera = 1050 - (ahora - rsLastNominatim);
    if (espera > 0) await new Promise(function(r) { setTimeout(r, espera); });
    rsLastNominatim = Date.now();

    try {
        var params = new URLSearchParams({ lat:lat.toString(), lon:lon.toString(), format:'json', zoom:'18', 'accept-language':'es' });
        var resp = await fetch('https://nominatim.openstreetmap.org/reverse?' + params.toString(),
            { headers: { 'User-Agent': 'AparcaYA/1.0 (registro sede Bogota)' } });
        var data = await resp.json();
        if (data && data.display_name) {
            var addr = data.address || {};
            var partes = [addr.road, addr.house_number, addr.suburb || addr.neighbourhood].filter(Boolean);
            var dirLegible = partes.length > 0 ? partes.join(' ') : data.display_name.split(',').slice(0,3).join(',').trim();
            var campo = document.getElementById('rsDireccion');
            if (campo && dirLegible) campo.value = dirLegible;
        }
        rsMarcarUbicacionConfirmada();
    } catch (err) {
        console.warn('Reverse geocoding falló:', err);
        rsMarcarUbicacionConfirmada();
    }
}

function rsIniciarAutocompletado() {
    var inputDir = document.getElementById('rsDireccion');
    var dropdown = document.getElementById('rsAutocompletadoDropdown');
    if (!inputDir || !dropdown) return;

    inputDir.addEventListener('input', function() {
        clearTimeout(rsAutocompDebounce);
        var val = this.value.trim();
        rsOcultarDropdown();
        rsDesconfirmarUbicacion();
        if (val.length < 5) return;
        rsSetDropdownCargando(dropdown);
        rsAutocompDebounce = setTimeout(async function() {
            var localidad = (document.getElementById('rsLocalidad') || {}).value || '';
            var barrio    = (document.getElementById('rsBarrio')    || {}).value || '';
            try {
                var resultados = await rsGeocodificarDireccion(val, localidad, barrio);
                rsMostrarSugerencias(resultados, dropdown, localidad, barrio);
            } catch (err) {
                console.warn('Autocompletado falló:', err);
                rsOcultarDropdown();
            }
        }, 600);
    });

    document.addEventListener('click', function(e) {
        if (!inputDir.contains(e.target) && !dropdown.contains(e.target)) rsOcultarDropdown();
    });

    inputDir.addEventListener('keydown', function(e) {
        var items  = dropdown.querySelectorAll('.rs-autocomp-item');
        var activo = dropdown.querySelector('.rs-autocomp-item.activo');
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (activo) { activo.classList.remove('activo'); (activo.nextElementSibling || items[0]).classList.add('activo'); }
            else if (items[0]) items[0].classList.add('activo');
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (activo) { activo.classList.remove('activo'); if (activo.previousElementSibling) activo.previousElementSibling.classList.add('activo'); }
        } else if (e.key === 'Enter' && activo) {
            e.preventDefault(); activo.click();
        } else if (e.key === 'Escape') {
            rsOcultarDropdown();
        }
    });
}

function rsSetDropdownCargando(dropdown) {
    dropdown.style.display = 'block';
    dropdown.innerHTML = '<div style="padding:.75rem 1rem;color:#64748b;font-size:.8125rem;display:flex;align-items:center;gap:.5rem;font-family:inherit;">' +
        '<svg style="width:14px;height:14px;animation:rs-spin 1s linear infinite;flex-shrink:0;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">' +
        '<circle style="opacity:.25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>' +
        '<path style="opacity:.75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>Buscando en Bogotá...</div>';
}

function rsMostrarSugerencias(resultados, dropdown, localidad, barrio) {
    var dentroRango = resultados.filter(function(r) {
        var lat = parseFloat(r.lat), lon = parseFloat(r.lon);
        return lat >= 4.45 && lat <= 4.85 && lon >= -74.25 && lon <= -73.95;
    });

    var c = RS_CENTROIDES_LOCALIDADES[localidad] || [4.6533, -74.0836];
    dentroRango.sort(function(a, b) {
        var dA = Math.hypot(parseFloat(a.lat)-c[0], parseFloat(a.lon)-c[1]);
        var dB = Math.hypot(parseFloat(b.lat)-c[0], parseFloat(b.lon)-c[1]);
        return dA - dB;
    });

    if (dentroRango.length === 0) {
        dropdown.innerHTML = '<div style="padding:.875rem 1rem;font-family:inherit;"><div style="color:#d97706;font-size:.8rem;font-weight:600;margin-bottom:.3rem;">⚠️ Sin resultados en Bogotá</div><div style="color:#64748b;font-size:.75rem;">Intentá con otra variante o hacé click en el mapa.</div></div>';
        dropdown.style.display = 'block';
        return;
    }

    dropdown.innerHTML = '<div style="padding:.4rem 1rem;font-size:.7rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #f1f5f9;font-family:inherit;">Sugerencias</div>';

    dentroRango.slice(0, 5).forEach(function(r) {
        var item = document.createElement('div');
        item.className = 'rs-autocomp-item';
        item.setAttribute('role', 'option');
        item.setAttribute('tabindex', '0');

        var addr   = r.address || {};
        var titulo = [addr.road, addr.house_number].filter(Boolean).join(' ') || r.display_name.split(',')[0];
        var sub    = [addr.suburb || addr.neighbourhood || addr.quarter, 'Bogotá'].filter(Boolean).slice(0, 2).join(', ');

        var inner = document.createElement('div');
        inner.style.cssText = 'display:flex;align-items:flex-start;gap:.625rem;padding:.7rem 1rem;cursor:pointer;border-bottom:1px solid #f8faff;transition:background .15s;font-family:inherit;';
        inner.innerHTML =
            '<div style="width:28px;height:28px;background:#f0fdfa;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:.05rem;">' +
            '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="#0d9488" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;">' +
            '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg></div>' +
            '<div style="flex:1;min-width:0;"><div style="font-size:.85rem;font-weight:600;color:#134e4a;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + titulo + '</div>' +
            '<div style="font-size:.73rem;color:#64748b;margin-top:.1rem;">' + sub + '</div></div>';

        item.appendChild(inner);

        item.addEventListener('mouseenter', function() {
            dropdown.querySelectorAll('.rs-autocomp-item').forEach(function(el) { el.classList.remove('activo'); });
            item.classList.add('activo');
            inner.style.background = '#f0fdfa';
        });
        item.addEventListener('mouseleave', function() { inner.style.background = ''; });

        item.addEventListener('click', function() {
            var lat = parseFloat(r.lat), lon = parseFloat(r.lon);
            var campo = document.getElementById('rsDireccion');
            if (campo) campo.value = titulo;
            rsOcultarDropdown();
            if (rsMap) rsMap.invalidateSize();
            rsColocarMarcador(lat, lon, false);
            rsMarcarUbicacionConfirmada();
            showNotification('Ubicación seleccionada. Arrastrá el pin si necesitás ajustar.', 'success');
        });

        dropdown.appendChild(item);
    });

    var footer = document.createElement('div');
    footer.style.cssText = 'padding:.4rem 1rem;font-size:.68rem;color:#94a3b8;text-align:center;border-top:1px solid #f1f5f9;font-family:inherit;';
    footer.textContent = '© OpenStreetMap contributors';
    dropdown.appendChild(footer);

    dropdown.style.display = 'block';
}

function rsOcultarDropdown() {
    var dropdown = document.getElementById('rsAutocompletadoDropdown');
    if (dropdown) { dropdown.style.display = 'none'; dropdown.innerHTML = ''; }
}

function rsIniciarBotonGPS() {
    var btn = document.getElementById('rsBtnGPS');
    if (!btn) return;

    btn.addEventListener('click', function() {
        if (!navigator.geolocation) { showNotification('Tu navegador no soporta geolocalización', 'warning'); return; }
        btn.disabled  = true;
        btn.innerHTML = '<svg style="width:14px;height:14px;animation:rs-spin 1s linear infinite;flex-shrink:0;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle style="opacity:.25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path style="opacity:.75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg> Obteniendo ubicación...';

        navigator.geolocation.getCurrentPosition(
            function(pos) {
                btn.disabled  = false;
                btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;flex-shrink:0;"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg> Usar mi ubicación actual (GPS)';
                var lat = pos.coords.latitude, lon = pos.coords.longitude;
                if (lat < 4.45 || lat > 4.85 || lon < -74.25 || lon > -73.95) {
                    showNotification('Tu ubicación no está en Bogotá. Buscá la dirección manualmente.', 'warning'); return;
                }
                if (rsMap) rsMap.invalidateSize();
                rsColocarMarcador(lat, lon, true);
                showNotification('Ubicación GPS obtenida. Arrastrá el pin si necesitás ajustar.', 'success');
            },
            function(err) {
                btn.disabled  = false;
                btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;flex-shrink:0;"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg> Usar mi ubicación actual (GPS)';
                var msgs = { 1:'Permiso denegado.', 2:'No se pudo obtener tu posición.', 3:'Tiempo de espera agotado.' };
                showNotification(msgs[err.code] || 'Error de geolocalización.', 'warning');
            },
            { timeout:10000, maximumAge:60000, enableHighAccuracy:true }
        );
    });
}

function rsIniciarListenersUbicacion() {
    var locSel = document.getElementById('rsLocalidad');
    var barSel = document.getElementById('rsBarrio');

    if (locSel) {
        locSel.addEventListener('change', function() {
            if (barSel) {
                barSel.innerHTML = '<option value="">Selecciona un barrio</option>';
                var barrios = RS_BARRIOS[this.value] || [];
                barrios.forEach(function(b) {
                    var opt = document.createElement('option');
                    opt.value = b; opt.textContent = b; barSel.appendChild(opt);
                });
            }
            if (rsMap) {
                var c = RS_CENTROIDES_LOCALIDADES[this.value] || [4.6533, -74.0836];
                rsMap.setView(c, 13, { animate: true });
            }
            rsDesconfirmarUbicacion();
        });
    }

    if (barSel) {
        barSel.addEventListener('change', function() { rsDesconfirmarUbicacion(); });
    }
}

// ================================================================
// ── FUNCIONES PÚBLICAS DEL MODAL REGISTRAR SEDE ─────────────────
// ================================================================

function rsFmtHora(v) {
    var h = parseInt(v, 10);
    if (v === '23:59') return '11:59 PM';
    if (h === 0)  return '12:00 AM';
    if (h < 12)   return h  + ':00 AM';
    if (h === 12) return '12:00 PM';
    return (h - 12) + ':00 PM';
}

function rsActualizarHorario() {
    var ap  = document.getElementById('rsHoraApertura');
    var ci  = document.getElementById('rsHoraCierre');
    var prv = document.getElementById('rsHorarioPreview');
    if (ap && ci && prv) {
        prv.textContent = rsFmtHora(ap.value) + ' → ' + rsFmtHora(ci.value);
    }
}

function abrirModalRegistrarSede() {
    var modal = document.getElementById('registrarSedeModal');
    if (modal) {
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
        rsActualizarHorario();
        setTimeout(function() {
            rsInicializarMapa();
            rsIniciarAutocompletado();
            rsIniciarBotonGPS();
            rsIniciarListenersUbicacion();
            if (rsMap) rsMap.invalidateSize();
        }, 200);
    }
}

function cerrarModalRegistrarSede() {
    var modal = document.getElementById('registrarSedeModal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');

    setTimeout(function() {
        ['rsNombre','rsNit','rsDireccion','rsCupos',
            'rsTarifaPlenaC','rsTarifaPlenaM','rsTarifaMinutoC','rsTarifaMinutoM',
            'rsLatitud','rsLongitud'
        ].forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });

        var loc = document.getElementById('rsLocalidad'); if (loc) loc.value = '';
        var bar = document.getElementById('rsBarrio');
        if (bar) bar.innerHTML = '<option value="">Primero selecciona localidad</option>';
        var ap  = document.getElementById('rsHoraApertura'); if (ap) ap.value = '7:00';
        var ci  = document.getElementById('rsHoraCierre');   if (ci) ci.value = '22:00';
        rsActualizarHorario();

        rsUbicacionOk = false;
        if (rsMarcador && rsMap) { rsMarcador.remove(); rsMarcador = null; }
        if (rsMap) rsMap.setView([4.6533, -74.0836], 12);

        var badge = document.getElementById('rsUbicacionBadge');
        if (badge) { badge.style.display = 'none'; badge.innerHTML = ''; }

        rsSetMapStatus('Buscá la dirección o hacé click en el mapa', 'pending');
        rsOcultarDropdown();

        ['err-rsNombre','err-rsNit','err-rsDireccion','err-rsLocalidad','err-rsBarrio',
            'err-rsCupos','err-rsTarifaPlenaC','err-rsTarifaPlenaM',
            'err-rsTarifaMinutoC','err-rsTarifaMinutoM'
        ].forEach(function(id) { var el = document.getElementById(id); if (el) el.textContent = ''; });
    }, 300);
}

async function registrarSede() {
    var nombre    = (document.getElementById('rsNombre')        || {}).value?.trim() || '';
    var nit       = (document.getElementById('rsNit')           || {}).value?.trim() || '';
    var direccion = (document.getElementById('rsDireccion')     || {}).value?.trim() || '';
    var localidad = (document.getElementById('rsLocalidad')     || {}).value         || '';
    var barrio    = (document.getElementById('rsBarrio')        || {}).value         || '';
    var cupos     = (document.getElementById('rsCupos')         || {}).value?.trim() || '';
    var tPlenaC   = (document.getElementById('rsTarifaPlenaC')  || {}).value?.trim() || '';
    var tPlenaM   = (document.getElementById('rsTarifaPlenaM')  || {}).value?.trim() || '';
    var tMinutoC  = (document.getElementById('rsTarifaMinutoC') || {}).value?.trim() || '';
    var tMinutoM  = (document.getElementById('rsTarifaMinutoM') || {}).value?.trim() || '';
    var apertura  = (document.getElementById('rsHoraApertura')  || {}).value         || '7:00';
    var cierre    = (document.getElementById('rsHoraCierre')    || {}).value         || '22:00';
    var latStr    = (document.getElementById('rsLatitud')       || {}).value         || '';
    var lonStr    = (document.getElementById('rsLongitud')      || {}).value         || '';

    ['err-rsNombre','err-rsNit','err-rsDireccion','err-rsLocalidad','err-rsBarrio',
        'err-rsCupos','err-rsTarifaPlenaC','err-rsTarifaPlenaM',
        'err-rsTarifaMinutoC','err-rsTarifaMinutoM'
    ].forEach(function(id) { var el = document.getElementById(id); if (el) el.textContent = ''; });

    var valido = true;
    function setErr(id, msg) { var el = document.getElementById(id); if (el) el.textContent = msg; valido = false; }

    if (!nombre)                             setErr('err-rsNombre',    'El nombre es obligatorio');
    if (!nit)                                setErr('err-rsNit',       'El NIT es obligatorio');
    else if (!/^[0-9]{9}-[0-9]$/.test(nit)) setErr('err-rsNit',       'Formato: 123456789-0');
    if (!direccion || direccion.length < 5)  setErr('err-rsDireccion', 'Ingresá una dirección válida');
    if (!localidad)                          setErr('err-rsLocalidad', 'Seleccioná una localidad');
    if (!barrio)                             setErr('err-rsBarrio',    'Seleccioná un barrio');

    var cuposNum = parseInt(cupos);
    if (!cupos || isNaN(cuposNum) || cuposNum < 1) setErr('err-rsCupos', 'Ingresá la capacidad (mínimo 1)');

    function validarTarifa(v, errId, label) {
        var n = parseFloat(v);
        if (!v || isNaN(n) || n <= 0) setErr(errId, label + ' debe ser mayor a 0');
    }
    validarTarifa(tPlenaC,  'err-rsTarifaPlenaC',  'Tarifa plena carro');
    validarTarifa(tPlenaM,  'err-rsTarifaPlenaM',  'Tarifa plena moto');
    validarTarifa(tMinutoC, 'err-rsTarifaMinutoC', 'Tarifa minuto carro');
    validarTarifa(tMinutoM, 'err-rsTarifaMinutoM', 'Tarifa minuto moto');

    // ── Validación CRÍTICA: coordenadas obligatorias ──────────────
    if (!latStr || !lonStr) {
        showNotification(
            '⚠️ Debés confirmar la ubicación en el mapa antes de registrar. ' +
            'Escribí la dirección y seleccioná una sugerencia, o hacé click en el mapa.',
            'warning'
        );
        var mapEl = document.getElementById('rsMapContainer');
        if (mapEl) mapEl.scrollIntoView({ behavior:'smooth', block:'center' });
        return;
    }

    var lat = parseFloat(latStr), lon = parseFloat(lonStr);
    if (lat < 4.45 || lat > 4.85 || lon < -74.25 || lon > -73.95) {
        showNotification('La ubicación debe estar dentro de Bogotá', 'error');
        return;
    }

    if (!valido) return;

    var localidadTexto = '';
    var locEl = document.getElementById('rsLocalidad');
    if (locEl && locEl.selectedOptions[0]) localidadTexto = locEl.selectedOptions[0].text;

    var direccionCompleta = direccion + ', ' + barrio + ', ' + (localidadTexto || localidad);
    var horario = apertura + ' - ' + cierre;

    var payload = {
        nombre:        nombre,
        nit:           nit,
        direccion:     direccionCompleta,
        localidad:     localidad,
        barrio:        barrio,
        capacidad:     cuposNum,
        tarifaPlenaC:  parseFloat(tPlenaC),
        tarifaPlenaM:  parseFloat(tPlenaM),
        tarifaMinutoC: parseFloat(tMinutoC),
        tarifaMinutoM: parseFloat(tMinutoM),
        horarioSede:   horario,
        latitud:       lat,
        longitud:      lon
    };

    try {
        showNotification('Registrando sede...', 'info');
        var response = await fetch(API_BASE_URL + '/sedes', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload)
        });
        if (!response.ok) {
            var err = await response.json();
            throw new Error(err.error || 'Error al registrar la sede');
        }
        var result = await response.json();
        showNotification('✅ Sede "' + result.nombre + '" registrada correctamente', 'success');
        cerrarModalRegistrarSede();
        await cargarSedes();
        switchToTab('sedes');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// ==================== EXPONER GLOBALES ====================
window.setPeriodo               = setPeriodo;
window.onPeriodoCustomChange    = onPeriodoCustomChange;
window.cargarGraficas           = cargarGraficas;
window.exportarReportePDF       = exportarReportePDF;
window.exportarReporteExcel     = exportarReporteExcel;
window.limpiarFiltroHistorial   = limpiarFiltroHistorial;
window.cargarBannerSede         = cargarBannerSede;
window.toggleModoRegistro       = toggleModoRegistro;
window.gestionarSede            = gestionarSede;
window.sedeCargarDestinatarios  = sedeCargarDestinatarios;
window.sedeSeleccionarTodos     = sedeSeleccionarTodos;
window.sedeAgregarSeleccionados = sedeAgregarSeleccionados;
window.abrirModalConfiguracion  = abrirModalConfiguracion;
window.cerrarModalConfiguracion = cerrarModalConfiguracion;
window.cfgClickFuera            = cfgClickFuera;
window.cfgCargarDatos           = cfgCargarDatos;
window.cfgActualizarPreview     = cfgActualizarPreview;
window.cfgActualizarBarra       = cfgActualizarBarra;
window.cfgGuardarInformacion    = cfgGuardarInformacion;
window.cfgGuardarTarifas        = cfgGuardarTarifas;
window.cfgGuardarCupos          = cfgGuardarCupos;
window.cfgPrevisualizarImagen   = cfgPrevisualizarImagen;
window.cfgGuardarImagen         = cfgGuardarImagen;
window.cfgEvaluarFortaleza      = cfgEvaluarFortaleza;
window.cfgLimpiarContrasena     = cfgLimpiarContrasena;
window.cfgCambiarContrasena     = cfgCambiarContrasena;
window.rsActualizarHorario      = rsActualizarHorario;
window.abrirModalRegistrarSede  = abrirModalRegistrarSede;
window.cerrarModalRegistrarSede = cerrarModalRegistrarSede;
window.registrarSede            = registrarSede;

console.log('SedeD.js v7 — Mapa profesional en modal registrar sede integrado');