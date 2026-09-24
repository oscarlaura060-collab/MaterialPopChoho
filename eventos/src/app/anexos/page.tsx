"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Filtros } from "@/components/filtros";
import { Galeria } from "@/components/galeria";
import { Fila, Kpi } from "@/components/kpi";
import { Encabezado } from "@/components/shell";
import { Vacio } from "@/components/ui";
import { fechaCorta, num } from "@/lib/format";
import { useApp } from "@/lib/store";

export default function AnexosPage() {
  const { datos, eventosFiltrados, idsFiltrados, cargando } = useApp();

  const anexos = useMemo(
    () => datos.anexos.filter((a) => idsFiltrados.has(a.evento_id)),
    [datos.anexos, idsFiltrados]
  );

  // Se agrupan por evento, en el mismo orden en que se listan los eventos
  const grupos = useMemo(
    () => eventosFiltrados
      .map((e) => ({ evento: e, archivos: anexos.filter((a) => a.evento_id === e.id) }))
      .filter((g) => g.archivos.length > 0),
    [eventosFiltrados, anexos]
  );

  const peso = useMemo(
    () => anexos.reduce((a, x) => a + (x.tamano_bytes ?? 0), 0),
    [anexos]
  );

  if (cargando) return null;

  return (
    <>
      <Encabezado
        titulo="Anexos"
        descripcion="Fotografías y documentos de cada evento."
      />

      <Filtros />

      <div className="mb-5">
        <Fila>
          <Kpi etiqueta="Archivos" icono="📎" valor={num(anexos.length)} />
          <Kpi etiqueta="Eventos con anexos" icono="📅" valor={num(grupos.length)}
               apoyo={`de ${eventosFiltrados.length} eventos`} />
          <Kpi etiqueta="Fotografías" icono="🖼️"
               valor={num(anexos.filter((a) => a.mime_type?.startsWith("image/")).length)} />
          <Kpi etiqueta="Documentos" icono="📄"
               valor={num(anexos.filter((a) => !a.mime_type?.startsWith("image/")).length)} />
          <Kpi etiqueta="Espacio" icono="💾"
               valor={peso ? `${(peso / 1024 / 1024).toFixed(1)} MB` : "—"} />
        </Fila>
      </div>

      {grupos.length === 0 ? (
        <div className="card">
          <Vacio icono="📎" titulo="Sin anexos"
                 detalle="Las fotografías se suben desde la ficha de cada evento." />
        </div>
      ) : (
        <div className="space-y-5">
          {grupos.map(({ evento, archivos }) => (
            <section key={evento.id} className="card overflow-hidden">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3 sm:px-5">
                <div>
                  <Link href={`/eventos/${evento.codigo}`}
                        className="text-sm font-bold text-neutral-900 hover:text-choho-red">
                    {evento.nombre}
                  </Link>
                  <p className="text-xs text-neutral-500">
                    <span className="font-mono">{evento.codigo}</span> · {fechaCorta(evento.fecha)}
                    {evento.ciudad ? ` · ${evento.ciudad}` : ""}
                  </p>
                </div>
                <span className="text-xs text-neutral-500">{archivos.length} archivo(s)</span>
              </header>
              <div className="px-4 py-4 sm:px-5">
                <Galeria anexos={archivos} eventoId={evento.id} />
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
