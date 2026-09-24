"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BUCKET_ANEXOS } from "@/lib/constants";
import { esImagen, nombreSeguro } from "@/lib/format";
import { useApp } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import type { Anexo } from "@/lib/types";
import { Aviso, Modal, Vacio } from "./ui";

const MAX_BYTES = 25 * 1024 * 1024;
const TIPOS_OK = /^(image\/(jpeg|png|webp|gif|heic|heif)|application\/pdf|video\/(mp4|quicktime|webm))$/;

/** Galería de fotografías y documentos del evento, servida desde Supabase Storage. */
export function Galeria({ anexos, eventoId }: { anexos: Anexo[]; eventoId: string }) {
  const { esAdmin, recargar } = useApp();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<Anexo | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // El bucket es privado: se firman URLs temporales para mostrar el contenido
  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!anexos.length) { setUrls({}); return; }
      const { data } = await supabase.storage
        .from(BUCKET_ANEXOS)
        .createSignedUrls(anexos.map((a) => a.storage_path), 3600);
      if (!vivo || !data) return;
      const m: Record<string, string> = {};
      data.forEach((d, i) => { if (d.signedUrl) m[anexos[i].storage_path] = d.signedUrl; });
      setUrls(m);
    })();
    return () => { vivo = false; };
  }, [anexos]);

  const subir = useCallback(
    async (archivos: FileList | null) => {
      if (!archivos?.length) return;
      setSubiendo(true);
      setError(null);
      try {
        for (const f of Array.from(archivos)) {
          if (f.size > MAX_BYTES) throw new Error(`"${f.name}" supera los 25 MB.`);
          if (!TIPOS_OK.test(f.type)) throw new Error(`"${f.name}" no es una imagen, video o PDF.`);

          const ruta = `${eventoId}/${Date.now()}-${nombreSeguro(f.name)}`;
          const { error: eSub } = await supabase.storage
            .from(BUCKET_ANEXOS)
            .upload(ruta, f, { contentType: f.type, upsert: false });
          if (eSub) throw eSub;

          const { error: eIns } = await supabase.from("anexos").insert({
            evento_id: eventoId,
            nombre: f.name,
            storage_path: ruta,
            mime_type: f.type,
            tamano_bytes: f.size,
          });
          if (eIns) {
            // No dejar el archivo huérfano si falla el registro
            await supabase.storage.from(BUCKET_ANEXOS).remove([ruta]);
            throw eIns;
          }
        }
        await recargar();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No fue posible subir el archivo.");
      } finally {
        setSubiendo(false);
        if (input.current) input.current.value = "";
      }
    },
    [eventoId, recargar]
  );

  async function eliminar(a: Anexo) {
    if (!confirm(`¿Eliminar "${a.nombre}"? Esta acción no se puede deshacer.`)) return;
    setError(null);
    const { error: e1 } = await supabase.from("anexos").delete().eq("id", a.id);
    if (e1) { setError(e1.message); return; }
    await supabase.storage.from(BUCKET_ANEXOS).remove([a.storage_path]);
    setAbierto(null);
    await recargar();
  }

  return (
    <div className="space-y-3">
      {error && <Aviso tipo="error">{error}</Aviso>}

      {esAdmin && (
        <div className="no-imprimir">
          <input
            ref={input}
            type="file"
            multiple
            accept="image/*,application/pdf,video/mp4,video/quicktime,video/webm"
            className="hidden"
            onChange={(e) => subir(e.target.files)}
          />
          <button className="btn-secundario" onClick={() => input.current?.click()} disabled={subiendo}>
            {subiendo ? "Subiendo…" : "📎 Agregar fotografías o documentos"}
          </button>
          <p className="mt-1.5 text-xs text-neutral-500">
            Imágenes, videos o PDF · hasta 25 MB por archivo
          </p>
        </div>
      )}

      {anexos.length === 0 ? (
        <Vacio icono="📎" titulo="Sin anexos"
               detalle={esAdmin ? "Sube las fotografías del evento." : "Todavía no se han cargado archivos."} />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {anexos.map((a) => {
            const url = urls[a.storage_path];
            const img = esImagen(a.mime_type);
            return (
              <li key={a.id}>
                <button
                  className="group block w-full overflow-hidden rounded-lg bg-neutral-100 ring-1 ring-neutral-200 transition hover:ring-choho-red"
                  onClick={() => setAbierto(a)}
                >
                  <div className="aspect-[4/3] w-full overflow-hidden">
                    {img && url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt={a.nombre} loading="lazy"
                           className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-3xl text-neutral-400">
                        {a.mime_type?.startsWith("video/") ? "🎬" : "📄"}
                      </span>
                    )}
                  </div>
                  <p className="truncate bg-white px-2 py-1.5 text-left text-xs text-neutral-600">
                    {a.nombre}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Modal abierto={!!abierto} onCerrar={() => setAbierto(null)} titulo={abierto?.nombre ?? ""} ancho="max-w-4xl">
        {abierto && (
          <div className="space-y-3">
            {esImagen(abierto.mime_type) && urls[abierto.storage_path] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urls[abierto.storage_path]} alt={abierto.nombre}
                   className="mx-auto max-h-[60vh] rounded-lg object-contain" />
            ) : abierto.mime_type?.startsWith("video/") && urls[abierto.storage_path] ? (
              <video src={urls[abierto.storage_path]} controls className="mx-auto max-h-[60vh] rounded-lg" />
            ) : (
              <p className="py-8 text-center text-sm text-neutral-500">
                Vista previa no disponible para este tipo de archivo.
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              {urls[abierto.storage_path] && (
                <a href={urls[abierto.storage_path]} target="_blank" rel="noreferrer"
                   className="btn-secundario">Abrir / descargar</a>
              )}
              {esAdmin && (
                <button className="btn-peligro" onClick={() => eliminar(abierto)}>Eliminar</button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
