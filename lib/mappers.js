/**
 * lib/mappers.js
 * Traduce entre las filas de Postgres (snake_case) y las claves en MAYÚSCULAS
 * que el frontend heredado espera (ID, NOMBRE, ID_ENTREGA, ...), para que la
 * interfaz existente funcione sin cambios.
 */

// ---------- ZONAS ----------
export function zonaOut(r) {
  return {
    ID: r.id,
    NOMBRE: r.nombre,
    REGION: r.region || '',
    CIUDAD_PRINCIPAL: r.ciudad_principal || '',
    RESPONSABLE: r.responsable || '',
    ESTADO: r.estado || 'Activa',
  };
}
export function zonaIn(z) {
  return {
    nombre: z.NOMBRE,
    region: z.REGION || '',
    ciudad_principal: z.CIUDAD_PRINCIPAL || '',
    responsable: z.RESPONSABLE || '',
    estado: z.ESTADO || 'Activa',
  };
}

// ---------- PERSONAS ----------
export function personaOut(r) {
  return {
    ID: r.id,
    NOMBRE: r.nombre,
    TELEFONO: r.telefono || '',
    CORREO: r.correo || '',
    ZONA_ID: r.zona_id || '',
    CIUDAD: r.ciudad || '',
    CARGO: r.cargo || '',
    ESTADO: r.estado || 'Activo',
    OBSERVACIONES: r.observaciones || '',
    CODIGO_ACCESO: r.codigo_acceso || '',
    ROL: r.rol || 'Encargado',
    PERMISOS: r.permisos || '',
    ZONAS: r.zonas || (r.zona_id || ''),
  };
}
export function personaIn(p) {
  // Acepta ZONAS (lista separada por comas) o el ZONA_ID heredado (una sola).
  var zonasArr = String(p.ZONAS || '')
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
  if (zonasArr.length === 0 && p.ZONA_ID) zonasArr = [p.ZONA_ID];
  return {
    nombre: p.NOMBRE,
    telefono: p.TELEFONO || '',
    correo: p.CORREO || '',
    zona_id: zonasArr[0] || null,
    zonas: zonasArr.join(','),
    ciudad: p.CIUDAD || '',
    cargo: p.CARGO || '',
    estado: p.ESTADO || 'Activo',
    observaciones: p.OBSERVACIONES || '',
    codigo_acceso: (p.CODIGO_ACCESO || '').trim(),
    rol: p.ROL || 'Encargado',
    permisos: p.PERMISOS || '',
  };
}

// ---------- MATERIALES ----------
export function materialOut(r) {
  return {
    ID: r.id,
    NOMBRE: r.nombre,
    CATEGORIA: r.categoria || '',
    DESCRIPCION: r.descripcion || '',
    UNIDAD: r.unidad || 'Unidad',
    ESTADO: r.estado || 'Activo',
    IMAGEN: r.imagen || '',
  };
}
export function materialIn(m) {
  return {
    nombre: m.NOMBRE,
    categoria: m.CATEGORIA || '',
    descripcion: m.DESCRIPCION || '',
    unidad: m.UNIDAD || 'Unidad',
    estado: m.ESTADO || 'Activo',
    imagen: m.IMAGEN || '',
  };
}
