package com.exe.AparcaYA.Controllers;

import com.exe.AparcaYA.Config.JwtUtil;
import com.exe.AparcaYA.Entity.PasswordResetToken;
import com.exe.AparcaYA.Entity.Sede;
import com.exe.AparcaYA.Entity.Usuario;
import com.exe.AparcaYA.Service.LogAccesoService;
import com.exe.AparcaYA.Service.PasswordResetService;
import com.exe.AparcaYA.Service.SedeService;
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

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Controller
@RequiredArgsConstructor
public class AuthController {

    private final PasswordResetService  passwordResetService;
    private final UsuarioService        usuarioService;
    private final SedeService           sedeService;
    private final PasswordEncoder       passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtUtil               jwtUtil;
    private final UserDetailsService    userDetailsService;
    private final LogAccesoService      logAccesoService;

    // =====================================================================
    // VISTAS
    // =====================================================================

    @GetMapping("/")
    public String index() { return "Index"; }

    @GetMapping("/login")
    public String loginPage() { return "Login"; }

    @GetMapping("/registro")
    public String registroPage() { return "Registro_1"; }

    // =====================================================================
    // RECUPERACIÓN DE CONTRASEÑA
    // =====================================================================

    @PostMapping("/api/auth/forgot-password")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> forgotPassword(
            @RequestBody Map<String, String> body) {

        String email = body.get("email");

        if (email == null || email.isBlank() ||
                !email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false, "message", "Correo inválido"));
        }

        email = email.trim().toLowerCase();
        log.info("Solicitud de recuperación de contraseña para: {}", email);

        Optional<Usuario> usuarioOpt = usuarioService.findByCorreo(email);
        if (usuarioOpt.isEmpty()) {
            log.warn("Solicitud de recuperación para correo no registrado: {}", email);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Si el correo está registrado, recibirás un código en breve"));
        }

        try {
            String token = passwordResetService.createPasswordResetToken(usuarioOpt.get());
            passwordResetService.sendResetEmail(email, token);
            log.info("Token de recuperación enviado a: {}", email);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Si el correo está registrado, recibirás un código en breve"));
        } catch (Exception e) {
            log.error("Error enviando email de recuperación a {}: {}", email, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "No se pudo enviar el correo. Intenta de nuevo más tarde."));
        }
    }

    @PostMapping("/api/auth/reset-password")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> resetPassword(
            @RequestBody Map<String, String> body) {

        String token       = body.get("token");
        String newPassword = body.get("newPassword");

        if (token == null || token.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false, "message", "El token es obligatorio"));
        }
        if (newPassword == null || newPassword.length() < 8) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "La contraseña debe tener al menos 8 caracteres"));
        }

        log.info("Intento de reset de contraseña con token: {}", token.toUpperCase());

        Optional<PasswordResetToken> tokenOpt =
                passwordResetService.validateToken(token.trim().toUpperCase());

        if (tokenOpt.isEmpty()) {
            log.warn("Token inválido o expirado: {}", token);
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "El código es inválido o ya expiró. Solicita uno nuevo."));
        }

        try {
            Usuario usuario = tokenOpt.get().getUsuario();
            usuario.setContrasena(passwordEncoder.encode(newPassword));
            usuarioService.save(usuario);
            passwordResetService.markTokenAsUsed(token.trim().toUpperCase());
            log.info("Contraseña actualizada exitosamente para: {}", usuario.getCorreo());
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Contraseña actualizada exitosamente"));
        } catch (Exception e) {
            log.error("Error actualizando contraseña: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false, "message", "Error interno. Intenta de nuevo."));
        }
    }

    // =====================================================================
    // LOGIN
    // =====================================================================

    @PostMapping("/api/auth/login")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> login(
            @RequestBody Map<String, String> body) {

        String correo     = body.get("correo");
        String contrasena = body.get("contrasena");

        if (correo == null || contrasena == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Correo y contraseña son obligatorios"));
        }

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(correo, contrasena));
        } catch (BadCredentialsException e) {
            return ResponseEntity.status(401).body(Map.of(
                    "success", false,
                    "message", "Correo o contraseña incorrectos"));
        }

        UserDetails userDetails = userDetailsService.loadUserByUsername(correo);
        Optional<Usuario> usuarioOpt = usuarioService.findByCorreo(correo);

        if (usuarioOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of(
                    "success", false, "message", "Usuario no encontrado"));
        }

        Usuario usuario = usuarioOpt.get();
        String  rol     = usuario.getRol().name();


        Long sedeId = null;
        if ("ADMINISTRADOR_SEDE".equals(rol)) {
            Sede primerasSede = sedeService.findByIdUsuario(usuario.getIdUsuario());
            if (primerasSede != null) sedeId = primerasSede.getIdSede();
        } else if ("OPERARIO".equals(rol)) {
            if (usuario.getSedeAsignada() != null)
                sedeId = usuario.getSedeAsignada().getIdSede();
        }

        String token = jwtUtil.generateToken(userDetails, rol, sedeId);

        logAccesoService.registrarAcceso(usuario);

        String redirectUrl = switch (usuario.getRol()) {
            case ADMIN              -> "/dashboard/administradorGeneral";
            case ADMINISTRADOR_SEDE -> "/dashboard/administradorSede";
            case OPERARIO           -> "/dashboard/trabajadorParqueadero";
            case CLIENTE            -> "/dashboard/cliente";
            default                 -> "/login";
        };

        Map<String, Object> respuesta = new HashMap<>();
        respuesta.put("success",     true);
        respuesta.put("token",       token);
        respuesta.put("rol",         rol);
        respuesta.put("redirectUrl", redirectUrl);
        respuesta.put("nombre",      usuario.getNombre());
        if (sedeId != null) respuesta.put("sedeId", sedeId);

        return ResponseEntity.ok(respuesta);
    }

    // =====================================================================
    // CAMBIAR SEDE ACTIVA
    // =====================================================================

    @PostMapping("/api/auth/cambiar-sede")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> cambiarSede(
            @RequestBody Map<String, Object> body,
            @RequestHeader("Authorization") String authHeader) {

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return ResponseEntity.status(401).body(Map.of(
                    "success", false, "message", "No autenticado"));
        }

        String tokenActual = authHeader.substring(7);
        String correo;
        try {
            correo = jwtUtil.extractUsername(tokenActual);
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of(
                    "success", false, "message", "Token inválido"));
        }

        Object sedeIdObj = body.get("sedeId");
        if (sedeIdObj == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false, "message", "sedeId es obligatorio"));
        }
        Long sedeId;
        try {
            sedeId = Long.parseLong(sedeIdObj.toString());
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false, "message", "sedeId inválido"));
        }

        Optional<Usuario> usuarioOpt = usuarioService.findByCorreo(correo);
        if (usuarioOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of(
                    "success", false, "message", "Usuario no encontrado"));
        }
        Usuario usuario = usuarioOpt.get();
        if (!"ADMINISTRADOR_SEDE".equals(usuario.getRol().name())) {
            return ResponseEntity.status(403).body(Map.of(
                    "success", false,
                    "message", "Solo los administradores de sede pueden cambiar de sede"));
        }

        Optional<Sede> sedeOpt = sedeService.findById(sedeId);
        if (sedeOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of(
                    "success", false, "message", "Sede no encontrada"));
        }
        Sede sede = sedeOpt.get();
        if (!sede.getIdUsuario().getIdUsuario().equals(usuario.getIdUsuario())) {
            return ResponseEntity.status(403).body(Map.of(
                    "success", false,
                    "message", "No tiene permisos sobre esta sede"));
        }

        UserDetails userDetails = userDetailsService.loadUserByUsername(correo);
        String nuevoToken = jwtUtil.generateToken(
                userDetails, usuario.getRol().name(), sedeId);

        log.info("Sede activa cambiada a id={} para admin={}", sedeId, correo);

        Map<String, Object> respuesta = new HashMap<>();
        respuesta.put("success",    true);
        respuesta.put("token",      nuevoToken);
        respuesta.put("sedeId",     sedeId);
        respuesta.put("sedeNombre", sede.getNombre());
        return ResponseEntity.ok(respuesta);
    }
}