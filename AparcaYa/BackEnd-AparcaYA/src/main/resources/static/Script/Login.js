/* ================================================
   LOGIND.JS — AparcaYA
   Script de la página de inicio de sesión
   ================================================
   Responsabilidades de este archivo:
   1. Validar el formulario de login antes de enviar
   2. Mostrar/ocultar la contraseña con el ícono ojo
   3. Manejar el modal de recuperación de contraseña
      (apertura, cierre, paso 1: enviar token,
       paso 2: resetear contraseña)
   4. Detectar el parámetro ?error en la URL para
      mostrar el mensaje de credenciales incorrectas

   CAMBIOS vs versión original (inline en HTML):
   ✅ Extraído a archivo externo /js/loginD.js
   ✅ modal.classList usa 'login-modal-open'
      en vez de 'modal-open' (nuevo nombre del CSS)
   ✅ Comentarios explicativos en cada línea
   ================================================ */


/* ================================================
   1. VALIDACIÓN DEL FORMULARIO DE LOGIN
   Se ejecuta al hacer submit del formulario.
   Si hay errores, preventDefault() previene el
   envío al servidor y muestra los mensajes.
   ================================================ */

/* Obtiene el formulario por su id y escucha el evento submit */
document.getElementById('login-form').addEventListener('submit', function(e) {

    /* Flag que indica si el formulario es válido.
       Empieza en true y se pone en false ante cualquier error */
    let isValid = true;


    /* --- VALIDACIÓN DEL CAMPO CORREO --- */

    /* .trim() → elimina espacios al inicio y al final
       para que "  " no se cuente como correo válido */
    const correo = document.getElementById('correo').value.trim();

    /* Obtiene el <div> donde se mostrará el error del correo */
    const correoError = document.getElementById('correo-error');

    if (!correo) {
        /* Si el campo está vacío, muestra mensaje de obligatorio */
        correoError.textContent = 'El correo es obligatorio.';
        correoError.classList.remove('hidden'); /* Quita hidden para mostrar el div */
        isValid = false;                         /* Marca el formulario como inválido */

    } else if (!/\S+@\S+\.\S+/.test(correo)) {
        /* Expresión regular básica de validación de email:
           \S+ → uno o más caracteres que no sean espacio
           @   → símbolo arroba
           \S+ → uno o más caracteres (dominio)
           \.  → punto literal
           \S+ → extensión (.com, .co, etc.)
           Si no cumple el patrón, no es un email válido */
        correoError.textContent = 'Ingresa un correo válido.';
        correoError.classList.remove('hidden');
        isValid = false;

    } else {
        /* Si el correo es válido, oculta cualquier error previo */
        correoError.classList.add('hidden');
    }


    /* --- VALIDACIÓN DEL CAMPO CONTRASEÑA --- */

    const contrasena = document.getElementById('contrasena').value.trim();
    const contrasenaError = document.getElementById('contrasena-error');

    if (!contrasena) {
        /* La contraseña no puede estar vacía */
        contrasenaError.textContent = 'La contraseña es obligatoria.';
        contrasenaError.classList.remove('hidden');
        isValid = false;
    } else {
        contrasenaError.classList.add('hidden');  /* Oculta el error si es válida */
    }


    /* --- VALIDACIÓN DEL CHECKBOX DE TÉRMINOS --- */

    /* .checked → true si el checkbox está marcado, false si no */
    const terms = document.getElementById('terms').checked;
    const termsError = document.getElementById('terms-error');

    if (!terms) {
        /* El usuario debe aceptar los términos para continuar */
        termsError.textContent = 'Debes aceptar los términos y condiciones.';
        termsError.classList.remove('hidden');
        isValid = false;
    } else {
        termsError.classList.add('hidden');
    }


    /* --- PREVENCIÓN DEL ENVÍO SI HAY ERRORES --- */

    if (!isValid) {
        /* e.preventDefault() → cancela el submit del formulario.
           El formulario NO se envía al servidor (/login) y el
           usuario ve los mensajes de error para corregirlos */
        e.preventDefault();
    }
    /* Si isValid es true, el formulario se envía normalmente
       con method="POST" a action="/login" (Spring Security) */
});


/* ================================================
   2. TOGGLE DE VISIBILIDAD DE CONTRASEÑA
   Alterna entre type="password" (oculto con •••)
   y type="text" (visible) al hacer clic en el ícono ojo
   ================================================ */

/* Obtiene el SVG del ojo por su id */
const togglePassword = document.getElementById('toggle-password');

/* Verificación defensiva: si el elemento existe en el DOM */
if (togglePassword) {

    togglePassword.addEventListener('click', function() {

        /* Obtiene el campo de contraseña */
        const passwordInput = document.getElementById('contrasena');

        if (passwordInput.type === 'password') {
            /* --- MOSTRAR CONTRASEÑA --- */
            passwordInput.type = 'text';         /* Cambia a texto visible */

            /* Cambia el SVG al ícono de "ojo cerrado/tachado"
               innerHTML reemplaza el contenido interno del SVG.
               El SVG padre ya existe con sus atributos (xmlns, class, etc.)
               Solo se reemplaza el <path> interno */
            this.innerHTML = `
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338
                      7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228
                      6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065
                      7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228
                      3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65
                      m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />`;

        } else {
            /* --- OCULTAR CONTRASEÑA --- */
            passwordInput.type = 'password';     /* Vuelve a tipo password (•••) */

            /* Restaura el ícono de "ojo abierto"
               Dos <path> porque el ícono original tiene la pupila
               y el contorno del ojo como rutas separadas */
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
   Flujo de 2 pasos:
   Paso 1: El usuario ingresa su email → se envía
           una petición POST a /api/auth/forgot-password
   Paso 2: El usuario ingresa el token recibido
           por email + nueva contraseña →
           POST a /api/auth/reset-password
   ================================================ */

/* Obtiene todos los elementos del modal */
const modal   = document.getElementById('forgot-password-modal'); /* El div del modal */
const link    = document.getElementById('forgot-password-link');  /* "¿Olvidaste tu contraseña?" */
const closeBtn = document.getElementById('close-modal');          /* Botón Cerrar */
const step1   = document.getElementById('step-1');                /* Div del paso 1 (ingresar email) */
const step2   = document.getElementById('step-2');                /* Div del paso 2 (token + nueva pass) */


/* --- ABRIR EL MODAL --- */

if (link) {
    link.addEventListener('click', (e) => {
        e.preventDefault();                      /* Evita que el href="#" haga scroll al tope */

        /* CAMBIO: era modal.classList.add('modal-open')
           AHORA: modal.classList.add('login-modal-open')
           Porque el CSS usa .login-modal.login-modal-open
           para mostrar el modal (display: flex) */
        modal.classList.add('login-modal-open');

        /* Siempre empieza mostrando el paso 1 al abrir */
        step1.classList.remove('hidden');        /* Muestra el formulario de email */
        step2.classList.add('hidden');           /* Oculta el formulario de token/contraseña */
    });
}


/* --- CERRAR EL MODAL --- */

if (closeBtn) {
    closeBtn.addEventListener('click', () => {
        /* CAMBIO: era modal.classList.remove('modal-open')
           AHORA: modal.classList.remove('login-modal-open') */
        modal.classList.remove('login-modal-open');
    });
}

/* Cerrar el modal también al hacer clic en el fondo oscuro */
modal.addEventListener('click', (e) => {
    /* e.target → el elemento exacto donde se hizo clic.
       Si se hizo clic en el fondo (.login-modal) y no
       en el cuadro interior (.login-modal-box), se cierra */
    if (e.target === modal) {
        modal.classList.remove('login-modal-open');
    }
});


/* --- PASO 1: ENVIAR TOKEN POR EMAIL --- */

const sendTokenBtn = document.getElementById('send-token-btn');

if (sendTokenBtn) {
    sendTokenBtn.addEventListener('click', async () => {

        /* Obtiene y limpia el email del input */
        const email = document.getElementById('reset-email').value.trim();
        const errorElement = document.getElementById('reset-email-error');

        /* Deshabilita el botón para evitar múltiples peticiones
           mientras se espera la respuesta del servidor */
        sendTokenBtn.disabled = true;

        /* Validación del email antes de hacer la petición */
        if (!email || !/\S+@\S+\.\S+/.test(email)) {
            errorElement.textContent = 'Por favor ingresa un correo válido.';
            errorElement.classList.remove('hidden');
            sendTokenBtn.disabled = false;       /* Re-habilita el botón para reintentar */
            return;                              /* Sale de la función, no envía la petición */
        }
        errorElement.classList.add('hidden');    /* Oculta errores anteriores si el email es válido */

        try {
            /* Petición POST a la API de recuperación de contraseña
               fetch → API nativa del navegador para hacer peticiones HTTP
               await → espera la respuesta antes de continuar */
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                /* Content-Type: application/json → le dice al servidor
                   que el body es JSON para que lo procese correctamente */
                headers: { 'Content-Type': 'application/json' },
                /* JSON.stringify → convierte el objeto JS a string JSON
                   { email } → shorthand de { email: email } */
                body: JSON.stringify({ email })
            });

            /* Convierte la respuesta del servidor a objeto JS */
            const data = await response.json();

            if (response.ok) {
                /* response.ok → true si el status HTTP es 200-299
                   Si el servidor procesó bien la petición:
                   - Oculta el paso 1 y muestra el paso 2 */
                step1.classList.add('hidden');
                step2.classList.remove('hidden');
                alert('Token enviado. Revisa tu correo.');
            } else {
                /* El servidor devolvió un error (400, 404, etc.)
                   Muestra el mensaje de error del servidor o uno genérico */
                errorElement.textContent = data.message || 'Error al enviar token.';
                errorElement.classList.remove('hidden');
            }

        } catch (error) {
            /* catch → captura errores de red (sin internet, servidor caído, etc.)
               Estos errores son distintos a errores HTTP (400, 500) */
            console.error('Error de red:', error); /* Log en la consola del navegador */
            errorElement.textContent = 'Error de conexión. Intenta de nuevo.';
            errorElement.classList.remove('hidden');

        } finally {
            /* finally → se ejecuta SIEMPRE, haya error o no.
               Re-habilita el botón para que el usuario pueda reintentar */
            sendTokenBtn.disabled = false;
        }
    });
}


/* --- PASO 2: RESETEAR CONTRASEÑA CON TOKEN --- */

const resetPasswordBtn = document.getElementById('reset-password-btn');

if (resetPasswordBtn) {
    resetPasswordBtn.addEventListener('click', async () => {

        /* Obtiene los tres valores del paso 2 */
        const token           = document.getElementById('reset-token').value.trim();
        const newPassword     = document.getElementById('new-password').value.trim();
        const confirmPassword = document.getElementById('confirm-password').value.trim();
        const errorElement    = document.getElementById('reset-error');

        resetPasswordBtn.disabled = true;        /* Previene doble envío */


        /* --- VALIDACIONES DEL PASO 2 --- */

        /* Valida el token: mínimo 8 caracteres alfanuméricos o guiones */
        if (!token || token.length < 8 || !/^[a-zA-Z0-9-]+$/.test(token)) {
            errorElement.textContent = 'Ingresa un token válido (al menos 8 caracteres alfanuméricos).';
            errorElement.classList.remove('hidden');
            resetPasswordBtn.disabled = false;
            return;
        }

        /* Valida que la nueva contraseña tenga al menos 6 caracteres */
        if (!newPassword || newPassword.length < 6) {
            errorElement.textContent = 'La contraseña debe tener al menos 6 caracteres.';
            errorElement.classList.remove('hidden');
            resetPasswordBtn.disabled = false;
            return;
        }

        /* Valida que ambas contraseñas coincidan */
        if (newPassword !== confirmPassword) {
            errorElement.textContent = 'Las contraseñas no coinciden.';
            errorElement.classList.remove('hidden');
            resetPasswordBtn.disabled = false;
            return;
        }

        /* Si todas las validaciones pasan, oculta el error */
        errorElement.classList.add('hidden');


        /* --- PETICIÓN AL SERVIDOR --- */

        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                /* Envía el token y la nueva contraseña al backend
                   Spring Boot las recibe en el RequestBody */
                body: JSON.stringify({ token, newPassword })
            });

            const data = await response.json();

            if (response.ok) {
                alert('Contraseña actualizada exitosamente.');

                /* Cierra el modal */
                modal.classList.remove('login-modal-open');

                /* Limpia los campos del paso 2 para que no queden
                   datos sensibles si el usuario vuelve a abrir el modal */
                document.getElementById('reset-token').value = '';
                document.getElementById('new-password').value = '';
                document.getElementById('confirm-password').value = '';

            } else {
                /* El token puede estar vencido o ser incorrecto */
                errorElement.textContent = data.message || 'Token inválido o expirado.';
                errorElement.classList.remove('hidden');
            }

        } catch (error) {
            console.error('Error de red:', error);
            errorElement.textContent = 'Error de conexión. Intenta de nuevo.';
            errorElement.classList.remove('hidden');

        } finally {
            resetPasswordBtn.disabled = false;   /* Siempre re-habilita el botón */
        }
    });
}


/* ================================================
   4. DETECCIÓN DE ERROR POR URL (?error=1)
   Spring Security redirige a /login?error cuando
   las credenciales son incorrectas.
   Al detectar el parámetro, se muestra el mensaje
   de error sin necesidad de lógica en el servidor.
   ================================================ */

/* DOMContentLoaded → se ejecuta cuando el HTML está
   completamente cargado y parseado (sin esperar
   imágenes, CSS u otros recursos externos) */
window.addEventListener('DOMContentLoaded', () => {

    /* URLSearchParams → API nativa para leer parámetros de la URL
       window.location.search → devuelve "?error=1" si está presente */
    const urlParams = new URLSearchParams(window.location.search);

    /* .get('error') → devuelve el valor del parámetro "error",
       o null si no existe en la URL */
    if (urlParams.get('error')) {
        const errorMsg = document.getElementById('error-msg');
        if (errorMsg) {
            /* Muestra el div de credenciales incorrectas
               quitando la clase .hidden de Tailwind */
            errorMsg.classList.remove('hidden');
        }
    }
});