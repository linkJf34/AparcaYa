package com.exe.AparcaYA.Controllers;

import com.exe.AparcaYA.Dto.SedeDTO;
import com.exe.AparcaYA.Dto.UsuarioDTO;
import com.exe.AparcaYA.Entity.Pago;
import com.exe.AparcaYA.Entity.Reservacion;
import com.exe.AparcaYA.Entity.Usuario;
import com.exe.AparcaYA.Enum.EstadoGeneral;
import com.exe.AparcaYA.Enum.EstadoReservacion;
import com.exe.AparcaYA.Service.PagoService;
import com.exe.AparcaYA.Service.ReservacionService;
import com.exe.AparcaYA.Service.SedeService;
import com.exe.AparcaYA.Service.UsuarioService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Controller
@RequestMapping("/cliente")
public class ClienteController {

    @Autowired private UsuarioService     usuarioService;
    @Autowired private ReservacionService reservacionService;
    @Autowired private SedeService        sedeService;
    @Autowired private PagoService        pagoService;

    // =========================================================
    // UTILIDAD: obtener usuario autenticado desde SecurityContext
    //
    // ✅ FIX C-05: Reemplaza session.getAttribute("userId") manual.
    // Antes: el controller leía userId de HttpSession — si el
    //        AuthenticationSuccessHandler no lo guardaba explícitamente,
    //        userId era siempre null y todos los usuarios veían el login.
    // Ahora: Spring Security garantiza que getName() retorna el correo
    //        del usuario autenticado en cualquier request protegido.
    // =========================================================
    private Usuario getUsuarioAutenticado() {
        String correo = SecurityContextHolder.getContext()
                .getAuthentication()
                .getName();
        return usuarioService.findByCorreo(correo).orElse(null);
    }

    // =========================================================
    // DASHBOARD PRINCIPAL
    // =========================================================
    @GetMapping("/dashboard")
    public String mostrarDashboard(Model model) {
        Usuario usuario = getUsuarioAutenticado();

        if (usuario == null) {
            return "redirect:/login";
        }

        try {
            model.addAttribute("nombreUsuario", usuario.getNombre());
            model.addAttribute("userId",        usuario.getIdUsuario());

            List<Reservacion> reservaciones =
                    reservacionService.findByCliente_IdUsuario(usuario.getIdUsuario());
            model.addAttribute("reservaciones", reservaciones);

            long reservasActivas = reservaciones.stream()
                    .filter(r -> r.getEstado() == EstadoReservacion.ACTIVA)
                    .count();
            model.addAttribute("reservasActivas", reservasActivas);

            // ✅ FIX C-06: SedeDTO en lugar de entidad Sede completa
            List<SedeDTO> sedesActivas = sedeService
                    .findByEstado(EstadoGeneral.ACTIVO)
                    .stream()
                    .map(SedeDTO::fromEntity)
                    .collect(Collectors.toList());
            model.addAttribute("sedes", sedesActivas);

            return "cliente/dashboard";

        } catch (Exception e) {
            log.error("Error cargando dashboard cliente: {}", e.getMessage());
            model.addAttribute("error", "Error cargando el dashboard");
            return "error";
        }
    }

    // =========================================================
    // PERFIL
    // =========================================================

    /**
     * GET /cliente/perfil — retorna UsuarioDTO (sin contraseña ni campos sensibles)
     */
    @GetMapping("/perfil")
    @ResponseBody
    public ResponseEntity<UsuarioDTO> obtenerPerfil() {
        Usuario usuario = getUsuarioAutenticado();

        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        return ResponseEntity.ok(UsuarioDTO.fromEntity(usuario));
    }

    /**
     * POST /cliente/perfil/actualizar — whitelist explícita, solo nombre/correo/telefono
     */
    @PostMapping("/perfil/actualizar")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> actualizarPerfil(
            @RequestBody Map<String, String> campos) {

        Usuario usuario = getUsuarioAutenticado();

        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "No autenticado"));
        }

        try {
            // Whitelist — rol, contrasena, estado, sedeAsignada ignorados aunque vengan
            if (campos.containsKey("nombre"))   usuario.setNombre(campos.get("nombre"));
            if (campos.containsKey("correo"))   usuario.setCorreo(campos.get("correo"));
            if (campos.containsKey("telefono")) usuario.setTelefono(campos.get("telefono"));

            usuarioService.update(usuario);
            return ResponseEntity.ok(Map.of("success", true, "message", "Perfil actualizado correctamente"));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    // =========================================================
    // RESERVAS
    // =========================================================

    /**
     * GET /cliente/reservas — reservas del usuario autenticado únicamente
     */
    @GetMapping("/reservas")
    @ResponseBody
    public ResponseEntity<List<Reservacion>> obtenerReservas() {
        Usuario usuario = getUsuarioAutenticado();

        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        return ResponseEntity.ok(
                reservacionService.findByCliente_IdUsuario(usuario.getIdUsuario())
        );
    }

    /**
     * POST /cliente/reservas/{reservaId}/cancelar
     *
     * ✅ Ownership check: verifica que la reserva pertenece al usuario autenticado.
     * ✅ Estado check: solo se pueden cancelar reservas ACTIVA o PENDIENTE.
     */
    @PostMapping("/reservas/{reservaId}/cancelar")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> cancelarReserva(
            @PathVariable Long reservaId) {

        Usuario usuario = getUsuarioAutenticado();

        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "No autenticado"));
        }

        try {
            Reservacion reserva = reservacionService.findById(reservaId).orElse(null);

            if (reserva == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("success", false, "message", "Reserva no encontrada"));
            }

            // Ownership check — el cliente solo puede cancelar sus propias reservas
            if (!reserva.getCliente().getIdUsuario().equals(usuario.getIdUsuario())) {
                log.warn("Cliente {} intentó cancelar reserva {} de otro usuario",
                        usuario.getIdUsuario(), reservaId);
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("success", false, "message", "No autorizado"));
            }

            if (reserva.getEstado() != EstadoReservacion.ACTIVA &&
                    reserva.getEstado() != EstadoReservacion.PENDIENTE) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("success", false, "message",
                                "Solo se pueden cancelar reservas activas o pendientes"));
            }

            reserva.setEstado(EstadoReservacion.CANCELADA);
            reservacionService.update(reserva);

            return ResponseEntity.ok(Map.of("success", true, "message", "Reserva cancelada correctamente"));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    // =========================================================
    // SEDES
    //
    // ✅ FIX C-06: Retorna List<SedeDTO> en lugar de List<Sede>.
    // Antes: la entidad Sede podía incluir la relación con el
    //        Usuario administrador — exponía datos del admin al cliente.
    // Ahora: SedeDTO.fromEntity() expone solo los campos públicos.
    // =========================================================
    @GetMapping("/sedes")
    @ResponseBody
    public ResponseEntity<List<SedeDTO>> obtenerSedesActivas() {
        List<SedeDTO> sedes = sedeService.findByEstado(EstadoGeneral.ACTIVO)
                .stream()
                .map(SedeDTO::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(sedes);
    }

    @GetMapping("/sedes/{sedeId}")
    @ResponseBody
    public ResponseEntity<SedeDTO> obtenerSede(@PathVariable Long sedeId) {
        return sedeService.findById(sedeId)
                .map(sede -> ResponseEntity.ok(SedeDTO.fromEntity(sede)))
                .orElse(ResponseEntity.notFound().build());
    }

    // =========================================================
    // PAGOS
    // =========================================================
    @GetMapping("/pagos")
    @ResponseBody
    public ResponseEntity<List<Pago>> obtenerPagos() {
        Usuario usuario = getUsuarioAutenticado();

        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        return ResponseEntity.ok(
                pagoService.findByCliente_IdUsuario(usuario.getIdUsuario())
        );
    }

    // =========================================================
    // LOGOUT
    //
    // ✅ FIX C-07: Eliminado logout manual con session.invalidate().
    // Antes: solo destruía la HttpSession pero dejaba el SecurityContext
    //        activo — el token CSRF y la autenticación podían reutilizarse.
    // Ahora: redirige a POST /logout de Spring Security que hace limpieza
    //        completa: SecurityContext, sesión, cookies de remember-me.
    //
    // IMPORTANTE: el HTML debe enviar un POST con el token CSRF, no un GET.
    // Ejemplo correcto en Thymeleaf:
    //   <form th:action="@{/logout}" method="post">
    //     <input type="hidden" th:name="${_csrf.parameterName}" th:value="${_csrf.token}"/>
    //     <button type="submit">Cerrar sesión</button>
    //   </form>
    //
    // Este endpoint GET se mantiene solo como respaldo de compatibilidad
    // pero redirige a Spring Security en lugar de hacer invalidación manual.
    // =========================================================
    @GetMapping("/logout")
    public String cerrarSesion() {
        // Redirige al endpoint de Spring Security que hace logout completo.
        // Spring Security maneja la invalidación del SecurityContext,
        // la sesión HTTP y las cookies de autenticación.
        return "redirect:/logout";
    }
}