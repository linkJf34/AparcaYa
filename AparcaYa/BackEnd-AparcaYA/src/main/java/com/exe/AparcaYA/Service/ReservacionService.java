package com.exe.AparcaYA.Service;

import com.exe.AparcaYA.Entity.Reservacion;
import com.exe.AparcaYA.Enum.EstadoReservacion;

import java.util.List;
import java.util.Optional;

public interface ReservacionService {
    Reservacion save(Reservacion reservacion);
    List<Reservacion> findAll();
    Optional<Reservacion> findById(Long id);
    Reservacion update(Reservacion reservacion);
    void delete(Long id);
    List<Reservacion> findByCliente_IdUsuario(Long idUsuario);
    List<Reservacion> findByEstado(EstadoReservacion estado);
}