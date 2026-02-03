package com.exe.AparcaYA.Dto;

import com.exe.AparcaYA.Enum.EstadoGeneral;
import com.exe.AparcaYA.Enum.MetodoPago;
import com.exe.AparcaYA.Enum.Rolenum;
import com.exe.AparcaYA.Enum.TipoCliente;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UsuarioDTO {
    private Long idUsuario;
    private String nombre;
    private String correo;
    private String telefono;
    private String cedula;
    private Rolenum rol;
    private TipoCliente tipoCliente;
    private MetodoPago metodoPago;
    private EstadoGeneral estado;
    private String descripcion;
    private String contrasena;
}