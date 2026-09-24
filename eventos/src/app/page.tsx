"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Filtros } from "@/components/filtros";
import { Fila, Kpi } from "@/components/kpi";
import { Encabezado } from "@/components/shell";
import { TablaDatos } from "@/components/tabla";
import { Grafico, Leyenda, Vacio } from "@/components/ui";
import { MESES, NEUTRO, SERIES, SERIES_ORDEN } from "@/lib/constants";
import { money, moneyCorto, num, pct } from "@/lib/format";
import { useApp } from "@/lib/store";

export default function Dashboard() {
  const { datos, eventosFiltrados, idsFiltrados, filtros, cargando } = useApp();

  // Las demás hojas se recortan a los eventos que pasaron el filtro
  const material = useMemo(
    () => datos.material.filter((m) => idsFiltrados.has(m.evento_id)),
    [datos.material, idsFiltrados]
  );
  const gastos = useMemo(
    () => datos.gastos.filter((g) => idsFiltrados.has(g.evento_id)),
    [datos.gastos, idsFiltrados]
  );
  const participacion = useMemo(
    () => datos.participacion.filter((p) => idsFiltrados.has(p.evento_id)),
    [datos.participacion, idsFiltrados]
  );

  const k = useMemo(() => {
    const suma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    const ahora = new Date();
    const mesRef = filtros.mes ? Number(filtros.mes) : ahora.getMonth() + 1;
    const anioRef = filtros.anio ? Number(filtros.anio) : ahora.getFullYear();

    return {
      eventos: eventosFiltrados.length,
      delMes: eventosFiltrados.filter((e) => e.mes === mesRef && e.anio === anioRef).length,
      etiquetaMes: `${MESES[mesRef - 1]} ${anioRef}`,
      realizados: eventosFiltrados.filter((e) => e.estado === "REALIZADO").length,
      ciudades: new Set(eventosFiltrados.map((e) => e.ciudad).filter(Boolean)).size,
      asistentes: suma(eventosFiltrados.map((e) => e.asistentes ?? 0)),
      esperados: suma(eventosFiltrados.map((e) => e.asistentes_esperados ?? 0)),
      popUtilizado: suma(material.map((m) => m.cantidad_utilizada)),
      popSobrante: suma(material.map((m) => m.cantidad_sobrante)),
      popLlevado: suma(material.map((m) => m.cantidad_llevada)),
      gastoPop: suma(material.map((m) => m.gasto_material)),
      gastoAdic: suma(gastos.map((g) => g.valor)),
      personas: new Set(participacion.map((p) => p.persona_nombre)).size,
    };
  }, [eventosFiltrados, material, gastos, participacion, filtros]);

  const gastoTotal = k.gastoPop + k.gastoAdic;
  const utilGlobal = k.popLlevado > 0 ? k.popUtilizado / k.popLlevado : null;

  // ---- series de los gráficos ----
  const porMes = useMemo(() => {
    const m = new Map<string, { etiqueta: string; orden: string; n: number; gasto: number }>();
    for (const e of eventosFiltrados) {
      const clave = `${e.anio}-${String(e.mes).padStart(2, "0")}`;
      const f = m.get(clave) ?? {
        etiqueta: `${MESES[e.mes - 1].slice(0, 3)} ${String(e.anio).slice(2)}`,
        orden: clave, n: 0, gasto: 0,
      };
      f.n += 1;
      f.gasto += e.gasto_total;
      m.set(clave, f);
    }
    return [...m.values()].sort((a, b) => a.orden.localeCompare(b.orden));
  }, [eventosFiltrados]);

  const agrupar = (campo: "ciudad" | "tipo_evento" | "responsable") => {
    const m = new Map<string, number>();
    for (const e of eventosFiltrados) {
      const v = (e[campo] as string | null) ?? "SIN DEFINIR";
      m.set(v, (m.get(v) ?? 0) + 1);
    }
    return [...m.entries()]
      .map(([etiqueta, n]) => ({ etiqueta, n }))
      .sort((a, b) => b.n - a.n);
  };

  const porCiudad = useMemo(() => agrupar("ciudad"), [eventosFiltrados]);
  const porTipo = useMemo(() => agrupar("tipo_evento"), [eventosFiltrados]);
  const porResponsable = useMemo(() => agrupar("responsable"), [eventosFiltrados]);

  // Material: LLEVADA se descompone en UTILIZADA + SOBRANTE (apiladas)
  const porMaterial = useMemo(() => {
    const m = new Map<string, { material: string; utilizada: number; sobrante: number; llevada: number; gasto: number }>();
    for (const x of material) {
      const f = m.get(x.material) ?? { material: x.material, utilizada: 0, sobrante: 0, llevada: 0, gasto: 0 };
      f.utilizada += x.cantidad_utilizada;
      f.sobrante += x.cantidad_sobrante;
      f.llevada += x.cantidad_llevada;
      f.gasto += x.gasto_material;
      m.set(x.material, f);
    }
    return [...m.values()].sort((a, b) => b.llevada - a.llevada);
  }, [material]);

  const porCategoria = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of gastos) m.set(g.categoria ?? "OTROS", (m.get(g.categoria ?? "OTROS") ?? 0) + g.valor);
    return [...m.entries()].map(([etiqueta, valor]) => ({ etiqueta, valor }))
      .sort((a, b) => b.valor - a.valor);
  }, [gastos]);

  const partic = useMemo(() => ([
    { etiqueta: "Confirmado", n: participacion.filter((p) => p.confirmado === "SÍ").length, color: SERIES.s2 },
    { etiqueta: "Asistió", n: participacion.filter((p) => p.asistio === "SÍ").length, color: SERIES.s4 },
    { etiqueta: "No asistió", n: participacion.filter((p) => p.asistio === "NO").length, color: SERIES.s1 },
    { etiqueta: "Pendiente", n: participacion.filter((p) => p.asistio === "PENDIENTE").length, color: NEUTRO },
  ]), [participacion]);

  if (cargando) return null;

  const tip = {
    contentStyle: {
      borderRadius: 10, border: "1px solid #e3e2e0", fontSize: 12,
      boxShadow: "0 8px 24px rgba(20,20,20,.10)", padding: "8px 10px",
    },
    cursor: { fill: "rgba(20,20,20,.04)" },
  };

  return (
    <>
      <Encabezado
        titulo="Dashboard"
        descripcion="Resumen ejecutivo de los eventos realizados."
        acciones={
          <Link href="/eventos" className="btn-secundario">Ver eventos →</Link>
        }
      />

      <Filtros />

      {eventosFiltrados.length === 0 ? (
        <div className="card">
          <Vacio
            icono="📅"
            titulo="No hay eventos con estos filtros"
            detalle="Ajusta o limpia los filtros para ver la información."
          />
        </div>
      ) : (
        <div className="space-y-5">
          {/* ---- Indicadores ---- */}
          <Fila>
            <Kpi etiqueta="Eventos realizados" icono="📅" valor={num(k.eventos)}
                 apoyo={`${k.realizados} con estado REALIZADO`} />
            <Kpi etiqueta="Eventos del mes" icono="🗓️" valor={num(k.delMes)} apoyo={k.etiquetaMes} />
            <Kpi etiqueta="Ciudades" icono="📍" valor={num(k.ciudades)}
                 apoyo={porCiudad[0] ? `Más eventos: ${porCiudad[0].etiqueta}` : undefined} />
            <Kpi etiqueta="Asistentes" icono="👥" valor={num(k.asistentes)}
                 apoyo={k.esperados ? `${num(k.esperados)} esperados` : "Registrados en Resultados"} />
            <Kpi etiqueta="Personal participante" icono="🧑‍🤝‍🧑" valor={num(k.personas)}
                 apoyo={`${participacion.length} participaciones`} />
          </Fila>

          <Fila>
            <Kpi etiqueta="Material POP utilizado" icono="📦" valor={num(k.popUtilizado)}
                 apoyo={`de ${num(k.popLlevado)} piezas llevadas`} />
            <Kpi etiqueta="Material POP sobrante" icono="📤" valor={num(k.popSobrante)}
                 apoyo={utilGlobal !== null ? `Utilización ${pct(utilGlobal, 1)}` : undefined} />
            <Kpi etiqueta="Gasto POP" icono="🏷️" valor={money(k.gastoPop)}
                 apoyo="Cantidad llevada × costo unitario" />
            <Kpi etiqueta="Gastos adicionales" icono="🧾" valor={money(k.gastoAdic)}
                 apoyo={`${gastos.length} registros`} />
            <Kpi etiqueta="Gasto total" icono="💰" valor={money(gastoTotal)} acento
                 apoyo="Gasto POP + gastos adicionales" />
          </Fila>

          {/* ---- Gráficos ---- */}
          <div className="grid gap-4 xl:grid-cols-2">
            <Grafico
              titulo="Eventos por mes"
              subtitulo="Número de eventos registrados en cada mes"
              tabla={<TablaDatos cabeceras={["Mes", "Eventos", "Gasto total"]}
                      filas={porMes.map((d) => [d.etiqueta, d.n, money(d.gasto)])} />}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porMes} margin={{ top: 18, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
                  <Tooltip {...tip} formatter={(v: number) => [num(v), "Eventos"]} />
                  <Bar dataKey="n" fill={SERIES.s1} radius={[4, 4, 0, 0]} maxBarSize={44}>
                    <LabelList dataKey="n" position="top" className="fill-neutral-600" fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Grafico>

            <Grafico
              titulo="Eventos por ciudad"
              subtitulo="Dónde se concentra la actividad"
              tabla={<TablaDatos cabeceras={["Ciudad", "Eventos"]}
                      filas={porCiudad.map((d) => [d.etiqueta, d.n])} />}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porCiudad} layout="vertical"
                          margin={{ top: 4, right: 30, left: 4, bottom: 4 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="etiqueta" width={104}
                         tickLine={false} axisLine={false} />
                  <Tooltip {...tip} formatter={(v: number) => [num(v), "Eventos"]} />
                  <Bar dataKey="n" fill={SERIES.s1} radius={[0, 4, 4, 0]} maxBarSize={22}>
                    <LabelList dataKey="n" position="right" className="fill-neutral-600" fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Grafico>

            <Grafico
              titulo="Eventos por tipo"
              subtitulo="Distribución según el tipo de evento"
              tabla={<TablaDatos cabeceras={["Tipo de evento", "Eventos"]}
                      filas={porTipo.map((d) => [d.etiqueta, d.n])} />}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={porTipo} dataKey="n" nameKey="etiqueta"
                       innerRadius="52%" outerRadius="80%" paddingAngle={2}
                       stroke="#fff" strokeWidth={2}
                       labelLine={false} label={false}>
                    {porTipo.map((d, i) => (
                      <Cell key={d.etiqueta} fill={SERIES_ORDEN[i % SERIES_ORDEN.length]} />
                    ))}
                    <LabelList dataKey="n" position="inside" fill="#fff"
                               fontSize={12} fontWeight={700} />
                  </Pie>
                  <Tooltip {...tip} formatter={(v: number) => [num(v), "Eventos"]} />
                  <Legend verticalAlign="bottom" iconType="circle" iconSize={8}
                          wrapperStyle={{ fontSize: 11, color: "#55534f" }} />
                </PieChart>
              </ResponsiveContainer>
            </Grafico>

            <Grafico
              titulo="Eventos por responsable"
              subtitulo="Quién lideró cada evento"
              tabla={<TablaDatos cabeceras={["Responsable", "Eventos"]}
                      filas={porResponsable.map((d) => [d.etiqueta, d.n])} />}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porResponsable} layout="vertical"
                          margin={{ top: 4, right: 30, left: 4, bottom: 4 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="etiqueta" width={116}
                         tickLine={false} axisLine={false} />
                  <Tooltip {...tip} formatter={(v: number) => [num(v), "Eventos"]} />
                  <Bar dataKey="n" fill={SERIES.s1} radius={[0, 4, 4, 0]} maxBarSize={22}>
                    <LabelList dataKey="n" position="right" className="fill-neutral-600" fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Grafico>

            <Grafico
              titulo="Material POP"
              subtitulo="Cada barra es la cantidad llevada, dividida en utilizada y sobrante"
              alto={280}
              tabla={<TablaDatos
                cabeceras={["Material", "Llevada", "Utilizada", "Sobrante", "% utilización", "Gasto"]}
                filas={porMaterial.map((d) => [
                  d.material, num(d.llevada), num(d.utilizada), num(d.sobrante),
                  pct(d.llevada ? d.utilizada / d.llevada : null, 1), money(d.gasto),
                ])} />}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porMaterial} margin={{ top: 18, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="material" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
                  <Tooltip {...tip} formatter={(v: number, n: string) => [num(v), n]} />
                  <Bar dataKey="utilizada" stackId="p" name="Utilizada"
                       fill={SERIES.s1} stroke="#fff" strokeWidth={2} maxBarSize={56}>
                    <LabelList dataKey="utilizada" position="center" fill="#fff" fontSize={11} fontWeight={600} />
                  </Bar>
                  <Bar dataKey="sobrante" stackId="p" name="Sobrante"
                       fill={NEUTRO} stroke="#fff" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={56}>
                    <LabelList dataKey="llevada" position="top" className="fill-neutral-600" fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Grafico>

            <Grafico
              titulo="Gastos por categoría"
              subtitulo={`Gasto POP ${moneyCorto(k.gastoPop)} + adicionales ${moneyCorto(k.gastoAdic)} = ${moneyCorto(gastoTotal)}`}
              alto={280}
              tabla={<TablaDatos cabeceras={["Categoría", "Valor"]}
                      filas={[
                        ["MATERIAL POP", money(k.gastoPop)],
                        ...porCategoria.map((d) => [d.etiqueta, money(d.valor)] as [string, string]),
                        ["GASTO TOTAL", money(gastoTotal)],
                      ]} />}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[{ etiqueta: "MATERIAL POP", valor: k.gastoPop, pop: true }, ...porCategoria]}
                  layout="vertical" margin={{ top: 4, right: 104, left: 4, bottom: 4 }}
                >
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false}
                         tickFormatter={(v: number) => moneyCorto(v)} />
                  <YAxis type="category" dataKey="etiqueta" width={116}
                         tickLine={false} axisLine={false} />
                  <Tooltip {...tip} formatter={(v: number) => [money(v), "Valor"]} />
                  <Bar dataKey="valor" radius={[0, 4, 4, 0]} maxBarSize={20}>
                    {[{ pop: true }, ...porCategoria].map((d, i) => (
                      <Cell key={i} fill={"pop" in d && d.pop ? SERIES.s1 : SERIES.s2} />
                    ))}
                    <LabelList dataKey="valor" position="right" fontSize={11}
                               className="fill-neutral-600"
                               formatter={(v: number) => moneyCorto(v)} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Grafico>
          </div>

          {/* ---- Participación ---- */}
          <Grafico
            titulo="Participación del personal"
            subtitulo="Sobre las participaciones registradas en los eventos filtrados"
            alto={220}
            tabla={<TablaDatos cabeceras={["Estado", "Participaciones"]}
                    filas={partic.map((d) => [d.etiqueta, d.n])} />}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={partic} margin={{ top: 18, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
                <Tooltip {...tip} formatter={(v: number) => [num(v), "Participaciones"]} />
                <Bar dataKey="n" radius={[4, 4, 0, 0]} maxBarSize={72}>
                  {partic.map((d) => <Cell key={d.etiqueta} fill={d.color} />)}
                  <LabelList dataKey="n" position="top" className="fill-neutral-600" fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Grafico>
        </div>
      )}
    </>
  );
}
