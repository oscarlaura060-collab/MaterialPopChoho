# CHOHO TASKS

**Gestión inteligente de actividades y seguimiento** — una aplicación web
personal tipo SaaS para responder de un vistazo: *¿Qué tengo que hacer? ¿Qué
está atrasado? ¿Qué estoy haciendo? ¿Qué terminé? ¿Cómo voy? ¿Qué resultados
puedo mostrar?*

Está construida **100 % con tecnologías del navegador** — HTML5, CSS3 y
JavaScript puro — y **guarda todos los datos localmente** (localStorage). **No
usa Google Apps Script, ni Supabase, ni ningún backend.** Solo necesitas abrir
el archivo `index.html`.

---

## 🚀 Cómo ejecutarla

### Opción 1 — Abrir el archivo directamente
1. Abre la carpeta `choho-tasks/`.
2. Haz doble clic en **`index.html`** (o arrástralo a Chrome).
3. ¡Listo!

### Opción 2 — Servidor local (recomendado)
Algunas funciones (como la vista compartida) funcionan mejor desde un servidor:

```bash
cd choho-tasks
python3 -m http.server 8080
# luego abre http://localhost:8080
```

O con Node:

```bash
npx serve choho-tasks
```

### 🔑 Credenciales de demostración
- **Correo:** `demo@choho.app`
- **Contraseña:** `choho123`

En la pantalla de login puedes pulsar *"usar credenciales de demostración"*
para rellenarlas automáticamente.

> ⚠️ **Nota de seguridad:** el inicio de sesión es un mecanismo **local de
> demostración** (las credenciales viven en tu navegador). **No es seguridad
> real** para un entorno público.

---

## 📂 Estructura del proyecto

```
choho-tasks/
├── index.html          # Aplicación principal (login + panel)
├── share.html          # Vista de solo lectura para compartir
├── README.md
├── css/
│   ├── style.css        # Núcleo: tokens, layout, componentes, login
│   ├── dashboard.css    # Vistas: dashboard, kanban, calendario, kpis...
│   └── responsive.css   # Adaptación móvil + tema de impresión
├── js/
│   ├── storage.js       # Capa de almacenamiento (localStorage)
│   ├── auth.js          # Autenticación local
│   ├── seed.js          # Datos de demostración
│   ├── ui.js            # Toasts, modales, confirmaciones
│   ├── metrics.js       # Cálculo de KPIs, filtros y agregaciones
│   ├── charts.js        # Gráficos (Chart.js + respaldo SVG)
│   ├── tasks.js         # Tareas: lista, kanban, formulario, detalle
│   ├── calendar.js      # Calendario mensual
│   ├── dashboard.js     # Panel principal
│   ├── projects.js      # Proyectos
│   ├── kpis.js          # Indicadores con filtros
│   ├── reports.js       # Informes, exportación CSV/PDF
│   ├── notifications.js # Centro de notificaciones
│   └── app.js           # Controlador principal (navegación, tema, perfil)
└── utils/
    └── helpers.js       # Utilidades: fechas, formato, DOM, cálculos
```

---

## ✨ Funcionalidades

- **Login** moderno con diseño a dos columnas, "Recordarme" y recuperación demo.
- **Dashboard** con 6 tarjetas KPI, 4 gráficos interactivos y sección **HOY**
  (atrasadas, vencen hoy, próximas, prioridad alta).
- **Mis tareas** en 3 vistas: **Lista**, **Kanban** (drag & drop) y **Calendario**.
- **Crear tarea** con propósito (*¿para qué?*), resultado esperado, proyecto,
  cliente, ciudad, prioridad, fechas y más.
- **Seguimiento de progreso** con historial de actualizaciones (fecha + % + comentario).
- **Detalle de tarea** en panel grande con evidencias e historial.
- **Kanban**: mover a *Completada* pone el avance a 100 % automáticamente.
- **Proyectos** con avance calculado automáticamente.
- **KPIs** de productividad, cumplimiento, tiempo y gestión, con **filtros**
  por mes, proyecto, categoría, prioridad, estado, responsable, cliente y ciudad.
- **Informes** por semana / mes / rango, con **exportación a PDF** (diálogo de
  impresión del navegador) y a **CSV/Excel**.
- **Compartir seguimiento**: genera una **vista de solo lectura** (`share.html`).
- **Perfil**, **notificaciones**, **búsqueda global**, **modo claro/oscuro**,
  **responsive** y copia de seguridad (exportar/importar JSON).

---

## 💾 Almacenamiento

Todo el acceso a datos pasa por `js/storage.js`. Hoy usa **localStorage**; la
interfaz (`createTask`, `getTasks`, `createProject`, …) está aislada del resto
de la aplicación, de modo que en el futuro podría cambiarse la implementación
interna sin reescribir la app. **Por defecto no depende de ningún servicio
externo.**

### Datos de demostración
En el primer inicio se crean automáticamente **6 proyectos** (Material POP,
Eventos, Avisos, Logística, Proveedores, Mercadeo) y **15 tareas** con estados y
avances variados. Puedes recargarlos o borrarlos desde **Configuración**.

---

## 🌐 Chart.js
Los gráficos usan **Chart.js** cargado por CDN. Si abres la app **sin conexión**,
la aplicación detecta la ausencia de Chart.js y dibuja un **respaldo en SVG**, de
modo que nunca se rompe.
