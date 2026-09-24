export const COP = new Intl.NumberFormat("es-CO", {
  style: "currency", currency: "COP", maximumFractionDigits: 0,
});
export const NUM = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
export const NUM1 = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

export const money = (v: number | null | undefined) => COP.format(Number(v ?? 0));
export const num = (v: number | null | undefined) => NUM.format(Number(v ?? 0));

/** Abreviado para ejes y tarjetas: 4,6 M / 850 K */
export function moneyCorto(v: number | null | undefined): string {
  const n = Number(v ?? 0);
  if (Math.abs(n) >= 1_000_000) return `$${NUM1.format(n / 1_000_000)}M`;
  if (Math.abs(n) >= 1_000) return `$${NUM.format(Math.round(n / 1_000))}K`;
  return `$${NUM.format(n)}`;
}

export function pct(v: number | null | undefined, decimales = 0): string {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "—";
  return `${(Number(v) * 100).toFixed(decimales)}%`;
}

/** Fecha en texto sin desfase de zona horaria (la BD guarda DATE puro) */
export function fechaLarga(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio",
    "agosto","septiembre","octubre","noviembre","diciembre"];
  return `${d} de ${meses[m - 1]} de ${a}`;
}

export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function horaCorta(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : "—";
}

/** Nombre de archivo seguro para Storage */
export function nombreSeguro(nombre: string): string {
  return nombre
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
}

export const esImagen = (mime?: string | null) => !!mime && mime.startsWith("image/");
