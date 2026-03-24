package com.exe.AparcaYA.Entity;

import com.exe.AparcaYA.Enum.EstadoGeneral;
import com.exe.AparcaYA.Enum.MetodoPago;
import com.exe.AparcaYA.Enum.Rolenum;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "usuario")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idUsuario;

    @NotBlank(message = "El nombre es obligatorio")
    @Column(nullable = false)
    private String nombre;

    @NotBlank(message = "El correo es obligatorio")
    @Email(message = "Formato de correo inválido")
    @Column(nullable = false, unique = true)
    private String correo;

    @NotBlank(message = "El teléfono es obligatorio")
    @Pattern(regexp = "[0-9]{10}", message = "El teléfono debe tener exactamente 10 dígitos")
    @Column(nullable = false, unique = true)
    private String telefono;

    @JsonIgnore
    @NotBlank(message = "La cédula es obligatoria")
    @Pattern(regexp = "[0-9]{10}", message = "La cédula debe tener exactamente 10 dígitos")
    @Column(nullable = false, unique = true)
    private String cedula;

    @JsonIgnore
    @NotBlank(message = "La contraseña es obligatoria")
    @Size(min = 8, message = "La contraseña debe tener al menos 8 caracteres")
    @Column(nullable = false)
    private String contrasena;

    @NotNull(message = "El rol es obligatorio")
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Rolenum rol;

    // Solo aplica para clientes
    @Enumerated(EnumType.STRING)
    @Column
    private MetodoPago metodoPago;

    @NotNull(message = "El estado es obligatorio")
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EstadoGeneral estado;

    @Column(columnDefinition = "TEXT")
    private String descripcion;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "id_sede_asignada")
    @JsonIgnore
    private Sede sedeAsignada;

    // ── Relaciones ───────────────────────────────────────────────────────────

    @OneToMany(mappedBy = "idUsuario", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @JsonIgnore
    private List<Sede> sedes = new ArrayList<>();

    @OneToMany(mappedBy = "idUsuario", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @JsonIgnore
    private List<Vehiculo> vehiculos = new ArrayList<>();

    @OneToMany(mappedBy = "cliente", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @JsonIgnore
    private List<Reservacion> reservaciones = new ArrayList<>();
}