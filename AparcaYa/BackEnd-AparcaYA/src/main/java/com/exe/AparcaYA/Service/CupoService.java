package com.exe.AparcaYA.Service;

import com.exe.AparcaYA.Entity.Cupo;
import com.exe.AparcaYA.Entity.Sede;
import com.exe.AparcaYA.Enum.EstadoCupo;

import java.util.List;
import java.util.Optional;

public interface CupoService {
    Cupo save(Cupo cupo);
    List<Cupo> findAll();
    Optional<Cupo> findById(Long id);
    Cupo update(Cupo cupo);
    void delete(Long id);
    List<Cupo> findBySede_IdSede(Long idSede);
    List<Cupo> findByEstado(EstadoCupo estado);
    List<Cupo> findBySedeAndEstado(Sede sede, EstadoCupo estadoCupo);

    // ✅ CAMBIO #6: Creación de cupos extraída del Controller al Service
    // Antes: bucle for inline en UsuarioController.registrarUsuario()
    // Ahora: lógica centralizada — reutilizable desde cualquier Controller
    void crearCuposParaSede(Sede sede);
}