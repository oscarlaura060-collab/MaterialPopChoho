"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Filtros } from "@/components/filtros";
import { Fila, Kpi } from "@/components/kpi";
import { Encabezado } from "@/components/shell";
import { Columna, Tabla } from "@/components/tabla";
import { Badge, Vacio } from "@/components/ui";
import { NEUTRO, SERIES } from "@/lib/constants";
import { NUM1, fechaCorta, money, num, pct } from "@/lib/format";
import { useApp } from "@/lib/store";
import type { MaterialPop } from "@/lib/types";
import { exportarHoja } from "@/lib/exportar";

export default function MaterialPage() {
  const { datos, idsFiltrados, eventosFiltrados, cargando } = useApp();
  const router = useRouter();

  const filas = useMemo(
    () => datos.material
      .filter((m) => idsFiltrados.has(m.evento_id))
      .sort((a, b) => b.evento_fecha.localeCompare(a.evento_fecha)),
    [datos.material, idsFiltrados]
  );

  /** Consolidado por material: cuánto se llevó y se usó de cada uno en total. */
  const porMaterial = useMemo(() => {
    const m = new Map<string, {
      material: string; llevada: number; utilizada: number; sobrante: number;
      gasto: number; valorLlevado: number; costo: number; eventos: Set<string>;
    }>();
    for (const x of filas) {
      const f = m.get(x.material) ?? {
        material: x.material, llevada: 0, utilizada: 0, sobrante: 0,
        gasto: 0, valorLlevado: 0, costo: x.costo_unitario, eventos: new Set<string>(),
      };
      f.llevada += x.cantidad_llevada;
      f.utilizada += x.cantidad_utilizada;
      f.sobrante += x.cantidad_sobrante;
      f.gasto += x.gasto_material;
      f.valorLlevado += x.valor_llevado;
      f.costo = x.costo_unitario || f.costo;
      f.eventos.add(x.evento_id);
      m.set(x.material, f);
    }
    return [...m.values()]
      .map((f) => ({
        ...f,
        nEventos: f.eventos.size,
        pct: f.llevada > 0 ? f.utilizada / f.llevada : null,
        promedio: f.eventos.size > 0 ? f.utilizada / f.eventos.size : 0,
      }))
      .sort((a, b) => b.utilizada - a.utilizada);
  }, [filas]);

  const tot = useMemo(() => {
    const s = (f: (m: MaterialPop) => number) => filas.reduce((a, m) => a + f(m), 0);
    const llevada = s((m) => m.cantidad_llevada);
    return {
      llevada,
      utilizada: s((m) => m.cantidad_utilizada),
      sobrante: s((m) => m.cantidad_sobrante),
      gasto: s((m) => m.gasto_material),
      valorLlevado: s((m) => m.valor_llevado),
      util: llevada > 0 ? s((m) => m.cantidad_utilizada) / llevada : null,
    };
  }, [filas]);

  const columnas: Columna<MaterialPop>[] = [
    { clave: "evento", titulo: "Evento", orden: (m) => m.evento_fecha,
      celda: (m) => (
        <div className="min-w-[150px]">
          <p className="font-semibold text-neutral-900">{m.evento_nombre}</p>
          <p className="text-xs text-neutral-500">
            <span className="font-mono">{m.evento_codigo}</span> · {fechaCorta(m.evento_fecha)}
          </p>
        </div>
      ) },
    { clave: "ciudad", titulo: "Ciudad", orden: (m) => m.evento_ciudad ?? "", soloEscritorio: true,
      celda: (m) => m.evento_ciudad ?? "—" },
    { clave: "material", titulo: "Material", orden: (m) => m.material,
      celda: (m) => <span className="font-medium">{m.material}</span> },
    { clave: "llevada", titulo: "Llevada", alinear: "der", orden: (m) => m.cantidad_llevada,
      celda: (m) => num(m.cantidad_llevada) },
    { clave: "utilizada", titulo: "Utilizada", alinear: "der", orden: (m) => m.cantidad_utilizada,
      celda: (m) => num(m.cantidad_utilizada) },
    { clave: "sobrante", titulo: "Sobrante", alinear: "der", orden: (m) => m.cantidad_sobrante,
      celda: (m) => num(m.cantidad_sobrante) },
    { clave: "pct", titulo: "% Utilización", alinear: "der", orden: (m) => m.pct_utilizacion ?? -1,
      celda: (m) => (
        <div className="flex items-center justify-end gap-2">
          <span className="hidden h-1.5 w-14 overflow-hidden rounded-full sm:block"
                style={{ background: NEUTRO }} aria-hidden>
            <span className="block h-full rounded-full"
                  style={{ width: `${Math.min(100, (m.pct_utilizacion ?? 0) * 100)}%`, background: SERIES.s1 }} />
          </span>
          <span className="font-semibold tabular-nums">{pct(m.pct_utilizacion, 1)}</span>
        </div>
      ) },
    { clave: "costo", titulo: "Costo unit.", alinear: "der", orden: (m) => m.costo_unitario,
      soloEscritorio: true, celda: (m) => <span className="text-neutral-500">{money(m.costo_unitario)}</span> },
    { clave: "gasto", titulo: "Gasto (utilizado)", alinear: "der", orden: (m) => m.gasto_material,
      celda: (m) => <span className="font-semibold">{money(m.gasto_material)}</span> },
    { clave: "estado", titulo: "Estado", soloEscritorio: true, orden: (m) => m.evento_estado,
      celda: (m) => <Badge estado={m.evento_estado} /> },
  ];

  if (cargando) return null;

  return (
    <>
      <Encabezado
        titulo="Material POP"
        descripcion="Utilizado = llevado − sobrante · Gasto = utilizado × costo unitario. Lo sobrante vuelve a bodega y no se cobra al evento."
        acciones={
          <button className="btn-secundario" disabled={!filas.length}
            onClick={() => exportarHoja("MATERIAL POP",
              ["ID EVENTO", "EVENTO", "FECHA", "MATERIAL POP", "CANTIDAD LLEVADA", "CANTIDAD UTILIZADA",
               "CANTIDAD SOBRANTE", "% UTILIZACIÓN", "COSTO UNITARIO", "GASTO MATERIAL", "OBSERVACIONES"],
              filas.map((m) => [
                m.evento_codigo, m.evento_nombre, fechaCorta(m.evento_fecha), m.material,
                m.cantidad_llevada, m.cantidad_utilizada, m.cantidad_sobrante,
                m.pct_utilizacion, m.costo_unitario, m.gasto_material, m.observaciones,
              ]), { H: "0.0%", I: '"$"#,##0', J: '"$"#,##0' })}>
            ⬇ Excel
          </button>
        }
      />

      <Filtros />

      <div className="mb-5">
        <Fila>
          <Kpi etiqueta="Piezas llevadas" icono="📦" valor={num(tot.llevada)} />
          <Kpi etiqueta="Piezas utilizadas" icono="✅" valor={num(tot.utilizada)} />
          <Kpi etiqueta="Piezas sobrantes" icono="📤" valor={num(tot.sobrante)} />
          <Kpi etiqueta="Utilización global" icono="📊" valor={pct(tot.util, 1)}
               apoyo="Utilizadas / llevadas" />
          <Kpi etiqueta="Gasto POP" icono="💰" valor={money(tot.gasto)} acento
               apoyo={`Movilizado ${money(tot.valorLlevado)}`} />
        </Fila>
      </div>

      {porMaterial.length > 0 && (
        <section className="card mb-5 overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3 sm:px-5">
            <div>
              <h2 className="text-sm font-bold text-neutral-900">Total por material</h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                Consolidado de {porMaterial.length} material{porMaterial.length === 1 ? "" : "es"}
                {" "}en {eventosFiltrados.length} evento{eventosFiltrados.length === 1 ? "" : "s"}
              </p>
            </div>
            <button className="btn-secundario px-2.5 py-1.5 text-xs"
              onClick={() => exportarHoja("RESUMEN MATERIAL POP",
                ["MATERIAL POP", "EVENTOS", "CANTIDAD LLEVADA", "CANTIDAD UTILIZADA",
                 "CANTIDAD SOBRANTE", "% UTILIZACIÓN", "PROMEDIO POR EVENTO",
                 "COSTO UNITARIO", "VALOR LLEVADO", "GASTO MATERIAL"],
                porMaterial.map((m) => [
                  m.material, m.nEventos, m.llevada, m.utilizada, m.sobrante,
                  m.pct, Math.round(m.promedio * 10) / 10, m.costo,
                  m.valorLlevado, m.gasto,
                ]), { F: "0.0%", H: '"$"#,##0', I: '"$"#,##0', J: '"$"#,##0' })}>
              ⬇ Excel
            </button>
          </header>

          <div className="overflow-x-auto scroll-fino">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="th">Material</th>
                  <th className="th text-right">Eventos</th>
                  <th className="th text-right">Llevado</th>
                  <th className="th text-right">Utilizado</th>
                  <th className="th text-right">Sobrante</th>
                  <th className="th text-right">% Utilización</th>
                  <th className="th hidden text-right lg:table-cell">Promedio por evento</th>
                  <th className="th hidden text-right lg:table-cell">Costo unit.</th>
                  <th className="th hidden text-right lg:table-cell">Valor llevado</th>
                  <th className="th text-right">Gasto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {porMaterial.map((m) => (
                  <tr key={m.material}>
                    <td className="td font-semibold">{m.material}</td>
                    <td className="td text-right tabular-nums text-neutral-500">{num(m.nEventos)}</td>
                    <td className="td text-right tabular-nums">{num(m.llevada)}</td>
                    <td className="td text-right text-base font-bold tabular-nums">{num(m.utilizada)}</td>
                    <td className="td text-right tabular-nums">{num(m.sobrante)}</td>
                    <td className="td text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="hidden h-1.5 w-16 overflow-hidden rounded-full sm:block"
                              style={{ background: NEUTRO }} aria-hidden>
                          <span className="block h-full rounded-full"
                                style={{ width: `${Math.min(100, (m.pct ?? 0) * 100)}%`, background: SERIES.s1 }} />
                        </span>
                        <span className="font-semibold tabular-nums">{pct(m.pct, 1)}</span>
                      </div>
                    </td>
                    <td className="td hidden text-right tabular-nums text-neutral-600 lg:table-cell">
                      {NUM1.format(m.promedio)}
                    </td>
                    <td className="td hidden text-right tabular-nums text-neutral-500 lg:table-cell">
                      {money(m.costo)}
                    </td>
                    <td className="td hidden text-right tabular-nums text-neutral-500 lg:table-cell">
                      {money(m.valorLlevado)}
                    </td>
                    <td className="td text-right font-semibold tabular-nums">{money(m.gasto)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-neutral-200 bg-neutral-50">
                <tr>
                  <td className="td font-bold">TOTAL</td>
                  <td className="td text-right font-bold tabular-nums">{num(eventosFiltrados.length)}</td>
                  <td className="td text-right font-bold tabular-nums">{num(tot.llevada)}</td>
                  <td className="td text-right text-base font-bold tabular-nums">{num(tot.utilizada)}</td>
                  <td className="td text-right font-bold tabular-nums">{num(tot.sobrante)}</td>
                  <td className="td text-right font-bold tabular-nums">{pct(tot.util, 1)}</td>
                  <td className="td hidden lg:table-cell" />
                  <td className="td hidden lg:table-cell" />
                  <td className="td hidden text-right font-bold tabular-nums text-neutral-500 lg:table-cell">
                    {money(tot.valorLlevado)}
                  </td>
                  <td className="td text-right font-bold tabular-nums">{money(tot.gasto)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      <div className="card overflow-hidden">
        <header className="border-b border-neutral-200 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-bold text-neutral-900">Detalle por evento</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Cada fila es un material en un evento. Toca una fila para abrir el evento.
          </p>
        </header>
        <Tabla
          columnas={columnas}
          filas={filas}
          claveFila={(m) => m.id}
          onFila={(m) => router.push(`/eventos/${m.evento_codigo}`)}
          vacio={<Vacio icono="📦" titulo="Sin material POP con estos filtros" />}
        />
      </div>
    </>
  );
}
