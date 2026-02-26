package com.exe.AparcaYA.Controllers;

import com.exe.AparcaYA.Entity.Sede;
import com.exe.AparcaYA.Entity.Usuario;
import com.exe.AparcaYA.Service.IEmailService;
import com.exe.AparcaYA.Service.ReporteService;
import com.exe.AparcaYA.Service.SedeService;
import com.exe.AparcaYA.Dto.SedeDTO;
import com.exe.AparcaYA.Service.UsuarioService;
import jakarta.mail.MessagingException; // ✅ CAMBIO 1: Solo el import necesario (eliminados jakarta.mail.*, InternetAddress, MimeMessage)
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Controller
@RequestMapping("/admin")
@CrossOrigin(origins = "*") // Permitir CORS para desarrollo
public class AdminController {

    @Autowired
    private UsuarioService usuarioService;

    @Autowired
    private SedeService sedeService;

    @Autowired
    private ReporteService reporteService;

    @Autowired
    private IEmailService emailService;

    // ============================================
    // VISTA PRINCIPAL DEL DASHBOARD
    // ============================================
    @GetMapping("/dashboard/administradorGeneral")
    public String dashboardAdmin(Model model) {
        // Solo retorna la vista HTML, los datos se cargan vía API
        return "DashboardAdmin";
    }

    // ============================================
    // APIS PARA USUARIOS
    // ============================================

    @GetMapping("/api/usuarios")
    @ResponseBody
    public ResponseEntity<List<Usuario>> getUsuarios() {
        try {
            List<Usuario> usuarios = usuarioService.findAll();
            return ResponseEntity.ok(usuarios);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/api/usuarios/{id}")
    @ResponseBody
    public ResponseEntity<Usuario> getUsuario(@PathVariable Long id) {
        Optional<Usuario> usuario = usuarioService.findById(id);
        return usuario.map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/api/usuarios/eliminar/{id}")
    @ResponseBody
    public ResponseEntity<Map<String, String>> eliminarUsuario(@PathVariable Long id) {
        try {
            Optional<Usuario> usuario = usuarioService.findById(id);
            if (usuario.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("mensaje", "Usuario no encontrado"));
            }

            usuarioService.delete(id);
            return ResponseEntity.ok(Map.of("mensaje", "Usuario eliminado correctamente"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("mensaje", "Error eliminando usuario: " + e.getMessage()));
        }
    }

    @PutMapping("/api/usuarios/actualizar/{id}")
    @ResponseBody
    public ResponseEntity<Map<String, String>> actualizarUsuario(
            @PathVariable Long id,
            @RequestBody Usuario usuarioActualizado) {
        try {
            Optional<Usuario> usuarioOpt = usuarioService.findById(id);
            if (usuarioOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("mensaje", "Usuario no encontrado"));
            }

            Usuario usuario = usuarioOpt.get();
            usuario.setNombre(usuarioActualizado.getNombre());
            usuario.setCorreo(usuarioActualizado.getCorreo());
            usuario.setRol(usuarioActualizado.getRol());
            usuario.setTelefono(usuarioActualizado.getTelefono());
            usuario.setEstado(usuarioActualizado.getEstado());

            usuarioService.save(usuario);
            return ResponseEntity.ok(Map.of("mensaje", "Usuario actualizado correctamente"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("mensaje", "Error actualizando usuario: " + e.getMessage()));
        }
    }

    // ============================================
    // APIS PARA SEDES
    // ============================================

    @GetMapping("/api/sedes")
    @ResponseBody
    public ResponseEntity<List<SedeDTO>> getSedes() {
        try {
            // ✅ CAMBIO #5: Mapeo delegado a SedeDTO.fromEntity(), eliminado Map<String,Object> manual
            List<SedeDTO> sedesResponse = sedeService.findAll().stream()
                    .map(SedeDTO::fromEntity)
                    .collect(Collectors.toList());

            return ResponseEntity.ok(sedesResponse);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/api/sedes/{id}")
    @ResponseBody
    public ResponseEntity<Sede> getSede(@PathVariable Long id) {
        Optional<Sede> sede = sedeService.findById(id);
        return sede.map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/api/sedes/eliminar/{id}")
    @ResponseBody
    public ResponseEntity<Map<String, String>> eliminarSede(@PathVariable Long id) {
        try {
            Optional<Sede> sede = sedeService.findById(id);
            if (sede.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("mensaje", "Sede no encontrada"));
            }

            sedeService.delete(id);
            return ResponseEntity.ok(Map.of("mensaje", "Sede eliminada correctamente"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("mensaje", "Error eliminando sede: " + e.getMessage()));
        }
    }

    @PutMapping("/api/sedes/actualizar/{id}")
    @ResponseBody
    public ResponseEntity<Map<String, String>> actualizarSede(
            @PathVariable Long id,
            @RequestBody Sede sedeActualizada) {
        try {
            Optional<Sede> sedeOpt = sedeService.findById(id);
            if (sedeOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("mensaje", "Sede no encontrada"));
            }

            Sede sede = sedeOpt.get();
            sede.setNombre(sedeActualizada.getNombre());
            sede.setDireccion(sedeActualizada.getDireccion());
            sede.setCapacidad(sedeActualizada.getCapacidad());
            sede.setEstado(sedeActualizada.getEstado());

            sedeService.save(sede);
            return ResponseEntity.ok(Map.of("mensaje", "Sede actualizada correctamente"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("mensaje", "Error actualizando sede: " + e.getMessage()));
        }
    }

    // ============================================
    // APIS PARA INDICADORES (DASHBOARD)
    // ============================================

    @GetMapping("/api/indicadores")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getIndicadores() {
        try {
            // ✅ CAMBIO #2: Cálculos delegados al Service, Controller solo ensambla la respuesta
            long totalUsuarios   = usuarioService.contarTotal();
            long usuariosActivos = usuarioService.contarActivos();
            long totalSedes      = sedeService.contarTotal();
            long sedesActivas    = sedeService.contarActivas();

            double porcentajeUsuarios = totalUsuarios == 0 ? 0 : (usuariosActivos * 100.0 / totalUsuarios);
            double porcentajeSedes    = totalSedes == 0 ? 0 : (sedesActivas * 100.0 / totalSedes);

            double ingresosTotales = calcularIngresosTotales();

            Map<String, Object> indicadores = new HashMap<>();
            indicadores.put("totalUsuarios",      totalUsuarios);
            indicadores.put("usuariosActivos",    usuariosActivos);
            indicadores.put("porcentajeUsuarios", Math.round(porcentajeUsuarios));
            indicadores.put("totalSedes",         totalSedes);
            indicadores.put("sedesActivas",       sedesActivas);
            indicadores.put("porcentajeSedes",    Math.round(porcentajeSedes));
            indicadores.put("ingresosTotales",    ingresosTotales);
            indicadores.put("porcentajeIngresos", 85);

            return ResponseEntity.ok(indicadores);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // ============================================
    // APIS PARA GRÁFICAS
    // ============================================

    @GetMapping("/api/grafica/usuarios-rol")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getGraficaUsuariosRol() {
        try {
            List<Usuario> usuarios = usuarioService.findAll();
            Map<String, Long> conteo = usuarios.stream()
                    .collect(Collectors.groupingBy(
                            u -> u.getRol().name(),
                            Collectors.counting()
                    ));

            List<String> labels = new ArrayList<>(conteo.keySet());
            List<Long> data = new ArrayList<>(conteo.values());

            return ResponseEntity.ok(Map.of("labels", labels, "data", data));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/api/grafica/ingresos")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getGraficaIngresos() {
        try {
            List<String> labels = List.of("Ene", "Feb", "Mar", "Abr", "May", "Jun",
                    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic");
            List<Integer> data = List.of(12000, 19000, 15000, 25000, 22000, 30000,
                    28000, 35000, 32000, 40000, 38000, 45000);

            return ResponseEntity.ok(Map.of("labels", labels, "data", data));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/api/grafica/sedes")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getGraficaSedes() {
        try {
            List<Sede> sedes = sedeService.findAll();

            List<String> labels = sedes.stream()
                    .map(Sede::getNombre)
                    .collect(Collectors.toList());
            List<Integer> data = sedes.stream()
                    .map(Sede::getCapacidad)
                    .collect(Collectors.toList());

            return ResponseEntity.ok(Map.of("labels", labels, "data", data));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // ============================================
    // REPORTES (PDF y EXCEL)
    // ============================================

    @GetMapping("/reporte/usuarios/pdf")
    @ResponseBody
    public ResponseEntity<byte[]> generarReportePDF() {
        try {
            List<Usuario> usuarios = usuarioService.findAll();

            if (usuarios.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NO_CONTENT).body(null);
            }

            ByteArrayOutputStream baos = reporteService.generarReportePDF(usuarios);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            String filename = "reporte_usuarios_AparcaYA_" +
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
    @ResponseBody
    public ResponseEntity<byte[]> generarReporteExcel() {
        try {
            List<Usuario> usuarios = usuarioService.findAll();

            if (usuarios.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NO_CONTENT).body(null);
            }

            ByteArrayOutputStream baos = reporteService.generarReporteExcel(usuarios);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            String filename = "reporte_usuarios_AparcaYA_" +
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

    // ============================================
    // MÉTODOS AUXILIARES PRIVADOS
    // ============================================

    private double calcularIngresosTotales() {
        return 85000.0; // Placeholder — reemplazar con lógica real cuando esté disponible
    }

    // ============================================
    // ENVÍO DE CORREOS
    // ============================================

    @PostMapping("/correo/unitario")
    @ResponseBody
    public ResponseEntity<Map<String, String>> enviarCorreoUnitario(
            @RequestParam String correo,
            @RequestParam String asunto,
            @RequestParam String mensaje) {

        Map<String, String> response = new HashMap<>();

        try {
            emailService.enviarCorreoUnitario(correo, asunto, mensaje);
            response.put("status", "success");
            response.put("message", "Correo enviado correctamente a " + correo);
            return ResponseEntity.ok(response);

        } catch (MessagingException e) {
            response.put("status", "error");
            response.put("message", "Error al enviar el correo: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    @PostMapping("/correo/masivo")
    @ResponseBody
    public ResponseEntity<Map<String, String>> enviarCorreoMasivo(
            @RequestParam(name = "seleccionados", required = false) List<String> seleccionados,
            @RequestParam String asunto,
            @RequestParam String mensaje) {

        Map<String, String> response = new HashMap<>();

        if (seleccionados == null || seleccionados.isEmpty()) {
            response.put("status", "error");
            response.put("message", "No se seleccionó ningún correo.");
            return ResponseEntity.badRequest().body(response);
        }

        try {
            emailService.enviarCorreoMasivo(seleccionados, asunto, mensaje);
            response.put("status", "success");
            response.put("message", "Correos enviados correctamente a " + seleccionados.size() + " destinatarios");
            return ResponseEntity.ok(response);

        } catch (MessagingException e) {
            response.put("status", "error");
            response.put("message", "No fue posible enviar la notificación: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
}