package com.exe.AparcaYA.Controllers;

import com.exe.AparcaYA.Config.JwtUtil;
import com.exe.AparcaYA.Dto.SedeDTO;
import com.exe.AparcaYA.Dto.TarifaDTO;
import com.exe.AparcaYA.Dto.UsuarioDTO;
import com.exe.AparcaYA.Entity.*;
import com.exe.AparcaYA.Enum.*;
import com.exe.AparcaYA.Repository.EmailLogRepository;
import com.exe.AparcaYA.Service.*;
import jakarta.mail.MessagingException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/sede")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMINISTRADOR_SEDE')")
public class SedeController {

    private final UsuarioService               usuarioService;
    private final SedeService                  sedeService;
    private final PasswordEncoder              passwordEncoder;
    private final ReporteService               reporteService;
    private final TarifaService                tarifaService;
    private final IEmailService                emailService;
    private final RegistroEntradaSalidaService registroEntradaSalidaService;
    private final VehiculoService              vehiculoService;
    private final ReservacionService           reservacionService;
    private final CupoService                  cupoService;
    private final JwtUtil                      jwtUtil;
    private final EmailLogRepository            emailLogRepository;

    // =========================================================
    // MÉTODOS AUXILIARES
    // =========================================================

    private Usuario getUsuarioAutenticado() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return usuarioService.findByCorreo(authentication.getName())
                .orElseThrow(() -> new RuntimeException("Usuario autenticado no encontrado"));
    }

    private Sede getSedeDelUsuarioAutenticado() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return null;
        Optional<Usuario> usuarioOpt = usuarioService.findByCorreo(auth.getName());
        if (usuarioOpt.isEmpty()) return null;
        Usuario user = usuarioOpt.get();
        if (user.getSedeAsignada() != null) return user.getSedeAsignada();
        return sedeService.findFirstByAdminId(user.getIdUsuario()).orElseGet(() -> {
            log.error("Sin sede para: {} (id={})", user.getNombre(), user.getIdUsuario());
            return null;
        });
    }

    /**
     * Resuelve la sede activa desde el claim sedeId del JWT.
     * Si el JWT contiene sedeId y pertenece al admin autenticado, la retorna.
     * Si no, hace fallback a getSedeDelUsuarioAutenticado().
     */
    private Sede getSedeActiva(HttpServletRequest request) {
        try {
            String authHeader = request.getHeader("Authorization");
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token  = authHeader.substring(7);
                Long   sedeId = jwtUtil.extractSedeId(token);
                if (sedeId != null) {
                    Optional<Sede> sedeOpt = sedeService.findById(sedeId);
                    if (sedeOpt.isPresent()) {
                        Sede   sede  = sedeOpt.get();
                        Usuario admin = getUsuarioAutenticado();
                        if (sede.getIdUsuario().getIdUsuario().equals(admin.getIdUsuario())) {
                            return sede;
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("No se pudo extraer sedeId del JWT: {}", e.getMessage());
        }
        return getSedeDelUsuarioAutenticado();
    }

    private Tarifa getTarifaDeSede(Sede sede) {
        List<Tarifa> tarifas = tarifaService.findBySede_IdSede(sede.getIdSede());
        if (tarifas.isEmpty()) {
            throw new RuntimeException("No hay tarifas configuradas para la sede: "
                    + sede.getNombre());
        }
        return tarifas.get(0);
    }

    private double[] resolverTarifas(Tarifa tarifa, TipoVehiculo tipo) {
        return switch (tipo) {
            case CARRO     -> new double[]{ tarifa.getTarifaPlenaC(), tarifa.getTarifaMinutoC() };
            case MOTO      -> new double[]{ tarifa.getTarifaPlenaM(), tarifa.getTarifaMinutoM() };
            case BICICLETA -> new double[]{ tarifa.getTarifaPlenaB(), tarifa.getTarifaMinutoB() };
            case OTRO      -> null;
        };
    }

    private double[] resolverTarifas(Tarifa tarifa, String tipoStr) {
        TipoVehiculo tipo;
        try {
            tipo = TipoVehiculo.valueOf(tipoStr.toUpperCase());
        } catch (IllegalArgumentException e) {
            tipo = TipoVehiculo.CARRO;
        }
        return resolverTarifas(tarifa, tipo);
    }

    private String formatearTiempo(Duration duracion) {
        long h = duracion.toHours(), m = duracion.toMinutes() % 60, s = duracion.getSeconds() % 60;
        if (h > 0) return String.format("%dh %dm %ds", h, m, s);
        if (m > 0) return String.format("%dm %ds", m, s);
        return String.format("%ds", s);
    }

    private String getCellValueAsString(Cell cell) {
        if (cell == null) return "";
        switch (cell.getCellType()) {
            case STRING:  return cell.getStringCellValue().trim();
            case NUMERIC:
                if (DateUtil.isCellDateFormatted(cell))
                    return cell.getLocalDateTimeCellValue().toString();
                return String.valueOf((long) cell.getNumericCellValue());
            case BOOLEAN: return String.valueOf(cell.getBooleanCellValue());
            default:      return "";
        }
    }

    private String obtenerExtension(String nombreArchivo) {
        if (nombreArchivo == null || !nombreArchivo.contains(".")) return ".jpg";
        return nombreArchivo.substring(nombreArchivo.lastIndexOf(".")).toLowerCase();
    }

    // =========================================================
    // USUARIOS
    // =========================================================

    @GetMapping("/usuarios")
    public ResponseEntity<List<UsuarioDTO>> getUsuarios() {
        try {
            List<UsuarioDTO> resultado = usuarioService
                    .findByRolIn(List.of(Rolenum.CLIENTE))
                    .stream()
                    .map(UsuarioDTO::fromEntity)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(resultado);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ArrayList<>());
        }
    }

    @GetMapping("/usuarios/{id}")
    public ResponseEntity<UsuarioDTO> getUsuarioById(@PathVariable Long id) {
        try {
            return usuarioService.findById(id)
                    .map(u -> ResponseEntity.ok(UsuarioDTO.fromEntity(u)))
                    .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PutMapping("/usuarios/{id}")
    public ResponseEntity<Map<String, Object>> updateUsuario(
            @PathVariable Long id,
            @RequestBody Map<String, String> datos) {
        try {
            Optional<Usuario> existing = usuarioService.findById(id);
            if (existing.isPresent()) {
                Usuario usuario = existing.get();
                if (datos.get("nombre")   != null) usuario.setNombre(datos.get("nombre"));
                if (datos.get("correo")   != null) usuario.setCorreo(datos.get("correo"));
                if (datos.get("telefono") != null) usuario.setTelefono(datos.get("telefono"));
                if (datos.get("cedula")   != null) usuario.setCedula(datos.get("cedula"));
                if (datos.get("estado")   != null)
                    usuario.setEstado(EstadoGeneral.valueOf(datos.get("estado").toUpperCase()));
                Usuario updated = usuarioService.save(usuario);
                UsuarioDTO dto  = UsuarioDTO.fromEntity(updated);
                Map<String, Object> resultado = new LinkedHashMap<>();
                resultado.put("id",       dto.getId());
                resultado.put("nombre",   dto.getNombre());
                resultado.put("correo",   dto.getCorreo());
                resultado.put("telefono", dto.getTelefono());
                resultado.put("cedula",   dto.getCedula());
                resultado.put("rol",      dto.getRol());
                resultado.put("estado",   dto.getEstado());
                resultado.put("mensaje",  "Usuario actualizado correctamente");
                return ResponseEntity.ok(resultado);
            }
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/usuarios/{id}")
    public ResponseEntity<Map<String, Object>> deleteUsuario(@PathVariable Long id) {
        try {
            if (usuarioService.findById(id).isPresent()) {
                usuarioService.delete(id);
                return ResponseEntity.ok(Map.of("mensaje", "Usuario eliminado correctamente"));
            }
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/registrar-trabajador")
    public ResponseEntity<Map<String, Object>> registrarTrabajador(
            @RequestBody Map<String, String> datos,
            HttpServletRequest request) {
        try {
            if (datos.get("nombre") == null || datos.get("correo") == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Nombre y correo son requeridos"));
            }
            if (usuarioService.findByCorreo(datos.get("correo")).isPresent()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Ya existe un usuario con ese correo"));
            }

            Sede sedeDelAdmin = getSedeActiva(request);
            if (sedeDelAdmin == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "El administrador no tiene una sede asignada."));
            }
            String contrasena = datos.get("contrasena");
            if (contrasena == null || contrasena.trim().length() < 8) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error",
                                "La contraseña es obligatoria y debe tener al menos 8 caracteres"));
            }
            Usuario trabajador = new Usuario();
            trabajador.setNombre(datos.get("nombre"));
            trabajador.setCorreo(datos.get("correo"));
            trabajador.setTelefono(datos.get("telefono") != null ? datos.get("telefono") : "");
            trabajador.setCedula(datos.get("cedula")     != null ? datos.get("cedula")   : "");
            trabajador.setContrasena(passwordEncoder.encode(contrasena));
            trabajador.setRol(Rolenum.OPERARIO);
            trabajador.setEstado(EstadoGeneral.ACTIVO);
            trabajador.setSedeAsignada(sedeDelAdmin);
            Usuario saved       = usuarioService.save(trabajador);
            UsuarioDTO savedDTO = UsuarioDTO.fromEntity(saved);
            Map<String, Object> resultado = new LinkedHashMap<>();
            resultado.put("id",            savedDTO.getId());
            resultado.put("nombre",        savedDTO.getNombre());
            resultado.put("correo",        savedDTO.getCorreo());
            resultado.put("telefono",      savedDTO.getTelefono());
            resultado.put("cedula",        savedDTO.getCedula());
            resultado.put("rol",           savedDTO.getRol());
            resultado.put("estado",        savedDTO.getEstado());
            resultado.put("sedeId",        sedeDelAdmin.getIdSede());
            resultado.put("sedeNombre",    sedeDelAdmin.getNombre());
            resultado.put("sedeDireccion", sedeDelAdmin.getDireccion());
            resultado.put("mensaje",       "Trabajador registrado exitosamente en la sede: "
                    + sedeDelAdmin.getNombre());
            return ResponseEntity.status(HttpStatus.CREATED).body(resultado);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Error al registrar trabajador: " + e.getMessage()));
        }
    }

    // =========================================================
    // INDICADORES
    // =========================================================

    @GetMapping("/indicadores")
    public ResponseEntity<Map<String, Object>> getIndicadores(HttpServletRequest request) {
        try {
            Sede sede = getSedeActiva(request);  // ✅
            if (sede == null) return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "No se encontró una sede asignada"));

            List<RegistroEntradaSalida> vehiculosActivos =
                    registroEntradaSalidaService.findBySedeAndEstado(sede, EstadoRegistro.ACTIVO);
            int ocupacionActual = vehiculosActivos.size();
            int capacidadTotal  = sede.getCapacidad();

            LocalDateTime inicioHoy   = LocalDate.now().atStartOfDay();
            BigDecimal    ingresosDia = registroEntradaSalidaService
                    .sumIngresosEntreFechas(sede, inicioHoy, inicioHoy.plusDays(1));

            List<RegistroEntradaSalida> registrosHoy =
                    registroEntradaSalidaService.findBySedeAndFechaHoraEntradaBetween(
                            sede, inicioHoy, inicioHoy.plusDays(1));

            long pendientesCobro = registrosHoy.stream()
                    .filter(r -> r.getEstado() == EstadoRegistro.FINALIZADO).count();

            Tarifa tarifa = getTarifaDeSede(sede);

            Map<String, Object> indicadores = new HashMap<>();
            indicadores.put("ocupacionActual",     ocupacionActual);
            indicadores.put("capacidadTotal",      capacidadTotal);
            indicadores.put("cuposLibres",         Math.max(0, capacidadTotal - ocupacionActual));
            indicadores.put("porcentajeOcupacion", capacidadTotal > 0
                    ? Math.round((ocupacionActual * 100.0) / capacidadTotal) : 0);
            indicadores.put("vehiculosHoy",    registrosHoy.size());
            indicadores.put("ingresosDia",     ingresosDia);
            indicadores.put("pendientesCobro", pendientesCobro);
            indicadores.put("sedeNombre",      sede.getNombre());
            indicadores.put("sedeActiva",      sede.getEstado());
            indicadores.put("tarifaPlenaC",    tarifa.getTarifaPlenaC());
            indicadores.put("tarifaPlenaM",    tarifa.getTarifaPlenaM());
            indicadores.put("tarifaMinutoC",   tarifa.getTarifaMinutoC());
            indicadores.put("tarifaMinutoM",   tarifa.getTarifaMinutoM());
            return ResponseEntity.ok(indicadores);
        } catch (Exception e) {
            log.error("Error al cargar indicadores: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // =========================================================
    // SEDES
    // =========================================================


    @GetMapping("/sedes")
    public ResponseEntity<List<SedeDTO>> getSedes() {
        try {
            Usuario admin = getUsuarioAutenticado();

            List<Sede> sedes = sedeService.findAllByAdminId(admin.getIdUsuario());

            // ✅ Para cada sede, calcular ocupacionActual desde registros ACTIVOS
            // Usa el mismo servicio que usa getIndicadores() — consistencia garantizada
            List<SedeDTO> resultado = sedes.stream().map(sede -> {
                SedeDTO dto = SedeDTO.fromEntity(sede);

                int activos = registroEntradaSalidaService
                        .findBySedeAndEstado(sede, EstadoRegistro.ACTIVO)
                        .size();
                dto.setOcupacionActual(activos);

                return dto;
            }).collect(Collectors.toList());

            return ResponseEntity.ok(resultado);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ArrayList<>());
        }
    }

    @GetMapping("/sedes/{id}")
    public ResponseEntity<SedeDTO> getSedeById(@PathVariable Long id,
                                               HttpServletRequest request) {
        try {
            Sede sede = getSedeActiva(request);  // ✅
            if (sede == null || !sede.getIdSede().equals(id))
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            return sedeService.findById(id)
                    .map(s -> ResponseEntity.ok(SedeDTO.fromEntity(s)))
                    .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/sedes")
    public ResponseEntity<Map<String, Object>> createSede(
            @RequestBody Map<String, Object> datos) {
        try {
            Sede sede = new Sede();
            if (datos.get("nombre")      != null) sede.setNombre(datos.get("nombre").toString().trim());
            if (datos.get("direccion")   != null) sede.setDireccion(datos.get("direccion").toString().trim());
            if (datos.get("capacidad")   != null) sede.setCapacidad(Integer.parseInt(datos.get("capacidad").toString()));
            if (datos.get("nit")         != null) sede.setNit(datos.get("nit").toString().trim());
            if (datos.get("horarioSede") != null) sede.setHorarioSede(datos.get("horarioSede").toString().trim());
            if (datos.get("barrio")      != null) sede.setBarrio(datos.get("barrio").toString().trim());

            if (datos.get("localidad") != null) {
                try {
                    sede.setLocalidad(Localidad.valueOf(datos.get("localidad").toString().toUpperCase()));
                } catch (IllegalArgumentException e) {
                    return ResponseEntity.badRequest()
                            .body(Map.of("error", "Localidad inválida: " + datos.get("localidad")));
                }
            } else {
                sede.setLocalidad(Localidad.CHAPINERO);
            }

            sede.setLatitud(datos.get("latitud")  != null
                    ? Double.parseDouble(datos.get("latitud").toString())  : 4.6533);
            sede.setLongitud(datos.get("longitud") != null
                    ? Double.parseDouble(datos.get("longitud").toString()) : -74.0836);

            sede.setEstado(EstadoGeneral.ACTIVO);
            sede.setFechaCreacion(LocalDateTime.now());
            sede.setIdUsuario(getUsuarioAutenticado());

            Sede saved = sedeService.save(sede);

            Tarifa tarifa = Tarifa.builder()
                    .tipoTarifa("GENERAL")
                    .tarifaPlenaC(datos.get("tarifaPlenaC")   != null ? Double.parseDouble(datos.get("tarifaPlenaC").toString())   : 0.0)
                    .tarifaPlenaM(datos.get("tarifaPlenaM")   != null ? Double.parseDouble(datos.get("tarifaPlenaM").toString())   : 0.0)
                    .tarifaMinutoC(datos.get("tarifaMinutoC") != null ? Double.parseDouble(datos.get("tarifaMinutoC").toString())  : 0.0)
                    .tarifaMinutoM(datos.get("tarifaMinutoM") != null ? Double.parseDouble(datos.get("tarifaMinutoM").toString())  : 0.0)
                    .tarifaHoraC(0.0).tarifaHoraM(0.0)
                    .tarifaPlenaB(0.0).tarifaMinutoB(0.0).tarifaHoraB(0.0)
                    .sede(saved)
                    .build();
            tarifaService.save(tarifa);
            cupoService.crearCuposParaSede(saved);

            SedeDTO savedDTO = SedeDTO.fromEntity(saved);
            Map<String, Object> resultado = new LinkedHashMap<>();
            resultado.put("id",        savedDTO.getId());
            resultado.put("nombre",    savedDTO.getNombre());
            resultado.put("direccion", savedDTO.getDireccion());
            resultado.put("capacidad", savedDTO.getCapacidad());
            resultado.put("tarifas",   savedDTO.getTarifas());
            resultado.put("cupos",     savedDTO.getCupos());
            resultado.put("estado",    savedDTO.getEstado());
            resultado.put("mensaje",   "Sede registrada correctamente");
            return ResponseEntity.status(HttpStatus.CREATED).body(resultado);
        } catch (Exception e) {
            log.error("Error al registrar sede: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/sedes/{id}")
    public ResponseEntity<Map<String, Object>> updateSede(
            @PathVariable Long id,
            @RequestBody Map<String, Object> datos,
            HttpServletRequest request) {
        try {
            Sede sedeAdmin = getSedeActiva(request);  // ✅
            if (sedeAdmin == null || !sedeAdmin.getIdSede().equals(id)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "No tiene permisos para modificar esta sede"));
            }
            Optional<Sede> existing = sedeService.findById(id);
            if (existing.isPresent()) {
                Sede sede = existing.get();
                if (datos.get("nombre")    != null) sede.setNombre((String) datos.get("nombre"));
                if (datos.get("direccion") != null) sede.setDireccion((String) datos.get("direccion"));
                if (datos.get("capacidad") != null) sede.setCapacidad(Integer.parseInt(datos.get("capacidad").toString()));
                if (datos.get("estado")    != null) sede.setEstado(EstadoGeneral.valueOf(datos.get("estado").toString().toUpperCase()));
                Sede updated = sedeService.save(sede);

                boolean hayTarifa = datos.get("tarifaPlenaC") != null || datos.get("tarifaPlenaM") != null
                        || datos.get("tarifaMinutoC") != null || datos.get("tarifaMinutoM") != null;
                if (hayTarifa) {
                    List<Tarifa> tarifas = tarifaService.findBySede_IdSede(id);
                    Tarifa tarifa = tarifas.isEmpty() ? new Tarifa() : tarifas.get(0);
                    if (datos.get("tarifaPlenaC")  != null) tarifa.setTarifaPlenaC(Double.parseDouble(datos.get("tarifaPlenaC").toString()));
                    if (datos.get("tarifaPlenaM")  != null) tarifa.setTarifaPlenaM(Double.parseDouble(datos.get("tarifaPlenaM").toString()));
                    if (datos.get("tarifaMinutoC") != null) tarifa.setTarifaMinutoC(Double.parseDouble(datos.get("tarifaMinutoC").toString()));
                    if (datos.get("tarifaMinutoM") != null) tarifa.setTarifaMinutoM(Double.parseDouble(datos.get("tarifaMinutoM").toString()));
                    tarifa.setSede(updated);
                    tarifaService.save(tarifa);
                }

                SedeDTO updatedDTO = SedeDTO.fromEntity(updated);
                Map<String, Object> resultado = new LinkedHashMap<>();
                resultado.put("id",        updatedDTO.getId());
                resultado.put("nombre",    updatedDTO.getNombre());
                resultado.put("direccion", updatedDTO.getDireccion());
                resultado.put("capacidad", updatedDTO.getCapacidad());
                resultado.put("tarifas",   updatedDTO.getTarifas());
                resultado.put("estado",    updatedDTO.getEstado());
                resultado.put("mensaje",   "Sede actualizada correctamente");
                return ResponseEntity.ok(resultado);
            }
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/sedes/{id}")
    public ResponseEntity<Map<String, Object>> deleteSede(@PathVariable Long id,
                                                          HttpServletRequest request) {
        try {
            Sede sedeDelAdmin = getSedeActiva(request);  // ✅
            if (sedeDelAdmin == null || !sedeDelAdmin.getIdSede().equals(id)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "No tiene permisos para eliminar esta sede"));
            }
            if (sedeService.findById(id).isPresent()) {
                sedeService.delete(id);
                return ResponseEntity.ok(Map.of("mensaje", "Sede eliminada correctamente"));
            }
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // =====================================================================
    // CORREOS — ENVÍO
    // =====================================================================

    @PostMapping("/correo/unitario")
    @ResponseBody
    public ResponseEntity<Map<String, String>> enviarCorreoUnitario(
            @RequestParam String correo,
            @RequestParam String asunto,
            @RequestParam String mensaje) {

        Map<String, String> response = new HashMap<>();
        try {
            emailService.enviarCorreoUnitario(correo, asunto, mensaje);
            response.put("status",  "success");
            response.put("message", "Correo enviado correctamente a " + correo);
            return ResponseEntity.ok(response);
        } catch (MessagingException e) {
            response.put("status",  "error");
            response.put("message", "Error al enviar el correo: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    /**
     * Envío masivo sin plantilla — BCC a todos los destinatarios.
     * Acepta tipoPlantilla como parámetro OPCIONAL.
     * Si viene tipoPlantilla, usa la plantilla Thymeleaf correspondiente.
     * Si no viene, usa la plantilla estándar (comportamiento original).
     */
    @PostMapping("/correo/masivo")
    @ResponseBody
    public ResponseEntity<Map<String, String>> enviarCorreoMasivo(
            @RequestParam(name = "seleccionados", required = false) List<String> seleccionados,
            @RequestParam String asunto,
            @RequestParam String mensaje,
            @RequestParam(required = false) String tipoPlantilla) {

        Map<String, String> response = new HashMap<>();

        if (seleccionados == null || seleccionados.isEmpty()) {
            response.put("status",  "error");
            response.put("message", "No se seleccionó ningún correo.");
            return ResponseEntity.badRequest().body(response);
        }

        try {
            if (tipoPlantilla != null && !tipoPlantilla.isBlank()) {
                // Envío masivo con plantilla — un correo por destinatario
                for (String dest : seleccionados) {
                    try {
                        emailService.enviarConPlantilla(dest, asunto, mensaje, tipoPlantilla);
                    } catch (MessagingException e) {
                        // Continuar con el siguiente si uno falla
                    }
                }
            } else {
                // Envío masivo sin plantilla — BCC (comportamiento original)
                emailService.enviarCorreoMasivo(seleccionados, asunto, mensaje);
            }

            response.put("status",  "success");
            response.put("message", "Correos enviados correctamente a " +
                    seleccionados.size() + " destinatarios");
            return ResponseEntity.ok(response);

        } catch (MessagingException e) {
            response.put("status",  "error");
            response.put("message", "No fue posible enviar la notificación: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    /**
     * Envío unitario con plantilla Thymeleaf específica.
     * Usado por el selector de plantillas del tab "Uno a Uno".
     */
    @PostMapping("/correo/con-plantilla")
    @ResponseBody
    public ResponseEntity<Map<String, String>> enviarConPlantilla(
            @RequestParam String correo,
            @RequestParam String asunto,
            @RequestParam String mensaje,
            @RequestParam(defaultValue = "CUSTOM") String tipoPlantilla) {

        Map<String, String> response = new HashMap<>();
        try {
            emailService.enviarConPlantilla(correo, asunto, mensaje, tipoPlantilla);
            response.put("status",  "success");
            response.put("message", "Correo enviado correctamente a " + correo);
            return ResponseEntity.ok(response);
        } catch (MessagingException e) {
            response.put("status",  "error");
            response.put("message", "Error al enviar: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    // =====================================================================
    // CORREOS — FILTRO DE DESTINATARIOS
    // =====================================================================

    @GetMapping("/correos/clientes")
    @ResponseBody
    public ResponseEntity<List<Map<String, String>>> getCorreosClientes() {
        try {
            return ResponseEntity.ok(usuarioService.findAll().stream()
                    .filter(u -> u.getRol() == Rolenum.CLIENTE)
                    .map(u -> Map.of(
                            "nombre", u.getNombre() != null ? u.getNombre() : "",
                            "correo", u.getCorreo() != null ? u.getCorreo() : "",
                            "rol",    "CLIENTE"))
                    .collect(Collectors.toList()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/correos/sedes")
    @ResponseBody
    public ResponseEntity<List<Map<String, String>>> getCorreosSedes() {
        try {
            return ResponseEntity.ok(usuarioService.findAll().stream()
                    .filter(u -> u.getRol() == Rolenum.ADMINISTRADOR_SEDE)
                    .map(u -> Map.of(
                            "nombre", u.getNombre() != null ? u.getNombre() : "",
                            "correo", u.getCorreo() != null ? u.getCorreo() : "",
                            "rol",    "ADMINISTRADOR_SEDE"))
                    .collect(Collectors.toList()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/correos/trabajadores")
    @ResponseBody
    public ResponseEntity<List<Map<String, String>>> getCorreosTrabajadores() {
        try {
            return ResponseEntity.ok(usuarioService.findAll().stream()
                    .filter(u -> u.getRol() == Rolenum.OPERARIO)
                    .map(u -> Map.of(
                            "nombre", u.getNombre() != null ? u.getNombre() : "",
                            "correo", u.getCorreo() != null ? u.getCorreo() : "",
                            "rol",    "OPERARIO"))
                    .collect(Collectors.toList()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // =====================================================================
    // CORREOS — HISTORIAL, ESTADÍSTICAS Y PLANTILLAS
    // =====================================================================

    @GetMapping("/correos/historial")
    @ResponseBody
    public ResponseEntity<List<EmailLog>> getHistorialCorreos(
            @RequestParam(required = false) String estado,
            @RequestParam(required = false) String tipo,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime desde,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime hasta) {

        try {
            // Convertir strings a enums solo si vienen con valor
            EmailLog.EstadoEmail estadoEnum = (estado != null && !estado.isBlank())
                    ? EmailLog.EstadoEmail.valueOf(estado) : null;
            EmailLog.TipoEmail tipoEnum = (tipo != null && !tipo.isBlank())
                    ? EmailLog.TipoEmail.valueOf(tipo) : null;

            boolean tieneEstado = estadoEnum != null;
            boolean tieneTipo   = tipoEnum   != null;
            boolean tieneDesde  = desde      != null;
            boolean tieneHasta  = hasta      != null;

            List<EmailLog> logs;

            // Elegir el método de Spring Data según los filtros presentes
            // Ningún parámetro opcional → PostgreSQL nunca ve un NULL sin tipo
            if (!tieneEstado && !tieneTipo && !tieneDesde && !tieneHasta) {
                logs = emailLogRepository.findAllByOrderByFechaCreacionDesc();

            } else if (tieneEstado && tieneTipo && tieneDesde && tieneHasta) {
                logs = emailLogRepository.findByEstadoAndTipoAndFechaCreacionBetweenOrderByFechaCreacionDesc(estadoEnum, tipoEnum, desde, hasta);

            } else if (tieneEstado && tieneTipo && tieneDesde) {
                logs = emailLogRepository.findByEstadoAndTipoAndFechaCreacionAfterOrderByFechaCreacionDesc(estadoEnum, tipoEnum, desde);

            } else if (tieneEstado && tieneTipo && tieneHasta) {
                logs = emailLogRepository.findByEstadoAndTipoAndFechaCreacionBeforeOrderByFechaCreacionDesc(estadoEnum, tipoEnum, hasta);

            } else if (tieneEstado && tieneTipo) {
                logs = emailLogRepository.findByEstadoAndTipoOrderByFechaCreacionDesc(estadoEnum, tipoEnum);

            } else if (tieneEstado && tieneDesde && tieneHasta) {
                logs = emailLogRepository.findByEstadoAndFechaCreacionBetweenOrderByFechaCreacionDesc(estadoEnum, desde, hasta);

            } else if (tieneEstado && tieneDesde) {
                logs = emailLogRepository.findByEstadoAndFechaCreacionAfterOrderByFechaCreacionDesc(estadoEnum, desde);

            } else if (tieneEstado && tieneHasta) {
                logs = emailLogRepository.findByEstadoAndFechaCreacionBeforeOrderByFechaCreacionDesc(estadoEnum, hasta);

            } else if (tieneEstado) {
                logs = emailLogRepository.findByEstadoOrderByFechaCreacionDesc(estadoEnum);

            } else if (tieneTipo && tieneDesde && tieneHasta) {
                logs = emailLogRepository.findByTipoAndFechaCreacionBetweenOrderByFechaCreacionDesc(tipoEnum, desde, hasta);

            } else if (tieneTipo && tieneDesde) {
                logs = emailLogRepository.findByTipoAndFechaCreacionAfterOrderByFechaCreacionDesc(tipoEnum, desde);

            } else if (tieneTipo && tieneHasta) {
                logs = emailLogRepository.findByTipoAndFechaCreacionBeforeOrderByFechaCreacionDesc(tipoEnum, hasta);

            } else if (tieneTipo) {
                logs = emailLogRepository.findByTipoOrderByFechaCreacionDesc(tipoEnum);

            } else if (tieneDesde && tieneHasta) {
                logs = emailLogRepository.findByFechaCreacionBetweenOrderByFechaCreacionDesc(desde, hasta);

            } else if (tieneDesde) {
                logs = emailLogRepository.findByFechaCreacionAfterOrderByFechaCreacionDesc(desde);

            } else {
                logs = emailLogRepository.findByFechaCreacionBeforeOrderByFechaCreacionDesc(hasta);
            }

            return ResponseEntity.ok(logs);

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/correos/estadisticas")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getEstadisticasCorreos() {
        try {
            Map<String, Object> stats = new HashMap<>();
            stats.put("totalEnviados",   emailLogRepository.countByEstado(EmailLog.EstadoEmail.ENVIADO));
            stats.put("totalErrores",    emailLogRepository.countByEstado(EmailLog.EstadoEmail.ERROR));
            stats.put("totalPendientes", emailLogRepository.countByEstado(EmailLog.EstadoEmail.PENDIENTE));
            stats.put("total",           emailLogRepository.count());
            stats.put("porTipo",         emailLogRepository.countPorTipo());
            stats.put("porEstado",       emailLogRepository.countPorEstado());
            stats.put("ultimos7dias",    emailLogRepository
                    .conteoUltimos7Dias(LocalDateTime.now().minusDays(7)));
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/correos/plantilla-preview")
    @ResponseBody
    public ResponseEntity<Map<String, String>> getPlantillaPreview(
            @RequestParam String tipo) {

        record Plantilla(String asunto, String mensaje) {}

        Map<String, Plantilla> plantillas = Map.of(
                "BIENVENIDA",   new Plantilla(
                        "Bienvenido a AparcaYA",
                        "Tu cuenta ha sido creada exitosamente. Ya puedes acceder al sistema."),
                "RECORDATORIO", new Plantilla(
                        "Recordatorio importante",
                        "Tienes una actividad pendiente en tu cuenta que requiere atencion."),
                "PROMOCION",    new Plantilla(
                        "Oferta especial para ti",
                        "Tenemos una oferta exclusiva disponible por tiempo limitado."),
                "NOTIFICACION", new Plantilla(
                        "Notificacion del sistema",
                        "El sistema ha generado una notificacion que requiere tu atencion.")
        );

        Plantilla p = plantillas.get(tipo.toUpperCase());
        if (p == null) return ResponseEntity.badRequest().build();

        return ResponseEntity.ok(Map.of(
                "asunto",  p.asunto(),
                "mensaje", p.mensaje()
        ));
    }

    // =========================================================
    // REPORTES
    // =========================================================

    @GetMapping("/reporte/usuarios/pdf")
    public ResponseEntity<byte[]> generarReportePDF() {
        try {
            List<Usuario> usuarios = usuarioService.findByRolIn(List.of(Rolenum.CLIENTE));
            if (usuarios.isEmpty()) return ResponseEntity.status(HttpStatus.NO_CONTENT).body(null);
            ByteArrayOutputStream baos = reporteService.generarReportePDF(usuarios);
            String filename = "reporte_clientes_" +
                    LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss")) + ".pdf";
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            headers.setContentDispositionFormData("attachment", filename);
            return new ResponseEntity<>(baos.toByteArray(), headers, HttpStatus.OK);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(("Error: " + e.getMessage()).getBytes());
        }
    }

    @GetMapping("/reporte/usuarios/excel")
    public ResponseEntity<byte[]> generarReporteExcelUsuarios() {
        try {
            List<Usuario> usuarios = usuarioService.findByRolIn(List.of(Rolenum.CLIENTE));
            if (usuarios.isEmpty()) return ResponseEntity.status(HttpStatus.NO_CONTENT).body(null);
            ByteArrayOutputStream baos = reporteService.generarReporteExcel(usuarios);
            String filename = "reporte_clientes_" +
                    LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss")) + ".xlsx";
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            headers.setContentDispositionFormData("attachment", filename);
            return new ResponseEntity<>(baos.toByteArray(), headers, HttpStatus.OK);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(("Error: " + e.getMessage()).getBytes());
        }
    }

    @GetMapping("/reportes/excel")
    public void generarExcel(HttpServletResponse response) throws IOException {
        response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setHeader("Content-Disposition", "attachment; filename=clientes.xlsx");
        try {
            List<Usuario> usuarios = usuarioService.findByRolIn(List.of(Rolenum.CLIENTE));
            ByteArrayOutputStream baos = reporteService.generarReporteExcel(usuarios);
            response.getOutputStream().write(baos.toByteArray());
        } catch (Exception e) { e.printStackTrace(); }
    }

    @GetMapping("/reportes/excel-sedes")
    public void generarExcelSedes(HttpServletResponse response,
                                  HttpServletRequest request) throws IOException {
        response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setHeader("Content-Disposition", "attachment; filename=mi_sede.xlsx");
        try {
            Sede sede = getSedeActiva(request);  // ✅
            List<Sede> sedes = sede != null ? List.of(sede) : new ArrayList<>();
            ByteArrayOutputStream baos = reporteService.generarReporteExcelSedes(sedes);
            response.getOutputStream().write(baos.toByteArray());
        } catch (Exception e) { e.printStackTrace(); }
    }

    // =========================================================
    // ESTADÍSTICAS
    // =========================================================

    @GetMapping("/estadisticas")
    public ResponseEntity<Map<String, Object>> getEstadisticas(HttpServletRequest request) {
        try {
            Sede sede = getSedeActiva(request);  // ✅
            List<Sede> sedes = sede != null ? List.of(sede) : new ArrayList<>();

            long totalClientes   = usuarioService.contarTotal();
            long usuariosActivos = usuarioService.contarActivos();
            long sedesActivas    = sedeService.contarActivas();
            int  capacidadTotal  = sedes.stream()
                    .filter(s -> s.getCapacidad() != null)
                    .mapToInt(Sede::getCapacidad).sum();

            Map<String, Object> stats = new LinkedHashMap<>();
            stats.put("totalUsuarios",     totalClientes);
            stats.put("totalClientes",     totalClientes);
            stats.put("usuariosActivos",   usuariosActivos);
            stats.put("usuariosInactivos", totalClientes - usuariosActivos);
            stats.put("totalSedes",        sedes.size());
            stats.put("sedesActivas",      sedesActivas);
            stats.put("capacidadTotal",    capacidadTotal);
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // =========================================================
    // VEHÍCULOS ACTIVOS
    // =========================================================

    @GetMapping("/vehiculos-activos")
    public ResponseEntity<?> getVehiculosActivos(HttpServletRequest request) {
        try {
            Sede sede = getSedeActiva(request);  // ✅
            if (sede == null) return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "No se encontró una sede asignada"));

            Tarifa tarifa = getTarifaDeSede(sede);
            List<RegistroEntradaSalida> registros =
                    registroEntradaSalidaService.findBySedeAndEstado(sede, EstadoRegistro.ACTIVO);

            List<Map<String, Object>> vehiculos = registros.stream().map(registro -> {
                Map<String, Object> v = new HashMap<>();
                v.put("registroId",   registro.getIdRegistro());
                v.put("placa",        registro.getVehiculo().getPlaca());
                v.put("tipoVehiculo", registro.getVehiculo().getTipo().toString());
                v.put("marca",        registro.getVehiculo().getMarca().toString());
                v.put("color",        registro.getVehiculo().getColor());
                v.put("horaEntrada",  registro.getFechaHoraEntrada().toString());
                Usuario cliente = registro.getVehiculo().getIdUsuario();
                v.put("clienteNombre",   cliente.getNombre());
                v.put("clienteTelefono", cliente.getTelefono());
                v.put("clienteEmail",    cliente.getCorreo());
                Duration duracion = Duration.between(registro.getFechaHoraEntrada(), LocalDateTime.now());
                v.put("tiempoTranscurrido",    formatearTiempo(duracion));
                v.put("segundosTranscurridos", duracion.getSeconds());
                double[] tarifas = resolverTarifas(tarifa, registro.getVehiculo().getTipo());
                long minutosTranscurridos = duracion.toMinutes();
                v.put("cobroEstimadoPlena",
                        BigDecimal.valueOf(tarifas[0]).setScale(2, RoundingMode.HALF_UP));
                v.put("cobroEstimadoMinuto",
                        BigDecimal.valueOf(minutosTranscurridos * tarifas[1]).setScale(2, RoundingMode.HALF_UP));
                v.put("cupo", registro.getCupo() != null ? registro.getCupo().getCodigo() : "Sin asignar");
                return v;
            }).collect(Collectors.toList());

            return ResponseEntity.ok(vehiculos);
        } catch (Exception e) {
            log.error("Error al cargar vehículos activos: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // =========================================================
    // VEHÍCULOS PENDIENTES DE COBRO
    // =========================================================

    @GetMapping("/vehiculos-pendientes-cobro")
    public ResponseEntity<?> getVehiculosPendientesCobro(HttpServletRequest request) {
        try {
            Sede sede = getSedeActiva(request);  // ✅
            if (sede == null) return ResponseEntity.ok(new ArrayList<>());

            List<RegistroEntradaSalida> registros =
                    registroEntradaSalidaService.findBySedeAndEstado(sede, EstadoRegistro.FINALIZADO);

            List<Map<String, Object>> vehiculos = registros.stream().map(registro -> {
                Map<String, Object> v = new HashMap<>();
                v.put("registroId",   registro.getIdRegistro());
                v.put("placa",        registro.getVehiculo().getPlaca());
                v.put("tipoVehiculo", registro.getVehiculo().getTipo().toString());
                v.put("horaEntrada",  registro.getFechaHoraEntrada().toString());
                v.put("horaSalida",   registro.getFechaHoraSalida().toString());
                Usuario cliente = registro.getVehiculo().getIdUsuario();
                v.put("clienteNombre",   cliente.getNombre());
                v.put("clienteTelefono", cliente.getTelefono());
                Duration duracion = Duration.between(
                        registro.getFechaHoraEntrada(), registro.getFechaHoraSalida());
                v.put("tiempoTotal", formatearTiempo(duracion));
                v.put("precio", registro.getPago() != null ? registro.getPago().getMonto() : null);
                return v;
            }).collect(Collectors.toList());

            return ResponseEntity.ok(vehiculos);
        } catch (Exception e) {
            log.error("Error al cargar pendientes: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // =========================================================
    // HISTORIAL
    // =========================================================

    @GetMapping("/historial")
    public ResponseEntity<?> getHistorial(
            @RequestParam(required = false) String fecha,
            @RequestParam(required = false) String estado,
            HttpServletRequest request) {
        try {
            Sede sede = getSedeActiva(request);  // ✅
            if (sede == null) return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "No se encontró una sede asignada"));

            List<RegistroEntradaSalida> registros =
                    registroEntradaSalidaService.findHistorialBySede(sede);

            if (fecha  != null && !fecha.isEmpty())
                registros = registros.stream()
                        .filter(r -> r.getFechaHoraEntrada().toLocalDate().equals(LocalDate.parse(fecha)))
                        .collect(Collectors.toList());
            if (estado != null && !estado.isEmpty())
                registros = registros.stream()
                        .filter(r -> r.getEstado() == EstadoRegistro.valueOf(estado.toUpperCase()))
                        .collect(Collectors.toList());

            List<Map<String, Object>> historial = registros.stream().map(registro -> {
                Map<String, Object> item = new HashMap<>();
                item.put("registroId",   registro.getIdRegistro());
                item.put("placa",        registro.getVehiculo().getPlaca());
                item.put("tipoVehiculo", registro.getVehiculo().getTipo().toString());
                item.put("marca",        registro.getVehiculo().getMarca().toString());
                item.put("horaEntrada",  registro.getFechaHoraEntrada().toString());
                item.put("horaSalida",   registro.getFechaHoraSalida() != null
                        ? registro.getFechaHoraSalida().toString() : null);
                item.put("estado",       registro.getEstado().toString());
                item.put("precio",     registro.getPago() != null ? registro.getPago().getMonto()     : null);
                item.put("metodoPago", registro.getPago() != null ? registro.getPago().getMetodoPago() : null);
                Usuario cliente = registro.getVehiculo().getIdUsuario();
                item.put("clienteNombre",   cliente.getNombre());
                item.put("clienteTelefono", cliente.getTelefono());
                item.put("clienteEmail",    cliente.getCorreo());
                Duration duracion = registro.getFechaHoraSalida() != null
                        ? Duration.between(registro.getFechaHoraEntrada(), registro.getFechaHoraSalida())
                        : Duration.between(registro.getFechaHoraEntrada(), LocalDateTime.now());
                item.put("tiempoTotal", formatearTiempo(duracion)
                        + (registro.getFechaHoraSalida() != null ? "" : " (en curso)"));
                return item;
            }).collect(Collectors.toList());

            return ResponseEntity.ok(historial);
        } catch (Exception e) {
            log.error("Error al cargar historial: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // =========================================================
    // REGISTRAR ENTRADA
    // =========================================================

    @PostMapping("/registrar-entrada")
    public ResponseEntity<Map<String, Object>> registrarEntrada(
            @RequestBody Map<String, String> datos,
            HttpServletRequest request) {
        try {
            Sede    sede       = getSedeActiva(request);  // ✅
            Usuario trabajador = getUsuarioAutenticado();

            List<RegistroEntradaSalida> vehiculosActivos =
                    registroEntradaSalidaService.findBySedeAndEstado(sede, EstadoRegistro.ACTIVO);
            if (vehiculosActivos.size() >= sede.getCapacidad()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Parqueadero lleno. No hay cupos disponibles."));
            }

            String correo   = datos.get("clienteEmail");
            String nombre   = datos.get("clienteNombre");
            String telefono = datos.get("clienteTelefono");
            String cedula   = datos.getOrDefault("clienteCedula", "");
            final String sufijo = String.valueOf(System.currentTimeMillis());

            Usuario cliente = usuarioService.findByCorreo(correo).orElseGet(() -> {
                Usuario nuevoCliente = new Usuario();
                nuevoCliente.setNombre((nombre != null && !nombre.isBlank()) ? nombre : "Visitante");
                String telefonoFinal = (telefono != null && !telefono.isBlank()
                        && !telefono.equals("0000000000"))
                        ? telefono : ("9" + sufijo).substring(0, 10);
                nuevoCliente.setTelefono(telefonoFinal);
                nuevoCliente.setCorreo(correo);
                String cedulaFinal = (cedula != null && !cedula.isBlank())
                        ? cedula : sufijo.substring(sufijo.length() - 10);
                nuevoCliente.setCedula(cedulaFinal);
                nuevoCliente.setContrasena(passwordEncoder.encode(UUID.randomUUID().toString()));
                nuevoCliente.setRol(Rolenum.CLIENTE);
                nuevoCliente.setMetodoPago(MetodoPago.EFECTIVO);
                nuevoCliente.setEstado(EstadoGeneral.ACTIVO);
                nuevoCliente.setDescripcion("");
                return usuarioService.save(nuevoCliente);
            });

            String placa        = datos.get("vehiculoPlaca").toUpperCase().trim();
            String tipoVehiculo = datos.getOrDefault("vehiculoTipo",  "CARRO");
            String marca        = datos.getOrDefault("vehiculoMarca", "OTRO");
            String color        = datos.getOrDefault("vehiculoColor", "NO ESPECIFICADO");
            String anioStr      = datos.getOrDefault("vehiculoAnio",  "2020");

            int anioResuelto;
            try { anioResuelto = Integer.parseInt(anioStr.isEmpty() ? "2020" : anioStr); }
            catch (NumberFormatException e) { anioResuelto = 2020; }
            final int anio = anioResuelto;

            Optional<Vehiculo> vehiculoExistente = vehiculoService.findByPlaca(placa);
            if (vehiculoExistente.isPresent()) {
                if (registroEntradaSalidaService.findVehiculoActivo(vehiculoExistente.get()).isPresent()) {
                    return ResponseEntity.badRequest()
                            .body(Map.of("error", "Este vehículo ya se encuentra en el parqueadero"));
                }
            }

            Vehiculo vehiculo = vehiculoService.findByPlaca(placa).orElseGet(() -> {
                Vehiculo v = new Vehiculo();
                v.setPlaca(placa);
                v.setTipo(TipoVehiculo.valueOf(tipoVehiculo.toUpperCase()));
                v.setMarca(Marca.valueOf(marca.toUpperCase()));
                v.setColor(color);
                v.setAnio(anio);
                v.setIdUsuario(cliente);
                return vehiculoService.save(v);
            });

            List<Cupo> cuposDisponibles = cupoService.findBySedeAndEstado(sede, EstadoCupo.DISPONIBLE);
            Cupo cupoAsignado = cuposDisponibles.isEmpty() ? null : cuposDisponibles.get(0);

            RegistroEntradaSalida registro = registroEntradaSalidaService
                    .registrarEntrada(vehiculo, sede, cupoAsignado, trabajador);

            Tarifa  tarifa  = getTarifaDeSede(sede);
            double[] tarifas = resolverTarifas(tarifa, tipoVehiculo);

            Map<String, Object> response = new HashMap<>();
            response.put("mensaje",       "Vehículo registrado exitosamente.");
            response.put("registroId",    registro.getIdRegistro());
            response.put("placa",         placa);
            response.put("clienteNombre", cliente.getNombre());
            response.put("horaEntrada",   registro.getFechaHoraEntrada().toString());
            response.put("cupo",          cupoAsignado != null ? cupoAsignado.getCodigo() : "Sin asignar");
            response.put("tarifaPlena",   tarifas[0]);
            response.put("tarifaMinuto",  tarifas[1]);
            log.info("Entrada registrada: placa={} sede={}", placa, sede.getNombre());
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (Exception e) {
            log.error("Error al registrar entrada: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // =========================================================
    // REGISTRAR SALIDA
    // =========================================================

    @PostMapping("/registrar-salida/{registroId}")
    public ResponseEntity<Map<String, Object>> registrarSalida(
            @PathVariable Long registroId,
            HttpServletRequest request) {
        try {
            Sede sede = getSedeActiva(request);
            RegistroEntradaSalida registroExistente = registroEntradaSalidaService
                    .findById(registroId)
                    .orElseThrow(() -> new RuntimeException("Registro no encontrado"));

            if (!registroExistente.getSede().getIdSede().equals(sede.getIdSede())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "No tiene permisos para operar sobre este registro"));
            }

            RegistroEntradaSalida registro = registroEntradaSalidaService.registrarSalida(registroId);

            // ← REEMPLAZAR findAll() por búsqueda directa por vehículo y estado
            reservacionService
                    .findByVehiculoAndEstado(
                            registro.getVehiculo().getIdVehiculo(),
                            EstadoReservacion.EN_CURSO)
                    .ifPresent(r -> {
                        r.setEstado(EstadoReservacion.COMPLETADA);
                        reservacionService.save(r);
                        log.info("Reservacion {} marcada COMPLETADA tras salida registro {}",
                                r.getIdReserva(), registroId);
                    });

            Duration duracion = Duration.between(
                    registro.getFechaHoraEntrada(), registro.getFechaHoraSalida());

            Map<String, Object> response = new HashMap<>();
            response.put("mensaje",       "Salida registrada. Pendiente de cobro.");
            response.put("registroId",    registro.getIdRegistro());
            response.put("placa",         registro.getVehiculo().getPlaca());
            response.put("clienteNombre", registro.getVehiculo().getIdUsuario().getNombre());
            response.put("horaEntrada",   registro.getFechaHoraEntrada().toString());
            response.put("horaSalida",    registro.getFechaHoraSalida().toString());
            response.put("tiempoTotal",   formatearTiempo(duracion));
            log.info("Salida registrada: registroId={}", registroId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error al registrar salida {}: {}", registroId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // =========================================================
    // CONFIRMAR COBRO
    // =========================================================

    @PostMapping("/confirmar-cobro/{registroId}")
    public ResponseEntity<Map<String, Object>> confirmarCobro(
            @PathVariable Long registroId,
            @RequestBody Map<String, String> datos,
            HttpServletRequest request) {
        try {
            Sede sede = getSedeActiva(request);  // ✅
            RegistroEntradaSalida registroExistente = registroEntradaSalidaService
                    .findById(registroId)
                    .orElseThrow(() -> new RuntimeException("Registro no encontrado"));

            if (!registroExistente.getSede().getIdSede().equals(sede.getIdSede())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "No tiene permisos para operar sobre este registro"));
            }

            String metodoPago = datos.getOrDefault("metodoPago", "EFECTIVO");
            String tipoTarifa = datos.getOrDefault("tipoTarifa", "MINUTO");

            if (!tipoTarifa.equalsIgnoreCase("PLENA")
                    && !tipoTarifa.equalsIgnoreCase("MINUTO")
                    && !tipoTarifa.equalsIgnoreCase("HORA")) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Tipo de tarifa inválido. Debe ser PLENA, MINUTO u HORA"));
            }

            RegistroEntradaSalida registro =
                    registroEntradaSalidaService.confirmarCobroConTarifa(registroId, metodoPago, tipoTarifa);

            reservacionService
                    .findByVehiculoAndEstado(
                            registro.getVehiculo().getIdVehiculo(),
                            EstadoReservacion.COMPLETADA)
                    .ifPresent(r -> {
                        r.setEstado(EstadoReservacion.PAGADA);
                        reservacionService.save(r);
                        log.info("Reservacion {} marcada PAGADA tras cobro registro {}",
                                r.getIdReserva(), registroId);
                    });

            Map<String, Object> response = new HashMap<>();
            response.put("mensaje",            "Cobro confirmado exitosamente");
            response.put("registroId",         registro.getIdRegistro());
            response.put("placa",              registro.getVehiculo().getPlaca());
            response.put("precio",             registro.getPago() != null ? registro.getPago().getMonto() : null);
            response.put("metodoPago",         metodoPago);
            response.put("tipoTarifaAplicada", tipoTarifa);
            response.put("estado",             registro.getEstado().toString());
            log.info("Cobro confirmado: registroId={} tarifa={}", registroId, tipoTarifa);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error al confirmar cobro {}: {}", registroId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // =========================================================
    // OPCIONES DE COBRO
    // =========================================================

    @GetMapping("/opciones-cobro/{registroId}")
    public ResponseEntity<?> getOpcionesCobro(@PathVariable Long registroId,
                                              HttpServletRequest request) {
        try {
            Sede sede = getSedeActiva(request);  // ✅
            RegistroEntradaSalida registro = registroEntradaSalidaService
                    .findById(registroId)
                    .orElseThrow(() -> new RuntimeException("Registro no encontrado"));

            if (!registro.getSede().getIdSede().equals(sede.getIdSede())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "No tiene permisos para ver este registro"));
            }
            if (registro.getEstado() != EstadoRegistro.FINALIZADO) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "El registro no está pendiente de cobro"));
            }

            Duration duracion = Duration.between(
                    registro.getFechaHoraEntrada(), registro.getFechaHoraSalida());
            long minutosTranscurridos = duracion.toMinutes();
            long horasTranscurridas   = duracion.toHours();

            Tarifa  tarifa  = getTarifaDeSede(sede);
            double[] tarifas = resolverTarifas(tarifa, registro.getVehiculo().getTipo());

            BigDecimal precioMinuto = BigDecimal.valueOf(minutosTranscurridos * tarifas[1])
                    .setScale(2, RoundingMode.HALF_UP);
            BigDecimal precioHora = BigDecimal.valueOf(
                            Math.max(1, horasTranscurridas) * tarifas[1] * 60)
                    .setScale(2, RoundingMode.HALF_UP);

            long horas = duracion.toHours(), minutos = duracion.toMinutes() % 60;

            Map<String, Object> response = new HashMap<>();
            response.put("registroId",           registroId);
            response.put("placa",                registro.getVehiculo().getPlaca());
            response.put("clienteNombre",        registro.getVehiculo().getIdUsuario().getNombre());
            response.put("tipoVehiculo",         registro.getVehiculo().getTipo().toString());
            response.put("horaEntrada",          registro.getFechaHoraEntrada().toString());
            response.put("horaSalida",           registro.getFechaHoraSalida().toString());
            response.put("minutosTranscurridos", minutosTranscurridos);
            response.put("tiempoTotal",          horas > 0 ? horas + "h " + minutos + "m" : minutos + "m");
            response.put("opciones", List.of(
                    Map.of("tipo","PLENA",  "nombre","Tarifa Plena (Día Completo)",
                            "precio", tarifas[0], "descripcion","Tarifa fija del día"),
                    Map.of("tipo","MINUTO", "nombre","Tarifa por Minuto",
                            "precio", precioMinuto,
                            "descripcion", minutosTranscurridos + " min × $" + (int) tarifas[1] + "/min"),
                    Map.of("tipo","HORA",   "nombre","Tarifa por Hora",
                            "precio", precioHora,
                            "descripcion", Math.max(1, horasTranscurridas) + " horas")
            ));
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error opciones cobro {}: {}", registroId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // =========================================================
    // RESERVACIONES
    // =========================================================

    @GetMapping("/reservaciones")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getReservaciones(HttpServletRequest request) {
        try {
            Sede sede = getSedeActiva(request);
            if (sede == null) return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "No se encontró una sede asignada"));

            List<Map<String, Object>> reservas = reservacionService
                    .findByCupoSedeId(sede.getIdSede())
                    .stream()
                    .filter(r -> r.getEstado() == EstadoReservacion.PENDIENTE
                            || r.getEstado() == EstadoReservacion.ACEPTADA
                            || r.getEstado() == EstadoReservacion.EN_CURSO
                            || r.getEstado() == EstadoReservacion.COMPLETADA)
                    .map(reserva -> {
                        Map<String, Object> r = new HashMap<>();
                        r.put("id",              reserva.getIdReserva());
                        r.put("clienteNombre",   reserva.getCliente().getNombre());
                        r.put("clienteTelefono", reserva.getCliente().getTelefono());
                        r.put("clienteEmail",    reserva.getCliente().getCorreo());
                        r.put("placa",           reserva.getVehiculo().getPlaca());
                        r.put("tipoVehiculo",    reserva.getVehiculo().getTipo().toString());
                        r.put("horaInicio",      reserva.getFechaInicio().toString());
                        r.put("horaFin",         reserva.getFechaFin().toString());
                        r.put("cupo",            reserva.getCupo().getCodigo());
                        r.put("estado",          reserva.getEstado().toString());
                        // Agregar el registroId cuando el vehículo ya está físicamente adentro
                        if (reserva.getEstado() == EstadoReservacion.EN_CURSO ||
                                reserva.getEstado() == EstadoReservacion.COMPLETADA) {
                            registroEntradaSalidaService
                                    .findVehiculoActivo(reserva.getVehiculo())
                                    .ifPresent(reg -> r.put("registroId", reg.getIdRegistro()));
                        }
                        return r;
                    }).collect(Collectors.toList());

            return ResponseEntity.ok(reservas);
        } catch (Exception e) {
            log.error("Error al cargar reservaciones: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/aceptar-reservacion/{reservacionId}")
    public ResponseEntity<Map<String, Object>> aceptarReservacion(
            @PathVariable Long reservacionId,
            HttpServletRequest request) {
        try {
            Sede    sede       = getSedeActiva(request);
            Usuario trabajador = getUsuarioAutenticado();

            Reservacion reservacion = reservacionService.findById(reservacionId)
                    .orElseThrow(() -> new RuntimeException("Reservación no encontrada"));

            if (!reservacion.getCupo().getSede().getIdSede().equals(sede.getIdSede())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "Sin permisos sobre esta reservación"));
            }

            // SOLO cambia estado — el vehículo aún no ha llegado físicamente
            reservacion.setEstado(EstadoReservacion.ACEPTADA);
            reservacionService.save(reservacion);

            return ResponseEntity.ok(Map.of(
                    "mensaje",       "Reservación aceptada — esperando llegada del vehículo",
                    "reservacionId", reservacionId,
                    "estado",        "ACEPTADA"
            ));
        } catch (Exception e) {
            log.error("Error al aceptar reservacion {}: {}", reservacionId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/rechazar-reservacion/{reservacionId}")
    public ResponseEntity<Map<String, Object>> rechazarReservacion(
            @PathVariable Long reservacionId,
            HttpServletRequest request) {
        try {
            Sede sede = getSedeActiva(request);  // ✅
            Reservacion reservacion = reservacionService.findById(reservacionId)
                    .orElseThrow(() -> new RuntimeException("Reservación no encontrada"));

            if (!reservacion.getCupo().getSede().getIdSede().equals(sede.getIdSede())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "No tiene permisos para operar sobre esta reservación"));
            }

            reservacion.setEstado(EstadoReservacion.CANCELADA);
            reservacionService.save(reservacion);
            Cupo cupo = reservacion.getCupo();
            cupo.setEstado(EstadoCupo.DISPONIBLE);
            cupoService.save(cupo);

            return ResponseEntity.ok(Map.of(
                    "mensaje", "Reservación rechazada", "reservacionId", reservacionId));
        } catch (Exception e) {
            log.error("Error al rechazar reservacion {}: {}", reservacionId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }
    @PostMapping("/iniciar-reservacion/{reservacionId}")
    public ResponseEntity<Map<String, Object>> iniciarReservacion(
            @PathVariable Long reservacionId,
            HttpServletRequest request) {
        try {
            Sede    sede       = getSedeActiva(request);
            Usuario trabajador = getUsuarioAutenticado();

            Reservacion reservacion = reservacionService.findById(reservacionId)
                    .orElseThrow(() -> new RuntimeException("Reservación no encontrada"));

            if (!reservacion.getCupo().getSede().getIdSede().equals(sede.getIdSede())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "Sin permisos sobre esta reservación"));
            }

            if (reservacion.getEstado() != EstadoReservacion.ACEPTADA) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(Map.of("error", "Solo se pueden iniciar reservaciones ACEPTADAS. Estado actual: "
                                + reservacion.getEstado().name()));
            }

            // Cambiar estado de la reserva
            reservacion.setEstado(EstadoReservacion.EN_CURSO);
            reservacionService.save(reservacion);

            // Crear el RegistroEntradaSalida real — ESTO es lo que aparece en Gestión de Vehículos
            RegistroEntradaSalida registro = registroEntradaSalidaService.registrarEntrada(
                    reservacion.getVehiculo(), sede, reservacion.getCupo(), trabajador);

            log.info("Reservacion {} iniciada — registro={} placa={}",
                    reservacionId, registro.getIdRegistro(), reservacion.getVehiculo().getPlaca());

            return ResponseEntity.ok(Map.of(
                    "mensaje",       "Vehículo ingresado — temporizador iniciado",
                    "reservacionId", reservacionId,
                    "registroId",    registro.getIdRegistro(),
                    "estado",        "EN_CURSO",
                    "horaEntrada",   registro.getFechaHoraEntrada().toString()
            ));
        } catch (Exception e) {
            log.error("Error al iniciar reservacion {}: {}", reservacionId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }


    // =========================================================
    // CARGA MASIVA
    // =========================================================

    private static final Set<String> MIME_EXCEL_PERMITIDOS = Set.of(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
            "application/octet-stream"
    );

    @PostMapping("/carga-masiva")
    public ResponseEntity<Map<String, Object>> cargaMasiva(
            @RequestParam("file") MultipartFile file) {
        log.info("Iniciando carga masiva: archivo={}", file.getOriginalFilename());

        if (file.isEmpty())
            return ResponseEntity.badRequest().body(Map.of("error", "Archivo vacío"));

        String originalFilename = file.getOriginalFilename() != null
                ? file.getOriginalFilename().toLowerCase() : "";
        if (!originalFilename.endsWith(".xlsx") && !originalFilename.endsWith(".xls"))
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Solo se aceptan archivos Excel (.xlsx o .xls)"));

        String contentType = file.getContentType() != null ? file.getContentType() : "";
        if (!MIME_EXCEL_PERMITIDOS.contains(contentType))
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Tipo de archivo no permitido"));

        try {
            Workbook workbook = new XSSFWorkbook(file.getInputStream());
            Sheet sheet = workbook.getSheetAt(0);

            int clientesRegistrados = 0, vehiculosRegistrados = 0;
            List<String> errores = new ArrayList<>();
            List<Map<String, Object>> cargados = new ArrayList<>();

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;
                try {
                    if (!"Cliente".equalsIgnoreCase(getCellValueAsString(row.getCell(0)))) continue;
                    String nombre   = getCellValueAsString(row.getCell(1));
                    String telefono = getCellValueAsString(row.getCell(2));
                    String email    = getCellValueAsString(row.getCell(3));
                    String cedula   = getCellValueAsString(row.getCell(4));
                    if (nombre.trim().isEmpty() || email.trim().isEmpty() || telefono.trim().isEmpty()) {
                        errores.add("Fila " + (i+1) + ": Faltan datos obligatorios"); continue;
                    }
                    if (usuarioService.findByCorreo(email.trim()).isPresent()) {
                        errores.add("Fila " + (i+1) + ": Email " + email + " ya existe"); continue;
                    }
                    if (usuarioService.findByTelefono(telefono.trim()) != null) {
                        errores.add("Fila " + (i+1) + ": Teléfono ya registrado"); continue;
                    }
                    String cedulaFinal = cedula.trim().isEmpty() ? "0000000000" : cedula.trim();
                    if (usuarioService.findByCedula(cedulaFinal) != null) {
                        errores.add("Fila " + (i+1) + ": Cédula ya registrada"); continue;
                    }
                    usuarioService.save(Usuario.builder()
                            .nombre(nombre.trim()).correo(email.trim())
                            .telefono(telefono.trim()).cedula(cedulaFinal)
                            .contrasena(passwordEncoder.encode(UUID.randomUUID().toString()))
                            .rol(Rolenum.CLIENTE).metodoPago(MetodoPago.EFECTIVO)
                            .estado(EstadoGeneral.ACTIVO).descripcion("").build());
                    clientesRegistrados++;
                    cargados.add(Map.of("tipo","Cliente","nombre",nombre,"email",email,"cedula",cedulaFinal));
                } catch (Exception e) {
                    errores.add("Fila " + (i+1) + " (Cliente): " + e.getMessage());
                }
            }

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;
                try {
                    String tipo = getCellValueAsString(row.getCell(0));
                    if (!("Vehiculo".equalsIgnoreCase(tipo) || "Vehículo".equalsIgnoreCase(tipo))) continue;
                    String placa        = getCellValueAsString(row.getCell(1)).toUpperCase().trim();
                    String tipoVeh      = getCellValueAsString(row.getCell(2)).toUpperCase().trim();
                    String marca        = getCellValueAsString(row.getCell(3)).toUpperCase().trim();
                    String color        = getCellValueAsString(row.getCell(4)).trim();
                    String anioStr      = getCellValueAsString(row.getCell(5)).trim();
                    String emailCliente = getCellValueAsString(row.getCell(6)).trim();
                    if (placa.isEmpty() || emailCliente.isEmpty()) {
                        errores.add("Fila " + (i+1) + ": Faltan placa o email"); continue;
                    }
                    int anio = 2020;
                    try { int p = Integer.parseInt(anioStr); if (p >= 1900 && p <= 2030) anio = p; }
                    catch (NumberFormatException ignored) {}
                    Optional<Usuario> clienteOpt = usuarioService.findByCorreo(emailCliente);
                    if (clienteOpt.isEmpty()) {
                        errores.add("Fila " + (i+1) + ": Cliente no encontrado: " + emailCliente); continue;
                    }
                    if (vehiculoService.findByPlaca(placa).isPresent()) {
                        errores.add("Fila " + (i+1) + ": Placa " + placa + " ya existe"); continue;
                    }
                    TipoVehiculo tipoVehiculo;
                    try { tipoVehiculo = TipoVehiculo.valueOf(tipoVeh); }
                    catch (IllegalArgumentException e) {
                        errores.add("Fila " + (i+1) + ": Tipo inválido: " + tipoVeh); continue;
                    }
                    Marca marcaEnum;
                    try { marcaEnum = Marca.valueOf(marca); }
                    catch (IllegalArgumentException e) {
                        errores.add("Fila " + (i+1) + ": Marca inválida: " + marca); continue;
                    }
                    vehiculoService.save(Vehiculo.builder().placa(placa).tipo(tipoVehiculo)
                            .marca(marcaEnum).color(color).anio(anio)
                            .idUsuario(clienteOpt.get()).build());
                    vehiculosRegistrados++;
                    cargados.add(Map.of("tipo","Vehículo","placa",placa,
                            "propietario",clienteOpt.get().getNombre()));
                } catch (Exception e) {
                    errores.add("Fila " + (i+1) + " (Vehículo): " + e.getMessage());
                }
            }

            workbook.close();

            Map<String, Object> response = new HashMap<>();
            response.put("mensaje",              "Carga masiva completada");
            response.put("clientesRegistrados",  clientesRegistrados);
            response.put("vehiculosRegistrados", vehiculosRegistrados);
            response.put("totalRegistros",       clientesRegistrados + vehiculosRegistrados);
            response.put("registrosCargados",    cargados);
            response.put("errores",              errores);
            response.put("tieneErrores",         !errores.isEmpty());
            return ResponseEntity.ok(response);
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Error procesando archivo Excel."));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // =========================================================
    // BUSCAR POR PLACA
    // =========================================================

    @GetMapping("/buscar-por-placa/{placa}")
    public ResponseEntity<?> buscarPorPlaca(@PathVariable String placa) {
        try {
            Optional<Vehiculo> vehiculoOpt = vehiculoService.findByPlaca(placa.toUpperCase().trim());
            if (vehiculoOpt.isEmpty()) return ResponseEntity.ok(
                    Map.of("encontrado", false, "mensaje", "Vehículo no registrado"));
            Vehiculo vehiculo = vehiculoOpt.get();
            Usuario  cliente  = vehiculo.getIdUsuario();
            return ResponseEntity.ok(Map.of(
                    "encontrado", true,
                    "vehiculo", Map.of(
                            "id",    vehiculo.getIdVehiculo(),
                            "placa", vehiculo.getPlaca(),
                            "tipo",  vehiculo.getTipo().toString(),
                            "marca", vehiculo.getMarca().toString(),
                            "color", vehiculo.getColor(),
                            "anio",  vehiculo.getAnio()),
                    "cliente", Map.of(
                            "id",       cliente.getIdUsuario(),
                            "nombre",   cliente.getNombre(),
                            "telefono", cliente.getTelefono(),
                            "email",    cliente.getCorreo(),
                            "cedula",   cliente.getCedula())
            ));
        } catch (Exception e) {
            log.error("Error al buscar placa {}: {}", placa, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // =========================================================
    // CONFIGURACIÓN DE SEDE
    // =========================================================

    @GetMapping("/mi-configuracion")
    public ResponseEntity<?> getMiConfiguracion(HttpServletRequest request) {
        try {
            Sede sede = getSedeActiva(request);  // ✅
            if (sede == null) return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "No se encontró la sede del usuario autenticado"));
            return ResponseEntity.ok(SedeDTO.fromEntity(sede));
        } catch (Exception e) {
            log.error("Error al obtener configuración: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping(value = "/mi-configuracion", consumes = "multipart/form-data")
    public ResponseEntity<?> updateMiConfiguracion(
            @RequestParam(required = false) String nombre,
            @RequestParam(required = false) String direccion,
            @RequestParam(required = false) String telefonoSede,
            @RequestParam(required = false) String correoSede,
            @RequestParam(required = false) String horarioSede,
            @RequestParam(required = false) Double tarifaPlenaC,
            @RequestParam(required = false) Double tarifaPlenaM,
            @RequestParam(required = false) Double tarifaMinutoC,
            @RequestParam(required = false) Double tarifaMinutoM,
            @RequestParam(required = false) Double tarifaHoraC,
            @RequestParam(required = false) Double tarifaHoraM,
            @RequestParam(required = false) Double tarifaPlenaB,
            @RequestParam(required = false) Double tarifaMinutoB,
            @RequestParam(required = false) Double tarifaHoraB,
            @RequestParam(required = false) Integer cuposCarro,
            @RequestParam(required = false) Integer cuposMoto,
            @RequestParam(required = false) Integer cuposBicicleta,
            @RequestParam(value = "imagen", required = false) MultipartFile imagen,
            HttpServletRequest request) {
        try {
            Sede sede = getSedeActiva(request);  // ✅
            if (sede == null) return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "No se encontró la sede del usuario autenticado"));

            if (nombre       != null && !nombre.isBlank())       sede.setNombre(nombre.trim());
            if (direccion    != null && !direccion.isBlank())    sede.setDireccion(direccion.trim());
            if (telefonoSede != null && !telefonoSede.isBlank()) sede.setTelefonoSede(telefonoSede.trim());
            if (correoSede   != null && !correoSede.isBlank())   sede.setCorreoSede(correoSede.trim());
            if (horarioSede  != null && !horarioSede.isBlank())  sede.setHorarioSede(horarioSede.trim());

            if (imagen != null && !imagen.isEmpty()) {
                String contentType = imagen.getContentType();
                if (contentType == null || !contentType.startsWith("image/"))
                    return ResponseEntity.badRequest().body(Map.of("error", "El archivo debe ser una imagen"));
                if (imagen.getSize() > 5 * 1024 * 1024)
                    return ResponseEntity.badRequest().body(Map.of("error", "La imagen no puede superar 5 MB"));
                String uploadDir = "uploads/sedes/" + sede.getIdSede();
                Path   uploadPath = Paths.get(uploadDir);
                Files.createDirectories(uploadPath);
                String ext      = obtenerExtension(imagen.getOriginalFilename());
                String fileName = "imagen_" + UUID.randomUUID() + ext;
                Path   filePath = uploadPath.resolve(fileName);
                if (sede.getImagenSede() != null) {
                    try { Files.deleteIfExists(Paths.get(sede.getImagenSede())); }
                    catch (Exception ignored) {}
                }
                Files.write(filePath, imagen.getBytes());
                sede.setImagenSede(uploadDir + "/" + fileName);
            }

            Sede updated = sedeService.save(sede);

            boolean hayTarifa = tarifaPlenaC != null || tarifaPlenaM != null
                    || tarifaMinutoC != null || tarifaMinutoM != null
                    || tarifaHoraC != null || tarifaHoraM != null
                    || tarifaPlenaB != null || tarifaMinutoB != null || tarifaHoraB != null;

            if (hayTarifa) {
                List<Tarifa> tarifas = tarifaService.findBySede_IdSede(updated.getIdSede());
                Tarifa tarifa = tarifas.isEmpty()
                        ? Tarifa.builder().tipoTarifa("GENERAL").sede(updated).build()
                        : tarifas.get(0);
                if (tarifaPlenaC  != null) tarifa.setTarifaPlenaC(tarifaPlenaC);
                if (tarifaPlenaM  != null) tarifa.setTarifaPlenaM(tarifaPlenaM);
                if (tarifaMinutoC != null) tarifa.setTarifaMinutoC(tarifaMinutoC);
                if (tarifaMinutoM != null) tarifa.setTarifaMinutoM(tarifaMinutoM);
                if (tarifaHoraC   != null) tarifa.setTarifaHoraC(tarifaHoraC);
                if (tarifaHoraM   != null) tarifa.setTarifaHoraM(tarifaHoraM);
                if (tarifaPlenaB  != null) tarifa.setTarifaPlenaB(tarifaPlenaB);
                if (tarifaMinutoB != null) tarifa.setTarifaMinutoB(tarifaMinutoB);
                if (tarifaHoraB   != null) tarifa.setTarifaHoraB(tarifaHoraB);
                tarifaService.save(tarifa);
            }

            boolean hayCupos = cuposCarro != null || cuposMoto != null || cuposBicicleta != null;
            if (hayCupos) {
                List<Cupo> cupos = cupoService.findBySede_IdSede(updated.getIdSede());
                Cupo cupo = cupos.isEmpty()
                        ? Cupo.builder().codigo("CUPO-" + updated.getIdSede())
                        .estado(EstadoCupo.DISPONIBLE).sede(updated).build()
                        : cupos.get(0);
                if (cuposCarro     != null && cuposCarro     >= 0) cupo.setCuposCarro(cuposCarro);
                if (cuposMoto      != null && cuposMoto      >= 0) cupo.setCuposMoto(cuposMoto);
                if (cuposBicicleta != null && cuposBicicleta >= 0) cupo.setCuposBicicleta(cuposBicicleta);
                cupoService.save(cupo);
            }

            Map<String, Object> resultado = new LinkedHashMap<>();
            resultado.put("mensaje", "Configuración actualizada correctamente");
            resultado.put("sede",    SedeDTO.fromEntity(updated));
            return ResponseEntity.ok(resultado);
        } catch (Exception e) {
            log.error("Error al actualizar configuración: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/cambiar-contrasena")
    public ResponseEntity<Map<String, Object>> cambiarContrasena(
            @RequestBody Map<String, String> datos) {
        try {
            String contrasenaActual = datos.get("contrasenaActual");
            String contrasenaNueva  = datos.get("contrasenaNueva");
            String confirmar        = datos.get("confirmar");

            if (contrasenaActual == null || contrasenaActual.isBlank())
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "La contraseña actual es obligatoria"));
            if (contrasenaNueva == null || contrasenaNueva.length() < 8)
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "La nueva contraseña debe tener al menos 8 caracteres"));
            if (!contrasenaNueva.equals(confirmar))
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Las contraseñas nuevas no coinciden"));

            Usuario admin = getUsuarioAutenticado();
            if (!passwordEncoder.matches(contrasenaActual, admin.getContrasena()))
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "La contraseña actual es incorrecta"));
            if (passwordEncoder.matches(contrasenaNueva, admin.getContrasena()))
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "La nueva contraseña no puede ser igual a la actual"));

            admin.setContrasena(passwordEncoder.encode(contrasenaNueva));
            usuarioService.save(admin);
            log.info("Contraseña cambiada para admin id={}", admin.getIdUsuario());
            return ResponseEntity.ok(Map.of("mensaje", "Contraseña actualizada correctamente"));
        } catch (Exception e) {
            log.error("Error al cambiar contraseña: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // =========================================================
    // GRÁFICAS
    // =========================================================

    @GetMapping("/graficas")
    public ResponseEntity<Map<String, Object>> getGraficas(
            @RequestParam(required = false) String desde,
            @RequestParam(required = false) String hasta,
            HttpServletRequest request) {
        try {
            Sede sede = getSedeActiva(request);  // ✅
            if (sede == null) return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "No se encontró una sede asignada"));

            LocalDateTime ahora      = LocalDateTime.now();
            LocalDateTime inicioHoy  = ahora.toLocalDate().atStartOfDay();
            LocalDateTime inicioMes  = ahora.toLocalDate().withDayOfMonth(1).atStartOfDay();
            LocalDateTime inicioAnio = ahora.toLocalDate().withDayOfYear(1).atStartOfDay();

            BigDecimal ingresosHoy  = registroEntradaSalidaService.sumIngresosEntreFechas(sede, inicioHoy,  inicioHoy.plusDays(1));
            BigDecimal ingresosMes  = registroEntradaSalidaService.sumIngresosEntreFechas(sede, inicioMes,  inicioMes.plusMonths(1));
            BigDecimal ingresosAnio = registroEntradaSalidaService.sumIngresosEntreFechas(sede, inicioAnio, inicioAnio.plusYears(1));

            LocalDateTime inicioRango, finRango;
            String periodoLabel;
            if (desde != null && !desde.isBlank() && hasta != null && !hasta.isBlank()) {
                inicioRango  = LocalDate.parse(desde).atStartOfDay();
                finRango     = LocalDate.parse(hasta).plusDays(1).atStartOfDay();
                periodoLabel = desde.equals(hasta) ? desde : desde + " → " + hasta;
            } else {
                inicioRango  = inicioHoy;
                finRango     = inicioHoy.plusDays(1);
                periodoLabel = "Hoy";
            }

            BigDecimal ingresosRango = registroEntradaSalidaService
                    .sumIngresosEntreFechas(sede, inicioRango, finRango);

            List<Map<String, Object>> serieRango = new ArrayList<>();
            long diasRango = ChronoUnit.DAYS.between(inicioRango.toLocalDate(), finRango.toLocalDate());
            if (diasRango >= 1 && diasRango <= 31) {
                LocalDate cursor = inicioRango.toLocalDate();
                LocalDate fin    = finRango.toLocalDate();
                while (cursor.isBefore(fin)) {
                    LocalDateTime diaInicio = cursor.atStartOfDay();
                    BigDecimal total = registroEntradaSalidaService
                            .sumIngresosEntreFechas(sede, diaInicio, diaInicio.plusDays(1));
                    Map<String, Object> punto = new LinkedHashMap<>();
                    punto.put("fecha",    cursor.toString());
                    punto.put("ingresos", total);
                    serieRango.add(punto);
                    cursor = cursor.plusDays(1);
                }
            }

            Map<String, Long> activosPorTipo = registroEntradaSalidaService.countActivosPorTipo(sede);

            List<Cupo> cupos = cupoService.findBySede_IdSede(sede.getIdSede());
            int cuposCarro = 0, cuposMoto = 0, cuposBicicleta = 0;
            if (!cupos.isEmpty()) {
                Cupo cupo   = cupos.get(0);
                cuposCarro     = cupo.getCuposCarro()     != null ? cupo.getCuposCarro()     : 0;
                cuposMoto      = cupo.getCuposMoto()      != null ? cupo.getCuposMoto()      : 0;
                cuposBicicleta = cupo.getCuposBicicleta() != null ? cupo.getCuposBicicleta() : 0;
            }
            if (cuposCarro == 0 && cuposMoto == 0 && cuposBicicleta == 0) {
                int cap    = sede.getCapacidad() != null ? sede.getCapacidad() : 0;
                cuposCarro     = (int) Math.round(cap * 0.60);
                cuposMoto      = (int) Math.round(cap * 0.30);
                cuposBicicleta = cap - cuposCarro - cuposMoto;
            }

            Map<String, Object> data = new LinkedHashMap<>();
            data.put("ingresosHoy",    ingresosHoy);
            data.put("ingresosMes",    ingresosMes);
            data.put("ingresosAnio",   ingresosAnio);
            data.put("ingresosRango",  ingresosRango);
            data.put("periodoLabel",   periodoLabel);
            data.put("serieRango",     serieRango);
            data.put("ocupacion", Map.of(
                    "carro",     Map.of("activos", activosPorTipo.getOrDefault("CARRO",     0L), "capacidad", cuposCarro),
                    "moto",      Map.of("activos", activosPorTipo.getOrDefault("MOTO",      0L), "capacidad", cuposMoto),
                    "bicicleta", Map.of("activos", activosPorTipo.getOrDefault("BICICLETA", 0L), "capacidad", cuposBicicleta)
            ));
            data.put("sedeNombre",     sede.getNombre());
            data.put("imagenSede",     sede.getImagenSede());
            data.put("capacidadTotal", sede.getCapacidad());
            return ResponseEntity.ok(data);
        } catch (Exception e) {
            log.error("Error al cargar gráficas: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // =========================================================
    // REPORTES ESTADÍSTICOS
    // =========================================================

    @GetMapping("/reporte/estadistico/pdf")
    public ResponseEntity<byte[]> getReporteEstadisticoPdf(
            @RequestParam String desde,
            @RequestParam String hasta,
            HttpServletRequest request) {
        try {
            Sede sede = getSedeActiva(request);  // ✅
            if (sede == null) return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("No se encontró la sede".getBytes());
            LocalDateTime inicio = LocalDate.parse(desde).atStartOfDay();
            LocalDateTime fin    = LocalDate.parse(hasta).plusDays(1).atStartOfDay();
            BigDecimal ingresos  = registroEntradaSalidaService.sumIngresosEntreFechas(sede, inicio, fin);
            List<RegistroEntradaSalida> registros =
                    registroEntradaSalidaService.findBySedeAndFechaBetween(sede, inicio, fin);
            ByteArrayOutputStream baos = reporteService
                    .generarReporteEstadisticoPdf(sede, desde, hasta, ingresos, registros);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            headers.setContentDispositionFormData("attachment",
                    "reporte_estadistico_" + desde + "_" + hasta + ".pdf");
            return new ResponseEntity<>(baos.toByteArray(), headers, HttpStatus.OK);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(("Error: " + e.getMessage()).getBytes());
        }
    }

    @GetMapping("/reporte/estadistico/excel")
    public ResponseEntity<byte[]> getReporteEstadisticoExcel(
            @RequestParam String desde,
            @RequestParam String hasta,
            HttpServletRequest request) {
        try {
            Sede sede = getSedeActiva(request);  // ✅
            if (sede == null) return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("No se encontró la sede".getBytes());
            LocalDateTime inicio = LocalDate.parse(desde).atStartOfDay();
            LocalDateTime fin    = LocalDate.parse(hasta).plusDays(1).atStartOfDay();
            BigDecimal ingresos  = registroEntradaSalidaService.sumIngresosEntreFechas(sede, inicio, fin);
            List<RegistroEntradaSalida> registros =
                    registroEntradaSalidaService.findBySedeAndFechaBetween(sede, inicio, fin);
            ByteArrayOutputStream baos = reporteService
                    .generarReporteEstadisticoExcel(sede, desde, hasta, ingresos, registros);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            headers.setContentDispositionFormData("attachment",
                    "reporte_estadistico_" + desde + "_" + hasta + ".xlsx");
            return new ResponseEntity<>(baos.toByteArray(), headers, HttpStatus.OK);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(("Error: " + e.getMessage()).getBytes());
        }
    }
}