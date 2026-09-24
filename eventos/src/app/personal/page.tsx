"use client";

import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Encabezado } from "@/components/shell";
import { Columna, Tabla, TablaDatos } from "@/components/tabla";
import { Aviso, Grafico, Modal, Select, Vacio } from "@/components/ui";
import { NEUTRO, SERIES, TIPOS_LISTA } from "@/lib/constants";
import { num, pct } from "@/lib/format";
import { useApp } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import type { Persona } from "@/lib/types";
import { exportarHoja } from "@/lib/exportar";

export default function PersonalPage() {
  const { datos, esAdmin, recargar, cargando, catalogo } = useApp();
  const [editar, setEditar] = useState<Partial<Persona> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const personas = datos.personas;

  const grafico = useMemo(
    () => personas
      .filter((p) => p.eventos_asignados > 0)
      .sort((a, b) => b.eventos_asignados - a.eventos_asignados)
      .map((p) => ({
        nombre: p.nombre.split(" ")[0] + " " + (p.nombre.split(" ")[1]?.[0] ?? "") + ".",
        completo: p.nombre,
        asistidos: p.asistidos,
        faltaron: p.no_asistio,
        pendientes: Math.max(0, p.eventos_asignados - p.asistidos - p.no_asistio),
      })),
    [personas]
  );

  const columnas: Columna<Persona>[] = [
    { clave: "codigo", titulo: "ID", orden: (p) => p.codigo ?? "",
      celda: (p) => <span className="font-mono text-xs text-neutral-500">{p.codigo ?? "—"}</span> },
    { clave: "nombre", titulo: "Nombre", orden: (p) => p.nombre,
      celda: (p) => <span className="font-semibold">{p.nombre}</span> },
    { clave: "cargo", titulo: "Cargo / área", orden: (p) => p.cargo_area ?? "", soloEscritorio: true,
      celda: (p) => p.cargo_area ?? "—" },
    { clave: "activo", titulo: "Activo", soloEscritorio: true, orden: (p) => (p.activo ? 1 : 0),
      celda: (p) => p.activo
        ? <span className="badge bg-emerald-50 text-emerald-800 ring-emerald-600/25">SÍ</span>
        : <span className="badge bg-neutral-100 text-neutral-600 ring-neutral-400/25">NO</span> },
    { clave: "asignados", titulo: "Eventos", alinear: "der", orden: (p) => p.eventos_asignados,
      celda: (p) => num(p.eventos_asignados) },
    { clave: "confirmados", titulo: "Confirmados", alinear: "der", soloEscritorio: true,
      orden: (p) => p.confirmados, celda: (p) => num(p.confirmados) },
    { clave: "pendientes", titulo: "Pendientes", alinear: "der", soloEscritorio: true,
      orden: (p) => p.pendientes, celda: (p) => num(p.pendientes) },
    { clave: "no_va", titulo: "No va", alinear: "der", soloEscritorio: true,
      orden: (p) => p.no_va, celda: (p) => num(p.no_va) },
    { clave: "asistidos", titulo: "Asistió", alinear: "der", orden: (p) => p.asistidos,
      celda: (p) => num(p.asistidos) },
    { clave: "no_asistio", titulo: "No asistió", alinear: "der", soloEscritorio: true,
      orden: (p) => p.no_asistio, celda: (p) => num(p.no_asistio) },
    { clave: "pct", titulo: "% Asistencia", alinear: "der", orden: (p) => p.pct_asistencia ?? -1,
      celda: (p) => <span className="font-semibold">{pct(p.pct_asistencia)}</span> },
    { clave: "horas", titulo: "Horas", alinear: "der", soloEscritorio: true,
      orden: (p) => p.horas_totales, celda: (p) => num(p.horas_totales) },
  ];

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!editar?.nombre?.trim()) return setError("El nombre es obligatorio.");
    setGuardando(true);
    setError(null);
    try {
      const cuerpo = {
        codigo: editar.codigo?.trim() || null,
        nombre: editar.nombre.trim(),
        cargo_area: editar.cargo_area?.trim() || null,
        activo: editar.activo ?? true,
        observaciones: editar.observaciones?.trim() || null,
      };
      const res = editar.id
        ? await supabase.from("personas").update(cuerpo).eq("id", editar.id)
        : await supabase.from("personas").insert(cuerpo);
      if (res.error) throw res.error;
      await recargar();
      setEditar(null);
    } catch (err) {
      const m = err instanceof Error ? err.message : "No fue posible guardar.";
      setError(m.includes("personas_nombre_key") ? "Ya existe una persona con ese nombre." : m);
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return null;

  return (
    <>
      <Encabezado
        titulo="Personal"
        descripcion="Participación de cada persona, calculada a partir de los eventos registrados."
        acciones={
          <>
            <button className="btn-secundario" disabled={!personas.length}
              onClick={() => exportarHoja("PERSONAL",
                ["ID PERSONA", "NOMBRE", "CARGO / ÁREA", "ACTIVO", "EVENTOS ASIGNADOS", "CONFIRMADOS",
                 "PENDIENTES", "NO VA", "ASISTIDOS", "NO ASISTIÓ", "% ASISTENCIA", "HORAS"],
                personas.map((p) => [
                  p.codigo, p.nombre, p.cargo_area, p.activo ? "SÍ" : "NO", p.eventos_asignados,
                  p.confirmados, p.pendientes, p.no_va, p.asistidos, p.no_asistio,
                  p.pct_asistencia, p.horas_totales,
                ]), { K: "0%" })}>
              ⬇ Excel
            </button>
            {esAdmin && (
              <button className="btn-primario" onClick={() => setEditar({ activo: true })}>
                + Nueva persona
              </button>
            )}
          </>
        }
      />

      {grafico.length > 0 && (
        <div className="mb-5">
          <Grafico
            titulo="Participación por persona"
            subtitulo="Eventos asignados, divididos entre asistidos, no asistidos y pendientes"
            alto={Math.max(220, grafico.length * 42)}
            tabla={<TablaDatos cabeceras={["Persona", "Asistió", "No asistió", "Pendiente"]}
                    filas={grafico.map((g) => [g.completo, g.asistidos, g.faltaron, g.pendientes])} />}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={grafico} layout="vertical" margin={{ top: 4, right: 20, left: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="nombre" width={92} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: "1px solid #e3e2e0", fontSize: 12 }}
                  cursor={{ fill: "rgba(20,20,20,.04)" }}
                  labelFormatter={(_l, p) => p?.[0]?.payload?.completo ?? ""}
                />
                <Bar dataKey="asistidos" stackId="a" name="Asistió" fill={SERIES.s4}
                     stroke="#fff" strokeWidth={2} maxBarSize={22}>
                  <LabelList dataKey="asistidos" position="center" fill="#fff" fontSize={10} fontWeight={700}
                             formatter={(v: number) => (v > 0 ? v : "")} />
                </Bar>
                <Bar dataKey="faltaron" stackId="a" name="No asistió" fill={SERIES.s1}
                     stroke="#fff" strokeWidth={2} maxBarSize={22} />
                <Bar dataKey="pendientes" stackId="a" name="Pendiente" fill={NEUTRO}
                     stroke="#fff" strokeWidth={2} radius={[0, 4, 4, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </Grafico>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
            {[
              { c: SERIES.s4, t: "Asistió" },
              { c: SERIES.s1, t: "No asistió" },
              { c: NEUTRO, t: "Pendiente" },
            ].map((i) => (
              <li key={i.t} className="flex items-center gap-1.5 text-xs text-neutral-600">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: i.c }} aria-hidden />
                {i.t}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card overflow-hidden">
        <Tabla
          columnas={columnas}
          filas={personas}
          claveFila={(p) => p.id}
          onFila={esAdmin ? (p) => setEditar(p) : undefined}
          vacio={<Vacio icono="👥" titulo="Sin personal registrado"
                        detalle="Agrega las personas que participan en los eventos." />}
        />
      </div>

      <Modal abierto={!!editar} onCerrar={() => { setEditar(null); setError(null); }}
             titulo={editar?.id ? "Editar persona" : "Nueva persona"}>
        <form onSubmit={guardar} className="space-y-4">
          {error && <Aviso tipo="error">{error}</Aviso>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="etiqueta" htmlFor="p-cod">ID persona</label>
              <input id="p-cod" className="campo font-mono" placeholder="P-009"
                     value={editar?.codigo ?? ""}
                     onChange={(e) => setEditar({ ...editar, codigo: e.target.value })} />
            </div>
            <div>
              <label className="etiqueta" htmlFor="p-nom">Nombre *</label>
              <input id="p-nom" className="campo" required value={editar?.nombre ?? ""}
                     onChange={(e) => setEditar({ ...editar, nombre: e.target.value })} />
            </div>
            <div>
              <label className="etiqueta" htmlFor="p-car">Cargo / área</label>
              <Select id="p-car" valor={editar?.cargo_area ?? ""} placeholder="—"
                      opciones={catalogo(TIPOS_LISTA.ROL)}
                      onChange={(v) => setEditar({ ...editar, cargo_area: v })} />
            </div>
            <div>
              <label className="etiqueta" htmlFor="p-act">Activo</label>
              <select id="p-act" className="campo" value={editar?.activo ? "SÍ" : "NO"}
                      onChange={(e) => setEditar({ ...editar, activo: e.target.value === "SÍ" })}>
                <option>SÍ</option><option>NO</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="etiqueta" htmlFor="p-obs">Observaciones</label>
              <textarea id="p-obs" rows={2} className="campo" value={editar?.observaciones ?? ""}
                        onChange={(e) => setEditar({ ...editar, observaciones: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-secundario" onClick={() => setEditar(null)}>Cancelar</button>
            <button type="submit" className="btn-primario" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
