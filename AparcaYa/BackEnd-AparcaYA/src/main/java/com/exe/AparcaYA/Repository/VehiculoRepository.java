package com.exe.AparcaYA.Repository;

import com.exe.AparcaYA.Entity.Vehiculo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface VehiculoRepository extends JpaRepository<Vehiculo, Long> {
    @Query("SELECT v FROM Vehiculo v WHERE LOWER(v.placa) LIKE LOWER(CONCAT('%', :placa, '%'))")
    List<Vehiculo> findByPlacaContainingIgnoreCase(@Param("placa") String placa);
    List<Vehiculo> findByTipo(String tipo);
    List<Vehiculo> findByIdUsuario_IdUsuario(Long idUsuario);  // Busca por ID del usuario
    Optional<Vehiculo> findByPlaca(String placa);  // Ya estaba, perfecto para búsqueda exacta
}