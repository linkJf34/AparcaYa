package com.exe.AparcaYA.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Arrays;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * GeocodificacionService — Convierte texto de dirección → latitud/longitud
 * usando OpenCage Geocoding API.
 *
 * Estrategia de selección de resultado:
 *   Cuando OpenCage devuelve múltiples segmentos de la misma calle,
 *   se elige el más cercano al centroide del barrio conocido.
 *   Esto resuelve el problema de "Carrera 7D" que aparece en múltiples
 *   sectores de Usaquén — se selecciona el segmento correcto por proximidad.
 */
@Service
public class GeocodificacionService {

    private static final Logger log = LoggerFactory.getLogger(GeocodificacionService.class);

    private static final double BOG_LAT_MIN =  4.45;
    private static final double BOG_LAT_MAX =  4.85;
    private static final double BOG_LON_MIN = -74.25;
    private static final double BOG_LON_MAX = -73.95;

    private static final String OPENCAGE_URL = "https://api.opencagedata.com/geocode/v1/json";

    @Value("${geocodificacion.opencage.key}")
    private String apiKey;

    private final HttpClient   httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(8))
            .build();
    private final ObjectMapper mapper = new ObjectMapper();

    // -------------------------------------------------------------------------
    // API pública
    // -------------------------------------------------------------------------

    public Optional<double[]> geocodificar(String direccion, String localidad, String barrio) {
        if (direccion == null || direccion.isBlank()) {
            log.warn("geocodificar: dirección vacía, se omite");
            return Optional.empty();
        }

        String direccionNormalizada = normalizarDireccion(direccion);
        String localidadFmt         = formatearLocalidad(localidad);

        log.info("geocodificar: '{}' → normalizada: '{}'", direccion, direccionNormalizada);

        // Obtener centroide del barrio para seleccionar el resultado más cercano
        double[] centroideBarrio = obtenerCentroideBarrio(localidad, barrio);

        String[] estrategias = buildEstrategias(direccionNormalizada, localidadFmt, barrio);

        for (int i = 0; i < estrategias.length; i++) {
            Optional<double[]> resultado = llamarOpenCage(estrategias[i], centroideBarrio);
            if (resultado.isPresent()) {
                log.info("geocodificar: éxito con estrategia {} → [{}, {}]",
                        i + 1, resultado.get()[0], resultado.get()[1]);
                return resultado;
            }
            if (i < estrategias.length - 1) {
                sleep(300);
            }
        }

        // Fallback: solo barrio + localidad
        if (barrio != null && !barrio.isBlank()) {
            log.info("geocodificar: fallback a barrio '{}'", barrio);
            String queryBarrio = barrio + ", "
                    + (localidadFmt != null ? localidadFmt + ", " : "")
                    + "Bogotá, Colombia";
            Optional<double[]> fallback = llamarOpenCage(queryBarrio, centroideBarrio);
            if (fallback.isPresent()) {
                log.info("geocodificar: resuelto por barrio → [{}, {}]",
                        fallback.get()[0], fallback.get()[1]);
                return fallback;
            }
        }

        log.warn("geocodificar: no se pudo resolver '{}'", direccion);
        return Optional.empty();
    }

    // -------------------------------------------------------------------------
    // Centroides aproximados de barrios — usados para elegir el resultado
    // más cercano cuando OpenCage devuelve múltiples segmentos de la misma calle
    // -------------------------------------------------------------------------

    private double[] obtenerCentroideBarrio(String localidad, String barrio) {
        if (barrio == null || barrio.isBlank()) {
            return obtenerCentroideLocalidad(localidad);
        }

        String b = barrio.trim().toLowerCase();
        String l = localidad != null ? localidad.toUpperCase().trim() : "";

        // Centroides por barrio — expandir según las sedes del proyecto
        if (b.contains("barrancas"))        return new double[]{4.7348, -74.0258};
        if (b.contains("cedritos"))         return new double[]{4.7190, -74.0355};
        if (b.contains("chico") || b.contains("chicó")) return new double[]{4.6737, -74.0517};
        if (b.contains("niza"))             return new double[]{4.7298, -74.0632};
        if (b.contains("santa barbara") || b.contains("santa bárbara")) return new double[]{4.7020, -74.0391};
        if (b.contains("usaquen") || b.contains("usaquén")) return new double[]{4.7050, -74.0350};
        if (b.contains("country"))          return new double[]{4.6716, -74.0573};
        if (b.contains("rosales"))          return new double[]{4.6597, -74.0482};
        if (b.contains("cabrera"))          return new double[]{4.6691, -74.0501};
        if (b.contains("lago"))             return new double[]{4.6660, -74.0587};
        if (b.contains("retiro"))           return new double[]{4.6667, -74.0516};
        if (b.contains("tintal"))           return new double[]{4.6538, -74.1548};
        if (b.contains("timiza"))           return new double[]{4.6251, -74.1489};
        if (b.contains("carvajal"))         return new double[]{4.6145, -74.1392};
        if (b.contains("patio bonito"))     return new double[]{4.6279, -74.1456};
        if (b.contains("ferias"))           return new double[]{4.7024, -74.1113};
        if (b.contains("minuto de dios"))   return new double[]{4.7063, -74.1142};
        if (b.contains("tibabuyes"))        return new double[]{4.7451, -74.0785};
        if (b.contains("suba"))             return new double[]{4.7415, -74.0816};
        if (b.contains("7 de agosto"))      return new double[]{4.6772, -74.0895};
        if (b.contains("soledad"))          return new double[]{4.6448, -74.0732};
        if (b.contains("restrepo"))         return new double[]{4.6110, -74.1026};
        if (b.contains("ciudad montes"))    return new double[]{4.6287, -74.1189};
        if (b.contains("kennedy"))          return new double[]{4.6280, -74.1550};
        if (b.contains("bosa"))             return new double[]{4.6242, -74.1975};
        if (b.contains("fontibon") || b.contains("fontibón")) return new double[]{4.7068, -74.1483};
        if (b.contains("candelaria"))       return new double[]{4.5986, -74.0721};
        if (b.contains("chapinero"))        return new double[]{4.6500, -74.0550};
        if (b.contains("perseverancia"))    return new double[]{4.6134, -74.0674};

        // Si no hay coincidencia de barrio, usar centroide de localidad
        return obtenerCentroideLocalidad(localidad);
    }

    private double[] obtenerCentroideLocalidad(String localidad) {
        if (localidad == null) return new double[]{4.6533, -74.0836}; // Centro Bogotá
        switch (localidad.toUpperCase().trim()) {
            case "USAQUEN":          return new double[]{4.7110, -74.0300};
            case "CHAPINERO":        return new double[]{4.6400, -74.0620};
            case "SANTA_FE":         return new double[]{4.6097, -74.0730};
            case "SAN_CRISTOBAL":    return new double[]{4.5700, -74.0800};
            case "USME":             return new double[]{4.5100, -74.1300};
            case "TUNJUELITO":       return new double[]{4.5800, -74.1400};
            case "BOSA":             return new double[]{4.6200, -74.1900};
            case "KENNEDY":          return new double[]{4.6280, -74.1550};
            case "FONTIBON":         return new double[]{4.6800, -74.1400};
            case "ENGATIVA":         return new double[]{4.7000, -74.1100};
            case "SUBA":             return new double[]{4.7500, -74.0800};
            case "BARRIOS_UNIDOS":   return new double[]{4.6700, -74.0850};
            case "TEUSAQUILLO":      return new double[]{4.6400, -74.0900};
            case "MARTIRES":         return new double[]{4.6000, -74.0950};
            case "ANTONIO_NARINO":   return new double[]{4.5900, -74.1100};
            case "PUENTE_ARANDA":    return new double[]{4.6200, -74.1200};
            case "CANDELARIA":       return new double[]{4.5970, -74.0730};
            case "RAFAEL_URIBE_URIBE": return new double[]{4.5600, -74.1200};
            case "CIUDAD_BOLIVAR":   return new double[]{4.5700, -74.1800};
            case "SUMAPAZ":          return new double[]{4.2600, -74.2900};
            default:                 return new double[]{4.6533, -74.0836};
        }
    }

    // -------------------------------------------------------------------------
    // Normalizador de direcciones colombianas
    // -------------------------------------------------------------------------

    private String normalizarDireccion(String direccion) {
        if (direccion == null) return null;
        String d = direccion.trim();
        d = d.replace("#", "");
        d = d.replaceAll("(?i)\\bCra\\.?\\b", "Carrera");
        d = d.replaceAll("(?i)\\bKra\\.?\\b", "Carrera");
        d = d.replaceAll("(?i)\\bKr\\.?\\b",  "Carrera");
        d = d.replaceAll("(?i)\\bCr\\.?\\b",  "Carrera");
        d = d.replaceAll("(?i)\\bK\\.?\\b",   "Carrera");
        d = d.replaceAll("(?i)\\bCll\\.?\\b", "Calle");
        d = d.replaceAll("(?i)\\bCl\\.?\\b",  "Calle");
        d = d.replaceAll("(?i)\\bDiag\\.?\\b","Diagonal");
        d = d.replaceAll("(?i)\\bDg\\.?\\b",  "Diagonal");
        d = d.replaceAll("(?i)\\bTrv\\.?\\b", "Transversal");
        d = d.replaceAll("(?i)\\bTv\\.?\\b",  "Transversal");
        d = d.replaceAll("(?i)\\bTr\\.?\\b",  "Transversal");
        d = d.replaceAll("(?i)\\bAvd\\.?\\b", "Avenida");
        d = d.replaceAll("(?i)\\bAv\\.?\\b",  "Avenida");
        d = d.replaceAll("\\s{2,}", " ").trim();
        return d;
    }

    // -------------------------------------------------------------------------
    // Privados
    // -------------------------------------------------------------------------

    private String[] buildEstrategias(String direccion, String localidad, String barrio) {
        boolean tieneBarrio    = barrio    != null && !barrio.isBlank();
        boolean tieneLocalidad = localidad != null && !localidad.isBlank();
        if (tieneBarrio && tieneLocalidad) {
            return new String[]{
                    direccion + ", " + barrio + ", " + localidad + ", Bogotá, Colombia",
                    direccion + ", " + localidad + ", Bogotá, Colombia",
                    direccion + ", Bogotá, Colombia"
            };
        }
        if (tieneLocalidad) {
            return new String[]{
                    direccion + ", " + localidad + ", Bogotá, Colombia",
                    direccion + ", Bogotá, Colombia"
            };
        }
        return new String[]{ direccion + ", Bogotá, Colombia" };
    }

    /**
     * Llama a OpenCage y selecciona el resultado más cercano al centroide del barrio.
     * Esto resuelve el problema de calles que aparecen en múltiples sectores de la ciudad.
     */
    private Optional<double[]> llamarOpenCage(String query, double[] centroide) {
        try {
            String url = OPENCAGE_URL
                    + "?q="       + java.net.URLEncoder.encode(query, "UTF-8")
                    + "&key="     + apiKey
                    + "&limit=5"
                    + "&countrycode=co"
                    + "&bounds="  + BOG_LON_MIN + "," + BOG_LAT_MIN
                    + "," + BOG_LON_MAX + "," + BOG_LAT_MAX
                    + "&language=es"
                    + "&no_annotations=1";

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("User-Agent", "AparcaYA/1.0")
                    .timeout(Duration.ofSeconds(10))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request,
                    HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.warn("OpenCage respondió {} para query: {}", response.statusCode(), query);
                return Optional.empty();
            }

            JsonNode root    = mapper.readTree(response.body());
            JsonNode results = root.get("results");

            if (results == null || !results.isArray() || results.size() == 0) {
                log.debug("OpenCage: sin resultados para '{}'", query);
                return Optional.empty();
            }

            // Seleccionar el resultado más cercano al centroide del barrio
            double mejorLat      = 0;
            double mejorLon      = 0;
            double menorDistancia = Double.MAX_VALUE;
            boolean encontrado   = false;

            for (JsonNode result : results) {
                JsonNode geometry = result.get("geometry");
                if (geometry == null) continue;

                double lat = geometry.get("lat").asDouble();
                double lon = geometry.get("lng").asDouble();

                if (!esDentroDeBogota(lat, lon)) continue;

                double distancia = distancia(lat, lon, centroide[0], centroide[1]);
                if (distancia < menorDistancia) {
                    menorDistancia = distancia;
                    mejorLat       = lat;
                    mejorLon       = lon;
                    encontrado     = true;
                }
            }

            if (encontrado) {
                log.debug("OpenCage: resultado más cercano al barrio → [{}, {}] (dist: {})",
                        mejorLat, mejorLon, menorDistancia);
                return Optional.of(new double[]{mejorLat, mejorLon});
            }

            return Optional.empty();

        } catch (Exception e) {
            log.error("Error llamando OpenCage para query '{}': {}", query, e.getMessage());
            return Optional.empty();
        }
    }

    /** Distancia euclidiana simple entre dos puntos (suficiente para comparar resultados cercanos) */
    private double distancia(double lat1, double lon1, double lat2, double lon2) {
        return Math.sqrt(Math.pow(lat1 - lat2, 2) + Math.pow(lon1 - lon2, 2));
    }

    private boolean esDentroDeBogota(double lat, double lon) {
        return lat >= BOG_LAT_MIN && lat <= BOG_LAT_MAX
                && lon >= BOG_LON_MIN && lon <= BOG_LON_MAX;
    }

    private String formatearLocalidad(String localidad) {
        if (localidad == null || localidad.isBlank()) return null;
        return Arrays.stream(localidad.split("[_\\s]+"))
                .map(w -> w.isEmpty() ? w :
                        Character.toUpperCase(w.charAt(0)) + w.substring(1).toLowerCase())
                .collect(Collectors.joining(" "));
    }

    private void sleep(long ms) {
        try { Thread.sleep(ms); } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }
    }
}