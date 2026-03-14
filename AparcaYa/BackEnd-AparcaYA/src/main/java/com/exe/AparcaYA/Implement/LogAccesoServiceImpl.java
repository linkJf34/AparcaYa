package com.exe.AparcaYA.Implement;

import com.exe.AparcaYA.Entity.LogAcceso;
import com.exe.AparcaYA.Entity.Usuario;
import com.exe.AparcaYA.Repository.LogAccesoRepository;
import com.exe.AparcaYA.Service.LogAccesoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import com.exe.AparcaYA.Enum.Rolenum;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class LogAccesoServiceImpl implements LogAccesoService {

    private final LogAccesoRepository logAccesoRepository;

    // ─────────────────────────────────────────────────────────────────────
    // REGISTRO
    // ─────────────────────────────────────────────────────────────────────

    @Override
    public void registrarAcceso(Usuario usuario) {
        try {
            LogAcceso log = LogAcceso.builder()
                    .usuario(usuario)
                    .rol(usuario.getRol())
                    .fechaAcceso(LocalDateTime.now())
                    .build();
            logAccesoRepository.save(log);
        } catch (Exception e) {
            // No interrumpir el login si falla el registro del log
            log.error("Error registrando acceso para usuario {}: {}",
                    usuario.getCorreo(), e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // KPIs
    // ─────────────────────────────────────────────────────────────────────

    @Override
    public long contarAccesosMesActual() {
        LocalDate hoy   = LocalDate.now();
        LocalDateTime inicio = hoy.withDayOfMonth(1).atStartOfDay();
        LocalDateTime fin    = hoy.plusDays(1).atStartOfDay().minusNanos(1);
        return logAccesoRepository.countByFechaAccesoBetween(inicio, fin);
    }

    @Override
    public long contarAccesosMesAnterior() {
        LocalDate primeroDiaMesActual = LocalDate.now().withDayOfMonth(1);
        LocalDate primeroDiaMesAnterior = primeroDiaMesActual.minusMonths(1);

        LocalDateTime inicio = primeroDiaMesAnterior.atStartOfDay();
        LocalDateTime fin    = primeroDiaMesActual.atStartOfDay().minusNanos(1);
        return logAccesoRepository.countByFechaAccesoBetween(inicio, fin);
    }

    @Override
    public long contarAccesosAnioActual() {
        int anio = LocalDate.now().getYear();
        LocalDateTime inicio = LocalDateTime.of(anio, 1, 1, 0, 0, 0);
        LocalDateTime fin    = LocalDateTime.of(anio, 12, 31, 23, 59, 59);
        return logAccesoRepository.countByFechaAccesoBetween(inicio, fin);
    }

    // ─────────────────────────────────────────────────────────────────────
    // SERIE MENSUAL — 12 valores para la gráfica
    // ─────────────────────────────────────────────────────────────────────

    @Override
    public List<Long> serieMensualAnioActual() {
        int anio = LocalDate.now().getYear();

        // Inicializar los 12 meses en cero
        Long[] serie = new Long[12];
        for (int i = 0; i < 12; i++) serie[i] = 0L;

        // Poblar solo los meses que tienen datos
        List<Object[]> resultados = logAccesoRepository.countByMesEnAnio(anio);
        for (Object[] fila : resultados) {
            int mes      = ((Number) fila[0]).intValue() - 1; // MONTH() devuelve 1-12
            long cantidad = ((Number) fila[1]).longValue();
            if (mes >= 0 && mes < 12) serie[mes] = cantidad;
        }

        return List.of(serie);
    }
    @Override
    public Map<String, List<Long>> serieMensualPorRol() {
        int anio = LocalDate.now().getYear();

        // Inicializar todos los roles con 12 ceros — garantiza que
        // aparezcan todos aunque no tengan accesos en algún mes
        Map<String, Long[]> matriz = new LinkedHashMap<>();
        for (Rolenum rol : Rolenum.values()) {
            Long[] meses = new Long[12];
            Arrays.fill(meses, 0L);
            matriz.put(rol.name(), meses);
        }

        // Poblar con datos reales de la BD
        List<Object[]> resultados = logAccesoRepository.countByMesYRolEnAnio(anio);
        for (Object[] fila : resultados) {
            int    mes      = ((Number) fila[0]).intValue() - 1; // MONTH() → 1-12, array → 0-11
            String rol      = fila[1].toString();
            long   cantidad = ((Number) fila[2]).longValue();

            if (mes >= 0 && mes < 12 && matriz.containsKey(rol)) {
                matriz.get(rol)[mes] = cantidad;
            }
        }

        // Convertir Long[] → List<Long> para la respuesta
        Map<String, List<Long>> resultado = new LinkedHashMap<>();
        matriz.forEach((rol, arr) -> resultado.put(rol, Arrays.asList(arr)));
        return resultado;
    }
}