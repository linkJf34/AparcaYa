package com.exe.AparcaYA.Controllers;

import com.exe.AparcaYA.Entity.Sede;
import com.exe.AparcaYA.Entity.Usuario;
import com.exe.AparcaYA.Enum.EstadoGeneral;
import com.exe.AparcaYA.Service.IEmailService;
import com.exe.AparcaYA.Service.ReporteService;
import com.exe.AparcaYA.Service.SedeService;
import com.exe.AparcaYA.Service.UsuarioService;
import jakarta.mail.*;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
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
            usuario.setTelefono(usuarioActualizado.getTelefono()); // 👈 AGREGAR ESTA LÍNEA
            usuario.setEstado(usuarioActualizado.getEstado());     // 👈 AGREGAR ESTA LÍNEA

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
    public ResponseEntity<List<Map<String, Object>>> getSedes() {
        try {
            List<Sede> sedes = sedeService.findAll();

            // Convertir a Map para asegurar que todos los campos se envían correctamente
            List<Map<String, Object>> sedesResponse = sedes.stream()
                    .map(sede -> {
                        Map<String, Object> sedeMap = new HashMap<>();
                        sedeMap.put("id", sede.getIdSede());
                        sedeMap.put("nombre", sede.getNombre());
                        sedeMap.put("nit", sede.getNit());
                        sedeMap.put("direccion", sede.getDireccion());
                        sedeMap.put("localidad", sede.getLocalidad() != null ? sede.getLocalidad().name() : null);
                        sedeMap.put("barrio", sede.getBarrio());
                        sedeMap.put("capacidad", sede.getCapacidad());
                        sedeMap.put("tarifaPlenaC", sede.getTarifaPlenaC());
                        sedeMap.put("tarifaPlenaM", sede.getTarifaPlenaM());
                        sedeMap.put("tarifaMinutoC", sede.getTarifaMinutoC());
                        sedeMap.put("tarifaMinutoM", sede.getTarifaMinutoM());
                        sedeMap.put("horarioSede", sede.getHorarioSede());
                        sedeMap.put("estado", sede.getEstado() != null ? sede.getEstado().name() : null);

                        return sedeMap;
                    })
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
            // Actualiza otros campos según necesites

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
            List<Usuario> usuarios = usuarioService.findAll();
            List<Sede> sedes = sedeService.findAll();

            // ---- USUARIOS ----
            long usuariosActivos = usuarios.stream()
                    .filter(u -> u.getEstado() == EstadoGeneral.ACTIVO)
                    .count();

            double porcentajeUsuarios = usuarios.isEmpty() ? 0 :
                    (usuariosActivos * 100.0 / usuarios.size());

            // ---- SEDES ----
            long sedesActivas = sedes.stream()
                    .filter(s -> s.getEstado() == EstadoGeneral.ACTIVO)
                    .count();

            double porcentajeSedes = sedes.isEmpty() ? 0 :
                    (sedesActivas * 100.0 / sedes.size());

            // ---- INGRESOS (EJEMPLO O PLACEHOLDER) ----
            double ingresosTotales = calcularIngresosTotales();

            // ---- MAPA DE RESPUESTA ----
            Map<String, Object> indicadores = new HashMap<>();
            indicadores.put("totalUsuarios", usuarios.size());
            indicadores.put("usuariosActivos", usuariosActivos);
            indicadores.put("porcentajeUsuarios", Math.round(porcentajeUsuarios));

            indicadores.put("totalSedes", sedes.size());
            indicadores.put("sedesActivas", sedesActivas);
            indicadores.put("porcentajeSedes", Math.round(porcentajeSedes));

            indicadores.put("ingresosTotales", ingresosTotales);
            indicadores.put("porcentajeIngresos", 85); // Temporal

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

            // Convertir a listas para Chart.js
            List<String> labels = new ArrayList<>(conteo.keySet());
            List<Long> data = new ArrayList<>(conteo.values());

            return ResponseEntity.ok(Map.of(
                    "labels", labels,
                    "data", data
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/api/grafica/ingresos")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getGraficaIngresos() {
        try {
            // Implementa tu lógica real de ingresos mensuales
            List<String> labels = List.of("Ene", "Feb", "Mar", "Abr", "May", "Jun",
                    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic");
            List<Integer> data = List.of(12000, 19000, 15000, 25000, 22000, 30000,
                    28000, 35000, 32000, 40000, 38000, 45000);

            return ResponseEntity.ok(Map.of(
                    "labels", labels,
                    "data", data
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/api/grafica/sedes")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getGraficaSedes() {
        try {
            List<Sede> sedes = sedeService.findAll();

            // Agrupar por nombre y capacidad
            List<String> labels = sedes.stream()
                    .map(Sede::getNombre)
                    .collect(Collectors.toList());
            List<Integer> data = sedes.stream()
                    .map(Sede::getCapacidad)
                    .collect(Collectors.toList());

            return ResponseEntity.ok(Map.of(
                    "labels", labels,
                    "data", data
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // ============================================
    // REPORTES (PDF y EXCEL)
    // ============================================

    @GetMapping("/reporte/usuarios/pdf")
    @ResponseBody  // ✅ AGREGADO para que retorne bytes directamente
    public ResponseEntity<byte[]> generarReportePDF() {
        try {
            // ✅ CAMBIO: listarTodos() → findAll()
            List<Usuario> usuarios = usuarioService.findAll();

            if (usuarios.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NO_CONTENT).body(null);
            }

            // Generar el PDF
            ByteArrayOutputStream baos = reporteService.generarReportePDF(usuarios);

            // Preparar headers para la descarga
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);

            String filename = "reporte_usuarios_AparcaYA_" +
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
    @ResponseBody  // ✅ AGREGADO para que retorne bytes directamente
    public ResponseEntity<byte[]> generarReporteExcel() {
        try {
            // ✅ CAMBIO: listarTodos() → findAll()
            List<Usuario> usuarios = usuarioService.findAll();

            if (usuarios.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NO_CONTENT).body(null);
            }

            // Generar el Excel
            ByteArrayOutputStream baos = reporteService.generarReporteExcel(usuarios);

            // Preparar headers para la descarga
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));

            String filename = "reporte_usuarios_AparcaYA_" +
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

    // ============================================
    // MÉTODOS AUXILIARES PRIVADOS
    // ============================================

    private double calcularIngresosTotales() {
        // Implementa tu lógica real de cálculo de ingresos
        // Por ejemplo, sumar todas las reservas pagadas
        return 85000.0; // Placeholder
    }


        // ==================== ENVÍO DE CORREOS ====================

    // Enviar correo unitario
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

    // Enviar correo masivo
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