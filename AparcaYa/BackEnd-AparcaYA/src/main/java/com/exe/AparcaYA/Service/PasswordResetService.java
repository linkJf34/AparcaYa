package com.exe.AparcaYA.Service;

import com.exe.AparcaYA.Entity.PasswordResetToken;
import com.exe.AparcaYA.Entity.Usuario;
import jakarta.mail.MessagingException;
import java.util.Optional;

public interface PasswordResetService {
    String createPasswordResetToken(Usuario usuario);
    Optional<PasswordResetToken> validateToken(String token);
    void markTokenAsUsed(String token);
    void sendResetEmail(String email, String token) throws MessagingException;
    void cleanExpiredTokens();
}
