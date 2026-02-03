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

    @NotNull(message = "El precio es obligatorio")
    @Column(nullable = false)
    private Double precio;

    // ===== CAMPO NUEVO QUE DEBES AGREGAR =====
    @NotNull(message = "El tipo de tarifa es obligatorio")
    @Column(nullable = false)
    private String tipoTarifa; // "PLENA_CARRO", "PLENA_MOTO", "MINUTO_CARRO", "MINUTO_MOTO"
    // =========================================

    @NotNull(message = "La sede es obligatoria")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_sede", nullable = false)
    private Sede sede;
}