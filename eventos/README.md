# CHOHO · Eventos

Aplicación web que reemplaza el libro **EVENTOS REALIZADOS.xlsx**: una sola
fuente de información en Supabase, un dashboard ejecutivo para los jefes y
formularios para registrar eventos, material POP, gastos, personal, resultados
y fotografías.

> No maneja presupuesto. El costo del material POP se trata como **gasto**,
> igual que en el Excel.

```
Formulario web  →  Supabase (PostgreSQL + Storage)  →  Dashboard  →  Jefes
```

> **¿Buscas la versión que se usa hoy?** Está en [`../escritorio/`](../escritorio/):
> un solo archivo que se abre con doble clic y guarda todo en una carpeta del
> computador, sin servidor ni cuentas. Esta versión web queda disponible por si
> más adelante se quiere un enlace en vivo.

---

## Cómo se convirtió el Excel

| Hoja del Excel | En la aplicación |
| --- | --- |
| RESUMEN EJECUTIVO | **Dashboard** — los indicadores se recalculan sobre los datos, no se importan |
| EVENTOS | Tabla **Eventos** + ficha individual de cada evento |
| PERSONAL | **Personal**, con los contadores resueltos desde Participación |
| PARTICIPACIÓN | Bloque *Personal* dentro del formulario y de la ficha del evento |
| MATERIAL POP | **Material POP** + bloque en la ficha |
| GASTOS | **Gastos adicionales** |
| RESULTADOS | **Resultados** |
| LISTAS | Tabla `eventos.listas` + catálogo `eventos.materiales`; alimenta todos los desplegables |
| ANEXOS | Esa hoja era un reporte de participación por persona, que hoy vive en **Personal**. La sección **Anexos** es nueva: galería de fotografías y documentos |

### Fórmulas que se conservaron

Las columnas calculadas del Excel se reprodujeron en la base de datos, así que
el resultado es idéntico:

| Excel | Aplicación |
| --- | --- |
| `CANTIDAD UTILIZADA = LLEVADA − SOBRANTE` | columna generada en `material_pop` |
| `% UTILIZACIÓN = UTILIZADA / LLEVADA` | columna generada |
| `GASTO MATERIAL = LLEVADA × COSTO UNITARIO` | **cambiado:** `UTILIZADA × COSTO UNITARIO` (columna generada); `valor_llevado` conserva el original |
| `COSTO UNITARIO` por `INDEX/MATCH` en el catálogo | trigger `aplicar_costo_unitario` |
| `GASTO POP = SUMIFS(MATERIAL POP)` | vista `v_eventos` |
| `GASTOS ADICIONALES = SUMIFS(GASTOS)` | vista `v_eventos` |
| `GASTO TOTAL = GASTO POP + GASTOS ADICIONALES` | vista `v_eventos` |
| `DÍA = CHOOSE(WEEKDAY(fecha,2), …)` | vista `v_eventos` |
| `HORAS = MOD(salida − ingreso, 1)` | vistas `v_participacion` y `v_personal` |
| Contadores de `PERSONAL` por `COUNTIFS` | vista `v_personal` |

**Importante:** en el Excel se captura la *cantidad sobrante* y la *utilizada*
se deduce. La aplicación hace lo mismo: tú registras **llevada** y **sobrante**.

El gasto, en cambio, ya no es el del Excel: cuenta solo el material
**utilizado**, porque lo sobrante vuelve a bodega. El valor de lo movilizado
queda en `valor_llevado` / `pop_valor_llevado`.

---

## Estructura

```
eventos/
├── src/app/                 Páginas (App Router)
│   ├── page.tsx             Dashboard
│   ├── eventos/             Tabla, ficha, nuevo y editar
│   ├── personal/  material-pop/  gastos/  resultados/  anexos/
│   ├── configuracion/       Importar Excel, catálogos, usuarios
│   └── login/
├── src/components/          Shell, filtros, KPIs, tablas, galería, formulario
├── src/lib/
│   ├── store.tsx            Carga los datos una vez y deriva todos los indicadores
│   ├── types.ts             Tipos 1:1 con las hojas del Excel
│   ├── constants.ts         Catálogos de respaldo y paleta de los gráficos
│   ├── exportar.ts          Excel (ExcelJS) y PDF del evento (jsPDF)
│   └── importar.ts          Lectura de EVENTOS REALIZADOS.xlsx
└── supabase/migrations/     Esquema, vistas, RLS, catálogos y datos
```

---

## Base de datos

Todo vive en el esquema **`eventos`**, aislado del resto del proyecto Supabase.

```
listas · materiales · parametros
personas ──┐
           ├── participacion ──┐
eventos ───┼── material_pop    ├── (todas por evento_id)
           ├── gastos          │
           ├── resultados      │
           └── anexos ─────────┘
usuarios (rol: ADMINISTRADOR | JEFE)
```

Vistas de lectura: `v_eventos`, `v_personal`, `v_participacion`,
`v_material_pop`, `v_gastos`, `v_resultados`.

### Roles

| | ADMINISTRADOR | JEFE |
| --- | --- | --- |
| Ver dashboard, fichas, filtros, fotos | ✅ | ✅ |
| Exportar Excel y PDF | ✅ | ✅ |
| Crear y editar eventos | ✅ | ❌ |
| Registrar material, gastos, personal, resultados | ✅ | ❌ |
| Subir y borrar anexos | ✅ | ❌ |
| Importar Excel y cambiar roles | ✅ | ❌ |

El **primer usuario que se registra queda como ADMINISTRADOR**; los demás
entran como JEFE y un administrador puede promoverlos desde *Configuración*.
Las políticas RLS aplican esto en la base de datos, no solo en la interfaz.

---

## Puesta en marcha

### 1 · Supabase

Las migraciones de `supabase/migrations/` **ya están aplicadas** en el proyecto
`MaterialPopChoho` (`pktodvupphauresqsxfb`), junto con los datos del Excel.

Para montarlo en un proyecto nuevo, ejecútalas en orden en el **SQL Editor**:

```
0001_esquema.sql
0002_vistas.sql
0003_rls_y_storage.sql
0004_catalogos.sql
0005_datos_excel.sql   (opcional: también puedes importar el Excel desde la app)
```

Después verifica en **Settings → API → Exposed schemas** que aparezca `eventos`
junto a `public`. La migración `0003` lo configura, pero si alguien edita esa
pantalla, el valor se sobrescribe.

### 2 · Vercel

La aplicación vive en la subcarpeta `eventos/` de este repositorio, así que se
despliega como un **proyecto de Vercel aparte** del panel de material POP:

1. **Add New → Project** y elige este repositorio.
2. En **Root Directory** selecciona `eventos`.
3. Framework: *Next.js* (se detecta solo).
4. Variables de entorno:

| Variable | Valor |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://pktodvupphauresqsxfb.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la *publishable key* (Supabase → Settings → API) |

5. **Deploy**. Queda una URL pública tipo `https://eventos-choho.vercel.app`,
   que se abre desde cualquier computador, celular o tablet sin instalar nada.

> Ambas claves son públicas por diseño: el acceso real lo controlan Supabase
> Auth y las políticas RLS. La `service_role` **no** se usa en esta aplicación.

### 3 · Primer ingreso

Abre la URL, entra a **Crear cuenta** y registra tu correo: esa primera cuenta
queda como administrador. Luego cada jefe crea la suya y entra como JEFE.

---

## Desarrollo local

```bash
cd eventos
npm install
cp .env.example .env.local     # completa NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev                    # http://localhost:3000
npm run build                  # compilación de producción
npm run lint                   # typecheck
```

---

## Importar y exportar

**Importar** (*Configuración → Importar Excel*): lee las hojas EVENTOS,
PERSONAL, PARTICIPACIÓN, MATERIAL POP, GASTOS, RESULTADOS y LISTAS. Cruza por
**ID EVENTO**, de modo que volver a cargar el mismo archivo *actualiza* en vez
de duplicar; las filas hijas de cada evento importado se reemplazan por las del
archivo. Entiende fechas y horas en formato serial de Excel y valores con
separador de miles colombiano.

**Exportar:**

- *Eventos* → libro de Excel con las 6 hojas de los eventos filtrados.
- *Material POP*, *Gastos*, *Resultados*, *Personal* → su hoja por separado.
- Ficha de un evento → **PDF** con formato de informe corporativo.

Todas las exportaciones respetan los filtros activos.

---

## Notas de diseño

- **Un solo juego de datos.** `store.tsx` carga todo una vez y deriva los
  indicadores en memoria, así que cambiar un filtro actualiza el dashboard
  completo sin volver a consultar.
- **Catálogos centralizados.** Ninguna pantalla escribe listas de valores: todo
  sale de `eventos.listas` con respaldo en `constants.ts`.
- **Paleta de los gráficos** validada para daltonismo (peor par CVD ΔE 9,1 ·
  visión normal ΔE 22,9, todos los pares, modo claro). Los colores de menor
  contraste llevan siempre etiqueta directa y vista de tabla, y ninguna serie
  se identifica solo por color.
- **Responsive.** Menú lateral fijo en escritorio y deslizante en celular; las
  tablas ocultan las columnas secundarias en pantallas pequeñas.
