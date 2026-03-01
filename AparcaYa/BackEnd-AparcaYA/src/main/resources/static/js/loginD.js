/* ================================================
   LOGIND.JS — AparcaYA
   Ruta: /js/loginD.js

   CAMBIOS APLICADOS:
   ✅ FIX L-03: Eliminada validación del checkbox de términos
               (se acepta en registro, no en login)
   ✅ FIX L-04: Contraseña mínima corregida a 8 caracteres
               (antes 6 en modal vs 8 en registro — inconsistente)
   ✅ FIX L-05: alert() nativos reemplazados por toasts inline
               (consistente con el sistema de notificaciones del proyecto)
   ✅ FIX L-01: Detección ?error como respaldo de Thymeleaf
               (Thymeleaf es la fuente principal, JS es el respaldo)
   ✅ Toggle de contraseña con SVG separados (eye-open/eye-closed)
   ================================================ */

document.addEventListener('DOMContentLoaded', function () {

    // =========================================================
    // SISTEMA DE NOTIFICACIONES — Toasts inline
    // ✅ FIX L-05: reemplaza alert() nativos del modal
    // =========================================================

    /**
     * Muestra un toast flotante arriba a la derecha.
     * Consistente con el sistema de notificaciones de Registro.js
     */
    function showToast(mensaje, tipo = 'info', duracion = 4000) {
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
            'max-width:340px', 'transition:opacity 0.3s'
        ].join(';');
        toast.innerHTML = `<span>${iconos[tipo] || ''}</span><span>${mensaje}</span>`;
        contenedor.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 350);
        }, duracion);
    }

    /**
     * Muestra un error inline bajo un campo del formulario.
     */
    function showFieldError(fieldId, mensaje) {
        const errorDiv = document.getElementById(fieldId + '-error');
        if (!errorDiv) return;
        errorDiv.textContent = mensaje;
        errorDiv.classList.remove('hidden');
    }

    function clearFieldError(fieldId) {
        const errorDiv = document.getElementById(fieldId + '-error');
        if (!errorDiv) return;
        errorDiv.textContent = '';
        errorDiv.classList.add('hidden');
    }

    // =========================================================
    // 1. VALIDACIÓN DEL FORMULARIO DE LOGIN
    //
    // ✅ FIX L-03: eliminada validación del checkbox de términos
    // =========================================================
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', function (e) {
            let isValid = true;

            // Correo
            const correo = document.getElementById('correo').value.trim();
            if (!correo) {
                showFieldError('correo', 'El correo es obligatorio.');
                isValid = false;
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
                showFieldError('correo', 'Ingresa un correo válido.');
                isValid = false;
            } else {
                clearFieldError('correo');
            }

            // Contraseña
            const contrasena = document.getElementById('contrasena').value;
            if (!contrasena) {
                showFieldError('contrasena', 'La contraseña es obligatoria.');
                isValid = false;
            } else {
                clearFieldError('contrasena');
            }

            // ✅ FIX L-03: eliminado bloque de validación del checkbox de términos

            if (!isValid) e.preventDefault();
        });
    }

    // =========================================================
    // 2. TOGGLE DE VISIBILIDAD DE CONTRASEÑA
    // Usa SVG separados (eye-open / eye-closed) en lugar de
    // reemplazar innerHTML — más limpio y accesible
    // =========================================================
    const togglePassword = document.getElementById('toggle-password');
    if (togglePassword) {
        togglePassword.addEventListener('click', function () {
            const input     = document.getElementById('contrasena');
            const eyeOpen   = this.querySelector('.eye-open');
            const eyeClosed = this.querySelector('.eye-closed');

            if (input.type === 'password') {
                input.type = 'text';
                if (eyeOpen)   eyeOpen.classList.add('hidden');
                if (eyeClosed) eyeClosed.classList.remove('hidden');
                this.setAttribute('aria-label', 'Ocultar contraseña');
            } else {
                input.type = 'password';
                if (eyeClosed) eyeClosed.classList.add('hidden');
                if (eyeOpen)   eyeOpen.classList.remove('hidden');
                this.setAttribute('aria-label', 'Mostrar contraseña');
            }
        });

        // Accesibilidad: activar con Enter/Space desde teclado
        togglePassword.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.click();
            }
        });
    }

    // =========================================================
    // 3. MODAL DE RECUPERACIÓN DE CONTRASEÑA
    // =========================================================
    const modal    = document.getElementById('forgot-password-modal');
    const link     = document.getElementById('forgot-password-link');
    const closeBtn = document.getElementById('close-modal');
    const step1    = document.getElementById('step-1');
    const step2    = document.getElementById('step-2');

    function abrirModal() {
        if (!modal) return;
        modal.classList.add('login-modal-open');
        if (step1) step1.classList.remove('hidden');
        if (step2) step2.classList.add('hidden');
        // Focus al primer campo al abrir (accesibilidad)
        setTimeout(() => {
            const primerCampo = modal.querySelector('input');
            if (primerCampo) primerCampo.focus();
        }, 50);
    }

    function cerrarModal() {
        if (!modal) return;
        modal.classList.remove('login-modal-open');
    }

    if (link)     link.addEventListener('click', (e) => { e.preventDefault(); abrirModal(); });
    if (closeBtn) closeBtn.addEventListener('click', cerrarModal);
    if (modal)    modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModal(); });

    document.addEventListener('keydown', (e) => {
        if (modal && e.key === 'Escape' && modal.classList.contains('login-modal-open')) {
            cerrarModal();
        }
    });

    // ── PASO 1: Enviar token por email ────────────────────────

    /**
     * Muestra/oculta spinner en un botón.
     */
    function setBtnLoading(btn, state, textoOriginal = 'Enviar') {
        if (state) {
            btn.disabled  = true;
            btn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:0.4rem;">
                <svg style="width:1rem;height:1rem;animation:spin 1s linear infinite"
                     xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle style="opacity:.25" cx="12" cy="12" r="10"
                            stroke="currentColor" stroke-width="4"></circle>
                    <path style="opacity:.75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                </svg>
                Enviando...
            </span>`;
        } else {
            btn.disabled  = false;
            btn.innerHTML = textoOriginal;
        }
    }

    if (!document.getElementById('spin-style')) {
        const style = document.createElement('style');
        style.id = 'spin-style';
        style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
        document.head.appendChild(style);
    }

    const sendTokenBtn = document.getElementById('send-token-btn');
    if (sendTokenBtn) {
        sendTokenBtn.addEventListener('click', async () => {
            const emailInput   = document.getElementById('reset-email');
            const errorElement = document.getElementById('reset-email-error');
            const email        = emailInput ? emailInput.value.trim() : '';

            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                if (errorElement) {
                    errorElement.textContent = 'Por favor ingresa un correo válido.';
                    errorElement.classList.remove('hidden');
                }
                return;
            }
            if (errorElement) errorElement.classList.add('hidden');

            setBtnLoading(sendTokenBtn, true);

            try {
                const response = await fetch('/api/auth/forgot-password', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ email })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    // ✅ FIX L-05: toast en lugar de alert()
                    showToast(
                        'Si el correo está registrado, recibirás un código en breve.',
                        'info', 6000
                    );
                    if (step1) step1.classList.add('hidden');
                    if (step2) step2.classList.remove('hidden');
                    // Focus al campo del token
                    setTimeout(() => {
                        const tokenInput = document.getElementById('reset-token');
                        if (tokenInput) tokenInput.focus();
                    }, 100);
                } else {
                    if (errorElement) {
                        errorElement.textContent = data.message || 'Error al enviar el código.';
                        errorElement.classList.remove('hidden');
                    }
                }

            } catch (err) {
                console.error('Error de red:', err);
                if (errorElement) {
                    errorElement.textContent = 'Error de conexión. Revisa tu red e intenta de nuevo.';
                    errorElement.classList.remove('hidden');
                }
            } finally {
                setBtnLoading(sendTokenBtn, false, 'Enviar código');
            }
        });
    }

    // ── PASO 2: Resetear contraseña con token ─────────────────

    const resetPasswordBtn = document.getElementById('reset-password-btn');
    if (resetPasswordBtn) {
        resetPasswordBtn.addEventListener('click', async () => {
            const token           = document.getElementById('reset-token')?.value.trim() ?? '';
            const newPassword     = document.getElementById('new-password')?.value ?? '';
            const confirmPassword = document.getElementById('confirm-password')?.value ?? '';
            const errorElement    = document.getElementById('reset-error');

            // Validaciones locales
            if (!token || token.length < 8 || !/^[A-Za-z0-9]+$/.test(token)) {
                if (errorElement) {
                    errorElement.textContent = 'Ingresa el código de 8 caracteres que recibiste.';
                    errorElement.classList.remove('hidden');
                }
                return;
            }

            // ✅ FIX L-04: mínimo 8 caracteres — consistente con el registro
            // Antes: pedía mínimo 6 (inconsistente con el registro que exige 8)
            if (!newPassword || newPassword.length < 8) {
                if (errorElement) {
                    errorElement.textContent = 'La contraseña debe tener al menos 8 caracteres.';
                    errorElement.classList.remove('hidden');
                }
                return;
            }

            if (newPassword !== confirmPassword) {
                if (errorElement) {
                    errorElement.textContent = 'Las contraseñas no coinciden.';
                    errorElement.classList.remove('hidden');
                }
                return;
            }

            if (errorElement) errorElement.classList.add('hidden');

            setBtnLoading(resetPasswordBtn, true, 'Actualizar contraseña');

            try {
                const response = await fetch('/api/auth/reset-password', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ token: token.toUpperCase(), newPassword })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    // ✅ FIX L-05: toast en lugar de alert()
                    cerrarModal();
                    showToast('Contraseña actualizada. Ya puedes iniciar sesión.', 'success', 6000);

                    // Limpiar campos del modal
                    ['reset-token', 'new-password', 'confirm-password'].forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.value = '';
                    });

                } else {
                    if (errorElement) {
                        errorElement.textContent =
                            data.message || 'Código inválido o expirado. Solicita uno nuevo.';
                        errorElement.classList.remove('hidden');
                    }
                }

            } catch (err) {
                console.error('Error de red:', err);
                if (errorElement) {
                    errorElement.textContent = 'Error de conexión. Revisa tu red e intenta de nuevo.';
                    errorElement.classList.remove('hidden');
                }
            } finally {
                setBtnLoading(resetPasswordBtn, false, 'Actualizar contraseña');
            }
        });
    }

    // =========================================================
    // 4. DETECCIÓN DE ?error EN URL — respaldo de Thymeleaf
    //
    // ✅ FIX L-01: Thymeleaf es la fuente principal (th:if="${param.error}")
    // Este bloque actúa como respaldo por si el fragmento Thymeleaf
    // no captura el parámetro en algún escenario de caché o fragmento.
    // Si Thymeleaf ya renderizó el div de error, este bloque no hace nada
    // visible porque el div #error-msg solo se muestra si Thymeleaf no lo hizo.
    // =========================================================
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('error')) {
        // Si Thymeleaf ya mostró su div, este div de respaldo se ignora visualmente
        const errorMsg = document.getElementById('error-msg');
        if (errorMsg) errorMsg.classList.remove('hidden');
    }

    // Logout exitoso — Thymeleaf lo maneja con th:if="${param.logout}"
    // No se necesita JS adicional para ese caso

}); // fin DOMContentLoaded