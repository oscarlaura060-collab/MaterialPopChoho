/**
 * Guarda todo en una carpeta del computador, mediante la API de acceso a
 * archivos del navegador (Chrome / Edge). No hay servidor ni cuentas.
 *
 *   <carpeta elegida>/
 *     eventos.json          ← toda la información, legible y respaldable
 *     anexos/EV-001/foto.jpg
 *     respaldos/eventos-2026-09-24T10-30.json
 */

export interface Tablas {
  eventos: Registro[];
  personas: Registro[];
  participacion: Registro[];
  material_pop: Registro[];
  gastos: Registro[];
  resultados: Registro[];
  anexos: Registro[];
  listas: Registro[];
  materiales: Registro[];
  parametros: Registro[];
}
export type Registro = Record<string, unknown>;

export const TABLAS: (keyof Tablas)[] = [
  "eventos", "personas", "participacion", "material_pop", "gastos",
  "resultados", "anexos", "listas", "materiales", "parametros",
];

export const ARCHIVO = "eventos.json";
const CARPETA_ANEXOS = "anexos";
const CARPETA_RESPALDOS = "respaldos";
const VERSION = 1;

export function tablasVacias(): Tablas {
  return {
    eventos: [], personas: [], participacion: [], material_pop: [], gastos: [],
    resultados: [], anexos: [], listas: [], materiales: [], parametros: [],
  };
}

/* ---------- recordar la carpeta entre sesiones (IndexedDB) ---------- */

const BD = "choho-eventos";
const ALMACEN = "config";

function abrirBd(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const p = indexedDB.open(BD, 1);
    p.onupgradeneeded = () => p.result.createObjectStore(ALMACEN);
    p.onsuccess = () => res(p.result);
    p.onerror = () => rej(p.error);
  });
}

/**
 * Recordar la carpeta es una comodidad, no un requisito: si el navegador no
 * lo permite (ventana de incógnito, almacenamiento bloqueado), la aplicación
 * sigue funcionando y solo vuelve a preguntar la carpeta al abrirse.
 */
async function guardarConfig(clave: string, valor: unknown): Promise<void> {
  try {
    const bd = await abrirBd();
    await new Promise<void>((res, rej) => {
      const t = bd.transaction(ALMACEN, "readwrite");
      t.objectStore(ALMACEN).put(valor, clave);
      t.oncomplete = () => res();
      t.onerror = () => rej(t.error);
    });
  } catch {
    /* sin recordar: no es un error para el usuario */
  }
}

async function leerConfig<T>(clave: string): Promise<T | undefined> {
  try {
    const bd = await abrirBd();
    return await new Promise((res, rej) => {
      const t = bd.transaction(ALMACEN, "readonly");
      const q = t.objectStore(ALMACEN).get(clave);
      q.onsuccess = () => res(q.result as T | undefined);
      q.onerror = () => rej(q.error);
    });
  } catch {
    return undefined;
  }
}

/* ---------- carpeta de trabajo ---------- */

export const soportado = () => typeof window.showDirectoryPicker === "function";

let carpeta: FileSystemDirectoryHandle | null = null;

export const carpetaActual = () => carpeta;
export const nombreCarpeta = () => carpeta?.name ?? null;

/** Pide al usuario que elija la carpeta y la recuerda. */
export async function elegirCarpeta(): Promise<FileSystemDirectoryHandle> {
  const h = await window.showDirectoryPicker({ mode: "readwrite", id: "choho-eventos" });
  carpeta = h;
  await guardarConfig("carpeta", h);
  return h;
}

/**
 * Intenta reabrir la carpeta de la sesión anterior.
 * Devuelve "lista" si ya hay permiso, "permiso" si hay que pedirlo con un
 * gesto del usuario, o "ninguna" si nunca se eligió.
 */
export async function recuperarCarpeta(): Promise<"lista" | "permiso" | "ninguna"> {
  const h = await leerConfig<FileSystemDirectoryHandle>("carpeta");
  if (!h || typeof h.queryPermission !== "function") return "ninguna";
  try {
    carpeta = h;
    const estado = await h.queryPermission({ mode: "readwrite" });
    return estado === "granted" ? "lista" : "permiso";
  } catch {
    carpeta = null;
    return "ninguna";
  }
}

/** Pide el permiso sobre la carpeta recordada (requiere un clic del usuario). */
export async function pedirPermiso(): Promise<boolean> {
  if (!carpeta) return false;
  return (await carpeta.requestPermission({ mode: "readwrite" })) === "granted";
}

export async function olvidarCarpeta(): Promise<void> {
  carpeta = null;
  await guardarConfig("carpeta", undefined);
}

/* ---------- lectura y escritura del archivo de datos ---------- */

function exigirCarpeta(): FileSystemDirectoryHandle {
  if (!carpeta) throw new Error("Todavía no has elegido una carpeta de trabajo.");
  return carpeta;
}

export async function leerTodo(): Promise<Tablas> {
  const dir = exigirCarpeta();
  let texto: string;
  try {
    const fh = await dir.getFileHandle(ARCHIVO);
    texto = await (await fh.getFile()).text();
  } catch {
    return tablasVacias();            // carpeta nueva: se empieza en blanco
  }
  if (!texto.trim()) return tablasVacias();

  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    throw new Error(
      `El archivo ${ARCHIVO} está dañado y no se pudo leer. ` +
      `Revisa la carpeta "${CARPETA_RESPALDOS}" para recuperar una copia anterior.`
    );
  }
  const obj = (crudo ?? {}) as Record<string, unknown>;
  const datos = (obj.tablas ?? obj) as Record<string, unknown>;
  const t = tablasVacias();
  for (const nombre of TABLAS) {
    const filas = datos[nombre];
    if (Array.isArray(filas)) t[nombre] = filas as Registro[];
  }
  return t;
}

export async function escribirTodo(t: Tablas): Promise<void> {
  const dir = exigirCarpeta();
  const cuerpo = JSON.stringify(
    { version: VERSION, actualizado: new Date().toISOString(), tablas: t },
    null, 2
  );
  // Se escribe primero un temporal y luego se reemplaza, para que un fallo
  // a mitad de camino no deje el archivo bueno a medias.
  const tmp = await dir.getFileHandle(ARCHIVO + ".tmp", { create: true });
  const w = await tmp.createWritable();
  await w.write(cuerpo);
  await w.close();

  const fin = await dir.getFileHandle(ARCHIVO, { create: true });
  const w2 = await fin.createWritable();
  await w2.write(cuerpo);
  await w2.close();

  await dir.removeEntry(ARCHIVO + ".tmp").catch(() => {});
}

/** Copia fechada en respaldos/. Se conservan las 20 más recientes. */
export async function respaldar(): Promise<string> {
  const dir = exigirCarpeta();
  const origen = await (await (await dir.getFileHandle(ARCHIVO)).getFile()).text();
  const carp = await dir.getDirectoryHandle(CARPETA_RESPALDOS, { create: true });
  const marca = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const nombre = `eventos-${marca}.json`;
  const fh = await carp.getFileHandle(nombre, { create: true });
  const w = await fh.createWritable();
  await w.write(origen);
  await w.close();

  const previos: string[] = [];
  for await (const [n, h] of carp.entries()) if (h.kind === "file" && n.endsWith(".json")) previos.push(n);
  previos.sort();
  for (const viejo of previos.slice(0, Math.max(0, previos.length - 20))) {
    await carp.removeEntry(viejo).catch(() => {});
  }
  return nombre;
}

/* ---------- anexos (fotografías y documentos) ---------- */

async function carpetaDelEvento(codigo: string): Promise<FileSystemDirectoryHandle> {
  const dir = exigirCarpeta();
  const base = await dir.getDirectoryHandle(CARPETA_ANEXOS, { create: true });
  return base.getDirectoryHandle(codigo || "sin-evento", { create: true });
}

/** Guarda el archivo y devuelve su ruta relativa dentro de la carpeta. */
export async function guardarAnexo(
  codigoEvento: string, nombre: string, datos: Blob
): Promise<string> {
  const carp = await carpetaDelEvento(codigoEvento);
  let final = nombre;
  let n = 1;
  // No sobrescribir si ya existe uno con el mismo nombre
  for (;;) {
    try { await carp.getFileHandle(final); } catch { break; }
    const punto = nombre.lastIndexOf(".");
    final = punto > 0
      ? `${nombre.slice(0, punto)}-${n}${nombre.slice(punto)}`
      : `${nombre}-${n}`;
    n++;
  }
  const fh = await carp.getFileHandle(final, { create: true });
  const w = await fh.createWritable();
  await w.write(datos);
  await w.close();
  return `${CARPETA_ANEXOS}/${codigoEvento}/${final}`;
}

export async function leerAnexo(ruta: string): Promise<File | null> {
  const dir = carpeta;
  if (!dir) return null;
  const partes = ruta.split("/").filter(Boolean);
  try {
    let actual: FileSystemDirectoryHandle = dir;
    for (const p of partes.slice(0, -1)) actual = await actual.getDirectoryHandle(p);
    const fh = await actual.getFileHandle(partes[partes.length - 1]);
    return await fh.getFile();
  } catch {
    return null;
  }
}

export async function borrarAnexo(ruta: string): Promise<void> {
  const dir = carpeta;
  if (!dir) return;
  const partes = ruta.split("/").filter(Boolean);
  try {
    let actual: FileSystemDirectoryHandle = dir;
    for (const p of partes.slice(0, -1)) actual = await actual.getDirectoryHandle(p);
    await actual.removeEntry(partes[partes.length - 1]);
  } catch { /* si ya no está, no hay nada que hacer */ }
}

/** Escribe un archivo suelto en la raíz de la carpeta (informes, exportaciones). */
export async function escribirArchivo(nombre: string, contenido: Blob | string): Promise<void> {
  const dir = exigirCarpeta();
  const fh = await dir.getFileHandle(nombre, { create: true });
  const w = await fh.createWritable();
  await w.write(contenido);
  await w.close();
}
