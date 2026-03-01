package com.exe.AparcaYA.Config;

import com.exe.AparcaYA.Entity.Usuario;
import com.exe.AparcaYA.Enum.Rolenum;
import com.exe.AparcaYA.Service.UsuarioService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Optional;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final UsuarioService             usuarioService;
    private final CustomUserDetailsService   customUserDetailsService;

    // ==================== PASSWORD ENCODER ====================

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // ==================== AUTHENTICATION PROVIDER ====================

    /**
     * ✅ CORRECCIÓN 2: Reemplaza el AuthenticationManager manual duplicado.
     *
     * Antes había dos @Bean AuthenticationManager:
     *   - authManager(HttpSecurity)        → construido manualmente con el builder
     *   - authenticationManager(AuthConfig) → delegado a Spring
     *
     * El problema: Spring podía inyectar el bean que NO usaba CustomUserDetailsService,
     * causando que la autenticación automática post-registro fallara.
     *
     * Ahora: un único DaoAuthenticationProvider vincula explícitamente
     * CustomUserDetailsService + BCryptPasswordEncoder. Spring lo detecta
     * automáticamente y el AuthenticationManager delegado lo usa.
     */
    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(customUserDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    // ==================== AUTHENTICATION MANAGER ====================

    /**
     * ✅ CORRECCIÓN 2 (cont.): Un único AuthenticationManager.
     * Delega a AuthenticationConfiguration, que ya recoge el
     * DaoAuthenticationProvider definido arriba.
     * El controller lo inyecta con @RequiredArgsConstructor por nombre de campo.
     */
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config)
            throws Exception {
        return config.getAuthenticationManager();
    }

    // ==================== SUCCESS HANDLER ====================

    @Bean
    public AuthenticationSuccessHandler authenticationSuccessHandler() {
        return new AuthenticationSuccessHandler() {
            @Override
            public void onAuthenticationSuccess(HttpServletRequest  request,
                                                HttpServletResponse response,
                                                Authentication      authentication)
                    throws IOException, ServletException {

                String correo = authentication.getName();
                Optional<Usuario> usuarioOpt = usuarioService.findByCorreo(correo);

                if (usuarioOpt.isPresent()) {
                    Rolenum rol = usuarioOpt.get().getRol();
                    String redirectUrl = switch (rol) {
                        case ADMIN              -> "/dashboard/administradorGeneral";
                        case ADMINISTRADOR_SEDE -> "/dashboard/administradorSede";
                        case OPERARIO           -> "/dashboard/trabajadorParqueadero";
                        case CLIENTE            -> "/dashboard/cliente";
                        default                 -> "/login";
                    };
                    response.sendRedirect(redirectUrl);
                } else {
                    response.sendRedirect("/login");
                }
            }
        };
    }

    // ==================== SECURITY FILTER CHAIN ====================

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {

        http
                // CSRF desactivado (sin cambios)
                .csrf(AbstractHttpConfigurer::disable)

                // ✅ CORRECCIÓN 1: Agregar /check/** al permitAll()
                // Antes: los 4 endpoints GET /check/correo, /check/cedula,
                //        /check/telefono y /check/nit eran interceptados por
                //        Spring Security → 302 redirect a /login.
                //        El JS recibía HTML en lugar de JSON → checkDisponibilidad()
                //        fallaba silenciosamente y retornaba true sin verificar nada.
                // Ahora: accesibles sin autenticación (son GET de solo lectura,
                //        solo indican si un valor ya existe en BD).
                .authorizeHttpRequests(authz -> authz
                        .requestMatchers(
                                "/",
                                "/login",
                                "/registro",
                                "/registrar",
                                "/test",
                                "/public",
                                "/api/auth/**",
                                "/check/**",          // ✅ NUEVO: verificación de duplicados
                                "/css/**",
                                "/js/**",
                                "/images/**"
                        )
                        .permitAll()
                        .anyRequest().authenticated()
                )

                // Configuración de login (sin cambios)
                .formLogin(form -> form
                        .loginPage("/login")
                        .loginProcessingUrl("/login")
                        .successHandler(authenticationSuccessHandler())
                        .failureUrl("/login?error")
                        .permitAll()
                )

                // Configuración de logout (sin cambios)
                .logout(logout -> logout
                        .logoutUrl("/logout")
                        .logoutSuccessUrl("/login?logout")
                        .permitAll()
                )

                // ✅ CORRECCIÓN 2 (cont.): registrar el provider explícitamente
                // para que la cadena de filtros lo use en el formLogin
                .authenticationProvider(authenticationProvider());

        return http.build();
    }
}