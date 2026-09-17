/**
 * lib/services.js
 * Reimplementación de toda la lógica de negocio de CHOHO POP sobre Supabase.
 * Cada función conserva EL MISMO NOMBRE que su equivalente en Apps Script, de
 * modo que el frontend heredado (app.js / campo.js) funciona sin cambios a
 * través del shim google.script.run -> /api/rpc.
 */
import { supabase, BUCKET_EVIDENCIAS } from './supabase.js';
import {
  fechaServidor,
  horaServidor,
  timestampServidor,
  generarId,
  registrarLog,
  resolverRegistradoPor,
  indexarPor,
} from './util.js';
import {
  zonaOut,
  zonaIn,
  personaOut,
  personaIn,
  materialOut,
  materialIn,
} from './mappers.js';

// ---------------- Constantes de negocio ----------------
const ESTADO_ENTREGA = {
  PENDIENTE: 'Pendiente',
  ENTREGADO: 'Entregado',
  PARCIAL: 'Parcialmente verificado',
  VERIFICADO: 'Verificado',
  CERRADO: 'Cerrado',
};
const ESTADO_INSTALACION = {
  PENDIENTE: 'Pendiente',
  PARCIAL: 'Parcial',
  COMPLETA: 'Completa',
  SIN_EVIDENCIA: 'Sin evidencia',
};
const LIMITE_IMAGEN = 8 * 1024 * 1024;
const LIMITE_VIDEO = 50 * 1024 * 1024;
const TIPOS_IMAGEN = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const TIPOS_VIDEO = ['video/mp4', 'video/quicktime', 'video/webm'];
const APP_NAME = 'CHOHO POP';

// Todas las secciones del panel (para el rol Administrador y el editor de permisos).
const TODAS_LAS_VISTAS = [
  'dashboard',
  'entregas',
  'verificacion',
  'materiales',
  'personas',
  'zonas',
  'evidencias',
  'reportes',
  'configuracion',
];

function permisosDePersona(persona) {
  if ((persona.rol || 'Encargado') === 'Administrador') return TODAS_LAS_VISTAS.slice();
  return String(persona.permisos || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------- Helpers de acceso ----------------
async function fetchAll(tabla) {
  const { data, error } = await supabase.from(tabla).select('*').range(0, 9999);
  if (error) throw new Error('Error leyendo ' + tabla + ': ' + error.message);
  return data || [];
}

// ============================================================
//  CATÁLOGOS
// ============================================================
async function listarZonas() {
  const rows = await fetchAll('zonas');
  rows.sort((a, b) => (a.id < b.id ? -1 : 1));
  return rows.map(zonaOut);
}

async function guardarZona(zona, nombreQuienRegistra) {
  const usuario = resolverRegistradoPor(nombreQuienRegistra);
  if (!zona.NOMBRE) throw new Error('El nombre de la zona es obligatorio.');
  if (zona.ID) {
    const { error } = await supabase.from('zonas').update(zonaIn(zona)).eq('id', zona.ID);
    if (error) throw new Error(error.message);
    await registrarLog(usuario, 'EDITAR_ZONA', zona);
  } else {
    const id = await generarId('ZON');
    const { error } = await supabase.from('zonas').insert({ id, ...zonaIn(zona) });
    if (error) throw new Error(error.message);
    zona.ID = id;
    await registrarLog(usuario, 'CREAR_ZONA', zona);
  }
  return zona;
}

async function listarPersonas() {
  const rows = await fetchAll('personas');
  rows.sort((a, b) => (a.id < b.id ? -1 : 1));
  return rows.map(personaOut);
}

async function guardarPersona(persona, nombreQuienRegistra) {
  const usuario = resolverRegistradoPor(nombreQuienRegistra);
  if (!persona.NOMBRE) throw new Error('El nombre de la persona es obligatorio.');
  // La zona es opcional: los administradores/usuarios de oficina pueden no tener zona.
  if (persona.ID) {
    const { error } = await supabase.from('personas').update(personaIn(persona)).eq('id', persona.ID);
    if (error) throw new Error(error.message);
    await registrarLog(usuario, 'EDITAR_PERSONA', { id: persona.ID, nombre: persona.NOMBRE });
  } else {
    const id = await generarId('PER');
    const { error } = await supabase.from('personas').insert({ id, ...personaIn(persona) });
    if (error) throw new Error(error.message);
    persona.ID = id;
    await registrarLog(usuario, 'CREAR_PERSONA', { id, nombre: persona.NOMBRE });
  }
  return persona;
}

async function obtenerPersonaPorZona(zonaId) {
  if (!zonaId) return null;
  const { data, error } = await supabase
    .from('personas')
    .select('*')
    .eq('zona_id', zonaId)
    .neq('estado', 'Inactivo')
    .limit(1);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return null;
  const p = data[0];
  return { id: p.id, nombre: p.nombre, ciudad: p.ciudad };
}

async function listarPersonasParaLogin() {
  const { data, error } = await supabase
    .from('personas')
    .select('id, nombre, estado')
    .neq('estado', 'Inactivo');
  if (error) throw new Error(error.message);
  return (data || []).map((p) => ({ id: p.id, nombre: p.nombre }));
}

async function obtenerDatosPersona(personaId) {
  const { data, error } = await supabase.from('personas').select('*').eq('id', personaId).limit(1);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return null;
  const p = data[0];
  return {
    id: p.id,
    nombre: p.nombre,
    zonaId: p.zona_id,
    ciudad: p.ciudad,
    telefono: p.telefono,
    correo: p.correo,
  };
}

async function listarMateriales() {
  const rows = await fetchAll('materiales');
  rows.sort((a, b) => (a.id < b.id ? -1 : 1));
  return rows.map(materialOut);
}

async function guardarMaterial(material, nombreQuienRegistra) {
  const usuario = resolverRegistradoPor(nombreQuienRegistra);
  if (!material.NOMBRE) throw new Error('El nombre del material es obligatorio.');
  if (material.ID) {
    const { error } = await supabase.from('materiales').update(materialIn(material)).eq('id', material.ID);
    if (error) throw new Error(error.message);
    await registrarLog(usuario, 'EDITAR_MATERIAL', { id: material.ID, nombre: material.NOMBRE });
  } else {
    const id = await generarId('MAT');
    const { error } = await supabase.from('materiales').insert({ id, ...materialIn(material) });
    if (error) throw new Error(error.message);
    material.ID = id;
    await registrarLog(usuario, 'CREAR_MATERIAL', { id, nombre: material.NOMBRE });
  }
  return material;
}

async function obtenerCatalogos() {
  const [zonas, personas, materiales] = await Promise.all([
    listarZonas(),
    listarPersonas(),
    listarMateriales(),
  ]);
  return {
    zonas: zonas.filter((z) => z.ESTADO !== 'Inactiva'),
    personas: personas.filter((p) => p.ESTADO !== 'Inactivo'),
    materiales: materiales.filter((m) => m.ESTADO !== 'Inactivo'),
  };
}

// ============================================================
//  AUTH / SESIÓN
// ============================================================
function obtenerUsuarioActual() {
  // Sin sesión de Google Workspace: el frontend pide "Nombre de quien registra".
  return { email: null, requiereNombre: true };
}

async function iniciarSesionPersona(personaId, codigo) {
  if (!personaId) throw new Error('Selecciona tu nombre para ingresar.');
  const { data, error } = await supabase.from('personas').select('*').eq('id', personaId).limit(1);
  if (error) throw new Error(error.message);
  const persona = data && data[0];
  if (!persona) throw new Error('Persona no encontrada.');
  if (persona.estado === 'Inactivo') throw new Error('Este usuario está inactivo. Contacta a un administrador.');

  const codigoGuardado = String(persona.codigo_acceso || '').trim();
  if (!codigoGuardado) {
    throw new Error('Todavía no tienes un código de acceso asignado. Pide a un administrador que te lo configure en "Personas encargadas".');
  }
  if (codigoGuardado !== String(codigo || '').trim()) {
    throw new Error('Código de acceso incorrecto.');
  }

  return armarSesion(persona);
}

/** Inicia sesión SOLO con el código de acceso (sin elegir nombre). */
async function iniciarSesionPorCodigo(codigo) {
  const cod = String(codigo || '').trim();
  if (!cod) throw new Error('Ingresa tu código de acceso.');
  const { data, error } = await supabase
    .from('personas')
    .select('*')
    .eq('codigo_acceso', cod)
    .neq('estado', 'Inactivo')
    .limit(1);
  if (error) throw new Error(error.message);
  const persona = data && data[0];
  if (!persona) throw new Error('Código de acceso incorrecto.');
  return armarSesion(persona);
}

/** Construye el objeto de sesión (zonas, permisos) a partir de una persona. */
async function armarSesion(persona) {
  // Zonas asignadas (una persona puede cubrir varias).
  const zonasMap = indexarPor(await fetchAll('zonas'), 'id');
  let zonasIds = String(persona.zonas || persona.zona_id || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const zonas = zonasIds.map((id) => ({ id, nombre: zonasMap[id] ? zonasMap[id].nombre : id }));
  const zonaPrincipal = zonas[0] || { id: persona.zona_id || '', nombre: '' };

  await registrarLog(persona.nombre, 'LOGIN', { personaId: persona.id, rol: persona.rol });

  return {
    id: persona.id,
    nombre: persona.nombre,
    zonaId: zonaPrincipal.id,
    zonaNombre: zonaPrincipal.nombre,
    zonas: zonas,
    zonasIds: zonasIds,
    ciudad: persona.ciudad,
    rol: persona.rol || 'Encargado',
    permisos: permisosDePersona(persona),
  };
}

/** Elimina un usuario/persona. No permite borrar el último administrador activo. */
async function eliminarPersona(id) {
  if (!id) throw new Error('Falta el ID del usuario a eliminar.');
  const { data: objetivo } = await supabase.from('personas').select('*').eq('id', id).limit(1);
  const persona = objetivo && objetivo[0];
  if (!persona) throw new Error('Usuario no encontrado.');

  if ((persona.rol || 'Encargado') === 'Administrador') {
    const { data: admins } = await supabase
      .from('personas')
      .select('id')
      .eq('rol', 'Administrador')
      .neq('estado', 'Inactivo');
    if ((admins || []).length <= 1) {
      throw new Error('No puedes eliminar al único administrador. Crea otro administrador primero.');
    }
  }

  const { error } = await supabase.from('personas').delete().eq('id', id);
  if (error) throw new Error(error.message);
  await registrarLog('Administrador', 'ELIMINAR_PERSONA', { id, nombre: persona.nombre });
  return true;
}

// ============================================================
//  ENTREGAS
// ============================================================
async function crearEntrega(data) {
  const usuario = resolverRegistradoPor(data.nombreQuienRegistra);

  if (!data.personaId) throw new Error('Debes seleccionar la persona encargada.');
  if (!data.zonaId) throw new Error('Debes seleccionar la zona.');
  if (!data.materiales || data.materiales.length === 0) throw new Error('Agrega al menos un material a la entrega.');

  data.materiales.forEach((m) => {
    if (!m.materialId) throw new Error('Todos los renglones de material deben tener un material seleccionado.');
    const cantidad = Number(m.cantidad);
    if (isNaN(cantidad) || cantidad <= 0) throw new Error('Las cantidades deben ser números mayores a cero.');
  });

  const idEntrega = await generarId('ENT');
  const lat = data.ubicacion ? data.ubicacion.lat : '';
  const lng = data.ubicacion ? data.ubicacion.lng : '';
  const ubicacionUrl = lat && lng ? 'https://www.google.com/maps?q=' + lat + ',' + lng : '';

  const { error: eEnt } = await supabase.from('entregas').insert({
    id_entrega: idEntrega,
    fecha_entrega: data.fechaEntrega || fechaServidor(),
    persona_id: data.personaId,
    zona_id: data.zonaId,
    ciudad: data.ciudad || '',
    punto: data.punto || '',
    direccion: data.direccion || '',
    latitud: lat,
    longitud: lng,
    ubicacion_url: ubicacionUrl,
    observaciones: data.observaciones || '',
    registrado_por: usuario,
    estado: ESTADO_ENTREGA.ENTREGADO,
  });
  if (eEnt) throw new Error('No se pudo crear la entrega: ' + eEnt.message);

  const detalles = [];
  for (const m of data.materiales) {
    detalles.push({
      id_detalle: await generarId('DET'),
      id_entrega: idEntrega,
      material_id: m.materialId,
      cantidad_entregada: Number(m.cantidad),
      cantidad_instalada: 0,
      cantidad_pendiente: Number(m.cantidad),
    });
  }
  const { error: eDet } = await supabase.from('detalle_entregas').insert(detalles);
  if (eDet) throw new Error('No se pudo guardar el detalle de materiales: ' + eDet.message);

  await registrarLog(usuario, 'CREAR_ENTREGA', { idEntrega, materiales: data.materiales.length });
  return { idEntrega };
}

async function listarEntregas(filtros) {
  filtros = filtros || {};
  const [entregas, detalles, personasRows, zonasRows, materialesRows] = await Promise.all([
    fetchAll('entregas'),
    fetchAll('detalle_entregas'),
    fetchAll('personas'),
    fetchAll('zonas'),
    fetchAll('materiales'),
  ]);
  const personas = indexarPor(personasRows, 'id');
  const zonas = indexarPor(zonasRows, 'id');
  const materiales = indexarPor(materialesRows, 'id');

  const detallesPorEntrega = {};
  detalles.forEach((d) => {
    if (!detallesPorEntrega[d.id_entrega]) detallesPorEntrega[d.id_entrega] = [];
    detallesPorEntrega[d.id_entrega].push(d);
  });

  let resultado = entregas.map((e) => {
    const det = detallesPorEntrega[e.id_entrega] || [];
    let entregado = 0,
      instalado = 0,
      pendiente = 0;
    const lineas = det.map((d) => {
      entregado += Number(d.cantidad_entregada) || 0;
      instalado += Number(d.cantidad_instalada) || 0;
      pendiente += Number(d.cantidad_pendiente) || 0;
      const mat = materiales[d.material_id];
      return {
        idDetalle: d.id_detalle,
        materialId: d.material_id,
        materialNombre: mat ? mat.nombre : d.material_id,
        entregado: Number(d.cantidad_entregada) || 0,
        instalado: Number(d.cantidad_instalada) || 0,
        pendiente: Number(d.cantidad_pendiente) || 0,
      };
    });
    const persona = personas[e.persona_id];
    const zona = zonas[e.zona_id];
    return {
      idEntrega: e.id_entrega,
      fecha: e.fecha_entrega,
      personaId: e.persona_id,
      personaNombre: persona ? persona.nombre : e.persona_id,
      zonaId: e.zona_id,
      zonaNombre: zona ? zona.nombre : e.zona_id,
      ciudad: e.ciudad,
      punto: e.punto,
      direccion: e.direccion,
      latitud: e.latitud,
      longitud: e.longitud,
      ubicacionUrl: e.ubicacion_url,
      observaciones: e.observaciones,
      registradoPor: e.registrado_por,
      timestamp: e.ts,
      estado: e.estado,
      entregado,
      instalado,
      pendiente,
      cumplimiento: entregado > 0 ? Math.round((instalado / entregado) * 1000) / 10 : 0,
      materiales: lineas,
    };
  });

  resultado = resultado.filter((e) => {
    if (filtros.zonaId && e.zonaId !== filtros.zonaId) return false;
    if (filtros.ciudad && e.ciudad !== filtros.ciudad) return false;
    if (filtros.personaId && e.personaId !== filtros.personaId) return false;
    if (filtros.estado && e.estado !== filtros.estado) return false;
    if (filtros.registradoPor && e.registradoPor !== filtros.registradoPor) return false;
    if (filtros.materialId && !e.materiales.some((m) => m.materialId === filtros.materialId)) return false;
    if (filtros.fechaDesde && e.fecha < filtros.fechaDesde) return false;
    if (filtros.fechaHasta && e.fecha > filtros.fechaHasta) return false;
    return true;
  });

  resultado.sort((a, b) => (b.timestamp < a.timestamp ? -1 : 1));
  return resultado;
}

// ============================================================
//  VERIFICACIÓN
// ============================================================
async function registrarVerificacion(data) {
  const usuario = resolverRegistradoPor(data.nombreQuienRegistra);
  if (!data.idEntrega) throw new Error('Falta el ID de la entrega.');
  if (!data.idDetalle) throw new Error('Falta el detalle de material a verificar.');

  const cantidadInstalada = Number(data.cantidadInstalada);
  if (isNaN(cantidadInstalada) || cantidadInstalada < 0) {
    throw new Error('La cantidad instalada debe ser un número igual o mayor a cero.');
  }

  const { data: detRows, error: eDet } = await supabase
    .from('detalle_entregas')
    .select('*')
    .eq('id_detalle', data.idDetalle)
    .limit(1);
  if (eDet) throw new Error(eDet.message);
  const detalle = detRows && detRows[0];
  if (!detalle) throw new Error('No se encontró el detalle de material indicado.');

  const entregado = Number(detalle.cantidad_entregada) || 0;
  if (cantidadInstalada > entregado) {
    throw new Error('La cantidad instalada (' + cantidadInstalada + ') no puede superar la cantidad entregada (' + entregado + ').');
  }
  const pendiente = entregado - cantidadInstalada;

  const idVerificacion = await generarId('VER');
  const timestamp = timestampServidor();
  const estadoLinea =
    cantidadInstalada === 0
      ? ESTADO_INSTALACION.PENDIENTE
      : pendiente === 0
      ? ESTADO_INSTALACION.COMPLETA
      : ESTADO_INSTALACION.PARCIAL;

  const { error: eVer } = await supabase.from('verificaciones').insert({
    id_verificacion: idVerificacion,
    id_entrega: data.idEntrega,
    id_detalle: data.idDetalle,
    cantidad_instalada: cantidadInstalada,
    cantidad_pendiente: pendiente,
    observaciones: data.observaciones || '',
    registrado_por: usuario,
    estado: estadoLinea,
  });
  if (eVer) throw new Error('No se pudo registrar la verificación: ' + eVer.message);

  const { error: eUpd } = await supabase
    .from('detalle_entregas')
    .update({ cantidad_instalada: cantidadInstalada, cantidad_pendiente: pendiente })
    .eq('id_detalle', data.idDetalle);
  if (eUpd) throw new Error(eUpd.message);

  await recalcularEstadoEntrega(data.idEntrega);
  await registrarLog(usuario, 'REGISTRAR_VERIFICACION', {
    idEntrega: data.idEntrega,
    idDetalle: data.idDetalle,
    cantidadInstalada,
  });

  return { idVerificacion, pendiente, estado: estadoLinea, timestamp };
}

async function recalcularEstadoEntrega(idEntrega) {
  const { data: detalles } = await supabase
    .from('detalle_entregas')
    .select('*')
    .eq('id_entrega', idEntrega);
  if (!detalles || detalles.length === 0) return;

  let totalEntregado = 0,
    totalInstalado = 0;
  detalles.forEach((d) => {
    totalEntregado += Number(d.cantidad_entregada) || 0;
    totalInstalado += Number(d.cantidad_instalada) || 0;
  });

  let estado;
  if (totalInstalado === 0) estado = ESTADO_ENTREGA.ENTREGADO;
  else if (totalInstalado >= totalEntregado) estado = ESTADO_ENTREGA.VERIFICADO;
  else estado = ESTADO_ENTREGA.PARCIAL;

  await supabase.from('entregas').update({ estado }).eq('id_entrega', idEntrega);
}

async function listarPendientesVerificacion() {
  const entregas = await listarEntregas({});
  return entregas.filter((e) => e.estado !== ESTADO_ENTREGA.CERRADO && e.pendiente > 0);
}

// ============================================================
//  EVIDENCIAS
// ============================================================
function validarArchivo(nombreArchivo, mimeType, base64Body) {
  if (!nombreArchivo || !mimeType || !base64Body) {
    throw new Error('Archivo inválido: falta nombre, tipo o contenido.');
  }
  const esImagen = TIPOS_IMAGEN.indexOf(mimeType) > -1;
  const esVideo = TIPOS_VIDEO.indexOf(mimeType) > -1;
  if (!esImagen && !esVideo) throw new Error('Formato de archivo no permitido: ' + mimeType);
  const sizeBytes = Math.floor((base64Body.length * 3) / 4);
  const limite = esImagen ? LIMITE_IMAGEN : LIMITE_VIDEO;
  if (sizeBytes > limite) {
    throw new Error('El archivo supera el límite permitido (' + Math.round(limite / (1024 * 1024)) + 'MB).');
  }
  return esImagen;
}

function sanitizar(nombre) {
  return String(nombre || 'archivo')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120);
}

/**
 * archivo = { base64, nombreArchivo, mimeType }
 * contexto = { idEntrega, idVerificacion, materialId, etapa, zonaNombre, nombreQuienRegistra }
 */
async function subirEvidencia(archivo, contexto) {
  const usuario = resolverRegistradoPor(contexto.nombreQuienRegistra);
  if (!contexto.idEntrega) throw new Error('Falta el ID de entrega asociado a la evidencia.');

  const base64Body = String(archivo.base64 || '').split(',').pop();
  const esImagen = validarArchivo(archivo.nombreArchivo, archivo.mimeType, base64Body);

  const buffer = Buffer.from(base64Body, 'base64');
  const anio = new Date().getFullYear();
  const zona = sanitizar(contexto.zonaNombre || 'Sin zona');
  const path = `${anio}/${zona}/${contexto.idEntrega}/${Date.now()}-${sanitizar(archivo.nombreArchivo)}`;

  const { error: eUp } = await supabase.storage
    .from(BUCKET_EVIDENCIAS)
    .upload(path, buffer, { contentType: archivo.mimeType, upsert: false });
  if (eUp) throw new Error('No se pudo subir el archivo: ' + eUp.message);

  const { data: pub } = supabase.storage.from(BUCKET_EVIDENCIAS).getPublicUrl(path);
  const url = pub.publicUrl;
  const tipo = esImagen ? 'imagen' : 'video';

  const idEvidencia = await generarId('EVI');
  const etapa = contexto.etapa || (contexto.idVerificacion ? 'verificacion' : 'entrega');

  const { error: eIns } = await supabase.from('evidencias').insert({
    id_evidencia: idEvidencia,
    id_verificacion: contexto.idVerificacion || '',
    id_entrega: contexto.idEntrega,
    material_id: contexto.materialId || '',
    etapa,
    tipo,
    nombre_archivo: archivo.nombreArchivo,
    storage_path: path,
    url,
    zona: contexto.zonaNombre || '',
    fecha: fechaServidor(),
    hora: horaServidor(),
    registrado_por: usuario,
  });
  if (eIns) throw new Error('No se pudo guardar la evidencia: ' + eIns.message);

  await registrarLog(usuario, 'SUBIR_EVIDENCIA', { idEvidencia, idEntrega: contexto.idEntrega });
  return { idEvidencia, url, tipo };
}

async function listarEvidencias(filtros) {
  filtros = filtros || {};
  const [evidencias, entregasRows, personasRows, materialesRows, zonasRows] = await Promise.all([
    fetchAll('evidencias'),
    fetchAll('entregas'),
    fetchAll('personas'),
    fetchAll('materiales'),
    fetchAll('zonas'),
  ]);
  const entregas = indexarPor(entregasRows, 'id_entrega');
  const personas = indexarPor(personasRows, 'id');
  const materiales = indexarPor(materialesRows, 'id');
  const zonas = indexarPor(zonasRows, 'id');

  evidencias.sort((a, b) => (String(b.created_at) < String(a.created_at) ? -1 : 1));

  let resultado = evidencias.map((ev) => {
    const entrega = entregas[ev.id_entrega];
    const persona = entrega ? personas[entrega.persona_id] : null;
    const zona = entrega ? zonas[entrega.zona_id] : null;
    const material = materiales[ev.material_id];
    return {
      idEvidencia: ev.id_evidencia,
      idEntrega: ev.id_entrega,
      etapa: ev.etapa || 'verificacion',
      tipo: ev.tipo,
      url: ev.url,
      nombreArchivo: ev.nombre_archivo,
      fecha: ev.fecha,
      hora: ev.hora,
      zonaNombre: zona ? zona.nombre : ev.zona,
      zonaId: entrega ? entrega.zona_id : '',
      personaNombre: persona ? persona.nombre : '',
      personaId: entrega ? entrega.persona_id : '',
      ciudad: entrega ? entrega.ciudad : '',
      punto: entrega ? entrega.punto : '',
      direccion: entrega ? entrega.direccion : '',
      latitud: entrega ? entrega.latitud : '',
      longitud: entrega ? entrega.longitud : '',
      ubicacionUrl: entrega ? entrega.ubicacion_url : '',
      materialNombre: material ? material.nombre : ev.material_id,
      materialId: ev.material_id,
      registradoPor: ev.registrado_por,
    };
  });

  resultado = resultado.filter((e) => {
    if (filtros.zonaId && e.zonaId !== filtros.zonaId) return false;
    if (filtros.ciudad && e.ciudad !== filtros.ciudad) return false;
    if (filtros.personaId && e.personaId !== filtros.personaId) return false;
    if (filtros.materialId && e.materialId !== filtros.materialId) return false;
    if (filtros.tipo && e.tipo !== filtros.tipo) return false;
    if (filtros.etapa && e.etapa !== filtros.etapa) return false;
    if (filtros.fechaDesde && e.fecha < filtros.fechaDesde) return false;
    if (filtros.fechaHasta && e.fecha > filtros.fechaHasta) return false;
    return true;
  });

  return resultado;
}

async function listarEvidenciasPorEntrega(idEntrega) {
  const todas = await listarEvidencias({});
  return todas.filter((e) => e.idEntrega === idEntrega);
}

/** Elimina una evidencia: borra el archivo del almacenamiento y su registro. */
async function eliminarEvidencia(idEvidencia) {
  if (!idEvidencia) throw new Error('Falta el ID de la evidencia.');
  const { data, error } = await supabase
    .from('evidencias')
    .select('*')
    .eq('id_evidencia', idEvidencia)
    .limit(1);
  if (error) throw new Error(error.message);
  const ev = data && data[0];
  if (!ev) throw new Error('Evidencia no encontrada.');

  if (ev.storage_path) {
    const { error: eDel } = await supabase.storage.from(BUCKET_EVIDENCIAS).remove([ev.storage_path]);
    if (eDel) console.error('No se pudo borrar el archivo de storage:', eDel.message);
  }

  const { error: eRow } = await supabase.from('evidencias').delete().eq('id_evidencia', idEvidencia);
  if (eRow) throw new Error(eRow.message);

  await registrarLog('Administrador', 'ELIMINAR_EVIDENCIA', { idEvidencia, idEntrega: ev.id_entrega });
  return true;
}

// ============================================================
//  DASHBOARD
// ============================================================
async function obtenerDashboard() {
  const [entregas, zonasRows, personasRows, materialesRows, detalles, evidencias] = await Promise.all([
    listarEntregas({}),
    fetchAll('zonas'),
    fetchAll('personas'),
    fetchAll('materiales'),
    fetchAll('detalle_entregas'),
    fetchAll('evidencias'),
  ]);
  const materiales = indexarPor(materialesRows, 'id');

  let totalEntregado = 0,
    totalInstalado = 0,
    totalPendiente = 0;
  entregas.forEach((e) => {
    totalEntregado += e.entregado;
    totalInstalado += e.instalado;
    totalPendiente += e.pendiente;
  });
  const cumplimiento = totalEntregado > 0 ? Math.round((totalInstalado / totalEntregado) * 1000) / 10 : 0;

  const porZona = {};
  entregas.forEach((e) => {
    if (!porZona[e.zonaNombre]) porZona[e.zonaNombre] = { entregado: 0, instalado: 0 };
    porZona[e.zonaNombre].entregado += e.entregado;
    porZona[e.zonaNombre].instalado += e.instalado;
  });
  const cumplimientoPorZona = Object.keys(porZona)
    .map((zona) => {
      const d = porZona[zona];
      return { zona, cumplimiento: d.entregado > 0 ? Math.round((d.instalado / d.entregado) * 1000) / 10 : 0 };
    })
    .sort((a, b) => b.cumplimiento - a.cumplimiento);

  const porTipo = {};
  detalles.forEach((d) => {
    const mat = materiales[d.material_id];
    const nombre = mat ? mat.nombre : d.material_id;
    porTipo[nombre] = (porTipo[nombre] || 0) + (Number(d.cantidad_entregada) || 0);
  });
  const materialPorTipo = Object.keys(porTipo)
    .map((n) => ({ material: n, cantidad: porTipo[n] }))
    .sort((a, b) => b.cantidad - a.cantidad);

  const idsConEvidencia = {};
  evidencias.forEach((ev) => {
    idsConEvidencia[ev.id_entrega] = true;
  });
  const estadoGeneral = { Instalado: 0, Parcial: 0, Pendiente: 0, 'Sin evidencia': 0 };
  entregas.forEach((e) => {
    if (e.instalado === 0) estadoGeneral['Pendiente']++;
    else if (e.pendiente === 0) estadoGeneral['Instalado']++;
    else estadoGeneral['Parcial']++;
    if (!idsConEvidencia[e.idEntrega]) estadoGeneral['Sin evidencia']++;
  });

  const entregasRecientes = entregas.slice(0, 8);
  const todasEvidencias = await listarEvidencias({});
  const evidenciasRecientes = todasEvidencias.slice(0, 8);

  const pendientesPorPersona = {};
  entregas.forEach((e) => {
    if (e.pendiente > 0) {
      const key = e.personaNombre + '|' + e.zonaNombre;
      pendientesPorPersona[key] = (pendientesPorPersona[key] || 0) + e.pendiente;
    }
  });
  const pendientes = Object.keys(pendientesPorPersona)
    .map((key) => {
      const parts = key.split('|');
      return { persona: parts[0], zona: parts[1], cantidad: pendientesPorPersona[key] };
    })
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 10);

  const alertas = [];
  const sinVerificar = entregas.filter((e) => e.instalado === 0).length;
  if (sinVerificar > 0) alertas.push(sinVerificar + ' entregas todavía no tienen verificación.');
  if (totalPendiente > 0) alertas.push(Math.round(totalPendiente) + ' materiales están pendientes de instalación.');
  const sinEvidencia = estadoGeneral['Sin evidencia'];
  if (sinEvidencia > 0) alertas.push(sinEvidencia + ' entregas no tienen evidencia fotográfica.');
  cumplimientoPorZona
    .filter((z) => z.cumplimiento < 70)
    .forEach((z) => {
      alertas.push('Zona ' + z.zona + ' tiene un cumplimiento bajo (' + z.cumplimiento + '%).');
    });

  const personasSinReportar = personasRows
    .filter((p) => !entregas.some((e) => e.personaId === p.id && e.instalado > 0))
    .map((p) => p.nombre);

  return {
    tarjetas: {
      totalEntregado,
      totalInstalado,
      totalPendiente,
      cumplimiento,
      personasEncargadas: personasRows.length,
      zonas: zonasRows.filter((z) => z.estado !== 'Inactiva').length,
      evidencias: evidencias.length,
    },
    graficos: {
      entregadoVsInstalado: { entregado: totalEntregado, instalado: totalInstalado, pendiente: totalPendiente },
      cumplimientoPorZona,
      materialPorTipo,
      estadoGeneral,
    },
    entregasRecientes,
    evidenciasRecientes,
    pendientes,
    personasSinReportar,
    alertas,
  };
}

// ============================================================
//  REPORTES
// ============================================================
function csvEscapar(valor) {
  let v = valor === undefined || valor === null ? '' : String(valor);
  if (v.indexOf(',') > -1 || v.indexOf('"') > -1 || v.indexOf('\n') > -1) {
    v = '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}

async function generarReporte(agruparPor, filtros) {
  const entregas = await listarEntregas(filtros || {});
  const grupos = {};

  entregas.forEach((e) => {
    if (agruparPor === 'material') {
      e.materiales.forEach((m) => {
        const key = m.materialNombre;
        if (!grupos[key]) grupos[key] = { entregado: 0, instalado: 0, pendiente: 0 };
        grupos[key].entregado += m.entregado;
        grupos[key].instalado += m.instalado;
        grupos[key].pendiente += m.pendiente;
      });
      return;
    }
    let key;
    switch (agruparPor) {
      case 'zona':
        key = e.zonaNombre;
        break;
      case 'persona':
        key = e.personaNombre;
        break;
      case 'ciudad':
        key = e.ciudad;
        break;
      case 'estado':
        key = e.estado;
        break;
      default:
        key = e.fecha;
    }
    if (!grupos[key]) grupos[key] = { entregado: 0, instalado: 0, pendiente: 0 };
    grupos[key].entregado += e.entregado;
    grupos[key].instalado += e.instalado;
    grupos[key].pendiente += e.pendiente;
  });

  const filas = Object.keys(grupos)
    .map((key) => {
      const g = grupos[key];
      return {
        grupo: key,
        entregado: g.entregado,
        instalado: g.instalado,
        pendiente: g.pendiente,
        cumplimiento: g.entregado > 0 ? Math.round((g.instalado / g.entregado) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.entregado - a.entregado);

  return { agrupadoPor: agruparPor, filas, filtros: filtros || {} };
}

async function exportarReporteCSV(agruparPor, filtros) {
  const reporte = await generarReporte(agruparPor, filtros);
  const lineas = ['Grupo,Entregado,Instalado,Pendiente,Cumplimiento(%)'];
  reporte.filas.forEach((f) => {
    lineas.push([csvEscapar(f.grupo), f.entregado, f.instalado, f.pendiente, f.cumplimiento].join(','));
  });
  const contenido = '﻿' + lineas.join('\n');
  return {
    nombreArchivo: 'reporte_choho_pop_' + agruparPor + '.csv',
    base64: Buffer.from(contenido, 'utf8').toString('base64'),
    mimeType: 'text/csv',
  };
}

async function exportarEntregasCSV(filtros) {
  const entregas = await listarEntregas(filtros || {});
  const lineas = ['ID,Fecha,Persona,Zona,Ciudad,Punto,Entregado,Instalado,Pendiente,Estado,Registrado por'];
  entregas.forEach((e) => {
    lineas.push(
      [
        e.idEntrega,
        e.fecha,
        csvEscapar(e.personaNombre),
        csvEscapar(e.zonaNombre),
        csvEscapar(e.ciudad),
        csvEscapar(e.punto),
        e.entregado,
        e.instalado,
        e.pendiente,
        e.estado,
        csvEscapar(e.registradoPor),
      ].join(',')
    );
  });
  const contenido = '﻿' + lineas.join('\n');
  return {
    nombreArchivo: 'entregas_choho_pop.csv',
    base64: Buffer.from(contenido, 'utf8').toString('base64'),
    mimeType: 'text/csv',
  };
}

// ============================================================
//  ARRANQUE
// ============================================================
async function obtenerDatosIniciales() {
  return {
    usuario: obtenerUsuarioActual(),
    catalogos: await obtenerCatalogos(),
    appName: APP_NAME,
  };
}

// ============================================================
//  REGISTRO DE FUNCIONES EXPUESTAS AL FRONTEND
// ============================================================
export const handlers = {
  // arranque / catálogos
  obtenerDatosIniciales,
  obtenerCatalogos,
  listarZonas,
  guardarZona,
  listarPersonas,
  guardarPersona,
  eliminarPersona,
  obtenerPersonaPorZona,
  listarPersonasParaLogin,
  obtenerDatosPersona,
  listarMateriales,
  guardarMaterial,
  // auth
  iniciarSesionPersona,
  iniciarSesionPorCodigo,
  // entregas
  crearEntrega,
  listarEntregas,
  // verificación
  registrarVerificacion,
  listarPendientesVerificacion,
  // evidencias
  subirEvidencia,
  listarEvidencias,
  listarEvidenciasPorEntrega,
  eliminarEvidencia,
  // dashboard
  obtenerDashboard,
  // reportes
  generarReporte,
  exportarReporteCSV,
  exportarEntregasCSV,
};
