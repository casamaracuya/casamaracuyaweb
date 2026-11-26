-- =====================================================================
--  Casa Maracuyá · 0022: los bebés menores de 3 años los anota Recepción en la reserva
--
--  Hasta 2 bebés menores de 3 años no pagan, así que no entran en «personas». Ahora la
--  reserva guarda cuántos vienen (reservas.bebes, de 0 a 2). Los anota Recepción al crear
--  la reserva o después desde la reserva (fijar_bebes). En «Mi reserva» el cliente ya no
--  agrega bebés: le salen las casillas de las personas y de los bebés anotados, y la lista
--  tiene que cuadrar con las dos cosas.
--
--  Va DESPUÉS de 0021. Se puede volver a correr.
--  Pruebas: supabase/tests/portal_huesped.sql
-- =====================================================================

-- ---------- 1. El campo ----------
alter table reservas add column if not exists bebes smallint not null default 0;
do $$ begin
  alter table reservas add constraint reservas_bebes check (bebes between 0 and 2);
exception when duplicate_object then null; end $$;
grant select (bebes) on reservas to authenticated;

-- La bitácora también anota cuando cambian los bebés.
drop trigger if exists bitacora_reservas on reservas;
create trigger bitacora_reservas after insert or update or delete on reservas for each row
  execute function anotar_bitacora('estado','llegada','salida','plan','personas','bebes','total','pagado','canal','huesped_id','cotizacion_id','localizador','ficha_firmada','ficha_origen');

-- ---------- 2. Recepción anota los bebés ----------
create or replace function fijar_bebes(p_reserva uuid, p_bebes int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tiene_algun_rol('{direccion,admin,recepcion}') then raise exception 'Tu rol no cambia las reservas'; end if;
  if p_bebes is null or p_bebes < 0 or p_bebes > 2 then
    raise exception 'Los bebés que no pagan van de 0 a 2. Del tercero en adelante cuentan como personas'; end if;
  update reservas set bebes = p_bebes where id = p_reserva;
  if not found then raise exception 'Reserva no encontrada'; end if;
end $$;
revoke all on function fijar_bebes(uuid, int) from public, anon;
grant execute on function fijar_bebes(uuid, int) to authenticated;

-- ---------- 3. El portal sabe cuántos bebés hay (misma función de 0020, con «bebes») ----------
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
      'plan', r.plan, 'personas', r.personas, 'bebes', r.bebes, 'mascota', r.mascota,
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

-- ---------- 4. La lista de la ficha cuadra con personas + bebés (misma función de 0021) ----------
create or replace function portal_guardar_ficha(p_codigo text, p_apellido text, p_parte int, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  x record; r reservas; h huespedes;
  t text; doc text; ad int; ni int; tot int;
  occ jsonb := '[]'; o jsonb; nom text; ed int; i int := 0; prev jsonb; nn int := 0; nb int := 0; menores int := 0;
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
      -- 0021: el número de personas lo anotó Recepción al registrar el pago y no se cambia
      -- aquí (si cambió, el cliente escribe por WhatsApp). Solo la hora y los vehículos.
      update reservas set
        hora_llegada = left(trim(coalesce(p->>'hora_llegada', '')), 20),
        vehiculos = coalesce((select array_agg(left(trim(v), 80)) from (select v from jsonb_array_elements_text(coalesce(p->'vehiculos', '[]')) v where trim(v) <> '' limit 4) s), '{}')
      where id = r.id;

    elsif p_parte = 3 then
      -- Tienen que ser las personas de la reserva (las que pagan) más los bebés anotados (0022).
      tot := coalesce(r.personas, coalesce(r.adultos, 0) + coalesce(r.ninos, 0));
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
        if ed is not null and ed < 3 then nb := nb + 1; else nn := nn + 1; end if;
        if ed is not null and ed < 18 then menores := menores + 1; end if;
        occ := occ || jsonb_build_object('nombre', nom, 'documento', doc, 'edad', ed);
      end loop;
      -- 0022: los bebés que no pagan también los anotó Recepción (reservas.bebes): la lista tiene
      -- que traer las personas de la reserva más esos bebés, y ellos menores de 3 años.
      if i <> tot + r.bebes or nb < r.bebes then
        raise exception 'Tu reserva es para % % (más % % menor de 3 años). Revisa la lista o escríbenos por WhatsApp si tienes dudas',
          tot, case when tot = 1 then 'persona' else 'personas' end, r.bebes, case when r.bebes = 1 then 'bebé' else 'bebés' end; end if;
      update reservas set ocupantes = occ, adultos = i - menores, ninos = menores where id = r.id;
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
