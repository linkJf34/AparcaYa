package com.exe.AparcaYA.Entity;

import com.exe.AparcaYA.Enum.Rolenum;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "log_acceso", indexes = {
        // Índice en fecha para que las queries de KPI sean rápidas
        @Index(name = "idx_log_fecha", columnList = "fecha_acceso"),
        @Index(name = "idx_log_rol",   columnList = "rol")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LogAcceso {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Referencia al usuario — si se elimina el usuario, se eliminan sus logs
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    // Guardamos el rol en el momento del acceso (snapshot)
    // por si el rol cambia después
    @Enumerated(EnumType.STRING)
    @Column(name = "rol", nullable = false, length = 30)
    private Rolenum rol;

    @Column(name = "fecha_acceso", nullable = false)
    private LocalDateTime fechaAcceso;
}