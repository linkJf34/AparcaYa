package com.exe.AparcaYA.Controllers;

import com.exe.AparcaYA.Config.CustomUserDetailsService;
import com.exe.AparcaYA.Config.JwtUtil;
import com.exe.AparcaYA.Dto.RegistroRequest;
import com.exe.AparcaYA.Entity.*;
import com.exe.AparcaYA.Enum.*;
import com.exe.AparcaYA.Repository.EmailLogRepository;
import com.exe.AparcaYA.Repository.SedeRepository;
import com.exe.AparcaYA.Repository.VehiculoRepository;
import com.exe.AparcaYA.Service.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Controller
@RequiredArgsConstructor
@CrossOrigin(origins = "${app.cors.allowed-origins:http://localhost:8080}")
public class UsuarioController {

    private final UsuarioService           usuarioService;
    private final VehiculoService          vehiculoService;
    private final SedeService              sedeService;
    private final CupoService              cupoService;
    private final TarifaService            tarifaService;
    private final PasswordEncoder          passwordEncoder;
    private final SedeRepository           sedeRepository;
    private final VehiculoRepository       vehiculoRepository;
    private final IEmailService            emailService;
    private final JwtUtil                  jwtUtil;                  // ← AÑADIDO
    private final CustomUserDetailsService customUserDetailsService; // ← AÑADIDO

    // =====================================================================
    // REGISTRO
    // =====================================================================

    @PostMapping("/registrar")
    @Transactional(rollbackFor = Exception.class)
    @ResponseBody
    public ResponseEntity<Map<String, Object>> registrarUsuario(
            @RequestBody RegistroRequest request) {

        log.info("Iniciando registro para correo: {}", request.getCorreo());

        // =====================================================================
        // FASE 1 — VALIDACIONES (sin guardar nada)
        // =====================================================================

        // ── 1.1 Campos obligatorios ──────────────────────────────────────────
        if (request.getNombre()     == null || request.getNombre().isBlank()     ||
                request.getCorreo()     == null || request.getCorreo().isBlank()     ||
                request.getCedula()     == null || request.getCedula().isBlank()     ||
                request.getTelefono()   == null || request.getTelefono().isBlank()   ||
                request.getContrasena() == null || request.getContrasena().isBlank() ||
                request.getRol()        == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false, "message", "Campos obligatorios faltantes"));
        }

        // ── 1.2 Formatos ─────────────────────────────────────────────────────
        if (!request.getCorreo().matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"))
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false, "message", "Formato de correo inválido"));

        if (!request.getTelefono().matches("[0-9]{10}"))
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false, "message", "El teléfono debe tener exactamente 10 dígitos"));

        if (!request.getCedula().matches("[0-9]{10}"))
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false, "message", "La cédula debe tener exactamente 10 dígitos"));

        if (request.getContrasena().length() < 8)
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false, "message", "La contraseña debe tener al menos 8 caracteres"));

        // ── 1.3 Duplicados ───────────────────────────────────────────────────
        if (usuarioService.findByCorreo(request.getCorreo()).isPresent())
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false, "message", "El correo ya está registrado"));

        if (usuarioService.findByTelefono(request.getTelefono()) != null)
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false, "message", "El teléfono ya está registrado"));

        if (usuarioService.findByCedula(request.getCedula()) != null)
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false, "message", "La cédula ya está registrada"));

        // ── 1.4 Validaciones por rol ─────────────────────────────────────────
        if (request.getRol() == Rolenum.CLIENTE) {

            if (request.getPlaca() == null || request.getPlaca().isBlank())
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false, "message", "La placa del vehículo es obligatoria"));

            String placaNormalizada = request.getPlaca().trim().toUpperCase();
            if (!placaNormalizada.matches("[A-Z]{3}[0-9]{3}"))
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false, "message", "Formato de placa inválido (ej. ABC123)"));

            if (vehiculoRepository.existsByPlaca(placaNormalizada))
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false, "message", "La placa ya está registrada"));

            request.setPlaca(placaNormalizada);

        } else if (request.getRol() == Rolenum.ADMINISTRADOR_SEDE) {

            if (request.getHiddenNombreSede()  == null || request.getHiddenNit()         == null ||
                    request.getHiddenDireccion()   == null || request.getHiddenLocalidad()    == null ||
                    request.getHiddenBarrio()      == null || request.getHiddenCuposTotales() == null ||
                    request.getTarifaPlenaC()      == null || request.getTarifaPlenaM()       == null ||
                    request.getTarifaMinutoC()     == null || request.getTarifaMinutoM()      == null ||
                    request.getHiddenHorarioSede() == null)
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false, "message", "Faltan datos obligatorios de la sede"));

            if (!request.getHiddenNit().matches("[0-9]{9}-[0-9]"))
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false, "message", "Formato de NIT inválido (ej. 123456789-0)"));

            if (sedeRepository.existsByNit(request.getHiddenNit()))
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false, "message", "El NIT ya está registrado"));

            if (request.getHiddenLatitud() == null || request.getHiddenLongitud() == null)
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false, "message",
                        "Debes confirmar la ubicación en el mapa antes de registrarte"));

            double lat = request.getHiddenLatitud();
            double lon = request.getHiddenLongitud();
            if (lat < 4.45 || lat > 4.85 || lon < -74.25 || lon > -73.95)
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false, "message",
                        "La ubicación debe estar dentro de Bogotá"));

            try {
                boolean barrioValido = Arrays.asList(
                        Localidad.valueOf(request.getHiddenLocalidad()).getBarrios()
                ).contains(request.getHiddenBarrio());
                if (!barrioValido)
                    return ResponseEntity.badRequest().body(Map.of(
                            "success", false, "message",
                            "Barrio inválido para la localidad seleccionada"));
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false, "message", "Localidad inválida"));
            }
        }

        // =====================================================================
        // FASE 2 — GUARDADO ATÓMICO
        // =====================================================================
        try {
            // ── 2.1 Guardar usuario ──────────────────────────────────────────
            Usuario usuario = new Usuario();
            usuario.setNombre(request.getNombre());
            usuario.setCorreo(request.getCorreo());
            usuario.setTelefono(request.getTelefono());
            usuario.setCedula(request.getCedula());
            usuario.setRol(request.getRol());
            usuario.setEstado(EstadoGeneral.ACTIVO);
            usuario.setDescripcion("");
            usuario.setContrasena(passwordEncoder.encode(request.getContrasena()));

            // FIX BUG #1 — metodo_pago solo para CLIENTE; null para los demás
            // La columna en BD ya no tiene NOT NULL (ver ALTER TABLE ejecutado en Render)
            if (request.getRol() == Rolenum.CLIENTE) {
                usuario.setMetodoPago(MetodoPago.EFECTIVO);
            }

            Usuario guardado = usuarioService.save(usuario);
            log.info("Usuario guardado: id={} rol={}", guardado.getIdUsuario(), guardado.getRol());

            // ── 2.2 OPERARIO — asignar sede del admin autenticado ────────────
            if (request.getRol() == Rolenum.OPERARIO) {
                try {
                    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
                    Optional<Usuario> adminOpt = usuarioService.findByCorreo(auth.getName());
                    if (adminOpt.isPresent()) {
                        Sede sedeAdmin = sedeService.findByIdUsuario(adminOpt.get().getIdUsuario());
                        if (sedeAdmin != null) {
                            guardado.setSedeAsignada(sedeAdmin);
                            usuarioService.save(guardado);
                            log.info("Operario id={} asignado a sede: {}",
                                    guardado.getIdUsuario(), sedeAdmin.getNombre());
                        }
                    }
                } catch (Exception e) {
                    log.error("Error asignando operario a sede: {}", e.getMessage(), e);
                }
            }

            // ── 2.3 ADMINISTRADOR_SEDE — guardar sede + cupos + tarifas ─────
            if (request.getRol() == Rolenum.ADMINISTRADOR_SEDE) {

                Sede sede = new Sede();
                sede.setNombre(request.getHiddenNombreSede());
                sede.setNit(request.getHiddenNit());
                sede.setDireccion(request.getHiddenDireccion());
                sede.setLocalidad(Localidad.valueOf(request.getHiddenLocalidad()));
                sede.setBarrio(request.getHiddenBarrio());
                sede.setCapacidad(request.getHiddenCuposTotales());
                sede.setHorarioSede(request.getHiddenHorarioSede());
                sede.setIdUsuario(guardado);
                sede.setEstado(EstadoGeneral.ACTIVO);
                sede.setFechaCreacion(LocalDateTime.now());
                sede.setLatitud(request.getHiddenLatitud());
                sede.setLongitud(request.getHiddenLongitud());

                Sede sedeGuardada = sedeService.save(sede);
                log.info("Sede guardada: id={}", sedeGuardada.getIdSede());

                cupoService.crearCuposParaSede(sedeGuardada);
                log.info("Cupo inicial creado para sede id={}", sedeGuardada.getIdSede());

                Tarifa tarifa = Tarifa.builder()
                        .tipoTarifa("GENERAL")
                        .tarifaPlenaC(request.getTarifaPlenaC())
                        .tarifaMinutoC(request.getTarifaMinutoC())
                        .tarifaHoraC(0.0)
                        .tarifaPlenaM(request.getTarifaPlenaM())
                        .tarifaMinutoM(request.getTarifaMinutoM())
                        .tarifaHoraM(0.0)
                        .tarifaPlenaB(0.0)
                        .tarifaMinutoB(0.0)
                        .tarifaHoraB(0.0)
                        .sede(sedeGuardada)
                        .build();
                tarifaService.save(tarifa);
                log.info("Tarifa creada para sede id={}", sedeGuardada.getIdSede());
            }

            // ── 2.4 CLIENTE — guardar vehículo ───────────────────────────────
            if (request.getRol() == Rolenum.CLIENTE) {
                Vehiculo vehiculo = new Vehiculo();
                vehiculo.setPlaca(request.getPlaca());
                vehiculo.setTipo(request.getTipoVehiculo());
                vehiculo.setMarca(request.getMarca());
                vehiculo.setColor(request.getColor());
                vehiculo.setAnio(request.getAnio());
                vehiculo.setIdUsuario(guardado);
                Vehiculo vehiculoGuardado = vehiculoService.save(vehiculo);
                log.info("Vehículo guardado: id={} placa={}",
                        vehiculoGuardado.getIdVehiculo(), vehiculoGuardado.getPlaca());
            }

            // ── 2.5 FIX: Generar JWT ANTES del email ────────────────────────
            UserDetails userDetails = customUserDetailsService
                    .loadUserByUsername(guardado.getCorreo());

            Long sedeId = null;
            if (guardado.getRol() == Rolenum.ADMINISTRADOR_SEDE) {
                Sede s = sedeService.findByIdUsuario(guardado.getIdUsuario());
                if (s != null) sedeId = s.getIdSede();
            } else if (guardado.getRol() == Rolenum.OPERARIO) {
                if (guardado.getSedeAsignada() != null)
                    sedeId = guardado.getSedeAsignada().getIdSede();
            }

            String token = jwtUtil.generateToken(
                    userDetails, guardado.getRol().name(), sedeId);
            log.info("JWT generado post-registro para: {}", guardado.getCorreo());

            String redirectUrl = switch (guardado.getRol()) {
                case ADMIN              -> "/dashboard/administradorGeneral";
                case ADMINISTRADOR_SEDE -> "/dashboard/administradorSede";
                case OPERARIO           -> "/dashboard/trabajadorParqueadero";
                case CLIENTE            -> "/dashboard/cliente";
                default                 -> "/login";
            };

            // Preparar respuesta ANTES de intentar el email
            Map<String, Object> respuesta = new HashMap<>();
            respuesta.put("success",     true);
            respuesta.put("token",       token);
            respuesta.put("rol",         guardado.getRol().name());
            respuesta.put("redirectUrl", redirectUrl);
            respuesta.put("nombre",      guardado.getNombre());
            if (sedeId != null) respuesta.put("sedeId", sedeId);

            // ── 2.6 Email de bienvenida — fallo NO revierte el registro ──────
            try {
                emailService.enviarBienvenida(
                        guardado.getCorreo(),
                        guardado.getNombre(),
                        guardado.getRol()
                );
            } catch (Exception emailEx) {
                // Solo loguear — el usuario ya está guardado y el JWT ya está listo
                log.error("Email de bienvenida falló (no crítico): {}", emailEx.getMessage());
            }

            log.info("Registro completado. Redirigiendo a: {}", redirectUrl);
            return ResponseEntity.ok(respuesta);

        } catch (DataIntegrityViolationException e) {
            log.error("Race condition en registro: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Datos duplicados detectados. Intenta nuevamente."));

        } catch (Exception e) {
            log.error("Error general en registro: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false, "message", "Error interno del sistema"));
        }
    }

    // =====================================================================
    // VERIFICACIÓN DE DUPLICADOS
    // =====================================================================

    @GetMapping("/check/correo")
    @ResponseBody
    public Map<String, Object> checkCorreo(@RequestParam String value) {
        boolean disponible = usuarioService.findByCorreo(value.trim()).isEmpty();
        return Map.of("disponible", disponible,
                "mensaje", disponible ? "Correo disponible" : "El correo ya está registrado");
    }

    @GetMapping("/check/cedula")
    @ResponseBody
    public Map<String, Object> checkCedula(@RequestParam String value) {
        boolean disponible = (usuarioService.findByCedula(value.trim()) == null);
        return Map.of("disponible", disponible,
                "mensaje", disponible ? "Cédula disponible" : "La cédula ya está registrada");
    }

    @GetMapping("/check/telefono")
    @ResponseBody
    public Map<String, Object> checkTelefono(@RequestParam String value) {
        boolean disponible = (usuarioService.findByTelefono(value.trim()) == null);
        return Map.of("disponible", disponible,
                "mensaje", disponible ? "Teléfono disponible" : "El teléfono ya está registrado");
    }

    @GetMapping("/check/nit")
    @ResponseBody
    public Map<String, Object> checkNit(@RequestParam String value) {
        boolean disponible = !sedeRepository.existsByNit(value.trim());
        return Map.of("disponible", disponible,
                "mensaje", disponible ? "NIT disponible" : "El NIT ya está registrado");
    }

    // =====================================================================
    // DASHBOARDS POR ROL
    // =====================================================================

    @GetMapping("/dashboard/administradorGeneral")
    public String dashboardAdminGeneral() { return "DashboardAdmin"; }

    @GetMapping("/dashboard/administradorSede")
    public String dashboardAdminSede() { return "DashboardSede"; }

    @GetMapping("/dashboard/trabajadorParqueadero")
    public String dashboardTrabajador() { return "DashboardTrabajador"; }

    @GetMapping("/dashboard/cliente")
    public String dashboardCliente() { return "DashboardCliente"; }

    @GetMapping("/configuracion/sede")
    public String configuracionSede() { return "ConfiguracionSede"; }
}