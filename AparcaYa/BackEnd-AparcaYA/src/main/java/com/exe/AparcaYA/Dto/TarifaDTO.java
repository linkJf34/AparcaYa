package com.exe.AparcaYA.Dto;

import com.exe.AparcaYA.Entity.Tarifa;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TarifaDTO {

    private Long idTarifa;
    private String tipoTarifa;

    // ── Carro ─────────────────────────────────────────────────
    private Double tarifaPlenaC;
    private Double tarifaMinutoC;
    private Double tarifaHoraC;

    // ── Moto ──────────────────────────────────────────────────
    private Double tarifaPlenaM;
    private Double tarifaMinutoM;
    private Double tarifaHoraM;

    // ── Bicicleta ─────────────────────────────────────────────
    private Double tarifaPlenaB;
    private Double tarifaMinutoB;
    private Double tarifaHoraB;

    public static TarifaDTO fromEntity(Tarifa tarifa) {
        TarifaDTO dto = new TarifaDTO();
        dto.setIdTarifa(tarifa.getIdTarifa());
        dto.setTipoTarifa(tarifa.getTipoTarifa());
        dto.setTarifaPlenaC(tarifa.getTarifaPlenaC());
        dto.setTarifaMinutoC(tarifa.getTarifaMinutoC());
        dto.setTarifaHoraC(tarifa.getTarifaHoraC());
        dto.setTarifaPlenaM(tarifa.getTarifaPlenaM());
        dto.setTarifaMinutoM(tarifa.getTarifaMinutoM());
        dto.setTarifaHoraM(tarifa.getTarifaHoraM());
        dto.setTarifaPlenaB(tarifa.getTarifaPlenaB());
        dto.setTarifaMinutoB(tarifa.getTarifaMinutoB());
        dto.setTarifaHoraB(tarifa.getTarifaHoraB());
        return dto;
    }
}