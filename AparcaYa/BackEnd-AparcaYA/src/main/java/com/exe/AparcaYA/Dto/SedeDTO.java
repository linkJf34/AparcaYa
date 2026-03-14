package com.exe.AparcaYA.Dto;

import com.exe.AparcaYA.Enum.EstadoGeneral;
import com.exe.AparcaYA.Enum.Localidad;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
public class SedeDTO {

    // ── Campos existentes (sin cambios) ──────────────────────────────────────

    private Long id;        // consumido por el JS como s.id
    private Long idSede;    // compatibilidad interna
    private String nombre;
    private String nit;
    private String direccion;
    private String localidad;
    private String barrio;
    private Integer capacidad;
    private Double tarifaPlenaC;
    private Double tarifaPlenaM;
    private Double tarifaMinutoC;
    private Double tarifaMinutoM;
    private String horarioSede;
    private EstadoGeneral estado;
    private LocalDateTime fechaCreacion;
    private Double latitud;
    private Double longitud;

    // ── Nuevos campos — módulo configuración ─────────────────────────────────

    private String imagenSede;
    private String telefonoSede;
    private String correoSede;
    private Integer cuposCarro;
    private Integer cuposMoto;
    private Integer cuposBicicleta;

    public static SedeDTO fromEntity(com.exe.AparcaYA.Entity.Sede sede) {
        SedeDTO dto = new SedeDTO();

        // Existentes
        dto.setId(sede.getIdSede());
        dto.setIdSede(sede.getIdSede());
        dto.setNombre(sede.getNombre());
        dto.setNit(sede.getNit());
        dto.setDireccion(sede.getDireccion());
        dto.setLocalidad(sede.getLocalidad() != null ? sede.getLocalidad().name() : null);
        dto.setBarrio(sede.getBarrio());
        dto.setCapacidad(sede.getCapacidad());
        dto.setTarifaPlenaC(sede.getTarifaPlenaC());
        dto.setTarifaPlenaM(sede.getTarifaPlenaM());
        dto.setTarifaMinutoC(sede.getTarifaMinutoC());
        dto.setTarifaMinutoM(sede.getTarifaMinutoM());
        dto.setHorarioSede(sede.getHorarioSede());
        dto.setEstado(sede.getEstado());
        dto.setFechaCreacion(sede.getFechaCreacion());
        dto.setLatitud(sede.getLatitud());
        dto.setLongitud(sede.getLongitud());

        // Nuevos
        dto.setImagenSede(sede.getImagenSede());
        dto.setTelefonoSede(sede.getTelefonoSede());
        dto.setCorreoSede(sede.getCorreoSede());
        dto.setCuposCarro(sede.getCuposCarro());
        dto.setCuposMoto(sede.getCuposMoto());
        dto.setCuposBicicleta(sede.getCuposBicicleta());

        return dto;
    }
}