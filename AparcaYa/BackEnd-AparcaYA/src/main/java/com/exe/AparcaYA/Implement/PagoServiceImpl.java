package com.exe.AparcaYA.Implement;

import com.exe.AparcaYA.Entity.Pago;
import com.exe.AparcaYA.Enum.EstadoPago;
import com.exe.AparcaYA.Repository.PagoRepository;
import com.exe.AparcaYA.Service.PagoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class PagoServiceImpl implements PagoService {

    @Autowired
    private PagoRepository pagoRepository;

    @Override
    public Pago save(Pago pago) {
        return pagoRepository.save(pago);
    }

    @Override
    public List<Pago> findAll() {
        return pagoRepository.findAll();
    }

    @Override
    public Optional<Pago> findById(Long id) {
        return pagoRepository.findById(id);
    }

    @Override
    public Pago update(Pago pago) {
        return null;
    }

    @Override
    public void delete(Long id) {

    }

    @Override
    public List<Pago> findByCliente_IdUsuario(Long idUsuario) {
        return List.of();
    }

    @Override
    public List<Pago> findByEstado(EstadoPago estado) {
        return List.of();
    }

    @Override
    public List<Pago> findByReservacion_IdReserva(Long idReserva) {
        return List.of();
    }

    @Override
    public List<Pago> findByReserva_IdReserva(Long idReserva) {
        return List.of();
    }

}