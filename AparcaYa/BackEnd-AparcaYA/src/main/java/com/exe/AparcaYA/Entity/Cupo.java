package com.exe.AparcaYA.Entity;

import com.exe.AparcaYA.Enum.EstadoCupo;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "cupo")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Cupo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idCupo;

    @NotBlank(message = "El código es obligatorio")
    @Column(nullable = false, unique = true)
    private String codigo;

    @NotNull(message = "El estado es obligatorio")
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EstadoCupo estado;

    @NotNull(message = "La sede es obligatoria")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_sede", nullable = false)
    private Sede sede;

    // Agregado: Un cupo puede tener muchas reservaciones
    @OneToMany(mappedBy = "cupo", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Reservacion> reservaciones = new ArrayList<>();
}