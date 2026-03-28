/**
 * aparca-calendar.js — AparcaYA
 * =====================================================================
 * TAREA 2 — CALENDARIOS MODERNOS CON FLATPICKR
 *
 * REGLAS APLICADAS:
 *   ✅ REGLA 3 — NO crea lógica JS desde cero. Solo integra flatpickr
 *               sobre los inputs/botones EXISTENTES en cada dashboard.
 *   ✅ REGLA 1 — NO reemplaza los event listeners existentes en
 *               ClienteD.js, SedeD.js, TrabajadorD.js, AdminD.js
 *   ✅ REGLA 6 — Responsive: flatpickr funciona en móvil nativamente
 *
 * CAUSA RAÍZ:
 *   Cada dashboard usa inputs type="date" nativos (sin estilo, sin rango,
 *   inconsistentes entre browsers) o botones custom sin calendario real.
 *   DashboardCliente tiene botones #btnDesdeReserva/#btnHastaReserva
 *   que muestran un label de texto pero no abren ningún picker.
 *
 * SOLUCIÓN:
 *   Inicializar flatpickr sobre cada input/botón existente, adaptando
 *   el tema al color de cada dashboard:
 *
 *   Dashboard    Color base    Tema flatpickr
 *   ─────────────────────────────────────────
 *   Cliente      Índigo/violet → aparca-indigo
 *   Sede         Teal          → aparca-teal
 *   Trabajador   Teal          → aparca-teal
 *   Admin        Azul oscuro   → aparca-admin
 *
 * INSTALACIÓN (agregar en el <head> de cada dashboard):
 *   <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css"/>
 *   <script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
 *   <script src="https://cdn.jsdelivr.net/npm/flatpickr/dist/l10n/es.js"></script>
 *   <link rel="stylesheet" href="/css/aparca-calendar.css"/>
 *   <script src="/js/aparca-calendar.js" defer></script>
 * =====================================================================
 */

(function () {
    'use strict';

    // ── DETECCIÓN DE DASHBOARD ────────────────────────────────────────
    const path         = window.location.pathname;
    const esCliente    = path.includes('/cliente');
    const esSede       = path.includes('/administradorSede');
    const esTrabajador = path.includes('/trabajadorParqueadero');
    const esAdmin      = path.includes('/administradorGeneral');

    // ── OPCIONES BASE FLATPICKR ───────────────────────────────────────
    const LOCALE_ES = {
        firstDayOfWeek: 1,
        weekdays: {
            shorthand: ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'],
            longhand:  ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
        },
        months: {
            shorthand: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
            longhand:  ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
        }
    };

    const BASE_CONFIG = {
        locale:          LOCALE_ES,
        dateFormat:      'Y-m-d',
        disableMobile:   false,   // ✅ Permite picker nativo en móvil
        allowInput:      true,
        animate:         true,
        showMonths:      1,
    };

    // ── UTILIDADES ────────────────────────────────────────────────────

    /**
     * Crea un flatpickr sobre un <input type="date"> estándar.
     * NO rompe los event listeners existentes porque flatpickr
     * dispara el evento 'change' nativo después de seleccionar.
     */
    function initDateInput(selector, extraConfig) {
        const el = document.querySelector(selector);
        if (!el || typeof flatpickr === 'undefined') return null;

        return flatpickr(el, {
            ...BASE_CONFIG,
            ...extraConfig
        });
    }

    /**
     * Crea un flatpickr sobre un <button> que muestra el texto de la fecha.
     * Se usa en DashboardCliente donde los filtros son botones, no inputs.
     *
     * Al seleccionar:
     *   1. Actualiza el <span> del label visible
     *   2. Guarda el valor en el hidden input correspondiente
     *   3. Llama el callback si se provee (para disparar el filtro)
     */
    function initDateButton(btnSelector, labelSelector, hiddenSelector, extraConfig, onSelect) {
        const btn    = document.querySelector(btnSelector);
        const label  = document.querySelector(labelSelector);
        const hidden = document.querySelector(hiddenSelector);
        if (!btn || typeof flatpickr === 'undefined') return null;

        // Crear un input oculto temporal para flatpickr
        const input  = document.createElement('input');
        input.type   = 'hidden';
        btn.parentNode.insertBefore(input, btn.nextSibling);

        const fp = flatpickr(input, {
            ...BASE_CONFIG,
            ...extraConfig,
            onReady: function (_, __, instance) {
                // Abrir el picker al hacer click en el botón
                btn.addEventListener('click', function (e) {
                    e.preventDefault();
                    instance.open();
                });
            },
            onChange: function (selectedDates, dateStr) {
                if (label)  label.textContent  = dateStr || 'Fecha';
                if (hidden) hidden.value        = dateStr || '';
                if (onSelect) onSelect(dateStr, selectedDates);
            }
        });

        return fp;
    }

    /**
     * Inicializa un rango de fechas en dos inputs separados.
     * Cuando se selecciona "desde", el mínimo de "hasta" se actualiza.
     */
    function initDateRange(desdeSelector, hastaSelector, extraConfig, onRangeChange) {
        const fpDesde = initDateInput(desdeSelector, {
            ...extraConfig,
            onChange: function (selectedDates, dateStr) {
                if (fpHasta) {
                    fpHasta.set('minDate', dateStr || null);
                }
                if (onRangeChange) onRangeChange('desde', dateStr, selectedDates);
            }
        });

        const fpHasta = initDateInput(hastaSelector, {
            ...extraConfig,
            onChange: function (selectedDates, dateStr) {
                if (fpDesde) {
                    fpDesde.set('maxDate', dateStr || null);
                }
                if (onRangeChange) onRangeChange('hasta', dateStr, selectedDates);
            }
        });

        return { fpDesde, fpHasta };
    }

    // ═════════════════════════════════════════════════════════════════
    // DASHBOARD CLIENTE
    // Calendarios en: Mis Reservas (btnDesde/Hasta) y Pagos (btnDesde/Hasta)
    // ═════════════════════════════════════════════════════════════════
    function initCalendarioCliente() {
        // ── Sección "Mis Reservas" ────────────────────────────────────
        initDateButton(
            '#btnDesdeReserva',
            '#lblDesdeReserva',
            '#filtroFechaDesdeReserva',
            { maxDate: 'today' },
            function (fecha) {
                // NO romper la lógica existente — disparar filtrarReservas si existe
                if (typeof filtrarReservas === 'function') filtrarReservas();
            }
        );

        initDateButton(
            '#btnHastaReserva',
            '#lblHastaReserva',
            '#filtroFechaHastaReserva',
            { maxDate: 'today' },
            function (fecha) {
                if (typeof filtrarReservas === 'function') filtrarReservas();
            }
        );

        // ── Sección "Pagos" ───────────────────────────────────────────
        initDateButton(
            '#btnDesdePago',
            '#lblDesdePago',
            '#filtroFechaDesdePago',
            { maxDate: 'today' },
            function (fecha) {
                if (typeof filtrarPagos === 'function') filtrarPagos();
            }
        );

        initDateButton(
            '#btnHastaPago',
            '#lblHastaPago',
            '#filtroFechaHastaPago',
            { maxDate: 'today' },
            function (fecha) {
                if (typeof filtrarPagos === 'function') filtrarPagos();
            }
        );

        console.log('[aparca-calendar] Cliente: calendarios inicializados');
    }

    // ═════════════════════════════════════════════════════════════════
    // DASHBOARD SEDE
    // Calendarios en: Historial (filtroFecha) y Gráficas (periodoDesde/Hasta)
    // ═════════════════════════════════════════════════════════════════
    function initCalendarioSede() {
        // ── Sección "Historial" ───────────────────────────────────────
        initDateInput('#filtroFecha', {
            maxDate: 'today',
            // El botón "Filtrar" existente (onclick="loadHistorial()")
            // ya lee el valor del input — flatpickr actualiza ese valor.
            // ✅ NO se rompe la lógica existente
        });

        // ── Sección "Gráficas" ────────────────────────────────────────
        initDateRange(
            '#periodoDesde',
            '#periodoHasta',
            { maxDate: 'today' },
            // El botón "Actualizar" existente (onclick="cargarGraficas()")
            // ya lee los valores — solo se actualiza el input.
            null
        );

        console.log('[aparca-calendar] Sede: calendarios inicializados');
    }

    // ═════════════════════════════════════════════════════════════════
    // DASHBOARD TRABAJADOR
    // Calendarios en: Historial (filtroFecha)
    // ═════════════════════════════════════════════════════════════════
    function initCalendarioTrabajador() {
        // ── Sección "Historial" ───────────────────────────────────────
        initDateInput('#filtroFecha', {
            maxDate: 'today',
        });

        console.log('[aparca-calendar] Trabajador: calendarios inicializados');
    }

    // ═════════════════════════════════════════════════════════════════
    // DASHBOARD ADMIN
    // Calendarios en: Gráficas (filtroGraficaDesde/Hasta) y
    //                 Historial correos (filtroHistorialDesde/Hasta)
    // ═════════════════════════════════════════════════════════════════
    function initCalendarioAdmin() {
        // ── Sección "Gráficas" ────────────────────────────────────────
        initDateRange(
            '#filtroGraficaDesde',
            '#filtroGraficaHasta',
            { maxDate: 'today' },
            null
        );

        // ── Sección "Historial de correos" ────────────────────────────
        // Estos son datetime-local — flatpickr con enableTime
        const configDatetime = {
            enableTime:  true,
            dateFormat:  'Y-m-dTH:i',
            time_24hr:   true,
            maxDate:     'today'
        };

        initDateInput('#filtroHistorialDesde', configDatetime);
        initDateInput('#filtroHistorialHasta', configDatetime);

        console.log('[aparca-calendar] Admin: calendarios inicializados');
    }

    // ── INICIALIZACIÓN AUTOMÁTICA ─────────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {

        // Verificar que flatpickr está cargado
        if (typeof flatpickr === 'undefined') {
            console.warn('[aparca-calendar] flatpickr no está cargado. ' +
                'Agregar CDN en el <head> del dashboard.');
            return;
        }

        // Inicializar según el dashboard actual
        if (esCliente)    initCalendarioCliente();
        if (esSede)       initCalendarioSede();
        if (esTrabajador) initCalendarioTrabajador();
        if (esAdmin)      initCalendarioAdmin();

        // Fallback: si no se detectó el dashboard por pathname,
        // intentar inicializar todos (para desarrollo local)
        if (!esCliente && !esSede && !esTrabajador && !esAdmin) {
            console.warn('[aparca-calendar] Dashboard no detectado por URL. ' +
                'Inicializando todos los calendarios disponibles.');
            initCalendarioCliente();
            initCalendarioSede();
            initCalendarioTrabajador();
            initCalendarioAdmin();
        }
    });

    // ── API PÚBLICA ───────────────────────────────────────────────────
    window.aparcaCalendar = {
        initDateInput,
        initDateButton,
        initDateRange
    };

})();