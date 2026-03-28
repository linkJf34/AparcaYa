package com.exe.AparcaYA.Service;

import com.exe.AparcaYA.Entity.EmailLog;
import com.exe.AparcaYA.Entity.Pago;
import com.exe.AparcaYA.Entity.Sede;
import com.exe.AparcaYA.Entity.Usuario;
import com.exe.AparcaYA.Enum.EstadoGeneral;
import com.exe.AparcaYA.Repository.*;
import com.exe.AparcaYA.Dto.ReporteDataDTO;
import com.exe.AparcaYA.Dto.ReportePayloadDTO;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class ReportesService {

    private final UsuarioRepository  usuarioRepository;
    private final SedeRepository     sedeRepository;
    private final EmailLogRepository emailLogRepository;

    private final ReservacionRepository reservacionRepository;
    private final PagoRepository             pagoRepository;
    private final RegistroEntradaSalidaRepository registroRepository;

    public ReportesService(UsuarioRepository usuarioRepository,
                           SedeRepository sedeRepository,
                           EmailLogRepository emailLogRepository,
                           ReservacionRepository reservacionRepository,
                           PagoRepository pagoRepository,
                           RegistroEntradaSalidaRepository registroRepository) {
        this.usuarioRepository   = usuarioRepository;
        this.sedeRepository      = sedeRepository;
        this.emailLogRepository  = emailLogRepository;
        this.reservacionRepository = reservacionRepository;
        this.pagoRepository      = pagoRepository;
        this.registroRepository  = registroRepository;
    }

    public ReporteDataDTO construirDatos(ReportePayloadDTO.FiltrosDTO filtros) {

        ReporteDataDTO data = new ReporteDataDTO();

        // ── Periodo del reporte ────────────────────────────────────────
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd/MM/yyyy");

        String inicio = (filtros.getFechaInicio() != null && !filtros.getFechaInicio().isBlank())
                ? LocalDate.parse(filtros.getFechaInicio()).format(fmt)
                : LocalDate.now().withDayOfMonth(1).format(fmt);

        String fin = (filtros.getFechaFin() != null && !filtros.getFechaFin().isBlank())
                ? LocalDate.parse(filtros.getFechaFin()).format(fmt)
                : LocalDate.now().format(fmt);

        data.setPeriodoReporte(inicio + " - " + fin);

        data.setSedeNombre(
                (filtros.getSedeId() != null && !filtros.getSedeId().isBlank())
                        ? "Sede ID: " + filtros.getSedeId()
                        : "Todas las sedes"
        );

        // ── Usuarios ───────────────────────────────────────────────────
        List<Usuario> usuarios = usuarioRepository.findAll();
        data.setUsuarios(
                usuarios.stream().map(u -> {
                    Map<String, Object> fila = new LinkedHashMap<>();
                    fila.put("nombre",  u.getNombre()  != null ? u.getNombre()  : "—");
                    fila.put("correo",  u.getCorreo()  != null ? u.getCorreo()  : "—");
                    fila.put("rol",     u.getRol()     != null ? u.getRol().name() : "—");
                    fila.put("estado",  u.getEstado()  != null ? u.getEstado().name() : "—");
                    return fila;
                }).collect(Collectors.toList())
        );

        // ── Sedes ──────────────────────────────────────────────────────
        List<Sede> sedes = sedeRepository.findAll();
        data.setSedes(
                sedes.stream().map(s -> {
                    Map<String, Object> fila = new LinkedHashMap<>();
                    fila.put("nombre",     s.getNombre()    != null ? s.getNombre()    : "—");
                    fila.put("direccion",  s.getDireccion() != null ? s.getDireccion() : "—");
                    fila.put("capacidad",  String.valueOf(s.getCapacidad()));
                    fila.put("estado",     s.getEstado()    != null ? s.getEstado().name() : "—");
                    return fila;
                }).collect(Collectors.toList())
        );

        // ── Correos ────────────────────────────────────────────────────
        List<EmailLog> correos = emailLogRepository.findUltimos(200);
        data.setCorreos(
                correos.stream().map(e -> {
                    Map<String, Object> fila = new LinkedHashMap<>();
                    fila.put("destinatario", e.getDestinatario() != null ? e.getDestinatario() : "—");
                    fila.put("asunto",       e.getAsunto()       != null ? e.getAsunto()       : "—");
                    fila.put("tipo",         e.getTipo()         != null ? e.getTipo().name()  : "—");
                    fila.put("estado",       e.getEstado()       != null ? e.getEstado().name(): "—");
                    fila.put("fecha",        e.getFechaCreacion()!= null
                            ? e.getFechaCreacion().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"))
                            : "—");
                    return fila;
                }).collect(Collectors.toList())
        );

        return data;
    }

    public ReporteDataDTO construirDatosSede(
            ReportePayloadDTO.FiltrosDTO filtros,
            Map<String, String> kpisDOM) {

        ReporteDataDTO data = new ReporteDataDTO();

        // ── Periodo ────────────────────────────────────────────────
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd/MM/yyyy");

        String inicio = (filtros.getFechaInicio() != null
                && !filtros.getFechaInicio().isBlank())
                ? LocalDate.parse(filtros.getFechaInicio()).format(fmt)
                : LocalDate.now().withDayOfMonth(1).format(fmt);

        String fin = (filtros.getFechaFin() != null
                && !filtros.getFechaFin().isBlank())
                ? LocalDate.parse(filtros.getFechaFin()).format(fmt)
                : LocalDate.now().format(fmt);

        data.setPeriodoReporte(inicio + " - " + fin);

        // ── Nombre de sede ─────────────────────────────────────────
        String nombreSede = "Mi sede";
        if (filtros.getSedeId() != null && !filtros.getSedeId().isBlank()) {
            try {
                Long sedeId = Long.parseLong(filtros.getSedeId());
                nombreSede = sedeRepository.findById(sedeId)
                        .map(s -> s.getNombre())
                        .orElse("Sede ID: " + sedeId);
            } catch (NumberFormatException ignored) {}
        }
        data.setSedeNombre(nombreSede);

        // ── KPIs del DOM (ya vienen del frontend) ──────────────────
        data.setKpisDOM(kpisDOM);

        // ── Pagos de la sede ───────────────────────────────────────
        List<Pago> pagos = pagoRepository.findByEstado(
                com.exe.AparcaYA.Enum.EstadoPago.PAGADO);

        data.setCorreos(
                pagos.stream().map(p -> {
                    Map<String, Object> fila = new LinkedHashMap<>();
                    fila.put("id",     String.valueOf(p.getIdPago()));
                    fila.put("monto",  p.getMonto() != null
                            ? "$" + String.valueOf(p.getMonto()) : "—");
                    fila.put("estado", p.getEstado() != null
                            ? p.getEstado().name() : "—");
                    fila.put("fecha",  p.getFechaPago() != null
                            ? p.getFechaPago().format(
                            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")) : "—");
                    return fila;
                }).collect(Collectors.toList())
        );

        // ── Reservaciones de la sede ───────────────────────────────
        List<com.exe.AparcaYA.Entity.Reservacion> reservaciones;
        if (filtros.getSedeId() != null && !filtros.getSedeId().isBlank()) {
            try {
                reservaciones = reservacionRepository.findByCupoSedeId(
                        Long.parseLong(filtros.getSedeId()));
            } catch (NumberFormatException e) {
                reservaciones = reservacionRepository.findAll();
            }
        } else {
            reservaciones = reservacionRepository.findAll();
        }

        data.setUsuarios(
                reservaciones.stream().map(r -> {
                    Map<String, Object> fila = new LinkedHashMap<>();
                    fila.put("cliente",  r.getCliente() != null
                            ? r.getCliente().getNombre() : "—");
                    fila.put("vehiculo", r.getVehiculo() != null
                            ? r.getVehiculo().getPlaca() : "—");
                    fila.put("inicio",   r.getFechaInicio() != null
                            ? r.getFechaInicio().format(
                            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")) : "—");
                    fila.put("fin",      r.getFechaFin() != null
                            ? r.getFechaFin().format(
                            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")) : "—");
                    fila.put("estado",   r.getEstado() != null
                            ? r.getEstado().name() : "—");
                    return fila;
                }).collect(Collectors.toList())
        );

        // ── Historial de registros de la sede ─────────────────────────
        List<com.exe.AparcaYA.Entity.RegistroEntradaSalida> registros;
        if (filtros.getSedeId() != null && !filtros.getSedeId().isBlank()) {
            try {
                Long sedeId = Long.parseLong(filtros.getSedeId());
                registros = registroRepository.findAll().stream()
                        .filter(r -> r.getSede() != null
                                && r.getSede().getIdSede() != null
                                && r.getSede().getIdSede().equals(sedeId))
                        .collect(Collectors.toList());
            } catch (NumberFormatException ignored) {
                registros = registroRepository.findAll();
            }
        } else {
            registros = registroRepository.findAll();
        }

        data.setSedes(
                registros.stream().map(r -> {
                    Map<String, Object> fila = new LinkedHashMap<>();
                    fila.put("placa",   r.getVehiculo() != null
                            ? r.getVehiculo().getPlaca() : "—");
                    fila.put("cliente", r.getVehiculo() != null
                            && r.getVehiculo().getIdUsuario() != null
                            ? r.getVehiculo().getIdUsuario().getNombre() : "—");
                    fila.put("entrada", r.getFechaHoraEntrada() != null
                            ? r.getFechaHoraEntrada().format(
                            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")) : "—");
                    fila.put("salida",  r.getFechaHoraSalida() != null
                            ? r.getFechaHoraSalida().format(
                            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")) : "—");
                    fila.put("estado",  r.getEstado() != null
                            ? r.getEstado().name() : "—");
                    return fila;
                }).collect(Collectors.toList())
        );

        return data;
    }
}