-- =====================================================
-- FASE 2 · Inventario, prácticas, bitácora de equipos y reportes
-- Pegar completo en Supabase > SQL Editor > Run
-- (requiere haber corrido antes 01_usuarios.sql)
-- =====================================================

-- Permisos base de la etapa 1 (inofensivo si ya los diste)
grant usage on schema public to anon, authenticated;
grant select on public.clases to anon, authenticated;
grant select, update on public.perfiles to authenticated;

-- -----------------------------------------------------
-- Inventario de materiales y reactivos
-- -----------------------------------------------------
create table if not exists public.articulos (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null check (length(trim(nombre)) >= 2),
  categoria    text not null check (categoria in ('reactivo','consumible','material','otro')),
  unidad       text not null default 'pieza',          -- ml, g, pieza, caja...
  stock        numeric(12,3) not null default 0 check (stock >= 0),
  stock_minimo numeric(12,3) not null default 0 check (stock_minimo >= 0),
  ubicacion    text,
  notas        text,
  activo       boolean not null default true,
  creado_en    timestamptz not null default now()
);
create unique index if not exists articulos_nombre_unico on public.articulos (lower(nombre));

-- Cada cambio de existencia queda registrado (no se edita ni se borra)
create table if not exists public.movimientos_inventario (
  id               uuid primary key default gen_random_uuid(),
  articulo_id      uuid not null references public.articulos(id),
  tipo             text not null check (tipo in ('entrada','salida','ajuste','practica')),
  cantidad         numeric(12,3) not null,              -- con signo: + entra, - sale
  stock_resultante numeric(12,3) not null,
  motivo           text,
  usuario_id       uuid references public.perfiles(id),
  practica_id      uuid,
  creado_en        timestamptz not null default now()
);

-- -----------------------------------------------------
-- Equipos
-- -----------------------------------------------------
create table if not exists public.equipos (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null check (length(trim(nombre)) >= 2),
  marca     text,
  modelo    text,
  ubicacion text,
  estado    text not null default 'disponible'
            check (estado in ('disponible','mantenimiento','fuera_de_servicio')),
  activo    boolean not null default true,
  creado_en timestamptz not null default now()
);

-- -----------------------------------------------------
-- Prácticas (selección de materiales usados)
-- -----------------------------------------------------
create table if not exists public.practicas (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references public.perfiles(id),
  clase_id   uuid references public.clases(id),
  titulo     text not null check (length(trim(titulo)) >= 3),
  notas      text,
  creado_en  timestamptz not null default now()
);

-- Se guarda copia del nombre y la unidad: el alumno no puede leer la tabla de inventario
create table if not exists public.practica_items (
  id          uuid primary key default gen_random_uuid(),
  practica_id uuid not null references public.practicas(id) on delete cascade,
  articulo_id uuid not null references public.articulos(id),
  nombre      text not null,
  unidad      text not null,
  cantidad    numeric(12,3) not null check (cantidad > 0)
);

-- -----------------------------------------------------
-- Bitácora de uso de equipos (solo se agrega, nunca se edita)
-- -----------------------------------------------------
create table if not exists public.bitacora_equipos (
  id                    uuid primary key default gen_random_uuid(),
  equipo_id             uuid not null references public.equipos(id),
  usuario_id            uuid not null default auth.uid() references public.perfiles(id),
  uso                   text not null check (length(trim(uso)) >= 3),
  condiciones_iniciales text not null check (length(trim(condiciones_iniciales)) >= 2),
  condiciones_finales   text not null check (length(trim(condiciones_finales)) >= 2),
  creado_en             timestamptz not null default now()
);

-- -----------------------------------------------------
-- Reportes de incidentes y equipos en mal estado
-- -----------------------------------------------------
create table if not exists public.reportes (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null default auth.uid() references public.perfiles(id),
  tipo        text not null check (tipo in ('incidente','equipo_mal_estado')),
  equipo_id   uuid references public.equipos(id),
  gravedad    text not null default 'media' check (gravedad in ('baja','media','alta')),
  descripcion text not null check (length(trim(descripcion)) >= 10),
  foto_path   text,
  estado      text not null default 'abierto' check (estado in ('abierto','en_revision','cerrado')),
  creado_en   timestamptz not null default now(),
  -- un equipo en mal estado exige equipo y foto de evidencia
  constraint equipo_requiere_foto
    check (tipo <> 'equipo_mal_estado' or (equipo_id is not null and foto_path is not null))
);

-- -----------------------------------------------------
-- Vista para alumnos: nombres y disponibilidad, sin cantidades exactas
-- -----------------------------------------------------
create or replace view public.articulos_catalogo as
  select id, nombre, categoria, unidad, ubicacion, (stock > 0) as disponible
  from public.articulos
  where activo;

-- -----------------------------------------------------
-- El stock solo cambia mediante las funciones de abajo (deja rastro)
-- -----------------------------------------------------
create or replace function public.proteger_stock()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.stock is distinct from old.stock
     and coalesce(current_setting('app.ajuste_stock', true), '') <> '1' then
    raise exception 'La existencia solo se modifica con movimientos de inventario.';
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_stock on public.articulos;
create trigger proteger_stock before update on public.articulos
  for each row execute function public.proteger_stock();

-- Existencia inicial al crear un artículo
create or replace function public.registrar_stock_inicial()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.stock > 0 then
    insert into public.movimientos_inventario
      (articulo_id, tipo, cantidad, stock_resultante, motivo, usuario_id)
    values (new.id, 'entrada', new.stock, new.stock, 'Existencia inicial', auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists stock_inicial on public.articulos;
create trigger stock_inicial after insert on public.articulos
  for each row execute function public.registrar_stock_inicial();

-- -----------------------------------------------------
-- Registrar una práctica: valida, descuenta y deja rastro, todo en una transacción
-- p_items = [{"articulo_id": "...", "cantidad": 2.5}, ...]
-- -----------------------------------------------------
create or replace function public.registrar_practica(p_titulo text, p_notas text, p_items jsonb)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_clase    uuid;
  v_practica uuid;
  v_item     jsonb;
  v_art      public.articulos%rowtype;
  v_cant     numeric;
begin
  if v_uid is null then raise exception 'Debes iniciar sesión.'; end if;
  if length(trim(coalesce(p_titulo, ''))) < 3 then
    raise exception 'Escribe el nombre de la práctica.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Agrega al menos un material.';
  end if;

  select clase_id into v_clase from public.perfiles where id = v_uid;

  insert into public.practicas (usuario_id, clase_id, titulo, notas)
  values (v_uid, v_clase, trim(p_titulo), nullif(trim(coalesce(p_notas, '')), ''))
  returning id into v_practica;

  perform set_config('app.ajuste_stock', '1', true);

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_cant := (v_item ->> 'cantidad')::numeric;
    if v_cant is null or v_cant <= 0 then
      raise exception 'Hay una cantidad no válida.';
    end if;

    select * into v_art from public.articulos
      where id = (v_item ->> 'articulo_id')::uuid and activo
      for update;
    if not found then
      raise exception 'Uno de los materiales ya no está disponible.';
    end if;
    if v_art.stock < v_cant then
      raise exception 'No hay existencia suficiente de %.', v_art.nombre;
    end if;

    update public.articulos set stock = stock - v_cant where id = v_art.id;

    insert into public.practica_items (practica_id, articulo_id, nombre, unidad, cantidad)
    values (v_practica, v_art.id, v_art.nombre, v_art.unidad, v_cant);

    insert into public.movimientos_inventario
      (articulo_id, tipo, cantidad, stock_resultante, motivo, usuario_id, practica_id)
    values (v_art.id, 'practica', -v_cant, v_art.stock - v_cant,
            'Práctica: ' || trim(p_titulo), v_uid, v_practica);
  end loop;

  perform set_config('app.ajuste_stock', '0', true);
  return v_practica;
end;
$$;

-- -----------------------------------------------------
-- Movimientos manuales de inventario (solo profesores / administradores)
-- tipo: entrada | salida | ajuste (en ajuste, p_cantidad es la nueva existencia)
-- -----------------------------------------------------
create or replace function public.ajustar_inventario(
  p_articulo uuid, p_tipo text, p_cantidad numeric, p_motivo text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_art   public.articulos%rowtype;
  v_delta numeric;
begin
  if not public.es_personal() then raise exception 'No tienes permiso para esto.'; end if;
  if p_tipo not in ('entrada','salida','ajuste') then raise exception 'Tipo de movimiento no válido.'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escribe el motivo del movimiento.'; end if;
  if p_cantidad is null or p_cantidad < 0 or (p_tipo <> 'ajuste' and p_cantidad = 0) then
    raise exception 'La cantidad no es válida.';
  end if;

  select * into v_art from public.articulos where id = p_articulo for update;
  if not found then raise exception 'El artículo no existe.'; end if;

  v_delta := case p_tipo
    when 'entrada' then p_cantidad
    when 'salida'  then -p_cantidad
    else p_cantidad - v_art.stock
  end;

  if v_art.stock + v_delta < 0 then
    raise exception 'La salida es mayor que la existencia actual.';
  end if;

  perform set_config('app.ajuste_stock', '1', true);
  update public.articulos set stock = stock + v_delta where id = p_articulo;
  perform set_config('app.ajuste_stock', '0', true);

  insert into public.movimientos_inventario
    (articulo_id, tipo, cantidad, stock_resultante, motivo, usuario_id)
  values (p_articulo, p_tipo, v_delta, v_art.stock + v_delta, trim(p_motivo), auth.uid());
end;
$$;

revoke execute on function public.registrar_practica(text, text, jsonb) from public, anon;
revoke execute on function public.ajustar_inventario(uuid, text, numeric, text) from public, anon;
grant execute on function public.registrar_practica(text, text, jsonb) to authenticated;
grant execute on function public.ajustar_inventario(uuid, text, numeric, text) to authenticated;

-- -----------------------------------------------------
-- Permisos de tabla (los de fila los decide RLS)
-- -----------------------------------------------------
grant select on public.articulos, public.movimientos_inventario, public.equipos,
  public.practicas, public.practica_items, public.bitacora_equipos, public.reportes
  to authenticated;
grant select on public.articulos_catalogo to authenticated;
grant insert, update on public.articulos, public.equipos to authenticated;
grant insert on public.bitacora_equipos, public.reportes to authenticated;
grant update (estado) on public.reportes to authenticated;

-- -----------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------
alter table public.articulos               enable row level security;
alter table public.movimientos_inventario  enable row level security;
alter table public.equipos                 enable row level security;
alter table public.practicas               enable row level security;
alter table public.practica_items          enable row level security;
alter table public.bitacora_equipos        enable row level security;
alter table public.reportes                enable row level security;

-- Inventario: solo el personal lo ve completo y lo edita
drop policy if exists articulos_ver on public.articulos;
create policy articulos_ver on public.articulos
  for select to authenticated using (public.es_personal());
drop policy if exists articulos_crear on public.articulos;
create policy articulos_crear on public.articulos
  for insert to authenticated with check (public.es_personal());
drop policy if exists articulos_editar on public.articulos;
create policy articulos_editar on public.articulos
  for update to authenticated using (public.es_personal()) with check (public.es_personal());

drop policy if exists movimientos_ver on public.movimientos_inventario;
create policy movimientos_ver on public.movimientos_inventario
  for select to authenticated using (public.es_personal());

-- Equipos: todos los ven, el personal los edita
drop policy if exists equipos_ver on public.equipos;
create policy equipos_ver on public.equipos
  for select to authenticated using (activo or public.es_personal());
drop policy if exists equipos_crear on public.equipos;
create policy equipos_crear on public.equipos
  for insert to authenticated with check (public.es_personal());
drop policy if exists equipos_editar on public.equipos;
create policy equipos_editar on public.equipos
  for update to authenticated using (public.es_personal()) with check (public.es_personal());

-- Prácticas: cada alumno ve las suyas; el personal ve todas. Se crean solo con la función.
drop policy if exists practicas_ver on public.practicas;
create policy practicas_ver on public.practicas
  for select to authenticated using (usuario_id = auth.uid() or public.es_personal());

drop policy if exists practica_items_ver on public.practica_items;
create policy practica_items_ver on public.practica_items
  for select to authenticated using (
    exists (select 1 from public.practicas p
            where p.id = practica_id and (p.usuario_id = auth.uid() or public.es_personal())));

-- Bitácora
drop policy if exists bitacora_ver on public.bitacora_equipos;
create policy bitacora_ver on public.bitacora_equipos
  for select to authenticated using (usuario_id = auth.uid() or public.es_personal());
drop policy if exists bitacora_crear on public.bitacora_equipos;
create policy bitacora_crear on public.bitacora_equipos
  for insert to authenticated with check (usuario_id = auth.uid());

-- Reportes
drop policy if exists reportes_ver on public.reportes;
create policy reportes_ver on public.reportes
  for select to authenticated using (usuario_id = auth.uid() or public.es_personal());
drop policy if exists reportes_crear on public.reportes;
create policy reportes_crear on public.reportes
  for insert to authenticated with check (usuario_id = auth.uid());
drop policy if exists reportes_estado on public.reportes;
create policy reportes_estado on public.reportes
  for update to authenticated using (public.es_personal()) with check (public.es_personal());

-- -----------------------------------------------------
-- Fotos de evidencia (almacenamiento privado, máx. 5 MB, solo imágenes)
-- Cada alumno sube a su propia carpeta; el personal puede ver todas.
-- -----------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidencias', 'evidencias', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists evidencias_subir on storage.objects;
create policy evidencias_subir on storage.objects
  for insert to authenticated
  with check (bucket_id = 'evidencias' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists evidencias_ver on storage.objects;
create policy evidencias_ver on storage.objects
  for select to authenticated
  using (bucket_id = 'evidencias'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.es_personal()));

-- -----------------------------------------------------
-- Datos de ejemplo (bórralos o cámbialos por los reales)
-- -----------------------------------------------------
insert into public.articulos (nombre, categoria, unidad, stock, stock_minimo, ubicacion) values
  ('Ácido clorhídrico 1 M',        'reactivo',   'ml',    1000, 200, 'Estante A1'),
  ('Hidróxido de sodio 0.1 M',     'reactivo',   'ml',    1500, 300, 'Estante A2'),
  ('Puntas de micropipeta 200 µl', 'consumible', 'pieza', 500,  100, 'Cajón 3'),
  ('Tubos de ensayo 13x100',       'consumible', 'pieza', 200,  50,  'Cajón 4'),
  ('Matraz Erlenmeyer 250 ml',     'material',   'pieza', 20,   5,   'Armario B')
on conflict do nothing;

insert into public.equipos (nombre, marca, modelo, ubicacion)
select * from (values
  ('Balanza analítica',  'OHAUS',   'Pioneer', 'Mesa 1'),
  ('Centrífuga',         'Thermo',  'Sorvall', 'Mesa 2'),
  ('Espectrofotómetro',  'Genesys', '30',      'Mesa 3')
) as v(nombre, marca, modelo, ubicacion)
where not exists (select 1 from public.equipos);
