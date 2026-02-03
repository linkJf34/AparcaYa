package com.exe.AparcaYA.Service;


import jakarta.mail.MessagingException;
import java.util.List;

public interface IEmailService {

    /**
     * Enviar correo unitario
     * @param destinatario Correo del destinatario
     * @param asunto Asunto del correo
     * @param mensaje Contenido del mensaje
     * @throws MessagingException Si ocurre un error al enviar
     */
    void enviarCorreoUnitario(String destinatario, String asunto, String mensaje) throws MessagingException;

    /**
     * Enviar correo masivo con BCC (oculta destinatarios)
     * @param destinatarios Lista de correos destinatarios
     * @param asunto Asunto del correo
     * @param mensaje Contenido del mensaje
     * @throws MessagingException Si ocurre un error al enviar
     */
    void enviarCorreoMasivo(List<String> destinatarios, String asunto, String mensaje) throws MessagingException;
}