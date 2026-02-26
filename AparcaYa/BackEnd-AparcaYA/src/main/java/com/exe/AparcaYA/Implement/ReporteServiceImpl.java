package com.exe.AparcaYA.Implement;

import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;

import com.exe.AparcaYA.Entity.Usuario;
import com.exe.AparcaYA.Service.ReporteService;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@Service
public class ReporteServiceImpl implements ReporteService {

    // ============================================
    // ✅ CAMBIO 2: Método auxiliar extraído para evitar duplicación
    // Antes: los 5 conteos se calculaban de forma idéntica tanto en
    //        generarReportePDF() como en generarReporteExcel().
    // Ahora: un único método privado reutilizado en ambos.
    // ============================================
    private Map<String, Long> calcularEstadisticas(List<Usuario> usuarios) {
        long adminCount    = usuarios.stream().filter(u -> u.getRol().name().equals("ADMIN")).count();
        long clienteCount  = usuarios.stream().filter(u -> u.getRol().name().equals("CLIENTE")).count();
        long operadorCount = usuarios.stream().filter(u -> u.getRol().name().equals("OPERADOR")).count();
        long activosCount  = usuarios.stream().filter(u -> u.getEstado().name().equals("ACTIVO")).count();
        long inactivosCount= usuarios.stream().filter(u -> u.getEstado().name().equals("INACTIVO")).count();

        return Map.of(
                "admin",     adminCount,
                "cliente",   clienteCount,
                "operador",  operadorCount,
                "activos",   activosCount,
                "inactivos", inactivosCount
        );
    }

    // ------------------------- PDF -------------------------------
    @Override
    public ByteArrayOutputStream generarReportePDF(List<Usuario> usuarios) throws Exception {

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PdfWriter writer = new PdfWriter(baos);
        PdfDocument pdf = new PdfDocument(writer);
        Document document = new Document(pdf);

        Paragraph titulo = new Paragraph("REPORTE DE USUARIOS - APARCAYA")
                .setFontSize(18)
                .setBold()
                .setTextAlignment(TextAlignment.CENTER);
        document.add(titulo);

        String fechaActual = LocalDateTime.now()
                .format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"));

        Paragraph fecha = new Paragraph("Fecha de generación: " + fechaActual)
                .setFontSize(10)
                .setTextAlignment(TextAlignment.RIGHT);
        document.add(fecha);

        document.add(new Paragraph("\n"));

        float[] columnWidths = {1, 2.5f, 2.5f, 1.5f, 2, 1.5f, 1.5f, 1.2f};
        Table table = new Table(UnitValue.createPercentArray(columnWidths));
        table.setWidth(UnitValue.createPercentValue(100));
        table.setFontSize(8);

        String[] headers = {"ID", "Nombre", "Correo", "Teléfono", "Cédula", "Rol", "Tipo Cliente", "Estado"};
        for (String header : headers) {
            Cell cell = new Cell()
                    .add(new Paragraph(header).setBold().setFontSize(8))
                    .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                    .setTextAlignment(TextAlignment.CENTER);
            table.addHeaderCell(cell);
        }

        for (Usuario usuario : usuarios) {
            table.addCell(new Cell().add(new Paragraph(String.valueOf(usuario.getIdUsuario())).setFontSize(7)));
            table.addCell(new Cell().add(new Paragraph(usuario.getNombre() != null ? usuario.getNombre() : "").setFontSize(7)));
            table.addCell(new Cell().add(new Paragraph(usuario.getCorreo() != null ? usuario.getCorreo() : "").setFontSize(7)));
            table.addCell(new Cell().add(new Paragraph(usuario.getTelefono() != null ? usuario.getTelefono() : "").setFontSize(7)));
            table.addCell(new Cell().add(new Paragraph(usuario.getCedula() != null ? usuario.getCedula() : "").setFontSize(7)));
            table.addCell(new Cell().add(new Paragraph(usuario.getRol() != null ? usuario.getRol().name() : "").setFontSize(7)));
            table.addCell(new Cell().add(new Paragraph(usuario.getTipoCliente() != null ? usuario.getTipoCliente().name() : "").setFontSize(7)));
            table.addCell(new Cell().add(new Paragraph(usuario.getEstado() != null ? usuario.getEstado().name() : "").setFontSize(7)));
        }

        document.add(table);

        // ✅ CAMBIO 2: Usar método auxiliar en lugar de calcular aquí
        Map<String, Long> stats = calcularEstadisticas(usuarios);

        document.add(new Paragraph("\n"));
        document.add(new Paragraph("ESTADÍSTICAS").setBold().setFontSize(12));
        document.add(new Paragraph("Total de usuarios: " + usuarios.size()).setFontSize(10));
        document.add(new Paragraph("Administradores: " + stats.get("admin")).setFontSize(10));
        document.add(new Paragraph("Clientes: " + stats.get("cliente")).setFontSize(10));
        document.add(new Paragraph("Operadores: " + stats.get("operador")).setFontSize(10));
        document.add(new Paragraph("\nActivos: " + stats.get("activos")).setFontSize(10));
        document.add(new Paragraph("Inactivos: " + stats.get("inactivos")).setFontSize(10));

        document.close();
        return baos;
    }

    // ------------------------- EXCEL -------------------------------
    @Override
    public ByteArrayOutputStream generarReporteExcel(List<Usuario> usuarios) throws Exception {

        Workbook workbook = new XSSFWorkbook();
        Sheet sheet = workbook.createSheet("Usuarios");

        CellStyle headerStyle = workbook.createCellStyle();
        Font headerFont = workbook.createFont();
        headerFont.setBold(true);
        headerFont.setFontHeightInPoints((short) 12);
        headerFont.setColor(IndexedColors.WHITE.getIndex());
        headerStyle.setFont(headerFont);
        headerStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
        headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        headerStyle.setAlignment(HorizontalAlignment.CENTER);

        Row headerRow = sheet.createRow(0);
        String[] headers = {"ID", "Nombre", "Correo", "Teléfono", "Cédula", "Rol",
                "Tipo Cliente", "Método Pago", "Estado", "Descripción"};

        for (int i = 0; i < headers.length; i++) {
            org.apache.poi.ss.usermodel.Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(headerStyle);
        }

        CellStyle dataStyle = workbook.createCellStyle();
        dataStyle.setBorderBottom(BorderStyle.THIN);
        dataStyle.setBorderTop(BorderStyle.THIN);
        dataStyle.setBorderLeft(BorderStyle.THIN);
        dataStyle.setBorderRight(BorderStyle.THIN);

        CellStyle alternateStyle = workbook.createCellStyle();
        alternateStyle.cloneStyleFrom(dataStyle);
        alternateStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        alternateStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

        int rowNum = 1;
        for (Usuario usuario : usuarios) {
            Row row = sheet.createRow(rowNum);
            CellStyle styleToUse = (rowNum % 2 == 0) ? alternateStyle : dataStyle;

            createStyledCell(row, 0, usuario.getIdUsuario(), styleToUse);
            createStyledCell(row, 1, usuario.getNombre(), styleToUse);
            createStyledCell(row, 2, usuario.getCorreo(), styleToUse);
            createStyledCell(row, 3, usuario.getTelefono(), styleToUse);
            createStyledCell(row, 4, usuario.getCedula(), styleToUse);
            createStyledCell(row, 5, usuario.getRol() != null ? usuario.getRol().name() : "", styleToUse);
            createStyledCell(row, 6, usuario.getTipoCliente() != null ? usuario.getTipoCliente().name() : "", styleToUse);
            createStyledCell(row, 7, usuario.getMetodoPago() != null ? usuario.getMetodoPago().name() : "", styleToUse);
            createStyledCell(row, 8, usuario.getEstado() != null ? usuario.getEstado().name() : "", styleToUse);
            createStyledCell(row, 9, usuario.getDescripcion(), styleToUse);

            rowNum++;
        }

        // Hoja de estadísticas
        Sheet statsSheet = workbook.createSheet("Estadísticas");
        int statsRow = 0;

        Row titleRow = statsSheet.createRow(statsRow++);
        org.apache.poi.ss.usermodel.Cell titleCell = titleRow.createCell(0);
        titleCell.setCellValue("ESTADÍSTICAS DE USUARIOS");
        titleCell.setCellStyle(headerStyle);

        statsRow++;

        Row totalRow = statsSheet.createRow(statsRow++);
        totalRow.createCell(0).setCellValue("Total de usuarios:");
        totalRow.createCell(1).setCellValue(usuarios.size());

        statsRow++;

        // ✅ CAMBIO 2: Usar método auxiliar en lugar de calcular aquí
        Map<String, Long> stats = calcularEstadisticas(usuarios);

        statsSheet.createRow(statsRow++).createCell(0).setCellValue("Por Rol:");
        statsSheet.createRow(statsRow++).createCell(0).setCellValue("Administradores: " + stats.get("admin"));
        statsSheet.createRow(statsRow++).createCell(0).setCellValue("Clientes: " + stats.get("cliente"));
        statsSheet.createRow(statsRow++).createCell(0).setCellValue("Operadores: " + stats.get("operador"));

        statsRow++;

        statsSheet.createRow(statsRow++).createCell(0).setCellValue("Por Estado:");
        statsSheet.createRow(statsRow++).createCell(0).setCellValue("Activos: " + stats.get("activos"));
        statsSheet.createRow(statsRow++).createCell(0).setCellValue("Inactivos: " + stats.get("inactivos"));

        for (int i = 0; i < headers.length; i++) {
            sheet.autoSizeColumn(i);
        }

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        workbook.write(baos);
        workbook.close();

        return baos;
    }

    // ------------------------- EXCEL SEDES ---------------------------
    // ✅ CAMBIO #5: Implementación del reporte Excel de sedes
    // Antes: generación manual con POI directamente en SedeController.generarExcelSedes()
    // Ahora: centralizado en el Service, el Controller solo descarga el resultado
    @Override
    public ByteArrayOutputStream generarReporteExcelSedes(List<com.exe.AparcaYA.Entity.Sede> sedes) throws Exception {

        Workbook workbook = new XSSFWorkbook();
        Sheet sheet = workbook.createSheet("Mi Sede");

        CellStyle headerStyle = workbook.createCellStyle();
        Font headerFont = workbook.createFont();
        headerFont.setBold(true);
        headerFont.setFontHeightInPoints((short) 12);
        headerFont.setColor(IndexedColors.WHITE.getIndex());
        headerStyle.setFont(headerFont);
        headerStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
        headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        headerStyle.setAlignment(HorizontalAlignment.CENTER);

        Row headerRow = sheet.createRow(0);
        String[] headers = {
                "ID", "Nombre", "Dirección", "Capacidad",
                "Tarifa Plena Carro", "Tarifa Plena Moto",
                "Tarifa Minuto Carro", "Tarifa Minuto Moto", "Estado"
        };
        for (int i = 0; i < headers.length; i++) {
            org.apache.poi.ss.usermodel.Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(headerStyle);
        }

        CellStyle dataStyle = workbook.createCellStyle();
        dataStyle.setBorderBottom(BorderStyle.THIN);
        dataStyle.setBorderTop(BorderStyle.THIN);
        dataStyle.setBorderLeft(BorderStyle.THIN);
        dataStyle.setBorderRight(BorderStyle.THIN);

        CellStyle alternateStyle = workbook.createCellStyle();
        alternateStyle.cloneStyleFrom(dataStyle);
        alternateStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        alternateStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

        int rowNum = 1;
        for (com.exe.AparcaYA.Entity.Sede s : sedes) {
            Row row = sheet.createRow(rowNum);
            CellStyle styleToUse = (rowNum % 2 == 0) ? alternateStyle : dataStyle;

            createStyledCell(row, 0, s.getIdSede(),     styleToUse);
            createStyledCell(row, 1, s.getNombre(),     styleToUse);
            createStyledCell(row, 2, s.getDireccion(),  styleToUse);
            createStyledCell(row, 3, s.getCapacidad() != null ? (long) s.getCapacidad().intValue() : 0L, styleToUse);
            createStyledCell(row, 4, s.getTarifaPlenaC()  != null ? s.getTarifaPlenaC().toString()  : "0", styleToUse);
            createStyledCell(row, 5, s.getTarifaPlenaM()  != null ? s.getTarifaPlenaM().toString()  : "0", styleToUse);
            createStyledCell(row, 6, s.getTarifaMinutoC() != null ? s.getTarifaMinutoC().toString() : "0", styleToUse);
            createStyledCell(row, 7, s.getTarifaMinutoM() != null ? s.getTarifaMinutoM().toString() : "0", styleToUse);
            createStyledCell(row, 8, s.getEstado() != null ? s.getEstado().name() : "", styleToUse);

            rowNum++;
        }

        for (int i = 0; i < headers.length; i++) {
            sheet.autoSizeColumn(i);
        }

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        workbook.write(baos);
        workbook.close();

        return baos;
    }

    // -------- MÉTODO AUXILIAR ----------
    private void createStyledCell(Row row, int column, Object value, CellStyle style) {
        org.apache.poi.ss.usermodel.Cell cell = row.createCell(column);

        if (value instanceof Long) {
            cell.setCellValue((Long) value);
        } else if (value instanceof String) {
            cell.setCellValue((String) value);
        } else if (value != null) {
            cell.setCellValue(value.toString());
        } else {
            cell.setCellValue("");
        }

        cell.setCellStyle(style);
    }
}