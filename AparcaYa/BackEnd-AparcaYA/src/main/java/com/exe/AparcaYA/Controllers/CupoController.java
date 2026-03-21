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
    // Devuelve los cupos sin conflicto de horario para una sede.
    // Usado por ClienteD.js en crearReserva() antes del POST.
    //
    // ✅ FIX-C1: Eliminado findBySede_IdSede() de diagnóstico
    //            que ejecutaba una query extra en cada solicitud.
    //
    // ✅ FIX-C2: Eliminado endpoint /debug/sede/{sedeId}
    //            que exponía datos internos sin autenticación.
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

        if (fechaInicio == null || fechaFin == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "fechaInicio y fechaFin son obligatorios"));
        }
        if (!fechaFin.isAfter(fechaInicio)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "La fecha de fin debe ser posterior a la de inicio"));
        }
        if (fechaInicio.isBefore(LocalDateTime.now())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "No se puede consultar disponibilidad en el pasado"));
        }

        try {
            List<Cupo> cupos = cupoService.findCuposDisponiblesEnRango(
                    sedeId, fechaInicio, fechaFin);

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
            log.error("Error consultando disponibilidad — sede={}: {}", sedeId, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Error consultando disponibilidad. Intenta de nuevo."));
        }
    }
}