package com.exe.AparcaYA.Implement;

import com.exe.AparcaYA.Entity.Reservacion;
import com.exe.AparcaYA.Enum.EstadoReservacion;
import com.exe.AparcaYA.Repository.ReservacionRepository;
import com.exe.AparcaYA.Service.ReservacionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class ReservacionServiceImpl implements ReservacionService {

    @Autowired
    private ReservacionRepository reservacionRepository;

    // ✅ CAMBIO #4: Estado PENDIENTE por defecto movido del Controller al Service
    // Antes: if (getEstado() == null) en ReservacionController.createReservacion()
    // Ahora: cualquier llamante (Controller, otro Service) obtiene el comportamiento correcto
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
        // ✅ CAMBIO #9: Eliminado Math.toIntExact(id) — el Repository ahora acepta Long directamente
        return reservacionRepository.findById(id);
    }

    @Override
    public Reservacion update(Reservacion reservacion) {
        // ✅ CAMBIO #9: Eliminado Math.toIntExact() — el Repository ahora acepta Long directamente
        if (reservacionRepository.existsById(reservacion.getIdReserva())) {
            return reservacionRepository.save(reservacion);
        }
        throw new RuntimeException("Reservación no encontrada");
    }

    @Override
    public void delete(Long id) {
        // ✅ CAMBIO #9: Eliminado Math.toIntExact(id) — el Repository ahora acepta Long directamente
        reservacionRepository.deleteById(id);
    }

    @Override
    public List<Reservacion> findByCliente_IdUsuario(Long idUsuario) {
        return reservacionRepository.findByCliente_IdUsuario(idUsuario);
    }

    @Override
    public List<Reservacion> findByEstado(EstadoReservacion estado) {
        // ✅ CAMBIO #10: Eliminado String.valueOf(estado)
        // El Repository recibe String por sus métodos heredados, pero la Entity
        // usa @Enumerated(EnumType.STRING) así que .name() es equivalente y más explícito
        return reservacionRepository.findByEstado(estado.name());
    }
}