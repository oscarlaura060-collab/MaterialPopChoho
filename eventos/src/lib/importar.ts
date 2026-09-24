"use client";

import { supabase } from "./supabase";

export interface ResumenImportacion {
  eventos: { nuevos: number; actualizados: number };
  personas: number;
  material: number;
  gastos: number;
  participacion: number;
  resultados: number;
  materiales: number;
  avisos: string[];
}

type Celda = string | number | boolean | Date | null | undefined;
type FilaHoja = Record<string, Celda>;

const texto = (v: Celda): string | null => {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  return s === "" ? null : s;
};

const numero = (v: Celda): number => {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  // Formato colombiano: 1.234.567,89 → 1234567.89
  const s = String(v).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const numeroONulo = (v: Celda): number | null => {
  const t = texto(v);
  return t === null ? null : numero(v);
};

/** Fecha de Excel (serial o texto) → YYYY-MM-DD */
function fecha(v: Celda): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) {
    return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()))
      .toISOString().slice(0, 10);
  }
  if (typeof v === "number") {
    // Serial de Excel: día 1 = 1900-01-01, con el bug del año bisiesto de 1900
    const ms = Math.round((v - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/); // dd/mm/yyyy
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** Hora de Excel (fracción de día o texto) → HH:MM:SS */
function hora(v: Celda): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(11, 19);
  if (typeof v === "number") {
    const seg = Math.round((v % 1) * 86400);
    const h = String(Math.floor(seg / 3600)).padStart(2, "0");
    const m = String(Math.floor((seg % 3600) / 60)).padStart(2, "0");
    return `${h}:${m}:00`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}:${m[3] ?? "00"}` : null;
}

const siNo = (v: Celda): "SÍ" | "NO" | "PENDIENTE" => {
  const s = (texto(v) ?? "").toUpperCase();
  if (["SÍ", "SI", "S", "X", "TRUE", "VERDADERO", "1"].includes(s)) return "SÍ";
  if (["NO", "N", "FALSE", "FALSO", "0"].includes(s)) return "NO";
  return "PENDIENTE";
};

/**
 * Lee una hoja buscando la fila de encabezados (el Excel tiene títulos
 * decorativos arriba) y devuelve objetos con esos encabezados como claves.
 */
function leerHoja(hoja: import("exceljs").Worksheet, clavesEsperadas: string[]): FilaHoja[] {
  let filaEnc = 0;
  let encabezados: string[] = [];

  for (let r = 1; r <= Math.min(hoja.rowCount, 12); r++) {
    const vals = (hoja.getRow(r).values as Celda[]).map((v) =>
      typeof v === "object" && v !== null && "result" in (v as object)
        ? String((v as unknown as { result: unknown }).result ?? "")
        : String(v ?? "")
    );
    const norm = vals.map((s) => s.trim().toUpperCase());
    const aciertos = clavesEsperadas.filter((k) => norm.includes(k)).length;
    if (aciertos >= Math.min(2, clavesEsperadas.length)) {
      filaEnc = r;
      encabezados = norm;
      break;
    }
  }
  if (!filaEnc) return [];

  const filas: FilaHoja[] = [];
  for (let r = filaEnc + 1; r <= hoja.rowCount; r++) {
    const fila = hoja.getRow(r);
    const obj: FilaHoja = {};
    let vacia = true;
    encabezados.forEach((h, i) => {
      if (!h) return;
      const celda = fila.getCell(i);
      // Si la celda es fórmula se toma su resultado, no la fórmula
      const v = (celda.value && typeof celda.value === "object" && "result" in celda.value)
        ? (celda.value as { result: Celda }).result
        : (celda.value as Celda);
      obj[h] = v;
      if (v !== null && v !== undefined && String(v).trim() !== "") vacia = false;
    });
    if (!vacia) filas.push(obj);
  }
  return filas;
}

/**
 * Importa EVENTOS REALIZADOS.xlsx. Cruza por ID EVENTO, así que volver a
 * cargar el mismo archivo actualiza en vez de duplicar.
 */
export async function importarExcel(archivo: File): Promise<ResumenImportacion> {
  const ExcelJS = (await import("exceljs")).default;
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await archivo.arrayBuffer());

  const r: ResumenImportacion = {
    eventos: { nuevos: 0, actualizados: 0 },
    personas: 0, material: 0, gastos: 0, participacion: 0,
    resultados: 0, materiales: 0, avisos: [],
  };

  const hoja = (nombre: string) =>
    libro.worksheets.find(
      (w) => w.name.trim().toUpperCase() === nombre.toUpperCase()
    );

  // ---------- LISTAS: catálogo de materiales con su costo ----------
  const hListas = hoja("LISTAS");
  if (hListas) {
    const filas = leerHoja(hListas, ["MATERIAL POP", "COSTO UNITARIO"]);
    const mats = filas
      .map((f) => ({ nombre: texto(f["MATERIAL POP"]), costo_unitario: numero(f["COSTO UNITARIO"]) }))
      .filter((m): m is { nombre: string; costo_unitario: number } => !!m.nombre);
    if (mats.length) {
      const { error } = await supabase.from("materiales")
        .upsert(mats, { onConflict: "nombre" });
      if (error) r.avisos.push(`Materiales: ${error.message}`);
      else r.materiales = mats.length;
    }
  } else r.avisos.push('No se encontró la hoja "LISTAS".');

  // ---------- PERSONAL ----------
  const hPersonal = hoja("PERSONAL");
  if (hPersonal) {
    const filas = leerHoja(hPersonal, ["NOMBRE", "ID PERSONA"]);
    const personas = filas
      .map((f) => ({
        codigo: texto(f["ID PERSONA"]),
        nombre: texto(f["NOMBRE"]),
        cargo_area: texto(f["CARGO / ÁREA"]),
        activo: siNo(f["ACTIVO"]) !== "NO",
        observaciones: texto(f["OBSERVACIONES"]),
      }))
      .filter((p) => p.nombre);
    // El Excel repite ID PERSONA en varias filas: el nombre es la clave real
    const unicos = [...new Map(personas.map((p) => [p.nombre, p])).values()];
    if (unicos.length) {
      const { error } = await supabase.from("personas")
        .upsert(unicos, { onConflict: "nombre" });
      if (error) r.avisos.push(`Personal: ${error.message}`);
      else r.personas = unicos.length;
    }
  } else r.avisos.push('No se encontró la hoja "PERSONAL".');

  // ---------- EVENTOS ----------
  const hEventos = hoja("EVENTOS");
  if (!hEventos) {
    r.avisos.push('No se encontró la hoja "EVENTOS": no se importó nada más.');
    return r;
  }

  const { data: previos } = await supabase.from("eventos").select("id, codigo");
  const existentes = new Map((previos ?? []).map((e) => [e.codigo as string, e.id as string]));

  const filasEv = leerHoja(hEventos, ["ID EVENTO", "EVENTO", "FECHA"]);
  const eventos = filasEv
    .map((f) => ({
      codigo: texto(f["ID EVENTO"])?.toUpperCase() ?? null,
      nombre: texto(f["EVENTO"]),
      fecha: fecha(f["FECHA"]),
      ciudad: texto(f["CIUDAD"]),
      lugar_negocio: texto(f["LUGAR / NEGOCIO"]),
      direccion: texto(f["DIRECCIÓN"]),
      cliente: texto(f["CLIENTE"]),
      tipo_evento: texto(f["TIPO DE EVENTO"]),
      responsable: texto(f["RESPONSABLE"]),
      estado: texto(f["ESTADO"]) ?? "PLANIFICADO",
      asistentes_esperados: numeroONulo(f["ASISTENTES ESPERADOS"]),
      observaciones: texto(f["OBSERVACIONES"]),
    }))
    .filter((e) => e.codigo && e.nombre && e.fecha);

  if (!eventos.length) {
    r.avisos.push('La hoja "EVENTOS" no tiene filas con ID EVENTO, EVENTO y FECHA.');
    return r;
  }

  const { error: eEv } = await supabase.from("eventos")
    .upsert(eventos as never[], { onConflict: "codigo" });
  if (eEv) {
    r.avisos.push(`Eventos: ${eEv.message}`);
    return r;
  }
  for (const e of eventos) {
    if (existentes.has(e.codigo!)) r.eventos.actualizados++;
    else r.eventos.nuevos++;
  }

  // Mapa código → id ya con los recién creados
  const { data: todos } = await supabase.from("eventos").select("id, codigo");
  const idDe = new Map((todos ?? []).map((e) => [e.codigo as string, e.id as string]));
  const idsImportados = eventos.map((e) => idDe.get(e.codigo!)).filter(Boolean) as string[];

  const { data: pers } = await supabase.from("personas").select("id, nombre");
  const idPersona = new Map((pers ?? []).map((p) => [p.nombre as string, p.id as string]));

  /** Las filas hijas se reemplazan por evento para no duplicar al reimportar */
  const reemplazar = async (tabla: string, filas: Record<string, unknown>[]) => {
    if (idsImportados.length) {
      await supabase.from(tabla).delete().in("evento_id", idsImportados);
    }
    if (!filas.length) return 0;
    const { error } = await supabase.from(tabla).insert(filas as never[]);
    if (error) { r.avisos.push(`${tabla}: ${error.message}`); return 0; }
    return filas.length;
  };

  // ---------- MATERIAL POP ----------
  const hMat = hoja("MATERIAL POP");
  if (hMat) {
    const filas = leerHoja(hMat, ["ID EVENTO", "MATERIAL POP", "CANTIDAD LLEVADA"]);
    const datos = filas
      .map((f) => {
        const cod = texto(f["ID EVENTO"])?.toUpperCase();
        const evento_id = cod ? idDe.get(cod) : undefined;
        const llevada = numero(f["CANTIDAD LLEVADA"]);
        // El Excel calcula UTILIZADA = LLEVADA − SOBRANTE; la fuente es SOBRANTE
        let sobrante = numeroONulo(f["CANTIDAD SOBRANTE"]);
        if (sobrante === null) {
          const util = numeroONulo(f["CANTIDAD UTILIZADA"]);
          sobrante = util === null ? 0 : llevada - util;
        }
        return {
          evento_id,
          material: texto(f["MATERIAL POP"]),
          cantidad_llevada: llevada,
          cantidad_sobrante: Math.max(0, Math.min(llevada, sobrante)),
          costo_unitario: numero(f["COSTO UNITARIO"]),
          observaciones: texto(f["OBSERVACIONES"]),
        };
      })
      .filter((m) => m.evento_id && m.material);
    r.material = await reemplazar("material_pop", datos);
  }

  // ---------- GASTOS ----------
  const hGas = hoja("GASTOS");
  if (hGas) {
    const filas = leerHoja(hGas, ["ID EVENTO", "CATEGORÍA", "VALOR"]);
    const datos = filas
      .map((f) => ({
        evento_id: idDe.get(texto(f["ID EVENTO"])?.toUpperCase() ?? ""),
        categoria: texto(f["CATEGORÍA"]),
        descripcion: texto(f["DESCRIPCIÓN"]),
        proveedor: texto(f["PROVEEDOR"]),
        responsable: texto(f["RESPONSABLE"]),
        valor: numero(f["VALOR"]),
        observaciones: texto(f["OBSERVACIONES"]),
      }))
      .filter((g) => g.evento_id);
    r.gastos = await reemplazar("gastos", datos);
  }

  // ---------- PARTICIPACIÓN ----------
  const hPar = hoja("PARTICIPACIÓN") ?? hoja("PARTICIPACION");
  if (hPar) {
    const filas = leerHoja(hPar, ["ID EVENTO", "PERSONA"]);
    const datos = filas
      .map((f) => {
        const nombre = texto(f["PERSONA"]);
        return {
          evento_id: idDe.get(texto(f["ID EVENTO"])?.toUpperCase() ?? ""),
          persona_id: nombre ? idPersona.get(nombre) ?? null : null,
          persona_nombre: nombre,
          confirmado: siNo(f["CONFIRMADO"]),
          asistio: siNo(f["ASISTIÓ"] ?? f["ASISTIO"]),
          rol_funcion: texto(f["ROL / FUNCIÓN"]),
          hora_ingreso: hora(f["HORA INGRESO"]),
          hora_salida: hora(f["HORA SALIDA"]),
          observaciones: texto(f["OBSERVACIONES"]),
        };
      })
      .filter((p) => p.evento_id && p.persona_nombre);
    // Una persona no puede repetirse dentro del mismo evento
    const unicas = [...new Map(datos.map((p) => [`${p.evento_id}|${p.persona_nombre}`, p])).values()];
    if (unicas.length < datos.length) {
      r.avisos.push(`Se omitieron ${datos.length - unicas.length} participaciones repetidas.`);
    }
    r.participacion = await reemplazar("participacion", unicas);
  }

  // ---------- RESULTADOS ----------
  const hRes = hoja("RESULTADOS");
  if (hRes) {
    const filas = leerHoja(hRes, ["ID EVENTO", "ASISTENTES"]);
    const datos = filas
      .map((f) => ({
        evento_id: idDe.get(texto(f["ID EVENTO"])?.toUpperCase() ?? ""),
        asistentes: numeroONulo(f["ASISTENTES"]),
        clientes_atendidos: numeroONulo(f["CLIENTES ATENDIDOS"]),
        resultado_comercial: texto(f["RESULTADO COMERCIAL"]),
        observaciones: texto(f["OBSERVACIONES"]),
        aprendizajes: texto(f["APRENDIZAJES"]),
      }))
      .filter((x) => x.evento_id)
      .filter((x) =>
        x.asistentes !== null || x.clientes_atendidos !== null ||
        x.resultado_comercial || x.observaciones || x.aprendizajes
      );
    const unicos = [...new Map(datos.map((x) => [x.evento_id, x])).values()];
    if (unicos.length) {
      const { error } = await supabase.from("resultados")
        .upsert(unicos as never[], { onConflict: "evento_id" });
      if (error) r.avisos.push(`Resultados: ${error.message}`);
      else r.resultados = unicos.length;
    }
  }

  if (hoja("RESUMEN EJECUTIVO")) {
    r.avisos.push(
      'La hoja "RESUMEN EJECUTIVO" no se importa: sus indicadores se recalculan ' +
      "en el Dashboard a partir de los datos."
    );
  }
  if (hoja("ANEXOS")) {
    r.avisos.push(
      'La hoja "ANEXOS" del Excel es un reporte de participación por persona; ' +
      "esa información ya está en la sección Personal. Las fotografías se suben " +
      "desde la ficha de cada evento."
    );
  }

  return r;
}
