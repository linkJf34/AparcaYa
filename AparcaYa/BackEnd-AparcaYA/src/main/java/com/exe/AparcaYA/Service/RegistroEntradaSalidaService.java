package com.exe.AparcaYA.Service;

import com.exe.AparcaYA.Entity.*;
import com.exe.AparcaYA.Enum.EstadoRegistro;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface RegistroEntradaSalidaService {

    // CRUD básico
    RegistroEntradaSalida save(RegistroEntradaSalida registro);
    List<RegistroEntradaSalida> findAll();
    Optional<RegistroEntradaSalida> findById(Long id);
    RegistroEntradaSalida update(RegistroEntradaSalida registro);
    void delete(Long id);

    // Consultas por sede
    List<RegistroEntradaSalida> findBySede(Sede sede);
    List<RegistroEntradaSalida> findBySedeAndEstado(Sede sede, EstadoRegistro estado);
    List<RegistroEntradaSalida> findBySedeAndEstadoIn(Sede sede, List<EstadoRegistro> estados);
    List<RegistroEntradaSalida> findBySedeAndFechaHoraEntradaBetween(Sede sede, LocalDateTime inicio, LocalDateTime fin);

    // Consultas por vehículo
    Optional<RegistroEntradaSalida> findVehiculoActivo(Vehiculo vehiculo);
    List<RegistroEntradaSalida> findByVehiculo(Vehiculo vehiculo);

    // Historial
    List<RegistroEntradaSalida> findHistorialBySede(Sede sede);
    Long countBySedeAndEstado(Sede sede, EstadoRegistro estado);

    // Operaciones de negocio
    RegistroEntradaSalida registrarEntrada(Vehiculo vehiculo, Sede sede, Cupo cupo, Usuario trabajador);
    RegistroEntradaSalida registrarSalida(Long registroId);
    RegistroEntradaSalida confirmarCobro(Long registroId, String metodoPago);

    // ✅ CAMBIO #8: Método subido a la interfaz
    // Antes: solo existía en RegistroEntradaSalidaServiceImpl como método público no declarado
    // en la interfaz, lo que obligaba a hacer un cast en TrabajadorController
    // Ahora: cualquier llamante puede usarlo programando contra la interfaz
    RegistroEntradaSalida confirmarCobroConTarifa(Long registroId, String metodoPago, String tipoTarifa);
}