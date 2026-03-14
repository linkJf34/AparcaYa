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

    // ── Coordenadas geocodificadas (existentes) ──────────────────────────────
    @Column
    private Double latitud;

    @Column
    private Double longitud;

    // ── NUEVOS CAMPOS — módulo configuración de sede ─────────────────────────
    // Todos nullable para compatibilidad con sedes existentes (sin migración forzada)

    /** Ruta relativa de la imagen: "sedes/12/imagen.jpg" */
    @Column(name = "imagen_sede")
    private String imagenSede;

    /** Teléfono de contacto de la sede (distinto al del admin-usuario) */
    @Column(name = "telefono_sede")
    private String telefonoSede;

    /** Correo de contacto público de la sede */
    @Column(name = "correo_sede")
    private String correoSede;

    /** Cupos disponibles para carros (permite controlar disponibilidad por tipo) */
    @Column(name = "cupos_carro")
    private Integer cuposCarro;

    /** Cupos disponibles para motos */
    @Column(name = "cupos_moto")
    private Integer cuposMoto;

    /** Cupos disponibles para bicicletas */
    @Column(name = "cupos_bicicleta")
    private Integer cuposBicicleta;

    // ── Relaciones (sin cambios) ─────────────────────────────────────────────

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
}