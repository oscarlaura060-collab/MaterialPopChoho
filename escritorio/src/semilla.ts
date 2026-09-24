/** Catálogos iniciales para una carpeta nueva (equivale a la hoja LISTAS). */
import type { Tablas } from "./archivos";
import { RESPALDO_LISTAS } from "@/lib/constants";

const MATERIALES: [string, number][] = [
  ["GORRAS", 9500], ["LANYARDS", 1380], ["CUELLEROS", 5100], ["BOLÍGRAFOS", 1230],
];

const PARAMETROS: [string, number, string][] = [
  ["margen_seguridad", 0.15, "% adicional sobre el consumo histórico para la recomendación"],
  ["factor_variacion", 1, "N° de desviaciones estándar que se suman al promedio utilizado"],
  ["min_eventos_tipo", 2, "Eventos del mismo tipo requeridos para usar historial por tipo"],
  ["utilizacion_baja", 0.5, "Por debajo de este % se lleva demasiado material"],
  ["utilizacion_alta", 0.9, "Por encima de este % hay riesgo de quedarse sin material"],
  ["tolerancia_recomendado", 0.2, "Planificado hasta este % por encima del recomendado"],
];

/** Solo agrega lo que falte; nunca pisa lo que ya exista. */
export function sembrar(t: Tablas): boolean {
  let cambio = false;

  if (t.listas.length === 0) {
    let i = 1;
    for (const [tipo, valores] of Object.entries(RESPALDO_LISTAS)) {
      valores.forEach((valor, orden) => {
        t.listas.push({ id: i++, tipo, valor, orden: orden + 1, activo: true });
      });
    }
    cambio = true;
  }

  if (t.materiales.length === 0) {
    MATERIALES.forEach(([nombre, costo_unitario], i) => {
      t.materiales.push({ id: i + 1, nombre, costo_unitario, activo: true });
    });
    cambio = true;
  }

  if (t.parametros.length === 0) {
    PARAMETROS.forEach(([clave, valor, descripcion]) => {
      t.parametros.push({ clave, valor, descripcion });
    });
    cambio = true;
  }

  return cambio;
}
