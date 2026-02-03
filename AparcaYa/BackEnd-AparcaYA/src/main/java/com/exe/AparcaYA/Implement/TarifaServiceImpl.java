package com.exe.AparcaYA.Implement;

import com.exe.AparcaYA.Entity.Tarifa;
import com.exe.AparcaYA.Repository.TarifaRepository;
import com.exe.AparcaYA.Service.TarifaService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class TarifaServiceImpl implements TarifaService {

    @Autowired
    private TarifaRepository tarifaRepository;

    @Override
    public Tarifa save(Tarifa tarifa) {
        return tarifaRepository.save(tarifa);
    }

    @Override
    public List<Tarifa> findAll() {
        return tarifaRepository.findAll();
    }

    @Override
    public Optional<Tarifa> findById(Long id) {
        return tarifaRepository.findById(id);
    }

    @Override
    public Tarifa update(Tarifa tarifa) {
        if (tarifaRepository.existsById(tarifa.getIdTarifa())) {
            return tarifaRepository.save(tarifa);
        }
        throw new RuntimeException("Tarifa no encontrada");
    }

    @Override
    public void delete(Long id) {
        tarifaRepository.deleteById(id);
    }

    @Override
    public List<Tarifa> findBySede_IdSede(Long idSede) {
        return tarifaRepository.findBySede_IdSede(idSede);
    }
}