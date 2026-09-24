"use client";

import React from "react";

/**
 * Tarjeta de indicador. El número es el protagonista (hero number);
 * la etiqueta y el apoyo van en tinta secundaria, nunca en color de serie.
 */
export function Kpi({
  etiqueta, valor, apoyo, acento = false, icono,
}: {
  etiqueta: string;
  valor: string;
  apoyo?: string;
  acento?: boolean;
  icono?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="titulo-seccion">{etiqueta}</p>
        {icono && <span className="text-sm opacity-60" aria-hidden>{icono}</span>}
      </div>
      <p className={`mt-2 text-2xl font-black tabular-nums tracking-tight sm:text-[28px] ${
        acento ? "text-choho-red" : "text-neutral-900"
      }`}>
        {valor}
      </p>
      {apoyo && <p className="mt-1 text-xs text-neutral-500">{apoyo}</p>}
    </div>
  );
}

export function Fila({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">{children}</div>
  );
}
