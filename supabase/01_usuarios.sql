-- =====================================================
-- FASE 1 · Usuarios, clases y perfiles
-- Pegar completo en Supabase > SQL Editor > Run
-- =====================================================

create extension if not exists unaccent;

-- Roles del sistema
do $$ begin
  create type public.rol_usuario as enum ('alumno', 'docente', 'tecnico', 'admin');
exception when duplicate_object then null; end $$;

-- Catálogo de clases (las administra el personal)
create table if not exists public.clases (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  docente    text,
  periodo    text,                       -- ej. 'Ene-Jun 2027'
  activa     boolean not null default true,
  creado_en  timestamptz not null default now()
);

-- Perfil de cada usuario (1 a 1 con auth.users)
create table if not exists public.perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null check (length(trim(nombre)) >= 3),
  matricula  text not null unique check (length(trim(matricula)) >= 4),
  correo     text not null,
  clase_id   uuid references public.clases(id),
  rol        public.rol_usuario not null default 'alumno',
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

-- -----------------------------------------------------
-- Funciones auxiliares (security definer evita recursión en RLS)
-- -----------------------------------------------------
create or replace function public.rol_actual()
returns public.rol_usuario
language sql stable security definer set search_path = ''
as $$ select rol from public.perfiles where id = auth.uid() $$;

create or replace function public.es_personal()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(public.rol_actual() in ('docente','tecnico','admin'), false) $$;

create or replace function public.es_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(public.rol_actual() = 'admin', false) $$;

-- -----------------------------------------------------
-- Al registrarse en auth.users se crea el perfil automáticamente
-- usando los datos que manda el formulario (nombre, matrícula, clase)
-- -----------------------------------------------------
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.perfiles (id, nombre, matricula, correo, clase_id)
  values (
    new.id,
    trim(new.raw_user_meta_data ->> 'nombre'),
    upper(trim(new.raw_user_meta_data ->> 'matricula')),
    new.email,
    nullif(new.raw_user_meta_data ->> 'clase_id', '')::uuid
  );
  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil_nuevo_usuario();

-- -----------------------------------------------------
-- Un alumno NO puede cambiarse rol, matrícula, correo ni estado
-- -----------------------------------------------------
create or replace function public.proteger_campos_perfil()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.es_admin() then
    new.rol       := old.rol;
    new.activo    := old.activo;
    new.matricula := old.matricula;
    new.correo    := old.correo;
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_perfil on public.perfiles;
create trigger proteger_perfil
  before update on public.perfiles
  for each row execute function public.proteger_campos_perfil();

-- -----------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------
alter table public.clases   enable row level security;
alter table public.perfiles enable row level security;

-- Clases: visibles para todos (el formulario de registro las necesita)
drop policy if exists clases_lectura on public.clases;
create policy clases_lectura on public.clases
  for select to anon, authenticated using (activa = true);

drop policy if exists clases_admin on public.clases;
create policy clases_admin on public.clases
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Perfiles: cada quien ve el suyo; el personal ve todos
drop policy if exists perfiles_lectura on public.perfiles;
create policy perfiles_lectura on public.perfiles
  for select to authenticated using (id = auth.uid() or public.es_personal());

drop policy if exists perfiles_actualizar_propio on public.perfiles;
create policy perfiles_actualizar_propio on public.perfiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists perfiles_admin on public.perfiles;
create policy perfiles_admin on public.perfiles
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- -----------------------------------------------------
-- Datos de ejemplo (cambia por tus clases reales)
-- -----------------------------------------------------
insert into public.clases (nombre, docente, periodo) values
  ('Bioquímica I',  'Docente de ejemplo', 'Ene-Jun 2027'),
  ('Bioquímica II', 'Docente de ejemplo', 'Ene-Jun 2027');
