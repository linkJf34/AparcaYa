package com.exe.AparcaYA.Controllers;

import com.exe.AparcaYA.Dto.UsuarioDTO;
import com.exe.AparcaYA.Entity.EmailLog;
import com.exe.AparcaYA.Entity.Sede;
import com.exe.AparcaYA.Entity.Usuario;
import com.exe.AparcaYA.Enum.Rolenum;
import com.exe.AparcaYA.Repository.EmailLogRepository;
import com.exe.AparcaYA.Service.*;
import com.exe.AparcaYA.Dto.SedeDTO;
import jakarta.mail.MessagingException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Controller
@RequestMapping("/admin")
@CrossOrigin(origins = "https://aparcaya.com")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    @Autowired private UsuarioService        usuarioService;
    @Autowired private SedeService           sedeService;
    @Autowired private ReporteService        reporteService;
    @Autowired private IEmailService         emailService;
    @Autowired private GeocodificacionService geocodificacionService;
    @Autowired private LogAccesoService      logAccesoService;
    @Autowired private EmailLogRepository    emailLogRepository;

    // =====================================================================
    // USUARIOS
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
            if (usuarioService.findById(id).isEmpty())
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("mensaje", "Usuario no encontrado"));
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
            if (usuarioOpt.isEmpty())
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("mensaje", "Usuario no encontrado"));

            Usuario usuario = usuarioOpt.get();
            if (campos.containsKey("nombre"))   usuario.setNombre(campos.get("nombre"));
            if (campos.containsKey("correo"))   usuario.setCorreo(campos.get("correo"));
            if (campos.containsKey("telefono")) usuario.setTelefono(campos.get("telefono"));
            if (campos.containsKey("rol"))      usuario.setRol(Rolenum.valueOf(campos.get("rol")));
            if (campos.containsKey("estado"))   usuario.setEstado(com.exe.AparcaYA.Enum.EstadoGeneral.valueOf(campos.get("estado")));

            usuarioService.save(usuario);
            return ResponseEntity.ok(Map.of("mensaje", "Usuario actualizado correctamente"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("mensaje", "Valor inválido: " + e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("mensaje", "Error actualizando usuario: " + e.getMessage()));
        }
    }

    // =====================================================================
    // SEDES
    // =====================================================================

    @GetMapping("/api/sedes")
    @ResponseBody
    public ResponseEntity<List<SedeDTO>> getSedes() {
        try {
            return ResponseEntity.ok(sedeService.findAll().stream()
                    .map(SedeDTO::fromEntity)
                    .collect(Collectors.toList()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/api/sedes/{id}")
    @ResponseBody
    public ResponseEntity<Sede> getSede(@PathVariable Long id) {
        return sedeService.findById(id).map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/api/sedes/eliminar/{id}")
    @ResponseBody
    public ResponseEntity<Map<String, String>> eliminarSede(@PathVariable Long id) {
        try {
            if (sedeService.findById(id).isEmpty())
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("mensaje", "Sede no encontrada"));
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
            if (sedeOpt.isEmpty())
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("mensaje", "Sede no encontrada"));

            Sede sede = sedeOpt.get();
            boolean direccionCambio = false;

            if (campos.containsKey("nombre"))
                sede.setNombre((String) campos.get("nombre"));
            if (campos.containsKey("capacidad"))
                sede.setCapacidad(((Number) campos.get("capacidad")).intValue());
            if (campos.containsKey("estado"))
                sede.setEstado(com.exe.AparcaYA.Enum.EstadoGeneral
                        .valueOf((String) campos.get("estado")));
            if (campos.containsKey("direccion")) {
                String nueva = (String) campos.get("direccion");
                if (!nueva.equals(sede.getDireccion())) {
                    sede.setDireccion(nueva);
                    direccionCambio = true;
                }
            }

            if (direccionCambio) {
                String localidad = sede.getLocalidad() != null ? sede.getLocalidad().name() : null;
                geocodificacionService.geocodificar(sede.getDireccion(), localidad, sede.getBarrio())
                        .ifPresent(coords -> {
                            sede.setLatitud(coords[0]);
                            sede.setLongitud(coords[1]);
                        });
            }

            sedeService.save(sede);
            return ResponseEntity.ok(Map.of("mensaje", "Sede actualizada correctamente"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("mensaje", "Valor inválido: " + e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("mensaje", "Error actualizando sede: " + e.getMessage()));
        }
    }

    @PostMapping("/api/sedes/geocodificar-todas")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> geocodificarTodasLasSedes() {
        List<Sede> sedes = sedeService.findAll();
        List<String> resueltas = new ArrayList<>();
        List<String> fallidas  = new ArrayList<>();

        for (Sede sede : sedes) {
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
                                    resueltas.add(sede.getNombre() + " → [" + coords[0] + ", " + coords[1] + "]");
                                },
                                () -> fallidas.add(sede.getNombre() + " (no encontrado)")
                        );
                Thread.sleep(1200);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                fallidas.add(sede.getNombre() + " (interrumpido)");
            } catch (Exception e) {
                fallidas.add(sede.getNombre() + " (error: " + e.getMessage() + ")");
            }
        }

        Map<String, Object> resultado = new LinkedHashMap<>();
        resultado.put("total",             sedes.size());
        resultado.put("resueltas",         resueltas.size());
        resultado.put("fallidas",          fallidas.size());
        resultado.put("detalle_resueltas", resueltas);
        resultado.put("detalle_fallidas",  fallidas);
        return ResponseEntity.ok(resultado);
    }

    // =====================================================================
    // INDICADORES
    // =====================================================================

    @GetMapping("/api/indicadores")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getIndicadores() {
        try {
            long totalUsuarios   = usuarioService.contarTotal();
            long usuariosActivos = usuarioService.contarActivos();
            long totalSedes      = sedeService.contarTotal();
            long sedesActivas    = sedeService.contarActivas();

            Map<String, Object> indicadores = new HashMap<>();
            indicadores.put("totalUsuarios",      totalUsuarios);
            indicadores.put("usuariosActivos",    usuariosActivos);
            indicadores.put("porcentajeUsuarios", totalUsuarios == 0 ? 0 : Math.round(usuariosActivos * 100.0 / totalUsuarios));
            indicadores.put("totalSedes",         totalSedes);
            indicadores.put("sedesActivas",       sedesActivas);
            indicadores.put("porcentajeSedes",    totalSedes == 0 ? 0 : Math.round(sedesActivas * 100.0 / totalSedes));
            indicadores.put("ingresosPorRol",     usuarioService.findAll().stream()
                    .collect(Collectors.groupingBy(u -> u.getRol().name(), Collectors.counting())));
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
            Map<String, Long> conteo = usuarios.stream()
                    .collect(Collectors.groupingBy(u -> u.getRol().name(), Collectors.counting()));

            Map<String, Long> resultado = new LinkedHashMap<>();
            for (Rolenum rol : Rolenum.values())
                resultado.put(rol.name(), conteo.getOrDefault(rol.name(), 0L));

            return ResponseEntity.ok(Map.of(
                    "porRol",   resultado,
                    "total",    (long) usuarios.size(),
                    "etiqueta", "Usuarios registrados por rol"
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // =====================================================================
    // GRÁFICAS
    // =====================================================================

    @GetMapping("/api/grafica/usuarios-rol")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getGraficaUsuariosRol() {
        try {
            Map<String, Long> conteo = usuarioService.findAll().stream()
                    .collect(Collectors.groupingBy(u -> u.getRol().name(), Collectors.counting()));
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
            List<String> labels  = List.of("Ene","Feb","Mar","Abr","May","Jun",
                    "Jul","Ago","Sep","Oct","Nov","Dic");
            long mesActual       = logAccesoService.contarAccesosMesActual();
            long mesAnterior     = logAccesoService.contarAccesosMesAnterior();
            long acumuladoAnio   = logAccesoService.contarAccesosAnioActual();
            Map<String, List<Long>> porRol = logAccesoService.serieMensualPorRol();

            List<Long> dataTotal = new ArrayList<>();
            for (int i = 0; i < 12; i++) {
                int mes = i;
                dataTotal.add(porRol.values().stream().mapToLong(s -> s.get(mes)).sum());
            }

            long variacion = mesAnterior > 0
                    ? Math.round(((double)(mesActual - mesAnterior) / mesAnterior) * 100) : 0;

            Map<String, Object> respuesta = new LinkedHashMap<>();
            respuesta.put("labels",        labels);
            respuesta.put("data",          dataTotal);
            respuesta.put("porRol",        porRol);
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
            Map<String, Object> estadisticas = new HashMap<>();
            estadisticas.put("totalUsuarios", usuarioService.contarTotal());
            estadisticas.put("totalSedes",    sedeService.contarTotal());
            estadisticas.put("metaUsuarios",  50);
            estadisticas.put("metaSedes",     10);
            estadisticas.put("ingresosTotal", 0);
            estadisticas.put("metaIngresos",  100000);
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
    // REPORTES
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
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(("Error al generar el Excel: " + e.getMessage()).getBytes());
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

    @GetMapping("/api/correos/clientes")
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

    @GetMapping("/api/correos/sedes")
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

    @GetMapping("/api/correos/trabajadores")
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

    @GetMapping("/api/correos/historial")
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

    @GetMapping("/api/correos/estadisticas")
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

    @GetMapping("/api/correos/plantilla-preview")
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
}