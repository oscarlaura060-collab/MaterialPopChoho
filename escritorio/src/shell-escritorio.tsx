import React, { useState } from "react";
import Link from "./shim/link";
import { useRuta } from "./shim/navegacion";
import { useApp } from "@/lib/store";

const MENU = [
  { href: "/", icono: "📊", texto: "Dashboard" },
  { href: "/eventos", icono: "📅", texto: "Eventos" },
  { href: "/comparar", icono: "⚖️", texto: "Comparar" },
  { href: "/personal", icono: "👥", texto: "Personal" },
  { href: "/material-pop", icono: "📦", texto: "Material POP" },
  { href: "/gastos", icono: "💰", texto: "Gastos" },
  { href: "/resultados", icono: "📈", texto: "Resultados" },
  { href: "/anexos", icono: "📎", texto: "Anexos" },
  { href: "/compartir", icono: "📤", texto: "Compartir" },
  { href: "/configuracion", icono: "⚙️", texto: "Configuración" },
];

const activo = (ruta: string, href: string) =>
  href === "/" ? ruta === "/" : ruta.startsWith(href);

export function ShellEscritorio({
  children, carpeta, guardando,
}: {
  children: React.ReactNode;
  carpeta: string | null;
  guardando: boolean;
}) {
  const ruta = useRuta();
  const { refrescando } = useApp();
  const [abierto, setAbierto] = useState(false);

  const barra = (
    <div className="flex h-full flex-col bg-choho-black">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-choho-red text-sm font-black text-white">CH</div>
        <div className="leading-tight">
          <p className="text-sm font-bold text-white">CHOHO</p>
          <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">Eventos</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3" aria-label="Secciones">
        {MENU.map((m) => {
          const on = activo(ruta, m.href);
          return (
            <Link key={m.href} href={m.href} onClick={() => setAbierto(false)}
                  aria-current={on ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    on ? "bg-choho-red text-white shadow-sm"
                       : "text-neutral-300 hover:bg-white/10 hover:text-white"}`}>
              <span className="text-base" aria-hidden>{m.icono}</span>
              {m.texto}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-5 py-4">
        <p className="text-[11px] uppercase tracking-wider text-neutral-500">Carpeta</p>
        <p className="mt-0.5 truncate text-xs font-semibold text-white" title={carpeta ?? ""}>
          📁 {carpeta ?? "—"}
        </p>
        <p className="mt-1.5 text-[11px] text-neutral-400">
          {guardando ? "Guardando…" : "Guardado en tu computador"}
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 lg:block">{barra}</aside>

      {abierto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAbierto(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 animate-slideIn">{barra}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden no-imprimir">
          <button className="btn-fantasma px-2 py-1 text-xl" onClick={() => setAbierto(true)}
                  aria-label="Abrir menú">☰</button>
          <span className="text-sm font-bold">CHOHO · Eventos</span>
        </header>

        {(refrescando || guardando) && (
          <div className="pointer-events-none fixed right-4 top-4 z-40 flex items-center gap-2
                          rounded-full bg-choho-black/90 px-3 py-1.5 text-xs font-semibold
                          text-white shadow-pop no-imprimir" role="status" aria-live="polite">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            {guardando ? "Guardando…" : "Actualizando…"}
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</main>
      </div>
    </div>
  );
}
