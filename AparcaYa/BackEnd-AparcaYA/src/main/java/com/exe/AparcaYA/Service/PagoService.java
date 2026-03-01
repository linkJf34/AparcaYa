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

    // ✅ C6: Eliminado findByReserva_IdReserva (nombre incorrecto sin "cion")
    // Era idéntico a findByReservacion_IdReserva — generaba confusión silenciosa:
    // cualquier llamante podía usar cualquiera de los dos sin saber cuál era el correcto.
    // Se conserva solo el nombre que coincide con la entidad (Reservacion).
    List<Pago> findByReservacion_IdReserva(Long idReserva);
}