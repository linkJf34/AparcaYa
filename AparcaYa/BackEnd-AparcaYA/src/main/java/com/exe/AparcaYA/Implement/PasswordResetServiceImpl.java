package com.exe.AparcaYA.Implement;

import com.exe.AparcaYA.Entity.PasswordResetToken;
import com.exe.AparcaYA.Entity.Usuario;
import com.exe.AparcaYA.Repository.PasswordResetTokenRepository;
import com.exe.AparcaYA.Service.PasswordResetService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import jakarta.mail.*;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.Properties;

@Service
@RequiredArgsConstructor
public class PasswordResetServiceImpl implements PasswordResetService {

    private final PasswordResetTokenRepository tokenRepository;

    private static final int TOKEN_LENGTH = 8;
    private static final int EXPIRATION_HOURS = 1;

    // Configuración de email
    private static final String REMITENTE = "aparcaya.parkingtech@gmail.com";
    private static final String PASSWORD = "bnsw wtcn zqjh dunq";

    @Override
    @Transactional
    public String createPasswordResetToken(Usuario usuario) {
        // Eliminar tokens previos del usuario
        tokenRepository.deleteByUsuario(usuario);

        // Generar token alfanumérico de 8 caracteres
        String token = generateToken();

        // Crear y guardar el token
        PasswordResetToken resetToken = new PasswordResetToken();
        resetToken.setToken(token);
        resetToken.setUsuario(usuario);
        resetToken.setExpirationDate(LocalDateTime.now().plusHours(EXPIRATION_HOURS));
        resetToken.setUsed(false);

        tokenRepository.save(resetToken);

        System.out.println("✅ Token creado: " + token + " para usuario: " + usuario.getCorreo());
        return token;
    }

    @Override
    public Optional<PasswordResetToken> validateToken(String token) {
        Optional<PasswordResetToken> resetToken = tokenRepository.findByToken(token);

        if (resetToken.isEmpty()) {
            System.out.println("❌ Token no encontrado: " + token);
            return Optional.empty();
        }

        PasswordResetToken tokenEntity = resetToken.get();

        // Verificar si el token ha expirado o ya fue usado
        if (tokenEntity.getExpirationDate().isBefore(LocalDateTime.now())) {
            System.out.println("❌ Token expirado: " + token);
            return Optional.empty();
        }

        if (tokenEntity.isUsed()) {
            System.out.println("❌ Token ya usado: " + token);
            return Optional.empty();
        }

        System.out.println("✅ Token válido: " + token);
        return resetToken;
    }

    @Override
    @Transactional
    public void markTokenAsUsed(String token) {
        tokenRepository.findByToken(token).ifPresent(resetToken -> {
            resetToken.setUsed(true);
            tokenRepository.save(resetToken);
            System.out.println("✅ Token marcado como usado: " + token);
        });
    }

    @Override
    public void sendResetEmail(String email, String token) throws MessagingException {
        // Configuración del servidor SMTP de Gmail
        Properties props = new Properties();
        props.put("mail.smtp.auth", "true");
        props.put("mail.smtp.starttls.enable", "true");
        props.put("mail.smtp.host", "smtp.gmail.com");
        props.put("mail.smtp.port", "587");
        props.put("mail.smtp.ssl.trust", "smtp.gmail.com");

        // Crear la sesión
        Session session = Session.getInstance(props, new Authenticator() {
            protected PasswordAuthentication getPasswordAuthentication() {
                return new PasswordAuthentication(REMITENTE, PASSWORD);
            }
        });

        try {
            Message message = new MimeMessage(session);
            message.setFrom(new InternetAddress(REMITENTE));
            message.setRecipients(Message.RecipientType.TO, InternetAddress.parse(email));
            message.setSubject("Recuperación de Contraseña - Aparca Ya");

            String htmlContent = buildEmailTemplate(token);

            // Configurar el mensaje como HTML
            message.setContent(htmlContent, "text/html; charset=utf-8");

            // Enviar el mensaje
            Transport.send(message);
            System.out.println("✅ Email de recuperación enviado a: " + email);

        } catch (MessagingException e) {
            System.err.println("❌ Error enviando email a " + email + ": " + e.getMessage());
            e.printStackTrace();
            throw e;
        }
    }

    @Override
    @Transactional
    public void cleanExpiredTokens() {
        tokenRepository.deleteByExpirationDateBefore(LocalDateTime.now());
        System.out.println("✅ Tokens expirados eliminados");
    }

    private String generateToken() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        SecureRandom random = new SecureRandom();
        StringBuilder token = new StringBuilder(TOKEN_LENGTH);

        for (int i = 0; i < TOKEN_LENGTH; i++) {
            token.append(chars.charAt(random.nextInt(chars.length())));
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
                "body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f7fa; padding: 20px; }" +
                ".email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }" +
                ".email-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; }" +
                ".email-header h1 { color: #ffffff; font-size: 28px; font-weight: 600; margin: 0; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); }" +
                ".email-icon { width: 80px; height: 80px; background-color: rgba(255, 255, 255, 0.2); border-radius: 50%; margin: 0 auto 15px auto; font-size: 40px; line-height: 80px; text-align: center; }" +
                ".email-body { padding: 40px 35px; color: #333333; line-height: 1.8; }" +
                ".email-body h2 { color: #667eea; font-size: 22px; margin-bottom: 20px; font-weight: 600; }" +
                ".token-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px; text-align: center; margin: 30px 0; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3); }" +
                ".token { font-size: 42px; font-weight: bold; color: #ffffff; letter-spacing: 8px; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); }" +
                ".info-box { background-color: #e3f2fd; padding: 20px 25px; border-radius: 8px; border-left: 4px solid #2196F3; margin: 25px 0; }" +
                ".info-box p { color: #1565c0; font-size: 15px; margin: 0; }" +
                ".warning-box { background-color: #fff3cd; padding: 20px 25px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 25px 0; }" +
                ".warning-box p { color: #856404; font-size: 15px; margin: 0; }" +
                ".divider { height: 1px; background: linear-gradient(to right, transparent, #e0e0e0, transparent); margin: 30px 0; }" +
                ".email-footer { background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef; }" +
                ".email-footer p { color: #6c757d; font-size: 14px; margin: 8px 0; }" +
                ".social-icons { margin: 20px 0; text-align: center; }" +
                ".social-icons a { display: inline-block; width: 40px; height: 40px; border-radius: 8px; text-decoration: none; margin: 0 8px; transition: transform 0.3s ease, opacity 0.3s ease; vertical-align: middle; overflow: hidden; }" +
                ".social-icons a:hover { transform: translateY(-3px); opacity: 0.9; }" +
                ".social-icons img { width: 40px; height: 40px; display: block; }" +
                ".footer-company { font-weight: 600; color: #333; font-size: 16px; margin-bottom: 10px; }" +
                ".footer-note { color: #6c757d; font-size: 13px; margin-bottom: 10px; }" +
                ".footer-copyright { font-size: 12px; color: #999; margin-top: 15px; }" +
                "@media only screen and (max-width: 600px) { .email-header { padding: 30px 20px; } .email-body { padding: 30px 20px; } .email-header h1 { font-size: 24px; } .token { font-size: 36px; letter-spacing: 6px; } }" +
                "</style>" +
                "</head>" +
                "<body>" +
                "<div class='email-container'>" +
                "<div class='email-header'>" +
                "<div class='email-icon'>🔐</div>" +
                "<h1>Recuperación de Contraseña</h1>" +
                "</div>" +
                "<div class='email-body'>" +
                "<h2>Estimado(a) usuario(a),</h2>" +
                "<p style='font-size: 16px; color: #555555; margin-bottom: 20px;'>" +
                "Has solicitado restablecer tu contraseña en <strong>Aparca Ya</strong>." +
                "</p>" +
                "<p style='font-size: 16px; color: #555555; margin-bottom: 10px;'>" +
                "Usa el siguiente código para continuar con el proceso:" +
                "</p>" +
                "<div class='token-box'>" +
                "<div class='token'>" + token + "</div>" +
                "</div>" +
                "<div class='info-box'>" +
                "<p><strong>⏰ Importante:</strong> Este código es válido por <strong>1 hora</strong>.</p>" +
                "</div>" +
                "<div class='warning-box'>" +
                "<p><strong>⚠️ Seguridad:</strong> Si no solicitaste este cambio, ignora este correo. Tu contraseña permanecerá sin cambios.</p>" +
                "</div>" +
                "<div class='divider'></div>" +
                "<p style='color: #666; font-size: 14px; margin-top: 20px;'>" +
                "Si tienes alguna pregunta o necesitas asistencia, no dudes en contactarnos." +
                "</p>" +
                "</div>" +
                "<div class='email-footer'>" +
                "<div class='social-icons'>" +
                "<a href='https://www.facebook.com/tupagina' target='_blank' title='Facebook'>" +
                "<img src='https://cdn-icons-png.flaticon.com/512/124/124010.png' alt='Facebook'>" +
                "</a>" +
                "<a href='https://twitter.com/tuperfil' target='_blank' title='Twitter'>" +
                "<img src='https://cdn-icons-png.flaticon.com/512/124/124021.png' alt='Twitter'>" +
                "</a>" +
                "<a href='https://www.instagram.com/tuperfil' target='_blank' title='Instagram'>" +
                "<img src='https://cdn-icons-png.flaticon.com/512/174/174855.png' alt='Instagram'>" +
                "</a>" +
                "<a href='https://www.linkedin.com/company/tuempresa' target='_blank' title='LinkedIn'>" +
                "<img src='https://cdn-icons-png.flaticon.com/512/174/174857.png' alt='LinkedIn'>" +
                "</a>" +
                "</div>" +
                "<p class='footer-company'>Aparcaya Parking Tech</p>" +
                "<p class='footer-note'>Este es un correo automático, por favor no responder</p>" +
                "<p class='footer-copyright'>© 2024 Aparcaya Parking Tech - Todos los derechos reservados</p>" +
                "</div>" +
                "</div>" +
                "</body>" +
                "</html>";
    }
}
