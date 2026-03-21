package com.exe.AparcaYA.Controllers;

import com.exe.AparcaYA.Entity.Sede;
import com.exe.AparcaYA.Enum.EstadoGeneral;
import com.exe.AparcaYA.Service.SedeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Endpoint público — no requiere autenticación.
 * Usado por Index.js para cargar el acordeón de parqueaderos.
 * Solo expone sedes ACTIVAS con campos mínimos (sin tarifas ni NIT).
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class PublicSedeController {

    private final SedeService sedeService;

    @GetMapping("/sedes")
    public ResponseEntity<List<Map<String, Object>>> getSedesPublicas() {
        List<Map<String, Object>> sedes = sedeService
                .findByEstado(EstadoGeneral.ACTIVO)
                .stream()
                .map(this::toPublicMap)
                .collect(Collectors.toList());

        return ResponseEntity.ok(sedes);
    }

    private Map<String, Object> toPublicMap(Sede sede) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("idSede",       sede.getIdSede());
        map.put("nombre",       sede.getNombre());
        map.put("direccion",    sede.getDireccion());
        map.put("localidad",    sede.getLocalidad() != null
                ? sede.getLocalidad().name() : "");
        map.put("capacidad",    sede.getCapacidad());
        map.put("horarioSede",  sede.getHorarioSede()  != null
                ? sede.getHorarioSede()  : "");
        map.put("telefonoSede", sede.getTelefonoSede() != null
                ? sede.getTelefonoSede() : "");
        map.put("cuposCarro",      sede.getCuposCarro());
        map.put("cuposMoto",       sede.getCuposMoto());
        map.put("cuposBicicleta",  sede.getCuposBicicleta());

        // Campo que usa el JS para mostrar la imagen en el acordeón
        map.put("imagenSede", sede.getImagenSede() != null
                ? sede.getImagenSede()
                : null);

        return map;
    }
}