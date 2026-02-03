package com.exe.AparcaYA.Controllers;

import com.exe.AparcaYA.Dto.UsuarioDTO;
import com.exe.AparcaYA.Entity.*;
import com.exe.AparcaYA.Enum.*;
import com.exe.AparcaYA.Implement.RegistroEntradaSalidaServiceImpl;
import com.exe.AparcaYA.Repository.UsuarioRepository;
import com.exe.AparcaYA.Service.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import jakarta.transaction.Transactional;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/trabajador")
//@PreAuthorize("hasRole('OPERARIO')")
@CrossOrigin(origins = "*")
public class TrabajadorController {

    @Autowired
    private VehiculoService vehiculoService;

    @Autowired
    private RegistroEntradaSalidaService registroService;

    @Autowired
    private ReservacionService reservacionService;

    @Autowired
    private UsuarioService usuarioService;

    @Autowired
    private SedeService sedeService;

    @Autowired
    private CupoService cupoService;

    @Autowired
    private UsuarioRepository usuarioRepository;

    private final PasswordEncoder passwordEncoder;


    // ==================== MÉTODOS AUXILIARES ====================

    private Sede getSedeDelUsuarioAutenticado() {
        Usuario usuario = getUsuarioAutenticado();
        return usuario != null ? usuario.getSedeAsignada() : null;
    }

    private Usuario getUsuarioAutenticado() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        if (auth == null || !auth.isAuthenticated()) {
            System.err.println("⚠️ No hay autenticación");
            return null;
        }

        String identifier = auth.getName();
        System.out.println("🔍 Identifier recibido: " + identifier);

        Optional<Usuario> usuario = usuarioRepository.findByCorreo(identifier);

        if (usuario.isEmpty()) {
            System.err.println("❌ No se encontró usuario con correo: " + identifier);
            return null;
        }

        Usuario user = usuario.get();

        if (user.getSedeAsignada() == null) {
            System.err.println("❌ El usuario NO tiene sede asignada");
            return null;
        }

        System.out.println("✅ Usuario encontrado: " + user.getNombre() + " - Sede: " + user.getSedeAsignada().getNombre());
        return user;
    }

    private String formatearTiempo(Duration duracion) {
        long horas = duracion.toHours();
        long minutos = duracion.toMinutes() % 60;
        long segundos = duracion.getSeconds() % 60;

        if (horas > 0) {
            return String.format("%dh %dm %ds", horas, minutos, segundos);
        } else if (minutos > 0) {
            return String.format("%dm %ds", minutos, segundos);
        } else {
            return String.format("%ds", segundos);
        }
    }

    private String getCellValueAsString(Cell cell) {
        if (cell == null) return "";

        switch (cell.getCellType()) {
            case STRING:
                return cell.getStringCellValue().trim();
            case NUMERIC:
                if (DateUtil.isCellDateFormatted(cell)) {
                    return cell.getLocalDateTimeCellValue().toString();
                }
                return String.valueOf((long) cell.getNumericCellValue());
            case BOOLEAN:
                return String.valueOf(cell.getBooleanCellValue());
            default:
                return "";
        }
    }

    private LocalDateTime parsearFechaHora(String fechaHora) {
        DateTimeFormatter[] formatters = {
                DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"),
                DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"),
                DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss"),
                DateTimeFormatter.ISO_LOCAL_DATE_TIME
        };

        for (DateTimeFormatter formatter : formatters) {
            try {
                return LocalDateTime.parse(fechaHora, formatter);
            } catch (Exception ignored) {
            }
        }
        return LocalDateTime.now();
    }

    // ==================== INDICADORES DEL DASHBOARD ====================

    @GetMapping("/indicadores")
    public ResponseEntity<Map<String, Object>> getIndicadores() {
        try {
            // 🔍 DEBUG - Ver qué viene en la autenticación
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            System.out.println("==================");
            System.out.println("🔑 Auth presente: " + (auth != null));
            System.out.println("🔑 Autenticado: " + (auth != null && auth.isAuthenticated()));
            System.out.println("🔑 Auth.getName(): " + (auth != null ? auth.getName() : "null"));
            System.out.println("==================");

            Sede sede = getSedeDelUsuarioAutenticado();

            // ✅ VALIDACIÓN: Si no hay sede, retornar error
            if (sede == null) {
                System.err.println("❌ No se pudo obtener la sede del usuario");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("error", "No se encontró una sede asignada al usuario autenticado"));
            }

            System.out.println("✅ Sede obtenida: " + sede.getNombre());

            Map<String, Object> indicadores = new HashMap<>();

            // Vehículos actualmente en el parqueadero
            List<RegistroEntradaSalida> vehiculosActivos = registroService
                    .findBySedeAndEstado(sede, EstadoRegistro.ACTIVO);

            int ocupacionActual = vehiculosActivos.size();
            int capacidadTotal = sede.getCapacidad();
            int cuposLibres = Math.max(0, capacidadTotal - ocupacionActual);

            // Estadísticas del día
            LocalDateTime inicioHoy = LocalDate.now().atStartOfDay();
            LocalDateTime finHoy = inicioHoy.plusDays(1);

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

            // Información básica
            indicadores.put("ocupacionActual", ocupacionActual);
            indicadores.put("capacidadTotal", capacidadTotal);
            indicadores.put("cuposLibres", cuposLibres);
            indicadores.put("porcentajeOcupacion", capacidadTotal > 0 ?
                    Math.round((ocupacionActual * 100.0) / capacidadTotal) : 0);
            indicadores.put("vehiculosHoy", vehiculosHoy);
            indicadores.put("ingresosDia", ingresosDia);
            indicadores.put("pendientesCobro", pendientesCobro);
            indicadores.put("sedeNombre", sede.getNombre());
            indicadores.put("sedeActiva", sede.getEstado());

            // Tarifas separadas
            indicadores.put("tarifaPlenaC", sede.getTarifaPlenaC());
            indicadores.put("tarifaPlenaM", sede.getTarifaPlenaM());
            indicadores.put("tarifaMinutoC", sede.getTarifaMinutoC());
            indicadores.put("tarifaMinutoM", sede.getTarifaMinutoM());

            System.out.println("✅ Indicadores generados exitosamente");
            return ResponseEntity.ok(indicadores);

        } catch (Exception e) {
            System.err.println("❌ ERROR en getIndicadores: " + e.getMessage());
            e.printStackTrace();

            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Error al cargar indicadores: " + e.getMessage()));
        }
    }


    // ==================== VEHÍCULOS ACTIVOS (TEMPORIZANDO) ====================

    @GetMapping("/vehiculos-activos")
    public ResponseEntity<?> getVehiculosActivos() {
        try {
            Sede sede = getSedeDelUsuarioAutenticado();

            List<RegistroEntradaSalida> registros = registroService
                    .findBySedeAndEstado(sede, EstadoRegistro.ACTIVO);

            List<Map<String, Object>> vehiculos = registros.stream().map(registro -> {
                Map<String, Object> vehiculo = new HashMap<>();
                vehiculo.put("registroId", registro.getIdRegistro());
                vehiculo.put("placa", registro.getVehiculo().getPlaca());
                vehiculo.put("tipoVehiculo", registro.getVehiculo().getTipo().toString());
                vehiculo.put("marca", registro.getVehiculo().getMarca().toString());
                vehiculo.put("color", registro.getVehiculo().getColor());
                vehiculo.put("horaEntrada", registro.getFechaHoraEntrada().toString());

                // Datos del cliente
                Usuario cliente = registro.getVehiculo().getIdUsuario();
                vehiculo.put("clienteNombre", cliente.getNombre());
                vehiculo.put("clienteTelefono", cliente.getTelefono());
                vehiculo.put("clienteEmail", cliente.getCorreo());

                // Calcular tiempo transcurrido
                Duration duracion = Duration.between(registro.getFechaHoraEntrada(), LocalDateTime.now());
                vehiculo.put("tiempoTranscurrido", formatearTiempo(duracion));
                vehiculo.put("tiempoMs", duracion.toMillis());
                vehiculo.put("segundosTranscurridos", duracion.getSeconds());

                // ===== CAMBIO: Calcular cobros estimados según tipo de vehículo =====
                String tipoVehiculo = registro.getVehiculo().getTipo().toString();
                boolean esCarro = tipoVehiculo.equalsIgnoreCase("CARRO") ||
                        tipoVehiculo.equalsIgnoreCase("AUTOMOVIL") ||
                        tipoVehiculo.equalsIgnoreCase("AUTO");

                // Tarifas según tipo de vehículo
                Double tarifaPlena = esCarro ? sede.getTarifaPlenaC() : sede.getTarifaPlenaM();
                Double tarifaMinuto = esCarro ? sede.getTarifaMinutoC() : sede.getTarifaMinutoM();

                // Cobro estimado por tarifa plena (día completo)
                BigDecimal cobroEstimadoPlena = BigDecimal.valueOf(tarifaPlena)
                        .setScale(2, RoundingMode.HALF_UP);

                // Cobro estimado por minutos
                long minutosTranscurridos = duracion.toMinutes();
                BigDecimal cobroEstimadoMinuto = BigDecimal.valueOf(minutosTranscurridos * tarifaMinuto)
                        .setScale(2, RoundingMode.HALF_UP);

                // Agregar ambas opciones de cobro
                vehiculo.put("cobroEstimadoPlena", cobroEstimadoPlena);
                vehiculo.put("cobroEstimadoMinuto", cobroEstimadoMinuto);
                vehiculo.put("minutosTranscurridos", minutosTranscurridos);
                vehiculo.put("tarifaPlena", tarifaPlena);
                vehiculo.put("tarifaMinuto", tarifaMinuto);

                // Para compatibilidad, dejar el cobro estimado por minutos como principal
                vehiculo.put("cobroEstimado", cobroEstimadoMinuto);
                // ==================================================================

                // Cupo asignado
                vehiculo.put("cupo", registro.getCupo() != null ?
                        registro.getCupo().getCodigo() : "Sin asignar");

                return vehiculo;
            }).collect(Collectors.toList());

            return ResponseEntity.ok(vehiculos);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== VEHÍCULOS PENDIENTES DE COBRO ====================

    @GetMapping("/vehiculos-pendientes-cobro")
    public ResponseEntity<?> getVehiculosPendientesCobro() {
        try {
            // SIN AUTENTICACIÓN: Elimina getSedeDelUsuarioAutenticado()
            // Opción 1: Filtrar por una sede fija (e.g., ID 1) o la primera disponible
            // Asumiendo que tienes un servicio para obtener sedes, ajusta según tu código
            List<Sede> sedes = sedeService.findAll();  // O un método para obtener sedes
            Sede sede = sedes.isEmpty() ? null : sedes.get(0);  // Usa la primera sede como ejemplo

            // Si no hay sede, devuelve vacío o todos (ajusta según necesidad)
            if (sede == null) {
                return ResponseEntity.ok(new ArrayList<>());  // Lista vacía
            }

            List<RegistroEntradaSalida> registros = registroService
                    .findBySedeAndEstado(sede, EstadoRegistro.FINALIZADO);

            List<Map<String, Object>> vehiculos = registros.stream().map(registro -> {
                Map<String, Object> vehiculo = new HashMap<>();
                vehiculo.put("registroId", registro.getIdRegistro());
                vehiculo.put("placa", registro.getVehiculo().getPlaca());
                vehiculo.put("tipoVehiculo", registro.getVehiculo().getTipo().toString());
                vehiculo.put("horaEntrada", registro.getFechaHoraEntrada().toString());
                vehiculo.put("horaSalida", registro.getFechaHoraSalida().toString());

                // Datos del cliente
                Usuario cliente = registro.getVehiculo().getIdUsuario();
                vehiculo.put("clienteNombre", cliente.getNombre());
                vehiculo.put("clienteTelefono", cliente.getTelefono());

                // Tiempo total
                Duration duracion = Duration.between(registro.getFechaHoraEntrada(), registro.getFechaHoraSalida());
                vehiculo.put("tiempoTotal", formatearTiempo(duracion));
                vehiculo.put("precio", registro.getPrecio());

                return vehiculo;
            }).collect(Collectors.toList());

            return ResponseEntity.ok(vehiculos);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

// CONTINÚA EN PARTE 2...
    // ==================== HISTORIAL COMPLETO ====================

    @GetMapping("/historial")
    public ResponseEntity<?> getHistorial(
            @RequestParam(required = false) String fecha,
            @RequestParam(required = false) String estado) {
        try {
            Sede sede = getSedeDelUsuarioAutenticado();

            List<RegistroEntradaSalida> registros = registroService.findHistorialBySede(sede);

            // Filtrar por fecha si se proporciona
            if (fecha != null && !fecha.isEmpty()) {
                LocalDate fechaFiltro = LocalDate.parse(fecha);
                registros = registros.stream()
                        .filter(r -> r.getFechaHoraEntrada().toLocalDate().equals(fechaFiltro))
                        .collect(Collectors.toList());
            }

            // Filtrar por estado si se proporciona
            if (estado != null && !estado.isEmpty()) {
                EstadoRegistro estadoFiltro = EstadoRegistro.valueOf(estado.toUpperCase());
                registros = registros.stream()
                        .filter(r -> r.getEstado() == estadoFiltro)
                        .collect(Collectors.toList());
            }

            List<Map<String, Object>> historial = registros.stream().map(registro -> {
                Map<String, Object> item = new HashMap<>();
                item.put("registroId", registro.getIdRegistro());
                item.put("placa", registro.getVehiculo().getPlaca());
                item.put("tipoVehiculo", registro.getVehiculo().getTipo().toString());
                item.put("marca", registro.getVehiculo().getMarca().toString());
                item.put("horaEntrada", registro.getFechaHoraEntrada().toString());
                item.put("horaSalida", registro.getFechaHoraSalida() != null ?
                        registro.getFechaHoraSalida().toString() : null);
                item.put("estado", registro.getEstado().toString());
                item.put("precio", registro.getPrecio());
                item.put("metodoPago", registro.getMetodoPago());

                // Datos del cliente
                Usuario cliente = registro.getVehiculo().getIdUsuario();
                item.put("clienteNombre", cliente.getNombre());
                item.put("clienteTelefono", cliente.getTelefono());
                item.put("clienteEmail", cliente.getCorreo());

                // Tiempo total si ya salió
                if (registro.getFechaHoraSalida() != null) {
                    Duration duracion = Duration.between(registro.getFechaHoraEntrada(), registro.getFechaHoraSalida());
                    item.put("tiempoTotal", formatearTiempo(duracion));
                } else {
                    Duration duracion = Duration.between(registro.getFechaHoraEntrada(), LocalDateTime.now());
                    item.put("tiempoTotal", formatearTiempo(duracion) + " (en curso)");
                }

                return item;
            }).collect(Collectors.toList());

            return ResponseEntity.ok(historial);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== REGISTRAR ENTRADA ====================

    @PostMapping("/registrar-entrada")
    public ResponseEntity<Map<String, Object>> registrarEntrada(@RequestBody Map<String, String> datos) {
        try {
            Sede sede = getSedeDelUsuarioAutenticado();
            Usuario trabajador = getUsuarioAutenticado();

            // Validar capacidad
            List<RegistroEntradaSalida> vehiculosActivos = registroService
                    .findBySedeAndEstado(sede, EstadoRegistro.ACTIVO);

            if (vehiculosActivos.size() >= sede.getCapacidad()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Parqueadero lleno. No hay cupos disponibles."));
            }

            // Datos del cliente
            String nombre = datos.get("clienteNombre");
            String telefono = datos.get("clienteTelefono");
            String correo = datos.get("clienteEmail");
            String cedula = datos.getOrDefault("clienteCedula", "");

            // Buscar o crear cliente
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

            // Datos del vehículo
            String placa = datos.get("vehiculoPlaca").toUpperCase().trim();
            String tipoVehiculo = datos.getOrDefault("vehiculoTipo", "CARRO");
            String marca = datos.getOrDefault("vehiculoMarca", "OTRO");
            String color = datos.getOrDefault("vehiculoColor", "NO ESPECIFICADO");
            int anio = Integer.parseInt(datos.getOrDefault("vehiculoAnio", "2020"));

            // Verificar si el vehículo ya está en el parqueadero
            Optional<Vehiculo> vehiculoExistente = vehiculoService.findByPlaca(placa);
            if (vehiculoExistente.isPresent()) {
                Optional<RegistroEntradaSalida> registroActivo = registroService.findVehiculoActivo(vehiculoExistente.get());
                if (registroActivo.isPresent()) {
                    return ResponseEntity.badRequest()
                            .body(Map.of("error", "Este vehículo ya se encuentra en el parqueadero"));
                }
            }

            // Buscar o crear vehículo
            Vehiculo vehiculo = vehiculoService.findByPlaca(placa)
                    .orElseGet(() -> {
                        Vehiculo nuevoVehiculo = new Vehiculo();
                        nuevoVehiculo.setPlaca(placa);
                        nuevoVehiculo.setTipo(TipoVehiculo.valueOf(tipoVehiculo.toUpperCase()));
                        nuevoVehiculo.setMarca(Marca.valueOf(marca.toUpperCase()));
                        nuevoVehiculo.setColor(color);
                        nuevoVehiculo.setAnio(anio);
                        nuevoVehiculo.setIdUsuario(cliente);
                        return vehiculoService.save(nuevoVehiculo);
                    });

            // Buscar cupo disponible
            List<Cupo> cuposDisponibles = cupoService.findBySedeAndEstado(sede, EstadoCupo.DISPONIBLE);
            Cupo cupoAsignado = null;

            if (!cuposDisponibles.isEmpty()) {
                cupoAsignado = cuposDisponibles.get(0);
            }

            // Registrar entrada usando el servicio
            RegistroEntradaSalida registro = registroService.registrarEntrada(vehiculo, sede, cupoAsignado, trabajador);

            // ===== CAMBIO: Determinar tarifas según tipo de vehículo =====
            boolean esCarro = tipoVehiculo.equalsIgnoreCase("CARRO") ||
                    tipoVehiculo.equalsIgnoreCase("AUTOMOVIL") ||
                    tipoVehiculo.equalsIgnoreCase("AUTO");

            Double tarifaPlena = esCarro ? sede.getTarifaPlenaC() : sede.getTarifaPlenaM();
            Double tarifaMinuto = esCarro ? sede.getTarifaMinutoC() : sede.getTarifaMinutoM();
            // ==============================================================

            Map<String, Object> response = new HashMap<>();
            response.put("mensaje", "Vehículo registrado exitosamente. Temporizador iniciado.");
            response.put("registroId", registro.getIdRegistro());
            response.put("placa", placa);
            response.put("tipoVehiculo", tipoVehiculo);
            response.put("clienteNombre", cliente.getNombre());
            response.put("horaEntrada", registro.getFechaHoraEntrada().toString());
            response.put("cupo", cupoAsignado != null ? cupoAsignado.getCodigo() : "Sin asignar");

            // ===== CAMBIO: Devolver las tarifas aplicables según tipo de vehículo =====
            response.put("tarifaPlena", tarifaPlena);
            response.put("tarifaMinuto", tarifaMinuto);

            // Opcional: Devolver todas las tarifas de la sede para referencia
            Map<String, Double> todasLasTarifas = new HashMap<>();
            todasLasTarifas.put("plenaC", sede.getTarifaPlenaC());
            todasLasTarifas.put("plenaM", sede.getTarifaPlenaM());
            todasLasTarifas.put("minutoC", sede.getTarifaMinutoC());
            todasLasTarifas.put("minutoM", sede.getTarifaMinutoM());
            response.put("tarifasSede", todasLasTarifas);
            // ===========================================================================

            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

// CONTINÚA EN PARTE 2B...
    // ==================== REGISTRAR SALIDA ====================

    @PostMapping("/registrar-salida/{registroId}")
    public ResponseEntity<Map<String, Object>> registrarSalida(@PathVariable Long registroId) {
        try {
            RegistroEntradaSalida registro = registroService.registrarSalida(registroId);

            Map<String, Object> response = new HashMap<>();
            response.put("mensaje", "Salida registrada. Pendiente de cobro.");
            response.put("registroId", registro.getIdRegistro());
            response.put("placa", registro.getVehiculo().getPlaca());
            response.put("clienteNombre", registro.getVehiculo().getIdUsuario().getNombre());
            response.put("horaEntrada", registro.getFechaHoraEntrada().toString());
            response.put("horaSalida", registro.getFechaHoraSalida().toString());
            response.put("precio", registro.getPrecio());

            // Calcular tiempo total
            Duration duracion = Duration.between(registro.getFechaHoraEntrada(), registro.getFechaHoraSalida());
            response.put("tiempoTotal", formatearTiempo(duracion));

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== CONFIRMAR COBRO ====================

    /**
     * ✅ CONFIRMAR COBRO CON SELECCIÓN DE TARIFA
     * Permite al trabajador elegir entre tarifa PLENA o por MINUTO
     */
    @PostMapping("/confirmar-cobro/{registroId}")
    public ResponseEntity<Map<String, Object>> confirmarCobro(
            @PathVariable Long registroId,
            @RequestBody Map<String, String> datos) {
        try {
            String metodoPago = datos.getOrDefault("metodoPago", "EFECTIVO");
            String tipoTarifa = datos.getOrDefault("tipoTarifa", "MINUTO"); // ✅ NUEVO PARÁMETRO

            // Validar tipo de tarifa
            if (!tipoTarifa.equalsIgnoreCase("PLENA") && !tipoTarifa.equalsIgnoreCase("MINUTO")) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Tipo de tarifa inválido. Debe ser 'PLENA' o 'MINUTO'"));
            }

            // Usar el nuevo método del servicio
            RegistroEntradaSalidaServiceImpl serviceImpl = (RegistroEntradaSalidaServiceImpl) registroService;
            RegistroEntradaSalida registro = serviceImpl.confirmarCobroConTarifa(
                    registroId,
                    metodoPago,
                    tipoTarifa
            );

            Map<String, Object> response = new HashMap<>();
            response.put("mensaje", "Cobro confirmado exitosamente");
            response.put("registroId", registro.getIdRegistro());
            response.put("placa", registro.getVehiculo().getPlaca());
            response.put("precio", registro.getPrecio());
            response.put("metodoPago", registro.getMetodoPago());
            response.put("tipoTarifaAplicada", tipoTarifa);
            response.put("estado", registro.getEstado().toString());

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * ✅ OBTENER OPCIONES DE COBRO
     * Devuelve ambas opciones (PLENA y MINUTO) para que el trabajador elija
     */
    @GetMapping("/opciones-cobro/{registroId}")
    public ResponseEntity<?> getOpcionesCobro(@PathVariable Long registroId) {
        try {
            RegistroEntradaSalida registro = registroService.findById(registroId)
                    .orElseThrow(() -> new RuntimeException("Registro no encontrado"));

            if (registro.getEstado() != EstadoRegistro.FINALIZADO) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "El registro no está pendiente de cobro"));
            }

            // Determinar tipo de vehículo
            TipoVehiculo tipoVehiculo = registro.getVehiculo().getTipo();
            boolean esCarro = (tipoVehiculo == TipoVehiculo.CARRO);

            Sede sede = registro.getSede();

            // Calcular tiempo transcurrido
            Duration duracion = Duration.between(registro.getFechaHoraEntrada(), registro.getFechaHoraSalida());
            long minutosTranscurridos = duracion.toMinutes();

            // Opción 1: Tarifa Plena
            Double tarifaPlena = esCarro ? sede.getTarifaPlenaC() : sede.getTarifaPlenaM();

            // Opción 2: Tarifa por Minuto
            Double tarifaMinuto = esCarro ? sede.getTarifaMinutoC() : sede.getTarifaMinutoM();
            BigDecimal precioMinuto = BigDecimal.valueOf(minutosTranscurridos * tarifaMinuto)
                    .setScale(2, RoundingMode.HALF_UP);

            Map<String, Object> response = new HashMap<>();
            response.put("registroId", registroId);
            response.put("placa", registro.getVehiculo().getPlaca());
            response.put("clienteNombre", registro.getVehiculo().getIdUsuario().getNombre());
            response.put("tipoVehiculo", tipoVehiculo.toString());
            response.put("horaEntrada", registro.getFechaHoraEntrada().toString());
            response.put("horaSalida", registro.getFechaHoraSalida().toString());
            response.put("minutosTranscurridos", minutosTranscurridos);

            // Tiempo formateado
            long horas = duracion.toHours();
            long minutos = duracion.toMinutes() % 60;
            String tiempoFormateado = horas > 0 ? horas + "h " + minutos + "m" : minutos + "m";
            response.put("tiempoTotal", tiempoFormateado);

            // Opciones de cobro
            Map<String, Object> opcionPlena = new HashMap<>();
            opcionPlena.put("tipo", "PLENA");
            opcionPlena.put("nombre", "Tarifa Plena (Día Completo)");
            opcionPlena.put("precio", tarifaPlena);
            opcionPlena.put("descripcion", "Tarifa fija del día");

            Map<String, Object> opcionMinuto = new HashMap<>();
            opcionMinuto.put("tipo", "MINUTO");
            opcionMinuto.put("nombre", "Tarifa por Minuto");
            opcionMinuto.put("precio", precioMinuto);
            opcionMinuto.put("descripcion", minutosTranscurridos + " minutos × $" +
                    tarifaMinuto.intValue() + "/min");

            response.put("opciones", List.of(opcionPlena, opcionMinuto));

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== RESERVACIONES ====================

    @GetMapping("/reservaciones")
    public ResponseEntity<?> getReservaciones() {
        try {
            Sede sede = getSedeDelUsuarioAutenticado();

            List<Reservacion> todasReservaciones = reservacionService.findAll();

            List<Reservacion> reservacionesSede = todasReservaciones.stream()
                    .filter(r -> r.getCupo().getSede().getIdSede().equals(sede.getIdSede()))
                    .filter(r -> r.getEstado() == EstadoReservacion.PENDIENTE)
                    .collect(Collectors.toList());

            List<Map<String, Object>> reservas = reservacionesSede.stream().map(reserva -> {
                Map<String, Object> r = new HashMap<>();
                r.put("id", reserva.getIdReserva());
                r.put("clienteNombre", reserva.getCliente().getNombre());
                r.put("clienteTelefono", reserva.getCliente().getTelefono());
                r.put("clienteEmail", reserva.getCliente().getCorreo());
                r.put("placa", reserva.getVehiculo().getPlaca());
                r.put("tipoVehiculo", reserva.getVehiculo().getTipo().toString());
                r.put("horaInicio", reserva.getFechaInicio().toString());
                r.put("horaFin", reserva.getFechaFin().toString());
                r.put("cupo", reserva.getCupo().getCodigo());
                r.put("estado", reserva.getEstado().toString());
                return r;
            }).collect(Collectors.toList());

            return ResponseEntity.ok(reservas);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/aceptar-reservacion/{reservacionId}")
    public ResponseEntity<Map<String, Object>> aceptarReservacion(@PathVariable Long reservacionId) {
        try {
            Sede sede = getSedeDelUsuarioAutenticado();
            Usuario trabajador = getUsuarioAutenticado();

            Reservacion reservacion = reservacionService.findById(reservacionId)
                    .orElseThrow(() -> new RuntimeException("Reservación no encontrada"));

            // Cambiar estado de la reservación
            reservacion.setEstado(EstadoReservacion.ACTIVA);
            reservacionService.save(reservacion);

            // Registrar entrada del vehículo
            RegistroEntradaSalida registro = registroService.registrarEntrada(
                    reservacion.getVehiculo(),
                    sede,
                    reservacion.getCupo(),
                    trabajador
            );

            Map<String, Object> response = new HashMap<>();
            response.put("mensaje", "Reservación aceptada y vehículo registrado");
            response.put("reservacionId", reservacionId);
            response.put("registroId", registro.getIdRegistro());
            response.put("placa", reservacion.getVehiculo().getPlaca());
            response.put("clienteNombre", reservacion.getCliente().getNombre());
            response.put("horaEntrada", registro.getFechaHoraEntrada().toString());

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/rechazar-reservacion/{reservacionId}")
    public ResponseEntity<Map<String, Object>> rechazarReservacion(@PathVariable Long reservacionId) {
        try {
            Reservacion reservacion = reservacionService.findById(reservacionId)
                    .orElseThrow(() -> new RuntimeException("Reservación no encontrada"));

            // Cambiar estado de la reservación
            reservacion.setEstado(EstadoReservacion.CANCELADA);
            reservacionService.save(reservacion);

            // Liberar el cupo
            Cupo cupo = reservacion.getCupo();
            cupo.setEstado(EstadoCupo.DISPONIBLE);
            cupoService.save(cupo);

            Map<String, Object> response = new HashMap<>();
            response.put("mensaje", "Reservación rechazada");
            response.put("reservacionId", reservacionId);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }


    // ==================== CARGA MASIVA DESDE EXCEL ====================

    @PostMapping("/carga-masiva")
    public ResponseEntity<Map<String, Object>> cargaMasiva(@RequestParam("file") MultipartFile file) {
        System.out.println("=== INICIO CARGA MASIVA ===");

        try {
            if (file.isEmpty()) {
                System.out.println("❌ Archivo vacío");
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Archivo vacío"));
            }

            Sede sede = getSedeDelUsuarioAutenticado();
            System.out.println("Sede del usuario: " + (sede != null ? sede.getNombre() : "NULL"));

            Workbook workbook = new XSSFWorkbook(file.getInputStream());
            Sheet sheet = workbook.getSheetAt(0);

            System.out.println("Total de filas en Excel: " + sheet.getLastRowNum());

            int clientesRegistrados = 0;
            int vehiculosRegistrados = 0;
            List<String> errores = new ArrayList<>();
            List<Map<String, Object>> registrosCargados = new ArrayList<>();

            // ============================================
            // PASADA 1: PROCESAR TODOS LOS CLIENTES PRIMERO
            // ============================================
            System.out.println("\n=== PASADA 1: PROCESANDO CLIENTES ===");

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) {
                    System.out.println("Fila " + (i + 1) + ": VACÍA - omitiendo");
                    continue;
                }

                try {
                    String tipo = getCellValueAsString(row.getCell(0));
                    System.out.println("\nFila " + (i + 1) + " - Tipo: " + tipo);

                    if ("Cliente".equalsIgnoreCase(tipo)) {
                        String nombre = getCellValueAsString(row.getCell(1));
                        String telefono = getCellValueAsString(row.getCell(2));
                        String email = getCellValueAsString(row.getCell(3));
                        String cedula = getCellValueAsString(row.getCell(4));

                        System.out.println("  Datos Cliente:");
                        System.out.println("    Nombre: " + nombre);
                        System.out.println("    Email: " + email);
                        System.out.println("    Teléfono: " + telefono);
                        System.out.println("    Cédula: " + cedula);

                        // Validar campos obligatorios
                        if (nombre == null || nombre.trim().isEmpty() ||
                                email == null || email.trim().isEmpty() ||
                                telefono == null || telefono.trim().isEmpty()) {
                            System.err.println("  ❌ Faltan datos obligatorios");
                            errores.add("Fila " + (i + 1) + ": Faltan datos obligatorios del cliente");
                            continue;
                        }

                        // Verificar si ya existe por correo
                        Optional<Usuario> existente = usuarioService.findByCorreo(email.trim());
                        if (existente.isPresent()) {
                            System.out.println("  ⚠️ Cliente ya existe - OMITIDO");
                            errores.add("Fila " + (i + 1) + ": Cliente con email " + email + " ya existe - OMITIDO");
                            continue;
                        }

                        // Verificar teléfono duplicado
                        if (usuarioService.findByTelefono(telefono.trim()) != null) {
                            System.out.println("  ⚠️ Teléfono ya existe - OMITIDO");
                            errores.add("Fila " + (i + 1) + ": Teléfono " + telefono + " ya registrado - OMITIDO");
                            continue;
                        }

                        // Verificar cédula duplicada
                        String cedulaFinal = (cedula == null || cedula.trim().isEmpty()) ? "0000000000" : cedula.trim();
                        if (usuarioService.findByCedula(cedulaFinal) != null) {
                            System.out.println("  ⚠️ Cédula ya existe - OMITIDO");
                            errores.add("Fila " + (i + 1) + ": Cédula " + cedulaFinal + " ya registrada - OMITIDO");
                            continue;
                        }

                        // Crear cliente directamente usando Builder
                        Usuario cliente = Usuario.builder()
                                .nombre(nombre.trim())
                                .correo(email.trim())
                                .telefono(telefono.trim())
                                .cedula(cedulaFinal)
                                .contrasena(passwordEncoder.encode("Temp123!"))
                                .rol(Rolenum.CLIENTE)
                                .tipoCliente(TipoCliente.NORMAL)
                                .metodoPago(MetodoPago.EFECTIVO)
                                .estado(EstadoGeneral.ACTIVO)
                                .descripcion("")
                                .build();

                        System.out.println("  Guardando cliente...");
                        Usuario guardado = usuarioService.save(cliente);
                        clientesRegistrados++;
                        System.out.println("  ✅ Cliente guardado con ID: " + guardado.getIdUsuario());

                        Map<String, Object> reg = new HashMap<>();
                        reg.put("tipo", "Cliente");
                        reg.put("nombre", nombre);
                        reg.put("email", email);
                        reg.put("telefono", telefono);
                        reg.put("cedula", cedulaFinal);
                        registrosCargados.add(reg);
                    }

                } catch (Exception e) {
                    System.err.println("  ❌ ERROR en fila " + (i + 1) + " (Cliente): " + e.getMessage());
                    e.printStackTrace();
                    errores.add("Fila " + (i + 1) + " (Cliente): " + e.getMessage());
                }
            }

            System.out.println("\n=== RESUMEN PASADA 1 ===");
            System.out.println("Clientes registrados: " + clientesRegistrados);
            System.out.println("Errores: " + errores.size());

            // ============================================
            // PASADA 2: PROCESAR TODOS LOS VEHÍCULOS
            // ============================================
            System.out.println("\n=== PASADA 2: PROCESANDO VEHÍCULOS ===");

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;

                try {
                    String tipo = getCellValueAsString(row.getCell(0));
                    System.out.println("\nFila " + (i + 1) + " - Tipo: " + tipo);

                    if ("Vehiculo".equalsIgnoreCase(tipo) || "Vehículo".equalsIgnoreCase(tipo)) {
                        String placa = getCellValueAsString(row.getCell(1)).toUpperCase().trim();
                        String tipoVeh = getCellValueAsString(row.getCell(2)).toUpperCase().trim();
                        String marca = getCellValueAsString(row.getCell(3)).toUpperCase().trim();
                        String color = getCellValueAsString(row.getCell(4)).trim();
                        String anioStr = getCellValueAsString(row.getCell(5)).trim();
                        String emailCliente = getCellValueAsString(row.getCell(6)).trim();

                        System.out.println("  Datos Vehículo:");
                        System.out.println("    Placa: " + placa);
                        System.out.println("    Tipo: " + tipoVeh);
                        System.out.println("    Marca: " + marca);
                        System.out.println("    Color: " + color);
                        System.out.println("    Año: " + anioStr);
                        System.out.println("    Email Cliente: " + emailCliente);

                        // Validar campos obligatorios
                        if (placa.isEmpty() || emailCliente.isEmpty()) {
                            errores.add("Fila " + (i + 1) + ": Faltan datos obligatorios (placa o email)");
                            System.err.println("  ❌ Faltan datos obligatorios");
                            continue;
                        }

                        // Validar año
                        int anio = 2020;
                        try {
                            anio = Integer.parseInt(anioStr);
                            if (anio < 1900 || anio > 2030) {
                                System.out.println("    ⚠️ Año fuera de rango, usando 2020");
                                anio = 2020;
                            }
                            System.out.println("    Año parseado: " + anio);
                        } catch (NumberFormatException e) {
                            System.out.println("    ⚠️ Año inválido, usando 2020 por defecto");
                        }

                        // Buscar el cliente
                        System.out.println("  Buscando cliente con email: " + emailCliente);
                        Optional<Usuario> clienteOpt = usuarioService.findByCorreo(emailCliente);

                        if (!clienteOpt.isPresent()) {
                            System.err.println("  ❌ Cliente NO encontrado: " + emailCliente);
                            errores.add("Fila " + (i + 1) + ": Cliente no encontrado con email: " + emailCliente);
                            continue;
                        }

                        Usuario cliente = clienteOpt.get();
                        System.out.println("  ✓ Cliente encontrado: " + cliente.getNombre() + " (ID: " + cliente.getIdUsuario() + ")");

                        // Verificar si el vehículo ya existe
                        Optional<Vehiculo> existente = vehiculoService.findByPlaca(placa);
                        if (existente.isPresent()) {
                            System.out.println("  ⚠️ Vehículo ya existe - OMITIDO");
                            errores.add("Fila " + (i + 1) + ": Vehículo con placa " + placa + " ya existe - OMITIDO");
                            continue;
                        }

                        // Validar y convertir TipoVehiculo
                        TipoVehiculo tipoVehiculo;
                        try {
                            tipoVehiculo = TipoVehiculo.valueOf(tipoVeh);
                            System.out.println("  ✓ Tipo Vehículo válido: " + tipoVehiculo);
                        } catch (IllegalArgumentException e) {
                            System.err.println("  ❌ Tipo de vehículo inválido: " + tipoVeh);
                            errores.add("Fila " + (i + 1) + ": Tipo de vehículo inválido: " + tipoVeh + " (debe ser: CARRO, MOTO, BICICLETA, OTRO)");
                            continue;
                        }

                        // Validar y convertir Marca
                        Marca marcaEnum;
                        try {
                            marcaEnum = Marca.valueOf(marca);
                            System.out.println("  ✓ Marca válida: " + marcaEnum);
                        } catch (IllegalArgumentException e) {
                            System.err.println("  ❌ Marca inválida: " + marca);
                            errores.add("Fila " + (i + 1) + ": Marca inválida: " + marca + " (valores permitidos: " + Arrays.toString(Marca.values()) + ")");
                            continue;
                        }

                        // Crear y guardar vehículo usando Builder
                        System.out.println("  Creando vehículo...");
                        System.out.println("  Cliente asignado: " + cliente.getIdUsuario() + " - " + cliente.getNombre());

                        Vehiculo vehiculo = Vehiculo.builder()
                                .placa(placa)
                                .tipo(tipoVehiculo)
                                .marca(marcaEnum)
                                .color(color)
                                .anio(anio)
                                .idUsuario(cliente)
                                .build();

                        System.out.println("  Vehículo construido:");
                        System.out.println("    - Placa: " + vehiculo.getPlaca());
                        System.out.println("    - Tipo: " + vehiculo.getTipo());
                        System.out.println("    - Marca: " + vehiculo.getMarca());
                        System.out.println("    - Color: " + vehiculo.getColor());
                        System.out.println("    - Año: " + vehiculo.getAnio());
                        System.out.println("    - Usuario ID: " + (vehiculo.getIdUsuario() != null ? vehiculo.getIdUsuario().getIdUsuario() : "NULL"));

                        System.out.println("  Llamando a vehiculoService.save()...");
                        Vehiculo guardado = vehiculoService.save(vehiculo);
                        vehiculosRegistrados++;
                        System.out.println("  ✅ Vehículo guardado exitosamente con ID: " + guardado.getIdVehiculo());

                        Map<String, Object> reg = new HashMap<>();
                        reg.put("tipo", "Vehículo");
                        reg.put("placa", placa);
                        reg.put("tipoVehiculo", tipoVeh);
                        reg.put("marca", marca);
                        reg.put("color", color);
                        reg.put("año", anio);
                        reg.put("propietario", cliente.getNombre());
                        registrosCargados.add(reg);
                    }

                } catch (Exception e) {
                    System.err.println("  ❌ ERROR en fila " + (i + 1) + " (Vehículo): " + e.getMessage());
                    e.printStackTrace();
                    errores.add("Fila " + (i + 1) + " (Vehículo): " + e.getMessage());
                }
            }

            workbook.close();

            System.out.println("\n=== RESUMEN FINAL CARGA MASIVA ===");
            System.out.println("Clientes registrados: " + clientesRegistrados);
            System.out.println("Vehículos registrados: " + vehiculosRegistrados);
            System.out.println("Total errores: " + errores.size());
            System.out.println("=== FIN CARGA MASIVA ===\n");

            Map<String, Object> response = new HashMap<>();
            response.put("mensaje", "Carga masiva completada");
            response.put("clientesRegistrados", clientesRegistrados);
            response.put("vehiculosRegistrados", vehiculosRegistrados);
            response.put("totalRegistros", clientesRegistrados + vehiculosRegistrados);
            response.put("registrosCargados", registrosCargados);
            response.put("errores", errores);
            response.put("tieneErrores", !errores.isEmpty());

            return ResponseEntity.ok(response);

        } catch (IOException e) {
            System.err.println("❌ Error procesando archivo Excel: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Error procesando archivo Excel: " + e.getMessage()));
        } catch (Exception e) {
            System.err.println("❌ Error general: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== BUSCAR CLIENTE POR PLACA ====================

    @GetMapping("/buscar-por-placa/{placa}")
    public ResponseEntity<?> buscarPorPlaca(@PathVariable String placa) {
        try {
            Optional<Vehiculo> vehiculoOpt = vehiculoService.findByPlaca(placa.toUpperCase().trim());

            if (vehiculoOpt.isEmpty()) {
                return ResponseEntity.ok(Map.of(
                        "encontrado", false,
                        "mensaje", "Vehículo no registrado"
                ));
            }

            Vehiculo vehiculo = vehiculoOpt.get();
            Usuario cliente = vehiculo.getIdUsuario();

            Map<String, Object> response = new HashMap<>();
            response.put("encontrado", true);
            response.put("vehiculo", Map.of(
                    "id", vehiculo.getIdVehiculo(),
                    "placa", vehiculo.getPlaca(),
                    "tipo", vehiculo.getTipo().toString(),
                    "marca", vehiculo.getMarca().toString(),
                    "color", vehiculo.getColor(),
                    "anio", vehiculo.getAnio()
            ));
            response.put("cliente", Map.of(
                    "id", cliente.getIdUsuario(),
                    "nombre", cliente.getNombre(),
                    "telefono", cliente.getTelefono(),
                    "email", cliente.getCorreo(),
                    "cedula", cliente.getCedula()
            ));

            return ResponseEntity.ok(response);
        } catch (Exception e) {
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

            LocalDateTime inicio = fechaInicio != null ?
                    LocalDate.parse(fechaInicio).atStartOfDay() :
                    LocalDate.now().minusDays(7).atStartOfDay();

            LocalDateTime fin = fechaFin != null ?
                    LocalDate.parse(fechaFin).atTime(23, 59, 59) :
                    LocalDateTime.now();

            List<RegistroEntradaSalida> registros = registroService
                    .findBySedeAndFechaHoraEntradaBetween(sede, inicio, fin);

            // Total de vehículos
            long totalVehiculos = registros.size();

            // Ingresos totales
            BigDecimal ingresosTotales = registros.stream()
                    .filter(r -> r.getPrecio() != null && r.getEstado() == EstadoRegistro.COBRADO)
                    .map(RegistroEntradaSalida::getPrecio)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            // Por tipo de vehículo
            Map<String, Long> porTipoVehiculo = registros.stream()
                    .collect(Collectors.groupingBy(
                            r -> r.getVehiculo().getTipo().toString(),
                            Collectors.counting()
                    ));

            // Por estado
            Map<String, Long> porEstado = registros.stream()
                    .collect(Collectors.groupingBy(
                            r -> r.getEstado().toString(),
                            Collectors.counting()
                    ));

            // Por método de pago
            Map<String, Long> porMetodoPago = registros.stream()
                    .filter(r -> r.getMetodoPago() != null)
                    .collect(Collectors.groupingBy(
                            RegistroEntradaSalida::getMetodoPago,
                            Collectors.counting()
                    ));

            // Promedio de tiempo de estancia (en minutos)
            double promedioTiempoMinutos = registros.stream()
                    .filter(r -> r.getFechaHoraSalida() != null)
                    .mapToLong(r -> Duration.between(r.getFechaHoraEntrada(), r.getFechaHoraSalida()).toMinutes())
                    .average()
                    .orElse(0);

            Map<String, Object> estadisticas = new HashMap<>();
            estadisticas.put("fechaInicio", inicio.toString());
            estadisticas.put("fechaFin", fin.toString());
            estadisticas.put("totalVehiculos", totalVehiculos);
            estadisticas.put("ingresosTotales", ingresosTotales);
            estadisticas.put("porTipoVehiculo", porTipoVehiculo);
            estadisticas.put("porEstado", porEstado);
            estadisticas.put("porMetodoPago", porMetodoPago);
            estadisticas.put("promedioTiempoMinutos", Math.round(promedioTiempoMinutos));
            estadisticas.put("promedioTiempoFormateado", formatearTiempo(Duration.ofMinutes((long) promedioTiempoMinutos)));

            return ResponseEntity.ok(estadisticas);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

} // FIN DE LA CLASE

