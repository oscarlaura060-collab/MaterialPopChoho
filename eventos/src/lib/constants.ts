/**
 * Valores centralizados. La fuente real es la tabla `eventos.listas`
 * (hoja LISTAS del Excel); esto es el respaldo si la consulta falla.
 * Nunca escribir estos valores sueltos en las pantallas: usar `useCatalogo`.
 */

export const TIPOS_LISTA = {
  ESTADO: "ESTADO",
  TIPO_EVENTO: "TIPO_EVENTO",
  CIUDAD: "CIUDAD",
  ROL: "ROL",
  CATEGORIA: "CATEGORIA",
  FORMA_PAGO: "FORMA_PAGO",
  ESTADO_PAGO: "ESTADO_PAGO",
} as const;

export const RESPALDO_LISTAS: Record<string, string[]> = {
  ESTADO: ["PLANIFICADO", "CONFIRMADO", "REALIZADO", "CANCELADO"],
  TIPO_EVENTO: [
    "EVENTO EN PUNTO DE VENTA", "ACTIVACIÓN DE MARCA", "LANZAMIENTO",
    "FERIA / EXPOSICIÓN", "RODADA / CARAVANA", "CAPACITACIÓN",
    "EVENTO CORPORATIVO", "OTRO",
  ],
  CIUDAD: [
    "BOGOTÁ", "MEDELLÍN", "CALI", "BARRANQUILLA", "BUCARAMANGA",
    "CARTAGENA", "PEREIRA", "IBAGUÉ", "VILLAVICENCIO", "TUNJA",
  ],
  ROL: [
    "ORGANIZACIÓN", "LOGÍSTICA", "MERCADEO", "APOYO COMERCIAL", "MONTAJE",
    "ACTIVACIÓN", "REGISTRO", "RESPONSABLE", "OTRO",
  ],
  CATEGORIA: [
    "TRANSPORTE", "ALIMENTACIÓN", "REFRIGERIOS", "PERIFONEO", "PUBLICIDAD",
    "IMPRESIÓN", "VOLANTES", "PREMIOS", "DECORACIÓN", "ALQUILER", "PERSONAL",
    "MONTAJE", "DESMONTAJE", "INFLUENCIADORES", "LOGÍSTICA", "HOSPEDAJE", "OTROS",
  ],
  FORMA_PAGO: [
    "EFECTIVO", "TRANSFERENCIA", "TARJETA CRÉDITO", "TARJETA DÉBITO",
    "CAJA MENOR", "CRÉDITO PROVEEDOR", "OTRO",
  ],
  ESTADO_PAGO: ["PREVISTO", "PENDIENTE DE PAGO", "PAGADO", "ANULADO"],
};

export const MESES = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
];

export const DIAS = ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO", "DOMINGO"];

export const OPCIONES_SI_NO = ["SÍ", "NO", "PENDIENTE"] as const;

/** Colores de estado del evento (reservados: no se reutilizan como serie) */
export const COLOR_ESTADO: Record<string, string> = {
  REALIZADO: "bg-emerald-50 text-emerald-800 ring-emerald-600/25",
  CONFIRMADO: "bg-blue-50 text-blue-800 ring-blue-600/25",
  PLANIFICADO: "bg-amber-50 text-amber-900 ring-amber-600/30",
  CANCELADO: "bg-neutral-100 text-neutral-600 ring-neutral-500/25",
};

/**
 * Paleta categórica de los gráficos. Validada con el validador de paleta
 * (all-pairs, modo claro): peor par CVD ΔE 9.1 · visión normal ΔE 22.9.
 * Los slots 3 y 4 quedan por debajo de 3:1 de contraste, por eso todos los
 * gráficos llevan etiquetas directas y vista de tabla.
 */
export const SERIES = {
  s1: "#d0342c", // rojo CHOHO
  s2: "#2a78d6", // azul
  s3: "#eda100", // ámbar
  s4: "#1baf7a", // aqua
} as const;

export const SERIES_ORDEN = [SERIES.s1, SERIES.s2, SERIES.s3, SERIES.s4];

/** Gris para la porción "no consumida" — no es una serie de identidad */
export const NEUTRO = "#c9c6c2";

export const BUCKET_ANEXOS = "eventos-anexos";
