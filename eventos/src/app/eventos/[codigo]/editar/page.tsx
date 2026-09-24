"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { FormularioEvento } from "@/components/formulario-evento";
import { Encabezado } from "@/components/shell";
import { Cargando } from "@/components/ui";
import { useApp } from "@/lib/store";

export default function EditarEvento() {
  const { codigo } = useParams<{ codigo: string }>();
  const { datos, esAdmin, cargando } = useApp();
  const router = useRouter();

  const evento = useMemo(
    () => datos.eventos.find((e) => e.codigo === decodeURIComponent(codigo)),
    [datos.eventos, codigo]
  );

  useEffect(() => {
    if (cargando) return;
    if (!esAdmin) router.replace(`/eventos/${codigo}`);
    else if (!evento) router.replace("/eventos");
  }, [cargando, esAdmin, evento, codigo, router]);

  if (cargando || !esAdmin || !evento) return <Cargando />;

  return (
    <>
      <Encabezado titulo={`Editar · ${evento.nombre}`} descripcion={evento.codigo} />
      <FormularioEvento evento={evento} />
    </>
  );
}
