"use client";

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { RESPALDO_LISTAS } from "./constants";
import type {
  Anexo, EventoVista, Filtros, Gasto, ListaItem, Material, MaterialPop,
  Participacion, Persona, Resultado, Usuario,
} from "./types";
import { FILTROS_VACIOS } from "./types";

interface Datos {
  eventos: EventoVista[];
  material: MaterialPop[];
  gastos: Gasto[];
  participacion: Participacion[];
  personas: Persona[];
  resultados: Resultado[];
  anexos: Anexo[];
  listas: ListaItem[];
  materiales: Material[];
}

const VACIO: Datos = {
  eventos: [], material: [], gastos: [], participacion: [],
  personas: [], resultados: [], anexos: [], listas: [], materiales: [],
};

interface Ctx {
  /** Solo la primera carga. Las páginas se apoyan en esto para no desmontarse
   *  (y perder su estado local) cada vez que se refrescan los datos. */
  cargando: boolean;
  /** Un refresco en segundo plano después de guardar o importar. */
  refrescando: boolean;
  error: string | null;
  sesion: Session | null;
  usuario: Usuario | null;
  esAdmin: boolean;
  datos: Datos;
  /** Eventos que pasan los filtros globales */
  eventosFiltrados: EventoVista[];
  /** Códigos de los eventos filtrados, para cruzar las demás tablas */
  idsFiltrados: Set<string>;
  filtros: Filtros;
  setFiltros: (f: Filtros) => void;
  limpiarFiltros: () => void;
  hayFiltros: boolean;
  catalogo: (tipo: string) => string[];
  recargar: () => Promise<void>;
}

const C = createContext<Ctx | null>(null);

export function useApp(): Ctx {
  const v = useContext(C);
  if (!v) throw new Error("useApp debe usarse dentro de <AppProvider>");
  return v;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [datos, setDatos] = useState<Datos>(VACIO);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const inicializado = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);
  const [listoAuth, setListoAuth] = useState(false);

  // ---- sesión ----
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      setListoAuth(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // ---- carga de datos ----
  const recargar = useCallback(async () => {
    if (!sesion) {
      setDatos(VACIO); setUsuario(null);
      setCargando(false); inicializado.current = true;
      return;
    }
    // Un refresco no debe desmontar la pantalla que lo pidió
    if (inicializado.current) setRefrescando(true); else setCargando(true);
    setError(null);
    try {
      const [ev, mp, ga, pa, pe, re, an, li, ma, us] = await Promise.all([
        supabase.from("v_eventos").select("*").order("fecha", { ascending: false }),
        supabase.from("v_material_pop").select("*"),
        supabase.from("v_gastos").select("*"),
        supabase.from("v_participacion").select("*"),
        supabase.from("v_personal").select("*").order("nombre"),
        supabase.from("v_resultados").select("*"),
        supabase.from("anexos").select("*").order("created_at", { ascending: false }),
        supabase.from("listas").select("*").eq("activo", true).order("orden"),
        supabase.from("materiales").select("*").order("nombre"),
        supabase.from("usuarios").select("*").eq("id", sesion.user.id).maybeSingle(),
      ]);

      const fallo = [ev, mp, ga, pa, pe, re, an, li, ma].find((r) => r.error);
      if (fallo?.error) throw fallo.error;

      // Postgres devuelve numeric como string: se normaliza una sola vez
      const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
      setDatos({
        eventos: (ev.data ?? []).map((e: Record<string, unknown>) => ({
          ...e,
          gasto_pop: Number(e.gasto_pop ?? 0),
          gastos_adicionales: Number(e.gastos_adicionales ?? 0),
          gasto_total: Number(e.gasto_total ?? 0),
          pop_llevado: Number(e.pop_llevado ?? 0),
          pop_utilizado: Number(e.pop_utilizado ?? 0),
          pop_sobrante: Number(e.pop_sobrante ?? 0),
          pct_asistencia: n(e.pct_asistencia),
        })) as EventoVista[],
        material: (mp.data ?? []).map((m: Record<string, unknown>) => ({
          ...m,
          cantidad_llevada: Number(m.cantidad_llevada ?? 0),
          cantidad_sobrante: Number(m.cantidad_sobrante ?? 0),
          cantidad_utilizada: Number(m.cantidad_utilizada ?? 0),
          costo_unitario: Number(m.costo_unitario ?? 0),
          gasto_material: Number(m.gasto_material ?? 0),
          pct_utilizacion: n(m.pct_utilizacion),
        })) as MaterialPop[],
        gastos: (ga.data ?? []).map((g: Record<string, unknown>) => ({
          ...g, valor: Number(g.valor ?? 0),
        })) as Gasto[],
        participacion: (pa.data ?? []).map((p: Record<string, unknown>) => ({
          ...p, horas: n(p.horas),
        })) as Participacion[],
        personas: (pe.data ?? []).map((p: Record<string, unknown>) => ({
          ...p,
          pct_asistencia: n(p.pct_asistencia),
          horas_totales: Number(p.horas_totales ?? 0),
        })) as Persona[],
        resultados: (re.data ?? []) as Resultado[],
        anexos: (an.data ?? []) as Anexo[],
        listas: (li.data ?? []) as ListaItem[],
        materiales: (ma.data ?? []).map((m: Record<string, unknown>) => ({
          ...m, costo_unitario: Number(m.costo_unitario ?? 0),
        })) as Material[],
      });
      setUsuario((us.data as Usuario) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible cargar la información.");
    } finally {
      inicializado.current = true;
      setCargando(false);
      setRefrescando(false);
    }
  }, [sesion]);

  useEffect(() => { if (listoAuth) void recargar(); }, [listoAuth, recargar]);

  // ---- filtros globales ----
  const eventosFiltrados = useMemo(() => {
    const f = filtros;
    const q = f.busqueda.trim().toLowerCase();
    return datos.eventos.filter((e) => {
      if (f.anio && String(e.anio) !== f.anio) return false;
      if (f.mes && String(e.mes) !== f.mes) return false;
      if (f.ciudad && e.ciudad !== f.ciudad) return false;
      if (f.responsable && e.responsable !== f.responsable) return false;
      if (f.tipo_evento && e.tipo_evento !== f.tipo_evento) return false;
      if (f.estado && e.estado !== f.estado) return false;
      if (f.cliente && e.cliente !== f.cliente) return false;
      if (q) {
        const heno = [
          e.codigo, e.nombre, e.ciudad, e.lugar_negocio, e.direccion,
          e.cliente, e.responsable, e.tipo_evento, e.estado,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!heno.includes(q)) return false;
      }
      return true;
    });
  }, [datos.eventos, filtros]);

  const idsFiltrados = useMemo(
    () => new Set(eventosFiltrados.map((e) => e.id)),
    [eventosFiltrados]
  );

  const hayFiltros = useMemo(
    () => Object.values(filtros).some((v) => v !== ""),
    [filtros]
  );

  const catalogo = useCallback(
    (tipo: string) => {
      const de = datos.listas.filter((l) => l.tipo === tipo).map((l) => l.valor);
      return de.length ? de : (RESPALDO_LISTAS[tipo] ?? []);
    },
    [datos.listas]
  );

  const valor: Ctx = {
    cargando: cargando || !listoAuth,
    refrescando,
    error, sesion, usuario,
    esAdmin: usuario?.rol === "ADMINISTRADOR",
    datos, eventosFiltrados, idsFiltrados,
    filtros, setFiltros,
    limpiarFiltros: () => setFiltros(FILTROS_VACIOS),
    hayFiltros, catalogo, recargar,
  };

  return <C.Provider value={valor}>{children}</C.Provider>;
}
