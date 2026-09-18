/* ==========================================================================
   CHOHO TASKS · seed.js
   Datos de demostración creados en el primer inicio para que el Dashboard
   se vea lleno y funcional desde el arranque.
   ========================================================================== */

(function (global) {
  'use strict';

  // Fecha relativa a hoy en formato YYYY-MM-DD
  function d(offsetDays) {
    const dt = new Date();
    dt.setHours(0, 0, 0, 0);
    dt.setDate(dt.getDate() + offsetDays);
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return dt.getFullYear() + '-' + mm + '-' + dd;
  }

  function iso(offsetDays) {
    const dt = new Date();
    dt.setDate(dt.getDate() + offsetDays);
    return dt.toISOString();
  }

  function seed() {
    if (Storage.isSeeded()) return;

    // ---- Proyectos ----
    const projectDefs = [
      { name: 'Material POP', color: '#4f6ef7' },
      { name: 'Eventos', color: '#ef476f' },
      { name: 'Avisos', color: '#f5a623' },
      { name: 'Logística', color: '#22c1a4' },
      { name: 'Proveedores', color: '#8b5cf6' },
      { name: 'Mercadeo', color: '#0ea5e9' }
    ];
    const projects = {};
    projectDefs.forEach(pd => {
      const p = Storage.createProject(pd);
      projects[pd.name] = p.id;
    });

    const R = 'Óscar Mora';

    // ---- Tareas ----
    const tasks = [
      {
        name: 'Gestionar instalación de avisos',
        purpose: 'Garantizar la instalación del material de visibilidad en los puntos de venta.',
        expectedResult: '10 avisos instalados y soportados.',
        project: 'Avisos', category: 'Instalación', priority: 'alta',
        start: -6, due: 2, status: 'en_progreso', progress: 70,
        client: 'Cadena Norte', city: 'Bogotá',
        notes: '6 de 10 avisos gestionados.',
        history: [
          { off: -6, p: 20, c: 'Se realizó levantamiento de puntos.' },
          { off: -3, p: 45, c: 'Se coordinó cuadrilla de instalación.' },
          { off: -1, p: 70, c: '6 avisos instalados y verificados.' }
        ]
      },
      {
        name: 'Gestionar transporte evento',
        purpose: 'Asegurar el traslado de material y personal al evento del 1° de Mayo.',
        expectedResult: 'Transporte confirmado y agendado.',
        project: 'Eventos', category: 'Logística', priority: 'alta',
        start: -4, due: 0, status: 'en_progreso', progress: 70,
        client: 'Distribuidora Sur', city: 'Medellín',
        notes: 'Falta confirmar vehículo de respaldo.',
        history: [
          { off: -4, p: 30, c: 'Se solicitaron cotizaciones de transporte.' },
          { off: -2, p: 70, c: 'Se recibieron dos cotizaciones.' }
        ]
      },
      {
        name: 'Cotizar material POP tienda insignia',
        purpose: 'Renovar la exhibición de la tienda insignia con material actualizado.',
        expectedResult: 'Cotización aprobada y orden de compra emitida.',
        project: 'Material POP', category: 'Compras', priority: 'media',
        start: -10, due: -2, status: 'en_progreso', progress: 55,
        client: 'Retail Center', city: 'Cali',
        notes: 'Pendiente aprobación de presupuesto.',
        history: [
          { off: -10, p: 25, c: 'Se solicitaron cotizaciones a proveedores.' },
          { off: -5, p: 55, c: 'Se recibieron 3 propuestas.' }
        ]
      },
      {
        name: 'Diseñar arte de campaña temporada',
        purpose: 'Alinear la comunicación visual de la campaña de temporada.',
        expectedResult: 'Piezas gráficas aprobadas por mercadeo.',
        project: 'Mercadeo', category: 'Diseño', priority: 'media',
        start: -8, due: 5, status: 'en_progreso', progress: 40,
        client: 'Marca Propia', city: 'Bogotá',
        notes: 'Primera ronda de arte enviada.',
        history: [
          { off: -8, p: 15, c: 'Brief entregado al diseñador.' },
          { off: -3, p: 40, c: 'Primera propuesta de arte recibida.' }
        ]
      },
      {
        name: 'Auditar inventario de material POP',
        purpose: 'Conocer el stock real disponible en bodega.',
        expectedResult: 'Inventario actualizado en la base de datos.',
        project: 'Material POP', category: 'Inventario', priority: 'media',
        start: -14, due: -7, status: 'completada', progress: 100,
        client: 'Bodega Central', city: 'Bogotá',
        notes: 'Inventario cerrado sin diferencias.',
        history: [
          { off: -14, p: 50, c: 'Conteo físico realizado.' },
          { off: -8, p: 100, c: 'Inventario cargado y validado.' }
        ]
      },
      {
        name: 'Coordinar montaje stand feria',
        purpose: 'Presentar la marca en la feria comercial regional.',
        expectedResult: 'Stand montado y operativo el primer día.',
        project: 'Eventos', category: 'Montaje', priority: 'alta',
        start: -2, due: 4, status: 'pendiente', progress: 0,
        client: 'Feria Andina', city: 'Bucaramanga',
        notes: 'A la espera de confirmación de espacio.',
        history: []
      },
      {
        name: 'Negociar acuerdo con proveedor de acrílicos',
        purpose: 'Reducir costos de exhibidores para el próximo trimestre.',
        expectedResult: 'Acuerdo firmado con mejora del 12% en precio.',
        project: 'Proveedores', category: 'Negociación', priority: 'media',
        start: -5, due: 8, status: 'en_espera', progress: 30,
        client: 'AcrilPlus', city: 'Medellín',
        notes: 'Esperando contrapropuesta del proveedor.',
        history: [
          { off: -5, p: 30, c: 'Reunión inicial de negociación realizada.' }
        ]
      },
      {
        name: 'Entregar reporte de rutas de mercaderistas',
        purpose: 'Optimizar la cobertura de puntos de venta.',
        expectedResult: 'Reporte con rutas optimizadas entregado.',
        project: 'Logística', category: 'Reporte', priority: 'baja',
        start: -12, due: -5, status: 'completada', progress: 100,
        client: 'Interno', city: 'Bogotá',
        notes: '',
        history: [
          { off: -12, p: 60, c: 'Consolidación de datos de rutas.' },
          { off: -6, p: 100, c: 'Reporte entregado a gerencia.' }
        ]
      },
      {
        name: 'Actualizar precios en exhibidores',
        purpose: 'Reflejar la nueva lista de precios en el punto de venta.',
        expectedResult: 'Precios actualizados en todos los puntos.',
        project: 'Material POP', category: 'Operación', priority: 'alta',
        start: -3, due: -1, status: 'en_progreso', progress: 80,
        client: 'Cadena Norte', city: 'Cali',
        notes: 'Faltan 4 puntos por actualizar.',
        history: [
          { off: -3, p: 40, c: 'Material de precios impreso.' },
          { off: -1, p: 80, c: 'Actualización en 16 de 20 puntos.' }
        ]
      },
      {
        name: 'Planear evento primera de mayo',
        purpose: 'Definir alcance, presupuesto y cronograma del evento.',
        expectedResult: 'Plan de evento aprobado.',
        project: 'Eventos', category: 'Planeación', priority: 'alta',
        start: -7, due: 6, status: 'en_progreso', progress: 60,
        client: 'Distribuidora Sur', city: 'Medellín',
        notes: 'Presupuesto en revisión final.',
        history: [
          { off: -7, p: 20, c: 'Objetivos del evento definidos.' },
          { off: -4, p: 45, c: 'Cronograma preliminar armado.' },
          { off: -1, p: 60, c: 'Presupuesto enviado a aprobación.' }
        ]
      },
      {
        name: 'Solicitar muestras de nuevos exhibidores',
        purpose: 'Evaluar calidad antes de una compra grande.',
        expectedResult: 'Muestras recibidas y evaluadas.',
        project: 'Proveedores', category: 'Compras', priority: 'baja',
        start: -1, due: 10, status: 'pendiente', progress: 0,
        client: 'AcrilPlus', city: 'Bogotá',
        notes: '',
        history: []
      },
      {
        name: 'Reponer material dañado punto de venta',
        purpose: 'Mantener la imagen de marca en óptimas condiciones.',
        expectedResult: 'Material repuesto en los puntos reportados.',
        project: 'Material POP', category: 'Mantenimiento', priority: 'media',
        start: -9, due: -3, status: 'vencida', progress: 50,
        client: 'Retail Center', city: 'Cali',
        notes: 'Retraso por disponibilidad de material.',
        history: [
          { off: -9, p: 25, c: 'Reporte de daños consolidado.' },
          { off: -5, p: 50, c: 'Producción del material iniciada.' }
        ]
      },
      {
        name: 'Capacitar mercaderistas nuevos',
        purpose: 'Estandarizar la ejecución en el punto de venta.',
        expectedResult: 'Equipo capacitado y evaluado.',
        project: 'Logística', category: 'Capacitación', priority: 'media',
        start: 2, due: 12, status: 'pendiente', progress: 0,
        client: 'Interno', city: 'Bucaramanga',
        notes: 'Agendar sala y material.',
        history: []
      },
      {
        name: 'Consolidar informe mensual de gestión',
        purpose: 'Reportar resultados de gestión a la dirección.',
        expectedResult: 'Informe mensual entregado con KPIs.',
        project: 'Mercadeo', category: 'Reporte', priority: 'alta',
        start: -2, due: 3, status: 'en_progreso', progress: 35,
        client: 'Interno', city: 'Bogotá',
        notes: 'Recopilando indicadores.',
        history: [
          { off: -2, p: 35, c: 'Datos de tareas consolidados.' }
        ]
      },
      {
        name: 'Verificar exhibición en cadena norte',
        purpose: 'Asegurar cumplimiento del planograma acordado.',
        expectedResult: 'Checklist de exhibición al 100%.',
        project: 'Material POP', category: 'Auditoría', priority: 'media',
        start: -15, due: -10, status: 'completada', progress: 100,
        client: 'Cadena Norte', city: 'Medellín',
        notes: '',
        history: [
          { off: -15, p: 50, c: 'Visitas programadas.' },
          { off: -11, p: 100, c: 'Auditoría completada en todos los puntos.' }
        ]
      }
    ];

    tasks.forEach(t => {
      const history = (t.history || []).map(h => ({
        id: Storage.uid('upd'),
        date: iso(h.off),
        progress: h.p,
        comment: h.c
      }));
      Storage.createTask({
        name: t.name,
        description: t.notes || '',
        purpose: t.purpose,
        expectedResult: t.expectedResult,
        projectId: projects[t.project] || '',
        category: t.category,
        priority: t.priority,
        responsible: R,
        startDate: d(t.start),
        dueDate: d(t.due),
        status: t.status === 'vencida' ? 'en_progreso' : t.status,
        progress: t.progress,
        client: t.client,
        city: t.city,
        notes: t.notes,
        evidenceLink: '',
        history: history,
        completedAt: t.status === 'completada' ? iso(t.due) : null
      });
    });

    Storage.markSeeded();
  }

  global.Seed = { seed };

})(window);
