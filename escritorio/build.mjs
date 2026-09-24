/**
 * Empaqueta toda la aplicación en UN SOLO archivo: dist/CHOHO-Eventos.html
 * Sin dependencias externas, sin internet, listo para doble clic.
 */
import esbuild from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const tmp = resolve(aqui, ".tmp");
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });

/* 1 · Estilos con Tailwind, a partir del mismo CSS de la versión web */
console.log("· Compilando estilos…");
const entradaCss = resolve(tmp, "entrada.css");
writeFileSync(entradaCss, readFileSync(resolve(aqui, "../eventos/src/app/globals.css"), "utf8"));
const salidaCss = resolve(tmp, "estilos.css");
execFileSync("npx", [
  "tailwindcss",
  "-c", resolve(aqui, "tailwind.config.cjs"),
  "-i", entradaCss,
  "-o", salidaCss,
  "--minify",
], { stdio: ["ignore", "ignore", "inherit"], cwd: aqui });
const css = readFileSync(salidaCss, "utf8");

/* 2 · JavaScript: React, gráficos, Excel y PDF en un solo paquete */
console.log("· Empaquetando la aplicación…");
const alias = {
  "next/link": resolve(aqui, "src/shim/link.tsx"),
  "next/navigation": resolve(aqui, "src/shim/navegacion.ts"),
  // Una sola copia de React: el código compartido vive en otra carpeta con
  // sus propios node_modules, y dos copias rompen los hooks.
  "react": resolve(aqui, "node_modules/react"),
  "react-dom": resolve(aqui, "node_modules/react-dom"),
  "react/jsx-runtime": resolve(aqui, "node_modules/react/jsx-runtime.js"),
  "recharts": resolve(aqui, "node_modules/recharts"),
};

const SHIM_SUPABASE = resolve(aqui, "src/shim/supabase.ts");

/**
 * El código compartido con la versión web importa el cliente de Supabase
 * tanto por "@/lib/supabase" como por "./supabase". Ambas formas se
 * redirigen a la carpeta local.
 */
const usarCarpetaLocal = {
  name: "usar-carpeta-local",
  setup(build) {
    build.onResolve({ filter: /(^|\/)supabase$/ }, (args) => {
      if (args.path === "@/lib/supabase" || /[\\/]lib[\\/]?$/.test(args.resolveDir) ||
          args.resolveDir.includes("eventos")) {
        return { path: SHIM_SUPABASE };
      }
      return null;
    });
  },
};

const r = await esbuild.build({
  entryPoints: [resolve(aqui, "src/main.tsx")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["chrome110", "edge110"],
  jsx: "automatic",
  minify: true,
  legalComments: "none",
  write: false,
  alias,
  plugins: [usarCarpetaLocal],
  define: { "process.env.NODE_ENV": '"production"' },
  // Varias librerías (ExcelJS, jsPDF) esperan estos globales de Node
  banner: {
    js: [
      "var global=globalThis;",
      "var process=globalThis.process||{env:{NODE_ENV:'production'},browser:true,",
      "version:'',versions:{},platform:'browser',argv:[],",
      "nextTick:function(f){Promise.resolve().then(f)},cwd:function(){return '/'},",
      "on:function(){},emit:function(){}};",
    ].join(""),
  },
  loader: { ".png": "dataurl", ".svg": "dataurl" },
  tsconfigRaw: {
    compilerOptions: {
      jsx: "react-jsx",
      baseUrl: aqui,
      paths: { "@/*": ["../eventos/src/*"] },
    },
  },
});
const js = r.outputFiles[0].text;

/* 3 · Un solo HTML con todo dentro */
const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CHOHO · Eventos</title>
<meta name="color-scheme" content="light">
<style>${css}</style>
</head>
<body>
<div id="raiz"></div>
<noscript style="display:block;padding:24px;font:15px system-ui">
  Esta aplicación necesita JavaScript. Ábrela con Google Chrome o Microsoft Edge.
</noscript>
<script>${js}</script>
</body>
</html>`;

const destino = resolve(aqui, "CHOHO-Eventos.html");
writeFileSync(destino, html);
rmSync(tmp, { recursive: true, force: true });

const mb = (Buffer.byteLength(html) / 1024 / 1024).toFixed(2);
console.log(`\n✓ CHOHO-Eventos.html — ${mb} MB (un solo archivo)`);
