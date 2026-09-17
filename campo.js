/* ============================================================
   ESTADO
   ============================================================ */
var SESION = null; // {id, nombre, zonaId, zonaNombre, ciudad}
var CATALOGOS = { materiales: [] };
var LINEA_COUNT = 0;
var ARCHIVOS_ENTREGA = [];
var ARCHIVOS_VERIFICACION = [];
var UBICACION_ENTREGA = null;
var CONTEXTO_VERIFICACION = null; // {idEntrega, idDetalle, materialNombre, zonaNombre}
var PENDIENTES_CACHE = [];
var ENTREGA_ZONA = null; // {id, nombre} zona elegida para la entrega en curso

function zonasDeSesion() {
  if (SESION && SESION.zonasIds && SESION.zonasIds.length) return SESION.zonasIds;
  return (SESION && SESION.zonaId) ? [SESION.zonaId] : [];
}
function listaZonasSesion() {
  if (SESION && SESION.zonas && SESION.zonas.length) return SESION.zonas;
  return (SESION && SESION.zonaId) ? [{ id: SESION.zonaId, nombre: SESION.zonaNombre || '' }] : [];
}

document.addEventListener('DOMContentLoaded', function () {
  cargarMateriales();
  configurarEventos();
});

function cargarMateriales() {
  google.script.run.withSuccessHandler(function (materiales) {
    CATALOGOS.materiales = materiales.filter(function (m) { return m.ESTADO !== 'Inactivo'; });
  }).withFailureHandler(manejarError).listarMateriales();
}

function configurarEventos() {
  document.getElementById('btnLogin').addEventListener('click', hacerLogin);
  document.getElementById('loginCodigo').addEventListener('keydown', function (e) { if (e.key === 'Enter') hacerLogin(); });
  document.getElementById('btnLogout').addEventListener('click', function () { SESION = null; mostrarPantalla('pantallaLogin'); });

  document.getElementById('btnIrEntrega').addEventListener('click', abrirPantallaEntrega);
  document.getElementById('btnIrVerificacion').addEventListener('click', abrirPantallaVerificacionLista);
  document.getElementById('btnIrEvidencias').addEventListener('click', abrirPantallaEvidencias);

  document.querySelectorAll('[data-back]').forEach(function (btn) {
    btn.addEventListener('click', function () { mostrarPantalla(btn.getAttribute('data-back')); });
  });

  document.getElementById('ceBtnUbicacion').addEventListener('click', capturarUbicacionCampo);
  document.getElementById('ceBtnAgregarMaterial').addEventListener('click', agregarLineaMaterial);
  document.getElementById('ceArchivo').addEventListener('change', function (e) { leerArchivos(e, ARCHIVOS_ENTREGA, 'cePreview'); });
  document.getElementById('ceBtnGuardar').addEventListener('click', guardarEntregaCampo);

  document.getElementById('cvArchivo').addEventListener('change', function (e) { leerArchivos(e, ARCHIVOS_VERIFICACION, 'cvPreview'); });
  document.getElementById('cvBtnGuardar').addEventListener('click', guardarVerificacionCampo);

  document.querySelectorAll('[data-close]').forEach(function (btn) {
    btn.addEventListener('click', function () { document.getElementById(btn.getAttribute('data-close')).classList.remove('active'); });
  });
}

function mostrarPantalla(id) {
  document.querySelectorAll('.campo-screen').forEach(function (s) { s.classList.remove('active'); });
  document.getElementById(id).classList.add('active');
}

/* ============================================================
   LOGIN
   ============================================================ */
function hacerLogin() {
  var codigo = document.getElementById('loginCodigo').value;
  if (!codigo) { toast('Ingresa tu código de acceso.', 'warning'); return; }

  mostrarCargando('Verificando...');
  google.script.run.withSuccessHandler(function (sesion) {
    SESION = sesion;
    ocultarCargando();
    document.getElementById('menuNombre').textContent = sesion.nombre;
    var zonas = listaZonasSesion();
    var etiqueta = zonas.length === 0 ? 'Sin zona asignada'
      : (zonas.length === 1 ? 'Zona: ' + zonas[0].nombre
        : 'Zonas: ' + zonas.map(function (z) { return z.nombre; }).join(', '));
    document.getElementById('menuZona').textContent = etiqueta;
    mostrarPantalla('pantallaMenu');
  }).withFailureHandler(manejarError).iniciarSesionPorCodigo(codigo);
}

/* ============================================================
   ENTREGA (campo)
   ============================================================ */
function abrirPantallaEntrega() {
  document.getElementById('ceEntregaPunto').value = '';
  document.getElementById('ceEntregaDireccion').value = '';
  document.getElementById('ceObservaciones').value = '';
  document.getElementById('ceUbicacionInfo').innerHTML = '';
  document.getElementById('cePreview').innerHTML = '';
  document.getElementById('ceMaterialLineas').innerHTML = '';
  ARCHIVOS_ENTREGA = [];
  UBICACION_ENTREGA = null;
  LINEA_COUNT = 0;
  agregarLineaMaterial();

  var zonas = listaZonasSesion();
  var sel = document.getElementById('ceZona');
  sel.innerHTML = zonas.map(function (z) { return '<option value="' + z.id + '">' + escaparHtml(z.nombre) + '</option>'; }).join('');
  document.getElementById('ceZonaWrap').style.display = zonas.length > 1 ? '' : 'none';

  mostrarPantalla('pantallaEntrega');
}

function agregarLineaMaterial() {
  LINEA_COUNT++;
  var idx = LINEA_COUNT;
  var opciones = CATALOGOS.materiales.map(function (m) { return '<option value="' + m.ID + '">' + escaparHtml(m.NOMBRE) + '</option>'; }).join('');
  var div = document.createElement('div');
  div.className = 'material-line';
  div.id = 'ce-linea-' + idx;
  div.innerHTML =
    '<div class="field"><label>Material</label><select id="ce-mat-' + idx + '"><option value="">Selecciona...</option>' + opciones + '</select></div>' +
    '<div class="field"><label>Cantidad</label><input type="number" min="1" id="ce-cant-' + idx + '"></div>' +
    '<button class="icon-btn" onclick="document.getElementById(\'ce-linea-' + idx + '\').remove()">✕</button>';
  document.getElementById('ceMaterialLineas').appendChild(div);
}

function capturarUbicacionCampo() {
  if (!navigator.geolocation) { toast('Este navegador no soporta ubicación GPS.', 'warning'); return; }
  toast('Obteniendo tu ubicación...', 'info');
  navigator.geolocation.getCurrentPosition(function (pos) {
    var lat = pos.coords.latitude.toFixed(6), lng = pos.coords.longitude.toFixed(6);
    UBICACION_ENTREGA = { lat: lat, lng: lng };
    var url = 'https://www.google.com/maps?q=' + lat + ',' + lng;
    document.getElementById('ceUbicacionInfo').innerHTML = '📍 <a href="' + url + '" target="_blank" style="color:var(--choho-red);">Verificar ubicación en Maps</a>';
    toast('Ubicación capturada.', 'success');
  }, function (err) { toast('No se pudo obtener tu ubicación: ' + err.message, 'error'); }, { enableHighAccuracy: true, timeout: 10000 });
}

function guardarEntregaCampo() {
  var lineas = document.querySelectorAll('#ceMaterialLineas .material-line');
  var materiales = [];
  lineas.forEach(function (linea) {
    var sel = linea.querySelector('select'); var cant = linea.querySelector('input');
    if (sel.value && cant.value) materiales.push({ materialId: sel.value, cantidad: cant.value });
  });
  if (materiales.length === 0) { toast('Agrega al menos un material.', 'warning'); return; }

  var zonas = listaZonasSesion();
  var zonaId = SESION.zonaId, zonaNombre = SESION.zonaNombre;
  if (zonas.length > 1) {
    zonaId = document.getElementById('ceZona').value;
    var zsel = zonas.filter(function (z) { return z.id === zonaId; })[0];
    zonaNombre = zsel ? zsel.nombre : '';
  } else if (zonas.length === 1) {
    zonaId = zonas[0].id; zonaNombre = zonas[0].nombre;
  }
  ENTREGA_ZONA = { id: zonaId, nombre: zonaNombre };

  var data = {
    fechaEntrega: '',
    personaId: SESION.id,
    zonaId: zonaId,
    ciudad: SESION.ciudad,
    punto: document.getElementById('ceEntregaPunto').value,
    direccion: document.getElementById('ceEntregaDireccion').value,
    ubicacion: UBICACION_ENTREGA,
    observaciones: document.getElementById('ceObservaciones').value,
    materiales: materiales,
    nombreQuienRegistra: SESION.nombre
  };

  mostrarCargando('Guardando entrega...');
  google.script.run.withSuccessHandler(function (res) {
    subirFotosEntregaCampo(res.idEntrega, 0);
  }).withFailureHandler(manejarError).crearEntrega(data);
}

function subirFotosEntregaCampo(idEntrega, index) {
  if (index >= ARCHIVOS_ENTREGA.length) {
    ocultarCargando();
    toast('Entrega ' + idEntrega + ' registrada correctamente.', 'success');
    mostrarPantalla('pantallaMenu');
    return;
  }
  mostrarCargando('Subiendo foto ' + (index + 1) + ' de ' + ARCHIVOS_ENTREGA.length + '...');
  var zonaNombre = ENTREGA_ZONA ? ENTREGA_ZONA.nombre : SESION.zonaNombre;
  var contexto = { idEntrega: idEntrega, idVerificacion: '', materialId: null, etapa: 'entrega', zonaNombre: zonaNombre, nombreQuienRegistra: SESION.nombre };
  google.script.run
    .withSuccessHandler(function () { subirFotosEntregaCampo(idEntrega, index + 1); })
    .withFailureHandler(function (err) { toast('Una foto no se pudo subir: ' + err.message, 'error'); subirFotosEntregaCampo(idEntrega, index + 1); })
    .subirEvidencia(ARCHIVOS_ENTREGA[index], contexto);
}

/* ============================================================
   VERIFICACIÓN (campo)
   ============================================================ */
function abrirPantallaVerificacionLista() {
  mostrarCargando('Cargando pendientes...');
  google.script.run.withSuccessHandler(function (lista) {
    var zonas = zonasDeSesion();
    PENDIENTES_CACHE = lista.filter(function (e) { return zonas.indexOf(e.zonaId) > -1; });
    pintarPendientes();
    ocultarCargando();
    mostrarPantalla('pantallaVerificacionLista');
  }).withFailureHandler(manejarError).listarPendientesVerificacion();
}

function pintarPendientes() {
  var cont = document.getElementById('cvListaPendientes');
  if (PENDIENTES_CACHE.length === 0) {
    cont.innerHTML = '<div class="empty-state"><div class="ic">✔</div>No tienes material pendiente por verificar.</div>';
    return;
  }
  cont.innerHTML = PENDIENTES_CACHE.map(function (e) {
    var filas = e.materiales.filter(function (m) { return m.pendiente > 0; }).map(function (m) {
      return '<div class="rowline"><span>' + escaparHtml(m.materialNombre) + ' (' + m.instalado + '/' + m.entregado + ')</span>' +
        '<button class="btn btn-secondary btn-sm" onclick=\'abrirFormVerificacion("' + e.idEntrega + '","' + m.idDetalle + '",' + JSON.stringify(m.materialNombre) + ',' + JSON.stringify(e.zonaNombre || '') + ')\'>Verificar</button></div>';
    }).join('');
    return '<div class="card pending-card"><strong>' + e.idEntrega + '</strong> · ' + escaparHtml(e.punto || e.ciudad) + filas + '</div>';
  }).join('');
}

function abrirFormVerificacion(idEntrega, idDetalle, materialNombre, zonaNombre) {
  CONTEXTO_VERIFICACION = { idEntrega: idEntrega, idDetalle: idDetalle, materialNombre: materialNombre, zonaNombre: zonaNombre || '' };
  document.getElementById('cvMaterialTitulo').textContent = materialNombre + ' · ' + idEntrega;
  document.getElementById('cvCantidad').value = '';
  document.getElementById('cvObservaciones').value = '';
  document.getElementById('cvPreview').innerHTML = '';
  ARCHIVOS_VERIFICACION = [];
  mostrarPantalla('pantallaVerificacionForm');
}

function guardarVerificacionCampo() {
  var cantidad = document.getElementById('cvCantidad').value;
  if (cantidad === '') { toast('Indica la cantidad instalada.', 'warning'); return; }
  var data = {
    idEntrega: CONTEXTO_VERIFICACION.idEntrega,
    idDetalle: CONTEXTO_VERIFICACION.idDetalle,
    cantidadInstalada: cantidad,
    observaciones: document.getElementById('cvObservaciones').value,
    nombreQuienRegistra: SESION.nombre
  };
  mostrarCargando('Guardando verificación...');
  google.script.run.withSuccessHandler(function (res) {
    subirFotosVerificacionCampo(res.idVerificacion, 0);
  }).withFailureHandler(manejarError).registrarVerificacion(data);
}

function subirFotosVerificacionCampo(idVerificacion, index) {
  if (index >= ARCHIVOS_VERIFICACION.length) {
    ocultarCargando();
    toast('Verificación registrada correctamente.', 'success');
    abrirPantallaVerificacionLista();
    return;
  }
  mostrarCargando('Subiendo evidencia ' + (index + 1) + ' de ' + ARCHIVOS_VERIFICACION.length + '...');
  var contexto = { idEntrega: CONTEXTO_VERIFICACION.idEntrega, idVerificacion: idVerificacion, materialId: null, etapa: 'verificacion', zonaNombre: CONTEXTO_VERIFICACION.zonaNombre || SESION.zonaNombre, nombreQuienRegistra: SESION.nombre };
  google.script.run
    .withSuccessHandler(function () { subirFotosVerificacionCampo(idVerificacion, index + 1); })
    .withFailureHandler(function (err) { toast('Una evidencia no se pudo subir: ' + err.message, 'error'); subirFotosVerificacionCampo(idVerificacion, index + 1); })
    .subirEvidencia(ARCHIVOS_VERIFICACION[index], contexto);
}

/* ============================================================
   EVIDENCIAS (campo)
   ============================================================ */
function abrirPantallaEvidencias() {
  mostrarCargando('Cargando evidencias...');
  google.script.run.withSuccessHandler(function (todas) {
    var zonas = zonasDeSesion();
    var lista = todas.filter(function (ev) { return zonas.indexOf(ev.zonaId) > -1; });
    document.getElementById('ceGaleria').innerHTML = lista.map(function (ev) {
      var media = ev.tipo === 'imagen' ? '<img src="' + ev.url + '" loading="lazy">' : '<div class="video-thumb">🎬</div>';
      return '<div class="gallery-item" onclick=\'abrirMediaCampo(' + JSON.stringify(ev) + ')\'>' + media +
        '<div class="gallery-meta"><strong>' + escaparHtml(ev.materialNombre || '') + '</strong>' + escaparHtml(ev.zonaNombre || '') + '<br>' + escaparHtml(ev.fecha) + ' ' + escaparHtml(ev.hora) + '</div></div>';
    }).join('') || '<div class="empty-state" style="grid-column:1/-1;">Todavía no hay evidencias.</div>';
    ocultarCargando();
    mostrarPantalla('pantallaEvidencias');
  }).withFailureHandler(manejarError).listarEvidencias({});
}

function abrirMediaCampo(ev) {
  var body = ev.tipo === 'imagen'
    ? '<img src="' + ev.url + '" style="width:100%;border-radius:10px;">'
    : '<video src="' + ev.url + '" controls style="width:100%;border-radius:10px;"></video>';
  var ubic;
  if (ev.ubicacionUrl) {
    ubic = '<a href="' + ev.ubicacionUrl + '" target="_blank" style="color:var(--choho-red);">📍 Ver en Google Maps</a>';
  } else if (ev.latitud && ev.longitud) {
    ubic = '<a href="https://www.google.com/maps?q=' + ev.latitud + ',' + ev.longitud + '" target="_blank" style="color:var(--choho-red);">📍 Ver en Google Maps</a>';
  } else {
    ubic = '<span style="color:var(--text-faint);">Sin ubicación GPS</span>';
  }
  body += '<div style="margin-top:14px;font-size:13px;line-height:1.7;">' +
    '<div><strong>Material:</strong> ' + escaparHtml(ev.materialNombre || '—') + '</div>' +
    '<div><strong>Zona:</strong> ' + escaparHtml(ev.zonaNombre || '—') + '</div>' +
    '<div><strong>Punto / dirección:</strong> ' + escaparHtml(ev.punto || ev.direccion || '—') + '</div>' +
    '<div><strong>Fecha:</strong> ' + escaparHtml(ev.fecha) + ' ' + escaparHtml(ev.hora) + '</div>' +
    '<div><strong>Ubicación:</strong> ' + ubic + '</div>' +
    '</div>';
  document.getElementById('modalMediaBody').innerHTML = body;
  document.getElementById('modalMedia').classList.add('active');
}

/* ============================================================
   UTILIDADES
   ============================================================ */
function leerArchivos(e, destino, idPreview) {
  var files = Array.from(e.target.files || []);
  files.forEach(function (file) {
    var reader = new FileReader();
    reader.onload = function (ev) {
      destino.push({ base64: ev.target.result, nombreArchivo: file.name, mimeType: file.type });
      var esImagen = file.type.indexOf('image') === 0;
      var thumb = document.createElement(esImagen ? 'img' : 'div');
      if (esImagen) { thumb.src = ev.target.result; } else { thumb.className = 'vid'; thumb.textContent = '🎬'; thumb.style.display = 'flex'; thumb.style.alignItems = 'center'; thumb.style.justifyContent = 'center'; }
      document.getElementById(idPreview).appendChild(thumb);
    };
    reader.readAsDataURL(file);
  });
}

function toast(mensaje, tipo) {
  tipo = tipo || 'info';
  var iconos = { success: '✓', error: '⚠', warning: '⚠', info: 'ℹ' };
  var el = document.createElement('div');
  el.className = 'toast ' + tipo;
  el.innerHTML = '<span>' + iconos[tipo] + '</span><span>' + escaparHtml(mensaje) + '</span>';
  document.getElementById('toast-container').appendChild(el);
  setTimeout(function () { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(function () { el.remove(); }, 300); }, 4200);
}
function mostrarCargando(texto) { document.getElementById('overlayLoadingText').textContent = texto || 'Procesando...'; document.getElementById('overlayLoading').classList.add('active'); }
function ocultarCargando() { document.getElementById('overlayLoading').classList.remove('active'); }
function manejarError(err) { ocultarCargando(); toast((err && err.message) ? err.message : String(err), 'error'); }
function escaparHtml(str) { var div = document.createElement('div'); div.textContent = (str === undefined || str === null) ? '' : String(str); return div.innerHTML; }
