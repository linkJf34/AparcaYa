package com.exe.AparcaYA.Service;

import com.exe.AparcaYA.Entity.Vehiculo;

import java.util.List;
import java.util.Optional;

public interface VehiculoService {
    Vehiculo save(Vehiculo vehiculo);
    List<Vehiculo> findAll();
    Optional<Vehiculo> findById(Long id);
    Vehiculo update(Vehiculo vehiculo);
    void delete(Long id);
    List<Vehiculo> findByPlacaContainingIgnoreCase(String placa);
    // Agregado: Método para buscar por placa exacta (necesario para reservas)
    Optional<Vehiculo> findByPlaca(String placa);
    List<Vehiculo> findByIdUsuario(Long idUsuario);
}