package com.exe.AparcaYA.Service;

import com.exe.AparcaYA.Entity.Pago;
import com.exe.AparcaYA.Enum.EstadoPago;

import java.util.List;
import java.util.Optional;

public interface PagoService {
    Pago save(Pago pago);
    List<Pago> findAll();
    Optional<Pago> findById(Long id);
    Pago update(Pago pago);
    void delete(Long id);
    List<Pago> findByCliente_IdUsuario(Long idUsuario);
    List<Pago> findByEstado(EstadoPago estado);
    List<Pago> findByReservacion_IdReserva(Long idReserva);

    List<Pago> findByReserva_IdReserva(Long idReserva);
}