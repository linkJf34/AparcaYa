package com.exe.AparcaYA.Service;

import com.exe.AparcaYA.Entity.Cupo;
import com.exe.AparcaYA.Entity.Sede;
import com.exe.AparcaYA.Enum.EstadoCupo;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface CupoService {
    Cupo save(Cupo cupo);
    List<Cupo> findAll();
    Optional<Cupo> findById(Long id);
    Cupo update(Cupo cupo);
    void delete(Long id);
    List<Cupo> findBySede_IdSede(Long idSede);
    List<Cupo> findByEstado(EstadoCupo estado);
    List<Cupo> findBySedeAndEstado(Sede sede, EstadoCupo estadoCupo);

    // Creación de cupos al registrar una sede
    void crearCuposParaSede(Sede sede);

    // Cupos disponibles en un rango de fechas — para reservaciones
    List<Cupo> findCuposDisponiblesEnRango(Long sedeId,
                                           LocalDateTime fechaInicio,
                                           LocalDateTime fechaFin);

    // Contar cupos por tipo — reemplaza sede.getCuposCarro/Moto/Bicicleta()
    Integer contarCuposPorTipo(Long idSede, String tipo);
}