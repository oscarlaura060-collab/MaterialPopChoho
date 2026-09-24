import React, { useRef, useState } from "react";
import { Encabezado } from "@/components/shell";
import { Aviso, Vacio } from "@/components/ui";
import { TIPOS_LISTA } from "@/lib/constants";
import { money } from "@/lib/format";
import { exportarEventosExcel } from "@/lib/exportar";
import { importarExcel, type ResumenImportacion } from "@/lib/importar";
import { useApp } from "@/lib/store";
import { ARCHIVO, elegirCarpeta, nombreCarpeta, respaldar } from "./archivos";
import { cargarDesdeCarpeta } from "./shim/supabase";

const ETIQUETAS: Record<string, string> = {
  ESTADO: "Estados del evento", TIPO_EVENTO: "Tipos de evento", CIUDAD: "Ciudades",
  ROL: "Roles / funciones", CATEGORIA: "Categorías de gasto",
  FORMA_PAGO: "Formas de pago", ESTADO_PAGO: "Estados de pago",
};

function Bloque({ titulo, descripcion, children }: {
  titulo: string; descripcion?: string; children: React.ReactNode;
}) {
  return (
    <section className="card overflow-hidden">
      <header className="border-b border-neutral-200 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-bold text-neutral-900">{titulo}</h2>
        {descripcion && <p className="mt-0.5 text-xs text-neutral-500">{descripcion}</p>}
      </header>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}

export default function Configuracion() {
  const { datos, catalogo, recargar, cargando } = useApp();
  const input = useRef<HTMLInputElement>(null);

  const [importando, setImportando] = useState(false);
  const [resumen, setResumen] = useState<ResumenImportacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function importar(f: File | undefined) {
    if (!f) return;
    setImportando(true); setResumen(null); setError(null); setAviso(null);
    try {
      const r = await importarExcel(f);
      setResumen(r);
      await recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible leer el archivo.");
    } finally {
      setImportando(false);
      if (input.current) input.current.value = "";
    }
  }

  async function hacerRespaldo() {
    setError(null); setAviso(null);
    try {
      const n = await respaldar();
      setAviso(`Copia guardada en respaldos/${n}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible respaldar.");
    }
  }

  async function cambiarCarpeta() {
    setError(null); setAviso(null);
    try {
      await elegirCarpeta();
      await cargarDesdeCarpeta();
      await recargar();
      setAviso(`Ahora estás trabajando en "${nombreCarpeta()}".`);
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "No fue posible cambiar de carpeta.");
    }
  }

  if (cargando) return null;

  return (
    <>
      <Encabezado titulo="Configuración"
                  descripcion="Tu carpeta, respaldos, importación del Excel y catálogos." />

      <div className="space-y-5">
        <Bloque titulo="Dónde se guarda"
                descripcion="Toda la información vive en esta carpeta de tu computador.">
          <div className="space-y-3">
            <div className="rounded-lg bg-neutral-50 p-4 ring-1 ring-neutral-200">
              <p className="text-sm font-semibold text-neutral-900">📁 {nombreCarpeta() ?? "—"}</p>
              <ul className="mt-2 space-y-1 text-xs text-neutral-600">
                <li><code className="font-mono">{ARCHIVO}</code> — eventos, personal, material, gastos y resultados</li>
                <li><code className="font-mono">anexos/</code> — las fotografías, organizadas por evento</li>
                <li><code className="font-mono">respaldos/</code> — copias fechadas</li>
              </ul>
              <p className="mt-3 text-xs text-neutral-500">
                Puedes copiar esta carpeta a una memoria USB o ponerla dentro de OneDrive
                para tener respaldo automático.
              </p>
            </div>
            {aviso && <Aviso tipo="ok">{aviso}</Aviso>}
            {error && <Aviso tipo="error">{error}</Aviso>}
            <div className="flex flex-wrap gap-2">
              <button className="btn-secundario" onClick={hacerRespaldo}>💾 Hacer una copia ahora</button>
              <button className="btn-secundario" onClick={cambiarCarpeta}>📁 Cambiar de carpeta</button>
            </div>
          </div>
        </Bloque>

        <Bloque titulo="Importar Excel"
                descripcion="Carga EVENTOS REALIZADOS.xlsx. Se cruza por ID EVENTO, así que reimportar actualiza en vez de duplicar.">
          <div className="space-y-3">
            <input ref={input} type="file" className="hidden"
                   accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                   onChange={(e) => importar(e.target.files?.[0])} />
            <button className="btn-primario" onClick={() => input.current?.click()} disabled={importando}>
              {importando ? "Importando…" : "⬆ Seleccionar archivo Excel"}
            </button>
            <p className="text-xs text-neutral-500">
              Se leen las hojas EVENTOS, PERSONAL, PARTICIPACIÓN, MATERIAL POP, GASTOS,
              RESULTADOS y LISTAS. Las filas hijas de cada evento importado se reemplazan
              por las del archivo.
            </p>

            {resumen && (
              <div className="rounded-lg bg-neutral-50 p-4 ring-1 ring-neutral-200">
                <p className="text-sm font-bold text-neutral-900">Importación completada</p>
                <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Eventos nuevos", resumen.eventos.nuevos],
                    ["Eventos actualizados", resumen.eventos.actualizados],
                    ["Personas", resumen.personas],
                    ["Materiales del catálogo", resumen.materiales],
                    ["Filas de material POP", resumen.material],
                    ["Gastos", resumen.gastos],
                    ["Participaciones", resumen.participacion],
                    ["Resultados", resumen.resultados],
                  ].map(([k, v]) => (
                    <div key={k as string}>
                      <dt className="titulo-seccion">{k}</dt>
                      <dd className="text-lg font-black tabular-nums">{v as number}</dd>
                    </div>
                  ))}
                </dl>
                {resumen.avisos.length > 0 && (
                  <ul className="mt-3 space-y-1.5 border-t border-neutral-200 pt-3">
                    {resumen.avisos.map((a, i) => (
                      <li key={i} className="text-xs text-neutral-600">· {a}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </Bloque>

        <Bloque titulo="Exportar a Excel" descripcion="Descarga toda la información en un libro con las mismas hojas del original.">
          <button className="btn-secundario" disabled={!datos.eventos.length}
                  onClick={() => exportarEventosExcel(datos.eventos, datos)}>
            ⬇ Exportar todo a Excel
          </button>
          <p className="mt-1.5 text-xs text-neutral-500">
            El PDF de un evento se descarga desde su ficha. Para enviarle algo a los
            jefes, usa <strong>Compartir</strong>.
          </p>
        </Bloque>

        <Bloque titulo="Catálogo de material POP"
                descripcion="El costo unitario se aplica automáticamente al registrar material en un evento.">
          {datos.materiales.length === 0 ? (
            <Vacio icono="📦" titulo="Sin materiales en el catálogo" />
          ) : (
            <div className="overflow-x-auto scroll-fino">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr><th className="th">Material</th><th className="th text-right">Costo unitario</th></tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {datos.materiales.map((m) => (
                    <tr key={m.id}>
                      <td className="td font-medium">{m.nombre}</td>
                      <td className="td text-right tabular-nums">{money(m.costo_unitario)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Bloque>

        <Bloque titulo="Listas" descripcion="Valores que alimentan todos los desplegables. Provienen de la hoja LISTAS.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.values(TIPOS_LISTA).map((tipo) => {
              const valores = catalogo(tipo);
              return (
                <div key={tipo} className="rounded-lg bg-neutral-50 p-3 ring-1 ring-neutral-200">
                  <p className="text-xs font-bold text-neutral-800">{ETIQUETAS[tipo] ?? tipo}</p>
                  <p className="mt-0.5 text-[11px] text-neutral-500">{valores.length} valores</p>
                  <ul className="mt-2 flex flex-wrap gap-1">
                    {valores.map((v) => (
                      <li key={v} className="rounded bg-white px-1.5 py-0.5 text-[11px] text-neutral-700 ring-1 ring-neutral-200">{v}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Bloque>
      </div>
    </>
  );
}
