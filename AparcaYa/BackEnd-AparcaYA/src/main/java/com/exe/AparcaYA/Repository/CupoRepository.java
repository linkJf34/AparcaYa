package com.exe.AparcaYA.Repository;

import com.exe.AparcaYA.Entity.Cupo;
import com.exe.AparcaYA.Entity.Sede;
import com.exe.AparcaYA.Enum.EstadoCupo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface CupoRepository extends JpaRepository<Cupo, Long> {

    List<Cupo> findBySede_IdSede(Long idSede);
    List<Cupo> findByEstado(EstadoCupo estado);
    List<Cupo> findBySedeAndEstado(Sede sede, EstadoCupo estado);

    @Query("SELECT c FROM Cupo c WHERE LOWER(c.codigo) " +
            "LIKE LOWER(CONCAT('%', :codigo, '%'))")
    List<Cupo> findByCodigoContainingIgnoreCase(@Param("codigo") String codigo);

    // NUEVO — reemplaza sede.getCuposCarro/Moto/Bicicleta()
    // Cuenta cupos por tipo de vehículo dentro de una sede
    @Query("SELECT COUNT(c) FROM Cupo c " +
            "WHERE c.sede.idSede = :idSede " +
            "AND c.cuposCarro > 0 AND :tipo = 'CARRO' " +
            "OR c.sede.idSede = :idSede " +
            "AND c.cuposMoto > 0 AND :tipo = 'MOTO' " +
            "OR c.sede.idSede = :idSede " +
            "AND c.cuposBicicleta > 0 AND :tipo = 'BICICLETA'")
    Integer contarCuposPorTipo(@Param("idSede") Long idSede,
                               @Param("tipo") String tipo);

    @Query("""
        SELECT c FROM Cupo c
        WHERE c.sede.idSede = :sedeId
        AND c.estado <> com.exe.AparcaYA.Enum.EstadoCupo.MANTENIMIENTO
        AND NOT EXISTS (
            SELECT r FROM Reservacion r
            WHERE r.cupo = c
            AND r.estado IN :estadosActivos
            AND r.fechaInicio < :fechaFin
            AND r.fechaFin    > :fechaInicio
        )
    """)
    List<Cupo> findCuposDisponiblesEnRango(
            @Param("sedeId")         Long          sedeId,
            @Param("fechaInicio")    LocalDateTime fechaInicio,
            @Param("fechaFin")       LocalDateTime fechaFin,
            @Param("estadosActivos") List<String>  estadosActivos
    );
}