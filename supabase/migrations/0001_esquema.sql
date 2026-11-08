-- =====================================================================
--  Casa Maracuyá · Esquema de base de datos (Supabase / Postgres)
--  Correr completo en: Supabase > SQL Editor > New query > Run
--  Se puede correr una sola vez sobre un proyecto vacío.
-- =====================================================================

-- ---------- Tipos ----------
create type rol_equipo   as enum ('direccion','admin','recepcion','cocina','limpieza','mantenimiento');
create type plan_estadia as enum ('esencial','plena');
create type estado_reserva as enum ('nueva','conversacion','pre','confirmada','casa','finalizada','rechazada','vencida','cancelada');
create type area_tarea   as enum ('recepcion','cocina','limpieza','mantenimiento','admin');
create type estado_hab   as enum ('sucia','limpiando','lista','revisada');

-- ---------- Equipo ----------
-- Cada persona del equipo es un usuario de Supabase Auth. Sus roles viven aquí.
create table perfiles (
  id      uuid primary key references auth.users(id) on delete cascade,
  nombre  text not null default '',
  roles   rol_equipo[] not null default '{}',
  creado  timestamptz not null default now()
);

-- Al crear o invitar un usuario en Auth se crea su perfil sin roles.
create or replace function crear_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, nombre) values (new.id, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger al_crear_usuario after insert on auth.users for each row execute function crear_perfil();

create or replace function tiene_rol(r rol_equipo) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and r = any(roles));
$$;
create or replace function tiene_algun_rol(rs rol_equipo[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and roles && rs);
$$;
create or replace function es_equipo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and cardinality(roles) > 0);
$$;

-- ---------- Huéspedes ----------
create table huespedes (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null,
  ciudad    text not null default '',
  telefono  text not null default '',
  alergias  text[] not null default '{}',
  gustos    text[] not null default '{}',
  mascota   text not null default '',
  celebra   text not null default '',
  kite      boolean not null default false,
  visitas   int not null default 0,
  creado    timestamptz not null default now()
);

-- ---------- Reservas ----------
create sequence reservas_codigo_seq start 1001;
create table reservas (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique default ('R-' || nextval('reservas_codigo_seq')),
  huesped_id  uuid not null references huespedes(id) on delete restrict,
  plan        plan_estadia not null,
  personas    int not null check (personas between 1 and 12),
  mascota     boolean not null default false,
  llegada     date not null,
  salida      date not null,
  estado      estado_reserva not null default 'nueva',
  canal       text not null default 'Web',
  idioma      text not null default 'es',
  total       numeric(10,2) not null default 0,
  pagado      numeric(10,2) not null default 0,
  notas       text not null default '',
  vence_en    timestamptz,
  creado      timestamptz not null default now(),
  check (salida > llegada),
  -- La casa se alquila completa: dos reservas activas nunca pueden compartir noches.
  constraint sin_doble_reserva exclude using gist (daterange(llegada, salida) with &&)
    where (estado in ('pre','confirmada','casa'))
);
create index on reservas (estado);
create index on reservas (llegada);

-- ---------- Fechas bloqueadas ----------
create table bloqueos (
  id      uuid primary key default gen_random_uuid(),
  desde   date not null,
  hasta   date not null check (hasta > desde),
  motivo  text not null default 'Mantenimiento',
  creado  timestamptz not null default now()
);

-- ---------- Tareas ----------
create table tareas (
  id          uuid primary key default gen_random_uuid(),
  area        area_tarea not null,
  titulo      text not null,
  reserva_id  uuid references reservas(id) on delete set null,
  para        date not null default current_date,
  hora        text not null default '',
  hecha       boolean not null default false,
  dano        boolean not null default false,
  foto_url    text,
  creado_por  uuid default auth.uid(),
  creado      timestamptz not null default now()
);
create index on tareas (area, hecha, para);

-- ---------- La casa ----------
create table habitaciones (
  id      text primary key,
  nombre  text not null,
  nota    text not null default '',
  foto    text not null default '',
  estado  estado_hab not null default 'lista',
  orden   int not null default 0
);
create table exteriores (
  id      text primary key,
  nombre  text not null,
  al_dia  boolean not null default true,
  orden   int not null default 0
);

-- ---------- Dinero ----------
create table pagos (
  id          uuid primary key default gen_random_uuid(),
  reserva_id  uuid not null references reservas(id) on delete cascade,
  monto       numeric(10,2) not null check (monto > 0),
  metodo      text not null,
  tipo        text not null default 'Anticipo',
  fecha       date not null default current_date,
  creado_por  uuid default auth.uid()
);
create table gastos (
  id        uuid primary key default gen_random_uuid(),
  concepto  text not null,
  categoria text not null default 'Otros',
  monto     numeric(10,2) not null check (monto > 0),
  fecha     date not null default current_date,
  pagado    boolean not null default false
);

-- ---------- Cocina ----------
create table compras (
  id     uuid primary key default gen_random_uuid(),
  texto  text not null,
  hecho  boolean not null default false,
  creado timestamptz not null default now()
);
create table menus (
  reserva_id uuid primary key references reservas(id) on delete cascade,
  texto      text not null default ''
);

-- ---------- Tarifas y promociones ----------
-- clave = temporada-plan-grupo, por ejemplo: alta-plena-6-12
create table tarifas (
  clave  text primary key,
  monto  numeric(10,2)
);
create table promociones (
  id      uuid primary key default gen_random_uuid(),
  nombre  text not null,
  activa  boolean not null default true
);

-- =====================================================================
--  Seguridad: cada rol ve y cambia solo lo suyo (Row Level Security)
-- =====================================================================
alter table perfiles     enable row level security;
alter table huespedes    enable row level security;
alter table reservas     enable row level security;
alter table bloqueos     enable row level security;
alter table tareas       enable row level security;
alter table habitaciones enable row level security;
alter table exteriores   enable row level security;
alter table pagos        enable row level security;
alter table gastos       enable row level security;
alter table compras      enable row level security;
alter table menus        enable row level security;
alter table tarifas      enable row level security;
alter table promociones  enable row level security;

-- Perfiles: cada quien ve el suyo; Dirección ve y edita a todos.
create policy "ver perfil propio o direccion" on perfiles for select using (id = auth.uid() or tiene_rol('direccion'));
create policy "direccion edita perfiles" on perfiles for update using (tiene_rol('direccion'));

-- Lectura general para el equipo (la interfaz oculta montos y teléfonos a quien no le tocan).
create policy "equipo lee huespedes"    on huespedes    for select using (es_equipo());
create policy "equipo lee reservas"     on reservas     for select using (es_equipo());
create policy "equipo lee bloqueos"     on bloqueos     for select using (es_equipo());
create policy "equipo lee tareas"       on tareas       for select using (es_equipo());
create policy "equipo lee habitaciones" on habitaciones for select using (es_equipo());
create policy "equipo lee exteriores"   on exteriores   for select using (es_equipo());
create policy "equipo lee compras"      on compras      for select using (es_equipo());
create policy "equipo lee menus"        on menus        for select using (es_equipo());
create policy "equipo lee tarifas"      on tarifas      for select using (es_equipo());
create policy "todos leen promociones"  on promociones  for select using (true);

-- Pagos y gastos: solo Dirección y Administración.
create policy "dinero lee pagos"   on pagos  for select using (tiene_algun_rol('{direccion,admin}'));
create policy "dinero lee gastos"  on gastos for select using (tiene_algun_rol('{direccion,admin}'));
create policy "dinero crea gastos" on gastos for insert with check (tiene_algun_rol('{direccion,admin}'));
create policy "dinero edita gastos" on gastos for update using (tiene_algun_rol('{direccion,admin}'));

-- Huéspedes: recepción y dirección los crean y editan; cocina anota gustos.
create policy "recepcion crea huespedes" on huespedes for insert with check (tiene_algun_rol('{direccion,recepcion,admin}'));
create policy "equipo edita huespedes"   on huespedes for update using (tiene_algun_rol('{direccion,recepcion,cocina}'));

-- Reservas: se crean y mueven desde funciones (más abajo). Recepción puede crear a mano.
create policy "recepcion crea reservas" on reservas for insert with check (tiene_algun_rol('{direccion,recepcion,admin}'));
create policy "recepcion edita reservas" on reservas for update using (tiene_algun_rol('{direccion,recepcion,admin}'));

-- Tareas: cualquiera del equipo crea; cada área marca las suyas (Dirección y Recepción, todas).
create policy "equipo crea tareas" on tareas for insert with check (es_equipo());
create policy "area marca tareas" on tareas for update using (
  tiene_algun_rol('{direccion,recepcion}') or tiene_rol(area::text::rol_equipo));

-- La casa
create policy "limpieza mueve habitaciones" on habitaciones for update using (tiene_algun_rol('{direccion,limpieza}'));
create policy "mantenimiento exteriores" on exteriores for update using (tiene_algun_rol('{direccion,mantenimiento}'));
create policy "mantenimiento crea bloqueos" on bloqueos for insert with check (tiene_algun_rol('{direccion,mantenimiento}'));
create policy "mantenimiento borra bloqueos" on bloqueos for delete using (tiene_algun_rol('{direccion,mantenimiento}'));

-- Cocina
create policy "cocina crea compras" on compras for insert with check (tiene_algun_rol('{direccion,cocina}'));
create policy "cocina edita compras" on compras for update using (tiene_algun_rol('{direccion,cocina}'));
create policy "cocina escribe menus" on menus for insert with check (tiene_algun_rol('{direccion,cocina}'));
create policy "cocina edita menus" on menus for update using (tiene_algun_rol('{direccion,cocina}'));

-- Tarifas y promociones: solo Dirección.
create policy "direccion tarifas"        on tarifas     for all using (tiene_rol('direccion')) with check (tiene_rol('direccion'));
create policy "direccion promociones"    on promociones for insert with check (tiene_rol('direccion'));
create policy "direccion edita promos"   on promociones for update using (tiene_rol('direccion'));

-- =====================================================================
--  Reglas del negocio (funciones)
-- =====================================================================

-- La web pública manda la solicitud: crea huésped + reserva en estado "nueva".
-- No bloquea fechas. Cualquiera puede llamarla (anon), pero solo puede hacer esto.
create or replace function crear_solicitud(
  p_nombre text, p_telefono text, p_plan plan_estadia, p_personas int, p_mascota boolean,
  p_llegada date, p_salida date, p_notas text, p_canal text default 'Web', p_idioma text default 'es'
) returns text
language plpgsql security definer set search_path = public as $$
declare h uuid; c text;
begin
  if length(trim(coalesce(p_nombre,''))) < 2 then raise exception 'Falta el nombre'; end if;
  if p_salida <= p_llegada then raise exception 'La salida tiene que ser después de la llegada'; end if;
  if p_llegada < current_date then raise exception 'La llegada no puede ser una fecha pasada'; end if;
  if p_personas not between 1 and 12 then raise exception 'Entre 1 y 12 personas'; end if;
  insert into huespedes (nombre, telefono) values (left(trim(p_nombre),120), left(coalesce(p_telefono,''),40)) returning id into h;
  insert into reservas (huesped_id, plan, personas, mascota, llegada, salida, notas, canal, idioma)
  values (h, p_plan, p_personas, coalesce(p_mascota,false), p_llegada, p_salida, left(coalesce(p_notas,''),1000), left(coalesce(p_canal,'Web'),40), left(coalesce(p_idioma,'es'),5))
  returning codigo into c;
  return c;
end $$;
grant execute on function crear_solicitud to anon, authenticated;

-- ¿Qué noches están ocupadas? (para que la web avise sin mostrar datos de nadie)
create or replace function noches_ocupadas(p_desde date, p_hasta date)
returns table (desde date, hasta date)
language sql stable security definer set search_path = public as $$
  select llegada, salida from reservas where estado in ('pre','confirmada','casa') and llegada < p_hasta and p_desde < salida
  union all
  select desde, hasta from bloqueos where desde < p_hasta and p_desde < hasta;
$$;
grant execute on function noches_ocupadas to anon, authenticated;

-- Libera solas las pre-reservas cuyo plazo venció.
create or replace function liberar_vencidas() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update reservas set estado = 'vencida' where estado = 'pre' and vence_en is not null and vence_en < now();
  get diagnostics n = row_count; return n;
end $$;
grant execute on function liberar_vencidas to authenticated;

-- Mueve una reserva al siguiente estado y reparte las tareas.
create or replace function cambiar_estado(p_reserva uuid, p_estado estado_reserva) returns void
language plpgsql security definer set search_path = public as $$
declare r reservas; g huespedes; prep date;
begin
  if not tiene_algun_rol('{direccion,recepcion,admin}') then raise exception 'No tienes permiso para mover reservas'; end if;
  select * into r from reservas where id = p_reserva for update;
  if not found then raise exception 'Reserva no encontrada'; end if;
  select * into g from huespedes where id = r.huesped_id;
  if exists (select 1 from bloqueos b where b.desde < r.salida and r.llegada < b.hasta) and p_estado in ('pre','confirmada') then
    raise exception 'La casa está bloqueada en esas fechas';
  end if;

  update reservas set estado = p_estado,
    vence_en = case when p_estado = 'pre' then now() + interval '24 hours' else null end
  where id = p_reserva;   -- si choca con otra reserva activa, la restricción sin_doble_reserva lo impide

  if p_estado = 'pre' then
    insert into tareas (area, titulo, reserva_id, para) values ('admin', 'Confirmar el anticipo de ' || g.nombre, r.id, current_date);
  elsif p_estado = 'confirmada' then
    prep := greatest(current_date, r.llegada - 1);
    insert into tareas (area, titulo, reserva_id, para) values
      ('cocina', 'Menú para ' || g.nombre, r.id, greatest(current_date, r.llegada - 7)),
      ('limpieza', 'Preparar la casa y la bienvenida para ' || r.personas, r.id, prep),
      ('mantenimiento', 'Piscina y jardín listos antes de la llegada', r.id, prep);
    update tareas set hecha = true where reserva_id = r.id and area = 'admin';
  elsif p_estado = 'finalizada' then
    insert into tareas (area, titulo, reserva_id, para) values
      ('limpieza', 'Limpieza de salida y lavandería', r.id, current_date),
      ('mantenimiento', 'Revisión de la casa después de la salida', r.id, current_date),
      ('recepcion', 'Enviar las gracias y el enlace de reseña a ' || g.nombre, r.id, current_date + 1);
    update huespedes set visitas = visitas + 1 where id = g.id;
  end if;
end $$;
grant execute on function cambiar_estado to authenticated;

-- Registra un pago. Si la reserva estaba pre-reservada, la confirma.
create or replace function registrar_pago(p_reserva uuid, p_monto numeric, p_metodo text) returns void
language plpgsql security definer set search_path = public as $$
declare r reservas;
begin
  if not tiene_algun_rol('{direccion,admin}') then raise exception 'Solo Administración registra pagos'; end if;
  select * into r from reservas where id = p_reserva for update;
  insert into pagos (reserva_id, monto, metodo, tipo) values (p_reserva, p_monto, p_metodo, case when r.pagado > 0 then 'Pago final' else 'Anticipo' end);
  update reservas set pagado = pagado + p_monto where id = p_reserva;
  if r.estado = 'pre' then perform cambiar_estado(p_reserva, 'confirmada'); end if;
end $$;
grant execute on function registrar_pago to authenticated;

-- Pasa una habitación al siguiente estado (sucia → en limpieza → lista → revisada → sucia).
create or replace function siguiente_estado_habitacion(p_id text) returns estado_hab
language plpgsql security definer set search_path = public as $$
declare e estado_hab;
begin
  if not tiene_algun_rol('{direccion,limpieza}') then raise exception 'Solo Limpieza cambia habitaciones'; end if;
  update habitaciones set estado = case estado when 'sucia' then 'limpiando' when 'limpiando' then 'lista' when 'lista' then 'revisada' else 'sucia' end::estado_hab
  where id = p_id returning estado into e;
  return e;
end $$;
grant execute on function siguiente_estado_habitacion to authenticated;

-- La liberación automática cada 15 minutos (pg_cron) se activa en 0004_huespedes_tareas_ingresos.sql.

-- =====================================================================
--  Fotos de daños (Storage)
-- =====================================================================
insert into storage.buckets (id, name, public) values ('danos', 'danos', false) on conflict do nothing;
create policy "equipo sube fotos" on storage.objects for insert to authenticated with check (bucket_id = 'danos' and public.es_equipo());
create policy "equipo ve fotos"   on storage.objects for select to authenticated using (bucket_id = 'danos' and public.es_equipo());

-- =====================================================================
--  Datos fijos de la casa
-- =====================================================================
insert into habitaciones (id, nombre, nota, foto, estado, orden) values
  ('maracuya', 'Habitación Maracuyá', '', '/fotos/hab-maracuya.jpg', 'lista', 1),
  ('delvalle', 'Habitación Del Valle', '', '/fotos/hab-del-valle.jpg', 'lista', 2),
  ('h3', 'Habitación Coromoto', '', '', 'lista', 3),
  ('comunes', 'Sala, comedor y cocina', '', '/fotos/comedor-exterior.jpg', 'lista', 4);
insert into exteriores (id, nombre, al_dia, orden) values
  ('piscina', 'Piscina', true, 1), ('jardin', 'Jardín', true, 2), ('muelle', 'Muelle', true, 3);
