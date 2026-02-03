package com.exe.AparcaYA.Dto;

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
    private String metodoPago;
    private LocalDateTime fechaPago;
}