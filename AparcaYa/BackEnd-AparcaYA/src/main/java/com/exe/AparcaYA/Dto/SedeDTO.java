package com.exe.AparcaYA.Dto;

import com.exe.AparcaYA.Enum.Localidad;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SedeDTO {
    private Long idSede;
    private String nombre;
    private String nit;  // Nuevo
    private String direccion;
    private Localidad localidad;
    private String barrio;
    private Integer capacidad;
    private Double tarifaPlenaC; // Nuevo
    private Double tarifaPlenaM;
    private Double tarifaMinutoC;
    private Double tarifaMinutoM;
    private String horarioSede;  // Nuevo
    private Long idAdministrador;  // Para referencia al usuario
    private Boolean estado;
    private LocalDateTime fechaCreacion;
}