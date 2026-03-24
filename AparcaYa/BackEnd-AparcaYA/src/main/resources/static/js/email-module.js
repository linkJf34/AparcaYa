// ============================================================
// email-module.js — AparcaYA
// Módulo de correos del panel admin: selector de plantillas,
// historial con filtros, e integración con los endpoints nuevos.
//
// INSTRUCCION: incluir en DashboardAdmin.html después de AdminD.js
//   <script th:src="@{/js/email-module.js}"></script>
// ============================================================

// ─── Estado del módulo ─────────────────────────────────────────────────────
const EMAIL_MODULE = {
    plantillaActiva: null,
    historialData:   []
};

// ─── Inicialización ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    inicializarSelectorPlantillas();
    cargarContadoresCorreos();
    cargarHistorialCorreos();
    vincularFiltrosHistorial();
});

// ═══════════════════════════════════════════════════════════════════════════
// SELECTOR DE PLANTILLAS
// Funciona sobre el formulario unitario existente en AdminD.js
// ═══════════════════════════════════════════════════════════════════════════

function inicializarSelectorPlantillas() {
    document.querySelectorAll('[data-plantilla]').forEach(card => {
        card.addEventListener('click', () => seleccionarPlantilla(card));
    });
}

/**
 * Al hacer clic en una tarjeta de plantilla:
 *  1. Carga asunto y mensaje preview desde el servidor
 *  2. Marca la tarjeta como activa
 *  3. Actualiza el campo oculto tipoPlantilla
 */
async function seleccionarPlantilla(card) {
    const tipo = card.dataset.plantilla;
    if (!tipo) return;

    // Marcar visualmente
    document.querySelectorAll('[data-plantilla]').forEach(c => {
        c.classList.remove('plantilla-activa');
        c.setAttribute('aria-pressed', 'false');
    });
    card.classList.add('plantilla-activa');
    card.setAttribute('aria-pressed', 'true');

    EMAIL_MODULE.plantillaActiva = tipo;

    // Actualizar campo oculto si existe
    const inputTipo = document.getElementById('tipoPlantillaActiva');
    if (inputTipo) inputTipo.value = tipo;

    // Actualizar badge de plantilla seleccionada
    const badge = document.getElementById('plantillaSeleccionadaBadge');
    const labels = {
        BIENVENIDA:   'Bienvenida',
        RECORDATORIO: 'Recordatorio',
        PROMOCION:    'Promocion',
        NOTIFICACION: 'Notificacion'
    };
    if (badge) {
        badge.textContent = labels[tipo] || tipo;
        badge.style.display = 'inline';
    }

    // Cargar preview del servidor
    try {
        const resp = await fetch(`/admin/api/correos/plantilla-preview?tipo=${tipo}`);
        if (!resp.ok) return;
        const data = await resp.json();

        // Solo rellenar si el campo está vacío (no pisamos lo que el admin ya escribió)
        const subjectField = document.getElementById('subjectSingle');
        const messageField = document.getElementById('messageSingle');

        if (subjectField && !subjectField.value.trim()) {
            subjectField.value = data.asunto;
        }
        if (messageField && !messageField.value.trim()) {
            messageField.value = data.mensaje;
        }
    } catch (e) {
        console.warn('No se pudo cargar preview de plantilla:', e);
    }
}

/**
 * Intercepta el submit del formulario unitario para usar /correo/con-plantilla
 * cuando hay una plantilla seleccionada.
 * Compatible con la función enviarCorreoUnitario() existente en AdminD.js.
 */
(function parchearFormularioUnitario() {
    const form = document.getElementById('formCorreoUnitario');
    if (!form) return;

    // Agregar campo oculto para el tipo de plantilla
    if (!document.getElementById('tipoPlantillaActiva')) {
        const input = document.createElement('input');
        input.type  = 'hidden';
        input.id    = 'tipoPlantillaActiva';
        input.name  = 'tipoPlantilla';
        input.value = 'CUSTOM';
        form.appendChild(input);
    }

    // Override del submit solo si hay plantilla seleccionada
    form.addEventListener('submit', function(e) {
        if (!EMAIL_MODULE.plantillaActiva || EMAIL_MODULE.plantillaActiva === 'CUSTOM') {
            // Sin plantilla → envío normal (AdminD.js lo maneja)
            return;
        }

        e.preventDefault();
        e.stopImmediatePropagation(); // evita que AdminD.js también lo maneje

        const email   = document.getElementById('emailSingle')?.value.trim();
        const subject = document.getElementById('subjectSingle')?.value.trim();
        const message = document.getElementById('messageSingle')?.value.trim();

        if (!email || !subject || !message) {
            showToast('Completa todos los campos', 'warning');
            return;
        }

        enviarConPlantillaSeleccionada(email, subject, message,
            EMAIL_MODULE.plantillaActiva, form);
    }, true); // capture: true para interceptar antes que AdminD.js
})();

async function enviarConPlantillaSeleccionada(correo, asunto, mensaje, tipo, form) {
    const btn = form.querySelector('button[type="submit"]');
    const textoOriginal = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = 'Enviando...'; }

    const params = new URLSearchParams({ correo, asunto, mensaje, tipoPlantilla: tipo });

    try {
        const resp = await fetch('/admin/correo/con-plantilla', {
            method:  'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body:    params.toString()
        });
        const data = await resp.json();

        if (data.status === 'success') {
            showToast(data.message, 'success');
            ['emailSingle', 'subjectSingle', 'messageSingle'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            EMAIL_MODULE.plantillaActiva = null;
            document.querySelectorAll('[data-plantilla]').forEach(c => {
                c.classList.remove('plantilla-activa');
            });
            const badge = document.getElementById('plantillaSeleccionadaBadge');
            if (badge) badge.style.display = 'none';

            // Refrescar historial después del envío
            setTimeout(cargarHistorialCorreos, 800);
        } else {
            showToast(data.message || 'Error al enviar', 'error');
        }
    } catch (e) {
        showToast('Error de conexion. Intenta de nuevo.', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = textoOriginal; }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTADORES DE CORREOS (para los KPI del panel)
// ═══════════════════════════════════════════════════════════════════════════

async function cargarContadoresCorreos() {
    try {
        const resp = await fetch('/admin/api/correos/estadisticas');
        if (!resp.ok) return;
        const data = await resp.json();

        setKpi('kpiCorreosEnviados',   data.totalEnviados);
        setKpi('kpiCorreosErrores',    data.totalErrores);
        setKpi('kpiCorreosPendientes', data.totalPendientes);
        setKpi('kpiCorreosTotal',      data.total);
    } catch (e) {
        console.warn('No se pudieron cargar contadores de correos:', e);
    }
}

function setKpi(id, valor) {
    const el = document.getElementById(id);
    if (el) el.textContent = (valor ?? 0).toLocaleString('es-CO');
}

// ═══════════════════════════════════════════════════════════════════════════
// HISTORIAL CON FILTROS
// ═══════════════════════════════════════════════════════════════════════════

async function cargarHistorialCorreos(filtros = {}) {
    const tbody = document.getElementById('tbodyHistorialCorreos');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:16px;">Cargando...</td></tr>';

    const params = new URLSearchParams();
    if (filtros.estado) params.set('estado', filtros.estado);
    if (filtros.tipo)   params.set('tipo',   filtros.tipo);
    if (filtros.desde)  params.set('desde',  filtros.desde);
    if (filtros.hasta)  params.set('hasta',  filtros.hasta);

    try {
        const resp = await fetch(`/admin/api/correos/historial?${params}`);
        if (!resp.ok) throw new Error(`Error ${resp.status}`);
        const logs = await resp.json();

        EMAIL_MODULE.historialData = logs;
        renderHistorial(logs);

        const contEl = document.getElementById('historialContador');
        if (contEl) contEl.textContent = logs.length;

    } catch (e) {
        console.error('Error cargando historial:', e);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#ef4444;padding:16px;">Error al cargar historial</td></tr>';
    }
}

function renderHistorial(logs) {
    const tbody = document.getElementById('tbodyHistorialCorreos');
    if (!tbody) return;

    if (!logs || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:16px;">Sin registros para los filtros seleccionados</td></tr>';
        return;
    }

    const ESTADO_CONFIG = {
        ENVIADO:   { clase: 'badge-success',  label: 'Enviado'   },
        ERROR:     { clase: 'badge-error',    label: 'Error'     },
        PENDIENTE: { clase: 'badge-warning',  label: 'Pendiente' }
    };

    const TIPO_LABELS = {
        BIENVENIDA:   'Bienvenida',
        RECORDATORIO: 'Recordatorio',
        PROMOCION:    'Promocion',
        NOTIFICACION: 'Notificacion',
        CUSTOM:       'Personalizado'
    };

    tbody.innerHTML = logs.map(log => {
        const cfg    = ESTADO_CONFIG[log.estado] || { clase: '', label: log.estado };
        const fecha  = log.fechaEnvio
            ? new Date(log.fechaEnvio).toLocaleString('es-CO', { dateStyle:'short', timeStyle:'short' })
            : '—';
        const error  = log.mensajeError
            ? `<span title="${_esc(log.mensajeError)}" style="cursor:help;color:#ef4444;font-size:12px;">Ver error</span>`
            : '';

        return `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:10px 12px;font-size:13px;color:#334155;">${_esc(log.destinatario)}</td>
          <td style="padding:10px 12px;font-size:13px;color:#475569;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
              title="${_esc(log.asunto)}">${_esc(log.asunto)}</td>
          <td style="padding:10px 12px;">
            <span style="font-size:11px;background:#f1f5f9;color:#64748b;padding:2px 8px;border-radius:999px;">
              ${TIPO_LABELS[log.tipo] || log.tipo}
            </span>
          </td>
          <td style="padding:10px 12px;">
            <span class="admin-badge ${cfg.clase}" style="font-size:11px;">
              ${cfg.label}
            </span>
            ${error}
          </td>
          <td style="padding:10px 12px;font-size:12px;color:#94a3b8;">${fecha}</td>
        </tr>`;
    }).join('');
}

function vincularFiltrosHistorial() {
    const btnFiltrar = document.getElementById('btnFiltrarHistorial');
    if (!btnFiltrar) return;

    btnFiltrar.addEventListener('click', () => {
        cargarHistorialCorreos({
            estado: document.getElementById('filtroHistorialEstado')?.value || '',
            tipo:   document.getElementById('filtroHistorialTipo')?.value   || '',
            desde:  document.getElementById('filtroHistorialDesde')?.value  || '',
            hasta:  document.getElementById('filtroHistorialHasta')?.value  || ''
        });
    });

    const btnLimpiar = document.getElementById('btnLimpiarHistorial');
    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', () => {
            ['filtroHistorialEstado', 'filtroHistorialTipo',
                'filtroHistorialDesde',  'filtroHistorialHasta'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            cargarHistorialCorreos();
        });
    }
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function _esc(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Exponer para uso desde HTML inline
window.seleccionarPlantilla   = seleccionarPlantilla;
window.cargarHistorialCorreos = cargarHistorialCorreos;
window.cargarContadoresCorreos = cargarContadoresCorreos;