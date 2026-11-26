-- =====================================================================
--  Casa Maracuyá · 0020: portal del huésped («Mi reserva») · parte 1, entrar
--  (SPEC-portal-huesped.md)
--
--  El cliente de una reserva pagada entra a casa-maracuya.com/mi-reserva con su
--  código CM- y su apellido. No tiene cuenta ni contraseña: cada llamada del
--  portal trae el código y el apellido, y la base solo devuelve lo de esa reserva.
--  Esta parte suma:
--    · el contacto de emergencia y de dónde vino la ficha (cliente o recepción);
--    · cuándo y cuántas veces se le envió el acceso al cliente;
--    · el bloqueo contra quien pruebe códigos al azar (5 fallos → 15 minutos);
--    · portal_entrar(código, apellido).
--
--  Va DESPUÉS de 0019. Cómo correrlo: Supabase > SQL Editor > New query > pega todo > Run.
--  Se puede volver a correr sin romper nada.
--  Pruebas: supabase/tests/portal_huesped.sql
-- =====================================================================

-- ---------- 1. Campos nuevos en la reserva ----------
alter table reservas
  add column if not exists emergencia_nombre     text not null default '',
  add column if not exists emergencia_parentesco text not null default '',
  add column if not exists emergencia_telefono   text not null default '',
  add column if not exists ficha_origen          text not null default '',   -- 'cliente' (portal) o 'recepcion' (panel)
  add column if not exists acceso_enviado        timestamptz,                -- la última vez que se le envió el acceso
  add column if not exists acceso_veces          int  not null default 0,
  add column if not exists acceso_por            uuid references perfiles(id) on delete set null,
  add column if not exists ficha_partes          smallint[] not null default '{}';  -- partes de la ficha que el cliente ya guardó (1 a 5)

do $$ begin
  alter table reservas add constraint reservas_ficha_origen check (ficha_origen in ('', 'cliente', 'recepcion'));
exception when duplicate_object then null; end $$;

-- El equipo lee lo que no es dato personal (ver 0015). El contacto de emergencia es
-- dato personal: lo entrega datos_personales() en la parte 2.
grant select (ficha_origen, acceso_enviado, acceso_veces, acceso_por, ficha_partes) on reservas to authenticated;

-- La bitácora también anota cuándo se firma la ficha y quién la llenó (cliente o recepción).
drop trigger if exists bitacora_reservas on reservas;
create trigger bitacora_reservas after insert or update or delete on reservas for each row
  execute function anotar_bitacora('estado','llegada','salida','plan','personas','total','pagado','canal','huesped_id','cotizacion_id','localizador','ficha_firmada','ficha_origen');

-- ---------- 2. Intentos fallidos (nadie la lee: solo las funciones del portal) ----------
create table if not exists portal_intentos (
  codigo          text primary key,          -- el código normalizado, sin guion: CM7K4Q9X
  fallos          int  not null default 0,
  bloqueado_hasta timestamptz,
  ultimo          timestamptz not null default now()
);
alter table portal_intentos enable row level security;
revoke all on portal_intentos from public, anon, authenticated;

-- ---------- 3. Ayudantes ----------
-- Texto sin tildes, en minúsculas, solo letras y un espacio entre palabras.
create or replace function portal_norm(t text) returns text
language sql immutable set search_path = public as $$
  select trim(regexp_replace(regexp_replace(lower(translate(coalesce(t, ''),
    'ÁÉÍÓÚÜÑÀÈÌÒÙÂÊÎÔÛÄËÏÖÇáéíóúüñàèìòùâêîôûäëïöç', 'AEIOUUNAEIOUAEIOUAEIOCaeiouunaeiouaeiouaeioc')),
    '[^a-z ]', ' ', 'g'), ' +', ' ', 'g'));
$$;

-- C.I. o pasaporte enmascarado: solo los últimos 3 caracteres.
create or replace function portal_mascara(t text) returns text
language sql immutable set search_path = public as $$
  select case when length(regexp_replace(coalesce(t, ''), '\s', '', 'g')) = 0 then ''
              else '•••' || right(regexp_replace(t, '\s', '', 'g'), 3) end;
$$;

-- ¿El apellido escrito es del titular? Sirve cualquier palabra (o palabras seguidas)
-- del nombre menos la primera; si el nombre es de una sola palabra, sirve esa.
create or replace function portal_apellido_ok(p_nombre text, p_apellido text) returns boolean
language sql immutable set search_path = public as $$
  with x as (select regexp_split_to_array(portal_norm(p_nombre), ' ') w, portal_norm(p_apellido) a)
  select length(a) >= 2 and
         (' ' || array_to_string(case when cardinality(w) > 1 then w[2:] else w end, ' ') || ' ') like ('% ' || a || ' %')
  from x;
$$;

-- La reserva que corresponde al código y al apellido, o null. Cuenta los fallos y
-- bloquea. La usan todas las funciones del portal (entrar, guardar la ficha, firmar).
-- p_error devuelve el mensaje para el cliente cuando no entra.
create or replace function portal_reserva(p_codigo text, p_apellido text, out r reservas, out p_error text)
language plpgsql security definer set search_path = public as $$
declare
  k text := upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'));
  i portal_intentos;
  nombre text;
  no_esta constant text := 'No encontramos una reserva con ese código y ese apellido. Revísalos o escríbenos por WhatsApp.';
begin
  if length(k) = 6 then k := 'CM' || k; end if;
  k := left(k, 12);

  -- Limpieza: los intentos viejos sin bloqueo vigente se olvidan.
  delete from portal_intentos where ultimo < now() - interval '1 day' and (bloqueado_hasta is null or bloqueado_hasta < now());

  select * into i from portal_intentos where codigo = k;
  if i.bloqueado_hasta > now() then
    p_error := 'Hiciste varios intentos seguidos. Espera 15 minutos y vuelve a probar, o escríbenos por WhatsApp.';
    return;
  end if;

  if k ~ '^CM[0-9A-Z]{6}$' then
    select x.* into r from reservas x
    where replace(x.localizador, '-', '') = k
      and x.estado in ('confirmada', 'casa', 'finalizada')
      and x.salida >= current_date - 7;
    if found then
      select h.nombre into nombre from huespedes h where h.id = r.huesped_id;
      if portal_apellido_ok(nombre, p_apellido) then
        delete from portal_intentos where codigo = k;
        return;
      end if;
      r := null;
    end if;
  end if;

  -- No entró: se cuenta el fallo; al 5.º el código queda bloqueado 15 minutos.
  insert into portal_intentos as t (codigo, fallos, ultimo) values (k, 1, now())
  on conflict (codigo) do update set
    fallos = case when t.bloqueado_hasta is not null and t.bloqueado_hasta <= now() then 1 else t.fallos + 1 end,
    bloqueado_hasta = case when t.bloqueado_hasta is not null and t.bloqueado_hasta <= now() then null else t.bloqueado_hasta end,
    ultimo = now();
  update portal_intentos set bloqueado_hasta = now() + interval '15 minutes', fallos = 0
  where codigo = k and fallos >= 5;
  p_error := no_esta;
end $$;
revoke all on function portal_reserva(text, text) from public, anon, authenticated;
revoke all on function portal_norm(text), portal_mascara(text), portal_apellido_ok(text, text) from public, anon, authenticated;

-- ---------- 4. Lo que el portal ve de su reserva ----------
-- No devuelve pagos, notas internas, cotización ni nada de otra reserva; el C.I.
-- (del titular y de los ocupantes) va enmascarado.
create or replace function portal_datos(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r reservas; h huespedes;
begin
  select * into r from reservas where id = p_id;
  select * into h from huespedes where id = r.huesped_id;
  return jsonb_build_object(
    'ok', true,
    'reserva', jsonb_build_object(
      'codigo', r.localizador,
      'llegada', r.llegada, 'salida', r.salida, 'noches', r.salida - r.llegada,
      'plan', r.plan, 'personas', r.personas, 'mascota', r.mascota,
      'estado', r.estado, 'idioma', r.idioma,
      'comprobante', r.comprobante_token),
    'ficha', jsonb_build_object(
      'nombre', h.nombre, 'documento', portal_mascara(h.documento),
      'telefono', h.telefono, 'email', h.email, 'ciudad', h.ciudad,
      'emergencia_nombre', r.emergencia_nombre, 'emergencia_parentesco', r.emergencia_parentesco,
      'emergencia_telefono', r.emergencia_telefono,
      'hora_llegada', r.hora_llegada, 'adultos', r.adultos, 'ninos', r.ninos,
      'vehiculos', to_jsonb(r.vehiculos),
      'ocupantes', coalesce((select jsonb_agg(o || jsonb_build_object('documento', portal_mascara(o->>'documento')) order by n)
                             from jsonb_array_elements(r.ocupantes) with ordinality x(o, n)), '[]'),
      'alergias', to_jsonb(h.alergias), 'bebidas', r.bebidas, 'requerimientos', r.requerimientos,
      'motivo', r.motivo, 'mascota_nombre', r.mascota_nombre, 'mascota_raza', r.mascota_raza,
      'partes', to_jsonb(r.ficha_partes),
      'firmada', r.ficha_firmada, 'origen', r.ficha_origen));
end $$;
revoke all on function portal_datos(uuid) from public, anon, authenticated;

-- ---------- 5. Entrar ----------
-- Devuelve {ok:true, reserva:{…}, ficha:{…}} o {ok:false, error:'…'}.
create or replace function portal_entrar(p_codigo text, p_apellido text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare x record;
begin
  select * into x from portal_reserva(p_codigo, p_apellido);
  if (x.r).id is null then return jsonb_build_object('ok', false, 'error', x.p_error); end if;
  return portal_datos((x.r).id);
end $$;
revoke all on function portal_entrar(text, text) from public;
grant execute on function portal_entrar(text, text) to anon, authenticated;

-- ---------- 6. Guardar la ficha, una parte a la vez ----------
-- p_parte: 1 titular y contacto de emergencia · 2 estadía y vehículos · 3 quienes se quedan
--          4 comida · 5 mascota y celebración. (La 6, normas y firma, es portal_firmar.)
-- Escribe en los mismos campos que la ficha del panel (guardar_ficha, 0009). Si la ficha
-- ya estaba firmada y el cliente cambia algo, la firma se borra y tiene que firmar de nuevo.
-- Devuelve lo mismo que portal_entrar, o {ok:false, error} con lo que falta.
create or replace function portal_guardar_ficha(p_codigo text, p_apellido text, p_parte int, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  x record; r reservas; h huespedes;
  t text; doc text; ad int; ni int; tot int;
  occ jsonb := '[]'; o jsonb; nom text; ed int; i int := 0; prev jsonb;
  al text[];
  txt constant int := 300;
begin
  select * into x from portal_reserva(p_codigo, p_apellido);
  if (x.r).id is null then return jsonb_build_object('ok', false, 'error', x.p_error); end if;
  if p_parte not between 1 and 5 then return jsonb_build_object('ok', false, 'error', 'Esa parte de la ficha no existe'); end if;
  p := coalesce(p, '{}');

  begin
    select * into r from reservas where id = (x.r).id for update;
    select * into h from huespedes where id = r.huesped_id for update;

    if p_parte = 1 then
      nom := left(trim(coalesce(p->>'nombre', '')), 120);
      if length(nom) < 3 then raise exception 'Escribe tu nombre y apellido'; end if;
      if not portal_apellido_ok(nom, p_apellido) then raise exception 'Tu nombre tiene que incluir el apellido con el que entraste'; end if;
      doc := left(trim(coalesce(p->>'documento', '')), 40);
      if doc like '•%' then doc := h.documento; end if;
      if length(doc) < 4 then raise exception 'Escribe tu C.I. o pasaporte'; end if;
      t := left(trim(coalesce(p->>'telefono', '')), 40);
      if length(regexp_replace(t, '\D', '', 'g')) < 7 then raise exception 'Escribe tu teléfono o WhatsApp'; end if;
      if trim(coalesce(p->>'email', '')) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Revisa tu correo electrónico'; end if;
      if length(trim(coalesce(p->>'emergencia_nombre', ''))) < 2 then raise exception 'Escribe un contacto de emergencia'; end if;
      if length(regexp_replace(coalesce(p->>'emergencia_telefono', ''), '\D', '', 'g')) < 7 then raise exception 'Escribe el teléfono del contacto de emergencia'; end if;
      update huespedes set nombre = nom, documento = doc, telefono = t,
        email = left(trim(p->>'email'), 120), ciudad = left(trim(coalesce(p->>'ciudad', '')), 80)
      where id = h.id;
      update reservas set
        emergencia_nombre     = left(trim(p->>'emergencia_nombre'), 120),
        emergencia_parentesco = left(trim(coalesce(p->>'emergencia_parentesco', '')), 60),
        emergencia_telefono   = left(trim(p->>'emergencia_telefono'), 40)
      where id = r.id;

    elsif p_parte = 2 then
      ad := coalesce(nullif(p->>'adultos', '')::int, 0);
      ni := coalesce(nullif(p->>'ninos', '')::int, 0);
      if ad < 1 then raise exception 'Tiene que venir al menos un adulto'; end if;
      if ni < 0 or ad + ni > 12 then raise exception 'La casa recibe hasta 12 personas en total'; end if;
      update reservas set
        hora_llegada = left(trim(coalesce(p->>'hora_llegada', '')), 20),
        adultos = ad, ninos = ni,
        vehiculos = coalesce((select array_agg(left(trim(v), 80)) from (select v from jsonb_array_elements_text(coalesce(p->'vehiculos', '[]')) v where trim(v) <> '' limit 4) s), '{}')
      where id = r.id;

    elsif p_parte = 3 then
      if r.adultos is null then raise exception 'Primero di cuántos adultos y niños vienen'; end if;
      tot := r.adultos + coalesce(r.ninos, 0);
      for o in select * from jsonb_array_elements(coalesce(p->'ocupantes', '[]')) loop
        nom := left(trim(coalesce(o->>'nombre', '')), 120);
        continue when length(nom) < 2;
        i := i + 1;
        if i > 12 then raise exception 'La casa recibe hasta 12 personas en total'; end if;
        doc := left(trim(coalesce(o->>'documento', '')), 40);
        if doc like '•%' then   -- vuelve enmascarado: se queda el que ya estaba para esa persona
          select e into prev from jsonb_array_elements(r.ocupantes) e where lower(e->>'nombre') = lower(nom) limit 1;
          doc := coalesce(prev->>'documento', '');
          if i = 1 and doc = '' then doc := h.documento; end if;
        end if;
        ed := nullif(left(regexp_replace(coalesce(o->>'edad', ''), '\D', '', 'g'), 3), '')::int;
        if ed is not null and ed > 120 then ed := null; end if;
        if (ed is null or ed >= 18) and length(doc) < 4 then raise exception 'Falta el C.I. o pasaporte de %', nom; end if;
        if ed is null and length(doc) < 4 then raise exception 'Escribe la edad de %', nom; end if;
        occ := occ || jsonb_build_object('nombre', nom, 'documento', doc, 'edad', ed);
      end loop;
      if i <> tot then raise exception 'Anotaste % personas, pero dijiste que vienen % (adultos y niños). Revisa la lista', i, tot; end if;
      update reservas set ocupantes = occ where id = r.id;
      -- Los acompañantes (del 2 en adelante) pasan a la ficha del huésped, como en el panel.
      insert into acompanantes (huesped_id, nombre, documento, edad)
        select r.huesped_id, v->>'nombre', v->>'documento', (v->>'edad')::int
        from jsonb_array_elements(occ) with ordinality z(v, n)
        where n > 1 and not exists (select 1 from acompanantes a where a.huesped_id = r.huesped_id and lower(a.nombre) = lower(v->>'nombre'));
      update acompanantes a set documento = coalesce(nullif(v->>'documento', ''), a.documento), edad = coalesce((v->>'edad')::int, a.edad)
      from jsonb_array_elements(occ) with ordinality z(v, n)
      where n > 1 and a.huesped_id = r.huesped_id and lower(a.nombre) = lower(v->>'nombre');

    elsif p_parte = 4 then
      -- Se suman a las que ya tenía anotadas (quitar una lo hace el equipo en la ficha del huésped).
      select array_agg(distinct a) into al from (
        select unnest(h.alergias) a
        union select left(trim(v), 60) from jsonb_array_elements_text(coalesce(p->'alergias', '[]')) v where trim(v) <> '' and lower(trim(v)) <> 'ninguna'
        union select left(trim(p->>'alergias_detalle'), 120) where length(trim(coalesce(p->>'alergias_detalle', ''))) > 1
      ) s;
      update huespedes set alergias = coalesce(al, '{}') where id = h.id;
      update reservas set
        bebidas = left(trim(coalesce(p->>'bebidas', '')), txt),
        requerimientos = left(trim(coalesce(p->>'requerimientos', '')), txt)
      where id = r.id;

    else -- 5
      update reservas set
        mascota = coalesce((p->>'mascota')::boolean, false),
        mascota_nombre = case when coalesce((p->>'mascota')::boolean, false) then left(trim(coalesce(p->>'mascota_nombre', '')), 60) else '' end,
        mascota_raza   = case when coalesce((p->>'mascota')::boolean, false) then left(trim(coalesce(p->>'mascota_raza', '')), 60) else '' end,
        motivo = left(trim(coalesce(p->>'motivo', '')), txt)
      where id = r.id;
      if coalesce((p->>'mascota')::boolean, false) and trim(coalesce(p->>'mascota_nombre', '')) <> '' then
        update huespedes set mascota = left(concat_ws(', ', nullif(trim(p->>'mascota_nombre'), ''), nullif(trim(p->>'mascota_raza'), '')), 120) where id = h.id;
      end if;
      if coalesce(p->>'motivo', '') ilike '%kite%' then update huespedes set kite = true where id = h.id; end if;
    end if;

    update reservas set
      ficha_origen  = 'cliente',
      ficha_en      = now(),
      ficha_por     = null,
      ficha_partes  = (select coalesce(array_agg(distinct v order by v), '{}') from unnest(ficha_partes || p_parte::smallint) v),
      ficha_firmada = null,   -- cambió algo: hay que firmar de nuevo (portal_firmar)
      ficha_firma   = ''
    where id = r.id;
  exception when others then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
  end;
  return portal_datos(r.id);
end $$;
revoke all on function portal_guardar_ficha(text, text, int, jsonb) from public;
grant execute on function portal_guardar_ficha(text, text, int, jsonb) to anon, authenticated;

-- ---------- 7. La firma (parte 6: normas y firma con el dedo) ----------
-- Cada firma queda guardada con: la imagen (PNG), el nombre y el C.I. que escribió,
-- la versión de las normas que aceptó, la fecha, el navegador, y una huella (SHA-256)
-- de la ficha tal como estaba al firmar. Si después cambia la ficha, se pide firmar
-- de nuevo y la firma anterior queda en el historial (vigente = false).
-- Nadie lee esta tabla directo: el equipo la ve con ver_firma().
create table if not exists fichas_firmas (
  id          uuid primary key default gen_random_uuid(),
  reserva_id  uuid not null references reservas(id) on delete cascade,
  imagen      text not null,                 -- data:image/png;base64,…
  nombre      text not null,
  documento   text not null,
  normas      text not null default '',      -- versión de las normas aceptadas (ficha-data.js)
  huella      text not null,                 -- SHA-256 de la ficha al firmar
  agente      text not null default '',      -- navegador desde el que firmó
  firmada     timestamptz not null default now(),
  vigente     boolean not null default true
);
create index if not exists fichas_firmas_reserva on fichas_firmas (reserva_id, firmada desc);
alter table fichas_firmas enable row level security;
revoke all on fichas_firmas from public, anon, authenticated;

-- La ficha completa (sin enmascarar) en un orden fijo, para la huella.
create or replace function portal_huella(p_id uuid, p_normas text) returns text
language sql stable security definer set search_path = public as $$
  select encode(sha256(convert_to(jsonb_build_object(
    'normas', p_normas,
    'titular', jsonb_build_object('nombre', h.nombre, 'documento', h.documento, 'telefono', h.telefono, 'email', h.email, 'ciudad', h.ciudad, 'alergias', h.alergias),
    'emergencia', jsonb_build_object('nombre', r.emergencia_nombre, 'parentesco', r.emergencia_parentesco, 'telefono', r.emergencia_telefono),
    'estadia', jsonb_build_object('codigo', r.localizador, 'llegada', r.llegada, 'salida', r.salida, 'hora', r.hora_llegada, 'adultos', r.adultos, 'ninos', r.ninos, 'vehiculos', r.vehiculos),
    'ocupantes', r.ocupantes,
    'comida', jsonb_build_object('bebidas', r.bebidas, 'requerimientos', r.requerimientos),
    'mascota', jsonb_build_object('si', r.mascota, 'nombre', r.mascota_nombre, 'raza', r.mascota_raza),
    'motivo', r.motivo)::text, 'UTF8')), 'hex')
  from reservas r join huespedes h on h.id = r.huesped_id where r.id = p_id;
$$;
revoke all on function portal_huella(uuid, text) from public, anon, authenticated;

-- p trae: acepto (bool), nombre, documento, firma ('data:image/png;base64,…'), normas (versión).
create or replace function portal_firmar(p_codigo text, p_apellido text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  x record; r reservas; h huespedes;
  doc text; img text; b bytea; agente text; normas text;
  limpio constant text := '[^A-Za-z0-9]';
begin
  select * into x from portal_reserva(p_codigo, p_apellido);
  if (x.r).id is null then return jsonb_build_object('ok', false, 'error', x.p_error); end if;
  p := coalesce(p, '{}');
  begin
    select * into r from reservas where id = (x.r).id for update;
    select * into h from huespedes where id = r.huesped_id;
    if not (r.ficha_partes @> '{1,2,3,4,5}') then raise exception 'Primero completa las 5 partes de la ficha'; end if;
    if not coalesce((p->>'acepto')::boolean, false) then raise exception 'Para firmar tienes que aceptar las normas de la casa'; end if;
    if portal_norm(p->>'nombre') <> portal_norm(h.nombre) then raise exception 'Escribe tu nombre completo como está en la ficha: %', h.nombre; end if;
    doc := trim(coalesce(p->>'documento', ''));
    if doc like '•%' then doc := h.documento; end if;
    if upper(regexp_replace(doc, limpio, '', 'g')) <> upper(regexp_replace(h.documento, limpio, '', 'g')) or length(doc) < 4 then
      raise exception 'El C.I. o pasaporte no coincide con el de la ficha'; end if;
    img := coalesce(p->>'firma', '');
    if img not like 'data:image/png;base64,%' or length(img) > 400000 then raise exception 'No pudimos leer la firma. Bórrala y vuelve a firmar'; end if;
    begin
      b := decode(substr(img, 23), 'base64');
    exception when others then raise exception 'No pudimos leer la firma. Bórrala y vuelve a firmar';
    end;
    if substring(b from 1 for 8) <> '\x89504e470d0a1a0a'::bytea then raise exception 'No pudimos leer la firma. Bórrala y vuelve a firmar'; end if;
    normas := left(trim(coalesce(p->>'normas', '')), 40);
    agente := left(coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb->>'user-agent', 300);

    update fichas_firmas set vigente = false where reserva_id = r.id and vigente;
    insert into fichas_firmas (reserva_id, imagen, nombre, documento, normas, huella, agente)
      values (r.id, img, h.nombre, h.documento, normas, portal_huella(r.id, normas), coalesce(agente, ''));
    update reservas set ficha_firmada = now(), ficha_firma = h.nombre, ficha_origen = 'cliente', ficha_en = now(), ficha_por = null
    where id = r.id;
  exception when others then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
  end;
  return portal_datos(r.id);
end $$;
revoke all on function portal_firmar(text, text, jsonb) from public;
grant execute on function portal_firmar(text, text, jsonb) to anon, authenticated;

-- El equipo que ve datos personales (ver 0015) ve la firma vigente de una reserva.
create or replace function ver_firma(p_reserva uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not ve_datos_personales() then return null; end if;
  return (select jsonb_build_object('imagen', imagen, 'nombre', nombre, 'documento', documento, 'normas', normas,
                                    'huella', huella, 'firmada', firmada, 'agente', agente)
          from fichas_firmas where reserva_id = p_reserva and vigente order by firmada desc limit 1);
end $$;
revoke all on function ver_firma(uuid) from public, anon;
grant execute on function ver_firma(uuid) to authenticated;


-- ---------- 8. Panel: el equipo ve el contacto de emergencia (misma función de 0015, con un campo más) ----------
create or replace function datos_personales() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare ve boolean := ve_datos_personales();
begin
  if not es_equipo() then return null; end if;
  return jsonb_build_object(
    'huespedes', case when ve then coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'telefono', telefono, 'tel_norm', tel_norm, 'email', email, 'documento', documento)) from huespedes), '[]') else '[]' end,
    'acompanantes', case when ve then coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'documento', documento)) from acompanantes), '[]') else '[]' end,
    'reservas', coalesce((select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'ocupantes', case when ve then r.ocupantes
                     else coalesce((select jsonb_agg(o - 'documento') from jsonb_array_elements(r.ocupantes) o), '[]') end,
        'comprobante_token', case when ve then r.comprobante_token end,
        'comprobante_correo', case when ve then r.comprobante_correo else '' end,
        'emergencia', case when ve then jsonb_build_object('nombre', r.emergencia_nombre, 'parentesco', r.emergencia_parentesco, 'telefono', r.emergencia_telefono) end)) from reservas r), '[]')
  );
end $$;
revoke all on function datos_personales() from public, anon;
grant execute on function datos_personales() to authenticated;

-- ---------- 9. Panel: la ficha que pasa Recepción también guarda el contacto de emergencia ----------
-- Misma función de 0009, con el contacto de emergencia y el origen de la ficha.
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
    ficha_en       = ahora,
    -- 0020: contacto de emergencia (si viene) y de dónde vino la ficha. Si la llenó el
    -- cliente en el portal y Recepción la corrige, sigue diciendo «cliente».
    emergencia_nombre     = left(trim(coalesce(p->>'emergencia_nombre', emergencia_nombre)), 120),
    emergencia_parentesco = left(trim(coalesce(p->>'emergencia_parentesco', emergencia_parentesco)), 60),
    emergencia_telefono   = left(trim(coalesce(p->>'emergencia_telefono', emergencia_telefono)), 40),
    ficha_origen   = case when ficha_origen = '' then 'recepcion' else ficha_origen end
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
revoke execute on function guardar_ficha(uuid, jsonb) from public, anon;
grant execute on function guardar_ficha(uuid, jsonb) to authenticated;

-- ---------- 10. Enviar el acceso al cliente ----------
-- Recepción toca «Enviar acceso» (por WhatsApp o, en la parte 2, por correo): queda anotado
-- cuándo, quién y cuántas veces. Devuelve el enlace del portal con el código de la reserva.
create or replace function registrar_acceso(p_reserva uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r reservas;
begin
  if not tiene_algun_rol('{direccion,admin,recepcion}') then raise exception 'Tu rol no envía accesos a clientes'; end if;
  select * into r from reservas where id = p_reserva for update;
  if not found then raise exception 'Reserva no encontrada'; end if;
  if r.localizador is null or r.estado not in ('confirmada', 'casa', 'finalizada') then
    raise exception 'La reserva todavía no está pagada: no tiene código para entrar'; end if;
  update reservas set acceso_enviado = now(), acceso_veces = acceso_veces + 1, acceso_por = auth.uid() where id = r.id;
  return jsonb_build_object(
    'codigo', r.localizador, 'veces', r.acceso_veces + 1,
    'enlace', 'https://casa-maracuya.com' || case when r.idioma = 'en' then '/en/my-booking' else '/mi-reserva' end || '?c=' || r.localizador);
end $$;
revoke all on function registrar_acceso(uuid) from public, anon;
grant execute on function registrar_acceso(uuid) to authenticated;
