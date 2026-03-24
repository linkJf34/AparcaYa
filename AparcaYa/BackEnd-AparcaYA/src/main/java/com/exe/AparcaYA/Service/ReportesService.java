package com.exe.AparcaYA.Service;

import com.exe.AparcaYA.Entity.EmailLog;
import com.exe.AparcaYA.Entity.Sede;
import com.exe.AparcaYA.Entity.Usuario;
import com.exe.AparcaYA.Enum.EstadoGeneral;
import com.exe.AparcaYA.Repository.EmailLogRepository;
import com.exe.AparcaYA.Repository.SedeRepository;
import com.exe.AparcaYA.Repository.UsuarioRepository;
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

    public ReportesService(UsuarioRepository usuarioRepository,
                           SedeRepository sedeRepository,
                           EmailLogRepository emailLogRepository) {
        this.usuarioRepository  = usuarioRepository;
        this.sedeRepository     = sedeRepository;
        this.emailLogRepository = emailLogRepository;
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
}