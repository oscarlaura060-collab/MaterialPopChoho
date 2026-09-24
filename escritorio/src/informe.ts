/**
 * Genera un informe en UN SOLO archivo .html, con los datos y las fotografías
 * incrustados. Se envía por WhatsApp o correo y se abre en cualquier celular
 * o computador, sin internet, sin instalar nada y sin poder modificarse.
 */
import { fechaCorta, fechaLarga, money, num, pct } from "@/lib/format";
import type { EventoVista, Gasto, MaterialPop, Participacion, Resultado } from "@/lib/types";
import type { Registro } from "./archivos";
import { leerAnexo } from "./archivos";

const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const EXT_IMAGEN = /\.(jpe?g|png|gif|webp|bmp|avif|heic|heif)$/i;

/** Una imagen puede llegar sin tipo MIME; entonces manda la extensión. */
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
  const { eventos } = f;
  const suma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

  const ids = new Set<unknown>(eventos.map((e) => e.id));
  const mat = f.material.filter((m) => ids.has(m.evento_id));
  const gas = f.gastos.filter((g) => ids.has(g.evento_id));
  const par = f.participacion.filter((p) => ids.has(p.evento_id));

  const gastoPop = suma(mat.map((m) => m.gasto_material));
  const gastoAdic = suma(gas.map((g) => g.valor));
  const popLlevado = suma(mat.map((m) => m.cantidad_llevada));
  const popUtil = suma(mat.map((m) => m.cantidad_utilizada));

  // Fotografías incrustadas
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

  const tarjeta = (etiqueta: string, valor: string, apoyo = "") => `
    <div class="k"><p class="ke">${esc(etiqueta)}</p><p class="kv">${esc(valor)}</p>
    ${apoyo ? `<p class="ka">${esc(apoyo)}</p>` : ""}</div>`;

  /** Consolidado de material: cuánto se usó de cada uno en todos los eventos */
  const matPorTipo = (() => {
    const m = new Map<string, { material: string; llevada: number; utilizada: number; sobrante: number; gasto: number }>();
    for (const x of mat) {
      const f = m.get(x.material) ?? { material: x.material, llevada: 0, utilizada: 0, sobrante: 0, gasto: 0 };
      f.llevada += x.cantidad_llevada;
      f.utilizada += x.cantidad_utilizada;
      f.sobrante += x.cantidad_sobrante;
      f.gasto += x.gasto_material;
      m.set(x.material, f);
    }
    return [...m.values()].sort((a, b) => b.utilizada - a.utilizada);
  })();

  const agrupar = (campo: "ciudad" | "tipo_evento" | "responsable") => {
    const m = new Map<string, number>();
    for (const e of eventos) m.set((e[campo] as string) ?? "SIN DEFINIR",
      (m.get((e[campo] as string) ?? "SIN DEFINIR") ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  const barras = (titulo: string, filas: [string, number][], total: number) => `
    <section class="c"><h3>${esc(titulo)}</h3><table class="b">
    ${filas.map(([k, v]) => `<tr><th>${esc(k)}</th>
      <td><span class="ba" style="width:${total ? (v / total) * 100 : 0}%"></span></td>
      <td class="n">${num(v)}</td></tr>`).join("")}
    </table></section>`;

  const fichaEvento = (e: EventoVista) => {
    const ms = mat.filter((m) => m.evento_id === e.id);
    const gs = gas.filter((g) => g.evento_id === e.id);
    const ps = par.filter((p) => p.evento_id === e.id);
    const r = f.resultados.find((x) => x.evento_id === e.id);
    const an = f.anexos.filter((a) => a.evento_id === e.id && fotos.has(String(a.id)));
    const util = e.pop_llevado > 0 ? e.pop_utilizado / e.pop_llevado : null;

    return `
    <article class="ev" id="ev-${esc(e.codigo)}">
      <header class="evh">
        <p class="cod">${esc(e.codigo)}</p>
        <h2>${esc(e.nombre)}</h2>
        <p class="sub">${esc(fechaLarga(e.fecha))} · ${esc(e.dia)}</p>
        <p class="sub2">${esc([e.lugar_negocio, e.ciudad].filter(Boolean).join(" · ") || "—")}</p>
      </header>
      <div class="evk">
        ${tarjeta("Gasto POP", money(e.gasto_pop))}
        ${tarjeta("Gastos adicionales", money(e.gastos_adicionales))}
        ${tarjeta("Gasto total", money(e.gasto_total))}
        ${tarjeta("Personal", `${num(e.asistieron)} / ${num(e.personal_asignado)}`)}
      </div>

      <h4>Información general</h4>
      <dl class="dl">
        <div><dt>Cliente</dt><dd>${esc(e.cliente ?? "—")}</dd></div>
        <div><dt>Tipo de evento</dt><dd>${esc(e.tipo_evento ?? "—")}</dd></div>
        <div><dt>Responsable</dt><dd>${esc(e.responsable ?? "—")}</dd></div>
        <div><dt>Estado</dt><dd>${esc(e.estado)}</dd></div>
        <div><dt>Dirección</dt><dd>${esc(e.direccion ?? "—")}</dd></div>
        <div><dt>Asistentes</dt><dd>${e.asistentes !== null ? num(e.asistentes) : "—"} de ${e.asistentes_esperados !== null ? num(e.asistentes_esperados) : "—"} esperados</dd></div>
      </dl>

      ${ms.length ? `<h4>Material POP</h4>
      <div class="tw"><table class="t"><thead><tr><th>Material</th><th class="n">Llevado</th>
      <th class="n">Utilizado</th><th class="n">Sobrante</th><th class="n">% Util.</th>
      <th class="n">Costo</th></tr></thead><tbody>
      ${ms.map((m) => `<tr><td>${esc(m.material)}</td><td class="n">${num(m.cantidad_llevada)}</td>
        <td class="n">${num(m.cantidad_utilizada)}</td><td class="n">${num(m.cantidad_sobrante)}</td>
        <td class="n">${pct(m.pct_utilizacion, 1)}</td><td class="n">${money(m.gasto_material)}</td></tr>`).join("")}
      </tbody><tfoot><tr><th>TOTAL</th><th class="n">${num(e.pop_llevado)}</th>
        <th class="n">${num(e.pop_utilizado)}</th><th class="n">${num(e.pop_sobrante)}</th>
        <th class="n">${pct(util, 1)}</th><th class="n">${money(e.gasto_pop)}</th></tr></tfoot></table></div>` : ""}

      ${ps.length ? `<h4>Personal</h4>
      <div class="tw"><table class="t"><thead><tr><th>Persona</th><th>Rol</th><th>Confirmado</th>
      <th>Asistió</th><th class="n">Horas</th></tr></thead><tbody>
      ${ps.map((p) => `<tr><td>${esc(p.persona_nombre)}</td><td>${esc(p.rol_funcion ?? "—")}</td>
        <td>${esc(p.confirmado)}</td><td>${esc(p.asistio)}</td>
        <td class="n">${p.horas ?? "—"}</td></tr>`).join("")}
      </tbody></table></div>` : ""}

      ${gs.length ? `<h4>Gastos adicionales</h4>
      <div class="tw"><table class="t"><thead><tr><th>Categoría</th><th>Descripción</th>
      <th>Responsable</th><th class="n">Valor</th></tr></thead><tbody>
      ${gs.map((g) => `<tr><td>${esc(g.categoria ?? "—")}</td><td>${esc(g.descripcion ?? "—")}</td>
        <td>${esc(g.responsable ?? "—")}</td><td class="n">${money(g.valor)}</td></tr>`).join("")}
      </tbody><tfoot><tr><th colspan="3">TOTAL</th>
        <th class="n">${money(e.gastos_adicionales)}</th></tr></tfoot></table></div>` : ""}

      ${r ? `<h4>Resultados</h4><dl class="dl">
        <div><dt>Asistentes</dt><dd>${r.asistentes !== null ? num(r.asistentes) : "—"}</dd></div>
        <div><dt>Clientes atendidos</dt><dd>${r.clientes_atendidos !== null ? num(r.clientes_atendidos) : "—"}</dd></div>
      </dl>
      ${r.resultado_comercial ? `<p class="tx"><b>Resultado comercial.</b> ${esc(r.resultado_comercial)}</p>` : ""}
      ${r.observaciones ? `<p class="tx"><b>Observaciones.</b> ${esc(r.observaciones)}</p>` : ""}
      ${r.aprendizajes ? `<p class="tx"><b>Aprendizajes.</b> ${esc(r.aprendizajes)}</p>` : ""}` : ""}

      ${an.length ? `<h4>Anexos</h4><div class="g">
      ${an.map((a) => `<figure><img src="${fotos.get(String(a.id))}" alt="${esc(a.nombre)}" loading="lazy">
        <figcaption>${esc(a.nombre)}</figcaption></figure>`).join("")}
      </div>` : ""}
    </article>`;
  };

  const titulo = op.titulo || "Informe de eventos";
  const rango = eventos.length
    ? (() => {
        const fs = eventos.map((e) => e.fecha).sort();
        return fs[0] === fs[fs.length - 1]
          ? fechaCorta(fs[0])
          : `${fechaCorta(fs[0])} — ${fechaCorta(fs[fs.length - 1])}`;
      })()
    : "—";

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CHOHO · ${esc(titulo)}</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#f4f4f3;color:#141414;
  font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-text-size-adjust:100%}
.w{max-width:1000px;margin:0 auto;padding:0 16px 56px}
header.top{background:#141414;color:#fff;padding:28px 0 24px;margin-bottom:24px;
  border-bottom:4px solid #d0342c}
header.top .w{padding-bottom:0}
.marca{display:flex;align-items:center;gap:10px;margin-bottom:18px}
.logo{width:34px;height:34px;border-radius:8px;background:#d0342c;color:#fff;font-weight:900;
  display:grid;place-items:center;font-size:13px}
h1{margin:0;font-size:26px;letter-spacing:-.02em}
.top p{margin:6px 0 0;color:#bdbdbd;font-size:14px}
h2{margin:0;font-size:21px;letter-spacing:-.01em}
h3{margin:0 0 12px;font-size:15px}
h4{margin:22px 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#d0342c}
.c{background:#fff;border:1px solid #e3e2e0;border-radius:12px;padding:18px;margin-bottom:16px}
.c .tw{margin:0}
.ks{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px}
.k{background:#fff;border:1px solid #e3e2e0;border-radius:12px;padding:14px}
.ke{margin:0;font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#8a8783;font-weight:700}
.kv{margin:6px 0 0;font-size:22px;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.ka{margin:3px 0 0;font-size:12px;color:#8a8783}
table.b{width:100%;border-collapse:collapse}
table.b th{text-align:left;font-weight:500;font-size:13px;padding:4px 10px 4px 0;white-space:nowrap;width:1%}
table.b td{padding:4px 0}
table.b td.n{text-align:right;font-variant-numeric:tabular-nums;font-weight:700;width:1%;padding-left:10px}
.ba{display:block;height:9px;border-radius:4px;background:#d0342c;min-width:2px}
.ev{background:#fff;border:1px solid #e3e2e0;border-radius:12px;margin-bottom:18px;overflow:hidden}
.evh{background:#141414;color:#fff;padding:20px}
.evh .cod{margin:0;font:600 11px/1 ui-monospace,monospace;letter-spacing:.1em;color:#9a9a9a}
.evh h2{margin:6px 0 0}
.evh .sub{margin:8px 0 0;color:#d4d4d4;font-size:14px}
.evh .sub2{margin:2px 0 0;color:#9a9a9a;font-size:13px}
.evk{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));
  border-bottom:1px solid #e3e2e0}
.evk .k{border:0;border-right:1px solid #e3e2e0;border-radius:0;background:#fff}
.evk .k:last-child{border-right:0}
.evk .kv{font-size:17px}
.ev h4,.ev .dl,.ev .g,.ev .tx{margin-left:20px;margin-right:20px}
.dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.dl dt{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#8a8783;font-weight:700}
.dl dd{margin:3px 0 0;font-weight:600;font-size:14px}
.tw{margin:0 20px 4px;overflow-x:auto;-webkit-overflow-scrolling:touch}
table.t{width:100%;border-collapse:collapse;font-size:13px;min-width:460px}
table.t th,table.t td{padding:7px 8px;border-bottom:1px solid #eceae8;text-align:left}
table.t thead th{background:#faf9f8;font-size:10px;text-transform:uppercase;
  letter-spacing:.08em;color:#8a8783}
table.t .n{text-align:right;font-variant-numeric:tabular-nums}
table.t tfoot th{background:#faf9f8;border-top:2px solid #e3e2e0;border-bottom:0;font-weight:800}
.tx{font-size:14px;color:#3a3a3a}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;
  margin-bottom:20px}
.g figure{margin:0}
.g img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px;border:1px solid #e3e2e0;
  cursor:zoom-in;background:#eee}
.g figcaption{font-size:11px;color:#8a8783;margin-top:4px;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.pie{text-align:center;color:#8a8783;font-size:12px;margin-top:28px}
dialog{border:0;background:transparent;padding:0;max-width:96vw;max-height:96vh}
dialog::backdrop{background:rgba(0,0,0,.85)}
dialog img{max-width:96vw;max-height:96vh;border-radius:8px;display:block}
@media(max-width:600px){
  .ev h4,.ev .dl,.ev .g,.ev .tx{margin-left:14px;margin-right:14px}
  .tw{margin-left:14px;margin-right:14px}
  table.t{font-size:12px}
  h1{font-size:21px}.evh h2{font-size:18px}
}
@media print{
  body{background:#fff}.ev,.c,.k{break-inside:avoid;border-color:#ccc}
  header.top{background:#141414!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
</style></head><body>

<header class="top"><div class="w">
  <div class="marca"><div class="logo">CH</div><strong>CHOHO</strong></div>
  <h1>${esc(titulo)}</h1>
  <p>${esc(rango)} · ${eventos.length} evento${eventos.length === 1 ? "" : "s"}
     · generado el ${esc(fechaCorta(new Date().toISOString()))}</p>
</div></header>

<div class="w">
  <div class="ks">
    ${tarjeta("Eventos", num(eventos.length))}
    ${tarjeta("Ciudades", num(new Set(eventos.map((e) => e.ciudad).filter(Boolean)).size))}
    ${tarjeta("Asistentes", num(suma(eventos.map((e) => e.asistentes ?? 0))))}
    ${tarjeta("Material POP utilizado", num(popUtil), `de ${num(popLlevado)} llevadas`)}
    ${tarjeta("Gasto POP", money(gastoPop))}
    ${tarjeta("Gastos adicionales", money(gastoAdic))}
    ${tarjeta("Gasto total", money(gastoPop + gastoAdic))}
  </div>

  ${matPorTipo.length ? `<section class="c"><h3>Total por material</h3>
    <div class="tw"><table class="t"><thead><tr><th>Material</th>
    <th class="n">Llevado</th><th class="n">Utilizado</th><th class="n">Sobrante</th>
    <th class="n">% Util.</th><th class="n">Gasto</th></tr></thead><tbody>
    ${matPorTipo.map((m) => `<tr><td>${esc(m.material)}</td>
      <td class="n">${num(m.llevada)}</td><td class="n"><b>${num(m.utilizada)}</b></td>
      <td class="n">${num(m.sobrante)}</td>
      <td class="n">${pct(m.llevada ? m.utilizada / m.llevada : null, 1)}</td>
      <td class="n">${money(m.gasto)}</td></tr>`).join("")}
    </tbody><tfoot><tr><th>TOTAL</th><th class="n">${num(popLlevado)}</th>
      <th class="n">${num(popUtil)}</th><th class="n">${num(popLlevado - popUtil)}</th>
      <th class="n">${pct(popLlevado ? popUtil / popLlevado : null, 1)}</th>
      <th class="n">${money(gastoPop)}</th></tr></tfoot></table></div></section>` : ""}

  ${eventos.length ? barras("Eventos por ciudad", agrupar("ciudad"),
      Math.max(...agrupar("ciudad").map((x) => x[1]))) : ""}
  ${eventos.length ? barras("Eventos por responsable", agrupar("responsable"),
      Math.max(...agrupar("responsable").map((x) => x[1]))) : ""}

  ${eventos.map(fichaEvento).join("")}

  <p class="pie">CHOHO Colombia · Documento generado desde CHOHO Eventos.<br>
  Es una copia para consulta: no se actualiza sola.</p>
</div>

<dialog id="lupa"><img alt=""></dialog>
<script>
// Ampliar las fotografías al tocarlas
var d=document.getElementById("lupa"), i=d.querySelector("img");
document.querySelectorAll(".g img").forEach(function(x){
  x.addEventListener("click",function(){ i.src=x.src; i.alt=x.alt; d.showModal(); });
});
d.addEventListener("click",function(){ d.close(); });
</script>
</body></html>`;

  const marca = new Date().toISOString().slice(0, 10);
  return {
    html,
    nombre: `CHOHO-Informe-${marca}.html`,
    fotos: fotos.size,
  };
}
