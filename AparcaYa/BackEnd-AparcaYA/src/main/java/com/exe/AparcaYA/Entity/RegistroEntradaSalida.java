package com.exe.AparcaYA.Entity;

import com.exe.AparcaYA.Enum.EstadoRegistro;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "registro_entrada_salida")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RegistroEntradaSalida {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idRegistro;

    @NotNull(message = "La fecha de entrada es obligatoria")
    @Column(nullable = false)
    private LocalDateTime fechaHoraEntrada;

    @Column
    private LocalDateTime fechaHoraSalida;

    @NotNull(message = "El estado es obligatorio")
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EstadoRegistro estado;

    @Column(precision = 10, scale = 2)
    private BigDecimal precio;

    @Column(length = 50)
    private String metodoPago;

    @Column(length = 500)
    private String observaciones;

    @NotNull(message = "El vehículo es obligatorio")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_vehiculo", nullable = false)
    private Vehiculo vehiculo;

    @NotNull(message = "La sede es obligatoria")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_sede", nullable = false)
    private Sede sede;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_cupo")
    private Cupo cupo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_usuario")
    private Usuario trabajador;
}