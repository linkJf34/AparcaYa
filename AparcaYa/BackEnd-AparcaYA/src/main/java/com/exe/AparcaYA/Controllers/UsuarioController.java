package com.exe.AparcaYA.Controllers;

import com.exe.AparcaYA.Dto.RegistroRequest;
import com.exe.AparcaYA.Dto.UsuarioDTO;
import com.exe.AparcaYA.Entity.*;
import com.exe.AparcaYA.Enum.*;
import com.exe.AparcaYA.Service.*;
import jakarta.mail.*;
import jakarta.mail.internet.InternetAddress;
import lombok.RequiredArgsConstructor;
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
import java.util.Properties;

@Controller
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class UsuarioController {

    private final UsuarioService usuarioService;
    private final VehiculoService vehiculoService;
    private final SedeService sedeService;
    // Agregado: Servicios para Cupo y Tarifa (asegúrate de que existan)
    private final CupoService cupoService;
    private final TarifaService tarifaService;
    private final PasswordEncoder passwordEncoder;
    private final JavaMailSender mailSender;
    private final AuthenticationManager authenticationManager;

    @PostMapping("/registrar")
    @Transactional(rollbackFor = Exception.class)
    public String registrarUsuario(@ModelAttribute RegistroRequest request, RedirectAttributes redirectAttributes, HttpServletRequest httpRequest) {
        System.out.println("=== INICIO REGISTRO ===");
        System.out.println("Datos recibidos: " + request.toString());

        // Validar campos obligatorios del usuario
        if (request.getNombre() == null || request.getCorreo() == null || request.getCedula() == null) {
            System.out.println("Campos obligatorios faltantes");
            redirectAttributes.addFlashAttribute("error", "Campos obligatorios faltantes");
            return "redirect:/registro";
        }

        // Verificar duplicados antes de guardar
        if (usuarioService.findByCorreo(request.getCorreo()).isPresent()) {
            System.out.println("Correo ya existe: " + request.getCorreo());
            redirectAttributes.addFlashAttribute("error", "Correo ya registrado");
            return "redirect:/registro";
        }
        if (usuarioService.findByTelefono(request.getTelefono()) != null) {
            System.out.println("Teléfono ya existe: " + request.getTelefono());
            redirectAttributes.addFlashAttribute("error", "Teléfono ya registrado");
            return "redirect:/registro";
        }
        if (usuarioService.findByCedula(request.getCedula()) != null) {
            System.out.println("Cédula ya existe: " + request.getCedula());
            redirectAttributes.addFlashAttribute("error", "Cédula ya registrada");
            return "redirect:/registro";
        }

        try {
            UsuarioDTO usuarioDTO = new UsuarioDTO();
            usuarioDTO.setNombre(request.getNombre());
            usuarioDTO.setCorreo(request.getCorreo());
            usuarioDTO.setTelefono(request.getTelefono());
            usuarioDTO.setContrasena(request.getContrasena());
            usuarioDTO.setRol(request.getRol());
            usuarioDTO.setTipoCliente(TipoCliente.NORMAL);
            usuarioDTO.setMetodoPago(MetodoPago.EFECTIVO);
            usuarioDTO.setEstado(EstadoGeneral.ACTIVO);
            usuarioDTO.setDescripcion("");
            usuarioDTO.setCedula(request.getCedula());

            Usuario usuario = toEntity(usuarioDTO);
            System.out.println("Usuario creado para guardar: " + usuario.toString());
            Usuario guardado = usuarioService.save(usuario);
            System.out.println("Usuario guardado exitosamente: ID=" + guardado.getIdUsuario());

            // ========== ASIGNAR OPERARIO A SEDE ==========
            if (request.getRol() == Rolenum.OPERARIO) {
                try {
                    System.out.println("=== ASIGNANDO OPERARIO A SEDE ===");

                    // Obtener el usuario autenticado (el administrador que está registrando)
                    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
                    String correoAdmin = auth.getName();
                    System.out.println("Administrador autenticado: " + correoAdmin);

                    // Buscar el administrador
                    Optional<Usuario> adminOpt = usuarioService.findByCorreo(correoAdmin);
                    if (adminOpt.isPresent()) {
                        Usuario admin = adminOpt.get();
                        System.out.println("ID del administrador: " + admin.getIdUsuario());

                        // Buscar la sede del administrador
                        Sede sedeAdmin = sedeService.findByIdUsuario(admin.getIdUsuario());

                        if (sedeAdmin != null) {
                            System.out.println("Sede encontrada: " + sedeAdmin.getNombre() + " (ID: " + sedeAdmin.getIdSede() + ")");

                            // Asignar la sede al operario
                            guardado.setSedeAsignada(sedeAdmin);
                            usuarioService.save(guardado);

                            System.out.println("✓ Operario asignado exitosamente a la sede: " + sedeAdmin.getNombre());

                        } else {
                            System.err.println("✗ El administrador no tiene una sede asignada");
                        }
                    } else {
                        System.err.println("✗ No se encontró el administrador autenticado");
                    }

                } catch (Exception e) {
                    System.err.println("✗ Error asignando operario a sede: " + e.getMessage());
                    e.printStackTrace();
                }
            }
            System.out.println("=== FIN ASIGNACIÓN OPERARIO ===");

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
                    System.out.println("Creando Sede: nombre=" + request.getHiddenNombreSede() +
                            ", nit=" + request.getHiddenNit() +
                            ", localidad=" + request.getHiddenLocalidad() +
                            ", barrio=" + request.getHiddenBarrio());

                    Sede sede = new Sede();
                    sede.setNombre(request.getHiddenNombreSede());
                    sede.setNit(request.getHiddenNit());
                    sede.setDireccion(request.getHiddenDireccion());
                    sede.setLocalidad(Localidad.valueOf(request.getHiddenLocalidad()));

                    String barrio = request.getHiddenBarrio();
                    if (barrio != null && !barrio.isEmpty()) {
                        boolean barrioValido = Arrays.asList(
                                Localidad.valueOf(request.getHiddenLocalidad()).getBarrios()
                        ).contains(barrio);
                        if (!barrioValido) {
                            System.out.println("Barrio inválido: " + barrio +
                                    " no en " + Arrays.toString(
                                    Localidad.valueOf(request.getHiddenLocalidad()).getBarrios()));
                            redirectAttributes.addFlashAttribute("error", "Barrio inválido para la localidad.");
                            return "redirect:/registro";
                        }
                    }

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

                    System.out.println("Sede lista para guardar: " + sede.toString());
                    Sede sedeGuardado = sedeService.save(sede);
                    System.out.println("✅ Sede guardada exitosamente: ID=" + sedeGuardado.getIdSede());

                    // Crear cupos para la sede
                    System.out.println("Creando cupos para la sede: capacidad=" + sedeGuardado.getCapacidad());
                    for (int i = 1; i <= sedeGuardado.getCapacidad(); i++) {
                        Cupo cupo = new Cupo();
                        cupo.setCodigo("CUPO-" + sedeGuardado.getIdSede() + "-" + i);
                        cupo.setEstado(EstadoCupo.DISPONIBLE);
                        cupo.setSede(sedeGuardado);
                        cupoService.save(cupo);
                        System.out.println("Cupo creado: " + cupo.getCodigo());
                    }
                    System.out.println("✅ Cupos creados exitosamente para la sede.");

                    // ========== CREAR LAS 4 TARIFAS ==========
                    System.out.println("Creando las 4 tarifas para la sede...");

                    // 1. Tarifa Plena Carro
                    Tarifa tarifaPlenaC = new Tarifa();
                    tarifaPlenaC.setPrecio(sedeGuardado.getTarifaPlenaC());
                    tarifaPlenaC.setTipoTarifa("PLENA_CARRO");
                    tarifaPlenaC.setSede(sedeGuardado);
                    tarifaService.save(tarifaPlenaC);
                    System.out.println("Tarifa Plena Carro creada: $" + tarifaPlenaC.getPrecio());

                    // 2. Tarifa Plena Moto
                    Tarifa tarifaPlenaM = new Tarifa();
                    tarifaPlenaM.setPrecio(sedeGuardado.getTarifaPlenaM());
                    tarifaPlenaM.setTipoTarifa("PLENA_MOTO");
                    tarifaPlenaM.setSede(sedeGuardado);
                    tarifaService.save(tarifaPlenaM);
                    System.out.println("Tarifa Plena Moto creada: $" + tarifaPlenaM.getPrecio());

                    // 3. Tarifa Minuto Carro
                    Tarifa tarifaMinutoC = new Tarifa();
                    tarifaMinutoC.setPrecio(sedeGuardado.getTarifaMinutoC());
                    tarifaMinutoC.setTipoTarifa("MINUTO_CARRO");
                    tarifaMinutoC.setSede(sedeGuardado);
                    tarifaService.save(tarifaMinutoC);
                    System.out.println("Tarifa Minuto Carro creada: $" + tarifaMinutoC.getPrecio());

                    // 4. Tarifa Minuto Moto
                    Tarifa tarifaMinutoM = new Tarifa();
                    tarifaMinutoM.setPrecio(sedeGuardado.getTarifaMinutoM());
                    tarifaMinutoM.setTipoTarifa("MINUTO_MOTO");
                    tarifaMinutoM.setSede(sedeGuardado);
                    tarifaService.save(tarifaMinutoM);
                    System.out.println("Tarifa Minuto Moto creada: $" + tarifaMinutoM.getPrecio());

                    System.out.println("✅ Las 4 tarifas fueron creadas exitosamente para la sede.");
                    // ========== FIN CREAR TARIFAS ==========

                } catch (DataIntegrityViolationException e) {
                    System.err.println("❌ Error de integridad en sede: " + e.getMessage());
                    e.printStackTrace();
                    redirectAttributes.addFlashAttribute("error", "NIT duplicado o error en sede.");
                    return "redirect:/registro";
                } catch (Exception e) {
                    System.err.println("❌ Error guardando sede: " + e.getMessage());
                    e.printStackTrace();
                    redirectAttributes.addFlashAttribute("error", "Error guardando sede.");
                    return "redirect:/registro";
                }
            } else if (request.getRol() == Rolenum.ADMINISTRADOR_SEDE) {
                System.out.println("❌ Sede no guardada - Revisando campos faltantes:");
                System.out.println("  HiddenNombreSede: " + request.getHiddenNombreSede());
                System.out.println("  HiddenNit: " + request.getHiddenNit());
                System.out.println("  HiddenDireccion: " + request.getHiddenDireccion());
                System.out.println("  HiddenLocalidad: " + request.getHiddenLocalidad());
                System.out.println("  HiddenBarrio: " + request.getHiddenBarrio());
                System.out.println("  HiddenCuposTotales: " + request.getHiddenCuposTotales());
                System.out.println("  TarifaPlenaC: " + request.getTarifaPlenaC());
                System.out.println("  TarifaPlenaM: " + request.getTarifaPlenaM());
                System.out.println("  TarifaMinutoC: " + request.getTarifaMinutoC());
                System.out.println("  TarifaMinutoM: " + request.getTarifaMinutoM());
                System.out.println("  HiddenHorarioSede: " + request.getHiddenHorarioSede());
                redirectAttributes.addFlashAttribute("error", "Faltan datos obligatorios de la sede.");
            }

            // ========== GUARDAR VEHÍCULO SI ES CLIENTE ==========
            if (request.getRol() == Rolenum.CLIENTE &&
                    request.getPlaca() != null &&
                    !request.getPlaca().trim().isEmpty()) {

                try {
                    System.out.println("=== CREANDO VEHÍCULO PARA CLIENTE ===");
                    System.out.println("Placa: " + request.getPlaca());
                    System.out.println("Tipo: " + request.getTipoVehiculo());
                    System.out.println("Marca: " + request.getMarca());
                    System.out.println("Color: " + request.getColor());
                    System.out.println("Año: " + request.getAnio());

                    Vehiculo vehiculo = new Vehiculo();
                    vehiculo.setPlaca(request.getPlaca().trim().toUpperCase());
                    vehiculo.setTipo(request.getTipoVehiculo());
                    vehiculo.setMarca(request.getMarca());
                    vehiculo.setColor(request.getColor());
                    vehiculo.setAnio(request.getAnio());
                    vehiculo.setIdUsuario(guardado); // Asignar el usuario recién guardado

                    Vehiculo vehiculoGuardado = vehiculoService.save(vehiculo);
                    System.out.println("✅ Vehículo guardado exitosamente: ID=" + vehiculoGuardado.getIdVehiculo());

                } catch (DataIntegrityViolationException e) {
                    System.err.println("❌ Error: Placa duplicada - " + e.getMessage());
                    redirectAttributes.addFlashAttribute("error", "La placa ya está registrada");
                    return "redirect:/registro";
                } catch (Exception e) {
                    System.err.println("❌ Error guardando vehículo: " + e.getMessage());
                    e.printStackTrace();
                    redirectAttributes.addFlashAttribute("error", "Error al registrar el vehículo");
                    return "redirect:/registro";
                }
            }
            // ========== FIN GUARDAR VEHÍCULO ==========

            // Enviar correo de bienvenida con logging detallado
            try {
                System.out.println("=== INICIANDO ENVÍO DE CORREO DE BIENVENIDA ===");
                System.out.println("Email destinatario: " + guardado.getCorreo());
                System.out.println("Nombre: " + guardado.getNombre());
                System.out.println("Rol: " + guardado.getRol());
                sendWelcomeEmail(guardado.getCorreo(), guardado.getNombre(), guardado.getRol());
                System.out.println("=== CORREO DE BIENVENIDA ENVIADO EXITOSAMENTE ===");
            } catch (MessagingException e) {
                System.err.println("=== ERROR DE MENSAJERÍA AL ENVIAR CORREO ===");
                System.err.println("Mensaje de error: " + e.getMessage());
                System.err.println("Causa: " + (e.getCause() != null ? e.getCause().getMessage() : "Sin causa específica"));
                e.printStackTrace();
            } catch (Exception e) {
                System.err.println("=== ERROR GENERAL AL ENVIAR CORREO ===");
                System.err.println("Mensaje de error: " + e.getMessage());
                System.err.println("Tipo de excepción: " + e.getClass().getSimpleName());
                e.printStackTrace();
            }

            System.out.println("=== REGISTRO EXITOSO ===");
            redirectAttributes.addFlashAttribute("success", "Usuario registrado exitosamente" + (request.getRol() == Rolenum.CLIENTE && request.getPlaca() != null ? " con vehículo" : "") + (request.getRol() == Rolenum.ADMINISTRADOR_SEDE && request.getHiddenNombreSede() != null ? " con sede, cupos y tarifa" : ""));

            // Autenticar al usuario automáticamente después del registro
            try {
                Authentication authentication = authenticationManager.authenticate(
                        new UsernamePasswordAuthenticationToken(guardado.getCorreo(), request.getContrasena())
                );
                SecurityContextHolder.getContext().setAuthentication(authentication);
                HttpSession session = httpRequest.getSession(true);
                session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, SecurityContextHolder.getContext());
            } catch (Exception e) {
                System.err.println("Error autenticando usuario: " + e.getMessage());
                return "redirect:/login";
            }

            // Redirigir al dashboard según rol
            String redirectUrl = switch (guardado.getRol()) {
                case ADMIN -> "/dashboard/administradorGeneral";
                case ADMINISTRADOR_SEDE -> "/dashboard/administradorSede";
                case OPERARIO -> "/dashboard/trabajadorParqueadero";
                case CLIENTE -> "/dashboard/cliente";
                default -> "/login";
            };
            return "redirect:" + redirectUrl;

        } catch (DataIntegrityViolationException e) {
            System.err.println("Error de integridad: " + e.getMessage());
            redirectAttributes.addFlashAttribute("error", "Datos duplicados: " + e.getMessage());
            return "redirect:/registro";
        } catch (Exception e) {
            System.err.println("Error general: " + e.getMessage());
            e.printStackTrace();
            redirectAttributes.addFlashAttribute("error", "Error interno: " + e.getMessage());
            return "redirect:/registro";
        }
    }

    // Método para enviar correo de bienvenida HTML con logging detallado

    private void sendWelcomeEmail(String correo, String nombre, Rolenum rol) throws MessagingException {

        String remitente = "aparcaya.parkingtech@gmail.com";
        String password = "bnsw wtcn zqjh dunq"; // Contraseña de aplicaciones

        // Configuración del servidor SMTP de Gmail
        Properties props = new Properties();
        props.put("mail.smtp.auth", "true");
        props.put("mail.smtp.starttls.enable", "true");
        props.put("mail.smtp.host", "smtp.gmail.com");
        props.put("mail.smtp.port", "587");
        props.put("mail.smtp.ssl.trust", "smtp.gmail.com");

        // Crear la sesión
        Session session = Session.getInstance(props, new Authenticator() {
            protected PasswordAuthentication getPasswordAuthentication() {
                return new PasswordAuthentication(remitente, password);
            }
        });

        try {
            Message message = new MimeMessage(session);
            message.setFrom(new InternetAddress(remitente));
            message.setRecipients(Message.RecipientType.TO, InternetAddress.parse(correo));
            message.setSubject("¡Bienvenido a ParkingTech!");

            // Personalizar mensaje según el rol
            String rolDescripcion = switch (rol) {
                case ADMIN -> "Administrador General";
                case ADMINISTRADOR_SEDE -> "Administrador de Sede";
                case OPERARIO -> "Operario de Parqueadero";
                case CLIENTE -> "Cliente";
            };

            // Contenido HTML del correo
            String contenidoHTML = String.format("""
            <!DOCTYPE html>
            <html lang='es'>
            <head>
                <meta charset='UTF-8'>
                <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f7fa; padding: 20px; }
                    .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
                    .email-header { background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%); padding: 40px 30px; text-align: center; }
                    .email-header h1 { color: #ffffff; font-size: 28px; font-weight: 600; margin: 0; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); }
                    .email-icon { width: 80px; height: 80px; background-color: rgba(255, 255, 255, 0.2); border-radius: 50%%; margin: 0 auto 15px auto; font-size: 40px; line-height: 80px; text-align: center; }
                    .email-body { padding: 40px 35px; color: #333333; line-height: 1.8; }
                    .email-body h2 { color: #667eea; font-size: 22px; margin-bottom: 20px; font-weight: 600; }
                    .welcome-message { font-size: 16px; color: #555555; margin-bottom: 25px; }
                    .info-card { background-color: #f8f9fa; padding: 25px; border-radius: 8px; border-left: 4px solid #667eea; margin: 25px 0; }
                    .info-card h3 { color: #2c3e50; font-size: 18px; margin-bottom: 15px; }
                    .info-list { list-style: none; padding: 0; }
                    .info-list li { padding: 10px 0; border-bottom: 1px solid #e9ecef; color: #555555; font-size: 15px; }
                    .info-list li:last-child { border-bottom: none; }
                    .info-list strong { color: #333333; font-weight: 600; }
                    .divider { height: 1px; background: linear-gradient(to right, transparent, #e0e0e0, transparent); margin: 30px 0; }
                    .email-footer { background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef; }
                    .email-footer p { color: #6c757d; font-size: 14px; margin: 8px 0; }
                    .social-icons { margin: 20px 0; text-align: center; }
                    .social-icons a { display: inline-block; width: 40px; height: 40px; border-radius: 8px; text-decoration: none; margin: 0 8px; transition: transform 0.3s ease, opacity 0.3s ease; vertical-align: middle; overflow: hidden; }
                    .social-icons a:hover { transform: translateY(-3px); opacity: 0.9; }
                    .social-icons img { width: 40px; height: 40px; display: block; }
                    .footer-company { font-weight: 600; color: #333; font-size: 16px; margin-bottom: 10px; }
                    .footer-note { color: #6c757d; font-size: 13px; margin-bottom: 10px; }
                    .footer-copyright { font-size: 12px; color: #999; margin-top: 15px; }
                    @media only screen and (max-width: 600px) {
                        .email-header { padding: 30px 20px; }
                        .email-body { padding: 30px 20px; }
                        .email-header h1 { font-size: 24px; }
                    }
                </style>
            </head>
            <body>
                <div class='email-container'>
                    <div class='email-header'>
                        <div class='email-icon'>🚗</div>
                        <h1>¡Bienvenido a ParkingTech!</h1>
                    </div>
                    <div class='email-body'>
                        <h2>¡Hola, %s!</h2>
                        <p class='welcome-message'>
                            Tu registro ha sido exitoso en nuestro sistema de gestión de parqueaderos. 
                            Estamos emocionados de tenerte con nosotros.
                        </p>
                        <div class='info-card'>
                            <h3>📋 Detalles de tu cuenta:</h3>
                            <ul class='info-list'>
                                <li><strong>Correo:</strong> %s</li>
                                <li><strong>Rol:</strong> %s</li>
                            </ul>
                        </div>
                        <p class='welcome-message'>
                            Ya puedes iniciar sesión y disfrutar de todos nuestros servicios.
                        </p>
                        <div class='divider'></div>
                        <p style='color: #666; font-size: 14px; margin-top: 20px;'>
                            Si tienes alguna pregunta o necesitas asistencia, no dudes en contactarnos.
                        </p>
                    </div>
                    <div class='email-footer'>
                        <div class='social-icons'>
                            <a href='https://www.facebook.com/tupagina' target='_blank' title='Facebook'>
                                <img src='https://cdn-icons-png.flaticon.com/512/124/124010.png' alt='Facebook'>
                            </a>
                            <a href='https://twitter.com/tuperfil' target='_blank' title='Twitter'>
                                <img src='https://cdn-icons-png.flaticon.com/512/124/124021.png' alt='Twitter'>
                            </a>
                            <a href='https://www.instagram.com/tuperfil' target='_blank' title='Instagram'>
                                <img src='https://cdn-icons-png.flaticon.com/512/174/174855.png' alt='Instagram'>
                            </a>
                            <a href='https://www.linkedin.com/company/tuempresa' target='_blank' title='LinkedIn'>
                                <img src='https://cdn-icons-png.flaticon.com/512/174/174857.png' alt='LinkedIn'>
                            </a>
                        </div>
                        <p class='footer-company'>Aparcaya Parking Tech</p>
                        <p class='footer-note'>Este es un correo automático, por favor no responder</p>
                        <p class='footer-copyright'>© 2024 Aparcaya Parking Tech - Todos los derechos reservados</p>
                    </div>
                </div>
            </body>
            </html>
            """, nombre, correo, rolDescripcion);

            // Configurar el mensaje como HTML
            message.setContent(contenidoHTML, "text/html; charset=utf-8");

            // Enviar el mensaje
            Transport.send(message);
            System.out.println("✓ Correo enviado correctamente a: " + correo);

        } catch (MessagingException e) {
            System.err.println("✗ Error al enviar correo: " + e.getMessage());
            e.printStackTrace();
            throw e;
        }
    }

    // Dashboards según rol
    @GetMapping("/dashboard/administradorGeneral")
    public String dashboardAdminGeneral() { return "DashboardAdmin"; }

    @GetMapping("/dashboard/administradorSede")
    public String dashboardAdminSede() { return "DashboardSede"; }

    @GetMapping("/dashboard/trabajadorParqueadero")
    public String dashboardTrabajador() { return "DashboardTrabajador"; }

    @GetMapping("/dashboard/cliente")
    public String dashboardCliente() { return "DashboardCliente"; }

    // Conversión DTO a entidad Usuario
    private Usuario toEntity(UsuarioDTO dto) {
        Usuario usuario = new Usuario();
        usuario.setNombre(dto.getNombre());
        usuario.setCorreo(dto.getCorreo());
        usuario.setTelefono(dto.getTelefono());
        usuario.setRol(dto.getRol());
        usuario.setTipoCliente(dto.getTipoCliente());
        usuario.setMetodoPago(dto.getMetodoPago());
        usuario.setEstado(dto.getEstado());
        usuario.setDescripcion(dto.getDescripcion());
        usuario.setCedula(dto.getCedula());
        if (dto.getContrasena() != null && !dto.getContrasena().isEmpty()) {
            usuario.setContrasena(passwordEncoder.encode(dto.getContrasena()));
        }
        return usuario;
    }

    // Endpoint de prueba
    @GetMapping("/test")
    @ResponseBody
    public String test() {
        System.out.println("=== TEST ENDPOINT LLAMADO ===");
        return "Test OK";
    }

    // Endpoint para probar envío de email manualmente
    @GetMapping("/test-email")
    @ResponseBody
    public String testEmail() {
        try {
            sendWelcomeEmail("tuemailreal@ejemplo.com", "Test User", Rolenum.CLIENTE);  // Cambia a un email real para probar
            return "Email enviado correctamente";
        } catch (Exception e) {
            return "Error: " + e.getMessage();
        }
    }
}