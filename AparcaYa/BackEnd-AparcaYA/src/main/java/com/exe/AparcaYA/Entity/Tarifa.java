package com.exe.AparcaYA.Entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "tarifa")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Tarifa {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idTarifa;

    @NotNull(message = "El tipo de tarifa es obligatorio")
    @Column(nullable = false)
    private String tipoTarifa;

    // ── Tarifas Carro ────────────────────────────────────────────────────────
    @Column(nullable = false)
    private Double tarifaPlenaC;

    @Column(nullable = false)
    private Double tarifaMinutoC;

    @Column(nullable = false)
    private Double tarifaHoraC;

    // ── Tarifas Moto ─────────────────────────────────────────────────────────
    @Column(nullable = false)
    private Double tarifaPlenaM;

    @Column(nullable = false)
    private Double tarifaMinutoM;

    @Column(nullable = false)
    private Double tarifaHoraM;

    // ── Tarifas Bicicleta ────────────────────────────────────────────────────
    @Column(nullable = false)
    private Double tarifaPlenaB;

    @Column(nullable = false)
    private Double tarifaMinutoB;

    @Column(nullable = false)
    private Double tarifaHoraB;



    // ── Relación ─────────────────────────────────────────────────────────────
    @NotNull(message = "La sede es obligatoria")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_sede", nullable = false)
    private Sede sede;
}