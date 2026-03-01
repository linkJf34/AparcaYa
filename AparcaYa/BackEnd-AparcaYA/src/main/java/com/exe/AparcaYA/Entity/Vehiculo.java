package com.exe.AparcaYA.Entity;

import com.exe.AparcaYA.Enum.Marca;
import com.exe.AparcaYA.Enum.TipoVehiculo;
import com.fasterxml.jackson.annotation.JsonBackReference;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "vehiculo")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Vehiculo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idVehiculo;

    // ✅ NUEVO: @Pattern para validar formato colombiano de placa (ej. ABC123)
    @NotBlank(message = "La placa es obligatoria")
    @Pattern(regexp = "[A-Z]{3}[0-9]{3}", message = "Formato de placa inválido (ej. ABC123)")
    @Column(nullable = false, unique = true)
    private String placa;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TipoVehiculo tipo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Marca marca;

    @Column(nullable = false)
    private String color;

    @Column(nullable = false)
    private Integer anio;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_usuario")
    @JsonBackReference("usuario-vehiculos")
    private Usuario idUsuario;

    @OneToMany(mappedBy = "vehiculo", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Reservacion> reservaciones = new ArrayList<>();
}