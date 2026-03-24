package com.exe.AparcaYA.Dto;

import com.exe.AparcaYA.Entity.Usuario;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class UsuarioDTO {

    private Long id;
    private String nombre;
    private String correo;
    private String telefono;
    private String cedula;
    private String rol;
    private String estado;

    // Sede asignada — solo aplica para OPERARIO
    private Long idSedeAsignada;
    private String nombreSedeAsignada;

    public static UsuarioDTO fromEntity(Usuario usuario) {
        UsuarioDTO dto = new UsuarioDTO();
        dto.setId(usuario.getIdUsuario());
        dto.setNombre(usuario.getNombre() != null ? usuario.getNombre() : "");
        dto.setCorreo(usuario.getCorreo() != null ? usuario.getCorreo() : "");
        dto.setTelefono(usuario.getTelefono() != null ? usuario.getTelefono() : "");
        dto.setCedula(usuario.getCedula() != null ? usuario.getCedula() : "");
        dto.setRol(usuario.getRol() != null ? usuario.getRol().toString() : "");
        dto.setEstado(usuario.getEstado() != null
                ? usuario.getEstado().toString() : "ACTIVO");
        if (usuario.getSedeAsignada() != null) {
            dto.setIdSedeAsignada(usuario.getSedeAsignada().getIdSede());
            dto.setNombreSedeAsignada(usuario.getSedeAsignada().getNombre());
        }
        return dto;
    }
}