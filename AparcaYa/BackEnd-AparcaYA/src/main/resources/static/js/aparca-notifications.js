// ============================================================
// aparca-notifications.js — AparcaYA
// Helper centralizado de notificaciones y confirmaciones
// Ruta sugerida: /js/aparca-notifications.js
//
// DEPENDENCIA: SweetAlert2 debe estar cargado antes que este script.
//
// USO en cualquier .js del proyecto:
//   showSuccess('Usuario guardado correctamente');
//   showError('No se pudo conectar con el servidor');
//   showWarning('Completa todos los campos obligatorios');
//   showInfo('Esta función estará disponible próximamente');
//   const ok = await showConfirm({ title:'¿Eliminar?', body:'...' });
//   const ok = await showDeleteConfirm('Juan Pérez');
// ============================================================

(function (global) {
    'use strict';

    // ── Configuración base compartida ─────────────────────────────
    const BASE_TOAST = {
        toast:             true,
        position:          'top-end',
        showConfirmButton: false,
        timerProgressBar:  true,
        didOpen: function (toast) {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    };

    const BASE_DIALOG = {
        showCancelButton:  true,
        cancelButtonText:  'Cancelar',
        cancelButtonColor: '#6b7280',
        reverseButtons:    true,
        focusCancel:       true,
        customClass: {
            popup:         'swal-aparca-popup',
            title:         'swal-aparca-title',
            htmlContainer: 'swal-aparca-body'
        }
    };

    // ── Toast helpers ─────────────────────────────────────────────

    /**
     * Notificación de éxito (toast, esquina superior derecha).
     * @param {string} mensaje
     * @param {number} [duracion=4000]
     */
    function showSuccess(mensaje, duracion) {
        Swal.mixin(BASE_TOAST).fire({
            icon:  'success',
            title: mensaje,
            timer: duracion || 4000
        });
    }

    /**
     * Notificación de error (toast).
     * @param {string} mensaje
     * @param {number} [duracion=5000]
     */
    function showError(mensaje, duracion) {
        Swal.mixin(BASE_TOAST).fire({
            icon:  'error',
            title: mensaje,
            timer: duracion || 5000
        });
    }

    /**
     * Notificación de advertencia (toast).
     * @param {string} mensaje
     * @param {number} [duracion=4000]
     */
    function showWarning(mensaje, duracion) {
        Swal.mixin(BASE_TOAST).fire({
            icon:  'warning',
            title: mensaje,
            timer: duracion || 4000
        });
    }

    /**
     * Notificación informativa (toast).
     * @param {string} mensaje
     * @param {number} [duracion=4000]
     */
    function showInfo(mensaje, duracion) {
        Swal.mixin(BASE_TOAST).fire({
            icon:  'info',
            title: mensaje,
            timer: duracion || 4000
        });
    }

    // ── Diálogos de confirmación ──────────────────────────────────

    /**
     * Diálogo de confirmación genérico.
     * @param {Object} opciones
     * @param {string}  opciones.title        - Título del diálogo
     * @param {string}  [opciones.body]        - HTML del cuerpo (opcional)
     * @param {string}  [opciones.btnTexto]    - Texto del botón de confirmar (default: 'Confirmar')
     * @param {string}  [opciones.btnColor]    - 'danger' | 'warning' | hex (default: 'danger')
     * @param {string}  [opciones.icon]        - Icono SweetAlert2 (default: auto según btnColor)
     * @returns {Promise<boolean>}
     */
    async function showConfirm(opciones) {
        var title    = opciones.title    || '¿Estás seguro?';
        var body     = opciones.body     || '';
        var btnTexto = opciones.btnTexto || 'Confirmar';
        var btnColor = opciones.btnColor || 'danger';
        var iconAuto = btnColor === 'warning' ? 'warning' : 'question';
        var colorMap = { danger: '#dc2626', warning: '#f59e0b' };
        var btnHex   = colorMap[btnColor] || btnColor;

        var result = await Swal.fire(Object.assign({}, BASE_DIALOG, {
            title:              title,
            html:               body,
            icon:               opciones.icon || iconAuto,
            confirmButtonText:  btnTexto,
            confirmButtonColor: btnHex
        }));
        return result.isConfirmed;
    }

    /**
     * Diálogo especializado para eliminar un registro.
     * Botón rojo, icono warning, texto estandarizado.
     * @param {string} nombreEntidad  - Ej: 'Juan Pérez' o 'Sede Norte'
     * @param {string} [tipoEntidad]  - Ej: 'usuario', 'sede' (default: 'registro')
     * @returns {Promise<boolean>}
     */
    async function showDeleteConfirm(nombreEntidad, tipoEntidad) {
        var tipo  = tipoEntidad || 'registro';
        var nombre = nombreEntidad || 'este ' + tipo;
        var result = await Swal.fire(Object.assign({}, BASE_DIALOG, {
            title:              'Eliminar ' + tipo,
            html:               '¿Estás seguro de eliminar <strong>' + nombre + '</strong>?'
                + '<br><span style="font-size:.875rem;color:#6b7280;">Esta acción no se puede deshacer.</span>',
            icon:               'warning',
            confirmButtonText:  'Eliminar',
            confirmButtonColor: '#dc2626'
        }));
        return result.isConfirmed;
    }

    /**
     * Toast genérico por tipo (compatibilidad con showToast() existente).
     * Mantiene compatibilidad con código anterior que use showToast().
     * @param {string} mensaje
     * @param {'success'|'error'|'warning'|'info'} [tipo='info']
     * @param {number} [duracion=4000]
     */
    function showToast(mensaje, tipo, duracion) {
        var t = tipo || 'info';
        switch (t) {
            case 'success': showSuccess(mensaje, duracion); break;
            case 'error':   showError(mensaje, duracion);   break;
            case 'warning': showWarning(mensaje, duracion); break;
            default:        showInfo(mensaje, duracion);    break;
        }
    }

    // ── Exportar al scope global ──────────────────────────────────
    global.AparcaNotif      = {
        showSuccess:       showSuccess,
        showError:         showError,
        showWarning:       showWarning,
        showInfo:          showInfo,
        showConfirm:       showConfirm,
        showDeleteConfirm: showDeleteConfirm,
        showToast:         showToast
    };

    // Aliases directos en window para compatibilidad con código existente
    global.showSuccess       = showSuccess;
    global.showError         = showError;
    global.showWarning       = showWarning;
    global.showInfo          = showInfo;
    global.showConfirm       = showConfirm;
    global.showDeleteConfirm = showDeleteConfirm;
    global.showToast         = showToast;

}(window));