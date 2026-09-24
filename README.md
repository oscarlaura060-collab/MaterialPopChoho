# CHOHO POP — Control de Material POP

Sistema interno de CHOHO Colombia para registrar entregas de material POP,
verificar cuánto se instaló y guardar evidencia fotográfica/de video por zona.

Originalmente construido en Google Apps Script + Google Sheets + Google Drive,
**migrado a Vercel + Supabase**:

| Antes (Apps Script)        | Ahora                                   |
| -------------------------- | --------------------------------------- |
| Google Sheets              | Supabase (PostgreSQL)                   |
| Google Drive               | Supabase Storage (bucket `evidencias`)  |
| HTML servido por Apps Script | Frontend estático en Vercel           |
| `google.script.run`        | `/api/rpc` (funciones serverless) + shim |

> **Nota:** este repositorio contiene además **CHOHO · Eventos**, la aplicación
> que reemplaza el libro `EVENTOS REALIZADOS.xlsx`. Hay dos versiones:
>
> - [`escritorio/`](escritorio/) — **la que se usa.** Un solo archivo
>   `CHOHO-Eventos.html` que se abre con doble clic y guarda todo en una
>   carpeta del computador. Sin servidor ni cuentas. Ver
>   [`escritorio/README.md`](escritorio/README.md).
> - [`eventos/`](eventos/) — la misma aplicación como sitio web sobre Supabase,
>   por si en el futuro se quiere un enlace en vivo para los jefes. No está
>   desplegada. Ver [`eventos/README.md`](eventos/README.md).

## Arquitectura

```
Navegador (index.html / campo.html)
   │  google.script.run.<fn>(args)   ← shim en gas-shim.js
   ▼
POST /api/rpc  { fn, args }          ← función serverless (api/rpc.js)
   ▼
lib/services.js  (lógica de negocio) ← usa la SERVICE ROLE key
   ▼
Supabase: PostgreSQL + Storage
```

El shim `gas-shim.js` reimplementa la API `google.script.run` de Apps Script
sobre `fetch()`, así que el frontend heredado (`app.js`, `campo.js`) funciona
sin cambios.

## Estructura

```
index.html        Panel de administración (SPA)
campo.html        Modo de campo para móvil (/campo)
styles.css        Estilos compartidos
app.js            Lógica del panel admin
campo.js          Lógica del modo de campo
gas-shim.js       Puente google.script.run -> /api/rpc
api/rpc.js        Único endpoint del backend (despachador)
lib/
  supabase.js     Cliente Supabase (service role, solo servidor)
  util.js         Fechas Colombia, IDs, log
  mappers.js      Traducción filas Postgres <-> claves del frontend
  services.js     Toda la lógica de negocio (entregas, verificación, etc.)
supabase/         Notas de esquema (las migraciones ya están aplicadas)
```

## Variables de entorno (Vercel)

En **Vercel → Project → Settings → Environment Variables** define:

| Variable                    | Valor                                                        |
| --------------------------- | ----------------------------------------------------------- |
| `SUPABASE_URL`              | `https://pktodvupphauresqsxfb.supabase.co`                  |
| `SUPABASE_SERVICE_ROLE_KEY` | La *service_role* key (Supabase → Settings → API). **Secreta.** |

> La `service_role` key hace bypass de RLS y **solo** vive en el servidor.
> Nunca se envía al navegador. Las tablas tienen RLS activado sin políticas
> públicas, de modo que la `anon` key no puede leer ni escribir.

## Base de datos

El esquema (10 tablas + generador de IDs `ENT-2026-00001` + bucket
`evidencias`) ya está aplicado en el proyecto Supabase `MaterialPopChoho`.
El catálogo base (4 zonas y 11 materiales) viene sembrado.

Para crear personas encargadas y asignarles un **código de acceso**, usa el
panel admin → "Personas encargadas". Con ese código ingresan al **modo de
campo** en `/campo`.

## Desarrollo local

```bash
npm install
npm i -g vercel        # una vez
vercel dev             # levanta frontend + /api con las env vars del proyecto
```

## Despliegue

Cada push a la rama de producción despliega automáticamente en Vercel
(si el proyecto está conectado a este repositorio de GitHub). Asegúrate de
tener configuradas las dos variables de entorno antes del primer despliegue.
