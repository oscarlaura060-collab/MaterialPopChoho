"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Filtros } from "@/components/filtros";
import { Fila, Kpi } from "@/components/kpi";
import { Encabezado } from "@/components/shell";
import { Vacio } from "@/components/ui";
import { fechaCorta, money, num } from "@/lib/format";
import { useApp } from "@/lib/store";
import { exportarHoja } from "@/lib/exportar";

export default function ResultadosPage() {
  const { datos, eventosFiltrados, idsFiltrados, cargando } = useApp();

  const filas = useMemo(
    () => datos.resultados
      .filter((r) => idsFiltrados.has(r.evento_id))
      .sort((a, b) => b.evento_fecha.localeCompare(a.evento_fecha)),
    [datos.resultados, idsFiltrados]
  );

  const tot = useMemo(() => ({
    asistentes: filas.reduce((a, r) => a + (r.asistentes ?? 0), 0),
    clientes: filas.reduce((a, r) => a + (r.clientes_atendidos ?? 0), 0),
    conResultado: filas.length,
    sinResultado: eventosFiltrados.length - filas.length,
    gasto: eventosFiltrados.reduce((a, e) => a + e.gasto_total, 0),
  }), [filas, eventosFiltrados]);

  const costoPorAsistente = tot.asistentes > 0 ? tot.gasto / tot.asistentes : null;

  if (cargando) return null;

  return (
    <>
      <Encabezado
        titulo="Resultados"
        descripcion="Lo que dejó cada evento: asistentes, clientes atendidos y aprendizajes."
        acciones={
          <button className="btn-secundario" disabled={!filas.length}
            onClick={() => exportarHoja("RESULTADOS",
              ["ID EVENTO", "EVENTO", "FECHA", "ASISTENTES", "CLIENTES ATENDIDOS",
               "RESULTADO COMERCIAL", "OBSERVACIONES", "APRENDIZAJES"],
              filas.map((r) => [
                r.evento_codigo, r.evento_nombre, fechaCorta(r.evento_fecha), r.asistentes,
                r.clientes_atendidos, r.resultado_comercial, r.observaciones, r.aprendizajes,
              ]))}>
            ⬇ Excel
          </button>
        }
      />

      <Filtros />

      <div className="mb-5">
        <Fila>
          <Kpi etiqueta="Eventos con resultados" icono="📈" valor={num(tot.conResultado)}
               apoyo={tot.sinResultado > 0 ? `${tot.sinResultado} sin registrar` : "Todos registrados"} />
          <Kpi etiqueta="Asistentes" icono="👥" valor={num(tot.asistentes)} />
          <Kpi etiqueta="Clientes atendidos" icono="🤝" valor={num(tot.clientes)} />
          <Kpi etiqueta="Gasto total" icono="💰" valor={money(tot.gasto)} />
          <Kpi etiqueta="Gasto por asistente" icono="📊"
               valor={costoPorAsistente !== null ? money(costoPorAsistente) : "—"} acento
               apoyo="Gasto total / asistentes" />
        </Fila>
      </div>

      {filas.length === 0 ? (
        <div className="card">
          <Vacio icono="📈" titulo="Sin resultados registrados"
                 detalle="Los resultados se registran al crear o editar un evento." />
        </div>
      ) : (
        <div className="space-y-4">
          {filas.map((r) => (
            <article key={r.evento_id} className="card-p">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={`/eventos/${r.evento_codigo}`}
                        className="text-base font-bold text-neutral-900 hover:text-choho-red">
                    {r.evento_nombre}
                  </Link>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    <span className="font-mono">{r.evento_codigo}</span> ·
                    {" "}{fechaCorta(r.evento_fecha)}
                    {r.evento_ciudad ? ` · ${r.evento_ciudad}` : ""}
                  </p>
                </div>
                <div className="flex gap-5 text-right">
                  <div>
                    <p className="titulo-seccion">Asistentes</p>
                    <p className="text-lg font-black tabular-nums">
                      {r.asistentes !== null ? num(r.asistentes) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="titulo-seccion">Clientes</p>
                    <p className="text-lg font-black tabular-nums">
                      {r.clientes_atendidos !== null ? num(r.clientes_atendidos) : "—"}
                    </p>
                  </div>
                </div>
              </div>

              {(r.resultado_comercial || r.observaciones || r.aprendizajes) && (
                <dl className="mt-4 grid gap-4 border-t border-neutral-200 pt-4 sm:grid-cols-3">
                  {[
                    ["Resultado comercial", r.resultado_comercial],
                    ["Observaciones", r.observaciones],
                    ["Aprendizajes", r.aprendizajes],
                  ].filter(([, v]) => v).map(([k, v]) => (
                    <div key={k as string}>
                      <dt className="titulo-seccion">{k}</dt>
                      <dd className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
