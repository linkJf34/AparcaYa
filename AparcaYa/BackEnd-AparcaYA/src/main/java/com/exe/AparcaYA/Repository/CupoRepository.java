package com.exe.AparcaYA.Repository;

import com.exe.AparcaYA.Entity.Cupo;
import com.exe.AparcaYA.Entity.Sede;
import com.exe.AparcaYA.Enum.EstadoCupo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CupoRepository extends JpaRepository<Cupo, Long> {
    List<Cupo> findBySede_IdSede(Long idSede);
    List<Cupo> findByEstado(EstadoCupo estado);
    @Query("SELECT c FROM Cupo c WHERE LOWER(c.codigo) LIKE LOWER(CONCAT('%', :codigo, '%'))")
    List<Cupo> findByCodigoContainingIgnoreCase(@Param("codigo") String codigo);
    // AGREGAR este método al final de CupoRepository.java
    List<Cupo> findBySedeAndEstado(Sede sede, EstadoCupo estado);
}