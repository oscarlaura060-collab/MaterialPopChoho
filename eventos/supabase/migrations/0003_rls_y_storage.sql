-- ============================================================
-- EVENTOS CHOHO · 0003 — RLS y Storage
-- ADMINISTRADOR escribe · JEFE solo lee · nadie anónimo
-- ============================================================

create or replace function eventos.es_admin()
returns boolean language sql stable security definer set search_path = eventos, public as $$
  select exists (select 1 from eventos.usuarios u
                  where u.id = auth.uid() and u.rol = 'ADMINISTRADOR');
$$;

create or replace function eventos.es_usuario()
returns boolean language sql stable security definer set search_path = eventos, public as $$
  select exists (select 1 from eventos.usuarios u where u.id = auth.uid());
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'listas','materiales','parametros','personas','eventos',
    'participacion','material_pop','gastos','resultados','anexos'
  ] loop
    execute format('alter table eventos.%I enable row level security', t);
    execute format($f$
      create policy "%1$s_lectura" on eventos.%1$I
        for select to authenticated using (eventos.es_usuario())
    $f$, t);
    execute format($f$
      create policy "%1$s_escritura" on eventos.%1$I
        for all to authenticated
        using (eventos.es_admin()) with check (eventos.es_admin())
    $f$, t);
  end loop;
end $$;

-- Cada quien ve su propia fila; el admin ve y gestiona todas
alter table eventos.usuarios enable row level security;

create policy usuarios_lectura on eventos.usuarios
  for select to authenticated
  using (id = auth.uid() or eventos.es_admin());

create policy usuarios_escritura on eventos.usuarios
  for all to authenticated
  using (eventos.es_admin()) with check (eventos.es_admin());

-- Alta automática al registrarse (el primer usuario queda como ADMINISTRADOR)
create or replace function eventos.alta_usuario()
returns trigger language plpgsql security definer set search_path = eventos, public as $$
declare v_n int;
begin
  select count(*) into v_n from eventos.usuarios;
  insert into eventos.usuarios (id, email, nombre, rol)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
          case when v_n = 0 then 'ADMINISTRADOR' else 'JEFE' end)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger trg_eventos_alta_usuario
  after insert on auth.users
  for each row execute function eventos.alta_usuario();

-- ---------- Storage: anexos del evento (bucket privado) ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('eventos-anexos', 'eventos-anexos', false, 26214400)
on conflict (id) do nothing;

create policy "eventos_anexos_lectura" on storage.objects
  for select to authenticated
  using (bucket_id = 'eventos-anexos' and eventos.es_usuario());

create policy "eventos_anexos_escritura" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'eventos-anexos' and eventos.es_admin());

create policy "eventos_anexos_borrado" on storage.objects
  for delete to authenticated
  using (bucket_id = 'eventos-anexos' and eventos.es_admin());

-- Exponer el esquema en la API REST.
-- Verifícalo también en Supabase → Settings → API → Exposed schemas:
-- si se edita desde el panel, esta línea se sobrescribe.
alter role authenticator set pgrst.db_schemas = 'public,graphql_public,eventos';
notify pgrst, 'reload config';
