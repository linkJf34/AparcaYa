package com.exe.AparcaYA.Repository;

import com.exe.AparcaYA.Entity.Sede;
import com.exe.AparcaYA.Enum.EstadoGeneral;
import com.exe.AparcaYA.Enum.Localidad;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SedeRepository extends JpaRepository<Sede, Long> {

    List<Sede> findByLocalidad(Localidad localidad);

    @Query("SELECT s FROM Sede s WHERE s.capacidad >= :capacidadMin " +
            "AND s.capacidad <= :capacidadMax")
    List<Sede> findByCapacidadBetween(@Param("capacidadMin") int capacidadMin,
                                      @Param("capacidadMax") int capacidadMax);

    // idUsuario sigue siendo el nombre del campo en Sede — sin cambios
    List<Sede> findByIdUsuario_IdUsuario(Long idUsuario);
    Optional<Sede> findFirstByIdUsuario_IdUsuario(Long idUsuario);

    List<Sede> findByEstado(EstadoGeneral estado);
    List<Sede> findByBarrioContainingIgnoreCase(String barrio);
    boolean existsByNit(String nit);
    long countByEstado(EstadoGeneral estado);
}