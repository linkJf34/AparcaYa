package com.exe.AparcaYA.Controllers;

import com.exe.AparcaYA.Entity.*;
import com.exe.AparcaYA.Enum.*;
import com.exe.AparcaYA.Service.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

// ✅ CAMBIO #4: @Slf4j de Lombok — reemplaza todos los System.out/err.println
// ✅ CAMBIO #1: @RequiredArgsConstructor inyecta todos los servicios por constructor
//              Eliminado UsuarioRepository del Controller (usaba findByCorreo que ya tiene UsuarioService)

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
@RequiredArgsConstructor
@RequestMapping("/api/trabajador")
//@PreAuthorize("hasRole('OPERARIO')")
@CrossOrigin(origins = "*")
public class TrabajadorController {

    // ✅ CAMBIO #1: Todos los servicios son final e inyectados por constructor via @RequiredArgsConstructor
    // Antes: @Autowired en campo para cada servicio + UsuarioRepository inyectado directamente
    // Ahora: patrón uniforme, sin acceso directo al Repository desde el Controller
    private final VehiculoService vehiculoService;
    private final RegistroEntradaSalidaService registroService;
    private final ReservacionService reservacionService;
    private final UsuarioService usuarioService;
    private final SedeService sedeService;
    private final CupoService cupoService;
    private final PasswordEncoder passwordEncoder;

    // ==================== MÉTODOS AUXILIARES ====================

    private Sede getSedeDelUsuarioAutenticado() {
        Usuario usuario = getUsuarioAutenticado();
        return usuario != null ? usuario.getSedeAsignada() : null;
    }

    private Usuario getUsuarioAutenticado() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        if (auth == null || !auth.isAuthenticated()) {
            log.warn("No hay autenticación activa");
            return null;
        }

        String identifier = auth.getName();
        log.debug("Buscando usuario autenticado: {}", identifier);

        // ✅ CAMBIO #1: Eliminado usuarioRepository.findByCorreo() — UsuarioService ya lo tiene
        Optional<Usuario> usuario = usuarioService.findByCorreo(identifier);

        if (usuario.isEmpty()) {
            log.error("No se encontró usuario con correo: {}", identifier);
            return null;
        }

        Usuario user = usuario.get();

        if (user.getSedeAsignada() == null) {
            log.error("El usuario {} no tiene sede asignada", user.getNombre());
            return null;
        }

        log.debug("Usuario autenticado: {} - Sede: {}", user.getNombre(), user.getSedeAsignada().getNombre());
        return user;
    }

    /**
     * ✅ CAMBIO #5: Lógica de resolución de tarifas extraída a método privado.
     * Antes: bloque esCarro ? tarifaPlena/Minuto repetido 3 veces en el Controller.
     * Devuelve un array [tarifaPlena, tarifaMinuto] según tipo de vehículo y sede.
     */
    private double[] resolverTarifas(Sede sede, TipoVehiculo tipo) {
        boolean esCarro = (tipo == TipoVehiculo.CARRO);
        double tarifaPlena  = esCarro ? sede.getTarifaPlenaC()  : sede.getTarifaPlenaM();
        double tarifaMinuto = esCarro ? sede.getTarifaMinutoC() : sede.getTarifaMinutoM();
        return new double[]{ tarifaPlena, tarifaMinuto };
    }

    // Sobrecarga para cuando el tipo llega como String (entrada manual)
    private double[] resolverTarifas(Sede sede, String tipoStr) {
        boolean esCarro = tipoStr.equalsIgnoreCase("CARRO") ||
                tipoStr.equalsIgnoreCase("AUTOMOVIL") ||
                tipoStr.equalsIgnoreCase("AUTO");
        double tarifaPlena  = esCarro ? sede.getTarifaPlenaC()  : sede.getTarifaPlenaM();
        double tarifaMinuto = esCarro ? sede.getTarifaMinutoC() : sede.getTarifaMinutoM();
        return new double[]{ tarifaPlena, tarifaMinuto };
    }

    private String formatearTiempo(Duration duracion) {
        long horas    = duracion.toHours();
        long minutos  = duracion.toMinutes() % 60;
        long segundos = duracion.getSeconds() % 60;

        if (horas > 0)        return String.format("%dh %dm %ds", horas, minutos, segundos);
        else if (minutos > 0) return String.format("%dm %ds", minutos, segundos);
        else                  return String.format("%ds", segundos);
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

    // ==================== INDICADORES DEL DASHBOARD ====================

    @GetMapping("/indicadores")
    public ResponseEntity<Map<String, Object>> getIndicadores() {
        try {
            // ✅ CAMBIO #4: log.debug reemplaza System.out.println de debug de autenticación
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            log.debug("Auth presente: {}, autenticado: {}, nombre: {}",
                    auth != null, auth != null && auth.isAuthenticated(),
                    auth != null ? auth.getName() : "null");

            Sede sede = getSedeDelUsuarioAutenticado();

            if (sede == null) {
                log.error("No se pudo obtener la sede del usuario autenticado");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("error", "No se encontró una sede asignada al usuario autenticado"));
            }

            log.debug("Generando indicadores para sede: {}", sede.getNombre());

            List<RegistroEntradaSalida> vehiculosActivos = registroService
                    .findBySedeAndEstado(sede, EstadoRegistro.ACTIVO);

            int ocupacionActual = vehiculosActivos.size();
            int capacidadTotal  = sede.getCapacidad();
            int cuposLibres     = Math.max(0, capacidadTotal - ocupacionActual);

            LocalDateTime inicioHoy = LocalDate.now().atStartOfDay();
            LocalDateTime finHoy    = inicioHoy.plusDays(1);

            List<RegistroEntradaSalida> registrosHoy = registroService
                    .findBySedeAndFechaHoraEntradaBetween(sede, inicioHoy, finHoy);

            long vehiculosHoy = registrosHoy.size();

            BigDecimal ingresosDia = registrosHoy.stream()
                    .filter(r -> r.getPrecio() != null && r.getEstado() == EstadoRegistro.COBRADO)
                    .map(RegistroEntradaSalida::getPrecio)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            long pendientesCobro = registrosHoy.stream()
                    .filter(r -> r.getEstado() == EstadoRegistro.FINALIZADO)
                    .count();

            Map<String, Object> indicadores = new HashMap<>();
            indicadores.put("ocupacionActual",    ocupacionActual);
            indicadores.put("capacidadTotal",     capacidadTotal);
            indicadores.put("cuposLibres",         cuposLibres);
            indicadores.put("porcentajeOcupacion", capacidadTotal > 0 ?
                    Math.round((ocupacionActual * 100.0) / capacidadTotal) : 0);
            indicadores.put("vehiculosHoy",    vehiculosHoy);
            indicadores.put("ingresosDia",     ingresosDia);
            indicadores.put("pendientesCobro", pendientesCobro);
            indicadores.put("sedeNombre",      sede.getNombre());
            indicadores.put("sedeActiva",      sede.getEstado());
            indicadores.put("tarifaPlenaC",    sede.getTarifaPlenaC());
            indicadores.put("tarifaPlenaM",    sede.getTarifaPlenaM());
            indicadores.put("tarifaMinutoC",   sede.getTarifaMinutoC());
            indicadores.put("tarifaMinutoM",   sede.getTarifaMinutoM());

            log.info("Indicadores generados para sede {}: ocupacion={}%, vehiculosHoy={}",
                    sede.getNombre(), indicadores.get("porcentajeOcupacion"), vehiculosHoy);
            return ResponseEntity.ok(indicadores);

        } catch (Exception e) {
            log.error("Error al cargar indicadores: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Error al cargar indicadores: " + e.getMessage()));
        }
    }

    // ==================== VEHÍCULOS ACTIVOS ====================

    @GetMapping("/vehiculos-activos")
    public ResponseEntity<?> getVehiculosActivos() {
        try {
            Sede sede = getSedeDelUsuarioAutenticado();

            List<RegistroEntradaSalida> registros = registroService
                    .findBySedeAndEstado(sede, EstadoRegistro.ACTIVO);

            List<Map<String, Object>> vehiculos = registros.stream().map(registro -> {
                Map<String, Object> vehiculo = new HashMap<>();
                vehiculo.put("registroId",    registro.getIdRegistro());
                vehiculo.put("placa",         registro.getVehiculo().getPlaca());
                vehiculo.put("tipoVehiculo",  registro.getVehiculo().getTipo().toString());
                vehiculo.put("marca",         registro.getVehiculo().getMarca().toString());
                vehiculo.put("color",         registro.getVehiculo().getColor());
                vehiculo.put("horaEntrada",   registro.getFechaHoraEntrada().toString());

                Usuario cliente = registro.getVehiculo().getIdUsuario();
                vehiculo.put("clienteNombre",  cliente.getNombre());
                vehiculo.put("clienteTelefono",cliente.getTelefono());
                vehiculo.put("clienteEmail",   cliente.getCorreo());

                Duration duracion = Duration.between(registro.getFechaHoraEntrada(), LocalDateTime.now());
                vehiculo.put("tiempoTranscurrido",  formatearTiempo(duracion));
                vehiculo.put("tiempoMs",            duracion.toMillis());
                vehiculo.put("segundosTranscurridos",duracion.getSeconds());

                // ✅ CAMBIO #5: Tarifas resueltas via método privado — sin bloque condicional inline
                double[] tarifas = resolverTarifas(sede, registro.getVehiculo().getTipo());
                double tarifaPlena  = tarifas[0];
                double tarifaMinuto = tarifas[1];

                long minutosTranscurridos = duracion.toMinutes();
                BigDecimal cobroEstimadoPlena  = BigDecimal.valueOf(tarifaPlena).setScale(2, RoundingMode.HALF_UP);
                BigDecimal cobroEstimadoMinuto = BigDecimal.valueOf(minutosTranscurridos * tarifaMinuto)
                        .setScale(2, RoundingMode.HALF_UP);

                vehiculo.put("cobroEstimadoPlena",  cobroEstimadoPlena);
                vehiculo.put("cobroEstimadoMinuto", cobroEstimadoMinuto);
                vehiculo.put("minutosTranscurridos",minutosTranscurridos);
                vehiculo.put("tarifaPlena",         tarifaPlena);
                vehiculo.put("tarifaMinuto",        tarifaMinuto);
                vehiculo.put("cobroEstimado",       cobroEstimadoMinuto);
                vehiculo.put("cupo", registro.getCupo() != null ?
                        registro.getCupo().getCodigo() : "Sin asignar");

                return vehiculo;
            }).collect(Collectors.toList());

            return ResponseEntity.ok(vehiculos);
        } catch (Exception e) {
            log.error("Error al cargar vehículos activos: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== VEHÍCULOS PENDIENTES DE COBRO ====================

    @GetMapping("/vehiculos-pendientes-cobro")
    public ResponseEntity<?> getVehiculosPendientesCobro() {
        try {
            List<Sede> sedes = sedeService.findAll();
            Sede sede = sedes.isEmpty() ? null : sedes.get(0);

            if (sede == null) return ResponseEntity.ok(new ArrayList<>());

            List<RegistroEntradaSalida> registros = registroService
                    .findBySedeAndEstado(sede, EstadoRegistro.FINALIZADO);

            List<Map<String, Object>> vehiculos = registros.stream().map(registro -> {
                Map<String, Object> vehiculo = new HashMap<>();
                vehiculo.put("registroId",  registro.getIdRegistro());
                vehiculo.put("placa",       registro.getVehiculo().getPlaca());
                vehiculo.put("tipoVehiculo",registro.getVehiculo().getTipo().toString());
                vehiculo.put("horaEntrada", registro.getFechaHoraEntrada().toString());
                vehiculo.put("horaSalida",  registro.getFechaHoraSalida().toString());

                Usuario cliente = registro.getVehiculo().getIdUsuario();
                vehiculo.put("clienteNombre",  cliente.getNombre());
                vehiculo.put("clienteTelefono",cliente.getTelefono());

                Duration duracion = Duration.between(registro.getFechaHoraEntrada(), registro.getFechaHoraSalida());
                vehiculo.put("tiempoTotal", formatearTiempo(duracion));
                vehiculo.put("precio",      registro.getPrecio());

                return vehiculo;
            }).collect(Collectors.toList());

            return ResponseEntity.ok(vehiculos);
        } catch (Exception e) {
            log.error("Error al cargar pendientes de cobro: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== HISTORIAL COMPLETO ====================

    @GetMapping("/historial")
    public ResponseEntity<?> getHistorial(
            @RequestParam(required = false) String fecha,
            @RequestParam(required = false) String estado) {
        try {
            Sede sede = getSedeDelUsuarioAutenticado();
            List<RegistroEntradaSalida> registros = registroService.findHistorialBySede(sede);

            if (fecha != null && !fecha.isEmpty()) {
                LocalDate fechaFiltro = LocalDate.parse(fecha);
                registros = registros.stream()
                        .filter(r -> r.getFechaHoraEntrada().toLocalDate().equals(fechaFiltro))
                        .collect(Collectors.toList());
            }

            if (estado != null && !estado.isEmpty()) {
                EstadoRegistro estadoFiltro = EstadoRegistro.valueOf(estado.toUpperCase());
                registros = registros.stream()
                        .filter(r -> r.getEstado() == estadoFiltro)
                        .collect(Collectors.toList());
            }

            List<Map<String, Object>> historial = registros.stream().map(registro -> {
                Map<String, Object> item = new HashMap<>();
                item.put("registroId",  registro.getIdRegistro());
                item.put("placa",       registro.getVehiculo().getPlaca());
                item.put("tipoVehiculo",registro.getVehiculo().getTipo().toString());
                item.put("marca",       registro.getVehiculo().getMarca().toString());
                item.put("horaEntrada", registro.getFechaHoraEntrada().toString());
                item.put("horaSalida",  registro.getFechaHoraSalida() != null ?
                        registro.getFechaHoraSalida().toString() : null);
                item.put("estado",      registro.getEstado().toString());
                item.put("precio",      registro.getPrecio());
                item.put("metodoPago",  registro.getMetodoPago());

                Usuario cliente = registro.getVehiculo().getIdUsuario();
                item.put("clienteNombre",  cliente.getNombre());
                item.put("clienteTelefono",cliente.getTelefono());
                item.put("clienteEmail",   cliente.getCorreo());

                Duration duracion = registro.getFechaHoraSalida() != null
                        ? Duration.between(registro.getFechaHoraEntrada(), registro.getFechaHoraSalida())
                        : Duration.between(registro.getFechaHoraEntrada(), LocalDateTime.now());
                String sufijo = registro.getFechaHoraSalida() != null ? "" : " (en curso)";
                item.put("tiempoTotal", formatearTiempo(duracion) + sufijo);

                return item;
            }).collect(Collectors.toList());

            return ResponseEntity.ok(historial);
        } catch (Exception e) {
            log.error("Error al cargar historial: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== REGISTRAR ENTRADA ====================

    @PostMapping("/registrar-entrada")
    public ResponseEntity<Map<String, Object>> registrarEntrada(@RequestBody Map<String, String> datos) {
        try {
            Sede sede       = getSedeDelUsuarioAutenticado();
            Usuario trabajador = getUsuarioAutenticado();

            List<RegistroEntradaSalida> vehiculosActivos = registroService
                    .findBySedeAndEstado(sede, EstadoRegistro.ACTIVO);

            if (vehiculosActivos.size() >= sede.getCapacidad()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Parqueadero lleno. No hay cupos disponibles."));
            }

            String nombre   = datos.get("clienteNombre");
            String telefono = datos.get("clienteTelefono");
            String correo   = datos.get("clienteEmail");
            String cedula   = datos.getOrDefault("clienteCedula", "");

            Usuario cliente = usuarioService.findByCorreo(correo)
                    .orElseGet(() -> {
                        Usuario nuevoCliente = new Usuario();
                        nuevoCliente.setNombre(nombre);
                        nuevoCliente.setTelefono(telefono);
                        nuevoCliente.setCorreo(correo);
                        nuevoCliente.setCedula(cedula.isEmpty() ? "0000000000" : cedula);
                        nuevoCliente.setContrasena("temp" + System.currentTimeMillis());
                        nuevoCliente.setRol(Rolenum.CLIENTE);
                        nuevoCliente.setTipoCliente(TipoCliente.NORMAL);
                        nuevoCliente.setMetodoPago(MetodoPago.EFECTIVO);
                        nuevoCliente.setEstado(EstadoGeneral.ACTIVO);
                        return usuarioService.save(nuevoCliente);
                    });

            String placa        = datos.get("vehiculoPlaca").toUpperCase().trim();
            String tipoVehiculo = datos.getOrDefault("vehiculoTipo", "CARRO");
            String marca        = datos.getOrDefault("vehiculoMarca", "OTRO");
            String color        = datos.getOrDefault("vehiculoColor", "NO ESPECIFICADO");
            int    anio         = Integer.parseInt(datos.getOrDefault("vehiculoAnio", "2020"));

            Optional<Vehiculo> vehiculoExistente = vehiculoService.findByPlaca(placa);
            if (vehiculoExistente.isPresent()) {
                Optional<RegistroEntradaSalida> registroActivo =
                        registroService.findVehiculoActivo(vehiculoExistente.get());
                if (registroActivo.isPresent()) {
                    return ResponseEntity.badRequest()
                            .body(Map.of("error", "Este vehículo ya se encuentra en el parqueadero"));
                }
            }

            Vehiculo vehiculo = vehiculoService.findByPlaca(placa)
                    .orElseGet(() -> {
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

            RegistroEntradaSalida registro = registroService.registrarEntrada(
                    vehiculo, sede, cupoAsignado, trabajador);

            // ✅ CAMBIO #5: Tarifas resueltas via método privado
            double[] tarifas    = resolverTarifas(sede, tipoVehiculo);
            double tarifaPlena  = tarifas[0];
            double tarifaMinuto = tarifas[1];

            Map<String, Double> todasLasTarifas = new HashMap<>();
            todasLasTarifas.put("plenaC",  sede.getTarifaPlenaC());
            todasLasTarifas.put("plenaM",  sede.getTarifaPlenaM());
            todasLasTarifas.put("minutoC", sede.getTarifaMinutoC());
            todasLasTarifas.put("minutoM", sede.getTarifaMinutoM());

            Map<String, Object> response = new HashMap<>();
            response.put("mensaje",      "Vehículo registrado exitosamente. Temporizador iniciado.");
            response.put("registroId",   registro.getIdRegistro());
            response.put("placa",        placa);
            response.put("tipoVehiculo", tipoVehiculo);
            response.put("clienteNombre",cliente.getNombre());
            response.put("horaEntrada",  registro.getFechaHoraEntrada().toString());
            response.put("cupo",         cupoAsignado != null ? cupoAsignado.getCodigo() : "Sin asignar");
            response.put("tarifaPlena",  tarifaPlena);
            response.put("tarifaMinuto", tarifaMinuto);
            response.put("tarifasSede",  todasLasTarifas);

            log.info("Entrada registrada: placa={} sede={}", placa, sede.getNombre());
            return ResponseEntity.status(HttpStatus.CREATED).body(response);

        } catch (Exception e) {
            log.error("Error al registrar entrada: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== REGISTRAR SALIDA ====================

    @PostMapping("/registrar-salida/{registroId}")
    public ResponseEntity<Map<String, Object>> registrarSalida(@PathVariable Long registroId) {
        try {
            RegistroEntradaSalida registro = registroService.registrarSalida(registroId);

            Duration duracion = Duration.between(
                    registro.getFechaHoraEntrada(), registro.getFechaHoraSalida());

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
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== CONFIRMAR COBRO ====================

    @PostMapping("/confirmar-cobro/{registroId}")
    public ResponseEntity<Map<String, Object>> confirmarCobro(
            @PathVariable Long registroId,
            @RequestBody Map<String, String> datos) {
        try {
            String metodoPago = datos.getOrDefault("metodoPago", "EFECTIVO");
            String tipoTarifa = datos.getOrDefault("tipoTarifa", "MINUTO");

            if (!tipoTarifa.equalsIgnoreCase("PLENA") && !tipoTarifa.equalsIgnoreCase("MINUTO")) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Tipo de tarifa inválido. Debe ser 'PLENA' o 'MINUTO'"));
            }

            RegistroEntradaSalida registro = registroService.confirmarCobroConTarifa(
                    registroId, metodoPago, tipoTarifa);

            Map<String, Object> response = new HashMap<>();
            response.put("mensaje",           "Cobro confirmado exitosamente");
            response.put("registroId",        registro.getIdRegistro());
            response.put("placa",             registro.getVehiculo().getPlaca());
            response.put("precio",            registro.getPrecio());
            response.put("metodoPago",        registro.getMetodoPago());
            response.put("tipoTarifaAplicada",tipoTarifa);
            response.put("estado",            registro.getEstado().toString());

            log.info("Cobro confirmado: registroId={} precio={} tarifa={}",
                    registroId, registro.getPrecio(), tipoTarifa);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error al confirmar cobro {}: {}", registroId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== OPCIONES DE COBRO ====================

    @GetMapping("/opciones-cobro/{registroId}")
    public ResponseEntity<?> getOpcionesCobro(@PathVariable Long registroId) {
        try {
            RegistroEntradaSalida registro = registroService.findById(registroId)
                    .orElseThrow(() -> new RuntimeException("Registro no encontrado"));

            if (registro.getEstado() != EstadoRegistro.FINALIZADO) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "El registro no está pendiente de cobro"));
            }

            Sede sede = registro.getSede();
            Duration duracion = Duration.between(
                    registro.getFechaHoraEntrada(), registro.getFechaHoraSalida());
            long minutosTranscurridos = duracion.toMinutes();

            // ✅ CAMBIO #5: Tarifas resueltas via método privado
            double[] tarifas    = resolverTarifas(sede, registro.getVehiculo().getTipo());
            double tarifaPlena  = tarifas[0];
            double tarifaMinuto = tarifas[1];

            BigDecimal precioMinuto = BigDecimal.valueOf(minutosTranscurridos * tarifaMinuto)
                    .setScale(2, RoundingMode.HALF_UP);

            long horas   = duracion.toHours();
            long minutos = duracion.toMinutes() % 60;

            Map<String, Object> opcionPlena = new HashMap<>();
            opcionPlena.put("tipo",        "PLENA");
            opcionPlena.put("nombre",      "Tarifa Plena (Día Completo)");
            opcionPlena.put("precio",       tarifaPlena);
            opcionPlena.put("descripcion", "Tarifa fija del día");

            Map<String, Object> opcionMinuto = new HashMap<>();
            opcionMinuto.put("tipo",        "MINUTO");
            opcionMinuto.put("nombre",      "Tarifa por Minuto");
            opcionMinuto.put("precio",       precioMinuto);
            opcionMinuto.put("descripcion", minutosTranscurridos + " minutos × $" +
                    (int) tarifaMinuto + "/min");

            Map<String, Object> response = new HashMap<>();
            response.put("registroId",          registroId);
            response.put("placa",               registro.getVehiculo().getPlaca());
            response.put("clienteNombre",       registro.getVehiculo().getIdUsuario().getNombre());
            response.put("tipoVehiculo",        registro.getVehiculo().getTipo().toString());
            response.put("horaEntrada",         registro.getFechaHoraEntrada().toString());
            response.put("horaSalida",          registro.getFechaHoraSalida().toString());
            response.put("minutosTranscurridos",minutosTranscurridos);
            response.put("tiempoTotal",         horas > 0 ? horas + "h " + minutos + "m" : minutos + "m");
            response.put("opciones",            List.of(opcionPlena, opcionMinuto));

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error al obtener opciones de cobro {}: {}", registroId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== RESERVACIONES ====================

    @GetMapping("/reservaciones")
    public ResponseEntity<?> getReservaciones() {
        try {
            Sede sede = getSedeDelUsuarioAutenticado();

            List<Map<String, Object>> reservas = reservacionService.findAll().stream()
                    .filter(r -> r.getCupo().getSede().getIdSede().equals(sede.getIdSede()))
                    .filter(r -> r.getEstado() == EstadoReservacion.PENDIENTE)
                    .map(reserva -> {
                        Map<String, Object> r = new HashMap<>();
                        r.put("id",             reserva.getIdReserva());
                        r.put("clienteNombre",  reserva.getCliente().getNombre());
                        r.put("clienteTelefono",reserva.getCliente().getTelefono());
                        r.put("clienteEmail",   reserva.getCliente().getCorreo());
                        r.put("placa",          reserva.getVehiculo().getPlaca());
                        r.put("tipoVehiculo",   reserva.getVehiculo().getTipo().toString());
                        r.put("horaInicio",     reserva.getFechaInicio().toString());
                        r.put("horaFin",        reserva.getFechaFin().toString());
                        r.put("cupo",           reserva.getCupo().getCodigo());
                        r.put("estado",         reserva.getEstado().toString());
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
    public ResponseEntity<Map<String, Object>> aceptarReservacion(@PathVariable Long reservacionId) {
        try {
            Sede sede          = getSedeDelUsuarioAutenticado();
            Usuario trabajador = getUsuarioAutenticado();

            Reservacion reservacion = reservacionService.findById(reservacionId)
                    .orElseThrow(() -> new RuntimeException("Reservación no encontrada"));

            reservacion.setEstado(EstadoReservacion.ACTIVA);
            reservacionService.save(reservacion);

            RegistroEntradaSalida registro = registroService.registrarEntrada(
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
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/rechazar-reservacion/{reservacionId}")
    public ResponseEntity<Map<String, Object>> rechazarReservacion(@PathVariable Long reservacionId) {
        try {
            Reservacion reservacion = reservacionService.findById(reservacionId)
                    .orElseThrow(() -> new RuntimeException("Reservación no encontrada"));

            reservacion.setEstado(EstadoReservacion.CANCELADA);
            reservacionService.save(reservacion);

            Cupo cupo = reservacion.getCupo();
            cupo.setEstado(EstadoCupo.DISPONIBLE);
            cupoService.save(cupo);

            return ResponseEntity.ok(Map.of("mensaje", "Reservación rechazada",
                    "reservacionId", reservacionId));

        } catch (Exception e) {
            log.error("Error al rechazar reservacion {}: {}", reservacionId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== CARGA MASIVA DESDE EXCEL ====================

    @PostMapping("/carga-masiva")
    public ResponseEntity<Map<String, Object>> cargaMasiva(@RequestParam("file") MultipartFile file) {
        log.info("Iniciando carga masiva: archivo={}", file.getOriginalFilename());

        try {
            if (file.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Archivo vacío"));
            }

            Sede sede = getSedeDelUsuarioAutenticado();
            log.debug("Sede del usuario: {}", sede != null ? sede.getNombre() : "NULL");

            Workbook workbook = new XSSFWorkbook(file.getInputStream());
            Sheet sheet       = workbook.getSheetAt(0);

            int clientesRegistrados  = 0;
            int vehiculosRegistrados = 0;
            List<String> errores              = new ArrayList<>();
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

                    if (nombre.trim().isEmpty() || email.trim().isEmpty() || telefono.trim().isEmpty()) {
                        errores.add("Fila " + (i + 1) + ": Faltan datos obligatorios del cliente");
                        continue;
                    }
                    if (usuarioService.findByCorreo(email.trim()).isPresent()) {
                        errores.add("Fila " + (i + 1) + ": Email " + email + " ya existe - OMITIDO");
                        continue;
                    }
                    if (usuarioService.findByTelefono(telefono.trim()) != null) {
                        errores.add("Fila " + (i + 1) + ": Teléfono " + telefono + " ya registrado - OMITIDO");
                        continue;
                    }

                    String cedulaFinal = (cedula.trim().isEmpty()) ? "0000000000" : cedula.trim();
                    if (usuarioService.findByCedula(cedulaFinal) != null) {
                        errores.add("Fila " + (i + 1) + ": Cédula " + cedulaFinal + " ya registrada - OMITIDO");
                        continue;
                    }

                    Usuario cliente = Usuario.builder()
                            .nombre(nombre.trim()).correo(email.trim()).telefono(telefono.trim())
                            .cedula(cedulaFinal).contrasena(passwordEncoder.encode("Temp123!"))
                            .rol(Rolenum.CLIENTE).tipoCliente(TipoCliente.NORMAL)
                            .metodoPago(MetodoPago.EFECTIVO).estado(EstadoGeneral.ACTIVO)
                            .descripcion("").build();

                    usuarioService.save(cliente);
                    clientesRegistrados++;

                    Map<String, Object> reg = new HashMap<>();
                    reg.put("tipo", "Cliente"); reg.put("nombre", nombre);
                    reg.put("email", email);    reg.put("telefono", telefono);
                    reg.put("cedula", cedulaFinal);
                    cargados.add(reg);

                } catch (Exception e) {
                    log.warn("Error en fila {} (Cliente): {}", i + 1, e.getMessage());
                    errores.add("Fila " + (i + 1) + " (Cliente): " + e.getMessage());
                }
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

                    if (placa.isEmpty() || emailCliente.isEmpty()) {
                        errores.add("Fila " + (i + 1) + ": Faltan datos obligatorios (placa o email)");
                        continue;
                    }

                    int anio = 2020;
                    try {
                        int p = Integer.parseInt(anioStr);
                        if (p >= 1900 && p <= 2030) anio = p;
                    } catch (NumberFormatException ignored) {}

                    Optional<Usuario> clienteOpt = usuarioService.findByCorreo(emailCliente);
                    if (clienteOpt.isEmpty()) {
                        errores.add("Fila " + (i + 1) + ": Cliente no encontrado: " + emailCliente);
                        continue;
                    }

                    if (vehiculoService.findByPlaca(placa).isPresent()) {
                        errores.add("Fila " + (i + 1) + ": Placa " + placa + " ya existe - OMITIDO");
                        continue;
                    }

                    TipoVehiculo tipoVehiculo;
                    try { tipoVehiculo = TipoVehiculo.valueOf(tipoVeh); }
                    catch (IllegalArgumentException e) {
                        errores.add("Fila " + (i + 1) + ": Tipo inválido: " + tipoVeh); continue;
                    }

                    Marca marcaEnum;
                    try { marcaEnum = Marca.valueOf(marca); }
                    catch (IllegalArgumentException e) {
                        errores.add("Fila " + (i + 1) + ": Marca inválida: " + marca +
                                " (valores: " + Arrays.toString(Marca.values()) + ")"); continue;
                    }

                    vehiculoService.save(Vehiculo.builder()
                            .placa(placa).tipo(tipoVehiculo).marca(marcaEnum)
                            .color(color).anio(anio).idUsuario(clienteOpt.get()).build());
                    vehiculosRegistrados++;

                    Map<String, Object> reg = new HashMap<>();
                    reg.put("tipo", "Vehículo"); reg.put("placa", placa);
                    reg.put("tipoVehiculo", tipoVeh); reg.put("marca", marca);
                    reg.put("color", color); reg.put("año", anio);
                    reg.put("propietario", clienteOpt.get().getNombre());
                    cargados.add(reg);

                } catch (Exception e) {
                    log.warn("Error en fila {} (Vehículo): {}", i + 1, e.getMessage());
                    errores.add("Fila " + (i + 1) + " (Vehículo): " + e.getMessage());
                }
            }

            workbook.close();

            log.info("Carga masiva completada: clientes={} vehiculos={} errores={}",
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
                    .body(Map.of("error", "Error procesando archivo Excel: " + e.getMessage()));
        } catch (Exception e) {
            log.error("Error en carga masiva: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== BUSCAR POR PLACA ====================

    @GetMapping("/buscar-por-placa/{placa}")
    public ResponseEntity<?> buscarPorPlaca(@PathVariable String placa) {
        try {
            Optional<Vehiculo> vehiculoOpt = vehiculoService.findByPlaca(placa.toUpperCase().trim());

            if (vehiculoOpt.isEmpty()) {
                return ResponseEntity.ok(Map.of("encontrado", false, "mensaje", "Vehículo no registrado"));
            }

            Vehiculo vehiculo = vehiculoOpt.get();
            Usuario  cliente  = vehiculo.getIdUsuario();

            return ResponseEntity.ok(Map.of(
                    "encontrado", true,
                    "vehiculo", Map.of(
                            "id", vehiculo.getIdVehiculo(), "placa", vehiculo.getPlaca(),
                            "tipo", vehiculo.getTipo().toString(), "marca", vehiculo.getMarca().toString(),
                            "color", vehiculo.getColor(), "anio", vehiculo.getAnio()),
                    "cliente", Map.of(
                            "id", cliente.getIdUsuario(), "nombre", cliente.getNombre(),
                            "telefono", cliente.getTelefono(), "email", cliente.getCorreo(),
                            "cedula", cliente.getCedula())
            ));
        } catch (Exception e) {
            log.error("Error al buscar placa {}: {}", placa, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== ESTADÍSTICAS ====================

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

            List<RegistroEntradaSalida> registros = registroService
                    .findBySedeAndFechaHoraEntradaBetween(sede, inicio, fin);

            BigDecimal ingresosTotales = registros.stream()
                    .filter(r -> r.getPrecio() != null && r.getEstado() == EstadoRegistro.COBRADO)
                    .map(RegistroEntradaSalida::getPrecio)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            double promedioMin = registros.stream()
                    .filter(r -> r.getFechaHoraSalida() != null)
                    .mapToLong(r -> Duration.between(r.getFechaHoraEntrada(), r.getFechaHoraSalida()).toMinutes())
                    .average().orElse(0);

            Map<String, Object> estadisticas = new HashMap<>();
            estadisticas.put("fechaInicio",           inicio.toString());
            estadisticas.put("fechaFin",              fin.toString());
            estadisticas.put("totalVehiculos",        registros.size());
            estadisticas.put("ingresosTotales",       ingresosTotales);
            estadisticas.put("porTipoVehiculo",       registros.stream().collect(
                    Collectors.groupingBy(r -> r.getVehiculo().getTipo().toString(), Collectors.counting())));
            estadisticas.put("porEstado",             registros.stream().collect(
                    Collectors.groupingBy(r -> r.getEstado().toString(), Collectors.counting())));
            estadisticas.put("porMetodoPago",         registros.stream()
                    .filter(r -> r.getMetodoPago() != null)
                    .collect(Collectors.groupingBy(RegistroEntradaSalida::getMetodoPago, Collectors.counting())));
            estadisticas.put("promedioTiempoMinutos", Math.round(promedioMin));
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