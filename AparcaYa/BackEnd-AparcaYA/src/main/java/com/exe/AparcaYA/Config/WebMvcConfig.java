package com.exe.AparcaYA.Config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.nio.file.Paths;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    /**
     * Sirve los archivos subidos por los usuarios (imágenes de sede, etc.)
     * desde la carpeta uploads/ del directorio de trabajo del proceso.
     *
     * El controller guarda las imágenes como:
     *   uploads/sedes/{sedeId}/imagen_{uuid}.jpg
     *
     * Y el JS las solicita como:
     *   /uploads/sedes/{sedeId}/imagen_{uuid}.jpg
     *
     * Esta configuración mapea /uploads/** → carpeta uploads/ en disco.
     */
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {

        // Resolver la ruta absoluta de la carpeta uploads/
        // relativa al directorio de trabajo del proceso (raíz del proyecto)
        Path uploadsDir = Paths.get("uploads").toAbsolutePath();

        registry
                .addResourceHandler("/uploads/**")
                .addResourceLocations("file:" + uploadsDir + "/");
    }
}