package com.exe.AparcaYA.Controllers;

import com.exe.AparcaYA.Config.JwtUtil;
import com.exe.AparcaYA.Entity.PasswordResetToken;
import com.exe.AparcaYA.Entity.Usuario;
import com.exe.AparcaYA.Service.LogAccesoService;
import com.exe.AparcaYA.Service.PasswordResetService;
import com.exe.AparcaYA.Service.UsuarioService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@Slf4j
@Controller
@RequiredArgsConstructor
public class AuthController {


    private final PasswordResetService passwordResetService;
    private final UsuarioService        usuarioService;
    private final PasswordEncoder       passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;
    private final UserDetailsService userDetailsService;
    private final LogAccesoService logAccesoService;

    // =====================================================================
    // VISTAS
    // =====================================================================

    @GetMapping("/")
    public String index() {
        return "Index";
    }

    @GetMapping("/login")
    public String loginPage() {
        return "Login";
    }

    @GetMapping("/registro")
    public String registroPage() {
        return "Registro_1";
    }

    // =====================================================================
    // RECUPERACIÓN DE CONTRASEÑA
    //
    // ANTES: endpoints comentados → JS recibía 404 → mostraba
    //        "Error de conexión. Intenta de nuevo." (mensaje incorrecto)
    //
    // AHORA: flujo completo implementado en dos pasos:
    //   POST /api/auth/forgot-password → genera token + envía email
    //   POST /api/auth/reset-password  → valida token + actualiza contraseña
    //
    // Ambos endpoints están en permitAll() de SecurityConfig (/api/auth/**)
    // =====================================================================

    /**
     * PASO 1 — Solicitar token de recuperación.
     * El JS envía el correo, el backend verifica que existe,
     * genera el token y lo envía por email.
     *
     * POST /api/auth/forgot-password
     * Body: { "email": "usuario@ejemplo.com" }
     *
     * Respuestas:
     *   200 OK      → token enviado (siempre, incluso si el correo no existe,
     *                  para no revelar qué correos están registrados)
     *   500 Error   → fallo al enviar el email
     */
    @PostMapping("/api/auth/forgot-password")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> forgotPassword(
            @RequestBody Map<String, String> body) {

        String email = body.get("email");

        // Validación básica del formato
        if (email == null || email.isBlank() ||
                !email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Correo inválido"
            ));
        }

        email = email.trim().toLowerCase();
        log.info("Solicitud de recuperación de contraseña para: {}", email);

        // Buscar el usuario — respuesta genérica para no revelar si existe
        Optional<Usuario> usuarioOpt = usuarioService.findByCorreo(email);

        if (usuarioOpt.isEmpty()) {
            // No revelar que el correo no está registrado (seguridad)
            log.warn("Solicitud de recuperación para correo no registrado: {}", email);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Si el correo está registrado, recibirás un código en breve"
            ));
        }

        try {
            String token = passwordResetService.createPasswordResetToken(usuarioOpt.get());
            passwordResetService.sendResetEmail(email, token);
            log.info("Token de recuperación enviado a: {}", email);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Si el correo está registrado, recibirás un código en breve"
            ));

        } catch (Exception e) {
            log.error("Error enviando email de recuperación a {}: {}", email, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "No se pudo enviar el correo. Intenta de nuevo más tarde."
            ));
        }
    }

    /**
     * PASO 2 — Restablecer contraseña con token.
     * El JS envía el token y la nueva contraseña.
     * El backend valida el token, actualiza la contraseña y lo marca como usado.
     *
     * POST /api/auth/reset-password
     * Body: { "token": "ABC12345", "newPassword": "nuevaPass123" }
     *
     * Respuestas:
     *   200 OK       → contraseña actualizada
     *   400 Bad Req  → token inválido, expirado, ya usado o contraseña inválida
     */
    @PostMapping("/api/auth/reset-password")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> resetPassword(
            @RequestBody Map<String, String> body) {

        String token       = body.get("token");
        String newPassword = body.get("newPassword");

        // Validación de campos
        if (token == null || token.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "El token es obligatorio"
            ));
        }

        // ✅ FIX: mínimo 8 caracteres — consistente con el registro
        // Antes el JS pedía mínimo 6, inconsistente con el registro que pide 8
        if (newPassword == null || newPassword.length() < 8) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "La contraseña debe tener al menos 8 caracteres"
            ));
        }

        log.info("Intento de reset de contraseña con token: {}", token.toUpperCase());

        // Validar token
        Optional<PasswordResetToken> tokenOpt =
                passwordResetService.validateToken(token.trim().toUpperCase());

        if (tokenOpt.isEmpty()) {
            log.warn("Token inválido o expirado: {}", token);
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "El código es inválido o ya expiró. Solicita uno nuevo."
            ));
        }

        try {
            // Actualizar contraseña del usuario
            Usuario usuario = tokenOpt.get().getUsuario();
            usuario.setContrasena(passwordEncoder.encode(newPassword));
            usuarioService.save(usuario);

            // Marcar token como usado para que no pueda reutilizarse
            passwordResetService.markTokenAsUsed(token.trim().toUpperCase());

            log.info("Contraseña actualizada exitosamente para: {}", usuario.getCorreo());

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Contraseña actualizada exitosamente"
            ));

        } catch (Exception e) {
            log.error("Error actualizando contraseña: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "Error interno. Intenta de nuevo."
            ));
        }
    }

    @PostMapping("/api/auth/login")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> login(
            @RequestBody Map<String, String> body) {

        String correo     = body.get("correo");
        String contrasena = body.get("contrasena");

        if (correo == null || contrasena == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Correo y contraseña son obligatorios"
            ));
        }

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(correo, contrasena)
            );
        } catch (BadCredentialsException e) {
            return ResponseEntity.status(401).body(Map.of(
                    "success", false,
                    "message", "Correo o contraseña incorrectos"
            ));
        }

        UserDetails userDetails = userDetailsService.loadUserByUsername(correo);
        Optional<Usuario> usuarioOpt = usuarioService.findByCorreo(correo);

        if (usuarioOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of(
                    "success", false,
                    "message", "Usuario no encontrado"
            ));
        }

        Usuario usuario = usuarioOpt.get();
        String rol = usuario.getRol().name();
        String token = jwtUtil.generateToken(userDetails, rol);

        // Registrar acceso
        logAccesoService.registrarAcceso(usuario);

        String redirectUrl = switch (usuario.getRol()) {
            case ADMIN              -> "/dashboard/administradorGeneral";
            case ADMINISTRADOR_SEDE -> "/dashboard/administradorSede";
            case OPERARIO           -> "/dashboard/trabajadorParqueadero";
            case CLIENTE            -> "/dashboard/cliente";
            default                 -> "/login";
        };

        return ResponseEntity.ok(Map.of(
                "success",     true,
                "token",       token,
                "rol",         rol,
                "redirectUrl", redirectUrl,
                "nombre",      usuario.getNombre()
        ));
    }
}