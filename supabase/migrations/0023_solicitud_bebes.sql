-- =====================================================================
--  Casa Maracuyá · 0023: la solicitud de la web guarda los bebés
--
--  El formulario de la web ya pregunta cuántos bebés menores de 3 años vienen, pero solo
--  quedaba escrito en las notas. Ahora crear_solicitud recibe p_bebes (los que no pagan,
--  de 0 a 2) y lo guarda en reservas.bebes (0022), así la reserva y «Mi reserva» ya lo saben.
--
--  También: con 12 personas + 2 bebés la lista de la ficha tiene 14 nombres; el tope de 12 del
--  portal (portal_guardar_ficha) y de la ficha del panel (guardar_ficha) se corrige.
--
--  Va DESPUÉS de 0022. Se puede volver a correr.
--  Pruebas: supabase/tests/solicitudes.sql
-- =====================================================================

-- La versión anterior (sin p_bebes) se quita para que no haya dos con el mismo nombre.
drop function if exists crear_solicitud(text, text, plan_estadia, int, boolean, date, date, text, text, text);

create or replace function crear_solicitud(
  p_nombre text, p_telefono text, p_plan plan_estadia, p_personas int, p_mascota boolean,
  p_llegada date, p_salida date, p_notas text, p_canal text default 'Web', p_idioma text default 'es',
  p_bebes int default 0
) returns text
language plpgsql security definer set search_path = public as $$
declare
  h uuid; c text;
  n text := right(regexp_replace(coalesce(p_telefono,''), '\D', '', 'g'), 10);
  publico boolean := not es_equipo();
  por_tel_hora int; por_tel_dia int; total_hora int;
begin
  if length(trim(coalesce(p_nombre,''))) < 2 then raise exception 'Falta el nombre'; end if;
  if p_salida <= p_llegada then raise exception 'La salida tiene que ser después de la llegada'; end if;
  if p_llegada < current_date then raise exception 'La llegada no puede ser una fecha pasada'; end if;
  if p_personas not between 1 and 12 then raise exception 'Entre 1 y 12 personas'; end if;

  if publico then
    if length(n) < 7 then raise exception 'Falta tu WhatsApp'; end if;
    if p_llegada > current_date + interval '2 years' then raise exception 'La llegada está demasiado lejos'; end if;
    if p_salida - p_llegada > 60 then raise exception 'La estadía no puede pasar de 60 noches'; end if;

    -- Una solicitud a la vez: así un ataque en paralelo no se salta los conteos.
    perform pg_advisory_xact_lock(hashtext('crear_solicitud'));
    delete from limite_solicitudes where creado < now() - interval '2 days';
    select count(*) filter (where tel = n and creado > now() - interval '1 hour'),
           count(*) filter (where tel = n),
           count(*) filter (where creado > now() - interval '1 hour')
      into por_tel_hora, por_tel_dia, total_hora
      from limite_solicitudes where creado > now() - interval '1 day';
    if por_tel_hora >= 3 or por_tel_dia >= 6 then
      raise exception 'Ya recibimos varias solicitudes de este número. Escríbenos por WhatsApp.';
    end if;
    if total_hora >= 30 then
      raise exception 'Estamos recibiendo muchas solicitudes. Escríbenos por WhatsApp.';
    end if;
    insert into limite_solicitudes (tel) values (n);
  end if;

  if length(n) >= 7 then select id into h from huespedes where tel_norm = n order by creado limit 1; end if;
  if h is null then
    insert into huespedes (nombre, telefono) values (left(trim(p_nombre),120), left(coalesce(p_telefono,''),40)) returning id into h;
  end if;
  insert into reservas (huesped_id, plan, personas, bebes, mascota, llegada, salida, notas, canal, idioma)
  values (h, p_plan, p_personas, least(greatest(coalesce(p_bebes, 0), 0), 2), coalesce(p_mascota,false), p_llegada, p_salida, left(coalesce(p_notas,''),1000), left(coalesce(p_canal,'Web'),40), left(coalesce(p_idioma,'es'),5))
  returning codigo into c;
  return c;
end $$;
grant execute on function crear_solicitud(text, text, plan_estadia, int, boolean, date, date, text, text, text, int) to anon, authenticated;

-- ---------- La ficha del portal acepta 12 personas + 2 bebés (misma función de 0022) ----------
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
        if i > 14 then raise exception 'La casa recibe hasta 12 personas y 2 bebés'; end if;   -- 0023: 12 que pagan + 2 bebés
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

-- ---------- La ficha del panel también (misma función de 0020) ----------
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
  if ni < 0 or ad + ni > 12 + coalesce(r.bebes, 0) then raise exception 'La casa recibe hasta 12 personas en total (más los bebés que no pagan)'; end if;   -- 0023

  -- Ocupantes: el titular primero, luego los acompañantes con nombre. Máximo 12.
  for o in select * from jsonb_array_elements(coalesce(p->'ocupantes','[]')) loop
    nom := left(trim(coalesce(o->>'nombre','')), 120);
    continue when length(nom) < 2;
    i := i + 1;
    if i > 12 + coalesce(r.bebes, 0) then raise exception 'La casa recibe hasta 12 personas en total (más los bebés que no pagan)'; end if;   -- 0023
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
