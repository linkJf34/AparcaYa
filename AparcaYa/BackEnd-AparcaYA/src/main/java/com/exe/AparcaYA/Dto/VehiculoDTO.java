package com.exe.AparcaYA.Dto;

import com.exe.AparcaYA.Entity.Vehiculo;
import com.exe.AparcaYA.Enum.Marca;
import com.exe.AparcaYA.Enum.TipoVehiculo;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class VehiculoDTO {

    private Long idVehiculo;
    private String placa;
    private TipoVehiculo tipo;
    private Marca marca;
    private String color;
    private Integer anio;

    // Referencia al propietario
    private Long idPropietario;
    private String nombrePropietario;

    public static VehiculoDTO fromEntity(Vehiculo vehiculo) {
        VehiculoDTO dto = new VehiculoDTO();
        dto.setIdVehiculo(vehiculo.getIdVehiculo());
        dto.setPlaca(vehiculo.getPlaca());
        dto.setTipo(vehiculo.getTipo());
        dto.setMarca(vehiculo.getMarca());
        dto.setColor(vehiculo.getColor());
        dto.setAnio(vehiculo.getAnio());
        if (vehiculo.getIdUsuario() != null) {
            dto.setIdPropietario(vehiculo.getIdUsuario().getIdUsuario());
            dto.setNombrePropietario(vehiculo.getIdUsuario().getNombre());
        }
        return dto;
    }
}