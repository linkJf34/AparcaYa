package com.exe.AparcaYA.Entity;

import com.exe.AparcaYA.Enum.EstadoGeneral;
import com.exe.AparcaYA.Enum.Localidad;
import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "sede")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Sede {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idSede;

    @Column(nullable = false)
    private String nombre;

    @NotBlank(message = "El nit es obligatorio")
    @Column(nullable = false, unique = true)
    private String nit;

    @Column(nullable = false)
    private String direccion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Localidad localidad;

    @Column
    private String barrio;

    @Column(nullable = false)
    private Integer capacidad;

    @Column(nullable = false)
    private Double tarifaPlenaC;

    @Column(nullable = false)
    private Double tarifaPlenaM;

    @Column(nullable = false)
    private Double tarifaMinutoC;

    @Column(nullable = false)
    private Double tarifaMinutoM;

    @Column(nullable = false)
    private String horarioSede;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EstadoGeneral estado;

    @Column(nullable = false)
    private LocalDateTime fechaCreacion;

    @OneToMany(mappedBy = "sede", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @JsonIgnore
    private List<Cupo> cupos = new ArrayList<>();

    @OneToMany(mappedBy = "sede", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @JsonIgnore
    private List<Tarifa> tarifas = new ArrayList<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_usuario", nullable = false)
    @JsonIgnore
    private Usuario idUsuario;

  /* // Relación: Una sede puede tener muchos cupos

    @OneToMany(mappedBy = "sede", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Cupo> cupos = new ArrayList<>();

    // Agregado: Una sede puede tener muchas tarifas
    @OneToMany(mappedBy = "sede", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Tarifa> tarifas = new ArrayList<>();*/
}