/* ============================================================
   ESTADO GLOBAL
   ============================================================ */
var STATE = {
  usuario: null,
  catalogos: { zonas: [], personas: [], materiales: [] },
  entregas: [],
  paginaEntregas: 1,
  filasPorPagina: 10,
  materialLineaCount: 0,
  verificarContexto: null,  // {idEntrega, idDetalle, materialNombre, zonaNombre}
  archivosEvidenciaPendientes: [], // [{base64, nombreArchivo, mimeType}]
  archivosEntregaPendientes: [],   // fotos del material entregado (se suben con etapa "entrega")
  ubicacionEntrega: null           // {lat, lng}
};

var ESTADO_BADGE_CLASS = {
  'Pendiente': 'badge-pendiente',
  'Entregado': 'badge-entregado',
  'Parcialmente verificado': 'badge-parcial',
  'Verificado': 'badge-verificado',
  'Cerrado': 'badge-cerrado',
  'Completa': 'badge-completa',
  'Parcial': 'badge-parcial',
  'Sin evidencia': 'badge-sinevidencia'
};

/* ============================================================
   SESIÓN / PERMISOS
   ============================================================ */
var SESION = null; // {id, nombre, rol, permisos:[...], zonaId, zonaNombre, ciudad}
var VISTAS_INFO = {
  dashboard: 'Dashboard',
  entregas: 'Entregas',
  verificacion: 'Verificación POP',
  materiales: 'Material POP',
  personas: 'Personas encargadas',
  zonas: 'Zonas',
  evidencias: 'Evidencias',
  reportes: 'Reportes',
  configuracion: 'Configuración'
};
var ORDEN_VISTAS = ['dashboard', 'entregas', 'verificacion', 'materiales', 'personas', 'zonas', 'evidencias', 'reportes', 'configuracion'];

/* ============================================================
   ARRANQUE
   ============================================================ */
document.addEventListener('DOMContentLoaded', function () {
  configurarNavegacion();
  configurarModales();
  configurarFormularios();
  configurarLogin();
});

function configurarLogin() {
  document.getElementById('btnAdminLogin').addEventListener('click', hacerLoginAdmin);
  document.getElementById('adminLoginCodigo').addEventListener('keydown', function (e) { if (e.key === 'Enter') hacerLoginAdmin(); });
  document.getElementById('btnLogout').addEventListener('click', cerrarSesion);
}

function hacerLoginAdmin() {
  var codigo = document.getElementById('adminLoginCodigo').value;
  if (!codigo) { toast('Ingresa tu código de acceso.', 'warning'); return; }
  mostrarCargando('Verificando...');
  google.script.run.withSuccessHandler(function (sesion) {
    SESION = sesion;
    iniciarApp();
  }).withFailureHandler(manejarError).iniciarSesionPorCodigo(codigo);
}

function iniciarApp() {
  var primera = primeraVistaPermitida();
  if (!primera) {
    ocultarCargando();
    toast('Tu usuario no tiene secciones asignadas. Para registrar en campo usa el enlace /campo, o pide acceso a un administrador.', 'warning');
    SESION = null;
    return;
  }
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  pintarUsuario();
  aplicarPermisos();
  google.script.run.withSuccessHandler(function (datos) {
    STATE.catalogos = datos.catalogos;
    poblarSelectsCatalogos();
    irAVista(primera);
    ocultarCargando();
  }).withFailureHandler(manejarError).obtenerDatosIniciales();
}

function cerrarSesion() {
  SESION = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('adminLoginCodigo').value = '';
  document.getElementById('loginScreen').style.display = 'flex';
}

function puedeVer(vista) { return !!(SESION && SESION.permisos && SESION.permisos.indexOf(vista) > -1); }
function primeraVistaPermitida() {
  for (var i = 0; i < ORDEN_VISTAS.length; i++) { if (puedeVer(ORDEN_VISTAS[i])) return ORDEN_VISTAS[i]; }
  return '';
}
function aplicarPermisos() {
  document.querySelectorAll('.nav-item[data-view]').forEach(function (item) {
    item.style.display = puedeVer(item.getAttribute('data-view')) ? '' : 'none';
  });
}

function pintarUsuario() {
  var label = (SESION && SESION.nombre) ? SESION.nombre : '—';
  document.getElementById('userLabel').textContent = label + (SESION && SESION.rol ? ' · ' + SESION.rol : '');
  document.getElementById('userAvatar').textContent = label.charAt(0).toUpperCase();
}

/* ============================================================
   NAVEGACIÓN / SPA
   ============================================================ */
var TITULOS = {
  dashboard: ['Dashboard', 'Vista general del cumplimiento de material POP'],
  entregas: ['Entregas', 'Registro y seguimiento de entregas de material POP'],
  verificacion: ['Verificación POP', 'Confirma qué material fue realmente instalado'],
  materiales: ['Material POP', 'Catálogo de material promocional'],
  personas: ['Personas encargadas', 'Administra las personas responsables por zona'],
  zonas: ['Zonas', 'Cobertura geográfica de CHOHO Colombia'],
  evidencias: ['Evidencias', 'Fotografías y videos de instalación'],
  reportes: ['Reportes', 'Cumplimiento agregado por zona, persona, ciudad o material'],
  configuracion: ['Configuración', 'Información del sistema']
};

function configurarNavegacion() {
  document.querySelectorAll('.nav-item[data-view]').forEach(function (item) {
    item.addEventListener('click', function () {
      irAVista(item.getAttribute('data-view'));
      document.getElementById('sidebar').classList.remove('open');
    });
  });
  document.getElementById('btnHamburger').addEventListener('click', function () {
    document.getElementById('sidebar').classList.toggle('open');
  });
}

function irAVista(nombre) {
  document.querySelectorAll('.nav-item[data-view]').forEach(function (i) {
    i.classList.toggle('active', i.getAttribute('data-view') === nombre);
  });
  document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
  document.getElementById('view-' + nombre).classList.add('active');
  document.getElementById('pageTitle').textContent = TITULOS[nombre][0];
  document.getElementById('pageSub').textContent = TITULOS[nombre][1];

  if (nombre === 'dashboard') cargarDashboard();
  if (nombre === 'entregas') cargarEntregas();
  if (nombre === 'verificacion') cargarVerificacion();
  if (nombre === 'materiales') cargarMateriales();
  if (nombre === 'personas') cargarPersonas();
  if (nombre === 'zonas') cargarZonas();
  if (nombre === 'evidencias') cargarEvidencias();
  if (nombre === 'reportes') generarReporteUI();
  if (nombre === 'configuracion') cargarUsuarios();
}

/* ============================================================
   UTILIDADES: TOASTS, LOADING, ERRORES, MODALES
   ============================================================ */
function toast(mensaje, tipo) {
  tipo = tipo || 'info';
  var iconos = { success: '✓', error: '⚠', warning: '⚠', info: 'ℹ' };
  var el = document.createElement('div');
  el.className = 'toast ' + tipo;
  el.innerHTML = '<span>' + iconos[tipo] + '</span><span>' + escaparHtml(mensaje) + '</span>';
  document.getElementById('toast-container').appendChild(el);
  setTimeout(function () {
    el.style.opacity = '0';
    el.style.transition = 'opacity .3s';
    setTimeout(function () { el.remove(); }, 300);
  }, 4200);
}

function mostrarCargando(texto) {
  document.getElementById('overlayLoadingText').textContent = texto || 'Procesando...';
  document.getElementById('overlayLoading').classList.add('active');
}
function ocultarCargando() {
  document.getElementById('overlayLoading').classList.remove('active');
}

function manejarError(err) {
  ocultarCargando();
  var msg = (err && err.message) ? err.message : String(err);
  toast(msg, 'error');
}

function escaparHtml(str) {
  var div = document.createElement('div');
  div.textContent = (str === undefined || str === null) ? '' : String(str);
  return div.innerHTML;
}

function configurarModales() {
  document.querySelectorAll('[data-close]').forEach(function (btn) {
    btn.addEventListener('click', function () { cerrarModal(btn.getAttribute('data-close')); });
  });
  document.querySelectorAll('.modal-backdrop').forEach(function (backdrop) {
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) cerrarModal(backdrop.id);
    });
  });
}
function abrirModal(id) { document.getElementById(id).classList.add('active'); }
function cerrarModal(id) { document.getElementById(id).classList.remove('active'); }

function badgeHtml(estado) {
  var cls = ESTADO_BADGE_CLASS[estado] || 'badge-pendiente';
  return '<span class="badge ' + cls + '"><span class="badge-dot"></span>' + escaparHtml(estado) + '</span>';
}

/* ============================================================
   CATÁLOGOS EN SELECTS
   ============================================================ */
function poblarSelectsCatalogos() {
  var zonas = STATE.catalogos.zonas;
  var personas = STATE.catalogos.personas;
  var materiales = STATE.catalogos.materiales;

  llenarSelect('entregaZona', zonas, 'ID', 'NOMBRE', 'Selecciona una zona');
  llenarSelect('entregaPersona', personas, 'ID', 'NOMBRE', 'Selecciona una persona');

  llenarSelect('filtroZonaEntregas', zonas, 'ID', 'NOMBRE', 'Todas las zonas', true);
  llenarSelect('filtroPersonaEntregas', personas, 'ID', 'NOMBRE', 'Todas las personas', true);
  llenarSelect('filtroZonaEvidencias', zonas, 'ID', 'NOMBRE', 'Todas las zonas', true);
  llenarSelect('filtroPersonaEvidencias', personas, 'ID', 'NOMBRE', 'Todas las personas', true);
  llenarSelect('filtroMaterialEvidencias', materiales, 'ID', 'NOMBRE', 'Todos los materiales', true);
  llenarSelect('reporteFiltroZona', zonas, 'ID', 'NOMBRE', 'Todas las zonas', true);

  document.getElementById('entregaFecha').value = new Date().toISOString().slice(0, 10);
}

function llenarSelect(id, lista, campoValor, campoTexto, placeholder, mantenerVacio) {
  var select = document.getElementById(id);
  if (!select) return;
  var actual = select.value;
  select.innerHTML = '';
  if (placeholder) {
    var opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = placeholder;
    select.appendChild(opt0);
  }
  lista.forEach(function (item) {
    var opt = document.createElement('option');
    opt.value = item[campoValor];
    opt.textContent = item[campoTexto];
    select.appendChild(opt);
  });
  if (actual) select.value = actual;
}

function nombreZona(id) {
  var z = STATE.catalogos.zonas.filter(function (x) { return x.ID === id; })[0];
  return z ? z.NOMBRE : id;
}
function nombrePersona(id) {
  var p = STATE.catalogos.personas.filter(function (x) { return x.ID === id; })[0];
  return p ? p.NOMBRE : id;
}
function nombresZonas(zonasStr) {
  if (!zonasStr) return '—';
  var nombres = String(zonasStr).split(',').map(function (id) { return nombreZona(id.trim()); }).filter(Boolean);
  return nombres.length ? nombres.join(', ') : '—';
}

/* ============================================================
   DASHBOARD
   ============================================================ */
var charts = {};

function cargarDashboard() {
  google.script.run
    .withSuccessHandler(pintarDashboard)
    .withFailureHandler(manejarError)
    .obtenerDashboard(false);
}

function pintarDashboard(data) {
  // Alertas
  var alertasHtml = data.alertas.map(function (a) {
    return '<div class="alert"><span class="ic">⚠</span><span>' + escaparHtml(a) + '</span></div>';
  }).join('');
  document.getElementById('alertasContainer').innerHTML = alertasHtml;

  // KPIs
  var k = data.tarjetas;
  var kpis = [
    { label: 'Total material entregado', value: k.totalEntregado, cls: 'accent-blue' },
    { label: 'Material instalado', value: k.totalInstalado, cls: 'accent-green' },
    { label: 'Material pendiente', value: k.totalPendiente, cls: 'accent-amber' },
    { label: '% de cumplimiento', value: k.cumplimiento + '%', cls: 'accent-red' },
    { label: 'Personas encargadas', value: k.personasEncargadas, cls: '' },
    { label: 'Zonas activas', value: k.zonas, cls: '' },
    { label: 'Evidencias registradas', value: k.evidencias, cls: '' }
  ];
  document.getElementById('kpiGrid').innerHTML = kpis.map(function (c) {
    return '<div class="kpi-card ' + c.cls + '"><div class="label">' + c.label + '</div><div class="value">' + c.value + '</div></div>';
  }).join('');

  // Gráfico 1: entregado vs instalado
  renderChart('chartEntregadoInstalado', 'bar', {
    labels: ['Entregado', 'Instalado', 'Pendiente'],
    datasets: [{
      data: [data.graficos.entregadoVsInstalado.entregado, data.graficos.entregadoVsInstalado.instalado, data.graficos.entregadoVsInstalado.pendiente],
      backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b'],
      borderRadius: 6
    }]
  }, { plugins: { legend: { display: false } } });

  // Cumplimiento por zona (barras horizontales custom con CSS)
  document.getElementById('zoneBars').innerHTML = data.graficos.cumplimientoPorZona.map(function (z) {
    return '<div class="zone-bar-row"><div class="zone-name">' + escaparHtml(z.zona) + '</div>' +
      '<div class="zone-bar-track"><div class="zone-bar-fill" style="width:' + Math.min(z.cumplimiento, 100) + '%"></div></div>' +
      '<div class="zone-bar-pct">' + z.cumplimiento + '%</div></div>';
  }).join('') || '<div class="empty-state">Sin datos de zonas todavía.</div>';

  // Gráfico 3: material por tipo
  renderChart('chartMaterialTipo', 'bar', {
    labels: data.graficos.materialPorTipo.map(function (m) { return m.material; }),
    datasets: [{ data: data.graficos.materialPorTipo.map(function (m) { return m.cantidad; }), backgroundColor: '#e11d2e', borderRadius: 6 }]
  }, { indexAxis: 'y', plugins: { legend: { display: false } } });

  // Gráfico 4: estado general
  var eg = data.graficos.estadoGeneral;
  renderChart('chartEstadoGeneral', 'doughnut', {
    labels: Object.keys(eg),
    datasets: [{ data: Object.keys(eg).map(function (k) { return eg[k]; }), backgroundColor: ['#22c55e', '#f59e0b', '#94a3b8', '#e11d2e'] }]
  }, {});

  // Entregas recientes
  document.getElementById('tbodyEntregasRecientes').innerHTML = data.entregasRecientes.map(function (e) {
    return '<tr><td>' + e.idEntrega + '</td><td>' + escaparHtml(e.personaNombre) + '</td><td>' + escaparHtml(e.zonaNombre) + '</td><td>' + badgeHtml(e.estado) + '</td></tr>';
  }).join('') || '<tr><td colspan="4"><div class="empty-state">Sin entregas registradas.</div></td></tr>';

  // Galería reciente
  document.getElementById('galeriaReciente').innerHTML = renderGaleria(data.evidenciasRecientes, true) ||
    '<div class="empty-state">Aún no hay evidencias.</div>';
}

function renderChart(canvasId, type, data, extraOptions) {
  var ctx = document.getElementById(canvasId).getContext('2d');
  if (charts[canvasId]) charts[canvasId].destroy();
  var baseOptions = {
    responsive: true,
    color: '#9aa1b1',
    scales: (type === 'doughnut') ? {} : {
      x: { ticks: { color: '#9aa1b1' }, grid: { color: '#262b38' } },
      y: { ticks: { color: '#9aa1b1' }, grid: { color: '#262b38' } }
    },
    plugins: { legend: { labels: { color: '#9aa1b1' } } }
  };
  charts[canvasId] = new Chart(ctx, { type: type, data: data, options: Object.assign(baseOptions, extraOptions) });
}

/* ============================================================
   ENTREGAS
   ============================================================ */
function obtenerFiltrosEntregas() {
  return {
    zonaId: document.getElementById('filtroZonaEntregas').value,
    personaId: document.getElementById('filtroPersonaEntregas').value,
    estado: document.getElementById('filtroEstadoEntregas').value,
    fechaDesde: document.getElementById('filtroFechaDesde').value,
    fechaHasta: document.getElementById('filtroFechaHasta').value
  };
}

function cargarEntregas() {
  mostrarCargando('Cargando entregas...');
  google.script.run
    .withSuccessHandler(function (lista) {
      STATE.entregas = lista;
      STATE.paginaEntregas = 1;
      pintarTablaEntregas();
      ocultarCargando();
    })
    .withFailureHandler(manejarError)
    .listarEntregas(obtenerFiltrosEntregas());
}

function pintarTablaEntregas() {
  var texto = (document.getElementById('buscarEntregas').value || '').toLowerCase();
  var filtradas = STATE.entregas.filter(function (e) {
    if (!texto) return true;
    return (e.personaNombre + ' ' + e.zonaNombre + ' ' + e.punto).toLowerCase().indexOf(texto) > -1;
  });

  var totalPaginas = Math.max(1, Math.ceil(filtradas.length / STATE.filasPorPagina));
  STATE.paginaEntregas = Math.min(STATE.paginaEntregas, totalPaginas);
  var inicio = (STATE.paginaEntregas - 1) * STATE.filasPorPagina;
  var pagina = filtradas.slice(inicio, inicio + STATE.filasPorPagina);

  document.getElementById('tbodyEntregas').innerHTML = pagina.map(function (e) {
    return '<tr>' +
      '<td>' + e.idEntrega + '</td><td>' + e.fecha + '</td><td>' + escaparHtml(e.personaNombre) + '</td>' +
      '<td>' + escaparHtml(e.zonaNombre) + '</td><td>' + escaparHtml(e.ciudad) + '</td><td>' + escaparHtml(e.punto) + '</td>' +
      '<td>' + e.entregado + '</td><td>' + e.instalado + '</td><td>' + e.pendiente + '</td>' +
      '<td>' + badgeHtml(e.estado) + '</td><td>' + escaparHtml(e.registradoPor) + '</td>' +
      '<td class="row-actions">' +
      '<button class="icon-btn" title="Ver" onclick="verEntrega(\'' + e.idEntrega + '\')">👁</button>' +
      '<button class="icon-btn" title="Verificar" onclick="abrirVerificacionDesdeEntrega(\'' + e.idEntrega + '\')">✔</button>' +
      '</td></tr>';
  }).join('') || '<tr><td colspan="12"><div class="empty-state"><div class="ic">📦</div>No hay entregas que coincidan con los filtros.</div></td></tr>';

  document.getElementById('paginacionEntregas').innerHTML =
    'Página ' + STATE.paginaEntregas + ' de ' + totalPaginas + ' &nbsp; (' + filtradas.length + ' resultados)' +
    ' <button class="btn btn-ghost btn-sm" onclick="cambiarPaginaEntregas(-1)">‹</button>' +
    ' <button class="btn btn-ghost btn-sm" onclick="cambiarPaginaEntregas(1)">›</button>';
}
function cambiarPaginaEntregas(delta) { STATE.paginaEntregas += delta; pintarTablaEntregas(); }

function verEntrega(idEntrega) {
  var e = STATE.entregas.filter(function (x) { return x.idEntrega === idEntrega; })[0];
  if (!e) return;
  document.getElementById('detalleTitulo').textContent = 'Entrega ' + e.idEntrega + ' · ' + e.personaNombre;
  var filas = e.materiales.map(function (m) {
    return '<tr><td>' + escaparHtml(m.materialNombre) + '</td><td>' + m.entregado + '</td><td>' + m.instalado + '</td><td>' + m.pendiente + '</td>' +
      '<td><button class="btn btn-secondary btn-sm" onclick="abrirVerificacion(\'' + e.idEntrega + '\',\'' + m.idDetalle + '\',\'' + escaparHtml(m.materialNombre).replace(/'/g, "\\'") + '\')">Registrar verificación</button></td></tr>';
  }).join('');
  var direccionHtml = escaparHtml(e.direccion || '—');
  if (e.ubicacionUrl) {
    direccionHtml += ' · <a href="' + e.ubicacionUrl + '" target="_blank" style="color:var(--choho-red);">📍 Ver ubicación en Maps</a>';
  }

  document.getElementById('detalleBody').innerHTML =
    '<div class="form-grid" style="margin-bottom:16px;">' +
    campoInfo('Zona', e.zonaNombre) + campoInfo('Ciudad', e.ciudad) + campoInfo('Punto', e.punto) +
    '<div class="field full"><label>Dirección / ubicación</label><div style="padding-top:4px;">' + direccionHtml + '</div></div>' +
    campoInfo('Registrado por', e.registradoPor) + campoInfo('Fecha', e.fecha) +
    campoInfo('Estado', e.estado) + campoInfo('Observaciones', e.observaciones || '—') +
    '</div>' +
    '<div class="table-wrap"><table><thead><tr><th>Material</th><th>Entregado</th><th>Instalado</th><th>Pendiente</th><th></th></tr></thead>' +
    '<tbody>' + filas + '</tbody></table></div>' +
    '<h4 style="margin:18px 0 10px;">Fotos y videos de esta entrega</h4>' +
    '<div class="gallery-grid" id="galeriaDetalleEntrega"><div class="empty-state" style="grid-column:1/-1;">Cargando...</div></div>';
  abrirModal('modalVerDetalle');

  google.script.run.withSuccessHandler(function (evidencias) {
    document.getElementById('galeriaDetalleEntrega').innerHTML = renderGaleria(evidencias, false) ||
      '<div class="empty-state" style="grid-column:1/-1;">Todavía no hay fotos ni videos para esta entrega.</div>';
  }).withFailureHandler(manejarError).listarEvidenciasPorEntrega(idEntrega);
}
function campoInfo(label, valor) {
  return '<div class="field"><label>' + label + '</label><div style="padding-top:4px;">' + escaparHtml(valor || '—') + '</div></div>';
}

function abrirVerificacionDesdeEntrega(idEntrega) { verEntrega(idEntrega); }

/* ---------- Modal Nueva Entrega ---------- */
function configurarFormularios() {
  document.getElementById('btnNuevaEntrega').addEventListener('click', function () {
    document.getElementById('materialLineas').innerHTML = '';
    STATE.materialLineaCount = 0;
    agregarLineaMaterial();
    document.getElementById('entregaFecha').value = new Date().toISOString().slice(0, 10);
    document.getElementById('entregaRegistradoPor').value = SESION ? SESION.nombre : '';
    ['entregaPersona', 'entregaZona', 'entregaCiudad', 'entregaPunto', 'entregaDireccion', 'entregaObservaciones', 'entregaLat', 'entregaLng'].forEach(function (id) {
      document.getElementById(id).value = '';
    });
    document.getElementById('entregaUbicacionInfo').innerHTML = '';
    document.getElementById('entregaPreview').innerHTML = '';
    STATE.ubicacionEntrega = null;
    STATE.archivosEntregaPendientes = [];
    abrirModal('modalEntrega');
  });

  document.getElementById('entregaPersona').addEventListener('change', function () {
    var id = this.value;
    if (!id) return;
    google.script.run.withSuccessHandler(function (datos) {
      if (!datos) return;
      document.getElementById('entregaZona').value = datos.zonaId;
      document.getElementById('entregaCiudad').value = datos.ciudad || '';
    }).withFailureHandler(manejarError).obtenerDatosPersona(id);
  });

  // Al elegir primero la zona, autocompleta la persona encargada de esa zona (y luego su ciudad).
  document.getElementById('entregaZona').addEventListener('change', function () {
    var zonaId = this.value;
    if (!zonaId) return;
    google.script.run.withSuccessHandler(function (persona) {
      if (!persona) { toast('Esa zona todavía no tiene una persona encargada asignada.', 'warning'); return; }
      document.getElementById('entregaPersona').value = persona.id;
      document.getElementById('entregaCiudad').value = persona.ciudad || '';
    }).withFailureHandler(manejarError).obtenerPersonaPorZona(zonaId);
  });

  document.getElementById('btnUsarUbicacion').addEventListener('click', function () { capturarUbicacion('entrega'); });
  document.getElementById('entregaArchivo').addEventListener('change', function (e) {
    manejarArchivosGenericos(e, STATE.archivosEntregaPendientes, 'entregaPreview');
  });

  document.getElementById('btnAgregarMaterial').addEventListener('click', agregarLineaMaterial);
  document.getElementById('btnGuardarEntrega').addEventListener('click', guardarEntrega);

  document.getElementById('buscarEntregas').addEventListener('input', pintarTablaEntregas);
  document.getElementById('btnLimpiarFiltrosEntregas').addEventListener('click', function () {
    ['filtroZonaEntregas', 'filtroPersonaEntregas', 'filtroEstadoEntregas', 'filtroFechaDesde', 'filtroFechaHasta'].forEach(function (id) {
      document.getElementById(id).value = '';
    });
    cargarEntregas();
  });
  ['filtroZonaEntregas', 'filtroPersonaEntregas', 'filtroEstadoEntregas', 'filtroFechaDesde', 'filtroFechaHasta'].forEach(function (id) {
    document.getElementById(id).addEventListener('change', cargarEntregas);
  });
  document.getElementById('btnExportarEntregas').addEventListener('click', function () {
    mostrarCargando('Generando archivo...');
    google.script.run.withSuccessHandler(function (archivo) { descargarBase64(archivo); ocultarCargando(); toast('Exportación lista.', 'success'); })
      .withFailureHandler(manejarError).exportarEntregasCSV(obtenerFiltrosEntregas());
  });

  document.getElementById('btnRefrescarVerificacion').addEventListener('click', cargarVerificacion);
  document.getElementById('btnGuardarVerificacion').addEventListener('click', guardarVerificacion);
  document.getElementById('verificarArchivo').addEventListener('change', manejarArchivosSeleccionados);

  document.getElementById('btnNuevaZona').addEventListener('click', function () { abrirModalZona(null); });
  document.getElementById('btnGuardarZona').addEventListener('click', guardarZonaForm);
  document.getElementById('btnNuevaPersona').addEventListener('click', function () { abrirModalPersona(null); });
  document.getElementById('btnNuevoUsuario').addEventListener('click', function () { abrirModalPersona(null); });
  document.getElementById('btnGuardarPersona').addEventListener('click', guardarPersonaForm);
  document.getElementById('btnNuevoMaterial').addEventListener('click', function () { abrirModalMaterial(null); });
  document.getElementById('btnGuardarMaterial').addEventListener('click', guardarMaterialForm);
  document.getElementById('btnGenerarCodigo').addEventListener('click', function () {
    document.getElementById('personaCodigoAcceso').value = 'CHOHO' + Math.floor(1000 + Math.random() * 9000);
  });

  ['filtroZonaEvidencias', 'filtroPersonaEvidencias', 'filtroMaterialEvidencias', 'filtroTipoEvidencias', 'filtroEtapaEvidencias'].forEach(function (id) {
    document.getElementById(id).addEventListener('change', cargarEvidencias);
  });

  document.getElementById('btnGenerarReporte').addEventListener('click', generarReporteUI);
  document.getElementById('btnExportarReporteExcel').addEventListener('click', function () {
    mostrarCargando('Generando archivo...');
    var agrupar = document.getElementById('reporteAgruparPor').value;
    var filtros = { zonaId: document.getElementById('reporteFiltroZona').value };
    google.script.run.withSuccessHandler(function (archivo) { descargarBase64(archivo); ocultarCargando(); toast('Exportación lista.', 'success'); })
      .withFailureHandler(manejarError).exportarReporteCSV(agrupar, filtros);
  });
  document.getElementById('btnExportarReportePDF').addEventListener('click', function () { window.print(); });
}

function agregarLineaMaterial() {
  STATE.materialLineaCount++;
  var idx = STATE.materialLineaCount;
  var div = document.createElement('div');
  div.className = 'material-line';
  div.id = 'linea-' + idx;
  var opciones = STATE.catalogos.materiales.map(function (m) { return '<option value="' + m.ID + '">' + escaparHtml(m.NOMBRE) + '</option>'; }).join('');
  div.innerHTML =
    '<div class="field"><label>Material</label><select id="materialSel-' + idx + '"><option value="">Selecciona...</option>' + opciones + '</select></div>' +
    '<div class="field"><label>Cantidad</label><input type="number" min="1" id="materialCant-' + idx + '"></div>' +
    '<button class="icon-btn" title="Quitar" onclick="document.getElementById(\'linea-' + idx + '\').remove()">✕</button>';
  document.getElementById('materialLineas').appendChild(div);
}

function guardarEntrega() {
  var lineas = document.querySelectorAll('#materialLineas .material-line');
  var materiales = [];
  lineas.forEach(function (linea) {
    var sel = linea.querySelector('select');
    var cant = linea.querySelector('input');
    if (sel.value && cant.value) materiales.push({ materialId: sel.value, cantidad: cant.value });
  });

  var data = {
    fechaEntrega: document.getElementById('entregaFecha').value,
    personaId: document.getElementById('entregaPersona').value,
    zonaId: document.getElementById('entregaZona').value,
    ciudad: document.getElementById('entregaCiudad').value,
    punto: document.getElementById('entregaPunto').value,
    direccion: document.getElementById('entregaDireccion').value,
    ubicacion: STATE.ubicacionEntrega,
    observaciones: document.getElementById('entregaObservaciones').value,
    materiales: materiales,
    nombreQuienRegistra: document.getElementById('entregaRegistradoPor').value
  };

  mostrarCargando('Guardando entrega...');
  google.script.run
    .withSuccessHandler(function (res) {
      subirFotosMaterialEntregado(res.idEntrega, document.getElementById('entregaZona').selectedOptions[0] ? document.getElementById('entregaZona').selectedOptions[0].textContent : '', document.getElementById('entregaRegistradoPor').value, 0);
    })
    .withFailureHandler(manejarError)
    .crearEntrega(data);
}

function subirFotosMaterialEntregado(idEntrega, zonaNombre, registradoPor, index) {
  var archivos = STATE.archivosEntregaPendientes;
  if (index >= archivos.length) {
    ocultarCargando();
    cerrarModal('modalEntrega');
    toast('Entrega ' + idEntrega + ' registrada correctamente.', 'success');
    cargarEntregas();
    cargarDashboard();
    return;
  }
  mostrarCargando('Subiendo foto ' + (index + 1) + ' de ' + archivos.length + '...');
  var contexto = { idEntrega: idEntrega, idVerificacion: '', materialId: null, etapa: 'entrega', zonaNombre: zonaNombre, nombreQuienRegistra: registradoPor };
  google.script.run
    .withSuccessHandler(function () { subirFotosMaterialEntregado(idEntrega, zonaNombre, registradoPor, index + 1); })
    .withFailureHandler(function (err) { toast('Una foto no se pudo subir: ' + err.message, 'error'); subirFotosMaterialEntregado(idEntrega, zonaNombre, registradoPor, index + 1); })
    .subirEvidencia(archivos[index], contexto);
}

/* ============================================================
   VERIFICACIÓN POP
   ============================================================ */
function cargarVerificacion() {
  mostrarCargando('Cargando pendientes...');
  google.script.run
    .withSuccessHandler(function (lista) {
      pintarVerificacion(lista);
      ocultarCargando();
    })
    .withFailureHandler(manejarError)
    .listarPendientesVerificacion();
}

function pintarVerificacion(lista) {
  var cont = document.getElementById('listaVerificacion');
  if (lista.length === 0) {
    cont.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="ic">✔</div>Todo el material entregado ya fue verificado.</div>';
    return;
  }
  cont.innerHTML = lista.map(function (e) {
    var filasMaterial = e.materiales.map(function (m) {
      return '<tr><td>' + escaparHtml(m.materialNombre) + '</td><td>' + m.entregado + '</td><td>' + m.instalado + '</td><td>' + m.pendiente + '</td>' +
        '<td><button class="btn btn-secondary btn-sm" onclick="abrirVerificacion(\'' + e.idEntrega + '\',\'' + m.idDetalle + '\',\'' + escaparHtml(m.materialNombre).replace(/'/g, "\\'") + '\')">Verificar</button></td></tr>';
    }).join('');
    return '<div class="card">' +
      '<div class="card-header"><div class="card-title">' + e.idEntrega + '<div class="muted">' + escaparHtml(e.personaNombre) + ' · ' + escaparHtml(e.zonaNombre) + '</div></div>' + badgeHtml(e.estado) + '</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Material</th><th>Ent.</th><th>Inst.</th><th>Pend.</th><th></th></tr></thead><tbody>' + filasMaterial + '</tbody></table></div>' +
      '<div style="margin-top:10px;text-align:right;"><button class="btn btn-secondary btn-sm" onclick="verFotosEntrega(\'' + e.idEntrega + '\')">🖼 Ver evidencias</button></div>' +
      '</div>';
  }).join('');
}

/** Muestra en un modal las fotos/videos de una entrega (usado desde Verificación POP). */
function verFotosEntrega(idEntrega) {
  mostrarCargando('Cargando evidencias...');
  google.script.run.withSuccessHandler(function (evid) {
    var galeria = renderGaleria(evid, false) ||
      '<div class="empty-state" style="grid-column:1/-1;">Todavía no hay fotos ni videos para esta entrega.</div>';
    document.getElementById('modalMediaBody').innerHTML = '<div class="gallery-grid">' + galeria + '</div>';
    var titulo = document.querySelector('#modalMedia .modal-title');
    if (titulo) titulo.textContent = 'Evidencias · ' + idEntrega;
    ocultarCargando();
    abrirModal('modalMedia');
  }).withFailureHandler(manejarError).listarEvidenciasPorEntrega(idEntrega);
}

function abrirVerificacion(idEntrega, idDetalle, materialNombre) {
  var entrega = STATE.entregas.filter(function (x) { return x.idEntrega === idEntrega; })[0];
  var zonaNombre = entrega ? entrega.zonaNombre : '';
  STATE.verificarContexto = { idEntrega: idEntrega, idDetalle: idDetalle, materialNombre: materialNombre, zonaNombre: zonaNombre };
  document.getElementById('verificarMaterialLabel').textContent = 'Material: ' + materialNombre + ' (Entrega ' + idEntrega + ')';
  document.getElementById('verificarCantidad').value = '';
  document.getElementById('verificarObservaciones').value = '';
  document.getElementById('verificarRegistradoPor').value = SESION ? SESION.nombre : '';
  document.getElementById('verificarPreview').innerHTML = '';
  STATE.archivosEvidenciaPendientes = [];
  abrirModal('modalVerificar');
}

function manejarArchivosSeleccionados(e) {
  manejarArchivosGenericos(e, STATE.archivosEvidenciaPendientes, 'verificarPreview');
}

/** Lee los archivos elegidos (foto/video), los guarda como base64 en memoria y pinta una miniatura. */
function manejarArchivosGenericos(e, listaDestino, idContenedorPreview) {
  var files = Array.from(e.target.files || []);
  files.forEach(function (file) {
    var reader = new FileReader();
    reader.onload = function (ev) {
      listaDestino.push({ base64: ev.target.result, nombreArchivo: file.name, mimeType: file.type });
      var esImagen = file.type.indexOf('image') === 0;
      var thumb = document.createElement(esImagen ? 'img' : 'div');
      if (esImagen) { thumb.src = ev.target.result; } else { thumb.className = 'vid'; thumb.textContent = '🎬'; thumb.style.display = 'flex'; thumb.style.alignItems = 'center'; thumb.style.justifyContent = 'center'; }
      document.getElementById(idContenedorPreview).appendChild(thumb);
    };
    reader.readAsDataURL(file);
  });
}

/** Captura la ubicación GPS del dispositivo y la guarda como enlace de Google Maps. */
function capturarUbicacion(destino) {
  if (!navigator.geolocation) { toast('Este navegador no soporta ubicación GPS.', 'warning'); return; }
  toast('Obteniendo tu ubicación...', 'info');
  navigator.geolocation.getCurrentPosition(function (pos) {
    var lat = pos.coords.latitude.toFixed(6);
    var lng = pos.coords.longitude.toFixed(6);
    var url = 'https://www.google.com/maps?q=' + lat + ',' + lng;
    if (destino === 'entrega') {
      STATE.ubicacionEntrega = { lat: lat, lng: lng };
      document.getElementById('entregaLat').value = lat;
      document.getElementById('entregaLng').value = lng;
      document.getElementById('entregaUbicacionInfo').innerHTML = '📍 Ubicación capturada: <a href="' + url + '" target="_blank" style="color:var(--choho-red);">Verificar ubicación en Maps</a>';
    }
    toast('Ubicación capturada correctamente.', 'success');
  }, function (err) {
    toast('No se pudo obtener tu ubicación: ' + err.message, 'error');
  }, { enableHighAccuracy: true, timeout: 10000 });
}

function guardarVerificacion() {
  var ctx = STATE.verificarContexto;
  if (!ctx) return;
  var cantidad = document.getElementById('verificarCantidad').value;
  if (cantidad === '') { toast('Debes indicar la cantidad instalada.', 'warning'); return; }

  var data = {
    idEntrega: ctx.idEntrega,
    idDetalle: ctx.idDetalle,
    cantidadInstalada: cantidad,
    observaciones: document.getElementById('verificarObservaciones').value,
    nombreQuienRegistra: document.getElementById('verificarRegistradoPor').value
  };

  mostrarCargando('Guardando verificación...');
  google.script.run
    .withSuccessHandler(function (res) {
      subirEvidenciasPendientes(res.idVerificacion, ctx, 0);
    })
    .withFailureHandler(manejarError)
    .registrarVerificacion(data);
}

function subirEvidenciasPendientes(idVerificacion, ctx, index) {
  var archivos = STATE.archivosEvidenciaPendientes;
  if (index >= archivos.length) {
    ocultarCargando();
    cerrarModal('modalVerificar');
    toast('Verificación actualizada correctamente.', 'success');
    cargarVerificacion();
    cargarEntregas();
    cargarDashboard();
    return;
  }
  mostrarCargando('Subiendo evidencia ' + (index + 1) + ' de ' + archivos.length + '...');
  var archivo = archivos[index];
  var contexto = {
    idEntrega: ctx.idEntrega,
    idVerificacion: idVerificacion,
    materialId: null,
    zonaNombre: ctx.zonaNombre,
    nombreQuienRegistra: document.getElementById('verificarRegistradoPor').value
  };
  google.script.run
    .withSuccessHandler(function () { subirEvidenciasPendientes(idVerificacion, ctx, index + 1); })
    .withFailureHandler(function (err) { toast('Una evidencia no se pudo subir: ' + err.message, 'error'); subirEvidenciasPendientes(idVerificacion, ctx, index + 1); })
    .subirEvidencia(archivo, contexto);
}

/* ============================================================
   ZONAS
   ============================================================ */
function cargarZonas() {
  mostrarCargando('Cargando zonas...');
  google.script.run.withSuccessHandler(function (lista) {
    STATE.catalogos.zonas = lista;
    poblarSelectsCatalogos();
    document.getElementById('tbodyZonas').innerHTML = lista.map(function (z) {
      return '<tr><td>' + z.ID + '</td><td>' + escaparHtml(z.NOMBRE) + '</td><td>' + escaparHtml(z.REGION) + '</td><td>' + escaparHtml(z.CIUDAD_PRINCIPAL) + '</td><td>' + escaparHtml(z.RESPONSABLE) + '</td><td>' + badgeHtml(z.ESTADO === 'Activa' ? 'Verificado' : 'Cerrado') + ' ' + escaparHtml(z.ESTADO) + '</td>' +
        '<td class="row-actions"><button class="icon-btn" onclick=\'abrirModalZona(' + JSON.stringify(z) + ')\'>✎</button></td></tr>';
    }).join('') || '<tr><td colspan="7"><div class="empty-state">No hay zonas registradas.</div></td></tr>';
    ocultarCargando();
  }).withFailureHandler(manejarError).listarZonas();
}
function abrirModalZona(z) {
  document.getElementById('zonaId').value = z ? z.ID : '';
  document.getElementById('zonaNombre').value = z ? z.NOMBRE : '';
  document.getElementById('zonaRegion').value = z ? z.REGION : '';
  document.getElementById('zonaCiudad').value = z ? z.CIUDAD_PRINCIPAL : '';
  document.getElementById('zonaResponsable').value = z ? z.RESPONSABLE : '';
  document.getElementById('zonaEstado').value = z ? z.ESTADO : 'Activa';
  abrirModal('modalZona');
}
function guardarZonaForm() {
  var zona = {
    ID: document.getElementById('zonaId').value || undefined,
    NOMBRE: document.getElementById('zonaNombre').value,
    REGION: document.getElementById('zonaRegion').value,
    CIUDAD_PRINCIPAL: document.getElementById('zonaCiudad').value,
    RESPONSABLE: document.getElementById('zonaResponsable').value,
    ESTADO: document.getElementById('zonaEstado').value
  };
  mostrarCargando('Guardando zona...');
  google.script.run.withSuccessHandler(function () {
    ocultarCargando(); cerrarModal('modalZona'); toast('Zona guardada correctamente.', 'success'); cargarZonas();
  }).withFailureHandler(manejarError).guardarZona(zona, '');
}

/* ============================================================
   PERSONAS
   ============================================================ */
function cargarPersonas() {
  mostrarCargando('Cargando personas...');
  google.script.run.withSuccessHandler(function (lista) {
    STATE.catalogos.personas = lista;
    poblarSelectsCatalogos();
    document.getElementById('tbodyPersonas').innerHTML = lista.map(function (p) {
      return '<tr><td>' + p.ID + '</td><td>' + escaparHtml(p.NOMBRE) + '</td><td>' + escaparHtml(nombresZonas(p.ZONAS || p.ZONA_ID)) + '</td><td>' + escaparHtml(p.CIUDAD) + '</td><td>' + escaparHtml(p.TELEFONO) + '</td><td>' + escaparHtml(p.CARGO) + '</td><td>' + escaparHtml(p.ESTADO) + '</td>' +
        '<td class="row-actions"><button class="icon-btn" onclick=\'abrirModalPersona(' + JSON.stringify(p) + ')\'>✎</button></td></tr>';
    }).join('') || '<tr><td colspan="8"><div class="empty-state">No hay personas registradas.</div></td></tr>';
    ocultarCargando();
  }).withFailureHandler(manejarError).listarPersonas();
}
function abrirModalPersona(p) {
  document.getElementById('personaId').value = p ? p.ID : '';
  document.getElementById('personaNombre').value = p ? p.NOMBRE : '';
  document.getElementById('personaTelefono').value = p ? p.TELEFONO : '';
  document.getElementById('personaCorreo').value = p ? p.CORREO : '';
  var zonasSel = p ? (p.ZONAS ? p.ZONAS.split(',') : (p.ZONA_ID ? [p.ZONA_ID] : [])).map(function (s) { return s.trim(); }).filter(Boolean) : [];
  pintarZonasChecks(zonasSel);
  document.getElementById('personaCiudad').value = p ? p.CIUDAD : '';
  document.getElementById('personaCargo').value = p ? p.CARGO : '';
  document.getElementById('personaEstado').value = p ? p.ESTADO : 'Activo';
  document.getElementById('personaObservaciones').value = p ? p.OBSERVACIONES : '';
  document.getElementById('personaCodigoAcceso').value = p ? (p.CODIGO_ACCESO || '') : '';
  document.getElementById('personaRol').value = p ? (p.ROL || 'Encargado') : 'Encargado';
  var permisos = (p && p.PERMISOS) ? p.PERMISOS.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];
  pintarPermisosChecks(permisos);
  abrirModal('modalPersona');
}
function pintarPermisosChecks(seleccionados) {
  document.getElementById('permisosChecks').innerHTML = ORDEN_VISTAS.map(function (v) {
    var checked = seleccionados.indexOf(v) > -1 ? 'checked' : '';
    return '<label><input type="checkbox" value="' + v + '" ' + checked + '>' + VISTAS_INFO[v] + '</label>';
  }).join('');
}
function pintarZonasChecks(seleccionadas) {
  var zonas = STATE.catalogos.zonas || [];
  document.getElementById('personaZonasChecks').innerHTML = zonas.map(function (z) {
    var checked = seleccionadas.indexOf(z.ID) > -1 ? 'checked' : '';
    return '<label><input type="checkbox" value="' + z.ID + '" ' + checked + '>' + escaparHtml(z.NOMBRE) + '</label>';
  }).join('') || '<div style="color:var(--text-faint);font-size:12px;">No hay zonas registradas. Crea zonas primero.</div>';
}
function guardarPersonaForm() {
  var permisosSel = Array.prototype.slice.call(document.querySelectorAll('#permisosChecks input:checked'))
    .map(function (c) { return c.value; });
  var persona = {
    ID: document.getElementById('personaId').value || undefined,
    NOMBRE: document.getElementById('personaNombre').value,
    TELEFONO: document.getElementById('personaTelefono').value,
    CORREO: document.getElementById('personaCorreo').value,
    ZONAS: Array.prototype.slice.call(document.querySelectorAll('#personaZonasChecks input:checked')).map(function (c) { return c.value; }).join(','),
    CIUDAD: document.getElementById('personaCiudad').value,
    CARGO: document.getElementById('personaCargo').value,
    ESTADO: document.getElementById('personaEstado').value,
    OBSERVACIONES: document.getElementById('personaObservaciones').value,
    CODIGO_ACCESO: document.getElementById('personaCodigoAcceso').value.trim(),
    ROL: document.getElementById('personaRol').value,
    PERMISOS: permisosSel.join(',')
  };
  mostrarCargando('Guardando usuario...');
  google.script.run.withSuccessHandler(function () {
    ocultarCargando(); cerrarModal('modalPersona'); toast('Usuario guardado correctamente.', 'success');
    cargarPersonas();
    if (document.getElementById('view-configuracion').classList.contains('active')) cargarUsuarios();
  }).withFailureHandler(manejarError).guardarPersona(persona, '');
}

/* ============================================================
   USUARIOS Y ACCESOS (Configuración)
   ============================================================ */
function cargarUsuarios() {
  mostrarCargando('Cargando usuarios...');
  google.script.run.withSuccessHandler(function (lista) {
    STATE.catalogos.personas = lista.filter(function (p) { return p.ESTADO !== 'Inactivo'; });
    document.getElementById('tbodyUsuarios').innerHTML = lista.map(function (p) {
      var secciones = (p.ROL === 'Administrador')
        ? 'Todas'
        : (p.PERMISOS ? p.PERMISOS.split(',').filter(Boolean).length + ' secciones' : '—');
      var codigo = p.CODIGO_ACCESO ? escaparHtml(p.CODIGO_ACCESO) : '<span style="color:var(--text-faint);">Sin código</span>';
      return '<tr><td>' + escaparHtml(p.NOMBRE) + '</td><td>' + escaparHtml(p.ROL || 'Encargado') + '</td><td>' + codigo + '</td>' +
        '<td>' + escaparHtml(nombresZonas(p.ZONAS || p.ZONA_ID)) + '</td><td>' + secciones + '</td><td>' + escaparHtml(p.ESTADO) + '</td>' +
        '<td class="row-actions">' +
        '<button class="icon-btn" title="Editar" onclick=\'abrirModalPersona(' + JSON.stringify(p) + ')\'>✎</button>' +
        '<button class="icon-btn" title="Eliminar" onclick="eliminarUsuario(\'' + p.ID + '\',' + JSON.stringify(p.NOMBRE) + ')">🗑</button>' +
        '</td></tr>';
    }).join('') || '<tr><td colspan="7"><div class="empty-state">No hay usuarios registrados.</div></td></tr>';
    ocultarCargando();
  }).withFailureHandler(manejarError).listarPersonas();
}

function eliminarUsuario(id, nombre) {
  if (!window.confirm('¿Eliminar al usuario "' + nombre + '"? Esta acción no se puede deshacer.')) return;
  mostrarCargando('Eliminando usuario...');
  google.script.run.withSuccessHandler(function () {
    ocultarCargando(); toast('Usuario eliminado.', 'success'); cargarUsuarios(); cargarPersonas();
  }).withFailureHandler(manejarError).eliminarPersona(id);
}

/* ============================================================
   MATERIALES
   ============================================================ */
function cargarMateriales() {
  mostrarCargando('Cargando materiales...');
  google.script.run.withSuccessHandler(function (lista) {
    STATE.catalogos.materiales = lista;
    poblarSelectsCatalogos();
    document.getElementById('tbodyMateriales').innerHTML = lista.map(function (m) {
      return '<tr><td>' + m.ID + '</td><td>' + escaparHtml(m.NOMBRE) + '</td><td>' + escaparHtml(m.CATEGORIA) + '</td><td>' + escaparHtml(m.UNIDAD) + '</td><td>' + escaparHtml(m.ESTADO) + '</td>' +
        '<td class="row-actions"><button class="icon-btn" onclick=\'abrirModalMaterial(' + JSON.stringify(m) + ')\'>✎</button></td></tr>';
    }).join('') || '<tr><td colspan="6"><div class="empty-state">No hay materiales registrados.</div></td></tr>';
    ocultarCargando();
  }).withFailureHandler(manejarError).listarMateriales();
}
function abrirModalMaterial(m) {
  document.getElementById('materialId').value = m ? m.ID : '';
  document.getElementById('materialNombre').value = m ? m.NOMBRE : '';
  document.getElementById('materialCategoria').value = m ? m.CATEGORIA : '';
  document.getElementById('materialUnidad').value = m ? m.UNIDAD : 'Unidad';
  document.getElementById('materialEstado').value = m ? m.ESTADO : 'Activo';
  document.getElementById('materialDescripcion').value = m ? m.DESCRIPCION : '';
  abrirModal('modalMaterial');
}
function guardarMaterialForm() {
  var material = {
    ID: document.getElementById('materialId').value || undefined,
    NOMBRE: document.getElementById('materialNombre').value,
    CATEGORIA: document.getElementById('materialCategoria').value,
    UNIDAD: document.getElementById('materialUnidad').value,
    ESTADO: document.getElementById('materialEstado').value,
    DESCRIPCION: document.getElementById('materialDescripcion').value
  };
  mostrarCargando('Guardando material...');
  google.script.run.withSuccessHandler(function () {
    ocultarCargando(); cerrarModal('modalMaterial'); toast('Material guardado correctamente.', 'success'); cargarMateriales();
  }).withFailureHandler(manejarError).guardarMaterial(material, '');
}

/* ============================================================
   EVIDENCIAS
   ============================================================ */
function cargarEvidencias() {
  var filtros = {
    zonaId: document.getElementById('filtroZonaEvidencias').value,
    personaId: document.getElementById('filtroPersonaEvidencias').value,
    materialId: document.getElementById('filtroMaterialEvidencias').value,
    tipo: document.getElementById('filtroTipoEvidencias').value,
    etapa: document.getElementById('filtroEtapaEvidencias').value
  };
  mostrarCargando('Cargando evidencias...');
  google.script.run.withSuccessHandler(function (lista) {
    document.getElementById('galeriaEvidencias').innerHTML = renderGaleria(lista, false) ||
      '<div class="empty-state" style="grid-column:1/-1;"><div class="ic">🖼</div>No hay evidencias que coincidan con los filtros.</div>';
    ocultarCargando();
  }).withFailureHandler(manejarError).listarEvidencias(filtros);
}

function renderGaleria(lista, compacto) {
  if (!lista || lista.length === 0) return '';
  return lista.map(function (ev, i) {
    var media = ev.tipo === 'imagen'
      ? '<img src="' + ev.url + '" loading="lazy">'
      : '<div class="video-thumb">🎬</div>';
    var meta = compacto
      ? '<div class="gallery-meta"><strong>' + escaparHtml(ev.zonaNombre || '') + '</strong>' + escaparHtml(ev.fecha) + '</div>'
      : '<div class="gallery-meta"><strong>' + escaparHtml(ev.materialNombre || '') + '</strong>' + escaparHtml(ev.personaNombre) + ' · ' + escaparHtml(ev.zonaNombre) + '<br>' + escaparHtml(ev.fecha) + ' ' + escaparHtml(ev.hora) + '</div>';
    return '<div class="gallery-item" onclick=\'abrirMedia(' + JSON.stringify(ev) + ')\'>' + media + meta + '</div>';
  }).join('');
}

function abrirMedia(ev) {
  var body = ev.tipo === 'imagen'
    ? '<img src="' + ev.url + '" style="width:100%;border-radius:10px;">'
    : '<video src="' + ev.url + '" controls style="width:100%;border-radius:10px;"></video>';
  body += '<div class="form-grid" style="margin-top:16px;">' +
    campoInfo('Zona', ev.zonaNombre) + campoInfo('Persona', ev.personaNombre) +
    campoInfo('Material', ev.materialNombre) + campoInfo('Fecha', ev.fecha + ' ' + ev.hora) +
    campoInfo('Registrado por', ev.registradoPor) + campoInfo('Entrega', ev.idEntrega) +
    campoInfo('Punto / dirección', ev.punto || ev.direccion || '—') +
    '<div class="field"><label>Ubicación</label><div style="padding-top:4px;">' + campoUbicacionHtml(ev) + '</div></div>' +
    '</div>';
  if (SESION && SESION.rol === 'Administrador' && ev.idEvidencia) {
    body += '<div style="margin-top:16px;text-align:right;">' +
      '<button class="btn btn-secondary btn-sm" style="border-color:var(--choho-red);color:#fca5a5;" onclick="eliminarEvidenciaUI(' + JSON.stringify(ev.idEvidencia) + ')">🗑 Eliminar evidencia</button></div>';
  }
  document.getElementById('modalMediaBody').innerHTML = body;
  abrirModal('modalMedia');
}

/** Elimina una evidencia (solo administradores) y refresca la vista activa. */
function eliminarEvidenciaUI(idEvidencia) {
  if (!window.confirm('¿Eliminar esta evidencia? La foto/video se borrará de forma permanente.')) return;
  mostrarCargando('Eliminando evidencia...');
  google.script.run.withSuccessHandler(function () {
    ocultarCargando();
    cerrarModal('modalMedia');
    toast('Evidencia eliminada.', 'success');
    if (document.getElementById('view-evidencias').classList.contains('active')) cargarEvidencias();
    if (document.getElementById('view-dashboard').classList.contains('active')) cargarDashboard();
  }).withFailureHandler(manejarError).eliminarEvidencia(idEvidencia);
}

/** Devuelve el enlace de ubicación (Maps) de una evidencia, o un guion si no hay. */
function campoUbicacionHtml(ev) {
  if (ev.ubicacionUrl) {
    return '<a href="' + ev.ubicacionUrl + '" target="_blank" style="color:var(--choho-red);">📍 Ver en Google Maps</a>';
  }
  if (ev.latitud && ev.longitud) {
    var u = 'https://www.google.com/maps?q=' + ev.latitud + ',' + ev.longitud;
    return '<a href="' + u + '" target="_blank" style="color:var(--choho-red);">📍 Ver en Google Maps</a>';
  }
  return '<span style="color:var(--text-faint);">Sin ubicación GPS</span>';
}

/* ============================================================
   REPORTES
   ============================================================ */
function generarReporteUI() {
  var agrupar = document.getElementById('reporteAgruparPor').value;
  var filtros = { zonaId: document.getElementById('reporteFiltroZona').value };
  mostrarCargando('Generando reporte...');
  google.script.run.withSuccessHandler(function (reporte) {
    document.getElementById('tbodyReporte').innerHTML = reporte.filas.map(function (f) {
      return '<tr><td>' + escaparHtml(f.grupo) + '</td><td>' + f.entregado + '</td><td>' + f.instalado + '</td><td>' + f.pendiente + '</td><td>' + f.cumplimiento + '%</td></tr>';
    }).join('') || '<tr><td colspan="5"><div class="empty-state">Sin datos para este reporte.</div></td></tr>';
    ocultarCargando();
  }).withFailureHandler(manejarError).generarReporte(agrupar, filtros);
}

/* ============================================================
   DESCARGA DE ARCHIVOS (CSV/Excel)
   ============================================================ */
function descargarBase64(archivo) {
  var byteChars = atob(archivo.base64);
  var byteNumbers = new Array(byteChars.length);
  for (var i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  var blob = new Blob([new Uint8Array(byteNumbers)], { type: archivo.mimeType });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = archivo.nombreArchivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
