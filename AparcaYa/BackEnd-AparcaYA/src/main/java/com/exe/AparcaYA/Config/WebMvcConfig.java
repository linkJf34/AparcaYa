package com.exe.AparcaYA.Config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Expone la carpeta local "uploads/" como ruta estática /uploads/**
 * Esto permite que el navegador cargue las imágenes guardadas en el servidor
 * usando una URL como: /uploads/sedes/12/imagen_abc123.jpg
 *
 * ⚠️  Si ya existe un WebMvcConfigurer en tu proyecto, simplemente
 *     agrega el método addResourceHandlers() a la clase existente
 *     en lugar de crear este archivo nuevo.
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Carpeta local "uploads/" → accesible desde el browser en "/uploads/"
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:uploads/");
    }
}