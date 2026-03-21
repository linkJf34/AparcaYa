package com.exe.AparcaYA.Implement;

import com.exe.AparcaYA.Entity.*;
import com.exe.AparcaYA.Enum.EstadoCupo;
import com.exe.AparcaYA.Enum.EstadoRegistro;
import com.exe.AparcaYA.Enum.TipoVehiculo;
import com.exe.AparcaYA.Repository.CupoRepository;
import com.exe.AparcaYA.Repository.RegistroEntradaSalidaRepository;
import com.exe.AparcaYA.Service.RegistroEntradaSalidaService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class RegistroEntradaSalidaServiceImpl implements RegistroEntradaSalidaService {

    @Autowired
    private RegistroEntradaSalidaRepository registroRepository;

    @Autowired
    private CupoRepository cupoRepository;

    // ==================== CRUD BÁSICO ====================

    @Override
    public RegistroEntradaSalida save(RegistroEntradaSalida registro) {
        return registroRepository.save(registro);
    }

    @Override
    public List<RegistroEntradaSalida> findAll() {
        return registroRepository.findAll();
    }

    @Override
    public Optional<RegistroEntradaSalida> findById(Long id) {
        return registroRepository.findById(id);
    }

    @Override
    public RegistroEntradaSalida update(RegistroEntradaSalida registro) {
        if (!registroRepository.existsById(registro.getIdRegistro())) {
            throw new RuntimeException("Registro no encontrado con ID: " + registro.getIdRegistro());
        }
        return registroRepository.save(registro);
    }

    @Override
    public void delete(Long id) {
        registroRepository.deleteById(id);
    }

    // ==================== CONSULTAS POR SEDE ====================

    @Override
    public List<RegistroEntradaSalida> findBySede(Sede sede) {
        return registroRepository.findBySede(sede);
    }

    @Override
    public List<RegistroEntradaSalida> findBySedeAndEstado(Sede sede, EstadoRegistro estado) {
        return registroRepository.findBySedeAndEstado(sede, estado);
    }

    @Override
    public List<RegistroEntradaSalida> findBySedeAndEstadoIn(Sede sede, List<EstadoRegistro> estados) {
        return registroRepository.findBySedeAndEstadoIn(sede, estados);
    }

    @Override
    public List<RegistroEntradaSalida> findBySedeAndFechaHoraEntradaBetween(
            Sede sede, LocalDateTime inicio, LocalDateTime fin) {
        return registroRepository.findBySedeAndFechaHoraEntradaBetween(sede, inicio, fin);
    }

    // ==================== CONSULTAS POR VEHÍCULO ====================

    @Override
    public Optional<RegistroEntradaSalida> findVehiculoActivo(Vehiculo vehiculo) {
        return registroRepository.findByVehiculoAndEstado(vehiculo, EstadoRegistro.ACTIVO);
    }

    @Override
    public List<RegistroEntradaSalida> findByVehiculo(Vehiculo vehiculo) {
        return registroRepository.findByVehiculo(vehiculo);
    }

    // ==================== HISTORIAL ====================

    @Override
    public List<RegistroEntradaSalida> findHistorialBySede(Sede sede) {
        return registroRepository.findAllBySedeOrderByFechaDesc(sede);
    }

    @Override
    public Long countBySedeAndEstado(Sede sede, EstadoRegistro estado) {
        return registroRepository.countBySedeAndEstado(sede, estado);
    }

    // ==================== OPERACIONES DE NEGOCIO ====================

    /**
     * ✅ REGISTRAR ENTRADA
     * Solo registra la entrada, NO calcula precio aún
     */
    @Override
    public RegistroEntradaSalida registrarEntrada(Vehiculo vehiculo, Sede sede, Cupo cupo, Usuario trabajador) {

        // Verificar si el vehículo ya está activo en algún parqueadero
        Optional<RegistroEntradaSalida> registroExistente = findVehiculoActivo(vehiculo);
        if (registroExistente.isPresent()) {
            throw new RuntimeException("El vehículo " + vehiculo.getPlaca() + " ya se encuentra en el parqueadero");
        }

        // Crear nuevo registro
        RegistroEntradaSalida registro = RegistroEntradaSalida.builder()
                .vehiculo(vehiculo)
                .sede(sede)
                .cupo(cupo)
                .trabajador(trabajador)
                .fechaHoraEntrada(LocalDateTime.now())
                .estado(EstadoRegistro.ACTIVO)
                .precio(null) // ⚠️ NO se calcula precio al entrar
                .metodoPago(null)
                .build();

        // Actualizar estado del cupo si existe
        if (cupo != null) {
            cupo.setEstado(EstadoCupo.OCUPADO);
            cupoRepository.save(cupo);
        }

        System.out.println("✅ Entrada registrada: " + vehiculo.getPlaca() + " a las " + registro.getFechaHoraEntrada());
        return registroRepository.save(registro);
    }

    /**
     * ✅ REGISTRAR SALIDA
     * Cambia estado a FINALIZADO pero NO guarda precio aún
     * El trabajador elegirá la tarifa en el siguiente paso
     */
    @Override
    public RegistroEntradaSalida registrarSalida(Long registroId) {
        RegistroEntradaSalida registro = registroRepository.findById(registroId)
                .orElseThrow(() -> new RuntimeException("Registro no encontrado con ID: " + registroId));

        if (registro.getEstado() != EstadoRegistro.ACTIVO) {
            throw new RuntimeException("El vehículo no está activo. Estado actual: " + registro.getEstado());
        }

        LocalDateTime horaSalida = LocalDateTime.now();
        registro.setFechaHoraSalida(horaSalida);
        registro.setEstado(EstadoRegistro.FINALIZADO);

        // ⚠️ NO calculamos precio aquí, el trabajador elegirá la tarifa
        registro.setPrecio(null);

        System.out.println("✅ Salida registrada: " + registro.getVehiculo().getPlaca() +
                " - Tiempo: " + calcularTiempoTranscurrido(registro));

        return registroRepository.save(registro);
    }

    /**
     * ✅ CONFIRMAR COBRO CON SELECCIÓN DE TARIFA
     * Ahora recibe un parámetro adicional: tipoTarifa ("PLENA" o "MINUTO")
     *
     * MODIFICACIÓN REQUERIDA EN TrabajadorController para pasar tipoTarifa
     */
    public RegistroEntradaSalida confirmarCobroConTarifa(Long registroId, String metodoPago, String tipoTarifa) {

        RegistroEntradaSalida registro = registroRepository.findById(registroId)
                .orElseThrow(() -> new RuntimeException("Registro no encontrado con ID: " + registroId));

        if (registro.getEstado() != EstadoRegistro.FINALIZADO) {
            throw new RuntimeException("El registro no está pendiente de cobro. Estado: " + registro.getEstado());
        }

        if (registro.getFechaHoraSalida() == null) {
            throw new RuntimeException("No se ha registrado la salida del vehículo");
        }

        // Determinar tipo de vehículo
        TipoVehiculo tipoVehiculo = registro.getVehiculo().getTipo();
        boolean esCarro = (tipoVehiculo == TipoVehiculo.CARRO);

        BigDecimal precio;

        // ✅ CALCULAR PRECIO SEGÚN LA TARIFA ELEGIDA POR EL TRABAJADOR
        if ("PLENA".equalsIgnoreCase(tipoTarifa)) {
            // Tarifa plena (día completo)
            Double tarifaPlena = esCarro ?
                    registro.getSede().getTarifaPlenaC() :
                    registro.getSede().getTarifaPlenaM();

            precio = BigDecimal.valueOf(tarifaPlena).setScale(2, RoundingMode.HALF_UP);

            System.out.println("💰 Aplicando tarifa PLENA: $" + precio +
                    " para " + (esCarro ? "CARRO" : "MOTO"));

        } else if ("MINUTO".equalsIgnoreCase(tipoTarifa)) {
            // Tarifa por minuto
            Double tarifaMinuto = esCarro ?
                    registro.getSede().getTarifaMinutoC() :
                    registro.getSede().getTarifaMinutoM();

            precio = calcularPrecioPorMinutos(
                    registro.getFechaHoraEntrada(),
                    registro.getFechaHoraSalida(),
                    tarifaMinuto
            );

            long minutos = Duration.between(
                    registro.getFechaHoraEntrada(),
                    registro.getFechaHoraSalida()
            ).toMinutes();

            System.out.println("💰 Aplicando tarifa POR MINUTO: " + minutos + " min × $" +
                    tarifaMinuto + " = $" + precio);

        } else {
            throw new RuntimeException("Tipo de tarifa inválido: " + tipoTarifa +
                    ". Debe ser 'PLENA' o 'MINUTO'");
        }

        // Guardar el precio calculado
        registro.setPrecio(precio);
        registro.setMetodoPago(metodoPago);
        registro.setEstado(EstadoRegistro.COBRADO);

        // Agregar observación sobre qué tarifa se aplicó
        String observacion = "Tarifa aplicada: " + tipoTarifa;
        if (registro.getObservaciones() != null && !registro.getObservaciones().isEmpty()) {
            observacion = registro.getObservaciones() + " | " + observacion;
        }
        registro.setObservaciones(observacion);

        // Liberar el cupo si existe
        if (registro.getCupo() != null) {
            Cupo cupo = registro.getCupo();
            cupo.setEstado(EstadoCupo.DISPONIBLE);
            cupoRepository.save(cupo);
            System.out.println("🅿️ Cupo liberado: " + cupo.getCodigo());
        }

        System.out.println("✅ Cobro confirmado: $" + precio + " - Método: " + metodoPago);
        return registroRepository.save(registro);
    }

    /**
     * ⚠️ MÉTODO ORIGINAL - MANTENER POR COMPATIBILIDAD
     * Pero usa tarifa por minuto por defecto
     */
    @Override
    public RegistroEntradaSalida confirmarCobro(Long registroId, String metodoPago) {
        // Por defecto usa tarifa por minuto
        return confirmarCobroConTarifa(registroId, metodoPago, "MINUTO");
    }

    // ==================== MÉTODOS AUXILIARES ====================

    /**
     * Calcular precio basado en minutos transcurridos
     */
    private BigDecimal calcularPrecioPorMinutos(LocalDateTime entrada, LocalDateTime salida, Double tarifaPorMinuto) {
        Duration duracion = Duration.between(entrada, salida);
        long minutosTranscurridos = Math.max(1, duracion.toMinutes()); // Mínimo 1 minuto

        BigDecimal precio = BigDecimal.valueOf(minutosTranscurridos * tarifaPorMinuto)
                .setScale(2, RoundingMode.HALF_UP);

        return precio;
    }

    /**
     * Calcular tiempo transcurrido en formato legible
     */
    private String calcularTiempoTranscurrido(RegistroEntradaSalida registro) {
        if (registro.getFechaHoraSalida() == null) {
            return "En curso";
        }

        Duration duracion = Duration.between(registro.getFechaHoraEntrada(), registro.getFechaHoraSalida());
        long horas = duracion.toHours();
        long minutos = duracion.toMinutes() % 60;

        if (horas > 0) {
            return horas + "h " + minutos + "m";
        } else {
            return minutos + "m";
        }
    }

    /**
     * Calcular ambas opciones de cobro para mostrar al trabajador
     */
    public BigDecimal[] calcularOpcionesCobro(Long registroId) {
        RegistroEntradaSalida registro = registroRepository.findById(registroId)
                .orElseThrow(() -> new RuntimeException("Registro no encontrado"));

        if (registro.getFechaHoraSalida() == null) {
            throw new RuntimeException("No se ha registrado la salida");
        }

        TipoVehiculo tipoVehiculo = registro.getVehiculo().getTipo();
        boolean esCarro = (tipoVehiculo == TipoVehiculo.CARRO);

        // Opción 1: Tarifa Plena
        Double tarifaPlena = esCarro ?
                registro.getSede().getTarifaPlenaC() :
                registro.getSede().getTarifaPlenaM();
        BigDecimal precioPlena = BigDecimal.valueOf(tarifaPlena).setScale(2, RoundingMode.HALF_UP);

        // Opción 2: Tarifa por Minuto
        Double tarifaMinuto = esCarro ?
                registro.getSede().getTarifaMinutoC() :
                registro.getSede().getTarifaMinutoM();
        BigDecimal precioMinuto = calcularPrecioPorMinutos(
                registro.getFechaHoraEntrada(),
                registro.getFechaHoraSalida(),
                tarifaMinuto
        );

        return new BigDecimal[] { precioPlena, precioMinuto };
    }

    @Override
    public BigDecimal sumIngresosEntreFechas(Sede sede,
                                             LocalDateTime inicio, LocalDateTime fin) {
        return registroRepository.sumIngresosEntreFechas(sede, inicio, fin);
    }

    @Override
    public java.util.Map<String, Long> countActivosPorTipo(Sede sede) {
        List<Object[]> rows = registroRepository.countActivosPorTipo(sede);
        java.util.Map<String, Long> result = new java.util.LinkedHashMap<>();
        // Inicializar todos los tipos en 0 para que el frontend siempre reciba los 3
        result.put("CARRO",     0L);
        result.put("MOTO",      0L);
        result.put("BICICLETA", 0L);
        for (Object[] row : rows) {
            String tipo  = row[0].toString();
            Long   count = ((Number) row[1]).longValue();
            result.put(tipo, count);
        }
        return result;
    }
    @Override
    public List<RegistroEntradaSalida> findBySedeAndFechaBetween(
            Sede sede,
            LocalDateTime inicio,
            LocalDateTime fin) {
        // Reutiliza el método existente en el repositorio —
        // findBySedeAndFechaHoraEntradaBetween hace exactamente lo mismo
        return registroRepository
                .findBySedeAndFechaHoraEntradaBetween(sede, inicio, fin);
    }
}