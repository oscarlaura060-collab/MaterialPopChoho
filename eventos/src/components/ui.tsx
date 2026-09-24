"use client";

import React from "react";
import { COLOR_ESTADO } from "@/lib/constants";

export function Badge({ estado }: { estado?: string | null }) {
  if (!estado) return <span className="text-neutral-400">—</span>;
  const cls = COLOR_ESTADO[estado] ?? "bg-neutral-100 text-neutral-700 ring-neutral-400/25";
  return <span className={`badge ${cls}`}>{estado}</span>;
}

export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5
                     text-xs font-medium text-neutral-700 ring-1 ring-inset ring-neutral-200">
      {children}
    </span>
  );
}

export function Campo({
  label, children, ancho = "",
}: { label: string; children: React.ReactNode; ancho?: string }) {
  return (
    <div className={ancho}>
      <label className="etiqueta">{label}</label>
      {children}
    </div>
  );
}

export function Select({
  valor, onChange, opciones, placeholder = "Todos", id,
}: {
  valor: string;
  onChange: (v: string) => void;
  opciones: { valor: string; texto: string }[] | string[];
  placeholder?: string;
  id?: string;
}) {
  const items = opciones.map((o) =>
    typeof o === "string" ? { valor: o, texto: o } : o
  );
  return (
    <select id={id} className="campo" value={valor} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {items.map((o) => (
        <option key={o.valor} value={o.valor}>{o.texto}</option>
      ))}
    </select>
  );
}

export function Vacio({ titulo, detalle, icono = "○" }: {
  titulo: string; detalle?: string; icono?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <span className="text-3xl text-neutral-300" aria-hidden>{icono}</span>
      <p className="text-sm font-semibold text-neutral-700">{titulo}</p>
      {detalle && <p className="max-w-sm text-sm text-neutral-500">{detalle}</p>}
    </div>
  );
}

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-neutral-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-choho-red" />
      {texto}
    </div>
  );
}

export function Aviso({ tipo = "info", children }: {
  tipo?: "info" | "error" | "ok"; children: React.ReactNode;
}) {
  const estilos = {
    info: "bg-blue-50 text-blue-900 ring-blue-600/20",
    error: "bg-choho-redLight text-red-900 ring-red-600/25",
    ok: "bg-emerald-50 text-emerald-900 ring-emerald-600/20",
  }[tipo];
  return (
    <div className={`rounded-lg px-3.5 py-2.5 text-sm ring-1 ring-inset ${estilos}`} role="status">
      {children}
    </div>
  );
}

export function Modal({
  abierto, onCerrar, titulo, children, ancho = "max-w-2xl",
}: {
  abierto: boolean; onCerrar: () => void; titulo: string;
  children: React.ReactNode; ancho?: string;
}) {
  React.useEffect(() => {
    if (!abierto) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
         role="dialog" aria-modal="true" aria-label={titulo} onClick={onCerrar}>
      <div className={`w-full ${ancho} animate-fadeUp rounded-t-2xl bg-white shadow-pop sm:rounded-2xl`}
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3.5">
          <h2 className="text-base font-bold text-neutral-900">{titulo}</h2>
          <button className="btn-fantasma -mr-2 px-2 py-1 text-lg" onClick={onCerrar} aria-label="Cerrar">×</button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto scroll-fino px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/** Contenedor de gráfico: título, acción de tabla y la superficie del gráfico */
export function Grafico({
  titulo, subtitulo, children, tabla, alto = 260,
}: {
  titulo: string; subtitulo?: string; children: React.ReactNode;
  tabla?: React.ReactNode; alto?: number;
}) {
  const [verTabla, setVerTabla] = React.useState(false);
  return (
    <section className="card-p">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-neutral-900">{titulo}</h3>
          {subtitulo && <p className="mt-0.5 text-xs text-neutral-500">{subtitulo}</p>}
        </div>
        {tabla && (
          <button
            className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
            onClick={() => setVerTabla((v) => !v)}
            aria-pressed={verTabla}
          >
            {verTabla ? "Ver gráfico" : "Ver tabla"}
          </button>
        )}
      </div>
      {verTabla && tabla ? (
        <div className="overflow-x-auto scroll-fino">{tabla}</div>
      ) : (
        <div style={{ height: alto }}>{children}</div>
      )}
    </section>
  );
}

/** Leyenda manual: identidad nunca queda solo en el color */
export function Leyenda({ items }: { items: { color: string; texto: string }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((i) => (
        <li key={i.texto} className="flex items-center gap-1.5 text-xs text-neutral-600">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: i.color }} aria-hidden />
          {i.texto}
        </li>
      ))}
    </ul>
  );
}
