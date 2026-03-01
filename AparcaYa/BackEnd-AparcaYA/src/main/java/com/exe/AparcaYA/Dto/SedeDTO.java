package com.exe.AparcaYA.Dto;

import com.exe.AparcaYA.Enum.EstadoGeneral;
import com.exe.AparcaYA.Enum.Localidad;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
public class SedeDTO {
    private Long id;        // ✅ Campo principal que consume el JS (s.id, editarSede(s.id), eliminarSede(s.id))
    private Long idSede;    // Mantenido para compatibilidad interna
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

    // ✅ NUEVO: coordenadas — el JS las lee directamente sin llamar a Nominatim
    private Double latitud;
    private Double longitud;

    public static SedeDTO fromEntity(com.exe.AparcaYA.Entity.Sede sede) {
        SedeDTO dto = new SedeDTO();
        dto.setId(sede.getIdSede());        // ✅ id para el JS
        dto.setIdSede(sede.getIdSede());    // idSede para uso interno
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
        return dto;
    }
}