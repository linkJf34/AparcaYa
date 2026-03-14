// ============================================================
// configuracion-sede.js  v1.1
// Ruta: static/js/configuracion-sede.js
// Módulo de configuración de sede — AparcaYA
// ============================================================
'use strict';

const CFG_API  = '/api/sede';
let   sedeDatos = null;   // cache local de la sede autenticada

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', function () {
    setupTabs();
    cargarDatosActuales();
    setupTarifaPreviewListeners();
    setupCuposListeners();
});

// ============================================================
// TABS
// ============================================================
function setupTabs() {
    document.querySelectorAll('.cfg-tab-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            activarTab(btn.getAttribute('data-panel'));
        });
    });
}

function activarTab(panelId) {
    document.querySelectorAll('.cfg-tab-btn').forEach(function (b) {
        var activo = b.getAttribute('data-panel') === panelId;
        b.classList.toggle('active',    activo);
        b.setAttribute('aria-selected', activo ? 'true' : 'false');
    });
    document.querySelectorAll('.cfg-panel').forEach(function (p) {
        p.classList.toggle('active', p.id === 'panel-' + panelId);
    });
}

// ============================================================
// CARGA DE DATOS
// ============================================================
async function cargarDatosActuales() {
    try {
        var res = await fetch(CFG_API + '/mi-configuracion');
        if (!res.ok) throw new Error('Error ' + res.status);
        sedeDatos = await res.json();
        poblarFormularios(sedeDatos);
    } catch (e) {
        mostrarToast('No se pudieron cargar los datos: ' + e.message, 'error');
    }
}

function poblarFormularios(s) {
    // Panel info
    setVal('cfg-nombre',    s.nombre         || '');
    setVal('cfg-nit',       s.nit            || '');
    setVal('cfg-direccion', s.direccion      || '');
    setVal('cfg-telefono',  s.telefonoSede   || '');
    setVal('cfg-correo',    s.correoSede     || '');
    setVal('cfg-horario',   s.horarioSede    || '');

    // Panel tarifas
    setVal('cfg-tarifaPlenaC',  s.tarifaPlenaC  != null ? s.tarifaPlenaC  : '');
    setVal('cfg-tarifaPlenaM',  s.tarifaPlenaM  != null ? s.tarifaPlenaM  : '');
    setVal('cfg-tarifaMinutoC', s.tarifaMinutoC != null ? s.tarifaMinutoC : '');
    setVal('cfg-tarifaMinutoM', s.tarifaMinutoM != null ? s.tarifaMinutoM : '');
    actualizarPreviewTarifas();

    // Panel cupos
    setVal('cfg-cuposCarro',     s.cuposCarro     != null ? s.cuposCarro     : '');
    setVal('cfg-cuposMoto',      s.cuposMoto      != null ? s.cuposMoto      : '');
    setVal('cfg-cuposBicicleta', s.cuposBicicleta != null ? s.cuposBicicleta : '');
    setVal('cfg-capacidadTotal', s.capacidad      != null ? s.capacidad      : '');
    actualizarVisualCupos();

    // Panel imagen
    if (s.imagenSede) {
        var img = document.getElementById('imgPreviewEl');
        var ph  = document.getElementById('imgPlaceholder');
        if (img) { img.src = '/' + s.imagenSede; img.style.display = 'block'; }
        if (ph)  { ph.style.display = 'none'; }
    }
}

// ============================================================
// GUARDAR — INFORMACIÓN BÁSICA
// ============================================================
async function guardarInformacion() {
    limpiarErrores(['err-nombre', 'err-direccion', 'err-correo']);

    var nombre    = getVal('cfg-nombre');
    var direccion = getVal('cfg-direccion');
    var correo    = getVal('cfg-correo');
    var valido    = true;

    if (!nombre)    { setErr('err-nombre',    'El nombre es obligatorio');    valido = false; }
    if (!direccion) { setErr('err-direccion', 'La dirección es obligatoria'); valido = false; }
    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        setErr('err-correo', 'Formato de correo inválido');
        valido = false;
    }
    if (!valido) return;

    var fd = new FormData();
    fd.append('nombre',       nombre);
    fd.append('direccion',    direccion);
    fd.append('telefonoSede', getVal('cfg-telefono'));
    fd.append('correoSede',   correo);
    fd.append('horarioSede',  getVal('cfg-horario'));

    await enviarConfiguracion(fd, 'Información actualizada correctamente');
}

// ============================================================
// GUARDAR — TARIFAS
// ============================================================
async function guardarTarifas() {
    limpiarErrores(['err-tarifaPlenaC', 'err-tarifaPlenaM', 'err-tarifaMinutoC', 'err-tarifaMinutoM']);

    var plenaC  = parseFloat(getVal('cfg-tarifaPlenaC'));
    var plenaM  = parseFloat(getVal('cfg-tarifaPlenaM'));
    var minutoC = parseFloat(getVal('cfg-tarifaMinutoC'));
    var minutoM = parseFloat(getVal('cfg-tarifaMinutoM'));
    var valido  = true;

    if (isNaN(plenaC)  || plenaC  < 0) { setErr('err-tarifaPlenaC',  'Ingresa un valor válido'); valido = false; }
    if (isNaN(plenaM)  || plenaM  < 0) { setErr('err-tarifaPlenaM',  'Ingresa un valor válido'); valido = false; }
    if (isNaN(minutoC) || minutoC < 0) { setErr('err-tarifaMinutoC', 'Ingresa un valor válido'); valido = false; }
    if (isNaN(minutoM) || minutoM < 0) { setErr('err-tarifaMinutoM', 'Ingresa un valor válido'); valido = false; }
    if (!valido) return;

    var fd = new FormData();
    fd.append('tarifaPlenaC',  plenaC);
    fd.append('tarifaPlenaM',  plenaM);
    fd.append('tarifaMinutoC', minutoC);
    fd.append('tarifaMinutoM', minutoM);

    await enviarConfiguracion(fd, 'Tarifas actualizadas correctamente');
}

// ============================================================
// GUARDAR — CUPOS
// ============================================================
async function guardarCupos() {
    var carro     = parseInt(getVal('cfg-cuposCarro'))     || 0;
    var moto      = parseInt(getVal('cfg-cuposMoto'))      || 0;
    var bicicleta = parseInt(getVal('cfg-cuposBicicleta')) || 0;

    if (carro < 0 || moto < 0 || bicicleta < 0) {
        mostrarToast('Los cupos deben ser 0 o mayores', 'warning');
        return;
    }

    var fd = new FormData();
    fd.append('cuposCarro',     carro);
    fd.append('cuposMoto',      moto);
    fd.append('cuposBicicleta', bicicleta);

    await enviarConfiguracion(fd, 'Cupos actualizados correctamente');
}

// ============================================================
// GUARDAR — IMAGEN
// ============================================================
async function guardarImagen() {
    var input   = document.getElementById('imagenInput');
    var archivo = input && input.files[0];

    if (!archivo) { mostrarToast('Selecciona una imagen primero', 'warning'); return; }
    if (archivo.size > 5 * 1024 * 1024) { mostrarToast('La imagen no puede superar 5 MB', 'error'); return; }

    var btn = document.getElementById('btn-guardar-img');
    if (btn) { btn.disabled = true; btn.textContent = 'Subiendo...'; }

    try {
        var fd = new FormData();
        fd.append('imagen', archivo);
        await enviarConfiguracion(fd, 'Imagen actualizada correctamente');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Subir imagen'; }
    }
}

// ============================================================
// CAMBIAR CONTRASEÑA
// ============================================================
async function cambiarContrasena() {
    limpiarErrores(['err-passActual', 'err-passNueva', 'err-passConfirmar']);

    var actual    = getVal('cfg-passActual');
    var nueva     = getVal('cfg-passNueva');
    var confirmar = getVal('cfg-passConfirmar');
    var valido    = true;

    if (!actual)          { setErr('err-passActual',    'La contraseña actual es obligatoria'); valido = false; }
    if (nueva.length < 8) { setErr('err-passNueva',     'Mínimo 8 caracteres');                 valido = false; }
    if (nueva !== confirmar) { setErr('err-passConfirmar', 'Las contraseñas no coinciden');      valido = false; }
    if (!valido) return;

    try {
        var res  = await fetch(CFG_API + '/cambiar-contrasena', {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ contrasenaActual: actual, contrasenaNueva: nueva, confirmar: confirmar })
        });
        var data = await res.json();

        if (!res.ok) {
            if (res.status === 401) { setErr('err-passActual', 'La contraseña actual es incorrecta'); }
            else                    { mostrarToast(data.error || 'Error al cambiar contraseña', 'error'); }
            return;
        }

        mostrarToast('Contraseña actualizada correctamente', 'success');
        limpiarFormContrasena();

    } catch (e) {
        mostrarToast('Error de conexión: ' + e.message, 'error');
    }
}

function limpiarFormContrasena() {
    ['cfg-passActual', 'cfg-passNueva', 'cfg-passConfirmar'].forEach(function (id) { setVal(id, ''); });
    limpiarErrores(['err-passActual', 'err-passNueva', 'err-passConfirmar']);
    var fill  = document.getElementById('strengthFill');
    var label = document.getElementById('strengthLabel');
    if (fill)  { fill.style.width = '0'; fill.style.backgroundColor = ''; }
    if (label) { label.textContent = ''; label.style.color = ''; }
}

// ============================================================
// HELPER COMÚN — envío multipart
// ============================================================
async function enviarConfiguracion(formData, mensajeExito) {
    try {
        var res  = await fetch(CFG_API + '/mi-configuracion', { method: 'PUT', body: formData });
        var data = await res.json();

        if (!res.ok) { mostrarToast(data.error || 'Error al guardar', 'error'); return; }

        if (data.sede) { sedeDatos = data.sede; }
        mostrarToast(mensajeExito, 'success');

    } catch (e) {
        mostrarToast('Error de conexión: ' + e.message, 'error');
    }
}

// ============================================================
// PREVISUALIZACIÓN DE IMAGEN
// ============================================================
function previsualizarImagen(input) {
    var archivo = input.files[0];
    if (!archivo) return;

    if (!archivo.type.startsWith('image/')) {
        mostrarToast('El archivo debe ser una imagen (JPG, PNG, WEBP)', 'error');
        input.value = '';
        return;
    }
    if (archivo.size > 5 * 1024 * 1024) {
        mostrarToast('La imagen no puede superar 5 MB', 'error');
        input.value = '';
        return;
    }

    var reader = new FileReader();
    reader.onload = function (e) {
        var img  = document.getElementById('imgPreviewEl');
        var ph   = document.getElementById('imgPlaceholder');
        var nb   = document.getElementById('cfg-img-nombre');
        var btn  = document.getElementById('btn-guardar-img');

        if (img) { img.src = e.target.result; img.style.display = 'block'; }
        if (ph)  { ph.style.display = 'none'; }
        if (nb)  { nb.textContent   = archivo.name + ' (' + (archivo.size / 1024).toFixed(1) + ' KB)'; }
        if (btn) { btn.disabled     = false; }
    };
    reader.readAsDataURL(archivo);
}

// ============================================================
// INDICADOR DE FORTALEZA DE CONTRASEÑA
// ============================================================
function evaluarFortaleza(password) {
    var fill  = document.getElementById('strengthFill');
    var label = document.getElementById('strengthLabel');
    if (!fill || !label) return;

    if (!password) {
        fill.style.width = '0';
        label.textContent = '';
        return;
    }

    var score = 0;
    if (password.length >= 8)               score++;
    if (password.length >= 12)              score++;
    if (/[A-Z]/.test(password))             score++;
    if (/[0-9]/.test(password))             score++;
    if (/[^A-Za-z0-9]/.test(password))      score++;

    var cfg = [
        { label: '',           color: '',        width: '0%'   },
        { label: 'Muy débil',  color: '#ef4444', width: '20%'  },
        { label: 'Débil',      color: '#f97316', width: '40%'  },
        { label: 'Regular',    color: '#eab308', width: '60%'  },
        { label: 'Fuerte',     color: '#22c55e', width: '80%'  },
        { label: 'Muy fuerte', color: '#16a34a', width: '100%' }
    ][Math.min(score, 5)];

    fill.style.width           = cfg.width;
    fill.style.backgroundColor = cfg.color;
    label.textContent          = cfg.label;
    label.style.color          = cfg.color;
}

// ============================================================
// PREVIEW EN TIEMPO REAL — TARIFAS
// ============================================================
function setupTarifaPreviewListeners() {
    ['cfg-tarifaPlenaC', 'cfg-tarifaPlenaM', 'cfg-tarifaMinutoC', 'cfg-tarifaMinutoM']
        .forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('input', actualizarPreviewTarifas);
        });
}

function actualizarPreviewTarifas() {
    var pc = parseFloat(getVal('cfg-tarifaPlenaC'))  || 0;
    var pm = parseFloat(getVal('cfg-tarifaPlenaM'))  || 0;
    var mc = parseFloat(getVal('cfg-tarifaMinutoC')) || 0;
    var mm = parseFloat(getVal('cfg-tarifaMinutoM')) || 0;

    setText('prev-plena-c', formatPesos(pc));
    setText('prev-plena-m', formatPesos(pm));
    setText('prev-min-c',   formatPesos(60 * mc) + ' (60 min)');
    setText('prev-min-m',   formatPesos(60 * mm) + ' (60 min)');
}

// ============================================================
// VISUAL DE CUPOS — Barra de distribución
// ============================================================
function setupCuposListeners() {
    ['cfg-cuposCarro', 'cfg-cuposMoto', 'cfg-cuposBicicleta'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('input', actualizarVisualCupos);
    });
}

function actualizarVisualCupos() {
    var c = parseInt(getVal('cfg-cuposCarro'))     || 0;
    var m = parseInt(getVal('cfg-cuposMoto'))      || 0;
    var b = parseInt(getVal('cfg-cuposBicicleta')) || 0;
    var total = c + m + b || 1;   // evitar /0

    var pctC = Math.round((c / total) * 100);
    var pctM = Math.round((m / total) * 100);
    var pctB = 100 - pctC - pctM;

    // Barras (porcentajes)
    setStyle('bar-carro',      'width', pctC + '%');
    setStyle('bar-moto',       'width', pctM + '%');
    setStyle('bar-bicicleta',  'width', pctB + '%');

    // Texto dentro de la barra (solo si el segmento es ancho)
    var barC = document.getElementById('bar-carro');
    var barM = document.getElementById('bar-moto');
    var barB = document.getElementById('bar-bicicleta');
    if (barC) barC.textContent = pctC > 12 ? c : '';
    if (barM) barM.textContent = pctM > 12 ? m : '';
    if (barB) barB.textContent = pctB > 12 ? b : '';

    // Leyenda
    setText('leg-carro',     c);
    setText('leg-moto',      m);
    setText('leg-bicicleta', b);
    setText('leg-total',     c + m + b);
}

// ============================================================
// TOAST — usa clases de configuracion-sede.css
// ============================================================
function mostrarToast(mensaje, tipo) {
    document.querySelectorAll('.cfg-toast').forEach(function (t) { t.remove(); });

    var toast         = document.createElement('div');
    toast.className   = 'cfg-toast ' + (tipo || 'info');
    toast.textContent = mensaje;
    document.body.appendChild(toast);

    setTimeout(function () {
        toast.style.opacity    = '0';
        toast.style.transition = 'opacity 0.3s ease-in';
        setTimeout(function () { toast.remove(); }, 300);
    }, 4500);
}

// ============================================================
// UTILIDADES
// ============================================================
function setVal(id, val) {
    var el = document.getElementById(id);
    if (el) el.value = val;
}

function getVal(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
}

function setText(id, txt) {
    var el = document.getElementById(id);
    if (el) el.textContent = txt;
}

function setErr(id, msg) {
    var el = document.getElementById(id);
    if (el) el.textContent = msg;
}

function setStyle(id, prop, val) {
    var el = document.getElementById(id);
    if (el) el.style[prop] = val;
}

function limpiarErrores(ids) {
    ids.forEach(function (id) { setErr(id, ''); });
}

function formatPesos(num) {
    return '$' + Number(num).toLocaleString('es-CO', { minimumFractionDigits: 0 });
}

console.log('configuracion-sede.js v1.1 cargado');