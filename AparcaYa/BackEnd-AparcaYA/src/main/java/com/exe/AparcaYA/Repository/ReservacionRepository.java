package com.exe.AparcaYA.Repository;

import com.exe.AparcaYA.Entity.Reservacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ReservacionRepository extends JpaRepository<Reservacion, Long> {

    // ── Métodos existentes — NO tocar ──────────────────────────────────────
    List<Reservacion> findByClienteIdUsuario(Long clienteId);
    List<Reservacion> findByClienteIdUsuarioAndEstado(Long clienteId, String estado);
    List<Reservacion> findByEstado(String estado);

    @Query("SELECT r FROM Reservacion r WHERE r.cupo.sede.idSede = :sedeId")
    List<Reservacion> findByCupoSedeId(@Param("sedeId") Long sedeId);

    List<Reservacion> findByCupoIdCupo(Long cupoId);

    // ✅ CORRECCIÓN #1 — findConflictosHorario
    // Antes: @Param("estados") List<String> — correcto, no cambia.
    // Problema real: NADIE lo invocaba. Ahora ReservacionServiceImpl lo usará.
    // No se modifica el query — ya estaba bien escrito.
    @Query("SELECT r FROM Reservacion r WHERE r.cupo.idCupo = :cupoId " +
            "AND r.estado IN :estados " +
            "AND r.fechaInicio < :fechaFin " +
            "AND r.fechaFin    > :fechaInicio")
    List<Reservacion> findConflictosHorario(
            @Param("cupoId")     Long          cupoId,
            @Param("estados")    List<String>  estados,
            @Param("fechaInicio") LocalDateTime fechaInicio,
            @Param("fechaFin")    LocalDateTime fechaFin
    );

    List<Reservacion> findByCupoIdCupoAndEstadoIn(Long cupoId, List<String> estados);
    List<Reservacion> findByVehiculoPlaca(String placa);

    @Query("SELECT r FROM Reservacion r WHERE r.cliente.idUsuario = :clienteId " +
            "AND r.fechaInicio > :fechaActual " +
            "ORDER BY r.fechaInicio ASC")
    List<Reservacion> findReservacionesFuturas(
            @Param("clienteId")   Long          clienteId,
            @Param("fechaActual") LocalDateTime fechaActual
    );

    // ✅ CORRECCIÓN #2 — countReservacionesActivas
    // Antes: AND r.estado = 'ACTIVA'  ← String hardcodeado, frágil.
    // Ahora: AND r.estado IN :estados ← recibe los estados desde el Service,
    //        que pasa EstadoReservacion.PENDIENTE.name() y ACTIVA.name().
    // Así si el enum cambia de nombre, el compilador lo detecta — no falla en runtime.
    @Query("SELECT COUNT(r) FROM Reservacion r " +
            "WHERE r.cliente.idUsuario = :clienteId " +
            "AND r.estado IN :estados")
    long countReservacionesActivasPorEstados(
            @Param("clienteId") Long         clienteId,
            @Param("estados")   List<String> estados
    );

    List<Reservacion> findByCliente_IdUsuario(Long idUsuario);
}