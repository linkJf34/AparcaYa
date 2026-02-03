// Validación del formulario de login antes de enviar
document.getElementById('login-form').addEventListener('submit', function(e) {
    let isValid = true;

    // Validar correo
    const correo = document.getElementById('correo').value.trim();
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

    // Validar contraseña
    const contrasena = document.getElementById('contrasena').value.trim();
    const contrasenaError = document.getElementById('contrasena-error');
    if (!contrasena) {
        contrasenaError.textContent = 'La contraseña es obligatoria.';
        contrasenaError.classList.remove('hidden');
        isValid = false;
    } else {
        contrasenaError.classList.add('hidden');
    }

    // Validar checkbox de términos
    const terms = document.getElementById('terms').checked;
    const termsError = document.getElementById('terms-error');
    if (!terms) {
        termsError.textContent = 'Debes aceptar los términos y condiciones.';
        termsError.classList.remove('hidden');
        isValid = false;
    } else {
        termsError.classList.add('hidden');
    }

    // Si no es válido, prevenir envío
    if (!isValid) {
        e.preventDefault();
    }
});

// Toggle visibilidad de contraseña
document.getElementById('toggle-password').addEventListener('click', function() {
    const passwordInput = document.getElementById('contrasena');
    const type = passwordInput.type === 'password' ? 'text' : 'password';
    passwordInput.type = type;
    // Opcional: Cambiar el icono si quieres alternar entre ojo abierto/cerrado
    // this.innerHTML = type === 'password' ? '<svg>...</svg>' : '<svg>...</svg>';
});

// Manejo del modal de recuperación de contraseña
const modal = document.getElementById('forgot-password-modal');
const link = document.getElementById('forgot-password-link');
const closeBtn = document.getElementById('close-modal');
const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');

// Abrir modal al hacer clic en "¿Olvidaste tu contraseña?"
link.addEventListener('click', (e) => {
    e.preventDefault();
    modal.classList.add('modal-open');
    step1.classList.remove('hidden');
    step2.classList.add('hidden');
});

// Cerrar modal
closeBtn.addEventListener('click', () => {
    modal.classList.remove('modal-open');
});

// Paso 1: Enviar token por email
document.getElementById('send-token-btn').addEventListener('click', async () => {
    const email = document.getElementById('reset-email').value.trim();
    const errorElement = document.getElementById('reset-email-error');
    const btn = document.getElementById('send-token-btn');
    btn.disabled = true; // Deshabilitar botón durante envío

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
        errorElement.textContent = 'Por favor ingresa un correo válido.';
        errorElement.classList.remove('hidden');
        btn.disabled = false;
        return;
    }
    errorElement.classList.add('hidden');

    try {
        const response = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await response.json();

        if (response.ok) {
            step1.classList.add('hidden');
            step2.classList.remove('hidden');
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
        btn.disabled = false;
    }
});

// Paso 2: Resetear contraseña con token
document.getElementById('reset-password-btn').addEventListener('click', async () => {
    const token = document.getElementById('reset-token').value.trim();
    const newPassword = document.getElementById('new-password').value.trim();
    const confirmPassword = document.getElementById('confirm-password').value.trim();
    const errorElement = document.getElementById('reset-error');
    const btn = document.getElementById('reset-password-btn');
    btn.disabled = true;

    // Validación actualizada: token debe tener al menos 8 caracteres alfanuméricos
    if (!token || token.length < 8 || !/^[a-zA-Z0-9-]+$/.test(token)) {
        errorElement.textContent = 'Ingresa un token válido (al menos 8 caracteres alfanuméricos).';
        errorElement.classList.remove('hidden');
        btn.disabled = false;
        return;
    }
    if (!newPassword || newPassword.length < 6) {
        errorElement.textContent = 'La contraseña debe tener al menos 6 caracteres.';
        errorElement.classList.remove('hidden');
        btn.disabled = false;
        return;
    }
    if (newPassword !== confirmPassword) {
        errorElement.textContent = 'Las contraseñas no coinciden.';
        errorElement.classList.remove('hidden');
        btn.disabled = false;
        return;
    }
    errorElement.classList.add('hidden');

    try {
        const response = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, newPassword })
        });
        const data = await response.json();

        if (response.ok) {
            alert('Contraseña actualizada exitosamente.');
            modal.classList.remove('modal-open');
            // Limpiar campos
            document.getElementById('reset-token').value = '';
            document.getElementById('new-password').value = '';
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
        btn.disabled = false;
    }
});