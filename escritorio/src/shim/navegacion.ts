/** Navegación por # dentro de un solo archivo HTML, con la misma API de Next. */
import { useEffect, useState } from "react";

export function rutaActual(): string {
  const h = window.location.hash.replace(/^#/, "");
  return h.startsWith("/") ? h : "/";
}

export function navegar(ruta: string, reemplazar = false) {
  const destino = "#" + (ruta.startsWith("/") ? ruta : "/" + ruta);
  if (reemplazar) window.location.replace(destino);
  else window.location.hash = destino.slice(1);
}

export function useRuta(): string {
  const [r, setR] = useState(rutaActual);
  useEffect(() => {
    const f = () => setR(rutaActual());
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  return r;
}

export const usePathname = useRuta;

export function useRouter() {
  return {
    push: (r: string) => navegar(r),
    replace: (r: string) => navegar(r, true),
    back: () => window.history.back(),
    refresh: () => {},
  };
}

/** Sustituye a useParams: extrae el código del evento de /eventos/<codigo>… */
export function useParams<T = Record<string, string>>(): T {
  const r = useRuta();
  const partes = r.split("/").filter(Boolean);
  const p: Record<string, string> = {};
  if (partes[0] === "eventos" && partes[1]) p.codigo = partes[1];
  return p as T;
}

export function useSearchParams() {
  return new URLSearchParams();
}
