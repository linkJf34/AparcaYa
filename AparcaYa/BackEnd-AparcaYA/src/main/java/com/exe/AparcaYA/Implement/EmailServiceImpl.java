package com.exe.AparcaYA.Implement;


import com.exe.AparcaYA.Service.IEmailService;
import jakarta.mail.*;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import jakarta.mail.*;                    // ← CAMBIAR a jakarta
import jakarta.mail.internet.*;
import java.util.*;

@Service
public class EmailServiceImpl implements IEmailService {

    @Autowired
    private TemplateEngine templateEngine;

    private final String remitente = "aparcaya.parkingtech@gmail.com";
    private final String password = "bnsw wtcn zqjh dunq";

    private Properties getMailProperties() {
        Properties props = new Properties();
        props.put("mail.smtp.auth", "true");
        props.put("mail.smtp.starttls.enable", "true");
        props.put("mail.smtp.host", "smtp.gmail.com");
        props.put("mail.smtp.port", "587");
        return props;
    }

    private Session getMailSession() {
        return Session.getInstance(getMailProperties(), new Authenticator() {
            protected PasswordAuthentication getPasswordAuthentication() {
                return new PasswordAuthentication(remitente, password);
            }
        });
    }

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
    public void enviarCorreoUnitario(String destinatario, String asunto, String mensaje) throws MessagingException {
        String htmlContent = procesarPlantilla(asunto, mensaje);

        MimeMessage mimeMessage = new MimeMessage(getMailSession());
        mimeMessage.setFrom(new InternetAddress(remitente));
        mimeMessage.setRecipients(Message.RecipientType.TO, InternetAddress.parse(destinatario));
        mimeMessage.setSubject(asunto);
        mimeMessage.setContent(htmlContent, "text/html; charset=utf-8");

        Transport.send(mimeMessage);
    }

    @Override
    public void enviarCorreoMasivo(List<String> destinatarios, String asunto, String mensaje) throws MessagingException {
        String htmlContent = procesarPlantilla(asunto, mensaje);

        MimeMessage mimeMessage = new MimeMessage(getMailSession());
        mimeMessage.setFrom(new InternetAddress(remitente));

        // El remitente como TO (para que no aparezca vacío)
        mimeMessage.setRecipients(Message.RecipientType.TO, InternetAddress.parse(remitente));

        // Todos los destinatarios en BCC (ocultos)
        String destinatariosStr = String.join(",", destinatarios);
        mimeMessage.setRecipients(Message.RecipientType.BCC, InternetAddress.parse(destinatariosStr));

        mimeMessage.setSubject(asunto);
        mimeMessage.setContent(htmlContent, "text/html; charset=utf-8");

        Transport.send(mimeMessage);
    }
}