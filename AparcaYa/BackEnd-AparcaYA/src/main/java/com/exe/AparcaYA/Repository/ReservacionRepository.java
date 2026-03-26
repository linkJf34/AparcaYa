package com.exe.AparcaYA.Repository;

import com.exe.AparcaYA.Entity.Reservacion;
import com.exe.AparcaYA.Enum.EstadoReservacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ReservacionRepository extends JpaRepository<Reservacion, Long> {

    // ── Consultas por cliente ──────────────────────────────────────────────
    List<Reservacion> findByCliente_IdUsuario(Long idUsuario);

    List<Reservacion> findByCliente_IdUsuarioAndEstado(
            Long clienteId, EstadoReservacion estado);

    // ── Consultas por estado ───────────────────────────────────────────────
    List<Reservacion> findByEstado(EstadoReservacion estado);

    // ── Consultas por sede ─────────────────────────────────────────────────
    @Query("SELECT r FROM Reservacion r WHERE r.cupo.sede.idSede = :sedeId")
    List<Reservacion> findByCupoSedeId(@Param("sedeId") Long sedeId);

    // ── Consultas por cupo ─────────────────────────────────────────────────
    List<Reservacion> findByCupo_IdCupo(Long cupoId);

    List<Reservacion> findByCupo_IdCupoAndEstadoIn(
            Long cupoId, List<EstadoReservacion> estados);

    // ── Consultas por vehículo ─────────────────────────────────────────────
    List<Reservacion> findByVehiculo_Placa(String placa);

    // ── Conflicto de horario ───────────────────────────────────────────────
    @Query("SELECT r FROM Reservacion r WHERE r.cupo.idCupo = :cupoId " +
            "AND r.estado IN :estados " +
            "AND r.fechaInicio < :fechaFin " +
            "AND r.fechaFin    > :fechaInicio")
    List<Reservacion> findConflictosHorario(
            @Param("cupoId")      Long                    cupoId,
            @Param("estados")     List<String>            estados,
            @Param("fechaInicio") LocalDateTime           fechaInicio,
            @Param("fechaFin")    LocalDateTime           fechaFin
    );

    // ── Reservas futuras del cliente ───────────────────────────────────────
    @Query("SELECT r FROM Reservacion r WHERE r.cliente.idUsuario = :clienteId " +
            "AND r.fechaInicio > :fechaActual ORDER BY r.fechaInicio ASC")
    List<Reservacion> findReservacionesFuturas(
            @Param("clienteId")   Long          clienteId,
            @Param("fechaActual") LocalDateTime fechaActual
    );

    // ── Conteo de reservas activas ─────────────────────────────────────────
    @Query("SELECT COUNT(r) FROM Reservacion r " +
            "WHERE r.cliente.idUsuario = :clienteId " +
            "AND r.estado IN :estados")
    long countReservacionesActivasPorEstados(
            @Param("clienteId") Long         clienteId,
            @Param("estados")   List<String> estados
    );

    @Query("SELECT r FROM Reservacion r WHERE r.vehiculo.idVehiculo = :vehiculoId " +
            "AND r.estado = :estado ORDER BY r.fechaInicio DESC")
    List<Reservacion> findByVehiculoIdAndEstado(
            @Param("vehiculoId") Long vehiculoId,
            @Param("estado") EstadoReservacion estado);
}