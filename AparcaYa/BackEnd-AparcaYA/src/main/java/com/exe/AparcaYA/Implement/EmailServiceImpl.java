package com.exe.AparcaYA.Implement;

import com.exe.AparcaYA.Service.IEmailService;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.util.List;

@Service
public class EmailServiceImpl implements IEmailService {

    // ✅ CAMBIO #10: JavaMailSender inyectado — Spring Boot lo autoconfigura
    // con spring.mail.* de application.properties. Eliminada la sesión manual.
    @Autowired
    private JavaMailSender mailSender;

    @Autowired
    private TemplateEngine templateEngine;

    // ✅ CAMBIO 3 (anterior): Credencial leída desde application.properties
    @Value("${spring.mail.username}")
    private String remitente;

    /**
     * Procesar plantilla HTML con Thymeleaf
     */
    private String procesarPlantilla(String asunto, String mensaje) {
        Context context = new Context();
        context.setVariable("asunto", asunto);
        context.setVariable("mensaje", mensaje.replace("\n", "<br>"));
        return templateEngine.process("emails/plantilla-estandar", context);
    }

    @Override
    public void enviarCorreoUnitario(String destinatario, String asunto, String mensaje)
            throws MessagingException {

        String htmlContent = procesarPlantilla(asunto, mensaje);

        MimeMessage mimeMessage = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");

        helper.setFrom(remitente);
        helper.setTo(destinatario);
        helper.setSubject(asunto);
        helper.setText(htmlContent, true); // true = es HTML

        mailSender.send(mimeMessage);
    }

    @Override
    public void enviarCorreoMasivo(List<String> destinatarios, String asunto, String mensaje)
            throws MessagingException {

        String htmlContent = procesarPlantilla(asunto, mensaje);

        MimeMessage mimeMessage = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");

        helper.setFrom(remitente);
        helper.setTo(remitente); // TO: remitente (no aparece vacío)

        // BCC: todos los destinatarios ocultos — mismo comportamiento que antes
        helper.setBcc(destinatarios.toArray(new String[0]));

        helper.setSubject(asunto);
        helper.setText(htmlContent, true);

        mailSender.send(mimeMessage);
    }
}