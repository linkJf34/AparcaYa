package com.exe.AparcaYA.Controllers;

import com.exe.AparcaYA.Entity.Reservacion;
import com.exe.AparcaYA.Enum.EstadoReservacion;  // Import para el enum EstadoReservacion
import com.exe.AparcaYA.Service.ReservacionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;  // Import para @Valid (cambia a javax si usas Spring Boot 2.x)

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/reservaciones")
public class ReservacionController {

    @Autowired
    private ReservacionService reservacionService;

    // Crear una nueva reserva (usado desde el modal del mapa)
    // El estado se establece automáticamente a PENDIENTE si no se proporciona
    @PostMapping
    public ResponseEntity<Reservacion> createReservacion(@Valid @RequestBody Reservacion reservacion) {
        // Si no se especifica estado, lo ponemos en PENDIENTE
        if (reservacion.getEstado() == null) {
            reservacion.setEstado(EstadoReservacion.PENDIENTE);
        }
        Reservacion savedReservacion = reservacionService.save(reservacion);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedReservacion);
    }

    // Obtener todas las reservas
    @GetMapping
    public ResponseEntity<List<Reservacion>> getAllReservaciones() {
        List<Reservacion> reservaciones = reservacionService.findAll();
        return ResponseEntity.ok(reservaciones);
    }

    // Obtener una reserva por ID
    @GetMapping("/{id}")
    public ResponseEntity<Reservacion> getReservacionById(@PathVariable Long id) {
        Optional<Reservacion> reservacion = reservacionService.findById(id);
        return reservacion.map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // Actualizar una reserva (e.g., aprobar/rechazar desde dashboard del trabajador)
    @PutMapping("/{id}")
    public ResponseEntity<Reservacion> updateReservacion(@PathVariable Long id, @Valid @RequestBody Reservacion reservacion) {
        reservacion.setIdReserva(id);
        try {
            Reservacion updatedReservacion = reservacionService.update(reservacion);
            return ResponseEntity.ok(updatedReservacion);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // Eliminar una reserva
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteReservacion(@PathVariable Long id) {
        try {
            reservacionService.delete(id);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    // Obtener reservas por cliente (para dashboard del cliente)
    @GetMapping("/cliente/{idUsuario}")
    public ResponseEntity<List<Reservacion>> getReservacionesByCliente(@PathVariable Long idUsuario) {
        List<Reservacion> reservaciones = reservacionService.findByCliente_IdUsuario(idUsuario);
        return ResponseEntity.ok(reservaciones);
    }

    // Obtener reservas por estado (e.g., PENDIENTE para dashboard del trabajador)
    @GetMapping("/estado/{estado}")
    public ResponseEntity<List<Reservacion>> getReservacionesByEstado(@PathVariable EstadoReservacion estado) {
        List<Reservacion> reservaciones = reservacionService.findByEstado(estado);
        return ResponseEntity.ok(reservaciones);
    }

    // Obtener todas las reservas por cliente (para mostrar en dashboard del cliente)
    @GetMapping("/cliente/{idUsuario}/reservaciones")
    public ResponseEntity<List<Reservacion>> getAllReservacionesByCliente(@PathVariable Long idUsuario) {
        List<Reservacion> reservaciones = reservacionService.findByCliente_IdUsuario(idUsuario);
        return ResponseEntity.ok(reservaciones);
    }
}