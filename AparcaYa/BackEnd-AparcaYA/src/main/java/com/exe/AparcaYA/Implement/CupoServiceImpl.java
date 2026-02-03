package com.exe.AparcaYA.Implement;

import com.exe.AparcaYA.Entity.Cupo;
import com.exe.AparcaYA.Entity.Sede;
import com.exe.AparcaYA.Enum.EstadoCupo;
import com.exe.AparcaYA.Repository.CupoRepository;
import com.exe.AparcaYA.Service.CupoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class CupoServiceImpl implements CupoService {

    @Autowired
    private CupoRepository cupoRepository;

    @Override
    public Cupo save(Cupo cupo) {
        return cupoRepository.save(cupo);
    }

    @Override
    public List<Cupo> findAll() {
        return cupoRepository.findAll();
    }

    @Override
    public Optional<Cupo> findById(Long id) {
        return cupoRepository.findById(id);
    }

    @Override
    public Cupo update(Cupo cupo) {
        if (cupoRepository.existsById(cupo.getIdCupo())) {
            return cupoRepository.save(cupo);
        }
        throw new RuntimeException("Cupo no encontrado");
    }

    @Override
    public void delete(Long id) {
        cupoRepository.deleteById(id);
    }

    @Override
    public List<Cupo> findBySede_IdSede(Long idSede) {
        return cupoRepository.findBySede_IdSede(idSede);
    }

    @Override
    public List<Cupo> findByEstado(EstadoCupo estado) {
        return cupoRepository.findByEstado(estado);
    }

    // CORREGIDO: Ahora llama al repository correctamente
    @Override
    public List<Cupo> findBySedeAndEstado(Sede sede, EstadoCupo estadoCupo) {
        return cupoRepository.findBySedeAndEstado(sede, estadoCupo);
    }
}