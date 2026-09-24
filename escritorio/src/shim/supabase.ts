/**
 * Reemplaza al cliente de Supabase por la carpeta local, con la misma forma
 * de llamada. Así el resto de la aplicación (formularios, importador de
 * Excel, galería, store) funciona sin tocar una línea.
 *
 * Solo implementa lo que la aplicación usa de verdad.
 */
import * as fs from "../archivos";
import type { Registro, Tablas } from "../archivos";
import { calcular, costoDelCatalogo, siguienteCodigo } from "../vistas";

let datos: Tablas = fs.tablasVacias();
let vistas = calcular(datos);
let pendiente: Promise<void> | null = null;
const oyentes = new Set<(guardando: boolean) => void>();

export function instantanea(): Tablas { return datos; }

/** Avisa cuando empieza y termina de escribirse el archivo en disco. */
export function alGuardar(f: (guardando: boolean) => void): () => void {
  oyentes.add(f);
  return () => { oyentes.delete(f); };
}
const avisar = (g: boolean) => oyentes.forEach((f) => f(g));

export async function cargarDesdeCarpeta(): Promise<void> {
  datos = await fs.leerTodo();
  recalcular();
}

function recalcular() {
  vistas = calcular(datos);
}

/** Las escrituras se agrupan: varias seguidas producen un solo guardado. */
function marcarSucio(): Promise<void> {
  recalcular();
  if (!pendiente) {
    avisar(true);
    pendiente = new Promise<void>((res, rej) => {
      setTimeout(() => {
        fs.escribirTodo(datos)
          .then(() => { pendiente = null; avisar(false); res(); })
          .catch((e) => { pendiente = null; avisar(false); rej(e); });
      }, 0);
    });
  }
  return pendiente;
}

export const guardado = () => pendiente ?? Promise.resolve();

const uuid = () =>
  (crypto.randomUUID?.() ??
    "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10));

/* En local no hay cuentas: siempre el mismo usuario, con todos los permisos. */
const USUARIOS = "__usuarios__";
const USUARIO_LOCAL: Registro = {
  id: "local", email: null, nombre: "Equipo CHOHO", rol: "ADMINISTRADOR",
};
const SESION_LOCAL = { user: { id: "local", email: "" } };

type Filtro = { col: string; op: "eq" | "in"; valor: unknown };

interface Resp<T> { data: T; error: { message: string } | null; }
const ok = <T>(d: T): Resp<T> => ({ data: d, error: null });
const fallo = (m: string): Resp<null> => ({ data: null, error: { message: m } });

function esVista(t: string) { return t.startsWith("v_"); }

function filasDe(tabla: string): Registro[] {
  if (tabla === USUARIOS) return [USUARIO_LOCAL];
  if (esVista(tabla)) return (vistas as Record<string, Registro[]>)[tabla] ?? [];
  return (datos as unknown as Record<string, Registro[]>)[tabla] ?? [];
}

function aplicar(filas: Registro[], filtros: Filtro[]): Registro[] {
  return filas.filter((f) =>
    filtros.every((x) =>
      x.op === "eq"
        ? f[x.col] === x.valor
        : Array.isArray(x.valor) && (x.valor as unknown[]).includes(f[x.col])
    )
  );
}

/** Deja la fila lista para guardar: id, valores por defecto y coherencia. */
function normalizar(tabla: string, fila: Registro): Registro {
  const f: Registro = { ...fila };
  if (tabla !== "resultados" && !f.id) f.id = uuid();
  if (tabla === "material_pop") {
    const llevada = Number(f.cantidad_llevada ?? 0);
    const sobrante = Number(f.cantidad_sobrante ?? 0);
    if (sobrante > llevada) {
      throw new Error(
        `En "${String(f.material)}" la cantidad sobrante no puede superar la llevada.`
      );
    }
    // Mismo comportamiento que el trigger de la base
    f.costo_unitario = costoDelCatalogo(datos, String(f.material ?? ""), f.costo_unitario);
  }
  if (tabla === "eventos" && typeof f.fecha === "string") f.fecha = f.fecha.slice(0, 10);
  if (!f.created_at) f.created_at = new Date().toISOString();
  return f;
}

/** Claves naturales que hacen las veces de UNIQUE en la base. */
const CLAVE: Record<string, string[]> = {
  eventos: ["codigo"],
  personas: ["nombre"],
  materiales: ["nombre"],
  listas: ["tipo", "valor"],
  parametros: ["clave"],
  resultados: ["evento_id"],
  participacion: ["evento_id", "persona_nombre"],
};

const mismaClave = (tabla: string, a: Registro, b: Registro) => {
  const cols = CLAVE[tabla];
  if (!cols) return false;
  return cols.every((c) => a[c] === b[c]);
};

class Consulta implements PromiseLike<Resp<unknown>> {
  private filtros: Filtro[] = [];
  private orden: { col: string; asc: boolean } | null = null;
  private modo: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private carga: Registro[] = [];
  private unica: "no" | "single" | "maybe" = "no";

  constructor(private tabla: string) {}

  select(_cols?: string) { if (this.modo === "select") this.modo = "select"; return this; }
  order(col: string, o?: { ascending?: boolean }) {
    this.orden = { col, asc: o?.ascending !== false }; return this;
  }
  eq(col: string, valor: unknown) { this.filtros.push({ col, op: "eq", valor }); return this; }
  in(col: string, valor: unknown[]) { this.filtros.push({ col, op: "in", valor }); return this; }
  limit(_n: number) { return this; }
  single() { this.unica = "single"; return this; }
  maybeSingle() { this.unica = "maybe"; return this; }

  insert(filas: Registro | Registro[]) {
    this.modo = "insert";
    this.carga = Array.isArray(filas) ? filas : [filas];
    return this;
  }
  update(cambios: Registro) { this.modo = "update"; this.carga = [cambios]; return this; }
  upsert(filas: Registro | Registro[], _o?: { onConflict?: string }) {
    this.modo = "upsert";
    this.carga = Array.isArray(filas) ? filas : [filas];
    return this;
  }
  delete() { this.modo = "delete"; return this; }

  private tablaBase(): Registro[] {
    const t = datos as unknown as Record<string, Registro[]>;
    if (!t[this.tabla]) t[this.tabla] = [];
    return t[this.tabla];
  }

  private async ejecutar(): Promise<Resp<unknown>> {
    try {
      if (this.modo === "select") {
        let filas = aplicar(filasDe(this.tabla), this.filtros);
        if (this.orden) {
          const { col, asc } = this.orden;
          filas = [...filas].sort((a, b) => {
            const x = a[col] as never, y = b[col] as never;
            if (x === y) return 0;
            if (x === null || x === undefined) return 1;
            if (y === null || y === undefined) return -1;
            return (x > y ? 1 : -1) * (asc ? 1 : -1);
          });
        }
        if (this.unica === "single") {
          if (filas.length !== 1) return fallo("Se esperaba exactamente un registro.");
          return ok(filas[0]);
        }
        if (this.unica === "maybe") return ok(filas[0] ?? null);
        return ok(filas);
      }

      if (esVista(this.tabla)) return fallo("Las vistas son de solo lectura.");
      const base = this.tablaBase();

      if (this.modo === "insert" || this.modo === "upsert") {
        const guardadas: Registro[] = [];
        for (const cruda of this.carga) {
          const fila = normalizar(this.tabla, cruda);
          const i = base.findIndex((x) => mismaClave(this.tabla, x, fila));
          if (i >= 0) {
            if (this.modo === "insert" && CLAVE[this.tabla]) {
              return fallo(`duplicate key: ya existe un registro con esa clave.`);
            }
            base[i] = { ...base[i], ...fila, id: base[i].id ?? fila.id };
            guardadas.push(base[i]);
          } else {
            base.push(fila);
            guardadas.push(fila);
          }
        }
        await marcarSucio();
        if (this.unica === "single") return ok(guardadas[0] ?? null);
        return ok(guardadas);
      }

      if (this.modo === "update") {
        const objetivo = aplicar(base, this.filtros);
        for (const f of objetivo) Object.assign(f, normalizar(this.tabla, { ...f, ...this.carga[0] }));
        await marcarSucio();
        return ok(objetivo);
      }

      if (this.modo === "delete") {
        const fuera = new Set(aplicar(base, this.filtros));
        const quedan = base.filter((f) => !fuera.has(f));
        (datos as unknown as Record<string, Registro[]>)[this.tabla] = quedan;
        await marcarSucio();
        return ok([]);
      }

      return ok([]);
    } catch (e) {
      return fallo(e instanceof Error ? e.message : "Error al guardar.");
    }
  }

  then<A, B = never>(
    res?: ((v: Resp<unknown>) => A | PromiseLike<A>) | null,
    rej?: ((r: unknown) => B | PromiseLike<B>) | null
  ): PromiseLike<A | B> {
    return this.ejecutar().then(res, rej);
  }
}

/* ---------- almacenamiento de anexos ---------- */

const urls = new Map<string, string>();

const almacen = {
  from(_bucket: string) {
    return {
      async upload(ruta: string, archivo: File | Blob, _o?: unknown) {
        try {
          // `ruta` viene como "<evento_id>/<archivo>"; localmente se organiza
          // por código de evento, que es lo que se ve en la carpeta.
          const [eventoId, ...resto] = ruta.split("/");
          const ev = datos.eventos.find((e) => e.id === eventoId);
          const codigo = String(ev?.codigo ?? eventoId);
          const nombre = resto.join("/") || "archivo";
          const real = await fs.guardarAnexo(codigo, nombre, archivo);
          return { data: { path: real }, error: null };
        } catch (e) {
          return { data: null, error: { message: e instanceof Error ? e.message : "No se pudo guardar el archivo." } };
        }
      },
      async remove(rutas: string[]) {
        for (const r of rutas) {
          await fs.borrarAnexo(r);
          const u = urls.get(r);
          if (u) { URL.revokeObjectURL(u); urls.delete(r); }
        }
        return { data: null, error: null };
      },
      async createSignedUrls(rutas: string[], _seg: number) {
        const salida = [];
        for (const r of rutas) {
          let u = urls.get(r);
          if (!u) {
            const f = await fs.leerAnexo(r);
            if (f) { u = URL.createObjectURL(f); urls.set(r, u); }
          }
          salida.push({ path: r, signedUrl: u ?? null, error: null });
        }
        return { data: salida, error: null };
      },
    };
  },
};

export const supabase = {
  from(tabla: string) {
    return new Consulta(tabla === "usuarios" ? USUARIOS : tabla);
  },
  async rpc(nombre: string, _args?: unknown) {
    if (nombre === "siguiente_codigo_evento") return ok(siguienteCodigo(datos));
    return fallo(`Función desconocida: ${nombre}`);
  },
  storage: almacen,
  auth: {
    async getSession() { return { data: { session: SESION_LOCAL }, error: null }; },
    onAuthStateChange(_f: unknown) {
      return { data: { subscription: { unsubscribe() {} } } };
    },
    async signOut() { return { error: null }; },
  },
};

export const BUCKET = "anexos";
