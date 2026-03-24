package com.exe.AparcaYA.Service;

import com.exe.AparcaYA.Enum.Rolenum;
import jakarta.mail.MessagingException;
import java.util.List;

/**
 * Contrato del servicio de correos para AparcaYA.
 *
 * Centraliza todo el envío de correo del sistema.
 * Ningún controller debe importar JavaMailSender directamente.
 */
public interface IEmailService {

    // ─── Correos de sistema ────────────────────────────────────────────

    /**
     * Correo de bienvenida post-registro.
     * Usa la plantilla emails/bienvenida.html con datos específicos del rol.
     *
     * @param destinatario correo del nuevo usuario
     * @param nombre       nombre completo
     * @param rol          rol asignado (determina mensaje personalizado)
     */
    void enviarBienvenida(String destinatario, String nombre, Rolenum rol);

    // ─── Correos administrativos ───────────────────────────────────────

    /**
     * Correo unitario enviado desde el panel del administrador.
     * Usa la plantilla emails/plantilla-estandar.html.
     */
    void enviarCorreoUnitario(String destinatario, String asunto, String mensaje)
            throws MessagingException;

    /**
     * Correo masivo con BCC — oculta destinatarios entre sí.
     * Usa la misma plantilla estándar.
     */
    void enviarCorreoMasivo(List<String> destinatarios, String asunto, String mensaje)
            throws MessagingException;

    /**
     * Correo con una plantilla específica seleccionada desde el panel.
     *
     * @param destinatario correo destino
     * @param asunto       asunto personalizado
     * @param mensaje      cuerpo del mensaje
     * @param tipoPlantilla BIENVENIDA | RECORDATORIO | PROMOCION | NOTIFICACION
     */
    void enviarConPlantilla(String destinatario, String asunto,
                            String mensaje, String tipoPlantilla)
            throws MessagingException;
}