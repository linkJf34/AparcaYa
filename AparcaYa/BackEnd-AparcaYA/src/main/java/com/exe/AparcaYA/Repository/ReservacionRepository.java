package com.exe.AparcaYA.Repository;

import com.exe.AparcaYA.Entity.Reservacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

// ✅ CAMBIO #9: JpaRepository<Reservacion, Integer> → JpaRepository<Reservacion, Long>
// La Entity Reservacion declara `private Long idReserva`, el tipo del Repository
// debe coincidir. Usar Integer forzaba Math.toIntExact() en el Impl con riesgo
// de ArithmeticException para IDs grandes.
@Repository
public interface ReservacionRepository extends JpaRepository<Reservacion, Long> {

    // ✅ CAMBIO #9: Integer clienteId → Long clienteId en todos los métodos
    List<Reservacion> findByClienteIdUsuario(Long clienteId);

    List<Reservacion> findByClienteIdUsuarioAndEstado(Long clienteId, String estado);

    List<Reservacion> findByEstado(String estado);

    // ✅ CAMBIO #9: Integer sedeId → Long sedeId
    @Query("SELECT r FROM Reservacion r WHERE r.cupo.sede.idSede = :sedeId")
    List<Reservacion> findByCupoSedeId(@Param("sedeId") Long sedeId);

    // ✅ CAMBIO #9: Integer cupoId → Long cupoId
    List<Reservacion> findByCupoIdCupo(Long cupoId);

    @Query("SELECT r FROM Reservacion r WHERE r.cupo.idCupo = :cupoId " +
            "AND r.estado IN :estados " +
            "AND r.fechaInicio < :fechaFin " +
            "AND r.fechaFin > :fechaInicio")
    List<Reservacion> findConflictosHorario(
            @Param("cupoId") Long cupoId,
            @Param("estados") List<String> estados,
            @Param("fechaInicio") LocalDateTime fechaInicio,
            @Param("fechaFin") LocalDateTime fechaFin
    );

    List<Reservacion> findByCupoIdCupoAndEstadoIn(Long cupoId, List<String> estados);

    List<Reservacion> findByVehiculoPlaca(String placa);

    // ✅ CAMBIO #9: Integer clienteId → Long clienteId
    @Query("SELECT r FROM Reservacion r WHERE r.cliente.idUsuario = :clienteId " +
            "AND r.fechaInicio > :fechaActual " +
            "ORDER BY r.fechaInicio ASC")
    List<Reservacion> findReservacionesFuturas(
            @Param("clienteId") Long clienteId,
            @Param("fechaActual") LocalDateTime fechaActual
    );

    // ✅ CAMBIO #9: Integer clienteId → Long clienteId
    @Query("SELECT COUNT(r) FROM Reservacion r WHERE r.cliente.idUsuario = :clienteId " +
            "AND r.estado = 'ACTIVA'")
    long countReservacionesActivas(@Param("clienteId") Long clienteId);

    // Este método ya estaba correcto con Long — se mantiene igual
    List<Reservacion> findByCliente_IdUsuario(Long idUsuario);
}