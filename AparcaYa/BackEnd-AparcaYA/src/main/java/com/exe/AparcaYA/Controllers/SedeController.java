package com.exe.AparcaYA.Controllers;

import com.exe.AparcaYA.Dto.SedeDTO;
import com.exe.AparcaYA.Dto.UsuarioDTO;
import com.exe.AparcaYA.Entity.*;
import com.exe.AparcaYA.Enum.*;
import com.exe.AparcaYA.Service.*;
import jakarta.mail.MessagingException;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
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
    // ✅ NUEVO: requerido por registrar-entrada y rechazar-reservacion
    private final CupoService                  cupoService;

    // =========================================================
    // MÉTODOS AUXILIARES
    // =========================================================

    private Usuario getUsuarioAutenticado() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String correo = authentication.getName();
        return usuarioService.findByCorreo(correo)
                .orElseThrow(() -> new RuntimeException("Usuario autenticado no encontrado"));
    }

    // ✅ NUEVO: necesario para todos los métodos operativos migrados
    private Sede getSedeDelUsuarioAutenticado() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            log.warn("No hay autenticación activa");
            return null;
        }
        Optional<Usuario> usuarioOpt = usuarioService.findByCorreo(auth.getName());
        if (usuarioOpt.isEmpty()) {
            log.error("No se encontró usuario con correo: {}", auth.getName());
            return null;
        }
        Usuario user = usuarioOpt.get();

        // OPERARIO → tiene sedeAsignada directamente
        if (user.getSedeAsignada() != null) {
            return user.getSedeAsignada();
        }

        // ADMINISTRADOR_SEDE → su sede se busca por idUsuario
        Sede sedePorAdmin = sedeService.findByIdUsuario(user.getIdUsuario());
        if (sedePorAdmin != null) {
            return sedePorAdmin;
        }

        log.error("El usuario {} no tiene sede asignada", user.getNombre());
        return null;
    }

    private double[] resolverTarifas(Sede sede, TipoVehiculo tipo) {
        boolean esCarro = (tipo == TipoVehiculo.CARRO);
        return new double[]{ esCarro ? sede.getTarifaPlenaC() : sede.getTarifaPlenaM(),
                esCarro ? sede.getTarifaMinutoC() : sede.getTarifaMinutoM() };
    }

    private double[] resolverTarifas(Sede sede, String tipoStr) {
        boolean esCarro = tipoStr.equalsIgnoreCase("CARRO") ||
                tipoStr.equalsIgnoreCase("AUTOMOVIL") || tipoStr.equalsIgnoreCase("AUTO");
        return new double[]{ esCarro ? sede.getTarifaPlenaC() : sede.getTarifaPlenaM(),
                esCarro ? sede.getTarifaMinutoC() : sede.getTarifaMinutoM() };
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
                if (DateUtil.isCellDateFormatted(cell)) return cell.getLocalDateTimeCellValue().toString();
                return String.valueOf((long) cell.getNumericCellValue());
            case BOOLEAN: return String.valueOf(cell.getBooleanCellValue());
            default:      return "";
        }
    }

    private void crearTarifasParaSede(Sede sede) {
        tarifaService.crearTarifasParaSede(sede);
    }

    // =========================================================
    // USUARIOS (CLIENTES)
    //
    // NOTA S-05: Este endpoint retorna todos los clientes del
    // sistema porque los clientes no tienen sede asignada en el
    // modelo actual. Cuando se implemente esa relación, filtrar
    // aquí por sedeAsignada del admin autenticado.
    // =========================================================

    @GetMapping("/usuarios")
    public ResponseEntity<List<UsuarioDTO>> getUsuarios() {
        try {
            List<UsuarioDTO> resultado = usuarioService.findByRolIn(List.of(Rolenum.CLIENTE))
                    .stream()
                    .map(UsuarioDTO::fromEntity)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(resultado);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new ArrayList<>());
        }
    }

    @GetMapping("/usuarios/{id}")
    public ResponseEntity<UsuarioDTO> getUsuarioById(@PathVariable Long id) {
        try {
            return usuarioService.findById(id)
                    .map(u -> ResponseEntity.ok(UsuarioDTO.fromEntity(u)))
                    .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            e.printStackTrace();
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
                if (datos.get("estado")   != null) {
                    usuario.setEstado(EstadoGeneral.valueOf(datos.get("estado").toUpperCase()));
                }
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
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // =========================================================
    // DELETE /api/sede/usuarios/{id}
    //
    // NOTA S-06: No se puede verificar que el cliente pertenezca
    // a esta sede porque los clientes no tienen sedeAsignada en
    // el modelo actual. Cuando se implemente esa relación,
    // agregar aquí: if (!cliente.getSedeAsignada().equals(sedeAdmin)) → 403.
    // =========================================================

    @DeleteMapping("/usuarios/{id}")
    public ResponseEntity<Map<String, Object>> deleteUsuario(@PathVariable Long id) {
        try {
            if (usuarioService.findById(id).isPresent()) {
                usuarioService.delete(id);
                return ResponseEntity.ok(Map.of("mensaje", "Usuario eliminado correctamente"));
            }
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/registrar-trabajador")
    public ResponseEntity<Map<String, Object>> registrarTrabajador(@RequestBody Map<String, String> datos) {
        try {
            if (datos.get("nombre") == null || datos.get("correo") == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Nombre y correo son requeridos"));
            }
            if (usuarioService.findByCorreo(datos.get("correo")).isPresent()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Ya existe un usuario con ese correo"));
            }

            Usuario admin     = getUsuarioAutenticado();
            Sede sedeDelAdmin = sedeService.findByIdUsuario(admin.getIdUsuario());

            if (sedeDelAdmin == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "El administrador no tiene una sede asignada."));
            }

            Usuario trabajador = new Usuario();
            trabajador.setNombre(datos.get("nombre"));
            trabajador.setCorreo(datos.get("correo"));
            trabajador.setTelefono(datos.get("telefono") != null ? datos.get("telefono") : "");
            trabajador.setCedula(datos.get("cedula")     != null ? datos.get("cedula")   : "");

            String contrasena = datos.get("contrasena");
            if (contrasena == null || contrasena.trim().length() < 8) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "La contraseña es obligatoria y debe tener al menos 8 caracteres"));
            }
            trabajador.setContrasena(passwordEncoder.encode(contrasena));
            trabajador.setRol(Rolenum.OPERARIO);
            trabajador.setEstado(EstadoGeneral.ACTIVO);
            trabajador.setTipoCliente(TipoCliente.NORMAL);
            trabajador.setMetodoPago(MetodoPago.EFECTIVO);
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
            resultado.put("mensaje",       "Trabajador registrado exitosamente en la sede: " + sedeDelAdmin.getNombre());

            return ResponseEntity.status(HttpStatus.CREATED).body(resultado);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Error al registrar trabajador: " + e.getMessage()));
        }
    }
    // =========================================================
// INDICADORES
// =========================================================

    @GetMapping("/indicadores")
    public ResponseEntity<Map<String, Object>> getIndicadores() {
        try {
            Sede sede = getSedeDelUsuarioAutenticado();
            if (sede == null) return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "No se encontró una sede asignada al usuario autenticado"));

            List<RegistroEntradaSalida> vehiculosActivos =
                    registroEntradaSalidaService.findBySedeAndEstado(sede, EstadoRegistro.ACTIVO);
            int ocupacionActual = vehiculosActivos.size();
            int capacidadTotal  = sede.getCapacidad();

            LocalDateTime inicioHoy = LocalDate.now().atStartOfDay();
            List<RegistroEntradaSalida> registrosHoy =
                    registroEntradaSalidaService.findBySedeAndFechaHoraEntradaBetween(
                            sede, inicioHoy, inicioHoy.plusDays(1));

            BigDecimal ingresosDia = registrosHoy.stream()
                    .filter(r -> r.getPrecio() != null && r.getEstado() == EstadoRegistro.COBRADO)
                    .map(RegistroEntradaSalida::getPrecio)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            long pendientesCobro = registrosHoy.stream()
                    .filter(r -> r.getEstado() == EstadoRegistro.FINALIZADO)
                    .count();

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
            indicadores.put("tarifaPlenaC",    sede.getTarifaPlenaC());
            indicadores.put("tarifaPlenaM",    sede.getTarifaPlenaM());
            indicadores.put("tarifaMinutoC",   sede.getTarifaMinutoC());
            indicadores.put("tarifaMinutoM",   sede.getTarifaMinutoM());

            return ResponseEntity.ok(indicadores);
        } catch (Exception e) {
            log.error("Error al cargar indicadores: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // =========================================================
    // SEDES (SOLO LA SEDE DEL ADMINISTRADOR)
    // =========================================================

    @GetMapping("/sedes")
    public ResponseEntity<List<SedeDTO>> getSedes() {
        try {
            Usuario admin = getUsuarioAutenticado();
            List<SedeDTO> resultado = new ArrayList<>();
            if (admin.getSedeAsignada() != null) {
                resultado.add(SedeDTO.fromEntity(admin.getSedeAsignada()));
            }
            return ResponseEntity.ok(resultado);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new ArrayList<>());
        }
    }

    @GetMapping("/sedes/{id}")
    public ResponseEntity<SedeDTO> getSedeById(@PathVariable Long id) {
        try {
            Usuario admin = getUsuarioAutenticado();
            if (admin.getSedeAsignada() == null || !admin.getSedeAsignada().getIdSede().equals(id)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
            return sedeService.findById(id)
                    .map(s -> ResponseEntity.ok(SedeDTO.fromEntity(s)))
                    .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/sedes")
    public ResponseEntity<Map<String, Object>> createSede(@RequestBody Map<String, Object> datos) {
        try {
            Sede sede = new Sede();
            if (datos.get("nombre")        != null) sede.setNombre((String) datos.get("nombre"));
            if (datos.get("direccion")     != null) sede.setDireccion((String) datos.get("direccion"));
            if (datos.get("capacidad")     != null) sede.setCapacidad(Integer.parseInt(datos.get("capacidad").toString()));
            if (datos.get("tarifaPlenaC")  != null) sede.setTarifaPlenaC(Double.parseDouble(datos.get("tarifaPlenaC").toString()));
            if (datos.get("tarifaPlenaM")  != null) sede.setTarifaPlenaM(Double.parseDouble(datos.get("tarifaPlenaM").toString()));
            if (datos.get("tarifaMinutoC") != null) sede.setTarifaMinutoC(Double.parseDouble(datos.get("tarifaMinutoC").toString()));
            if (datos.get("tarifaMinutoM") != null) sede.setTarifaMinutoM(Double.parseDouble(datos.get("tarifaMinutoM").toString()));
            sede.setEstado(EstadoGeneral.ACTIVO);
            sede.setFechaCreacion(LocalDateTime.now());

            Sede saved       = sedeService.save(sede);
            crearTarifasParaSede(saved);
            SedeDTO savedDTO = SedeDTO.fromEntity(saved);

            Map<String, Object> resultado = new LinkedHashMap<>();
            resultado.put("id",            savedDTO.getId());
            resultado.put("nombre",        savedDTO.getNombre());
            resultado.put("direccion",     savedDTO.getDireccion());
            resultado.put("capacidad",     savedDTO.getCapacidad());
            resultado.put("tarifaPlenaC",  savedDTO.getTarifaPlenaC());
            resultado.put("tarifaPlenaM",  savedDTO.getTarifaPlenaM());
            resultado.put("tarifaMinutoC", savedDTO.getTarifaMinutoC());
            resultado.put("tarifaMinutoM", savedDTO.getTarifaMinutoM());
            resultado.put("estado",        savedDTO.getEstado());
            resultado.put("mensaje",       "Sede creada correctamente");
            return ResponseEntity.status(HttpStatus.CREATED).body(resultado);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/sedes/{id}")
    public ResponseEntity<Map<String, Object>> updateSede(
            @PathVariable Long id,
            @RequestBody Map<String, Object> datos) {
        try {
            Usuario admin = getUsuarioAutenticado();
            if (admin.getSedeAsignada() == null || !admin.getSedeAsignada().getIdSede().equals(id)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "No tiene permisos para modificar esta sede"));
            }

            Optional<Sede> existing = sedeService.findById(id);
            if (existing.isPresent()) {
                Sede sede = existing.get();
                if (datos.get("nombre")        != null) sede.setNombre((String) datos.get("nombre"));
                if (datos.get("direccion")     != null) sede.setDireccion((String) datos.get("direccion"));
                if (datos.get("capacidad")     != null) sede.setCapacidad(Integer.parseInt(datos.get("capacidad").toString()));
                if (datos.get("tarifaPlenaC")  != null) sede.setTarifaPlenaC(Double.parseDouble(datos.get("tarifaPlenaC").toString()));
                if (datos.get("tarifaPlenaM")  != null) sede.setTarifaPlenaM(Double.parseDouble(datos.get("tarifaPlenaM").toString()));
                if (datos.get("tarifaMinutoC") != null) sede.setTarifaMinutoC(Double.parseDouble(datos.get("tarifaMinutoC").toString()));
                if (datos.get("tarifaMinutoM") != null) sede.setTarifaMinutoM(Double.parseDouble(datos.get("tarifaMinutoM").toString()));
                if (datos.get("estado")        != null) sede.setEstado(EstadoGeneral.valueOf(datos.get("estado").toString().toUpperCase()));

                Sede updated       = sedeService.save(sede);
                SedeDTO updatedDTO = SedeDTO.fromEntity(updated);

                Map<String, Object> resultado = new LinkedHashMap<>();
                resultado.put("id",            updatedDTO.getId());
                resultado.put("nombre",        updatedDTO.getNombre());
                resultado.put("direccion",     updatedDTO.getDireccion());
                resultado.put("capacidad",     updatedDTO.getCapacidad());
                resultado.put("tarifaPlenaC",  updatedDTO.getTarifaPlenaC());
                resultado.put("tarifaPlenaM",  updatedDTO.getTarifaPlenaM());
                resultado.put("tarifaMinutoC", updatedDTO.getTarifaMinutoC());
                resultado.put("tarifaMinutoM", updatedDTO.getTarifaMinutoM());
                resultado.put("estado",        updatedDTO.getEstado());
                resultado.put("mensaje",       "Sede actualizada correctamente");
                return ResponseEntity.ok(resultado);
            }
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/sedes/{id}")
    public ResponseEntity<Map<String, Object>> deleteSede(@PathVariable Long id) {
        try {
            Usuario admin = getUsuarioAutenticado();
            if (admin.getSedeAsignada() == null || !admin.getSedeAsignada().getIdSede().equals(id)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "No tiene permisos para eliminar esta sede"));
            }
            if (sedeService.findById(id).isPresent()) {
                sedeService.delete(id);
                return ResponseEntity.ok(Map.of("mensaje", "Sede eliminada correctamente"));
            }
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // =========================================================
    // CORREOS
    //
    // ✅ FIX S-04: Implementados — antes eran stubs en el JS que
    // mostraban "función en desarrollo" sin llamar al backend.
    // Reutilizan IEmailService igual que AdminController.
    // =========================================================

    @PostMapping("/correo/unitario")
    public ResponseEntity<Map<String, String>> enviarCorreoUnitario(
            @RequestParam String correo,
            @RequestParam String asunto,
            @RequestParam String mensaje) {
        try {
            emailService.enviarCorreoUnitario(correo, asunto, mensaje);
            return ResponseEntity.ok(Map.of(
                    "status",  "success",
                    "message", "Correo enviado correctamente a " + correo
            ));
        } catch (MessagingException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                    "status",  "error",
                    "message", "Error al enviar el correo: " + e.getMessage()
            ));
        }
    }

    @PostMapping("/correo/masivo")
    public ResponseEntity<Map<String, String>> enviarCorreoMasivo(
            @RequestParam(name = "seleccionados", required = false) List<String> seleccionados,
            @RequestParam String asunto,
            @RequestParam String mensaje) {
        if (seleccionados == null || seleccionados.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "status",  "error",
                    "message", "No se seleccionó ningún correo."
            ));
        }
        try {
            emailService.enviarCorreoMasivo(seleccionados, asunto, mensaje);
            return ResponseEntity.ok(Map.of(
                    "status",  "success",
                    "message", "Correos enviados correctamente a " + seleccionados.size() + " destinatarios"
            ));
        } catch (MessagingException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                    "status",  "error",
                    "message", "No fue posible enviar la notificación: " + e.getMessage()
            ));
        }
    }

    // =========================================================
    // REPORTES PDF Y EXCEL
    // =========================================================

    @GetMapping("/reporte/usuarios/pdf")
    public ResponseEntity<byte[]> generarReportePDF() {
        try {
            List<Usuario> usuarios = usuarioService.findByRolIn(List.of(Rolenum.CLIENTE));
            if (usuarios.isEmpty()) return ResponseEntity.status(HttpStatus.NO_CONTENT).body(null);

            ByteArrayOutputStream baos = reporteService.generarReportePDF(usuarios);
            String filename = "reporte_clientes_AparcaYA_" +
                    LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss")) + ".pdf";
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            headers.setContentDispositionFormData("attachment", filename);
            headers.setCacheControl("must-revalidate, post-check=0, pre-check=0");
            return new ResponseEntity<>(baos.toByteArray(), headers, HttpStatus.OK);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(("Error al generar el PDF: " + e.getMessage()).getBytes());
        }
    }

    @GetMapping("/reporte/usuarios/excel")
    public ResponseEntity<byte[]> generarReporteExcelUsuarios() {
        try {
            List<Usuario> usuarios = usuarioService.findByRolIn(List.of(Rolenum.CLIENTE));
            if (usuarios.isEmpty()) return ResponseEntity.status(HttpStatus.NO_CONTENT).body(null);

            ByteArrayOutputStream baos = reporteService.generarReporteExcel(usuarios);
            String filename = "reporte_clientes_AparcaYA_" +
                    LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss")) + ".xlsx";
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            headers.setContentDispositionFormData("attachment", filename);
            headers.setCacheControl("must-revalidate, post-check=0, pre-check=0");
            return new ResponseEntity<>(baos.toByteArray(), headers, HttpStatus.OK);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(("Error al generar el Excel: " + e.getMessage()).getBytes());
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
    public void generarExcelSedes(HttpServletResponse response) throws IOException {
        response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setHeader("Content-Disposition", "attachment; filename=mi_sede.xlsx");
        try {
            Usuario admin = getUsuarioAutenticado();
            List<Sede> sedes = new ArrayList<>();
            if (admin.getSedeAsignada() != null) sedes.add(admin.getSedeAsignada());
            ByteArrayOutputStream baos = reporteService.generarReporteExcelSedes(sedes);
            response.getOutputStream().write(baos.toByteArray());
        } catch (Exception e) { e.printStackTrace(); }
    }

    // =========================================================
    // ESTADÍSTICAS (original del SedeController — sin cambios)
    // =========================================================

    @GetMapping("/estadisticas")
    public ResponseEntity<Map<String, Object>> getEstadisticas() {
        try {
            Usuario admin = getUsuarioAutenticado();
            List<Sede> sedes = new ArrayList<>();
            if (admin.getSedeAsignada() != null) sedes.add(admin.getSedeAsignada());

            long totalClientes     = usuarioService.contarTotal();
            long usuariosActivos   = usuarioService.contarActivos();
            long usuariosInactivos = totalClientes - usuariosActivos;
            long sedesActivas      = sedeService.contarActivas();
            int  capacidadTotal    = sedes.stream()
                    .filter(s -> s.getCapacidad() != null)
                    .mapToInt(Sede::getCapacidad)
                    .sum();

            Map<String, Object> stats = new LinkedHashMap<>();
            stats.put("totalUsuarios",     totalClientes);
            stats.put("totalClientes",     totalClientes);
            stats.put("usuariosActivos",   usuariosActivos);
            stats.put("usuariosInactivos", usuariosInactivos);
            stats.put("totalSedes",        sedes.size());
            stats.put("sedesActivas",      sedesActivas);
            stats.put("capacidadTotal",    capacidadTotal);
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // =========================================================
    // ▼▼▼ MÉTODOS OPERATIVOS — copiados desde TrabajadorController ▼▼▼
    // Rol: ADMINISTRADOR_SEDE (hereda @PreAuthorize de clase)
    // Rutas: /api/sede/* (separadas de /api/trabajador/*)
    // =========================================================

    // =========================================================
    // VEHÍCULOS ACTIVOS
    // =========================================================

    @GetMapping("/vehiculos-activos")
    public ResponseEntity<?> getVehiculosActivos() {
        try {
            Sede sede = getSedeDelUsuarioAutenticado();
            if (sede == null) return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "No se encontró una sede asignada al usuario autenticado"));
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
                double[] tarifas = resolverTarifas(sede, registro.getVehiculo().getTipo());
                long minutosTranscurridos = duracion.toMinutes();
                v.put("cobroEstimadoPlena",  BigDecimal.valueOf(tarifas[0]).setScale(2, RoundingMode.HALF_UP));
                v.put("cobroEstimadoMinuto", BigDecimal.valueOf(minutosTranscurridos * tarifas[1]).setScale(2, RoundingMode.HALF_UP));
                v.put("cupo", registro.getCupo() != null ? registro.getCupo().getCodigo() : "Sin asignar");
                return v;
            }).collect(Collectors.toList());

            return ResponseEntity.ok(vehiculos);
        } catch (Exception e) {
            log.error("Error al cargar vehículos activos: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    // =========================================================
    // VEHÍCULOS PENDIENTES DE COBRO
    // =========================================================

    @GetMapping("/vehiculos-pendientes-cobro")
    public ResponseEntity<?> getVehiculosPendientesCobro() {
        try {
            Sede sede = getSedeDelUsuarioAutenticado();
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
                Duration duracion = Duration.between(registro.getFechaHoraEntrada(), registro.getFechaHoraSalida());
                v.put("tiempoTotal", formatearTiempo(duracion));
                v.put("precio",      registro.getPrecio());
                return v;
            }).collect(Collectors.toList());

            return ResponseEntity.ok(vehiculos);
        } catch (Exception e) {
            log.error("Error al cargar pendientes: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    // =========================================================
    // HISTORIAL
    // =========================================================

    @GetMapping("/historial")
    public ResponseEntity<?> getHistorial(
            @RequestParam(required = false) String fecha,
            @RequestParam(required = false) String estado) {
        try {
            Sede sede = getSedeDelUsuarioAutenticado();
            if (sede == null) return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "No se encontró una sede asignada al usuario autenticado"));
            List<RegistroEntradaSalida> registros =
                    registroEntradaSalidaService.findHistorialBySede(sede);

            if (fecha  != null && !fecha.isEmpty())  registros = registros.stream().filter(r -> r.getFechaHoraEntrada().toLocalDate().equals(LocalDate.parse(fecha))).collect(Collectors.toList());
            if (estado != null && !estado.isEmpty()) registros = registros.stream().filter(r -> r.getEstado() == EstadoRegistro.valueOf(estado.toUpperCase())).collect(Collectors.toList());

            List<Map<String, Object>> historial = registros.stream().map(registro -> {
                Map<String, Object> item = new HashMap<>();
                item.put("registroId",   registro.getIdRegistro());
                item.put("placa",        registro.getVehiculo().getPlaca());
                item.put("tipoVehiculo", registro.getVehiculo().getTipo().toString());
                item.put("marca",        registro.getVehiculo().getMarca().toString());
                item.put("horaEntrada",  registro.getFechaHoraEntrada().toString());
                item.put("horaSalida",   registro.getFechaHoraSalida() != null ? registro.getFechaHoraSalida().toString() : null);
                item.put("estado",       registro.getEstado().toString());
                item.put("precio",       registro.getPrecio());
                item.put("metodoPago",   registro.getMetodoPago());
                Usuario cliente = registro.getVehiculo().getIdUsuario();
                item.put("clienteNombre",   cliente.getNombre());
                item.put("clienteTelefono", cliente.getTelefono());
                item.put("clienteEmail",    cliente.getCorreo());
                Duration duracion = registro.getFechaHoraSalida() != null
                        ? Duration.between(registro.getFechaHoraEntrada(), registro.getFechaHoraSalida())
                        : Duration.between(registro.getFechaHoraEntrada(), LocalDateTime.now());
                item.put("tiempoTotal", formatearTiempo(duracion) + (registro.getFechaHoraSalida() != null ? "" : " (en curso)"));
                return item;
            }).collect(Collectors.toList());

            return ResponseEntity.ok(historial);
        } catch (Exception e) {
            log.error("Error al cargar historial: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    // =========================================================
    // REGISTRAR ENTRADA
    // =========================================================

    @PostMapping("/registrar-entrada")
    public ResponseEntity<Map<String, Object>> registrarEntrada(@RequestBody Map<String, String> datos) {
        try {
            Sede sede          = getSedeDelUsuarioAutenticado();
            Usuario trabajador = getUsuarioAutenticado();

            List<RegistroEntradaSalida> vehiculosActivos = registroEntradaSalidaService.findBySedeAndEstado(sede, EstadoRegistro.ACTIVO);
            if (vehiculosActivos.size() >= sede.getCapacidad()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Parqueadero lleno. No hay cupos disponibles."));
            }

            String correo   = datos.get("clienteEmail");
            String nombre   = datos.get("clienteNombre");
            String telefono = datos.get("clienteTelefono");
            String cedula   = datos.getOrDefault("clienteCedula", "");

            Usuario cliente = usuarioService.findByCorreo(correo).orElseGet(() -> {
                Usuario nuevoCliente = new Usuario();
                nuevoCliente.setNombre(nombre); nuevoCliente.setTelefono(telefono);
                nuevoCliente.setCorreo(correo);
                nuevoCliente.setCedula(cedula.isEmpty() ? "0000000000" : cedula);
                nuevoCliente.setContrasena(passwordEncoder.encode(UUID.randomUUID().toString()));
                nuevoCliente.setRol(Rolenum.CLIENTE); nuevoCliente.setTipoCliente(TipoCliente.NORMAL);
                nuevoCliente.setMetodoPago(MetodoPago.EFECTIVO); nuevoCliente.setEstado(EstadoGeneral.ACTIVO);
                return usuarioService.save(nuevoCliente);
            });

            String placa        = datos.get("vehiculoPlaca").toUpperCase().trim();
            String tipoVehiculo = datos.getOrDefault("vehiculoTipo",  "CARRO");
            String marca        = datos.getOrDefault("vehiculoMarca", "OTRO");
            String color        = datos.getOrDefault("vehiculoColor", "NO ESPECIFICADO");
            String anioStr      = datos.getOrDefault("vehiculoAnio",  "2020");
            int anioResuelto;
            try {
                anioResuelto = Integer.parseInt(anioStr.isEmpty() ? "2020" : anioStr);
            } catch (NumberFormatException e) {
                anioResuelto = 2020;
            }
            final int anio = anioResuelto;

            Optional<Vehiculo> vehiculoExistente = vehiculoService.findByPlaca(placa);
            if (vehiculoExistente.isPresent()) {
                if (registroEntradaSalidaService.findVehiculoActivo(vehiculoExistente.get()).isPresent()) {
                    return ResponseEntity.badRequest().body(Map.of("error", "Este vehículo ya se encuentra en el parqueadero"));
                }
            }

            Vehiculo vehiculo = vehiculoService.findByPlaca(placa).orElseGet(() -> {
                Vehiculo v = new Vehiculo();
                v.setPlaca(placa); v.setTipo(TipoVehiculo.valueOf(tipoVehiculo.toUpperCase()));
                v.setMarca(Marca.valueOf(marca.toUpperCase())); v.setColor(color); v.setAnio(anio); v.setIdUsuario(cliente);
                return vehiculoService.save(v);
            });

            List<Cupo> cuposDisponibles = cupoService.findBySedeAndEstado(sede, EstadoCupo.DISPONIBLE);
            Cupo cupoAsignado = cuposDisponibles.isEmpty() ? null : cuposDisponibles.get(0);
            RegistroEntradaSalida registro = registroEntradaSalidaService.registrarEntrada(vehiculo, sede, cupoAsignado, trabajador);

            double[] tarifas = resolverTarifas(sede, tipoVehiculo);
            Map<String, Object> response = new HashMap<>();
            response.put("mensaje",      "Vehículo registrado exitosamente. Temporizador iniciado.");
            response.put("registroId",   registro.getIdRegistro());
            response.put("placa",        placa);
            response.put("clienteNombre",cliente.getNombre());
            response.put("horaEntrada",  registro.getFechaHoraEntrada().toString());
            response.put("cupo",         cupoAsignado != null ? cupoAsignado.getCodigo() : "Sin asignar");
            response.put("tarifaPlena",  tarifas[0]);
            response.put("tarifaMinuto", tarifas[1]);

            log.info("Entrada registrada: placa={} sede={}", placa, sede.getNombre());
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (Exception e) {
            log.error("Error al registrar entrada: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    // =========================================================
    // REGISTRAR SALIDA
    //
    // ✅ FIX O-05: Verifica que el registro pertenezca a la sede
    // del usuario autenticado antes de procesar la salida.
    // =========================================================

    @PostMapping("/registrar-salida/{registroId}")
    public ResponseEntity<Map<String, Object>> registrarSalida(@PathVariable Long registroId) {
        try {
            Sede sede = getSedeDelUsuarioAutenticado();

            RegistroEntradaSalida registroExistente = registroEntradaSalidaService.findById(registroId)
                    .orElseThrow(() -> new RuntimeException("Registro no encontrado"));

            if (!registroExistente.getSede().getIdSede().equals(sede.getIdSede())) {
                log.warn("Usuario de sede {} intentó registrar salida de registro {} (sede {})",
                        sede.getIdSede(), registroId, registroExistente.getSede().getIdSede());
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "No tiene permisos para operar sobre este registro"));
            }

            RegistroEntradaSalida registro = registroEntradaSalidaService.registrarSalida(registroId);
            Duration duracion = Duration.between(registro.getFechaHoraEntrada(), registro.getFechaHoraSalida());

            Map<String, Object> response = new HashMap<>();
            response.put("mensaje",      "Salida registrada. Pendiente de cobro.");
            response.put("registroId",   registro.getIdRegistro());
            response.put("placa",        registro.getVehiculo().getPlaca());
            response.put("clienteNombre",registro.getVehiculo().getIdUsuario().getNombre());
            response.put("horaEntrada",  registro.getFechaHoraEntrada().toString());
            response.put("horaSalida",   registro.getFechaHoraSalida().toString());
            response.put("precio",       registro.getPrecio());
            response.put("tiempoTotal",  formatearTiempo(duracion));

            log.info("Salida registrada: registroId={}", registroId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error al registrar salida {}: {}", registroId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    // =========================================================
    // CONFIRMAR COBRO
    //
    // ✅ FIX O-05: Verifica ownership de sede antes de cobrar.
    // =========================================================

    @PostMapping("/confirmar-cobro/{registroId}")
    public ResponseEntity<Map<String, Object>> confirmarCobro(
            @PathVariable Long registroId,
            @RequestBody Map<String, String> datos) {
        try {
            Sede sede = getSedeDelUsuarioAutenticado();

            RegistroEntradaSalida registroExistente = registroEntradaSalidaService.findById(registroId)
                    .orElseThrow(() -> new RuntimeException("Registro no encontrado"));

            if (!registroExistente.getSede().getIdSede().equals(sede.getIdSede())) {
                log.warn("Usuario de sede {} intentó cobrar registro {} (sede {})",
                        sede.getIdSede(), registroId, registroExistente.getSede().getIdSede());
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "No tiene permisos para operar sobre este registro"));
            }

            String metodoPago = datos.getOrDefault("metodoPago", "EFECTIVO");
            String tipoTarifa = datos.getOrDefault("tipoTarifa", "MINUTO");

            if (!tipoTarifa.equalsIgnoreCase("PLENA") && !tipoTarifa.equalsIgnoreCase("MINUTO")) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Tipo de tarifa inválido. Debe ser 'PLENA' o 'MINUTO'"));
            }

            RegistroEntradaSalida registro = registroEntradaSalidaService.confirmarCobroConTarifa(registroId, metodoPago, tipoTarifa);

            Map<String, Object> response = new HashMap<>();
            response.put("mensaje",            "Cobro confirmado exitosamente");
            response.put("registroId",         registro.getIdRegistro());
            response.put("placa",              registro.getVehiculo().getPlaca());
            response.put("precio",             registro.getPrecio());
            response.put("metodoPago",         registro.getMetodoPago());
            response.put("tipoTarifaAplicada", tipoTarifa);
            response.put("estado",             registro.getEstado().toString());

            log.info("Cobro confirmado: registroId={} precio={} tarifa={}", registroId, registro.getPrecio(), tipoTarifa);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error al confirmar cobro {}: {}", registroId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    // =========================================================
    // OPCIONES DE COBRO
    //
    // ✅ FIX O-05: Verifica ownership de sede.
    // =========================================================

    @GetMapping("/opciones-cobro/{registroId}")
    public ResponseEntity<?> getOpcionesCobro(@PathVariable Long registroId) {
        try {
            Sede sede = getSedeDelUsuarioAutenticado();

            RegistroEntradaSalida registro = registroEntradaSalidaService.findById(registroId)
                    .orElseThrow(() -> new RuntimeException("Registro no encontrado"));

            if (!registro.getSede().getIdSede().equals(sede.getIdSede())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "No tiene permisos para ver este registro"));
            }

            if (registro.getEstado() != EstadoRegistro.FINALIZADO) {
                return ResponseEntity.badRequest().body(Map.of("error", "El registro no está pendiente de cobro"));
            }

            Duration duracion = Duration.between(registro.getFechaHoraEntrada(), registro.getFechaHoraSalida());
            long minutosTranscurridos = duracion.toMinutes();
            double[] tarifas = resolverTarifas(sede, registro.getVehiculo().getTipo());

            BigDecimal precioMinuto = BigDecimal.valueOf(minutosTranscurridos * tarifas[1]).setScale(2, RoundingMode.HALF_UP);
            long horas = duracion.toHours(), minutos = duracion.toMinutes() % 60;

            Map<String, Object> opcionPlena  = Map.of("tipo","PLENA", "nombre","Tarifa Plena (Día Completo)", "precio",tarifas[0], "descripcion","Tarifa fija del día");
            Map<String, Object> opcionMinuto = Map.of("tipo","MINUTO","nombre","Tarifa por Minuto",            "precio",precioMinuto,"descripcion",minutosTranscurridos + " minutos × $" + (int)tarifas[1] + "/min");

            Map<String, Object> response = new HashMap<>();
            response.put("registroId",           registroId);
            response.put("placa",                registro.getVehiculo().getPlaca());
            response.put("clienteNombre",        registro.getVehiculo().getIdUsuario().getNombre());
            response.put("tipoVehiculo",         registro.getVehiculo().getTipo().toString());
            response.put("horaEntrada",          registro.getFechaHoraEntrada().toString());
            response.put("horaSalida",           registro.getFechaHoraSalida().toString());
            response.put("minutosTranscurridos", minutosTranscurridos);
            response.put("tiempoTotal",          horas > 0 ? horas + "h " + minutos + "m" : minutos + "m");
            response.put("opciones",             List.of(opcionPlena, opcionMinuto));

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error al obtener opciones de cobro {}: {}", registroId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    // =========================================================
    // RESERVACIONES
    // =========================================================

    @GetMapping("/reservaciones")
    public ResponseEntity<?> getReservaciones() {
        try {
            Sede sede = getSedeDelUsuarioAutenticado();

            List<Map<String, Object>> reservas = reservacionService.findAll().stream()
                    .filter(r -> r.getCupo() != null
                            && r.getCupo().getSede() != null
                            && r.getCupo().getSede().getIdSede().equals(sede.getIdSede()))
                    .filter(r -> r.getEstado() == EstadoReservacion.PENDIENTE)
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
                        return r;
                    }).collect(Collectors.toList());

            return ResponseEntity.ok(reservas);
        } catch (Exception e) {
            log.error("Error al cargar reservaciones: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    // =========================================================
    // ACEPTAR RESERVACIÓN
    //
    // ✅ FIX O-04: Verifica que la reservación pertenezca a la sede
    // del usuario autenticado antes de aceptarla.
    // =========================================================

    @PostMapping("/aceptar-reservacion/{reservacionId}")
    public ResponseEntity<Map<String, Object>> aceptarReservacion(@PathVariable Long reservacionId) {
        try {
            Sede sede          = getSedeDelUsuarioAutenticado();
            Usuario trabajador = getUsuarioAutenticado();

            Reservacion reservacion = reservacionService.findById(reservacionId)
                    .orElseThrow(() -> new RuntimeException("Reservación no encontrada"));

            if (!reservacion.getCupo().getSede().getIdSede().equals(sede.getIdSede())) {
                log.warn("Usuario de sede {} intentó aceptar reservación {} (sede {})",
                        sede.getIdSede(), reservacionId, reservacion.getCupo().getSede().getIdSede());
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "No tiene permisos para operar sobre esta reservación"));
            }

            reservacion.setEstado(EstadoReservacion.ACTIVA);
            reservacionService.save(reservacion);

            RegistroEntradaSalida registro = registroEntradaSalidaService.registrarEntrada(
                    reservacion.getVehiculo(), sede, reservacion.getCupo(), trabajador);

            Map<String, Object> response = new HashMap<>();
            response.put("mensaje",      "Reservación aceptada y vehículo registrado");
            response.put("reservacionId",reservacionId);
            response.put("registroId",   registro.getIdRegistro());
            response.put("placa",        reservacion.getVehiculo().getPlaca());
            response.put("clienteNombre",reservacion.getCliente().getNombre());
            response.put("horaEntrada",  registro.getFechaHoraEntrada().toString());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error al aceptar reservacion {}: {}", reservacionId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    // =========================================================
    // RECHAZAR RESERVACIÓN
    //
    // ✅ FIX O-04: Verifica ownership de sede antes de rechazar.
    // =========================================================

    @PostMapping("/rechazar-reservacion/{reservacionId}")
    public ResponseEntity<Map<String, Object>> rechazarReservacion(@PathVariable Long reservacionId) {
        try {
            Sede sede = getSedeDelUsuarioAutenticado();

            Reservacion reservacion = reservacionService.findById(reservacionId)
                    .orElseThrow(() -> new RuntimeException("Reservación no encontrada"));

            if (!reservacion.getCupo().getSede().getIdSede().equals(sede.getIdSede())) {
                log.warn("Usuario de sede {} intentó rechazar reservación {} (sede {})",
                        sede.getIdSede(), reservacionId, reservacion.getCupo().getSede().getIdSede());
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "No tiene permisos para operar sobre esta reservación"));
            }

            reservacion.setEstado(EstadoReservacion.CANCELADA);
            reservacionService.save(reservacion);

            Cupo cupo = reservacion.getCupo();
            cupo.setEstado(EstadoCupo.DISPONIBLE);
            cupoService.save(cupo);

            return ResponseEntity.ok(Map.of("mensaje", "Reservación rechazada", "reservacionId", reservacionId));
        } catch (Exception e) {
            log.error("Error al rechazar reservacion {}: {}", reservacionId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    // =========================================================
    // CARGA MASIVA DESDE EXCEL
    //
    // ✅ FIX O-06: Contraseña temporal reemplazada por UUID hasheado.
    // ✅ FIX O-07: Validación de tipo MIME agregada antes de parsear.
    // =========================================================

    private static final Set<String> MIME_EXCEL_PERMITIDOS = Set.of(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
            "application/octet-stream"
    );

    @PostMapping("/carga-masiva")
    public ResponseEntity<Map<String, Object>> cargaMasiva(@RequestParam("file") MultipartFile file) {
        log.info("Iniciando carga masiva: archivo={}", file.getOriginalFilename());

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Archivo vacío"));
        }

        String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        if (!originalFilename.endsWith(".xlsx") && !originalFilename.endsWith(".xls")) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Solo se aceptan archivos Excel (.xlsx o .xls)"));
        }
        String contentType = file.getContentType() != null ? file.getContentType() : "";
        if (!MIME_EXCEL_PERMITIDOS.contains(contentType)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Tipo de archivo no permitido"));
        }

        try {
            Sede sede = getSedeDelUsuarioAutenticado();
            Workbook workbook = new XSSFWorkbook(file.getInputStream());
            Sheet sheet = workbook.getSheetAt(0);

            int clientesRegistrados = 0, vehiculosRegistrados = 0;
            List<String> errores = new ArrayList<>();
            List<Map<String, Object>> cargados = new ArrayList<>();

            // PASADA 1: CLIENTES
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;
                try {
                    if (!"Cliente".equalsIgnoreCase(getCellValueAsString(row.getCell(0)))) continue;
                    String nombre   = getCellValueAsString(row.getCell(1));
                    String telefono = getCellValueAsString(row.getCell(2));
                    String email    = getCellValueAsString(row.getCell(3));
                    String cedula   = getCellValueAsString(row.getCell(4));
                    if (nombre.trim().isEmpty() || email.trim().isEmpty() || telefono.trim().isEmpty()) { errores.add("Fila " + (i+1) + ": Faltan datos obligatorios"); continue; }
                    if (usuarioService.findByCorreo(email.trim()).isPresent())   { errores.add("Fila " + (i+1) + ": Email "    + email    + " ya existe - OMITIDO");    continue; }
                    if (usuarioService.findByTelefono(telefono.trim()) != null) { errores.add("Fila " + (i+1) + ": Teléfono " + telefono + " ya registrado - OMITIDO"); continue; }
                    String cedulaFinal = cedula.trim().isEmpty() ? "0000000000" : cedula.trim();
                    if (usuarioService.findByCedula(cedulaFinal) != null)       { errores.add("Fila " + (i+1) + ": Cédula "   + cedulaFinal + " ya registrada - OMITIDO"); continue; }

                    usuarioService.save(Usuario.builder()
                            .nombre(nombre.trim()).correo(email.trim()).telefono(telefono.trim())
                            .cedula(cedulaFinal)
                            .contrasena(passwordEncoder.encode(UUID.randomUUID().toString()))
                            .rol(Rolenum.CLIENTE).tipoCliente(TipoCliente.NORMAL)
                            .metodoPago(MetodoPago.EFECTIVO).estado(EstadoGeneral.ACTIVO)
                            .descripcion("").build());
                    clientesRegistrados++;
                    cargados.add(Map.of("tipo","Cliente","nombre",nombre,"email",email,"telefono",telefono,"cedula",cedulaFinal));
                } catch (Exception e) { errores.add("Fila " + (i+1) + " (Cliente): " + e.getMessage()); }
            }

            // PASADA 2: VEHÍCULOS
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
                    if (placa.isEmpty() || emailCliente.isEmpty()) { errores.add("Fila " + (i+1) + ": Faltan placa o email"); continue; }
                    int anio = 2020; try { int p = Integer.parseInt(anioStr); if (p >= 1900 && p <= 2030) anio = p; } catch (NumberFormatException ignored) {}
                    Optional<Usuario> clienteOpt = usuarioService.findByCorreo(emailCliente);
                    if (clienteOpt.isEmpty()) { errores.add("Fila " + (i+1) + ": Cliente no encontrado: " + emailCliente); continue; }
                    if (vehiculoService.findByPlaca(placa).isPresent()) { errores.add("Fila " + (i+1) + ": Placa " + placa + " ya existe - OMITIDO"); continue; }
                    TipoVehiculo tipoVehiculo; try { tipoVehiculo = TipoVehiculo.valueOf(tipoVeh); } catch (IllegalArgumentException e) { errores.add("Fila " + (i+1) + ": Tipo inválido: " + tipoVeh); continue; }
                    Marca marcaEnum;          try { marcaEnum = Marca.valueOf(marca);               } catch (IllegalArgumentException e) { errores.add("Fila " + (i+1) + ": Marca inválida: " + marca);  continue; }
                    vehiculoService.save(Vehiculo.builder().placa(placa).tipo(tipoVehiculo).marca(marcaEnum).color(color).anio(anio).idUsuario(clienteOpt.get()).build());
                    vehiculosRegistrados++;
                    cargados.add(Map.of("tipo","Vehículo","placa",placa,"tipoVehiculo",tipoVeh,"marca",marca,"color",color,"año",anio,"propietario",clienteOpt.get().getNombre()));
                } catch (Exception e) { errores.add("Fila " + (i+1) + " (Vehículo): " + e.getMessage()); }
            }

            workbook.close();
            log.info("Carga masiva: clientes={} vehiculos={} errores={}", clientesRegistrados, vehiculosRegistrados, errores.size());

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
            log.error("Error procesando Excel: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Error procesando archivo Excel. Verifica que el archivo sea válido."));
        } catch (Exception e) {
            log.error("Error en carga masiva: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    // =========================================================
    // BUSCAR POR PLACA
    // =========================================================

    @GetMapping("/buscar-por-placa/{placa}")
    public ResponseEntity<?> buscarPorPlaca(@PathVariable String placa) {
        try {
            Optional<Vehiculo> vehiculoOpt = vehiculoService.findByPlaca(placa.toUpperCase().trim());
            if (vehiculoOpt.isEmpty()) return ResponseEntity.ok(Map.of("encontrado", false, "mensaje", "Vehículo no registrado"));

            Vehiculo vehiculo = vehiculoOpt.get();
            Usuario  cliente  = vehiculo.getIdUsuario();
            return ResponseEntity.ok(Map.of(
                    "encontrado", true,
                    "vehiculo", Map.of("id",vehiculo.getIdVehiculo(),"placa",vehiculo.getPlaca(),"tipo",vehiculo.getTipo().toString(),"marca",vehiculo.getMarca().toString(),"color",vehiculo.getColor(),"anio",vehiculo.getAnio()),
                    "cliente",  Map.of("id",cliente.getIdUsuario(),"nombre",cliente.getNombre(),"telefono",cliente.getTelefono(),"email",cliente.getCorreo(),"cedula",cliente.getCedula())
            ));
        } catch (Exception e) {
            log.error("Error al buscar placa {}: {}", placa, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }
}