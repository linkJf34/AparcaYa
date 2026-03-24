package com.exe.AparcaYA.Component;

import com.exe.AparcaYA.Dto.ReporteDataDTO;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.*;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@Component
public class ExcelReporteBuilder {

    public byte[] generar(ReporteDataDTO data) throws Exception {
        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            Estilos e = new Estilos(wb);

            crearHojaResumen(wb, e, data);
            crearHojaDatos(wb, e, "Usuarios", data.getUsuarios(),
                    new String[]{"nombre", "correo", "rol", "estado"},
                    new int[]{6000, 8000, 4000, 3500});
            crearHojaDatos(wb, e, "Sedes", data.getSedes(),
                    new String[]{"nombre", "direccion", "capacidad", "estado"},
                    new int[]{6000, 9000, 4000, 3500});
            crearHojaDatos(wb, e, "Correos", data.getCorreos(),
                    new String[]{"destinatario", "asunto", "tipo", "estado", "fecha"},
                    new int[]{7000, 8000, 4000, 3500, 5000});

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            wb.write(baos);
            return baos.toByteArray();
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // HOJA RESUMEN
    // ──────────────────────────────────────────────────────────────────
    private void crearHojaResumen(XSSFWorkbook wb, Estilos e,
                                  ReporteDataDTO data) {
        XSSFSheet sheet = wb.createSheet("Resumen");
        sheet.setColumnWidth(0, 5000);
        sheet.setColumnWidth(1, 7000);
        sheet.setColumnWidth(2, 5000);
        sheet.setColumnWidth(3, 7000);

        int f = 0;

        // Titulo
        Row rt = sheet.createRow(f++);
        rt.setHeightInPoints(32);
        Cell ct = rt.createCell(0);
        ct.setCellValue("REPORTE EJECUTIVO — APARCAYA");
        ct.setCellStyle(e.titulo());
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 3));

        // Subtitulo
        Row rs = sheet.createRow(f++);
        rs.setHeightInPoints(20);
        Cell cs = rs.createCell(0);
        cs.setCellValue("Periodo: " + data.getPeriodoReporte()
                + "  |  Generado: "
                + LocalDateTime.now().format(
                DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")));
        cs.setCellStyle(e.subtitulo());
        sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, 3));

        f++; // espacio

        // Header seccion KPIs
        Row rh = sheet.createRow(f++);
        rh.setHeightInPoints(18);
        Cell ch = rh.createCell(0);
        ch.setCellValue("INDICADORES CLAVE");
        ch.setCellStyle(e.seccion());
        sheet.addMergedRegion(new CellRangeAddress(f - 1, f - 1, 0, 3));

        // Valores KPIs
        Map<String, String> kpis = data.getKpisDOM();
        if (kpis != null) {
            f = agregarFilaKpi(sheet, e, f,
                    "Ingresos este mes",  kpis.getOrDefault("ingresosActual",   "0"),
                    "Total usuarios",     kpis.getOrDefault("totalUsuariosCard","0"));
            f = agregarFilaKpi(sheet, e, f,
                    "Usuarios activos",   kpis.getOrDefault("usuariosActivos",  "0"),
                    "Total sedes",        kpis.getOrDefault("totalSedesCard",   "0"));
            f = agregarFilaKpi(sheet, e, f,
                    "Capacidad sedes",    kpis.getOrDefault("sedesCapacidad",   "0"),
                    "Correos enviados",   kpis.getOrDefault("correosEnviados",  "0"));
            f = agregarFilaKpi(sheet, e, f,
                    "Acumulado ano",      kpis.getOrDefault("ingresosAnio",     "0"),
                    "Correos con error",  kpis.getOrDefault("correosErrores",   "0"));
        }
    }

    private int agregarFilaKpi(XSSFSheet sheet, Estilos e, int fila,
                               String lbl1, String val1,
                               String lbl2, String val2) {
        // Fila de etiquetas
        Row rl = sheet.createRow(fila++);
        rl.setHeightInPoints(16);
        celdaStr(rl, 0, lbl1, e.kpiLabel());
        celdaStr(rl, 1, "",   e.kpiLabel());
        celdaStr(rl, 2, lbl2, e.kpiLabel());
        celdaStr(rl, 3, "",   e.kpiLabel());

        // Fila de valores
        Row rv = sheet.createRow(fila++);
        rv.setHeightInPoints(28);
        celdaStr(rv, 0, lbl1, e.kpiLabel());
        celdaStr(rv, 1, val1, e.kpiValor());
        celdaStr(rv, 2, lbl2, e.kpiLabel());
        celdaStr(rv, 3, val2, e.kpiValor());
        return fila;
    }

    // ──────────────────────────────────────────────────────────────────
    // HOJA DE DATOS GENERICA
    // ──────────────────────────────────────────────────────────────────
    private void crearHojaDatos(XSSFWorkbook wb, Estilos e,
                                String nombre,
                                List<Map<String, Object>> filas,
                                String[] columnas,
                                int[] anchos) {
        XSSFSheet sheet = wb.createSheet(nombre);
        for (int i = 0; i < anchos.length; i++) {
            sheet.setColumnWidth(i, anchos[i]);
        }

        // Titulo
        Row rt = sheet.createRow(0);
        rt.setHeightInPoints(28);
        Cell ct = rt.createCell(0);
        ct.setCellValue(nombre);
        ct.setCellStyle(e.titulo());
        sheet.addMergedRegion(
                new CellRangeAddress(0, 0, 0, columnas.length - 1));

        // Headers
        Row rh = sheet.createRow(1);
        rh.setHeightInPoints(22);
        for (int i = 0; i < columnas.length; i++) {
            Cell c = rh.createCell(i);
            String col = columnas[i];
            c.setCellValue(
                    col.substring(0, 1).toUpperCase() + col.substring(1));
            c.setCellStyle(e.header());
        }

        // Sin datos
        if (filas == null || filas.isEmpty()) {
            Row re = sheet.createRow(2);
            Cell ce = re.createCell(0);
            ce.setCellValue("Sin registros en este periodo.");
            ce.setCellStyle(e.celdaMuted());
            sheet.addMergedRegion(
                    new CellRangeAddress(2, 2, 0, columnas.length - 1));
            return;
        }

        // Filas de datos
        boolean par = false;
        int f = 2;
        for (Map<String, Object> fila : filas) {
            Row row = sheet.createRow(f++);
            row.setHeightInPoints(18);
            for (int i = 0; i < columnas.length; i++) {
                Object val = fila.get(columnas[i]);
                celdaStr(row, i,
                        val != null ? val.toString() : "—",
                        par ? e.celdaPar() : e.celdaImpar());
            }
            par = !par;
        }

        // Filtros automaticos
        sheet.setAutoFilter(
                new CellRangeAddress(1, f - 1, 0, columnas.length - 1));
    }

    // ──────────────────────────────────────────────────────────────────
    // UTILIDAD
    // ──────────────────────────────────────────────────────────────────
    private void celdaStr(Row row, int col, String valor, CellStyle style) {
        Cell c = row.createCell(col);
        c.setCellValue(valor != null ? valor : "—");
        c.setCellStyle(style);
    }

    // ──────────────────────────────────────────────────────────────────
    // ESTILOS
    // ──────────────────────────────────────────────────────────────────
    private static class Estilos {

        private final XSSFWorkbook wb;

        Estilos(XSSFWorkbook wb) { this.wb = wb; }

        private XSSFColor color(int r, int g, int b) {
            return new XSSFColor(
                    new byte[]{(byte) r, (byte) g, (byte) b}, null);
        }

        XSSFCellStyle titulo() {
            XSSFCellStyle s = wb.createCellStyle();
            s.setFillForegroundColor(color(30, 64, 175));
            s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            s.setAlignment(HorizontalAlignment.LEFT);
            s.setVerticalAlignment(VerticalAlignment.CENTER);
            s.setIndention((short) 1);
            XSSFFont f = wb.createFont();
            f.setBold(true);
            f.setFontHeightInPoints((short) 14);
            f.setColor(IndexedColors.WHITE.getIndex());
            s.setFont(f);
            return s;
        }

        XSSFCellStyle subtitulo() {
            XSSFCellStyle s = wb.createCellStyle();
            s.setFillForegroundColor(color(248, 250, 252));
            s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            s.setAlignment(HorizontalAlignment.LEFT);
            s.setVerticalAlignment(VerticalAlignment.CENTER);
            s.setIndention((short) 1);
            XSSFFont f = wb.createFont();
            f.setFontHeightInPoints((short) 9);
            f.setColor(color(100, 116, 139));
            s.setFont(f);
            return s;
        }

        XSSFCellStyle seccion() {
            XSSFCellStyle s = wb.createCellStyle();
            s.setFillForegroundColor(color(96, 130, 220));
            s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            XSSFFont f = wb.createFont();
            f.setBold(true);
            f.setFontHeightInPoints((short) 10);
            f.setColor(IndexedColors.WHITE.getIndex());
            s.setFont(f);
            s.setAlignment(HorizontalAlignment.LEFT);
            s.setVerticalAlignment(VerticalAlignment.CENTER);
            s.setIndention((short) 1);
            return s;
        }

        XSSFCellStyle header() {
            XSSFCellStyle s = wb.createCellStyle();
            s.setFillForegroundColor(color(30, 64, 175));
            s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            s.setAlignment(HorizontalAlignment.CENTER);
            s.setVerticalAlignment(VerticalAlignment.CENTER);
            XSSFFont f = wb.createFont();
            f.setBold(true);
            f.setFontHeightInPoints((short) 10);
            f.setColor(IndexedColors.WHITE.getIndex());
            s.setFont(f);
            borde(s, BorderStyle.THIN, color(15, 32, 90));
            return s;
        }

        XSSFCellStyle celdaPar() {
            XSSFCellStyle s = wb.createCellStyle();
            s.setFillForegroundColor(color(241, 245, 249));
            s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            s.setVerticalAlignment(VerticalAlignment.CENTER);
            bordeLight(s);
            return s;
        }

        XSSFCellStyle celdaImpar() {
            XSSFCellStyle s = wb.createCellStyle();
            s.setFillForegroundColor(color(255, 255, 255));
            s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            s.setVerticalAlignment(VerticalAlignment.CENTER);
            bordeLight(s);
            return s;
        }

        XSSFCellStyle celdaMuted() {
            XSSFCellStyle s = celdaImpar();
            XSSFFont f = wb.createFont();
            f.setItalic(true);
            f.setColor(color(100, 116, 139));
            s.setFont(f);
            return s;
        }

        XSSFCellStyle kpiLabel() {
            XSSFCellStyle s = wb.createCellStyle();
            s.setFillForegroundColor(color(239, 246, 255));
            s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            s.setAlignment(HorizontalAlignment.CENTER);
            XSSFFont f = wb.createFont();
            f.setFontHeightInPoints((short) 9);
            f.setColor(color(100, 116, 139));
            s.setFont(f);
            bordeLight(s);
            return s;
        }

        XSSFCellStyle kpiValor() {
            XSSFCellStyle s = wb.createCellStyle();
            s.setFillForegroundColor(color(239, 246, 255));
            s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            s.setAlignment(HorizontalAlignment.CENTER);
            s.setVerticalAlignment(VerticalAlignment.CENTER);
            XSSFFont f = wb.createFont();
            f.setBold(true);
            f.setFontHeightInPoints((short) 16);
            f.setColor(color(30, 64, 175));
            s.setFont(f);
            borde(s, BorderStyle.MEDIUM, color(96, 130, 220));
            return s;
        }

        private void borde(XSSFCellStyle s, BorderStyle bs, XSSFColor c) {
            s.setBorderTop(bs);    s.setTopBorderColor(c);
            s.setBorderBottom(bs); s.setBottomBorderColor(c);
            s.setBorderLeft(bs);   s.setLeftBorderColor(c);
            s.setBorderRight(bs);  s.setRightBorderColor(c);
        }

        private void bordeLight(XSSFCellStyle s) {
            XSSFColor c = color(203, 213, 225);
            s.setBorderTop(BorderStyle.HAIR);    s.setTopBorderColor(c);
            s.setBorderBottom(BorderStyle.HAIR); s.setBottomBorderColor(c);
            s.setBorderLeft(BorderStyle.HAIR);   s.setLeftBorderColor(c);
            s.setBorderRight(BorderStyle.HAIR);  s.setRightBorderColor(c);
        }
    }
}