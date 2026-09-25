-- ============================================================
-- EVENTOS CHOHO · 0002 — vistas que reproducen las fórmulas del Excel
-- ============================================================

-- COSTO UNITARIO se busca en el catálogo (INDEX/MATCH sobre tblMateriales)
create or replace function eventos.aplicar_costo_unitario()
returns trigger language plpgsql as $$
declare v_costo numeric;
begin
  if new.costo_unitario is null or new.costo_unitario = 0 then
    select m.costo_unitario into v_costo
      from eventos.materiales m
     where upper(m.nombre) = upper(new.material)
     limit 1;
    new.costo_unitario := coalesce(v_costo, 0);
  end if;
  return new;
end $$;

create trigger trg_material_costo
  before insert or update of material, costo_unitario on eventos.material_pop
  for each row execute function eventos.aplicar_costo_unitario();

-- ---- EVENTOS con las columnas calculadas de la hoja ----
create or replace view eventos.v_eventos as
select
  e.*,
  extract(year  from e.fecha)::int as anio,
  extract(month from e.fecha)::int as mes,
  -- DÍA: CHOOSE(WEEKDAY(fecha,2), LUNES..DOMINGO)
  (array['LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO','DOMINGO'])
    [extract(isodow from e.fecha)::int] as dia,
  coalesce(mp.gasto_pop, 0)                                     as gasto_pop,
  coalesce(mp.valor_llevado, 0)                                 as pop_valor_llevado,
  coalesce(g.gastos_adicionales, 0)                             as gastos_adicionales,
  coalesce(mp.gasto_pop, 0) + coalesce(g.gastos_adicionales, 0) as gasto_total,
  coalesce(mp.pop_llevado, 0)                                   as pop_llevado,
  coalesce(mp.pop_utilizado, 0)                                 as pop_utilizado,
  coalesce(mp.pop_sobrante, 0)                                  as pop_sobrante,
  coalesce(p.personal_asignado, 0)                              as personal_asignado,
  coalesce(p.confirmados, 0)                                    as confirmados,
  coalesce(p.personal_asignado, 0) - coalesce(p.confirmados, 0) as pendientes,
  coalesce(p.no_van, 0)                                         as no_van,
  coalesce(p.asistieron, 0)                                     as asistieron,
  coalesce(p.no_asistieron, 0)                                  as no_asistieron,
  case when coalesce(p.asistieron,0) + coalesce(p.no_asistieron,0) > 0
       then p.asistieron::numeric / (p.asistieron + p.no_asistieron)
       else null end                                            as pct_asistencia,
  r.asistentes,
  r.clientes_atendidos,
  coalesce(a.n_anexos, 0)                                       as n_anexos
from eventos.eventos e
left join lateral (
  select sum(m.gasto_material)     as gasto_pop,
         sum(m.valor_llevado)      as valor_llevado,
         sum(m.cantidad_llevada)   as pop_llevado,
         sum(m.cantidad_utilizada) as pop_utilizado,
         sum(m.cantidad_sobrante)  as pop_sobrante
    from eventos.material_pop m where m.evento_id = e.id) mp on true
left join lateral (
  select sum(x.valor) as gastos_adicionales
    from eventos.gastos x where x.evento_id = e.id) g on true
left join lateral (
  select count(*)                                     as personal_asignado,
         count(*) filter (where pa.confirmado = 'SÍ') as confirmados,
         count(*) filter (where pa.confirmado = 'NO') as no_van,
         count(*) filter (where pa.asistio    = 'SÍ') as asistieron,
         count(*) filter (where pa.asistio    = 'NO') as no_asistieron
    from eventos.participacion pa where pa.evento_id = e.id) p on true
left join eventos.resultados r on r.evento_id = e.id
left join lateral (
  select count(*) as n_anexos from eventos.anexos an where an.evento_id = e.id) a on true;

-- ---- PERSONAL con sus contadores (COUNTIFS sobre PARTICIPACIÓN) ----
create or replace view eventos.v_personal as
select
  pe.*,
  coalesce(s.eventos_asignados, 0) as eventos_asignados,
  coalesce(s.confirmados, 0)       as confirmados,
  coalesce(s.eventos_asignados, 0) - coalesce(s.confirmados, 0) as pendientes,
  coalesce(s.no_va, 0)             as no_va,
  coalesce(s.asistidos, 0)         as asistidos,
  coalesce(s.no_asistio, 0)        as no_asistio,
  case when coalesce(s.asistidos,0) + coalesce(s.no_asistio,0) > 0
       then s.asistidos::numeric / (s.asistidos + s.no_asistio)
       else null end               as pct_asistencia,
  coalesce(s.horas_totales, 0)     as horas_totales
from eventos.personas pe
left join lateral (
  select count(*)                                     as eventos_asignados,
         count(*) filter (where pa.confirmado = 'SÍ') as confirmados,
         count(*) filter (where pa.confirmado = 'NO') as no_va,
         count(*) filter (where pa.asistio    = 'SÍ') as asistidos,
         count(*) filter (where pa.asistio    = 'NO') as no_asistio,
         sum(case when pa.hora_ingreso is not null and pa.hora_salida is not null
                  -- MOD(salida-ingreso,1): admite turnos que cruzan medianoche
                  then mod(extract(epoch from (pa.hora_salida - pa.hora_ingreso))::numeric
                           + 86400, 86400) / 3600
                  else 0 end) as horas_totales
    from eventos.participacion pa
   where pa.persona_nombre = pe.nombre) s on true;

-- ---- PARTICIPACIÓN con HORAS ----
create or replace view eventos.v_participacion as
select pa.*,
  e.codigo as evento_codigo, e.nombre as evento_nombre,
  e.fecha  as evento_fecha,  e.estado as evento_estado,
  case when pa.hora_ingreso is not null and pa.hora_salida is not null
       then round(mod(extract(epoch from (pa.hora_salida - pa.hora_ingreso))::numeric
                      + 86400, 86400) / 3600, 2)
       else null end as horas
from eventos.participacion pa
join eventos.eventos e on e.id = pa.evento_id;

-- ---- MATERIAL POP con contexto del evento ----
create or replace view eventos.v_material_pop as
select m.*,
  e.codigo as evento_codigo, e.nombre as evento_nombre, e.fecha as evento_fecha,
  e.ciudad as evento_ciudad, e.tipo_evento as evento_tipo, e.estado as evento_estado,
  e.responsable as evento_responsable
from eventos.material_pop m
join eventos.eventos e on e.id = m.evento_id;

-- ---- GASTOS con contexto del evento ----
create or replace view eventos.v_gastos as
select g.*,
  e.codigo as evento_codigo, e.nombre as evento_nombre, e.fecha as evento_fecha,
  e.ciudad as evento_ciudad, e.tipo_evento as evento_tipo, e.estado as evento_estado
from eventos.gastos g
join eventos.eventos e on e.id = g.evento_id;

-- ---- RESULTADOS con contexto ----
create or replace view eventos.v_resultados as
select r.*,
  e.codigo as evento_codigo, e.nombre as evento_nombre, e.fecha as evento_fecha,
  e.ciudad as evento_ciudad, e.estado as evento_estado
from eventos.resultados r
join eventos.eventos e on e.id = r.evento_id;

-- Las vistas se consultan con los permisos de quien las invoca
alter view eventos.v_eventos       set (security_invoker = on);
alter view eventos.v_personal      set (security_invoker = on);
alter view eventos.v_participacion set (security_invoker = on);
alter view eventos.v_material_pop  set (security_invoker = on);
alter view eventos.v_gastos        set (security_invoker = on);
alter view eventos.v_resultados    set (security_invoker = on);

-- Siguiente código de evento disponible (EV-004, ...)
create or replace function eventos.siguiente_codigo_evento()
returns text language sql stable security definer set search_path = eventos, public as $$
  select 'EV-' || lpad((
    coalesce(max(nullif(regexp_replace(codigo, '\D', '', 'g'), '')::int), 0) + 1
  )::text, 3, '0')
  from eventos.eventos;
$$;
