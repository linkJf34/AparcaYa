package com.exe.AparcaYA.Controllers;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class SessionController {

    // Endpoint llamado por JS cada 10 min para renovar la sesión.
    // Requiere autenticación (cubierto por anyRequest().authenticated()).
    // false en getSession → no crea sesión si no existe.
    @GetMapping("/api/session/keepalive")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> keepAlive(HttpServletRequest request) {

        HttpSession session = request.getSession(false);

        if (session != null) {
            return ResponseEntity.ok(Map.of("alive", true));
        }

        return ResponseEntity.status(401)
                .body(Map.of("alive", false));
    }
}