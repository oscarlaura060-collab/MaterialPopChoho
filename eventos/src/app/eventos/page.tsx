"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Filtros } from "@/components/filtros";
import { Encabezado } from "@/components/shell";
import { Columna, Tabla } from "@/components/tabla";
import { Badge, Vacio } from "@/components/ui";
import { fechaCorta, money, num } from "@/lib/format";
import { useApp } from "@/lib/store";
import type { EventoVista } from "@/lib/types";
import { exportarEventosExcel } from "@/lib/exportar";

export default function Eventos() {
  const { eventosFiltrados, datos, esAdmin, cargando } = useApp();
  const router = useRouter();

  const columnas: Columna<EventoVista>[] = [
    {
      clave: "codigo", titulo: "ID", orden: (e) => e.codigo,
      celda: (e) => <span className="font-mono text-xs font-semibold text-neutral-500">{e.codigo}</span>,
    },
    {
      clave: "nombre", titulo: "Evento", orden: (e) => e.nombre,
      celda: (e) => (
        <div className="min-w-[160px]">
          <p className="font-semibold text-neutral-900">{e.nombre}</p>
          <p className="text-xs text-neutral-500 lg:hidden">
            {fechaCorta(e.fecha)} · {e.ciudad ?? "—"}
          </p>
        </div>
      ),
    },
    {
      clave: "fecha", titulo: "Fecha", orden: (e) => e.fecha, soloEscritorio: true,
      celda: (e) => (
        <div>
          <p>{fechaCorta(e.fecha)}</p>
          <p className="text-xs text-neutral-400">{e.dia}</p>
        </div>
      ),
    },
    { clave: "ciudad", titulo: "Ciudad", orden: (e) => e.ciudad ?? "", soloEscritorio: true,
      celda: (e) => e.ciudad ?? "—" },
    { clave: "lugar", titulo: "Lugar / negocio", orden: (e) => e.lugar_negocio ?? "", soloEscritorio: true,
      celda: (e) => <span className="text-neutral-600">{e.lugar_negocio ?? "—"}</span> },
    { clave: "cliente", titulo: "Cliente", orden: (e) => e.cliente ?? "", soloEscritorio: true,
      celda: (e) => e.cliente ?? "—" },
    { clave: "tipo", titulo: "Tipo", orden: (e) => e.tipo_evento ?? "", soloEscritorio: true,
      celda: (e) => <span className="text-xs text-neutral-600">{e.tipo_evento ?? "—"}</span> },
    { clave: "responsable", titulo: "Responsable", orden: (e) => e.responsable ?? "", soloEscritorio: true,
      celda: (e) => e.responsable ?? "—" },
    { clave: "estado", titulo: "Estado", orden: (e) => e.estado,
      celda: (e) => <Badge estado={e.estado} /> },
    { clave: "asistentes", titulo: "Asistentes", alinear: "der", soloEscritorio: true,
      orden: (e) => e.asistentes ?? e.asistentes_esperados ?? 0,
      celda: (e) => (
        <span title="Asistentes registrados · esperados">
          {e.asistentes !== null ? num(e.asistentes) : "—"}
          <span className="text-neutral-400"> / {e.asistentes_esperados !== null ? num(e.asistentes_esperados) : "—"}</span>
        </span>
      ) },
    { clave: "gasto_pop", titulo: "Gasto POP", alinear: "der", orden: (e) => e.gasto_pop,
      soloEscritorio: true, celda: (e) => money(e.gasto_pop) },
    { clave: "gasto_adic", titulo: "Gastos adic.", alinear: "der", orden: (e) => e.gastos_adicionales,
      soloEscritorio: true, celda: (e) => money(e.gastos_adicionales) },
    { clave: "gasto_total", titulo: "Gasto total", alinear: "der", orden: (e) => e.gasto_total,
      celda: (e) => <span className="font-semibold">{money(e.gasto_total)}</span> },
  ];

  if (cargando) return null;

  return (
    <>
      <Encabezado
        titulo="Eventos"
        descripcion="Cada fila abre la ficha completa del evento."
        acciones={
          <>
            <button
              className="btn-secundario"
              onClick={() => exportarEventosExcel(eventosFiltrados, datos)}
              disabled={!eventosFiltrados.length}
            >
              ⬇ Excel
            </button>
            {esAdmin && (
              <Link href="/eventos/nuevo" className="btn-primario">+ Nuevo evento</Link>
            )}
          </>
        }
      />

      <Filtros conBusqueda />

      <div className="card overflow-hidden">
        <Tabla
          columnas={columnas}
          filas={eventosFiltrados}
          claveFila={(e) => e.id}
          onFila={(e) => router.push(`/eventos/${e.codigo}`)}
          vacio={
            <Vacio
              icono="📅"
              titulo="No hay eventos que coincidan"
              detalle={
                datos.eventos.length
                  ? "Prueba a limpiar los filtros o cambiar la búsqueda."
                  : "Empieza registrando tu primer evento o importando el Excel desde Configuración."
              }
            />
          }
        />
      </div>

      {eventosFiltrados.length > 0 && (
        <p className="mt-3 text-xs text-neutral-500">
          {eventosFiltrados.length} evento{eventosFiltrados.length === 1 ? "" : "s"} ·
          Gasto total {money(eventosFiltrados.reduce((a, e) => a + e.gasto_total, 0))}
        </p>
      )}
    </>
  );
}
