-- =====================================================================
--  Casa Maracuyá · 0009: ficha de registro de huéspedes en el panel
--
--  El huésped llena y firma la ficha en papel (public/ficha-registro-casa-maracuya.pdf)
--  y el equipo la pasa al panel desde la reserva. Los datos caen en la reserva
--  (registro de quienes pernoctan, vehículos, bebidas…) y en la ficha del huésped
--  (cédula, alergias, acompañantes). El público no tiene ningún acceso a esto.
--
--  Cómo correrlo: Supabase > SQL Editor > New query > pega todo > Run.
--  Se puede volver a correr sin romper nada.
-- =====================================================================
-- ---------- 1. Campos nuevos ----------
alter table huespedes
  add column if not exists documento text not null default '';   -- C.I. o pasaporte del titular

alter table acompanantes
  add column if not exists documento text not null default '',
  add column if not exists edad      int check (edad between 0 and 120);   -- solo si es menor

alter table reservas
  add column if not exists hora_llegada    text not null default '',
  add column if not exists adultos         int check (adultos between 0 and 12),
  add column if not exists ninos           int check (ninos between 0 and 12),
  add column if not exists vehiculos       text[] not null default '{}',
  add column if not exists bebidas         text not null default '',
  add column if not exists requerimientos  text not null default '',
  add column if not exists motivo          text not null default '',
  add column if not exists mascota_nombre  text not null default '',
  add column if not exists mascota_raza    text not null default '',
  -- Registro de quienes duermen en la casa en ESTA estadía: [{nombre, documento, edad}].
  -- Es la lista que vale para la norma «no pernoctan personas fuera del registro».
  add column if not exists ocupantes       jsonb not null default '[]',
  add column if not exists ficha_firma     text not null default '',   -- quién firmó la ficha en papel (el titular)
  add column if not exists ficha_firmada   timestamptz,                -- cuándo se marcó como firmada
  add column if not exists ficha_por       uuid references perfiles(id) on delete set null,  -- quién la pasó al panel
  add column if not exists ficha_en        timestamptz;                -- cuándo se pasó o corrigió por última vez

-- ---------- 2. Guardar la ficha (solo el equipo) ----------
-- Dirección, Administración y Operaciones pasan la ficha al panel (antes de la llegada
-- o en el check-in). Se puede guardar incompleta y completarla después.
-- p trae: nombre, documento, telefono, email, ciudad, hora_llegada, adultos, ninos, vehiculos[],
-- ocupantes[{nombre, documento, edad}], alergias[], bebidas, requerimientos, motivo,
-- mascota (bool), mascota_nombre, mascota_raza, firmada (bool: el titular firmó la ficha en papel).
create or replace function guardar_ficha(p_reserva uuid, p jsonb) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  r reservas;
  t text := left(trim(coalesce(p->>'telefono','')), 40);
  ad int := coalesce((p->>'adultos')::int, 0);
  ni int := coalesce((p->>'ninos')::int, 0);
  occ jsonb := '[]'; o jsonb; nom text; ed int; i int := 0;
  al text[]; ahora timestamptz := now();
  txt constant int := 300;
begin
  if not tiene_algun_rol('{direccion,recepcion,admin,operaciones}') then raise exception 'Tu rol no puede pasar fichas de registro'; end if;
  select * into r from reservas where id = p_reserva for update;
  if not found then raise exception 'Reserva no encontrada'; end if;

  if length(trim(coalesce(p->>'nombre',''))) < 2 then raise exception 'Falta el nombre del titular'; end if;
  if ad < 1 then raise exception 'Tiene que venir al menos un adulto'; end if;
  if ni < 0 or ad + ni > 12 then raise exception 'La casa recibe hasta 12 personas en total'; end if;

  -- Ocupantes: el titular primero, luego los acompañantes con nombre. Máximo 12.
  for o in select * from jsonb_array_elements(coalesce(p->'ocupantes','[]')) loop
    nom := left(trim(coalesce(o->>'nombre','')), 120);
    continue when length(nom) < 2;
    i := i + 1;
    if i > 12 then raise exception 'La casa recibe hasta 12 personas en total'; end if;
    ed := nullif(left(regexp_replace(coalesce(o->>'edad',''), '\D', '', 'g'), 3), '')::int;
    if ed is not null and ed > 120 then ed := null; end if;
    occ := occ || jsonb_build_object('nombre', nom, 'documento', left(trim(coalesce(o->>'documento','')), 40), 'edad', ed);
  end loop;

  -- Alergias: se suman a las que ya tenía anotadas (quitar una se hace en la ficha del huésped).
  select array_agg(distinct a) into al from (
    select unnest(alergias) a from huespedes where id = r.huesped_id
    union select left(trim(x), 60) from jsonb_array_elements_text(coalesce(p->'alergias','[]')) x where trim(x) <> '' and lower(trim(x)) <> 'ninguna'
  ) s;

  update huespedes set
    nombre    = left(trim(p->>'nombre'), 120),
    documento = left(trim(coalesce(p->>'documento', documento)), 40),
    telefono  = case when length(regexp_replace(t, '\D', '', 'g')) >= 7 then t else telefono end,
    email     = left(trim(coalesce(p->>'email', email)), 120),
    ciudad    = left(trim(coalesce(p->>'ciudad', ciudad)), 80),
    alergias  = coalesce(al, '{}'),
    mascota   = case when coalesce((p->>'mascota')::boolean, false) and trim(coalesce(p->>'mascota_nombre','')) <> ''
                     then left(concat_ws(', ', nullif(trim(p->>'mascota_nombre'),''), nullif(trim(p->>'mascota_raza'),'')), 120) else mascota end,
    kite      = kite or coalesce(p->>'motivo','') ilike '%kite%'
  where id = r.huesped_id;

  update reservas set
    hora_llegada   = left(trim(coalesce(p->>'hora_llegada','')), 20),
    adultos        = ad,
    ninos          = ni,
    vehiculos      = coalesce((select array_agg(left(trim(v), 80)) from jsonb_array_elements_text(coalesce(p->'vehiculos','[]')) v where trim(v) <> ''), '{}'),
    bebidas        = left(trim(coalesce(p->>'bebidas','')), txt),
    requerimientos = left(trim(coalesce(p->>'requerimientos','')), txt),
    motivo         = left(trim(coalesce(p->>'motivo','')), txt),
    mascota        = coalesce((p->>'mascota')::boolean, mascota),
    mascota_nombre = left(trim(coalesce(p->>'mascota_nombre','')), 60),
    mascota_raza   = left(trim(coalesce(p->>'mascota_raza','')), 60),
    ocupantes      = occ,
    ficha_firma    = case when coalesce((p->>'firmada')::boolean, false) then left(trim(p->>'nombre'), 120) else '' end,
    ficha_firmada  = case when coalesce((p->>'firmada')::boolean, false) then coalesce(r.ficha_firmada, ahora) end,
    ficha_por      = auth.uid(),
    ficha_en       = ahora
  where id = r.id;

  -- Acompañantes (del 2 en adelante) pasan a la ficha del huésped: si ya estaban
  -- anotados con ese nombre se completan su documento y edad; si no, se agregan.
  insert into acompanantes (huesped_id, nombre, documento, edad)
    select r.huesped_id, v->>'nombre', v->>'documento', (v->>'edad')::int
    from jsonb_array_elements(occ) with ordinality x(v, n)
    where n > 1 and not exists (select 1 from acompanantes a where a.huesped_id = r.huesped_id and lower(a.nombre) = lower(v->>'nombre'));
  update acompanantes a set
    documento = coalesce(nullif(v->>'documento',''), a.documento),
    edad      = coalesce((v->>'edad')::int, a.edad)
  from jsonb_array_elements(occ) with ordinality x(v, n)
  where n > 1 and a.huesped_id = r.huesped_id and lower(a.nombre) = lower(v->>'nombre');

  return ahora;
end $$;

-- Solo el equipo con sesión iniciada (la función revisa el rol por dentro).
revoke execute on function guardar_ficha(uuid, jsonb) from public, anon;
grant execute on function guardar_ficha(uuid, jsonb) to authenticated;
