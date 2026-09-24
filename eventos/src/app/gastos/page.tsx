"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import {
  Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Filtros } from "@/components/filtros";
import { Fila, Kpi } from "@/components/kpi";
import { Encabezado } from "@/components/shell";
import { Columna, Tabla, TablaDatos } from "@/components/tabla";
import { Grafico, Vacio } from "@/components/ui";
import { SERIES } from "@/lib/constants";
import { fechaCorta, money, moneyCorto } from "@/lib/format";
import { useApp } from "@/lib/store";
import type { Gasto } from "@/lib/types";
import { exportarHoja } from "@/lib/exportar";

export default function GastosPage() {
  const { datos, idsFiltrados, eventosFiltrados, cargando } = useApp();
  const router = useRouter();

  const filas = useMemo(
    () => datos.gastos
      .filter((g) => idsFiltrados.has(g.evento_id))
      .sort((a, b) => b.evento_fecha.localeCompare(a.evento_fecha)),
    [datos.gastos, idsFiltrados]
  );

  const gastoPop = useMemo(
    () => eventosFiltrados.reduce((a, e) => a + e.gasto_pop, 0),
    [eventosFiltrados]
  );
  const gastoAdic = useMemo(() => filas.reduce((a, g) => a + g.valor, 0), [filas]);

  const porCategoria = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of filas) m.set(g.categoria ?? "OTROS", (m.get(g.categoria ?? "OTROS") ?? 0) + g.valor);
    return [...m.entries()].map(([etiqueta, valor]) => ({ etiqueta, valor }))
      .sort((a, b) => b.valor - a.valor);
  }, [filas]);

  const columnas: Columna<Gasto>[] = [
    { clave: "evento", titulo: "Evento", orden: (g) => g.evento_fecha,
      celda: (g) => (
        <div className="min-w-[150px]">
          <p className="font-semibold text-neutral-900">{g.evento_nombre}</p>
          <p className="text-xs text-neutral-500">
            <span className="font-mono">{g.evento_codigo}</span> · {fechaCorta(g.evento_fecha)}
          </p>
        </div>
      ) },
    { clave: "categoria", titulo: "Categoría", orden: (g) => g.categoria ?? "",
      celda: (g) => <span className="font-medium">{g.categoria ?? "—"}</span> },
    { clave: "descripcion", titulo: "Descripción", orden: (g) => g.descripcion ?? "",
      celda: (g) => <span className="text-neutral-600">{g.descripcion ?? "—"}</span> },
    { clave: "proveedor", titulo: "Proveedor", orden: (g) => g.proveedor ?? "", soloEscritorio: true,
      celda: (g) => g.proveedor ?? "—" },
    { clave: "responsable", titulo: "Responsable", orden: (g) => g.responsable ?? "", soloEscritorio: true,
      celda: (g) => g.responsable ?? "—" },
    { clave: "valor", titulo: "Valor", alinear: "der", orden: (g) => g.valor,
      celda: (g) => <span className="font-semibold">{money(g.valor)}</span> },
    { clave: "obs", titulo: "Observaciones", soloEscritorio: true, orden: (g) => g.observaciones ?? "",
      celda: (g) => <span className="text-neutral-500">{g.observaciones ?? "—"}</span> },
  ];

  if (cargando) return null;

  return (
    <>
      <Encabezado
        titulo="Gastos adicionales"
        descripcion="Todo lo que no es material POP. El gasto total del evento suma ambos."
        acciones={
          <button className="btn-secundario" disabled={!filas.length}
            onClick={() => exportarHoja("GASTOS",
              ["ID EVENTO", "EVENTO", "FECHA", "CATEGORÍA", "DESCRIPCIÓN", "PROVEEDOR",
               "RESPONSABLE", "VALOR", "OBSERVACIONES"],
              filas.map((g) => [
                g.evento_codigo, g.evento_nombre, fechaCorta(g.evento_fecha), g.categoria,
                g.descripcion, g.proveedor, g.responsable, g.valor, g.observaciones,
              ]), { H: '"$"#,##0' })}>
            ⬇ Excel
          </button>
        }
      />

      <Filtros />

      <div className="mb-5">
        <Fila>
          <Kpi etiqueta="Gasto POP" icono="📦" valor={money(gastoPop)}
               apoyo="Material llevado × costo unitario" />
          <Kpi etiqueta="Gastos adicionales" icono="🧾" valor={money(gastoAdic)}
               apoyo={`${filas.length} registros`} />
          <Kpi etiqueta="Gasto total" icono="💰" valor={money(gastoPop + gastoAdic)} acento />
          <Kpi etiqueta="Categorías" icono="🏷️" valor={String(porCategoria.length)}
               apoyo={porCategoria[0]?.etiqueta} />
          <Kpi etiqueta="Promedio por evento" icono="📊"
               valor={money(eventosFiltrados.length ? (gastoPop + gastoAdic) / eventosFiltrados.length : 0)}
               apoyo={`${eventosFiltrados.length} eventos`} />
        </Fila>
      </div>

      {porCategoria.length > 0 && (
        <div className="mb-5">
          <Grafico
            titulo="Gastos adicionales por categoría"
            alto={Math.max(220, porCategoria.length * 34)}
            tabla={<TablaDatos cabeceras={["Categoría", "Valor"]}
                    filas={porCategoria.map((c) => [c.etiqueta, money(c.valor)])} />}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porCategoria} layout="vertical" margin={{ top: 4, right: 104, left: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false}
                       tickFormatter={(v: number) => moneyCorto(v)} />
                <YAxis type="category" dataKey="etiqueta" width={120} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e3e2e0", fontSize: 12 }}
                         cursor={{ fill: "rgba(20,20,20,.04)" }}
                         formatter={(v: number) => [money(v), "Valor"]} />
                <Bar dataKey="valor" fill={SERIES.s2} radius={[0, 4, 4, 0]} maxBarSize={20}>
                  <LabelList dataKey="valor" position="right" fontSize={11}
                             className="fill-neutral-600" formatter={(v: number) => moneyCorto(v)} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Grafico>
        </div>
      )}

      <div className="card overflow-hidden">
        <Tabla
          columnas={columnas}
          filas={filas}
          claveFila={(g) => g.id}
          onFila={(g) => router.push(`/eventos/${g.evento_codigo}`)}
          vacio={<Vacio icono="🧾" titulo="Sin gastos con estos filtros" />}
        />
      </div>
    </>
  );
}
