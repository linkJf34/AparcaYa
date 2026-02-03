package com.exe.AparcaYA.Repository;

import com.exe.AparcaYA.Entity.Reservacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ReservacionRepository extends JpaRepository<Reservacion, Integer> {

    /**
     * Obtiene todas las reservaciones de un cliente específico
     */
    List<Reservacion> findByClienteIdUsuario(Integer clienteId);

    /**
     * Obtiene reservaciones de un cliente por estado
     */
    List<Reservacion> findByClienteIdUsuarioAndEstado(Integer clienteId, String estado);

    /**
     * Obtiene reservaciones por estado
     */
    List<Reservacion> findByEstado(String estado);

    /**
     * Obtiene reservaciones por sede
     */
    @Query("SELECT r FROM Reservacion r WHERE r.cupo.sede.idSede = :sedeId")
    List<Reservacion> findByCupoSedeId(@Param("sedeId") Integer sedeId);

    /**
     * Obtiene reservaciones por cupo
     */
    List<Reservacion> findByCupoIdCupo(Integer cupoId);

    /**
     * Obtiene reservaciones activas de un cupo en un rango de fechas
     */
    @Query("SELECT r FROM Reservacion r WHERE r.cupo.idCupo = :cupoId " +
            "AND r.estado IN :estados " +
            "AND r.fechaInicio < :fechaFin " +
            "AND r.fechaFin > :fechaInicio")
    List<Reservacion> findConflictosHorario(
            @Param("cupoId") Integer cupoId,
            @Param("estados") List<String> estados,
            @Param("fechaInicio") LocalDateTime fechaInicio,
            @Param("fechaFin") LocalDateTime fechaFin
    );

    /**
     * Obtiene reservaciones de un cupo con estados específicos
     */
    List<Reservacion> findByCupoIdCupoAndEstadoIn(Integer cupoId, List<String> estados);

    /**
     * Obtiene reservaciones por vehículo
     */
    List<Reservacion> findByVehiculoPlaca(String placa);

    /**
     * Obtiene reservaciones futuras de un cliente
     */
    @Query("SELECT r FROM Reservacion r WHERE r.cliente.idUsuario = :clienteId " +
            "AND r.fechaInicio > :fechaActual " +
            "ORDER BY r.fechaInicio ASC")
    List<Reservacion> findReservacionesFuturas(
            @Param("clienteId") Integer clienteId,
            @Param("fechaActual") LocalDateTime fechaActual
    );

    /**
     * Cuenta reservaciones activas de un cliente
     */
    @Query("SELECT COUNT(r) FROM Reservacion r WHERE r.cliente.idUsuario = :clienteId " +
            "AND r.estado = 'ACTIVA'")
    long countReservacionesActivas(@Param("clienteId") Integer clienteId);

    List<Reservacion> findByCliente_IdUsuario(Long idUsuario);
}