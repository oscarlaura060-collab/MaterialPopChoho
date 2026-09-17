/**
 * api/rpc.js
 * Único punto de entrada del backend. Recibe { fn, args } desde el frontend
 * (a través del shim google.script.run) y ejecuta la función de negocio
 * correspondiente contra Supabase.
 *
 * Respuesta:
 *   200 { data: <resultado> }      en caso de éxito
 *   4xx/5xx { error: "<mensaje>" }  en caso de error
 */
import { handlers } from '../lib/services.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido. Usa POST.' });
  }

  if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)) {
    return res.status(500).json({
      error:
        'El servidor no está configurado: faltan las variables de entorno SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en Vercel.',
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body || '{}');
    } catch (e) {
      return res.status(400).json({ error: 'Cuerpo JSON inválido.' });
    }
  }
  body = body || {};

  const fn = body.fn;
  const args = Array.isArray(body.args) ? body.args : [];

  if (!fn || typeof fn !== 'string') {
    return res.status(400).json({ error: 'Falta el nombre de la función (fn).' });
  }
  if (!Object.prototype.hasOwnProperty.call(handlers, fn) || typeof handlers[fn] !== 'function') {
    return res.status(400).json({ error: 'Función no reconocida: ' + fn });
  }

  try {
    const data = await handlers[fn](...args);
    return res.status(200).json({ data: data === undefined ? null : data });
  } catch (err) {
    console.error('Error en rpc[' + fn + ']:', err);
    const msg = err && err.message ? err.message : String(err);
    return res.status(400).json({ error: msg });
  }
}

export const config = {
  api: {
    bodyParser: { sizeLimit: '60mb' }, // evidencias en base64 pueden ser grandes
  },
};
