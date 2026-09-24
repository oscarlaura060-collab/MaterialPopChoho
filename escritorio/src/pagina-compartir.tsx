import React, { useMemo, useState } from "react";
import { Filtros } from "@/components/filtros";
import { Encabezado } from "@/components/shell";
import { Aviso, Vacio } from "@/components/ui";
import { fechaCorta, num } from "@/lib/format";
import { useApp } from "@/lib/store";
import { escribirArchivo, nombreCarpeta } from "./archivos";
import { generarInforme } from "./informe";

function descargar(nombre: string, texto: string) {
  const b = new Blob([texto], { type: "text/html;charset=utf-8" });
  const u = URL.createObjectURL(b);
  const a = document.createElement("a");
  a.href = u; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 3000);
}

export default function Compartir() {
  const { datos, eventosFiltrados, idsFiltrados, cargando } = useApp();
  const [fotos, setFotos] = useState(true);
  const [titulo, setTitulo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [hecho, setHecho] = useState<{ nombre: string; fotos: number; peso: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nAnexos = useMemo(
    () => datos.anexos.filter(
      (a) => idsFiltrados.has(a.evento_id) && a.mime_type?.startsWith("image/")
    ).length,
    [datos.anexos, idsFiltrados]
  );

  async function generar(guardarEnCarpeta: boolean) {
    setOcupado(true); setError(null); setHecho(null);
    try {
      const r = await generarInforme(
        {
          eventos: eventosFiltrados,
          material: datos.material,
          gastos: datos.gastos,
          participacion: datos.participacion,
          resultados: datos.resultados,
          anexos: datos.anexos as never,
        },
        { incluirFotos: fotos, titulo: titulo.trim() || undefined }
      );
      const peso = (new Blob([r.html]).size / 1024 / 1024).toFixed(1) + " MB";
      if (guardarEnCarpeta) await escribirArchivo(r.nombre, r.html);
      else descargar(r.nombre, r.html);
      setHecho({ nombre: r.nombre, fotos: r.fotos, peso });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible generar el informe.");
    } finally {
      setOcupado(false);
    }
  }

  if (cargando) return null;

  return (
    <>
      <Encabezado
        titulo="Compartir"
        descripcion="Genera un archivo único que puedes enviar por WhatsApp o correo."
      />

      <Filtros />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="card-p space-y-4">
            <div>
              <h2 className="text-sm font-bold text-neutral-900">Qué va a contener</h2>
              <p className="mt-1 text-sm text-neutral-600">
                El informe incluye los <strong>{eventosFiltrados.length} evento
                {eventosFiltrados.length === 1 ? "" : "s"}</strong> que pasan los filtros de
                arriba, con su material POP, gastos, personal, resultados y fotografías.
              </p>
            </div>

            <div>
              <label className="etiqueta" htmlFor="titulo">Título del informe</label>
              <input id="titulo" className="campo" value={titulo}
                     placeholder="Informe de eventos · septiembre 2026"
                     onChange={(e) => setTitulo(e.target.value)} />
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-neutral-50 p-3 ring-1 ring-neutral-200">
              <input type="checkbox" checked={fotos} onChange={(e) => setFotos(e.target.checked)}
                     className="mt-0.5 h-4 w-4 accent-[#d0342c]" />
              <span className="text-sm">
                <span className="font-semibold text-neutral-900">Incluir las fotografías</span>
                <span className="block text-neutral-600">
                  {nAnexos > 0
                    ? `${num(nAnexos)} fotografía${nAnexos === 1 ? "" : "s"}. Se reducen de tamaño
                       para que el archivo sea liviano y se pueda enviar por WhatsApp.`
                    : "No hay fotografías en los eventos filtrados."}
                </span>
              </span>
            </label>

            {error && <Aviso tipo="error">{error}</Aviso>}

            {hecho && (
              <Aviso tipo="ok">
                Informe <strong>{hecho.nombre}</strong> generado · {hecho.peso}
                {hecho.fotos > 0 ? ` · ${hecho.fotos} fotografía(s)` : ""}.
                Ya puedes adjuntarlo en WhatsApp o en un correo.
              </Aviso>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button className="btn-primario" disabled={ocupado || !eventosFiltrados.length}
                      onClick={() => generar(true)}>
                {ocupado ? "Generando…" : "📤 Guardar en mi carpeta"}
              </button>
              <button className="btn-secundario" disabled={ocupado || !eventosFiltrados.length}
                      onClick={() => generar(false)}>
                ⬇ Descargar
              </button>
            </div>
            {!eventosFiltrados.length && (
              <p className="text-xs text-neutral-500">
                No hay eventos con los filtros actuales.
              </p>
            )}
          </section>

          {eventosFiltrados.length > 0 && (
            <section className="card overflow-hidden">
              <header className="border-b border-neutral-200 px-4 py-3 sm:px-5">
                <h2 className="text-sm font-bold text-neutral-900">Eventos incluidos</h2>
              </header>
              <ul className="divide-y divide-neutral-100">
                {eventosFiltrados.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{e.nombre}</p>
                      <p className="text-xs text-neutral-500">
                        <span className="font-mono">{e.codigo}</span> · {fechaCorta(e.fecha)}
                        {e.ciudad ? ` · ${e.ciudad}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-neutral-500">
                      {e.n_anexos > 0 ? `${e.n_anexos} foto(s)` : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="card-p">
            <h2 className="text-sm font-bold text-neutral-900">Cómo lo envías</h2>
            <ol className="mt-3 space-y-3 text-sm text-neutral-700">
              <li className="flex gap-2.5">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-choho-red text-[11px] font-bold text-white">1</span>
                Genera el informe. Queda en tu carpeta
                {nombreCarpeta() ? <> <strong>{nombreCarpeta()}</strong></> : null}.
              </li>
              <li className="flex gap-2.5">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-choho-red text-[11px] font-bold text-white">2</span>
                Adjúntalo en WhatsApp, Teams o un correo, como cualquier archivo.
              </li>
              <li className="flex gap-2.5">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-choho-red text-[11px] font-bold text-white">3</span>
                El jefe lo abre y lo ve en su celular, sin instalar nada y sin internet.
              </li>
            </ol>
          </section>

          <section className="card-p">
            <h2 className="text-sm font-bold text-neutral-900">Ten en cuenta</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              El informe es una <strong>copia del momento</strong>: no se actualiza solo.
              Cuando registres eventos nuevos, genera y envía uno nuevo.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              Nadie puede modificarlo desde su celular, así que tu carpeta sigue siendo
              la única fuente real.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
