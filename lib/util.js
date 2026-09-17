/**
 * lib/util.js
 * Utilidades compartidas: fechas en zona horaria de Colombia, generación de IDs,
 * registro de log y helpers varios. Equivale a las funciones de Database.gs.
 */
import { supabase } from './supabase.js';

const TIMEZONE = 'America/Bogota';

/** Fecha del servidor en formato dd/MM/yyyy (zona horaria Colombia). */
export function fechaServidor() {
  const p = partesFecha();
  return `${p.dd}/${p.MM}/${p.yyyy}`;
}

/** Hora del servidor en formato HH:mm:ss (zona horaria Colombia). */
export function horaServidor() {
  const p = partesFecha();
  return `${p.HH}:${p.mm}:${p.ss}`;
}

/** Timestamp yyyy-MM-dd HH:mm:ss (zona horaria Colombia). */
export function timestampServidor() {
  const p = partesFecha();
  return `${p.yyyy}-${p.MM}-${p.dd} ${p.HH}:${p.mm}:${p.ss}`;
}

function partesFecha() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = {};
  fmt.formatToParts(new Date()).forEach((x) => {
    parts[x.type] = x.value;
  });
  return {
    yyyy: parts.year,
    MM: parts.month,
    dd: parts.day,
    HH: parts.hour === '24' ? '00' : parts.hour,
    mm: parts.minute,
    ss: parts.second,
  };
}

/**
 * Genera un ID consecutivo con prefijo y año, ej: ENT-2026-00001.
 * Delega en la función Postgres generar_id(), segura ante concurrencia.
 */
export async function generarId(prefijo) {
  const { data, error } = await supabase.rpc('generar_id', { p_prefijo: prefijo });
  if (error) throw new Error('No se pudo generar el ID (' + prefijo + '): ' + error.message);
  return data;
}

/** Registra una acción en la tabla LOG (nunca hace fallar la operación principal). */
export async function registrarLog(usuario, accion, detalle) {
  try {
    await supabase.from('log').insert({
      usuario: usuario,
      accion: accion,
      detalle: typeof detalle === 'string' ? detalle : JSON.stringify(detalle),
    });
  } catch (e) {
    console.error('Error registrando log:', e);
  }
}

/**
 * Resuelve el nombre "registrado por". Como no hay sesión de Google Workspace,
 * usa el nombre enviado por el frontend; si viene vacío, usa 'Administrador'.
 */
export function resolverRegistradoPor(nombreManual) {
  if (nombreManual && String(nombreManual).trim() !== '') {
    return String(nombreManual).trim();
  }
  return 'Administrador';
}

/** Indexa una lista de objetos por el valor de un campo. */
export function indexarPor(lista, campo) {
  const idx = {};
  lista.forEach((item) => {
    idx[item[campo]] = item;
  });
  return idx;
}

export { TIMEZONE };
