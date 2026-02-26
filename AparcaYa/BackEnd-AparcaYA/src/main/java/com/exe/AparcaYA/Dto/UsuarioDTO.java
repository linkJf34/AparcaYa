package com.exe.AparcaYA.Dto;

import com.exe.AparcaYA.Enum.EstadoGeneral;
import com.exe.AparcaYA.Enum.Rolenum;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UsuarioDTO {

    private Long id;
    private String nombre;
    private String correo;
    private String telefono;
    private String cedula;
    private String rol;       // String para que el JS pueda consumirlo directamente
    private String estado;    // String para que el JS pueda consumirlo directamente

    // ✅ Constructor de mapeo desde Entity
    // Centraliza la conversión Usuario → UsuarioDTO en un solo lugar
    // Antes: el mismo mapeo de 7 campos se repetía 4 veces en SedeController
    public static UsuarioDTO fromEntity(com.exe.AparcaYA.Entity.Usuario usuario) {
        UsuarioDTO dto = new UsuarioDTO();
        dto.setId(usuario.getIdUsuario());
        dto.setNombre(usuario.getNombre() != null ? usuario.getNombre() : "");
        dto.setCorreo(usuario.getCorreo() != null ? usuario.getCorreo() : "");
        dto.setTelefono(usuario.getTelefono() != null ? usuario.getTelefono() : "");
        dto.setCedula(usuario.getCedula() != null ? usuario.getCedula() : "");
        dto.setRol(usuario.getRol() != null ? usuario.getRol().toString() : "");
        dto.setEstado(usuario.getEstado() != null ? usuario.getEstado().toString() : "ACTIVO");
        return dto;
    }
}