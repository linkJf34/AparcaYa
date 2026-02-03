package com.exe.AparcaYA.Dto;

import com.exe.AparcaYA.Enum.Marca;
import com.exe.AparcaYA.Enum.TipoVehiculo;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class VehiculoDTO {
    private Long idVehiculo;
    private String placa;
    private TipoVehiculo tipo;
    private Marca marca;  // Nuevo
    private String color;  // Nuevo
    private Integer anio;  // Nuevo
    private Long idPropietario;  // Para referencia al usuario
}