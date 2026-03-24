package com.exe.AparcaYA.Repository;

import com.exe.AparcaYA.Entity.Usuario;
import com.exe.AparcaYA.Enum.EstadoGeneral;
import com.exe.AparcaYA.Enum.Rolenum;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

    List<Usuario> findByRol(Rolenum rol);
    Optional<Usuario> findByCorreo(String correo);
    List<Usuario> findByEstado(EstadoGeneral estado);

    // ELIMINADO: findByTipoCliente — tipoCliente ya no existe en Usuario

    @Query("SELECT u FROM Usuario u WHERE LOWER(u.nombre) LIKE LOWER(CONCAT('%', :nombre, '%'))")
    List<Usuario> findByNombreContainingIgnoreCase(@Param("nombre") String nombre);

    Optional<Usuario> findByTelefono(String telefono);
    Optional<Usuario> findByCedula(String cedula);
    List<Usuario> findByRolIn(List<Rolenum> roles);

    long countByEstado(EstadoGeneral estado);
}