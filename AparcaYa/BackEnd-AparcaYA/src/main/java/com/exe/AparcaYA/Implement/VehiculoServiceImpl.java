package com.exe.AparcaYA.Implement;

import com.exe.AparcaYA.Entity.Vehiculo;
import com.exe.AparcaYA.Repository.VehiculoRepository;
import com.exe.AparcaYA.Service.VehiculoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class VehiculoServiceImpl implements VehiculoService {

    @Autowired
    private VehiculoRepository vehiculoRepository;

    @Override
    public Vehiculo save(Vehiculo vehiculo) {
        return vehiculoRepository.save(vehiculo);
    }

    @Override
    public List<Vehiculo> findAll() {
        return vehiculoRepository.findAll();
    }

    @Override
    public Optional<Vehiculo> findById(Long id) {
        return vehiculoRepository.findById(id);
    }


    @Override
    public Vehiculo update(Vehiculo vehiculo) {
        if (vehiculoRepository.existsById(vehiculo.getIdVehiculo())) {
            return vehiculoRepository.save(vehiculo);
        }
        throw new RuntimeException("Vehículo no encontrado");
    }

    @Override
    public void delete(Long id) {
        vehiculoRepository.deleteById(id);
    }

    @Override
    public List<Vehiculo> findByPlacaContainingIgnoreCase(String placa) {
        return vehiculoRepository.findByPlacaContainingIgnoreCase(placa);
    }

    // DESPUÉS
    @Override
    public Optional<Vehiculo> findByPlaca(String placa) {
        return vehiculoRepository.findByPlaca(placa);
    }

    // ✅ CLI-C03: expone el query que ya existe en el repository
    @Override
    public List<Vehiculo> findByIdUsuario(Long idUsuario) {
        return vehiculoRepository.findByIdUsuario_IdUsuario(idUsuario);
    }
}