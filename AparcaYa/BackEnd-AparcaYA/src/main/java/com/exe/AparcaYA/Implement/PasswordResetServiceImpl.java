package com.exe.AparcaYA.Implement;

import com.exe.AparcaYA.Entity.PasswordResetToken;
import com.exe.AparcaYA.Entity.Usuario;
import com.exe.AparcaYA.Repository.PasswordResetTokenRepository;
import com.exe.AparcaYA.Service.PasswordResetService;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class PasswordResetServiceImpl implements PasswordResetService {

    private final PasswordResetTokenRepository tokenRepository;

    // ✅ FIX: usa JavaMailSender (el bean de Spring ya configurado en application.properties)
    // Antes: creaba una sesión SMTP manual con credenciales hardcodeadas en el código
    //        → contraseña de Gmail expuesta en el fuente
    //        → configuración duplicada e inconsistente con el resto de la app
    // Ahora: reutiliza el JavaMailSender inyectado, igual que UsuarioController
    private final JavaMailSender mailSender;

    private static final int    TOKEN_LENGTH      = 8;
    private static final int    EXPIRATION_HOURS  = 1;
    private static final String REMITENTE         = "aparcaya.parkingtech@gmail.com";
    private static final String CHARS             = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    // =====================================================================
    // CREAR TOKEN
    // =====================================================================

    @Override
    @Transactional
    public String createPasswordResetToken(Usuario usuario) {
        // Eliminar tokens previos del usuario para que solo exista uno activo
        tokenRepository.deleteByUsuario(usuario);

        String token = generateToken();

        PasswordResetToken resetToken = new PasswordResetToken();
        resetToken.setToken(token);
        resetToken.setUsuario(usuario);
        resetToken.setExpirationDate(LocalDateTime.now().plusHours(EXPIRATION_HOURS));
        resetToken.setUsed(false);

        tokenRepository.save(resetToken);
        log.info("Token creado para usuario: {}", usuario.getCorreo());

        return token;
    }

    // =====================================================================
    // VALIDAR TOKEN
    // =====================================================================

    @Override
    public Optional<PasswordResetToken> validateToken(String token) {
        Optional<PasswordResetToken> resetToken = tokenRepository.findByToken(token);

        if (resetToken.isEmpty()) {
            log.warn("Token no encontrado: {}", token);
            return Optional.empty();
        }

        PasswordResetToken tokenEntity = resetToken.get();

        if (tokenEntity.getExpirationDate().isBefore(LocalDateTime.now())) {
            log.warn("Token expirado: {}", token);
            return Optional.empty();
        }

        if (tokenEntity.isUsed()) {
            log.warn("Token ya usado: {}", token);
            return Optional.empty();
        }

        log.info("Token válido: {}", token);
        return resetToken;
    }

    // =====================================================================
    // MARCAR TOKEN COMO USADO
    // =====================================================================

    @Override
    @Transactional
    public void markTokenAsUsed(String token) {
        tokenRepository.findByToken(token).ifPresent(resetToken -> {
            resetToken.setUsed(true);
            tokenRepository.save(resetToken);
            log.info("Token marcado como usado: {}", token);
        });
    }

    // =====================================================================
    // ENVIAR EMAIL DE RECUPERACIÓN
    //
    // ✅ FIX: reemplaza Session/Transport manual por MimeMessageHelper de Spring
    // Ventajas:
    //   - Reutiliza la configuración de application.properties (sin duplicados)
    //   - No expone credenciales en el código fuente
    //   - Consistente con el envío de correos en UsuarioController
    // =====================================================================

    @Override
    public void sendResetEmail(String email, String token) throws MessagingException {
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

        helper.setFrom(REMITENTE);
        helper.setTo(email);
        helper.setSubject("Recuperación de Contraseña - Aparca Ya");
        helper.setText(buildEmailTemplate(token), true);

        mailSender.send(message);
        log.info("Email de recuperación enviado a: {}", email);
    }

    // =====================================================================
    // LIMPIAR TOKENS EXPIRADOS
    // =====================================================================

    @Override
    @Transactional
    public void cleanExpiredTokens() {
        tokenRepository.deleteByExpirationDateBefore(LocalDateTime.now());
        log.info("Tokens expirados eliminados");
    }

    // =====================================================================
    // UTILIDADES PRIVADAS
    // =====================================================================

    private String generateToken() {
        SecureRandom random = new SecureRandom();
        StringBuilder token = new StringBuilder(TOKEN_LENGTH);
        for (int i = 0; i < TOKEN_LENGTH; i++) {
            token.append(CHARS.charAt(random.nextInt(CHARS.length())));
        }
        return token.toString();
    }

    private String buildEmailTemplate(String token) {
        return "<!DOCTYPE html>" +
                "<html lang='es'>" +
                "<head>" +
                "<meta charset='UTF-8'>" +
                "<meta name='viewport' content='width=device-width, initial-scale=1.0'>" +
                "<style>" +
                "* { margin: 0; padding: 0; box-sizing: border-box; }" +
                "body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;" +
                "       background-color: #f5f7fa; padding: 20px; }" +
                ".container { max-width: 600px; margin: 0 auto; background: #fff;" +
                "             border-radius: 12px; overflow: hidden;" +
                "             box-shadow: 0 4px 12px rgba(0,0,0,.1); }" +
                ".header { background: linear-gradient(135deg,#667eea,#764ba2);" +
                "          padding: 40px 30px; text-align: center; }" +
                ".header h1 { color:#fff; font-size:28px; font-weight:600; margin:0; }" +
                ".icon { width:80px; height:80px; background:rgba(255,255,255,.2);" +
                "        border-radius:50%; margin:0 auto 15px; font-size:40px;" +
                "        line-height:80px; text-align:center; }" +
                ".body { padding: 40px 35px; color: #333; line-height: 1.8; }" +
                ".body h2 { color:#667eea; font-size:22px; margin-bottom:20px; }" +
                ".token-box { background: linear-gradient(135deg,#667eea,#764ba2);" +
                "             padding:30px; border-radius:12px; text-align:center;" +
                "             margin:30px 0; box-shadow:0 4px 12px rgba(102,126,234,.3); }" +
                ".token { font-size:42px; font-weight:bold; color:#fff;" +
                "         letter-spacing:8px; text-shadow:0 2px 4px rgba(0,0,0,.2); }" +
                ".info-box { background:#e3f2fd; padding:20px 25px; border-radius:8px;" +
                "            border-left:4px solid #2196F3; margin:25px 0; }" +
                ".info-box p { color:#1565c0; font-size:15px; margin:0; }" +
                ".warning-box { background:#fff3cd; padding:20px 25px; border-radius:8px;" +
                "               border-left:4px solid #ffc107; margin:25px 0; }" +
                ".warning-box p { color:#856404; font-size:15px; margin:0; }" +
                ".divider { height:1px; background:linear-gradient(to right,transparent,#e0e0e0,transparent);" +
                "           margin:30px 0; }" +
                ".footer { background:#f8f9fa; padding:30px; text-align:center;" +
                "          border-top:1px solid #e9ecef; }" +
                ".footer p { color:#6c757d; font-size:13px; margin:6px 0; }" +
                "@media (max-width:600px) {" +
                "  .header { padding:30px 20px; } .body { padding:30px 20px; }" +
                "  .header h1 { font-size:24px; } .token { font-size:36px; letter-spacing:6px; }" +
                "}" +
                "</style>" +
                "</head>" +
                "<body>" +
                "<div class='container'>" +
                "  <div class='header'>" +
                "    <div class='icon'>🔐</div>" +
                "    <h1>Recuperación de Contraseña</h1>" +
                "  </div>" +
                "  <div class='body'>" +
                "    <h2>Estimado(a) usuario(a),</h2>" +
                "    <p style='font-size:16px;color:#555;margin-bottom:20px;'>" +
                "      Has solicitado restablecer tu contraseña en <strong>Aparca Ya</strong>." +
                "    </p>" +
                "    <p style='font-size:16px;color:#555;margin-bottom:10px;'>" +
                "      Usa el siguiente código para continuar:" +
                "    </p>" +
                "    <div class='token-box'>" +
                "      <div class='token'>" + token + "</div>" +
                "    </div>" +
                "    <div class='info-box'>" +
                "      <p><strong>⏰ Importante:</strong> Este código es válido por <strong>1 hora</strong>.</p>" +
                "    </div>" +
                "    <div class='warning-box'>" +
                "      <p><strong>⚠️ Seguridad:</strong> Si no solicitaste este cambio, ignora este correo.</p>" +
                "    </div>" +
                "    <div class='divider'></div>" +
                "    <p style='color:#666;font-size:14px;margin-top:20px;'>" +
                "      Si tienes alguna pregunta, no dudes en contactarnos." +
                "    </p>" +
                "  </div>" +
                "  <div class='footer'>" +
                "    <p style='font-weight:600;color:#333;font-size:16px;'>Aparcaya Parking Tech</p>" +
                "    <p>Este es un correo automático, por favor no responder</p>" +
                "    <p style='font-size:12px;color:#999;margin-top:15px;'>" +
                "      © 2024 Aparcaya Parking Tech - Todos los derechos reservados" +
                "    </p>" +
                "  </div>" +
                "</div>" +
                "</body>" +
                "</html>";
    }
}