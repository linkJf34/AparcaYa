document.addEventListener('DOMContentLoaded', function() {
        /// Variables y selección de elementos
        let rol = "CLIENTE";
        let rolBloqueado = false;  // Flag para bloquear cambio de rol después del primer paso

        const localidadSelect = document.getElementById('localidad');
        const barrioSelect = document.getElementById('barrio');
        const tipoVehiculoSelect = document.getElementById('tipoVehiculo');
        const marcaSelect = document.getElementById('marca');

        // Datos para marcas dinámicas según tipo de vehículo
        const marcasPorTipo = {
            CARRO: [
                "RENAULT", "KIA", "TOYOTA", "CHEVROLET", "MAZDA", "NISSAN", "VOLKSWAGEN",
                "FORD", "HYUNDAI", "BMW", "MERCEDES_BENZ", "AUDI", "PEUGEOT", "CITROEN",
                "FIAT", "VOLVO", "JEEP", "LAND_ROVER", "PORSCHE", "FERRARI", "LAMBORGHINI",
                "TESLA", "BYD", "CHANGAN", "GEELY", "JAC", "CHERY", "GREAT_WALL", "HAVAL",
                "GWM", "MITSUBISHI", "SUBARU", "ISUZU", "SSANGYONG", "MG", "RAM", "DFSK",
                "FOTON", "OTRO"
            ],
            MOTO: [
                "HONDA", "YAMAHA", "SUZUKI", "KAWASAKI", "BAJAJ", "TVS", "HERO", "KTM",
                "DUCATI", "HARLEY_DAVIDSON", "BMW_MOTORRAD", "TRIUMPH", "ROYAL_ENFIELD",
                "AUTECO", "AKT", "VICTORY", "APRILIA", "BENELLI", "HUSQVARNA", "OTRO"
            ],
            BICICLETA: [
                "TREK", "SPECIALIZED", "GIANT", "SCOTT", "CANNONDALE", "ORBEA", "GW",
                "SHIMANO", "BIANCHI", "MERIDA", "CUBE", "BMC", "FOCUS", "OTRO"
            ],
            OTRO: ["OTRO"]
        };

        // Función para formatear nombres de marcas
        function formatMarcaName(marca) {
            const formatMap = {
                'MERCEDES_BENZ': 'Mercedes-Benz',
                'LAND_ROVER': 'Land Rover',
                'GREAT_WALL': 'Great Wall',
                'BMW_MOTORRAD': 'BMW Motorrad',
                'HARLEY_DAVIDSON': 'Harley-Davidson',
                'ROYAL_ENFIELD': 'Royal Enfield'
            };

            if (formatMap[marca]) return formatMap[marca];

            return marca.split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
        }

        // Actualizar marcas según tipo de vehículo
        function updateMarcas() {
            const selectedTipo = tipoVehiculoSelect.value;
            marcaSelect.innerHTML = '<option value="">Selecciona una marca</option>';

            if (selectedTipo && marcasPorTipo[selectedTipo]) {
                marcasPorTipo[selectedTipo].forEach(marca => {
                    const option = document.createElement('option');
                    option.value = marca;
                    option.textContent = formatMarcaName(marca);
                    marcaSelect.appendChild(option);
                });
            }
        }

        // Escuchar cambios en tipo de vehículo
        tipoVehiculoSelect.addEventListener('change', updateMarcas);

        // Datos para barrios dinámicos según localidad
        const localidadesBarrios = {
            USAQUEN: ["Santa Bárbara", "Cedritos", "Usaquén", "La Calleja", "Molinos Norte", "Barrancas"],

            CHAPINERO: ["Chicó", "El Lago", "Rosales", "Chapinero Alto", "Antiguo Country"],

            SANTA_FE: ["Las Aguas", "La Perseverancia", "San Diego"],

            SAN_CRISTOBAL: ["San Cristóbal Norte", "San Blas", "La Victoria"],

            USME: ["Usme Pueblo", "Yomasa", "El Virrey"],

            TUNJUELITO: ["Parque El Tunal", "San Vicente", "Venecia"],

            BOSA: ["Bosa Central", "Bosa Laureles", "El Porvenir"],

            KENNEDY: ["Tintal", "Timiza", "Mandalay", "Carvajal", "Patio Bonito"],

            FONTIBON: ["Capellanía", "Fontibón Centro", "Modelia"],

            ENGATIVA: ["Ferias", "Boyacá Real", "Minuto de Dios"],

            SUBA: ["Tibabuyes", "Niza", "Suba Centro", "La Campiña"],

            BARRIOS_UNIDOS: ["7 de Agosto", "Doce de Octubre", "San Felipe"],

            TEUSAQUILLO: ["La Soledad", "Quesada", "Campín"],

            MARTIRES: ["Santa Isabel", "Eduardo Santos"],

            ANTONIO_NARINO: ["Restrepo", "Eduardo Santos", "Policarpa"],

            PUENTE_ARANDA: ["Ciudad Montes", "Torremolinos", "Salazar Gómez"],

            CANDELARIA: ["La Catedral", "Egipto", "Las Aguas"],

            RAFAEL_URIBE_URIBE: ["Bravo Páez", "Marruecos", "Quiroga"],

            CIUDAD_BOLIVAR: ["Meissen", "Jerusalén", "Paraíso"],

            SUMAPAZ: ["Nazareth", "Betania"]
        };

        // Actualizar barrios según localidad seleccionada
        function updateBarrios() {
            const selectedLocalidad = localidadSelect.value;
            barrioSelect.innerHTML = '<option value="">Selecciona un barrio</option>';

            if (selectedLocalidad && localidadesBarrios[selectedLocalidad]) {
                localidadesBarrios[selectedLocalidad].forEach(barrio => {
                    const option = document.createElement('option');
                    option.value = barrio;
                    option.textContent = barrio;
                    barrioSelect.appendChild(option);
                });
            } else {
                barrioSelect.innerHTML = '<option value="">Primero selecciona localidad</option>';
            }
        }

        localidadSelect.addEventListener('change', updateBarrios);

        // Botones rol - con bloqueo después del primer paso
        document.getElementById("btnCliente").onclick = () => {
            if (!rolBloqueado) setRol("CLIENTE");
        };
        document.getElementById("btnSede").onclick = () => {
            if (!rolBloqueado) setRol("ADMINISTRADOR_SEDE");
        };

        function setRol(r) {
            rol = r;
            const btnCliente = document.getElementById("btnCliente");
            const btnSede = document.getElementById("btnSede");
            const rolHidden = document.getElementById("rolHidden");
            if (btnCliente) btnCliente.classList.toggle("active", r === "CLIENTE");
            if (btnSede) btnSede.classList.toggle("active", r === "ADMINISTRADOR_SEDE");
            if (rolHidden) rolHidden.value = r;
        }

        // Función para mostrar el paso activo
        function showStep(stepId) {
            document.querySelectorAll(".step").forEach(s => s.classList.remove("active-step"));
            const step = document.getElementById(stepId);
            if (step) step.classList.add("active-step");
        }

        // Validación personalizada para campos específicos
        function validateField(fieldId, customValidator) {
            const field = document.getElementById(fieldId);
            const errorSpan = document.getElementById(fieldId + "-error");
            const successSpan = document.getElementById(fieldId + "-success");

            if (!field) return true;

            let isValid = true;
            let message = "";

            if (customValidator) {
                const result = customValidator(field.value);
                isValid = result.isValid;
                message = result.message;
            } else {
                if (field.hasAttribute('required') && !field.value.trim()) {
                    isValid = false;
                    message = "Este campo es obligatorio.";
                } else if (field.hasAttribute('pattern') && field.value && !new RegExp(field.pattern).test(field.value)) {
                    isValid = false;
                    message = field.title || "Formato inválido.";
                }
            }

            if (errorSpan) {
                errorSpan.textContent = isValid ? "" : message;
            }
            if (successSpan) {
                successSpan.textContent = "";
            }
            field.classList.toggle("border-red-500", !isValid);
            field.classList.toggle("border-green-500", isValid && field.value.trim() !== "");

            return isValid;
        }

        // Validación completa de un paso
        function validateStep(stepId) {
            const step = document.getElementById(stepId);
            if (!step) return true;
            const requiredFields = step.querySelectorAll("input[required], select[required]");
            let isValid = true;

            requiredFields.forEach(field => {
                let customValidator = null;

                if (field.id === "correo") {
                    customValidator = (value) => {
                        if (!value.includes("@")) return { isValid: false, message: "El correo debe contener '@'." };
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        if (!emailRegex.test(value)) return { isValid: false, message: "Formato de correo inválido." };
                        return { isValid: true };
                    };
                } else if (field.id === "confirmarContrasena") {
                    customValidator = (value) => {
                        const pass = document.getElementById("contrasena").value;
                        if (value !== pass) return { isValid: false, message: "Las contraseñas no coinciden." };
                        return { isValid: true };
                    };
                } else if (field.id === "telefono" || field.id === "cedula") {
                    customValidator = (value) => {
                        if (!/^[0-9]{10}$/.test(value)) return { isValid: false, message: "Debe tener exactamente 10 dígitos numéricos." };
                        return { isValid: true };
                    };
                }

                if (!validateField(field.id, customValidator)) isValid = false;
            });

            return isValid;
        }

        // Toggle de contraseña mejorado
        document.querySelectorAll('.toggle-password').forEach(button => {
            button.addEventListener('click', function() {
                const targetId = this.getAttribute('data-target');
                const input = document.getElementById(targetId);
                const eyeOpen = this.querySelector('.eye-open');
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

        // Validación en tiempo real de contraseñas
        document.getElementById("confirmarContrasena").addEventListener('input', function() {
            const pass = document.getElementById("contrasena").value;
            const confirm = this.value;
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

        // Navegación entre pasos y bloqueo de rol
        document.getElementById("next1").onclick = () => {
            if (validateStep("step1")) {
                rolBloqueado = true;
                document.getElementById("btnCliente").disabled = true;
                document.getElementById("btnSede").disabled = true;
                if (rol === "CLIENTE") showStep("stepCliente");
                else showStep("stepSede2");
            }
        };

        document.getElementById("backCliente").onclick = () => showStep("step1");
        document.getElementById("nextCliente").onclick = () => {
            if (validateStep("stepCliente")) showStep("stepFinal");
        };

        document.getElementById("backSede2").onclick = () => showStep("step1");
        document.getElementById("nextSede2").onclick = () => {
            if (validateStep("stepSede2")) {
                document.getElementById("hiddenNombreSede").value = document.getElementById("nombreSede").value;
                document.getElementById("hiddenNit").value = document.getElementById("nit").value;
                showStep("stepSede3");
            }
        };

        document.getElementById("backSede3").onclick = () => showStep("stepSede2");
        document.getElementById("nextSede3").onclick = () => {
            if (validateStep("stepSede3")) {
                document.getElementById("hiddenDireccion").value = document.getElementById("direccion").value;
                document.getElementById("hiddenLocalidad").value = document.getElementById("localidad").value;
                document.getElementById("hiddenBarrio").value = document.getElementById("barrio").value;
                showStep("stepSede4");
            }
        };

        document.getElementById("nextSede4").onclick = () => {
            if (validateStep("stepSede4")) {
                // Cupos totales
                document.getElementById("hiddenCuposTotales").value = document.getElementById("cuposTotales").value;

                // Las 4 tarifas
                document.getElementById("hiddenTarifaPlenaC").value = document.getElementById("tarifaPlenaC").value;
                document.getElementById("hiddenTarifaPlenaM").value = document.getElementById("tarifaPlenaM").value;
                document.getElementById("hiddenTarifaMinutoC").value = document.getElementById("tarifaMinutoC").value;
                document.getElementById("hiddenTarifaMinutoM").value = document.getElementById("tarifaMinutoM").value;

                // Horario
                document.getElementById("hiddenHorarioSede").value = document.getElementById("horarioSede").value;

                showStep("stepFinal");
            }
        };

        document.getElementById("backFinal").onclick = () => {
            if (rol === "CLIENTE") showStep("stepCliente");
            else showStep("stepSede4");
        };

        // Validación en tiempo real para feedback inmediato
        document.querySelectorAll("input, select").forEach(field => {
            field.addEventListener("blur", () => {
                validateField(field.id);
            });
        });

        // Validación de barrio antes de envío del formulario
        document.getElementById("registroForm").onsubmit = function(e) {
            if (rol === "ADMINISTRADOR_SEDE") {
                const selectedLocalidad = localidadSelect.value;
                const selectedBarrio = barrioSelect.value;

                if (selectedLocalidad && !selectedBarrio) {
                    e.preventDefault();
                    document.getElementById('barrio-error').textContent = 'Debes seleccionar un barrio.';
                    showStep("stepSede3");
                    return false;
                }
            }
        };
    });