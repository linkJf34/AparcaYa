package com.exe.AparcaYA.Dto;

import java.util.List;
import java.util.Map;

public class ReporteDataDTO {

    private Map<String, String> kpisDOM;
    private Map<String, String> graficasBase64;
    private String periodoReporte;
    private String sedeNombre;
    private List<Map<String, Object>> usuarios;
    private List<Map<String, Object>> sedes;
    private List<Map<String, Object>> correos;

    public Map<String, String> getKpisDOM() { return kpisDOM; }
    public void setKpisDOM(Map<String, String> v) { this.kpisDOM = v; }
    public Map<String, String> getGraficasBase64() { return graficasBase64; }
    public void setGraficasBase64(Map<String, String> v) { this.graficasBase64 = v; }
    public String getPeriodoReporte() { return periodoReporte; }
    public void setPeriodoReporte(String v) { this.periodoReporte = v; }
    public String getSedeNombre() { return sedeNombre; }
    public void setSedeNombre(String v) { this.sedeNombre = v; }
    public List<Map<String, Object>> getUsuarios() { return usuarios; }
    public void setUsuarios(List<Map<String, Object>> v) { this.usuarios = v; }
    public List<Map<String, Object>> getSedes() { return sedes; }
    public void setSedes(List<Map<String, Object>> v) { this.sedes = v; }
    public List<Map<String, Object>> getCorreos() { return correos; }
    public void setCorreos(List<Map<String, Object>> v) { this.correos = v; }
}