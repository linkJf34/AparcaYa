package com.exe.AparcaYA.Implement;

import com.exe.AparcaYA.Dto.ReservacionDTO;
import com.exe.AparcaYA.Entity.Cupo;
import com.exe.AparcaYA.Entity.Reservacion;
import com.exe.AparcaYA.Entity.Usuario;
import com.exe.AparcaYA.Entity.Vehiculo;
import com.exe.AparcaYA.Enum.EstadoCupo;
import com.exe.AparcaYA.Enum.EstadoReservacion;
import com.exe.AparcaYA.Repository.CupoRepository;
import com.exe.AparcaYA.Repository.ReservacionRepository;
import com.exe.AparcaYA.Repository.VehiculoRepository;
import com.exe.AparcaYA.Service.ReservacionService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@Transactional
public class ReservacionServiceImpl implements ReservacionService {

    @Autowired
    private ReservacionRepository reservacionRepository;

    @Autowired
    private CupoRepository cupoRepository;

    @Autowired
    private VehiculoRepository vehiculoRepository;

    // ═══════════════════════════════════════════════════════════════════════
    // CRUD BÁSICO — sin cambios respecto al original
    // ═══════════════════════════════════════════════════════════════════════

    @Override
    public Reservacion save(Reservacion reservacion) {
        if (reservacion.getEstado() == null) {
            reservacion.setEstado(EstadoReservacion.PENDIENTE);
        }
        return reservacionRepository.save(reservacion);
    }

    @Override
    public List<Reservacion> findAll() {
        return reservacionRepository.findAll();
    }

    @Override
    public Optional<Reservacion> findById(Long id) {
        return reservacionRepository.findById(id);
    }

    @Override
    public Reservacion update(Reservacion reservacion) {
        if (reservacionRepository.existsById(reservacion.getIdReserva())) {
            return reservacionRepository.save(reservacion);
        }
        throw new RuntimeException("Reservación no encontrada");
    }

    @Override
    public void delete(Long id) {
        reservacionRepository.deleteById(id);
    }

    @Override
    public List<Reservacion> findByCliente_IdUsuario(Long idUsuario) {
        return reservacionRepository.findByCliente_IdUsuario(idUsuario);
    }

    @Override
    public List<Reservacion> findByEstado(EstadoReservacion estado) {
        return reservacionRepository.findByEstado(estado.name());
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CREAR RESERVA — orquestador principal
    // ═══════════════════════════════════════════════════════════════════════

    @Override
    @Transactional
    public Reservacion crearReserva(ReservacionDTO dto, Usuario cliente) {

        // ── 1. Validar rango de fechas ────────────────────────────────────
        if (dto.getFechaInicio() == null || dto.getFechaFin() == null) {
            throw new IllegalArgumentException(
                    "Las fechas de inicio y fin son obligatorias");
        }
        if (!dto.getFechaFin().isAfter(dto.getFechaInicio())) {
            throw new IllegalArgumentException(
                    "La fecha de fin debe ser posterior a la de inicio");
        }
        if (dto.getFechaInicio().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException(
                    "No se puede crear una reserva en el pasado");
        }

        // ── 2. Verificar ownership del vehículo ───────────────────────────
        // Impide que un cliente reserve con el vehículo de otro usuario
        Vehiculo vehiculo = vehiculoRepository.findById(dto.getVehiculoId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Vehículo no encontrado con ID: " + dto.getVehiculoId()));

        if (!vehiculo.getIdUsuario().getIdUsuario()
                .equals(cliente.getIdUsuario())) {
            log.warn("Cliente {} intentó usar vehículo {} que no le pertenece",
                    cliente.getIdUsuario(), dto.getVehiculoId());
            throw new SecurityException(
                    "El vehículo no pertenece al cliente autenticado");
        }

        // ── 3. Verificar que el cupo existe y tiene estado válido ─────────
        Cupo cupo = cupoRepository.findById(dto.getCupoId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Cupo no encontrado con ID: " + dto.getCupoId()));

        if (cupo.getEstado() == EstadoCupo.MANTENIMIENTO) {
            throw new IllegalStateException(
                    "El cupo " + cupo.getCodigo() + " está en mantenimiento");
        }

        // ── 4. Verificar conflicto de horario ─────────────────────────────
        // Activa findConflictosHorario() que era código muerto en el Repository
        boolean hayConflicto = existeConflictoHorario(
                cupo.getIdCupo(),
                dto.getFechaInicio(),
                dto.getFechaFin()
        );
        if (hayConflicto) {
            throw new IllegalStateException(
                    "El cupo " + cupo.getCodigo() +
                            " ya tiene una reserva en el horario solicitado. " +
                            "Por favor selecciona otro horario.");
        }

        // ── 5. Verificar límite de reservas activas del cliente ───────────
        // Usa countReservacionesActivasPorEstados() — ya no hardcodea 'ACTIVA'
        List<String> estadosActivos = List.of(
                EstadoReservacion.PENDIENTE.name(),
                EstadoReservacion.ACTIVA.name()
        );
        long reservasActivas = reservacionRepository
                .countReservacionesActivasPorEstados(
                        cliente.getIdUsuario(),
                        estadosActivos
                );
        if (reservasActivas >= 3) {
            throw new IllegalStateException(
                    "Has alcanzado el límite de 3 reservas activas simultáneas. " +
                            "Cancela una reserva existente antes de crear una nueva.");
        }

        // ── 6. Construir y persistir la reserva ───────────────────────────
        Reservacion reservacion = Reservacion.builder()
                .cliente(cliente)
                .cupo(cupo)
                .vehiculo(vehiculo)
                .fechaInicio(dto.getFechaInicio())
                .fechaFin(dto.getFechaFin())
                .estado(EstadoReservacion.PENDIENTE)
                .build();

        Reservacion saved = reservacionRepository.save(reservacion);
        log.info("Reserva {} creada — cliente={}, cupo={}, inicio={}, fin={}",
                saved.getIdReserva(),
                cliente.getIdUsuario(),
                cupo.getCodigo(),
                dto.getFechaInicio(),
                dto.getFechaFin());

        // ── 7. Marcar el cupo como RESERVADO ──────────────────────────────
        // Impide que otro cliente tome el mismo cupo mientras
        // la reserva está PENDIENTE o ACTIVA
        cupo.setEstado(EstadoCupo.RESERVADO);
        cupoRepository.save(cupo);
        log.info("Cupo {} marcado como RESERVADO", cupo.getCodigo());

        return saved;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VERIFICAR CONFLICTO DE HORARIO
    // ═══════════════════════════════════════════════════════════════════════

    @Override
    public boolean existeConflictoHorario(Long cupoId,
                                          LocalDateTime inicio,
                                          LocalDateTime fin) {
        // Pasa los estados como String para que coincidan con
        // @Enumerated(EnumType.STRING) en la entidad Reservacion
        List<String> estadosActivos = List.of(
                EstadoReservacion.PENDIENTE.name(),
                EstadoReservacion.ACTIVA.name()
        );
        List<Reservacion> conflictos = reservacionRepository.findConflictosHorario(
                cupoId,
                estadosActivos,
                inicio,
                fin
        );
        return !conflictos.isEmpty();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CANCELAR RESERVA
    // ═══════════════════════════════════════════════════════════════════════

    @Override
    @Transactional
    public Reservacion cancelarReserva(Long idReserva, Long idCliente) {

        // 1. Verificar que la reserva existe
        Reservacion reservacion = reservacionRepository.findById(idReserva)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Reserva no encontrada con ID: " + idReserva));

        // 2. Verificar ownership
        if (!reservacion.getCliente().getIdUsuario().equals(idCliente)) {
            log.warn("Cliente {} intentó cancelar reserva {} de otro usuario",
                    idCliente, idReserva);
            throw new SecurityException(
                    "No estás autorizado para cancelar esta reserva");
        }

        // 3. Verificar que el estado permite cancelación
        if (reservacion.getEstado() != EstadoReservacion.PENDIENTE &&
                reservacion.getEstado() != EstadoReservacion.ACTIVA) {
            throw new IllegalStateException(
                    "Solo se pueden cancelar reservas PENDIENTES o ACTIVAS. " +
                            "Estado actual: " + reservacion.getEstado().name());
        }

        // 4. Cancelar la reserva
        reservacion.setEstado(EstadoReservacion.CANCELADA);
        Reservacion cancelada = reservacionRepository.save(reservacion);
        log.info("Reserva {} cancelada por cliente {}", idReserva, idCliente);

        // 5. Liberar el cupo para que otros clientes puedan reservarlo
        Cupo cupo = reservacion.getCupo();
        if (cupo != null) {
            cupo.setEstado(EstadoCupo.DISPONIBLE);
            cupoRepository.save(cupo);
            log.info("Cupo {} liberado tras cancelación de reserva {}",
                    cupo.getCodigo(), idReserva);
        }

        return cancelada;
    }
}