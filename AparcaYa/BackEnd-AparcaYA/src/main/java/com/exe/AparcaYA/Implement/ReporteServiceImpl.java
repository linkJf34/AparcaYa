package com.exe.AparcaYA.Implement;

import com.exe.AparcaYA.Entity.RegistroEntradaSalida;
import com.exe.AparcaYA.Entity.Sede;
import com.exe.AparcaYA.Entity.Tarifa;
import com.exe.AparcaYA.Enum.EstadoRegistro;
import com.exe.AparcaYA.Enum.TipoVehiculo;
import com.exe.AparcaYA.Service.TarifaService;

import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.borders.SolidBorder;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;
// VerticalAlignment de iText se referencia con FQN (com.itextpdf.layout.properties.VerticalAlignment)
// para evitar colisión con org.apache.poi.ss.usermodel.VerticalAlignment del import wildcard de POI

import com.exe.AparcaYA.Entity.Usuario;
import com.exe.AparcaYA.Service.ReporteService;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@Service
public class ReporteServiceImpl implements ReporteService {

    // CORRECCIÓN — inyectado para obtener tarifas desde TarifaService
    // (los campos tarifaPlenaC/M, tarifaMinutoC/M ya no existen en Sede)
    @Autowired
    private TarifaService tarifaService;

    // ============================================
    // Método auxiliar extraído para evitar duplicación
    // ============================================
    private Map<String, Long> calcularEstadisticas(List<Usuario> usuarios) {
        long adminCount    = usuarios.stream().filter(u -> u.getRol().name().equals("ADMIN")).count();
        long clienteCount  = usuarios.stream().filter(u -> u.getRol().name().equals("CLIENTE")).count();
        long operadorCount = usuarios.stream().filter(u -> u.getRol().name().equals("OPERARIO")).count();
        long activosCount  = usuarios.stream().filter(u -> u.getEstado().name().equals("ACTIVO")).count();
        long inactivosCount= usuarios.stream().filter(u -> !u.getEstado().name().equals("ACTIVO")).count();

        return Map.of(
                "admin",     adminCount,
                "cliente",   clienteCount,
                "operador",  operadorCount,
                "activos",   activosCount,
                "inactivos", inactivosCount
        );
    }

    // ============================================================
    // COLORES CORPORATIVOS
    // ============================================================
    private static final DeviceRgb PDF_COLOR_HEADER_BG   = new DeviceRgb(30,  58,  95);
    private static final DeviceRgb PDF_COLOR_SECTION_BG  = new DeviceRgb(37,  99, 235);
    private static final DeviceRgb PDF_COLOR_ROW_ALT     = new DeviceRgb(239, 246, 255);
    private static final DeviceRgb PDF_COLOR_ROW_NORMAL  = new DeviceRgb(255, 255, 255);
    private static final DeviceRgb PDF_COLOR_SUCCESS_BG  = new DeviceRgb(209, 250, 229);
    private static final DeviceRgb PDF_COLOR_SUCCESS_TEXT = new DeviceRgb(6,   95,  70);
    private static final DeviceRgb PDF_COLOR_DANGER_BG   = new DeviceRgb(254, 226, 226);
    private static final DeviceRgb PDF_COLOR_DANGER_TEXT  = new DeviceRgb(153,  27,  27);
    private static final DeviceRgb PDF_COLOR_TEXT_MUTED  = new DeviceRgb(100, 116, 139);

    // ----------------------------------------------------------------
    // PDF — REPORTE USUARIOS
    // ----------------------------------------------------------------
    @Override
    public ByteArrayOutputStream generarReportePDF(List<Usuario> usuarios) throws Exception {

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PdfWriter   writer   = new PdfWriter(baos);
        PdfDocument pdf      = new PdfDocument(writer);
        Document    document = new Document(pdf, PageSize.A4.rotate());
        document.setMargins(36, 36, 36, 36);

        // Encabezado
        Table headerBand = new Table(UnitValue.createPercentArray(new float[]{1}))
                .setWidth(UnitValue.createPercentValue(100)).setMarginBottom(4);
        headerBand.addCell(new Cell()
                .add(new Paragraph("REPORTE DE USUARIOS")
                        .setFontSize(20).setBold().setFontColor(ColorConstants.WHITE)
                        .setTextAlignment(TextAlignment.CENTER).setMarginBottom(2))
                .add(new Paragraph("AparcaYA — Sistema de Gestión de Parqueaderos")
                        .setFontSize(9).setFontColor(new DeviceRgb(147, 197, 253))
                        .setTextAlignment(TextAlignment.CENTER))
                .setBackgroundColor(PDF_COLOR_HEADER_BG).setPadding(14)
                .setBorder(com.itextpdf.layout.borders.Border.NO_BORDER));
        document.add(headerBand);

        String fechaActual = LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"));
        document.add(new Paragraph("Generado el: " + fechaActual + "  |  Total registros: " + usuarios.size())
                .setFontSize(8).setFontColor(PDF_COLOR_TEXT_MUTED)
                .setTextAlignment(TextAlignment.RIGHT).setMarginBottom(10));

        // Sección
        Table sectionLabel = new Table(UnitValue.createPercentArray(new float[]{1}))
                .setWidth(UnitValue.createPercentValue(100)).setMarginBottom(0);
        sectionLabel.addCell(new Cell()
                .add(new Paragraph("📋  Listado de Usuarios Registrados")
                        .setFontSize(9).setBold().setFontColor(ColorConstants.WHITE))
                .setBackgroundColor(PDF_COLOR_SECTION_BG)
                .setPaddingTop(5).setPaddingBottom(5).setPaddingLeft(10)
                .setBorder(com.itextpdf.layout.borders.Border.NO_BORDER));
        document.add(sectionLabel);

        // CORRECCIÓN — eliminada columna "Tipo Cliente" (campo borrado de Usuario)
        // ANTES: 8 columnas incluyendo "Tipo Cliente"
        // AHORA: 7 columnas sin "Tipo Cliente"
        float[] columnWidths = {1, 2.5f, 2.5f, 1.5f, 2, 1.5f, 1.2f};
        Table table = new Table(UnitValue.createPercentArray(columnWidths))
                .setWidth(UnitValue.createPercentValue(100))
                .setFontSize(7.5f).setMarginBottom(16);

        String[] headers = {"ID", "Nombre", "Correo", "Teléfono", "Cédula", "Rol", "Estado"};
        for (String header : headers) {
            table.addHeaderCell(new Cell()
                    .add(new Paragraph(header).setBold().setFontSize(8).setFontColor(ColorConstants.WHITE))
                    .setBackgroundColor(PDF_COLOR_HEADER_BG)
                    .setTextAlignment(TextAlignment.CENTER)
                    .setVerticalAlignment(com.itextpdf.layout.properties.VerticalAlignment.MIDDLE)
                    .setPaddingTop(6).setPaddingBottom(6)
                    .setBorderBottom(new SolidBorder(new DeviceRgb(147, 197, 253), 1.5f))
                    .setBorderLeft(new SolidBorder(new DeviceRgb(30, 58, 95), 0.5f))
                    .setBorderRight(new SolidBorder(new DeviceRgb(30, 58, 95), 0.5f))
                    .setBorderTop(com.itextpdf.layout.borders.Border.NO_BORDER));
        }

        int rowIndex = 0;
        for (Usuario usuario : usuarios) {
            DeviceRgb rowBg = (rowIndex % 2 == 0) ? PDF_COLOR_ROW_NORMAL : PDF_COLOR_ROW_ALT;
            SolidBorder cellBorder = new SolidBorder(new DeviceRgb(219, 234, 254), 0.4f);

            String estadoStr = usuario.getEstado() != null ? usuario.getEstado().name() : "";
            DeviceRgb estadoBg   = estadoStr.equals("ACTIVO") ? PDF_COLOR_SUCCESS_BG  : PDF_COLOR_DANGER_BG;
            DeviceRgb estadoText = estadoStr.equals("ACTIVO") ? PDF_COLOR_SUCCESS_TEXT : PDF_COLOR_DANGER_TEXT;

            // CORRECCIÓN — eliminado tipoCliente (ya no existe en Usuario)
            Object[][] cellData = {
                    { String.valueOf(usuario.getIdUsuario()),                           TextAlignment.CENTER },
                    { usuario.getNombre()   != null ? usuario.getNombre()   : "",       TextAlignment.LEFT   },
                    { usuario.getCorreo()   != null ? usuario.getCorreo()   : "",       TextAlignment.LEFT   },
                    { usuario.getTelefono() != null ? usuario.getTelefono() : "",       TextAlignment.CENTER },
                    { usuario.getCedula()   != null ? usuario.getCedula()   : "",       TextAlignment.CENTER },
                    { usuario.getRol()      != null ? usuario.getRol().name(): "",      TextAlignment.CENTER }
            };

            for (Object[] cd : cellData) {
                table.addCell(new Cell()
                        .add(new Paragraph((String) cd[0]).setFontSize(7.5f))
                        .setBackgroundColor(rowBg)
                        .setTextAlignment((TextAlignment) cd[1])
                        .setVerticalAlignment(com.itextpdf.layout.properties.VerticalAlignment.MIDDLE)
                        .setPaddingTop(4).setPaddingBottom(4).setPaddingLeft(5).setPaddingRight(5)
                        .setBorder(cellBorder));
            }

            // Celda Estado con color semántico
            table.addCell(new Cell()
                    .add(new Paragraph(estadoStr).setFontSize(7.5f).setBold().setFontColor(estadoText))
                    .setBackgroundColor(estadoBg)
                    .setTextAlignment(TextAlignment.CENTER)
                    .setVerticalAlignment(com.itextpdf.layout.properties.VerticalAlignment.MIDDLE)
                    .setPaddingTop(4).setPaddingBottom(4).setBorder(cellBorder));

            rowIndex++;
        }
        document.add(table);

        // Estadísticas
        Map<String, Long> stats = calcularEstadisticas(usuarios);

        Table statsLabel = new Table(UnitValue.createPercentArray(new float[]{1}))
                .setWidth(UnitValue.createPercentValue(100)).setMarginBottom(8);
        statsLabel.addCell(new Cell()
                .add(new Paragraph("📊  Estadísticas del Reporte")
                        .setFontSize(9).setBold().setFontColor(ColorConstants.WHITE))
                .setBackgroundColor(PDF_COLOR_SECTION_BG)
                .setPaddingTop(5).setPaddingBottom(5).setPaddingLeft(10)
                .setBorder(com.itextpdf.layout.borders.Border.NO_BORDER));
        document.add(statsLabel);

        Table statsTable = new Table(UnitValue.createPercentArray(new float[]{1, 1, 1}))
                .setWidth(UnitValue.createPercentValue(100)).setFontSize(9).setMarginBottom(8);

        statsTable.addCell(buildStatCell("Total Usuarios",  String.valueOf(usuarios.size()),
                new DeviceRgb(239, 246, 255), new DeviceRgb(30, 58, 95)));
        statsTable.addCell(buildStatCell("Administradores", String.valueOf(stats.get("admin")),
                new DeviceRgb(237, 233, 254), new DeviceRgb(91, 33, 182)));
        statsTable.addCell(buildStatCell("Clientes",        String.valueOf(stats.get("cliente")),
                new DeviceRgb(209, 250, 229), new DeviceRgb(6, 95, 70)));
        statsTable.addCell(buildStatCell("Operarios",       String.valueOf(stats.get("operador")),
                new DeviceRgb(254, 243, 199), new DeviceRgb(146, 64, 14)));
        statsTable.addCell(buildStatCell("Activos ✓",       String.valueOf(stats.get("activos")),
                PDF_COLOR_SUCCESS_BG, PDF_COLOR_SUCCESS_TEXT));
        statsTable.addCell(buildStatCell("Inactivos ✗",     String.valueOf(stats.get("inactivos")),
                PDF_COLOR_DANGER_BG, PDF_COLOR_DANGER_TEXT));

        document.add(statsTable);
        document.close();
        return baos;
    }

    private Cell buildStatCell(String label, String value, DeviceRgb bgColor, DeviceRgb textColor) {
        return new Cell()
                .add(new Paragraph(value).setFontSize(22).setBold().setFontColor(textColor)
                        .setTextAlignment(TextAlignment.CENTER).setMarginBottom(2))
                .add(new Paragraph(label).setFontSize(8).setFontColor(textColor)
                        .setTextAlignment(TextAlignment.CENTER))
                .setBackgroundColor(bgColor).setPadding(12)
                .setBorder(new SolidBorder(new DeviceRgb(226, 232, 240), 0.5f));
    }

    // ----------------------------------------------------------------
    // EXCEL — REPORTE USUARIOS
    // ----------------------------------------------------------------
    @Override
    public ByteArrayOutputStream generarReporteExcel(List<Usuario> usuarios) throws Exception {

        Workbook workbook = new XSSFWorkbook();

        CellStyle headerStyle = workbook.createCellStyle();
        Font headerFont = workbook.createFont();
        headerFont.setBold(true); headerFont.setFontHeightInPoints((short) 11);
        headerFont.setColor(IndexedColors.WHITE.getIndex());
        headerStyle.setFont(headerFont);
        headerStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
        headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        headerStyle.setAlignment(HorizontalAlignment.CENTER);
        headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);
        setBordersStyle(headerStyle, BorderStyle.THIN, IndexedColors.WHITE.getIndex());

        CellStyle titleDocStyle = workbook.createCellStyle();
        Font titleDocFont = workbook.createFont();
        titleDocFont.setBold(true); titleDocFont.setFontHeightInPoints((short) 16);
        titleDocFont.setColor(IndexedColors.WHITE.getIndex());
        titleDocStyle.setFont(titleDocFont);
        titleDocStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
        titleDocStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        titleDocStyle.setAlignment(HorizontalAlignment.CENTER);
        titleDocStyle.setVerticalAlignment(VerticalAlignment.CENTER);

        CellStyle subtitleStyle = workbook.createCellStyle();
        Font subtitleFont = workbook.createFont();
        subtitleFont.setItalic(true); subtitleFont.setFontHeightInPoints((short) 9);
        subtitleFont.setColor(IndexedColors.GREY_50_PERCENT.getIndex());
        subtitleStyle.setFont(subtitleFont);
        subtitleStyle.setAlignment(HorizontalAlignment.RIGHT);

        CellStyle dataStylePar = workbook.createCellStyle();
        dataStylePar.setFillForegroundColor(IndexedColors.WHITE.getIndex());
        dataStylePar.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        setBordersStyle(dataStylePar, BorderStyle.THIN, IndexedColors.PALE_BLUE.getIndex());
        dataStylePar.setVerticalAlignment(VerticalAlignment.CENTER);

        CellStyle dataStyleImpar = workbook.createCellStyle();
        dataStyleImpar.cloneStyleFrom(dataStylePar);
        dataStyleImpar.setFillForegroundColor(IndexedColors.PALE_BLUE.getIndex());
        dataStyleImpar.setFillPattern(FillPatternType.SOLID_FOREGROUND);

        CellStyle activeStyle = workbook.createCellStyle();
        activeStyle.cloneStyleFrom(dataStylePar);
        Font activeFont = workbook.createFont();
        activeFont.setBold(true); activeFont.setColor(IndexedColors.GREEN.getIndex());
        activeStyle.setFont(activeFont);
        activeStyle.setAlignment(HorizontalAlignment.CENTER);

        CellStyle inactiveStyle = workbook.createCellStyle();
        inactiveStyle.cloneStyleFrom(dataStylePar);
        Font inactiveFont = workbook.createFont();
        inactiveFont.setBold(true); inactiveFont.setColor(IndexedColors.RED.getIndex());
        inactiveStyle.setFont(inactiveFont);
        inactiveStyle.setAlignment(HorizontalAlignment.CENTER);

        CellStyle dataCenterPar   = workbook.createCellStyle(); dataCenterPar.cloneStyleFrom(dataStylePar);     dataCenterPar.setAlignment(HorizontalAlignment.CENTER);
        CellStyle dataCenterImpar = workbook.createCellStyle(); dataCenterImpar.cloneStyleFrom(dataStyleImpar); dataCenterImpar.setAlignment(HorizontalAlignment.CENTER);

        Sheet sheet = workbook.createSheet("Usuarios");
        sheet.setDefaultRowHeightInPoints(16);

        Row titleRow = sheet.createRow(0);
        titleRow.setHeightInPoints(36);
        org.apache.poi.ss.usermodel.Cell titleCell = titleRow.createCell(0);
        titleCell.setCellValue("REPORTE DE USUARIOS — AparcaYA");
        titleCell.setCellStyle(titleDocStyle);

        // CORRECCIÓN — ajustado merge a 7 columnas (eliminadas Tipo Cliente y Método Pago)
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 7));

        String fechaStr = LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"));
        Row fechaRow = sheet.createRow(1);
        org.apache.poi.ss.usermodel.Cell fechaCell = fechaRow.createCell(0);
        fechaCell.setCellValue("Generado el: " + fechaStr + "   |   Total: " + usuarios.size() + " usuarios");
        fechaCell.setCellStyle(subtitleStyle);
        sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, 7));

        sheet.createRow(2).setHeightInPoints(6);

        // CORRECCIÓN — eliminadas columnas "Tipo Cliente" y "Método Pago"
        // ANTES: {"ID","Nombre","Correo","Teléfono","Cédula","Rol","Tipo Cliente","Método Pago","Estado","Descripción"}
        // AHORA: {"ID","Nombre","Correo","Teléfono","Cédula","Rol","Estado","Descripción"}
        Row headerRow = sheet.createRow(3);
        headerRow.setHeightInPoints(22);
        String[] headers = {"ID", "Nombre", "Correo", "Teléfono", "Cédula", "Rol", "Estado", "Descripción"};
        for (int i = 0; i < headers.length; i++) {
            org.apache.poi.ss.usermodel.Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(headerStyle);
        }

        int rowNum = 4;
        for (Usuario usuario : usuarios) {
            Row row = sheet.createRow(rowNum);
            boolean esPar = (rowNum % 2 == 0);

            String estadoStr = usuario.getEstado() != null ? usuario.getEstado().name() : "";
            CellStyle estiloEstado = estadoStr.equals("ACTIVO") ? activeStyle : inactiveStyle;

            // CORRECCIÓN — eliminadas celdas de tipoCliente (col 6) y metodoPago (col 7)
            createStyledCell(row, 0, usuario.getIdUsuario(),                                                   esPar ? dataCenterPar : dataCenterImpar);
            createStyledCell(row, 1, usuario.getNombre()    != null ? usuario.getNombre()   : "",              esPar ? dataStylePar  : dataStyleImpar);
            createStyledCell(row, 2, usuario.getCorreo()    != null ? usuario.getCorreo()   : "",              esPar ? dataStylePar  : dataStyleImpar);
            createStyledCell(row, 3, usuario.getTelefono()  != null ? usuario.getTelefono() : "",              esPar ? dataCenterPar : dataCenterImpar);
            createStyledCell(row, 4, usuario.getCedula()    != null ? usuario.getCedula()   : "",              esPar ? dataCenterPar : dataCenterImpar);
            createStyledCell(row, 5, usuario.getRol()       != null ? usuario.getRol().name(): "",             esPar ? dataCenterPar : dataCenterImpar);
            createStyledCell(row, 6, estadoStr,                                                                estiloEstado);
            createStyledCell(row, 7, usuario.getDescripcion() != null ? usuario.getDescripcion() : "",         esPar ? dataStylePar  : dataStyleImpar);

            rowNum++;
        }

        for (int i = 0; i < headers.length; i++) {
            sheet.autoSizeColumn(i);
        }

        // Hoja estadísticas
        Sheet statsSheet = workbook.createSheet("Estadísticas");
        statsSheet.setColumnWidth(0, 8000);
        statsSheet.setColumnWidth(1, 5000);

        Row statsTitleRow = statsSheet.createRow(0);
        statsTitleRow.setHeightInPoints(30);
        org.apache.poi.ss.usermodel.Cell statsTitleCell = statsTitleRow.createCell(0);
        statsTitleCell.setCellValue("ESTADÍSTICAS DE USUARIOS — AparcaYA");
        statsTitleCell.setCellStyle(titleDocStyle);
        statsSheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 1));

        Row statsFechaRow = statsSheet.createRow(1);
        org.apache.poi.ss.usermodel.Cell statsFechaCell = statsFechaRow.createCell(0);
        statsFechaCell.setCellValue("Generado el: " + fechaStr);
        statsFechaCell.setCellStyle(subtitleStyle);
        statsSheet.addMergedRegion(new CellRangeAddress(1, 1, 0, 1));

        int statsRow = 3;
        statsSheet.createRow(statsRow).setHeightInPoints(8); statsRow++;

        addStatsSectionHeader(statsSheet, statsRow++, "TOTALES GENERALES", headerStyle, workbook);
        addStatsDataRow(statsSheet, statsRow++, "Total de usuarios", usuarios.size(), dataCenterPar, dataStylePar);

        statsRow++;
        addStatsSectionHeader(statsSheet, statsRow++, "POR ROL", headerStyle, workbook);

        Map<String, Long> stats = calcularEstadisticas(usuarios);

        addStatsDataRow(statsSheet, statsRow++, "Administradores", stats.get("admin"),    dataCenterPar,   dataStylePar);
        addStatsDataRow(statsSheet, statsRow++, "Clientes",        stats.get("cliente"),  dataCenterImpar, dataStyleImpar);
        // CORRECCIÓN — etiqueta actualizada a "Operarios" para coincidir con el enum OPERARIO
        addStatsDataRow(statsSheet, statsRow++, "Operarios",       stats.get("operador"), dataCenterPar,   dataStylePar);

        statsRow++;
        addStatsSectionHeader(statsSheet, statsRow++, "POR ESTADO", headerStyle, workbook);
        addStatsDataRow(statsSheet, statsRow++, "Activos",   stats.get("activos"),   activeStyle,   dataStylePar);
        addStatsDataRow(statsSheet, statsRow++, "Inactivos", stats.get("inactivos"), inactiveStyle, dataStyleImpar);

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        workbook.write(baos);
        workbook.close();
        return baos;
    }

    // ----------------------------------------------------------------
    // EXCEL — REPORTE SEDES
    // ----------------------------------------------------------------
    @Override
    public ByteArrayOutputStream generarReporteExcelSedes(List<Sede> sedes) throws Exception {

        Workbook workbook = new XSSFWorkbook();
        Sheet sheet = workbook.createSheet("Mi Sede");

        CellStyle headerStyle = workbook.createCellStyle();
        Font headerFont = workbook.createFont();
        headerFont.setBold(true); headerFont.setFontHeightInPoints((short) 11);
        headerFont.setColor(IndexedColors.WHITE.getIndex());
        headerStyle.setFont(headerFont);
        headerStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
        headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        headerStyle.setAlignment(HorizontalAlignment.CENTER);
        headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);

        CellStyle titleStyle = workbook.createCellStyle();
        Font titleFont = workbook.createFont();
        titleFont.setBold(true); titleFont.setFontHeightInPoints((short) 14);
        titleFont.setColor(IndexedColors.WHITE.getIndex());
        titleStyle.setFont(titleFont);
        titleStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
        titleStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        titleStyle.setAlignment(HorizontalAlignment.CENTER);
        titleStyle.setVerticalAlignment(VerticalAlignment.CENTER);

        Row titleRow = sheet.createRow(0);
        titleRow.setHeightInPoints(30);
        org.apache.poi.ss.usermodel.Cell tc = titleRow.createCell(0);
        tc.setCellValue("REPORTE DE SEDES — AparcaYA");
        tc.setCellStyle(titleStyle);

        // CORRECCIÓN — columnas ahora incluyen los campos de bicicleta y hora
        // que antes no existían (estaban en Sede, ahora en Tarifa)
        String[] headers = {
                "ID", "Nombre", "Dirección", "Capacidad",
                "Tarifa Plena Carro", "Tarifa Plena Moto",
                "Tarifa Minuto Carro", "Tarifa Minuto Moto",
                "Tarifa Hora Carro", "Tarifa Hora Moto",
                "Tarifa Plena Bici", "Tarifa Minuto Bici",
                "Estado"
        };
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, headers.length - 1));

        sheet.createRow(1).setHeightInPoints(6);

        Row headerRow = sheet.createRow(2);
        headerRow.setHeightInPoints(20);
        for (int i = 0; i < headers.length; i++) {
            org.apache.poi.ss.usermodel.Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(headerStyle);
        }

        CellStyle dataStyle = workbook.createCellStyle();
        setBordersStyle(dataStyle, BorderStyle.THIN, IndexedColors.PALE_BLUE.getIndex());
        dataStyle.setVerticalAlignment(VerticalAlignment.CENTER);

        CellStyle alternateStyle = workbook.createCellStyle();
        alternateStyle.cloneStyleFrom(dataStyle);
        alternateStyle.setFillForegroundColor(IndexedColors.PALE_BLUE.getIndex());
        alternateStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

        int rowNum = 3;
        for (Sede s : sedes) {

            // CORRECCIÓN — tarifas ya no existen en Sede, se obtienen desde TarifaService
            List<Tarifa> tarifas = tarifaService.findBySede_IdSede(s.getIdSede());
            Tarifa tarifa = tarifas.isEmpty() ? null : tarifas.get(0);

            Row row = sheet.createRow(rowNum);
            row.setHeightInPoints(16);
            CellStyle styleToUse = (rowNum % 2 == 0) ? alternateStyle : dataStyle;

            createStyledCell(row, 0,  s.getIdSede(),   styleToUse);
            createStyledCell(row, 1,  s.getNombre(),   styleToUse);
            createStyledCell(row, 2,  s.getDireccion(), styleToUse);
            createStyledCell(row, 3,  s.getCapacidad() != null ? (long) s.getCapacidad().intValue() : 0L, styleToUse);
            // CORRECCIÓN — valores leídos desde Tarifa, no desde Sede
            createStyledCell(row, 4,  tarifa != null && tarifa.getTarifaPlenaC()  != null ? tarifa.getTarifaPlenaC().toString()  : "0", styleToUse);
            createStyledCell(row, 5,  tarifa != null && tarifa.getTarifaPlenaM()  != null ? tarifa.getTarifaPlenaM().toString()  : "0", styleToUse);
            createStyledCell(row, 6,  tarifa != null && tarifa.getTarifaMinutoC() != null ? tarifa.getTarifaMinutoC().toString() : "0", styleToUse);
            createStyledCell(row, 7,  tarifa != null && tarifa.getTarifaMinutoM() != null ? tarifa.getTarifaMinutoM().toString() : "0", styleToUse);
            createStyledCell(row, 8,  tarifa != null && tarifa.getTarifaHoraC()   != null ? tarifa.getTarifaHoraC().toString()   : "0", styleToUse);
            createStyledCell(row, 9,  tarifa != null && tarifa.getTarifaHoraM()   != null ? tarifa.getTarifaHoraM().toString()   : "0", styleToUse);
            createStyledCell(row, 10, tarifa != null && tarifa.getTarifaPlenaB()  != null ? tarifa.getTarifaPlenaB().toString()  : "0", styleToUse);
            createStyledCell(row, 11, tarifa != null && tarifa.getTarifaMinutoB() != null ? tarifa.getTarifaMinutoB().toString() : "0", styleToUse);
            createStyledCell(row, 12, s.getEstado() != null ? s.getEstado().name() : "", styleToUse);

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

    // ----------------------------------------------------------------
    // PDF — REPORTE ESTADÍSTICO
    // ----------------------------------------------------------------
    @Override
    public ByteArrayOutputStream generarReporteEstadisticoPdf(
            Sede sede,
            String desde,
            String hasta,
            BigDecimal ingresos,
            List<RegistroEntradaSalida> registros) throws Exception {

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PdfWriter   writer   = new PdfWriter(baos);
        PdfDocument pdf      = new PdfDocument(writer);
        Document    document = new Document(pdf, PageSize.A4.rotate());
        document.setMargins(36, 36, 36, 36);

        // Encabezado
        Table headerBand = new Table(UnitValue.createPercentArray(new float[]{1}))
                .setWidth(UnitValue.createPercentValue(100)).setMarginBottom(4);
        headerBand.addCell(new Cell()
                .add(new Paragraph("REPORTE ESTADÍSTICO DE PARQUEADERO")
                        .setFontSize(20).setBold().setFontColor(ColorConstants.WHITE)
                        .setTextAlignment(TextAlignment.CENTER).setMarginBottom(2))
                .add(new Paragraph("Sede: " + sede.getNombre() + "   |   Período: " + desde + " → " + hasta)
                        .setFontSize(9).setFontColor(new DeviceRgb(147, 197, 253))
                        .setTextAlignment(TextAlignment.CENTER))
                .setBackgroundColor(PDF_COLOR_HEADER_BG).setPadding(14)
                .setBorder(com.itextpdf.layout.borders.Border.NO_BORDER));
        document.add(headerBand);

        String fechaGen = LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"));
        document.add(new Paragraph("Generado el: " + fechaGen + "   |   Total registros: " + registros.size())
                .setFontSize(8).setFontColor(PDF_COLOR_TEXT_MUTED)
                .setTextAlignment(TextAlignment.RIGHT).setMarginBottom(10));

        // Métricas — comparación con enum (EstadoRegistro es enum, no String)
        long cobrados   = registros.stream().filter(r -> r.getEstado() == EstadoRegistro.COBRADO).count();
        long pendientes = registros.stream().filter(r -> r.getEstado() == EstadoRegistro.FINALIZADO).count();
        long activos    = registros.stream().filter(r -> r.getEstado() == EstadoRegistro.ACTIVO).count();
        long totalCarros = registros.stream().filter(r -> r.getVehiculo() != null && r.getVehiculo().getTipo() == TipoVehiculo.CARRO).count();
        long totalMotos  = registros.stream().filter(r -> r.getVehiculo() != null && r.getVehiculo().getTipo() == TipoVehiculo.MOTO).count();
        long totalBicis  = registros.stream().filter(r -> r.getVehiculo() != null && r.getVehiculo().getTipo() == TipoVehiculo.BICICLETA).count();

        // Resumen financiero
        document.add(buildSectionLabelEstadistico("💰  Resumen Financiero del Período"));

        Table resumenTable = new Table(UnitValue.createPercentArray(new float[]{1.4f, 1f, 1f, 1f}))
                .setWidth(UnitValue.createPercentValue(100)).setMarginBottom(16);
        resumenTable.addCell(buildStatCell("$ " + formatearMonto(ingresos), "Ingresos Cobrados",
                new DeviceRgb(209, 250, 229), new DeviceRgb(6, 95, 70)));
        resumenTable.addCell(buildStatCell(String.valueOf(cobrados),   "Registros Cobrados",   PDF_COLOR_SUCCESS_BG, PDF_COLOR_SUCCESS_TEXT));
        resumenTable.addCell(buildStatCell(String.valueOf(pendientes), "Pendientes de Cobro",  new DeviceRgb(254, 243, 199), new DeviceRgb(146, 64, 14)));
        resumenTable.addCell(buildStatCell(String.valueOf(activos),    "Vehículos Activos",    new DeviceRgb(239, 246, 255), new DeviceRgb(30, 58, 95)));
        document.add(resumenTable);

        Table tiposTable = new Table(UnitValue.createPercentArray(new float[]{1, 1, 1}))
                .setWidth(UnitValue.createPercentValue(100)).setMarginBottom(16);
        tiposTable.addCell(buildStatCell(String.valueOf(totalCarros), "Carros",     new DeviceRgb(224, 242, 254), new DeviceRgb(3, 105, 161)));
        tiposTable.addCell(buildStatCell(String.valueOf(totalMotos),  "Motos",      new DeviceRgb(237, 233, 254), new DeviceRgb(91, 33, 182)));
        tiposTable.addCell(buildStatCell(String.valueOf(totalBicis),  "Bicicletas", new DeviceRgb(240, 253, 244), new DeviceRgb(22, 101, 52)));
        document.add(tiposTable);

        // Historial
        document.add(buildSectionLabelEstadistico("📋  Historial de Registros — " + desde + " → " + hasta));

        if (registros.isEmpty()) {
            document.add(new Paragraph("No hay registros para el período seleccionado.")
                    .setFontSize(9).setFontColor(PDF_COLOR_TEXT_MUTED)
                    .setMarginTop(8).setMarginBottom(8));
        } else {
            float[] cols = {0.6f, 1.2f, 1f, 1.8f, 1.5f, 1.5f, 0.9f, 1f, 0.9f};
            Table histTable = new Table(UnitValue.createPercentArray(cols))
                    .setWidth(UnitValue.createPercentValue(100)).setFontSize(7f).setMarginBottom(8);

            String[] hdrs = {"ID", "Placa", "Tipo", "Entrada", "Salida", "Tiempo", "Precio", "Método", "Estado"};
            for (String h : hdrs) {
                histTable.addHeaderCell(new Cell()
                        .add(new Paragraph(h).setBold().setFontSize(7.5f).setFontColor(ColorConstants.WHITE))
                        .setBackgroundColor(PDF_COLOR_HEADER_BG)
                        .setTextAlignment(TextAlignment.CENTER)
                        .setVerticalAlignment(com.itextpdf.layout.properties.VerticalAlignment.MIDDLE)
                        .setPaddingTop(5).setPaddingBottom(5)
                        .setBorderBottom(new SolidBorder(new DeviceRgb(147, 197, 253), 1.5f))
                        .setBorderLeft(new SolidBorder(new DeviceRgb(30, 58, 95), 0.4f))
                        .setBorderRight(new SolidBorder(new DeviceRgb(30, 58, 95), 0.4f))
                        .setBorderTop(com.itextpdf.layout.borders.Border.NO_BORDER));
            }

            DateTimeFormatter dtf = DateTimeFormatter.ofPattern("dd/MM/yy HH:mm");
            int idx = 0;
            for (RegistroEntradaSalida r : registros) {
                DeviceRgb rowBg = (idx % 2 == 0) ? PDF_COLOR_ROW_NORMAL : PDF_COLOR_ROW_ALT;
                SolidBorder cb  = new SolidBorder(new DeviceRgb(219, 234, 254), 0.4f);

                String estadoStr = r.getEstado() != null ? r.getEstado().name() : "";

                DeviceRgb eBg  = r.getEstado() == EstadoRegistro.COBRADO
                        ? PDF_COLOR_SUCCESS_BG
                        : r.getEstado() == EstadoRegistro.FINALIZADO
                        ? new DeviceRgb(254, 243, 199)
                        : new DeviceRgb(239, 246, 255);
                DeviceRgb eTxt = r.getEstado() == EstadoRegistro.COBRADO
                        ? PDF_COLOR_SUCCESS_TEXT
                        : r.getEstado() == EstadoRegistro.FINALIZADO
                        ? new DeviceRgb(146, 64, 14)
                        : new DeviceRgb(30, 58, 95);

                String placa   = r.getVehiculo() != null ? r.getVehiculo().getPlaca() : "-";
                String tipo    = (r.getVehiculo() != null && r.getVehiculo().getTipo() != null) ? r.getVehiculo().getTipo().name() : "-";
                String entrada = r.getFechaHoraEntrada() != null ? r.getFechaHoraEntrada().format(dtf) : "-";
                String salida  = r.getFechaHoraSalida()  != null ? r.getFechaHoraSalida().format(dtf)  : "—";
                String tiempo  = calcularTiempoTextoEstadistico(r);

                // CORRECCIÓN — precio y metodoPago ahora se leen desde Pago
                // (r.getPrecio() y r.getMetodoPago() ya no existen en RegistroEntradaSalida)
                String precio = (r.getPago() != null && r.getPago().getMonto() != null)
                        ? "$ " + formatearMonto(BigDecimal.valueOf(r.getPago().getMonto())) : "—";
                String metodo = (r.getPago() != null && r.getPago().getMetodoPago() != null)
                        ? r.getPago().getMetodoPago().toString() : "—";

                Object[][] celdas = {
                        { String.valueOf(r.getIdRegistro()), TextAlignment.CENTER },
                        { placa,   TextAlignment.CENTER },
                        { tipo,    TextAlignment.CENTER },
                        { entrada, TextAlignment.CENTER },
                        { salida,  TextAlignment.CENTER },
                        { tiempo,  TextAlignment.CENTER },
                        { precio,  TextAlignment.RIGHT  },
                        { metodo,  TextAlignment.CENTER }
                };

                for (Object[] cd : celdas) {
                    histTable.addCell(new Cell()
                            .add(new Paragraph((String) cd[0]).setFontSize(7f))
                            .setBackgroundColor(rowBg)
                            .setTextAlignment((TextAlignment) cd[1])
                            .setVerticalAlignment(com.itextpdf.layout.properties.VerticalAlignment.MIDDLE)
                            .setPaddingTop(3).setPaddingBottom(3).setPaddingLeft(4).setPaddingRight(4)
                            .setBorder(cb));
                }

                histTable.addCell(new Cell()
                        .add(new Paragraph(estadoStr).setFontSize(7f).setBold().setFontColor(eTxt))
                        .setBackgroundColor(eBg).setTextAlignment(TextAlignment.CENTER)
                        .setVerticalAlignment(com.itextpdf.layout.properties.VerticalAlignment.MIDDLE)
                        .setPaddingTop(3).setPaddingBottom(3).setBorder(cb));
                idx++;
            }
            document.add(histTable);
        }

        document.close();
        return baos;
    }

    // ----------------------------------------------------------------
    // EXCEL — REPORTE ESTADÍSTICO
    // ----------------------------------------------------------------
    @Override
    public ByteArrayOutputStream generarReporteEstadisticoExcel(
            Sede sede,
            String desde,
            String hasta,
            BigDecimal ingresos,
            List<RegistroEntradaSalida> registros) throws Exception {

        Workbook workbook = new XSSFWorkbook();

        CellStyle titleStyle      = buildExcelEstilo(workbook, (short) 13, true,  IndexedColors.DARK_BLUE, IndexedColors.WHITE, HorizontalAlignment.CENTER);
        CellStyle headerStyle     = buildExcelEstilo(workbook, (short) 10, true,  IndexedColors.DARK_BLUE, IndexedColors.WHITE, HorizontalAlignment.CENTER);
        CellStyle seccionStyle    = buildExcelEstilo(workbook, (short) 9,  true,  IndexedColors.INDIGO,    IndexedColors.WHITE, HorizontalAlignment.LEFT);
        CellStyle dataParStyle    = buildExcelDataEstilo(workbook, false, HorizontalAlignment.LEFT);
        CellStyle dataImparStyle  = buildExcelDataEstilo(workbook, true,  HorizontalAlignment.LEFT);
        CellStyle centroParStyle  = buildExcelDataEstilo(workbook, false, HorizontalAlignment.CENTER);
        CellStyle centroImparStyle= buildExcelDataEstilo(workbook, true,  HorizontalAlignment.CENTER);
        CellStyle successStyle    = buildExcelColorStyle(workbook, IndexedColors.GREEN);
        CellStyle warningStyle    = buildExcelColorStyle(workbook, IndexedColors.DARK_YELLOW);
        CellStyle infoStyle       = buildExcelColorStyle(workbook, IndexedColors.DARK_BLUE);
        CellStyle moneyStyle      = buildExcelMoneyEstilo(workbook);

        // Hoja resumen
        Sheet resumen = workbook.createSheet("Resumen");
        resumen.setColumnWidth(0, 9000);
        resumen.setColumnWidth(1, 5500);

        Row tRow = resumen.createRow(0); tRow.setHeightInPoints(28);
        org.apache.poi.ss.usermodel.Cell tCell = tRow.createCell(0);
        tCell.setCellValue("REPORTE ESTADÍSTICO — " + sede.getNombre().toUpperCase());
        tCell.setCellStyle(titleStyle);
        resumen.addMergedRegion(new CellRangeAddress(0, 0, 0, 1));

        Row pRow = resumen.createRow(1); pRow.setHeightInPoints(15);
        org.apache.poi.ss.usermodel.Cell pCell = pRow.createCell(0);
        pCell.setCellValue("Período: " + desde + " → " + hasta + "   |   Generado: "
                + LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")));
        CellStyle subStyle = workbook.createCellStyle();
        Font subFont = workbook.createFont();
        subFont.setItalic(true); subFont.setFontHeightInPoints((short) 9);
        subFont.setColor(IndexedColors.GREY_50_PERCENT.getIndex());
        subStyle.setFont(subFont); subStyle.setAlignment(HorizontalAlignment.LEFT);
        pCell.setCellStyle(subStyle);
        resumen.addMergedRegion(new CellRangeAddress(1, 1, 0, 1));

        resumen.createRow(2).setHeightInPoints(6);

        // Métricas
        long cobrados   = registros.stream().filter(r -> r.getEstado() == EstadoRegistro.COBRADO).count();
        long pendientes = registros.stream().filter(r -> r.getEstado() == EstadoRegistro.FINALIZADO).count();
        long activos    = registros.stream().filter(r -> r.getEstado() == EstadoRegistro.ACTIVO).count();
        long totalCarros = registros.stream().filter(r -> r.getVehiculo() != null && r.getVehiculo().getTipo() == TipoVehiculo.CARRO).count();
        long totalMotos  = registros.stream().filter(r -> r.getVehiculo() != null && r.getVehiculo().getTipo() == TipoVehiculo.MOTO).count();
        long totalBicis  = registros.stream().filter(r -> r.getVehiculo() != null && r.getVehiculo().getTipo() == TipoVehiculo.BICICLETA).count();

        int sRow = 3;
        addExcelSeccionHeader(resumen, sRow++, "RESUMEN FINANCIERO", seccionStyle, workbook);
        addExcelDataFila(resumen, sRow++, "Ingresos totales cobrados",  "$ " + formatearMonto(ingresos), moneyStyle,      dataParStyle);
        addExcelDataFila(resumen, sRow++, "Registros cobrados",         cobrados,                        successStyle,    dataImparStyle);
        addExcelDataFila(resumen, sRow++, "Pendientes de cobro",        pendientes,                      warningStyle,    dataParStyle);
        addExcelDataFila(resumen, sRow++, "Vehículos aún activos",      activos,                         infoStyle,       dataImparStyle);
        addExcelDataFila(resumen, sRow++, "Total registros del período",(long) registros.size(),         centroParStyle,  dataParStyle);

        sRow++;
        addExcelSeccionHeader(resumen, sRow++, "POR TIPO DE VEHÍCULO", seccionStyle, workbook);
        addExcelDataFila(resumen, sRow++, "Carros",     totalCarros, centroParStyle,   dataParStyle);
        addExcelDataFila(resumen, sRow++, "Motos",      totalMotos,  centroImparStyle, dataImparStyle);
        addExcelDataFila(resumen, sRow++, "Bicicletas", totalBicis,  centroParStyle,   dataParStyle);

        sRow++;
        addExcelSeccionHeader(resumen, sRow++, "INFORMACIÓN DE LA SEDE", seccionStyle, workbook);
        addExcelDataFila(resumen, sRow++, "Nombre",    sede.getNombre(),    dataParStyle,   dataParStyle);
        addExcelDataFila(resumen, sRow++, "Dirección", sede.getDireccion(), dataImparStyle, dataImparStyle);
        addExcelDataFila(resumen, sRow++, "Capacidad",
                sede.getCapacidad() != null ? (long) sede.getCapacidad() : 0L,
                centroParStyle, dataParStyle);

        // Hoja registros
        Sheet regSheet = workbook.createSheet("Registros");

        Row rTitleRow = regSheet.createRow(0); rTitleRow.setHeightInPoints(26);
        org.apache.poi.ss.usermodel.Cell rTitleCell = rTitleRow.createCell(0);
        rTitleCell.setCellValue("HISTORIAL DE REGISTROS — " + desde + " → " + hasta);
        rTitleCell.setCellStyle(buildExcelEstilo(workbook, (short) 11, true,
                IndexedColors.DARK_BLUE, IndexedColors.WHITE, HorizontalAlignment.CENTER));
        regSheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 8));

        regSheet.createRow(1).setHeightInPoints(6);

        Row rh = regSheet.createRow(2); rh.setHeightInPoints(20);
        String[] regHdrs = {"ID Registro", "Placa", "Tipo Vehículo",
                "Fecha Entrada", "Fecha Salida",
                "Tiempo Total", "Precio", "Método Pago", "Estado"};
        for (int i = 0; i < regHdrs.length; i++) {
            org.apache.poi.ss.usermodel.Cell c = rh.createCell(i);
            c.setCellValue(regHdrs[i]); c.setCellStyle(headerStyle);
        }

        DateTimeFormatter dtf = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
        int rn = 3;
        for (RegistroEntradaSalida r : registros) {
            Row row = regSheet.createRow(rn);
            boolean esPar = (rn % 2 == 0);
            CellStyle cs  = esPar ? dataParStyle   : dataImparStyle;
            CellStyle ccs = esPar ? centroParStyle : centroImparStyle;

            CellStyle estadoStyle = r.getEstado() == EstadoRegistro.COBRADO    ? successStyle :
                    r.getEstado() == EstadoRegistro.FINALIZADO  ? warningStyle : infoStyle;

            String estadoStr = r.getEstado() != null ? r.getEstado().name() : "";
            String tipoStr   = (r.getVehiculo() != null && r.getVehiculo().getTipo() != null)
                    ? r.getVehiculo().getTipo().name() : "-";

            // CORRECCIÓN — precio y metodoPago ahora se leen desde Pago
            // (r.getPrecio() y r.getMetodoPago() ya no existen en RegistroEntradaSalida)
            String metodoPagoStr = (r.getPago() != null && r.getPago().getMetodoPago() != null)
                    ? r.getPago().getMetodoPago().toString() : "—";
            String precioStr = (r.getPago() != null && r.getPago().getMonto() != null)
                    ? "$ " + formatearMonto(BigDecimal.valueOf(r.getPago().getMonto())) : "—";

            createStyledCell(row, 0, r.getIdRegistro(),                                                     ccs);
            createStyledCell(row, 1, r.getVehiculo() != null ? r.getVehiculo().getPlaca() : "-",            ccs);
            createStyledCell(row, 2, tipoStr,                                                                ccs);
            createStyledCell(row, 3, r.getFechaHoraEntrada() != null ? r.getFechaHoraEntrada().format(dtf) : "-", cs);
            createStyledCell(row, 4, r.getFechaHoraSalida()  != null ? r.getFechaHoraSalida().format(dtf)  : "—", cs);
            createStyledCell(row, 5, calcularTiempoTextoEstadistico(r),                                      ccs);
            createStyledCell(row, 6, precioStr,                                                              moneyStyle);
            createStyledCell(row, 7, metodoPagoStr,                                                          ccs);
            createStyledCell(row, 8, estadoStr,                                                              estadoStyle);
            rn++;
        }

        for (int i = 0; i < regHdrs.length; i++) {
            regSheet.autoSizeColumn(i);
        }

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        workbook.write(baos);
        workbook.close();
        return baos;
    }

    // ----------------------------------------------------------------
    // MÉTODOS PRIVADOS DE APOYO
    // ----------------------------------------------------------------

    private String formatearMonto(BigDecimal monto) {
        if (monto == null) return "0";
        return String.format("%,.0f", monto.doubleValue());
    }

    private String calcularTiempoTextoEstadistico(RegistroEntradaSalida r) {
        if (r.getFechaHoraEntrada() == null) return "—";
        LocalDateTime fin = r.getFechaHoraSalida() != null ? r.getFechaHoraSalida() : LocalDateTime.now();
        Duration d = Duration.between(r.getFechaHoraEntrada(), fin);
        long h = d.toHours(), m = d.toMinutes() % 60, s = d.getSeconds() % 60;
        if (h > 0) return h + "h " + m + "m";
        if (m > 0) return m + "m " + s + "s";
        return s + "s";
    }

    private Table buildSectionLabelEstadistico(String texto) {
        Table t = new Table(UnitValue.createPercentArray(new float[]{1}))
                .setWidth(UnitValue.createPercentValue(100))
                .setMarginBottom(6).setMarginTop(4);
        t.addCell(new Cell()
                .add(new Paragraph(texto).setFontSize(9).setBold().setFontColor(ColorConstants.WHITE))
                .setBackgroundColor(PDF_COLOR_SECTION_BG)
                .setPaddingTop(5).setPaddingBottom(5).setPaddingLeft(10)
                .setBorder(com.itextpdf.layout.borders.Border.NO_BORDER));
        return t;
    }

    private void addStatsSectionHeader(Sheet sheet, int rowIndex, String text,
                                       CellStyle style, Workbook workbook) {
        Row row = sheet.createRow(rowIndex); row.setHeightInPoints(18);
        org.apache.poi.ss.usermodel.Cell c0 = row.createCell(0);
        c0.setCellValue(text); c0.setCellStyle(style);
        org.apache.poi.ss.usermodel.Cell c1 = row.createCell(1); c1.setCellStyle(style);
        sheet.addMergedRegion(new CellRangeAddress(rowIndex, rowIndex, 0, 1));
    }

    private void addStatsDataRow(Sheet sheet, int rowIndex, String label, Object value,
                                 CellStyle numStyle, CellStyle labelStyle) {
        Row row = sheet.createRow(rowIndex); row.setHeightInPoints(16);
        org.apache.poi.ss.usermodel.Cell labelCell = row.createCell(0);
        labelCell.setCellValue(label); labelCell.setCellStyle(labelStyle);
        org.apache.poi.ss.usermodel.Cell valCell = row.createCell(1);
        if (value instanceof Long)         valCell.setCellValue((Long) value);
        else if (value instanceof Integer) valCell.setCellValue((Integer) value);
        else                               valCell.setCellValue(value != null ? value.toString() : "");
        valCell.setCellStyle(numStyle);
    }

    private void setBordersStyle(CellStyle style, BorderStyle bs, short color) {
        style.setBorderTop(bs);    style.setTopBorderColor(color);
        style.setBorderBottom(bs); style.setBottomBorderColor(color);
        style.setBorderLeft(bs);   style.setLeftBorderColor(color);
        style.setBorderRight(bs);  style.setRightBorderColor(color);
    }

    private CellStyle buildExcelEstilo(Workbook wb, short fontSize, boolean bold,
                                       IndexedColors bgColor, IndexedColors fontColor, HorizontalAlignment align) {
        CellStyle s = wb.createCellStyle();
        Font f = wb.createFont(); f.setBold(bold); f.setFontHeightInPoints(fontSize);
        f.setColor(fontColor.getIndex()); s.setFont(f);
        s.setFillForegroundColor(bgColor.getIndex()); s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        s.setAlignment(align); s.setVerticalAlignment(VerticalAlignment.CENTER);
        setBordersStyle(s, BorderStyle.THIN, IndexedColors.WHITE.getIndex());
        return s;
    }

    private CellStyle buildExcelDataEstilo(Workbook wb, boolean alternate, HorizontalAlignment align) {
        CellStyle s = wb.createCellStyle();
        if (alternate) {
            s.setFillForegroundColor(IndexedColors.PALE_BLUE.getIndex());
            s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        }
        setBordersStyle(s, BorderStyle.THIN, IndexedColors.PALE_BLUE.getIndex());
        s.setVerticalAlignment(VerticalAlignment.CENTER); s.setAlignment(align);
        return s;
    }

    private CellStyle buildExcelColorStyle(Workbook wb, IndexedColors color) {
        CellStyle s = wb.createCellStyle();
        Font f = wb.createFont(); f.setBold(true); f.setColor(color.getIndex()); s.setFont(f);
        s.setAlignment(HorizontalAlignment.CENTER);
        setBordersStyle(s, BorderStyle.THIN, IndexedColors.PALE_BLUE.getIndex());
        s.setVerticalAlignment(VerticalAlignment.CENTER);
        return s;
    }

    private CellStyle buildExcelMoneyEstilo(Workbook wb) {
        CellStyle s = wb.createCellStyle();
        Font f = wb.createFont(); f.setBold(true); f.setColor(IndexedColors.GREEN.getIndex()); s.setFont(f);
        s.setAlignment(HorizontalAlignment.RIGHT);
        setBordersStyle(s, BorderStyle.THIN, IndexedColors.PALE_BLUE.getIndex());
        s.setVerticalAlignment(VerticalAlignment.CENTER);
        return s;
    }

    private void addExcelSeccionHeader(Sheet sheet, int rowIndex, String texto,
                                       CellStyle style, Workbook wb) {
        Row row = sheet.createRow(rowIndex); row.setHeightInPoints(18);
        org.apache.poi.ss.usermodel.Cell c0 = row.createCell(0);
        c0.setCellValue(texto); c0.setCellStyle(style);
        org.apache.poi.ss.usermodel.Cell c1 = row.createCell(1); c1.setCellStyle(style);
        sheet.addMergedRegion(new CellRangeAddress(rowIndex, rowIndex, 0, 1));
    }

    private void addExcelDataFila(Sheet sheet, int rowIndex, String label,
                                  Object value, CellStyle valueStyle, CellStyle labelStyle) {
        Row row = sheet.createRow(rowIndex); row.setHeightInPoints(16);
        org.apache.poi.ss.usermodel.Cell lc = row.createCell(0);
        lc.setCellValue(label); lc.setCellStyle(labelStyle);
        org.apache.poi.ss.usermodel.Cell vc = row.createCell(1);
        if (value instanceof Long)         vc.setCellValue((Long) value);
        else if (value instanceof Integer) vc.setCellValue((Integer) value);
        else                               vc.setCellValue(value != null ? value.toString() : "");
        vc.setCellStyle(valueStyle);
    }

    private void createStyledCell(Row row, int column, Object value, CellStyle style) {
        org.apache.poi.ss.usermodel.Cell cell = row.createCell(column);
        if (value instanceof Long)         cell.setCellValue((Long) value);
        else if (value instanceof String)  cell.setCellValue((String) value);
        else if (value != null)            cell.setCellValue(value.toString());
        else                               cell.setCellValue("");
        cell.setCellStyle(style);
    }
}