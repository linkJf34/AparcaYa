package com.exe.AparcaYA.Controllers;

import com.exe.AparcaYA.Dto.SedeDTO;
import com.exe.AparcaYA.Dto.UsuarioDTO;
import com.exe.AparcaYA.Entity.Pago;
import com.exe.AparcaYA.Entity.Reservacion;
import com.exe.AparcaYA.Entity.Usuario;
import com.exe.AparcaYA.Entity.Vehiculo;
import com.exe.AparcaYA.Enum.EstadoGeneral;
import com.exe.AparcaYA.Enum.EstadoReservacion;
import com.exe.AparcaYA.Service.PagoService;
import com.exe.AparcaYA.Service.ReservacionService;
import com.exe.AparcaYA.Service.SedeService;
import com.exe.AparcaYA.Service.UsuarioService;
import com.exe.AparcaYA.Service.VehiculoService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Controller
@RequestMapping("/cliente")
@PreAuthorize("hasRole('CLIENTE')")
public class ClienteController {

    @Autowired private UsuarioService     usuarioService;
    @Autowired private ReservacionService reservacionService;
    @Autowired private SedeService        sedeService;
    @Autowired private PagoService        pagoService;
    @Autowired private VehiculoService    vehiculoService;

    // ✅ FIX-P1: inyectado para verificar y hashear contraseñas en cambiarPassword()
    // Sin este bean, cambiarContrasena() del JS llamaba a /perfil/actualizar
    // que ignoraba los campos de password — el botón nunca hacía nada real.
    @Autowired private PasswordEncoder    passwordEncoder;

    // =========================================================
    // UTILIDAD
    // =========================================================
    private Usuario getUsuarioAutenticado() {
        String correo = SecurityContextHolder.getContext()
                .getAuthentication()
                .getName();
        return usuarioService.findByCorreo(correo).orElse(null);
    }

    // =========================================================
    // DASHBOARD
    // =========================================================
    @GetMapping("/dashboard")
    public String mostrarDashboard(Model model) {
        Usuario usuario = getUsuarioAutenticado();
        if (usuario == null) return "redirect:/login";

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
    // PERFIL — GET
    // =========================================================
    @GetMapping("/perfil")
    @ResponseBody
    public ResponseEntity<UsuarioDTO> obtenerPerfil() {
        Usuario usuario = getUsuarioAutenticado();
        if (usuario == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(UsuarioDTO.fromEntity(usuario));
    }

    // =========================================================
    // PERFIL — Actualizar nombre y teléfono
    // Solo procesa "nombre" y "telefono".
    // Los campos de contraseña usan /perfil/cambiar-password.
    // =========================================================
    @PostMapping("/perfil/actualizar")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> actualizarPerfil(
            @RequestBody Map<String, String> campos) {
        Usuario usuario = getUsuarioAutenticado();
        if (usuario == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("success", false, "message", "No autenticado"));
        try {
            if (campos.containsKey("nombre"))   usuario.setNombre(campos.get("nombre"));
            if (campos.containsKey("telefono")) usuario.setTelefono(campos.get("telefono"));
            if (campos.containsKey("correo")) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("success", false,
                                "message", "El correo no puede modificarse desde este endpoint"));
            }

            usuarioService.update(usuario);
            return ResponseEntity.ok(Map.of("success", true,
                    "message", "Perfil actualizado correctamente"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    // =========================================================
    // PERFIL — Cambiar contraseña
    //
    // ✅ FIX-P1: endpoint nuevo que realmente cambia la contraseña.
    //
    // Antes: cambiarContrasena() del JS llamaba a POST /perfil/actualizar,
    //        que solo procesaba "nombre" y "telefono" — los campos
    //        "passwordActual" y "passwordNueva" eran ignorados.
    //        El botón "Actualizar contraseña" respondía success:true
    //        sin modificar nada en la base de datos.
    //
    // Ahora: este endpoint verifica la contraseña actual con BCrypt,
    //        valida la nueva, la hashea y la persiste correctamente.
    // =========================================================
    @PostMapping("/perfil/cambiar-password")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> cambiarPassword(
            @RequestBody Map<String, String> campos) {

        Usuario usuario = getUsuarioAutenticado();
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "No autenticado"));
        }

        String passwordActual = campos.get("passwordActual");
        String passwordNueva  = campos.get("passwordNueva");

        // Validar que vengan los dos campos
        if (passwordActual == null || passwordActual.isBlank() ||
                passwordNueva  == null || passwordNueva.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("success", false, "message", "Completa todos los campos"));
        }

        // Longitud mínima — espeja la validación del frontend
        if (passwordNueva.length() < 8) {
            return ResponseEntity.badRequest()
                    .body(Map.of("success", false,
                            "message", "La nueva contraseña debe tener al menos 8 caracteres"));
        }

        // Verificar que la contraseña actual sea correcta
        if (!passwordEncoder.matches(passwordActual, usuario.getContrasena())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("success", false,
                            "message", "La contraseña actual es incorrecta"));
        }

        try {
            usuario.setContrasena(passwordEncoder.encode(passwordNueva));
            usuarioService.update(usuario);
            log.info("Contraseña actualizada — usuario={}", usuario.getIdUsuario());
            return ResponseEntity.ok(Map.of("success", true,
                    "message", "Contraseña actualizada correctamente"));
        } catch (Exception e) {
            log.error("Error actualizando contraseña — usuario={}: {}",
                    usuario.getIdUsuario(), e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false,
                            "message", "Error al actualizar la contraseña"));
        }
    }

    // =========================================================
    // VEHÍCULOS
    // =========================================================
    @GetMapping("/vehiculos")
    @ResponseBody
    public ResponseEntity<List<Map<String, Object>>> obtenerVehiculos() {
        Usuario usuario = getUsuarioAutenticado();
        if (usuario == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        try {
            List<Vehiculo> vehiculos =
                    vehiculoService.findByIdUsuario(usuario.getIdUsuario());

            List<Map<String, Object>> resultado = vehiculos.stream().map(v -> {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("idVehiculo", v.getIdVehiculo());
                item.put("placa",      v.getPlaca());
                item.put("marca",  v.getMarca() != null ? v.getMarca().name()  : "");
                item.put("modelo", v.getTipo()  != null ? v.getTipo().name()   : "");
                item.put("color",  v.getColor() != null ? v.getColor()         : "");
                item.put("anio",   v.getAnio()  != null ? v.getAnio()          : "");
                return item;
            }).collect(Collectors.toList());

            return ResponseEntity.ok(resultado);
        } catch (Exception e) {
            log.error("Error cargando vehículos del cliente: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // =========================================================
    // RESERVAS — GET
    // =========================================================
    @GetMapping("/reservas")
    @ResponseBody
    public ResponseEntity<List<Map<String, Object>>> obtenerReservas() {
        Usuario usuario = getUsuarioAutenticado();
        if (usuario == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        try {
            List<Reservacion> reservaciones =
                    reservacionService.findByCliente_IdUsuario(usuario.getIdUsuario());

            List<Map<String, Object>> resultado = reservaciones.stream().map(r -> {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("idReserva",   r.getIdReserva());
                item.put("fechaInicio", r.getFechaInicio());
                item.put("fechaFin",    r.getFechaFin());
                item.put("estado",      r.getEstado() != null ? r.getEstado().name() : "");

                String nombreSede = "Sede desconocida";
                if (r.getCupo() != null && r.getCupo().getSede() != null
                        && r.getCupo().getSede().getNombre() != null) {
                    nombreSede = r.getCupo().getSede().getNombre();
                }
                Map<String, Object> sede = new LinkedHashMap<>();
                sede.put("nombre", nombreSede);
                Map<String, Object> cupo = new LinkedHashMap<>();
                cupo.put("sede", sede);
                item.put("cupo", cupo);

                return item;
            }).collect(Collectors.toList());

            return ResponseEntity.ok(resultado);
        } catch (Exception e) {
            log.error("Error cargando reservas del cliente: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // =========================================================
    // RESERVAS — Cancelar
    // =========================================================
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
            reservacionService.cancelarReserva(reservaId, usuario.getIdUsuario());
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Reserva cancelada correctamente"
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("success", false, "message", e.getMessage()));
        } catch (SecurityException e) {
            log.warn("Cliente {} intentó cancelar reserva {} de otro usuario",
                    usuario.getIdUsuario(), reservaId);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("success", false, "message", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    // =========================================================
    // SEDES
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
                .map(s -> ResponseEntity.ok(SedeDTO.fromEntity(s)))
                .orElse(ResponseEntity.notFound().build());
    }

    // =========================================================
    // PAGOS
    // =========================================================
    @GetMapping("/pagos")
    @ResponseBody
    public ResponseEntity<List<Map<String, Object>>> obtenerPagos() {
        Usuario usuario = getUsuarioAutenticado();
        if (usuario == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        try {
            List<Pago> pagos = pagoService.findByCliente_IdUsuario(usuario.getIdUsuario());

            List<Map<String, Object>> resultado = pagos.stream().map(p -> {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("fechaPago",   p.getFechaPago());
                item.put("monto",       p.getMonto());
                item.put("metodoPago",  p.getMetodoPago() != null ? p.getMetodoPago().name() : "N/A");
                item.put("estado",      p.getEstado()     != null ? p.getEstado().name()     : "");

                Long idReserva = null;
                if (p.getReservacion() != null) {
                    idReserva = p.getReservacion().getIdReserva();
                }
                Map<String, Object> reservacion = new LinkedHashMap<>();
                reservacion.put("idReserva", idReserva);
                item.put("reservacion", reservacion);

                return item;
            }).collect(Collectors.toList());

            return ResponseEntity.ok(resultado);
        } catch (Exception e) {
            log.error("Error cargando pagos del cliente: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // =========================================================
    // LOGOUT
    // =========================================================
    @GetMapping("/logout")
    public String cerrarSesion() {
        return "redirect:/logout";
    }
}