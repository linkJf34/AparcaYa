package com.exe.AparcaYA.Service;

import com.exe.AparcaYA.Entity.Sede;
import com.exe.AparcaYA.Entity.Tarifa;

import java.util.List;
import java.util.Optional;

public interface TarifaService {
    Tarifa save(Tarifa tarifa);
    List<Tarifa> findAll();
    Optional<Tarifa> findById(Long id);
    Tarifa update(Tarifa tarifa);
    void delete(Long id);

    // ✅ CAMBIO #2: Creación de tarifas extraída al Service
    // Antes: bloque de 4 tarifas inline en UsuarioController Y en SedeController (duplicado)
    // Ahora: lógica centralizada — un único punto de verdad para las 4 tarifas
    void crearTarifasParaSede(Sede sede);
}