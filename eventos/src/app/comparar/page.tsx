"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Filtros } from "@/components/filtros";
import { Encabezado } from "@/components/shell";
import { TablaDatos } from "@/components/tabla";
import { Badge, Grafico, Vacio } from "@/components/ui";
import { NEUTRO, SERIES } from "@/lib/constants";
import { fechaCorta, money, moneyCorto, num, pct } from "@/lib/format";
import { useApp } from "@/lib/store";
import { exportarHoja } from "@/lib/exportar";

/** Las magnitudes que se pueden comparar entre eventos. */
const METRICAS = [
  { clave: "gasto_total", texto: "Gasto total", tipo: "money" },
  { clave: "gasto_pop", texto: "Gasto POP", tipo: "money" },
  { clave: "gastos_adicionales", texto: "Gastos adicionales", tipo: "money" },
  { clave: "asistentes", texto: "Asistentes", tipo: "num" },
  { clave: "pop_utilizado", texto: "Material utilizado", tipo: "num" },
  { clave: "pct_util", texto: "% utilización del material", tipo: "pct" },
  { clave: "personal_asignado", texto: "Personal", tipo: "num" },
  { clave: "costo_asistente", texto: "Gasto por asistente", tipo: "money" },
] as const;

type ClaveMetrica = (typeof METRICAS)[number]["clave"];

export default function Comparar() {
  const { eventosFiltrados, cargando } = useApp();
  const router = useRouter();
  const [metrica, setMetrica] = useState<ClaveMetrica>("gasto_total");

  /** Un registro por evento con todo lo comparable ya calculado. */
  const filas = useMemo(
    () => eventosFiltrados.map((e) => ({
      ...e,
      pct_util: e.pop_llevado > 0 ? e.pop_utilizado / e.pop_llevado : null,
      costo_asistente: e.asistentes && e.asistentes > 0 ? e.gasto_total / e.asistentes : null,
    })),
    [eventosFiltrados]
  );

  const def = METRICAS.find((m) => m.clave === metrica)!;

  const formato = (v: number | null) =>
    v === null || v === undefined ? "—"
      : def.tipo === "money" ? money(v)
      : def.tipo === "pct" ? pct(v, 1)
      : num(v);

  const serie = useMemo(
    () => filas
      .map((e) => ({
        codigo: e.codigo,
        etiqueta: e.nombre.length > 16 ? e.nombre.slice(0, 15) + "…" : e.nombre,
        nombre: e.nombre,
        fecha: e.fecha,
        valor: (e[metrica] as number | null) ?? 0,
        sinDato: (e[metrica] as number | null) === null,
      }))
      .sort((a, b) => b.valor - a.valor),
    [filas, metrica]
  );

  /** Referencias para saber si un evento está por encima o por debajo. */
  const ref = useMemo(() => {
    const vs = filas.map((e) => e[metrica] as number | null).filter((v): v is number => v !== null);
    if (!vs.length) return null;
    const suma = vs.reduce((a, b) => a + b, 0);
    const ord = [...vs].sort((a, b) => a - b);
    return {
      promedio: suma / vs.length,
      maximo: Math.max(...vs),
      minimo: Math.min(...vs),
      mediana: ord.length % 2
        ? ord[(ord.length - 1) / 2]
        : (ord[ord.length / 2 - 1] + ord[ord.length / 2]) / 2,
    };
  }, [filas, metrica]);

  if (cargando) return null;

  const tip = {
    contentStyle: { borderRadius: 10, border: "1px solid #e3e2e0", fontSize: 12,
                    boxShadow: "0 8px 24px rgba(20,20,20,.10)", padding: "8px 10px" },
    cursor: { fill: "rgba(20,20,20,.04)" },
  };

  return (
    <>
      <Encabezado
        titulo="Comparar eventos"
        descripcion="Todos los eventos lado a lado, para ver cuál rindió mejor."
        acciones={
          <button className="btn-secundario" disabled={!filas.length}
            onClick={() => exportarHoja("COMPARACIÓN",
              ["ID EVENTO", "EVENTO", "FECHA", "CIUDAD", "TIPO DE EVENTO", "RESPONSABLE",
               "ESTADO", "ASISTENTES", "PERSONAL", "MATERIAL LLEVADO", "MATERIAL UTILIZADO",
               "% UTILIZACIÓN", "GASTO POP", "GASTOS ADICIONALES", "GASTO TOTAL",
               "GASTO POR ASISTENTE"],
              filas.map((e) => [
                e.codigo, e.nombre, fechaCorta(e.fecha), e.ciudad, e.tipo_evento,
                e.responsable, e.estado, e.asistentes, e.personal_asignado,
                e.pop_llevado, e.pop_utilizado, e.pct_util,
                e.gasto_pop, e.gastos_adicionales, e.gasto_total, e.costo_asistente,
              ]),
              { L: "0.0%", M: '"$"#,##0', N: '"$"#,##0', O: '"$"#,##0', P: '"$"#,##0' })}>
            ⬇ Excel
          </button>
        }
      />

      <Filtros conBusqueda />

      {filas.length === 0 ? (
        <div className="card">
          <Vacio icono="⚖️" titulo="No hay eventos para comparar"
                 detalle="Ajusta o limpia los filtros." />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Selector de la magnitud a comparar */}
          <section className="card p-4 no-imprimir">
            <h2 className="titulo-seccion mb-2.5">Comparar por</h2>
            <div className="flex flex-wrap gap-2">
              {METRICAS.map((m) => (
                <button
                  key={m.clave}
                  onClick={() => setMetrica(m.clave)}
                  aria-pressed={metrica === m.clave}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    metrica === m.clave
                      ? "bg-choho-red text-white"
                      : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                  }`}
                >
                  {m.texto}
                </button>
              ))}
            </div>
          </section>

          {/* Referencias */}
          {ref && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Promedio", ref.promedio],
                ["Mediana", ref.mediana],
                ["Más alto", ref.maximo],
                ["Más bajo", ref.minimo],
              ].map(([k, v]) => (
                <div key={k as string} className="card p-3.5">
                  <p className="titulo-seccion">{k}</p>
                  <p className="mt-1 text-lg font-black tabular-nums">{formato(v as number)}</p>
                </div>
              ))}
            </div>
          )}

          {/* Ranking */}
          <Grafico
            titulo={`${def.texto} por evento`}
            subtitulo="De mayor a menor. La línea gris marca el promedio."
            alto={Math.max(220, serie.length * 42)}
            tabla={<TablaDatos cabeceras={["Evento", def.texto]}
                    filas={serie.map((s) => [s.nombre, formato(s.sinDato ? null : s.valor)])} />}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serie} layout="vertical"
                        margin={{ top: 4, right: 104, left: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false}
                       tickFormatter={(v: number) =>
                         def.tipo === "money" ? moneyCorto(v)
                         : def.tipo === "pct" ? pct(v, 0) : num(v)} />
                <YAxis type="category" dataKey="etiqueta" width={116}
                       tickLine={false} axisLine={false} />
                <Tooltip {...tip}
                         labelFormatter={(_l, p) => p?.[0]?.payload?.nombre ?? ""}
                         formatter={(v: number) => [formato(v), def.texto]} />
                {ref && (
                  <ReferenceLine x={ref.promedio} stroke="#8a8783" strokeDasharray="4 4"
                    label={{ value: "promedio", position: "top", fontSize: 10, fill: "#8a8783" }} />
                )}
                <Bar dataKey="valor" radius={[0, 4, 4, 0]} maxBarSize={24}>
                  {serie.map((s) => (
                    <Cell key={s.codigo}
                          fill={s.sinDato ? NEUTRO
                                : ref && s.valor >= ref.promedio ? SERIES.s1 : SERIES.s2} />
                  ))}
                  <LabelList dataKey="valor" position="right" fontSize={11}
                             className="fill-neutral-600"
                             formatter={(v: number) =>
                               def.tipo === "money" ? moneyCorto(v)
                               : def.tipo === "pct" ? pct(v, 1) : num(v)} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Grafico>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {[
              { c: SERIES.s1, t: "En el promedio o por encima" },
              { c: SERIES.s2, t: "Por debajo del promedio" },
              { c: NEUTRO, t: "Sin dato registrado" },
            ].map((i) => (
              <li key={i.t} className="flex items-center gap-1.5 text-xs text-neutral-600">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: i.c }} aria-hidden />
                {i.t}
              </li>
            ))}
          </ul>

          {/* Tabla comparativa completa */}
          <section className="card overflow-hidden">
            <header className="border-b border-neutral-200 px-4 py-3 sm:px-5">
              <h2 className="text-sm font-bold text-neutral-900">Comparación completa</h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                Toca un evento para abrir su ficha.
              </p>
            </header>
            <div className="overflow-x-auto scroll-fino">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="th">Evento</th>
                    <th className="th hidden sm:table-cell">Ciudad</th>
                    <th className="th hidden lg:table-cell">Responsable</th>
                    <th className="th hidden lg:table-cell">Estado</th>
                    <th className="th text-right">Asistentes</th>
                    <th className="th hidden text-right lg:table-cell">Personal</th>
                    <th className="th text-right">Material usado</th>
                    <th className="th text-right">% Util.</th>
                    <th className="th hidden text-right lg:table-cell">Gasto POP</th>
                    <th className="th hidden text-right lg:table-cell">Adicionales</th>
                    <th className="th text-right">Gasto total</th>
                    <th className="th text-right">Por asistente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filas.map((e) => (
                    <tr key={e.id} className="cursor-pointer transition-colors hover:bg-neutral-50"
                        onClick={() => router.push(`/eventos/${e.codigo}`)}>
                      <td className="td">
                        <p className="font-semibold text-neutral-900">{e.nombre}</p>
                        <p className="text-xs text-neutral-500">
                          <span className="font-mono">{e.codigo}</span> · {fechaCorta(e.fecha)}
                        </p>
                      </td>
                      <td className="td hidden text-neutral-600 sm:table-cell">{e.ciudad ?? "—"}</td>
                      <td className="td hidden text-neutral-600 lg:table-cell">{e.responsable ?? "—"}</td>
                      <td className="td hidden lg:table-cell"><Badge estado={e.estado} /></td>
                      <td className="td text-right tabular-nums">
                        {e.asistentes !== null ? num(e.asistentes) : "—"}
                      </td>
                      <td className="td hidden text-right tabular-nums lg:table-cell">
                        {num(e.personal_asignado)}
                      </td>
                      <td className="td text-right tabular-nums">
                        {num(e.pop_utilizado)}
                        <span className="text-neutral-400"> / {num(e.pop_llevado)}</span>
                      </td>
                      <td className="td text-right tabular-nums">{pct(e.pct_util, 1)}</td>
                      <td className="td hidden text-right tabular-nums lg:table-cell">{money(e.gasto_pop)}</td>
                      <td className="td hidden text-right tabular-nums lg:table-cell">{money(e.gastos_adicionales)}</td>
                      <td className="td text-right font-semibold tabular-nums">{money(e.gasto_total)}</td>
                      <td className="td text-right tabular-nums">
                        {e.costo_asistente !== null ? money(e.costo_asistente) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-neutral-200 bg-neutral-50">
                  <tr>
                    <td className="td font-bold">
                      TOTAL · {filas.length} evento{filas.length === 1 ? "" : "s"}
                    </td>
                    <td className="td hidden sm:table-cell" />
                    <td className="td hidden lg:table-cell" />
                    <td className="td hidden lg:table-cell" />
                    <td className="td text-right font-bold tabular-nums">
                      {num(filas.reduce((a, e) => a + (e.asistentes ?? 0), 0))}
                    </td>
                    <td className="td hidden text-right font-bold tabular-nums lg:table-cell">
                      {num(filas.reduce((a, e) => a + e.personal_asignado, 0))}
                    </td>
                    <td className="td text-right font-bold tabular-nums">
                      {num(filas.reduce((a, e) => a + e.pop_utilizado, 0))}
                    </td>
                    <td className="td" />
                    <td className="td hidden text-right font-bold tabular-nums lg:table-cell">
                      {money(filas.reduce((a, e) => a + e.gasto_pop, 0))}
                    </td>
                    <td className="td hidden text-right font-bold tabular-nums lg:table-cell">
                      {money(filas.reduce((a, e) => a + e.gastos_adicionales, 0))}
                    </td>
                    <td className="td text-right font-bold tabular-nums">
                      {money(filas.reduce((a, e) => a + e.gasto_total, 0))}
                    </td>
                    <td className="td" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
