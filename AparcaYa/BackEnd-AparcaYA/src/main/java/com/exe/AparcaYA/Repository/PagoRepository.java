package com.exe.AparcaYA.Repository;

import com.exe.AparcaYA.Entity.Pago;
import com.exe.AparcaYA.Enum.EstadoPago;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PagoRepository extends JpaRepository<Pago, Long> {

    // Buscar pagos por estado
    List<Pago> findByEstado(EstadoPago estado);

    // Buscar pagos por reservación
    List<Pago> findByReservacion_IdReserva(Long idReserva);

    // Buscar pagos de un cliente específico (a través de reservación)
    List<Pago> findByReservacion_Cliente_IdUsuario(Long idUsuario);
}