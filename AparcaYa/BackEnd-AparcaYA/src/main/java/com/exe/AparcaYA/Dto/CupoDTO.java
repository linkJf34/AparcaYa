package com.exe.AparcaYA.Dto;

import com.exe.AparcaYA.Enum.EstadoCupo;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CupoDTO {
    private Long idCupo;
    private String codigo;
    private EstadoCupo estado;
}