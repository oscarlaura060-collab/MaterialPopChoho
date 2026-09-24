"use client";

import { useRef, useState } from "react";
import { Encabezado } from "@/components/shell";
import { Aviso, Vacio } from "@/components/ui";
import { TIPOS_LISTA } from "@/lib/constants";
import { money } from "@/lib/format";
import { importarExcel, type ResumenImportacion } from "@/lib/importar";
import { useApp } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { exportarEventosExcel } from "@/lib/exportar";
import type { Rol, Usuario } from "@/lib/types";

const ETIQUETAS: Record<string, string> = {
  ESTADO: "Estados del evento",
  TIPO_EVENTO: "Tipos de evento",
  CIUDAD: "Ciudades",
  ROL: "Roles / funciones",
  CATEGORIA: "Categorías de gasto",
  FORMA_PAGO: "Formas de pago",
  ESTADO_PAGO: "Estados de pago",
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
  const { datos, esAdmin, usuario, recargar, catalogo, cargando } = useApp();
  const input = useRef<HTMLInputElement>(null);

  const [importando, setImportando] = useState(false);
  const [resumen, setResumen] = useState<ResumenImportacion | null>(null);
  const [errorImp, setErrorImp] = useState<string | null>(null);

  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [errorUsr, setErrorUsr] = useState<string | null>(null);

  async function cargarUsuarios() {
    const { data, error } = await supabase.from("usuarios").select("*").order("email");
    if (error) setErrorUsr(error.message);
    else setUsuarios(data as Usuario[]);
  }

  async function cambiarRol(id: string, rol: Rol) {
    setErrorUsr(null);
    const { error } = await supabase.from("usuarios").update({ rol }).eq("id", id);
    if (error) setErrorUsr(error.message);
    else await cargarUsuarios();
  }

  async function importar(f: File | undefined) {
    if (!f) return;
    setImportando(true);
    setResumen(null);
    setErrorImp(null);
    try {
      const r = await importarExcel(f);
      setResumen(r);
      await recargar();
    } catch (e) {
      setErrorImp(e instanceof Error ? e.message : "No fue posible leer el archivo.");
    } finally {
      setImportando(false);
      if (input.current) input.current.value = "";
    }
  }

  if (cargando) return null;

  return (
    <>
      <Encabezado titulo="Configuración"
                  descripcion="Catálogos, importación del Excel y acceso de usuarios." />

      <div className="space-y-5">
        {/* IMPORTAR EXCEL */}
        <Bloque
          titulo="Importar Excel"
          descripcion="Carga EVENTOS REALIZADOS.xlsx. Se cruza por ID EVENTO, así que reimportar actualiza en vez de duplicar."
        >
          {!esAdmin ? (
            <Aviso>Solo un administrador puede importar información.</Aviso>
          ) : (
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

              {errorImp && <Aviso tipo="error">{errorImp}</Aviso>}

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
          )}
        </Bloque>

        {/* EXPORTAR */}
        <Bloque titulo="Exportar" descripcion="Descarga toda la información en un solo libro de Excel.">
          <button className="btn-secundario" disabled={!datos.eventos.length}
                  onClick={() => exportarEventosExcel(datos.eventos, datos)}>
            ⬇ Exportar todo a Excel
          </button>
          <p className="mt-1.5 text-xs text-neutral-500">
            El PDF de un evento se descarga desde su ficha. Cada sección exporta su propia hoja.
          </p>
        </Bloque>

        {/* CATÁLOGO DE MATERIALES */}
        <Bloque
          titulo="Catálogo de material POP"
          descripcion="El costo unitario se aplica automáticamente al registrar material en un evento."
        >
          {datos.materiales.length === 0 ? (
            <Vacio icono="📦" titulo="Sin materiales en el catálogo" />
          ) : (
            <div className="overflow-x-auto scroll-fino">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="th">Material</th>
                    <th className="th text-right">Costo unitario</th>
                    <th className="th">Activo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {datos.materiales.map((m) => (
                    <tr key={m.id}>
                      <td className="td font-medium">{m.nombre}</td>
                      <td className="td text-right tabular-nums">{money(m.costo_unitario)}</td>
                      <td className="td">{m.activo ? "SÍ" : "NO"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Bloque>

        {/* LISTAS */}
        <Bloque
          titulo="Listas"
          descripcion="Valores que alimentan todos los desplegables. Provienen de la hoja LISTAS."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.values(TIPOS_LISTA).map((tipo) => {
              const valores = catalogo(tipo);
              return (
                <div key={tipo} className="rounded-lg bg-neutral-50 p-3 ring-1 ring-neutral-200">
                  <p className="text-xs font-bold text-neutral-800">{ETIQUETAS[tipo] ?? tipo}</p>
                  <p className="mt-0.5 text-[11px] text-neutral-500">{valores.length} valores</p>
                  <ul className="mt-2 flex flex-wrap gap-1">
                    {valores.map((v) => (
                      <li key={v} className="rounded bg-white px-1.5 py-0.5 text-[11px] text-neutral-700 ring-1 ring-neutral-200">
                        {v}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Bloque>

        {/* USUARIOS */}
        <Bloque titulo="Usuarios y roles"
                descripcion="El ADMINISTRADOR registra y edita; el JEFE solo consulta.">
          {!esAdmin ? (
            <Aviso>
              Tu cuenta tiene el rol <strong>{usuario?.rol}</strong>. Solo un administrador
              puede cambiar los roles.
            </Aviso>
          ) : (
            <div className="space-y-3">
              {errorUsr && <Aviso tipo="error">{errorUsr}</Aviso>}
              {usuarios === null ? (
                <button className="btn-secundario" onClick={cargarUsuarios}>Ver usuarios</button>
              ) : (
                <div className="overflow-x-auto scroll-fino">
                  <table className="min-w-full divide-y divide-neutral-200">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th className="th">Nombre</th>
                        <th className="th">Correo</th>
                        <th className="th">Rol</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {usuarios.map((u) => (
                        <tr key={u.id}>
                          <td className="td font-medium">{u.nombre ?? "—"}</td>
                          <td className="td text-neutral-600">{u.email ?? "—"}</td>
                          <td className="td">
                            <select
                              className="campo py-1 text-xs"
                              value={u.rol}
                              disabled={u.id === usuario?.id}
                              title={u.id === usuario?.id ? "No puedes cambiar tu propio rol" : undefined}
                              onChange={(e) => cambiarRol(u.id, e.target.value as Rol)}
                            >
                              <option value="ADMINISTRADOR">ADMINISTRADOR</option>
                              <option value="JEFE">JEFE</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-xs text-neutral-500">
                    Los usuarios se crean desde la pantalla de ingreso. El primero en
                    registrarse queda como administrador; los demás entran como JEFE.
                  </p>
                </div>
              )}
            </div>
          )}
        </Bloque>
      </div>
    </>
  );
}
