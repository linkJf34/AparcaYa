package com.exe.AparcaYA.Controllers;

import com.exe.AparcaYA.Entity.Tarifa;
import com.exe.AparcaYA.Entity.Usuario;
import com.exe.AparcaYA.Entity.Sede;
import com.exe.AparcaYA.Enum.EstadoGeneral;
import com.exe.AparcaYA.Enum.MetodoPago;
import com.exe.AparcaYA.Enum.Rolenum;
import com.exe.AparcaYA.Enum.TipoCliente;
import com.exe.AparcaYA.Service.TarifaService;
import com.exe.AparcaYA.Service.UsuarioService;
import com.exe.AparcaYA.Service.SedeService;
import com.exe.AparcaYA.Service.ReporteService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import jakarta.servlet.http.HttpServletResponse;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/sede")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMINISTRADOR_SEDE')")
public class SedeController {

    private final UsuarioService usuarioService;
    private final SedeService sedeService;
    private final PasswordEncoder passwordEncoder;
    private final ReporteService reporteService;

    @Autowired
    private TarifaService tarifaService;

    // ==================== MÉTODO AUXILIAR PARA OBTENER USUARIO AUTENTICADO ====================

    /**
     * Obtiene el usuario actualmente autenticado
     */
    private Usuario getUsuarioAutenticado() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String correo = authentication.getName();
        return usuarioService.findByCorreo(correo)
                .orElseThrow(() -> new RuntimeException("Usuario autenticado no encontrado"));
    }

    // ==================== USUARIOS (SOLO CLIENTES) ====================

    @GetMapping("/usuarios")
    public ResponseEntity<List<Map<String, Object>>> getUsuarios() {
        try {
            // ✅ CAMBIO: Solo traer CLIENTES
            List<Usuario> usuarios = usuarioService.findByRolIn(List.of(Rolenum.CLIENTE));

            List<Map<String, Object>> resultado = usuarios.stream().map(u -> {
                Map<String, Object> usuario = new HashMap<>();
                usuario.put("id", u.getIdUsuario());
                usuario.put("nombre", u.getNombre() != null ? u.getNombre() : "");
                usuario.put("correo", u.getCorreo() != null ? u.getCorreo() : "");
                usuario.put("telefono", u.getTelefono() != null ? u.getTelefono() : "");
                usuario.put("cedula", u.getCedula() != null ? u.getCedula() : "");
                usuario.put("rol", u.getRol() != null ? u.getRol().toString() : "");
                usuario.put("estado", u.getEstado() != null ? u.getEstado().toString() : "ACTIVO");
                return usuario;
            }).collect(Collectors.toList());

            return ResponseEntity.ok(resultado);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new ArrayList<>());
        }
    }

    @GetMapping("/usuarios/{id}")
    public ResponseEntity<Map<String, Object>> getUsuarioById(@PathVariable Long id) {
        try {
            Optional<Usuario> usuarioOpt = usuarioService.findById(id);

            if (usuarioOpt.isPresent()) {
                Usuario u = usuarioOpt.get();
                Map<String, Object> usuario = new HashMap<>();
                usuario.put("id", u.getIdUsuario());
                usuario.put("nombre", u.getNombre() != null ? u.getNombre() : "");
                usuario.put("correo", u.getCorreo() != null ? u.getCorreo() : "");
                usuario.put("telefono", u.getTelefono() != null ? u.getTelefono() : "");
                usuario.put("cedula", u.getCedula() != null ? u.getCedula() : "");
                usuario.put("rol", u.getRol() != null ? u.getRol().toString() : "");
                usuario.put("estado", u.getEstado() != null ? u.getEstado().toString() : "ACTIVO");
                return ResponseEntity.ok(usuario);
            }

            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/usuarios/{id}")
    public ResponseEntity<Map<String, Object>> updateUsuario(@PathVariable Long id, @RequestBody Map<String, String> datos) {
        try {
            Optional<Usuario> existing = usuarioService.findById(id);

            if (existing.isPresent()) {
                Usuario usuario = existing.get();

                if (datos.get("nombre") != null) usuario.setNombre(datos.get("nombre"));
                if (datos.get("correo") != null) usuario.setCorreo(datos.get("correo"));
                if (datos.get("telefono") != null) usuario.setTelefono(datos.get("telefono"));
                if (datos.get("cedula") != null) usuario.setCedula(datos.get("cedula"));
                if (datos.get("estado") != null) {
                    usuario.setEstado(EstadoGeneral.valueOf(datos.get("estado").toUpperCase()));
                }

                Usuario updated = usuarioService.save(usuario);

                Map<String, Object> resultado = new HashMap<>();
                resultado.put("id", updated.getIdUsuario());
                resultado.put("nombre", updated.getNombre());
                resultado.put("correo", updated.getCorreo());
                resultado.put("telefono", updated.getTelefono());
                resultado.put("cedula", updated.getCedula());
                resultado.put("rol", updated.getRol().toString());
                resultado.put("estado", updated.getEstado().toString());
                resultado.put("mensaje", "Usuario actualizado correctamente");

                return ResponseEntity.ok(resultado);
            }

            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            e.printStackTrace();
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
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/registrar-trabajador")
    public ResponseEntity<Map<String, Object>> registrarTrabajador(@RequestBody Map<String, String> datos) {
        try {
            // Validar datos requeridos
            if (datos.get("nombre") == null || datos.get("correo") == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Nombre y correo son requeridos"));
            }

            // Verificar si el correo ya existe
            if (usuarioService.findByCorreo(datos.get("correo")).isPresent()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Ya existe un usuario con ese correo"));
            }

            // ✅ Obtener el administrador autenticado
            Usuario admin = getUsuarioAutenticado();

            // ✅ Validar que sea un administrador
            if (admin.getRol() != Rolenum.ADMINISTRADOR_SEDE) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "Solo los administradores pueden registrar trabajadores"));
            }

            // ✅ Obtener la sede del administrador usando el método existente
            Sede sedeDelAdmin = sedeService.findByIdUsuario(admin.getIdUsuario());

            if (sedeDelAdmin == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "El administrador no tiene una sede asignada. Debe crear una sede primero."));
            }

            // ✅ Crear el trabajador
            Usuario trabajador = new Usuario();
            trabajador.setNombre(datos.get("nombre"));
            trabajador.setCorreo(datos.get("correo"));
            trabajador.setTelefono(datos.get("telefono") != null ? datos.get("telefono") : "");
            trabajador.setCedula(datos.get("cedula") != null ? datos.get("cedula") : "");

            // Encriptar contraseña
            String contrasena = datos.get("contrasena") != null ? datos.get("contrasena") : "123456";
            trabajador.setContrasena(passwordEncoder.encode(contrasena));

            trabajador.setRol(Rolenum.OPERARIO);
            trabajador.setEstado(EstadoGeneral.ACTIVO);

            // ✅ Asignar valores por defecto para campos obligatorios
            trabajador.setTipoCliente(TipoCliente.NORMAL);
            trabajador.setMetodoPago(MetodoPago.EFECTIVO);

            // ✅ IMPORTANTE: Asignar la sede al trabajador
            trabajador.setSedeAsignada(sedeDelAdmin);

            Usuario saved = usuarioService.save(trabajador);

            // ✅ Respuesta exitosa con información de la sede
            Map<String, Object> resultado = new HashMap<>();
            resultado.put("id", saved.getIdUsuario());
            resultado.put("nombre", saved.getNombre());
            resultado.put("correo", saved.getCorreo());
            resultado.put("telefono", saved.getTelefono());
            resultado.put("cedula", saved.getCedula());
            resultado.put("rol", saved.getRol().toString());
            resultado.put("estado", saved.getEstado().toString());
            resultado.put("sedeId", sedeDelAdmin.getIdSede());
            resultado.put("sedeNombre", sedeDelAdmin.getNombre());
            resultado.put("sedeDireccion", sedeDelAdmin.getDireccion());
            resultado.put("mensaje", "Trabajador registrado exitosamente en la sede: " + sedeDelAdmin.getNombre());

            return ResponseEntity.status(HttpStatus.CREATED).body(resultado);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Error al registrar trabajador: " + e.getMessage()));
        }
    }

    // ==================== SEDES (SOLO LA SEDE DEL ADMINISTRADOR) ====================

    @GetMapping("/sedes")
    public ResponseEntity<List<Map<String, Object>>> getSedes() {
        try {
            // ✅ CAMBIO: Solo traer la sede asignada al administrador
            Usuario admin = getUsuarioAutenticado();

            List<Sede> sedes = new ArrayList<>();
            if (admin.getSedeAsignada() != null) {
                sedes.add(admin.getSedeAsignada());
            }

            List<Map<String, Object>> resultado = sedes.stream().map(s -> {
                Map<String, Object> sede = new HashMap<>();
                sede.put("id", s.getIdSede());
                sede.put("nombre", s.getNombre() != null ? s.getNombre() : "");
                sede.put("direccion", s.getDireccion() != null ? s.getDireccion() : "");
                sede.put("capacidad", s.getCapacidad() != null ? s.getCapacidad() : 0);
                sede.put("tarifaPlenaC", s.getTarifaPlenaC() != null ? s.getTarifaPlenaC() : 0);
                sede.put("tarifaPlenaM", s.getTarifaPlenaM() != null ? s.getTarifaPlenaM() : 0);
                sede.put("tarifaMinutoC", s.getTarifaMinutoC() != null ? s.getTarifaMinutoC() : 0);
                sede.put("tarifaMinutoM", s.getTarifaMinutoM() != null ? s.getTarifaMinutoM() : 0);
                sede.put("estado", s.getEstado() != null ? s.getEstado().toString() : "ACTIVO");
                return sede;
            }).collect(Collectors.toList());

            return ResponseEntity.ok(resultado);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new ArrayList<>());
        }
    }

    @GetMapping("/sedes/{id}")
    public ResponseEntity<Map<String, Object>> getSedeById(@PathVariable Long id) {
        try {
            // ✅ CAMBIO: Verificar que la sede pertenezca al administrador
            Usuario admin = getUsuarioAutenticado();

            if (admin.getSedeAsignada() == null || !admin.getSedeAsignada().getIdSede().equals(id)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "No tiene permisos para acceder a esta sede"));
            }

            Optional<Sede> sedeOpt = sedeService.findById(id);

            if (sedeOpt.isPresent()) {
                Sede s = sedeOpt.get();
                Map<String, Object> sede = new HashMap<>();
                sede.put("id", s.getIdSede());
                sede.put("nombre", s.getNombre() != null ? s.getNombre() : "");
                sede.put("direccion", s.getDireccion() != null ? s.getDireccion() : "");
                sede.put("capacidad", s.getCapacidad() != null ? s.getCapacidad() : 0);
                sede.put("tarifaPlenaC", s.getTarifaPlenaC() != null ? s.getTarifaPlenaC() : 0);
                sede.put("tarifaPlenaM", s.getTarifaPlenaM() != null ? s.getTarifaPlenaM() : 0);
                sede.put("tarifaMinutoC", s.getTarifaMinutoC() != null ? s.getTarifaMinutoC() : 0);
                sede.put("tarifaMinutoM", s.getTarifaMinutoM() != null ? s.getTarifaMinutoM() : 0);
                sede.put("estado", s.getEstado() != null ? s.getEstado().toString() : "ACTIVO");
                return ResponseEntity.ok(sede);
            }

            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/sedes")
    public ResponseEntity<Map<String, Object>> createSede(@RequestBody Map<String, Object> datos) {
        try {
            // ✅ NOTA: Los administradores de sede normalmente NO crean sedes
            // Este endpoint probablemente debería ser restringido o eliminado
            // Se mantiene por compatibilidad pero considera moverlo a un AdminController

            Sede sede = new Sede();

            if (datos.get("nombre") != null) sede.setNombre((String) datos.get("nombre"));
            if (datos.get("direccion") != null) sede.setDireccion((String) datos.get("direccion"));
            if (datos.get("capacidad") != null) {
                sede.setCapacidad(Integer.parseInt(datos.get("capacidad").toString()));
            }

            if (datos.get("tarifaPlenaC") != null) {
                sede.setTarifaPlenaC(Double.parseDouble(datos.get("tarifaPlenaC").toString()));
            }
            if (datos.get("tarifaPlenaM") != null) {
                sede.setTarifaPlenaM(Double.parseDouble(datos.get("tarifaPlenaM").toString()));
            }
            if (datos.get("tarifaMinutoC") != null) {
                sede.setTarifaMinutoC(Double.parseDouble(datos.get("tarifaMinutoC").toString()));
            }
            if (datos.get("tarifaMinutoM") != null) {
                sede.setTarifaMinutoM(Double.parseDouble(datos.get("tarifaMinutoM").toString()));
            }

            sede.setEstado(EstadoGeneral.ACTIVO);
            sede.setFechaCreacion(LocalDateTime.now());

            Sede saved = sedeService.save(sede);

            // Crear las 4 tarifas en la tabla tarifa
            Tarifa tarifaPlenaC = new Tarifa();
            tarifaPlenaC.setPrecio(saved.getTarifaPlenaC());
            tarifaPlenaC.setTipoTarifa("PLENA_CARRO");
            tarifaPlenaC.setSede(saved);
            tarifaService.save(tarifaPlenaC);

            Tarifa tarifaPlenaM = new Tarifa();
            tarifaPlenaM.setPrecio(saved.getTarifaPlenaM());
            tarifaPlenaM.setTipoTarifa("PLENA_MOTO");
            tarifaPlenaM.setSede(saved);
            tarifaService.save(tarifaPlenaM);

            Tarifa tarifaMinutoC = new Tarifa();
            tarifaMinutoC.setPrecio(saved.getTarifaMinutoC());
            tarifaMinutoC.setTipoTarifa("MINUTO_CARRO");
            tarifaMinutoC.setSede(saved);
            tarifaService.save(tarifaMinutoC);

            Tarifa tarifaMinutoM = new Tarifa();
            tarifaMinutoM.setPrecio(saved.getTarifaMinutoM());
            tarifaMinutoM.setTipoTarifa("MINUTO_MOTO");
            tarifaMinutoM.setSede(saved);
            tarifaService.save(tarifaMinutoM);

            Map<String, Object> resultado = new HashMap<>();
            resultado.put("id", saved.getIdSede());
            resultado.put("nombre", saved.getNombre());
            resultado.put("direccion", saved.getDireccion());
            resultado.put("capacidad", saved.getCapacidad());
            resultado.put("tarifaPlenaC", saved.getTarifaPlenaC());
            resultado.put("tarifaPlenaM", saved.getTarifaPlenaM());
            resultado.put("tarifaMinutoC", saved.getTarifaMinutoC());
            resultado.put("tarifaMinutoM", saved.getTarifaMinutoM());
            resultado.put("estado", saved.getEstado().toString());
            resultado.put("mensaje", "Sede creada correctamente");

            return ResponseEntity.status(HttpStatus.CREATED).body(resultado);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/sedes/{id}")
    public ResponseEntity<Map<String, Object>> updateSede(@PathVariable Long id, @RequestBody Map<String, Object> datos) {
        try {
            // ✅ CAMBIO: Verificar que la sede pertenezca al administrador
            Usuario admin = getUsuarioAutenticado();

            if (admin.getSedeAsignada() == null || !admin.getSedeAsignada().getIdSede().equals(id)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "No tiene permisos para modificar esta sede"));
            }

            Optional<Sede> existing = sedeService.findById(id);

            if (existing.isPresent()) {
                Sede sede = existing.get();

                if (datos.get("nombre") != null) sede.setNombre((String) datos.get("nombre"));
                if (datos.get("direccion") != null) sede.setDireccion((String) datos.get("direccion"));
                if (datos.get("capacidad") != null) {
                    sede.setCapacidad(Integer.parseInt(datos.get("capacidad").toString()));
                }

                if (datos.get("tarifaPlenaC") != null) {
                    sede.setTarifaPlenaC(Double.parseDouble(datos.get("tarifaPlenaC").toString()));
                }
                if (datos.get("tarifaPlenaM") != null) {
                    sede.setTarifaPlenaM(Double.parseDouble(datos.get("tarifaPlenaM").toString()));
                }
                if (datos.get("tarifaMinutoC") != null) {
                    sede.setTarifaMinutoC(Double.parseDouble(datos.get("tarifaMinutoC").toString()));
                }
                if (datos.get("tarifaMinutoM") != null) {
                    sede.setTarifaMinutoM(Double.parseDouble(datos.get("tarifaMinutoM").toString()));
                }

                if (datos.get("estado") != null) {
                    sede.setEstado(EstadoGeneral.valueOf(datos.get("estado").toString().toUpperCase()));
                }

                Sede updated = sedeService.save(sede);

                Map<String, Object> resultado = new HashMap<>();
                resultado.put("id", updated.getIdSede());
                resultado.put("nombre", updated.getNombre());
                resultado.put("direccion", updated.getDireccion());
                resultado.put("capacidad", updated.getCapacidad());
                resultado.put("tarifaPlenaC", updated.getTarifaPlenaC());
                resultado.put("tarifaPlenaM", updated.getTarifaPlenaM());
                resultado.put("tarifaMinutoC", updated.getTarifaMinutoC());
                resultado.put("tarifaMinutoM", updated.getTarifaMinutoM());
                resultado.put("estado", updated.getEstado().toString());
                resultado.put("mensaje", "Sede actualizada correctamente");

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
            // ✅ CAMBIO: Verificar que la sede pertenezca al administrador
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

    // ==================== REPORTES PDF Y EXCEL ====================

    @GetMapping("/reporte/usuarios/pdf")
    @ResponseBody
    public ResponseEntity<byte[]> generarReportePDF() {
        try {
            // ✅ Solo generar reporte de CLIENTES
            List<Usuario> usuarios = usuarioService.findByRolIn(List.of(Rolenum.CLIENTE));

            if (usuarios.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NO_CONTENT).body(null);
            }

            // Generar el PDF
            ByteArrayOutputStream baos = reporteService.generarReportePDF(usuarios);

            // Preparar headers para la descarga
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);

            String filename = "reporte_clientes_AparcaYA_" +
                    LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss")) +
                    ".pdf";
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
    @ResponseBody
    public ResponseEntity<byte[]> generarReporteExcel() {
        try {
            // ✅ Solo generar reporte de CLIENTES
            List<Usuario> usuarios = usuarioService.findByRolIn(List.of(Rolenum.CLIENTE));

            if (usuarios.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NO_CONTENT).body(null);
            }

            // Generar el Excel
            ByteArrayOutputStream baos = reporteService.generarReporteExcel(usuarios);

            // Preparar headers para la descarga
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));

            String filename = "reporte_clientes_AparcaYA_" +
                    LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss")) +
                    ".xlsx";
            headers.setContentDispositionFormData("attachment", filename);
            headers.setCacheControl("must-revalidate, post-check=0, pre-check=0");

            return new ResponseEntity<>(baos.toByteArray(), headers, HttpStatus.OK);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(("Error al generar el Excel: " + e.getMessage()).getBytes());
        }
    }

    // ==================== REPORTES EXCEL ANTIGUOS (MANTENER POR COMPATIBILIDAD) ====================

    @GetMapping("/reportes/excel")
    public void generarExcel(HttpServletResponse response) throws IOException {
        response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setHeader("Content-Disposition", "attachment; filename=clientes.xlsx");

        Workbook workbook = new XSSFWorkbook();
        Sheet sheet = workbook.createSheet("Clientes");

        // Estilo de encabezado
        CellStyle headerStyle = workbook.createCellStyle();
        Font headerFont = workbook.createFont();
        headerFont.setBold(true);
        headerStyle.setFont(headerFont);
        headerStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

        // Encabezados
        Row headerRow = sheet.createRow(0);
        String[] headers = {"ID", "Nombre", "Correo", "Teléfono", "Cédula", "Rol", "Estado"};
        for (int i = 0; i < headers.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(headerStyle);
        }

        // ✅ CAMBIO: Solo CLIENTES
        List<Usuario> usuarios = usuarioService.findByRolIn(List.of(Rolenum.CLIENTE));
        int rowNum = 1;
        for (Usuario u : usuarios) {
            Row row = sheet.createRow(rowNum++);
            row.createCell(0).setCellValue(u.getIdUsuario() != null ? u.getIdUsuario() : 0);
            row.createCell(1).setCellValue(u.getNombre() != null ? u.getNombre() : "");
            row.createCell(2).setCellValue(u.getCorreo() != null ? u.getCorreo() : "");
            row.createCell(3).setCellValue(u.getTelefono() != null ? u.getTelefono() : "");
            row.createCell(4).setCellValue(u.getCedula() != null ? u.getCedula() : "");
            row.createCell(5).setCellValue(u.getRol() != null ? u.getRol().toString() : "");
            row.createCell(6).setCellValue(u.getEstado() != null ? u.getEstado().toString() : "");
        }

        // Ajustar ancho de columnas
        for (int i = 0; i < headers.length; i++) {
            sheet.autoSizeColumn(i);
        }

        workbook.write(response.getOutputStream());
        workbook.close();
    }

    @GetMapping("/reportes/excel-sedes")
    public void generarExcelSedes(HttpServletResponse response) throws IOException {
        response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setHeader("Content-Disposition", "attachment; filename=mi_sede.xlsx");

        Workbook workbook = new XSSFWorkbook();
        Sheet sheet = workbook.createSheet("Mi Sede");

        // Estilo de encabezado
        CellStyle headerStyle = workbook.createCellStyle();
        Font headerFont = workbook.createFont();
        headerFont.setBold(true);
        headerStyle.setFont(headerFont);
        headerStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

        Row headerRow = sheet.createRow(0);
        String[] headers = {
                "ID",
                "Nombre",
                "Dirección",
                "Capacidad",
                "Tarifa Plena Carro",
                "Tarifa Plena Moto",
                "Tarifa Minuto Carro",
                "Tarifa Minuto Moto",
                "Estado"
        };
        for (int i = 0; i < headers.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(headerStyle);
        }

        // ✅ CAMBIO: Solo la sede del administrador
        Usuario admin = getUsuarioAutenticado();
        List<Sede> sedes = new ArrayList<>();
        if (admin.getSedeAsignada() != null) {
            sedes.add(admin.getSedeAsignada());
        }

        int rowNum = 1;
        for (Sede s : sedes) {
            Row row = sheet.createRow(rowNum++);
            row.createCell(0).setCellValue(s.getIdSede() != null ? s.getIdSede() : 0);
            row.createCell(1).setCellValue(s.getNombre() != null ? s.getNombre() : "");
            row.createCell(2).setCellValue(s.getDireccion() != null ? s.getDireccion() : "");
            row.createCell(3).setCellValue(s.getCapacidad() != null ? s.getCapacidad() : 0);
            row.createCell(4).setCellValue(s.getTarifaPlenaC() != null ? s.getTarifaPlenaC() : 0);
            row.createCell(5).setCellValue(s.getTarifaPlenaM() != null ? s.getTarifaPlenaM() : 0);
            row.createCell(6).setCellValue(s.getTarifaMinutoC() != null ? s.getTarifaMinutoC() : 0);
            row.createCell(7).setCellValue(s.getTarifaMinutoM() != null ? s.getTarifaMinutoM() : 0);
            row.createCell(8).setCellValue(s.getEstado() != null ? s.getEstado().toString() : "");
        }

        // Ajustar ancho de columnas
        for (int i = 0; i < headers.length; i++) {
            sheet.autoSizeColumn(i);
        }

        workbook.write(response.getOutputStream());
        workbook.close();
    }

    // ==================== ESTADÍSTICAS ====================

    @GetMapping("/estadisticas")
    public ResponseEntity<Map<String, Object>> getEstadisticas() {
        try {
            Map<String, Object> stats = new HashMap<>();

            // ✅ CAMBIO: Solo CLIENTES para usuarios
            List<Usuario> usuarios = usuarioService.findByRolIn(List.of(Rolenum.CLIENTE));

            // ✅ CAMBIO: Solo la sede del administrador
            Usuario admin = getUsuarioAutenticado();
            List<Sede> sedes = new ArrayList<>();
            if (admin.getSedeAsignada() != null) {
                sedes.add(admin.getSedeAsignada());
            }

            long totalClientes = usuarios.size();
            long usuariosActivos = usuarios.stream().filter(u -> u.getEstado() == EstadoGeneral.ACTIVO).count();
            long usuariosInactivos = usuarios.stream().filter(u -> u.getEstado() == EstadoGeneral.INACTIVO).count();

            long sedesActivas = sedes.stream().filter(s -> s.getEstado() == EstadoGeneral.ACTIVO).count();
            int capacidadTotal = sedes.stream()
                    .filter(s -> s.getCapacidad() != null)
                    .mapToInt(Sede::getCapacidad)
                    .sum();

            stats.put("totalUsuarios", usuarios.size());
            stats.put("totalClientes", totalClientes);
            stats.put("usuariosActivos", usuariosActivos);
            stats.put("usuariosInactivos", usuariosInactivos);
            stats.put("totalSedes", sedes.size());
            stats.put("sedesActivas", sedesActivas);
            stats.put("capacidadTotal", capacidadTotal);

            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

} // FIN DE LA CLASE