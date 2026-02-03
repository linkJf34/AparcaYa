package com.exe.AparcaYA.Service;

import com.exe.AparcaYA.Entity.Sede;
import com.exe.AparcaYA.Enum.EstadoGeneral;

import java.util.List;
import java.util.Optional;

public interface SedeService {
    Sede save(Sede sede);
    List<Sede> findAll();
    Optional<Sede> findById(Long id);
    Sede update(Sede sede);
    void delete(Long id);
    List<Sede> findByLocalidad(String localidad);
    List<Sede> findByCapacidadBetween(int capacidadMin, int capacidadMax);
    List<Sede> findByBarrioContainingIgnoreCase(String barrio);
    List<Sede> findByEstado(EstadoGeneral estado);
    Sede findByIdUsuario(Long idUsuario);
}