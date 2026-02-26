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
        // ✅ CAMBIO #8: Implementado — antes retornaba null
        if (pagoRepository.existsById(pago.getIdPago())) {
            return pagoRepository.save(pago);
        }
        throw new RuntimeException("Pago no encontrado");
    }

    @Override
    public void delete(Long id) {
        // ✅ CAMBIO #8: Implementado — antes era cuerpo vacío
        pagoRepository.deleteById(id);
    }

    @Override
    public List<Pago> findByCliente_IdUsuario(Long idUsuario) {
        // ✅ CAMBIO #7: Implementado — antes retornaba List.of()
        // PagoRepository expone findByReservacion_Cliente_IdUsuario que navega
        // la relación Pago → Reservacion → Cliente para filtrar por usuario
        return pagoRepository.findByReservacion_Cliente_IdUsuario(idUsuario);
    }

    @Override
    public List<Pago> findByEstado(EstadoPago estado) {
        // ✅ CAMBIO #8: Implementado — antes retornaba List.of()
        return pagoRepository.findByEstado(estado);
    }

    @Override
    public List<Pago> findByReservacion_IdReserva(Long idReserva) {
        // ✅ CAMBIO #8: Implementado — antes retornaba List.of()
        return pagoRepository.findByReservacion_IdReserva(idReserva);
    }

    @Override
    public List<Pago> findByReserva_IdReserva(Long idReserva) {
        // ✅ CAMBIO #8: Implementado — delegado al método correcto del Repository
        // El nombre del método en PagoService usaba "Reserva" (sin "cion")
        // pero el Repository usa "Reservacion" — se unifica aquí sin cambiar
        // la firma del Service para no romper quien ya lo llame
        return pagoRepository.findByReservacion_IdReserva(idReserva);
    }
}