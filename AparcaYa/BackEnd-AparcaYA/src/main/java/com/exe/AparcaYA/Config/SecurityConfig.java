package com.exe.AparcaYA.Config;

import com.exe.AparcaYA.Entity.Usuario;
import com.exe.AparcaYA.Enum.Rolenum;
import com.exe.AparcaYA.Service.UsuarioService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import com.exe.AparcaYA.Service.LogAccesoService;
import org.springframework.security.web.authentication.session.SessionAuthenticationException;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Optional;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
@RequiredArgsConstructor
public class SecurityConfig {

    private final UsuarioService           usuarioService;
    private final CustomUserDetailsService customUserDetailsService;
    private final LogAccesoService logAccesoService;

    // ==================== PASSWORD ENCODER ====================

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // ==================== AUTHENTICATION PROVIDER ====================

    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(customUserDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    // ==================== AUTHENTICATION MANAGER ====================

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
                    Usuario usuario = usuarioOpt.get();

                    // ── NUEVO: registrar acceso en log ────────────────────────
                    // Se ejecuta después de que Spring Security ya autenticó
                    // al usuario. Si falla, el catch interno de LogAccesoServiceImpl
                    // lo absorbe sin interrumpir el login.
                    logAccesoService.registrarAcceso(usuario);
                    // ─────────────────────────────────────────────────────────

                    Rolenum rol = usuario.getRol();
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
                .csrf(AbstractHttpConfigurer::disable)

                .authorizeHttpRequests(authz -> authz
                        .requestMatchers(
                                "/",
                                "/login",
                                "/registro",
                                "/registrar",
                                "/test",
                                "/public",
                                "/api/auth/**",
                                "/check/**",
                                "/css/**",
                                "/js/**",
                                "/images/**"
                        )
                        .permitAll()

                        .requestMatchers("/dashboard/administradorGeneral").hasRole("ADMIN")
                        .requestMatchers("/dashboard/administradorSede").hasRole("ADMINISTRADOR_SEDE")
                        .requestMatchers("/dashboard/trabajadorParqueadero").hasRole("OPERARIO")
                        .requestMatchers("/dashboard/cliente").hasRole("CLIENTE")

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
                        .invalidateHttpSession(true)
                        .deleteCookies("JSESSIONID")
                        .permitAll()
                )

                // Sesiones ilimitadas simultáneas — el mismo usuario puede estar
                // autenticado desde múltiples pestañas y dispositivos a la vez.
                // sessionFixation().migrateSession() regenera el ID de sesión al
                // autenticarse para prevenir session fixation attacks.
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
                        .sessionFixation().migrateSession()
                )

                .exceptionHandling(ex -> ex
                        .accessDeniedHandler((request, response, accessDeniedException) -> {
                            response.sendRedirect("/login?accessDenied");
                        })
                )

                .authenticationProvider(authenticationProvider());

        return http.build();
    }

    // ==================== SESSION TIMEOUT — 24 HORAS ====================

    // Doble cobertura: application.properties define el timeout del servlet container,
    // este bean lo fuerza también a nivel Tomcat context (1440 minutos = 24 horas).
    @Bean
    public WebServerFactoryCustomizer<TomcatServletWebServerFactory> sessionTimeoutCustomizer() {
        return factory -> factory.addContextCustomizers(context -> {
            context.setSessionTimeout(1440);
        });
    }
}