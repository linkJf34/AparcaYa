package com.exe.AparcaYA.Implement;

import com.exe.AparcaYA.Entity.Sede;
import com.exe.AparcaYA.Enum.EstadoGeneral;
import com.exe.AparcaYA.Enum.Localidad;
import com.exe.AparcaYA.Repository.SedeRepository;
import com.exe.AparcaYA.Service.SedeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class SedeServiceImpl implements SedeService {

    @Autowired
    private SedeRepository sedeRepository;

    @Override
    public Sede save(Sede sede) {
        return sedeRepository.save(sede);
    }

    @Override
    public List<Sede> findAll() {
        return sedeRepository.findAll();
    }

    @Override
    public Optional<Sede> findById(Long id) {
        return sedeRepository.findById(id);
    }

    @Override
    public Sede update(Sede sede) {
        if (sedeRepository.existsById(sede.getIdSede())) {
            return sedeRepository.save(sede);
        }
        throw new RuntimeException("Sede no encontrada");
    }

    @Override
    public void delete(Long id) {
        sedeRepository.deleteById(id);
    }

    @Override
    public List<Sede> findByLocalidad(String localidad) {
        return sedeRepository.findByLocalidad(Localidad.valueOf(localidad));
    }

    @Override
    public List<Sede> findByCapacidadBetween(int capacidadMin, int capacidadMax) {
        return sedeRepository.findByCapacidadBetween(capacidadMin, capacidadMax);
    }

    @Override
    public List<Sede> findByBarrioContainingIgnoreCase(String barrio) {
        return sedeRepository.findByBarrioContainingIgnoreCase(barrio);
    }

    @Override
    public List<Sede> findByEstado(EstadoGeneral estado) {
        return sedeRepository.findByEstado(estado);
    }

    @Override
    public Sede findByIdUsuario(Long idUsuario) {
        List<Sede> sedes = sedeRepository.findByIdUsuario_IdUsuario(idUsuario);
        if (!sedes.isEmpty()) {
            return sedes.get(0); // Retorna la primera sede encontrada
        }
        return null;
    }
}