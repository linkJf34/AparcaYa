package com.exe.AparcaYA.Implement;

import com.exe.AparcaYA.Entity.EmailLog;
import com.exe.AparcaYA.Entity.EmailLog.EstadoEmail;
import com.exe.AparcaYA.Entity.EmailLog.TipoEmail;
import com.exe.AparcaYA.Enum.Rolenum;
import com.exe.AparcaYA.Repository.EmailLogRepository;
import com.exe.AparcaYA.Service.IEmailService;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Implementación centralizada del servicio de correos para AparcaYA.
 *
 * CAMBIOS RESPECTO AL ORIGINAL:
 *   - enviarBienvenida() movido desde UsuarioController.sendWelcomeEmail()
 *   - HTML de bienvenida → plantilla Thymeleaf (emails/bienvenida.html)
 *   - Registro automático en EmailLog para historial y tracking
 *   - enviarConPlantilla() nuevo: soporta selector de plantillas del panel admin
 *   - Envío asíncrono con @Async para no bloquear el hilo del registro
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailServiceImpl implements IEmailService {

    private final JavaMailSender    mailSender;
    private final TemplateEngine    templateEngine;
    private final EmailLogRepository emailLogRepository;

    @Value("${spring.mail.username}")
    private String remitente;

    // ─── Bienvenida (antes en UsuarioController) ──────────────────────────

    /**
     * Envía correo de bienvenida usando plantilla Thymeleaf.
     * @Async: no bloquea el flujo de registro si el correo tarda.
     *
     * ANTES: UsuarioController.sendWelcomeEmail() con String.format() de 60 líneas
     * AHORA: template emails/bienvenida.html + registro en EmailLog
     */
    @Override
    @Async
    @Transactional
    public void enviarBienvenida(String destinatario, String nombre, Rolenum rol) {
        String rolDescripcion = switch (rol) {
            case ADMIN              -> "Administrador General";
            case ADMINISTRADOR_SEDE -> "Administrador de Sede";
            case OPERARIO           -> "Operario de Parqueadero";
            case CLIENTE            -> "Cliente";
            default                 -> rol.toString();
        };

        String mensajePersonalizado = switch (rol) {
            case CLIENTE            -> "Ya puedes buscar y reservar espacios de parqueo en todas nuestras sedes de Bogota.";
            case ADMINISTRADOR_SEDE -> "Tu sede ha sido registrada. Puedes comenzar a gestionar cupos, tarifas y operarios desde tu panel.";
            case OPERARIO           -> "Has sido asignado a una sede. Accede a tu panel para gestionar entradas y salidas de vehiculos.";
            default                 -> "Tienes acceso completo al sistema. Accede con tu correo y contrasena registrados.";
        };

        Context ctx = new Context();
        ctx.setVariable("nombre",       nombre);
        ctx.setVariable("correo",       destinatario);
        ctx.setVariable("rol",          rolDescripcion);
        ctx.setVariable("mensaje",      mensajePersonalizado);
        ctx.setVariable("anio",         LocalDateTime.now().getYear());

        String asunto = "Bienvenido a AparcaYA — " + rolDescripcion;

        enviarYRegistrar(destinatario, asunto, "emails/bienvenida", ctx, TipoEmail.BIENVENIDA);
    }

    // ─── Correo unitario (sin cambios de contrato) ────────────────────────

    @Override
    public void enviarCorreoUnitario(String destinatario, String asunto, String mensaje)
            throws MessagingException {
        Context ctx = buildContextEstandar(asunto, mensaje);
        String  html = templateEngine.process("emails/plantilla-estandar", ctx);
        enviarMensaje(destinatario, asunto, html);
        registrarLog(destinatario, asunto, EstadoEmail.ENVIADO, TipoEmail.CUSTOM, null);
    }

    // ─── Correo masivo (sin cambios de contrato) ──────────────────────────

    @Override
    public void enviarCorreoMasivo(List<String> destinatarios, String asunto, String mensaje)
            throws MessagingException {
        Context ctx  = buildContextEstandar(asunto, mensaje);
        String  html = templateEngine.process("emails/plantilla-estandar", ctx);

        MimeMessage mimeMessage = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
        helper.setFrom(remitente);
        helper.setTo(remitente);
        helper.setBcc(destinatarios.toArray(new String[0]));
        helper.setSubject(asunto);
        helper.setText(html, true);
        mailSender.send(mimeMessage);

        // Registrar un log por destinatario
        destinatarios.forEach(dest ->
                registrarLog(dest, asunto, EstadoEmail.ENVIADO, TipoEmail.CUSTOM, null));
    }

    // ─── Correo con plantilla seleccionada (NUEVO) ────────────────────────

    @Override
    public void enviarConPlantilla(String destinatario, String asunto,
                                   String mensaje, String tipoPlantilla)
            throws MessagingException {

        TipoEmail tipo   = parseTipo(tipoPlantilla);
        String template  = resolverTemplate(tipoPlantilla);

        Context ctx = new Context();
        ctx.setVariable("asunto",  asunto);
        ctx.setVariable("mensaje", mensaje.replace("\n", "<br>"));
        ctx.setVariable("anio",    LocalDateTime.now().getYear());

        String html = templateEngine.process(template, ctx);
        enviarMensaje(destinatario, asunto, html);
        registrarLog(destinatario, asunto, EstadoEmail.ENVIADO, tipo, null);
    }

    // ─── Métodos privados ─────────────────────────────────────────────────

    /**
     * Procesa la plantilla y envía, registrando el resultado en EmailLog.
     * Captura excepciones para que @Async no pierda el error silenciosamente.
     */
    private void enviarYRegistrar(String destinatario, String asunto,
                                  String templateName, Context ctx,
                                  TipoEmail tipo) {
        String html = templateEngine.process(templateName, ctx);
        try {
            enviarMensaje(destinatario, asunto, html);
            registrarLog(destinatario, asunto, EstadoEmail.ENVIADO, tipo, null);
            log.info("Correo [{}] enviado a: {}", tipo, destinatario);
        } catch (Exception e) {
            registrarLog(destinatario, asunto, EstadoEmail.ERROR, tipo, e.getMessage());
            log.error("Error enviando correo [{}] a {}: {}", tipo, destinatario, e.getMessage());
        }
    }

    private void enviarMensaje(String destinatario, String asunto, String html)
            throws MessagingException {
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
        helper.setFrom(remitente);
        helper.setTo(destinatario);
        helper.setSubject(asunto);
        helper.setText(html, true);
        mailSender.send(message);
    }

    private Context buildContextEstandar(String asunto, String mensaje) {
        Context ctx = new Context();
        ctx.setVariable("asunto",  asunto);
        ctx.setVariable("mensaje", mensaje.replace("\n", "<br>"));
        ctx.setVariable("anio",    LocalDateTime.now().getYear());
        return ctx;
    }

    @Transactional
    protected void registrarLog(String destinatario, String asunto,
                                EstadoEmail estado, TipoEmail tipo,
                                String error) {
        try {
            EmailLog log = EmailLog.builder()
                    .destinatario(destinatario)
                    .asunto(asunto)
                    .estado(estado)
                    .tipo(tipo)
                    .mensajeError(error)
                    .fechaEnvio(EstadoEmail.ENVIADO.equals(estado)
                            ? LocalDateTime.now() : null)
                    .fechaCreacion(LocalDateTime.now())
                    .build();
            emailLogRepository.save(log);
        } catch (Exception e) {
            log.warn("No se pudo registrar log de correo: {}", e.getMessage());
        }
    }

    private String resolverTemplate(String tipo) {
        return switch (tipo.toUpperCase()) {
            case "BIENVENIDA"   -> "emails/bienvenida";
            case "RECORDATORIO" -> "emails/recordatorio";
            case "PROMOCION"    -> "emails/promocion";
            case "NOTIFICACION" -> "emails/notificacion";
            default             -> "emails/plantilla-estandar";
        };
    }

    private TipoEmail parseTipo(String tipo) {
        try { return TipoEmail.valueOf(tipo.toUpperCase()); }
        catch (Exception e) { return TipoEmail.CUSTOM; }
    }
}