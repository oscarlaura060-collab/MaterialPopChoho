// Tipos derivados 1:1 del libro EVENTOS REALIZADOS.xlsx

export type Rol = "ADMINISTRADOR" | "JEFE";
export type SiNo = "SÍ" | "NO" | "PENDIENTE";

/** Hoja EVENTOS (columnas capturadas por el usuario) */
export interface Evento {
  id: string;
  codigo: string;                 // ID EVENTO
  nombre: string;                 // EVENTO
  fecha: string;                  // FECHA (YYYY-MM-DD)
  ciudad: string | null;
  lugar_negocio: string | null;   // LUGAR / NEGOCIO
  direccion: string | null;
  cliente: string | null;
  tipo_evento: string | null;
  responsable: string | null;
  estado: string;
  asistentes_esperados: number | null;
  observaciones: string | null;
}

/** Vista v_eventos: incluye las columnas calculadas de la hoja */
export interface EventoVista extends Evento {
  anio: number;
  mes: number;
  dia: string;                    // DÍA (LUNES..DOMINGO)
  gasto_pop: number;              // Σ del material utilizado × costo
  pop_valor_llevado: number;      // Σ del material llevado × costo (informativo)
  gastos_adicionales: number;     // SUMIFS sobre GASTOS
  gasto_total: number;            // GASTO POP + GASTOS ADICIONALES
  pop_llevado: number;
  pop_utilizado: number;
  pop_sobrante: number;
  personal_asignado: number;
  confirmados: number;
  pendientes: number;
  no_van: number;
  asistieron: number;
  no_asistieron: number;
  pct_asistencia: number | null;
  asistentes: number | null;      // desde RESULTADOS
  clientes_atendidos: number | null;
  n_anexos: number;
}

/** Hoja MATERIAL POP */
export interface MaterialPop {
  id: string;
  evento_id: string;
  material: string;
  cantidad_llevada: number;
  cantidad_sobrante: number;
  cantidad_utilizada: number;     // = LLEVADA − SOBRANTE
  pct_utilizacion: number | null; // = UTILIZADA / LLEVADA
  costo_unitario: number;
  gasto_material: number;         // = UTILIZADA × COSTO UNITARIO
  valor_llevado: number;          // = LLEVADA × COSTO UNITARIO
  observaciones: string | null;
  evento_codigo: string;
  evento_nombre: string;
  evento_fecha: string;
  evento_ciudad: string | null;
  evento_tipo: string | null;
  evento_estado: string;
  evento_responsable: string | null;
}

/** Hoja GASTOS */
export interface Gasto {
  id: string;
  evento_id: string;
  categoria: string | null;
  descripcion: string | null;
  proveedor: string | null;
  responsable: string | null;
  valor: number;
  observaciones: string | null;
  evento_codigo: string;
  evento_nombre: string;
  evento_fecha: string;
  evento_ciudad: string | null;
  evento_tipo: string | null;
  evento_estado: string;
}

/** Hoja PARTICIPACIÓN */
export interface Participacion {
  id: string;
  evento_id: string;
  persona_id: string | null;
  persona_nombre: string;
  confirmado: SiNo;
  asistio: SiNo;
  rol_funcion: string | null;
  hora_ingreso: string | null;
  hora_salida: string | null;
  observaciones: string | null;
  horas: number | null;           // MOD(salida − ingreso)
  evento_codigo: string;
  evento_nombre: string;
  evento_fecha: string;
  evento_estado: string;
}

/** Hoja PERSONAL (con los COUNTIFS resueltos) */
export interface Persona {
  id: string;
  codigo: string | null;
  nombre: string;
  cargo_area: string | null;
  activo: boolean;
  observaciones: string | null;
  eventos_asignados: number;
  confirmados: number;
  pendientes: number;
  no_va: number;
  asistidos: number;
  no_asistio: number;
  pct_asistencia: number | null;
  horas_totales: number;
}

/** Hoja RESULTADOS */
export interface Resultado {
  evento_id: string;
  asistentes: number | null;
  clientes_atendidos: number | null;
  resultado_comercial: string | null;
  observaciones: string | null;
  aprendizajes: string | null;
  evento_codigo: string;
  evento_nombre: string;
  evento_fecha: string;
  evento_ciudad: string | null;
  evento_estado: string;
}

export interface Anexo {
  id: string;
  evento_id: string;
  nombre: string;
  storage_path: string;
  mime_type: string | null;
  tamano_bytes: number | null;
  descripcion: string | null;
  created_at: string;
}

export interface Material {
  id: number;
  nombre: string;
  costo_unitario: number;
  activo: boolean;
}

export interface ListaItem {
  id: number;
  tipo: string;
  valor: string;
  orden: number;
  activo: boolean;
}

export interface Usuario {
  id: string;
  email: string | null;
  nombre: string | null;
  rol: Rol;
}

/** Filtros globales del dashboard */
export interface Filtros {
  anio: string;
  mes: string;
  ciudad: string;
  responsable: string;
  tipo_evento: string;
  estado: string;
  cliente: string;
  busqueda: string;
}

export const FILTROS_VACIOS: Filtros = {
  anio: "", mes: "", ciudad: "", responsable: "",
  tipo_evento: "", estado: "", cliente: "", busqueda: "",
};
