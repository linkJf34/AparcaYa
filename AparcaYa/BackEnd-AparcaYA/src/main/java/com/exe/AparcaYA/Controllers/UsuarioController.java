package com.exe.AparcaYA.Controllers;

import com.exe.AparcaYA.Dto.RegistroRequest;
import com.exe.AparcaYA.Entity.*;
import com.exe.AparcaYA.Enum.*;
import com.exe.AparcaYA.Repository.EmailLogRepository;
import com.exe.AparcaYA.Repository.SedeRepository;
import com.exe.AparcaYA.Repository.VehiculoRepository;
import com.exe.AparcaYA.Service.*;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Controller
@RequiredArgsConstructor
@CrossOrigin(origins = "${app.cors.allowed-origins:http://localhost:8080}")
public class UsuarioController {

    private final UsuarioService        usuarioService;
    private final VehiculoService       vehiculoService;
    private final SedeService           sedeService;
    private final CupoService           cupoService;
    private final TarifaService         tarifaService;
    private final PasswordEncoder       passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final SedeRepository        sedeRepository;
    private final VehiculoRepository    vehiculoRepository;
    private final IEmailService         emailService;

    // =====================================================================
    // REGISTRO
    // =====================================================================

    @PostMapping("/registrar")
    @Transactional(rollbackFor = Exception.class)
    public String registrarUsuario(
            @ModelAttribute RegistroRequest request,
            RedirectAttributes redirectAttributes,
            HttpServletRequest httpRequest) {

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
            redirectAttributes.addFlashAttribute("error", "Campos obligatorios faltantes");
            return "redirect:/registro";
        }

        // ── 1.2 Formatos ─────────────────────────────────────────────────────
        if (!request.getCorreo().matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            redirectAttributes.addFlashAttribute("error", "Formato de correo inválido");
            return "redirect:/registro";
        }
        if (!request.getTelefono().matches("[0-9]{10}")) {
            redirectAttributes.addFlashAttribute("error",
                    "El teléfono debe tener exactamente 10 dígitos");
            return "redirect:/registro";
        }
        if (!request.getCedula().matches("[0-9]{10}")) {
            redirectAttributes.addFlashAttribute("error",
                    "La cédula debe tener exactamente 10 dígitos");
            return "redirect:/registro";
        }
        if (request.getContrasena().length() < 8) {
            redirectAttributes.addFlashAttribute("error",
                    "La contraseña debe tener al menos 8 caracteres");
            return "redirect:/registro";
        }

        // ── 1.3 Duplicados de usuario ────────────────────────────────────────
        if (usuarioService.findByCorreo(request.getCorreo()).isPresent()) {
            redirectAttributes.addFlashAttribute("error", "El correo ya está registrado");
            return "redirect:/registro";
        }
        if (usuarioService.findByTelefono(request.getTelefono()) != null) {
            redirectAttributes.addFlashAttribute("error", "El teléfono ya está registrado");
            return "redirect:/registro";
        }
        if (usuarioService.findByCedula(request.getCedula()) != null) {
            redirectAttributes.addFlashAttribute("error", "La cédula ya está registrada");
            return "redirect:/registro";
        }

        // ── 1.4 Validaciones por rol ─────────────────────────────────────────

        if (request.getRol() == Rolenum.CLIENTE) {

            if (request.getPlaca() == null || request.getPlaca().isBlank()) {
                redirectAttributes.addFlashAttribute("error",
                        "La placa del vehículo es obligatoria");
                return "redirect:/registro";
            }
            String placaNormalizada = request.getPlaca().trim().toUpperCase();
            if (!placaNormalizada.matches("[A-Z]{3}[0-9]{3}")) {
                redirectAttributes.addFlashAttribute("error",
                        "Formato de placa inválido (ej. ABC123)");
                return "redirect:/registro";
            }
            if (vehiculoRepository.existsByPlaca(placaNormalizada)) {
                redirectAttributes.addFlashAttribute("error", "La placa ya está registrada");
                return "redirect:/registro";
            }
            request.setPlaca(placaNormalizada);

        } else if (request.getRol() == Rolenum.ADMINISTRADOR_SEDE) {

            if (request.getHiddenNombreSede()  == null || request.getHiddenNit()         == null ||
                    request.getHiddenDireccion()   == null || request.getHiddenLocalidad()    == null ||
                    request.getHiddenBarrio()      == null || request.getHiddenCuposTotales() == null ||
                    request.getTarifaPlenaC()      == null || request.getTarifaPlenaM()       == null ||
                    request.getTarifaMinutoC()     == null || request.getTarifaMinutoM()      == null ||
                    request.getHiddenHorarioSede() == null) {
                redirectAttributes.addFlashAttribute("error",
                        "Faltan datos obligatorios de la sede");
                return "redirect:/registro";
            }
            if (!request.getHiddenNit().matches("[0-9]{9}-[0-9]")) {
                redirectAttributes.addFlashAttribute("error",
                        "Formato de NIT inválido (ej. 123456789-0)");
                return "redirect:/registro";
            }
            if (sedeRepository.existsByNit(request.getHiddenNit())) {
                redirectAttributes.addFlashAttribute("error", "El NIT ya está registrado");
                return "redirect:/registro";
            }
            if (request.getHiddenLatitud() == null || request.getHiddenLongitud() == null) {
                redirectAttributes.addFlashAttribute("error",
                        "Debes confirmar la ubicación en el mapa antes de registrarte");
                return "redirect:/registro";
            }
            double lat = request.getHiddenLatitud();
            double lon = request.getHiddenLongitud();
            if (lat < 4.45 || lat > 4.85 || lon < -74.25 || lon > -73.95) {
                redirectAttributes.addFlashAttribute("error",
                        "La ubicación debe estar dentro de Bogotá");
                return "redirect:/registro";
            }
            String barrio = request.getHiddenBarrio();
            try {
                boolean barrioValido = Arrays.asList(
                        Localidad.valueOf(request.getHiddenLocalidad()).getBarrios()
                ).contains(barrio);
                if (!barrioValido) {
                    redirectAttributes.addFlashAttribute("error",
                            "Barrio inválido para la localidad seleccionada");
                    return "redirect:/registro";
                }
            } catch (IllegalArgumentException e) {
                redirectAttributes.addFlashAttribute("error", "Localidad inválida");
                return "redirect:/registro";
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

            // metodoPago solo aplica para CLIENTE
            if (request.getRol() == Rolenum.CLIENTE) {
                usuario.setMetodoPago(MetodoPago.EFECTIVO);
            }

            // ELIMINADO: usuario.setTipoCliente() — ya no existe en Usuario

            Usuario guardado = usuarioService.save(usuario);
            log.info("Usuario guardado: id={} rol={}",
                    guardado.getIdUsuario(), guardado.getRol());

            // ── 2.2 OPERARIO — asignar sede del admin autenticado ────────────
            if (request.getRol() == Rolenum.OPERARIO) {
                try {
                    Authentication auth = SecurityContextHolder.getContext()
                            .getAuthentication();
                    Optional<Usuario> adminOpt = usuarioService
                            .findByCorreo(auth.getName());
                    if (adminOpt.isPresent()) {
                        Sede sedeAdmin = sedeService
                                .findByIdUsuario(adminOpt.get().getIdUsuario());
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

                // Sede — sin campos de tarifa ni cupos (ya no existen ahí)
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

                // Cupos — un Cupo por sede con contadores en 0
                cupoService.crearCuposParaSede(sedeGuardada);
                log.info("Cupo inicial creado para sede id={}", sedeGuardada.getIdSede());

                // Tarifa — una Tarifa por sede con los valores del request
                // CORRECCIÓN: los precios vienen del request, no de Sede
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

            // ── 2.5 Correo de bienvenida ─────────────────────────────────────
            emailService.enviarBienvenida(
                    guardado.getCorreo(),
                    guardado.getNombre(),
                    guardado.getRol()
            );

            // ── 2.6 Autenticación automática post-registro ───────────────────
            try {
                Authentication authentication = authenticationManager.authenticate(
                        new UsernamePasswordAuthenticationToken(
                                guardado.getCorreo(), request.getContrasena())
                );
                SecurityContextHolder.getContext().setAuthentication(authentication);
                HttpSession session = httpRequest.getSession(true);
                session.setAttribute(
                        HttpSessionSecurityContextRepository
                                .SPRING_SECURITY_CONTEXT_KEY,
                        SecurityContextHolder.getContext()
                );
            } catch (Exception e) {
                log.error("Error autenticando usuario tras registro: {}",
                        e.getMessage());
                return "redirect:/login";
            }

            // ── 2.7 Redirect al dashboard ────────────────────────────────────
            String extra = switch (guardado.getRol()) {
                case CLIENTE            -> " con vehículo";
                case ADMINISTRADOR_SEDE -> " con sede, cupos y tarifa";
                default                 -> "";
            };
            redirectAttributes.addFlashAttribute("success",
                    "Usuario registrado exitosamente" + extra);

            String redirectUrl = switch (guardado.getRol()) {
                case ADMIN              -> "/dashboard/administradorGeneral";
                case ADMINISTRADOR_SEDE -> "/dashboard/administradorSede";
                case OPERARIO           -> "/dashboard/trabajadorParqueadero";
                case CLIENTE            -> "/dashboard/cliente";
                default                 -> "/login";
            };

            log.info("Registro completado. Redirigiendo a: {}", redirectUrl);
            return "redirect:" + redirectUrl;

        } catch (DataIntegrityViolationException e) {
            log.error("Race condition en registro: {}", e.getMessage());
            redirectAttributes.addFlashAttribute("error",
                    "Datos duplicados detectados. Intenta nuevamente.");
            return "redirect:/registro";

        } catch (Exception e) {
            log.error("Error general en registro: {}", e.getMessage(), e);
            redirectAttributes.addFlashAttribute("error",
                    "Error interno del sistema");
            return "redirect:/registro";
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
                "mensaje", disponible
                        ? "Correo disponible" : "El correo ya está registrado");
    }

    @GetMapping("/check/cedula")
    @ResponseBody
    public Map<String, Object> checkCedula(@RequestParam String value) {
        boolean disponible = (usuarioService.findByCedula(value.trim()) == null);
        return Map.of("disponible", disponible,
                "mensaje", disponible
                        ? "Cédula disponible" : "La cédula ya está registrada");
    }

    @GetMapping("/check/telefono")
    @ResponseBody
    public Map<String, Object> checkTelefono(@RequestParam String value) {
        boolean disponible = (usuarioService.findByTelefono(value.trim()) == null);
        return Map.of("disponible", disponible,
                "mensaje", disponible
                        ? "Teléfono disponible" : "El teléfono ya está registrado");
    }

    @GetMapping("/check/nit")
    @ResponseBody
    public Map<String, Object> checkNit(@RequestParam String value) {
        boolean disponible = !sedeRepository.existsByNit(value.trim());
        return Map.of("disponible", disponible,
                "mensaje", disponible
                        ? "NIT disponible" : "El NIT ya está registrado");
    }

    // =====================================================================
    // CORREO DE BIENVENIDA
    // =====================================================================



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