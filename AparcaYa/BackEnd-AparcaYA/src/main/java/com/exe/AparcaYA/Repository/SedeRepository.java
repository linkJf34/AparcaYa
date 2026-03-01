package com.exe.AparcaYA.Repository;

import com.exe.AparcaYA.Entity.Sede;
import com.exe.AparcaYA.Enum.EstadoGeneral;
import com.exe.AparcaYA.Enum.Localidad;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SedeRepository extends JpaRepository<Sede, Long> {

    List<Sede> findByLocalidad(Localidad localidad);

    @Query("SELECT s FROM Sede s WHERE s.capacidad >= :capacidadMin AND s.capacidad <= :capacidadMax")
    List<Sede> findByCapacidadBetween(@Param("capacidadMin") int capacidadMin,
                                      @Param("capacidadMax") int capacidadMax);

    List<Sede> findByIdUsuario_IdUsuario(Long idUsuario);
    List<Sede> findByEstado(EstadoGeneral estado);
    List<Sede> findByBarrioContainingIgnoreCase(String barrio);
    boolean existsByNit(String nit);

    // ✅ RIESGO #8: Query de conteo directa en BD — elimina findAll() en memoria
    // Antes: sedeRepository.findAll().stream().filter(...).count()
    //        → cargaba TODA la tabla en memoria para contar
    // Ahora: SELECT COUNT(*) WHERE estado = ? — operación O(1) en BD
    long countByEstado(EstadoGeneral estado);
}