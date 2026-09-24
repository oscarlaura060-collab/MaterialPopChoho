"use client";

import React, { useMemo, useState } from "react";

export interface Columna<T> {
  clave: string;
  titulo: string;
  /** Contenido de la celda */
  celda: (fila: T) => React.ReactNode;
  /** Valor usado para ordenar (por defecto no ordena) */
  orden?: (fila: T) => string | number;
  alinear?: "izq" | "der";
  /** Se oculta en celular */
  soloEscritorio?: boolean;
}

/** Tabla con orden por columna. El filtrado vive en los filtros globales. */
export function Tabla<T>({
  columnas, filas, onFila, claveFila, vacio,
}: {
  columnas: Columna<T>[];
  filas: T[];
  onFila?: (f: T) => void;
  claveFila: (f: T) => string;
  vacio?: React.ReactNode;
}) {
  const [orden, setOrden] = useState<{ clave: string; asc: boolean } | null>(null);

  const ordenadas = useMemo(() => {
    if (!orden) return filas;
    const col = columnas.find((c) => c.clave === orden.clave);
    if (!col?.orden) return filas;
    const f = [...filas].sort((a, b) => {
      const va = col.orden!(a), vb = col.orden!(b);
      if (va === vb) return 0;
      return (va > vb ? 1 : -1) * (orden.asc ? 1 : -1);
    });
    return f;
  }, [filas, orden, columnas]);

  if (!filas.length && vacio) return <>{vacio}</>;

  return (
    <div className="overflow-x-auto scroll-fino">
      <table className="min-w-full divide-y divide-neutral-200">
        <thead className="bg-neutral-50">
          <tr>
            {columnas.map((c) => (
              <th
                key={c.clave}
                scope="col"
                className={`th ${c.alinear === "der" ? "text-right" : ""} ${
                  c.soloEscritorio ? "hidden lg:table-cell" : ""
                } ${c.orden ? "cursor-pointer select-none hover:text-neutral-800" : ""}`}
                onClick={() =>
                  c.orden &&
                  setOrden((o) =>
                    o?.clave === c.clave ? { clave: c.clave, asc: !o.asc } : { clave: c.clave, asc: true }
                  )
                }
                aria-sort={
                  orden?.clave === c.clave ? (orden.asc ? "ascending" : "descending") : undefined
                }
              >
                {c.titulo}
                {c.orden && (
                  <span className="ml-1 text-neutral-400" aria-hidden>
                    {orden?.clave === c.clave ? (orden.asc ? "↑" : "↓") : "↕"}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 bg-white">
          {ordenadas.map((f) => (
            <tr
              key={claveFila(f)}
              className={onFila ? "cursor-pointer transition-colors hover:bg-neutral-50" : ""}
              onClick={onFila ? () => onFila(f) : undefined}
            >
              {columnas.map((c) => (
                <td
                  key={c.clave}
                  className={`td ${c.alinear === "der" ? "text-right tabular-nums" : ""} ${
                    c.soloEscritorio ? "hidden lg:table-cell" : ""
                  }`}
                >
                  {c.celda(f)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Tabla compacta para la vista alterna de los gráficos */
export function TablaDatos({
  cabeceras, filas,
}: { cabeceras: string[]; filas: (string | number)[][] }) {
  return (
    <table className="min-w-full text-sm">
      <thead>
        <tr className="border-b border-neutral-200">
          {cabeceras.map((h, i) => (
            <th key={h} className={`th ${i > 0 ? "text-right" : ""}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-neutral-100">
        {filas.map((f, i) => (
          <tr key={i}>
            {f.map((c, j) => (
              <td key={j} className={`td ${j > 0 ? "text-right tabular-nums" : ""}`}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
