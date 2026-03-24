package com.exe.AparcaYA.Dto;

import com.exe.AparcaYA.Entity.Pago;
import com.exe.AparcaYA.Enum.EstadoPago;
import com.exe.AparcaYA.Enum.MetodoPago;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PagoDTO {

    private Long idPago;
    private Double monto;
    private MetodoPago metodoPago;
    private EstadoPago estado;
    private LocalDateTime fechaPago;
    private String numeroTransaccion;
    private String detalles;

    // ── Referencias ───────────────────────────────────────────
    // Nullable — un pago puede venir de reservación o de registro directo
    private Long idReservacion;
    private Long idRegistro;

    public static PagoDTO fromEntity(Pago pago) {
        PagoDTO dto = new PagoDTO();
        dto.setIdPago(pago.getIdPago());
        dto.setMonto(pago.getMonto());
        dto.setMetodoPago(pago.getMetodoPago());
        dto.setEstado(pago.getEstado());
        dto.setFechaPago(pago.getFechaPago());
        dto.setNumeroTransaccion(pago.getNumeroTransaccion());
        dto.setDetalles(pago.getDetalles());
        if (pago.getReservacion() != null) {
            dto.setIdReservacion(pago.getReservacion().getIdReserva());
        }
        if (pago.getRegistro() != null) {
            dto.setIdRegistro(pago.getRegistro().getIdRegistro());
        }
        return dto;
    }
}