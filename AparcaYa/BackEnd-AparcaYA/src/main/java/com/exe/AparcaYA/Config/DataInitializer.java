package com.exe.AparcaYA.Config;

import com.exe.AparcaYA.Entity.Usuario;
import com.exe.AparcaYA.Enum.*;
import com.exe.AparcaYA.Repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        // Verificar si ya existe un administrador general
        if (usuarioRepository.findByRol(Rolenum.ADMIN).isEmpty()) {
            Usuario admin = Usuario.builder()
                    .nombre("Administrador General")
                    .correo("admin@aparcaya.com")  // Correo por defecto
                    .telefono("3000000000")       // Teléfono por defecto
                    .cedula("0000000000")         // Cédula por defecto
                    .contrasena(passwordEncoder.encode("admin123"))  // Contraseña por defecto: admin123
                    .rol(Rolenum.ADMIN)
                    .metodoPago(MetodoPago.EFECTIVO)
                    .estado(EstadoGeneral.ACTIVO)
                    .descripcion("Usuario administrador creado automáticamente")
                    .build();

            usuarioRepository.save(admin);

            System.out.println("Correo: admin@aparcaya.com");
            System.out.println("Accede al sistema y cambia la contraseña por defecto.");
        } else {
            System.out.println("Usuario ADMIN ya existe.");
        }
    }
}