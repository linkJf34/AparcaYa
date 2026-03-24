package com.exe.AparcaYA.Config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Component
public class JwtUtil {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration}")
    private long expiration;

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateToken(UserDetails userDetails, String rol, Long sedeId) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("rol", rol);
        if (sedeId != null) {
            claims.put("sedeId", sedeId);
        }
        return Jwts.builder()
                .claims(claims)
                .subject(userDetails.getUsername())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(getSigningKey())
                .compact();
    }

    // Sobrecarga sin sedeId — mantiene compatibilidad con código existente
    public String generateToken(UserDetails userDetails, String rol) {
        return generateToken(userDetails, rol, null);
    }

    public String extractUsername(String token) {
        return extractClaims(token).getSubject();
    }

    public String extractRol(String token) {
        return extractClaims(token).get("rol", String.class);
    }

    public Long extractSedeId(String token) {
        Object sedeId = extractClaims(token).get("sedeId");
        if (sedeId == null) return null;
        if (sedeId instanceof Integer) return ((Integer) sedeId).longValue();
        if (sedeId instanceof Long)    return (Long) sedeId;
        try { return Long.parseLong(sedeId.toString()); }
        catch (NumberFormatException e) { return null; }
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {
        final String username = extractUsername(token);
        return username.equals(userDetails.getUsername()) && !isTokenExpired(token);
    }

    private boolean isTokenExpired(String token) {
        return extractClaims(token).getExpiration().before(new Date());
    }

    private Claims extractClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}