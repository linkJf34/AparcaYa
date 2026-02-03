package com.exe.AparcaYA.Enum;

public enum EstadoRegistro {
    ACTIVO,      // Vehículo actualmente en el parqueadero
    FINALIZADO,  // Vehículo salió pero no se ha cobrado
    COBRADO,     // Vehículo salió y se cobró
    CANCELADO    // Registro cancelado
}