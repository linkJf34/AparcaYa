package com.exe.AparcaYA.Repository;

import com.exe.AparcaYA.Entity.PasswordResetToken;
import com.exe.AparcaYA.Entity.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {
    Optional<PasswordResetToken> findByToken(String token);
    void deleteByUsuario(Usuario usuario);
    void deleteByExpirationDateBefore(LocalDateTime dateTime);
}