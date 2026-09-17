/**
 * lib/supabase.js
 * Cliente de Supabase para el lado servidor (funciones serverless de Vercel).
 *
 * Usa la SERVICE ROLE key, que hace bypass de las políticas RLS. Esta key es
 * secreta y SOLO vive en el servidor (variables de entorno de Vercel); nunca
 * se envía al navegador.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!url || !serviceKey) {
  // El error se lanzará al primer uso, con un mensaje claro para configurar Vercel.
  console.error(
    'Faltan variables de entorno: SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY.'
  );
}

export const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const BUCKET_EVIDENCIAS = 'evidencias';
