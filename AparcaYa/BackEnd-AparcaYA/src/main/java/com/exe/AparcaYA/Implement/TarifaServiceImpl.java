package com.exe.AparcaYA.Implement;

import com.exe.AparcaYA.Entity.Sede;
import com.exe.AparcaYA.Entity.Tarifa;
import com.exe.AparcaYA.Repository.TarifaRepository;
import com.exe.AparcaYA.Service.TarifaService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class TarifaServiceImpl implements TarifaService {

    private final TarifaRepository tarifaRepository;

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
    public List<Tarifa> findBySede(Sede sede) {
        return tarifaRepository.findBySede(sede);
    }

    @Override
    public List<Tarifa> findBySede_IdSede(Long idSede) {
        return tarifaRepository.findBySede_IdSede(idSede);
    }

    // CORRECCIÓN CRÍTICA — antes leía sede.getTarifaPlenaC() etc.
    // Ahora Tarifa tiene todos los campos de precio directamente.
    // Se crea una única Tarifa por sede con todos los precios incluidos.
    @Override
    public void crearTarifasParaSede(Sede sede) {
        Tarifa tarifa = Tarifa.builder()
                .tipoTarifa("GENERAL")
                // Carro
                .tarifaPlenaC(0.0)
                .tarifaMinutoC(0.0)
                .tarifaHoraC(0.0)
                // Moto
                .tarifaPlenaM(0.0)
                .tarifaMinutoM(0.0)
                .tarifaHoraM(0.0)
                // Bicicleta
                .tarifaPlenaB(0.0)
                .tarifaMinutoB(0.0)
                .tarifaHoraB(0.0)
                .sede(sede)
                .build();
        tarifaRepository.save(tarifa);
    }
}