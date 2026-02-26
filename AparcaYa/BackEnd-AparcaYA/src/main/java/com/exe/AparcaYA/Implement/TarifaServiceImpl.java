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

    /**
     * ✅ CAMBIO #2: Creación de las 4 tarifas centralizada en el Service
     * Antes: bloque idéntico de 16 líneas duplicado en:
     *   - UsuarioController.registrarUsuario() (sede nueva en registro)
     *   - SedeController.crearTarifasParaSede() (método privado del Controller)
     * Ahora: un único método en el Service, ambos Controllers lo delegan aquí
     */
    @Override
    public void crearTarifasParaSede(Sede sede) {
        Tarifa tarifaPlenaC = new Tarifa();
        tarifaPlenaC.setPrecio(sede.getTarifaPlenaC());
        tarifaPlenaC.setTipoTarifa("PLENA_CARRO");
        tarifaPlenaC.setSede(sede);
        tarifaRepository.save(tarifaPlenaC);

        Tarifa tarifaPlenaM = new Tarifa();
        tarifaPlenaM.setPrecio(sede.getTarifaPlenaM());
        tarifaPlenaM.setTipoTarifa("PLENA_MOTO");
        tarifaPlenaM.setSede(sede);
        tarifaRepository.save(tarifaPlenaM);

        Tarifa tarifaMinutoC = new Tarifa();
        tarifaMinutoC.setPrecio(sede.getTarifaMinutoC());
        tarifaMinutoC.setTipoTarifa("MINUTO_CARRO");
        tarifaMinutoC.setSede(sede);
        tarifaRepository.save(tarifaMinutoC);

        Tarifa tarifaMinutoM = new Tarifa();
        tarifaMinutoM.setPrecio(sede.getTarifaMinutoM());
        tarifaMinutoM.setTipoTarifa("MINUTO_MOTO");
        tarifaMinutoM.setSede(sede);
        tarifaRepository.save(tarifaMinutoM);
    }
}