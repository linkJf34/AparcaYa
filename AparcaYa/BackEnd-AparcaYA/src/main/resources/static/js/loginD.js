/* ================================================
   LOGIND.JS — AparcaYA
   Ruta: /js/loginD.js
   FIX: todo dentro de DOMContentLoaded + null checks
   para que el modal del th:replace esté en el DOM
   antes de que el JS intente acceder a él.
   ================================================ */

document.addEventListener('DOMContentLoaded', function () {

    /* ================================================
       1. VALIDACIÓN DEL FORMULARIO DE LOGIN
       ================================================ */
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', function (e) {

            let isValid = true;

            // Validación correo
            const correo      = document.getElementById('correo').value.trim();
            const correoError = document.getElementById('correo-error');

            if (!correo) {
                correoError.textContent = 'El correo es obligatorio.';
                correoError.classList.remove('hidden');
                isValid = false;
            } else if (!/\S+@\S+\.\S+/.test(correo)) {
                correoError.textContent = 'Ingresa un correo válido.';
                correoError.classList.remove('hidden');
                isValid = false;
            } else {
                correoError.classList.add('hidden');
            }

            // Validación contraseña
            const contrasena      = document.getElementById('contrasena').value.trim();
            const contrasenaError = document.getElementById('contrasena-error');

            if (!contrasena) {
                contrasenaError.textContent = 'La contraseña es obligatoria.';
                contrasenaError.classList.remove('hidden');
                isValid = false;
            } else {
                contrasenaError.classList.add('hidden');
            }

            // Validación términos
            const terms      = document.getElementById('terms').checked;
            const termsError = document.getElementById('terms-error');

            if (!terms) {
                termsError.textContent = 'Debes aceptar los términos y condiciones.';
                termsError.classList.remove('hidden');
                isValid = false;
            } else {
                termsError.classList.add('hidden');
            }

            if (!isValid) e.preventDefault();
        });
    }


    /* ================================================
       2. TOGGLE DE VISIBILIDAD DE CONTRASEÑA
       ================================================ */
    const togglePassword = document.getElementById('toggle-password');
    if (togglePassword) {
        togglePassword.addEventListener('click', function () {
            const passwordInput = document.getElementById('contrasena');

            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                this.innerHTML = `
                    <path stroke-linecap="round" stroke-linejoin="round"
                          d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338
                          7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228
                          6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065
                          7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228
                          3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65
                          m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />`;
            } else {
                passwordInput.type = 'password';
                this.innerHTML = `
                    <path stroke-linecap="round" stroke-linejoin="round"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round"
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943
                          9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943
                          -9.542-7z" />`;
            }
        });
    }


    /* ================================================
       3. MODAL DE RECUPERACIÓN DE CONTRASEÑA
       ================================================ */
    const modal    = document.getElementById('forgot-password-modal');
    const link     = document.getElementById('forgot-password-link');
    const closeBtn = document.getElementById('close-modal');
    const step1    = document.getElementById('step-1');
    const step2    = document.getElementById('step-2');

    // Abrir modal
    if (link && modal) {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            modal.classList.add('login-modal-open');
            if (step1) step1.classList.remove('hidden');
            if (step2) step2.classList.add('hidden');
        });
    }

    // Cerrar modal — botón
    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('login-modal-open');
        });
    }

    // Cerrar modal — clic en overlay
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('login-modal-open');
            }
        });
    }

    // Cerrar modal — tecla Escape
    document.addEventListener('keydown', (e) => {
        if (modal && e.key === 'Escape' && modal.classList.contains('login-modal-open')) {
            modal.classList.remove('login-modal-open');
        }
    });


    /* --- PASO 1: Enviar token por email --- */
    const sendTokenBtn = document.getElementById('send-token-btn');
    if (sendTokenBtn) {
        sendTokenBtn.addEventListener('click', async () => {
            const email        = document.getElementById('reset-email').value.trim();
            const errorElement = document.getElementById('reset-email-error');

            sendTokenBtn.disabled = true;

            if (!email || !/\S+@\S+\.\S+/.test(email)) {
                errorElement.textContent = 'Por favor ingresa un correo válido.';
                errorElement.classList.remove('hidden');
                sendTokenBtn.disabled = false;
                return;
            }
            errorElement.classList.add('hidden');

            try {
                const response = await fetch('/api/auth/forgot-password', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ email })
                });

                const data = await response.json();

                if (response.ok) {
                    if (step1) step1.classList.add('hidden');
                    if (step2) step2.classList.remove('hidden');
                    alert('Token enviado. Revisa tu correo.');
                } else {
                    errorElement.textContent = data.message || 'Error al enviar token.';
                    errorElement.classList.remove('hidden');
                }

            } catch (error) {
                console.error('Error de red:', error);
                errorElement.textContent = 'Error de conexión. Intenta de nuevo.';
                errorElement.classList.remove('hidden');
            } finally {
                sendTokenBtn.disabled = false;
            }
        });
    }


    /* --- PASO 2: Resetear contraseña con token --- */
    const resetPasswordBtn = document.getElementById('reset-password-btn');
    if (resetPasswordBtn) {
        resetPasswordBtn.addEventListener('click', async () => {
            const token           = document.getElementById('reset-token').value.trim();
            const newPassword     = document.getElementById('new-password').value.trim();
            const confirmPassword = document.getElementById('confirm-password').value.trim();
            const errorElement    = document.getElementById('reset-error');

            resetPasswordBtn.disabled = true;

            if (!token || token.length < 8 || !/^[a-zA-Z0-9-]+$/.test(token)) {
                errorElement.textContent = 'Ingresa un token válido (al menos 8 caracteres alfanuméricos).';
                errorElement.classList.remove('hidden');
                resetPasswordBtn.disabled = false;
                return;
            }

            if (!newPassword || newPassword.length < 6) {
                errorElement.textContent = 'La contraseña debe tener al menos 6 caracteres.';
                errorElement.classList.remove('hidden');
                resetPasswordBtn.disabled = false;
                return;
            }

            if (newPassword !== confirmPassword) {
                errorElement.textContent = 'Las contraseñas no coinciden.';
                errorElement.classList.remove('hidden');
                resetPasswordBtn.disabled = false;
                return;
            }

            errorElement.classList.add('hidden');

            try {
                const response = await fetch('/api/auth/reset-password', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ token, newPassword })
                });

                const data = await response.json();

                if (response.ok) {
                    alert('Contraseña actualizada exitosamente.');
                    if (modal) modal.classList.remove('login-modal-open');
                    document.getElementById('reset-token').value      = '';
                    document.getElementById('new-password').value     = '';
                    document.getElementById('confirm-password').value = '';
                } else {
                    errorElement.textContent = data.message || 'Token inválido o expirado.';
                    errorElement.classList.remove('hidden');
                }

            } catch (error) {
                console.error('Error de red:', error);
                errorElement.textContent = 'Error de conexión. Intenta de nuevo.';
                errorElement.classList.remove('hidden');
            } finally {
                resetPasswordBtn.disabled = false;
            }
        });
    }


    /* ================================================
       4. DETECCIÓN DE ERROR POR URL (?error)
       Spring Security redirige a /login?error
       cuando las credenciales son incorrectas.
       ================================================ */
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('error')) {
        const errorMsg = document.getElementById('error-msg');
        if (errorMsg) errorMsg.classList.remove('hidden');
    }

}); // fin DOMContentLoaded