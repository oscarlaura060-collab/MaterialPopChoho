"use client";

import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Defínelas en Vercel → Settings → Environment Variables."
  );
}

/**
 * Cliente único del navegador. Todas las tablas viven en el esquema `eventos`,
 * aislado del resto del proyecto Supabase.
 */
export const supabase = createBrowserClient(url, key, {
  db: { schema: "eventos" },
});

/** Cliente sobre el esquema `storage` no hace falta: storage va aparte */
export const BUCKET = "eventos-anexos";
