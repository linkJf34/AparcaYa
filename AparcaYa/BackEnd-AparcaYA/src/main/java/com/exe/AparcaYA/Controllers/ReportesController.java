package com.exe.AparcaYA.Controllers;

import com.exe.AparcaYA.Dto.ReporteDataDTO;
import com.exe.AparcaYA.Dto.ReportePayloadDTO;
import com.exe.AparcaYA.Component.ExcelReporteBuilder;
import com.exe.AparcaYA.Component.PdfReporteBuilder;
import com.exe.AparcaYA.Service.ReportesService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Map;

@RestController
@RequestMapping("/admin/reportes")
public class ReportesController {

    private final ReportesService     reportesService;
    private final PdfReporteBuilder   pdfBuilder;
    private final ExcelReporteBuilder excelBuilder;

    public ReportesController(ReportesService reportesService,
                              PdfReporteBuilder pdfBuilder,
                              ExcelReporteBuilder excelBuilder) {
        this.reportesService = reportesService;
        this.pdfBuilder      = pdfBuilder;
        this.excelBuilder    = excelBuilder;
    }

    // ── PDF completo ───────────────────────────────────────────────────
    @PostMapping("/pdf")
    public ResponseEntity<byte[]> generarPdf(
            @RequestBody ReportePayloadDTO payload) throws Exception {

        ReporteDataDTO data = reportesService.construirDatos(payload.getFiltros());
        data.setGraficasBase64(payload.getGraficas());
        data.setKpisDOM(payload.getKpis());

        byte[] pdf = pdfBuilder.generar(data);

        String nombre = "reporte-aparcaya-"
                + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"))
                + ".pdf";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + nombre + "\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    // ── Excel completo ─────────────────────────────────────────────────
    @PostMapping("/excel")
    public ResponseEntity<byte[]> generarExcel(
            @RequestBody ReportePayloadDTO payload) throws Exception {

        ReporteDataDTO data = reportesService.construirDatos(payload.getFiltros());
        data.setGraficasBase64(payload.getGraficas());
        data.setKpisDOM(payload.getKpis());

        byte[] excel = excelBuilder.generar(data);

        String nombre = "reporte-aparcaya-"
                + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"))
                + ".xlsx";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + nombre + "\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(excel);
    }

    // ── PDF de una sola grafica ────────────────────────────────────────
    @PostMapping("/grafica-pdf")
    public ResponseEntity<byte[]> exportarGraficaPdf(
            @RequestBody Map<String, String> body) throws Exception {

        byte[] pdf = pdfBuilder.generarPdfGraficaIndividual(
                body.getOrDefault("titulo", "Grafica"),
                body.get("imagen")
        );

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"grafica.pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }
}