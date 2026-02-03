package com.exe.AparcaYA.Config;

import com.exe.AparcaYA.Service.UsuarioService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder;

import java.io.IOException;
import java.util.Optional;

import com.exe.AparcaYA.Config.CustomUserDetailsService;
import com.exe.AparcaYA.Entity.Usuario;
import com.exe.AparcaYA.Enum.Rolenum;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final UsuarioService usuarioService;
    private final CustomUserDetailsService customUserDetailsService;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // Vincular CustomUserDetailsService + passwordEncoder
    @Bean
    public AuthenticationManager authManager(HttpSecurity http) throws Exception {
        AuthenticationManagerBuilder auth =
                http.getSharedObject(AuthenticationManagerBuilder.class);

        auth
                .userDetailsService(customUserDetailsService)
                .passwordEncoder(passwordEncoder());

        return auth.build();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public AuthenticationSuccessHandler authenticationSuccessHandler() {
        return new AuthenticationSuccessHandler() {
            @Override
            public void onAuthenticationSuccess(HttpServletRequest request,
                                                HttpServletResponse response,
                                                Authentication authentication)
                    throws IOException, ServletException {

                String correo = authentication.getName();
                Optional<Usuario> usuarioOpt = usuarioService.findByCorreo(correo);

                if (usuarioOpt.isPresent()) {
                    Rolenum rol = usuarioOpt.get().getRol();
                    String redirectUrl = switch (rol) {
                        case ADMIN -> "/dashboard/administradorGeneral";
                        case ADMINISTRADOR_SEDE -> "/dashboard/administradorSede";
                        case OPERARIO -> "/dashboard/trabajadorParqueadero";
                        case CLIENTE -> "/dashboard/cliente";
                        default -> "/login";
                    };

                    response.sendRedirect(redirectUrl);
                } else {
                    response.sendRedirect("/login");
                }
            }
        };
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {

        http
                .csrf(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(authz -> authz
                        .requestMatchers("/", "/login", "/registro", "/registrar",
                                "/test", "/public", "/api/auth/**",
                                "/css/**", "/js/**", "/images/**")
                        .permitAll()
                        .anyRequest().authenticated()
                )
                .formLogin(form -> form
                        .loginPage("/login")
                        .loginProcessingUrl("/login")
                        .successHandler(authenticationSuccessHandler())
                        .failureUrl("/login?error")
                        .permitAll()
                )
                .logout(logout -> logout
                        .logoutUrl("/logout")
                        .logoutSuccessUrl("/login?logout")
                        .permitAll()
                );

        return http.build();
    }
}
