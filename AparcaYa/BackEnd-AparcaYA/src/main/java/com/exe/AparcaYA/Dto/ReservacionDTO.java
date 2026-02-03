package com.exe.AparcaYA.Dto;

import com.exe.AparcaYA.Enum.EstadoReservacion;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReservacionDTO {
    private Long idReserva;
    private LocalDateTime horaEntrada;
    private LocalDateTime horaSalida;
    private EstadoReservacion estado;
    private LocalDateTime fechaCreacion;
}