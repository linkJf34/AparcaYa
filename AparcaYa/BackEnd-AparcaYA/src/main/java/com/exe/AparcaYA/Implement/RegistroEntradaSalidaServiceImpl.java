package com.exe.AparcaYA.Implement;

import com.exe.AparcaYA.Entity.*;
import com.exe.AparcaYA.Enum.EstadoCupo;
import com.exe.AparcaYA.Enum.EstadoPago;
import com.exe.AparcaYA.Enum.EstadoRegistro;
import com.exe.AparcaYA.Enum.MetodoPago;
import com.exe.AparcaYA.Enum.TipoVehiculo;
import com.exe.AparcaYA.Repository.CupoRepository;
import com.exe.AparcaYA.Repository.PagoRepository;
import com.exe.AparcaYA.Repository.RegistroEntradaSalidaRepository;
import com.exe.AparcaYA.Repository.TarifaRepository;
import com.exe.AparcaYA.Service.RegistroEntradaSalidaService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@Transactional
@RequiredArgsConstructor
public class RegistroEntradaSalidaServiceImpl implements RegistroEntradaSalidaService {

    private final RegistroEntradaSalidaRepository registroRepository;
    private final CupoRepository                  cupoRepository;
    private final TarifaRepository                tarifaRepository;
    // ✅ FIX: PagoRepository inyectado — antes no estaba, por eso
    //         confirmarCobroConTarifa calculaba el precio pero nunca
    //         creaba ni persistía el Pago, dejando registro.getPago() = null
    //         en todos los cobros. Eso hacía que precio, ingresos del día
    //         y gráficas siempre mostraran $0 o null.
    private final PagoRepository                  pagoRepository;

    // ── CRUD básico ───────────────────────────────────────────

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
            throw new RuntimeException("Registro no encontrado: "
                    + registro.getIdRegistro());
        }
        return registroRepository.save(registro);
    }

    @Override
    public void delete(Long id) {
        registroRepository.deleteById(id);
    }

    // ── Consultas por sede ────────────────────────────────────

    @Override
    public List<RegistroEntradaSalida> findBySede(Sede sede) {
        return registroRepository.findBySede(sede);
    }

    @Override
    public List<RegistroEntradaSalida> findBySedeAndEstado(
            Sede sede, EstadoRegistro estado) {
        return registroRepository.findBySedeAndEstado(sede, estado);
    }

    @Override
    public List<RegistroEntradaSalida> findBySedeAndEstadoIn(
            Sede sede, List<EstadoRegistro> estados) {
        return registroRepository.findBySedeAndEstadoIn(sede, estados);
    }

    @Override
    public List<RegistroEntradaSalida> findBySedeAndFechaHoraEntradaBetween(
            Sede sede, LocalDateTime inicio, LocalDateTime fin) {
        return registroRepository
                .findBySedeAndFechaHoraEntradaBetween(sede, inicio, fin);
    }

    @Override
    public List<RegistroEntradaSalida> findBySedeAndFechaBetween(
            Sede sede, LocalDateTime inicio, LocalDateTime fin) {
        return registroRepository.findBySedeAndFechaBetween(sede, inicio, fin);
    }

    // ── Consultas por vehículo ────────────────────────────────

    @Override
    public Optional<RegistroEntradaSalida> findVehiculoActivo(Vehiculo vehiculo) {
        return registroRepository
                .findByVehiculoAndEstado(vehiculo, EstadoRegistro.ACTIVO);
    }

    @Override
    public List<RegistroEntradaSalida> findByVehiculo(Vehiculo vehiculo) {
        return registroRepository.findByVehiculo(vehiculo);
    }

    // ── Historial y conteos ───────────────────────────────────

    @Override
    public List<RegistroEntradaSalida> findHistorialBySede(Sede sede) {
        return registroRepository.findAllBySedeOrderByFechaDesc(sede);
    }

    @Override
    public Long countBySedeAndEstado(Sede sede, EstadoRegistro estado) {
        return registroRepository.countBySedeAndEstado(sede, estado);
    }

    @Override
    public Map<String, Long> countActivosPorTipo(Sede sede) {
        List<Object[]> rows = registroRepository.countActivosPorTipo(sede);
        Map<String, Long> result = new LinkedHashMap<>();
        result.put("CARRO",     0L);
        result.put("MOTO",      0L);
        result.put("BICICLETA", 0L);
        for (Object[] row : rows) {
            result.put(row[0].toString(), ((Number) row[1]).longValue());
        }
        return result;
    }

    @Override
    public BigDecimal sumIngresosEntreFechas(Sede sede,
                                             LocalDateTime inicio,
                                             LocalDateTime fin) {
        BigDecimal resultado = registroRepository
                .sumIngresosEntreFechas(sede, inicio, fin);
        // La query puede devolver null si no hay filas — protegemos con COALESCE
        // pero por si acaso también aquí
        return resultado != null ? resultado : BigDecimal.ZERO;
    }

    // ── Operaciones de negocio ────────────────────────────────

    @Override
    public RegistroEntradaSalida registrarEntrada(Vehiculo vehiculo,
                                                  Sede sede,
                                                  Cupo cupo,
                                                  Usuario trabajador) {
        findVehiculoActivo(vehiculo).ifPresent(r -> {
            throw new RuntimeException("El vehículo "
                    + vehiculo.getPlaca() + " ya está en el parqueadero");
        });

        RegistroEntradaSalida registro = RegistroEntradaSalida.builder()
                .vehiculo(vehiculo)
                .sede(sede)
                .cupo(cupo)
                .trabajador(trabajador)
                .fechaHoraEntrada(LocalDateTime.now())
                .estado(EstadoRegistro.ACTIVO)
                .build();

        if (cupo != null) {
            cupo.setEstado(EstadoCupo.OCUPADO);
            cupoRepository.save(cupo);
        }

        return registroRepository.save(registro);
    }

    @Override
    public RegistroEntradaSalida registrarSalida(Long registroId) {
        RegistroEntradaSalida registro = registroRepository.findById(registroId)
                .orElseThrow(() -> new RuntimeException(
                        "Registro no encontrado: " + registroId));

        if (registro.getEstado() != EstadoRegistro.ACTIVO) {
            throw new RuntimeException("Estado inválido para salida: "
                    + registro.getEstado());
        }

        registro.setFechaHoraSalida(LocalDateTime.now());
        registro.setEstado(EstadoRegistro.FINALIZADO);
        return registroRepository.save(registro);
    }

    @Override
    public RegistroEntradaSalida confirmarCobro(Long registroId,
                                                String metodoPago) {
        return confirmarCobroConTarifa(registroId, metodoPago, "MINUTO");
    }

    // ✅ FIX PRINCIPAL — antes: calculaba precio pero nunca creaba Pago.
    //    Ahora:
    //    1. Calcula el precio según tipo de tarifa (igual que antes)
    //    2. Crea la entidad Pago con monto, metodoPago y estado PAGADO
    //    3. Persiste el Pago con pagoRepository.save()
    //    4. Asigna pago al registro con registro.setPago(pago)
    //    5. Persiste el registro actualizado
    //
    //    Con esto registro.getPago().getMonto() deja de ser null y
    //    sumIngresosEntreFechas() empieza a sumar correctamente.
    @Override
    public RegistroEntradaSalida confirmarCobroConTarifa(Long registroId,
                                                         String metodoPago,
                                                         String tipoTarifa) {
        RegistroEntradaSalida registro = registroRepository.findById(registroId)
                .orElseThrow(() -> new RuntimeException(
                        "Registro no encontrado: " + registroId));

        if (registro.getEstado() != EstadoRegistro.FINALIZADO) {
            throw new RuntimeException("Estado inválido para cobro: "
                    + registro.getEstado());
        }
        if (registro.getFechaHoraSalida() == null) {
            throw new RuntimeException("No se ha registrado la salida");
        }

        // Obtener tarifa desde la entidad Tarifa
        List<Tarifa> tarifas = tarifaRepository
                .findBySede_IdSede(registro.getSede().getIdSede());
        if (tarifas.isEmpty()) {
            throw new RuntimeException(
                    "No hay tarifas configuradas para la sede");
        }
        Tarifa tarifa = tarifas.get(0);
        TipoVehiculo tipo = registro.getVehiculo().getTipo();

        // Calcular precio según tipo de tarifa
        BigDecimal precio;

        if ("PLENA".equalsIgnoreCase(tipoTarifa)) {
            Double valor = switch (tipo) {
                case CARRO     -> tarifa.getTarifaPlenaC();
                case MOTO      -> tarifa.getTarifaPlenaM();
                case BICICLETA -> tarifa.getTarifaPlenaB();
                case OTRO      -> tarifa.getTarifaPlenaC(); // fallback
            };
            if (valor == null) throw new RuntimeException(
                    "Tarifa plena no configurada para: " + tipo);
            precio = BigDecimal.valueOf(valor).setScale(2, RoundingMode.HALF_UP);

        } else if ("MINUTO".equalsIgnoreCase(tipoTarifa)) {
            Double valorMinuto = switch (tipo) {
                case CARRO     -> tarifa.getTarifaMinutoC();
                case MOTO      -> tarifa.getTarifaMinutoM();
                case BICICLETA -> tarifa.getTarifaMinutoB();
                case OTRO      -> tarifa.getTarifaMinutoC(); // fallback
            };
            if (valorMinuto == null) throw new RuntimeException(
                    "Tarifa por minuto no configurada para: " + tipo);
            long minutos = Math.max(1, Duration.between(
                    registro.getFechaHoraEntrada(),
                    registro.getFechaHoraSalida()).toMinutes());
            precio = BigDecimal.valueOf(minutos * valorMinuto)
                    .setScale(2, RoundingMode.HALF_UP);

        } else if ("HORA".equalsIgnoreCase(tipoTarifa)) {
            Double valorHora = switch (tipo) {
                case CARRO     -> tarifa.getTarifaHoraC();
                case MOTO      -> tarifa.getTarifaHoraM();
                case BICICLETA -> tarifa.getTarifaHoraB();
                case OTRO      -> tarifa.getTarifaHoraC(); // fallback
            };
            if (valorHora == null) throw new RuntimeException(
                    "Tarifa por hora no configurada para: " + tipo);
            long horas = Math.max(1, Duration.between(
                    registro.getFechaHoraEntrada(),
                    registro.getFechaHoraSalida()).toHours());
            precio = BigDecimal.valueOf(horas * valorHora)
                    .setScale(2, RoundingMode.HALF_UP);

        } else {
            throw new RuntimeException("Tipo de tarifa inválido: " + tipoTarifa
                    + ". Debe ser PLENA, MINUTO u HORA");
        }

        // ✅ FIX: Resolver MetodoPago — el frontend envía String, convertir a enum
        MetodoPago metodo;
        try {
            metodo = MetodoPago.valueOf(metodoPago.toUpperCase());
        } catch (IllegalArgumentException e) {
            metodo = MetodoPago.EFECTIVO; // fallback seguro
        }

        // ✅ FIX: Crear y persistir Pago ANTES de actualizar el registro
        Pago pago = Pago.builder()
                .registro(registro)
                .monto(precio.doubleValue())
                .fechaPago(LocalDateTime.now())
                .estado(EstadoPago.PAGADO)
                .metodoPago(metodo)
                .detalles("Tarifa aplicada: " + tipoTarifa
                        + " | Vehículo: " + registro.getVehiculo().getPlaca()
                        + " | Tipo: " + tipo)
                .build();
        Pago pagoGuardado = pagoRepository.save(pago);

        // ✅ FIX: Asignar el Pago al Registro para que registro.getPago() != null
        registro.setPago(pagoGuardado);
        registro.setEstado(EstadoRegistro.COBRADO);
        registro.setObservaciones("Tarifa: " + tipoTarifa
                + (registro.getObservaciones() != null
                ? " | " + registro.getObservaciones() : ""));

        // Liberar cupo
        if (registro.getCupo() != null) {
            registro.getCupo().setEstado(EstadoCupo.DISPONIBLE);
            cupoRepository.save(registro.getCupo());
        }

        return registroRepository.save(registro);
    }
}