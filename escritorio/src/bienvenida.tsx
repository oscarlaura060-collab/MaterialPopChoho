import React from "react";
import { Aviso } from "@/components/ui";

export function Bienvenida({
  estado, onElegir, onPermitir, error, carpeta, ocupado,
}: {
  estado: "ninguna" | "permiso";
  onElegir: () => void;
  onPermitir: () => void;
  error: string | null;
  carpeta: string | null;
  ocupado: boolean;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-choho-black p-10 lg:flex">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-choho-red font-black text-white">CH</div>
          <span className="text-lg font-bold text-white">CHOHO</span>
        </div>
        <div>
          <h1 className="text-4xl font-black leading-tight text-white">
            Eventos<br /><span className="text-choho-red">realizados</span>
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-neutral-400">
            Todo se guarda en una carpeta de tu computador. Sin internet, sin cuentas
            y sin depender de nadie más.
          </p>
        </div>
        <p className="text-xs text-neutral-500">CHOHO Colombia · Uso interno</p>
      </div>

      <div className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-md space-y-5">
          <div className="lg:hidden mb-2 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-choho-red font-black text-white">CH</div>
            <span className="text-lg font-bold">CHOHO · Eventos</span>
          </div>

          {estado === "permiso" ? (
            <>
              <div>
                <h2 className="text-2xl font-black tracking-tight">Continuar donde quedaste</h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Tu carpeta es <strong>{carpeta}</strong>. Por seguridad, el navegador
                  pide tu permiso cada vez que se abre la aplicación.
                </p>
              </div>
              {error && <Aviso tipo="error">{error}</Aviso>}
              <button className="btn-primario w-full" onClick={onPermitir} disabled={ocupado}>
                {ocupado ? "Abriendo…" : `Abrir "${carpeta}"`}
              </button>
              <button className="w-full text-center text-sm text-neutral-500 hover:text-neutral-800"
                      onClick={onElegir} disabled={ocupado}>
                Usar otra carpeta
              </button>
            </>
          ) : (
            <>
              <div>
                <h2 className="text-2xl font-black tracking-tight">Elige dónde guardar</h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Escoge una carpeta de tu computador. Ahí se guardarán los eventos y
                  las fotografías, y podrás respaldarla o ponerla en OneDrive.
                </p>
              </div>
              {error && <Aviso tipo="error">{error}</Aviso>}
              <button className="btn-primario w-full" onClick={onElegir} disabled={ocupado}>
                {ocupado ? "Un momento…" : "📁 Elegir carpeta"}
              </button>
              <div className="rounded-lg bg-neutral-50 p-4 text-xs leading-relaxed text-neutral-600 ring-1 ring-neutral-200">
                <p className="font-semibold text-neutral-800">Qué se crea en esa carpeta</p>
                <ul className="mt-2 space-y-1">
                  <li><code className="font-mono">eventos.json</code> — toda la información</li>
                  <li><code className="font-mono">anexos/</code> — las fotografías por evento</li>
                  <li><code className="font-mono">respaldos/</code> — copias fechadas automáticas</li>
                </ul>
                <p className="mt-3">
                  Si ya tienes una carpeta de trabajo, vuelve a elegirla y se abrirá con
                  toda tu información.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function NoSoportado() {
  return (
    <div className="grid min-h-screen place-items-center bg-white p-6">
      <div className="max-w-lg space-y-4 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-choho-red font-black text-white">CH</div>
        <h1 className="text-xl font-black">Abre esta aplicación en Chrome o Edge</h1>
        <p className="text-sm leading-relaxed text-neutral-600">
          Para poder guardar en una carpeta de tu computador, la aplicación necesita
          <strong> Google Chrome</strong> o <strong>Microsoft Edge</strong> en un
          computador de escritorio. Firefox, Safari y los navegadores de celular
          todavía no permiten esta función.
        </p>
        <p className="text-sm text-neutral-600">
          Haz clic derecho sobre el archivo <code className="font-mono">CHOHO-Eventos.html</code> →
          <em> Abrir con</em> → <strong>Chrome</strong> o <strong>Edge</strong>.
        </p>
        <p className="text-xs text-neutral-500">
          Los informes que compartas sí se abren en cualquier navegador y en el celular.
        </p>
      </div>
    </div>
  );
}
