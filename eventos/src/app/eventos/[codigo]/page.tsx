"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Encabezado } from "@/components/shell";
import { Badge, Cargando, Vacio } from "@/components/ui";
import { Galeria } from "@/components/galeria";
import { NEUTRO, SERIES } from "@/lib/constants";
import { fechaLarga, horaCorta, money, num, pct } from "@/lib/format";
import { useApp } from "@/lib/store";
import { exportarEventoPdf } from "@/lib/exportar";

function Dato({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{etiqueta}</dt>
      <dd className="mt-1 text-sm font-medium text-neutral-900">{valor || "—"}</dd>
    </div>
  );
}

function Seccion({ titulo, extra, children }: {
  titulo: string; extra?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-bold text-neutral-900">{titulo}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

export default function FichaEvento() {
  const { codigo } = useParams<{ codigo: string }>();
  const router = useRouter();
  const { datos, esAdmin, cargando } = useApp();
  const [pdf, setPdf] = useState(false);

  const evento = useMemo(
    () => datos.eventos.find((e) => e.codigo === decodeURIComponent(codigo)),
    [datos.eventos, codigo]
  );

  const material = useMemo(
    () => datos.material.filter((m) => m.evento_id === evento?.id),
    [datos.material, evento]
  );
  const gastos = useMemo(
    () => datos.gastos.filter((g) => g.evento_id === evento?.id),
    [datos.gastos, evento]
  );
  const personal = useMemo(
    () => datos.participacion.filter((p) => p.evento_id === evento?.id),
    [datos.participacion, evento]
  );
  const resultado = useMemo(
    () => datos.resultados.find((r) => r.evento_id === evento?.id),
    [datos.resultados, evento]
  );
  const anexos = useMemo(
    () => datos.anexos.filter((a) => a.evento_id === evento?.id),
    [datos.anexos, evento]
  );

  useEffect(() => {
    if (!cargando && !evento) router.replace("/eventos");
  }, [cargando, evento, router]);

  if (cargando) return <Cargando />;
  if (!evento) return null;

  const utilizacion = evento.pop_llevado > 0 ? evento.pop_utilizado / evento.pop_llevado : null;

  const descargarPdf = async () => {
    setPdf(true);
    try {
      await exportarEventoPdf(evento, material, gastos, personal, resultado, anexos);
    } finally {
      setPdf(false);
    }
  };

  return (
    <>
      <Link href="/eventos" className="mb-3 inline-block text-sm text-neutral-500 hover:text-neutral-900 no-imprimir">
        ← Eventos
      </Link>

      {/* Portada de la ficha */}
      <div className="card mb-5 overflow-hidden">
        <div className="bg-choho-black px-5 py-6 sm:px-7 sm:py-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="font-mono text-xs font-semibold tracking-wider text-neutral-400">
                {evento.codigo}
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
                {evento.nombre}
              </h1>
              <p className="mt-2 text-sm text-neutral-300">
                {fechaLarga(evento.fecha)} · {evento.dia}
              </p>
              <p className="text-sm text-neutral-400">
                {[evento.lugar_negocio, evento.ciudad].filter(Boolean).join(" · ") || "Sin ubicación registrada"}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 no-imprimir">
              <button className="btn bg-white/10 text-white hover:bg-white/20"
                      onClick={descargarPdf} disabled={pdf}>
                {pdf ? "Generando…" : "⬇ PDF"}
              </button>
              {esAdmin && (
                <Link href={`/eventos/${evento.codigo}/editar`} className="btn-primario">
                  Editar
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Cifras de cabecera */}
        <dl className="grid grid-cols-2 divide-neutral-200 border-t border-neutral-200 sm:grid-cols-4 sm:divide-x">
          <div className="px-5 py-4">
            <dt className="titulo-seccion">Gasto POP</dt>
            <dd className="mt-1 text-lg font-black tabular-nums">{money(evento.gasto_pop)}</dd>
          </div>
          <div className="border-l border-neutral-200 px-5 py-4 sm:border-l-0">
            <dt className="titulo-seccion">Gastos adicionales</dt>
            <dd className="mt-1 text-lg font-black tabular-nums">{money(evento.gastos_adicionales)}</dd>
          </div>
          <div className="border-t border-neutral-200 px-5 py-4 sm:border-t-0">
            <dt className="titulo-seccion">Gasto total</dt>
            <dd className="mt-1 text-lg font-black tabular-nums text-choho-red">
              {money(evento.gasto_total)}
            </dd>
          </div>
          <div className="border-l border-t border-neutral-200 px-5 py-4 sm:border-t-0">
            <dt className="titulo-seccion">Personal</dt>
            <dd className="mt-1 text-lg font-black tabular-nums">
              {num(evento.asistieron)}
              <span className="text-sm font-semibold text-neutral-400"> / {num(evento.personal_asignado)}</span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="space-y-5">
        {/* INFORMACIÓN GENERAL */}
        <Seccion titulo="Información general" extra={<Badge estado={evento.estado} />}>
          <dl className="grid grid-cols-2 gap-4 px-4 py-4 sm:grid-cols-3 sm:px-5 lg:grid-cols-4">
            <Dato etiqueta="Evento" valor={evento.nombre} />
            <Dato etiqueta="Fecha" valor={`${fechaLarga(evento.fecha)}`} />
            <Dato etiqueta="Día" valor={evento.dia} />
            <Dato etiqueta="Ciudad" valor={evento.ciudad} />
            <Dato etiqueta="Lugar / negocio" valor={evento.lugar_negocio} />
            <Dato etiqueta="Dirección" valor={evento.direccion} />
            <Dato etiqueta="Cliente" valor={evento.cliente} />
            <Dato etiqueta="Tipo de evento" valor={evento.tipo_evento} />
            <Dato etiqueta="Responsable" valor={evento.responsable} />
            <Dato etiqueta="Asistentes esperados"
                  valor={evento.asistentes_esperados !== null ? num(evento.asistentes_esperados) : null} />
            <Dato etiqueta="Asistentes"
                  valor={evento.asistentes !== null ? num(evento.asistentes) : null} />
            <Dato etiqueta="Anexos" valor={evento.n_anexos ? `${evento.n_anexos} archivo(s)` : null} />
          </dl>
          {evento.observaciones && (
            <div className="border-t border-neutral-200 px-4 py-4 sm:px-5">
              <Dato etiqueta="Observaciones" valor={evento.observaciones} />
            </div>
          )}
        </Seccion>

        {/* MATERIAL POP */}
        <Seccion
          titulo="Material POP"
          extra={
            utilizacion !== null ? (
              <span className="text-xs font-semibold text-neutral-600">
                Utilización global {pct(utilizacion, 1)}
              </span>
            ) : undefined
          }
        >
          {material.length === 0 ? (
            <Vacio icono="📦" titulo="Sin material POP registrado" />
          ) : (
            <div className="overflow-x-auto scroll-fino">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="th">Material</th>
                    <th className="th text-right">Llevado</th>
                    <th className="th text-right">Utilizado</th>
                    <th className="th text-right">Sobrante</th>
                    <th className="th text-right">% Utilización</th>
                    <th className="th text-right">Costo unit.</th>
                    <th className="th text-right">Costo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {material.map((m) => (
                    <tr key={m.id}>
                      <td className="td font-medium">{m.material}</td>
                      <td className="td text-right tabular-nums">{num(m.cantidad_llevada)}</td>
                      <td className="td text-right tabular-nums">{num(m.cantidad_utilizada)}</td>
                      <td className="td text-right tabular-nums">{num(m.cantidad_sobrante)}</td>
                      <td className="td text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* barra de utilización: apoyo visual, el número manda */}
                          <span className="hidden h-1.5 w-16 overflow-hidden rounded-full sm:block"
                                style={{ background: NEUTRO }} aria-hidden>
                            <span className="block h-full rounded-full"
                                  style={{
                                    width: `${Math.min(100, (m.pct_utilizacion ?? 0) * 100)}%`,
                                    background: SERIES.s1,
                                  }} />
                          </span>
                          <span className="tabular-nums">{pct(m.pct_utilizacion, 1)}</span>
                        </div>
                      </td>
                      <td className="td text-right tabular-nums text-neutral-500">{money(m.costo_unitario)}</td>
                      <td className="td text-right font-semibold tabular-nums">{money(m.gasto_material)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-neutral-200 bg-neutral-50">
                  <tr>
                    <td className="td font-bold">TOTAL</td>
                    <td className="td text-right font-bold tabular-nums">{num(evento.pop_llevado)}</td>
                    <td className="td text-right font-bold tabular-nums">{num(evento.pop_utilizado)}</td>
                    <td className="td text-right font-bold tabular-nums">{num(evento.pop_sobrante)}</td>
                    <td className="td text-right font-bold tabular-nums">{pct(utilizacion, 1)}</td>
                    <td className="td" />
                    <td className="td text-right font-bold tabular-nums">{money(evento.gasto_pop)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Seccion>

        {/* PERSONAL */}
        <Seccion
          titulo="Personal"
          extra={
            <span className="text-xs text-neutral-600">
              {evento.confirmados} confirmados · {evento.asistieron} asistieron
            </span>
          }
        >
          {personal.length === 0 ? (
            <Vacio icono="👥" titulo="Sin personal registrado" />
          ) : (
            <div className="overflow-x-auto scroll-fino">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="th">Persona</th>
                    <th className="th">Rol</th>
                    <th className="th">Confirmado</th>
                    <th className="th">Asistió</th>
                    <th className="th">Ingreso</th>
                    <th className="th">Salida</th>
                    <th className="th text-right">Horas</th>
                    <th className="th hidden lg:table-cell">Observaciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {personal.map((p) => (
                    <tr key={p.id}>
                      <td className="td font-medium">{p.persona_nombre}</td>
                      <td className="td text-neutral-600">{p.rol_funcion ?? "—"}</td>
                      <td className="td">{p.confirmado}</td>
                      <td className="td">
                        <span className={
                          p.asistio === "SÍ" ? "font-semibold text-emerald-700"
                          : p.asistio === "NO" ? "font-semibold text-choho-red"
                          : "text-neutral-500"
                        }>{p.asistio}</span>
                      </td>
                      <td className="td tabular-nums">{horaCorta(p.hora_ingreso)}</td>
                      <td className="td tabular-nums">{horaCorta(p.hora_salida)}</td>
                      <td className="td text-right tabular-nums">{p.horas ?? "—"}</td>
                      <td className="td hidden text-neutral-500 lg:table-cell">{p.observaciones ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Seccion>

        {/* GASTOS ADICIONALES */}
        <Seccion titulo="Gastos adicionales">
          {gastos.length === 0 ? (
            <Vacio icono="🧾" titulo="Sin gastos adicionales registrados" />
          ) : (
            <div className="overflow-x-auto scroll-fino">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="th">Categoría</th>
                    <th className="th">Descripción</th>
                    <th className="th hidden lg:table-cell">Proveedor</th>
                    <th className="th hidden lg:table-cell">Responsable</th>
                    <th className="th text-right">Valor</th>
                    <th className="th hidden lg:table-cell">Observaciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {gastos.map((g) => (
                    <tr key={g.id}>
                      <td className="td font-medium">{g.categoria ?? "—"}</td>
                      <td className="td text-neutral-600">{g.descripcion ?? "—"}</td>
                      <td className="td hidden text-neutral-600 lg:table-cell">{g.proveedor ?? "—"}</td>
                      <td className="td hidden text-neutral-600 lg:table-cell">{g.responsable ?? "—"}</td>
                      <td className="td text-right font-semibold tabular-nums">{money(g.valor)}</td>
                      <td className="td hidden text-neutral-500 lg:table-cell">{g.observaciones ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-neutral-200 bg-neutral-50">
                  <tr>
                    <td className="td font-bold" colSpan={4}>TOTAL</td>
                    <td className="td text-right font-bold tabular-nums">{money(evento.gastos_adicionales)}</td>
                    <td className="td" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Seccion>

        {/* RESULTADOS */}
        <Seccion titulo="Resultados">
          {!resultado ? (
            <Vacio icono="📈" titulo="Sin resultados registrados"
                   detalle={esAdmin ? "Edita el evento para registrar los resultados." : undefined} />
          ) : (
            <div className="space-y-4 px-4 py-4 sm:px-5">
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Dato etiqueta="Asistentes"
                      valor={resultado.asistentes !== null ? num(resultado.asistentes) : null} />
                <Dato etiqueta="Clientes atendidos"
                      valor={resultado.clientes_atendidos !== null ? num(resultado.clientes_atendidos) : null} />
              </dl>
              {resultado.resultado_comercial && (
                <Dato etiqueta="Resultado comercial"
                      valor={<p className="whitespace-pre-wrap font-normal">{resultado.resultado_comercial}</p>} />
              )}
              {resultado.observaciones && (
                <Dato etiqueta="Observaciones"
                      valor={<p className="whitespace-pre-wrap font-normal">{resultado.observaciones}</p>} />
              )}
              {resultado.aprendizajes && (
                <Dato etiqueta="Aprendizajes"
                      valor={<p className="whitespace-pre-wrap font-normal">{resultado.aprendizajes}</p>} />
              )}
            </div>
          )}
        </Seccion>

        {/* ANEXOS */}
        <Seccion titulo="Anexos" extra={
          <span className="text-xs text-neutral-500">{anexos.length} archivo(s)</span>
        }>
          <div className="px-4 py-4 sm:px-5">
            <Galeria anexos={anexos} eventoId={evento.id} />
          </div>
        </Seccion>
      </div>
    </>
  );
}
