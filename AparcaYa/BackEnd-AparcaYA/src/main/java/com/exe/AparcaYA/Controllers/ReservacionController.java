package com.exe.AparcaYA.Controllers;

import com.exe.AparcaYA.Dto.ReservacionDTO;
import com.exe.AparcaYA.Entity.Reservacion;
import com.exe.AparcaYA.Entity.Usuario;
import com.exe.AparcaYA.Enum.EstadoReservacion;
import com.exe.AparcaYA.Service.ReservacionService;
import com.exe.AparcaYA.Service.UsuarioService;
import jakarta.validation.Valid;
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
@RequestMapping("/api/reservaciones")
public class ReservacionController {

    private final ReservacionService reservacionService;
    private final UsuarioService     usuarioService;

    // ── Antes inyectaba CupoService y VehiculoService aquí ────────────────
    // Ahora esa lógica vive en ReservacionServiceImpl.crearReserva()
    // El Controller solo orquesta HTTP — no toca repositorios ni entidades
    // ──────────────────────────────────────────────────────────────────────

    private Usuario getUsuarioAutenticado() {
        String correo = SecurityContextHolder.getContext()
                .getAuthentication()
                .getName();
        return usuarioService.findByCorreo(correo).orElse(null);
    }

    // =========================================================
    // POST /api/reservaciones — Crear reserva
    //
    // Antes: el Controller verificaba cupo, vehículo, fechas y ownership.
    //        Toda esa lógica era de negocio — no pertenecía aquí.
    // Ahora: el Controller solo valida autenticación y delega al Service.
    //        Cada excepción del Service se mapea a su HTTP status correcto.
    // =========================================================
    @PostMapping
    @PreAuthorize("hasRole('CLIENTE')")
    public ResponseEntity<?> createReservacion(
            @Valid @RequestBody ReservacionDTO dto) {

        // 1. Autenticación — nunca del body
        Usuario cliente = getUsuarioAutenticado();
        if (cliente == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "No autenticado"));
        }

        try {
            // 2. Delegar TODO al Service
            Reservacion saved = reservacionService.crearReserva(dto, cliente);

            // 3. Respuesta limpia — sin serializar la entidad completa
            //    (evita LazyInitializationException en relaciones LAZY)
            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                    "idReserva",   saved.getIdReserva(),
                    "estado",      saved.getEstado().name(),
                    "fechaInicio", saved.getFechaInicio().toString(),
                    "fechaFin",    saved.getFechaFin().toString(),
                    "message",     "Reserva creada exitosamente"
            ));

        } catch (IllegalArgumentException e) {
            // Fechas inválidas, vehículo no encontrado, cupo no encontrado
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));

        } catch (IllegalStateException e) {
            // Conflicto de horario, cupo en mantenimiento, límite de reservas
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("message", e.getMessage()));

        } catch (SecurityException e) {
            // Vehículo no pertenece al cliente autenticado
            log.warn("Intento de acceso no autorizado: cliente={}, vehiculo={}, cupo={}",
                    cliente.getIdUsuario(), dto.getVehiculoId(), dto.getCupoId());
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    // =========================================================
    // GET /api/reservaciones — Solo ADMIN
    // =========================================================
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'ADMINISTRADOR_SEDE')")
    public ResponseEntity<List<Reservacion>> getAllReservaciones() {
        return ResponseEntity.ok(reservacionService.findAll());
    }

    // =========================================================
    // GET /api/reservaciones/{id}
    // Verifica ownership — cliente solo ve sus propias reservas
    // =========================================================
    @GetMapping("/{id}")
    public ResponseEntity<?> getReservacionById(@PathVariable Long id) {

        Usuario solicitante = getUsuarioAutenticado();
        if (solicitante == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "No autenticado"));
        }

        Optional<Reservacion> reservacionOpt = reservacionService.findById(id);
        if (reservacionOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Reservacion reservacion = reservacionOpt.get();
        boolean esAdmin = solicitante.getRol().name().contains("ADMIN");

        if (!esAdmin && !reservacion.getCliente().getIdUsuario()
                .equals(solicitante.getIdUsuario())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "No autorizado"));
        }

        return ResponseEntity.ok(reservacion);
    }

    // =========================================================
    // PUT /api/reservaciones/{id} — Solo ADMIN/OPERARIO
    // Los clientes cancelan via /cliente/reservas/{id}/cancelar
    // =========================================================
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OPERARIO', 'ADMINISTRADOR_SEDE')")
    public ResponseEntity<?> updateReservacion(
            @PathVariable Long id,
            @Valid @RequestBody Reservacion reservacion) {

        Usuario solicitante = getUsuarioAutenticado();
        if (solicitante == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "No autenticado"));
        }

        reservacion.setIdReserva(id);
        try {
            return ResponseEntity.ok(reservacionService.update(reservacion));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // =========================================================
    // DELETE /api/reservaciones/{id}
    // =========================================================
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'ADMINISTRADOR_SEDE')")
    public ResponseEntity<?> deleteReservacion(@PathVariable Long id) {

        Usuario solicitante = getUsuarioAutenticado();
        if (solicitante == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "No autenticado"));
        }

        try {
            reservacionService.delete(id);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    // =========================================================
    // GET /api/reservaciones/cliente/{idUsuario}
    // Verifica que el cliente solo consulte sus propias reservas
    // =========================================================
    @GetMapping("/cliente/{idUsuario}")
    public ResponseEntity<?> getReservacionesByCliente(
            @PathVariable Long idUsuario) {

        Usuario solicitante = getUsuarioAutenticado();
        if (solicitante == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "No autenticado"));
        }

        boolean esAdmin = solicitante.getRol().name().contains("ADMIN");
        if (!esAdmin && !solicitante.getIdUsuario().equals(idUsuario)) {
            log.warn("Cliente {} intentó acceder a reservas del cliente {}",
                    solicitante.getIdUsuario(), idUsuario);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "No autorizado"));
        }

        return ResponseEntity.ok(
                reservacionService.findByCliente_IdUsuario(idUsuario));
    }

    // =========================================================
    // GET /api/reservaciones/estado/{estado}
    // =========================================================
    @GetMapping("/estado/{estado}")
    public ResponseEntity<List<Reservacion>> getReservacionesByEstado(
            @PathVariable EstadoReservacion estado) {
        return ResponseEntity.ok(reservacionService.findByEstado(estado));
    }
}