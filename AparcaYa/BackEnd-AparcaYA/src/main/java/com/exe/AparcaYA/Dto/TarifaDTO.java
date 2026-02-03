package com.exe.AparcaYA.Dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TarifaDTO {
    private Long idTarifa;
    private String tipoVehiculo;
    private Double valorHora;
}