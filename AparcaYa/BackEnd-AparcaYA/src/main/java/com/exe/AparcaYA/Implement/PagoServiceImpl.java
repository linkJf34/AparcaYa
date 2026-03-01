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
        if (pagoRepository.existsById(pago.getIdPago())) {
            return pagoRepository.save(pago);
        }
        throw new RuntimeException("Pago no encontrado");
    }

    @Override
    public void delete(Long id) {
        pagoRepository.deleteById(id);
    }

    @Override
    public List<Pago> findByCliente_IdUsuario(Long idUsuario) {
        return pagoRepository.findByReservacion_Cliente_IdUsuario(idUsuario);
    }

    @Override
    public List<Pago> findByEstado(EstadoPago estado) {
        return pagoRepository.findByEstado(estado);
    }

    @Override
    public List<Pago> findByReservacion_IdReserva(Long idReserva) {
        // ✅ C6: Eliminado findByReserva_IdReserva — este es el único método correcto.
        // El nombre "Reservacion" coincide con la entidad real y con el Repository.
        return pagoRepository.findByReservacion_IdReserva(idReserva);
    }
}