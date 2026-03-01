package com.exe.AparcaYA.Dto;

import com.exe.AparcaYA.Enum.EstadoReservacion;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO de Reservacion — sirve tanto para respuesta (campos de solo lectura)
 * como para entrada de creación (cupoId, vehiculoId, fechaInicio, fechaFin).
 *
 * CAMPOS DE ENTRADA (crear reserva desde cliente):
 *   - cupoId      → cupo a reservar
 *   - vehiculoId  → vehículo del cliente (reemplaza "placa" suelto del JS anterior)
 *   - fechaInicio → inicio de la reserva
 *   - fechaFin    → fin de la reserva
 *
 * CAMPOS DE SOLO LECTURA (respuesta):
 *   - idReserva, estado, fechaCreacion, horaEntrada, horaSalida
 *
 * CAMPOS IGNORADOS SIEMPRE:
 *   - cliente / idUsuario → se obtiene de SecurityContextHolder, nunca del body
 *   - estado al crear     → siempre PENDIENTE, lo fija el controller
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReservacionDTO {

    // ── Respuesta ──────────────────────────────────────────────
    private Long              idReserva;
    private LocalDateTime     horaEntrada;
    private LocalDateTime     horaSalida;
    private EstadoReservacion estado;
    private LocalDateTime     fechaCreacion;

    // ── Entrada (crear reserva) ────────────────────────────────
    @NotNull(message = "El cupo es obligatorio")
    private Long cupoId;

    @NotNull(message = "El vehículo es obligatorio")
    private Long vehiculoId;

    @NotNull(message = "La fecha de inicio es obligatoria")
    private LocalDateTime fechaInicio;

    @NotNull(message = "La fecha de fin es obligatoria")
    private LocalDateTime fechaFin;
}