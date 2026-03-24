package com.exe.AparcaYA.Dto;

import java.util.Map;

public class ReportePayloadDTO {

    private String tipo;
    private FiltrosDTO filtros;
    private Map<String, String> kpis;
    private Map<String, String> graficas;

    public static class FiltrosDTO {
        private String fechaInicio;
        private String fechaFin;
        private String sedeId;

        public String getFechaInicio() { return fechaInicio; }
        public void setFechaInicio(String v) { this.fechaInicio = v; }
        public String getFechaFin() { return fechaFin; }
        public void setFechaFin(String v) { this.fechaFin = v; }
        public String getSedeId() { return sedeId; }
        public void setSedeId(String v) { this.sedeId = v; }
    }

    public String getTipo() { return tipo; }
    public void setTipo(String v) { this.tipo = v; }
    public FiltrosDTO getFiltros() { return filtros; }
    public void setFiltros(FiltrosDTO v) { this.filtros = v; }
    public Map<String, String> getKpis() { return kpis; }
    public void setKpis(Map<String, String> v) { this.kpis = v; }
    public Map<String, String> getGraficas() { return graficas; }
    public void setGraficas(Map<String, String> v) { this.graficas = v; }
}
