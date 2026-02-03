package com.exe.AparcaYA.Controllers;

/*import com.exe.AparcaYA.Service.PasswordResetService;*/
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import java.util.Map;

@Controller  // Quita @RequestMapping("/api/auth") aquí
public class AuthController {

   /* @Autowired
    private PasswordResetService passwordResetService;*/

    // Página principal (index)
    @GetMapping("/")
    public String index() {
        return "Index";  // Vista en templates/Index.html
    }

    // Página de login (GET)
    @GetMapping("/login")
    public String loginPage() {
        return "Login";  // Vista Login.html
    }

    // Página de registro (GET)
    @GetMapping("/registro")
    public String registroPage() {
        return "Registro_1";  // Vista Registro_1.html
    }


}