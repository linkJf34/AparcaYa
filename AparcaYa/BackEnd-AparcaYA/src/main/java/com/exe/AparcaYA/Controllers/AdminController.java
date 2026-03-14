package com.exe.AparcaYA.Controllers;

import com.exe.AparcaYA.Dto.UsuarioDTO;
import com.exe.AparcaYA.Entity.Sede;
import com.exe.AparcaYA.Entity.Usuario;
import com.exe.AparcaYA.Enum.Rolenum;
import com.exe.AparcaYA.Service.*;
import com.exe.AparcaYA.Dto.SedeDTO;
import jakarta.mail.MessagingException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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

// ✅ FIX A-05: CORS restringido al origen de producción.
// Antes: origins = "*" — cualquier sitio externo podía hacer requests
//        autenticados a /admin/api/usuarios, /admin/api/sedes/eliminar/*, etc.
//        si el usuario tenía una sesión activa (CSRF amplificado por CORS abierto).
// Ahora: solo el origen propio puede hacer requests cross-origin.
//        Cambiar "https://aparcaya.com" por el dominio real de producción.
@CrossOrigin(origins = "https://aparcaya.com")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    @Autowired
    private UsuarioService usuarioService;

    @Autowired
    private SedeService sedeService;

    @Autowired
    private ReporteService reporteService;

    @Autowired
    private IEmailService emailService;

    @Autowired
    private GeocodificacionService geocodificacionService;

    @Autowired
    private LogAccesoService logAccesoService;
    // =====================================================================
    // VISTA PRINCIPAL DEL DASHBOARD
    //
    // ✅ FIX A-02: Ruta duplicada eliminada.
    // Antes: existían DOS rutas que servían DashboardAdmin.html:
    //   - GET /dashboard/administradorGeneral  (AuthController)
    //   - GET /admin/dashboard/administradorGeneral (AdminController) ← esta
    //
    // El AuthenticationSuccessHandler redirige a /dashboard/administradorGeneral
    // (sin /admin), así que /admin/dashboard/administradorGeneral era inaccesible
    // en el flujo normal y solo generaba confusión.
    //
    // La vista la sirve AuthController.dashboardAdminGeneral() en:
    //   GET /dashboard/administradorGeneral
    //
    // Este controller solo expone las APIs en /admin/api/**
    // =====================================================================

    // =====================================================================
    // APIS PARA USUARIOS
    // =====================================================================

    @GetMapping("/api/usuarios")
    @ResponseBody
    public ResponseEntity<List<UsuarioDTO>> getUsuarios() {
        try {
            List<UsuarioDTO> usuarios = usuarioService.findAll()
                    .stream()
                    .map(UsuarioDTO::fromEntity)
                    .collect(Collectors.toList());
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
            @RequestBody Map<String, String> campos) {
        try {
            Optional<Usuario> usuarioOpt = usuarioService.findById(id);
            if (usuarioOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("mensaje", "Usuario no encontrado"));
            }

            // Whitelist explícita — solo campos permitidos son aplicados.
            // contrasena, sedeAsignada, tipoCliente y cualquier otro campo sensible
            // son ignorados aunque vengan en el body del request.
            Usuario usuario = usuarioOpt.get();
            if (campos.containsKey("nombre"))   usuario.setNombre(campos.get("nombre"));
            if (campos.containsKey("correo"))   usuario.setCorreo(campos.get("correo"));
            if (campos.containsKey("telefono")) usuario.setTelefono(campos.get("telefono"));
            if (campos.containsKey("rol"))      usuario.setRol(com.exe.AparcaYA.Enum.Rolenum.valueOf(campos.get("rol")));
            if (campos.containsKey("estado"))   usuario.setEstado(com.exe.AparcaYA.Enum.EstadoGeneral.valueOf(campos.get("estado")));

            usuarioService.save(usuario);
            return ResponseEntity.ok(Map.of("mensaje", "Usuario actualizado correctamente"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("mensaje", "Valor inválido para rol o estado: " + e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("mensaje", "Error actualizando usuario: " + e.getMessage()));
        }
    }

    // =====================================================================
    // APIS PARA SEDES
    // =====================================================================

    @GetMapping("/api/sedes")
    @ResponseBody
    public ResponseEntity<List<SedeDTO>> getSedes() {
        try {
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
            @RequestBody Map<String, Object> campos) {
        try {
            Optional<Sede> sedeOpt = sedeService.findById(id);
            if (sedeOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("mensaje", "Sede no encontrada"));
            }

            Sede sede = sedeOpt.get();
            boolean direccionCambio = false;

            if (campos.containsKey("nombre"))    sede.setNombre((String) campos.get("nombre"));
            if (campos.containsKey("capacidad")) sede.setCapacidad(((Number) campos.get("capacidad")).intValue());
            if (campos.containsKey("estado"))    sede.setEstado(com.exe.AparcaYA.Enum.EstadoGeneral.valueOf((String) campos.get("estado")));

            if (campos.containsKey("direccion")) {
                String nuevaDireccion = (String) campos.get("direccion");
                if (!nuevaDireccion.equals(sede.getDireccion())) {
                    sede.setDireccion(nuevaDireccion);
                    direccionCambio = true;
                }
            }

            // Geocodificar solo si la dirección cambió (evita llamadas innecesarias a Nominatim)
            if (direccionCambio) {
                String localidad = sede.getLocalidad() != null ? sede.getLocalidad().name() : null;
                 geocodificacionService.geocodificar(sede.getDireccion(), localidad, sede.getBarrio())
                        .ifPresentOrElse(
                                coords -> {
                                    sede.setLatitud(coords[0]);
                                    sede.setLongitud(coords[1]);
                                },
                                () -> {
                                    // Si Nominatim falla, limpiar coords obsoletas en lugar de dejar las anteriores
                                    sede.setLatitud(null);
                                    sede.setLongitud(null);
                                }
                        );
            }

            sedeService.save(sede);
            return ResponseEntity.ok(Map.of("mensaje", "Sede actualizada correctamente"));

        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("mensaje", "Valor inválido para estado: " + e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("mensaje", "Error actualizando sede: " + e.getMessage()));
        }
    }

    // =====================================================================
    // MIGRACIÓN — Geocodificar sedes existentes sin coordenadas
    //
    // Agregar este método al AdminController.java existente,
    // junto a los demás endpoints de /api/sedes.
    //
    // USO: llamar UNA SOLA VEZ desde el navegador o Postman:
    //   POST http://localhost:8080/admin/api/sedes/geocodificar-todas
    //
    // Qué hace:
    //   - Busca todas las sedes con latitud = null
    //   - Las geocodifica usando GeocodificacionService (Nominatim)
    //   - Guarda lat/lon en BD
    //   - Respeta el rate limit de Nominatim (1 req/seg entre sedes)
    //   - Devuelve un resumen de cuántas se resolvieron y cuáles fallaron
    //
    // Después de ejecutarlo, el mapa carga instantáneamente sin llamar a Nominatim.
    // =====================================================================

    @PostMapping("/api/sedes/geocodificar-todas")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> geocodificarTodasLasSedes() {
        List<Sede> sedes = sedeService.findAll();

        List<String> resueltas = new ArrayList<>();
        List<String> fallidas  = new ArrayList<>();

        for (Sede sede : sedes) {
            // Solo procesar sedes sin coordenadas
            if (sede.getLatitud() != null && sede.getLongitud() != null) {
                resueltas.add(sede.getNombre() + " (ya tenía coordenadas)");
                continue;
            }

            String localidad = sede.getLocalidad() != null ? sede.getLocalidad().name() : null;

            try {
                geocodificacionService.geocodificar(sede.getDireccion(), localidad, sede.getBarrio())
                        .ifPresentOrElse(
                                coords -> {
                                    sede.setLatitud(coords[0]);
                                    sede.setLongitud(coords[1]);
                                    sedeService.save(sede);
                                    resueltas.add(sede.getNombre() +
                                            " → [" + coords[0] + ", " + coords[1] + "]");
                                },
                                () -> fallidas.add(sede.getNombre() +
                                        " (Nominatim no encontró: " + sede.getDireccion() + ")")
                        );

                // Respetar rate limit de Nominatim entre sedes
                Thread.sleep(1200);

            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                fallidas.add(sede.getNombre() + " (interrumpido)");
            } catch (Exception e) {
                fallidas.add(sede.getNombre() + " (error: " + e.getMessage() + ")");
            }
        }

        Map<String, Object> resultado = new LinkedHashMap<>();
        resultado.put("total",     sedes.size());
        resultado.put("resueltas", resueltas.size());
        resultado.put("fallidas",  fallidas.size());
        resultado.put("detalle_resueltas", resueltas);
        resultado.put("detalle_fallidas",  fallidas);

        return ResponseEntity.ok(resultado);
    }

    // =====================================================================
    // APIS PARA INDICADORES
    // =====================================================================

    @GetMapping("/api/indicadores")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getIndicadores() {
        try {
            long totalUsuarios   = usuarioService.contarTotal();
            long usuariosActivos = usuarioService.contarActivos();
            long totalSedes      = sedeService.contarTotal();
            long sedesActivas    = sedeService.contarActivas();

            double porcentajeUsuarios = totalUsuarios == 0 ? 0 : (usuariosActivos * 100.0 / totalUsuarios);
            double porcentajeSedes    = totalSedes == 0 ? 0 : (sedesActivas * 100.0 / totalSedes);

            Map<String, Object> indicadores = new HashMap<>();
            indicadores.put("totalUsuarios",      totalUsuarios);
            indicadores.put("usuariosActivos",    usuariosActivos);
            indicadores.put("porcentajeUsuarios", Math.round(porcentajeUsuarios));
            indicadores.put("totalSedes",         totalSedes);
            indicadores.put("sedesActivas",       sedesActivas);
            indicadores.put("porcentajeSedes",    Math.round(porcentajeSedes));
            Map<String, Long> ingresosPorRol = usuarioService.findAll()
                    .stream()
                    .collect(Collectors.groupingBy(
                            u -> u.getRol().name(),
                            Collectors.counting()
                    ));
            indicadores.put("ingresosPorRol", ingresosPorRol);

            return ResponseEntity.ok(indicadores);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/api/indicadores/ingresos-por-rol")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getIngresosPorRol() {
        try {
            List<Usuario> usuarios = usuarioService.findAll();

            // Contar por rol usando el enum real
            Map<String, Long> conteo = usuarios.stream()
                    .collect(Collectors.groupingBy(
                            u -> u.getRol().name(),
                            Collectors.counting()
                    ));

            // Garantizar que todos los roles aparezcan aunque tengan 0
            Map<String, Long> resultado = new LinkedHashMap<>();
            for (Rolenum rol : Rolenum.values()) {
                resultado.put(rol.name(), conteo.getOrDefault(rol.name(), 0L));
            }

            long totalUsuarios = usuarios.size();

            return ResponseEntity.ok(Map.of(
                    "porRol",   resultado,
                    "total",    totalUsuarios,
                    "etiqueta", "Usuarios registrados por rol"
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // =====================================================================
    // APIS PARA GRÁFICAS
    // =====================================================================

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

            return ResponseEntity.ok(Map.of(
                    "labels", new ArrayList<>(conteo.keySet()),
                    "data",   new ArrayList<>(conteo.values())
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/api/grafica/accesos")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getGraficaAccesos() {
        try {
            List<String> labels    = List.of("Ene","Feb","Mar","Abr","May","Jun",
                    "Jul","Ago","Sep","Oct","Nov","Dic");
            long mesActual         = logAccesoService.contarAccesosMesActual();
            long mesAnterior       = logAccesoService.contarAccesosMesAnterior();
            long acumuladoAnio     = logAccesoService.contarAccesosAnioActual();

            // Desglose por rol — nuevo
            Map<String, List<Long>> porRol = logAccesoService.serieMensualPorRol();

            // Serie total (suma de todos los roles por mes) — para compatibilidad
            List<Long> dataTotal = new ArrayList<>();
            for (int i = 0; i < 12; i++) {
                int mes = i;
                long suma = porRol.values().stream()
                        .mapToLong(serie -> serie.get(mes))
                        .sum();
                dataTotal.add(suma);
            }

            long variacion = 0;
            if (mesAnterior > 0) {
                variacion = Math.round(
                        ((double)(mesActual - mesAnterior) / mesAnterior) * 100
                );
            }

            Map<String, Object> respuesta = new LinkedHashMap<>();
            respuesta.put("labels",        labels);
            respuesta.put("data",          dataTotal);   // serie total (retrocompatible)
            respuesta.put("porRol",        porRol);       // NUEVO — desglose por rol
            respuesta.put("mesActual",     mesActual);
            respuesta.put("mesAnterior",   mesAnterior);
            respuesta.put("acumuladoAnio", acumuladoAnio);
            respuesta.put("variacion",     variacion);

            return ResponseEntity.ok(respuesta);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/api/estadisticas/generales")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getEstadisticasGenerales() {
        try {
            long totalUsuarios = usuarioService.contarTotal();
            long totalSedes    = sedeService.contarTotal();

            Map<String, Object> estadisticas = new HashMap<>();
            estadisticas.put("totalUsuarios", totalUsuarios);
            estadisticas.put("totalSedes",    totalSedes);
            estadisticas.put("metaUsuarios",  50);
            estadisticas.put("metaSedes",     10);
            estadisticas.put("ingresosTotal", 0);
            estadisticas.put("metaIngresos",  100000);
            estadisticas.put("advertencia",   "ingresosTotales pendiente de implementación real");

            return ResponseEntity.ok(estadisticas);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/api/grafica/sedes")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getGraficaSedes() {
        try {
            List<Sede> sedes = sedeService.findAll();
            return ResponseEntity.ok(Map.of(
                    "labels", sedes.stream().map(Sede::getNombre).collect(Collectors.toList()),
                    "data",   sedes.stream().map(Sede::getCapacidad).collect(Collectors.toList())
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // =====================================================================
    // REPORTES (PDF y EXCEL)
    // =====================================================================

    @GetMapping("/reporte/usuarios/pdf")
    @ResponseBody
    public ResponseEntity<byte[]> generarReportePDF() {
        try {
            List<Usuario> usuarios = usuarioService.findAll();
            if (usuarios.isEmpty()) return ResponseEntity.status(HttpStatus.NO_CONTENT).body(null);

            ByteArrayOutputStream baos = reporteService.generarReportePDF(usuarios);
            String filename = "reporte_usuarios_AparcaYA_" +
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
    @ResponseBody
    public ResponseEntity<byte[]> generarReporteExcel() {
        try {
            List<Usuario> usuarios = usuarioService.findAll();
            if (usuarios.isEmpty()) return ResponseEntity.status(HttpStatus.NO_CONTENT).body(null);

            ByteArrayOutputStream baos = reporteService.generarReporteExcel(usuarios);
            String filename = "reporte_usuarios_AparcaYA_" +
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

    // =====================================================================
    // ENVÍO DE CORREOS
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

    @PostMapping("/correo/masivo")
    @ResponseBody
    public ResponseEntity<Map<String, String>> enviarCorreoMasivo(
            @RequestParam(name = "seleccionados", required = false) List<String> seleccionados,
            @RequestParam String asunto,
            @RequestParam String mensaje) {

        Map<String, String> response = new HashMap<>();

        if (seleccionados == null || seleccionados.isEmpty()) {
            response.put("status",  "error");
            response.put("message", "No se seleccionó ningún correo.");
            return ResponseEntity.badRequest().body(response);
        }

        try {
            emailService.enviarCorreoMasivo(seleccionados, asunto, mensaje);
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

    // =====================================================================
// APIS PARA FILTRO DE DESTINATARIOS — MÓDULO CORREOS ADMIN
// =====================================================================

    @GetMapping("/api/correos/clientes")
    @ResponseBody
    public ResponseEntity<List<Map<String, String>>> getCorreosClientes() {
        try {
            List<Map<String, String>> resultado = usuarioService.findAll()
                    .stream()
                    .filter(u -> u.getRol() == Rolenum.CLIENTE)
                    .map(u -> Map.of(
                            "nombre", u.getNombre() != null ? u.getNombre() : "",
                            "correo", u.getCorreo() != null ? u.getCorreo() : "",
                            "rol",    "CLIENTE"
                    ))
                    .collect(Collectors.toList());
            return ResponseEntity.ok(resultado);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/api/correos/sedes")
    @ResponseBody
    public ResponseEntity<List<Map<String, String>>> getCorreosSedes() {
        try {
            List<Map<String, String>> resultado = usuarioService.findAll()
                    .stream()
                    .filter(u -> u.getRol() == Rolenum.ADMINISTRADOR_SEDE)
                    .map(u -> Map.of(
                            "nombre", u.getNombre() != null ? u.getNombre() : "",
                            "correo", u.getCorreo() != null ? u.getCorreo() : "",
                            "rol",    "ADMINISTRADOR_SEDE"
                    ))
                    .collect(Collectors.toList());
            return ResponseEntity.ok(resultado);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/api/correos/trabajadores")
    @ResponseBody
    public ResponseEntity<List<Map<String, String>>> getCorreosTrabajadores() {
        try {
            List<Map<String, String>> resultado = usuarioService.findAll()
                    .stream()
                    .filter(u -> u.getRol() == Rolenum.OPERARIO)
                    .map(u -> Map.of(
                            "nombre", u.getNombre() != null ? u.getNombre() : "",
                            "correo", u.getCorreo() != null ? u.getCorreo() : "",
                            "rol",    "OPERARIO"
                    ))
                    .collect(Collectors.toList());
            return ResponseEntity.ok(resultado);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}