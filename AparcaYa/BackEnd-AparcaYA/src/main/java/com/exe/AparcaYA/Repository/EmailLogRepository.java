package com.exe.AparcaYA.Repository;

import com.exe.AparcaYA.Entity.EmailLog;
import com.exe.AparcaYA.Entity.EmailLog.EstadoEmail;
import com.exe.AparcaYA.Entity.EmailLog.TipoEmail;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface EmailLogRepository extends JpaRepository<EmailLog, Long> {

    // ── Conteo simple ──────────────────────────────────────────────────
    long countByEstado(EstadoEmail estado);

    // ── Todos sin filtro ───────────────────────────────────────────────
    List<EmailLog> findAllByOrderByFechaCreacionDesc();

    // ── Un solo filtro ─────────────────────────────────────────────────
    List<EmailLog> findByEstadoOrderByFechaCreacionDesc(EstadoEmail estado);
    List<EmailLog> findByTipoOrderByFechaCreacionDesc(TipoEmail tipo);
    List<EmailLog> findByFechaCreacionAfterOrderByFechaCreacionDesc(LocalDateTime desde);
    List<EmailLog> findByFechaCreacionBeforeOrderByFechaCreacionDesc(LocalDateTime hasta);
    List<EmailLog> findByFechaCreacionBetweenOrderByFechaCreacionDesc(LocalDateTime desde, LocalDateTime hasta);

    // ── Estado + fecha ─────────────────────────────────────────────────
    List<EmailLog> findByEstadoAndFechaCreacionAfterOrderByFechaCreacionDesc(EstadoEmail estado, LocalDateTime desde);
    List<EmailLog> findByEstadoAndFechaCreacionBeforeOrderByFechaCreacionDesc(EstadoEmail estado, LocalDateTime hasta);
    List<EmailLog> findByEstadoAndFechaCreacionBetweenOrderByFechaCreacionDesc(EstadoEmail estado, LocalDateTime desde, LocalDateTime hasta);

    // ── Tipo + fecha ───────────────────────────────────────────────────
    List<EmailLog> findByTipoAndFechaCreacionAfterOrderByFechaCreacionDesc(TipoEmail tipo, LocalDateTime desde);
    List<EmailLog> findByTipoAndFechaCreacionBeforeOrderByFechaCreacionDesc(TipoEmail tipo, LocalDateTime hasta);
    List<EmailLog> findByTipoAndFechaCreacionBetweenOrderByFechaCreacionDesc(TipoEmail tipo, LocalDateTime desde, LocalDateTime hasta);

    // ── Estado + tipo ──────────────────────────────────────────────────
    List<EmailLog> findByEstadoAndTipoOrderByFechaCreacionDesc(EstadoEmail estado, TipoEmail tipo);

    // ── Estado + tipo + fecha ──────────────────────────────────────────
    List<EmailLog> findByEstadoAndTipoAndFechaCreacionBetweenOrderByFechaCreacionDesc(EstadoEmail estado, TipoEmail tipo, LocalDateTime desde, LocalDateTime hasta);
    List<EmailLog> findByEstadoAndTipoAndFechaCreacionAfterOrderByFechaCreacionDesc(EstadoEmail estado, TipoEmail tipo, LocalDateTime desde);
    List<EmailLog> findByEstadoAndTipoAndFechaCreacionBeforeOrderByFechaCreacionDesc(EstadoEmail estado, TipoEmail tipo, LocalDateTime hasta);

    // ── Estadísticas para el dashboard ────────────────────────────────
    @Query(value = "SELECT * FROM email_log ORDER BY fecha_creacion DESC LIMIT :n", nativeQuery = true)
    List<EmailLog> findUltimos(@Param("n") int n);

    @Query(value = "SELECT tipo, COUNT(*) FROM email_log GROUP BY tipo", nativeQuery = true)
    List<Object[]> countPorTipo();

    @Query(value = "SELECT estado, COUNT(*) FROM email_log GROUP BY estado", nativeQuery = true)
    List<Object[]> countPorEstado();

    @Query(value = """
        SELECT CAST(fecha_creacion AS date) AS dia, COUNT(*) AS total
        FROM   email_log
        WHERE  fecha_creacion >= :hace7Dias
        GROUP  BY CAST(fecha_creacion AS date)
        ORDER  BY dia
    """, nativeQuery = true)
    List<Object[]> conteoUltimos7Dias(@Param("hace7Dias") LocalDateTime hace7Dias);
}