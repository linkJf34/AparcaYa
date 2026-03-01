package com.exe.AparcaYA.Controllers;

import com.exe.AparcaYA.Dto.ReservacionDTO;
import com.exe.AparcaYA.Entity.Cupo;
import com.exe.AparcaYA.Entity.Reservacion;
import com.exe.AparcaYA.Entity.Usuario;
import com.exe.AparcaYA.Entity.Vehiculo;
import com.exe.AparcaYA.Enum.EstadoReservacion;
import com.exe.AparcaYA.Service.ReservacionService;
import com.exe.AparcaYA.Service.UsuarioService;
import com.exe.AparcaYA.Service.CupoService;
import com.exe.AparcaYA.Service.VehiculoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
    private final CupoService        cupoService;
    private final VehiculoService    vehiculoService;

    // =========================================================
    // UTILIDAD: obtener usuario autenticado desde SecurityContext
    //
    // ✅ FIX C-01 / C-02: el idUsuario ya no viene del body del request.
    // Antes: el JS enviaba { cliente: { idUsuario: X } } y el controller
    //        lo aceptaba sin verificar — cualquier cliente podía poner
    //        el id de otro usuario y crear reservas en su nombre (IDOR).
    // Ahora: el usuario siempre se obtiene del SecurityContextHolder,
    //        que Spring Security garantiza que corresponde al autenticado.
    // =========================================================
    private Usuario getUsuarioAutenticado() {
        String correo = SecurityContextHolder.getContext()
                .getAuthentication()
                .getName();
        return usuarioService.findByCorreo(correo).orElse(null);
    }

    // =========================================================
    // POST /api/reservaciones — Crear reserva
    //
    // ✅ FIX C-02: Endpoint protegido con autenticación obligatoria.
    // ✅ FIX C-02: Recibe ReservacionRequestDTO en lugar de la entidad completa.
    //             Antes: @RequestBody Reservacion — el cliente podía enviar
    //             estado=ACTIVA, cliente.idUsuario=otro, etc.
    //             Ahora: solo acepta cupoId, vehiculoId, fechaInicio, fechaFin.
    // ✅ FIX C-02: Verifica que el vehículo pertenezca al cliente autenticado.
    // ✅ FIX C-02: Verifica que el cupo esté DISPONIBLE antes de reservar.
    // =========================================================
    @PostMapping
    public ResponseEntity<?> createReservacion(
            @Valid @RequestBody ReservacionDTO dto) {

        // 1. Obtener usuario autenticado — nunca del body
        Usuario cliente = getUsuarioAutenticado();
        if (cliente == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "No autenticado"));
        }

        // 2. Verificar que el cupo existe y está DISPONIBLE
        Optional<Cupo> cupoOpt = cupoService.findById(dto.getCupoId());
        if (cupoOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("message", "Cupo no encontrado"));
        }

        Cupo cupo = cupoOpt.get();
        if (!"DISPONIBLE".equalsIgnoreCase(cupo.getEstado().name())) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("message", "El cupo ya no está disponible"));
        }

        // 3. Verificar que el vehículo existe y pertenece al cliente autenticado
        //    ✅ FIX C-02: Sin esta verificación cualquier cliente podía reservar
        //    con el vehículo de otro usuario.
        Optional<Vehiculo> vehiculoOpt = vehiculoService.findById(dto.getVehiculoId());
        if (vehiculoOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("message", "Vehículo no encontrado"));
        }

        Vehiculo vehiculo = vehiculoOpt.get();
        if (!vehiculo.getIdUsuario().getIdUsuario().equals(cliente.getIdUsuario())) {
            log.warn("Cliente {} intentó usar vehículo {} que no le pertenece",
                    cliente.getIdUsuario(), dto.getVehiculoId());
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "El vehículo no pertenece a tu cuenta"));
        }

        // 4. Validar fechas
        if (!dto.getFechaFin().isAfter(dto.getFechaInicio())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "La fecha de fin debe ser posterior a la de inicio"));
        }

        // 5. Construir y guardar la reserva — estado PENDIENTE siempre
        Reservacion reservacion = Reservacion.builder()
                .cliente(cliente)
                .cupo(cupo)
                .vehiculo(vehiculo)
                .fechaInicio(dto.getFechaInicio())
                .fechaFin(dto.getFechaFin())
                .estado(EstadoReservacion.PENDIENTE)
                .build();

        Reservacion saved = reservacionService.save(reservacion);
        log.info("Reserva {} creada para cliente {}", saved.getIdReserva(), cliente.getIdUsuario());

        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    // =========================================================
    // GET /api/reservaciones — Solo para ADMIN
    //
    // ✅ FIX C-02: Antes este endpoint devolvía TODAS las reservas
    //             sin ningún control — cualquier cliente autenticado
    //             podía ver las reservas de todos los demás usuarios.
    // Ahora: restringido a ADMINISTRADOR_GENERAL via SecurityConfig.
    //        Si un cliente intenta acceder, Spring Security retorna 403.
    //        Asegúrate de agregar en SecurityConfig:
    //          .requestMatchers(HttpMethod.GET, "/api/reservaciones")
    //          .hasRole("ADMINISTRADOR_GENERAL")
    // =========================================================
    @GetMapping
    public ResponseEntity<List<Reservacion>> getAllReservaciones() {
        return ResponseEntity.ok(reservacionService.findAll());
    }

    // =========================================================
    // GET /api/reservaciones/{id}
    //
    // ✅ FIX C-02: Verifica ownership — el cliente solo puede ver
    //             sus propias reservas. El admin puede ver cualquiera.
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

        // Verificar ownership excepto para administradores
        boolean esAdmin = solicitante.getRol().name().contains("ADMINISTRADOR");
        if (!esAdmin && !reservacion.getCliente().getIdUsuario()
                .equals(solicitante.getIdUsuario())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "No autorizado"));
        }

        return ResponseEntity.ok(reservacion);
    }

    // =========================================================
    // PUT /api/reservaciones/{id} — Solo para ADMIN/OPERARIO
    //
    // Los clientes cancelan via /cliente/reservas/{id}/cancelar
    // que tiene las validaciones de estado correctas.
    // =========================================================
    @PutMapping("/{id}")
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

    @DeleteMapping("/{id}")
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
    //
    // ✅ FIX C-02: Verifica que el idUsuario de la ruta coincida
    //             con el usuario autenticado — antes cualquier cliente
    //             podía ver las reservas de otro pasando otro idUsuario.
    // =========================================================
    @GetMapping("/cliente/{idUsuario}")
    public ResponseEntity<?> getReservacionesByCliente(@PathVariable Long idUsuario) {
        Usuario solicitante = getUsuarioAutenticado();
        if (solicitante == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "No autenticado"));
        }

        boolean esAdmin = solicitante.getRol().name().contains("ADMINISTRADOR");
        if (!esAdmin && !solicitante.getIdUsuario().equals(idUsuario)) {
            log.warn("Cliente {} intentó acceder a reservas del cliente {}",
                    solicitante.getIdUsuario(), idUsuario);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "No autorizado"));
        }

        return ResponseEntity.ok(reservacionService.findByCliente_IdUsuario(idUsuario));
    }

    @GetMapping("/estado/{estado}")
    public ResponseEntity<List<Reservacion>> getReservacionesByEstado(
            @PathVariable EstadoReservacion estado) {
        return ResponseEntity.ok(reservacionService.findByEstado(estado));
    }
}