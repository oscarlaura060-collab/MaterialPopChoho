"use client";

import { fechaCorta, fechaLarga, horaCorta, money, num, pct } from "./format";
import type {
  Anexo, EventoVista, Gasto, MaterialPop, Participacion, Persona, Resultado,
} from "./types";

interface Datos {
  material: MaterialPop[];
  gastos: Gasto[];
  participacion: Participacion[];
  personas: Persona[];
  resultados: Resultado[];
  anexos: Anexo[];
}

function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const hoy = () => new Date().toISOString().slice(0, 10);

/** Encabezado con el mismo estilo en todas las hojas */
function encabezar(hoja: import("exceljs").Worksheet, titulos: string[]) {
  const fila = hoja.addRow(titulos);
  fila.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  fila.alignment = { vertical: "middle" };
  fila.height = 20;
  fila.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF141414" } };
  });
  hoja.views = [{ state: "frozen", ySplit: 1 }];
}

function anchos(hoja: import("exceljs").Worksheet, anchos: number[]) {
  anchos.forEach((w, i) => { hoja.getColumn(i + 1).width = w; });
}

const MONEDA = '"$"#,##0';

/**
 * Exporta a Excel los eventos filtrados con todas sus hojas relacionadas.
 * Mantiene los mismos encabezados que EVENTOS REALIZADOS.xlsx.
 */
export async function exportarEventosExcel(eventos: EventoVista[], datos: Datos) {
  const ExcelJS = (await import("exceljs")).default;
  const libro = new ExcelJS.Workbook();
  libro.creator = "CHOHO · Eventos";
  libro.created = new Date();

  const ids = new Set(eventos.map((e) => e.id));

  // --- EVENTOS ---
  const hEv = libro.addWorksheet("EVENTOS");
  encabezar(hEv, [
    "ID EVENTO", "EVENTO", "FECHA", "DÍA", "CIUDAD", "LUGAR / NEGOCIO", "DIRECCIÓN",
    "CLIENTE", "TIPO DE EVENTO", "RESPONSABLE", "ESTADO", "ASISTENTES ESPERADOS",
    "ASISTENTES", "GASTO POP", "VALOR MATERIAL LLEVADO", "GASTOS ADICIONALES",
    "GASTO TOTAL", "OBSERVACIONES",
  ]);
  for (const e of eventos) {
    hEv.addRow([
      e.codigo, e.nombre, fechaCorta(e.fecha), e.dia, e.ciudad, e.lugar_negocio,
      e.direccion, e.cliente, e.tipo_evento, e.responsable, e.estado,
      e.asistentes_esperados, e.asistentes,
      e.gasto_pop, e.pop_valor_llevado, e.gastos_adicionales, e.gasto_total,
      e.observaciones,
    ]);
  }
  anchos(hEv, [11, 26, 12, 11, 14, 26, 24, 18, 24, 18, 14, 12, 12, 14, 18, 16, 14, 30]);
  ["N", "O", "P", "Q"].forEach((c) => { hEv.getColumn(c).numFmt = MONEDA; });

  // --- MATERIAL POP ---
  const hMp = libro.addWorksheet("MATERIAL POP");
  encabezar(hMp, [
    "ID EVENTO", "EVENTO", "FECHA", "MATERIAL POP", "CANTIDAD LLEVADA",
    "CANTIDAD UTILIZADA", "CANTIDAD SOBRANTE", "% UTILIZACIÓN",
    "COSTO UNITARIO", "GASTO MATERIAL", "OBSERVACIONES",
  ]);
  for (const m of datos.material.filter((x) => ids.has(x.evento_id))) {
    hMp.addRow([
      m.evento_codigo, m.evento_nombre, fechaCorta(m.evento_fecha), m.material,
      m.cantidad_llevada, m.cantidad_utilizada, m.cantidad_sobrante,
      m.pct_utilizacion, m.costo_unitario, m.gasto_material, m.observaciones,
    ]);
  }
  anchos(hMp, [11, 24, 12, 18, 16, 17, 17, 13, 14, 15, 28]);
  hMp.getColumn("H").numFmt = "0.0%";
  ["I", "J"].forEach((c) => { hMp.getColumn(c).numFmt = MONEDA; });

  // --- GASTOS ---
  const hGa = libro.addWorksheet("GASTOS");
  encabezar(hGa, [
    "ID EVENTO", "EVENTO", "FECHA", "CATEGORÍA", "DESCRIPCIÓN",
    "PROVEEDOR", "RESPONSABLE", "VALOR", "OBSERVACIONES",
  ]);
  for (const g of datos.gastos.filter((x) => ids.has(x.evento_id))) {
    hGa.addRow([
      g.evento_codigo, g.evento_nombre, fechaCorta(g.evento_fecha), g.categoria,
      g.descripcion, g.proveedor, g.responsable, g.valor, g.observaciones,
    ]);
  }
  anchos(hGa, [11, 24, 12, 18, 26, 20, 18, 14, 28]);
  hGa.getColumn("H").numFmt = MONEDA;

  // --- PARTICIPACIÓN ---
  const hPa = libro.addWorksheet("PARTICIPACIÓN");
  encabezar(hPa, [
    "ID EVENTO", "EVENTO", "FECHA", "PERSONA", "CONFIRMADO", "ASISTIÓ",
    "ROL / FUNCIÓN", "HORA INGRESO", "HORA SALIDA", "HORAS", "OBSERVACIONES",
  ]);
  for (const p of datos.participacion.filter((x) => ids.has(x.evento_id))) {
    hPa.addRow([
      p.evento_codigo, p.evento_nombre, fechaCorta(p.evento_fecha), p.persona_nombre,
      p.confirmado, p.asistio, p.rol_funcion, horaCorta(p.hora_ingreso),
      horaCorta(p.hora_salida), p.horas, p.observaciones,
    ]);
  }
  anchos(hPa, [11, 24, 12, 22, 12, 10, 18, 13, 13, 8, 28]);

  // --- RESULTADOS ---
  const hRe = libro.addWorksheet("RESULTADOS");
  encabezar(hRe, [
    "ID EVENTO", "EVENTO", "FECHA", "ASISTENTES", "CLIENTES ATENDIDOS",
    "RESULTADO COMERCIAL", "OBSERVACIONES", "APRENDIZAJES",
  ]);
  for (const r of datos.resultados.filter((x) => ids.has(x.evento_id))) {
    hRe.addRow([
      r.evento_codigo, r.evento_nombre, fechaCorta(r.evento_fecha), r.asistentes,
      r.clientes_atendidos, r.resultado_comercial, r.observaciones, r.aprendizajes,
    ]);
  }
  anchos(hRe, [11, 24, 12, 12, 18, 34, 34, 34]);

  // --- PERSONAL ---
  const hPe = libro.addWorksheet("PERSONAL");
  encabezar(hPe, [
    "ID PERSONA", "NOMBRE", "CARGO / ÁREA", "ACTIVO", "EVENTOS ASIGNADOS",
    "CONFIRMADOS", "PENDIENTES", "NO VA", "ASISTIDOS", "NO ASISTIÓ",
    "% ASISTENCIA", "HORAS", "OBSERVACIONES",
  ]);
  for (const p of datos.personas) {
    hPe.addRow([
      p.codigo, p.nombre, p.cargo_area, p.activo ? "SÍ" : "NO", p.eventos_asignados,
      p.confirmados, p.pendientes, p.no_va, p.asistidos, p.no_asistio,
      p.pct_asistencia, p.horas_totales, p.observaciones,
    ]);
  }
  anchos(hPe, [12, 22, 20, 9, 17, 13, 12, 9, 11, 12, 13, 9, 28]);
  hPe.getColumn("K").numFmt = "0%";

  const buf = await libro.xlsx.writeBuffer();
  descargar(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `CHOHO_EVENTOS_${hoy()}.xlsx`
  );
}

/** Exporta una sola hoja a Excel (Material POP, Gastos o Resultados) */
export async function exportarHoja(
  nombreHoja: string, cabeceras: string[], filas: (string | number | null)[][],
  formatos?: Record<string, string>
) {
  const ExcelJS = (await import("exceljs")).default;
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet(nombreHoja);
  encabezar(hoja, cabeceras);
  filas.forEach((f) => hoja.addRow(f));
  cabeceras.forEach((c, i) => { hoja.getColumn(i + 1).width = Math.max(11, Math.min(32, c.length + 6)); });
  if (formatos) for (const [col, fmt] of Object.entries(formatos)) hoja.getColumn(col).numFmt = fmt;
  const buf = await libro.xlsx.writeBuffer();
  descargar(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `CHOHO_${nombreHoja.replace(/\s+/g, "_")}_${hoy()}.xlsx`
  );
}

/** Informe PDF de un evento, con aspecto de documento corporativo */
export async function exportarEventoPdf(
  e: EventoVista,
  material: MaterialPop[],
  gastos: Gasto[],
  participacion: Participacion[],
  resultado: Resultado | undefined,
  anexos: Anexo[]
) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  const ROJO: [number, number, number] = [208, 52, 44];
  const NEGRO: [number, number, number] = [20, 20, 20];

  // Cabecera
  doc.setFillColor(...NEGRO);
  doc.rect(0, 0, W, 78, "F");
  doc.setFillColor(...ROJO);
  doc.rect(0, 78, W, 4, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold").setFontSize(17);
  doc.text(e.nombre, M, 36, { maxWidth: W - M * 2 - 90 });
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.setTextColor(200, 200, 200);
  doc.text(
    `${fechaLarga(e.fecha)} · ${e.dia}${e.ciudad ? ` · ${e.ciudad}` : ""}`,
    M, 55
  );
  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("CHOHO", W - M, 30, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text("Informe de evento", W - M, 43, { align: "right" });
  doc.text(e.codigo, W - M, 55, { align: "right" });

  let y = 104;

  const seccion = (titulo: string) => {
    doc.setFont("helvetica", "bold").setFontSize(10);
    doc.setTextColor(...ROJO);
    doc.text(titulo.toUpperCase(), M, y);
    doc.setDrawColor(226, 226, 224);
    doc.line(M, y + 5, W - M, y + 5);
    y += 18;
  };

  const pares = (items: [string, string][]) => {
    doc.setFontSize(9);
    const col = (W - M * 2) / 2;
    items.forEach(([k, v], i) => {
      const x = M + (i % 2) * col;
      const fy = y + Math.floor(i / 2) * 26;
      doc.setFont("helvetica", "normal").setTextColor(130, 130, 130);
      doc.text(k, x, fy);
      doc.setFont("helvetica", "bold").setTextColor(...NEGRO);
      doc.text(v || "—", x, fy + 12, { maxWidth: col - 12 });
    });
    y += Math.ceil(items.length / 2) * 26 + 8;
  };

  seccion("Información general");
  pares([
    ["Evento", e.nombre],
    ["Fecha", `${fechaCorta(e.fecha)} · ${e.dia}`],
    ["Ciudad", e.ciudad ?? "—"],
    ["Lugar / negocio", e.lugar_negocio ?? "—"],
    ["Dirección", e.direccion ?? "—"],
    ["Cliente", e.cliente ?? "—"],
    ["Tipo de evento", e.tipo_evento ?? "—"],
    ["Responsable", e.responsable ?? "—"],
    ["Estado", e.estado],
    ["Asistentes", `${e.asistentes !== null ? num(e.asistentes) : "—"} de ${e.asistentes_esperados !== null ? num(e.asistentes_esperados) : "—"} esperados`],
  ]);

  // Resumen de gasto
  seccion("Gasto del evento");
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [["Concepto", "Valor"]],
    body: [
      ["Gasto POP (material llevado × costo unitario)", money(e.gasto_pop)],
      ["Gastos adicionales", money(e.gastos_adicionales)],
    ],
    foot: [["GASTO TOTAL", money(e.gasto_total)]],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: NEGRO, textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [253, 236, 235], textColor: ROJO, fontStyle: "bold" },
    columnStyles: { 1: { halign: "right", cellWidth: 120 } },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22;

  if (material.length) {
    seccion("Material POP");
    autoTable(doc, {
      startY: y, margin: { left: M, right: M },
      head: [["Material", "Llevado", "Utilizado", "Sobrante", "% Util.", "Costo unit.", "Gasto"]],
      body: material.map((m) => [
        m.material, num(m.cantidad_llevada), num(m.cantidad_utilizada),
        num(m.cantidad_sobrante), pct(m.pct_utilizacion, 1),
        money(m.costo_unitario), money(m.gasto_material),
      ]),
      foot: [[
        "TOTAL",
        num(material.reduce((a, m) => a + m.cantidad_llevada, 0)),
        num(material.reduce((a, m) => a + m.cantidad_utilizada, 0)),
        num(material.reduce((a, m) => a + m.cantidad_sobrante, 0)),
        "", "", money(e.gasto_pop),
      ]],
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 4 },
      headStyles: { fillColor: NEGRO, textColor: 255 },
      footStyles: { fillColor: [244, 244, 243], textColor: NEGRO, fontStyle: "bold" },
      columnStyles: {
        1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" },
        4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" },
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22;
  }

  if (participacion.length) {
    seccion("Personal");
    autoTable(doc, {
      startY: y, margin: { left: M, right: M },
      head: [["Persona", "Rol", "Confirmado", "Asistió", "Ingreso", "Salida", "Horas"]],
      body: participacion.map((p) => [
        p.persona_nombre, p.rol_funcion ?? "—", p.confirmado, p.asistio,
        horaCorta(p.hora_ingreso), horaCorta(p.hora_salida),
        p.horas !== null ? String(p.horas) : "—",
      ]),
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 4 },
      headStyles: { fillColor: NEGRO, textColor: 255 },
      columnStyles: { 6: { halign: "right" } },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22;
  }

  if (gastos.length) {
    seccion("Gastos adicionales");
    autoTable(doc, {
      startY: y, margin: { left: M, right: M },
      head: [["Categoría", "Descripción", "Proveedor", "Responsable", "Valor"]],
      body: gastos.map((g) => [
        g.categoria ?? "—", g.descripcion ?? "—", g.proveedor ?? "—",
        g.responsable ?? "—", money(g.valor),
      ]),
      foot: [["TOTAL", "", "", "", money(e.gastos_adicionales)]],
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 4 },
      headStyles: { fillColor: NEGRO, textColor: 255 },
      footStyles: { fillColor: [244, 244, 243], textColor: NEGRO, fontStyle: "bold" },
      columnStyles: { 4: { halign: "right", cellWidth: 80 } },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22;
  }

  if (resultado) {
    if (y > 640) { doc.addPage(); y = 60; }
    seccion("Resultados");
    pares([
      ["Asistentes", resultado.asistentes !== null ? num(resultado.asistentes) : "—"],
      ["Clientes atendidos", resultado.clientes_atendidos !== null ? num(resultado.clientes_atendidos) : "—"],
    ]);
    const texto = (t: string, v: string | null) => {
      if (!v) return;
      doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(130, 130, 130);
      doc.text(t, M, y);
      doc.setTextColor(...NEGRO);
      const lineas = doc.splitTextToSize(v, W - M * 2);
      doc.text(lineas, M, y + 12);
      y += 12 + lineas.length * 11 + 10;
    };
    texto("Resultado comercial", resultado.resultado_comercial);
    texto("Observaciones", resultado.observaciones);
    texto("Aprendizajes", resultado.aprendizajes);
  }

  if (anexos.length) {
    if (y > 700) { doc.addPage(); y = 60; }
    seccion("Anexos");
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...NEGRO);
    doc.text(
      `${anexos.length} archivo${anexos.length === 1 ? "" : "s"} adjunto${anexos.length === 1 ? "" : "s"}: ` +
        anexos.map((a) => a.nombre).join(", "),
      M, y, { maxWidth: W - M * 2 }
    );
  }

  // Pie en todas las páginas
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    const H = doc.internal.pageSize.getHeight();
    doc.setDrawColor(226, 226, 224);
    doc.line(M, H - 34, W - M, H - 34);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(150, 150, 150);
    doc.text(`CHOHO · Informe de evento ${e.codigo} · generado el ${fechaCorta(hoy())}`, M, H - 20);
    doc.text(`${i} / ${paginas}`, W - M, H - 20, { align: "right" });
  }

  doc.save(`CHOHO_${e.codigo}_${e.nombre.replace(/\s+/g, "_")}.pdf`);
}
