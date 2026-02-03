package com.exe.AparcaYA.Service;

import com.exe.AparcaYA.Entity.Usuario;
import com.exe.AparcaYA.Enum.Rolenum;

import java.util.List;
import java.util.Optional;

public interface UsuarioService {
    Usuario save(Usuario usuario);
    List<Usuario> findAll();
    Optional<Usuario> findById(Long id);
    Usuario update(Usuario usuario);
    void delete(Long id);
    List<Usuario> findByRol(Rolenum rol);
    Optional<Usuario> findByCorreo(String correo);
    Usuario findByTelefono(String telefono);
    Usuario findByCedula(String cedula);

    // AGREGADO: Método para buscar por múltiples roles (necesario para SedeController)
    List<Usuario> findByRolIn(List<Rolenum> roles);
}