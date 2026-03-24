package com.exe.AparcaYA.Entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Historial de todos los correos enviados o fallidos en AparcaYA.
 * Permite tracking completo desde el panel del administrador.
 *
 * PostgreSQL: la columna "tipo" usa TEXT para los enums
 * (no ENUM nativo de MySQL, evita migraciones al agregar valores).
 */
@Entity
@Table(
        name = "email_log",
        indexes = {
                @Index(name = "idx_email_log_estado",    columnList = "estado"),
                @Index(name = "idx_email_log_tipo",      columnList = "tipo"),
                @Index(name = "idx_email_log_fecha",     columnList = "fecha_creacion"),
                @Index(name = "idx_email_log_destino",   columnList = "destinatario")
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmailLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Correo del destinatario */
    @Column(nullable = false, length = 255)
    private String destinatario;

    /** Asunto del correo */
    @Column(nullable = false, length = 255)
    private String asunto;

    /** Estado actual del envío */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EstadoEmail estado;

    /** Tipo de plantilla usada */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private TipoEmail tipo;

    /** Fecha y hora en que se procesó el envío exitoso */
    @Column(name = "fecha_envio")
    private LocalDateTime fechaEnvio;

    /** Fecha de creación del registro (siempre se llena) */
    @Column(name = "fecha_creacion", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime fechaCreacion;

    /** Descripción técnica del error — solo si estado = ERROR */
    @Column(name = "mensaje_error", length = 1000)
    private String mensajeError;

    // ── Enums ──────────────────────────────────────────────────────────

    public enum EstadoEmail {
        /** Correo enviado y aceptado por el servidor SMTP */
        ENVIADO,
        /** El envío falló — ver mensajeError para detalles */
        ERROR,
        /** Programado para envío futuro (para extensión futura) */
        PENDIENTE
    }

    public enum TipoEmail {
        /** Correo de bienvenida post-registro */
        BIENVENIDA,
        /** Recordatorio enviado manualmente */
        RECORDATORIO,
        /** Promocion o campaña */
        PROMOCION,
        /** Notificacion del sistema */
        NOTIFICACION,
        /** Correo personalizado sin plantilla específica */
        CUSTOM
    }

    // ── Helpers de dominio ─────────────────────────────────────────────

    public boolean esFallido() {
        return EstadoEmail.ERROR.equals(this.estado);
    }

    public boolean esEnviado() {
        return EstadoEmail.ENVIADO.equals(this.estado);
    }
}