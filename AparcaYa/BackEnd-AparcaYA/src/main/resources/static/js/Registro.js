/* ================================================
   REGISTRO.JS — AparcaYA
   Ruta: /js/Registro.js

   MEJORAS APLICADAS:
   ✅ Iconos Lucide SVG en todos los toasts y alertas
   ✅ Sistema de mapa completamente rediseñado
   ✅ Autocompletado inteligente con Nominatim (sin API key)
   ✅ Marcador draggable con reverse geocoding
   ✅ Botón GPS con geolocalización del navegador
   ✅ Validación de coordenadas antes de avanzar
   ✅ Badge de confirmación de ubicación
   ✅ Mapa visible desde el inicio del paso 3
   ✅ Sin API key expuesta en frontend
   ================================================ */
document.addEventListener('DOMContentLoaded', function () {

    let rol = "CLIENTE";
    let rolBloqueado = false;

    const localidadSelect    = document.getElementById('localidad');
    const barrioSelect       = document.getElementById('barrio');
    const tipoVehiculoSelect = document.getElementById('tipoVehiculo');
    const marcaSelect        = document.getElementById('marca');


    var _GEO_AUTOFILL = {

        // ── Mapa localidad: texto Nominatim → value del <select> ──
        LOCALIDADES: {
            // USAQUEN
            'usaquén':            'USAQUEN',
            'usaquen':            'USAQUEN',
            // CHAPINERO
            'chapinero':          'CHAPINERO',
            // SANTA FE
            'santa fe':           'SANTA_FE',
            'santafé':            'SANTA_FE',
            'santafe':            'SANTA_FE',
            // SAN CRISTOBAL
            'san cristóbal':      'SAN_CRISTOBAL',
            'san cristobal':      'SAN_CRISTOBAL',
            // USME
            'usme':               'USME',
            // TUNJUELITO
            'tunjuelito':         'TUNJUELITO',
            // BOSA
            'bosa':               'BOSA',
            // KENNEDY
            'kennedy':            'KENNEDY',
            // FONTIBON
            'fontibón':           'FONTIBON',
            'fontibon':           'FONTIBON',
            // ENGATIVA
            'engativá':           'ENGATIVA',
            'engativa':           'ENGATIVA',
            // SUBA
            'suba':               'SUBA',
            // BARRIOS UNIDOS
            'barrios unidos':     'BARRIOS_UNIDOS',
            // TEUSAQUILLO
            'teusaquillo':        'TEUSAQUILLO',
            // MARTIRES
            'los mártires':       'MARTIRES',
            'los martires':       'MARTIRES',
            'mártires':           'MARTIRES',
            'martires':           'MARTIRES',
            // ANTONIO NARINO
            'antonio nariño':     'ANTONIO_NARINO',
            'antonio narino':     'ANTONIO_NARINO',
            // PUENTE ARANDA
            'puente aranda':      'PUENTE_ARANDA',
            // CANDELARIA
            'la candelaria':      'CANDELARIA',
            'candelaria':         'CANDELARIA',
            // RAFAEL URIBE
            'rafael uribe uribe': 'RAFAEL_URIBE_URIBE',
            'rafael uribe':       'RAFAEL_URIBE_URIBE',
            // CIUDAD BOLIVAR
            'ciudad bolívar':     'CIUDAD_BOLIVAR',
            'ciudad bolivar':     'CIUDAD_BOLIVAR',
            // SUMAPAZ
            'sumapaz':            'SUMAPAZ'
        },

        // ── Mapa barrio: texto Nominatim → barrio normalizado ─────
        // (solo los más frecuentes; si no hay match exacto se usa
        //  el valor crudo limpio)
        BARRIOS: {
            'cedritos':              'Cedritos',
            'molinos norte':         'Molinos Norte',
            'la calleja':            'La Calleja',
            'barrancas':             'Barrancas',
            'santa bárbara':         'Santa Bárbara',
            'santa barbara':         'Santa Bárbara',
            'usaquén':               'Usaquén',
            'chicó':                 'Chicó',
            'chico':                 'Chicó',
            'el lago':               'El Lago',
            'lago gaitán':           'El Lago',
            'rosales':               'Rosales',
            'los rosales':           'Rosales',
            'chapinero alto':        'Chapinero Alto',
            'antiguo country':       'Antiguo Country',
            'la cabrera':            'La Cabrera',
            'las aguas':             'Las Aguas',
            'la perseverancia':      'La Perseverancia',
            'san diego':             'San Diego',
            'san cristóbal norte':   'San Cristóbal Norte',
            'san cristobal norte':   'San Cristóbal Norte',
            'san blas':              'San Blas',
            'la victoria':           'La Victoria',
            'usme pueblo':           'Usme Pueblo',
            'yomasa':                'Yomasa',
            'parque el tunal':       'Parque El Tunal',
            'venecia':               'Venecia',
            'bosa central':          'Bosa Central',
            'bosa laureles':         'Bosa Laureles',
            'el porvenir':           'El Porvenir',
            'tintal':                'Tintal',
            'timiza':                'Timiza',
            'mandalay':              'Mandalay',
            'carvajal':              'Carvajal',
            'patio bonito':          'Patio Bonito',
            'kennedy central':       'Kennedy Central',
            'techo':                 'Techo',
            'capellanía':            'Capellanía',
            'capellania':            'Capellanía',
            'fontibón centro':       'Fontibón Centro',
            'fontibon centro':       'Fontibón Centro',
            'modelia':               'Modelia',
            'ferias':                'Ferias',
            'boyacá real':           'Boyacá Real',
            'boyaca real':           'Boyacá Real',
            'minuto de dios':        'Minuto de Dios',
            'tibabuyes':             'Tibabuyes',
            'niza':                  'Niza',
            'suba centro':           'Suba Centro',
            'la campiña':            'La Campiña',
            'la campina':            'La Campiña',
            'la alhambra':           'La Alhambra',
            'el rincón':             'El Rincón',
            'el rincon':             'El Rincón',
            'lista':                 'Lisboa',
            'lisboa':                'Lisboa',
            '7 de agosto':           '7 de Agosto',
            'doce de octubre':       'Doce de Octubre',
            'san felipe':            'San Felipe',
            'los andes':             'Los Andes',
            'la soledad':            'La Soledad',
            'quesada':               'Quesada',
            'campín':                'Campín',
            'campin':                'Campín',
            'palermo':               'Palermo',
            'santa isabel':          'Santa Isabel',
            'eduardo santos':        'Eduardo Santos',
            'restrepo':              'Restrepo',
            'policarpa':             'Policarpa',
            'ciudad montes':         'Ciudad Montes',
            'muzú':                  'Muzú',
            'muzu':                  'Muzú',
            'la catedral':           'La Catedral',
            'egipto':                'Egipto',
            'bravo páez':            'Bravo Páez',
            'bravo paez':            'Bravo Páez',
            'marruecos':             'Marruecos',
            'quiroga':               'Quiroga',
            'meissen':               'Meissen',
            'jerusalén':             'Jerusalén',
            'jerusalem':             'Jerusalén',
            'paraíso':               'Paraíso',
            'paraiso':               'Paraíso',
            'nazareth':              'Nazareth'
        }
    };

    // =========================================================
    // ICONOS LUCIDE SVG INLINE (para toasts y UI dinámica)
    // =========================================================
    const ICONS = {
        success: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round"
                      stroke-linejoin="round" style="width:16px;height:16px;flex-shrink:0;">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>`,
        error:   `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round"
                      stroke-linejoin="round" style="width:16px;height:16px;flex-shrink:0;">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="m15 9-6 6M9 9l6 6"/>
                  </svg>`,
        warning: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round"
                      stroke-linejoin="round" style="width:16px;height:16px;flex-shrink:0;">
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                      <path d="M12 9v4"/><path d="M12 17h.01"/>
                  </svg>`,
        info:    `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round"
                      stroke-linejoin="round" style="width:16px;height:16px;flex-shrink:0;">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M12 16v-4"/><path d="M12 8h.01"/>
                  </svg>`,
        pin:     `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round"
                      stroke-linejoin="round" style="width:16px;height:16px;flex-shrink:0;">
                      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
                      <circle cx="12" cy="10" r="3"/>
                  </svg>`,
        nav:     `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round"
                      stroke-linejoin="round" style="width:16px;height:16px;flex-shrink:0;">
                      <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                  </svg>`,
        spinner: `<svg style="width:14px;height:14px;animation:spin 1s linear infinite;flex-shrink:0;"
                      xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle style="opacity:.25" cx="12" cy="12" r="10"
                              stroke="currentColor" stroke-width="4"></circle>
                      <path style="opacity:.75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                  </svg>`
    };

    // =========================================================
    // SISTEMA UNIFICADO DE NOTIFICACIONES
    // =========================================================

    function showToast(mensaje, tipo = 'info', duracion = 3500) {
        let contenedor = document.getElementById('toast-contenedor');
        if (!contenedor) {
            contenedor = document.createElement('div');
            contenedor.id = 'toast-contenedor';
            contenedor.style.cssText = [
                'position:fixed', 'top:1.5rem', 'right:1.5rem',
                'z-index:9999', 'display:flex', 'flex-direction:column', 'gap:0.5rem'
            ].join(';');
            document.body.appendChild(contenedor);
        }

        const palette = {
            success: 'background:#f0fdf4;border:1px solid #86efac;color:#166534',
            error:   'background:#fef2f2;border:1px solid #fca5a5;color:#991b1b',
            warning: 'background:#fffbeb;border:1px solid #fcd34d;color:#92400e',
            info:    'background:#eff6ff;border:1px solid #93c5fd;color:#1e40af'
        };

        const toast = document.createElement('div');
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'polite');
        toast.style.cssText = [
            palette[tipo] || palette.info,
            'padding:0.75rem 1rem', 'border-radius:0.625rem',
            'box-shadow:0 4px 16px rgba(0,0,0,.1)', 'font-size:0.875rem',
            'display:flex', 'align-items:center', 'gap:0.5rem',
            'max-width:340px', 'transition:opacity 0.3s',
            'font-family:"Plus Jakarta Sans",system-ui,sans-serif',
            'font-weight:500'
        ].join(';');
        toast.innerHTML = `${ICONS[tipo] || ICONS.info}<span>${mensaje}</span>`;
        contenedor.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 350);
        }, duracion);
    }

    function showAlert(mensaje, tipo = 'error') {
        const div = document.getElementById('mensajeJS');
        if (!div) return;

        const palette = {
            error:   'background:#fef2f2;border:1px solid #fca5a5;color:#991b1b',
            success: 'background:#f0fdf4;border:1px solid #86efac;color:#166534',
            warning: 'background:#fffbeb;border:1px solid #fcd34d;color:#92400e'
        };

        div.style.cssText = [
            palette[tipo] || palette.error,
            'padding:0.75rem 1rem', 'border-radius:0.625rem',
            'font-size:0.875rem', 'display:flex',
            'align-items:flex-start', 'gap:0.5rem', 'margin-top:1rem',
            'font-family:"Plus Jakarta Sans",system-ui,sans-serif'
        ].join(';');
        div.innerHTML = `${ICONS[tipo] || ICONS.error}<span>${mensaje}</span>`;
        div.scrollIntoView({ behavior: 'smooth', block: 'center' });

        setTimeout(() => {
            div.style.cssText = '';
            div.innerHTML     = '';
        }, 6000);
    }

    function setBtnLoading(btn, state, texto = 'Siguiente') {
        if (state) {
            btn.disabled  = true;
            btn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:0.4rem;">
                ${ICONS.spinner}
                Verificando...
            </span>`;
        } else {
            btn.disabled  = false;
            btn.innerHTML = `${texto}
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                     stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
                     stroke-linejoin="round" style="width:16px;height:16px;">
                    <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                </svg>`;
        }
    }

    if (!document.getElementById('spin-style')) {
        const style = document.createElement('style');
        style.id          = 'spin-style';
        style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
        document.head.appendChild(style);
    }

    // =========================================================
    // PERSISTENCIA DE DATOS CON sessionStorage
    // =========================================================

    const STORAGE_KEY = 'aparcaya_registro_form';

    const CAMPOS_PERSISTIR = [
        'nombre', 'correo', 'telefono', 'cedula', 'rolHidden',
        'placa', 'tipoVehiculo', 'marca', 'color', 'anio',
        'nombreSede', 'nit', 'direccion', 'localidad', 'barrio',
        'cuposTotales',
        'tarifaPlenaC', 'tarifaPlenaM', 'tarifaMinutoC', 'tarifaMinutoM',
        'horarioSede'
    ];

    function guardarFormulario() {
        const datos = { __rol: rol };
        CAMPOS_PERSISTIR.forEach(id => {
            const el = document.getElementById(id);
            if (el) datos[id] = el.value;
        });
        try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(datos)); } catch (e) {}
    }

    function restaurarFormulario() {
        let datos;
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            datos = JSON.parse(raw);
        } catch (e) { return; }

        if (datos.__rol && datos.__rol !== rol) setRol(datos.__rol);

        CAMPOS_PERSISTIR.forEach(id => {
            if (id === 'localidad' || id === 'tipoVehiculo' ||
                id === 'barrio'    || id === 'marca') return;
            const el = document.getElementById(id);
            if (el && datos[id] !== undefined) el.value = datos[id];
        });

        if (datos['localidad']) {
            const el = document.getElementById('localidad');
            if (el) {
                el.value = datos['localidad'];
                updateBarrios();
                if (datos['barrio']) {
                    const barrioEl = document.getElementById('barrio');
                    if (barrioEl) barrioEl.value = datos['barrio'];
                }
            }
        }

        if (datos['tipoVehiculo']) {
            const el = document.getElementById('tipoVehiculo');
            if (el) {
                el.value = datos['tipoVehiculo'];
                updateMarcas();
                if (datos['marca']) {
                    const marcaEl = document.getElementById('marca');
                    if (marcaEl) marcaEl.value = datos['marca'];
                }
            }
        }
    }

    function limpiarFormulario() {
        try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) {}
    }

    CAMPOS_PERSISTIR.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const evento = (el.tagName === 'SELECT') ? 'change' : 'input';
        el.addEventListener(evento, guardarFormulario);
    });

    restaurarFormulario();

    // =========================================================
    // MARCAS POR TIPO DE VEHÍCULO
    // =========================================================
    const marcasPorTipo = {
        CARRO: [
            "RENAULT","KIA","TOYOTA","CHEVROLET","MAZDA","NISSAN","VOLKSWAGEN",
            "FORD","HYUNDAI","BMW","MERCEDES_BENZ","AUDI","PEUGEOT","CITROEN",
            "FIAT","VOLVO","JEEP","LAND_ROVER","PORSCHE","FERRARI","LAMBORGHINI",
            "TESLA","BYD","CHANGAN","GEELY","JAC","CHERY","GREAT_WALL","HAVAL",
            "GWM","MITSUBISHI","SUBARU","ISUZU","SSANGYONG","MG","RAM","DFSK",
            "FOTON","OTRO"
        ],
        MOTO: [
            "HONDA","YAMAHA","SUZUKI","KAWASAKI","BAJAJ","TVS","HERO","KTM",
            "DUCATI","HARLEY_DAVIDSON","BMW_MOTORRAD","TRIUMPH","ROYAL_ENFIELD",
            "AUTECO","AKT","VICTORY","APRILIA","BENELLI","HUSQVARNA","OTRO"
        ],
        BICICLETA: [
            "TREK","SPECIALIZED","GIANT","SCOTT","CANNONDALE","ORBEA","GW",
            "SHIMANO","BIANCHI","MERIDA","CUBE","BMC","FOCUS","OTRO"
        ],
        OTRO: ["OTRO"]
    };

    function formatMarcaName(marca) {
        const formatMap = {
            'MERCEDES_BENZ': 'Mercedes-Benz', 'LAND_ROVER': 'Land Rover',
            'GREAT_WALL': 'Great Wall',        'BMW_MOTORRAD': 'BMW Motorrad',
            'HARLEY_DAVIDSON': 'Harley-Davidson', 'ROYAL_ENFIELD': 'Royal Enfield'
        };
        if (formatMap[marca]) return formatMap[marca];
        return marca.split('_')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ');
    }

    function updateMarcas() {
        marcaSelect.innerHTML = '<option value="">Selecciona una marca</option>';
        const tipo = tipoVehiculoSelect.value;
        if (tipo && marcasPorTipo[tipo]) {
            marcasPorTipo[tipo].forEach(marca => {
                const opt       = document.createElement('option');
                opt.value       = marca;
                opt.textContent = formatMarcaName(marca);
                marcaSelect.appendChild(opt);
            });
        }
    }
    tipoVehiculoSelect.addEventListener('change', updateMarcas);

    // =========================================================
    // LOCALIDADES / BARRIOS
    // =========================================================
    const localidadesBarrios = {
        USAQUEN:           ["Santa Bárbara","Cedritos","Usaquén","La Calleja","Molinos Norte","Barrancas"],
        CHAPINERO:         ["Chicó","El Lago","Rosales","Chapinero Alto","Antiguo Country"],
        SANTA_FE:          ["Las Aguas","La Perseverancia","San Diego"],
        SAN_CRISTOBAL:     ["San Cristóbal Norte","San Blas","La Victoria"],
        USME:              ["Usme Pueblo","Yomasa","El Virrey"],
        TUNJUELITO:        ["Parque El Tunal","San Vicente","Venecia"],
        BOSA:              ["Bosa Central","Bosa Laureles","El Porvenir"],
        KENNEDY:           ["Tintal","Timiza","Mandalay","Carvajal","Patio Bonito"],
        FONTIBON:          ["Capellanía","Fontibón Centro","Modelia"],
        ENGATIVA:          ["Ferias","Boyacá Real","Minuto de Dios"],
        SUBA:              ["Tibabuyes","Niza","Suba Centro","La Campiña"],
        BARRIOS_UNIDOS:    ["7 de Agosto","Doce de Octubre","San Felipe"],
        TEUSAQUILLO:       ["La Soledad","Quesada","Campín"],
        MARTIRES:          ["Santa Isabel","Eduardo Santos"],
        ANTONIO_NARINO:    ["Restrepo","Eduardo Santos","Policarpa"],
        PUENTE_ARANDA:     ["Ciudad Montes","Torremolinos","Salazar Gómez"],
        CANDELARIA:        ["La Catedral","Egipto","Las Aguas"],
        RAFAEL_URIBE_URIBE:["Bravo Páez","Marruecos","Quiroga"],
        CIUDAD_BOLIVAR:    ["Meissen","Jerusalén","Paraíso"],
        SUMAPAZ:           ["Nazareth","Betania"]
    };

    function updateBarrios() {
        const loc = localidadSelect.value;
        if (loc && localidadesBarrios[loc]) {
            barrioSelect.innerHTML = '<option value="">Selecciona un barrio</option>';
            localidadesBarrios[loc].forEach(barrio => {
                const opt       = document.createElement('option');
                opt.value       = opt.textContent = barrio;
                barrioSelect.appendChild(opt);
            });
        } else {
            barrioSelect.innerHTML = '<option value="">Primero selecciona localidad</option>';
        }
    }
    localidadSelect.addEventListener('change', updateBarrios);

    // =========================================================
    // SELECCIÓN DE ROL
    // =========================================================
    document.getElementById("btnCliente").onclick = () => { if (!rolBloqueado) setRol("CLIENTE"); };
    document.getElementById("btnSede").onclick    = () => { if (!rolBloqueado) setRol("ADMINISTRADOR_SEDE"); };

    function setRol(r) {
        rol = r;
        const btnCliente = document.getElementById("btnCliente");
        const btnSede    = document.getElementById("btnSede");
        const rolHidden  = document.getElementById("rolHidden");
        if (btnCliente) btnCliente.classList.toggle("active", r === "CLIENTE");
        if (btnSede)    btnSede.classList.toggle("active",    r === "ADMINISTRADOR_SEDE");
        if (rolHidden)  rolHidden.value = r;
    }

    function showStep(stepId) {
        document.querySelectorAll(".step").forEach(s => s.classList.remove("active-step"));
        const step = document.getElementById(stepId);
        if (step) step.classList.add("active-step");
    }

    // =========================================================
    // VALIDACIÓN
    // =========================================================
    function validateField(fieldId, customValidator) {
        const field       = document.getElementById(fieldId);
        const errorSpan   = document.getElementById(fieldId + "-error");
        const successSpan = document.getElementById(fieldId + "-success");
        if (!field) return true;

        let isValid = true;
        let message = "";

        if (customValidator) {
            const result = customValidator(field.value);
            isValid = result.isValid;
            message = result.message || "";
        } else {
            if (field.hasAttribute('required') && !field.value.trim()) {
                isValid = false;
                message = "Este campo es obligatorio.";
            } else if (field.hasAttribute('pattern') && field.value &&
                !new RegExp(field.pattern).test(field.value)) {
                isValid = false;
                message = field.title || "Formato inválido.";
            }
        }

        if (errorSpan)   errorSpan.textContent  = isValid ? "" : message;
        if (successSpan) successSpan.textContent = "";
        field.classList.toggle("border-red-500",   !isValid);
        field.classList.toggle("border-green-500",  isValid && field.value.trim() !== "");
        return isValid;
    }

    function validateStep(stepId) {
        const step = document.getElementById(stepId);
        if (!step) return true;
        let isValid = true;

        step.querySelectorAll("input[required], select[required]").forEach(field => {
            let customValidator = null;

            if (field.id === "correo") {
                customValidator = v => {
                    if (!v.includes("@"))
                        return { isValid: false, message: "El correo debe contener '@'." };
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
                        return { isValid: false, message: "Formato de correo inválido." };
                    return { isValid: true };
                };
            } else if (field.id === "confirmarContrasena") {
                customValidator = v => {
                    const pass = document.getElementById("contrasena").value;
                    if (v !== pass)
                        return { isValid: false, message: "Las contraseñas no coinciden." };
                    return { isValid: true };
                };
            } else if (field.id === "telefono" || field.id === "cedula") {
                customValidator = v => {
                    if (!/^[0-9]{10}$/.test(v))
                        return { isValid: false, message: "Debe tener exactamente 10 dígitos numéricos." };
                    return { isValid: true };
                };
            } else if (field.id === "placa") {
                customValidator = v => {
                    if (!/^[A-Z]{3}[0-9]{3}$/.test(v.toUpperCase()))
                        return { isValid: false, message: "Formato de placa inválido (ej. ABC123)." };
                    return { isValid: true };
                };
            } else if (field.id === "nit") {
                customValidator = v => {
                    if (!/^[0-9]{9}-[0-9]$/.test(v))
                        return { isValid: false, message: "Formato de NIT inválido (ej. 123456789-0)." };
                    return { isValid: true };
                };
            }

            if (!validateField(field.id, customValidator)) isValid = false;
        });

        return isValid;
    }

    // =========================================================
    // VERIFICACIÓN BACKEND
    // =========================================================
    async function checkDisponibilidad(endpoint, value, fieldId) {
        const errorSpan   = document.getElementById(fieldId + "-error");
        const successSpan = document.getElementById(fieldId + "-success");
        const field       = document.getElementById(fieldId);
        if (!value || !value.trim()) return true;

        try {
            const res  = await fetch(`${endpoint}?value=${encodeURIComponent(value.trim())}`);
            const data = await res.json();

            if (!data.disponible) {
                if (errorSpan)   errorSpan.textContent   = data.mensaje;
                if (successSpan) successSpan.textContent = "";
                if (field) { field.classList.add("border-red-500"); field.classList.remove("border-green-500"); }
                showToast(data.mensaje, 'error');
                return false;
            } else {
                if (errorSpan)   errorSpan.textContent   = "";
                if (successSpan) successSpan.textContent = data.mensaje + " ✓";
                if (field) { field.classList.remove("border-red-500"); field.classList.add("border-green-500"); }
                return true;
            }
        } catch (err) {
            console.warn("No se pudo verificar disponibilidad (" + fieldId + "):", err);
            return true;
        }
    }

    async function verificarPaso1ConBackend() {
        const correo   = document.getElementById("correo").value.trim();
        const cedula   = document.getElementById("cedula").value.trim();
        const telefono = document.getElementById("telefono").value.trim();

        let resultados;
        try {
            resultados = await Promise.all([
                fetch(`/check/correo?value=${encodeURIComponent(correo)}`).then(r => r.json()),
                fetch(`/check/cedula?value=${encodeURIComponent(cedula)}`).then(r => r.json()),
                fetch(`/check/telefono?value=${encodeURIComponent(telefono)}`).then(r => r.json())
            ]);
        } catch (err) {
            console.error("Error de red verificando disponibilidad:", err);
            showAlert("No se pudo verificar la disponibilidad de tus datos. Revisa tu conexión e inténtalo de nuevo.", 'error');
            return false;
        }

        const [resCorreo, resCedula, resTelefono] = resultados;
        let todosDisponibles = true;

        const aplicar = (res, id) => {
            if (!res.disponible) {
                const span = document.getElementById(id + "-error");
                const suc  = document.getElementById(id + "-success");
                const inp  = document.getElementById(id);
                if (span) span.textContent = res.mensaje;
                if (suc)  suc.textContent  = "";
                if (inp)  { inp.classList.add("border-red-500"); inp.classList.remove("border-green-500"); }
                showToast(res.mensaje, 'error');
                todosDisponibles = false;
            }
        };

        aplicar(resCorreo,   'correo');
        aplicar(resCedula,   'cedula');
        aplicar(resTelefono, 'telefono');

        if (!todosDisponibles)
            showAlert("Algunos datos ya están registrados. Corrígelos antes de continuar.", 'error');

        return todosDisponibles;
    }

    document.getElementById("correo").addEventListener('blur', async function () {
        const ok = validateField("correo", v => {
            if (!v.includes("@")) return { isValid: false, message: "El correo debe contener '@'." };
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { isValid: false, message: "Formato de correo inválido." };
            return { isValid: true };
        });
        if (ok && this.value.trim()) await checkDisponibilidad('/check/correo', this.value, 'correo');
    });

    document.getElementById("cedula").addEventListener('blur', async function () {
        const ok = validateField("cedula", v => {
            if (!/^[0-9]{10}$/.test(v)) return { isValid: false, message: "Debe tener exactamente 10 dígitos numéricos." };
            return { isValid: true };
        });
        if (ok && this.value.trim()) await checkDisponibilidad('/check/cedula', this.value, 'cedula');
    });

    document.getElementById("telefono").addEventListener('blur', async function () {
        const ok = validateField("telefono", v => {
            if (!/^[0-9]{10}$/.test(v)) return { isValid: false, message: "Debe tener exactamente 10 dígitos numéricos." };
            return { isValid: true };
        });
        if (ok && this.value.trim()) await checkDisponibilidad('/check/telefono', this.value, 'telefono');
    });

    document.getElementById("nit").addEventListener('blur', async function () {
        const ok = validateField("nit", v => {
            if (!/^[0-9]{9}-[0-9]$/.test(v)) return { isValid: false, message: "Formato de NIT inválido (ej. 123456789-0)." };
            return { isValid: true };
        });
        if (ok && this.value.trim()) await checkDisponibilidad('/check/nit', this.value, 'nit');
    });

    // =========================================================
    // TOGGLE DE CONTRASEÑA
    // =========================================================
    document.querySelectorAll('.toggle-password').forEach(button => {
        button.addEventListener('click', function () {
            const input     = document.getElementById(this.getAttribute('data-target'));
            const eyeOpen   = this.querySelector('.eye-open');
            const eyeClosed = this.querySelector('.eye-closed');
            if (input.type === 'password') {
                input.type = 'text';
                eyeOpen.classList.add('hidden');
                eyeClosed.classList.remove('hidden');
            } else {
                input.type = 'password';
                eyeClosed.classList.add('hidden');
                eyeOpen.classList.remove('hidden');
            }
        });
    });

    document.getElementById("confirmarContrasena").addEventListener('input', function () {
        const pass      = document.getElementById("contrasena").value;
        const confirm   = this.value;
        const errorSpan = document.getElementById("confirmar-error");
        if (confirm && pass !== confirm) {
            errorSpan.textContent = "Las contraseñas no coinciden.";
            this.classList.add("border-red-500");
            this.classList.remove("border-green-500");
        } else if (confirm && pass === confirm) {
            errorSpan.textContent = "";
            this.classList.remove("border-red-500");
            this.classList.add("border-green-500");
        } else {
            errorSpan.textContent = "";
            this.classList.remove("border-red-500", "border-green-500");
        }
    });


    // =========================================================
    // ═══════════════════════════════════════════════════════
    //  SISTEMA DE GEOLOCALIZACIÓN PROFESIONAL — APARCAYA
    //  Nominatim (OSM) · Sin API key · Reverse geocoding
    //  Autocompletado · GPS · Marcador draggable
    // ═══════════════════════════════════════════════════════
    // =========================================================

    let mapaRegistro        = null;
    let marcadorRegistro    = null;
    let ubicacionConfirmada = false;
    let autocompDebounce    = null;
    let lastNominatimReq    = 0;  // throttle: 1 req/s a Nominatim
    let sistemaMapaIniciado = false;

    // ── Centroides de referencia ────────────────────────────────────────────
    const CENTROIDES_BARRIOS = {
        'Barrancas': [4.7348, -74.0258],        'Cedritos': [4.7190, -74.0355],
        'Santa Bárbara': [4.7020, -74.0391],    'Usaquén': [4.7050, -74.0350],
        'La Calleja': [4.7150, -74.0310],        'Molinos Norte': [4.7080, -74.0280],
        'Chicó': [4.6737, -74.0517],             'El Lago': [4.6620, -74.0560],
        'Rosales': [4.6597, -74.0482],           'Chapinero Alto': [4.6400, -74.0620],
        'Antiguo Country': [4.6716, -74.0573],   'Niza': [4.7298, -74.0632],
        'Tibabuyes': [4.7451, -74.0785],         'Suba Centro': [4.7415, -74.0816],
        'La Campiña': [4.7350, -74.0700],        'Ferias': [4.7024, -74.1113],
        'Boyacá Real': [4.7100, -74.1000],       'Minuto de Dios': [4.7063, -74.1142],
        'La Soledad': [4.6448, -74.0732],        'Quesada': [4.6380, -74.0850],
        'Campín': [4.6460, -74.0920],            '7 de Agosto': [4.6772, -74.0895],
        'Doce de Octubre': [4.6900, -74.0950],   'San Felipe': [4.6720, -74.0830],
        'Tintal': [4.6538, -74.1548],            'Timiza': [4.6251, -74.1489],
        'Carvajal': [4.6145, -74.1392],          'Patio Bonito': [4.6279, -74.1456],
        'Mandalay': [4.6350, -74.1500],          'Capellanía': [4.6900, -74.1400],
        'Fontibón Centro': [4.6800, -74.1450],   'Modelia': [4.6750, -74.1200],
        'Restrepo': [4.6110, -74.1026],          'Meissen': [4.5700, -74.1800],
        'Jerusalén': [4.5600, -74.1900],         'Paraíso': [4.5550, -74.1700],
        'La Catedral': [4.5970, -74.0730],       'Egipto': [4.5960, -74.0680],
        'Las Aguas': [4.6010, -74.0710],         'Bravo Páez': [4.5700, -74.1100],
        'Marruecos': [4.5650, -74.1200],         'Quiroga': [4.5800, -74.1150],
        'Ciudad Montes': [4.6287, -74.1189],     'Parque El Tunal': [4.5800, -74.1300],
        'San Vicente': [4.5750, -74.1350],       'Venecia': [4.5850, -74.1400],
        'Bosa Central': [4.6242, -74.1975],      'Bosa Laureles': [4.6200, -74.2000],
        'El Porvenir': [4.6100, -74.2100],
    };

    const CENTROIDES_LOCALIDADES = {
        'USAQUEN': [4.7110, -74.0300],           'CHAPINERO': [4.6400, -74.0620],
        'SANTA_FE': [4.6097, -74.0730],          'SAN_CRISTOBAL': [4.5700, -74.0800],
        'USME': [4.5100, -74.1300],              'TUNJUELITO': [4.5800, -74.1400],
        'BOSA': [4.6200, -74.1900],              'KENNEDY': [4.6280, -74.1550],
        'FONTIBON': [4.6800, -74.1400],          'ENGATIVA': [4.7000, -74.1100],
        'SUBA': [4.7500, -74.0800],              'BARRIOS_UNIDOS': [4.6700, -74.0850],
        'TEUSAQUILLO': [4.6400, -74.0900],       'MARTIRES': [4.6000, -74.0950],
        'ANTONIO_NARINO': [4.5900, -74.1100],    'PUENTE_ARANDA': [4.6200, -74.1200],
        'CANDELARIA': [4.5970, -74.0730],        'RAFAEL_URIBE_URIBE': [4.5600, -74.1200],
        'CIUDAD_BOLIVAR': [4.5700, -74.1800],    'SUMAPAZ': [4.2600, -74.2900],
    };

    // ── Icono del marcador (estilo pin de apps modernas) ────────────────────
    const iconoSede = L.divIcon({
        className: '',
        html: `<div style="
            width:34px;height:34px;
            background:linear-gradient(135deg,#1e3a8a,#1d4ed8);
            border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);
            border:3px solid #fff;
            box-shadow:0 4px 16px rgba(30,58,138,.5);
            position:relative;
        ">
            <div style="
                width:9px;height:9px;
                background:#fff;border-radius:50%;
                position:absolute;top:50%;left:50%;
                transform:translate(-50%,-50%) rotate(45deg);
            "></div>
        </div>`,
        iconSize:   [34, 34],
        iconAnchor: [17, 34],
        popupAnchor:[0, -38]
    });

    // ── Icono de arrastre (feedback al usuario) ──────────────────────────────
    const iconoSedeDrag = L.divIcon({
        className: '',
        html: `<div style="
            width:34px;height:34px;
            background:linear-gradient(135deg,#0f766e,#0d9488);
            border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);
            border:3px solid #fff;
            box-shadow:0 4px 20px rgba(15,118,110,.6);
            position:relative;
            transition:all .2s;
        ">
            <div style="
                width:9px;height:9px;
                background:#fff;border-radius:50%;
                position:absolute;top:50%;left:50%;
                transform:translate(-50%,-50%) rotate(45deg);
            "></div>
        </div>`,
        iconSize:   [34, 34],
        iconAnchor: [17, 34],
        popupAnchor:[0, -38]
    });

    // =========================================================
    // INICIALIZACIÓN DEL MAPA
    // =========================================================
    function initMapaRegistro() {
        if (mapaRegistro) return;

        mapaRegistro = L.map('mapaRegistro', {
            zoomControl:        true,
            attributionControl: true,
            scrollWheelZoom:    true
        }).setView([4.6533, -74.0836], 12);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19
        }).addTo(mapaRegistro);

        // Click en el mapa → mover marcador + reverse geocoding
        mapaRegistro.on('click', function (e) {
            colocarMarcador(e.latlng.lat, e.latlng.lng, true);
        });
    }

    // =========================================================
    // COLOCAR / MOVER MARCADOR
    // =========================================================
    function colocarMarcador(lat, lon, hacerReverseGeo) {
        if (!mapaRegistro) return;
        const latlng = L.latLng(lat, lon);

        if (marcadorRegistro) {
            marcadorRegistro.setLatLng(latlng);
        } else {
            marcadorRegistro = L.marker(latlng, {
                draggable: true,
                icon:      iconoSede,
                title:     'Arrastrá para ajustar la posición exacta'
            }).addTo(mapaRegistro);

            // Popup con instrucción
            marcadorRegistro.bindPopup(`
                <div style="font-family:'Plus Jakarta Sans',system-ui,sans-serif;font-size:.8rem;text-align:center;padding:.25rem .125rem;">
                    <strong style="color:#1e3a8a;display:block;margin-bottom:.2rem;">📍 Sede</strong>
                    <span style="color:#64748b;">Arrastrá para ajustar</span>
                </div>
            `).openPopup();

            // Drag → cambiar icono a verde + mostrar coordenadas
            marcadorRegistro.on('drag', function (e) {
                marcadorRegistro.setIcon(iconoSedeDrag);
                const pos = e.target.getLatLng();
                setMapStatus(
                    `${ICONS.pin} ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`,
                    'dragging'
                );
            });

            // Dragend → restaurar icono + guardar + reverse geo
            marcadorRegistro.on('dragend', function (e) {
                marcadorRegistro.setIcon(iconoSede);
                const pos = e.target.getLatLng();
                guardarCoordenadas(pos.lat, pos.lng);
                reverseGeocodificar(pos.lat, pos.lng);
            });
        }

        mapaRegistro.setView(latlng, 17, { animate: true });
        guardarCoordenadas(lat, lon);
        marcarUbicacionConfirmada();

        if (hacerReverseGeo) reverseGeocodificar(lat, lon);
    }

    // =========================================================
    // GUARDAR COORDENADAS EN HIDDEN INPUTS
    // =========================================================
    function guardarCoordenadas(lat, lon) {
        const elLat = document.getElementById('hiddenLatitud');
        const elLon = document.getElementById('hiddenLongitud');
        if (elLat) elLat.value = parseFloat(lat).toFixed(7);
        if (elLon) elLon.value = parseFloat(lon).toFixed(7);
    }

    // =========================================================
    // BADGE DE CONFIRMACIÓN
    // =========================================================
    function marcarUbicacionConfirmada() {
        ubicacionConfirmada = true;
        setMapStatus('Ubicación confirmada — arrastrá el pin para ajustar', 'ok');

        const badge = document.getElementById('ubicacionBadge');
        if (badge) {
            badge.style.display    = 'flex';
            badge.style.background = '#f0fdf4';
            badge.style.border     = '1.5px solid #86efac';
            badge.style.color      = '#166534';
            badge.innerHTML        = `${ICONS.success} Ubicación confirmada — podés continuar`;
        }
    }

    function desconfirmarUbicacion() {
        ubicacionConfirmada = false;
        setMapStatus('Buscá tu dirección o hacé click en el mapa', 'pending');

        const badge = document.getElementById('ubicacionBadge');
        if (badge && badge.style.display !== 'none') {
            badge.style.background = '#fffbeb';
            badge.style.border     = '1.5px solid #fcd34d';
            badge.style.color      = '#92400e';
            badge.innerHTML        = `${ICONS.warning} Dirección modificada — volvé a buscar o ajustá el pin`;
        }
    }

    // =========================================================
    // ESTADO DEL MAPA
    // =========================================================
    function setMapStatus(html, tipo) {
        const el = document.getElementById('mapaRegistroEstado');
        if (!el) return;
        const colores = {
            ok:       '#059669',
            pending:  '#d97706',
            error:    '#dc2626',
            loading:  '#1d4ed8',
            dragging: '#1d4ed8'
        };
        el.innerHTML   = html;
        el.style.color = colores[tipo] || '#64748b';
    }

    // =========================================================
    // NORMALIZACIÓN DE DIRECCIONES
    // =========================================================
    function normalizarDireccion(dir) {
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
            .replace(/\s{2,}/g, ' ').trim();
    }

    // =========================================================
    // GEOCODIFICACIÓN DIRECTA — Nominatim (sin API key)
    // =========================================================
    async function geocodificarDireccion(direccion, localidad, barrio) {
        // Respetar rate limit de 1 req/s
        const ahora = Date.now();
        const espera = 1050 - (ahora - lastNominatimReq);
        if (espera > 0) await new Promise(r => setTimeout(r, espera));
        lastNominatimReq = Date.now();

        const dirNorm      = normalizarDireccion(direccion);
        const localidadFmt = localidad
            ? localidad.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')
            : '';

        const query = [dirNorm, barrio, localidadFmt, 'Bogotá', 'Colombia']
            .filter(Boolean).join(', ');

        const params = new URLSearchParams({
            q:                 query,
            format:            'json',
            limit:             '5',
            countrycode:       'co',
            viewbox:           '-74.25,4.45,-73.95,4.85',
            bounded:           '1',
            'accept-language': 'es'
        });

        const resp = await fetch(
            `https://nominatim.openstreetmap.org/search?${params}`,
            { headers: { 'User-Agent': 'AparcaYA/1.0 (registro sede Bogota)' } }
        );

        if (!resp.ok) throw new Error(`Nominatim HTTP ${resp.status}`);
        return await resp.json();
    }

    function _inferirLocalidadBarrio(addr, idLocalidad, idBarrio, barrios_por_localidad) {
        if (!addr) return;

        var localidadSelect = document.getElementById(idLocalidad);
        var barrioSelect    = document.getElementById(idBarrio);
        if (!localidadSelect || !barrioSelect) return;

        // ── Inferir localidad ──────────────────────────────────────
        // Nominatim puede traerla en city_district, suburb o quarter
        var candidatosLoc = [
            addr.city_district,
            addr.suburb,
            addr.quarter,
            addr.neighbourhood
        ].filter(Boolean);

        var localidadValue = null;
        for (var i = 0; i < candidatosLoc.length; i++) {
            var clave = candidatosLoc[i].toLowerCase().trim();
            if (_GEO_AUTOFILL.LOCALIDADES[clave]) {
                localidadValue = _GEO_AUTOFILL.LOCALIDADES[clave];
                break;
            }
        }

        if (!localidadValue) return; // no se pudo inferir — no tocar los selects

        // Setear localidad si existe como option
        var optionExiste = Array.from(localidadSelect.options)
            .some(function(o) { return o.value === localidadValue; });
        if (!optionExiste) return;

        localidadSelect.value = localidadValue;

        // Disparar change para poblar el select de barrios
        _poblarBarrioSelect(localidadValue, idBarrio, barrios_por_localidad);

        // ── Inferir barrio ─────────────────────────────────────────
        // Nominatim puede traerlo en neighbourhood, quarter o suburb
        var candidatosBar = [
            addr.neighbourhood,
            addr.quarter,
            addr.suburb
        ].filter(Boolean);

        var barrioTexto = null;
        for (var j = 0; j < candidatosBar.length; j++) {
            var bc = candidatosBar[j].toLowerCase().trim();
            if (_GEO_AUTOFILL.BARRIOS[bc]) {
                barrioTexto = _GEO_AUTOFILL.BARRIOS[bc];
                break;
            }
            // Si no hay match exacto, usar el valor crudo capitalizado
            if (!barrioTexto) {
                barrioTexto = candidatosBar[j].trim();
            }
        }

        if (!barrioTexto) return;

        // Buscar el barrio en las options (match exacto o parcial)
        var optBarrio = Array.from(barrioSelect.options).find(function(o) {
            return o.value.toLowerCase() === barrioTexto.toLowerCase() ||
                o.textContent.toLowerCase() === barrioTexto.toLowerCase();
        });

        // Si no hay match exacto intentar match parcial
        if (!optBarrio) {
            var barTextoLow = barrioTexto.toLowerCase();
            optBarrio = Array.from(barrioSelect.options).find(function(o) {
                return o.value.toLowerCase().includes(barTextoLow) ||
                    barTextoLow.includes(o.value.toLowerCase());
            });
        }

        if (optBarrio) {
            barrioSelect.value = optBarrio.value;
        }
    }


// ============================================================
// 3. POBLAR SELECT DE BARRIOS
//    Rellena el <select> de barrio con los barrios de la
//    localidad detectada, usando el mapa de barrios del JS.
// ============================================================
    function _poblarBarrioSelect(localidadValue, idBarrio, barrios_por_localidad) {
        var barrioSelect = document.getElementById(idBarrio);
        if (!barrioSelect || !barrios_por_localidad) return;

        var lista = barrios_por_localidad[localidadValue] || [];
        barrioSelect.innerHTML = '<option value="">Selecciona un barrio</option>';
        lista.forEach(function(b) {
            var opt = document.createElement('option');
            opt.value = b; opt.textContent = b;
            barrioSelect.appendChild(opt);
        });
    }

    // =========================================================
    // REVERSE GEOCODIFICACIÓN — coordenadas → dirección
    // =========================================================
    async function reverseGeocodificar(lat, lon) {
        setMapStatus(`${ICONS.spinner} Obteniendo dirección...`, 'loading');

        const ahora  = Date.now();
        const espera = 1050 - (ahora - lastNominatimReq);
        if (espera > 0) await new Promise(r => setTimeout(r, espera));
        lastNominatimReq = Date.now();

        try {
            const params = new URLSearchParams({
                lat:               lat.toString(),
                lon:               lon.toString(),
                format:            'json',
                zoom:              '18',
                'accept-language': 'es'
            });

            const resp = await fetch(
                `https://nominatim.openstreetmap.org/reverse?${params}`,
                { headers: { 'User-Agent': 'AparcaYA/1.0 (registro sede Bogota)' } }
            );
            const data = await resp.json();

            if (data && data.display_name) {
                const addr = data.address || {};

                // ── FIX GPS: solo calle + número en el campo dirección ─
                const partes = [
                    addr.road,
                    addr.house_number
                ].filter(Boolean);

                const dirLegible = partes.length > 0
                    ? partes.join(' ')
                    : data.display_name.split(',')[0].trim();

                const campoDireccion = document.getElementById('direccion');
                if (campoDireccion && dirLegible) {
                    campoDireccion.value = dirLegible;
                    const hDir = document.getElementById('hiddenDireccion');
                    if (hDir) hDir.value = dirLegible;
                }

                // ── NUEVO: autorellenar localidad y barrio ─────────────
                _inferirLocalidadBarrio(
                    addr,
                    'localidad',          // ID select localidad en registro
                    'barrio',             // ID select barrio en registro
                    localidadesBarrios    // objeto ya definido en Registro.js
                );
            }

            setMapStatus('Ubicación confirmada — arrastrá el pin para ajustar', 'ok');
            marcarUbicacionConfirmada();

        } catch (err) {
            console.warn('Reverse geocoding falló:', err);
            setMapStatus('Pin colocado — podés continuar', 'ok');
            marcarUbicacionConfirmada();
        }
    }

    // =========================================================
    // AUTOCOMPLETADO INTELIGENTE (debounce 600ms)
    // =========================================================
    function iniciarAutocompletado() {
        const inputDir = document.getElementById('direccion');
        const dropdown = document.getElementById('autocompletadoDropdown');
        if (!inputDir || !dropdown) return;

        inputDir.addEventListener('input', function () {
            clearTimeout(autocompDebounce);
            const val = this.value.trim();

            ocultarDropdown();
            desconfirmarUbicacion();

            if (val.length < 5) return;

            setDropdownCargando(dropdown);

            autocompDebounce = setTimeout(async () => {
                const localidad = document.getElementById('localidad').value;
                const barrio    = document.getElementById('barrio').value;
                try {
                    const resultados = await geocodificarDireccion(val, localidad, barrio);
                    mostrarSugerencias(resultados, dropdown, localidad, barrio);
                } catch (err) {
                    console.warn('Autocompletado falló:', err);
                    ocultarDropdown();
                }
            }, 600);
        });

        // Cerrar al hacer click fuera
        document.addEventListener('click', function (e) {
            if (!inputDir.contains(e.target) && !dropdown.contains(e.target))
                ocultarDropdown();
        });

        // Navegación con teclado
        inputDir.addEventListener('keydown', function (e) {
            const items  = dropdown.querySelectorAll('.autocomp-item');
            const activo = dropdown.querySelector('.autocomp-item.activo');
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
                    if (activo.previousElementSibling)
                        activo.previousElementSibling.classList.add('activo');
                }
            } else if (e.key === 'Enter' && activo) {
                e.preventDefault();
                activo.click();
            } else if (e.key === 'Escape') {
                ocultarDropdown();
            }
        });
    }

    function setDropdownCargando(dropdown) {
        dropdown.style.display = 'block';
        dropdown.innerHTML = `
            <div style="padding:.75rem 1rem;color:#64748b;font-size:.8125rem;
                        display:flex;align-items:center;gap:.5rem;
                        font-family:'Plus Jakarta Sans',system-ui,sans-serif;">
                ${ICONS.spinner}
                Buscando direcciones en Bogotá...
            </div>`;
    }

    function mostrarSugerencias(resultados, dropdown, localidad, barrio) {
        const centroide = (barrio    && CENTROIDES_BARRIOS[barrio])
            || (localidad && CENTROIDES_LOCALIDADES[localidad])
            || [4.6533, -74.0836];

        // Filtrar resultados dentro de Bogotá
        const dentroRango = resultados.filter(r => {
            const lat = parseFloat(r.lat);
            const lon = parseFloat(r.lon);
            return lat >= 4.45 && lat <= 4.85 && lon >= -74.25 && lon <= -73.95;
        });

        // Ordenar por proximidad al centroide del barrio/localidad
        dentroRango.sort((a, b) => {
            const dA = Math.hypot(parseFloat(a.lat) - centroide[0], parseFloat(a.lon) - centroide[1]);
            const dB = Math.hypot(parseFloat(b.lat) - centroide[0], parseFloat(b.lon) - centroide[1]);
            return dA - dB;
        });

        if (dentroRango.length === 0) {
            dropdown.innerHTML = `
                <div style="padding:.875rem 1rem;font-family:'Plus Jakarta Sans',system-ui,sans-serif;">
                    <div style="display:flex;align-items:center;gap:.5rem;color:#d97706;font-size:.8125rem;font-weight:600;margin-bottom:.375rem;">
                        ${ICONS.warning} Sin resultados en Bogotá
                    </div>
                    <div style="color:#64748b;font-size:.8rem;line-height:1.5;">
                        Intentá con otra variante o hacé click directamente en el mapa.
                    </div>
                </div>`;
            dropdown.style.display = 'block';
            return;
        }

        dropdown.innerHTML = '';

        // Encabezado del dropdown
        const header = document.createElement('div');
        header.style.cssText = 'padding:.5rem 1rem;font-size:.7rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #f1f5f9;font-family:"Plus Jakarta Sans",system-ui,sans-serif;';
        header.innerHTML = `${ICONS.pin} Sugerencias para Bogotá`;
        dropdown.appendChild(header);

        dentroRango.slice(0, 5).forEach((r) => {
            const item = document.createElement('div');
            item.className = 'autocomp-item';
            item.setAttribute('role', 'option');
            item.setAttribute('tabindex', '0');

            const addr   = r.address || {};
            const titulo = [addr.road, addr.house_number].filter(Boolean).join(' ')
                || r.display_name.split(',')[0];
            const sub    = [
                addr.suburb || addr.neighbourhood || addr.quarter,
                addr.city_district || addr.county,
                'Bogotá'
            ].filter(Boolean).slice(0, 2).join(', ');

            const inner = document.createElement('div');
            inner.style.cssText = 'display:flex;align-items:flex-start;gap:.625rem;padding:.75rem 1rem;cursor:pointer;border-bottom:1px solid #f8faff;transition:background .15s ease;font-family:"Plus Jakarta Sans",system-ui,sans-serif;';
            inner.innerHTML = `
                <div style="width:30px;height:30px;background:#eff6ff;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:.05rem;">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                         stroke="#1d4ed8" stroke-width="2" stroke-linecap="round"
                         stroke-linejoin="round" style="width:14px;height:14px;">
                        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
                        <circle cx="12" cy="10" r="3"/>
                    </svg>
                </div>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:.875rem;font-weight:600;color:#1e3a8a;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${titulo}</div>
                    <div style="font-size:.75rem;color:#64748b;margin-top:.15rem;">${sub}</div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                     stroke="#cbd5e1" stroke-width="2" stroke-linecap="round"
                     stroke-linejoin="round" style="width:14px;height:14px;flex-shrink:0;margin-top:.25rem;">
                    <path d="M9 18l6-6-6-6"/>
                </svg>`;

            item.appendChild(inner);

            item.addEventListener('mouseenter', () => {
                dropdown.querySelectorAll('.autocomp-item').forEach(el => el.classList.remove('activo'));
                item.classList.add('activo');
                inner.style.background = '#eff6ff';
            });
            item.addEventListener('mouseleave', () => {
                inner.style.background = '';
            });

            item.addEventListener('click', () => {
                const lat = parseFloat(r.lat);
                const lon = parseFloat(r.lon);

                document.getElementById('direccion').value = titulo;
                ocultarDropdown();
                initMapaRegistro();
                setTimeout(() => { mapaRegistro.invalidateSize(); }, 50);
                colocarMarcador(lat, lon, false);
                marcarUbicacionConfirmada();
                showToast('Ubicación seleccionada. Arrastrá el pin para ajustar si es necesario.', 'success', 3000);
            });

            dropdown.appendChild(item);
        });

        // Pie del dropdown
        const footer = document.createElement('div');
        footer.style.cssText = 'padding:.5rem 1rem;font-size:.7rem;color:#94a3b8;text-align:center;border-top:1px solid #f1f5f9;font-family:"Plus Jakarta Sans",system-ui,sans-serif;';
        footer.innerHTML = '© OpenStreetMap contributors';
        dropdown.appendChild(footer);

        dropdown.style.display = 'block';
    }

    function ocultarDropdown() {
        const dropdown = document.getElementById('autocompletadoDropdown');
        if (dropdown) { dropdown.style.display = 'none'; dropdown.innerHTML = ''; }
    }

    // =========================================================
    // BOTÓN GPS
    // =========================================================
    function iniciarBotonGPS() {
        const btn = document.getElementById('btnUsarUbicacion');
        if (!btn) return;

        btn.addEventListener('click', function () {
            if (!navigator.geolocation) {
                showToast('Tu navegador no soporta geolocalización.', 'warning');
                return;
            }

            btn.disabled  = true;
            btn.innerHTML = `${ICONS.spinner} Obteniendo ubicación...`;

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    btn.disabled  = false;
                    btn.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                             stroke="currentColor" stroke-width="2" stroke-linecap="round"
                             stroke-linejoin="round" style="width:15px;height:15px;flex-shrink:0;">
                            <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                        </svg>
                        Usar mi ubicación actual (GPS)`;

                    const lat = pos.coords.latitude;
                    const lon = pos.coords.longitude;

                    if (lat < 4.45 || lat > 4.85 || lon < -74.25 || lon > -73.95) {
                        showToast('Tu ubicación no está en Bogotá. Buscá la dirección manualmente.', 'warning');
                        return;
                    }

                    initMapaRegistro();
                    setTimeout(() => { mapaRegistro.invalidateSize(); }, 50);
                    colocarMarcador(lat, lon, true);
                    showToast('Ubicación GPS obtenida. Arrastrá el pin si necesitás ajustar.', 'success');
                },
                (err) => {
                    btn.disabled  = false;
                    btn.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                             stroke="currentColor" stroke-width="2" stroke-linecap="round"
                             stroke-linejoin="round" style="width:15px;height:15px;flex-shrink:0;">
                            <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                        </svg>
                        Usar mi ubicación actual (GPS)`;
                    const msgs = {
                        1: 'Permiso denegado. Activá la geolocalización en tu navegador.',
                        2: 'No se pudo obtener tu posición.',
                        3: 'Tiempo de espera agotado.'
                    };
                    showToast(msgs[err.code] || 'Error de geolocalización.', 'warning');
                },
                { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true }
            );
        });
    }

    // =========================================================
    // INICIALIZAR SISTEMA DE MAPA (se llama al entrar al paso 3)
    // =========================================================
    function inicializarSistemaMapa() {
        if (sistemaMapaIniciado) return;
        sistemaMapaIniciado = true;

        iniciarAutocompletado();
        iniciarBotonGPS();

        // Cambio de localidad → centrar mapa + resetear confirmación
        if (localidadSelect) {
            localidadSelect.addEventListener('change', () => {
                if (mapaRegistro) {
                    const c = CENTROIDES_LOCALIDADES[localidadSelect.value] || [4.6533, -74.0836];
                    mapaRegistro.setView(c, 13, { animate: true });
                }
                desconfirmarUbicacion();
            });
        }

        // Cambio de barrio → centrar mapa en el barrio
        if (barrioSelect) {
            barrioSelect.addEventListener('change', () => {
                if (mapaRegistro) {
                    const bar = barrioSelect.value;
                    const loc = localidadSelect.value;
                    const c   = CENTROIDES_BARRIOS[bar] || CENTROIDES_LOCALIDADES[loc] || [4.6533, -74.0836];
                    mapaRegistro.setView(c, 15, { animate: true });
                }
                desconfirmarUbicacion();
            });
        }
    }

    // =========================================================
    // BLUR GENÉRICO
    // =========================================================
    const conCheckBackend = ['correo', 'cedula', 'telefono', 'nit'];
    document.querySelectorAll("input, select").forEach(field => {
        if (!conCheckBackend.includes(field.id)) {
            field.addEventListener("blur", () => validateField(field.id));
        }
    });

    // =========================================================
    // NAVEGACIÓN ENTRE PASOS
    // =========================================================

    // Paso 1
    document.getElementById("next1").addEventListener('click', async function () {
        if (!validateStep("step1")) {
            showAlert("Revisa los campos marcados en rojo antes de continuar.");
            return;
        }
        const btn = this;
        setBtnLoading(btn, true);
        const disponible = await verificarPaso1ConBackend();
        setBtnLoading(btn, false, 'Siguiente');
        if (!disponible) return;

        rolBloqueado = true;
        document.getElementById("btnCliente").disabled = true;
        document.getElementById("btnSede").disabled    = true;
        if (rol === "CLIENTE") showStep("stepCliente");
        else                   showStep("stepSede2");
    });

    // Cliente
    document.getElementById("backCliente").onclick = () => showStep("step1");
    document.getElementById("nextCliente").onclick = () => {
        if (validateStep("stepCliente")) showStep("stepFinal");
        else showAlert("Revisa los datos del vehículo antes de continuar.");
    };

    // Sede — paso 2
    document.getElementById("backSede2").onclick = () => showStep("step1");
    document.getElementById("nextSede2").onclick = () => {
        if (validateStep("stepSede2")) {
            document.getElementById("hiddenNombreSede").value = document.getElementById("nombreSede").value;
            document.getElementById("hiddenNit").value        = document.getElementById("nit").value;
            showStep("stepSede3");
            // Inicializar mapa y sistema al entrar al paso 3
            setTimeout(() => {
                inicializarSistemaMapa();
                initMapaRegistro();
                mapaRegistro.invalidateSize();
            }, 200);
        } else {
            showAlert("Revisa los datos básicos de la sede antes de continuar.");
        }
    };

    // Sede — paso 3 (con validación de coordenadas)
    document.getElementById("backSede3").onclick = () => showStep("stepSede2");

    document.getElementById("nextSede3").addEventListener('click', function () {
        if (!validateStep("stepSede3")) {
            showAlert("Revisa la ubicación de la sede antes de continuar.");
            return;
        }

        // ✅ VALIDACIÓN CRÍTICA: coordenadas obligatorias
        const latVal = document.getElementById('hiddenLatitud').value;
        const lonVal = document.getElementById('hiddenLongitud').value;

        if (!latVal || !lonVal || latVal === '' || lonVal === '') {
            showAlert(
                "Debés confirmar la ubicación en el mapa antes de continuar. " +
                "Escribí la dirección y seleccioná una sugerencia, " +
                "o hacé click directamente en el mapa.",
                'warning'
            );
            document.getElementById('mapaRegistroWrapper')
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        // Validar rango geográfico Bogotá
        const lat = parseFloat(latVal);
        const lon = parseFloat(lonVal);
        if (lat < 4.45 || lat > 4.85 || lon < -74.25 || lon > -73.95) {
            showAlert("La ubicación seleccionada está fuera de Bogotá.", 'error');
            return;
        }

        // Sincronizar hiddens
        document.getElementById("hiddenDireccion").value = document.getElementById("direccion").value;
        document.getElementById("hiddenLocalidad").value = document.getElementById("localidad").value;
        document.getElementById("hiddenBarrio").value    = document.getElementById("barrio").value;

        showStep("stepSede4");
    });

    // Sede — paso 4
    document.getElementById("backSede4").onclick = () => {
        showStep("stepSede3");
        setTimeout(() => { if (mapaRegistro) mapaRegistro.invalidateSize(); }, 200);
    };

    document.getElementById("nextSede4").onclick = () => {
        if (validateStep("stepSede4")) {
            document.getElementById("hiddenCuposTotales").value  = document.getElementById("cuposTotales").value;
            document.getElementById("hiddenTarifaPlenaC").value  = document.getElementById("tarifaPlenaC").value;
            document.getElementById("hiddenTarifaPlenaM").value  = document.getElementById("tarifaPlenaM").value;
            document.getElementById("hiddenTarifaMinutoC").value = document.getElementById("tarifaMinutoC").value;
            document.getElementById("hiddenTarifaMinutoM").value = document.getElementById("tarifaMinutoM").value;
            document.getElementById("hiddenHorarioSede").value   = document.getElementById("horarioSede").value;
            showStep("stepFinal");
        } else {
            showAlert("Revisa los detalles operativos antes de continuar.");
        }
    };

    // Paso final — atrás
    document.getElementById("backFinal").onclick = () => {
        if (rol === "CLIENTE") showStep("stepCliente");
        else                   showStep("stepSede4");
    };

    // =========================================================
    // SUBMIT
    // =========================================================
    document.getElementById("registroForm").addEventListener('submit', async function (e) {
        e.preventDefault();

        // Validación barrio para ADMINISTRADOR_SEDE
        if (rol === "ADMINISTRADOR_SEDE") {
            if (localidadSelect.value && !barrioSelect.value) {
                document.getElementById('barrio-error').textContent = 'Debes seleccionar un barrio.';
                showStep("stepSede3");
                showAlert("Debes seleccionar un barrio antes de continuar.", 'warning');
                return;
            }
        }

        limpiarFormulario();

        const btn = this.querySelector('button[type="submit"]');
        if (btn) { btn.disabled = true; btn.textContent = 'Registrando...'; }

        const data = Object.fromEntries(new FormData(this).entries());

        try {
            const res = await fetch('/registrar', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(data)
            });

            const json = await res.json();

            if (json.success && json.token) {
                localStorage.setItem('token',  json.token);
                localStorage.setItem('rol',    json.rol);
                localStorage.setItem('nombre', json.nombre);
                if (json.sedeId) localStorage.setItem('sedeId', String(json.sedeId));
                window.location.href = json.redirectUrl;
            } else {
                showAlert(json.message || 'Error al registrar', 'error');
                if (btn) { btn.disabled = false; btn.textContent = 'Registrar cuenta'; }
            }
        } catch (err) {
            console.error('Error en registro:', err);
            showAlert('Error de conexión. Intenta nuevamente.', 'error');
            if (btn) { btn.disabled = false; btn.textContent = 'Registrar cuenta'; }
        }
    });

});