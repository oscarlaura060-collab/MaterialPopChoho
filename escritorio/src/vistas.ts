/**
 * Columnas calculadas. Es la traducción exacta de las vistas SQL del
 * proyecto web (eventos/supabase/migrations/0002_vistas.sql), que a su vez
 * reproducen las fórmulas de EVENTOS REALIZADOS.xlsx.
 *
 *   UTILIZADA      = LLEVADA − SOBRANTE
 *   % UTILIZACIÓN  = UTILIZADA / LLEVADA
 *   GASTO MATERIAL = UTILIZADA × COSTO UNITARIO   (solo lo consumido)
 *   VALOR LLEVADO  = LLEVADA  × COSTO UNITARIO    (lo movilizado, informativo)
 *   GASTO POP      = Σ GASTO MATERIAL del evento
 *   GASTO TOTAL    = GASTO POP + Σ VALOR de los gastos adicionales
 *   HORAS          = MOD(SALIDA − INGRESO)
 */
import type { Registro, Tablas } from "./archivos";

const DIAS = ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO", "DOMINGO"];

const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const nn = (v: unknown): number | null =>
  v === null || v === undefined || v === "" ? null : n(v);

/** Día de la semana sin desfase de zona horaria (la fecha es AAAA-MM-DD puro) */
function diaSemana(iso: string): string {
  const [a, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!a || !m || !d) return "";
  const dow = new Date(Date.UTC(a, m - 1, d)).getUTCDay();  // 0 = domingo
  return DIAS[(dow + 6) % 7];                                // ISO: 0 = lunes
}

/** Segundos desde medianoche de una hora "HH:MM" o "HH:MM:SS" */
function segundos(t: unknown): number | null {
  if (!t) return null;
  const m = String(t).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] ?? 0);
}

/** MOD(salida − ingreso, 1 día): admite turnos que cruzan la medianoche */
export function horasTrabajadas(ingreso: unknown, salida: unknown): number | null {
  const a = segundos(ingreso), b = segundos(salida);
  if (a === null || b === null) return null;
  return Math.round((((b - a + 86400) % 86400) / 3600) * 100) / 100;
}

/** Costo unitario del catálogo cuando la fila no trae uno propio */
export function costoDelCatalogo(t: Tablas, material: string, propio?: unknown): number {
  const c = n(propio);
  if (c > 0) return c;
  const m = t.materiales.find(
    (x) => String(x.nombre ?? "").toUpperCase() === String(material ?? "").toUpperCase()
  );
  return n(m?.costo_unitario);
}

/* ---------- MATERIAL POP ---------- */

export function materialPop(t: Tablas): Registro[] {
  const evPorId = new Map(t.eventos.map((e) => [e.id, e]));
  return t.material_pop.map((m) => {
    const llevada = n(m.cantidad_llevada);
    const sobrante = n(m.cantidad_sobrante);
    const utilizada = llevada - sobrante;
    const costo = costoDelCatalogo(t, String(m.material ?? ""), m.costo_unitario);
    const e = evPorId.get(m.evento_id) ?? {};
    return {
      ...m,
      cantidad_llevada: llevada,
      cantidad_sobrante: sobrante,
      cantidad_utilizada: utilizada,
      pct_utilizacion: llevada > 0 ? utilizada / llevada : null,
      costo_unitario: costo,
      gasto_material: utilizada * costo,
      valor_llevado: llevada * costo,
      evento_codigo: e.codigo ?? "",
      evento_nombre: e.nombre ?? "",
      evento_fecha: e.fecha ?? "",
      evento_ciudad: e.ciudad ?? null,
      evento_tipo: e.tipo_evento ?? null,
      evento_estado: e.estado ?? "",
      evento_responsable: e.responsable ?? null,
    };
  });
}

/* ---------- GASTOS ---------- */

export function gastos(t: Tablas): Registro[] {
  const evPorId = new Map(t.eventos.map((e) => [e.id, e]));
  return t.gastos.map((g) => {
    const e = evPorId.get(g.evento_id) ?? {};
    return {
      ...g,
      valor: n(g.valor),
      evento_codigo: e.codigo ?? "",
      evento_nombre: e.nombre ?? "",
      evento_fecha: e.fecha ?? "",
      evento_ciudad: e.ciudad ?? null,
      evento_tipo: e.tipo_evento ?? null,
      evento_estado: e.estado ?? "",
    };
  });
}

/* ---------- PARTICIPACIÓN ---------- */

export function participacion(t: Tablas): Registro[] {
  const evPorId = new Map(t.eventos.map((e) => [e.id, e]));
  return t.participacion.map((p) => {
    const e = evPorId.get(p.evento_id) ?? {};
    return {
      ...p,
      horas: horasTrabajadas(p.hora_ingreso, p.hora_salida),
      evento_codigo: e.codigo ?? "",
      evento_nombre: e.nombre ?? "",
      evento_fecha: e.fecha ?? "",
      evento_estado: e.estado ?? "",
    };
  });
}

/* ---------- RESULTADOS ---------- */

export function resultados(t: Tablas): Registro[] {
  const evPorId = new Map(t.eventos.map((e) => [e.id, e]));
  return t.resultados.map((r) => {
    const e = evPorId.get(r.evento_id) ?? {};
    return {
      ...r,
      evento_codigo: e.codigo ?? "",
      evento_nombre: e.nombre ?? "",
      evento_fecha: e.fecha ?? "",
      evento_ciudad: e.ciudad ?? null,
      evento_estado: e.estado ?? "",
    };
  });
}

/* ---------- EVENTOS ---------- */

export function eventos(t: Tablas): Registro[] {
  const mat = materialPop(t);
  const porEvento = <T extends Registro>(filas: T[]) => {
    const m = new Map<unknown, T[]>();
    for (const f of filas) {
      const k = f.evento_id;
      const a = m.get(k);
      if (a) a.push(f); else m.set(k, [f]);
    }
    return m;
  };
  const matDe = porEvento(mat);
  const gasDe = porEvento(t.gastos);
  const parDe = porEvento(t.participacion);
  const anxDe = porEvento(t.anexos);
  const resDe = new Map(t.resultados.map((r) => [r.evento_id, r]));

  return t.eventos.map((e) => {
    const ms = matDe.get(e.id) ?? [];
    const gs = gasDe.get(e.id) ?? [];
    const ps = parDe.get(e.id) ?? [];
    const r = resDe.get(e.id);

    const gastoPop = ms.reduce((a, m) => a + n(m.gasto_material), 0);
    const valorLlevado = ms.reduce((a, m) => a + n(m.valor_llevado), 0);
    const gastosAdic = gs.reduce((a, g) => a + n(g.valor), 0);

    const asignado = ps.length;
    const confirmados = ps.filter((p) => p.confirmado === "SÍ").length;
    const noVan = ps.filter((p) => p.confirmado === "NO").length;
    const asistieron = ps.filter((p) => p.asistio === "SÍ").length;
    const noAsistieron = ps.filter((p) => p.asistio === "NO").length;

    const fecha = String(e.fecha ?? "").slice(0, 10);
    const [anio, mes] = fecha.split("-").map(Number);

    return {
      ...e,
      anio: anio || 0,
      mes: mes || 0,
      dia: diaSemana(fecha),
      gasto_pop: gastoPop,
      pop_valor_llevado: valorLlevado,
      gastos_adicionales: gastosAdic,
      gasto_total: gastoPop + gastosAdic,
      pop_llevado: ms.reduce((a, m) => a + n(m.cantidad_llevada), 0),
      pop_utilizado: ms.reduce((a, m) => a + n(m.cantidad_utilizada), 0),
      pop_sobrante: ms.reduce((a, m) => a + n(m.cantidad_sobrante), 0),
      personal_asignado: asignado,
      confirmados,
      pendientes: asignado - confirmados,
      no_van: noVan,
      asistieron,
      no_asistieron: noAsistieron,
      pct_asistencia:
        asistieron + noAsistieron > 0 ? asistieron / (asistieron + noAsistieron) : null,
      asistentes: r ? nn(r.asistentes) : null,
      clientes_atendidos: r ? nn(r.clientes_atendidos) : null,
      n_anexos: (anxDe.get(e.id) ?? []).length,
    };
  });
}

/* ---------- PERSONAL ---------- */

export function personal(t: Tablas): Registro[] {
  return t.personas.map((pe) => {
    // El Excel cruza por NOMBRE, no por ID
    const ps = t.participacion.filter((p) => p.persona_nombre === pe.nombre);
    const asignados = ps.length;
    const confirmados = ps.filter((p) => p.confirmado === "SÍ").length;
    const asistidos = ps.filter((p) => p.asistio === "SÍ").length;
    const noAsistio = ps.filter((p) => p.asistio === "NO").length;
    return {
      ...pe,
      eventos_asignados: asignados,
      confirmados,
      pendientes: asignados - confirmados,
      no_va: ps.filter((p) => p.confirmado === "NO").length,
      asistidos,
      no_asistio: noAsistio,
      pct_asistencia:
        asistidos + noAsistio > 0 ? asistidos / (asistidos + noAsistio) : null,
      horas_totales: ps.reduce(
        (a, p) => a + (horasTrabajadas(p.hora_ingreso, p.hora_salida) ?? 0), 0
      ),
    };
  });
}

/** Siguiente código disponible: EV-004, EV-005, … */
export function siguienteCodigo(t: Tablas): string {
  const max = t.eventos.reduce((a, e) => {
    const d = String(e.codigo ?? "").replace(/\D/g, "");
    return d ? Math.max(a, Number(d)) : a;
  }, 0);
  return "EV-" + String(max + 1).padStart(3, "0");
}

/** Todas las vistas que consume la aplicación */
export function calcular(t: Tablas) {
  return {
    v_eventos: eventos(t),
    v_personal: personal(t),
    v_participacion: participacion(t),
    v_material_pop: materialPop(t),
    v_gastos: gastos(t),
    v_resultados: resultados(t),
  };
}
