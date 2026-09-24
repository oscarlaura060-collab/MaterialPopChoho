"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FormularioEvento } from "@/components/formulario-evento";
import { Encabezado } from "@/components/shell";
import { Cargando } from "@/components/ui";
import { useApp } from "@/lib/store";

export default function NuevoEvento() {
  const { esAdmin, cargando } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!cargando && !esAdmin) router.replace("/eventos");
  }, [cargando, esAdmin, router]);

  if (cargando || !esAdmin) return <Cargando />;

  return (
    <>
      <Encabezado titulo="Nuevo evento"
                  descripcion="Al guardar aparecerá en el dashboard y en todas las secciones." />
      <FormularioEvento />
    </>
  );
}
