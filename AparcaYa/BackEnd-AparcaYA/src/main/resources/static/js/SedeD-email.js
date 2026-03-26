// ============================================================
// SedeD-email.js — AparcaYA
// Ruta: /static/js/SedeD-email.js
// Módulo de correos del dashboard Sede.
//
// USO: incluir en DashboardSede.html DESPUÉS de SedeD.js
//   <script src="/js/SedeD-email.js"></script>
//
// ENDPOINTS propios del SedeController:
//   POST /api/sede/correo/unitario
//   POST /api/sede/correo/masivo
//   GET  /api/sede/correos/clientes
//   GET  /api/sede/correos/trabajadores
//
// NO usa endpoints de /admin/*
// NO duplica lógica de SedeD.js
// ============================================================

(function () {
    'use strict';

    // ── Estado interno (aislado del scope global) ───────────────────────────
    const SEDE_MAIL = {
        destinatariosCache: []
    };

    // ── Estado del selector de plantillas ───────────────────────────────────
    var _plantillaUno    = null;
    var _plantillaMasivo = null;

    // ── Inicialización ───────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {
        _setupMailTabs();
        _setupForms();
        _setupBadge();
        _cargarKpis();
    });

    // ── Tabs Correo Uno / Masivo ─────────────────────────────────────────────
    function _setupMailTabs() {
        var tabUno    = document.getElementById('tab-mailuno');
        var tabMasivo = document.getElementById('tab-mailmasivo');
        var panelUno  = document.getElementById('correoUno');
        var panelMas  = document.getElementById('correoMasivo');

        if (!tabUno || !tabMasivo) return;

        tabUno.addEventListener('click', function () {
            _activarTab(tabUno, tabMasivo, panelUno, panelMas);
        });
        tabMasivo.addEventListener('click', function () {
            _activarTab(tabMasivo, tabUno, panelMas, panelUno);
        });
    }

    function _activarTab(btnActivo, btnInactivo, panelActivo, panelInactivo) {
        btnActivo.classList.add('active');
        btnActivo.setAttribute('aria-selected', 'true');
        btnInactivo.classList.remove('active');
        btnInactivo.setAttribute('aria-selected', 'false');
        panelActivo.hidden  = false;
        panelInactivo.hidden = true;
    }

    // ── Formularios ──────────────────────────────────────────────────────────
    // CORRECCIÓN Bug 1: listener directo en el form con preventDefault garantizado.
    // removeAttribute('onsubmit') elimina el handler inline para evitar doble disparo.
    function _setupForms() {
        var formUno = document.getElementById('formCorreoUno');
        if (formUno) {
            // Eliminar cualquier atributo que cause envío nativo
            formUno.removeAttribute('onsubmit');
            formUno.removeAttribute('action');
            formUno.setAttribute('method', 'dialog'); // previene submit nativo en browsers modernos
            formUno.addEventListener('submit', function (e) {
                e.preventDefault();
                e.stopImmediatePropagation();
                enviarCorreoUno();
            }, true); // capture:true — se ejecuta antes de cualquier otro handler
        }

        var formMasivo = document.getElementById('formCorreoMasivo');
        if (formMasivo) {
            formMasivo.removeAttribute('onsubmit');
            formMasivo.removeAttribute('action');
            formMasivo.setAttribute('method', 'dialog');
            formMasivo.addEventListener('submit', function (e) {
                e.preventDefault();
                e.stopImmediatePropagation();
                enviarCorreoMasivo();
            }, true);
        }

        window.enviarCorreoUno    = enviarCorreoUno;
        window.enviarCorreoMasivo = enviarCorreoMasivo;
    }

    // ── Badge de conteo de destinatarios ────────────────────────────────────
    function _setupBadge() {
        var textarea = document.getElementById('emailsMassive');
        if (textarea) {
            textarea.addEventListener('input', _actualizarBadge);
        }
    }

    function _actualizarBadge() {
        var textarea = document.getElementById('emailsMassive');
        var badge    = document.getElementById('sedeBadgeConteo');
        if (!textarea || !badge) return;
        var count = textarea.value
            .split(',')
            .map(function (e) { return e.trim(); })
            .filter(function (e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); })
            .length;
        badge.textContent  = count;
        badge.style.display = count > 0 ? 'inline' : 'none';
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ENVÍO UNO A UNO
    // Endpoint: POST /api/sede/correo/unitario
    // ═══════════════════════════════════════════════════════════════════════
    function enviarCorreoUno() {
        var correo  = _val('emailSingle');
        var asunto  = _val('subjectSingle');
        var mensaje = _val('messageSingle');

        if (!correo || !asunto || !mensaje) {
            showToast('Completa todos los campos', 'warning');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
            showToast('Correo inválido', 'warning');
            return;
        }

        // Buscar el botón por el formulario directamente — más robusto que por ID del panel
        var form = document.getElementById('formCorreoUno');
        var btn  = form ? form.querySelector('button[type="submit"]') : null;
        var txt  = _btnLoading(btn);

        // Si hay plantilla activa usar /correo/con-plantilla, si no /correo/unitario
        var endpoint = _plantillaUno
            ? '/api/sede/correo/con-plantilla'
            : '/api/sede/correo/unitario';

        var params = new URLSearchParams({ correo: correo, asunto: asunto, mensaje: mensaje });
        if (_plantillaUno) params.set('tipoPlantilla', _plantillaUno);

        fetch(endpoint, {
            method:  'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body:    params.toString()
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.status === 'success') {
                    showToast(data.message, 'success');
                    ['emailSingle', 'subjectSingle', 'messageSingle'].forEach(_limpiar);
                    _limpiarPlantillaUno();
                } else {
                    showToast(data.message || 'Error al enviar', 'error');
                }
            })
            .catch(function () { showToast('Error de conexión', 'error'); })
            .finally(function () { _btnRestore(btn, txt); });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ENVÍO MASIVO — BCC vía /api/sede/correo/masivo
    // EmailService.enviarCorreoMasivo() usa BCC nativo
    // ═══════════════════════════════════════════════════════════════════════
    function enviarCorreoMasivo() {
        var emails  = _val('emailsMassive');
        var asunto  = _val('subjectMassive');
        var mensaje = _val('messageMassive');

        if (!emails || !asunto || !mensaje) {
            showToast('Completa todos los campos', 'warning');
            return;
        }

        var lista   = emails.split(',').map(function (e) { return e.trim(); }).filter(Boolean);
        var invalidos = lista.filter(function (e) {
            return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
        });

        if (invalidos.length > 0) {
            showToast('Correos inválidos: ' + invalidos.join(', '), 'error');
            return;
        }
        if (lista.length === 0) {
            showToast('Agrega al menos un destinatario', 'warning');
            return;
        }

        // Buscar botón por el formulario — más robusto que por ID del panel
        var formM = document.getElementById('formCorreoMasivo');
        var btn   = formM ? formM.querySelector('button[type="submit"]') : null;
        var txt   = _btnLoading(btn);

        var params = new URLSearchParams();
        lista.forEach(function (email) { params.append('seleccionados', email); });
        params.set('asunto',  asunto);
        params.set('mensaje', mensaje);
        // Pasar plantilla si está activa — el controller la usa para enviar con plantilla Thymeleaf
        if (_plantillaMasivo) params.set('tipoPlantilla', _plantillaMasivo);

        fetch('/api/sede/correo/masivo', {
            method:  'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body:    params.toString()
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.status === 'success') {
                    showToast(data.message, 'success');
                    ['emailsMassive', 'subjectMassive', 'messageMassive'].forEach(_limpiar);
                    _actualizarBadge();
                    _limpiarPlantillaMasivo();
                } else {
                    showToast(data.message || 'Error al enviar', 'error');
                }
            })
            .catch(function () { showToast('Error de conexión', 'error'); })
            .finally(function () { _btnRestore(btn, txt); });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // FILTRO DE DESTINATARIOS — endpoints propios de Sede
    // ═══════════════════════════════════════════════════════════════════════
    var _SEDE_ENDPOINTS = {
        clientes:     '/api/sede/correos/clientes',
        trabajadores: '/api/sede/correos/trabajadores'
    };

    window.sedeCargarDestinatarios = function () {
        var rol      = _val('sedeFiltroRol');
        var estadoEl = document.getElementById('sedeEstadoFiltro');
        var listaEl  = document.getElementById('sedeListaDestinatarios');
        var tablaEl  = document.getElementById('sedeTablaDestinatarios');
        var contEl   = document.getElementById('sedeContadorLista');
        var btnEl    = document.getElementById('btnSedeCargar');

        if (!rol) { showToast('Selecciona un grupo', 'warning'); return; }
        if (!_SEDE_ENDPOINTS[rol]) {
            showToast('Grupo no reconocido', 'warning');
            return;
        }

        if (estadoEl) estadoEl.textContent = 'Consultando...';
        if (listaEl)  listaEl.style.display = 'none';
        if (btnEl)    { btnEl.disabled = true; btnEl.textContent = 'Cargando...'; }

        fetch(_SEDE_ENDPOINTS[rol])
            .then(function (r) {
                if (!r.ok) throw new Error('Error ' + r.status);
                return r.json();
            })
            .then(function (datos) {
                SEDE_MAIL.destinatariosCache = datos;

                if (datos.length === 0) {
                    if (estadoEl) estadoEl.textContent = 'No hay usuarios en este grupo.';
                    return;
                }

                if (tablaEl) {
                    tablaEl.innerHTML = datos.map(function (d) {
                        return '<label style="display:flex;align-items:center;gap:.75rem;padding:.6rem .75rem;' +
                            'cursor:pointer;border-bottom:1px solid #f0fdfa;transition:background .15s;"' +
                            'onmouseover="this.style.background=\'#f0fdfa\'" onmouseout="this.style.background=\'transparent\'">' +
                            '<input type="checkbox" class="sede-dest-check" data-correo="' + _esc(d.correo) + '"' +
                            ' style="width:16px;height:16px;cursor:pointer;accent-color:#0d9488;" checked/>' +
                            '<div style="flex:1;min-width:0;">' +
                            '<div style="font-weight:600;font-size:.875rem;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
                            _esc(d.nombre || '(sin nombre)') + '</div>' +
                            '<div style="font-size:.8rem;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
                            _esc(d.correo) + '</div></div>' +
                            '<span style="font-size:.72rem;background:#ccfbf1;color:#0f766e;border-radius:9999px;padding:.15rem .5rem;white-space:nowrap;">' +
                            _rolLabel(d.rol) + '</span></label>';
                    }).join('');
                }

                if (contEl)   contEl.textContent   = datos.length + ' usuario(s) encontrado(s)';
                if (estadoEl) estadoEl.textContent  = '';
                if (listaEl)  listaEl.style.display = 'block';
            })
            .catch(function () {
                if (estadoEl) estadoEl.textContent = 'Error al consultar. Intenta de nuevo.';
                showToast('Error al consultar destinatarios', 'error');
            })
            .finally(function () {
                if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Consultar'; }
            });
    };

    window.sedeSeleccionarTodos = function (estado) {
        document.querySelectorAll('.sede-dest-check').forEach(function (cb) {
            cb.checked = estado;
        });
    };

    window.sedeAgregarSeleccionados = function () {
        var seleccionados = Array.from(
            document.querySelectorAll('.sede-dest-check:checked')
        ).map(function (cb) { return cb.dataset.correo; }).filter(Boolean);

        if (seleccionados.length === 0) {
            showToast('No hay destinatarios seleccionados', 'warning');
            return;
        }

        var textarea    = document.getElementById('emailsMassive');
        if (!textarea) return;

        var existentes  = textarea.value.split(',').map(function (e) { return e.trim(); }).filter(Boolean);
        var nuevos      = seleccionados.filter(function (e) { return !existentes.includes(e); });
        var todos       = existentes.concat(nuevos).filter(Boolean);

        textarea.value = todos.join(', ');
        _actualizarBadge();

        showToast(nuevos.length + ' correo(s) agregado(s)', 'success');

        var lista    = document.getElementById('sedeListaDestinatarios');
        var estadoEl = document.getElementById('sedeEstadoFiltro');
        if (lista)    lista.style.display  = 'none';
        if (estadoEl) estadoEl.textContent = seleccionados.length + ' destinatario(s) cargados.';
    };

    // ═══════════════════════════════════════════════════════════════════════
    // SELECTOR DE PLANTILLAS — Uno a uno
    // ═══════════════════════════════════════════════════════════════════════
    window.sedeSelectorPlantilla = function (card) {
        var tipo = card.dataset.plantilla;
        if (!tipo) return;

        // CORRECCIÓN Bug 2: limpiar con selector más amplio + forzar remove antes de add
        // Cubre casos donde el id del panel difiera del esperado
        document.querySelectorAll('[data-plantilla]').forEach(function (c) {
            c.classList.remove('plantilla-activa');
            c.setAttribute('aria-pressed', 'false');
        });
        card.classList.add('plantilla-activa');
        card.setAttribute('aria-pressed', 'true');

        _plantillaUno = tipo;

        var badge = document.getElementById('sedePlantillaBadge');
        if (badge) {
            badge.textContent   = _plantillaLabel(tipo);
            badge.style.display = 'inline';
        }

        _cargarPreview(tipo, 'subjectSingle', 'messageSingle');
    };

    // ═══════════════════════════════════════════════════════════════════════
    // SELECTOR DE PLANTILLAS — Masivo
    // ═══════════════════════════════════════════════════════════════════════
    window.sedeSelectorPlantillaMasivo = function (card) {
        var tipo = card.dataset.plantillaMasivo;
        if (!tipo) return;

        // CORRECCIÓN Bug 2: mismo fix que el unitario
        document.querySelectorAll('[data-plantilla-masivo]').forEach(function (c) {
            c.classList.remove('plantilla-activa');
            c.setAttribute('aria-pressed', 'false');
        });
        card.classList.add('plantilla-activa');
        card.setAttribute('aria-pressed', 'true');

        _plantillaMasivo = tipo;

        var badge = document.getElementById('sedePlantillaBadgeMasivo');
        if (badge) {
            badge.textContent   = _plantillaLabel(tipo);
            badge.style.display = 'inline';
        }

        _cargarPreview(tipo, 'subjectMassive', 'messageMassive');
    };

    // Preview desde el endpoint propio de Sede
    // CORRECCIÓN Bug 2: siempre reemplaza los campos al cambiar plantilla,
    // sin importar si ya tenían contenido de una plantilla anterior.
    // Solo respeta el contenido si el usuario lo escribió manualmente
    // (detectado por el flag data-user-edited en el campo).
    function _cargarPreview(tipo, subjectId, messageId) {
        fetch('/api/sede/correos/plantilla-preview?tipo=' + tipo)
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (data) {
                if (!data) return;
                var s = document.getElementById(subjectId);
                var m = document.getElementById(messageId);
                // Reemplazar siempre — el usuario eligió otra plantilla intencionalmente
                if (s) { s.value = data.asunto;  s.dataset.userEdited = ''; }
                if (m) { m.value = data.mensaje; m.dataset.userEdited = ''; }
            })
            .catch(function () {});
    }

    function _plantillaLabel(tipo) {
        var map = {
            BIENVENIDA:   'Bienvenida',
            RECORDATORIO: 'Recordatorio',
            PROMOCION:    'Promoción',
            NOTIFICACION: 'Notificación'
        };
        return map[tipo] || tipo;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // KPIs — reutiliza endpoint del AdminController
    // (el admin está autenticado como ADMINISTRADOR_SEDE también tiene acceso)
    // Si el proyecto tiene endpoint propio de sede para estadísticas,
    // cambiar la URL a /api/sede/correos/estadisticas
    // ═══════════════════════════════════════════════════════════════════════
    function _cargarKpis() {
        fetch('/api/sede/correos/estadisticas')
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (data) {
                if (!data) return;
                _setKpi('sedeKpiEnviados', data.totalEnviados);
                _setKpi('sedeKpiErrores',  data.totalErrores);
                _setKpi('sedeKpiTotal',    data.total);
            })
            .catch(function () {});
    }

    function _setKpi(id, valor) {
        var el = document.getElementById(id);
        if (el) el.textContent = (valor != null ? Number(valor) : 0).toLocaleString('es-CO');
    }

    // ── Limpiar plantilla al enviar ──────────────────────────────────────
    function _limpiarPlantillaUno() {
        _plantillaUno = null;
        document.querySelectorAll('#correoUno [data-plantilla]').forEach(function (c) {
            c.classList.remove('plantilla-activa');
        });
        var b = document.getElementById('sedePlantillaBadge');
        if (b) b.style.display = 'none';
    }

    function _limpiarPlantillaMasivo() {
        _plantillaMasivo = null;
        document.querySelectorAll('#correoMasivo [data-plantilla-masivo]').forEach(function (c) {
            c.classList.remove('plantilla-activa');
        });
        var b = document.getElementById('sedePlantillaBadgeMasivo');
        if (b) b.style.display = 'none';
    }

    // Helpers privados
    function _val(id) {
        var el = document.getElementById(id);
        return el ? el.value.trim() : '';
    }

    function _limpiar(id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
    }

    function _btnLoading(btn) {
        if (!btn) return '';
        var original   = btn.innerHTML;
        btn.disabled   = true;
        btn.innerHTML  = 'Enviando...';
        return original;
    }

    function _btnRestore(btn, original) {
        if (!btn) return;
        btn.disabled  = false;
        btn.innerHTML = original;
    }

    function _esc(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function _rolLabel(rol) {
        var map = { CLIENTE: 'Cliente', ADMINISTRADOR_SEDE: 'Admin Sede', OPERARIO: 'Operario' };
        return map[rol] || (rol || '');
    }

})();