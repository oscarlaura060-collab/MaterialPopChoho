-- ============================================================
-- EVENTOS CHOHO · 0001 — esquema aislado
-- Derivado de EVENTOS REALIZADOS.xlsx
-- ============================================================
create schema if not exists eventos;

grant usage on schema eventos to anon, authenticated, service_role;
alter default privileges in schema eventos grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema eventos grant all on sequences to anon, authenticated, service_role;

-- ---------- LISTAS (hoja LISTAS: catálogos centralizados) ----------
create table eventos.listas (
  id         bigserial primary key,
  tipo       text not null,   -- ESTADO | TIPO_EVENTO | CIUDAD | ROL | CATEGORIA | FORMA_PAGO | ESTADO_PAGO
  valor      text not null,
  orden      int  not null default 0,
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tipo, valor)
);

-- Catálogo de materiales con su costo unitario (LISTAS!MATERIAL POP / COSTO UNITARIO)
create table eventos.materiales (
  id             bigserial primary key,
  nombre         text not null unique,
  costo_unitario numeric(14,2) not null default 0,
  activo         boolean not null default true,
  created_at     timestamptz not null default now()
);

-- Parámetros (LISTAS!PARÁMETRO / VALOR / DESCRIPCIÓN)
create table eventos.parametros (
  clave       text primary key,
  valor       numeric not null,
  descripcion text
);

-- ---------- PERSONAL ----------
create table eventos.personas (
  id            uuid primary key default gen_random_uuid(),
  codigo        text unique,            -- ID PERSONA (P-001)
  nombre        text not null unique,   -- NOMBRE (clave de cruce en el Excel)
  cargo_area    text,
  activo        boolean not null default true,
  observaciones text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------- EVENTOS ----------
create table eventos.eventos (
  id                   uuid primary key default gen_random_uuid(),
  codigo               text not null unique,  -- ID EVENTO (EV-001)
  nombre               text not null,
  fecha                date not null,
  ciudad               text,
  lugar_negocio        text,
  direccion            text,
  cliente              text,
  tipo_evento          text,
  responsable          text,
  estado               text not null default 'PLANIFICADO',
  asistentes_esperados int,
  observaciones        text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index on eventos.eventos (fecha desc);
create index on eventos.eventos (estado);
create index on eventos.eventos (ciudad);

-- ---------- PARTICIPACIÓN ----------
create table eventos.participacion (
  id             uuid primary key default gen_random_uuid(),
  evento_id      uuid not null references eventos.eventos(id) on delete cascade,
  persona_id     uuid references eventos.personas(id) on delete set null,
  persona_nombre text not null,
  confirmado     text not null default 'PENDIENTE',  -- SÍ | NO | PENDIENTE
  asistio        text not null default 'PENDIENTE',
  rol_funcion    text,
  hora_ingreso   time,
  hora_salida    time,
  observaciones  text,
  created_at     timestamptz not null default now(),
  unique (evento_id, persona_nombre)
);
create index on eventos.participacion (evento_id);

-- ---------- MATERIAL POP ----------
-- Se registran CANTIDAD LLEVADA y CANTIDAD SOBRANTE; el resto se calcula
-- igual que en el Excel:
--   UTILIZADA      = LLEVADA - SOBRANTE
--   % UTILIZACIÓN  = UTILIZADA / LLEVADA
--   GASTO MATERIAL = LLEVADA * COSTO UNITARIO
create table eventos.material_pop (
  id                 uuid primary key default gen_random_uuid(),
  evento_id          uuid not null references eventos.eventos(id) on delete cascade,
  material           text not null,
  cantidad_llevada   numeric(14,2) not null default 0,
  cantidad_sobrante  numeric(14,2) not null default 0,
  costo_unitario     numeric(14,2) not null default 0,
  observaciones      text,
  created_at         timestamptz not null default now(),
  cantidad_utilizada numeric(14,2)
    generated always as (cantidad_llevada - cantidad_sobrante) stored,
  pct_utilizacion    numeric
    generated always as (
      case when cantidad_llevada > 0
           then (cantidad_llevada - cantidad_sobrante) / cantidad_llevada
           else null end) stored,
  gasto_material     numeric(14,2)
    generated always as (cantidad_llevada * costo_unitario) stored,
  constraint material_pop_sobrante_valido
    check (cantidad_sobrante >= 0 and cantidad_sobrante <= cantidad_llevada)
);
create index on eventos.material_pop (evento_id);

-- ---------- GASTOS ADICIONALES ----------
create table eventos.gastos (
  id            uuid primary key default gen_random_uuid(),
  evento_id     uuid not null references eventos.eventos(id) on delete cascade,
  categoria     text,
  descripcion   text,
  proveedor     text,
  responsable   text,
  valor         numeric(14,2) not null default 0,
  observaciones text,
  created_at    timestamptz not null default now()
);
create index on eventos.gastos (evento_id);

-- ---------- RESULTADOS (uno por evento) ----------
create table eventos.resultados (
  evento_id           uuid primary key references eventos.eventos(id) on delete cascade,
  asistentes          int,
  clientes_atendidos  int,
  resultado_comercial text,
  observaciones       text,
  aprendizajes        text,
  updated_at          timestamptz not null default now()
);

-- ---------- ANEXOS ----------
create table eventos.anexos (
  id           uuid primary key default gen_random_uuid(),
  evento_id    uuid not null references eventos.eventos(id) on delete cascade,
  nombre       text not null,
  storage_path text not null,
  mime_type    text,
  tamano_bytes bigint,
  descripcion  text,
  created_at   timestamptz not null default now()
);
create index on eventos.anexos (evento_id);

-- ---------- USUARIOS / ROLES ----------
create table eventos.usuarios (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  nombre     text,
  rol        text not null default 'JEFE' check (rol in ('ADMINISTRADOR','JEFE')),
  created_at timestamptz not null default now()
);

-- ---------- updated_at ----------
create or replace function eventos.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_eventos_touch    before update on eventos.eventos
  for each row execute function eventos.touch_updated_at();
create trigger trg_personas_touch   before update on eventos.personas
  for each row execute function eventos.touch_updated_at();
create trigger trg_resultados_touch before update on eventos.resultados
  for each row execute function eventos.touch_updated_at();
