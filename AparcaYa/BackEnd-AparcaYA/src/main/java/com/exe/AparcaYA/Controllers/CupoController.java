package com.exe.AparcaYA.Controllers;

import com.exe.AparcaYA.Entity.Cupo;
import com.exe.AparcaYA.Service.CupoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/cupos")
public class CupoController {

    private final CupoService cupoService;

    // =========================================================
    // GET /api/cupos/sede/{sedeId}
    //
    // Devuelve TODOS los cupos de una sede.
    // Usado por el panel de administrador y trabajador.
    // NO lo usa el flujo de reserva del cliente.
    // =========================================================
    @GetMapping("/sede/{sedeId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'ADMINISTRADOR_SEDE', 'OPERARIO')")
    public ResponseEntity<List<Map<String, Object>>> getCuposPorSede(
            @PathVariable Long sedeId) {

        try {
            List<Cupo> cupos = cupoService.findBySede_IdSede(sedeId);

            List<Map<String, Object>> resultado = cupos.stream().map(c -> {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("idCupo", c.getIdCupo());
                item.put("codigo", c.getCodigo());
                item.put("estado", c.getEstado().name());
                return item;
            }).collect(Collectors.toList());

            return ResponseEntity.ok(resultado);

        } catch (Exception e) {
            log.error("Error obteniendo cupos de sede {}: {}", sedeId, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // =========================================================
    // GET /api/cupos/disponibles?sedeId=1&fechaInicio=...&fechaFin=...
    //
    // Devuelve solo los cupos SIN conflicto de horario.
    // Este es el endpoint que usa ClienteD.js en crearReserva()
    // antes de enviar el POST a /api/reservaciones.
    //
    // Parámetros:
    //   sedeId      → Long
    //   fechaInicio → ISO 8601 sin zona: "2025-03-10T14:00:00"
    //   fechaFin    → ISO 8601 sin zona: "2025-03-10T16:00:00"
    //
    // Respuesta: [ { idCupo, codigo, estado } ]
    // Proyección manual — evita serializar relaciones LAZY
    // =========================================================
    @GetMapping("/disponibles")
    @PreAuthorize("hasAnyRole('CLIENTE', 'ADMIN', 'ADMINISTRADOR_SEDE')")
    public ResponseEntity<?> getCuposDisponibles(
            @RequestParam Long sedeId,
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime fechaInicio,
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime fechaFin) {

        // Validar rango antes de consultar BD
        if (fechaInicio == null || fechaFin == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message",
                            "fechaInicio y fechaFin son obligatorios"));
        }

        if (!fechaFin.isAfter(fechaInicio)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message",
                            "La fecha de fin debe ser posterior a la de inicio"));
        }

        if (fechaInicio.isBefore(LocalDateTime.now())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message",
                            "No se puede consultar disponibilidad en el pasado"));
        }

        try {
            List<Cupo> cupos = cupoService.findCuposDisponiblesEnRango(
                    sedeId, fechaInicio, fechaFin);

            // Proyección — solo los campos que necesita el JS
            List<Map<String, Object>> resultado = cupos.stream().map(c -> {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("idCupo", c.getIdCupo());
                item.put("codigo", c.getCodigo());
                item.put("estado", c.getEstado().name());
                return item;
            }).collect(Collectors.toList());

            log.info("Cupos disponibles — sede={} inicio={} fin={} cantidad={}",
                    sedeId, fechaInicio, fechaFin, resultado.size());

            return ResponseEntity.ok(resultado);

        } catch (Exception e) {
            log.error("Error consultando disponibilidad — sede={}: {}",
                    sedeId, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message",
                            "Error consultando disponibilidad. Intenta de nuevo."));
        }
    }
}
