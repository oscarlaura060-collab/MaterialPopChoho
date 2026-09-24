# CHOHO · Eventos — versión de escritorio

Un **solo archivo** que abres con doble clic. Guarda todo en una carpeta de tu
computador, sin internet, sin cuentas y sin depender de nadie más. Cuando
quieras mostrarle algo a los jefes, generas un informe y se lo envías por
WhatsApp o correo.

```
Tú registras  →  carpeta de tu PC  →  informe .html  →  los jefes lo abren en el celular
```

---

## Cómo se usa

1. Descarga **`CHOHO-Eventos.html`** y guárdalo donde quieras (por ejemplo, el Escritorio).
2. Haz **doble clic**. Se abre en Chrome o Edge.
3. La primera vez, pulsa **Elegir carpeta** y escoge dónde guardar
   (por ejemplo `Documentos\CHOHO Eventos`). El navegador te pedirá confirmar.
4. Ya puedes registrar eventos. Todo se guarda solo.

> Cada vez que vuelvas a abrir la aplicación, el navegador te pedirá permiso
> sobre la carpeta con un clic. Es una medida de seguridad de Chrome, no un
> error.

### Qué se crea en tu carpeta

```
CHOHO Eventos/
├── eventos.json                  toda la información
├── anexos/
│   └── EV-001/foto.jpg           las fotografías, por evento
├── respaldos/
│   └── eventos-2026-09-24-10-30.json
└── CHOHO-Informe-2026-09-24.html los informes que generas
```

`eventos.json` es un archivo de texto normal: puedes copiarlo, respaldarlo o
poner toda la carpeta dentro de OneDrive para tener copia automática.

---

## Compartir con los jefes

En la sección **📤 Compartir**:

1. Filtra los eventos que quieras incluir (mes, ciudad, responsable…).
2. Ponle un título, por ejemplo *"Eventos de septiembre 2026"*.
3. Pulsa **Guardar en mi carpeta**.
4. Adjunta el archivo generado en WhatsApp, Teams o un correo.

El jefe lo abre en su celular y ve el resumen, cada evento con su material POP,
gastos, personal, resultados y las fotografías. **No necesita instalar nada, ni
tener internet, ni una cuenta.** Tampoco puede modificarlo.

> El informe es una **copia del momento**: no se actualiza solo. Cuando
> registres eventos nuevos, genera y envía otro.

---

## Primera carga: tu Excel

En **⚙️ Configuración → Importar Excel**, carga `EVENTOS REALIZADOS.xlsx`.
Se leen las hojas EVENTOS, PERSONAL, PARTICIPACIÓN, MATERIAL POP, GASTOS,
RESULTADOS y LISTAS.

El cruce se hace por **ID EVENTO**, así que puedes volver a importar el mismo
archivo las veces que quieras: actualiza en vez de duplicar.

---

## Las fórmulas del Excel se conservan

| Excel | Aplicación |
| --- | --- |
| `CANTIDAD UTILIZADA = LLEVADA − SOBRANTE` | se calcula sola |
| `% UTILIZACIÓN = UTILIZADA / LLEVADA` | se calcula sola |
| `GASTO MATERIAL = LLEVADA × COSTO UNITARIO` | se calcula sola |
| `COSTO UNITARIO` buscado en el catálogo | se aplica al elegir el material |
| `GASTO POP = SUMIFS(MATERIAL POP)` | por evento |
| `GASTO TOTAL = GASTO POP + GASTOS ADICIONALES` | por evento |
| `DÍA = CHOOSE(WEEKDAY(fecha,2), …)` | se calcula sola |
| `HORAS = MOD(salida − ingreso)` | se calcula sola |
| Contadores de `PERSONAL` por `COUNTIFS` | se calculan solos |

Igual que en el Excel, **tú registras la cantidad llevada y la sobrante**; la
utilizada se deduce.

---

## Requisitos

- **Google Chrome** o **Microsoft Edge**, en un computador (Windows o Mac).
- Firefox y Safari todavía no permiten guardar en una carpeta, y los
  navegadores de celular tampoco. Los **informes** que compartes sí se abren
  en cualquier navegador y en el celular.

---

## Para volver a compilar el archivo

Solo hace falta si se cambia el código.

```bash
cd escritorio
npm install
npm run build      # genera CHOHO-Eventos.html
npm run lint       # typecheck
```

El empaquetado toma la interfaz de `../eventos/src` (la misma de la versión
web) y reemplaza el acceso a la base de datos por la carpeta local:

```
src/
├── archivos.ts          lee y escribe en la carpeta del usuario
├── vistas.ts            las fórmulas del Excel, calculadas en el navegador
├── shim/supabase.ts     misma forma de llamada que la versión web
├── shim/link.tsx        enlaces por # (sin Next.js)
├── shim/navegacion.ts   navegación por # (sin Next.js)
├── informe.ts           genera el .html autónomo para compartir
├── semilla.ts           catálogos iniciales de una carpeta nueva
└── main.tsx             elige la carpeta y arma la aplicación
```
