package com.exe.AparcaYA.Implement;

import com.exe.AparcaYA.Entity.Usuario;
import com.exe.AparcaYA.Enum.EstadoGeneral;
import com.exe.AparcaYA.Enum.Rolenum;
import com.exe.AparcaYA.Repository.UsuarioRepository;
import com.exe.AparcaYA.Service.UsuarioService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class UsuarioServiceImpl implements UsuarioService {

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Override
    public Usuario save(Usuario usuario) {
        return usuarioRepository.save(usuario);
    }

    @Override
    public List<Usuario> findAll() {
        return usuarioRepository.findAll();
    }

    @Override
    public Optional<Usuario> findById(Long id) {
        return usuarioRepository.findById(id);
    }

    @Override
    public Usuario update(Usuario usuario) {
        if (usuarioRepository.existsById(usuario.getIdUsuario())) {
            return usuarioRepository.save(usuario);
        }
        throw new RuntimeException("Usuario no encontrado");
    }

    @Override
    public void delete(Long id) {
        usuarioRepository.deleteById(id);
    }

    @Override
    public List<Usuario> findByRol(Rolenum rol) {
        return usuarioRepository.findByRol(rol);
    }

    @Override
    public Optional<Usuario> findByCorreo(String correo) {
        return usuarioRepository.findByCorreo(correo);
    }

    @Override
    public Usuario findByTelefono(String telefono) {
        return usuarioRepository.findByTelefono(telefono).orElse(null);
    }

    @Override
    public Usuario findByCedula(String cedula) {
        return usuarioRepository.findByCedula(cedula).orElse(null);
    }

    @Override
    public List<Usuario> findByRolIn(List<Rolenum> roles) {
        return usuarioRepository.findByRolIn(roles);
    }

    // ✅ CAMBIO #2: Lógica de conteo movida desde AdminController
    @Override
    public long contarActivos() {
        return usuarioRepository.findAll().stream()
                .filter(u -> u.getEstado() == EstadoGeneral.ACTIVO)
                .count();
    }

    @Override
    public long contarTotal() {
        return usuarioRepository.count();
    }
}