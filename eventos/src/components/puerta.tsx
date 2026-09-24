"use client";

import { usePathname, useRouter } from "next/navigation";
import React, { useEffect } from "react";
import { useApp } from "@/lib/store";
import { Shell } from "./shell";
import { Aviso, Cargando } from "./ui";

/** Controla el acceso: sin sesión se va a /login; con sesión se pinta el Shell. */
export function Puerta({ children }: { children: React.ReactNode }) {
  const { cargando, sesion, usuario, error } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const enLogin = pathname === "/login";

  useEffect(() => {
    if (cargando) return;
    if (!sesion && !enLogin) router.replace("/login");
    if (sesion && enLogin) router.replace("/");
  }, [cargando, sesion, enLogin, router]);

  if (enLogin) return <>{children}</>;

  if (cargando) {
    return <div className="grid min-h-screen place-items-center"><Cargando /></div>;
  }

  if (!sesion) {
    return <div className="grid min-h-screen place-items-center"><Cargando texto="Redirigiendo…" /></div>;
  }

  // Sesión válida pero sin fila en eventos.usuarios: no tiene acceso todavía
  if (!usuario) {
    return (
      <div className="grid min-h-screen place-items-center p-6">
        <div className="card-p max-w-md space-y-3 text-center">
          <h1 className="text-lg font-bold">Cuenta sin acceso</h1>
          <p className="text-sm text-neutral-600">
            Tu usuario existe pero todavía no está habilitado en el sistema de eventos.
            Pídele a un administrador que te asigne un rol desde <strong>Configuración</strong>.
          </p>
          {error && <Aviso tipo="error">{error}</Aviso>}
        </div>
      </div>
    );
  }

  return (
    <Shell>
      {error && <div className="mb-4"><Aviso tipo="error">{error}</Aviso></div>}
      {children}
    </Shell>
  );
}
