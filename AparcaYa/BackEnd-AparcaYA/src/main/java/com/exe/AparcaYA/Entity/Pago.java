package com.exe.AparcaYA.Entity;

import com.exe.AparcaYA.Enum.EstadoPago;
import com.exe.AparcaYA.Enum.MetodoPago;
import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "pagos")
public class Pago {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idPago;

    @ManyToOne
    @JoinColumn(name = "id_reservacion", nullable = false)
    private Reservacion reservacion;

    @Column(nullable = false)
    private Double monto;

    @Column(nullable = false)
    private LocalDateTime fechaPago;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EstadoPago estado;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MetodoPago metodoPago;

    @Column(length = 100)
    private String numeroTransaccion;

    @Column(columnDefinition = "TEXT")
    private String detalles;
}