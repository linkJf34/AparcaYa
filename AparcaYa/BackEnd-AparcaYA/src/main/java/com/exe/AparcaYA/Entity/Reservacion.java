package com.exe.AparcaYA.Entity;

import com.exe.AparcaYA.Enum.EstadoReservacion;
import com.fasterxml.jackson.annotation.JsonBackReference;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "reservacion")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Reservacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idReserva;

    @NotNull(message = "La fecha de inicio es obligatoria")
    @Column(nullable = false)
    private LocalDateTime fechaInicio;

    @NotNull(message = "La fecha de fin es obligatoria")
    @Column(nullable = false)
    private LocalDateTime fechaFin;

    @NotNull(message = "El estado es obligatorio")
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EstadoReservacion estado;

    @NotNull(message = "El cliente es obligatorio")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cliente_id")
    @JsonBackReference("usuario-reservas")
    private Usuario cliente;

    @NotNull(message = "El cupo es obligatorio")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_cupo", nullable = false)
    private Cupo cupo;

    @NotNull(message = "El vehículo es obligatorio")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_vehiculo", nullable = false)
    private Vehiculo vehiculo;

    // RELACIÓN CORRECTA
    @OneToMany(
            mappedBy = "reservacion",
            cascade = CascadeType.ALL,
            fetch = FetchType.LAZY
    )
    private List<Pago> pagos = new ArrayList<>();
}