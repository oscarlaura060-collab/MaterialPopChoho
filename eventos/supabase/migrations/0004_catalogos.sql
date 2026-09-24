-- ============================================================
-- EVENTOS CHOHO · 0004 — catálogos tomados de la hoja LISTAS
-- ============================================================
insert into eventos.listas (tipo, valor, orden) values
  ('ESTADO','PLANIFICADO',1),('ESTADO','CONFIRMADO',2),
  ('ESTADO','REALIZADO',3),('ESTADO','CANCELADO',4),

  ('TIPO_EVENTO','EVENTO EN PUNTO DE VENTA',1),('TIPO_EVENTO','ACTIVACIÓN DE MARCA',2),
  ('TIPO_EVENTO','LANZAMIENTO',3),('TIPO_EVENTO','FERIA / EXPOSICIÓN',4),
  ('TIPO_EVENTO','RODADA / CARAVANA',5),('TIPO_EVENTO','CAPACITACIÓN',6),
  ('TIPO_EVENTO','EVENTO CORPORATIVO',7),('TIPO_EVENTO','OTRO',8),

  ('CIUDAD','BOGOTÁ',1),('CIUDAD','MEDELLÍN',2),('CIUDAD','CALI',3),
  ('CIUDAD','BARRANQUILLA',4),('CIUDAD','BUCARAMANGA',5),('CIUDAD','CARTAGENA',6),
  ('CIUDAD','PEREIRA',7),('CIUDAD','IBAGUÉ',8),('CIUDAD','VILLAVICENCIO',9),
  ('CIUDAD','TUNJA',10),

  ('ROL','ORGANIZACIÓN',1),('ROL','LOGÍSTICA',2),('ROL','MERCADEO',3),
  ('ROL','APOYO COMERCIAL',4),('ROL','MONTAJE',5),('ROL','ACTIVACIÓN',6),
  ('ROL','REGISTRO',7),('ROL','RESPONSABLE',8),('ROL','OTRO',9),

  ('CATEGORIA','TRANSPORTE',1),('CATEGORIA','ALIMENTACIÓN',2),('CATEGORIA','REFRIGERIOS',3),
  ('CATEGORIA','PERIFONEO',4),('CATEGORIA','PUBLICIDAD',5),('CATEGORIA','IMPRESIÓN',6),
  ('CATEGORIA','VOLANTES',7),('CATEGORIA','PREMIOS',8),('CATEGORIA','DECORACIÓN',9),
  ('CATEGORIA','ALQUILER',10),('CATEGORIA','PERSONAL',11),('CATEGORIA','MONTAJE',12),
  ('CATEGORIA','DESMONTAJE',13),('CATEGORIA','INFLUENCIADORES',14),('CATEGORIA','LOGÍSTICA',15),
  ('CATEGORIA','HOSPEDAJE',16),('CATEGORIA','OTROS',17),

  ('FORMA_PAGO','EFECTIVO',1),('FORMA_PAGO','TRANSFERENCIA',2),
  ('FORMA_PAGO','TARJETA CRÉDITO',3),('FORMA_PAGO','TARJETA DÉBITO',4),
  ('FORMA_PAGO','CAJA MENOR',5),('FORMA_PAGO','CRÉDITO PROVEEDOR',6),('FORMA_PAGO','OTRO',7),

  ('ESTADO_PAGO','PREVISTO',1),('ESTADO_PAGO','PENDIENTE DE PAGO',2),
  ('ESTADO_PAGO','PAGADO',3),('ESTADO_PAGO','ANULADO',4)
on conflict (tipo, valor) do nothing;

insert into eventos.materiales (nombre, costo_unitario) values
  ('GORRAS', 9500), ('LANYARDS', 1380), ('CUELLEROS', 5100), ('BOLÍGRAFOS', 1230)
on conflict (nombre) do update set costo_unitario = excluded.costo_unitario;

insert into eventos.parametros (clave, valor, descripcion) values
  ('margen_seguridad',       0.15, '% adicional sobre el consumo histórico para la recomendación'),
  ('factor_variacion',       1,    'N° de desviaciones estándar que se suman al promedio utilizado'),
  ('min_eventos_tipo',       2,    'Eventos del mismo tipo requeridos para usar historial por tipo'),
  ('utilizacion_baja',       0.5,  'Por debajo de este % se considera que se lleva demasiado material'),
  ('utilizacion_alta',       0.9,  'Por encima de este % hay riesgo de quedarse sin material'),
  ('tolerancia_recomendado', 0.2,  'Planificado hasta este % por encima del recomendado = cantidad adecuada')
on conflict (clave) do update set valor = excluded.valor, descripcion = excluded.descripcion;
