package com.exe.AparcaYA.Component;

import com.exe.AparcaYA.Dto.ReporteDataDTO;
import com.lowagie.text.*;
import com.lowagie.text.Font;
import com.lowagie.text.Image;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.*;
import org.springframework.stereotype.Component;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@Component
public class PdfReporteBuilder {

    // ── Colores ────────────────────────────────────────────────────────
    private static final Color AZUL         = new Color(30, 64, 175);
    private static final Color AZUL_DARK    = new Color(15, 32, 90);
    private static final Color VERDE        = new Color(5, 150, 105);
    private static final Color GRIS_CLARO   = new Color(248, 250, 252);
    private static final Color GRIS_BORDE   = new Color(203, 213, 225);
    private static final Color TEXTO_MUTED  = new Color(100, 116, 139);
    private static final Color BLANCO       = Color.WHITE;
    private static final Color TEXTO_OSCURO = new Color(15, 23, 42);

    // ── Fuentes ────────────────────────────────────────────────────────
    private static final Font F_TITULO  =
            FontFactory.getFont(FontFactory.HELVETICA_BOLD, 20, BLANCO);
    private static final Font F_SECCION =
            FontFactory.getFont(FontFactory.HELVETICA_BOLD, 13, AZUL_DARK);
    private static final Font F_KPI_LABEL =
            FontFactory.getFont(FontFactory.HELVETICA, 9, TEXTO_MUTED);
    private static final Font F_TH =
            FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, BLANCO);
    private static final Font F_TD =
            FontFactory.getFont(FontFactory.HELVETICA, 9, TEXTO_OSCURO);
    private static final Font F_META =
            FontFactory.getFont(FontFactory.HELVETICA, 8, TEXTO_MUTED);
    private static final Font F_SUB =
            FontFactory.getFont(FontFactory.HELVETICA, 10, TEXTO_MUTED);

    // ──────────────────────────────────────────────────────────────────
    // METODO PRINCIPAL
    // ──────────────────────────────────────────────────────────────────
    public byte[] generar(ReporteDataDTO data) throws Exception {

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        Document doc = new Document(PageSize.A4, 40, 40, 60, 50);
        PdfWriter writer = PdfWriter.getInstance(doc, baos);
        writer.setPageEvent(new HeaderFooterEvent(data.getPeriodoReporte()));
        doc.open();

        agregarPortada(doc, data);
        doc.newPage();
        agregarKpis(doc, data);
        agregarSeparador(doc);
        agregarGraficas(doc, data);
        agregarSeparador(doc);
        agregarTabla(doc, "Usuarios", data.getUsuarios(),
                new String[]{"nombre", "correo", "rol", "estado"}, AZUL);
        agregarSeparador(doc);
        agregarTabla(doc, "Sedes", data.getSedes(),
                new String[]{"nombre", "direccion", "capacidad", "estado"}, VERDE);
        agregarSeparador(doc);
        agregarTabla(doc, "Correos enviados", data.getCorreos(),
                new String[]{"destinatario", "asunto", "tipo", "estado", "fecha"},
                new Color(124, 58, 237));

        doc.close();
        return baos.toByteArray();
    }

    // ──────────────────────────────────────────────────────────────────
    // PDF DE UNA SOLA GRAFICA
    // ──────────────────────────────────────────────────────────────────
    public byte[] generarPdfGraficaIndividual(String titulo, String base64)
            throws Exception {

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        Document doc = new Document(PageSize.A4.rotate(), 40, 40, 50, 40);
        PdfWriter.getInstance(doc, baos);
        doc.open();

        Paragraph p = new Paragraph(titulo, F_SECCION);
        p.setSpacingAfter(16);
        doc.add(p);

        Image img = imagenDesdeBase64(base64, 750, 420);
        if (img != null) doc.add(img);

        Paragraph pie = new Paragraph(
                "Exportado el " + LocalDateTime.now()
                        .format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")), F_META);
        pie.setSpacingBefore(12);
        doc.add(pie);

        doc.close();
        return baos.toByteArray();
    }

    // ──────────────────────────────────────────────────────────────────
    // SECCIONES
    // ──────────────────────────────────────────────────────────────────
    private void agregarPortada(Document doc, ReporteDataDTO data)
            throws DocumentException {

        PdfPTable banda = new PdfPTable(1);
        banda.setWidthPercentage(100);
        PdfPCell celda = new PdfPCell();
        celda.setBackgroundColor(AZUL);
        celda.setBorder(Rectangle.NO_BORDER);
        celda.setPadding(24);
        celda.addElement(new Paragraph("REPORTE EJECUTIVO — APARCAYA", F_TITULO));
        celda.addElement(new Paragraph(
                "Sistema de Gestion de Parqueaderos",
                FontFactory.getFont(FontFactory.HELVETICA, 12, new Color(147, 197, 253))
        ));
        banda.addCell(celda);
        doc.add(banda);
        doc.add(Chunk.NEWLINE);

        PdfPTable meta = new PdfPTable(2);
        meta.setWidthPercentage(100);
        meta.setWidths(new float[]{1, 1});
        agregarMetaItem(meta, "Periodo",     data.getPeriodoReporte());
        agregarMetaItem(meta, "Sede",        data.getSedeNombre());
        agregarMetaItem(meta, "Generado el",
                LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")));
        agregarMetaItem(meta, "Sistema", "AparcaYA Admin v1.0");
        doc.add(meta);
    }

    private void agregarMetaItem(PdfPTable t, String label, String valor)
            throws DocumentException {
        PdfPCell c = new PdfPCell();
        c.setBorder(Rectangle.BOTTOM);
        c.setBorderColor(GRIS_BORDE);
        c.setPadding(10);
        c.setBackgroundColor(GRIS_CLARO);
        Paragraph p = new Paragraph();
        p.add(new Chunk(label + "\n", F_META));
        p.add(new Chunk(valor != null ? valor : "—",
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, TEXTO_OSCURO)));
        c.addElement(p);
        t.addCell(c);
    }

    private void agregarKpis(Document doc, ReporteDataDTO data)
            throws DocumentException {

        doc.add(new Paragraph("Resumen Ejecutivo", F_SECCION));
        doc.add(Chunk.NEWLINE);

        Map<String, String> kpis = data.getKpisDOM();
        if (kpis == null || kpis.isEmpty()) {
            doc.add(new Paragraph("Sin datos de KPIs disponibles.", F_SUB));
            return;
        }

        PdfPTable tabla = new PdfPTable(4);
        tabla.setWidthPercentage(100);
        tabla.setSpacingBefore(8);

        agregarKpiCard(tabla, "Ingresos este mes",
                kpis.getOrDefault("ingresosActual",   "0"), AZUL);
        agregarKpiCard(tabla, "Total usuarios",
                kpis.getOrDefault("totalUsuariosCard","0"), VERDE);
        agregarKpiCard(tabla, "Total sedes",
                kpis.getOrDefault("totalSedesCard",   "0"), new Color(124, 58, 237));
        agregarKpiCard(tabla, "Correos enviados",
                kpis.getOrDefault("correosEnviados",  "0"), new Color(220, 38, 38));
        agregarKpiCard(tabla, "Usuarios activos",
                kpis.getOrDefault("usuariosActivos",  "0"), AZUL);
        agregarKpiCard(tabla, "Capacidad sedes",
                kpis.getOrDefault("sedesCapacidad",   "0"), VERDE);
        agregarKpiCard(tabla, "Acumulado ano",
                kpis.getOrDefault("ingresosAnio",     "0"), new Color(124, 58, 237));
        agregarKpiCard(tabla, "Correos con error",
                kpis.getOrDefault("correosErrores",   "0"), new Color(220, 38, 38));

        doc.add(tabla);
    }

    private void agregarKpiCard(PdfPTable t, String label,
                                String valor, Color color)
            throws DocumentException {
        PdfPCell c = new PdfPCell();
        c.setBorder(Rectangle.LEFT);
        c.setBorderColor(color);
        c.setBorderWidth(3);
        c.setBackgroundColor(GRIS_CLARO);
        c.setPadding(10);
        Paragraph p = new Paragraph();
        p.add(new Chunk(label + "\n", F_KPI_LABEL));
        p.add(new Chunk(valor,
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16, color)));
        c.addElement(p);
        t.addCell(c);
    }

    private void agregarGraficas(Document doc, ReporteDataDTO data)
            throws Exception {

        doc.add(new Paragraph("Graficas del Dashboard", F_SECCION));
        doc.add(Chunk.NEWLINE);

        Map<String, String> g = data.getGraficasBase64();
        if (g == null || g.isEmpty()) {
            doc.add(new Paragraph("No se recibieron graficas.", F_SUB));
            return;
        }

        // Ingresos: ancho completo
        Image imgIngresos = imagenDesdeBase64(g.get("chartIngresos"), 520, 250);
        if (imgIngresos != null) doc.add(imgIngresos);
        doc.add(Chunk.NEWLINE);

        // Usuarios y Sedes: dos columnas
        PdfPTable dos = new PdfPTable(2);
        dos.setWidthPercentage(100);
        agregarImgEnCelda(dos, g.get("chartUsuarios"), 250, 200);
        agregarImgEnCelda(dos, g.get("chartSedes"),    250, 200);
        doc.add(dos);
        doc.add(Chunk.NEWLINE);

        // Correos: centrado
        Image imgCorreos = imagenDesdeBase64(
                g.get("chartCorreosEstado"), 380, 220);
        if (imgCorreos != null) {
            imgCorreos.setAlignment(Element.ALIGN_CENTER);
            doc.add(imgCorreos);
        }
    }

    private void agregarImgEnCelda(PdfPTable t, String base64, int w, int h)
            throws Exception {
        PdfPCell c = new PdfPCell();
        c.setBorder(Rectangle.NO_BORDER);
        c.setHorizontalAlignment(Element.ALIGN_CENTER);
        Image img = imagenDesdeBase64(base64, w, h);
        if (img != null) c.addElement(img);
        else c.addElement(new Paragraph("Sin datos", F_SUB));
        t.addCell(c);
    }

    private void agregarTabla(Document doc, String titulo,
                              List<Map<String, Object>> filas,
                              String[] columnas, Color color)
            throws DocumentException {

        doc.add(new Paragraph(titulo, F_SECCION));
        doc.add(Chunk.NEWLINE);

        if (filas == null || filas.isEmpty()) {
            doc.add(new Paragraph("Sin registros en este periodo.", F_SUB));
            return;
        }

        PdfPTable tabla = new PdfPTable(columnas.length);
        tabla.setWidthPercentage(100);
        tabla.setSpacingBefore(4);

        for (String col : columnas) {
            PdfPCell h = new PdfPCell(new Phrase(
                    col.substring(0, 1).toUpperCase() + col.substring(1), F_TH));
            h.setBackgroundColor(color);
            h.setPadding(7);
            h.setBorder(Rectangle.NO_BORDER);
            h.setHorizontalAlignment(Element.ALIGN_CENTER);
            tabla.addCell(h);
        }

        boolean par = false;
        for (Map<String, Object> fila : filas) {
            Color bg = par ? new Color(241, 245, 249) : BLANCO;
            for (String col : columnas) {
                Object val = fila.get(col);
                PdfPCell c = new PdfPCell(
                        new Phrase(val != null ? val.toString() : "—", F_TD));
                c.setBackgroundColor(bg);
                c.setPadding(6);
                c.setBorderColor(GRIS_BORDE);
                c.setBorderWidth(0.3f);
                tabla.addCell(c);
            }
            par = !par;
        }

        doc.add(tabla);
    }

    private void agregarSeparador(Document doc) throws DocumentException {
        PdfPTable linea = new PdfPTable(1);
        linea.setWidthPercentage(100);
        linea.setSpacingBefore(8);
        linea.setSpacingAfter(8);
        PdfPCell celda = new PdfPCell();
        celda.setBorder(Rectangle.BOTTOM);
        celda.setBorderColor(GRIS_BORDE);
        celda.setBorderWidth(0.5f);
        celda.setPadding(0);
        celda.setMinimumHeight(1);
        linea.addCell(celda);
        doc.add(linea);
    }

    // ──────────────────────────────────────────────────────────────────
    // UTILIDAD: base64 a Image OpenPDF
    // ──────────────────────────────────────────────────────────────────
    private Image imagenDesdeBase64(String base64DataUrl, int maxW, int maxH)
            throws Exception {
        if (base64DataUrl == null || base64DataUrl.isBlank()) return null;
        String datos = base64DataUrl.contains(",")
                ? base64DataUrl.split(",", 2)[1]
                : base64DataUrl;
        byte[] bytes = java.util.Base64.getDecoder().decode(datos);
        Image img = Image.getInstance(bytes);
        img.scaleToFit(maxW, maxH);
        img.setAlignment(Element.ALIGN_CENTER);
        return img;
    }

    // ──────────────────────────────────────────────────────────────────
    // HEADER Y FOOTER EN CADA PAGINA
    // ──────────────────────────────────────────────────────────────────
    private static class HeaderFooterEvent extends PdfPageEventHelper {

        private final String periodo;

        HeaderFooterEvent(String periodo) { this.periodo = periodo; }

        @Override
        public void onEndPage(PdfWriter writer, Document document) {
            PdfContentByte cb  = writer.getDirectContent();
            Rectangle      ps  = document.getPageSize();

            cb.setColorFill(new Color(30, 64, 175));
            cb.rectangle(0, ps.getHeight() - 32, ps.getWidth(), 32);
            cb.fill();

            cb.setColorFill(new Color(248, 250, 252));
            cb.rectangle(0, 0, ps.getWidth(), 26);
            cb.fill();

            Font f = FontFactory.getFont(
                    FontFactory.HELVETICA, 7, new Color(100, 116, 139));
            ColumnText.showTextAligned(cb, Element.ALIGN_LEFT,
                    new Phrase("AparcaYA | " + periodo, f), 40, 9, 0);
            ColumnText.showTextAligned(cb, Element.ALIGN_RIGHT,
                    new Phrase("Pag. " + writer.getPageNumber(), f),
                    ps.getWidth() - 40, 9, 0);
        }
    }

    public byte[] generarReporteSede(ReporteDataDTO data) throws Exception {

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        Document doc = new Document(PageSize.A4, 40, 40, 60, 50);
        PdfWriter writer = PdfWriter.getInstance(doc, baos);
        writer.setPageEvent(new HeaderFooterEvent(data.getPeriodoReporte()));
        doc.open();

        // ── Portada ────────────────────────────────────────────────
        PdfPTable banda = new PdfPTable(1);
        banda.setWidthPercentage(100);
        PdfPCell celda = new PdfPCell();
        celda.setBackgroundColor(VERDE);
        celda.setBorder(Rectangle.NO_BORDER);
        celda.setPadding(24);
        celda.addElement(new Paragraph(
                "REPORTE DE INGRESOS — " + data.getSedeNombre().toUpperCase(), F_TITULO));
        celda.addElement(new Paragraph(
                "Sistema de Gestion de Parqueaderos AparcaYA",
                FontFactory.getFont(FontFactory.HELVETICA, 12, new Color(167, 243, 208))
        ));
        banda.addCell(celda);
        doc.add(banda);
        doc.add(Chunk.NEWLINE);

        // ── Metadata ───────────────────────────────────────────────
        PdfPTable meta = new PdfPTable(2);
        meta.setWidthPercentage(100);
        meta.setWidths(new float[]{1, 1});
        agregarMetaItem(meta, "Sede",        data.getSedeNombre());
        agregarMetaItem(meta, "Periodo",     data.getPeriodoReporte());
        agregarMetaItem(meta, "Generado el",
                LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")));
        agregarMetaItem(meta, "Sistema",     "AparcaYA Sede v1.0");
        doc.add(meta);

        doc.newPage();

        // ── KPIs ───────────────────────────────────────────────────
        doc.add(new Paragraph("Resumen de Ingresos", F_SECCION));
        doc.add(Chunk.NEWLINE);

        Map<String, String> kpis = data.getKpisDOM();
        if (kpis != null && !kpis.isEmpty()) {
            PdfPTable tablaKpi = new PdfPTable(3);
            tablaKpi.setWidthPercentage(100);
            tablaKpi.setSpacingBefore(8);
            agregarKpiCard(tablaKpi, "Ingresos Hoy",
                    kpis.getOrDefault("ingresosHoy",     "$0"), VERDE);
            agregarKpiCard(tablaKpi, "Ingresos Este Mes",
                    kpis.getOrDefault("ingresosMes",     "$0"), AZUL);
            agregarKpiCard(tablaKpi, "Ingresos Este Ano",
                    kpis.getOrDefault("ingresosAnio",    "$0"), new Color(124, 58, 237));
            doc.add(tablaKpi);
        }

        agregarSeparador(doc);

        // ── Graficas ───────────────────────────────────────────────
        Map<String, String> g = data.getGraficasBase64();
        if (g != null && !g.isEmpty()) {
            doc.add(new Paragraph("Graficas del Periodo", F_SECCION));
            doc.add(Chunk.NEWLINE);

            Image imgIngresos = imagenDesdeBase64(g.get("chartIngresos"), 520, 250);
            if (imgIngresos != null) doc.add(imgIngresos);

            doc.add(Chunk.NEWLINE);

            Image imgOcupacion = imagenDesdeBase64(g.get("chartOcupacion"), 400, 220);
            if (imgOcupacion != null) {
                imgOcupacion.setAlignment(Element.ALIGN_CENTER);
                doc.add(imgOcupacion);
            }
            agregarSeparador(doc);
        }

        // ── Tabla de reservaciones ─────────────────────────────────
        agregarTabla(doc, "Reservaciones del Periodo", data.getUsuarios(),
                new String[]{"cliente", "vehiculo", "inicio", "fin", "estado"}, VERDE);

        agregarSeparador(doc);

        // ── Tabla de pagos ─────────────────────────────────────────
        agregarTabla(doc, "Pagos Registrados", data.getCorreos(),
                new String[]{"id", "monto", "estado", "fecha"},
                new Color(5, 150, 105));


        // ── Tablas de datos ────────────────────────────────────────────
        agregarSeparador(doc);

        agregarTabla(doc, "Reservaciones del Periodo", data.getUsuarios(),
                new String[]{"cliente", "vehiculo", "inicio", "fin", "estado"},
                VERDE);

        agregarSeparador(doc);

        agregarTabla(doc, "Historial de Registros", data.getSedes(),
                new String[]{"placa", "cliente", "entrada", "salida", "estado"},
                AZUL);

        agregarSeparador(doc);

        agregarTabla(doc, "Pagos Registrados", data.getCorreos(),
                new String[]{"id", "monto", "estado", "fecha"},
                new Color(124, 58, 237));

        doc.close();
        return baos.toByteArray();
    }
}
