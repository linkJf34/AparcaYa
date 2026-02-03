package com.exe.AparcaYA.Dto;

import com.exe.AparcaYA.Enum.*;
import lombok.Data;

@Data
public class RegistroRequest {
    // Campos comunes del usuario
    private String nombre;
    private String correo;
    private String telefono;
    private String cedula;  // Campo único para cédula
    private String contrasena;
    private Rolenum rol;

    // Campos opcionales para vehículo (solo si rol == CLIENTE)
    private String placa;
    private TipoVehiculo tipoVehiculo;
    private Marca marca;
    private String color;
    private Integer anio;

    // Campos opcionales para sede (solo si rol == ADMINISTRADOR_SEDE) - Usados para hidden fields
    private String hiddenNombreSede;
    private String hiddenNit;
    private String hiddenDireccion;
    private String hiddenLocalidad;  // Cambiado a String para Localidad.valueOf()
    private String hiddenBarrio;
    private Integer hiddenCuposTotales;
    private Double tarifaPlenaC;
    private Double tarifaPlenaM;
    private Double tarifaMinutoC;
    private Double tarifaMinutoM;
    private String hiddenHorarioSede;

   /* // Campos visibles para sede (mantén si los necesitas, pero el controlador usa hidden)
    private String nombreSede;
    private String nit;
    private String direccion;
    private Localidad localidad;
    private String barrio;
    private Integer cuposTotales;
    private Double tarifaPlenaC;
    private Double tarifaPlenaM;
    private Double tarifaMinutoC;
    private Double tarifaMinutoM;
    private String horarioSede;*/
}
