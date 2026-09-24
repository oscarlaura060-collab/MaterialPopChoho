"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Aviso } from "@/components/ui";

export default function Login() {
  const router = useRouter();
  const [modo, setModo] = useState<"entrar" | "crear">("entrar");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [nombre, setNombre] = useState("");
  const [msg, setMsg] = useState<{ t: "error" | "ok"; x: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setMsg(null);
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: clave });
        if (error) throw error;
        router.replace("/");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password: clave, options: { data: { nombre } },
        });
        if (error) throw error;
        if (data.session) router.replace("/");
        else setMsg({ t: "ok", x: "Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión." });
      }
    } catch (err) {
      const t = err instanceof Error ? err.message : "No fue posible completar la operación.";
      setMsg({
        t: "error",
        x: t.includes("Invalid login") ? "Correo o contraseña incorrectos." : t,
      });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Panel de marca */}
      <div className="hidden flex-col justify-between bg-choho-black p-10 lg:flex">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-choho-red font-black text-white">
            CH
          </div>
          <span className="text-lg font-bold text-white">CHOHO</span>
        </div>
        <div>
          <h1 className="text-4xl font-black leading-tight text-white">
            Eventos<br />
            <span className="text-choho-red">realizados</span>
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-neutral-400">
            Material POP, gastos, personal, resultados y evidencia fotográfica de cada
            evento, en un solo lugar y actualizado para todos.
          </p>
        </div>
        <p className="text-xs text-neutral-500">CHOHO Colombia · Uso interno</p>
      </div>

      {/* Formulario */}
      <div className="flex items-center justify-center bg-white px-6 py-12">
        <form onSubmit={enviar} className="w-full max-w-sm space-y-4">
          <div className="lg:hidden">
            <div className="mb-6 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-choho-red font-black text-white">
                CH
              </div>
              <span className="text-lg font-bold">CHOHO · Eventos</span>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-black tracking-tight">
              {modo === "entrar" ? "Ingresar" : "Crear cuenta"}
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              {modo === "entrar"
                ? "Accede con tu correo corporativo."
                : "El primer usuario registrado queda como administrador."}
            </p>
          </div>

          {msg && <Aviso tipo={msg.t}>{msg.x}</Aviso>}

          {modo === "crear" && (
            <div>
              <label className="etiqueta" htmlFor="nombre">Nombre</label>
              <input id="nombre" className="campo" value={nombre}
                     onChange={(e) => setNombre(e.target.value)} required autoComplete="name" />
            </div>
          )}

          <div>
            <label className="etiqueta" htmlFor="email">Correo</label>
            <input id="email" type="email" className="campo" value={email}
                   onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>

          <div>
            <label className="etiqueta" htmlFor="clave">Contraseña</label>
            <input id="clave" type="password" className="campo" value={clave}
                   onChange={(e) => setClave(e.target.value)} required minLength={6}
                   autoComplete={modo === "entrar" ? "current-password" : "new-password"} />
          </div>

          <button type="submit" className="btn-primario w-full" disabled={enviando}>
            {enviando ? "Un momento…" : modo === "entrar" ? "Ingresar" : "Crear cuenta"}
          </button>

          <button
            type="button"
            className="w-full text-center text-sm text-neutral-500 hover:text-neutral-800"
            onClick={() => { setModo(modo === "entrar" ? "crear" : "entrar"); setMsg(null); }}
          >
            {modo === "entrar" ? "¿No tienes cuenta? Crear una" : "Ya tengo cuenta · Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
