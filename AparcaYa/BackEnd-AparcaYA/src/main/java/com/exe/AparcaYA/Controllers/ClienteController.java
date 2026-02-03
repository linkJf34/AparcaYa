package com.exe.AparcaYA.Controllers;

import com.exe.AparcaYA.Entity.Usuario;
import com.exe.AparcaYA.Entity.Reservacion;
import com.exe.AparcaYA.Entity.Sede;
import com.exe.AparcaYA.Entity.Pago;
import com.exe.AparcaYA.Enum.EstadoGeneral;
import com.exe.AparcaYA.Enum.EstadoReservacion;
import com.exe.AparcaYA.Service.UsuarioService;
import com.exe.AparcaYA.Service.ReservacionService;
import com.exe.AparcaYA.Service.SedeService;
import com.exe.AparcaYA.Service.PagoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpSession;
import java.util.List;

@Controller
@RequestMapping("/cliente")
public class ClienteController {

    @Autowired
    private UsuarioService usuarioService;

    @Autowired
    private ReservacionService reservacionService;

    @Autowired
    private SedeService sedeService;

    @Autowired
    private PagoService pagoService;

    /**
     * Dashboard principal del cliente
     */
    @GetMapping("/dashboard")
    public String mostrarDashboard(HttpSession session, Model model) {
        Long userId = (Long) session.getAttribute("userId");

        if (userId == null) {
            return "redirect:/login";
        }

        try {
            Usuario usuario = usuarioService.findById(userId).orElse(null);

            if (usuario == null) {
                return "redirect:/login";
            }

            model.addAttribute("usuario", usuario);
            model.addAttribute("nombreUsuario", usuario.getNombre());
            model.addAttribute("userId", userId);

            List<Reservacion> reservaciones = reservacionService.findByCliente_IdUsuario(userId);
            model.addAttribute("reservaciones", reservaciones);

            long reservasActivas = reservaciones.stream()
                    .filter(r -> r.getEstado() == EstadoReservacion.ACTIVA)
                    .count();
            model.addAttribute("reservasActivas", reservasActivas);

            List<Sede> sedesActivas = sedeService.findByEstado(EstadoGeneral.ACTIVO);
            model.addAttribute("sedes", sedesActivas);

            return "cliente/dashboard";

        } catch (Exception e) {
            model.addAttribute("error", "Error cargando el dashboard: " + e.getMessage());
            return "error";
        }
    }

    /**
     * Obtiene el perfil del usuario (JSON)
     */
    @GetMapping("/perfil")
    @ResponseBody
    public ResponseEntity<Usuario> obtenerPerfil(HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");

        if (userId == null) {
            return ResponseEntity.status(401).build();
        }

        Usuario usuario = usuarioService.findById(userId).orElse(null);

        if (usuario == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(usuario);
    }

    /**
     * Actualiza el perfil del usuario
     */
    @PostMapping("/perfil/actualizar")
    @ResponseBody
    public ResponseEntity<String> actualizarPerfil(@RequestBody Usuario usuarioActualizado, HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");

        if (userId == null) {
            return ResponseEntity.status(401).body("{\"success\": false, \"message\": \"No autenticado\"}");
        }

        try {
            Usuario usuario = usuarioService.findById(userId).orElse(null);

            if (usuario == null) {
                return ResponseEntity.status(404).body("{\"success\": false, \"message\": \"Usuario no encontrado\"}");
            }

            if (usuarioActualizado.getNombre() != null) {
                usuario.setNombre(usuarioActualizado.getNombre());
            }
            if (usuarioActualizado.getCorreo() != null) {
                usuario.setCorreo(usuarioActualizado.getCorreo());
            }
            if (usuarioActualizado.getTelefono() != null) {
                usuario.setTelefono(usuarioActualizado.getTelefono());
            }

            usuarioService.update(usuario);

            return ResponseEntity.ok("{\"success\": true, \"message\": \"Perfil actualizado correctamente\"}");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("{\"success\": false, \"message\": \"" + e.getMessage() + "\"}");
        }
    }

    /**
     * Obtiene las reservas del cliente (JSON)
     */
    @GetMapping("/reservas")
    @ResponseBody
    public ResponseEntity<List<Reservacion>> obtenerReservas(HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");

        if (userId == null) {
            return ResponseEntity.status(401).build();
        }

        List<Reservacion> reservas = reservacionService.findByCliente_IdUsuario(userId);
        return ResponseEntity.ok(reservas);
    }

    /**
     * Cancela una reserva del cliente
     */
    @PostMapping("/reservas/{reservaId}/cancelar")
    @ResponseBody
    public ResponseEntity<String> cancelarReserva(@PathVariable Long reservaId, HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");

        if (userId == null) {
            return ResponseEntity.status(401).body("{\"success\": false, \"message\": \"No autenticado\"}");
        }

        try {
            Reservacion reserva = reservacionService.findById(reservaId).orElse(null);

            if (reserva == null) {
                return ResponseEntity.status(404).body("{\"success\": false, \"message\": \"Reserva no encontrada\"}");
            }

            if (!reserva.getCliente().getIdUsuario().equals(userId)) {
                return ResponseEntity.status(403).body("{\"success\": false, \"message\": \"No autorizado\"}");
            }

            if (reserva.getEstado() != EstadoReservacion.ACTIVA &&
                    reserva.getEstado() != EstadoReservacion.PENDIENTE) {
                return ResponseEntity.status(400).body("{\"success\": false, \"message\": \"La reserva no se puede cancelar\"}");
            }

            reserva.setEstado(EstadoReservacion.CANCELADA);
            reservacionService.update(reserva);

            return ResponseEntity.ok("{\"success\": true, \"message\": \"Reserva cancelada correctamente\"}");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("{\"success\": false, \"message\": \"" + e.getMessage() + "\"}");
        }
    }

    /**
     * Obtiene todas las sedes activas (JSON)
     */
    @GetMapping("/sedes")
    @ResponseBody
    public ResponseEntity<List<Sede>> obtenerSedesActivas() {
        List<Sede> sedes = sedeService.findByEstado(EstadoGeneral.ACTIVO);
        return ResponseEntity.ok(sedes);
    }

    /**
     * Obtiene información de una sede específica (JSON)
     */
    @GetMapping("/sedes/{sedeId}")
    @ResponseBody
    public ResponseEntity<Sede> obtenerSede(@PathVariable Long sedeId) {
        Sede sede = sedeService.findById(sedeId).orElse(null);

        if (sede == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(sede);
    }

    /**
     * Obtiene los pagos del cliente (JSON)
     */
    @GetMapping("/pagos")
    @ResponseBody
    public ResponseEntity<List<Pago>> obtenerPagos(HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");

        if (userId == null) {
            return ResponseEntity.status(401).build();
        }

        List<Pago> pagos = pagoService.findByCliente_IdUsuario(userId);
        return ResponseEntity.ok(pagos);
    }

    /**
     * Cierra la sesión del usuario
     */
    @GetMapping("/logout")
    public String cerrarSesion(HttpSession session) {
        session.invalidate();
        return "redirect:/login";
    }
}