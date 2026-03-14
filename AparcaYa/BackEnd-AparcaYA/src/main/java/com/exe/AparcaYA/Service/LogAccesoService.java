package com.exe.AparcaYA.Service;

import com.exe.AparcaYA.Entity.Usuario;

import java.util.List;
import java.util.Map;

public interface LogAccesoService {

    /** Registra un acceso al sistema para el usuario dado. */
    void registrarAcceso(Usuario usuario);

    /** Accesos del mes en curso. */
    long contarAccesosMesActual();

    /** Accesos del mes anterior. */
    long contarAccesosMesAnterior();

    /** Accesos acumulados en el año en curso. */
    long contarAccesosAnioActual();

    /**
     * Serie mensual del año en curso para la gráfica.
     * Devuelve lista de 12 valores (enero=índice 0 ... diciembre=índice 11).
     */
    List<Long> serieMensualAnioActual();

    Map<String, List<Long>> serieMensualPorRol();
}