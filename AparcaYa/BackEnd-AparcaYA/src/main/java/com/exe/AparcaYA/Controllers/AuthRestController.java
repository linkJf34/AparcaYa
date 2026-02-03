package com.exe.AparcaYA.Controllers;

import com.exe.AparcaYA.Dto.ApiResponse;
import com.exe.AparcaYA.Dto.ForgotPasswordRequest;
import com.exe.AparcaYA.Dto.ResetPasswordRequest;
import com.exe.AparcaYA.Entity.PasswordResetToken;
import com.exe.AparcaYA.Entity.Usuario;
import com.exe.AparcaYA.Service.PasswordResetService;
import com.exe.AparcaYA.Service.UsuarioService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AuthRestController {

    private final UsuarioService usuarioService;
    private final PasswordResetService passwordResetService;
    private final PasswordEncoder passwordEncoder;

    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse> forgotPassword(@RequestBody ForgotPasswordRequest request) {
        System.out.println("=== SOLICITUD DE RECUPERACIÓN DE CONTRASEÑA ===");
        System.out.println("Email: " + request.getEmail());

        try {
            Optional<Usuario> usuarioOpt = usuarioService.findByCorreo(request.getEmail());

            if (usuarioOpt.isEmpty()) {
                System.out.println("⚠️ Usuario no encontrado: " + request.getEmail());
                // Por seguridad, no revelar si el usuario existe o no
                return ResponseEntity.ok(new ApiResponse(true, "Si el correo existe, recibirás un token."));
            }

            Usuario usuario = usuarioOpt.get();
            String token = passwordResetService.createPasswordResetToken(usuario);

            System.out.println("✅ Token generado: " + token);

            // Enviar correo con el token
            passwordResetService.sendResetEmail(usuario.getCorreo(), token);

            System.out.println("✅ Correo de recuperación enviado exitosamente");

            return ResponseEntity.ok(new ApiResponse(true, "Token enviado al correo."));

        } catch (Exception e) {
            System.err.println("❌ Error en recuperación de contraseña: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error al enviar token."));
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse> resetPassword(@RequestBody ResetPasswordRequest request) {
        System.out.println("=== SOLICITUD DE RESET DE CONTRASEÑA ===");
        System.out.println("Token: " + request.getToken());

        try {
            // Validar token
            Optional<PasswordResetToken> tokenOpt = passwordResetService.validateToken(request.getToken());

            if (tokenOpt.isEmpty()) {
                System.out.println("❌ Token inválido o expirado: " + request.getToken());
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(new ApiResponse(false, "Token inválido o expirado."));
            }

            PasswordResetToken resetToken = tokenOpt.get();
            Usuario usuario = resetToken.getUsuario();

            // Actualizar contraseña
            usuario.setContrasena(passwordEncoder.encode(request.getNewPassword()));
            usuarioService.save(usuario);

            // Marcar token como usado
            passwordResetService.markTokenAsUsed(request.getToken());

            System.out.println("✅ Contraseña actualizada para usuario: " + usuario.getCorreo());

            return ResponseEntity.ok(new ApiResponse(true, "Contraseña actualizada exitosamente."));

        } catch (Exception e) {
            System.err.println("❌ Error reseteando contraseña: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error al actualizar contraseña."));
        }
    }
}