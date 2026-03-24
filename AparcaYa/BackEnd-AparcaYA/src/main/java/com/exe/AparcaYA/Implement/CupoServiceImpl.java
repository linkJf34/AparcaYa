package com.exe.AparcaYA.Implement;

import com.exe.AparcaYA.Entity.Cupo;
import com.exe.AparcaYA.Entity.Sede;
import com.exe.AparcaYA.Enum.EstadoCupo;
import com.exe.AparcaYA.Enum.EstadoReservacion;
import com.exe.AparcaYA.Repository.CupoRepository;
import com.exe.AparcaYA.Service.CupoService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class CupoServiceImpl implements CupoService {

    private final CupoRepository cupoRepository;

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

    @Override
    public List<Cupo> findBySedeAndEstado(Sede sede, EstadoCupo estadoCupo) {
        return cupoRepository.findBySedeAndEstado(sede, estadoCupo);
    }

    // CORRECCIÓN — antes creaba N cupos individuales por capacidad.
    // Ahora Cupo tiene cuposCarro/Moto/Bicicleta como contadores.
    // Se crea un único Cupo por sede con contadores en 0,
    // el admin los configura después desde mi-configuracion.
    @Override
    public void crearCuposParaSede(Sede sede) {
        Cupo cupo = Cupo.builder()
                .codigo("CUPO-" + sede.getIdSede())
                .estado(EstadoCupo.DISPONIBLE)
                .cuposCarro(0)
                .cuposMoto(0)
                .cuposBicicleta(0)
                .sede(sede)
                .build();
        cupoRepository.save(cupo);
    }

    // NUEVO — reemplaza sede.getCuposCarro/Moto/Bicicleta()
    @Override
    public Integer contarCuposPorTipo(Long idSede, String tipo) {
        return cupoRepository.contarCuposPorTipo(idSede, tipo);
    }

    @Override
    public List<Cupo> findCuposDisponiblesEnRango(Long sedeId,
                                                  LocalDateTime fechaInicio,
                                                  LocalDateTime fechaFin) {
        List<String> estadosActivos = List.of(
                EstadoReservacion.PENDIENTE.name(),
                EstadoReservacion.ACEPTADA.name()
        );
        return cupoRepository.findCuposDisponiblesEnRango(
                sedeId, fechaInicio, fechaFin, estadosActivos);
    }
}