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

    @Override
    public Reservacion save(Reservacion reservacion) {
        return reservacionRepository.save(reservacion);
    }

    @Override
    public List<Reservacion> findAll() {
        return reservacionRepository.findAll();
    }

    @Override
    public Optional<Reservacion> findById(Long id) {
        return reservacionRepository.findById(Math.toIntExact(id));
    }

    @Override
    public Reservacion update(Reservacion reservacion) {
        if (reservacionRepository.existsById(Math.toIntExact(reservacion.getIdReserva()))) {
            return reservacionRepository.save(reservacion);
        }
        throw new RuntimeException("Reservación no encontrada");
    }

    @Override
    public void delete(Long id) {
        reservacionRepository.deleteById(Math.toIntExact(id));
    }

    @Override
    public List<Reservacion> findByCliente_IdUsuario(Long idUsuario) {
        return reservacionRepository.findByCliente_IdUsuario(idUsuario);
    }

    @Override
    public List<Reservacion> findByEstado(EstadoReservacion estado) {
        return reservacionRepository.findByEstado(String.valueOf(estado));
    }
}