package com.exe.AparcaYA.Dto;

import com.exe.AparcaYA.Entity.Cupo;
import com.exe.AparcaYA.Enum.EstadoCupo;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CupoDTO {

    private Long idCupo;
    private String codigo;
    private EstadoCupo estado;

    // ── Contadores por tipo de vehículo ───────────────────────
    private Integer cuposCarro;
    private Integer cuposMoto;
    private Integer cuposBicicleta;

    // ── Referencia a sede ─────────────────────────────────────
    private Long idSede;
    private String nombreSede;

    public static CupoDTO fromEntity(Cupo cupo) {
        CupoDTO dto = new CupoDTO();
        dto.setIdCupo(cupo.getIdCupo());
        dto.setCodigo(cupo.getCodigo());
        dto.setEstado(cupo.getEstado());
        dto.setCuposCarro(cupo.getCuposCarro());
        dto.setCuposMoto(cupo.getCuposMoto());
        dto.setCuposBicicleta(cupo.getCuposBicicleta());
        if (cupo.getSede() != null) {
            dto.setIdSede(cupo.getSede().getIdSede());
            dto.setNombreSede(cupo.getSede().getNombre());
        }
        return dto;
    }
}