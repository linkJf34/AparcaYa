package com.exe.AparcaYA.Service;

import com.exe.AparcaYA.Entity.Pago;
import com.exe.AparcaYA.Enum.EstadoPago;
import com.exe.AparcaYA.Enum.MetodoPago;

import java.util.List;
import java.util.Optional;

public interface PagoService {
    Pago save(Pago pago);
    List<Pago> findAll();
    Optional<Pago> findById(Long id);
    Pago update(Pago pago);
    void delete(Long id);
    List<Pago> findByEstado(EstadoPago estado);

    // Pagos asociados a una reservación
    List<Pago> findByReservacion_IdReserva(Long idReserva);

    // Pagos asociados a un registro directo sin reservación
    List<Pago> findByRegistro_IdRegistro(Long idRegistro);

    List<Pago> findByReservacion_Cliente_IdUsuario(Long idUsuario);
    Pago cobrarReserva(Long idReserva, MetodoPago metodoPago, Long idOperario);
}