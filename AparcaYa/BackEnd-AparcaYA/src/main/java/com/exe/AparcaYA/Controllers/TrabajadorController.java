package com.exe.AparcaYA.Controllers;

import com.exe.AparcaYA.Entity.*;
import com.exe.AparcaYA.Enum.*;
import com.exe.AparcaYA.Service.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/trabajador")
@PreAuthorize("hasRole('OPERARIO')")
@CrossOrigin(origins = "${app.cors.allowed-origins:http://localhost:8080}")
public class TrabajadorController {

    private final VehiculoService              vehiculoService;
    private final RegistroEntradaSalidaService registroService;
    private final ReservacionService           reservacionService;
    private final UsuarioService               usuarioService;
    private final SedeService                  sedeService;
    private final CupoService                  cupoService;
    private final TarifaService                tarifaService;
    private final PasswordEncoder              passwordEncoder;


    // =========================================================
    // MÉTODOS AUXILIARES
    // =========================================================

    private Usuario getUsuarioAutenticado() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            log.warn("No hay autenticación activa");
            return null;
        }
        Optional<Usuario> usuario = usuarioService.findByCorreo(auth.getName());
        if (usuario.isEmpty()) {
            log.error("No se encontró usuario con correo: {}", auth.getName());
            return null;
        }
        Usuario user = usuario.get();
        if (user.getSedeAsignada() == null) {
            log.error("El usuario {} no tiene sede asignada", user.getNombre());
            return null;
        }
        return user;
    }

    private Sede getSedeDelUsuarioAutenticado() {
        Usuario usuario = getUsuarioAutenticado();
        return usuario != null ? usuario.getSedeAsignada() : null;
    }

    // CORRECCIÓN — ya no lee desde Sede, obtiene Tarifa desde BD
    private Tarifa getTarifaDeSede(Sede sede) {
        List<Tarifa> tarifas = tarifaService.findBySede_IdSede(sede.getIdSede());
        if (tarifas.isEmpty()) {
            throw new RuntimeException("No hay tarifas configuradas para la sede: "
                    + sede.getNombre());
        }
        return tarifas.get(0);
    }

    // CORRECCIÓN — recibe Tarifa en lugar de Sede
    private double[] resolverTarifas(Tarifa tarifa, TipoVehiculo tipo) {
        return switch (tipo) {
            case CARRO     -> new double[]{ tarifa.getTarifaPlenaC(), tarifa.getTarifaMinutoC() };
            case MOTO      -> new double[]{ tarifa.getTarifaPlenaM(), tarifa.getTarifaMinutoM() };
            case BICICLETA -> new double[]{ tarifa.getTarifaPlenaB(), tarifa.getTarifaMinutoB() };
            case OTRO -> null;
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

    // =========================================================
    // INDICADORES
    // =========================================================

    @GetMapping("/indicadores")
    public ResponseEntity<Map<String, Object>> getIndicadores() {
        try {
            Sede sede = getSedeDelUsuarioAutenticado();
            if (sede == null) return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "No se encontró una sede asignada"));

            List<RegistroEntradaSalida> vehiculosActivos =
                    registroService.findBySedeAndEstado(sede, EstadoRegistro.ACTIVO);
            int ocupacionActual = vehiculosActivos.size();
            int capacidadTotal  = sede.getCapacidad();

            LocalDateTime inicioHoy = LocalDate.now().atStartOfDay();

            // CORRECCIÓN — ingresos desde Pago via sumIngresosEntreFechas
            BigDecimal ingresosDia = registroService
                    .sumIngresosEntreFechas(sede, inicioHoy, inicioHoy.plusDays(1));

            List<RegistroEntradaSalida> registrosHoy =
                    registroService.findBySedeAndFechaHoraEntradaBetween(
                            sede, inicioHoy, inicioHoy.plusDays(1));

            long pendientesCobro = registrosHoy.stream()
                    .filter(r -> r.getEstado() == EstadoRegistro.FINALIZADO)
                    .count();

            // CORRECCIÓN — tarifas desde Tarifa, no desde Sede
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
            // CORRECCIÓN — desde Tarifa
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
    // VEHÍCULOS ACTIVOS
    // =========================================================

    @GetMapping("/vehiculos-activos")
    public ResponseEntity<?> getVehiculosActivos() {
        try {
            Sede sede = getSedeDelUsuarioAutenticado();
            if (sede == null) return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "No se encontró una sede asignada"));

            // CORRECCIÓN — tarifa desde Tarifa
            Tarifa tarifa = getTarifaDeSede(sede);

            List<RegistroEntradaSalida> registros =
                    registroService.findBySedeAndEstado(sede, EstadoRegistro.ACTIVO);

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
                Duration duracion = Duration.between(
                        registro.getFechaHoraEntrada(), LocalDateTime.now());
                v.put("tiempoTranscurrido",    formatearTiempo(duracion));
                v.put("segundosTranscurridos", duracion.getSeconds());
                // CORRECCIÓN — tarifas desde Tarifa
                double[] tarifas = resolverTarifas(tarifa, registro.getVehiculo().getTipo());
                long minutosTranscurridos = duracion.toMinutes();
                v.put("cobroEstimadoPlena",
                        BigDecimal.valueOf(tarifas[0]).setScale(2, RoundingMode.HALF_UP));
                v.put("cobroEstimadoMinuto",
                        BigDecimal.valueOf(minutosTranscurridos * tarifas[1])
                                .setScale(2, RoundingMode.HALF_UP));
                v.put("cupo", registro.getCupo() != null
                        ? registro.getCupo().getCodigo() : "Sin asignar");
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
    public ResponseEntity<?> getVehiculosPendientesCobro() {
        try {
            Sede sede = getSedeDelUsuarioAutenticado();
            if (sede == null) return ResponseEntity.ok(new ArrayList<>());

            List<RegistroEntradaSalida> registros =
                    registroService.findBySedeAndEstado(sede, EstadoRegistro.FINALIZADO);

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
                // CORRECCIÓN — precio desde Pago asociado
                v.put("precio", registro.getPago() != null
                        ? registro.getPago().getMonto() : null);
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
            @RequestParam(required = false) String estado) {
        try {
            Sede sede = getSedeDelUsuarioAutenticado();
            if (sede == null) return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "No se encontró una sede asignada"));

            List<RegistroEntradaSalida> registros =
                    registroService.findHistorialBySede(sede);

            if (fecha != null && !fecha.isEmpty())
                registros = registros.stream()
                        .filter(r -> r.getFechaHoraEntrada().toLocalDate()
                                .equals(LocalDate.parse(fecha)))
                        .collect(Collectors.toList());
            if (estado != null && !estado.isEmpty())
                registros = registros.stream()
                        .filter(r -> r.getEstado() ==
                                EstadoRegistro.valueOf(estado.toUpperCase()))
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
                // CORRECCIÓN — precio y metodoPago desde Pago asociado
                item.put("precio",     registro.getPago() != null
                        ? registro.getPago().getMonto() : null);
                item.put("metodoPago", registro.getPago() != null
                        ? registro.getPago().getMetodoPago() : null);
                Usuario cliente = registro.getVehiculo().getIdUsuario();
                item.put("clienteNombre",   cliente.getNombre());
                item.put("clienteTelefono", cliente.getTelefono());
                item.put("clienteEmail",    cliente.getCorreo());
                Duration duracion = registro.getFechaHoraSalida() != null
                        ? Duration.between(registro.getFechaHoraEntrada(),
                        registro.getFechaHoraSalida())
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
            @RequestBody Map<String, String> datos) {
        try {
            Sede sede          = getSedeDelUsuarioAutenticado();
            Usuario trabajador = getUsuarioAutenticado();

            List<RegistroEntradaSalida> vehiculosActivos =
                    registroService.findBySedeAndEstado(sede, EstadoRegistro.ACTIVO);
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
                // Nombre: fallback a "Visitante" si viene vacío (modo rápido)
                nuevoCliente.setNombre((nombre != null && !nombre.isBlank()) ? nombre : "Visitante");
                // Teléfono: genera uno único si viene vacío (modo rápido)
                String telefonoFinal = (telefono != null && !telefono.isBlank()
                        && !telefono.equals("0000000000"))
                        ? telefono : ("9" + sufijo).substring(0, 10);
                nuevoCliente.setTelefono(telefonoFinal);
                nuevoCliente.setCorreo(correo);
                // Cédula: genera sufijo numérico si viene vacía (modo rápido)
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
            try {
                anioResuelto = Integer.parseInt(anioStr.isEmpty() ? "2020" : anioStr);
            } catch (NumberFormatException e) { anioResuelto = 2020; }
            final int anio = anioResuelto;

            Optional<Vehiculo> vehiculoExistente = vehiculoService.findByPlaca(placa);
            if (vehiculoExistente.isPresent()) {
                if (registroService.findVehiculoActivo(vehiculoExistente.get()).isPresent()) {
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

            List<Cupo> cuposDisponibles =
                    cupoService.findBySedeAndEstado(sede, EstadoCupo.DISPONIBLE);
            Cupo cupoAsignado = cuposDisponibles.isEmpty() ? null : cuposDisponibles.get(0);

            RegistroEntradaSalida registro =
                    registroService.registrarEntrada(vehiculo, sede, cupoAsignado, trabajador);

            // CORRECCIÓN — tarifas desde Tarifa
            Tarifa tarifa    = getTarifaDeSede(sede);
            double[] tarifas = resolverTarifas(tarifa, tipoVehiculo);

            Map<String, Object> response = new HashMap<>();
            response.put("mensaje",       "Vehículo registrado exitosamente.");
            response.put("registroId",    registro.getIdRegistro());
            response.put("placa",         placa);
            response.put("clienteNombre", cliente.getNombre());
            response.put("horaEntrada",   registro.getFechaHoraEntrada().toString());
            response.put("cupo",          cupoAsignado != null
                    ? cupoAsignado.getCodigo() : "Sin asignar");
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
    public ResponseEntity<Map<String, Object>> registrarSalida(@PathVariable Long registroId) {
        try {
            Sede sede = getSedeDelUsuarioAutenticado();
            RegistroEntradaSalida registroExistente = registroService.findById(registroId)
                    .orElseThrow(() -> new RuntimeException("Registro no encontrado"));

            if (!registroExistente.getSede().getIdSede().equals(sede.getIdSede())) {
                log.warn("Operario de sede {} intentó registrar salida de registro {} (sede {})",
                        sede.getIdSede(), registroId, registroExistente.getSede().getIdSede());
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "No tiene permisos para operar sobre este registro"));
            }

            RegistroEntradaSalida registro = registroService.registrarSalida(registroId);
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
            // CORRECCIÓN — precio no existe en Registro, vendrá al confirmar cobro

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
            @RequestBody Map<String, String> datos) {
        try {
            Sede sede = getSedeDelUsuarioAutenticado();
            RegistroEntradaSalida registroExistente = registroService.findById(registroId)
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
                    registroService.confirmarCobroConTarifa(registroId, metodoPago, tipoTarifa);

            // ← try-catch separado — el cobro ya se completó, esto es opcional
            try {
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
            } catch (Exception ex) {
                log.warn("No se pudo actualizar reservación tras cobro {}: {}",
                        registroId, ex.getMessage());
            }

            Map<String, Object> response = new HashMap<>();
            response.put("mensaje",            "Cobro confirmado exitosamente");
            response.put("registroId",         registro.getIdRegistro());
            response.put("placa",              registro.getVehiculo().getPlaca());
            response.put("precio",             registro.getPago() != null
                    ? registro.getPago().getMonto() : null);
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
    public ResponseEntity<?> getOpcionesCobro(@PathVariable Long registroId) {
        try {
            Sede sede = getSedeDelUsuarioAutenticado();
            RegistroEntradaSalida registro = registroService.findById(registroId)
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

            // CORRECCIÓN — tarifas desde Tarifa
            Tarifa tarifa    = getTarifaDeSede(sede);
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
            response.put("tiempoTotal",
                    horas > 0 ? horas + "h " + minutos + "m" : minutos + "m");
            response.put("opciones", List.of(
                    Map.of("tipo", "PLENA", "nombre", "Tarifa Plena (Día Completo)",
                            "precio", tarifas[0], "descripcion", "Tarifa fija del día"),
                    Map.of("tipo", "MINUTO", "nombre", "Tarifa por Minuto",
                            "precio", precioMinuto,
                            "descripcion", minutosTranscurridos + " min × $"
                                    + (int) tarifas[1] + "/min"),
                    Map.of("tipo", "HORA", "nombre", "Tarifa por Hora",
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
    public ResponseEntity<?> getReservaciones() {
        try {
            Sede sede = getSedeDelUsuarioAutenticado();
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
            @PathVariable Long reservacionId) {
        try {
            Sede    sede       = getSedeDelUsuarioAutenticado(); // ← correcto
            Usuario trabajador = getUsuarioAutenticado();

            Reservacion reservacion = reservacionService.findById(reservacionId)
                    .orElseThrow(() -> new RuntimeException("Reservación no encontrada"));

            if (!reservacion.getCupo().getSede().getIdSede().equals(sede.getIdSede())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "Sin permisos sobre esta reservación"));
            }

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

    @PostMapping("/iniciar-reservacion/{reservacionId}")
    public ResponseEntity<Map<String, Object>> iniciarReservacion(
            @PathVariable Long reservacionId) {
        try {
            Sede    sede       = getSedeDelUsuarioAutenticado();
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

            reservacion.setEstado(EstadoReservacion.EN_CURSO);
            reservacionService.save(reservacion);

            // registroService ← nombre correcto en TrabajadorController
            RegistroEntradaSalida registro = registroService.registrarEntrada(
                    reservacion.getVehiculo(), sede, reservacion.getCupo(), trabajador);

            log.info("Reservacion {} iniciada — registro={} placa={}",
                    reservacionId, registro.getIdRegistro(),
                    reservacion.getVehiculo().getPlaca());

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

    @PostMapping("/rechazar-reservacion/{reservacionId}")
    public ResponseEntity<Map<String, Object>> rechazarReservacion(
            @PathVariable Long reservacionId) {
        try {
            Sede sede = getSedeDelUsuarioAutenticado();
            Reservacion reservacion = reservacionService.findById(reservacionId)
                    .orElseThrow(() -> new RuntimeException("Reservación no encontrada"));

            if (!reservacion.getCupo().getSede().getIdSede().equals(sede.getIdSede())) {
                log.warn("Operario de sede {} intentó rechazar reservación {} (sede {})",
                        sede.getIdSede(), reservacionId,
                        reservacion.getCupo().getSede().getIdSede());
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error",
                                "No tiene permisos para operar sobre esta reservación"));
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

            // PASADA 1: CLIENTES
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;
                try {
                    if (!"Cliente".equalsIgnoreCase(
                            getCellValueAsString(row.getCell(0)))) continue;
                    String nombre   = getCellValueAsString(row.getCell(1));
                    String telefono = getCellValueAsString(row.getCell(2));
                    String email    = getCellValueAsString(row.getCell(3));
                    String cedula   = getCellValueAsString(row.getCell(4));
                    if (nombre.trim().isEmpty() || email.trim().isEmpty()
                            || telefono.trim().isEmpty()) {
                        errores.add("Fila " + (i+1) + ": Faltan datos obligatorios"); continue;
                    }
                    if (usuarioService.findByCorreo(email.trim()).isPresent()) {
                        errores.add("Fila " + (i+1) + ": Email " + email
                                + " ya existe - OMITIDO"); continue;
                    }
                    if (usuarioService.findByTelefono(telefono.trim()) != null) {
                        errores.add("Fila " + (i+1) + ": Teléfono "
                                + telefono + " ya registrado - OMITIDO"); continue;
                    }
                    String cedulaFinal = cedula.trim().isEmpty() ? "0000000000" : cedula.trim();
                    if (usuarioService.findByCedula(cedulaFinal) != null) {
                        errores.add("Fila " + (i+1) + ": Cédula "
                                + cedulaFinal + " ya registrada - OMITIDO"); continue;
                    }

                    // CORRECCIÓN — eliminado tipoCliente del builder
                    usuarioService.save(Usuario.builder()
                            .nombre(nombre.trim()).correo(email.trim())
                            .telefono(telefono.trim()).cedula(cedulaFinal)
                            .contrasena(passwordEncoder.encode(UUID.randomUUID().toString()))
                            .rol(Rolenum.CLIENTE)
                            .metodoPago(MetodoPago.EFECTIVO)
                            .estado(EstadoGeneral.ACTIVO)
                            .descripcion("").build());
                    clientesRegistrados++;
                    cargados.add(Map.of("tipo","Cliente","nombre",nombre,
                            "email",email,"cedula",cedulaFinal));
                } catch (Exception e) {
                    errores.add("Fila " + (i+1) + " (Cliente): " + e.getMessage());
                }
            }

            // PASADA 2: VEHÍCULOS
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;
                try {
                    String tipo = getCellValueAsString(row.getCell(0));
                    if (!("Vehiculo".equalsIgnoreCase(tipo)
                            || "Vehículo".equalsIgnoreCase(tipo))) continue;
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
                    try { int p = Integer.parseInt(anioStr);
                        if (p >= 1900 && p <= 2030) anio = p; }
                    catch (NumberFormatException ignored) {}
                    Optional<Usuario> clienteOpt = usuarioService.findByCorreo(emailCliente);
                    if (clienteOpt.isEmpty()) {
                        errores.add("Fila " + (i+1) + ": Cliente no encontrado: "
                                + emailCliente); continue;
                    }
                    if (vehiculoService.findByPlaca(placa).isPresent()) {
                        errores.add("Fila " + (i+1) + ": Placa " + placa
                                + " ya existe - OMITIDO"); continue;
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
                    vehiculoService.save(Vehiculo.builder()
                            .placa(placa).tipo(tipoVehiculo).marca(marcaEnum)
                            .color(color).anio(anio).idUsuario(clienteOpt.get()).build());
                    vehiculosRegistrados++;
                    cargados.add(Map.of("tipo","Vehículo","placa",placa,
                            "propietario",clienteOpt.get().getNombre()));
                } catch (Exception e) {
                    errores.add("Fila " + (i+1) + " (Vehículo): " + e.getMessage());
                }
            }

            workbook.close();
            log.info("Carga masiva: clientes={} vehiculos={} errores={}",
                    clientesRegistrados, vehiculosRegistrados, errores.size());

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
                    .body(Map.of("error", "Error procesando archivo Excel."));
        } catch (Exception e) {
            log.error("Error en carga masiva: {}", e.getMessage(), e);
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
            Optional<Vehiculo> vehiculoOpt =
                    vehiculoService.findByPlaca(placa.toUpperCase().trim());
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
    // ESTADÍSTICAS
    // =========================================================

    @GetMapping("/estadisticas")
    public ResponseEntity<?> getEstadisticas(
            @RequestParam(required = false) String fechaInicio,
            @RequestParam(required = false) String fechaFin) {
        try {
            Sede sede = getSedeDelUsuarioAutenticado();
            LocalDateTime inicio = fechaInicio != null
                    ? LocalDate.parse(fechaInicio).atStartOfDay()
                    : LocalDate.now().minusDays(7).atStartOfDay();
            LocalDateTime fin = fechaFin != null
                    ? LocalDate.parse(fechaFin).atTime(23, 59, 59)
                    : LocalDateTime.now();

            List<RegistroEntradaSalida> registros =
                    registroService.findBySedeAndFechaHoraEntradaBetween(sede, inicio, fin);

            // CORRECCIÓN — ingresos desde Pago via sumIngresosEntreFechas
            BigDecimal ingresosTotales =
                    registroService.sumIngresosEntreFechas(sede, inicio, fin);

            double promedioMin = registros.stream()
                    .filter(r -> r.getFechaHoraSalida() != null)
                    .mapToLong(r -> Duration.between(
                            r.getFechaHoraEntrada(), r.getFechaHoraSalida()).toMinutes())
                    .average().orElse(0);

            Map<String, Object> estadisticas = new HashMap<>();
            estadisticas.put("totalVehiculos", registros.size());
            estadisticas.put("ingresosTotales", ingresosTotales);
            estadisticas.put("porTipoVehiculo", registros.stream()
                    .collect(Collectors.groupingBy(
                            r -> r.getVehiculo().getTipo().toString(),
                            Collectors.counting())));
            estadisticas.put("porEstado", registros.stream()
                    .collect(Collectors.groupingBy(
                            r -> r.getEstado().toString(), Collectors.counting())));
            // CORRECCIÓN — metodoPago desde Pago asociado
            estadisticas.put("porMetodoPago", registros.stream()
                    .filter(r -> r.getPago() != null
                            && r.getPago().getMetodoPago() != null)
                    .collect(Collectors.groupingBy(
                            r -> r.getPago().getMetodoPago().toString(),
                            Collectors.counting())));
            estadisticas.put("promedioTiempoMinutos",    Math.round(promedioMin));
            estadisticas.put("promedioTiempoFormateado",
                    formatearTiempo(Duration.ofMinutes((long) promedioMin)));

            return ResponseEntity.ok(estadisticas);
        } catch (Exception e) {
            log.error("Error al cargar estadísticas: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }
}