package com.exe.AparcaYA.Repository;

import com.exe.AparcaYA.Entity.Pago;
import com.exe.AparcaYA.Enum.EstadoPago;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PagoRepository extends JpaRepository<Pago, Long> {

    List<Pago> findByEstado(EstadoPago estado);

    // Pagos por reservación
    List<Pago> findByReservacion_IdReserva(Long idReserva);

    // NUEVO — pagos por registro directo sin reservación
    List<Pago> findByRegistro_IdRegistro(Long idRegistro);

    // Pagos de un cliente a través de su reservación
    List<Pago> findByReservacion_Cliente_IdUsuario(Long idUsuario);

    @Query("SELECT p FROM Pago p WHERE p.registro.vehiculo.idUsuario.idUsuario = :idUsuario")
    List<Pago> findByRegistro_Vehiculo_IdUsuario(@Param("idUsuario") Long idUsuario);
}