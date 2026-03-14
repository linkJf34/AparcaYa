package com.exe.AparcaYA.Config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

    // Máximo 20 requests por IP cada 60 segundos en /check/**
    private static final int MAX_REQUESTS = 20;
    private static final long WINDOW_MS   = 60_000;

    private final ConcurrentHashMap<String, AtomicInteger> contadores = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long>          tiempos    = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest  request,
                                    HttpServletResponse response,
                                    FilterChain         filterChain)
            throws ServletException, IOException {

        String path = request.getRequestURI();

        // Solo aplicar a /check/**
        if (!path.startsWith("/check/")) {
            filterChain.doFilter(request, response);
            return;
        }

        String ip  = request.getRemoteAddr();
        long ahora = System.currentTimeMillis();

        // Resetear contador si venció la ventana de tiempo
        tiempos.compute(ip, (k, ultimoReset) -> {
            if (ultimoReset == null || (ahora - ultimoReset) > WINDOW_MS) {
                contadores.put(ip, new AtomicInteger(0));
                return ahora;
            }
            return ultimoReset;
        });

        int requests = contadores
                .computeIfAbsent(ip, k -> new AtomicInteger(0))
                .incrementAndGet();

        if (requests > MAX_REQUESTS) {
            response.setStatus(429); // Too Many Requests
            response.setContentType("application/json");
            response.getWriter().write(
                    "{\"disponible\":false,\"mensaje\":\"Demasiadas solicitudes. Intenta en 1 minuto.\"}"
            );
            return;
        }

        filterChain.doFilter(request, response);
    }
}