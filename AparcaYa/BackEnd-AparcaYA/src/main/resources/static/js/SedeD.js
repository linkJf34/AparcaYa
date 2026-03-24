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
// CAMBIO: showNotification() custom eliminada.
// Ahora usa showToast() / showSuccess() / showError() / showWarning() / showInfo()
// provenientes de aparca-notifications.js (helper centralizado).
// Alias de compatibilidad para llamadas existentes con tipo como segundo argumento:
function showNotification(msg, type) {
    showToast(msg, type || 'info');
}

// ==================== MODAL CONFIRMACIÓN ====================
// CAMBIO: showConfirm() con overlay/innerHTML manual eliminado.
// Ahora delega en showConfirm() del helper centralizado (SweetAlert2).
// La firma cambia: recibe { title, body, btnTexto, btnColor } o
// los 4 parámetros posicionales que usaba el código anterior.
// Se mantiene como wrapper para no romper llamadas existentes.
function showConfirm(titulo, cuerpo, btnTexto, btnColor) {
    // Si se llama con objeto (nuevo estilo del helper) lo pasa directo
    if (typeof titulo === 'object') {
        return window.AparcaNotif
            ? window.AparcaNotif.showConfirm(titulo)
            : Promise.resolve(false);
    }
    // Llamada posicional — compatibilidad con código existente
    return window.AparcaNotif
        ? window.AparcaNotif.showConfirm({
            title:    titulo,
            body:     cuerpo     || '',
            btnTexto: btnTexto   || 'Confirmar',
            btnColor: btnColor   || 'danger'
        })
        : Promise.resolve(false);
}

// ==================== MODAL EDICIÓN ====================
// CAMBIO: showEditModal() con overlay/innerHTML manual eliminado.
// Ahora usa Swal.fire() con html + campos tipo input nativo de SweetAlert2.
function showEditModal(titulo, campos) {
    return new Promise(function(resolve) {
        var htmlInputs = campos.map(function(c) {
            if (c.type === 'select') {
                var opts = c.options.map(function(o) {
                    return '<option value="' + o + '"' + (o === c.value ? ' selected' : '') + '>' + o + '</option>';
                }).join('');
                return '<div style="margin-bottom:.75rem;text-align:left;">' +
                    '<label style="display:block;font-size:.8rem;font-weight:600;color:#374151;margin-bottom:.25rem;">' + c.label + '</label>' +
                    '<select id="swal-field-' + c.key + '" style="width:100%;padding:.5rem;border:1px solid #d1d5db;border-radius:.375rem;">' + opts + '</select></div>';
            }
            return '<div style="margin-bottom:.75rem;text-align:left;">' +
                '<label style="display:block;font-size:.8rem;font-weight:600;color:#374151;margin-bottom:.25rem;">' + c.label + '</label>' +
                '<input id="swal-field-' + c.key + '" type="' + (c.type || 'text') + '" value="' + (c.value || '') + '" ' +
                'style="width:100%;padding:.5rem;border:1px solid #d1d5db;border-radius:.375rem;" /></div>';
        }).join('');

        Swal.fire({
            title:             titulo,
            html:              htmlInputs,
            showCancelButton:  true,
            confirmButtonText: 'Guardar',
            cancelButtonText:  'Cancelar',
            confirmButtonColor:'#0f766e',
            cancelButtonColor: '#6b7280',
            reverseButtons:    true,
            focusCancel:       true,
            preConfirm: function() {
                var res = {};
                campos.forEach(function(c) {
                    var el = document.getElementById('swal-field-' + c.key);
                    if (el) res[c.key] = el.value;
                });
                return res;
            }
        }).then(function(result) {
            resolve(result.isConfirmed ? result.value : null);
        });
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

    var modalRS = document.getElementById('registrarSedeModal');
    if (modalRS) {
        modalRS.addEventListener('click', function(e) {
            if (e.target === modalRS) cerrarModalRegistrarSede();
        });
    }

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

// ==================== BANNER SEDE ====================
// ================================================================
// CAMBIO EN SedeD.js
// Reemplazar la función cargarBannerSede() completa
// ================================================================

async function cargarBannerSede(){
    try {
        var res = await fetch(API_BASE_URL+'/sedes');
        if (!res.ok) return;
        var sedes = await res.json();
        if (!sedes||!sedes.length) return;

        // Resolver sede activa desde el JWT
        var sedeActual = sedes[0];
        var tokenActual = sessionStorage.getItem('aparca_jwt');
        if (tokenActual) {
            try {
                var payload = JSON.parse(atob(tokenActual.split('.')[1]));
                if (payload.sedeId) {
                    var match = sedes.find(function(s){ return s.id === payload.sedeId; });
                    if (match) sedeActual = match;
                }
            } catch(e) {}
        }

        var s = sedeActual;
        function set(id,v){var el=document.getElementById(id);if(el)el.textContent=v||'—';}
        set('sedeHeaderNombre',    s.nombre);
        set('sedeHeaderDireccion', s.direccion);
        set('sedeHeaderEstado',    s.estado);
        set('ind-sede-nombre',     s.nombre);

        var img         = document.getElementById('sedeHeaderImg');
        var placeholder = document.getElementById('sedeHeaderPlaceholder');


        if (img) {
            img.style.display = 'none';
            img.src = '';
        }
        if (placeholder) placeholder.style.display = 'flex';

        if (s.imagenSede) {
            if (img) {
                // Forzar recarga aunque el src sea el mismo
                var nuevaSrc = '/' + s.imagenSede + '?t=' + Date.now();
                img.onload  = function() {
                    img.style.display = 'block';
                    if (placeholder) placeholder.style.display = 'none';
                };
                img.onerror = function() {
                    img.style.display = 'none';
                    if (placeholder) placeholder.style.display = 'flex';
                };
                img.src = nuevaSrc;
            }
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
        if (!periodoDesde||!periodoHasta){showWarning('Selecciona ambas fechas');return;}
        if (periodoDesde>periodoHasta){showWarning('La fecha de inicio no puede ser mayor que la fecha fin');return;}
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
        showError('Error al cargar los datos de gráficas');
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
    // CAMBIO: emojis 🚗 🏍️ 🚲 → texto plano
    chartOcupacion = new Chart(canvas,{
        type:'bar',
        data:{
            labels:['Carros','Motos','Bicicletas'],
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

// ==================== REPORTES ====================
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
        showSuccess('Reporte PDF generado correctamente');
    } catch(e){showError('Error al generar el reporte PDF');}
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
        showSuccess('Reporte Excel generado correctamente');
    } catch(e){showError('Error al generar el reporte Excel');}
}

// ==================== HISTORIAL ====================
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
    var map={
        'btnUsuarios':function(){switchToTab('usuarios');},
        'btnSedes':function(){switchToTab('sedes');},
        'tab-mailuno':function(){switchMailTab('uno');},
        'tab-mailmasivo':function(){switchMailTab('masivo');}
    };
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
    try{
        var r=await fetch(API_BASE_URL+'/usuarios');
        if(r.ok){usuariosData=await r.json();mostrarUsuarios(usuariosData);}
        else showError('No se pudieron cargar los usuarios');
    }
    catch(e){showError('Error de conexión al cargar usuarios');}
}
async function cargarSedes(){
    try{
        var r=await fetch(API_BASE_URL+'/sedes');
        if(r.ok){sedesData=await r.json();mostrarSedes(sedesData);}
        else showError('No se pudieron cargar las sedes');
    }
    catch(e){showError('Error de conexión al cargar sedes');}
}

// ==================== VISUALIZACIÓN ====================
function mostrarUsuarios(usuarios){
    var tb=document.getElementById('usuariosTableBody'); if(!tb) return;
    if (!usuarios.length){
        tb.innerHTML='<tr><td colspan="5" style="text-align:center;color:#64748b;">No hay usuarios registrados</td></tr>';
        return;
    }
    tb.innerHTML=usuarios.map(function(u){
        return '<tr><td>'+(u.nombre||'N/A')+'</td><td>'+(u.correo||'N/A')+'</td>' +
            '<td>'+(u.telefono||'N/A')+'</td>' +
            '<td><span class="sede-badge sede-badge-info">'+(u.rol||'N/A')+'</span></td>' +
            '<td><span class="sede-badge '+(u.estado==='ACTIVO'?'sede-badge-success':'sede-badge-danger')+'">'+(u.estado||'N/A')+'</span></td></tr>';
    }).join('');
}

function mostrarSedes(sedes){
    var tb=document.getElementById('sedesTableBody'); if(!tb) return;
    if (!sedes.length){
        tb.innerHTML='<tr><td colspan="5" style="text-align:center;color:#64748b;">No tiene sede asignada</td></tr>';
        return;
    }
    tb.innerHTML=sedes.map(function(s){
        var pct=s.capacidad>0?Math.round(((s.ocupacionActual||0)/s.capacidad)*100):0;
        var bc=pct>80?'#ef4444':pct>50?'#f59e0b':'#10b981';
        // CAMBIO: emoji ⚙️ → icono SVG Lucide (settings)
        return '<tr>' +
            '<td><strong>'+(s.nombre||'N/A')+'</strong><div style="font-size:.75rem;color:#64748b;margin-top:2px;">'+(s.direccion||'')+'</div></td>' +
            '<td>'+(s.capacidad||0)+' cupos</td>' +
            '<td><div style="display:flex;align-items:center;gap:.5rem;">' +
            '<div style="flex:1;background:#f1f5f9;border-radius:9999px;height:8px;overflow:hidden;">' +
            '<div style="width:'+pct+'%;height:100%;background:'+bc+';border-radius:9999px;transition:width .6s;"></div></div>' +
            '<span style="font-size:.75rem;font-weight:700;color:#374151;min-width:32px;">'+pct+'%</span></div></td>' +
            '<td><span class="sede-badge '+(s.estado==='ACTIVO'?'sede-badge-success':'sede-badge-danger')+'">'+(s.estado||'N/A')+'</span></td>' +
            '<td><button class="sede-btn-primary" style="font-size:.8rem;padding:.4rem .875rem;white-space:nowrap;display:inline-flex;align-items:center;gap:.375rem;" onclick="gestionarSede('+s.id+',\''+(s.nombre||'').replace(/\'/g,"\\'")+'\')">'+
            '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>' +
            '<circle cx="12" cy="12" r="3"/></svg>' +
            'Gestionar</button></td>' +
            '</tr>';
    }).join('');
}

async function gestionarSede(id, nombre) {
    try {
        var tokenActual = sessionStorage.getItem('aparca_jwt');
        if (tokenActual) {
            try {
                var payload = JSON.parse(atob(tokenActual.split('.')[1]));
                if (payload.sedeId === id) {
                    var l = document.querySelector('.aparca-sidebar-nav a[data-tab="gestion"]');
                    if (l) l.click();
                    return;
                }
            } catch(e) {}
        }
        showInfo('Cambiando a sede: ' + (nombre || id) + '...');
        var r = await fetch('/api/auth/cambiar-sede', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sedeId: id })
        });
        if (!r.ok) { var err = await r.json(); showError(err.message || 'Error al cambiar de sede'); return; }
        var data = await r.json();
        if (data.success && data.token) {
            sessionStorage.setItem('aparca_jwt', data.token);
            showSuccess('Sede activa: ' + data.sedeNombre);
            var l = document.querySelector('.aparca-sidebar-nav a[data-tab="gestion"]');
            if (l) l.click();
            setTimeout(function() {
                cargarEstadisticas();
                cargarBannerSede();
                loadVehiculosActivos();
                loadPendientesCobro();
            }, 200);
        }
    } catch(e) { showError('Error al cambiar de sede'); console.error(e); }
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
        // CAMBIO: texto limpio sin emoji
        if(badge){badge.textContent='RÁPIDO';badge.style.background='#0d9488';badge.style.color='white';}
        if(slider)slider.style.background='#0d9488';
        if(knob)knob.style.transform='translateX(20px)';
        if(txt)txt.textContent='Registrar Rápido';
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
    if (!validateFormularioEntrada()){
        showWarning(modoRapido?'Ingresa la placa y el tipo de vehículo':'Completa todos los campos requeridos');
        return;
    }
    try {
        var placa=getInputValue('placa'), tipo=getInputValue('tipoVehiculo');
        var datos={vehiculoPlaca:placa,vehiculoTipo:tipo,
            vehiculoMarca:getInputValue('marca')||'OTRO',
            vehiculoColor:getInputValue('color')||'NO ESPECIFICADO',
            vehiculoAnio:getInputValue('anio')||'2020'};
        if (modoRapido){
            datos.clienteNombre='Visitante';datos.clienteTelefono='';
            datos.clienteEmail=placa.toLowerCase()+'@temp.aparcaya.co';datos.clienteCedula='';
            // CAMBIO: emoji ⚡ → texto limpio
            showInfo('Registrando entrada rápida...');
        } else {
            datos.clienteNombre=getInputValue('nombre');datos.clienteTelefono=getInputValue('telefono');
            datos.clienteEmail=getInputValue('correo1');datos.clienteCedula=getInputValue('cedula');
            showInfo('Registrando entrada...');
        }
        var r=await fetch(API_BASE_URL+'/registrar-entrada',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(datos)});
        if (!r.ok){var err=await r.json();throw new Error(err.error||'Error al registrar entrada');}
        var result=await r.json();
        // CAMBIO: emojis ⚡ ✅ → texto limpio
        if (modoRapido) {
            showSuccess('Placa '+placa+' registrada. Cupo: '+(result.cupo||'S/A'));
        } else {
            showSuccess('Entrada de '+result.clienteNombre+'. Cupo: '+(result.cupo||'S/A'));
        }
        limpiarFormularioEntrada();
        setTimeout(function(){loadVehiculosActivos();},400);
    } catch(e){showError(e.message);}
}

async function buscarPorPlacaIntegrado(){
    var placa=getInputValue('buscarPlaca');
    if (!placa||placa.length<5){showWarning('Ingrese una placa válida');return;}
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
            // CAMBIO: emoji ✅ → texto limpio
            showSuccess('Vehículo encontrado — datos cargados');
        } else {
            limpiarFormularioEntrada();setInputValue('placa',placa);
            showInfo('Vehículo nuevo. Complete los datos.');
        }
    } catch(e){showError('Error al buscar');}
}

// ==================== VEHÍCULOS ACTIVOS ====================
async function loadVehiculosActivos(){
    try {
        var r=await fetch(API_BASE_URL+'/vehiculos-activos',{headers:{'Content-Type':'application/json'}});
        if (!r.ok) throw new Error('Error');
        var vehiculos=await r.json();
        var tb=document.getElementById('vehiculosActivosBody'); if(!tb) return;
        Object.values(timerIntervals).forEach(function(id){clearInterval(id);}); timerIntervals={};
        if (!vehiculos.length){
            tb.innerHTML='<tr><td colspan="8" style="text-align:center;">No hay vehículos en el parqueadero</td></tr>';
            return;
        }
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
    } catch(e){showError('Error al cargar vehículos activos');}
}

// ==================== MODAL SALIDA ====================
async function abrirModalSalida(registroId){
    var modal=document.getElementById('salidaModal');
    if(!modal){showError('Error: Modal no encontrado');return;}
    try {
        currentSalidaRegistroId=registroId;
        var r=await fetch(API_BASE_URL+'/vehiculos-activos',{headers:{'Content-Type':'application/json'}});
        if(!r.ok) throw new Error('Error');
        var vehiculos=await r.json();
        var v=vehiculos.find(function(x){return x.registroId===registroId;});
        if(!v){showError('Vehículo no encontrado');return;}
        function set(id,v){var el=document.getElementById(id);if(el)el.textContent=v;}
        set('salidaPlaca',v.placa);set('salidaCliente',v.clienteNombre);
        set('salidaHoraEntrada',formatDateTime(v.horaEntrada));set('salidaTiempo',v.tiempoTranscurrido);
        var ec=document.getElementById('salidaCobroEstimado');
        if(ec)ec.innerHTML='<div class="sede-modal-salida-row"><strong>Plena:</strong><span>$'+formatNumber(v.cobroEstimadoPlena)+'</span></div>' +
            '<div class="sede-modal-salida-row"><strong>Minuto:</strong><span style="color:#059669;">$'+formatNumber(v.cobroEstimadoMinuto)+'</span></div>';
        modal.classList.add('open');modal.setAttribute('aria-hidden','false');
    } catch(e){showError('Error al abrir modal de salida');}
}
function cerrarModalSalida(){
    var m=document.getElementById('salidaModal');
    if(m){m.classList.remove('open');m.setAttribute('aria-hidden','true');}
    currentSalidaRegistroId=null;
}
async function confirmarSalida(){
    if(!currentSalidaRegistroId) return;
    try {
        showInfo('Registrando salida...');
        var r=await fetch(API_BASE_URL+'/registrar-salida/'+currentSalidaRegistroId,{method:'POST',headers:{'Content-Type':'application/json'}});
        if(!r.ok){var err=await r.json();throw new Error(err.error||'Error');}
        showSuccess('Salida registrada. Proceda a cobrar.');
        cerrarModalSalida();await loadVehiculosActivos();await loadPendientesCobro();
    } catch(e){showError(e.message);}
}

// ==================== PENDIENTES COBRO ====================
async function loadPendientesCobro(){
    try {
        var r=await fetch(API_BASE_URL+'/vehiculos-pendientes-cobro',{headers:{'Content-Type':'application/json'}});
        if(!r.ok) throw new Error('Error');
        var pendientes=await r.json();
        var tb=document.getElementById('pendientesCobroBody'); if(!tb) return;
        if(!pendientes.length){
            tb.innerHTML='<tr><td colspan="7" style="text-align:center;">No hay pendientes</td></tr>';
            return;
        }
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
    } catch(e){showError(e.message);cerrarModalCobro();}
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
        if(!tt){showWarning('Seleccione una tarifa');return;}
        showInfo('Procesando cobro...');
        var r=await fetch(API_BASE_URL+'/confirmar-cobro/'+currentCobroRegistroId,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({metodoPago:metodoPago,tipoTarifa:tt.value})});
        if(!r.ok){var err=await r.json();throw new Error(err.error||'Error');}
        var data=await r.json();
        showSuccess('Cobro: $'+formatNumber(data.precio)+' — '+data.tipoTarifaAplicada);
        cerrarModalCobro();await loadPendientesCobro();
    } catch(e){showError(e.message);}
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
        if(!registros.length){
            tb.innerHTML='<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:2rem;">Sin registros para los filtros seleccionados</td></tr>';
            return;
        }
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

async function aceptarReservacion(id) {
    var ok = await showConfirm(
        'Aceptar reservación',
        '¿Confirmas que deseas aceptar esta reservación?',
        'Aceptar', 'warning'
    );
    if (!ok) { return; }
    try {
        // ANTES: /api/trabajador/aceptar-reservacion/{id}
        // DESPUÉS: endpoint unificado con lógica de estado correcta
        var response = await fetch('/api/reservaciones/' + id + '/aceptar', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            var err = await response.json();
            throw new Error(err.message || 'Error al aceptar la reservación');
        }
        showSuccess('Reservación aceptada — el cliente será notificado');
        await loadReservaciones();
        await loadIndicadores();
    } catch (error) {
        showError(error.message);
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

// ==================== CARGA MASIVA ====================
async function cargarExcel(){
    var fi=document.getElementById('excelFile');
    var file=fi?fi.files[0]:null;
    if(!file){showWarning('Por favor seleccione un archivo Excel');return;}
    var ext=file.name.split('.').pop().toLowerCase();
    if(!['xlsx','xls'].includes(ext)){showWarning('El archivo debe ser formato Excel');return;}
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
        if (data.tieneErrores) {
            showWarning('Carga completada con '+data.errores.length+' error(es)');
        } else {
            showSuccess('Carga exitosa: '+(data.totalRegistros||0)+' registros');
        }
        fi.value='';var ai=document.getElementById('archivoSeleccionado');if(ai)ai.innerHTML='';
        setTimeout(function(){if(pc)pc.style.display='none';},2000);
    } catch(e){showError('Error: '+e.message);if(pc)pc.style.display='none';}
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
    // CAMBIO: emojis 🚗 👤 → texto limpio con badges
    if(tb&&data.registrosCargados)tb.innerHTML=data.registrosCargados.map(function(r){
        if(r.tipo==='Vehículo'||r.tipo==='Vehiculo')return '<tr>' +
            '<td><span class="sede-badge sede-badge-info">Vehículo</span></td>' +
            '<td><strong>'+(r.placa||'N/A')+'</strong></td>' +
            '<td><strong>'+(r.marca||'N/A')+'</strong> '+(r.tipoVehiculo||'')+'<br>' +
            '<small style="color:#64748b;">Color: '+(r.color||'N/A')+' · Año: '+(r.anio||'N/A')+'</small><br>' +
            '<small style="color:#64748b;">Propietario: '+(r.propietario||'N/A')+'</small></td>' +
            '<td><span class="sede-badge sede-badge-success">OK</span></td></tr>';
        if(r.tipo==='Cliente')return '<tr>' +
            '<td><span class="sede-badge sede-badge-success">Cliente</span></td>' +
            '<td><strong>'+(r.nombre||'N/A')+'</strong></td>' +
            '<td>'+(r.email||'N/A')+'<br><small style="color:#64748b;">Tel: '+(r.telefono||'N/A')+'</small></td>' +
            '<td><span class="sede-badge sede-badge-success">OK</span></td></tr>';
        return '';
    }).join('');
}

function descargarPlantillaCompleta(){
    if(typeof XLSX==='undefined'){showError('Error: Librería XLSX no está cargada');return;}
    var wb=XLSX.utils.book_new();
    var wsC=XLSX.utils.aoa_to_sheet([['Tipo','Nombre','Teléfono','Email','Cédula'],['Cliente','Juan Pérez','0987654321','juan@gmail.com','1234567899']]);
    wsC['!cols']=[{wch:10},{wch:20},{wch:12},{wch:28},{wch:12}];XLSX.utils.book_append_sheet(wb,wsC,'Clientes');
    var wsV=XLSX.utils.aoa_to_sheet([['Tipo','Placa','Tipo Vehículo','Marca','Color','Año','Email Cliente'],['Vehiculo','ABC123','CARRO','TOYOTA','Blanco','2020','juan@gmail.com']]);
    wsV['!cols']=[{wch:10},{wch:10},{wch:15},{wch:12},{wch:10},{wch:8},{wch:28}];XLSX.utils.book_append_sheet(wb,wsV,'Vehículos');
    XLSX.writeFile(wb,'Plantilla_Carga_Masiva_Completa.xlsx');
    showSuccess('Plantilla descargada');
}

function descargarPlantillaVehiculosSolo(){
    if(typeof XLSX==='undefined'){showError('Error: Librería XLSX no está cargada');return;}
    var wb=XLSX.utils.book_new();
    var wsV=XLSX.utils.aoa_to_sheet([['Tipo','Placa','Tipo Vehículo','Marca','Color','Año','Email Cliente'],['Vehiculo','ABC123','CARRO','TOYOTA','Blanco','2020','juan@gmail.com']]);
    wsV['!cols']=[{wch:10},{wch:10},{wch:15},{wch:12},{wch:10},{wch:8},{wch:28}];XLSX.utils.book_append_sheet(wb,wsV,'Vehículos');
    XLSX.writeFile(wb,'Plantilla_Solo_Vehiculos.xlsx');
    showSuccess('Plantilla descargada');
}

function mostrarArchivoSeleccionado(){
    var fi=document.getElementById('excelFile'),info=document.getElementById('archivoSeleccionado');
    if(fi&&fi.files[0]){
        var f=fi.files[0];
        // CAMBIO: emoji 📎 → icono SVG inline
        info.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:4px;color:#0d9488;"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>' +
            '<strong>'+f.name+'</strong> ('+(f.size/1024).toFixed(2)+' KB)';
        info.style.color='#059669';
    }
    else if(info)info.innerHTML='';
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
    if(!datos.nombre||!datos.correo){showWarning('Complete Nombre y Correo');return;}
    if(!datos.contrasena||datos.contrasena.length<8){showWarning('La contraseña debe tener al menos 8 caracteres');return;}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo)){showWarning('Ingrese un correo válido');return;}
    try {
        var r=await fetch(API_BASE_URL+'/registrar-trabajador',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(datos)});
        if(r.ok){
            var res=await r.json();
            showSuccess(res.mensaje||'Trabajador registrado exitosamente');
            closeRegistrarTrabajadorModal();cargarUsuarios();
        } else {
            var err=await r.json();showError(err.error||'Error al registrar trabajador');
        }
    } catch(e){showError('Error de conexión al registrar trabajador');}
}

// ==================== CORREOS ====================
async function enviarCorreoUno(){
    var email=(document.getElementById('emailSingle')||{}).value?.trim()||'';
    var subject=(document.getElementById('subjectSingle')||{}).value?.trim()||'';
    var message=(document.getElementById('messageSingle')||{}).value?.trim()||'';
    if(!email||!subject||!message){showWarning('Complete todos los campos');return;}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){showWarning('Correo inválido');return;}
    var btn=document.querySelector('#correoUno button[type="submit"]');
    if(btn){btn.disabled=true;btn.textContent='Enviando...';}
    var fd=new URLSearchParams();fd.append('correo',email);fd.append('asunto',subject);fd.append('mensaje',message);
    try {
        var r=await fetch(API_BASE_URL+'/correo/unitario',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:fd.toString()});
        var data=await r.json();
        if(data.status==='success'){
            showSuccess(data.message);
            ['emailSingle','subjectSingle','messageSingle'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
        } else showError(data.message||'Error al enviar correo');
    } catch(e){showError('Error de conexión');}
    finally{if(btn){btn.disabled=false;btn.textContent='Enviar Correo';}}
}

async function enviarCorreoMasivo(){
    var emailsRaw=(document.getElementById('emailsMassive')||{}).value?.trim()||'';
    var subject=(document.getElementById('subjectMassive')||{}).value?.trim()||'';
    var message=(document.getElementById('messageMassive')||{}).value?.trim()||'';
    if(!emailsRaw||!subject||!message){showWarning('Complete todos los campos');return;}
    var list=emailsRaw.split(',').map(function(e){return e.trim();}).filter(Boolean);
    var invalid=list.filter(function(e){return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);});
    if(invalid.length){showError('Correos inválidos: '+invalid.join(', '));return;}
    if(!list.length){showWarning('Ingresa al menos un correo');return;}
    var btn=document.querySelector('#correoMasivo button[type="submit"]');
    if(btn){btn.disabled=true;btn.textContent='Enviando...';}
    var fd=new URLSearchParams();list.forEach(function(e){fd.append('seleccionados',e);});fd.append('asunto',subject);fd.append('mensaje',message);
    try {
        var r=await fetch(API_BASE_URL+'/correo/masivo',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:fd.toString()});
        var data=await r.json();
        if(data.status==='success'){
            showSuccess(data.message);
            ['emailsMassive','subjectMassive','messageMassive'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
        } else showError(data.message||'Error al enviar correos');
    } catch(e){showError('Error de conexión');}
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
    if(!rol){showWarning('Selecciona un grupo primero');return;}
    if(estEl)estEl.textContent='Consultando...';
    if(listEl)listEl.style.display='none';
    if(btnEl){btnEl.disabled=true;btnEl.textContent='Cargando...';}
    var ep={clientes:API_BASE_URL+'/correos/clientes',trabajadores:API_BASE_URL+'/correos/trabajadores'};
    try {
        var r=await fetch(ep[rol]);if(!r.ok)throw new Error('Error '+r.status);
        var datos=await r.json();_sedeDestinatariosCache=datos;
        if(!datos.length){
            if(estEl)estEl.textContent=rol==='trabajadores'?'No hay trabajadores asignados.':'No se encontraron clientes.';
            if(listEl)listEl.style.display='none';
            return;
        }
        if(tabEl)tabEl.innerHTML=datos.map(function(d){
            return '<label style="display:flex;align-items:center;gap:.75rem;padding:.6rem .75rem;cursor:pointer;border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background=\'#f0fdf9\'" onmouseout="this.style.background=\'transparent\'">' +
                '<input type="checkbox" class="sede-dest-check" data-correo="'+d.correo+'" style="width:16px;height:16px;cursor:pointer;accent-color:#0d9488;" checked/>' +
                '<div style="flex:1;min-width:0;"><div style="font-weight:600;font-size:.875rem;color:#1e293b;">'+(d.nombre||'(sin nombre)')+'</div>' +
                '<div style="font-size:.8rem;color:#64748b;">'+d.correo+'</div></div>' +
                '<span style="font-size:.72rem;background:#ccfbf1;color:#0f766e;border-radius:9999px;padding:.15rem .5rem;">'+(d.rol==='OPERARIO'?'Operario':'Cliente')+'</span></label>';
        }).join('');
        if(cntEl)cntEl.textContent=datos.length+' usuario(s) encontrado(s)';
        if(estEl)estEl.textContent='';if(listEl)listEl.style.display='block';
    } catch(e){
        if(estEl)estEl.textContent='Error al consultar. Intenta de nuevo.';
        showError('Error al consultar destinatarios');
    }
    finally{if(btnEl){btnEl.disabled=false;btnEl.textContent='Consultar';}}
}

function sedeSeleccionarTodos(estado) {
    document.querySelectorAll('.sede-dest-check').forEach(function(cb) {
        cb.checked = estado;
    });
}

function sedeAgregarSeleccionados(){
    var sel=[];document.querySelectorAll('.sede-dest-check:checked').forEach(function(cb){if(cb.dataset.correo)sel.push(cb.dataset.correo);});
    if(!sel.length){showWarning('No hay destinatarios seleccionados');return;}
    var ta=document.getElementById('emailsMassive');if(!ta)return;
    var ex=ta.value.split(',').map(function(e){return e.trim();}).filter(Boolean);
    var nuevos=sel.filter(function(e){return!ex.includes(e);});
    ta.value=ex.concat(nuevos).filter(Boolean).join(', ');
    _sedeActualizarBadge();
    showSuccess(nuevos.length+' correo(s) agregado(s) al envío');
    var l=document.getElementById('sedeListaDestinatarios');if(l)l.style.display='none';
    // CAMBIO: emoji ✓ → texto limpio
    var e=document.getElementById('sedeEstadoFiltro');
    if(e)e.textContent=sel.length+' destinatario(s) cargados desde base de datos.';
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
function cfgClickFuera(e) {
    if (e.target === document.getElementById('cfgModalOverlay')) {
        cerrarModalConfiguracion();
    }
}

document.addEventListener('keydown',function(e){
    if(e.key!=='Escape')return;
    var ov=document.getElementById('cfgModalOverlay'),co=document.getElementById('cobroModal'),sa=document.getElementById('salidaModal');
    if(ov&&ov.classList.contains('open')){cerrarModalConfiguracion();return;}
    if(co&&co.classList.contains('open')){cerrarModalCobro();return;}
    if(sa&&sa.classList.contains('open')){cerrarModalSalida();return;}
    var rs=document.getElementById('registrarSedeModal');
    if(rs&&rs.classList.contains('show')){cerrarModalRegistrarSede();return;}
});

async function cfgCargarDatos() {
    try {
        var r = await fetch(API_BASE_URL + '/mi-configuracion');
        if (!r.ok) throw new Error('Error');
        var d = await r.json();

        function set(id, v) { var el = document.getElementById(id); if (el) el.value = v || ''; }

        set('cfg-nombre',    d.nombre);
        set('cfg-nit',       d.nit);
        set('cfg-direccion', d.direccion);
        set('cfg-telefono',  d.telefonoSede);
        set('cfg-correo',    d.correoSede);
        set('cfg-horario',   d.horarioSede);

        var tarifa = d.tarifas && d.tarifas.length > 0 ? d.tarifas[0] : null;
        set('cfg-tarifaPlenaC',  tarifa ? tarifa.tarifaPlenaC  : '');
        set('cfg-tarifaMinutoC', tarifa ? tarifa.tarifaMinutoC : '');
        set('cfg-tarifaHoraC',   tarifa ? tarifa.tarifaHoraC   : '');
        set('cfg-tarifaPlenaM',  tarifa ? tarifa.tarifaPlenaM  : '');
        set('cfg-tarifaMinutoM', tarifa ? tarifa.tarifaMinutoM : '');
        set('cfg-tarifaHoraM',   tarifa ? tarifa.tarifaHoraM   : '');
        set('cfg-tarifaPlenaB',  tarifa ? tarifa.tarifaPlenaB  : '');
        set('cfg-tarifaMinutoB', tarifa ? tarifa.tarifaMinutoB : '');
        set('cfg-tarifaHoraB',   tarifa ? tarifa.tarifaHoraB   : '');

        cfgActualizarPreview();

        var cupo = d.cupos && d.cupos.length > 0 ? d.cupos[0] : null;
        set('cfg-cuposCarro',     cupo ? cupo.cuposCarro     : 0);
        set('cfg-cuposMoto',      cupo ? cupo.cuposMoto      : 0);
        set('cfg-cuposBicicleta', cupo ? cupo.cuposBicicleta : 0);
        set('cfg-capacidadTotal', d.capacidad);

        cfgActualizarBarra();

        var img = document.getElementById('cfgImgPreviewEl');
        var ph  = document.getElementById('cfgImgPlaceholder');
        if (d.imagenSede && img) {
            img.src = '/' + d.imagenSede;
            img.style.display = 'block';
            if (ph) ph.style.display = 'none';
        }

        cargarBannerSede();
    } catch (e) {
        showError('Error al cargar la configuración');
    }
}

function cfgActualizarPreview() {
    function gv(id) { var el = document.getElementById(id); return el ? parseFloat(el.value) || 0 : 0; }
    var pc = gv('cfg-tarifaPlenaC'),  mc = gv('cfg-tarifaMinutoC'),  hc = gv('cfg-tarifaHoraC');
    var pm = gv('cfg-tarifaPlenaM'),  mm = gv('cfg-tarifaMinutoM'),  hm = gv('cfg-tarifaHoraM');
    var pb = gv('cfg-tarifaPlenaB'),  mb = gv('cfg-tarifaMinutoB'),  hb = gv('cfg-tarifaHoraB');
    function fmt(v) { return v > 0 ? '$' + formatNumber(v) : '—'; }
    function set(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
    set('prev-plena-c', fmt(pc));
    set('prev-min-c',   fmt(mc * 60));
    set('prev-hora-c',  fmt(hc));
    set('prev-plena-m', fmt(pm));
    set('prev-min-m',   fmt(mm * 60));
    set('prev-hora-m',  fmt(hm));
    set('prev-plena-b', fmt(pb));
    set('prev-min-b',   fmt(mb * 60));
    set('prev-hora-b',  fmt(hb));
}

function cfgActualizarBarra() {
    function gi(id) { var el = document.getElementById(id); return el ? parseInt(el.value) || 0 : 0; }
    var c = gi('cfg-cuposCarro'), m = gi('cfg-cuposMoto'), b = gi('cfg-cuposBicicleta');
    var total = c + m + b;
    var capacidad = gi('cfg-capacidadTotal');

    function set(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
    set('leg-carro',     c);
    set('leg-moto',      m);
    set('leg-bicicleta', b);
    set('leg-total',     total);

    if (total > 0) {
        function sw(id, pct) { var el = document.getElementById(id); if (el) el.style.width = pct + '%'; }
        sw('bar-carro',     Math.round((c / total) * 100));
        sw('bar-moto',      Math.round((m / total) * 100));
        sw('bar-bicicleta', Math.round((b / total) * 100));
    }

    var alerta     = document.getElementById('cfg-cupos-alerta');
    var btnGuardar = document.getElementById('btn-guardar-cupos');
    var sumaEl     = document.getElementById('cfg-cupos-suma');
    var limiteEl   = document.getElementById('cfg-cupos-limite');

    if (sumaEl)   sumaEl.textContent   = total;
    if (limiteEl) limiteEl.textContent = capacidad;

    var excede = capacidad > 0 && total > capacidad;
    if (alerta)     alerta.style.display    = excede ? 'block' : 'none';
    if (btnGuardar) btnGuardar.disabled     = excede;

    ['cfg-cuposCarro', 'cfg-cuposMoto', 'cfg-cuposBicicleta'].forEach(function(id) {
        var f = document.getElementById(id);
        if (f) f.style.borderColor = excede ? '#ef4444' : '';
    });
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
        showSuccess('Información actualizada correctamente');
        cargarBannerSede();cargarSedes();cargarEstadisticas();
    } catch(e){showError('Error al guardar la información');}
}

async function cfgGuardarTarifas() {
    function gv(id) { var el = document.getElementById(id); return el ? parseFloat(el.value) : null; }
    var pc = gv('cfg-tarifaPlenaC'),  mc = gv('cfg-tarifaMinutoC'),  hc = gv('cfg-tarifaHoraC');
    var pm = gv('cfg-tarifaPlenaM'),  mm = gv('cfg-tarifaMinutoM'),  hm = gv('cfg-tarifaHoraM');
    var pb = gv('cfg-tarifaPlenaB'),  mb = gv('cfg-tarifaMinutoB'),  hb = gv('cfg-tarifaHoraB');

    ['cfg-tarifaPlenaC','cfg-tarifaMinutoC','cfg-tarifaHoraC',
        'cfg-tarifaPlenaM','cfg-tarifaMinutoM','cfg-tarifaHoraM',
        'cfg-tarifaPlenaB','cfg-tarifaMinutoB','cfg-tarifaHoraB'].forEach(function(id) {
        var err = document.getElementById('err-' + id.replace('cfg-',''));
        if (err) err.textContent = '';
    });

    var valido = true;
    function validarTarifa(v, errId, label) {
        if (v === null || isNaN(v) || v < 0) {
            var el = document.getElementById(errId);
            if (el) el.textContent = label + ' debe ser mayor o igual a 0';
            valido = false;
        }
    }
    validarTarifa(pc, 'err-tarifaPlenaC',  'Tarifa plena carro');
    validarTarifa(mc, 'err-tarifaMinutoC', 'Tarifa minuto carro');
    validarTarifa(hc, 'err-tarifaHoraC',  'Tarifa hora carro');
    validarTarifa(pm, 'err-tarifaPlenaM',  'Tarifa plena moto');
    validarTarifa(mm, 'err-tarifaMinutoM', 'Tarifa minuto moto');
    validarTarifa(hm, 'err-tarifaHoraM',  'Tarifa hora moto');
    validarTarifa(pb, 'err-tarifaPlenaB',  'Tarifa plena bicicleta');
    validarTarifa(mb, 'err-tarifaMinutoB', 'Tarifa minuto bicicleta');
    validarTarifa(hb, 'err-tarifaHoraB',  'Tarifa hora bicicleta');
    if (!valido) return;

    try {
        var fd = new FormData();
        fd.append('tarifaPlenaC',  pc); fd.append('tarifaMinutoC', mc); fd.append('tarifaHoraC',   hc);
        fd.append('tarifaPlenaM',  pm); fd.append('tarifaMinutoM', mm); fd.append('tarifaHoraM',   hm);
        fd.append('tarifaPlenaB',  pb); fd.append('tarifaMinutoB', mb); fd.append('tarifaHoraB',   hb);
        var r = await fetch(API_BASE_URL + '/mi-configuracion', { method: 'PUT', body: fd });
        if (!r.ok) throw new Error('Error');
        showSuccess('Tarifas actualizadas correctamente');
    } catch (e) {
        showError('Error al guardar las tarifas');
    }
}

async function cfgGuardarCupos() {
    function gi(id) { var el = document.getElementById(id); return el ? parseInt(el.value) || 0 : 0; }
    var c = gi('cfg-cuposCarro'), m = gi('cfg-cuposMoto'), b = gi('cfg-cuposBicicleta');
    var capacidad = gi('cfg-capacidadTotal');
    var total = c + m + b;

    ['err-cuposCarro','err-cuposMoto','err-cuposBicicleta'].forEach(function(id) {
        var el = document.getElementById(id); if (el) el.textContent = '';
    });

    if (capacidad > 0 && total > capacidad) {
        showError('La suma de cupos (' + total + ') supera la capacidad total de la sede (' + capacidad + ')');
        cfgActualizarBarra();
        return;
    }

    if (c < 0 || m < 0 || b < 0) {
        showError('Los cupos no pueden ser negativos');
        return;
    }

    try {
        var fd = new FormData();
        fd.append('cuposCarro', c); fd.append('cuposMoto', m); fd.append('cuposBicicleta', b);
        var r = await fetch(API_BASE_URL + '/mi-configuracion', { method: 'PUT', body: fd });
        if (!r.ok) throw new Error('Error');
        showSuccess('Cupos actualizados correctamente');
        cfgActualizarBarra();
    } catch (e) {
        showError('Error al guardar los cupos');
    }
}

function cfgPrevisualizarImagen(input){
    if(!input.files||!input.files[0])return;
    var file=input.files[0];
    if(file.size>5*1024*1024){showError('La imagen no puede superar 5 MB');input.value='';return;}
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
    if(!input||!input.files[0]){showWarning('Selecciona una imagen primero');return;}
    try {
        var fd=new FormData();fd.append('imagen',input.files[0]);
        var r=await fetch(API_BASE_URL+'/mi-configuracion',{method:'PUT',body:fd});
        if(!r.ok)throw new Error('Error');
        showSuccess('Imagen actualizada correctamente');
        var btn=document.getElementById('btn-guardar-img');if(btn)btn.disabled=true;
        cargarBannerSede();
    } catch(e){showError('Error al subir la imagen');}
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
        showSuccess('Contraseña actualizada correctamente');cfgLimpiarContrasena();
    } catch(e){showError(e.message);}
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
function irAyuda(){showInfo('Sección de ayuda próximamente');}

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
        '@keyframes rs-spin{to{transform:rotate(360deg);}}' +
        '.hidden{display:none!important;}';
    document.head.appendChild(style);
}

// ================================================================
// SISTEMA DE MAPA — REGISTRAR SEDE
// (sin cambios — lógica pura de mapa/geocodificación)
// ================================================================
var RS_BARRIOS = {
    USAQUEN:['Santa Bárbara','Cedritos','Usaquén','La Calleja','Molinos Norte','Barrancas','Country Club'],
    CHAPINERO:['Chicó','El Lago','Rosales','Chapinero Alto','Antiguo Country','La Cabrera'],
    SANTA_FE:['Las Aguas','La Perseverancia','San Diego','La Candelaria','Las Cruces'],
    SAN_CRISTOBAL:['San Cristóbal Norte','San Blas','La Victoria','20 de Julio','Altamira'],
    USME:['Usme Pueblo','Yomasa','El Virrey','Gran Yomasa','Alfonso López'],
    TUNJUELITO:['Parque El Tunal','San Vicente','Venecia','Abraham Lincoln','San Benito'],
    BOSA:['Bosa Central','Bosa Laureles','El Porvenir','San Bernardino','Apogeo'],
    KENNEDY:['Tintal','Timiza','Mandalay','Carvajal','Patio Bonito','Kennedy Central','Techo'],
    FONTIBON:['Capellanía','Fontibón Centro','Modelia','Granjas de Techo','Ciudad Salitre'],
    ENGATIVA:['Ferias','Boyacá Real','Minuto de Dios','Bolivia','Las Ferias'],
    SUBA:['Tibabuyes','Niza','Suba Centro','La Campiña','La Alhambra','El Rincón','Lisboa'],
    BARRIOS_UNIDOS:['7 de Agosto','Doce de Octubre','San Felipe','Los Andes','Los Alcázares'],
    TEUSAQUILLO:['La Soledad','Quesada','Campín','Palermo','Nicolás de Federmán'],
    MARTIRES:['Santa Isabel','Eduardo Santos','La Sabana'],
    ANTONIO_NARINO:['Restrepo','Eduardo Santos','Policarpa','Country Sur'],
    PUENTE_ARANDA:['Ciudad Montes','Torremolinos','Salazar Gómez','Muzú','Zona Industrial'],
    CANDELARIA:['La Catedral','Egipto','Las Aguas','Belén'],
    RAFAEL_URIBE_URIBE:['Bravo Páez','Marruecos','Quiroga','Marco Fidel Suárez','Diana Turbay'],
    CIUDAD_BOLIVAR:['Meissen','Jerusalén','Paraíso','Arborizadora','El Lucero','Ismael Perdomo'],
    SUMAPAZ:['Nazareth','Betania','San Juan de Sumapaz']
};

var RS_CENTROIDES_LOCALIDADES = {
    'USAQUEN':[4.7110,-74.0300],'CHAPINERO':[4.6400,-74.0620],'SANTA_FE':[4.6097,-74.0730],
    'SAN_CRISTOBAL':[4.5700,-74.0800],'USME':[4.5100,-74.1300],'TUNJUELITO':[4.5800,-74.1400],
    'BOSA':[4.6200,-74.1900],'KENNEDY':[4.6280,-74.1550],'FONTIBON':[4.6800,-74.1400],
    'ENGATIVA':[4.7000,-74.1100],'SUBA':[4.7500,-74.0800],'BARRIOS_UNIDOS':[4.6700,-74.0850],
    'TEUSAQUILLO':[4.6400,-74.0900],'MARTIRES':[4.6000,-74.0950],'ANTONIO_NARINO':[4.5900,-74.1100],
    'PUENTE_ARANDA':[4.6200,-74.1200],'CANDELARIA':[4.5970,-74.0730],'RAFAEL_URIBE_URIBE':[4.5600,-74.1200],
    'CIUDAD_BOLIVAR':[4.5700,-74.1800],'SUMAPAZ':[4.2600,-74.2900]
};

// ── Estado del mapa ───────────────────────────────────────────────
var rsMap              = null;
var rsMarcador         = null;
var rsUbicacionOk      = false;
var rsAutocompDebounce = null;
var rsLastNominatim    = 0;
var rsIconoSede        = null;
var rsIconoSedeDrag    = null;

// ── Iconos Leaflet ────────────────────────────────────────────────
function rsCrearIcono() {
    if (!rsIconoSede && typeof L !== 'undefined') {
        rsIconoSede = L.divIcon({
            className: '',
            html: '<div style="width:34px;height:34px;background:linear-gradient(135deg,#134e4a,#0d9488);' +
                'border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;' +
                'box-shadow:0 4px 16px rgba(13,148,136,.5);position:relative;">' +
                '<div style="width:9px;height:9px;background:#fff;border-radius:50%;position:absolute;' +
                'top:50%;left:50%;transform:translate(-50%,-50%) rotate(45deg);"></div></div>',
            iconSize:    [34, 34],
            iconAnchor:  [17, 34],
            popupAnchor: [0, -38]
        });
    }
    return rsIconoSede;
}

function rsCrearIconoDrag() {
    if (!rsIconoSedeDrag && typeof L !== 'undefined') {
        rsIconoSedeDrag = L.divIcon({
            className: '',
            html: '<div style="width:34px;height:34px;background:linear-gradient(135deg,#065f46,#059669);' +
                'border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;' +
                'box-shadow:0 4px 20px rgba(5,150,105,.6);position:relative;">' +
                '<div style="width:9px;height:9px;background:#fff;border-radius:50%;position:absolute;' +
                'top:50%;left:50%;transform:translate(-50%,-50%) rotate(45deg);"></div></div>',
            iconSize:    [34, 34],
            iconAnchor:  [17, 34],
            popupAnchor: [0, -38]
        });
    }
    return rsIconoSedeDrag;
}
// ── Inicialización del mapa ───────────────────────────────────────
function rsInicializarMapa() {
    if (rsMap) return;
    var container = document.getElementById('rsMapContainer');
    if (!container || typeof L === 'undefined') return;

    rsMap = L.map('rsMapContainer', {
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: true
    }).setView([4.6533, -74.0836], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(rsMap);

    rsMap.on('click', function(e) {
        rsColocarMarcador(e.latlng.lat, e.latlng.lng, true);
    });
}

// ── Marcador ──────────────────────────────────────────────────────
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
            '<strong style="color:#0f766e;display:block;margin-bottom:.2rem;">Nueva Sede</strong>' +
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

// ── Estado visual del mapa ────────────────────────────────────────
function rsSetMapStatus(html, tipo) {
    var el = document.getElementById('rsMapStatus');
    if (!el) return;
    var colores = {
        ok:       '#059669',
        pending:  '#d97706',
        error:    '#dc2626',
        loading:  '#0d9488',
        dragging: '#0d9488'
    };
    el.innerHTML   = html;
    el.style.color = colores[tipo] || '#64748b';
}

function rsMarcarUbicacionConfirmada() {
    rsUbicacionOk = true;
    rsSetMapStatus('Ubicación confirmada — podés continuar', 'ok');
    var badge = document.getElementById('rsUbicacionBadge');
    if (badge) {
        badge.style.display    = 'flex';
        badge.style.background = '#f0fdf4';
        badge.style.border     = '1.5px solid #86efac';
        badge.style.color      = '#166534';
        badge.innerHTML        = 'Ubicación confirmada — podés continuar';
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
        badge.innerHTML        = 'Dirección modificada — volvé a buscar o ajustá el pin';
    }
}

// ── Geocodificación ───────────────────────────────────────────────
function rsNormalizarDireccion(dir) {
    return dir
        .replace('#', '')
        .replace(/\bKra?\.?\b/gi,  'Carrera')
        .replace(/\bCra\.?\b/gi,   'Carrera')
        .replace(/\bCr\.?\b/gi,    'Carrera')
        .replace(/\bCll\.?\b/gi,   'Calle')
        .replace(/\bCl\.?\b/gi,    'Calle')
        .replace(/\bDg\.?\b/gi,    'Diagonal')
        .replace(/\bTrv?\.?\b/gi,  'Transversal')
        .replace(/\bAv\.?\b/gi,    'Avenida')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

async function rsGeocodificarDireccion(direccion, localidad, barrio) {
    var ahora  = Date.now();
    var espera = 1050 - (ahora - rsLastNominatim);
    if (espera > 0) await new Promise(function(r) { setTimeout(r, espera); });
    rsLastNominatim = Date.now();

    var dirNorm = rsNormalizarDireccion(direccion);
    var locFmt  = localidad
        ? localidad.split('_').map(function(w) {
            return w.charAt(0) + w.slice(1).toLowerCase();
        }).join(' ')
        : '';

    var query  = [dirNorm, barrio, locFmt, 'Bogotá', 'Colombia'].filter(Boolean).join(', ');
    var params = new URLSearchParams({
        q:               query,
        format:          'json',
        limit:           '5',
        countrycodes:    'co',
        viewbox:         '-74.25,4.45,-73.95,4.85',
        bounded:         '1',
        'accept-language': 'es'
    });

    var resp = await fetch(
        'https://nominatim.openstreetmap.org/search?' + params.toString(),
        { headers: { 'User-Agent': 'AparcaYA/1.0 (registro sede Bogota)' } }
    );
    if (!resp.ok) throw new Error('Nominatim HTTP ' + resp.status);
    return await resp.json();
}

async function rsReverseGeocodificar(lat, lon) {
    rsSetMapStatus('Obteniendo dirección...', 'loading');

    var ahora  = Date.now();
    var espera = 1050 - (ahora - rsLastNominatim);
    if (espera > 0) await new Promise(function(r) { setTimeout(r, espera); });
    rsLastNominatim = Date.now();

    try {
        var params = new URLSearchParams({
            lat:               lat.toString(),
            lon:               lon.toString(),
            format:            'json',
            zoom:              '18',
            'accept-language': 'es'
        });

        var resp = await fetch(
            'https://nominatim.openstreetmap.org/reverse?' + params.toString(),
            { headers: { 'User-Agent': 'AparcaYA/1.0 (registro sede Bogota)' } }
        );
        var data = await resp.json();

        if (data && data.display_name) {
            var addr   = data.address || {};

            // ── FIX: solo calle + número — sin barrio ni localidad ──
            var partes = [
                addr.road,
                addr.house_number
            ].filter(Boolean);

            var dirLegible = partes.length > 0
                ? partes.join(' ')
                : data.display_name.split(',')[0].trim();

            var campoDireccion = document.getElementById('rsDireccion');
            if (campoDireccion && dirLegible) {
                campoDireccion.value = dirLegible;
            }
        }

        rsSetMapStatus('Ubicación confirmada — arrastrá el pin para ajustar', 'ok');
        rsMarcarUbicacionConfirmada();

    } catch (err) {
        console.warn('Reverse geocoding falló:', err);
        rsSetMapStatus('Pin colocado — podés continuar', 'ok');
        rsMarcarUbicacionConfirmada();
    }
}
// ── Autocompletado de dirección ───────────────────────────────────
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
        if (!inputDir.contains(e.target) && !dropdown.contains(e.target)) {
            rsOcultarDropdown();
        }
    });

    inputDir.addEventListener('keydown', function(e) {
        var items  = dropdown.querySelectorAll('.rs-autocomp-item');
        var activo = dropdown.querySelector('.rs-autocomp-item.activo');

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (activo) {
                activo.classList.remove('activo');
                (activo.nextElementSibling || items[0]).classList.add('activo');
            } else if (items[0]) {
                items[0].classList.add('activo');
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (activo) {
                activo.classList.remove('activo');
                if (activo.previousElementSibling) {
                    activo.previousElementSibling.classList.add('activo');
                }
            }
        } else if (e.key === 'Enter' && activo) {
            e.preventDefault();
            activo.click();
        } else if (e.key === 'Escape') {
            rsOcultarDropdown();
        }
    });
}

function rsSetDropdownCargando(dropdown) {
    dropdown.style.display = 'block';
    dropdown.innerHTML =
        '<div style="padding:.75rem 1rem;color:#64748b;font-size:.8125rem;' +
        'display:flex;align-items:center;gap:.5rem;font-family:inherit;">' +
        '<svg style="width:14px;height:14px;animation:rs-spin 1s linear infinite;flex-shrink:0;" ' +
        'xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">' +
        '<circle style="opacity:.25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>' +
        '<path style="opacity:.75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>' +
        'Buscando en Bogotá...</div>';
}

function rsMostrarSugerencias(resultados, dropdown, localidad) {
    var dentroRango = resultados.filter(function(r) {
        var lat = parseFloat(r.lat), lon = parseFloat(r.lon);
        return lat >= 4.45 && lat <= 4.85 && lon >= -74.25 && lon <= -73.95;
    });

    var c = RS_CENTROIDES_LOCALIDADES[localidad] || [4.6533, -74.0836];
    dentroRango.sort(function(a, b) {
        var dA = Math.hypot(parseFloat(a.lat) - c[0], parseFloat(a.lon) - c[1]);
        var dB = Math.hypot(parseFloat(b.lat) - c[0], parseFloat(b.lon) - c[1]);
        return dA - dB;
    });

    if (dentroRango.length === 0) {
        dropdown.innerHTML =
            '<div style="padding:.875rem 1rem;font-family:inherit;">' +
            '<div style="color:#d97706;font-size:.8rem;font-weight:600;margin-bottom:.3rem;">Sin resultados en Bogotá</div>' +
            '<div style="color:#64748b;font-size:.75rem;">Intentá con otra variante o hacé click en el mapa.</div></div>';
        dropdown.style.display = 'block';
        return;
    }

    dropdown.innerHTML =
        '<div style="padding:.4rem 1rem;font-size:.7rem;font-weight:700;color:#94a3b8;' +
        'text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #f1f5f9;font-family:inherit;">Sugerencias</div>';

    dentroRango.slice(0, 5).forEach(function(r) {
        var item = document.createElement('div');
        item.className = 'rs-autocomp-item';
        item.setAttribute('role',    'option');
        item.setAttribute('tabindex', '0');

        var addr   = r.address || {};
        var titulo = [addr.road, addr.house_number].filter(Boolean).join(' ') ||
            r.display_name.split(',')[0];
        var sub    = [addr.suburb || addr.neighbourhood || addr.quarter, 'Bogotá']
            .filter(Boolean).slice(0, 2).join(', ');

        var inner = document.createElement('div');
        inner.style.cssText =
            'display:flex;align-items:flex-start;gap:.625rem;padding:.7rem 1rem;' +
            'cursor:pointer;border-bottom:1px solid #f8faff;transition:background .15s;font-family:inherit;';
        inner.innerHTML =
            '<div style="width:28px;height:28px;background:#f0fdfa;border-radius:50%;' +
            'display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:.05rem;">' +
            '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" ' +
            'stroke="#0d9488" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
            'style="width:13px;height:13px;">' +
            '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0' +
            'C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg></div>' +
            '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:.85rem;font-weight:600;color:#134e4a;line-height:1.3;' +
            'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + titulo + '</div>' +
            '<div style="font-size:.73rem;color:#64748b;margin-top:.1rem;">' + sub + '</div></div>';

        item.appendChild(inner);

        item.addEventListener('mouseenter', function() {
            dropdown.querySelectorAll('.rs-autocomp-item').forEach(function(el) {
                el.classList.remove('activo');
            });
            item.classList.add('activo');
            inner.style.background = '#f0fdfa';
        });
        item.addEventListener('mouseleave', function() { inner.style.background = ''; });

        item.addEventListener('click', function() {
            var lat   = parseFloat(r.lat), lon = parseFloat(r.lon);
            var campo = document.getElementById('rsDireccion');
            if (campo) campo.value = titulo;
            rsOcultarDropdown();
            if (rsMap) rsMap.invalidateSize();
            rsColocarMarcador(lat, lon, false);
            rsMarcarUbicacionConfirmada();
            showSuccess('Ubicación seleccionada. Arrastrá el pin si necesitás ajustar.');
        });

        dropdown.appendChild(item);
    });

    var footer = document.createElement('div');
    footer.style.cssText =
        'padding:.4rem 1rem;font-size:.68rem;color:#94a3b8;' +
        'text-align:center;border-top:1px solid #f1f5f9;font-family:inherit;';
    footer.textContent = '© OpenStreetMap contributors';
    dropdown.appendChild(footer);
    dropdown.style.display = 'block';
}

function rsOcultarDropdown() {
    var dropdown = document.getElementById('rsAutocompletadoDropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
        dropdown.innerHTML     = '';
    }
}

// ── Horario ───────────────────────────────────────────────────────
function rsFmtHora(v) {
    var h = parseInt(v, 10);
    if (v === '23:59') return '11:59 PM';
    if (h === 0)       return '12:00 AM';
    if (h < 12)        return h + ':00 AM';
    if (h === 12)      return '12:00 PM';
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

// ── Modal registrar sede — abrir / cerrar ─────────────────────────
function abrirModalRegistrarSede() {
    var modal = document.getElementById('registrarSedeModal');
    if (!modal) return;
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

function cerrarModalRegistrarSede() {
    var modal = document.getElementById('registrarSedeModal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');

    setTimeout(function() {
        // Limpiar campos de texto
        ['rsNombre','rsNit','rsDireccion','rsCupos',
            'rsTarifaPlenaC','rsTarifaPlenaM','rsTarifaMinutoC','rsTarifaMinutoM',
            'rsLatitud','rsLongitud'
        ].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.value = '';
        });

        var loc = document.getElementById('rsLocalidad');
        if (loc) loc.value = '';

        var bar = document.getElementById('rsBarrio');
        if (bar) bar.innerHTML = '<option value="">Primero selecciona localidad</option>';

        var ap = document.getElementById('rsHoraApertura');
        if (ap) ap.value = '7:00';

        var ci = document.getElementById('rsHoraCierre');
        if (ci) ci.value = '22:00';

        rsActualizarHorario();

        // Limpiar mapa
        rsUbicacionOk = false;
        if (rsMarcador && rsMap) { rsMarcador.remove(); rsMarcador = null; }
        if (rsMap) rsMap.setView([4.6533, -74.0836], 12);

        var badge = document.getElementById('rsUbicacionBadge');
        if (badge) { badge.style.display = 'none'; badge.innerHTML = ''; }

        rsSetMapStatus('Buscá la dirección o hacé click en el mapa', 'pending');
        rsOcultarDropdown();

        // Limpiar mensajes de error
        ['err-rsNombre','err-rsNit','err-rsDireccion','err-rsLocalidad','err-rsBarrio',
            'err-rsCupos','err-rsTarifaPlenaC','err-rsTarifaPlenaM',
            'err-rsTarifaMinutoC','err-rsTarifaMinutoM'
        ].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.textContent = '';
        });
    }, 300);
}

// ── Registrar sede ────────────────────────────────────────────────
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

    // Limpiar errores previos
    ['err-rsNombre','err-rsNit','err-rsDireccion','err-rsLocalidad','err-rsBarrio',
        'err-rsCupos','err-rsTarifaPlenaC','err-rsTarifaPlenaM',
        'err-rsTarifaMinutoC','err-rsTarifaMinutoM'
    ].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.textContent = '';
    });

    var valido = true;
    function setErr(id, msg) {
        var el = document.getElementById(id);
        if (el) el.textContent = msg;
        valido = false;
    }

    // Validaciones
    if (!nombre)                              setErr('err-rsNombre',    'El nombre es obligatorio');
    if (!nit)                                 setErr('err-rsNit',       'El NIT es obligatorio');
    else if (!/^[0-9]{9}-[0-9]$/.test(nit))  setErr('err-rsNit',       'Formato: 123456789-0');
    if (!direccion || direccion.length < 5)   setErr('err-rsDireccion', 'Ingresá una dirección válida');
    if (!localidad)                           setErr('err-rsLocalidad', 'Seleccioná una localidad');
    if (!barrio)                              setErr('err-rsBarrio',    'Seleccioná un barrio');

    var cuposNum = parseInt(cupos);
    if (!cupos || isNaN(cuposNum) || cuposNum < 1) {
        setErr('err-rsCupos', 'Ingresá la capacidad (mínimo 1)');
    }

    function validarTarifa(v, errId, label) {
        var n = parseFloat(v);
        if (!v || isNaN(n) || n <= 0) setErr(errId, label + ' debe ser mayor a 0');
    }
    validarTarifa(tPlenaC,  'err-rsTarifaPlenaC',  'Tarifa plena carro');
    validarTarifa(tPlenaM,  'err-rsTarifaPlenaM',  'Tarifa plena moto');
    validarTarifa(tMinutoC, 'err-rsTarifaMinutoC', 'Tarifa minuto carro');
    validarTarifa(tMinutoM, 'err-rsTarifaMinutoM', 'Tarifa minuto moto');

    // Validar ubicación en mapa
    if (!latStr || !lonStr) {
        showWarning(
            'Debés confirmar la ubicación en el mapa antes de registrar. ' +
            'Escribí la dirección y seleccioná una sugerencia, o hacé click en el mapa.'
        );
        var mapEl = document.getElementById('rsMapContainer');
        if (mapEl) mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    var lat = parseFloat(latStr), lon = parseFloat(lonStr);
    if (lat < 4.45 || lat > 4.85 || lon < -74.25 || lon > -73.95) {
        showError('La ubicación debe estar dentro de Bogotá');
        return;
    }

    if (!valido) return;

    // Construir payload
    var localidadTexto = '';
    var locEl = document.getElementById('rsLocalidad');
    if (locEl && locEl.selectedOptions[0]) {
        localidadTexto = locEl.selectedOptions[0].text;
    }

    var direccionCompleta = direccion + ', ' + barrio + ', ' + (localidadTexto || localidad);
    var horario           = apertura + ' - ' + cierre;
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
        showInfo('Registrando sede...');
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
        showSuccess('Sede "' + result.nombre + '" registrada correctamente');
        cerrarModalRegistrarSede();
        await cargarSedes();
        switchToTab('sedes');
    } catch (error) {
        showError(error.message);
    }
}
function rsIniciarBotonGPS() {
    var btn = document.getElementById('rsBtnGPS');
    if (!btn) return;

    var svgGPS =
        '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" ' +
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
        'style="width:14px;height:14px;flex-shrink:0;">' +
        '<polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>';
    var svgSpin =
        '<svg style="width:14px;height:14px;animation:rs-spin 1s linear infinite;flex-shrink:0;" ' +
        'xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">' +
        '<circle style="opacity:.25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>' +
        '<path style="opacity:.75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>';

    btn.addEventListener('click', function() {
        if (!navigator.geolocation) {
            showWarning('Tu navegador no soporta geolocalización');
            return;
        }

        btn.disabled  = true;
        btn.innerHTML = svgSpin + ' Obteniendo ubicación...';

        navigator.geolocation.getCurrentPosition(
            function(pos) {
                btn.disabled  = false;
                btn.innerHTML = svgGPS + ' Usar mi ubicación actual (GPS)';
                var lat = pos.coords.latitude, lon = pos.coords.longitude;
                if (lat < 4.45 || lat > 4.85 || lon < -74.25 || lon > -73.95) {
                    showWarning('Tu ubicación no está en Bogotá. Buscá la dirección manualmente.');
                    return;
                }
                if (rsMap) rsMap.invalidateSize();
                rsColocarMarcador(lat, lon, true);
                showSuccess('Ubicación GPS obtenida. Arrastrá el pin si necesitás ajustar.');
            },
            function(err) {
                btn.disabled  = false;
                btn.innerHTML = svgGPS + ' Usar mi ubicación actual (GPS)';
                var msgs = {
                    1: 'Permiso denegado.',
                    2: 'No se pudo obtener tu posición.',
                    3: 'Tiempo de espera agotado.'
                };
                showWarning(msgs[err.code] || 'Error de geolocalización.');
            },
            { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true }
        );
    });
}

// ── Listeners de localidad/barrio ─────────────────────────────────
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
                    opt.value = b; opt.textContent = b;
                    barSel.appendChild(opt);
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
        barSel.addEventListener('change', function() {
            rsDesconfirmarUbicacion();
        });
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

// Agregar estas líneas al bloque window.xxx existente
window.iniciarReservacion    = iniciarReservacion;
window.completarReservacion  = completarReservacion;
window.cobrarReservacion     = cobrarReservacion;
window.renderBadgeEstado     = renderBadgeEstado;
window.renderAccionesReserva = renderAccionesReserva;