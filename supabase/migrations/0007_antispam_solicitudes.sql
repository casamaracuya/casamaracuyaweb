-- =====================================================================
--  Anti-spam para las solicitudes que llegan desde la web (crear_solicitud).
--
--  Antes, cualquiera (o un robot) podía llamar crear_solicitud sin límite y
--  llenar el panel de reservas falsas. Ahora, para quien NO es del equipo:
--    · el WhatsApp es obligatorio (al menos 7 dígitos);
--    · máximo 3 solicitudes por teléfono en una hora y 6 en un día;
--    · máximo 30 solicitudes en total por hora (frena robots que cambian
--      de número en cada intento);
--    · fechas razonables: llegada dentro de los próximos 2 años y estadías
--      de hasta 60 noches.
--  El equipo (con sesión iniciada en el panel) no tiene límites.
--
--  Si alguien real choca con el límite, la web le muestra el aviso de que
--  no se guardó y le deja escribir igual por WhatsApp.
--
--  Cómo correrlo: Supabase > SQL Editor > New query > pega todo > Run.
-- =====================================================================

-- Registro de cada solicitud pública, solo para contar. Nadie lo lee desde fuera:
-- tiene RLS activado y ninguna política, así que solo la función de abajo lo usa.
create table if not exists limite_solicitudes (
  id      bigserial primary key,
  creado  timestamptz not null default now(),
  tel     text not null default ''
);
create index if not exists limite_solicitudes_creado on limite_solicitudes (creado);
create index if not exists limite_solicitudes_tel on limite_solicitudes (tel, creado);
alter table limite_solicitudes enable row level security;
revoke all on limite_solicitudes from anon, authenticated;

create or replace function crear_solicitud(
  p_nombre text, p_telefono text, p_plan plan_estadia, p_personas int, p_mascota boolean,
  p_llegada date, p_salida date, p_notas text, p_canal text default 'Web', p_idioma text default 'es'
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
  insert into reservas (huesped_id, plan, personas, mascota, llegada, salida, notas, canal, idioma)
  values (h, p_plan, p_personas, coalesce(p_mascota,false), p_llegada, p_salida, left(coalesce(p_notas,''),1000), left(coalesce(p_canal,'Web'),40), left(coalesce(p_idioma,'es'),5))
  returning codigo into c;
  return c;
end $$;
grant execute on function crear_solicitud(text, text, plan_estadia, int, boolean, date, date, text, text, text) to anon, authenticated;
