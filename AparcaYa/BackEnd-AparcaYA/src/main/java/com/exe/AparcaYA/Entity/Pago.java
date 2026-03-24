package com.exe.AparcaYA.Entity;

import com.exe.AparcaYA.Enum.EstadoPago;
import com.exe.AparcaYA.Enum.MetodoPago;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "pagos")
public class Pago {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idPago;

    // Nullable — el pago puede venir de una reservación o de un
    // cliente que llega directo sin reservar
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_reservacion")
    private Reservacion reservacion;

    // Nullable — el pago puede venir de un registro de entrada directa
    // sin reservación previa
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_registro")
    private RegistroEntradaSalida registro;

    // Calculado desde Tarifa — el service lo asigna, nunca viene del form
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