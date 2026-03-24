package com.exe.AparcaYA.Dto;

import com.exe.AparcaYA.Entity.Sede;
import com.exe.AparcaYA.Enum.EstadoGeneral;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Data
@NoArgsConstructor
public class SedeDTO {

    // ── Identificación ────────────────────────────────────────
    private Long id;
    private Long idSede;
    private String nombre;
    private String nit;

    // ── Ubicación ─────────────────────────────────────────────
    private String direccion;
    private String localidad;
    private String barrio;
    private Double latitud;
    private Double longitud;

    // ── Operación ─────────────────────────────────────────────
    private Integer capacidad;
    private Integer ocupacionActual;
    private String horarioSede;
    private EstadoGeneral estado;
    private LocalDateTime fechaCreacion;

    // ── Contacto ──────────────────────────────────────────────
    private String imagenSede;
    private String telefonoSede;
    private String correoSede;

    // ── Relaciones anidadas ───────────────────────────────────
    // Tarifas y cupos viven en sus propias entidades
    private List<TarifaDTO> tarifas;
    private List<CupoDTO> cupos;

    public static SedeDTO fromEntity(Sede sede) {
        SedeDTO dto = new SedeDTO();

        // Identificación
        dto.setId(sede.getIdSede());
        dto.setIdSede(sede.getIdSede());
        dto.setNombre(sede.getNombre());
        dto.setNit(sede.getNit());

        // Ubicación
        dto.setDireccion(sede.getDireccion());
        dto.setLocalidad(sede.getLocalidad() != null
                ? sede.getLocalidad().name() : null);
        dto.setBarrio(sede.getBarrio());
        dto.setLatitud(sede.getLatitud());
        dto.setLongitud(sede.getLongitud());

        // Operación
        dto.setCapacidad(sede.getCapacidad());
        dto.setHorarioSede(sede.getHorarioSede());
        dto.setEstado(sede.getEstado());
        dto.setFechaCreacion(sede.getFechaCreacion());

        // Contacto
        dto.setImagenSede(sede.getImagenSede());
        dto.setTelefonoSede(sede.getTelefonoSede());
        dto.setCorreoSede(sede.getCorreoSede());

        // Tarifas anidadas — null-safe
        dto.setTarifas(sede.getTarifas() != null
                ? sede.getTarifas().stream()
                .map(TarifaDTO::fromEntity)
                .collect(Collectors.toList())
                : Collections.emptyList());

        // Cupos anidados — null-safe
        dto.setCupos(sede.getCupos() != null
                ? sede.getCupos().stream()
                .map(CupoDTO::fromEntity)
                .collect(Collectors.toList())
                : Collections.emptyList());

        return dto;
    }
}