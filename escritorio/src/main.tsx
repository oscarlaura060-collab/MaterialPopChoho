import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { AppProvider, useApp } from "@/lib/store";
import { Cargando } from "@/components/ui";

import Dashboard from "@/app/page";
import ListaEventos from "@/app/eventos/page";
import FichaEvento from "@/app/eventos/[codigo]/page";
import NuevoEvento from "@/app/eventos/nuevo/page";
import EditarEvento from "@/app/eventos/[codigo]/editar/page";
import Personal from "@/app/personal/page";
import MaterialPop from "@/app/material-pop/page";
import Gastos from "@/app/gastos/page";
import Resultados from "@/app/resultados/page";
import Anexos from "@/app/anexos/page";

import Compartir from "./pagina-compartir";
import Configuracion from "./pagina-configuracion";
import { Bienvenida, NoSoportado } from "./bienvenida";
import { ShellEscritorio } from "./shell-escritorio";
import { useRuta } from "./shim/navegacion";
import { alGuardar, cargarDesdeCarpeta } from "./shim/supabase";
import * as fs from "./archivos";
import { sembrar } from "./semilla";

function Ruteador() {
  const ruta = useRuta();
  const partes = ruta.split("/").filter(Boolean);

  if (partes.length === 0) return <Dashboard />;
  if (partes[0] === "eventos") {
    if (partes.length === 1) return <ListaEventos />;
    if (partes[1] === "nuevo") return <NuevoEvento />;
    if (partes[2] === "editar") return <EditarEvento />;
    return <FichaEvento />;
  }
  if (partes[0] === "personal") return <Personal />;
  if (partes[0] === "material-pop") return <MaterialPop />;
  if (partes[0] === "gastos") return <Gastos />;
  if (partes[0] === "resultados") return <Resultados />;
  if (partes[0] === "anexos") return <Anexos />;
  if (partes[0] === "compartir") return <Compartir />;
  if (partes[0] === "configuracion") return <Configuracion />;
  return <Dashboard />;
}

function Contenido({ carpeta }: { carpeta: string | null }) {
  const { cargando, error } = useApp();
  const [guardando, setGuardando] = useState(false);

  // El indicador "Guardando…" se enciende mientras se escribe en disco
  useEffect(() => alGuardar(setGuardando), []);
  useEffect(() => {
    (window as { __guardando?: boolean }).__guardando = guardando;
  }, [guardando]);

  if (cargando) {
    return <div className="grid min-h-screen place-items-center"><Cargando /></div>;
  }
  return (
    <ShellEscritorio carpeta={carpeta} guardando={guardando}>
      {error && (
        <div className="mb-4 rounded-lg bg-choho-redLight px-3.5 py-2.5 text-sm text-red-900 ring-1 ring-inset ring-red-600/25">
          {error}
        </div>
      )}
      <Ruteador />
    </ShellEscritorio>
  );
}

function Aplicacion() {
  const [estado, setEstado] = useState<"revisando" | "ninguna" | "permiso" | "lista">("revisando");
  const [carpeta, setCarpeta] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    fs.recuperarCarpeta()
      .then((r) => {
        setCarpeta(fs.nombreCarpeta());
        setEstado(r === "lista" ? "lista" : r);
      })
      .catch(() => setEstado("ninguna"));
  }, []);

  /** Abre la carpeta, siembra los catálogos si está vacía y carga los datos. */
  const abrir = useCallback(async () => {
    await cargarDesdeCarpeta();
    const t = fs.tablasVacias();
    const actual = await fs.leerTodo();
    Object.assign(t, actual);
    if (sembrar(t)) {
      await fs.escribirTodo(t);
      await cargarDesdeCarpeta();
    }
    setCarpeta(fs.nombreCarpeta());
    setEstado("lista");
  }, []);

  const elegir = useCallback(async () => {
    setOcupado(true); setError(null);
    try {
      await fs.elegirCarpeta();
      await abrir();
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        setError(e instanceof Error ? e.message : "No fue posible abrir la carpeta.");
      }
    } finally { setOcupado(false); }
  }, [abrir]);

  const permitir = useCallback(async () => {
    setOcupado(true); setError(null);
    try {
      if (await fs.pedirPermiso()) await abrir();
      else setError("No se concedió el permiso sobre la carpeta.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible abrir la carpeta.");
    } finally { setOcupado(false); }
  }, [abrir]);

  if (!fs.soportado()) return <NoSoportado />;

  if (estado === "revisando") {
    return <div className="grid min-h-screen place-items-center"><Cargando texto="Abriendo…" /></div>;
  }

  if (estado !== "lista") {
    return (
      <Bienvenida estado={estado} carpeta={carpeta} error={error} ocupado={ocupado}
                  onElegir={elegir} onPermitir={permitir} />
    );
  }

  return (
    <AppProvider>
      <Contenido carpeta={carpeta} />
    </AppProvider>
  );
}

// Aviso antes de cerrar si quedó algo por escribir
window.addEventListener("beforeunload", (e) => {
  if ((window as { __guardando?: boolean }).__guardando) {
    e.preventDefault();
    e.returnValue = "";
  }
});

if (!window.location.hash) window.location.hash = "#/";
createRoot(document.getElementById("raiz")!).render(<Aplicacion />);
