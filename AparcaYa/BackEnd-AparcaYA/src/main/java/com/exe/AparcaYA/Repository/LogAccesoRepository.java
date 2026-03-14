package com.exe.AparcaYA.Repository;

import com.exe.AparcaYA.Entity.LogAcceso;
import com.exe.AparcaYA.Enum.Rolenum;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface LogAccesoRepository extends JpaRepository<LogAcceso, Long> {

    // ── KPI: Total accesos en un rango de fechas ──────────────────────────
    long countByFechaAccesoBetween(LocalDateTime inicio, LocalDateTime fin);

    // ── Gráfica: Accesos agrupados por mes en un año ──────────────────────
    // Devuelve [mes(1-12), cantidad] para construir la serie mensual
    @Query("""
        SELECT MONTH(l.fechaAcceso), COUNT(l)
        FROM LogAcceso l
        WHERE YEAR(l.fechaAcceso) = :anio
        GROUP BY MONTH(l.fechaAcceso)
        ORDER BY MONTH(l.fechaAcceso)
        """)
    List<Object[]> countByMesEnAnio(@Param("anio") int anio);

    // ── Nueva métrica: accesos por rol en un rango ────────────────────────
    @Query("""
        SELECT l.rol, COUNT(l)
        FROM LogAcceso l
        WHERE l.fechaAcceso BETWEEN :inicio AND :fin
        GROUP BY l.rol
        """)
    List<Object[]> countByRolBetween(
            @Param("inicio") LocalDateTime inicio,
            @Param("fin")    LocalDateTime fin
    );

    @Query("""
    SELECT MONTH(l.fechaAcceso), l.rol, COUNT(l)
    FROM LogAcceso l
    WHERE YEAR(l.fechaAcceso) = :anio
    GROUP BY MONTH(l.fechaAcceso), l.rol
    ORDER BY MONTH(l.fechaAcceso)
    """)
    List<Object[]> countByMesYRolEnAnio(@Param("anio") int anio);

    @Query("""
    SELECT l.rol, COUNT(l)
    FROM LogAcceso l
    WHERE l.fechaAcceso BETWEEN :inicio AND :fin
    GROUP BY l.rol
    """)
    List<Object[]> countByRolEnRango(
            @Param("inicio") LocalDateTime inicio,
            @Param("fin")    LocalDateTime fin
    );
}