package com.exe.AparcaYA.Service;

import com.exe.AparcaYA.Entity.Sede;
import com.exe.AparcaYA.Entity.Usuario;

import java.io.ByteArrayOutputStream;
import java.util.List;

public interface ReporteService {

    ByteArrayOutputStream generarReportePDF(List<Usuario> usuarios) throws Exception;
    ByteArrayOutputStream generarReporteExcel(List<Usuario> usuarios) throws Exception;

    // ✅ CAMBIO #5: Nuevo método para reporte Excel de sedes
    // Permite eliminar la generación manual con POI en SedeController
    ByteArrayOutputStream generarReporteExcelSedes(List<Sede> sedes) throws Exception;
}