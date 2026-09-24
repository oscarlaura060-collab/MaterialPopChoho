"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { MESES, TIPOS_LISTA } from "@/lib/constants";
import { Select } from "./ui";

/** Filtros globales: al cambiar uno se recalcula TODO el tablero. */
export function Filtros({ conBusqueda = false }: { conBusqueda?: boolean }) {
  const { datos, filtros, setFiltros, limpiarFiltros, hayFiltros, catalogo, eventosFiltrados } = useApp();
  const [abierto, setAbierto] = useState(false);

  // Los desplegables se alimentan del catálogo y de lo que exista en los datos
  const opciones = useMemo(() => {
    const unicos = (f: (e: (typeof datos.eventos)[number]) => string | null | undefined) =>
      Array.from(new Set(datos.eventos.map(f).filter(Boolean) as string[])).sort();
    const mezclar = (cat: string[], usados: string[]) =>
      Array.from(new Set([...cat, ...usados]));
    return {
      anios: Array.from(new Set(datos.eventos.map((e) => e.anio))).sort((a, b) => b - a).map(String),
      ciudades: mezclar(catalogo(TIPOS_LISTA.CIUDAD), unicos((e) => e.ciudad)),
      responsables: unicos((e) => e.responsable),
      tipos: mezclar(catalogo(TIPOS_LISTA.TIPO_EVENTO), unicos((e) => e.tipo_evento)),
      estados: mezclar(catalogo(TIPOS_LISTA.ESTADO), unicos((e) => e.estado)),
      clientes: unicos((e) => e.cliente),
    };
  }, [datos.eventos, catalogo]);

  const activos = Object.entries(filtros).filter(([, v]) => v !== "").length;

  const campos = (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">
      <div>
        <label className="etiqueta" htmlFor="f-anio">Año</label>
        <Select id="f-anio" valor={filtros.anio} opciones={opciones.anios}
                onChange={(v) => setFiltros({ ...filtros, anio: v })} />
      </div>
      <div>
        <label className="etiqueta" htmlFor="f-mes">Mes</label>
        <Select id="f-mes" valor={filtros.mes}
                opciones={MESES.map((m, i) => ({ valor: String(i + 1), texto: m }))}
                onChange={(v) => setFiltros({ ...filtros, mes: v })} />
      </div>
      <div>
        <label className="etiqueta" htmlFor="f-ciudad">Ciudad</label>
        <Select id="f-ciudad" valor={filtros.ciudad} opciones={opciones.ciudades}
                onChange={(v) => setFiltros({ ...filtros, ciudad: v })} />
      </div>
      <div>
        <label className="etiqueta" htmlFor="f-resp">Responsable</label>
        <Select id="f-resp" valor={filtros.responsable} opciones={opciones.responsables}
                onChange={(v) => setFiltros({ ...filtros, responsable: v })} />
      </div>
      <div>
        <label className="etiqueta" htmlFor="f-tipo">Tipo de evento</label>
        <Select id="f-tipo" valor={filtros.tipo_evento} opciones={opciones.tipos}
                onChange={(v) => setFiltros({ ...filtros, tipo_evento: v })} />
      </div>
      <div>
        <label className="etiqueta" htmlFor="f-estado">Estado</label>
        <Select id="f-estado" valor={filtros.estado} opciones={opciones.estados}
                onChange={(v) => setFiltros({ ...filtros, estado: v })} />
      </div>
      <div>
        <label className="etiqueta" htmlFor="f-cliente">Cliente</label>
        <Select id="f-cliente" valor={filtros.cliente} opciones={opciones.clientes}
                onChange={(v) => setFiltros({ ...filtros, cliente: v })} />
      </div>
    </div>
  );

  return (
    <section className="card mb-5 p-4 no-imprimir" aria-label="Filtros">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="titulo-seccion">Filtros</h2>
          {activos > 0 && (
            <span className="rounded-full bg-choho-red px-1.5 py-0.5 text-[10px] font-bold text-white">
              {activos}
            </span>
          )}
          <span className="text-xs text-neutral-500">
            · {eventosFiltrados.length} de {datos.eventos.length} eventos
          </span>
        </div>
        <div className="flex items-center gap-1">
          {hayFiltros && (
            <button className="btn-fantasma px-2 py-1 text-xs" onClick={limpiarFiltros}>
              Limpiar filtros
            </button>
          )}
          <button
            className="btn-fantasma px-2 py-1 text-xs sm:hidden"
            onClick={() => setAbierto((a) => !a)}
            aria-expanded={abierto}
          >
            {abierto ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </div>

      <div className={`${abierto ? "block" : "hidden"} mt-3 sm:mt-3 sm:block`}>
        {conBusqueda && (
          <div className="mb-3">
            <label className="etiqueta" htmlFor="f-buscar">Buscar</label>
            <input
              id="f-buscar"
              className="campo"
              placeholder="Evento, lugar, ciudad, cliente, responsable…"
              value={filtros.busqueda}
              onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })}
            />
          </div>
        )}
        {campos}
      </div>
    </section>
  );
}
