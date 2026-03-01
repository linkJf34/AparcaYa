/* ================================================
   REGISTRO.JS — AparcaYA
   Ruta: /js/Registro.js

   CAMBIOS APLICADOS:
   ✅ Sistema unificado de notificaciones (showToast + showAlert)
   ✅ Verificación de duplicados contra backend con fetch
   ✅ customValidator para placa y NIT
   ✅ FIX: handler backSede4
   ✅ Mensajes de alerta en navegación entre pasos
   ✅ Blur con check backend solo en campos con endpoints /check/*
   ✅ Verificación correo+cédula+teléfono en paralelo al hacer clic en "Siguiente"
   ✅ Persistencia de datos con sessionStorage
   ✅ NUEVO: Mini-mapa Leaflet en paso 3 de sede con geocodificación OpenCage
             y marcador arrastrable para confirmar ubicación exacta
   ================================================ */
document.addEventListener('DOMContentLoaded', function () {

    let rol = "CLIENTE";
    let rolBloqueado = false;

    const localidadSelect    = document.getElementById('localidad');
    const barrioSelect       = document.getElementById('barrio');
    const tipoVehiculoSelect = document.getElementById('tipoVehiculo');
    const marcaSelect        = document.getElementById('marca');

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
        const iconos = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

        const toast = document.createElement('div');
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'polite');
        toast.style.cssText = [
            palette[tipo] || palette.info,
            'padding:0.75rem 1rem', 'border-radius:0.5rem',
            'box-shadow:0 4px 12px rgba(0,0,0,.1)', 'font-size:0.875rem',
            'display:flex', 'align-items:center', 'gap:0.5rem',
            'max-width:320px', 'transition:opacity 0.3s'
        ].join(';');
        toast.innerHTML = `<span>${iconos[tipo] || ''}</span><span>${mensaje}</span>`;
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
        const iconos = { error: '❌', success: '✅', warning: '⚠️' };

        div.style.cssText = [
            palette[tipo] || palette.error,
            'padding:0.75rem 1rem', 'border-radius:0.5rem',
            'font-size:0.875rem', 'display:flex',
            'align-items:flex-start', 'gap:0.5rem', 'margin-top:1rem'
        ].join(';');
        div.innerHTML = `<span>${iconos[tipo] || ''}</span><span>${mensaje}</span>`;
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
                <svg style="width:1rem;height:1rem;animation:spin 1s linear infinite"
                     xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle style="opacity:.25" cx="12" cy="12" r="10"
                            stroke="currentColor" stroke-width="4"></circle>
                    <path style="opacity:.75" fill="currentColor"
                          d="M4 12a8 8 0 018-8v8z"></path>
                </svg>
                Verificando...
            </span>`;
        } else {
            btn.disabled  = false;
            btn.innerHTML = texto;
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
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(datos));
        } catch (e) {}
    }

    function restaurarFormulario() {
        let datos;
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            datos = JSON.parse(raw);
        } catch (e) { return; }

        if (datos.__rol && datos.__rol !== rol) {
            setRol(datos.__rol);
        }

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
            'GREAT_WALL': 'Great Wall',       'BMW_MOTORRAD': 'BMW Motorrad',
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
                if (field) {
                    field.classList.add("border-red-500");
                    field.classList.remove("border-green-500");
                }
                showToast(data.mensaje, 'error');
                return false;
            } else {
                if (errorSpan)   errorSpan.textContent   = "";
                if (successSpan) successSpan.textContent = data.mensaje + " ✓";
                if (field) {
                    field.classList.remove("border-red-500");
                    field.classList.add("border-green-500");
                }
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

        if (!resCorreo.disponible) {
            const span = document.getElementById("correo-error");
            const suc  = document.getElementById("correo-success");
            const inp  = document.getElementById("correo");
            if (span) span.textContent = resCorreo.mensaje;
            if (suc)  suc.textContent  = "";
            if (inp)  { inp.classList.add("border-red-500"); inp.classList.remove("border-green-500"); }
            showToast(resCorreo.mensaje, 'error');
            todosDisponibles = false;
        }

        if (!resCedula.disponible) {
            const span = document.getElementById("cedula-error");
            const suc  = document.getElementById("cedula-success");
            const inp  = document.getElementById("cedula");
            if (span) span.textContent = resCedula.mensaje;
            if (suc)  suc.textContent  = "";
            if (inp)  { inp.classList.add("border-red-500"); inp.classList.remove("border-green-500"); }
            showToast(resCedula.mensaje, 'error');
            todosDisponibles = false;
        }

        if (!resTelefono.disponible) {
            const span = document.getElementById("telefono-error");
            const suc  = document.getElementById("telefono-success");
            const inp  = document.getElementById("telefono");
            if (span) span.textContent = resTelefono.mensaje;
            if (suc)  suc.textContent  = "";
            if (inp)  { inp.classList.add("border-red-500"); inp.classList.remove("border-green-500"); }
            showToast(resTelefono.mensaje, 'error');
            todosDisponibles = false;
        }

        if (!todosDisponibles) {
            showAlert("Algunos datos ya están registrados. Corrígelos antes de continuar.", 'error');
        }

        return todosDisponibles;
    }

    document.getElementById("correo").addEventListener('blur', async function () {
        const formatOk = validateField("correo", v => {
            if (!v.includes("@")) return { isValid: false, message: "El correo debe contener '@'." };
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { isValid: false, message: "Formato de correo inválido." };
            return { isValid: true };
        });
        if (formatOk && this.value.trim()) await checkDisponibilidad('/check/correo', this.value, 'correo');
    });

    document.getElementById("cedula").addEventListener('blur', async function () {
        const formatOk = validateField("cedula", v => {
            if (!/^[0-9]{10}$/.test(v)) return { isValid: false, message: "Debe tener exactamente 10 dígitos numéricos." };
            return { isValid: true };
        });
        if (formatOk && this.value.trim()) await checkDisponibilidad('/check/cedula', this.value, 'cedula');
    });

    document.getElementById("telefono").addEventListener('blur', async function () {
        const formatOk = validateField("telefono", v => {
            if (!/^[0-9]{10}$/.test(v)) return { isValid: false, message: "Debe tener exactamente 10 dígitos numéricos." };
            return { isValid: true };
        });
        if (formatOk && this.value.trim()) await checkDisponibilidad('/check/telefono', this.value, 'telefono');
    });

    document.getElementById("nit").addEventListener('blur', async function () {
        const formatOk = validateField("nit", v => {
            if (!/^[0-9]{9}-[0-9]$/.test(v)) return { isValid: false, message: "Formato de NIT inválido (ej. 123456789-0)." };
            return { isValid: true };
        });
        if (formatOk && this.value.trim()) await checkDisponibilidad('/check/nit', this.value, 'nit');
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
    // ✅ NUEVO: MINI-MAPA LEAFLET — PASO 3 SEDE
    // =========================================================

    let mapaRegistro     = null;
    let marcadorRegistro = null;

    const OPENCAGE_KEY = '972b38cb8f6f43fc9203ecda67200ebd';

    // Centroides por barrio — para elegir el resultado más cercano de OpenCage
    const CENTROIDES_BARRIOS = {
        'Barrancas': [4.7348, -74.0258],       'Cedritos': [4.7190, -74.0355],
        'Santa Bárbara': [4.7020, -74.0391],   'Usaquén': [4.7050, -74.0350],
        'La Calleja': [4.7150, -74.0310],       'Molinos Norte': [4.7080, -74.0280],
        'Chicó': [4.6737, -74.0517],            'El Lago': [4.6620, -74.0560],
        'Rosales': [4.6597, -74.0482],          'Chapinero Alto': [4.6400, -74.0620],
        'Antiguo Country': [4.6716, -74.0573],  'Niza': [4.7298, -74.0632],
        'Tibabuyes': [4.7451, -74.0785],        'Suba Centro': [4.7415, -74.0816],
        'La Campiña': [4.7350, -74.0700],       'Ferias': [4.7024, -74.1113],
        'Boyacá Real': [4.7100, -74.1000],      'Minuto de Dios': [4.7063, -74.1142],
        'La Soledad': [4.6448, -74.0732],       'Quesada': [4.6380, -74.0850],
        'Campín': [4.6460, -74.0920],           '7 de Agosto': [4.6772, -74.0895],
        'Doce de Octubre': [4.6900, -74.0950],  'San Felipe': [4.6720, -74.0830],
        'Tintal': [4.6538, -74.1548],           'Timiza': [4.6251, -74.1489],
        'Carvajal': [4.6145, -74.1392],         'Patio Bonito': [4.6279, -74.1456],
        'Mandalay': [4.6350, -74.1500],         'Capellanía': [4.6900, -74.1400],
        'Fontibón Centro': [4.6800, -74.1450],  'Modelia': [4.6750, -74.1200],
        'Restrepo': [4.6110, -74.1026],         'Meissen': [4.5700, -74.1800],
        'Jerusalén': [4.5600, -74.1900],        'Paraíso': [4.5550, -74.1700],
        'La Catedral': [4.5970, -74.0730],      'Egipto': [4.5960, -74.0680],
        'Las Aguas': [4.6010, -74.0710],        'Bravo Páez': [4.5700, -74.1100],
        'Marruecos': [4.5650, -74.1200],        'Quiroga': [4.5800, -74.1150],
        'Ciudad Montes': [4.6287, -74.1189],    'Parque El Tunal': [4.5800, -74.1300],
        'San Vicente': [4.5750, -74.1350],      'Venecia': [4.5850, -74.1400],
        'Bosa Central': [4.6242, -74.1975],     'Bosa Laureles': [4.6200, -74.2000],
        'El Porvenir': [4.6100, -74.2100],
    };

    const CENTROIDES_LOCALIDADES = {
        'USAQUEN': [4.7110, -74.0300],          'CHAPINERO': [4.6400, -74.0620],
        'SANTA_FE': [4.6097, -74.0730],         'SAN_CRISTOBAL': [4.5700, -74.0800],
        'USME': [4.5100, -74.1300],             'TUNJUELITO': [4.5800, -74.1400],
        'BOSA': [4.6200, -74.1900],             'KENNEDY': [4.6280, -74.1550],
        'FONTIBON': [4.6800, -74.1400],         'ENGATIVA': [4.7000, -74.1100],
        'SUBA': [4.7500, -74.0800],             'BARRIOS_UNIDOS': [4.6700, -74.0850],
        'TEUSAQUILLO': [4.6400, -74.0900],      'MARTIRES': [4.6000, -74.0950],
        'ANTONIO_NARINO': [4.5900, -74.1100],   'PUENTE_ARANDA': [4.6200, -74.1200],
        'CANDELARIA': [4.5970, -74.0730],       'RAFAEL_URIBE_URIBE': [4.5600, -74.1200],
        'CIUDAD_BOLIVAR': [4.5700, -74.1800],   'SUMAPAZ': [4.2600, -74.2900],
    };

    function initMapaRegistro() {
        if (mapaRegistro) return; // ya inicializado
        mapaRegistro = L.map('mapaRegistro', { zoomControl: true })
            .setView([4.6533, -74.0836], 12);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(mapaRegistro);

        // Click en el mapa → mover marcador
        mapaRegistro.on('click', function(e) {
            moverMarcadorRegistro(e.latlng.lat, e.latlng.lng);
        });
    }

    function moverMarcadorRegistro(lat, lon) {
        if (!mapaRegistro) return;
        const latlng = L.latLng(lat, lon);

        if (marcadorRegistro) {
            marcadorRegistro.setLatLng(latlng);
        } else {
            marcadorRegistro = L.marker(latlng, { draggable: true })
                .addTo(mapaRegistro)
                .bindPopup('📍 Ubicación de la sede<br><small>Arrastrá para ajustar</small>')
                .openPopup();

            marcadorRegistro.on('dragend', function(e) {
                const pos = e.target.getLatLng();
                guardarCoordenadas(pos.lat, pos.lng);
            });
        }

        mapaRegistro.setView(latlng, 17);
        guardarCoordenadas(lat, lon);
    }

    function guardarCoordenadas(lat, lon) {
        const latInput = document.getElementById('hiddenLatitud');
        const lonInput = document.getElementById('hiddenLongitud');
        if (latInput) latInput.value = lat;
        if (lonInput) lonInput.value = lon;
    }

    function normalizarDireccion(dir) {
        return dir
            .replace('#', '')
            .replace(/\bKra?\.?\b/gi, 'Carrera')
            .replace(/\bCra\.?\b/gi, 'Carrera')
            .replace(/\bCr\.?\b/gi, 'Carrera')
            .replace(/\bCll\.?\b/gi, 'Calle')
            .replace(/\bCl\.?\b/gi, 'Calle')
            .replace(/\bDg\.?\b/gi, 'Diagonal')
            .replace(/\bTrv?\.?\b/gi, 'Transversal')
            .replace(/\bAv\.?\b/gi, 'Avenida')
            .replace(/\s{2,}/g, ' ').trim();
    }

    async function geocodificarYMostrarMapa() {
        const direccion = document.getElementById('direccion').value.trim();
        const localidad = document.getElementById('localidad').value;
        const barrio    = document.getElementById('barrio').value;

        if (!direccion) return;

        const estado  = document.getElementById('mapaRegistroEstado');
        const wrapper = document.getElementById('mapaRegistroWrapper');

        // Mostrar el mapa
        wrapper.style.display = 'block';
        if (estado) estado.textContent = 'Buscando ubicación...';

        // Inicializar mapa si no existe, luego invalidar tamaño
        initMapaRegistro();
        setTimeout(() => { if (mapaRegistro) mapaRegistro.invalidateSize(); }, 150);

        try {
            const dirNorm      = normalizarDireccion(direccion);
            const localidadFmt = localidad
                ? localidad.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')
                : '';

            const query = [dirNorm, barrio, localidadFmt, 'Bogotá', 'Colombia']
                .filter(Boolean).join(', ');

            const url = `https://api.opencagedata.com/geocode/v1/json` +
                `?q=${encodeURIComponent(query)}` +
                `&key=${OPENCAGE_KEY}` +
                `&limit=5&countrycode=co&no_annotations=1` +
                `&bounds=-74.25,4.45,-73.95,4.85`;

            const resp = await fetch(url);
            const data = await resp.json();

            if (data.results && data.results.length > 0) {
                // Elegir el resultado más cercano al centroide del barrio
                const centroide = CENTROIDES_BARRIOS[barrio]
                    || CENTROIDES_LOCALIDADES[localidad]
                    || [4.6533, -74.0836];

                let mejorLat = null, mejorLon = null, menorDist = Infinity;

                for (const r of data.results) {
                    const lat  = r.geometry.lat;
                    const lon  = r.geometry.lng;
                    const dist = Math.sqrt(
                        Math.pow(lat - centroide[0], 2) + Math.pow(lon - centroide[1], 2)
                    );
                    // Solo considerar resultados dentro de Bogotá
                    if (lat >= 4.45 && lat <= 4.85 && lon >= -74.25 && lon <= -73.95) {
                        if (dist < menorDist) {
                            menorDist = dist;
                            mejorLat  = lat;
                            mejorLon  = lon;
                        }
                    }
                }

                if (mejorLat !== null) {
                    moverMarcadorRegistro(mejorLat, mejorLon);
                    if (estado) estado.textContent = 'Arrastrá el marcador si necesitás ajustar la posición';
                } else {
                    // Sin resultados en Bogotá → centrar en localidad
                    const c = CENTROIDES_LOCALIDADES[localidad] || [4.6533, -74.0836];
                    mapaRegistro.setView(c, 13);
                    if (estado) estado.textContent = 'No se encontró la dirección — hacé click en el mapa para marcarla';
                    showToast('No se encontró la dirección exacta. Marcá la ubicación en el mapa.', 'warning');
                }
            } else {
                const c = CENTROIDES_LOCALIDADES[localidad] || [4.6533, -74.0836];
                mapaRegistro.setView(c, 13);
                if (estado) estado.textContent = 'No se encontró la dirección — hacé click en el mapa para marcarla';
                showToast('No se encontró la dirección exacta. Marcá la ubicación en el mapa.', 'warning');
            }

        } catch (err) {
            console.warn('Error geocodificando:', err);
            const c = CENTROIDES_LOCALIDADES[document.getElementById('localidad').value] || [4.6533, -74.0836];
            if (mapaRegistro) mapaRegistro.setView(c, 13);
            if (estado) estado.textContent = 'Hacé click en el mapa para marcar la ubicación';
        }
    }

    // =========================================================
    // NAVEGACIÓN ENTRE PASOS
    // =========================================================

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
        if (validateStep("stepCliente")) {
            showStep("stepFinal");
        } else {
            showAlert("Revisa los datos del vehículo antes de continuar.");
        }
    };

    // Sede — paso 2
    document.getElementById("backSede2").onclick = () => showStep("step1");
    document.getElementById("nextSede2").onclick = () => {
        if (validateStep("stepSede2")) {
            document.getElementById("hiddenNombreSede").value = document.getElementById("nombreSede").value;
            document.getElementById("hiddenNit").value        = document.getElementById("nit").value;
            showStep("stepSede3");
        } else {
            showAlert("Revisa los datos básicos de la sede antes de continuar.");
        }
    };

    // Sede — paso 3 con mini-mapa
    document.getElementById("backSede3").onclick = () => showStep("stepSede2");
    document.getElementById("nextSede3").addEventListener('click', async function() {
        if (!validateStep("stepSede3")) {
            showAlert("Revisa la ubicación de la sede antes de continuar.");
            return;
        }

        document.getElementById("hiddenDireccion").value = document.getElementById("direccion").value;
        document.getElementById("hiddenLocalidad").value = document.getElementById("localidad").value;
        document.getElementById("hiddenBarrio").value    = document.getElementById("barrio").value;

        // Mostrar spinner en el botón mientras geocodifica
        const btn = this;
        setBtnLoading(btn, true, 'Siguiente');

        await geocodificarYMostrarMapa();

        setBtnLoading(btn, false, 'Siguiente');
        showStep("stepSede4");

        // Invalidar tamaño del mapa después de que el paso sea visible
        setTimeout(() => { if (mapaRegistro) mapaRegistro.invalidateSize(); }, 200);
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
    // BLUR GENÉRICO
    // =========================================================
    const conCheckBackend = ['correo', 'cedula', 'telefono', 'nit'];
    document.querySelectorAll("input, select").forEach(field => {
        if (!conCheckBackend.includes(field.id)) {
            field.addEventListener("blur", () => validateField(field.id));
        }
    });

    // =========================================================
    // SUBMIT
    // =========================================================
    document.getElementById("registroForm").onsubmit = function (e) {
        if (rol === "ADMINISTRADOR_SEDE") {
            const selectedLocalidad = localidadSelect.value;
            const selectedBarrio    = barrioSelect.value;
            if (selectedLocalidad && !selectedBarrio) {
                e.preventDefault();
                document.getElementById('barrio-error').textContent = 'Debes seleccionar un barrio.';
                showStep("stepSede3");
                showAlert("Debes seleccionar un barrio antes de continuar.", 'warning');
                return false;
            }
        }
        limpiarFormulario();
    };

});