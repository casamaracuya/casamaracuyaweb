-- =====================================================================
--  Casa Maracuyá · 0004: ficha de huéspedes, tareas que se toman, solo ingresos
--  Correr una vez en Supabase > SQL Editor, después de 0001, 0002 y 0003.
--  Se puede volver a correr sin romper nada.
-- =====================================================================

-- ---------- 1. Solo ingresos: los gastos los lleva otro sistema ----------
drop table if exists gastos cascade;

-- ---------- 2. Ficha interna del huésped ----------
alter table huespedes
  add column if not exists email        text   not null default '',
  add column if not exists cumple       date,
  add column if not exists no_le_gusta  text[] not null default '{}',
  add column if not exists notas        text   not null default '';
-- Teléfono normalizado (últimos 10 dígitos) para reconocer a quien ya vino.
alter table huespedes
  add column if not exists tel_norm text generated always as (right(regexp_replace(telefono, '\D', '', 'g'), 10)) stored;
create index if not exists huespedes_tel_norm on huespedes (tel_norm);

-- Quiénes vienen con el huésped (familia, pareja, amigos).
create table if not exists acompanantes (
  id          uuid primary key default gen_random_uuid(),
  huesped_id  uuid not null references huespedes(id) on delete cascade,
  nombre      text not null,
  relacion    text not null default '',
  cumple      date,
  alergias    text not null default '',
  notas       text not null default '',
  creado      timestamptz not null default now()
);
create index if not exists acompanantes_huesped on acompanantes (huesped_id);
alter table acompanantes enable row level security;
drop policy if exists "equipo lee acompanantes" on acompanantes;
drop policy if exists "equipo anota acompanantes" on acompanantes;
create policy "equipo lee acompanantes" on acompanantes for select using (es_equipo());
create policy "equipo anota acompanantes" on acompanantes for all
  using (tiene_algun_rol('{direccion,recepcion,cocina}')) with check (tiene_algun_rol('{direccion,recepcion,cocina}'));

-- La web ya no duplica huéspedes: si el teléfono coincide, usa la ficha que existe.
create or replace function crear_solicitud(
  p_nombre text, p_telefono text, p_plan plan_estadia, p_personas int, p_mascota boolean,
  p_llegada date, p_salida date, p_notas text, p_canal text default 'Web', p_idioma text default 'es'
) returns text
language plpgsql security definer set search_path = public as $$
declare h uuid; c text; n text := right(regexp_replace(coalesce(p_telefono,''), '\D', '', 'g'), 10);
begin
  if length(trim(coalesce(p_nombre,''))) < 2 then raise exception 'Falta el nombre'; end if;
  if p_salida <= p_llegada then raise exception 'La salida tiene que ser después de la llegada'; end if;
  if p_llegada < current_date then raise exception 'La llegada no puede ser una fecha pasada'; end if;
  if p_personas not between 1 and 12 then raise exception 'Entre 1 y 12 personas'; end if;
  if length(n) >= 7 then select id into h from huespedes where tel_norm = n order by creado limit 1; end if;
  if h is null then
    insert into huespedes (nombre, telefono) values (left(trim(p_nombre),120), left(coalesce(p_telefono,''),40)) returning id into h;
  end if;
  insert into reservas (huesped_id, plan, personas, mascota, llegada, salida, notas, canal, idioma)
  values (h, p_plan, p_personas, coalesce(p_mascota,false), p_llegada, p_salida, left(coalesce(p_notas,''),1000), left(coalesce(p_canal,'Web'),40), left(coalesce(p_idioma,'es'),5))
  returning codigo into c;
  return c;
end $$;
grant execute on function crear_solicitud to anon, authenticated;

-- ---------- 3. Tareas: se asignan o se toman, y se ponen en proceso ----------
alter table tareas
  add column if not exists asignada_a uuid references perfiles(id) on delete set null,
  add column if not exists en_proceso boolean not null default false,
  add column if not exists hecha_por  uuid references perfiles(id) on delete set null,
  add column if not exists hecha_en   timestamptz;

-- Teléfono de cada persona del equipo (para avisarle por WhatsApp).
alter table perfiles add column if not exists telefono text not null default '';

-- Todo el equipo ve los nombres de sus compañeros (para saber quién tomó cada tarea).
drop policy if exists "equipo ve companeros" on perfiles;
create policy "equipo ve companeros" on perfiles for select using (es_equipo());

-- ---------- 4. Tiempo real para lo nuevo ----------
do $$ begin
  alter publication supabase_realtime add table acompanantes;
exception when duplicate_object then null; end $$;

-- ---------- 5. Pre-reservas que se liberan solas cada 15 minutos ----------
-- Si esta parte da error, activa pg_cron en Database > Extensions y vuelve a correr solo estas dos líneas.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('liberar-vencidas', '*/15 * * * *', 'select public.liberar_vencidas()');
