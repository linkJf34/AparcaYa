package com.exe.AparcaYA.Controllers;

import com.exe.AparcaYA.Entity.Pago;
import com.exe.AparcaYA.Entity.Usuario;
import com.exe.AparcaYA.Enum.EstadoPago;
import com.exe.AparcaYA.Enum.MetodoPago;
import com.exe.AparcaYA.Service.PagoService;
import com.exe.AparcaYA.Service.UsuarioService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/pagos")
public class PagoController {

    private final PagoService  pagoService;
    private final UsuarioService usuarioService;

    private Usuario getUsuarioAutenticado() {
        String correo = SecurityContextHolder.getContext()
                .getAuthentication().getName();
        return usuarioService.findByCorreo(correo).orElse(null);
    }

    // =========================================================
    // GET /api/pagos — Solo ADMIN
    // =========================================================
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'ADMINISTRADOR_SEDE')")
    public ResponseEntity<List<Pago>> getAllPagos() {
        return ResponseEntity.ok(pagoService.findAll());
    }

    // =========================================================
    // GET /api/pagos/{id}
    // =========================================================
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'ADMINISTRADOR_SEDE', 'OPERARIO')")
    public ResponseEntity<?> getPagoById(@PathVariable Long id) {
        Optional<Pago> pago = pagoService.findById(id);
        return pago.isPresent()
                ? ResponseEntity.ok(pago.get())
                : ResponseEntity.notFound().build();
    }

    // =========================================================
    // GET /api/pagos/reserva/{idReserva}
    // Pagos asociados a una reservación específica
    // =========================================================
    @GetMapping("/reserva/{idReserva}")
    @PreAuthorize("hasAnyRole('ADMIN', 'ADMINISTRADOR_SEDE', 'OPERARIO')")
    public ResponseEntity<List<Pago>> getPagosByReserva(
            @PathVariable Long idReserva) {
        return ResponseEntity.ok(
                pagoService.findByReservacion_IdReserva(idReserva));
    }

    // =========================================================
    // GET /api/pagos/estado/{estado}
    // =========================================================
    @GetMapping("/estado/{estado}")
    @PreAuthorize("hasAnyRole('ADMIN', 'ADMINISTRADOR_SEDE')")
    public ResponseEntity<List<Pago>> getPagosByEstado(
            @PathVariable EstadoPago estado) {
        return ResponseEntity.ok(pagoService.findByEstado(estado));
    }

    // =========================================================
    // POST /api/pagos/cobrar-reserva
    // TAREA 2 — Registra pago Y actualiza reserva a PAGADA
    // =========================================================
    /*@PostMapping("/cobrar-reserva")
    @PreAuthorize("hasAnyRole('ADMIN', 'OPERARIO', 'ADMINISTRADOR_SEDE')")
    public ResponseEntity<?> cobrarReserva(
            @RequestBody Map<String, Object> body) {

        Usuario operario = getUsuarioAutenticado();
        if (operario == null)
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "No autenticado"));

        // Validar campos requeridos
        if (!body.containsKey("idReserva"))
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "El campo idReserva es obligatorio"));

        try {
            Long idReserva = Long.valueOf(body.get("idReserva").toString());

            MetodoPago metodoPago = MetodoPago.EFECTIVO; // valor por defecto
            if (body.containsKey("metodoPago")) {
                try {
                    metodoPago = MetodoPago.valueOf(
                            body.get("metodoPago").toString().toUpperCase());
                } catch (IllegalArgumentException ex) {
                    return ResponseEntity.badRequest()
                            .body(Map.of("message",
                                    "Método de pago inválido: " + body.get("metodoPago")));
                }
            }

            Pago pago = pagoService.cobrarReserva(
                    idReserva, metodoPago, operario.getIdUsuario());

            log.info("Cobro registrado — reserva={}, pago={}, operario={}",
                    idReserva, pago.getIdPago(), operario.getIdUsuario());

            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                    "idPago",   pago.getIdPago(),
                    "monto",    pago.getMonto(),
                    "estado",   pago.getEstado().name(),
                    "message",  "Cobro registrado correctamente"
            ));

        } catch (IllegalStateException e) {
            // Reserva no está en estado COMPLETADA
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("message", e.getMessage()));

        } catch (IllegalArgumentException e) {
            // Reserva no encontrada
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("message", e.getMessage()));

        } catch (Exception e) {
            log.error("Error inesperado en cobrarReserva: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Error interno al procesar el cobro"));
        }
    }*/
}