package com.exe.AparcaYA.Controllers;

import com.exe.AparcaYA.Dto.RegistroRequest;
import com.exe.AparcaYA.Entity.*;
import com.exe.AparcaYA.Enum.*;
import com.exe.AparcaYA.Service.*;
import jakarta.mail.MessagingException;
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
import jakarta.mail.internet.MimeMessage;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Optional;

// ✅ CAMBIO #2: Creación de tarifas delegada a TarifaService.crearTarifasParaSede()
// ✅ CAMBIO #6: Creación de cupos delegada a CupoService.crearCuposParaSede()
// ✅ CAMBIO #4/#8: Eliminada doble conversión RegistroRequest → UsuarioDTO → toEntity()
//                  El Usuario se construye directamente desde RegistroRequest

@Slf4j
@Controller
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class UsuarioController {

    private final UsuarioService usuarioService;
    private final VehiculoService vehiculoService;
    private final SedeService sedeService;
    private final CupoService cupoService;
    private final TarifaService tarifaService;
    private final PasswordEncoder passwordEncoder;
    private final JavaMailSender mailSender;
    private final AuthenticationManager authenticationManager;

    // ==================== REGISTRO ====================

    @PostMapping("/registrar")
    @Transactional(rollbackFor = Exception.class)
    public String registrarUsuario(
            @ModelAttribute RegistroRequest request,
            RedirectAttributes redirectAttributes,
            HttpServletRequest httpRequest) {

        log.info("Iniciando registro para correo: {}", request.getCorreo());

        // Validar campos obligatorios
        if (request.getNombre() == null || request.getCorreo() == null || request.getCedula() == null) {
            log.warn("Campos obligatorios faltantes en registro");
            redirectAttributes.addFlashAttribute("error", "Campos obligatorios faltantes");
            return "redirect:/registro";
        }

        // Verificar duplicados
        if (usuarioService.findByCorreo(request.getCorreo()).isPresent()) {
            log.warn("Correo ya registrado: {}", request.getCorreo());
            redirectAttributes.addFlashAttribute("error", "Correo ya registrado");
            return "redirect:/registro";
        }
        if (usuarioService.findByTelefono(request.getTelefono()) != null) {
            log.warn("Teléfono ya registrado: {}", request.getTelefono());
            redirectAttributes.addFlashAttribute("error", "Teléfono ya registrado");
            return "redirect:/registro";
        }
        if (usuarioService.findByCedula(request.getCedula()) != null) {
            log.warn("Cédula ya registrada: {}", request.getCedula());
            redirectAttributes.addFlashAttribute("error", "Cédula ya registrada");
            return "redirect:/registro";
        }

        try {
            // ✅ CAMBIO #4/#8: Usuario construido directamente desde RegistroRequest
            // Antes: RegistroRequest → UsuarioDTO (set de 10 campos) → toEntity() (set de 10 campos)
            // Ahora: RegistroRequest → Usuario directamente, sin DTO intermedio
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
            if (request.getContrasena() != null && !request.getContrasena().isEmpty()) {
                usuario.setContrasena(passwordEncoder.encode(request.getContrasena()));
            }

            Usuario guardado = usuarioService.save(usuario);
            log.info("Usuario guardado: id={} rol={}", guardado.getIdUsuario(), guardado.getRol());

            // ========== ASIGNAR OPERARIO A SEDE ==========
            if (request.getRol() == Rolenum.OPERARIO) {
                try {
                    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
                    Optional<Usuario> adminOpt = usuarioService.findByCorreo(auth.getName());

                    if (adminOpt.isPresent()) {
                        Sede sedeAdmin = sedeService.findByIdUsuario(adminOpt.get().getIdUsuario());
                        if (sedeAdmin != null) {
                            guardado.setSedeAsignada(sedeAdmin);
                            usuarioService.save(guardado);
                            log.info("Operario id={} asignado a sede: {}", guardado.getIdUsuario(), sedeAdmin.getNombre());
                        } else {
                            log.warn("Administrador {} no tiene sede asignada", auth.getName());
                        }
                    } else {
                        log.warn("No se encontró el administrador autenticado: {}", auth.getName());
                    }
                } catch (Exception e) {
                    log.error("Error asignando operario a sede: {}", e.getMessage(), e);
                }
            }

            // ========== GUARDAR SEDE SI ES ADMINISTRADOR_SEDE ==========
            if (request.getRol() == Rolenum.ADMINISTRADOR_SEDE &&
                    request.getHiddenNombreSede() != null &&
                    request.getHiddenNit() != null &&
                    request.getHiddenDireccion() != null &&
                    request.getHiddenLocalidad() != null &&
                    request.getHiddenBarrio() != null &&
                    request.getHiddenCuposTotales() != null &&
                    request.getTarifaPlenaC() != null &&
                    request.getTarifaPlenaM() != null &&
                    request.getTarifaMinutoC() != null &&
                    request.getTarifaMinutoM() != null &&
                    request.getHiddenHorarioSede() != null) {

                try {
                    log.info("Creando sede: nombre={} nit={}", request.getHiddenNombreSede(), request.getHiddenNit());

                    // Validar barrio
                    String barrio = request.getHiddenBarrio();
                    if (barrio != null && !barrio.isEmpty()) {
                        boolean barrioValido = Arrays.asList(
                                Localidad.valueOf(request.getHiddenLocalidad()).getBarrios()
                        ).contains(barrio);
                        if (!barrioValido) {
                            log.warn("Barrio inválido: {} para localidad {}", barrio, request.getHiddenLocalidad());
                            redirectAttributes.addFlashAttribute("error", "Barrio inválido para la localidad.");
                            return "redirect:/registro";
                        }
                    }

                    Sede sede = new Sede();
                    sede.setNombre(request.getHiddenNombreSede());
                    sede.setNit(request.getHiddenNit());
                    sede.setDireccion(request.getHiddenDireccion());
                    sede.setLocalidad(Localidad.valueOf(request.getHiddenLocalidad()));
                    sede.setBarrio(barrio);
                    sede.setCapacidad(request.getHiddenCuposTotales());
                    sede.setTarifaPlenaC(request.getTarifaPlenaC());
                    sede.setTarifaPlenaM(request.getTarifaPlenaM());
                    sede.setTarifaMinutoC(request.getTarifaMinutoC());
                    sede.setTarifaMinutoM(request.getTarifaMinutoM());
                    sede.setHorarioSede(request.getHiddenHorarioSede());
                    sede.setIdUsuario(guardado);
                    sede.setEstado(EstadoGeneral.ACTIVO);
                    sede.setFechaCreacion(LocalDateTime.now());

                    Sede sedeGuardada = sedeService.save(sede);
                    log.info("Sede guardada: id={}", sedeGuardada.getIdSede());

                    // ✅ CAMBIO #6: Creación de cupos delegada al Service
                    // Antes: bucle for con new Cupo() inline en el Controller (12 líneas)
                    cupoService.crearCuposParaSede(sedeGuardada);
                    log.info("Cupos creados para sede id={}: total={}", sedeGuardada.getIdSede(), sedeGuardada.getCapacidad());

                    // ✅ CAMBIO #2: Creación de tarifas delegada al Service
                    // Antes: bloque de 4 tarifas inline en el Controller (16 líneas)
                    // duplicado también en SedeController — ahora ambos usan el mismo Service
                    tarifaService.crearTarifasParaSede(sedeGuardada);
                    log.info("Tarifas creadas para sede id={}", sedeGuardada.getIdSede());

                } catch (DataIntegrityViolationException e) {
                    log.error("Error de integridad al guardar sede (NIT duplicado?): {}", e.getMessage());
                    redirectAttributes.addFlashAttribute("error", "NIT duplicado o error en sede.");
                    return "redirect:/registro";
                } catch (Exception e) {
                    log.error("Error guardando sede: {}", e.getMessage(), e);
                    redirectAttributes.addFlashAttribute("error", "Error guardando sede.");
                    return "redirect:/registro";
                }

            } else if (request.getRol() == Rolenum.ADMINISTRADOR_SEDE) {
                log.warn("Sede no guardada — faltan campos obligatorios para ADMINISTRADOR_SEDE");
                redirectAttributes.addFlashAttribute("error", "Faltan datos obligatorios de la sede.");
            }

            // ========== GUARDAR VEHÍCULO SI ES CLIENTE ==========
            if (request.getRol() == Rolenum.CLIENTE &&
                    request.getPlaca() != null &&
                    !request.getPlaca().trim().isEmpty()) {

                try {
                    Vehiculo vehiculo = new Vehiculo();
                    vehiculo.setPlaca(request.getPlaca().trim().toUpperCase());
                    vehiculo.setTipo(request.getTipoVehiculo());
                    vehiculo.setMarca(request.getMarca());
                    vehiculo.setColor(request.getColor());
                    vehiculo.setAnio(request.getAnio());
                    vehiculo.setIdUsuario(guardado);

                    Vehiculo vehiculoGuardado = vehiculoService.save(vehiculo);
                    log.info("Vehículo guardado: id={} placa={}", vehiculoGuardado.getIdVehiculo(), vehiculoGuardado.getPlaca());

                } catch (DataIntegrityViolationException e) {
                    log.error("Placa duplicada: {}", request.getPlaca());
                    redirectAttributes.addFlashAttribute("error", "La placa ya está registrada");
                    return "redirect:/registro";
                } catch (Exception e) {
                    log.error("Error guardando vehículo: {}", e.getMessage(), e);
                    redirectAttributes.addFlashAttribute("error", "Error al registrar el vehículo");
                    return "redirect:/registro";
                }
            }

            // ========== CORREO DE BIENVENIDA ==========
            try {
                sendWelcomeEmail(guardado.getCorreo(), guardado.getNombre(), guardado.getRol());
                log.info("Correo de bienvenida enviado a: {}", guardado.getCorreo());
            } catch (Exception e) {
                log.warn("No se pudo enviar correo de bienvenida a {}: {}", guardado.getCorreo(), e.getMessage());
            }

            String extra = "";
            if (request.getRol() == Rolenum.CLIENTE && request.getPlaca() != null) extra = " con vehículo";
            if (request.getRol() == Rolenum.ADMINISTRADOR_SEDE && request.getHiddenNombreSede() != null) extra = " con sede, cupos y tarifa";
            redirectAttributes.addFlashAttribute("success", "Usuario registrado exitosamente" + extra);

            // ========== AUTENTICAR AUTOMÁTICAMENTE ==========
            try {
                Authentication authentication = authenticationManager.authenticate(
                        new UsernamePasswordAuthenticationToken(guardado.getCorreo(), request.getContrasena())
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
            log.error("Error de integridad en registro: {}", e.getMessage());
            redirectAttributes.addFlashAttribute("error", "Datos duplicados: " + e.getMessage());
            return "redirect:/registro";
        } catch (Exception e) {
            log.error("Error general en registro: {}", e.getMessage(), e);
            redirectAttributes.addFlashAttribute("error", "Error interno: " + e.getMessage());
            return "redirect:/registro";
        }
    }

    // ==================== CORREO DE BIENVENIDA ====================

    private void sendWelcomeEmail(String correo, String nombre, Rolenum rol) throws MessagingException {
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
                    .container { max-width:600px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,.1); }
                    .header { background:linear-gradient(135deg,#667eea,#764ba2); padding:40px 30px; text-align:center; }
                    .header h1 { color:#fff; font-size:28px; margin:0; }
                    .icon { width:80px; height:80px; background:rgba(255,255,255,.2); border-radius:50%%; margin:0 auto 15px; font-size:40px; line-height:80px; text-align:center; }
                    .body { padding:40px 35px; color:#333; line-height:1.8; }
                    .body h2 { color:#667eea; font-size:22px; margin-bottom:20px; }
                    .card { background:#f8f9fa; padding:25px; border-radius:8px; border-left:4px solid #667eea; margin:25px 0; }
                    .card h3 { color:#2c3e50; margin-bottom:15px; }
                    ul { list-style:none; padding:0; }
                    li { padding:10px 0; border-bottom:1px solid #e9ecef; color:#555; font-size:15px; }
                    li:last-child { border-bottom:none; }
                    .footer { background:#f8f9fa; padding:30px; text-align:center; border-top:1px solid #e9ecef; }
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

    // ==================== DASHBOARDS POR ROL ====================

    @GetMapping("/dashboard/administradorGeneral")
    public String dashboardAdminGeneral() { return "DashboardAdmin"; }

    @GetMapping("/dashboard/administradorSede")
    public String dashboardAdminSede() { return "DashboardSede"; }

    @GetMapping("/dashboard/trabajadorParqueadero")
    public String dashboardTrabajador() { return "DashboardTrabajador"; }

    @GetMapping("/dashboard/cliente")
    public String dashboardCliente() { return "DashboardCliente"; }
}