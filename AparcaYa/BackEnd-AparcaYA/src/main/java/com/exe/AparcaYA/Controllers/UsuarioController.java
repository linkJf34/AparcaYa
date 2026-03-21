package com.exe.AparcaYA.Controllers;

import com.exe.AparcaYA.Dto.RegistroRequest;
import com.exe.AparcaYA.Entity.*;
import com.exe.AparcaYA.Enum.*;
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

    private final UsuarioService         usuarioService;
    private final VehiculoService        vehiculoService;
    private final SedeService            sedeService;
    private final CupoService            cupoService;
    private final TarifaService          tarifaService;
    private final PasswordEncoder        passwordEncoder;
    private final JavaMailSender         mailSender;
    private final AuthenticationManager  authenticationManager;
    private final SedeRepository         sedeRepository;
    private final VehiculoRepository     vehiculoRepository;

    // =====================================================================
    // REGISTRO
    //
    // PATRÓN: validate-all → then-save
    //
    // ANTES (problema):
    //   save(usuario) → validar placa → si falla: return redirect
    //   → @Transactional NO hace rollback porque no hay excepción
    //   → el usuario queda guardado en BD sin vehículo ni sede
    //
    // AHORA (solución):
    //   FASE 1 — Validar TODO (campos, formatos, duplicados usuario,
    //            duplicados placa/NIT, campos sede/vehículo)
    //            Si cualquier validación falla → redirect SIN haber
    //            guardado nada todavía
    //   FASE 2 — Guardar TODO en una sola transacción atómica
    //            Si algo falla aquí (race condition) → @Transactional
    //            hace rollback completo: ni usuario, ni vehículo, ni sede
    // =====================================================================

    @PostMapping("/registrar")
    @Transactional(rollbackFor = Exception.class)
    public String registrarUsuario(
            @ModelAttribute RegistroRequest request,
            RedirectAttributes redirectAttributes,
            HttpServletRequest httpRequest) {

        log.info("Iniciando registro para correo: {}", request.getCorreo());

        // =====================================================================
        // FASE 1 — VALIDACIONES COMPLETAS (sin guardar nada todavía)
        // =====================================================================

        // ── 1.1 Campos obligatorios ──────────────────────────────────────────
        if (request.getNombre()     == null || request.getNombre().isBlank()     ||
                request.getCorreo()     == null || request.getCorreo().isBlank()     ||
                request.getCedula()     == null || request.getCedula().isBlank()     ||
                request.getTelefono()   == null || request.getTelefono().isBlank()   ||
                request.getContrasena() == null || request.getContrasena().isBlank() ||
                request.getRol()        == null) {
            log.warn("Campos obligatorios faltantes en registro");
            redirectAttributes.addFlashAttribute("error", "Campos obligatorios faltantes");
            return "redirect:/registro";
        }

        // ── 1.2 Formatos server-side ─────────────────────────────────────────
        if (!request.getCorreo().matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            log.warn("Formato de correo inválido: {}", request.getCorreo());
            redirectAttributes.addFlashAttribute("error", "Formato de correo inválido");
            return "redirect:/registro";
        }
        if (!request.getTelefono().matches("[0-9]{10}")) {
            log.warn("Formato de teléfono inválido: {}", request.getTelefono());
            redirectAttributes.addFlashAttribute("error", "El teléfono debe tener exactamente 10 dígitos");
            return "redirect:/registro";
        }
        if (!request.getCedula().matches("[0-9]{10}")) {
            log.warn("Formato de cédula inválido: {}", request.getCedula());
            redirectAttributes.addFlashAttribute("error", "La cédula debe tener exactamente 10 dígitos");
            return "redirect:/registro";
        }
        if (request.getContrasena().length() < 8) {
            log.warn("Contraseña demasiado corta para: {}", request.getCorreo());
            redirectAttributes.addFlashAttribute("error", "La contraseña debe tener al menos 8 caracteres");
            return "redirect:/registro";
        }

        // ── 1.3 Duplicados de usuario ────────────────────────────────────────
        if (usuarioService.findByCorreo(request.getCorreo()).isPresent()) {
            log.warn("Correo ya registrado: {}", request.getCorreo());
            redirectAttributes.addFlashAttribute("error", "El correo ya está registrado");
            return "redirect:/registro";
        }
        if (usuarioService.findByTelefono(request.getTelefono()) != null) {
            log.warn("Teléfono ya registrado: {}", request.getTelefono());
            redirectAttributes.addFlashAttribute("error", "El teléfono ya está registrado");
            return "redirect:/registro";
        }
        if (usuarioService.findByCedula(request.getCedula()) != null) {
            log.warn("Cédula ya registrada: {}", request.getCedula());
            redirectAttributes.addFlashAttribute("error", "La cédula ya está registrada");
            return "redirect:/registro";
        }

        // ── 1.4 Validaciones específicas por rol ─────────────────────────────
        //
        // ✅ FIX PRINCIPAL: estas validaciones estaban DESPUÉS de save(usuario),
        // lo que causaba que el usuario quedara guardado aunque fallara la placa o el NIT.
        // Ahora se ejecutan ANTES de guardar cualquier cosa.

        if (request.getRol() == Rolenum.CLIENTE) {

            // Placa obligatoria para cliente
            if (request.getPlaca() == null || request.getPlaca().isBlank()) {
                log.warn("Placa faltante para cliente: {}", request.getCorreo());
                redirectAttributes.addFlashAttribute("error", "La placa del vehículo es obligatoria");
                return "redirect:/registro";
            }

            // Formato de placa
            String placaNormalizada = request.getPlaca().trim().toUpperCase();
            if (!placaNormalizada.matches("[A-Z]{3}[0-9]{3}")) {
                log.warn("Formato de placa inválido: {}", request.getPlaca());
                redirectAttributes.addFlashAttribute("error", "Formato de placa inválido (ej. ABC123)");
                return "redirect:/registro";
            }

            // ✅ Duplicado de placa — verificado ANTES de guardar usuario
            if (vehiculoRepository.existsByPlaca(placaNormalizada)) {
                log.warn("Placa ya registrada: {}", placaNormalizada);
                redirectAttributes.addFlashAttribute("error", "La placa ya está registrada");
                return "redirect:/registro";
            }

            // Guardar la placa normalizada para usarla en fase 2
            request.setPlaca(placaNormalizada);

        } else if (request.getRol() == Rolenum.ADMINISTRADOR_SEDE) {

            // Campos obligatorios de sede
            if (request.getHiddenNombreSede()  == null || request.getHiddenNit()          == null ||
                    request.getHiddenDireccion()   == null || request.getHiddenLocalidad()     == null ||
                    request.getHiddenBarrio()      == null || request.getHiddenCuposTotales()  == null ||
                    request.getTarifaPlenaC()      == null || request.getTarifaPlenaM()        == null ||
                    request.getTarifaMinutoC()     == null || request.getTarifaMinutoM()       == null ||
                    request.getHiddenHorarioSede() == null) {
                log.warn("Campos obligatorios de sede faltantes para: {}", request.getCorreo());
                redirectAttributes.addFlashAttribute("error", "Faltan datos obligatorios de la sede");
                return "redirect:/registro";
            }

            // Formato de NIT
            if (!request.getHiddenNit().matches("[0-9]{9}-[0-9]")) {
                log.warn("Formato de NIT inválido: {}", request.getHiddenNit());
                redirectAttributes.addFlashAttribute("error", "Formato de NIT inválido (ej. 123456789-0)");
                return "redirect:/registro";
            }

            // ✅ Duplicado de NIT — verificado ANTES de guardar usuario
            if (sedeRepository.existsByNit(request.getHiddenNit())) {
                log.warn("NIT ya registrado: {}", request.getHiddenNit());
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

            // Validar barrio coherente con localidad
            String barrio = request.getHiddenBarrio();
            try {
                boolean barrioValido = Arrays.asList(
                        Localidad.valueOf(request.getHiddenLocalidad()).getBarrios()
                ).contains(barrio);
                if (!barrioValido) {
                    log.warn("Barrio inválido: {} para localidad {}", barrio, request.getHiddenLocalidad());
                    redirectAttributes.addFlashAttribute("error", "Barrio inválido para la localidad seleccionada");
                    return "redirect:/registro";
                }
            } catch (IllegalArgumentException e) {
                log.warn("Localidad inválida: {}", request.getHiddenLocalidad());
                redirectAttributes.addFlashAttribute("error", "Localidad inválida");
                return "redirect:/registro";
            }
        }

        // =====================================================================
        // FASE 2 — GUARDADO ATÓMICO
        //
        // Llegamos aquí solo si TODAS las validaciones de la Fase 1 pasaron.
        // Si cualquier operación de guardado falla, @Transactional hace rollback
        // completo: ni usuario, ni vehículo, ni sede quedan en BD.
        // =====================================================================

        try {
            // ── 2.1 Guardar usuario ──────────────────────────────────────────
            Usuario usuario = new Usuario();
            usuario.setNombre(request.getNombre());
            usuario.setCorreo(request.getCorreo());
            usuario.setTelefono(request.getTelefono());
            usuario.setCedula(request.getCedula());
            usuario.setRol(request.getRol());
            usuario.setTipoCliente(TipoCliente.NORMAL);
            usuario.setMetodoPago(MetodoPago.EFECTIVO);
            usuario.setEstado(EstadoGeneral.ACTIVO);
            usuario.setDescripcion("");
            usuario.setContrasena(passwordEncoder.encode(request.getContrasena()));

            Usuario guardado = usuarioService.save(usuario);
            log.info("Usuario guardado: id={} rol={}", guardado.getIdUsuario(), guardado.getRol());

            // ── 2.2 OPERARIO — asignar sede del admin autenticado ────────────
            if (request.getRol() == Rolenum.OPERARIO) {
                try {
                    Authentication auth    = SecurityContextHolder.getContext().getAuthentication();
                    Optional<Usuario> adminOpt = usuarioService.findByCorreo(auth.getName());
                    if (adminOpt.isPresent()) {
                        Sede sedeAdmin = sedeService.findByIdUsuario(adminOpt.get().getIdUsuario());
                        if (sedeAdmin != null) {
                            guardado.setSedeAsignada(sedeAdmin);
                            usuarioService.save(guardado);
                            log.info("Operario id={} asignado a sede: {}", guardado.getIdUsuario(), sedeAdmin.getNombre());
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
                sede.setTarifaPlenaC(request.getTarifaPlenaC());
                sede.setTarifaPlenaM(request.getTarifaPlenaM());
                sede.setTarifaMinutoC(request.getTarifaMinutoC());
                sede.setTarifaMinutoM(request.getTarifaMinutoM());
                sede.setHorarioSede(request.getHiddenHorarioSede());
                sede.setIdUsuario(guardado);
                sede.setEstado(EstadoGeneral.ACTIVO);
                sede.setFechaCreacion(LocalDateTime.now());
                sede.setLatitud(request.getHiddenLatitud());
                sede.setLongitud(request.getHiddenLongitud());

                Sede sedeGuardada = sedeService.save(sede);
                log.info("Sede guardada: id={}", sedeGuardada.getIdSede());

                cupoService.crearCuposParaSede(sedeGuardada);
                log.info("Cupos creados para sede id={}: total={}",
                        sedeGuardada.getIdSede(), sedeGuardada.getCapacidad());

                tarifaService.crearTarifasParaSede(sedeGuardada);
                log.info("Tarifas creadas para sede id={}", sedeGuardada.getIdSede());
            }

            // ── 2.4 CLIENTE — guardar vehículo ───────────────────────────────
            if (request.getRol() == Rolenum.CLIENTE) {
                Vehiculo vehiculo = new Vehiculo();
                vehiculo.setPlaca(request.getPlaca()); // ya normalizada en Fase 1
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
            try {
                sendWelcomeEmail(guardado.getCorreo(), guardado.getNombre(), guardado.getRol());
                log.info("Correo de bienvenida enviado a: {}", guardado.getCorreo());
            } catch (Exception e) {
                // No crítico — el registro ya está completo
                log.warn("No se pudo enviar correo de bienvenida a {}: {}",
                        guardado.getCorreo(), e.getMessage());
            }

            // ── 2.6 Autenticación automática post-registro ───────────────────
            try {
                Authentication authentication = authenticationManager.authenticate(
                        new UsernamePasswordAuthenticationToken(
                                guardado.getCorreo(), request.getContrasena())
                );
                SecurityContextHolder.getContext().setAuthentication(authentication);
                HttpSession session = httpRequest.getSession(true);
                session.setAttribute(
                        HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY,
                        SecurityContextHolder.getContext()
                );
            } catch (Exception e) {
                log.error("Error autenticando usuario tras registro: {}", e.getMessage());
                return "redirect:/login";
            }

            // ── 2.7 Redirect al dashboard correspondiente ────────────────────
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
            // Race condition: dos registros simultáneos con los mismos datos únicos.
            // @Transactional hace rollback completo — ningún dato queda en BD.
            log.error("Race condition en registro (integridad): {}", e.getMessage());
            redirectAttributes.addFlashAttribute("error",
                    "Datos duplicados detectados. Otro usuario se registró con los mismos datos.");
            return "redirect:/registro";

        } catch (Exception e) {
            // Cualquier otra excepción en Fase 2 también hace rollback completo.
            log.error("Error general en registro: {}", e.getMessage(), e);
            redirectAttributes.addFlashAttribute("error", "Error interno del sistema");
            return "redirect:/registro";
        }
    }

    // =====================================================================
    // VERIFICACIÓN DE DUPLICADOS — endpoints para el JS (fetch en blur)
    // =====================================================================

    /** GET /check/correo?value=email@ejemplo.com */
    @GetMapping("/check/correo")
    @ResponseBody
    public Map<String, Object> checkCorreo(@RequestParam String value) {
        boolean disponible = usuarioService.findByCorreo(value.trim()).isEmpty();
        return Map.of(
                "disponible", disponible,
                "mensaje", disponible ? "Correo disponible" : "El correo ya está registrado"
        );
    }

    /** GET /check/cedula?value=1234567890 */
    @GetMapping("/check/cedula")
    @ResponseBody
    public Map<String, Object> checkCedula(@RequestParam String value) {
        boolean disponible = (usuarioService.findByCedula(value.trim()) == null);
        return Map.of(
                "disponible", disponible,
                "mensaje", disponible ? "Cédula disponible" : "La cédula ya está registrada"
        );
    }

    /** GET /check/telefono?value=3001234567 */
    @GetMapping("/check/telefono")
    @ResponseBody
    public Map<String, Object> checkTelefono(@RequestParam String value) {
        boolean disponible = (usuarioService.findByTelefono(value.trim()) == null);
        return Map.of(
                "disponible", disponible,
                "mensaje", disponible ? "Teléfono disponible" : "El teléfono ya está registrado"
        );
    }

    /** GET /check/nit?value=123456789-0 */
    @GetMapping("/check/nit")
    @ResponseBody
    public Map<String, Object> checkNit(@RequestParam String value) {
        boolean disponible = !sedeRepository.existsByNit(value.trim());
        return Map.of(
                "disponible", disponible,
                "mensaje", disponible ? "NIT disponible" : "El NIT ya está registrado"
        );
    }

    // =====================================================================
    // CORREO DE BIENVENIDA
    // =====================================================================

    private void sendWelcomeEmail(String correo, String nombre, Rolenum rol)
            throws MessagingException {

        String rolDescripcion = switch (rol) {
            case ADMIN              -> "Administrador General";
            case ADMINISTRADOR_SEDE -> "Administrador de Sede";
            case OPERARIO           -> "Operario de Parqueadero";
            case CLIENTE            -> "Cliente";
            default                 -> rol.toString();
        };

        String contenidoHTML = String.format("""
            <!DOCTYPE html>
            <html lang='es'>
            <head>
                <meta charset='UTF-8'>
                <style>
                    * { margin:0; padding:0; box-sizing:border-box; }
                    body { font-family:'Segoe UI',sans-serif; background:#f5f7fa; padding:20px; }
                    .container { max-width:600px; margin:0 auto; background:#fff; border-radius:12px;
                                 overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,.1); }
                    .header { background:linear-gradient(135deg,#667eea,#764ba2);
                              padding:40px 30px; text-align:center; }
                    .header h1 { color:#fff; font-size:28px; margin:0; }
                    .icon { width:80px; height:80px; background:rgba(255,255,255,.2);
                            border-radius:50%%; margin:0 auto 15px; font-size:40px;
                            line-height:80px; text-align:center; }
                    .body { padding:40px 35px; color:#333; line-height:1.8; }
                    .body h2 { color:#667eea; font-size:22px; margin-bottom:20px; }
                    .card { background:#f8f9fa; padding:25px; border-radius:8px;
                            border-left:4px solid #667eea; margin:25px 0; }
                    .card h3 { color:#2c3e50; margin-bottom:15px; }
                    ul { list-style:none; padding:0; }
                    li { padding:10px 0; border-bottom:1px solid #e9ecef; color:#555; font-size:15px; }
                    li:last-child { border-bottom:none; }
                    .footer { background:#f8f9fa; padding:30px; text-align:center;
                              border-top:1px solid #e9ecef; }
                    .footer p { color:#6c757d; font-size:13px; margin:6px 0; }
                </style>
            </head>
            <body>
                <div class='container'>
                    <div class='header'>
                        <div class='icon'>🚗</div>
                        <h1>¡Bienvenido a ParkingTech!</h1>
                    </div>
                    <div class='body'>
                        <h2>¡Hola, %s!</h2>
                        <p>Tu registro ha sido exitoso. Estamos felices de tenerte con nosotros.</p>
                        <div class='card'>
                            <h3>📋 Detalles de tu cuenta:</h3>
                            <ul>
                                <li><strong>Correo:</strong> %s</li>
                                <li><strong>Rol:</strong> %s</li>
                            </ul>
                        </div>
                        <p>Ya puedes iniciar sesión y disfrutar de todos nuestros servicios.</p>
                    </div>
                    <div class='footer'>
                        <p><strong>Aparcaya Parking Tech</strong></p>
                        <p>Este es un correo automático, por favor no responder</p>
                        <p>© 2024 Aparcaya Parking Tech - Todos los derechos reservados</p>
                    </div>
                </div>
            </body>
            </html>
        """, nombre, correo, rolDescripcion);

        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
        helper.setTo(correo);
        helper.setSubject("¡Bienvenido a ParkingTech!");
        helper.setText(contenidoHTML, true);
        mailSender.send(message);
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