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
import com.exe.AparcaYA.Service.TarifaService;
import com.exe.AparcaYA.Service.UsuarioService;
import com.exe.AparcaYA.Service.SedeService;
import com.exe.AparcaYA.Service.ReporteService;
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

    private final UsuarioService usuarioService;
    private final SedeService sedeService;
    private final PasswordEncoder passwordEncoder;
    private final ReporteService reporteService;
    private final TarifaService tarifaService;

    // ==================== MÉTODO AUXILIAR PARA OBTENER USUARIO AUTENTICADO ====================

    private Usuario getUsuarioAutenticado() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String correo = authentication.getName();
        return usuarioService.findByCorreo(correo)
                .orElseThrow(() -> new RuntimeException("Usuario autenticado no encontrado"));
    }

    // ==================== MÉTODO AUXILIAR PARA CREAR TARIFAS ====================

    // ✅ CAMBIO módulo Usuario: lógica de 4 tarifas movida a TarifaService.crearTarifasParaSede()
    // Antes: 16 líneas de new Tarifa() inline aquí
    // Ahora: delegación al Service — mismo método que usa UsuarioController
    private void crearTarifasParaSede(Sede sede) {
        tarifaService.crearTarifasParaSede(sede);
    }

    // ==================== USUARIOS (SOLO CLIENTES) ====================

    @GetMapping("/usuarios")
    public ResponseEntity<List<UsuarioDTO>> getUsuarios() {
        try {
            // ✅ CAMBIO #1: Mapeo delegado a UsuarioDTO.fromEntity()
            // Antes: bloque Map<String,Object> de 7 campos repetido 4 veces en el Controller
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
            // ✅ CAMBIO #1: Mapeo delegado a UsuarioDTO.fromEntity()
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

                // ✅ CAMBIO #1: Campos base via UsuarioDTO + "mensaje" extra para el frontend
                UsuarioDTO dto = UsuarioDTO.fromEntity(updated);
                Map<String, Object> resultado = new LinkedHashMap<>();
                resultado.put("id",      dto.getId());
                resultado.put("nombre",  dto.getNombre());
                resultado.put("correo",  dto.getCorreo());
                resultado.put("telefono",dto.getTelefono());
                resultado.put("cedula",  dto.getCedula());
                resultado.put("rol",     dto.getRol());
                resultado.put("estado",  dto.getEstado());
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
            if (datos.get("nombre") == null || datos.get("correo") == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Nombre y correo son requeridos"));
            }

            if (usuarioService.findByCorreo(datos.get("correo")).isPresent()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Ya existe un usuario con ese correo"));
            }

            Usuario admin = getUsuarioAutenticado();

            if (admin.getRol() != Rolenum.ADMINISTRADOR_SEDE) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "Solo los administradores pueden registrar trabajadores"));
            }

            Sede sedeDelAdmin = sedeService.findByIdUsuario(admin.getIdUsuario());

            if (sedeDelAdmin == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "El administrador no tiene una sede asignada."));
            }

            Usuario trabajador = new Usuario();
            trabajador.setNombre(datos.get("nombre"));
            trabajador.setCorreo(datos.get("correo"));
            trabajador.setTelefono(datos.get("telefono") != null ? datos.get("telefono") : "");
            trabajador.setCedula(datos.get("cedula")     != null ? datos.get("cedula")    : "");

            String contrasena = datos.get("contrasena") != null ? datos.get("contrasena") : "123456";
            trabajador.setContrasena(passwordEncoder.encode(contrasena));

            trabajador.setRol(Rolenum.OPERARIO);
            trabajador.setEstado(EstadoGeneral.ACTIVO);
            trabajador.setTipoCliente(TipoCliente.NORMAL);
            trabajador.setMetodoPago(MetodoPago.EFECTIVO);
            trabajador.setSedeAsignada(sedeDelAdmin);

            Usuario saved = usuarioService.save(trabajador);

            // ✅ CAMBIO #1: Campos base del trabajador via UsuarioDTO
            // Los campos extra de sede (sedeId, sedeNombre, sedeDireccion) se agregan aquí
            // ya que no pertenecen al DTO de usuario
            UsuarioDTO savedDTO = UsuarioDTO.fromEntity(saved);
            Map<String, Object> resultado = new LinkedHashMap<>();
            resultado.put("id",           savedDTO.getId());
            resultado.put("nombre",       savedDTO.getNombre());
            resultado.put("correo",       savedDTO.getCorreo());
            resultado.put("telefono",     savedDTO.getTelefono());
            resultado.put("cedula",       savedDTO.getCedula());
            resultado.put("rol",          savedDTO.getRol());
            resultado.put("estado",       savedDTO.getEstado());
            resultado.put("sedeId",       sedeDelAdmin.getIdSede());
            resultado.put("sedeNombre",   sedeDelAdmin.getNombre());
            resultado.put("sedeDireccion",sedeDelAdmin.getDireccion());
            resultado.put("mensaje",      "Trabajador registrado exitosamente en la sede: " + sedeDelAdmin.getNombre());

            return ResponseEntity.status(HttpStatus.CREATED).body(resultado);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Error al registrar trabajador: " + e.getMessage()));
        }
    }

    // ==================== SEDES (SOLO LA SEDE DEL ADMINISTRADOR) ====================

    @GetMapping("/sedes")
    public ResponseEntity<List<SedeDTO>> getSedes() {
        try {
            // ✅ CAMBIO #2: Mapeo delegado a SedeDTO.fromEntity()
            // Antes: bloque Map<String,Object> de 9 campos repetido 4 veces en el Controller
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
            // ✅ CAMBIO #2: Mapeo delegado a SedeDTO.fromEntity()
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

            Sede saved = sedeService.save(sede);
            crearTarifasParaSede(saved);

            // ✅ CAMBIO #2: Campos base via SedeDTO + "mensaje" extra para el frontend
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

                Sede updated = sedeService.save(sede);

                // ✅ CAMBIO #2: Campos base via SedeDTO + "mensaje" extra para el frontend
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

    // ==================== REPORTES PDF Y EXCEL ====================

    @GetMapping("/reporte/usuarios/pdf")
    public ResponseEntity<byte[]> generarReportePDF() {
        try {
            List<Usuario> usuarios = usuarioService.findByRolIn(List.of(Rolenum.CLIENTE));

            if (usuarios.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NO_CONTENT).body(null);
            }

            ByteArrayOutputStream baos = reporteService.generarReportePDF(usuarios);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            String filename = "reporte_clientes_AparcaYA_" +
                    LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss")) + ".pdf";
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

            if (usuarios.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NO_CONTENT).body(null);
            }

            ByteArrayOutputStream baos = reporteService.generarReporteExcel(usuarios);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            String filename = "reporte_clientes_AparcaYA_" +
                    LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss")) + ".xlsx";
            headers.setContentDispositionFormData("attachment", filename);
            headers.setCacheControl("must-revalidate, post-check=0, pre-check=0");

            return new ResponseEntity<>(baos.toByteArray(), headers, HttpStatus.OK);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(("Error al generar el Excel: " + e.getMessage()).getBytes());
        }
    }

    // ==================== REPORTES EXCEL LEGACY (COMPATIBILIDAD) ====================

    @GetMapping("/reportes/excel")
    public void generarExcel(HttpServletResponse response) throws IOException {
        // ✅ CAMBIO #5: Delegado a ReporteService — eliminadas ~40 líneas de POI manual
        response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setHeader("Content-Disposition", "attachment; filename=clientes.xlsx");
        try {
            List<Usuario> usuarios = usuarioService.findByRolIn(List.of(Rolenum.CLIENTE));
            ByteArrayOutputStream baos = reporteService.generarReporteExcel(usuarios);
            response.getOutputStream().write(baos.toByteArray());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @GetMapping("/reportes/excel-sedes")
    public void generarExcelSedes(HttpServletResponse response) throws IOException {
        // ✅ CAMBIO #5: Delegado a ReporteService — eliminadas ~50 líneas de POI manual
        response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setHeader("Content-Disposition", "attachment; filename=mi_sede.xlsx");
        try {
            Usuario admin = getUsuarioAutenticado();
            List<Sede> sedes = new ArrayList<>();
            if (admin.getSedeAsignada() != null) {
                sedes.add(admin.getSedeAsignada());
            }
            ByteArrayOutputStream baos = reporteService.generarReporteExcelSedes(sedes);
            response.getOutputStream().write(baos.toByteArray());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // ==================== ESTADÍSTICAS ====================

    @GetMapping("/estadisticas")
    public ResponseEntity<Map<String, Object>> getEstadisticas() {
        try {
            // ✅ CAMBIO #4: Conteos delegados a métodos del Service
            // Antes: streams de filtrado directamente en el Controller
            // Reutiliza contarActivos() y contarTotal() implementados en el módulo Admin
            Usuario admin = getUsuarioAutenticado();
            List<Sede> sedes = new ArrayList<>();
            if (admin.getSedeAsignada() != null) {
                sedes.add(admin.getSedeAsignada());
            }

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