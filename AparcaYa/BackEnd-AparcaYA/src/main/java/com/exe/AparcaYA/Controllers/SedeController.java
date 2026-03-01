package com.exe.AparcaYA.Controllers;

import com.exe.AparcaYA.Dto.SedeDTO;
import com.exe.AparcaYA.Dto.UsuarioDTO;
import com.exe.AparcaYA.Entity.Tarifa;
import com.exe.AparcaYA.Entity.Usuario;
import com.exe.AparcaYA.Entity.Sede;
import com.exe.AparcaYA.Enum.EstadoGeneral;
import com.exe.AparcaYA.Enum.MetodoPago;
import com.exe.AparcaYA.Enum.Rolenum;
import com.exe.AparcaYA.Enum.TipoCliente;
import com.exe.AparcaYA.Service.IEmailService;
import com.exe.AparcaYA.Service.TarifaService;
import com.exe.AparcaYA.Service.UsuarioService;
import com.exe.AparcaYA.Service.SedeService;
import com.exe.AparcaYA.Service.ReporteService;
import jakarta.mail.MessagingException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

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

    private final UsuarioService  usuarioService;
    private final SedeService     sedeService;
    private final PasswordEncoder passwordEncoder;
    private final ReporteService  reporteService;
    private final TarifaService   tarifaService;
    private final IEmailService   emailService;

    // =========================================================
    // UTILIDAD: usuario autenticado desde SecurityContext
    // =========================================================
    private Usuario getUsuarioAutenticado() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String correo = authentication.getName();
        return usuarioService.findByCorreo(correo)
                .orElseThrow(() -> new RuntimeException("Usuario autenticado no encontrado"));
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

            Usuario admin        = getUsuarioAutenticado();
            Sede sedeDelAdmin    = sedeService.findByIdUsuario(admin.getIdUsuario());

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
    // SEDES (SOLO LA SEDE DEL ADMINISTRADOR)
    // =========================================================

    @GetMapping("/sedes")
    public ResponseEntity<List<SedeDTO>> getSedes() {
        try {
            Usuario admin       = getUsuarioAutenticado();
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

            Sede saved        = sedeService.save(sede);
            crearTarifasParaSede(saved);
            SedeDTO savedDTO  = SedeDTO.fromEntity(saved);

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

                Sede updated         = sedeService.save(sede);
                SedeDTO updatedDTO   = SedeDTO.fromEntity(updated);

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
    // ESTADÍSTICAS
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
}