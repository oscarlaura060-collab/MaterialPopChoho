-- ============================================================
-- CHOHO POP - Esquema completo de Supabase (referencia).
-- Ya aplicado en el proyecto MaterialPopChoho vía migraciones.
-- Reejecutable en un proyecto nuevo para reproducir la base.
-- ============================================================

-- Contadores para IDs legibles tipo ENT-2026-00001
create table if not exists public.contadores (
  prefijo text not null,
  anio    int  not null,
  valor   int  not null default 0,
  primary key (prefijo, anio)
);

create or replace function public.generar_id(p_prefijo text)
returns text
language plpgsql
as $$
declare
  v_anio int := extract(year from now() at time zone 'America/Bogota');
  v_valor int;
begin
  insert into public.contadores (prefijo, anio, valor)
  values (p_prefijo, v_anio, 1)
  on conflict (prefijo, anio)
  do update set valor = public.contadores.valor + 1
  returning valor into v_valor;
  return p_prefijo || '-' || v_anio || '-' || lpad(v_valor::text, 5, '0');
end;
$$;

create table if not exists public.configuracion (
  clave text primary key,
  valor text
);

create table if not exists public.zonas (
  id text primary key,
  nombre text not null,
  region text default '',
  ciudad_principal text default '',
  responsable text default '',
  estado text default 'Activa',
  created_at timestamptz default now()
);

create table if not exists public.personas (
  id text primary key,
  nombre text not null,
  telefono text default '',
  correo text default '',
  zona_id text references public.zonas(id),
  ciudad text default '',
  cargo text default '',
  estado text default 'Activo',
  observaciones text default '',
  codigo_acceso text default '',
  created_at timestamptz default now()
);

create table if not exists public.materiales (
  id text primary key,
  nombre text not null,
  categoria text default '',
  descripcion text default '',
  unidad text default 'Unidad',
  estado text default 'Activo',
  imagen text default '',
  created_at timestamptz default now()
);

create table if not exists public.entregas (
  id_entrega text primary key,
  fecha_entrega text,
  persona_id text references public.personas(id),
  zona_id text references public.zonas(id),
  ciudad text default '',
  punto text default '',
  direccion text default '',
  latitud text default '',
  longitud text default '',
  ubicacion_url text default '',
  observaciones text default '',
  registrado_por text default '',
  ts timestamptz default now(),
  estado text default 'Entregado'
);

create table if not exists public.detalle_entregas (
  id_detalle text primary key,
  id_entrega text references public.entregas(id_entrega) on delete cascade,
  material_id text references public.materiales(id),
  cantidad_entregada numeric default 0,
  cantidad_instalada numeric default 0,
  cantidad_pendiente numeric default 0
);

create table if not exists public.verificaciones (
  id_verificacion text primary key,
  id_entrega text references public.entregas(id_entrega) on delete cascade,
  id_detalle text references public.detalle_entregas(id_detalle) on delete cascade,
  cantidad_instalada numeric default 0,
  cantidad_pendiente numeric default 0,
  observaciones text default '',
  registrado_por text default '',
  ts timestamptz default now(),
  estado text default ''
);

create table if not exists public.evidencias (
  id_evidencia text primary key,
  id_verificacion text default '',
  id_entrega text references public.entregas(id_entrega) on delete cascade,
  material_id text default '',
  etapa text default 'verificacion',
  tipo text default 'imagen',
  nombre_archivo text default '',
  storage_path text default '',
  url text default '',
  zona text default '',
  fecha text default '',
  hora text default '',
  registrado_por text default '',
  created_at timestamptz default now()
);

create table if not exists public.log (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz default now(),
  usuario text default '',
  accion text default '',
  detalle text default ''
);

create index if not exists idx_detalle_entrega on public.detalle_entregas(id_entrega);
create index if not exists idx_verif_entrega   on public.verificaciones(id_entrega);
create index if not exists idx_evid_entrega     on public.evidencias(id_entrega);
create index if not exists idx_personas_zona    on public.personas(zona_id);
create index if not exists idx_entregas_ts       on public.entregas(ts desc);

-- RLS activado sin políticas públicas: solo la service_role key (servidor) accede.
alter table public.configuracion    enable row level security;
alter table public.zonas            enable row level security;
alter table public.personas         enable row level security;
alter table public.materiales       enable row level security;
alter table public.entregas         enable row level security;
alter table public.detalle_entregas enable row level security;
alter table public.verificaciones   enable row level security;
alter table public.evidencias       enable row level security;
alter table public.log              enable row level security;
alter table public.contadores       enable row level security;

-- Bucket público de evidencias (subidas server-side con service role).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidencias', 'evidencias', true, 52428800,
        array['image/jpeg','image/jpg','image/png','image/webp','video/mp4','video/quicktime','video/webm'])
on conflict (id) do nothing;
