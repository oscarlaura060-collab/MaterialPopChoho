/**
 * Genera el informe en UN SOLO archivo .html, autónomo e interactivo:
 * dashboard, pestañas, filtros que se tocan, gráficos con detalle al pasar
 * el dedo y ficha de cada evento sin tener que bajar y bajar.
 *
 * No usa internet ni librerías: los datos van incrustados como JSON y todo
 * se dibuja con JavaScript y SVG dentro del propio archivo.
 */
import { fechaCorta, fechaLarga } from "@/lib/format";
import type { EventoVista, Gasto, MaterialPop, Participacion, Resultado } from "@/lib/types";
import type { Registro } from "./archivos";
import { leerAnexo } from "./archivos";

const EXT_IMAGEN = /\.(jpe?g|png|gif|webp|bmp|avif|heic|heif)$/i;
const pareceImagen = (f: File) =>
  f.type ? f.type.startsWith("image/") : EXT_IMAGEN.test(f.name);

/** Reduce la foto para que el archivo no crezca sin control */
async function miniatura(f: File, ladoMax = 1280, calidad = 0.72): Promise<string | null> {
  if (!pareceImagen(f)) return null;
  try {
    const bmp = await createImageBitmap(f);
    const escala = Math.min(1, ladoMax / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * escala));
    const h = Math.max(1, Math.round(bmp.height * escala));
    const lienzo = document.createElement("canvas");
    lienzo.width = w; lienzo.height = h;
    lienzo.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    return lienzo.toDataURL("image/jpeg", calidad);
  } catch {
    return null;
  }
}

export interface OpcionesInforme {
  incluirFotos: boolean;
  titulo?: string;
}

interface Fuente {
  eventos: EventoVista[];
  material: MaterialPop[];
  gastos: Gasto[];
  participacion: Participacion[];
  resultados: Resultado[];
  anexos: Registro[];
}

export async function generarInforme(
  f: Fuente, op: OpcionesInforme
): Promise<{ html: string; nombre: string; fotos: number }> {
  const ids = new Set<unknown>(f.eventos.map((e) => e.id));

  // ---- fotografías incrustadas ----
  const fotos = new Map<string, string>();
  if (op.incluirFotos) {
    for (const a of f.anexos) {
      if (!ids.has(a.evento_id)) continue;
      const arch = await leerAnexo(String(a.storage_path));
      if (!arch) continue;
      const d = await miniatura(arch);
      if (d) fotos.set(String(a.id), d);
    }
  }

  // ---- un solo objeto con todo lo que el informe necesita ----
  const eventos = f.eventos
    .slice()
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .map((e) => ({
      id: String(e.id),
      codigo: e.codigo,
      nombre: e.nombre,
      fecha: e.fecha,
      fechaTexto: fechaCorta(e.fecha),
      fechaLarga: fechaLarga(e.fecha),
      dia: e.dia,
      anio: e.anio,
      mes: e.mes,
      ciudad: e.ciudad ?? "",
      lugar: e.lugar_negocio ?? "",
      direccion: e.direccion ?? "",
      cliente: e.cliente ?? "",
      tipo: e.tipo_evento ?? "",
      responsable: e.responsable ?? "",
      estado: e.estado,
      asistentesEsp: e.asistentes_esperados,
      asistentes: e.asistentes,
      clientes: e.clientes_atendidos,
      observaciones: e.observaciones ?? "",
      gastoPop: e.gasto_pop,
      valorLlevado: e.pop_valor_llevado,
      gastosAdic: e.gastos_adicionales,
      gastoTotal: e.gasto_total,
      popLlevado: e.pop_llevado,
      popUtilizado: e.pop_utilizado,
      popSobrante: e.pop_sobrante,
      personal: e.personal_asignado,
      asistieron: e.asistieron,
      material: f.material.filter((m) => m.evento_id === e.id).map((m) => ({
        material: m.material,
        llevada: m.cantidad_llevada,
        utilizada: m.cantidad_utilizada,
        sobrante: m.cantidad_sobrante,
        pct: m.pct_utilizacion,
        costo: m.costo_unitario,
        gasto: m.gasto_material,
        valorLlevado: m.valor_llevado,
      })),
      gastos: f.gastos.filter((g) => g.evento_id === e.id).map((g) => ({
        categoria: g.categoria ?? "OTROS",
        descripcion: g.descripcion ?? "",
        proveedor: g.proveedor ?? "",
        responsable: g.responsable ?? "",
        valor: g.valor,
      })),
      equipo: f.participacion.filter((p) => p.evento_id === e.id).map((p) => ({
        nombre: p.persona_nombre,
        rol: p.rol_funcion ?? "",
        confirmado: p.confirmado,
        asistio: p.asistio,
        ingreso: p.hora_ingreso ? p.hora_ingreso.slice(0, 5) : "",
        salida: p.hora_salida ? p.hora_salida.slice(0, 5) : "",
        horas: p.horas,
      })),
      resultado: (() => {
        const r = f.resultados.find((x) => x.evento_id === e.id);
        return r ? {
          comercial: r.resultado_comercial ?? "",
          observaciones: r.observaciones ?? "",
          aprendizajes: r.aprendizajes ?? "",
        } : null;
      })(),
      fotos: f.anexos
        .filter((a) => a.evento_id === e.id && fotos.has(String(a.id)))
        .map((a) => ({ nombre: String(a.nombre), src: fotos.get(String(a.id))! })),
    }));

  const titulo = op.titulo || "Informe de eventos";
  const rango = eventos.length
    ? (() => {
        const fs = eventos.map((e) => e.fecha).sort();
        return fs[0] === fs[fs.length - 1]
          ? fechaCorta(fs[0])
          : `${fechaCorta(fs[0])} — ${fechaCorta(fs[fs.length - 1])}`;
      })()
    : "—";

  const datos = { titulo, rango, generado: fechaCorta(new Date().toISOString()), eventos };
  const json = JSON.stringify(datos).replace(/<\/script/gi, "<\\/script");

  const html = PLANTILLA.replace("__TITULO__", escaparHtml(titulo)).replace("__DATOS__", json);

  return {
    html,
    nombre: `CHOHO-Informe-${new Date().toISOString().slice(0, 10)}.html`,
    fotos: fotos.size,
  };
}

const escaparHtml = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
   .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/* ============================================================
   La página: estilos + aplicación, todo dentro del mismo archivo
   ============================================================ */

const PLANTILLA = String.raw`<!doctype html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>CHOHO · __TITULO__</title>
<style>
*{box-sizing:border-box}
:root{
  --rojo:#d0342c; --rojo-claro:#fdeceb; --negro:#141414;
  --s1:#d0342c; --s2:#2a78d6; --s3:#eda100; --s4:#1baf7a; --gris:#c9c6c2;
  --fondo:#f4f4f3; --sup:#fff; --linea:#e3e2e0;
  --t1:#141414; --t2:#55534f; --t3:#8a8783;
}
html,body{margin:0;padding:0}
body{background:var(--fondo);color:var(--t1);
  font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  -webkit-text-size-adjust:100%;-webkit-font-smoothing:antialiased}
button{font:inherit;color:inherit;cursor:pointer;border:0;background:none}
table{border-collapse:collapse}

/* ---------- cabecera ---------- */
.top{position:sticky;top:0;z-index:30;background:var(--negro);color:#fff;
  border-bottom:3px solid var(--rojo)}
.top .w{display:flex;align-items:center;gap:12px;padding:12px 16px;max-width:1200px;margin:0 auto}
.logo{width:32px;height:32px;border-radius:8px;background:var(--rojo);color:#fff;
  font-weight:900;font-size:12px;display:grid;place-items:center;flex:0 0 auto}
.top h1{margin:0;font-size:15px;font-weight:800;letter-spacing:-.01em;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.top .meta{font-size:11px;color:#9a9a9a;margin:1px 0 0}
.top .der{margin-left:auto;display:flex;gap:6px;align-items:center}
.ico{width:34px;height:34px;border-radius:8px;display:grid;place-items:center;
  font-size:15px;background:rgba(255,255,255,.1)}
.ico:hover{background:rgba(255,255,255,.2)}

/* ---------- pestañas ---------- */
nav.tabs{background:var(--negro);overflow-x:auto;-webkit-overflow-scrolling:touch;
  scrollbar-width:none}
nav.tabs::-webkit-scrollbar{display:none}
nav.tabs .w{display:flex;gap:2px;padding:0 12px 8px;max-width:1200px;margin:0 auto}
.tab{padding:7px 13px;border-radius:8px;font-size:13px;font-weight:600;
  color:#b5b5b5;white-space:nowrap}
.tab:hover{background:rgba(255,255,255,.1);color:#fff}
.tab[aria-selected="true"]{background:var(--rojo);color:#fff}

/* ---------- filtros ---------- */
.filtros{background:var(--sup);border-bottom:1px solid var(--linea);
  position:sticky;top:0;z-index:20}
.filtros .w{max-width:1200px;margin:0 auto;padding:10px 16px}
.buscar{width:100%;padding:8px 12px;border-radius:8px;border:1px solid var(--linea);
  font-size:14px;background:var(--fondo)}
.buscar:focus{outline:2px solid var(--rojo);outline-offset:-1px}
.chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.chip{padding:5px 11px;border-radius:99px;font-size:12px;font-weight:600;
  background:var(--fondo);color:var(--t2);border:1px solid var(--linea)}
.chip:hover{border-color:var(--t3)}
.chip[aria-pressed="true"]{background:var(--rojo);color:#fff;border-color:var(--rojo)}
.chip.limpiar{background:transparent;border-style:dashed}
.grupo-f{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px}
.grupo-f>b{font-size:10px;text-transform:uppercase;letter-spacing:.1em;
  color:var(--t3);margin-right:2px}

/* ---------- contenido ---------- */
main{max-width:1200px;margin:0 auto;padding:16px 16px 60px}
.card{background:var(--sup);border:1px solid var(--linea);border-radius:12px}
.card-p{padding:16px}
h2.sec{margin:0 0 10px;font-size:14px;font-weight:800}
h3.sub{margin:0;font-size:13px;font-weight:700}
.apoyo{font-size:11px;color:var(--t3);margin:2px 0 0}

/* tarjetas de indicador */
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(142px,1fr));gap:10px}
.k{background:var(--sup);border:1px solid var(--linea);border-radius:12px;
  padding:12px 14px;text-align:left;width:100%}
.k.click:hover{border-color:var(--rojo);box-shadow:0 2px 10px rgba(208,52,44,.12)}
.k .e{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.11em;
  color:var(--t3);display:block}
.k .v{font-size:22px;font-weight:900;letter-spacing:-.02em;margin-top:4px;
  font-variant-numeric:tabular-nums;display:block}
.k .v.rojo{color:var(--rojo)}
.k .a{font-size:11px;color:var(--t3);margin-top:2px;display:block}

.rejilla{display:grid;gap:12px;margin-top:12px}
.rejilla>*{min-width:0}
@media(min-width:900px){.rejilla.dos{grid-template-columns:1fr 1fr}}

/* gráficos */
.gr{position:relative}
.gr-top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:10px}
.vertabla{font-size:11px;font-weight:600;color:var(--t3);padding:3px 7px;border-radius:6px}
.vertabla:hover{background:var(--fondo);color:var(--t1)}
.barras{display:flex;flex-direction:column;gap:7px}
.fila-b{display:grid;grid-template-columns:minmax(72px,26%) 1fr auto;gap:9px;
  align-items:center;text-align:left;width:100%;padding:2px 0;border-radius:6px}
.fila-b:hover{background:var(--fondo)}
.fila-b[aria-pressed="true"]{background:var(--rojo-claro)}
.fila-b .n{font-size:12px;color:var(--t2);overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap}
.pista{height:10px;border-radius:5px;background:var(--fondo);overflow:hidden;display:flex}
.pista i{display:block;height:100%}
.pista i+i{border-left:2px solid var(--sup)}
.fila-b .v{font-size:12px;font-weight:700;font-variant-numeric:tabular-nums;
  white-space:nowrap}
.leyenda{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:10px}
.leyenda span{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--t2)}
.leyenda i{width:10px;height:10px;border-radius:3px;display:block}

/* tablas */
.tw{overflow-x:auto;-webkit-overflow-scrolling:touch}
table.t{width:100%;font-size:13px;min-width:440px}
table.t th,table.t td{padding:8px 10px;border-bottom:1px solid #f0efed;text-align:left}
table.t thead th{background:#faf9f8;font-size:10px;text-transform:uppercase;
  letter-spacing:.08em;color:var(--t3);position:sticky;top:0}
table.t .n{text-align:right;font-variant-numeric:tabular-nums}
table.t tfoot td,table.t tfoot th{background:#faf9f8;font-weight:800;
  border-top:2px solid var(--linea);border-bottom:0}
table.t tbody tr.click{cursor:pointer}
table.t tbody tr.click:hover{background:var(--fondo)}

/* lista de eventos + detalle */
.dosp{display:grid;gap:12px}
/* Sin esto, las columnas de la rejilla se estiran al ancho de las tablas
   y la página entera se desborda en celular. */
.dosp>*{min-width:0}
@media(min-width:920px){.dosp{grid-template-columns:320px 1fr;align-items:start}
  .lista{position:sticky;top:120px;max-height:calc(100vh - 140px);overflow-y:auto}}
.ev-b{display:block;width:100%;text-align:left;padding:11px 13px;
  border-bottom:1px solid var(--linea)}
.ev-b:last-child{border-bottom:0}
.ev-b .t,.ev-b .s{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ev-b:hover{background:var(--fondo)}
.ev-b[aria-current="true"]{background:var(--rojo-claro);
  box-shadow:inset 3px 0 0 var(--rojo)}
.ev-b .t{display:block;font-weight:700;font-size:13.5px;line-height:1.3}
.ev-b .s{display:block;font-size:11px;color:var(--t3);margin-top:2px}
.ev-b .g{display:block;font-size:12.5px;font-weight:700;margin-top:4px;
  font-variant-numeric:tabular-nums}

.cab-ev{background:var(--negro);color:#fff;padding:16px;border-radius:12px 12px 0 0}
.cab-ev .cod{font:700 10px/1 ui-monospace,monospace;letter-spacing:.12em;color:#9a9a9a}
.cab-ev h2{margin:6px 0 0;font-size:19px;letter-spacing:-.01em}
.cab-ev p{margin:6px 0 0;font-size:12.5px;color:#c9c9c9}
.mini{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));
  border-bottom:1px solid var(--linea)}
.mini>div{padding:10px 13px;border-right:1px solid var(--linea)}
.mini>div:last-child{border-right:0}
.mini .e{font-size:9.5px;font-weight:700;text-transform:uppercase;
  letter-spacing:.1em;color:var(--t3)}
.mini .v{font-size:16px;font-weight:900;margin-top:2px;font-variant-numeric:tabular-nums}
.bloque{padding:14px 16px;border-bottom:1px solid var(--linea)}
.bloque:last-child{border-bottom:0}
.bloque h4{margin:0 0 8px;font-size:10px;font-weight:800;text-transform:uppercase;
  letter-spacing:.11em;color:var(--rojo)}
.dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:11px}
.dl dt{font-size:9.5px;text-transform:uppercase;letter-spacing:.09em;
  color:var(--t3);font-weight:700}
.dl dd{margin:2px 0 0;font-size:13.5px;font-weight:600}
.tx{font-size:13.5px;color:#3a3a3a;margin:0 0 8px}
.tx b{color:var(--t1)}

/* fotos */
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}
.g button{padding:0;border-radius:8px;overflow:hidden;border:1px solid var(--linea);
  background:var(--fondo)}
.g img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block}
.g button:hover img{opacity:.88}
.g .cap{font-size:10px;color:var(--t3);padding:4px 6px;text-align:left;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

.vacio{padding:36px 16px;text-align:center;color:var(--t3);font-size:13px}
.volver{display:none}
@media(max-width:919px){
  .volver{display:inline-flex;align-items:center;gap:5px;font-size:13px;
    font-weight:600;color:var(--t2);padding:6px 0;margin-bottom:6px}
  .dosp.abierto .lista{display:none}
  .dosp:not(.abierto) .detalle{display:none}
}

dialog{border:0;padding:0;background:transparent;max-width:96vw;max-height:96vh}
dialog::backdrop{background:rgba(0,0,0,.88)}
dialog img{max-width:96vw;max-height:90vh;border-radius:10px;display:block}
dialog .pie{color:#fff;font-size:12px;text-align:center;padding:8px}

.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
@media print{
  .top,nav.tabs,.filtros,.vertabla,.volver{display:none!important}
  body{background:#fff}.card{break-inside:avoid}
  .dosp{grid-template-columns:1fr}.lista{display:none}
}
</style></head>
<body>

<header class="top"><div class="w">
  <div class="logo">CH</div>
  <div style="min-width:0">
    <h1 id="h-titulo"></h1>
    <p class="meta" id="h-meta"></p>
  </div>
  <div class="der">
    <button class="ico" id="b-imprimir" title="Imprimir o guardar como PDF">🖨</button>
  </div>
</div>
<nav class="tabs"><div class="w" id="tabs" role="tablist"></div></nav>
</header>

<div class="filtros"><div class="w">
  <input class="buscar" id="q" type="search" placeholder="Buscar evento, ciudad, lugar, cliente…"
         aria-label="Buscar">
  <div id="filtros-chips"></div>
</div></div>

<main id="app"></main>

<dialog id="lupa"><img alt=""><p class="pie"></p></dialog>

<script>
"use strict";
const D = __DATOS__;

/* ---------- formato ---------- */
const fCOP = new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0});
const fNUM = new Intl.NumberFormat("es-CO",{maximumFractionDigits:0});
const fNUM1 = new Intl.NumberFormat("es-CO",{maximumFractionDigits:1});
const money = v => fCOP.format(Number(v||0));
const num   = v => fNUM.format(Number(v||0));
const pct   = (v,d) => (v===null||v===undefined||isNaN(v)) ? "—" : (Number(v)*100).toFixed(d==null?1:d)+"%";
function corto(v){
  const n = Number(v||0);
  if (Math.abs(n) >= 1e6) return "$"+fNUM1.format(n/1e6)+"M";
  if (Math.abs(n) >= 1e3) return "$"+fNUM.format(Math.round(n/1e3))+"K";
  return "$"+fNUM.format(n);
}
const esc = v => String(v==null?"":v)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const MESES=["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO","JULIO","AGOSTO",
             "SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"];
const suma = (a,f) => a.reduce((s,x)=>s+(Number(f(x))||0),0);

/* ---------- estado ---------- */
const E = {
  tab: "resumen",
  q: "",
  filtros: { ciudad:"", responsable:"", tipo:"", estado:"", mes:"" },
  evento: null,
  abierto: false,     // en celular: se está viendo el detalle
  tablas: {},         // gráficos mostrados como tabla
};

function filtrados(){
  const q = E.q.trim().toLowerCase();
  return D.eventos.filter(e => {
    const f = E.filtros;
    if (f.ciudad && e.ciudad !== f.ciudad) return false;
    if (f.responsable && e.responsable !== f.responsable) return false;
    if (f.tipo && e.tipo !== f.tipo) return false;
    if (f.estado && e.estado !== f.estado) return false;
    if (f.mes && (e.anio+"-"+e.mes) !== f.mes) return false;
    if (q) {
      const h = [e.codigo,e.nombre,e.ciudad,e.lugar,e.direccion,e.cliente,
                 e.responsable,e.tipo,e.estado].join(" ").toLowerCase();
      if (h.indexOf(q) < 0) return false;
    }
    return true;
  });
}

/* ---------- acumulados ---------- */
function totales(evs){
  const mat = [].concat.apply([], evs.map(e=>e.material));
  return {
    n: evs.length,
    ciudades: new Set(evs.map(e=>e.ciudad).filter(Boolean)).size,
    asistentes: suma(evs, e=>e.asistentes||0),
    personal: suma(evs, e=>e.personal),
    llevado: suma(mat, m=>m.llevada),
    utilizado: suma(mat, m=>m.utilizada),
    sobrante: suma(mat, m=>m.sobrante),
    gastoPop: suma(evs, e=>e.gastoPop),
    valorLlevado: suma(evs, e=>e.valorLlevado),
    gastosAdic: suma(evs, e=>e.gastosAdic),
    gastoTotal: suma(evs, e=>e.gastoTotal),
    fotos: suma(evs, e=>e.fotos.length),
  };
}

function agrupar(evs, clave){
  const m = new Map();
  evs.forEach(e => {
    const k = e[clave] || "SIN DEFINIR";
    m.set(k, (m.get(k)||0) + 1);
  });
  return [...m.entries()].map(x=>({k:x[0],v:x[1]})).sort((a,b)=>b.v-a.v);
}

function porMaterial(evs){
  const m = new Map();
  evs.forEach(e => e.material.forEach(x => {
    const f = m.get(x.material) || {k:x.material,llevada:0,utilizada:0,sobrante:0,
                                    gasto:0,valorLlevado:0,costo:x.costo,eventos:new Set()};
    f.llevada += x.llevada; f.utilizada += x.utilizada; f.sobrante += x.sobrante;
    f.gasto += x.gasto; f.valorLlevado += x.valorLlevado;
    if (x.costo) f.costo = x.costo;
    f.eventos.add(e.id);
    m.set(x.material, f);
  }));
  return [...m.values()].map(f=>({...f, nEventos:f.eventos.size,
    pct: f.llevada>0 ? f.utilizada/f.llevada : null}))
    .sort((a,b)=>b.utilizada-a.utilizada);
}

function porCategoria(evs){
  const m = new Map();
  evs.forEach(e => e.gastos.forEach(g => m.set(g.categoria,(m.get(g.categoria)||0)+g.valor)));
  return [...m.entries()].map(x=>({k:x[0],v:x[1]})).sort((a,b)=>b.v-a.v);
}

function porPersona(evs){
  const m = new Map();
  evs.forEach(e => e.equipo.forEach(p => {
    const f = m.get(p.nombre) || {k:p.nombre,eventos:0,asistio:0,noAsistio:0,horas:0};
    f.eventos++;
    if (p.asistio === "SÍ") f.asistio++;
    if (p.asistio === "NO") f.noAsistio++;
    f.horas += Number(p.horas||0);
    m.set(p.nombre, f);
  }));
  return [...m.values()].sort((a,b)=>b.eventos-a.eventos);
}

/* ---------- componentes ---------- */
function kpi(etiqueta, valor, apoyo, rojo, alTocar){
  const t = alTocar ? "button" : "div";
  return "<"+t+' class="k'+(alTocar?" click":"")+'"'+(alTocar?' data-ir="'+alTocar+'"':"")+'>'+
    '<span class="e">'+esc(etiqueta)+'</span>'+
    '<span class="v'+(rojo?" rojo":"")+'">'+esc(valor)+'</span>'+
    (apoyo ? '<span class="a">'+esc(apoyo)+'</span>' : "")+
  "</"+t+">";
}

/**
 * Gráfico de barras. Cada barra puede tener varios segmentos apilados y
 * se puede tocar para filtrar. Siempre lleva etiqueta directa con el valor,
 * y un botón para verlo como tabla.
 */
function barras(id, titulo, apoyo, filas, opciones){
  const o = opciones || {};
  const max = Math.max.apply(null, filas.map(f=>f.total!=null?f.total:f.v).concat([1]));
  const verTabla = E.tablas[id];
  let cuerpo;

  if (verTabla) {
    const cols = o.columnas || ["", "Valor"];
    cuerpo = '<div class="tw"><table class="t"><thead><tr>'+
      cols.map((c,i)=>'<th'+(i?' class="n"':"")+'>'+esc(c)+"</th>").join("")+
      "</tr></thead><tbody>"+
      filas.map(f=>"<tr><td>"+esc(f.k)+"</td>"+
        (o.celdas ? o.celdas(f) : '<td class="n">'+esc(f.etiqueta)+"</td>")+
      "</tr>").join("")+"</tbody></table></div>";
  } else {
    cuerpo = '<div class="barras">'+filas.map(f=>{
      const segs = f.segmentos || [{v:f.v, color:o.color||"var(--s1)"}];
      const tot = f.total!=null?f.total:f.v;
      const ancho = Math.max(1.5, (tot/max)*100);
      const dentro = segs.map(s=>{
        const p = tot>0 ? (s.v/tot)*100 : 0;
        return '<i style="width:'+p+'%;background:'+s.color+'"></i>';
      }).join("");
      const activo = o.filtro && E.filtros[o.filtro] === f.k;
      return "<"+(o.filtro?"button":"div")+' class="fila-b"'+
        (o.filtro?' data-filtro="'+o.filtro+'" data-valor="'+esc(f.k)+'" aria-pressed="'+(activo?"true":"false")+'"':"")+
        ' title="'+esc(f.k+" · "+f.etiqueta)+'">'+
        '<span class="n">'+esc(f.k)+"</span>"+
        '<span class="pista" style="width:'+ancho+'%">'+dentro+"</span>"+
        '<span class="v">'+esc(f.etiqueta)+"</span>"+
      "</"+(o.filtro?"button":"div")+">";
    }).join("")+"</div>"+
    (o.leyenda ? '<div class="leyenda">'+o.leyenda.map(l=>
       '<span><i style="background:'+l.color+'"></i>'+esc(l.texto)+"</span>").join("")+"</div>" : "");
  }

  return '<section class="card card-p gr"><div class="gr-top"><div>'+
    '<h3 class="sub">'+esc(titulo)+"</h3>"+
    (apoyo?'<p class="apoyo">'+esc(apoyo)+"</p>":"")+
    '</div><button class="vertabla" data-tabla="'+id+'">'+
    (verTabla?"Ver gráfico":"Ver tabla")+"</button></div>"+
    (filas.length ? cuerpo : '<p class="vacio">Sin datos</p>')+
  "</section>";
}

/* ---------- pestañas ---------- */
const TABS = [
  {id:"resumen",  t:"📊 Resumen"},
  {id:"eventos",  t:"📅 Eventos"},
  {id:"material", t:"📦 Material POP"},
  {id:"gastos",   t:"💰 Gastos"},
  {id:"personal", t:"👥 Personal"},
];

function vistaResumen(evs){
  const T = totales(evs);
  const util = T.llevado>0 ? T.utilizado/T.llevado : null;
  const meses = new Map();
  evs.forEach(e=>{
    const k = e.anio+"-"+e.mes;
    const f = meses.get(k) || {k:MESES[e.mes-1].slice(0,3)+" "+String(e.anio).slice(2),
                               clave:k, v:0, gasto:0};
    f.v++; f.gasto += e.gastoTotal; meses.set(k,f);
  });
  const porMes = [...meses.values()].sort((a,b)=>a.clave.localeCompare(b.clave));
  const mats = porMaterial(evs);

  return '<div class="kpis">'+
    kpi("Eventos", num(T.n), T.ciudades+" ciudad"+(T.ciudades===1?"":"es"), false, "eventos")+
    kpi("Asistentes", num(T.asistentes), "Registrados en resultados")+
    kpi("Material utilizado", num(T.utilizado), "de "+num(T.llevado)+" llevadas", false, "material")+
    kpi("Utilización", pct(util), "Utilizado / llevado", false, "material")+
    kpi("Gasto POP", money(T.gastoPop), "Solo lo utilizado", false, "material")+
    kpi("Gastos adicionales", money(T.gastosAdic), null, false, "gastos")+
    kpi("Gasto total", money(T.gastoTotal), "POP + adicionales", true, "gastos")+
    kpi("Personal", num(T.personal), "Participaciones", false, "personal")+
  "</div>"+

  '<div class="rejilla dos">'+
    barras("mes","Eventos por mes","Toca para ver solo ese mes",
      porMes.map(m=>({k:m.k, v:m.v, etiqueta:num(m.v), _clave:m.clave})),
      {color:"var(--s1)"})+
    barras("ciudad","Eventos por ciudad","Toca una ciudad para filtrar todo el informe",
      agrupar(evs,"ciudad").map(x=>({k:x.k, v:x.v, etiqueta:num(x.v)})),
      {color:"var(--s1)", filtro:"ciudad"})+
    barras("resp","Eventos por responsable","Toca para filtrar",
      agrupar(evs,"responsable").map(x=>({k:x.k, v:x.v, etiqueta:num(x.v)})),
      {color:"var(--s1)", filtro:"responsable"})+
    barras("tipo","Eventos por tipo","Toca para filtrar",
      agrupar(evs,"tipo").map(x=>({k:x.k, v:x.v, etiqueta:num(x.v)})),
      {color:"var(--s1)", filtro:"tipo"})+
  "</div>"+

  '<div class="rejilla">'+
    barras("matres","Material POP","Cada barra es lo llevado: en rojo lo utilizado, en gris lo que sobró",
      mats.map(m=>({k:m.k, total:m.llevada, etiqueta:num(m.utilizada)+" / "+num(m.llevada),
        segmentos:[{v:m.utilizada,color:"var(--s1)"},{v:m.sobrante,color:"var(--gris)"}]})),
      {leyenda:[{color:"var(--s1)",texto:"Utilizado"},{color:"var(--gris)",texto:"Sobrante"}],
       columnas:["Material","Llevado","Utilizado","Sobrante","% Util.","Gasto"],
       celdas:f=>{
         const m = mats.find(x=>x.k===f.k);
         return '<td class="n">'+num(m.llevada)+'</td><td class="n">'+num(m.utilizada)+
                '</td><td class="n">'+num(m.sobrante)+'</td><td class="n">'+pct(m.pct)+
                '</td><td class="n">'+money(m.gasto)+"</td>";
       }})+
  "</div>";
}

function vistaEventos(evs){
  if (!evs.length) return '<div class="card"><p class="vacio">No hay eventos con estos filtros.</p></div>';
  const sel = evs.find(e=>e.id===E.evento) || evs[0];
  E.evento = sel.id;

  const lista = '<div class="card lista">'+evs.map(e=>
    '<button class="ev-b" data-ev="'+e.id+'" aria-current="'+(e.id===sel.id?"true":"false")+'">'+
      '<span class="t">'+esc(e.nombre)+"</span>"+
      '<span class="s">'+esc(e.codigo)+" · "+esc(e.fechaTexto)+
        (e.ciudad?" · "+esc(e.ciudad):"")+"</span>"+
      '<span class="g">'+money(e.gastoTotal)+"</span>"+
    "</button>").join("")+"</div>";

  return '<div class="dosp'+(E.abierto?" abierto":"")+'">'+lista+
    '<div class="detalle"><button class="volver" id="b-volver">‹ Todos los eventos</button>'+
    fichaEvento(sel)+"</div></div>";
}

function fichaEvento(e){
  const util = e.popLlevado>0 ? e.popUtilizado/e.popLlevado : null;
  let h = '<div class="card">'+
    '<div class="cab-ev"><p class="cod">'+esc(e.codigo)+"</p>"+
      "<h2>"+esc(e.nombre)+"</h2>"+
      "<p>"+esc(e.fechaLarga)+" · "+esc(e.dia)+"</p>"+
      "<p>"+esc([e.lugar,e.ciudad].filter(Boolean).join(" · ")||"—")+"</p></div>"+
    '<div class="mini">'+
      '<div><p class="e">Gasto POP</p><p class="v">'+money(e.gastoPop)+"</p></div>"+
      '<div><p class="e">Adicionales</p><p class="v">'+money(e.gastosAdic)+"</p></div>"+
      '<div><p class="e">Gasto total</p><p class="v" style="color:var(--rojo)">'+money(e.gastoTotal)+"</p></div>"+
      '<div><p class="e">Personal</p><p class="v">'+num(e.asistieron)+" / "+num(e.personal)+"</p></div>"+
    "</div>"+
    '<div class="bloque"><h4>Información general</h4><dl class="dl">'+
      dato("Cliente", e.cliente)+dato("Tipo de evento", e.tipo)+
      dato("Responsable", e.responsable)+dato("Estado", e.estado)+
      dato("Dirección", e.direccion)+
      dato("Asistentes", (e.asistentes!=null?num(e.asistentes):"—")+" de "+
        (e.asistentesEsp!=null?num(e.asistentesEsp):"—")+" esperados")+
    "</dl>"+(e.observaciones?'<p class="tx" style="margin-top:10px"><b>Observaciones.</b> '+
      esc(e.observaciones)+"</p>":"")+"</div>";

  if (e.material.length) {
    h += '<div class="bloque"><h4>Material POP</h4><div class="tw"><table class="t">'+
      "<thead><tr><th>Material</th><th class=n>Llevado</th><th class=n>Utilizado</th>"+
      "<th class=n>Sobrante</th><th class=n>% Util.</th><th class=n>Gasto</th></tr></thead><tbody>"+
      e.material.map(m=>"<tr><td>"+esc(m.material)+'</td><td class="n">'+num(m.llevada)+
        '</td><td class="n"><b>'+num(m.utilizada)+'</b></td><td class="n">'+num(m.sobrante)+
        '</td><td class="n">'+pct(m.pct)+'</td><td class="n">'+money(m.gasto)+"</td></tr>").join("")+
      "</tbody><tfoot><tr><th>TOTAL</th>"+
        '<td class="n">'+num(e.popLlevado)+'</td><td class="n">'+num(e.popUtilizado)+
        '</td><td class="n">'+num(e.popSobrante)+'</td><td class="n">'+pct(util)+
        '</td><td class="n">'+money(e.gastoPop)+"</td></tr></tfoot></table></div>"+
      '<p class="apoyo" style="margin-top:6px">El gasto cuenta solo lo utilizado. '+
      "Se movilizaron "+money(e.valorLlevado)+" en material.</p></div>";
  }

  if (e.equipo.length) {
    h += '<div class="bloque"><h4>Personal</h4><div class="tw"><table class="t">'+
      "<thead><tr><th>Persona</th><th>Rol</th><th>Confirmado</th><th>Asistió</th>"+
      "<th class=n>Ingreso</th><th class=n>Salida</th><th class=n>Horas</th></tr></thead><tbody>"+
      e.equipo.map(p=>"<tr><td>"+esc(p.nombre)+"</td><td>"+esc(p.rol||"—")+"</td><td>"+
        esc(p.confirmado)+"</td><td>"+esc(p.asistio)+'</td><td class="n">'+esc(p.ingreso||"—")+
        '</td><td class="n">'+esc(p.salida||"—")+'</td><td class="n">'+
        (p.horas!=null?p.horas:"—")+"</td></tr>").join("")+
      "</tbody></table></div></div>";
  }

  if (e.gastos.length) {
    h += '<div class="bloque"><h4>Gastos adicionales</h4><div class="tw"><table class="t">'+
      "<thead><tr><th>Categoría</th><th>Descripción</th><th>Proveedor</th>"+
      "<th>Responsable</th><th class=n>Valor</th></tr></thead><tbody>"+
      e.gastos.map(g=>"<tr><td>"+esc(g.categoria)+"</td><td>"+esc(g.descripcion||"—")+
        "</td><td>"+esc(g.proveedor||"—")+"</td><td>"+esc(g.responsable||"—")+
        '</td><td class="n">'+money(g.valor)+"</td></tr>").join("")+
      "</tbody><tfoot><tr><th colspan=4>TOTAL</th>"+
      '<td class="n">'+money(e.gastosAdic)+"</td></tr></tfoot></table></div></div>";
  }

  if (e.resultado) {
    const r = e.resultado;
    h += '<div class="bloque"><h4>Resultados</h4><dl class="dl">'+
      dato("Asistentes", e.asistentes!=null?num(e.asistentes):"—")+
      dato("Clientes atendidos", e.clientes!=null?num(e.clientes):"—")+"</dl>"+
      (r.comercial?'<p class="tx" style="margin-top:10px"><b>Resultado comercial.</b> '+esc(r.comercial)+"</p>":"")+
      (r.observaciones?'<p class="tx"><b>Observaciones.</b> '+esc(r.observaciones)+"</p>":"")+
      (r.aprendizajes?'<p class="tx"><b>Aprendizajes.</b> '+esc(r.aprendizajes)+"</p>":"")+
    "</div>";
  }

  if (e.fotos.length) {
    h += '<div class="bloque"><h4>Anexos · '+e.fotos.length+'</h4><div class="g">'+
      e.fotos.map((f,i)=>'<button data-foto="'+e.id+"|"+i+'">'+
        '<img src="'+f.src+'" alt="'+esc(f.nombre)+'" loading="lazy">'+
        '<span class="cap">'+esc(f.nombre)+"</span></button>").join("")+
      "</div></div>";
  }
  return h+"</div>";
}

const dato = (k,v) => "<div><dt>"+esc(k)+"</dt><dd>"+esc(v||"—")+"</dd></div>";

function vistaMaterial(evs){
  const mats = porMaterial(evs);
  const T = totales(evs);
  const util = T.llevado>0 ? T.utilizado/T.llevado : null;
  if (!mats.length) return '<div class="card"><p class="vacio">Sin material POP con estos filtros.</p></div>';

  return '<div class="kpis">'+
    kpi("Piezas llevadas", num(T.llevado))+
    kpi("Piezas utilizadas", num(T.utilizado))+
    kpi("Piezas sobrantes", num(T.sobrante))+
    kpi("Utilización", pct(util))+
    kpi("Gasto POP", money(T.gastoPop), "Movilizado "+money(T.valorLlevado), true)+
  "</div>"+
  '<div class="rejilla">'+
    barras("m1","Utilizado por material","Cada barra es lo llevado: en rojo lo utilizado",
      mats.map(m=>({k:m.k, total:m.llevada, etiqueta:num(m.utilizada)+" / "+num(m.llevada),
        segmentos:[{v:m.utilizada,color:"var(--s1)"},{v:m.sobrante,color:"var(--gris)"}]})),
      {leyenda:[{color:"var(--s1)",texto:"Utilizado"},{color:"var(--gris)",texto:"Sobrante"}]})+
    barras("m2","Gasto por material","Solo lo consumido",
      mats.map(m=>({k:m.k, v:m.gasto, etiqueta:corto(m.gasto)})), {color:"var(--s2)"})+
  "</div>"+
  '<section class="card" style="margin-top:12px"><div class="card-p" style="padding-bottom:0">'+
    '<h3 class="sub">Total por material</h3>'+
    '<p class="apoyo">Consolidado de '+mats.length+" material"+(mats.length===1?"":"es")+
    " en "+evs.length+" evento"+(evs.length===1?"":"s")+"</p></div>"+
    '<div class="tw"><table class="t"><thead><tr><th>Material</th><th class=n>Eventos</th>'+
    "<th class=n>Llevado</th><th class=n>Utilizado</th><th class=n>Sobrante</th>"+
    "<th class=n>% Util.</th><th class=n>Costo unit.</th><th class=n>Gasto</th></tr></thead><tbody>"+
    mats.map(m=>"<tr><td><b>"+esc(m.k)+'</b></td><td class="n">'+num(m.nEventos)+
      '</td><td class="n">'+num(m.llevada)+'</td><td class="n"><b>'+num(m.utilizada)+
      '</b></td><td class="n">'+num(m.sobrante)+'</td><td class="n">'+pct(m.pct)+
      '</td><td class="n">'+money(m.costo)+'</td><td class="n">'+money(m.gasto)+"</td></tr>").join("")+
    "</tbody><tfoot><tr><th>TOTAL</th>"+
      '<td class="n">'+num(evs.length)+'</td><td class="n">'+num(T.llevado)+
      '</td><td class="n">'+num(T.utilizado)+'</td><td class="n">'+num(T.sobrante)+
      '</td><td class="n">'+pct(util)+'</td><td class="n"></td><td class="n">'+
      money(T.gastoPop)+"</td></tr></tfoot></table></div></section>";
}

function vistaGastos(evs){
  const cats = porCategoria(evs);
  const T = totales(evs);
  const filas = [{k:"MATERIAL POP", v:T.gastoPop, pop:true}].concat(cats);
  return '<div class="kpis">'+
    kpi("Gasto POP", money(T.gastoPop), "Material utilizado")+
    kpi("Gastos adicionales", money(T.gastosAdic), cats.length+" categorías")+
    kpi("Gasto total", money(T.gastoTotal), null, true)+
    kpi("Promedio por evento", money(evs.length?T.gastoTotal/evs.length:0), evs.length+" eventos")+
  "</div>"+
  '<div class="rejilla">'+
    barras("g1","Gasto por categoría","El material POP se muestra aparte, en rojo",
      filas.map(f=>({k:f.k, v:f.v, etiqueta:corto(f.v),
        segmentos:[{v:f.v, color:f.pop?"var(--s1)":"var(--s2)"}]})),
      {leyenda:[{color:"var(--s1)",texto:"Material POP"},
                {color:"var(--s2)",texto:"Gastos adicionales"}],
       columnas:["Categoría","Valor"],
       celdas:f=>'<td class="n">'+money(f.v)+"</td>"})+
    barras("g2","Gasto total por evento","Toca un evento para abrir su ficha",
      evs.slice().sort((a,b)=>b.gastoTotal-a.gastoTotal)
        .map(e=>({k:e.nombre, v:e.gastoTotal, etiqueta:corto(e.gastoTotal), _ev:e.id})),
      {color:"var(--s2)", columnas:["Evento","Gasto total"],
       celdas:f=>'<td class="n">'+money(f.v)+"</td>"})+
  "</div>";
}

function vistaPersonal(evs){
  const gente = porPersona(evs);
  if (!gente.length) return '<div class="card"><p class="vacio">Sin participaciones con estos filtros.</p></div>';
  const totHoras = suma(gente, p=>p.horas);
  return '<div class="kpis">'+
    kpi("Personas", num(gente.length))+
    kpi("Participaciones", num(suma(gente,p=>p.eventos)))+
    kpi("Asistencias", num(suma(gente,p=>p.asistio)))+
    kpi("Horas", num(totHoras))+
  "</div>"+
  '<div class="rejilla">'+
    barras("p1","Participación por persona","En verde lo que asistió, en rojo lo que no",
      gente.map(p=>({k:p.k, total:p.eventos, etiqueta:num(p.asistio)+" / "+num(p.eventos),
        segmentos:[{v:p.asistio,color:"var(--s4)"},{v:p.noAsistio,color:"var(--s1)"},
                   {v:Math.max(0,p.eventos-p.asistio-p.noAsistio),color:"var(--gris)"}]})),
      {leyenda:[{color:"var(--s4)",texto:"Asistió"},{color:"var(--s1)",texto:"No asistió"},
                {color:"var(--gris)",texto:"Pendiente"}],
       columnas:["Persona","Eventos","Asistió","Horas"],
       celdas:f=>{const p=gente.find(x=>x.k===f.k);
         return '<td class="n">'+num(p.eventos)+'</td><td class="n">'+num(p.asistio)+
                '</td><td class="n">'+num(p.horas)+"</td>";}})+
  "</div>"+
  '<section class="card" style="margin-top:12px"><div class="card-p" style="padding-bottom:0">'+
    '<h3 class="sub">Detalle por persona</h3></div><div class="tw"><table class="t">'+
    "<thead><tr><th>Persona</th><th class=n>Eventos</th><th class=n>Asistió</th>"+
    "<th class=n>No asistió</th><th class=n>% Asistencia</th><th class=n>Horas</th></tr></thead><tbody>"+
    gente.map(p=>"<tr><td><b>"+esc(p.k)+'</b></td><td class="n">'+num(p.eventos)+
      '</td><td class="n">'+num(p.asistio)+'</td><td class="n">'+num(p.noAsistio)+
      '</td><td class="n">'+(p.asistio+p.noAsistio>0?pct(p.asistio/(p.asistio+p.noAsistio),0):"—")+
      '</td><td class="n">'+num(p.horas)+"</td></tr>").join("")+
    "</tbody><tfoot><tr><th>TOTAL</th>"+
      '<td class="n">'+num(suma(gente,p=>p.eventos))+'</td><td class="n">'+
      num(suma(gente,p=>p.asistio))+'</td><td class="n">'+num(suma(gente,p=>p.noAsistio))+
      '</td><td class="n"></td><td class="n">'+num(totHoras)+
      "</td></tr></tfoot></table></div></section>";
}

/* ---------- filtros visibles ---------- */
function chipsHtml(){
  const valores = c => [...new Set(D.eventos.map(e=>e[c]).filter(Boolean))].sort();
  const meses = [...new Set(D.eventos.map(e=>e.anio+"-"+e.mes))]
    .sort().map(k=>{const p=k.split("-");
      return {k:k, t:MESES[Number(p[1])-1].slice(0,3)+" "+p[0]};});
  const activos = Object.keys(E.filtros).filter(k=>E.filtros[k]).length;

  const grupo = (etiqueta, campo, items) => items.length<2 ? "" :
    '<div class="grupo-f"><b>'+etiqueta+"</b>"+items.map(i=>
      '<button class="chip" data-filtro="'+campo+'" data-valor="'+esc(i.k)+
      '" aria-pressed="'+(E.filtros[campo]===i.k?"true":"false")+'">'+esc(i.t)+"</button>").join("")+
    "</div>";

  return grupo("Mes","mes",meses)+
    grupo("Ciudad","ciudad",valores("ciudad").map(v=>({k:v,t:v})))+
    grupo("Responsable","responsable",valores("responsable").map(v=>({k:v,t:v})))+
    grupo("Tipo","tipo",valores("tipo").map(v=>({k:v,t:v})))+
    grupo("Estado","estado",valores("estado").map(v=>({k:v,t:v})))+
    (activos||E.q ? '<div class="chips" style="margin-top:8px">'+
      '<button class="chip limpiar" id="b-limpiar">✕ Limpiar filtros ('+
      (activos+(E.q?1:0))+")</button></div>" : "");
}

/* ---------- pintar ---------- */
function render(){
  const evs = filtrados();

  document.getElementById("h-titulo").textContent = D.titulo;
  document.getElementById("h-meta").textContent =
    D.rango+" · "+evs.length+" de "+D.eventos.length+" evento"+
    (D.eventos.length===1?"":"s")+" · generado el "+D.generado;

  document.getElementById("tabs").innerHTML = TABS.map(t=>
    '<button class="tab" role="tab" data-tab="'+t.id+'" aria-selected="'+
    (E.tab===t.id?"true":"false")+'">'+t.t+"</button>").join("");

  document.getElementById("filtros-chips").innerHTML = chipsHtml();

  const app = document.getElementById("app");
  app.innerHTML =
    E.tab==="resumen"  ? vistaResumen(evs) :
    E.tab==="eventos"  ? vistaEventos(evs) :
    E.tab==="material" ? vistaMaterial(evs) :
    E.tab==="gastos"   ? vistaGastos(evs) :
                         vistaPersonal(evs);
  if (E.tab !== "eventos") app.scrollIntoView({block:"start"});
}

/* ---------- interacción ---------- */
document.addEventListener("click", function(ev){
  const t = ev.target.closest("[data-tab],[data-filtro],[data-tabla],[data-ev],[data-foto],[data-ir],#b-limpiar,#b-volver,#b-imprimir");
  if (!t) return;

  if (t.id === "b-imprimir") { window.print(); return; }

  if (t.id === "b-limpiar") {
    E.filtros = {ciudad:"",responsable:"",tipo:"",estado:"",mes:""};
    E.q = ""; document.getElementById("q").value = "";
    render(); return;
  }

  if (t.id === "b-volver") { E.abierto = false; render(); return; }

  if (t.dataset.tab)   { E.tab = t.dataset.tab; E.abierto = false; render(); return; }
  if (t.dataset.ir)    { E.tab = t.dataset.ir; render(); return; }
  if (t.dataset.tabla) { E.tablas[t.dataset.tabla] = !E.tablas[t.dataset.tabla]; render(); return; }

  if (t.dataset.filtro) {
    const c = t.dataset.filtro, v = t.dataset.valor;
    E.filtros[c] = E.filtros[c] === v ? "" : v;
    render(); return;
  }

  if (t.dataset.ev) { E.evento = t.dataset.ev; E.abierto = true; render(); return; }

  if (t.dataset.foto) {
    const p = t.dataset.foto.split("|");
    const e = D.eventos.find(x=>x.id===p[0]);
    const f = e && e.fotos[Number(p[1])];
    if (f) {
      const d = document.getElementById("lupa");
      d.querySelector("img").src = f.src;
      d.querySelector("img").alt = f.nombre;
      d.querySelector(".pie").textContent = f.nombre;
      d.showModal();
    }
  }
});

document.getElementById("lupa").addEventListener("click", function(){ this.close(); });

let temporizador;
document.getElementById("q").addEventListener("input", function(e){
  clearTimeout(temporizador);
  const v = e.target.value;
  temporizador = setTimeout(function(){ E.q = v; render(); }, 180);
});

document.addEventListener("keydown", function(e){
  if (e.key === "Escape" && E.abierto) { E.abierto = false; render(); }
});

render();
</script>
</body></html>`;
