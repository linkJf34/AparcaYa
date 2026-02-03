package com.exe.AparcaYA.Service;

import com.exe.AparcaYA.Entity.Tarifa;

import java.util.List;
import java.util.Optional;

public interface TarifaService {
    Tarifa save(Tarifa tarifa);
    List<Tarifa> findAll();
    Optional<Tarifa> findById(Long id);
    Tarifa update(Tarifa tarifa);
    void delete(Long id);
    List<Tarifa> findBySede_IdSede(Long idSede);
}