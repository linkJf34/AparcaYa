package com.exe.AparcaYA.Implement;

import com.exe.AparcaYA.Entity.Pago;
import com.exe.AparcaYA.Entity.Reservacion;
import com.exe.AparcaYA.Enum.EstadoPago;
import com.exe.AparcaYA.Enum.EstadoReservacion;
import com.exe.AparcaYA.Enum.MetodoPago;
import com.exe.AparcaYA.Repository.PagoRepository;
import com.exe.AparcaYA.Repository.ReservacionRepository;
import com.exe.AparcaYA.Service.PagoService;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;


@Slf4j
@Service
@RequiredArgsConstructor
public class PagoServiceImpl implements PagoService {

    private final PagoRepository pagoRepository;
    private final ReservacionRepository reservacionRepository;

    @Override
    public Pago save(Pago pago) {
        return pagoRepository.save(pago);
    }

    @Override
    public List<Pago> findAll() {
        return pagoRepository.findAll();
    }

    @Override
    public Optional<Pago> findById(Long id) {
        return pagoRepository.findById(id);
    }

    @Override
    public Pago update(Pago pago) {
        if (pagoRepository.existsById(pago.getIdPago())) {
            return pagoRepository.save(pago);
        }
        throw new RuntimeException("Pago no encontrado");
    }

    @Override
    public List<Pago> findByRegistro_Vehiculo_IdUsuario(Long idUsuario) {
        return pagoRepository.findByRegistro_Vehiculo_IdUsuario(idUsuario);
    }

    @Override
    public void delete(Long id) {
        pagoRepository.deleteById(id);
    }

    @Override
    public List<Pago> findByEstado(EstadoPago estado) {
        return pagoRepository.findByEstado(estado);
    }

    @Override
    public List<Pago> findByReservacion_IdReserva(Long idReserva) {
        return pagoRepository.findByReservacion_IdReserva(idReserva);
    }

    // NUEVO — pagos de clientes sin reservación (entrada directa)
    @Override
    public List<Pago> findByRegistro_IdRegistro(Long idRegistro) {
        return pagoRepository.findByRegistro_IdRegistro(idRegistro);
    }
    @Override
    public List<Pago> findByReservacion_Cliente_IdUsuario(Long idUsuario) {
        return pagoRepository.findByReservacion_Cliente_IdUsuario(idUsuario);
    }

    /**
     * TAREA 2 — cobrarReserva
     * Registra el pago Y transiciona la reserva de COMPLETADA → PAGADA
     * en una sola transacción atómica.
     *
     * Antes: save(pago) guardaba el pago pero nunca actualizaba la reserva.
     * Ahora: ambas operaciones ocurren juntas o ninguna ocurre.
     */
    @Override
    @Transactional
    public Pago cobrarReserva(Long idReserva, MetodoPago metodoPago, Long idOperario) {

        // 1. Verificar que la reserva existe y está en estado cobrable
        Reservacion reservacion = reservacionRepository.findById(idReserva)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Reserva no encontrada: " + idReserva));

        if (reservacion.getEstado() != EstadoReservacion.COMPLETADA) {
            throw new IllegalStateException(
                    "Solo se pueden cobrar reservas COMPLETADAS. Estado actual: "
                            + reservacion.getEstado().name());
        }

        // 2. Crear y persistir el pago
        // Nota: el monto debe calcularse desde la Tarifa de la sede.
        // Por ahora se recibe como parámetro — refactorizar con TarifaService
        // en una iteración futura sin romper este flujo.
        Pago pago = Pago.builder()
                .reservacion(reservacion)
                .monto(calcularMonto(reservacion))   // ver método privado
                .fechaPago(LocalDateTime.now())
                .estado(EstadoPago.PAGADO)
                .metodoPago(metodoPago)
                .build();

        Pago savedPago = pagoRepository.save(pago);

        // 3. Actualizar estado de la reserva — este es el fix de la Tarea 2
        reservacion.setEstado(EstadoReservacion.PAGADA);
        reservacionRepository.save(reservacion);

        log.info("Reserva {} cobrada — pago={}, método={}, operario={}",
                idReserva, savedPago.getIdPago(), metodoPago, idOperario);

        return savedPago;
    }

    /**
     * Calcula el monto basado en duración y tarifa de la sede.
     * Implementación mínima — reemplazar con TarifaService cuando esté disponible.
     */
    private Double calcularMonto(Reservacion reservacion) {
        // Duración en horas, redondeada hacia arriba
        long minutos = java.time.Duration.between(
                reservacion.getFechaInicio(),
                reservacion.getFechaFin()
        ).toMinutes();
        double horas = Math.ceil(minutos / 60.0);

        // Tarifa base por defecto — reemplazar con sede.getTarifas()
        double tarifaPorHora = 3000.0;

        return horas * tarifaPorHora;
    }
}