-- ============================================================
-- EVENTOS CHOHO · 0005 — datos existentes en EVENTOS REALIZADOS.xlsx
-- Opcional: la app también puede cargarlos desde Configuración → Importar Excel.
-- ============================================================
insert into eventos.personas (codigo, nombre, activo) values
  ('P-001','Laura Pinilla',true),   ('P-002','Oscar Mora',true),
  ('P-003','María Gonzales',true),  ('P-004','Javier Herrán',true),
  ('P-005','Nury Preciado',true),   ('P-006','Camilo Mariño',true),
  ('P-007','Carolina Plaza',true),  ('P-008','Ximena Rodriguez',true)
on conflict (nombre) do nothing;

insert into eventos.eventos
  (codigo, nombre, fecha, ciudad, lugar_negocio, tipo_evento, responsable, estado) values
  ('EV-001','PRIMERA DE MAYO','2026-09-19','BOGOTÁ','Mundimotos Primera de Mayo','EVENTO EN PUNTO DE VENTA','Nury Preciado','REALIZADO'),
  ('EV-002','LA FAVORITA',    '2026-09-05','BOGOTÁ','Mundimotos La Favorita',    'EVENTO EN PUNTO DE VENTA','Nury Preciado','REALIZADO'),
  ('EV-003','IBAGUÉ',         '2026-09-04','IBAGUÉ','Fogón Ibagué',              'EVENTO EN PUNTO DE VENTA','Nury Preciado','REALIZADO')
on conflict (codigo) do nothing;

insert into eventos.participacion
  (evento_id, persona_id, persona_nombre, confirmado, asistio, rol_funcion, hora_ingreso, hora_salida)
select e.id, p.id, d.persona, 'SÍ', 'SÍ', 'MERCADEO', d.ingreso::time, d.salida::time
from (values
  ('EV-001','Oscar Mora','09:00','15:00'),    ('EV-001','María Gonzales','09:00','15:00'),
  ('EV-001','Javier Herrán','09:00','15:00'), ('EV-001','Nury Preciado','09:00','15:00'),
  ('EV-002','Oscar Mora','10:00','15:00'),    ('EV-002','María Gonzales','10:00','15:00'),
  ('EV-002','Nury Preciado','10:00','15:00'), ('EV-002','Camilo Mariño','10:00','15:00'),
  ('EV-002','Javier Herrán','10:00','15:00')
) as d(evento, persona, ingreso, salida)
join eventos.eventos  e on e.codigo = d.evento
join eventos.personas p on p.nombre = d.persona
on conflict (evento_id, persona_nombre) do nothing;

-- Solo LLEVADA y SOBRANTE: utilizada, % y gasto los calcula la base
insert into eventos.material_pop (evento_id, material, cantidad_llevada, cantidad_sobrante)
select e.id, d.material, d.llevada, d.sobrante
from (values
  ('EV-001','GORRAS',60,48),   ('EV-001','LANYARDS',80,33),
  ('EV-001','CUELLEROS',20,17),('EV-001','BOLÍGRAFOS',50,23),
  ('EV-002','GORRAS',100,40),  ('EV-002','LANYARDS',100,60),
  ('EV-002','CUELLEROS',100,80),('EV-002','BOLÍGRAFOS',100,50),
  ('EV-003','GORRAS',60,30),   ('EV-003','LANYARDS',60,40),
  ('EV-003','CUELLEROS',60,30),('EV-003','BOLÍGRAFOS',60,30)
) as d(evento, material, llevada, sobrante)
join eventos.eventos e on e.codigo = d.evento;

insert into eventos.gastos (evento_id, categoria, descripcion, responsable, valor)
select e.id, d.categoria, d.descripcion, d.responsable, d.valor
from (values
  ('EV-001','VOLANTES','VOLANTES','Nury Preciado',130000),
  ('EV-001','INFLUENCIADORES','INFLUENCIADORES','Nury Preciado',800000),
  ('EV-001','ALIMENTACIÓN','ALIMENTACION','Nury Preciado',180000),
  ('EV-001','TRANSPORTE','FLETE','Oscar Mora',65500),
  ('EV-001','OTROS','BTL','Nury Preciado',2050000),
  ('EV-001','OTROS','POP MAN','Nury Preciado',540000),
  ('EV-002','VOLANTES','VOLANTES','Oscar Mora',270000),
  ('EV-002','INFLUENCIADORES','INFLUENCIADORES','Nury Preciado',800000),
  ('EV-002','TRANSPORTE','FLETE','Oscar Mora',120000),
  ('EV-002','OTROS','PERIFONEO','Oscar Mora',400000),
  ('EV-002','OTROS','PAUTA','Nury Preciado',250000),
  ('EV-003','ALIMENTACIÓN','ALIMENTACION','Oscar Mora',604800),
  ('EV-003','ALIMENTACIÓN','ALIMENTACION','Oscar Mora',200000),
  ('EV-003','TRANSPORTE','TRANSPORTE','Nury Preciado',1600000),
  ('EV-003','OTROS','PERIFONEO','Oscar Mora',210000)
) as d(evento, categoria, descripcion, responsable, valor)
join eventos.eventos e on e.codigo = d.evento;
