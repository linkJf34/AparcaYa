package com.exe.AparcaYA.Implement;

import com.exe.AparcaYA.Entity.RegistroEntradaSalida;
import com.exe.AparcaYA.Entity.Sede;
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

import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
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

    // ============================================================
    // COLORES CORPORATIVOS — reutilizados en PDF y Excel
    // ✅ Definidos una sola vez para coherencia visual entre formatos
    // ============================================================
    // Azul corporativo oscuro  → headers principales
    private static final DeviceRgb PDF_COLOR_HEADER_BG   = new DeviceRgb(30,  58,  95);
    // Azul medio               → headers de secciones
    private static final DeviceRgb PDF_COLOR_SECTION_BG  = new DeviceRgb(37,  99, 235);
    // Azul claro               → filas alternas
    private static final DeviceRgb PDF_COLOR_ROW_ALT     = new DeviceRgb(239, 246, 255);
    // Blanco puro              → filas normales
    private static final DeviceRgb PDF_COLOR_ROW_NORMAL  = new DeviceRgb(255, 255, 255);
    // Verde éxito              → estadísticas activos
    private static final DeviceRgb PDF_COLOR_SUCCESS_BG  = new DeviceRgb(209, 250, 229);
    private static final DeviceRgb PDF_COLOR_SUCCESS_TEXT = new DeviceRgb(6,   95,  70);
    // Rojo suave               → estadísticas inactivos
    private static final DeviceRgb PDF_COLOR_DANGER_BG   = new DeviceRgb(254, 226, 226);
    private static final DeviceRgb PDF_COLOR_DANGER_TEXT  = new DeviceRgb(153,  27,  27);
    // Gris texto secundario
    private static final DeviceRgb PDF_COLOR_TEXT_MUTED  = new DeviceRgb(100, 116, 139);

    // ------------------------- PDF -------------------------------
    @Override
    public ByteArrayOutputStream generarReportePDF(List<Usuario> usuarios) throws Exception {

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PdfWriter   writer   = new PdfWriter(baos);
        PdfDocument pdf      = new PdfDocument(writer);

        // ✅ MEJORA VISUAL: márgenes explícitos (36pt = 0.5", más profesional que el default)
        Document document = new Document(pdf, PageSize.A4.rotate());
        document.setMargins(36, 36, 36, 36);

        // ── ENCABEZADO DEL DOCUMENTO ────────────────────────────────────────
        // ✅ MEJORA VISUAL: banda de color completa como header, no solo texto plano
        Table headerBand = new Table(UnitValue.createPercentArray(new float[]{1}))
                .setWidth(UnitValue.createPercentValue(100))
                .setMarginBottom(4);
        Cell headerCell = new Cell()
                .add(new Paragraph("REPORTE DE USUARIOS")
                        .setFontSize(20)
                        .setBold()
                        .setFontColor(ColorConstants.WHITE)
                        .setTextAlignment(TextAlignment.CENTER)
                        .setMarginBottom(2))
                .add(new Paragraph("AparcaYA — Sistema de Gestión de Parqueaderos")
                        .setFontSize(9)
                        .setFontColor(new DeviceRgb(147, 197, 253))
                        .setTextAlignment(TextAlignment.CENTER))
                .setBackgroundColor(PDF_COLOR_HEADER_BG)
                .setPadding(14)
                .setBorder(com.itextpdf.layout.borders.Border.NO_BORDER);
        headerBand.addCell(headerCell);
        document.add(headerBand);

        // ✅ MEJORA VISUAL: fecha alineada a la derecha con color muted
        String fechaActual = LocalDateTime.now()
                .format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"));
        document.add(new Paragraph("Generado el: " + fechaActual + "  |  Total registros: " + usuarios.size())
                .setFontSize(8)
                .setFontColor(PDF_COLOR_TEXT_MUTED)
                .setTextAlignment(TextAlignment.RIGHT)
                .setMarginBottom(10));

        // ── TÍTULO DE SECCIÓN — TABLA DE USUARIOS ───────────────────────────
        // ✅ MEJORA VISUAL: separador de sección con fondo azul medio
        Table sectionLabel = new Table(UnitValue.createPercentArray(new float[]{1}))
                .setWidth(UnitValue.createPercentValue(100))
                .setMarginBottom(0);
        sectionLabel.addCell(new Cell()
                .add(new Paragraph("📋  Listado de Usuarios Registrados")
                        .setFontSize(9)
                        .setBold()
                        .setFontColor(ColorConstants.WHITE))
                .setBackgroundColor(PDF_COLOR_SECTION_BG)
                .setPaddingTop(5).setPaddingBottom(5).setPaddingLeft(10)
                .setBorder(com.itextpdf.layout.borders.Border.NO_BORDER));
        document.add(sectionLabel);

        // ── TABLA PRINCIPAL ─────────────────────────────────────────────────
        float[] columnWidths = {1, 2.5f, 2.5f, 1.5f, 2, 1.5f, 1.5f, 1.2f};
        Table table = new Table(UnitValue.createPercentArray(columnWidths))
                .setWidth(UnitValue.createPercentValue(100))
                .setFontSize(7.5f)
                .setMarginBottom(16);

        // ✅ MEJORA VISUAL: headers con padding adecuado y borde inferior destacado
        String[] headers = {"ID", "Nombre", "Correo", "Teléfono", "Cédula", "Rol", "Tipo Cliente", "Estado"};
        for (String header : headers) {
            table.addHeaderCell(new Cell()
                    .add(new Paragraph(header)
                            .setBold()
                            .setFontSize(8)
                            .setFontColor(ColorConstants.WHITE))
                    .setBackgroundColor(PDF_COLOR_HEADER_BG)
                    .setTextAlignment(TextAlignment.CENTER)
                    .setVerticalAlignment(com.itextpdf.layout.properties.VerticalAlignment.MIDDLE)
                    .setPaddingTop(6).setPaddingBottom(6)
                    .setBorderBottom(new SolidBorder(new DeviceRgb(147, 197, 253), 1.5f))
                    .setBorderLeft(new SolidBorder(new DeviceRgb(30, 58, 95), 0.5f))
                    .setBorderRight(new SolidBorder(new DeviceRgb(30, 58, 95), 0.5f))
                    .setBorderTop(com.itextpdf.layout.borders.Border.NO_BORDER));
        }

        // ✅ MEJORA VISUAL: filas alternas con color, padding cómodo en celdas
        int rowIndex = 0;
        for (Usuario usuario : usuarios) {
            DeviceRgb rowBg = (rowIndex % 2 == 0) ? PDF_COLOR_ROW_NORMAL : PDF_COLOR_ROW_ALT;
            SolidBorder cellBorder = new SolidBorder(new DeviceRgb(219, 234, 254), 0.4f);

            String estadoStr = usuario.getEstado() != null ? usuario.getEstado().name() : "";
            DeviceRgb estadoBg   = estadoStr.equals("ACTIVO") ? PDF_COLOR_SUCCESS_BG  : PDF_COLOR_DANGER_BG;
            DeviceRgb estadoText = estadoStr.equals("ACTIVO") ? PDF_COLOR_SUCCESS_TEXT : PDF_COLOR_DANGER_TEXT;

            // Celdas de datos — lógica de obtención de valores SIN CAMBIOS
            Object[][] cellData = {
                    { String.valueOf(usuario.getIdUsuario()),                               TextAlignment.CENTER },
                    { usuario.getNombre()      != null ? usuario.getNombre()      : "",     TextAlignment.LEFT   },
                    { usuario.getCorreo()      != null ? usuario.getCorreo()      : "",     TextAlignment.LEFT   },
                    { usuario.getTelefono()    != null ? usuario.getTelefono()    : "",     TextAlignment.CENTER },
                    { usuario.getCedula()      != null ? usuario.getCedula()      : "",     TextAlignment.CENTER },
                    { usuario.getRol()         != null ? usuario.getRol().name()  : "",     TextAlignment.CENTER },
                    { usuario.getTipoCliente() != null ? usuario.getTipoCliente().name() : "", TextAlignment.CENTER }
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

            // ✅ MEJORA VISUAL: celda Estado con color semántico (verde/rojo)
            table.addCell(new Cell()
                    .add(new Paragraph(estadoStr)
                            .setFontSize(7.5f)
                            .setBold()
                            .setFontColor(estadoText))
                    .setBackgroundColor(estadoBg)
                    .setTextAlignment(TextAlignment.CENTER)
                    .setVerticalAlignment(com.itextpdf.layout.properties.VerticalAlignment.MIDDLE)
                    .setPaddingTop(4).setPaddingBottom(4)
                    .setBorder(cellBorder));

            rowIndex++;
        }

        document.add(table);

        // ── SECCIÓN ESTADÍSTICAS ─────────────────────────────────────────────
        // ✅ MEJORA VISUAL: bloque de estadísticas con cards visuales, no solo texto plano
        Map<String, Long> stats = calcularEstadisticas(usuarios);  // lógica SIN CAMBIOS

        // Separador de sección
        Table statsLabel = new Table(UnitValue.createPercentArray(new float[]{1}))
                .setWidth(UnitValue.createPercentValue(100))
                .setMarginBottom(8);
        statsLabel.addCell(new Cell()
                .add(new Paragraph("📊  Estadísticas del Reporte")
                        .setFontSize(9).setBold().setFontColor(ColorConstants.WHITE))
                .setBackgroundColor(PDF_COLOR_SECTION_BG)
                .setPaddingTop(5).setPaddingBottom(5).setPaddingLeft(10)
                .setBorder(com.itextpdf.layout.borders.Border.NO_BORDER));
        document.add(statsLabel);

        // ✅ MEJORA VISUAL: estadísticas en tabla de 3 columnas con cards
        Table statsTable = new Table(UnitValue.createPercentArray(new float[]{1, 1, 1}))
                .setWidth(UnitValue.createPercentValue(100))
                .setFontSize(9)
                .setMarginBottom(8);

        // Fila 1 — Totales por rol
        statsTable.addCell(buildStatCell("Total Usuarios",   String.valueOf(usuarios.size()),
                new DeviceRgb(239, 246, 255), new DeviceRgb(30, 58, 95)));
        statsTable.addCell(buildStatCell("Administradores",  String.valueOf(stats.get("admin")),
                new DeviceRgb(237, 233, 254), new DeviceRgb(91, 33, 182)));
        statsTable.addCell(buildStatCell("Clientes",         String.valueOf(stats.get("cliente")),
                new DeviceRgb(209, 250, 229), new DeviceRgb(6, 95, 70)));

        // Fila 2 — Operadores y estados
        statsTable.addCell(buildStatCell("Operadores",       String.valueOf(stats.get("operador")),
                new DeviceRgb(254, 243, 199), new DeviceRgb(146, 64, 14)));
        statsTable.addCell(buildStatCell("Activos ✓",        String.valueOf(stats.get("activos")),
                PDF_COLOR_SUCCESS_BG, PDF_COLOR_SUCCESS_TEXT));
        statsTable.addCell(buildStatCell("Inactivos ✗",      String.valueOf(stats.get("inactivos")),
                PDF_COLOR_DANGER_BG, PDF_COLOR_DANGER_TEXT));

        document.add(statsTable);

        document.close();
        return baos;
    }

    /**
     * ✅ MEJORA VISUAL: método auxiliar para construir "cards" de estadísticas en el PDF.
     * No forma parte de la lógica de negocio — solo presentación.
     */
    private Cell buildStatCell(String label, String value, DeviceRgb bgColor, DeviceRgb textColor) {
        return new Cell()
                .add(new Paragraph(value)
                        .setFontSize(22)
                        .setBold()
                        .setFontColor(textColor)
                        .setTextAlignment(TextAlignment.CENTER)
                        .setMarginBottom(2))
                .add(new Paragraph(label)
                        .setFontSize(8)
                        .setFontColor(textColor)
                        .setTextAlignment(TextAlignment.CENTER))
                .setBackgroundColor(bgColor)
                .setPadding(12)
                .setBorder(new SolidBorder(new DeviceRgb(226, 232, 240), 0.5f));
    }

    // ------------------------- EXCEL — REPORTES USUARIOS --------------------
    @Override
    public ByteArrayOutputStream generarReporteExcel(List<Usuario> usuarios) throws Exception {

        Workbook workbook = new XSSFWorkbook();

        // ── ESTILOS REUTILIZABLES ─────────────────────────────────────────
        // ✅ MEJORA VISUAL: paleta centralizada, consistente con el PDF

        // Header principal — azul corporativo oscuro
        CellStyle headerStyle = workbook.createCellStyle();
        Font headerFont = workbook.createFont();
        headerFont.setBold(true);
        headerFont.setFontHeightInPoints((short) 11);
        headerFont.setColor(IndexedColors.WHITE.getIndex());
        headerStyle.setFont(headerFont);
        headerStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
        headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        headerStyle.setAlignment(HorizontalAlignment.CENTER);
        headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);
        setBordersStyle(headerStyle, BorderStyle.THIN, IndexedColors.WHITE.getIndex());

        // Título del documento — encabezado superior
        CellStyle titleDocStyle = workbook.createCellStyle();
        Font titleDocFont = workbook.createFont();
        titleDocFont.setBold(true);
        titleDocFont.setFontHeightInPoints((short) 16);
        titleDocFont.setColor(IndexedColors.WHITE.getIndex());
        titleDocStyle.setFont(titleDocFont);
        titleDocStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
        titleDocStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        titleDocStyle.setAlignment(HorizontalAlignment.CENTER);
        titleDocStyle.setVerticalAlignment(VerticalAlignment.CENTER);

        // Subtítulo — fecha de generación
        CellStyle subtitleStyle = workbook.createCellStyle();
        Font subtitleFont = workbook.createFont();
        subtitleFont.setItalic(true);
        subtitleFont.setFontHeightInPoints((short) 9);
        subtitleFont.setColor(IndexedColors.GREY_50_PERCENT.getIndex());
        subtitleStyle.setFont(subtitleFont);
        subtitleStyle.setAlignment(HorizontalAlignment.RIGHT);

        // Fila normal par — blanco
        CellStyle dataStylePar = workbook.createCellStyle();
        dataStylePar.setFillForegroundColor(IndexedColors.WHITE.getIndex());
        dataStylePar.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        setBordersStyle(dataStylePar, BorderStyle.THIN, IndexedColors.PALE_BLUE.getIndex());
        dataStylePar.setVerticalAlignment(VerticalAlignment.CENTER);

        // Fila normal impar — azul muy claro
        CellStyle dataStyleImpar = workbook.createCellStyle();
        dataStyleImpar.cloneStyleFrom(dataStylePar);
        dataStyleImpar.setFillForegroundColor(IndexedColors.PALE_BLUE.getIndex());
        dataStyleImpar.setFillPattern(FillPatternType.SOLID_FOREGROUND);

        // Estado ACTIVO — verde claro
        CellStyle activeStyle = workbook.createCellStyle();
        activeStyle.cloneStyleFrom(dataStylePar);
        Font activeFont = workbook.createFont();
        activeFont.setBold(true);
        activeFont.setColor(IndexedColors.GREEN.getIndex());
        activeStyle.setFont(activeFont);
        activeStyle.setAlignment(HorizontalAlignment.CENTER);

        // Estado INACTIVO — rojo claro
        CellStyle inactiveStyle = workbook.createCellStyle();
        inactiveStyle.cloneStyleFrom(dataStylePar);
        Font inactiveFont = workbook.createFont();
        inactiveFont.setBold(true);
        inactiveFont.setColor(IndexedColors.RED.getIndex());
        inactiveStyle.setFont(inactiveFont);
        inactiveStyle.setAlignment(HorizontalAlignment.CENTER);

        // Centro genérico (para ID, Teléfono, Cédula, Rol, Tipo, Estado)
        CellStyle dataCenterPar   = workbook.createCellStyle(); dataCenterPar.cloneStyleFrom(dataStylePar);     dataCenterPar.setAlignment(HorizontalAlignment.CENTER);
        CellStyle dataCenterImpar = workbook.createCellStyle(); dataCenterImpar.cloneStyleFrom(dataStyleImpar); dataCenterImpar.setAlignment(HorizontalAlignment.CENTER);

        // ── HOJA PRINCIPAL: Usuarios ─────────────────────────────────────
        Sheet sheet = workbook.createSheet("Usuarios");
        sheet.setDefaultRowHeightInPoints(16);

        // Fila 0 — Título del documento
        Row titleRow = sheet.createRow(0);
        titleRow.setHeightInPoints(36);
        org.apache.poi.ss.usermodel.Cell titleCell = titleRow.createCell(0);
        titleCell.setCellValue("REPORTE DE USUARIOS — AparcaYA");
        titleCell.setCellStyle(titleDocStyle);
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 9));

        // Fila 1 — Fecha de generación
        String fechaStr = LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"));
        Row fechaRow = sheet.createRow(1);
        org.apache.poi.ss.usermodel.Cell fechaCell = fechaRow.createCell(0);
        fechaCell.setCellValue("Generado el: " + fechaStr + "   |   Total: " + usuarios.size() + " usuarios");
        fechaCell.setCellStyle(subtitleStyle);
        sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, 9));

        // Fila 2 — vacía (espacio visual)
        sheet.createRow(2).setHeightInPoints(6);

        // Fila 3 — Headers de tabla — lógica SIN CAMBIOS
        Row headerRow = sheet.createRow(3);
        headerRow.setHeightInPoints(22);
        String[] headers = {"ID", "Nombre", "Correo", "Teléfono", "Cédula", "Rol",
                "Tipo Cliente", "Método Pago", "Estado", "Descripción"};
        for (int i = 0; i < headers.length; i++) {
            org.apache.poi.ss.usermodel.Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(headerStyle);
        }

        // Filas de datos — lógica SIN CAMBIOS
        int rowNum = 4;
        for (Usuario usuario : usuarios) {
            Row row = sheet.createRow(rowNum);
            boolean esPar = (rowNum % 2 == 0);

            String estadoStr = usuario.getEstado() != null ? usuario.getEstado().name() : "";
            CellStyle estiloEstado = estadoStr.equals("ACTIVO") ? activeStyle : inactiveStyle;

            createStyledCell(row, 0, usuario.getIdUsuario(),                                                             esPar ? dataCenterPar   : dataCenterImpar);
            createStyledCell(row, 1, usuario.getNombre(),                                                                esPar ? dataStylePar    : dataStyleImpar);
            createStyledCell(row, 2, usuario.getCorreo(),                                                                esPar ? dataStylePar    : dataStyleImpar);
            createStyledCell(row, 3, usuario.getTelefono(),                                                              esPar ? dataCenterPar   : dataCenterImpar);
            createStyledCell(row, 4, usuario.getCedula(),                                                                esPar ? dataCenterPar   : dataCenterImpar);
            createStyledCell(row, 5, usuario.getRol()         != null ? usuario.getRol().name()         : "",           esPar ? dataCenterPar   : dataCenterImpar);
            createStyledCell(row, 6, usuario.getTipoCliente() != null ? usuario.getTipoCliente().name() : "",           esPar ? dataCenterPar   : dataCenterImpar);
            createStyledCell(row, 7, usuario.getMetodoPago()  != null ? usuario.getMetodoPago().name()  : "",           esPar ? dataCenterPar   : dataCenterImpar);
            createStyledCell(row, 8, estadoStr,                                                                          estiloEstado);
            createStyledCell(row, 9, usuario.getDescripcion(),                                                           esPar ? dataStylePar    : dataStyleImpar);

            rowNum++;
        }

        // AutoSize columnas — SIN CAMBIOS
        for (int i = 0; i < headers.length; i++) {
            sheet.autoSizeColumn(i);
        }

        // ── HOJA ESTADÍSTICAS ─────────────────────────────────────────────
        Sheet statsSheet = workbook.createSheet("Estadísticas");
        statsSheet.setColumnWidth(0, 8000);
        statsSheet.setColumnWidth(1, 5000);

        // Título hoja stats
        Row statsTitleRow = statsSheet.createRow(0);
        statsTitleRow.setHeightInPoints(30);
        org.apache.poi.ss.usermodel.Cell statsTitleCell = statsTitleRow.createCell(0);
        statsTitleCell.setCellValue("ESTADÍSTICAS DE USUARIOS — AparcaYA");
        statsTitleCell.setCellStyle(titleDocStyle);
        statsSheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 1));

        // Fecha
        Row statsFechaRow = statsSheet.createRow(1);
        org.apache.poi.ss.usermodel.Cell statsFechaCell = statsFechaRow.createCell(0);
        statsFechaCell.setCellValue("Generado el: " + fechaStr);
        statsFechaCell.setCellStyle(subtitleStyle);
        statsSheet.addMergedRegion(new CellRangeAddress(1, 1, 0, 1));

        int statsRow = 3;

        // ✅ MEJORA VISUAL: sección con header azul para separar grupos de estadísticas
        statsSheet.createRow(statsRow).setHeightInPoints(8); statsRow++;

        addStatsSectionHeader(statsSheet, statsRow++, "TOTALES GENERALES", headerStyle, workbook);
        addStatsDataRow(statsSheet, statsRow++, "Total de usuarios",  usuarios.size(), dataCenterPar, dataStylePar);

        statsRow++;
        addStatsSectionHeader(statsSheet, statsRow++, "POR ROL", headerStyle, workbook);

        // ✅ CAMBIO 2: Usar método auxiliar — SIN CAMBIOS
        Map<String, Long> stats = calcularEstadisticas(usuarios);

        addStatsDataRow(statsSheet, statsRow++, "Administradores",  stats.get("admin"),     dataCenterPar, dataStylePar);
        addStatsDataRow(statsSheet, statsRow++, "Clientes",         stats.get("cliente"),   dataCenterImpar, dataStyleImpar);
        addStatsDataRow(statsSheet, statsRow++, "Operadores",       stats.get("operador"),  dataCenterPar, dataStylePar);

        statsRow++;
        addStatsSectionHeader(statsSheet, statsRow++, "POR ESTADO", headerStyle, workbook);
        addStatsDataRow(statsSheet, statsRow++, "Activos",    stats.get("activos"),    activeStyle,   dataStylePar);
        addStatsDataRow(statsSheet, statsRow++, "Inactivos",  stats.get("inactivos"),  inactiveStyle, dataStyleImpar);

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        workbook.write(baos);
        workbook.close();

        return baos;
    }

    /** Añade una fila de encabezado de sección en la hoja de estadísticas */
    private void addStatsSectionHeader(Sheet sheet, int rowIndex, String text,
                                       CellStyle style, Workbook workbook) {
        Row row = sheet.createRow(rowIndex);
        row.setHeightInPoints(18);
        org.apache.poi.ss.usermodel.Cell c0 = row.createCell(0);
        c0.setCellValue(text);
        c0.setCellStyle(style);
        org.apache.poi.ss.usermodel.Cell c1 = row.createCell(1);
        c1.setCellStyle(style);
        sheet.addMergedRegion(new CellRangeAddress(rowIndex, rowIndex, 0, 1));
    }

    /** Añade una fila de dato en la hoja de estadísticas */
    private void addStatsDataRow(Sheet sheet, int rowIndex, String label, Object value,
                                 CellStyle numStyle, CellStyle labelStyle) {
        Row row = sheet.createRow(rowIndex);
        row.setHeightInPoints(16);
        org.apache.poi.ss.usermodel.Cell labelCell = row.createCell(0);
        labelCell.setCellValue(label);
        labelCell.setCellStyle(labelStyle);
        org.apache.poi.ss.usermodel.Cell valCell = row.createCell(1);
        if (value instanceof Long)    valCell.setCellValue((Long) value);
        else if (value instanceof Integer) valCell.setCellValue((Integer) value);
        else valCell.setCellValue(value != null ? value.toString() : "");
        valCell.setCellStyle(numStyle);
    }

    /** Aplica bordes uniformes a un CellStyle */
    private void setBordersStyle(CellStyle style, BorderStyle bs, short color) {
        style.setBorderTop(bs);    style.setTopBorderColor(color);
        style.setBorderBottom(bs); style.setBottomBorderColor(color);
        style.setBorderLeft(bs);   style.setLeftBorderColor(color);
        style.setBorderRight(bs);  style.setRightBorderColor(color);
    }

    // ------------------------- EXCEL SEDES ---------------------------
    // ✅ CAMBIO #5: Implementación del reporte Excel de sedes
    // Antes: generación manual con POI directamente en SedeController.generarExcelSedes()
    // Ahora: centralizado en el Service, el Controller solo descarga el resultado
    @Override
    public ByteArrayOutputStream generarReporteExcelSedes(List<com.exe.AparcaYA.Entity.Sede> sedes) throws Exception {

        Workbook workbook = new XSSFWorkbook();
        Sheet sheet = workbook.createSheet("Mi Sede");

        // ── Reutiliza la misma paleta visual que el reporte de usuarios ──────
        CellStyle headerStyle = workbook.createCellStyle();
        Font headerFont = workbook.createFont();
        headerFont.setBold(true);
        headerFont.setFontHeightInPoints((short) 11);
        headerFont.setColor(IndexedColors.WHITE.getIndex());
        headerStyle.setFont(headerFont);
        headerStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
        headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        headerStyle.setAlignment(HorizontalAlignment.CENTER);
        headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);

        CellStyle titleStyle = workbook.createCellStyle();
        Font titleFont = workbook.createFont();
        titleFont.setBold(true);
        titleFont.setFontHeightInPoints((short) 14);
        titleFont.setColor(IndexedColors.WHITE.getIndex());
        titleStyle.setFont(titleFont);
        titleStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
        titleStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        titleStyle.setAlignment(HorizontalAlignment.CENTER);
        titleStyle.setVerticalAlignment(VerticalAlignment.CENTER);

        // Título
        Row titleRow = sheet.createRow(0);
        titleRow.setHeightInPoints(30);
        org.apache.poi.ss.usermodel.Cell tc = titleRow.createCell(0);
        tc.setCellValue("REPORTE DE SEDES — AparcaYA");
        tc.setCellStyle(titleStyle);

        String[] headers = {
                "ID", "Nombre", "Dirección", "Capacidad",
                "Tarifa Plena Carro", "Tarifa Plena Moto",
                "Tarifa Minuto Carro", "Tarifa Minuto Moto", "Estado"
        };
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, headers.length - 1));

        // Fila 1 vacía
        sheet.createRow(1).setHeightInPoints(6);

        // Fila 2 — headers — lógica SIN CAMBIOS
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

        // Filas de datos — lógica SIN CAMBIOS
        int rowNum = 3;
        for (com.exe.AparcaYA.Entity.Sede s : sedes) {
            Row row = sheet.createRow(rowNum);
            row.setHeightInPoints(16);
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

    @Override
    public ByteArrayOutputStream generarReporteEstadisticoPdf(Sede sede, String desde, String hasta, BigDecimal ingresos, List<RegistroEntradaSalida> registros) throws Exception {
        return null;
    }

    @Override
    public ByteArrayOutputStream generarReporteEstadisticoExcel(Sede sede, String desde, String hasta, BigDecimal ingresos, List<RegistroEntradaSalida> registros) throws Exception {
        return null;
    }

    // -------- MÉTODO AUXILIAR: SIN CAMBIOS ──────────────────────────────────
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