"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { OPCIONES_SI_NO, TIPOS_LISTA } from "@/lib/constants";
import { money, num, pct } from "@/lib/format";
import { useApp } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import type { EventoVista } from "@/lib/types";
import { Aviso, Select } from "./ui";

interface FilaMaterial {
  id?: string;
  material: string;
  cantidad_llevada: string;
  cantidad_sobrante: string;
  costo_unitario: string;
  observaciones: string;
}
interface FilaGasto {
  id?: string;
  categoria: string; descripcion: string; proveedor: string;
  responsable: string; valor: string; observaciones: string;
}
interface FilaPersonal {
  id?: string;
  persona_nombre: string; rol_funcion: string;
  confirmado: string; asistio: string;
  hora_ingreso: string; hora_salida: string; observaciones: string;
}

const vacioMaterial = (): FilaMaterial => ({
  material: "", cantidad_llevada: "", cantidad_sobrante: "", costo_unitario: "", observaciones: "",
});
const vacioGasto = (): FilaGasto => ({
  categoria: "", descripcion: "", proveedor: "", responsable: "", valor: "", observaciones: "",
});
const vacioPersonal = (): FilaPersonal => ({
  persona_nombre: "", rol_funcion: "", confirmado: "PENDIENTE", asistio: "PENDIENTE",
  hora_ingreso: "", hora_salida: "", observaciones: "",
});

const n = (v: string) => (v.trim() === "" ? 0 : Number(v));
const nn = (v: string) => (v.trim() === "" ? null : Number(v));
const t = (v: string) => (v.trim() === "" ? null : v.trim());

function Paso({ numero, titulo, descripcion, children }: {
  numero: number; titulo: string; descripcion?: string; children: React.ReactNode;
}) {
  return (
    <section className="card overflow-hidden">
      <header className="flex items-start gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-3 sm:px-5">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-choho-red text-xs font-bold text-white">
          {numero}
        </span>
        <div>
          <h2 className="text-sm font-bold text-neutral-900">{titulo}</h2>
          {descripcion && <p className="mt-0.5 text-xs text-neutral-500">{descripcion}</p>}
        </div>
      </header>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}

function BotonQuitar({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Quitar fila"
            className="rounded-md px-2 py-1 text-neutral-400 transition-colors hover:bg-choho-redLight hover:text-choho-red">
      ✕
    </button>
  );
}

export function FormularioEvento({ evento }: { evento?: EventoVista }) {
  const router = useRouter();
  const { datos, catalogo, recargar } = useApp();
  const editando = !!evento;

  const [general, setGeneral] = useState({
    codigo: evento?.codigo ?? "",
    nombre: evento?.nombre ?? "",
    fecha: evento?.fecha?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    ciudad: evento?.ciudad ?? "",
    lugar_negocio: evento?.lugar_negocio ?? "",
    direccion: evento?.direccion ?? "",
    cliente: evento?.cliente ?? "",
    tipo_evento: evento?.tipo_evento ?? "",
    responsable: evento?.responsable ?? "",
    estado: evento?.estado ?? "PLANIFICADO",
    asistentes_esperados: evento?.asistentes_esperados?.toString() ?? "",
    observaciones: evento?.observaciones ?? "",
  });

  const [personal, setPersonal] = useState<FilaPersonal[]>([]);
  const [material, setMaterial] = useState<FilaMaterial[]>([]);
  const [gastos, setGastos] = useState<FilaGasto[]>([]);
  const [resultado, setResultado] = useState({
    asistentes: "", clientes_atendidos: "", resultado_comercial: "",
    observaciones: "", aprendizajes: "",
  });

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Código sugerido para un evento nuevo
  useEffect(() => {
    if (editando) return;
    supabase.rpc("siguiente_codigo_evento").then(({ data }) => {
      if (data) setGeneral((g) => (g.codigo ? g : { ...g, codigo: String(data) }));
    });
  }, [editando]);

  // Precarga de las filas existentes al editar
  useEffect(() => {
    if (!evento) return;
    setPersonal(
      datos.participacion.filter((p) => p.evento_id === evento.id).map((p) => ({
        id: p.id, persona_nombre: p.persona_nombre, rol_funcion: p.rol_funcion ?? "",
        confirmado: p.confirmado, asistio: p.asistio,
        hora_ingreso: p.hora_ingreso?.slice(0, 5) ?? "",
        hora_salida: p.hora_salida?.slice(0, 5) ?? "",
        observaciones: p.observaciones ?? "",
      }))
    );
    setMaterial(
      datos.material.filter((m) => m.evento_id === evento.id).map((m) => ({
        id: m.id, material: m.material,
        cantidad_llevada: String(m.cantidad_llevada),
        cantidad_sobrante: String(m.cantidad_sobrante),
        costo_unitario: String(m.costo_unitario),
        observaciones: m.observaciones ?? "",
      }))
    );
    setGastos(
      datos.gastos.filter((g) => g.evento_id === evento.id).map((g) => ({
        id: g.id, categoria: g.categoria ?? "", descripcion: g.descripcion ?? "",
        proveedor: g.proveedor ?? "", responsable: g.responsable ?? "",
        valor: String(g.valor), observaciones: g.observaciones ?? "",
      }))
    );
    const r = datos.resultados.find((x) => x.evento_id === evento.id);
    if (r) {
      setResultado({
        asistentes: r.asistentes?.toString() ?? "",
        clientes_atendidos: r.clientes_atendidos?.toString() ?? "",
        resultado_comercial: r.resultado_comercial ?? "",
        observaciones: r.observaciones ?? "",
        aprendizajes: r.aprendizajes ?? "",
      });
    }
  }, [evento, datos]);

  const nombresPersonas = useMemo(
    () => datos.personas.filter((p) => p.activo).map((p) => p.nombre),
    [datos.personas]
  );
  const costoDe = useMemo(() => {
    const m = new Map(datos.materiales.map((x) => [x.nombre.toUpperCase(), x.costo_unitario]));
    return (nombre: string) => m.get(nombre.toUpperCase()) ?? 0;
  }, [datos.materiales]);

  // Totales en vivo, con la misma lógica del Excel
  const totales = useMemo(() => {
    // El gasto cuenta solo lo consumido: (llevada − sobrante) × costo
    const pop = material.reduce(
      (a, m) => a + Math.max(0, n(m.cantidad_llevada) - n(m.cantidad_sobrante)) * n(m.costo_unitario), 0);
    const adic = gastos.reduce((a, g) => a + n(g.valor), 0);
    return { pop, adic, total: pop + adic };
  }, [material, gastos]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!general.codigo.trim()) return setError("El ID del evento es obligatorio.");
    if (!general.nombre.trim()) return setError("El nombre del evento es obligatorio.");
    if (!general.fecha) return setError("La fecha es obligatoria.");

    for (const m of material.filter((x) => x.material.trim())) {
      if (n(m.cantidad_sobrante) > n(m.cantidad_llevada)) {
        return setError(
          `En "${m.material}" la cantidad sobrante (${num(n(m.cantidad_sobrante))}) ` +
          `no puede superar la llevada (${num(n(m.cantidad_llevada))}).`
        );
      }
    }
    const repetidos = personal
      .map((p) => p.persona_nombre.trim())
      .filter(Boolean)
      .filter((x, i, a) => a.indexOf(x) !== i);
    if (repetidos.length) return setError(`La persona "${repetidos[0]}" está repetida.`);

    setGuardando(true);
    try {
      const cuerpo = {
        codigo: general.codigo.trim().toUpperCase(),
        nombre: general.nombre.trim(),
        fecha: general.fecha,
        ciudad: t(general.ciudad),
        lugar_negocio: t(general.lugar_negocio),
        direccion: t(general.direccion),
        cliente: t(general.cliente),
        tipo_evento: t(general.tipo_evento),
        responsable: t(general.responsable),
        estado: general.estado,
        asistentes_esperados: nn(general.asistentes_esperados),
        observaciones: t(general.observaciones),
      };

      let eventoId = evento?.id;
      if (editando) {
        const { error: e1 } = await supabase.from("eventos").update(cuerpo).eq("id", eventoId!);
        if (e1) throw e1;
      } else {
        const { data, error: e1 } = await supabase.from("eventos").insert(cuerpo).select("id").single();
        if (e1) throw e1;
        eventoId = data.id as string;
      }

      // Las tablas hijas se reescriben completas: es la forma más simple
      // de reflejar altas, bajas y cambios hechos en el formulario.
      const idPorNombre = new Map(datos.personas.map((p) => [p.nombre, p.id]));

      await supabase.from("participacion").delete().eq("evento_id", eventoId!);
      const filasP = personal
        .filter((p) => p.persona_nombre.trim())
        .map((p) => ({
          evento_id: eventoId,
          persona_id: idPorNombre.get(p.persona_nombre.trim()) ?? null,
          persona_nombre: p.persona_nombre.trim(),
          confirmado: p.confirmado, asistio: p.asistio,
          rol_funcion: t(p.rol_funcion),
          hora_ingreso: t(p.hora_ingreso), hora_salida: t(p.hora_salida),
          observaciones: t(p.observaciones),
        }));
      if (filasP.length) {
        const { error: e2 } = await supabase.from("participacion").insert(filasP);
        if (e2) throw e2;
      }

      await supabase.from("material_pop").delete().eq("evento_id", eventoId!);
      const filasM = material
        .filter((m) => m.material.trim())
        .map((m) => ({
          evento_id: eventoId,
          material: m.material.trim(),
          cantidad_llevada: n(m.cantidad_llevada),
          cantidad_sobrante: n(m.cantidad_sobrante),
          costo_unitario: n(m.costo_unitario),
          observaciones: t(m.observaciones),
        }));
      if (filasM.length) {
        const { error: e3 } = await supabase.from("material_pop").insert(filasM);
        if (e3) throw e3;
      }

      await supabase.from("gastos").delete().eq("evento_id", eventoId!);
      const filasG = gastos
        .filter((g) => g.categoria.trim() || g.descripcion.trim() || n(g.valor) > 0)
        .map((g) => ({
          evento_id: eventoId,
          categoria: t(g.categoria), descripcion: t(g.descripcion),
          proveedor: t(g.proveedor), responsable: t(g.responsable),
          valor: n(g.valor), observaciones: t(g.observaciones),
        }));
      if (filasG.length) {
        const { error: e4 } = await supabase.from("gastos").insert(filasG);
        if (e4) throw e4;
      }

      const hayResultado = Object.values(resultado).some((v) => v.trim() !== "");
      if (hayResultado) {
        const { error: e5 } = await supabase.from("resultados").upsert({
          evento_id: eventoId,
          asistentes: nn(resultado.asistentes),
          clientes_atendidos: nn(resultado.clientes_atendidos),
          resultado_comercial: t(resultado.resultado_comercial),
          observaciones: t(resultado.observaciones),
          aprendizajes: t(resultado.aprendizajes),
        });
        if (e5) throw e5;
      } else if (editando) {
        await supabase.from("resultados").delete().eq("evento_id", eventoId!);
      }

      await recargar();
      router.push(`/eventos/${cuerpo.codigo}`);
    } catch (err) {
      const m = err instanceof Error ? err.message : "No fue posible guardar el evento.";
      setError(
        m.includes("eventos_codigo_key") || m.includes("duplicate key")
          ? `Ya existe un evento con el ID "${general.codigo}". Usa otro.`
          : m
      );
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-5 pb-28">
      {error && <Aviso tipo="error">{error}</Aviso>}

      {/* 1 · INFORMACIÓN GENERAL */}
      <Paso numero={1} titulo="Información general" descripcion="Los datos base de la hoja EVENTOS.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="etiqueta" htmlFor="codigo">ID evento *</label>
            <input id="codigo" className="campo font-mono" required value={general.codigo}
                   onChange={(e) => setGeneral({ ...general, codigo: e.target.value })}
                   placeholder="EV-004" />
          </div>
          <div className="sm:col-span-1 lg:col-span-2">
            <label className="etiqueta" htmlFor="nombre">Evento *</label>
            <input id="nombre" className="campo" required value={general.nombre}
                   onChange={(e) => setGeneral({ ...general, nombre: e.target.value })}
                   placeholder="ACTIVACIÓN PRIMERA DE MAYO" />
          </div>
          <div>
            <label className="etiqueta" htmlFor="fecha">Fecha *</label>
            <input id="fecha" type="date" className="campo" required value={general.fecha}
                   onChange={(e) => setGeneral({ ...general, fecha: e.target.value })} />
          </div>
          <div>
            <label className="etiqueta" htmlFor="ciudad">Ciudad</label>
            <Select id="ciudad" valor={general.ciudad} placeholder="Seleccionar…"
                    opciones={catalogo(TIPOS_LISTA.CIUDAD)}
                    onChange={(v) => setGeneral({ ...general, ciudad: v })} />
          </div>
          <div>
            <label className="etiqueta" htmlFor="lugar">Lugar / negocio</label>
            <input id="lugar" className="campo" value={general.lugar_negocio}
                   onChange={(e) => setGeneral({ ...general, lugar_negocio: e.target.value })}
                   placeholder="Mundimotos Primera de Mayo" />
          </div>
          <div className="sm:col-span-2">
            <label className="etiqueta" htmlFor="direccion">Dirección</label>
            <input id="direccion" className="campo" value={general.direccion}
                   onChange={(e) => setGeneral({ ...general, direccion: e.target.value })} />
          </div>
          <div>
            <label className="etiqueta" htmlFor="cliente">Cliente</label>
            <input id="cliente" className="campo" value={general.cliente}
                   onChange={(e) => setGeneral({ ...general, cliente: e.target.value })} />
          </div>
          <div>
            <label className="etiqueta" htmlFor="tipo">Tipo de evento</label>
            <Select id="tipo" valor={general.tipo_evento} placeholder="Seleccionar…"
                    opciones={catalogo(TIPOS_LISTA.TIPO_EVENTO)}
                    onChange={(v) => setGeneral({ ...general, tipo_evento: v })} />
          </div>
          <div>
            <label className="etiqueta" htmlFor="responsable">Responsable</label>
            <Select id="responsable" valor={general.responsable} placeholder="Seleccionar…"
                    opciones={nombresPersonas}
                    onChange={(v) => setGeneral({ ...general, responsable: v })} />
          </div>
          <div>
            <label className="etiqueta" htmlFor="estado">Estado</label>
            <Select id="estado" valor={general.estado} placeholder="Seleccionar…"
                    opciones={catalogo(TIPOS_LISTA.ESTADO)}
                    onChange={(v) => setGeneral({ ...general, estado: v })} />
          </div>
          <div>
            <label className="etiqueta" htmlFor="esperados">Asistentes esperados</label>
            <input id="esperados" type="number" min={0} className="campo"
                   value={general.asistentes_esperados}
                   onChange={(e) => setGeneral({ ...general, asistentes_esperados: e.target.value })} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="etiqueta" htmlFor="obs">Observaciones</label>
            <textarea id="obs" rows={2} className="campo" value={general.observaciones}
                      onChange={(e) => setGeneral({ ...general, observaciones: e.target.value })} />
          </div>
        </div>
      </Paso>

      {/* 2 · PERSONAL */}
      <Paso numero={2} titulo="Personal" descripcion="Quién fue convocado y quién asistió.">
        <div className="space-y-3">
          {personal.map((p, i) => (
            <div key={i} className="rounded-lg bg-neutral-50 p-3 ring-1 ring-neutral-200">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
                <div className="lg:col-span-2">
                  <label className="etiqueta">Persona</label>
                  <Select valor={p.persona_nombre} placeholder="Seleccionar…" opciones={nombresPersonas}
                          onChange={(v) => setPersonal(personal.map((x, j) => j === i ? { ...x, persona_nombre: v } : x))} />
                </div>
                <div>
                  <label className="etiqueta">Rol / función</label>
                  <Select valor={p.rol_funcion} placeholder="—" opciones={catalogo(TIPOS_LISTA.ROL)}
                          onChange={(v) => setPersonal(personal.map((x, j) => j === i ? { ...x, rol_funcion: v } : x))} />
                </div>
                <div>
                  <label className="etiqueta">Confirmado</label>
                  <select className="campo" value={p.confirmado}
                          onChange={(e) => setPersonal(personal.map((x, j) => j === i ? { ...x, confirmado: e.target.value } : x))}>
                    {OPCIONES_SI_NO.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="etiqueta">Asistió</label>
                  <select className="campo" value={p.asistio}
                          onChange={(e) => setPersonal(personal.map((x, j) => j === i ? { ...x, asistio: e.target.value } : x))}>
                    {OPCIONES_SI_NO.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="etiqueta">Ingreso</label>
                  <input type="time" className="campo" value={p.hora_ingreso}
                         onChange={(e) => setPersonal(personal.map((x, j) => j === i ? { ...x, hora_ingreso: e.target.value } : x))} />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="etiqueta">Salida</label>
                    <input type="time" className="campo" value={p.hora_salida}
                           onChange={(e) => setPersonal(personal.map((x, j) => j === i ? { ...x, hora_salida: e.target.value } : x))} />
                  </div>
                  <BotonQuitar onClick={() => setPersonal(personal.filter((_, j) => j !== i))} />
                </div>
              </div>
            </div>
          ))}
          <button type="button" className="btn-secundario"
                  onClick={() => setPersonal([...personal, vacioPersonal()])}>
            + Agregar persona
          </button>
        </div>
      </Paso>

      {/* 3 · MATERIAL POP */}
      <Paso
        numero={3}
        titulo="Material POP"
        descripcion="Registra lo llevado y lo sobrante. El gasto cuenta solo lo utilizado; lo sobrante vuelve a bodega."
      >
        <div className="space-y-3">
          {material.map((m, i) => {
            const llev = n(m.cantidad_llevada);
            const sob = n(m.cantidad_sobrante);
            const util = llev - sob;
            const excede = sob > llev;
            return (
              <div key={i} className={`rounded-lg p-3 ring-1 ${
                excede ? "bg-choho-redLight ring-red-300" : "bg-neutral-50 ring-neutral-200"
              }`}>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div>
                    <label className="etiqueta">Material</label>
                    <Select
                      valor={m.material} placeholder="Seleccionar…"
                      opciones={datos.materiales.map((x) => x.nombre)}
                      onChange={(v) => setMaterial(material.map((x, j) =>
                        j === i ? { ...x, material: v, costo_unitario: String(costoDe(v) || x.costo_unitario) } : x
                      ))}
                    />
                  </div>
                  <div>
                    <label className="etiqueta">Cantidad llevada</label>
                    <input type="number" min={0} className="campo" value={m.cantidad_llevada}
                           onChange={(e) => setMaterial(material.map((x, j) => j === i ? { ...x, cantidad_llevada: e.target.value } : x))} />
                  </div>
                  <div>
                    <label className="etiqueta">Cantidad sobrante</label>
                    <input type="number" min={0} className="campo" value={m.cantidad_sobrante}
                           onChange={(e) => setMaterial(material.map((x, j) => j === i ? { ...x, cantidad_sobrante: e.target.value } : x))} />
                  </div>
                  <div>
                    <label className="etiqueta">Costo unitario</label>
                    <input type="number" min={0} className="campo" value={m.costo_unitario}
                           onChange={(e) => setMaterial(material.map((x, j) => j === i ? { ...x, costo_unitario: e.target.value } : x))} />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="etiqueta">Observaciones</label>
                      <input className="campo" value={m.observaciones}
                             onChange={(e) => setMaterial(material.map((x, j) => j === i ? { ...x, observaciones: e.target.value } : x))} />
                    </div>
                    <BotonQuitar onClick={() => setMaterial(material.filter((_, j) => j !== i))} />
                  </div>
                </div>
                <p className={`mt-2 text-xs ${excede ? "font-semibold text-choho-red" : "text-neutral-600"}`}>
                  {excede
                    ? "La cantidad sobrante no puede superar la llevada."
                    : <>Utilizado <strong>{num(util)}</strong> · Utilización <strong>{pct(llev ? util / llev : null, 1)}</strong> · Gasto <strong>{money(util * n(m.costo_unitario))}</strong> <span className="text-neutral-400">(llevado {money(llev * n(m.costo_unitario))})</span></>}
                </p>
              </div>
            );
          })}
          <button type="button" className="btn-secundario"
                  onClick={() => setMaterial([...material, vacioMaterial()])}>
            + Agregar material
          </button>
        </div>
      </Paso>

      {/* 4 · GASTOS */}
      <Paso numero={4} titulo="Gastos adicionales" descripcion="Todo lo que no es material POP.">
        <div className="space-y-3">
          {gastos.map((g, i) => (
            <div key={i} className="rounded-lg bg-neutral-50 p-3 ring-1 ring-neutral-200">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <div>
                  <label className="etiqueta">Categoría</label>
                  <Select valor={g.categoria} placeholder="Seleccionar…" opciones={catalogo(TIPOS_LISTA.CATEGORIA)}
                          onChange={(v) => setGastos(gastos.map((x, j) => j === i ? { ...x, categoria: v } : x))} />
                </div>
                <div>
                  <label className="etiqueta">Descripción</label>
                  <input className="campo" value={g.descripcion}
                         onChange={(e) => setGastos(gastos.map((x, j) => j === i ? { ...x, descripcion: e.target.value } : x))} />
                </div>
                <div>
                  <label className="etiqueta">Proveedor</label>
                  <input className="campo" value={g.proveedor}
                         onChange={(e) => setGastos(gastos.map((x, j) => j === i ? { ...x, proveedor: e.target.value } : x))} />
                </div>
                <div>
                  <label className="etiqueta">Responsable</label>
                  <Select valor={g.responsable} placeholder="—" opciones={nombresPersonas}
                          onChange={(v) => setGastos(gastos.map((x, j) => j === i ? { ...x, responsable: v } : x))} />
                </div>
                <div>
                  <label className="etiqueta">Valor</label>
                  <input type="number" min={0} className="campo" value={g.valor}
                         onChange={(e) => setGastos(gastos.map((x, j) => j === i ? { ...x, valor: e.target.value } : x))} />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="etiqueta">Observaciones</label>
                    <input className="campo" value={g.observaciones}
                           onChange={(e) => setGastos(gastos.map((x, j) => j === i ? { ...x, observaciones: e.target.value } : x))} />
                  </div>
                  <BotonQuitar onClick={() => setGastos(gastos.filter((_, j) => j !== i))} />
                </div>
              </div>
            </div>
          ))}
          <button type="button" className="btn-secundario"
                  onClick={() => setGastos([...gastos, vacioGasto()])}>
            + Agregar gasto
          </button>
        </div>
      </Paso>

      {/* 5 · RESULTADOS */}
      <Paso numero={5} titulo="Resultados" descripcion="Qué dejó el evento.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="etiqueta" htmlFor="r-asist">Asistentes</label>
            <input id="r-asist" type="number" min={0} className="campo" value={resultado.asistentes}
                   onChange={(e) => setResultado({ ...resultado, asistentes: e.target.value })} />
          </div>
          <div>
            <label className="etiqueta" htmlFor="r-cli">Clientes atendidos</label>
            <input id="r-cli" type="number" min={0} className="campo" value={resultado.clientes_atendidos}
                   onChange={(e) => setResultado({ ...resultado, clientes_atendidos: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="etiqueta" htmlFor="r-com">Resultado comercial</label>
            <textarea id="r-com" rows={2} className="campo" value={resultado.resultado_comercial}
                      onChange={(e) => setResultado({ ...resultado, resultado_comercial: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="etiqueta" htmlFor="r-obs">Observaciones</label>
            <textarea id="r-obs" rows={2} className="campo" value={resultado.observaciones}
                      onChange={(e) => setResultado({ ...resultado, observaciones: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="etiqueta" htmlFor="r-apr">Aprendizajes</label>
            <textarea id="r-apr" rows={2} className="campo" value={resultado.aprendizajes}
                      onChange={(e) => setResultado({ ...resultado, aprendizajes: e.target.value })} />
          </div>
        </div>
      </Paso>

      {editando && (
        <Paso numero={6} titulo="Anexos" descripcion="Las fotografías se administran desde la ficha del evento.">
          <a href={`/eventos/${evento!.codigo}`} className="btn-secundario">
            📎 Ir a la ficha para subir fotografías
          </a>
        </Paso>
      )}

      {/* Barra de guardado */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur lg:pl-64">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-neutral-600">
            <span className="hidden sm:inline">Gasto POP <strong className="tabular-nums">{money(totales.pop)}</strong> + adicionales <strong className="tabular-nums">{money(totales.adic)}</strong> = </span>
            <span className="text-sm font-black tabular-nums text-choho-red">{money(totales.total)}</span>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secundario" onClick={() => router.back()} disabled={guardando}>
              Cancelar
            </button>
            <button type="submit" className="btn-primario" disabled={guardando}>
              {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear evento"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
