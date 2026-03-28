package com.exe.AparcaYA.Repository;

import com.exe.AparcaYA.Entity.RegistroEntradaSalida;
import com.exe.AparcaYA.Entity.Sede;
import com.exe.AparcaYA.Entity.Vehiculo;
import com.exe.AparcaYA.Enum.EstadoRegistro;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface RegistroEntradaSalidaRepository
        extends JpaRepository<RegistroEntradaSalida, Long> {

    List<RegistroEntradaSalida> findBySede(Sede sede);
    List<RegistroEntradaSalida> findBySedeAndEstado(Sede sede, EstadoRegistro estado);
    List<RegistroEntradaSalida> findBySedeAndFechaHoraEntradaBetween(
            Sede sede, LocalDateTime inicio, LocalDateTime fin);
    Optional<RegistroEntradaSalida> findByVehiculoAndEstado(
            Vehiculo vehiculo, EstadoRegistro estado);
    List<RegistroEntradaSalida> findByVehiculo(Vehiculo vehiculo);

    @Query("SELECT r FROM RegistroEntradaSalida r WHERE r.sede = :sede " +
            "AND r.estado IN :estados ORDER BY r.fechaHoraEntrada DESC")
    List<RegistroEntradaSalida> findBySedeAndEstadoIn(
            @Param("sede")    Sede                sede,
            @Param("estados") List<EstadoRegistro> estados);

    @Query("SELECT r FROM RegistroEntradaSalida r WHERE r.sede = :sede " +
            "ORDER BY r.fechaHoraEntrada DESC")
    List<RegistroEntradaSalida> findAllBySedeOrderByFechaDesc(
            @Param("sede") Sede sede);

    @Query("SELECT COUNT(r) FROM RegistroEntradaSalida r " +
            "WHERE r.sede = :sede AND r.estado = :estado")
    Long countBySedeAndEstado(@Param("sede")   Sede           sede,
                              @Param("estado") EstadoRegistro estado);

    // AJUSTE — precio ya no está en RegistroEntradaSalida
    // se calcula desde Pago asociado al registro
    // En RegistroEntradaSalidaRepository
    @Query("SELECT COALESCE(SUM(p.monto), 0) FROM Pago p " +
            "WHERE p.registro.sede = :sede " +
            "AND p.estado = com.exe.AparcaYA.Enum.EstadoPago.PAGADO " +
            "AND p.registro.fechaHoraEntrada >= :inicio " +
            "AND p.registro.fechaHoraEntrada < :fin")
    BigDecimal sumIngresosEntreFechas(
            @Param("sede")   Sede          sede,
            @Param("inicio") LocalDateTime inicio,
            @Param("fin")    LocalDateTime fin);

    @Query("SELECT r.vehiculo.tipo, COUNT(r) FROM RegistroEntradaSalida r " +
            "WHERE r.sede = :sede AND r.estado = 'ACTIVO' " +
            "GROUP BY r.vehiculo.tipo")
    List<Object[]> countActivosPorTipo(@Param("sede") Sede sede);

    @Query("SELECT r FROM RegistroEntradaSalida r " +
            "WHERE r.sede = :sede " +
            "AND r.fechaHoraEntrada >= :inicio " +
            "AND r.fechaHoraEntrada < :fin " +
            "ORDER BY r.fechaHoraEntrada DESC")
    List<RegistroEntradaSalida> findBySedeAndFechaBetween(
            @Param("sede")   Sede          sede,
            @Param("inicio") LocalDateTime inicio,
            @Param("fin")    LocalDateTime fin);
}