-- =====================================================================
--  Casa Maracuyá · Pruebas del portal del huésped (migración 0020)
--
--  Qué prueba: que el cliente entre a «Mi reserva» solo con su código CM- y
--  su apellido; que alguien que prueba al azar quede bloqueado; que el portal
--  no deje ver nada de otra reserva ni datos internos; y que nadie anónimo
--  lea las tablas directo.
--
--  Es seguro correrlo en producción: todo pasa dentro de una transacción que
--  SIEMPRE se deshace al final. Usa fechas del año 2099.
--
--  Cómo correrlo: después de 0020, Supabase > SQL Editor > New query > pega todo > Run.
--  El resultado aparece como un mensaje que empieza por «PRUEBAS 0020».
--  Si dice «0 fallas», todo está bien.
-- =====================================================================
begin;

create temp table resultados (n serial, prueba text, quien text, espera text, obtuvo text, ok boolean);
create temp table usuarios (rol text primary key, id uuid);
grant all on resultados, usuarios to authenticated, anon;
grant usage, select on sequence resultados_n_seq to authenticated, anon;

do $$
declare r text;
begin
  foreach r in array array['direccion','recepcion','cocina'] loop
    insert into usuarios values (r, gen_random_uuid());
    insert into auth.users (id, email) select id, 'prueba0020-' || r || '@prueba.invalid' from usuarios where rol = r;
    update perfiles set roles = array[r]::rol_equipo[] where id = (select id from usuarios where rol = r);
  end loop;
end $$;

-- ---------- Ejecuta una consulta como otro usuario y anota el resultado ----------
-- p_sql debe devolver un número. p_espera: 'cero', 'hay', 'error' o 'funciona'.
create function pg_temp.probar(p_prueba text, p_quien text, p_sql text, p_espera text) returns void
language plpgsql as $f$
declare v bigint; obt text;
begin
  if p_quien = 'base' then
    null;  -- revisa directo en la base, sin los permisos de nadie
  elsif p_quien = 'anon' then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    execute 'set local role anon';
  else
    perform set_config('request.jwt.claims', json_build_object('sub', (select id from usuarios where rol = p_quien), 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
  end if;
  begin
    execute p_sql into v;
    obt := coalesce(v, 0)::text;
  exception when others then
    obt := 'error: ' || left(sqlerrm, 90);
  end;
  if p_quien <> 'base' then execute 'reset role'; end if;
  perform set_config('request.jwt.claims', '', true);
  insert into resultados (prueba, quien, espera, obtuvo, ok) values (p_prueba, p_quien, p_espera, obt,
    case p_espera
      when 'cero' then obt = '0'
      when 'hay' then obt !~ '^error' and obt <> '0'
      when 'error' then obt ~ '^error'
      when 'funciona' then obt !~ '^error'
    end);
end $f$;

-- ---------- Datos de prueba ----------
-- a: confirmada, titular «María José Pérez Rojas»   b: otra confirmada (para los bloqueos)
-- c: cancelada   d: salió hace 10 días   e: salió hace 3 días   f: solicitud sin pagar
create temp table ids as select gen_random_uuid() a, gen_random_uuid() b, gen_random_uuid() c, gen_random_uuid() d,
  gen_random_uuid() e, gen_random_uuid() f, gen_random_uuid() h, gen_random_uuid() h2;
insert into huespedes (id, nombre, telefono, documento) select h, 'María José Pérez Rojas', '+58 400 333 0020', 'V-12345678' from ids;
insert into huespedes (id, nombre, telefono) select h2, 'Cher', '+58 400 333 0021' from ids;
insert into reservas (id, huesped_id, plan, personas, llegada, salida, estado, canal, notas)
  select a, h, 'esencial'::plan_estadia, 4, date '2099-05-10', date '2099-05-12', 'confirmada'::estado_reserva, 'WhatsApp', 'Nota interna secreta' from ids
  union all select b, h2, 'plena'::plan_estadia, 2, date '2099-06-10', date '2099-06-12', 'confirmada'::estado_reserva, 'Web', '' from ids
  union all select c, h, 'esencial'::plan_estadia, 4, date '2099-07-10', date '2099-07-12', 'confirmada'::estado_reserva, 'Web', '' from ids
  union all select d, h, 'esencial'::plan_estadia, 4, current_date - 12, current_date - 10, 'finalizada'::estado_reserva, 'Web', '' from ids
  union all select e, h, 'esencial'::plan_estadia, 4, current_date - 5, current_date - 3, 'finalizada'::estado_reserva, 'Web', '' from ids
  union all select f, h, 'esencial'::plan_estadia, 4, date '2099-08-10', date '2099-08-12', 'nueva'::estado_reserva, 'Web', '' from ids;
update reservas set estado = 'cancelada' where id = (select c from ids);
create temp table locs as select
  (select localizador from reservas where id = (select a from ids)) a,
  (select localizador from reservas where id = (select b from ids)) b,
  (select localizador from reservas where id = (select c from ids)) c,
  (select localizador from reservas where id = (select d from ids)) d,
  (select localizador from reservas where id = (select e from ids)) e;
grant select on ids, locs to anon, authenticated;

-- Abreviatura: 1 si entra, 0 si no.
create function pg_temp.entra(p_cod text, p_ape text) returns int language sql as $$
  select case when (portal_entrar(p_cod, p_ape)->>'ok')::boolean then 1 else 0 end $$;
grant execute on function pg_temp.entra(text, text) to anon;

-- ---------- Entrar ----------
select pg_temp.probar('Entra con el código y su apellido', 'anon', $q$select pg_temp.entra((select a from locs), 'Pérez')$q$, 'hay');
select pg_temp.probar('…sin tildes ni mayúsculas y con los dos apellidos', 'anon', $q$select pg_temp.entra((select a from locs), '  perez   ROJAS ')$q$, 'hay');
select pg_temp.probar('…con el código en minúsculas y sin guion', 'anon', $q$select pg_temp.entra(lower(replace((select a from locs), '-', '')), 'Rojas')$q$, 'hay');
select pg_temp.probar('Con el primer nombre no entra', 'anon', $q$select pg_temp.entra((select a from locs), 'María')$q$, 'cero');
select pg_temp.probar('Con medio apellido no entra', 'anon', $q$select pg_temp.entra((select a from locs), 'Pér')$q$, 'cero');
select pg_temp.probar('Con un código inventado no entra', 'anon', $q$select pg_temp.entra('CM-ZZZZZZ', 'Pérez')$q$, 'cero');
select pg_temp.probar('Con el apellido de otra reserva no entra', 'anon', $q$select pg_temp.entra((select b from locs), 'Pérez')$q$, 'cero');
select pg_temp.probar('Si el nombre tiene una sola palabra, sirve esa', 'anon', $q$select pg_temp.entra((select b from locs), 'cher')$q$, 'hay');
select pg_temp.probar('El error es el mismo si falla el código o el apellido', 'anon',
  $q$select count(*) - 1 from (select portal_entrar('CM-ZZZZZY', 'Pérez')->>'error' x union select portal_entrar((select a from locs), 'Nadie')->>'error') s$q$, 'cero');
select pg_temp.probar('Una reserva cancelada no entra', 'anon', $q$select pg_temp.entra((select c from locs), 'Pérez')$q$, 'cero');
select pg_temp.probar('Si salió hace 10 días ya no entra', 'anon', $q$select pg_temp.entra((select d from locs), 'Pérez')$q$, 'cero');
select pg_temp.probar('Si salió hace 3 días todavía entra', 'anon', $q$select pg_temp.entra((select e from locs), 'Pérez')$q$, 'hay');
select pg_temp.probar('Una solicitud sin pagar no tiene código', 'direccion', $q$select count(*) from reservas where id = (select f from ids) and localizador is not null$q$, 'cero');

-- ---------- Lo que devuelve ----------
select pg_temp.probar('Devuelve sus fechas', 'anon', $q$select count(*) from (select portal_entrar((select a from locs), 'Pérez') j) s where j->'reserva'->>'llegada' = '2099-05-10'$q$, 'hay');
select pg_temp.probar('El C.I. no vuelve completo', 'anon', $q$select count(*) from (select portal_entrar((select a from locs), 'Pérez')::text j) s where j like '%12345678%'$q$, 'cero');
select pg_temp.probar('…solo los últimos 3 dígitos', 'anon', $q$select count(*) from (select portal_entrar((select a from locs), 'Pérez') j) s where j->'ficha'->>'documento' like '%678'$q$, 'hay');
select pg_temp.probar('No devuelve las notas internas', 'anon', $q$select count(*) from (select portal_entrar((select a from locs), 'Pérez')::text j) s where j like '%secreta%'$q$, 'cero');
select pg_temp.probar('No devuelve pagos', 'anon', $q$select count(*) from (select portal_entrar((select a from locs), 'Pérez')::text j) s where j like '%"pagos"%' or j like '%"pagado"%'$q$, 'cero');

-- ---------- Bloqueo por intentos ----------
select pg_temp.probar('4 intentos fallidos todavía no bloquean', 'anon',
  $q$select pg_temp.entra((select b from locs), 'x1') + pg_temp.entra((select b from locs), 'x2') + pg_temp.entra((select b from locs), 'x3') + pg_temp.entra((select b from locs), 'x4') + pg_temp.entra((select b from locs), 'Cher')$q$, 'hay');
select pg_temp.probar('Entrar bien borra los fallos anteriores', 'anon',
  $q$select pg_temp.entra((select b from locs), 'x1') + pg_temp.entra((select b from locs), 'x2') + pg_temp.entra((select b from locs), 'x3') + pg_temp.entra((select b from locs), 'x4') + pg_temp.entra((select b from locs), 'Cher')$q$, 'hay');
select pg_temp.probar('Al 5.º fallo el código queda bloqueado, aunque después pongan el apellido bien', 'anon',
  $q$select pg_temp.entra((select b from locs), 'x1') + pg_temp.entra((select b from locs), 'x2') + pg_temp.entra((select b from locs), 'x3') + pg_temp.entra((select b from locs), 'x4') + pg_temp.entra((select b from locs), 'x5') + pg_temp.entra((select b from locs), 'Cher')$q$, 'cero');
select pg_temp.probar('…y el mensaje lo dice', 'anon', $q$select count(*) from (select portal_entrar((select b from locs), 'Cher')->>'error' x) s where x ilike '%minutos%'$q$, 'hay');
select pg_temp.probar('El bloqueo es solo de ese código', 'anon', $q$select pg_temp.entra((select a from locs), 'Pérez')$q$, 'hay');
-- Pasan los 15 minutos:
update portal_intentos set bloqueado_hasta = now() - interval '1 minute' where codigo = replace((select b from locs), '-', '');
select pg_temp.probar('…(después del bloqueo) entra', 'anon', $q$select pg_temp.entra((select b from locs), 'Cher')$q$, 'hay');

-- ---------- Nadie lee las tablas directo ----------
select pg_temp.probar('Anónimo no lee los intentos', 'anon', 'select count(*) from portal_intentos', 'error');
select pg_temp.probar('El equipo tampoco escribe en los intentos', 'recepcion', $q$with x as (delete from portal_intentos returning 1) select count(*) from x$q$, 'error');
select pg_temp.probar('Anónimo no lee reservas', 'anon', 'select count(*) from reservas', 'error');
select pg_temp.probar('Anónimo no lee huéspedes', 'anon', 'select count(*) from huespedes', 'error');

-- ---------- Campos nuevos para el equipo ----------
select pg_temp.probar('El contacto de emergencia existe en la reserva', 'direccion', $q$select count(*) from information_schema.columns where table_name = 'reservas' and column_name in ('emergencia_nombre','emergencia_parentesco','emergencia_telefono','ficha_origen','acceso_enviado','acceso_veces')$q$, 'hay');

-- ---------- Guardar la ficha, parte por parte (tarea 3) ----------
-- Abreviatura: guarda una parte como el cliente de la reserva «a»; 1 si guardó.
create function pg_temp.guarda(p_parte int, p jsonb, p_ape text default 'Pérez') returns int language sql as $$
  select case when (portal_guardar_ficha((select a from locs), p_ape, p_parte, p)->>'ok')::boolean then 1 else 0 end $$;
grant execute on function pg_temp.guarda(int, jsonb, text) to anon;

select pg_temp.probar('Parte 1: guarda el titular y el contacto de emergencia', 'anon', $q$select pg_temp.guarda(1, '{"nombre":"María José Pérez Rojas","documento":"V-12345678","telefono":"+58 412 111 2233","email":"maria@correo.com","ciudad":"Valencia","emergencia_nombre":"Luis Pérez","emergencia_parentesco":"Hermano","emergencia_telefono":"+58 414 999 8877"}')$q$, 'hay');
select pg_temp.probar('…queda en la reserva y en su ficha', 'base', $q$select count(*) from reservas r join huespedes h on h.id = r.huesped_id where r.id = (select a from ids) and r.emergencia_nombre = 'Luis Pérez' and h.ciudad = 'Valencia' and r.ficha_origen = 'cliente'$q$, 'hay');
select pg_temp.probar('Parte 1 sin contacto de emergencia no se guarda', 'anon', $q$select pg_temp.guarda(1, '{"nombre":"María José Pérez Rojas","documento":"V-12345678","telefono":"+58 412 111 2233","email":"maria@correo.com","ciudad":"Valencia","emergencia_nombre":"","emergencia_telefono":""}')$q$, 'cero');
select pg_temp.probar('Si el C.I. vuelve enmascarado, se queda el que estaba', 'anon', $q$select pg_temp.guarda(1, '{"nombre":"María José Pérez Rojas","documento":"•••678","telefono":"+58 412 111 2233","email":"maria@correo.com","ciudad":"Valencia","emergencia_nombre":"Luis Pérez","emergencia_parentesco":"Hermano","emergencia_telefono":"+58 414 999 8877"}')$q$, 'hay');
select pg_temp.probar('…y el C.I. sigue completo en la base', 'base', $q$select count(*) from reservas r join huespedes h on h.id = r.huesped_id where r.id = (select a from ids) and h.documento = 'V-12345678'$q$, 'hay');
select pg_temp.probar('No puede cambiar el nombre a uno sin su apellido', 'anon', $q$select pg_temp.guarda(1, '{"nombre":"Otra Persona","documento":"V-99887766","telefono":"+58 412 111 2233","email":"x@y.com","ciudad":"X","emergencia_nombre":"Luis","emergencia_parentesco":"Hermano","emergencia_telefono":"+58 414 999 8877"}')$q$, 'cero');
select pg_temp.probar('Con el apellido equivocado no guarda nada', 'anon', $q$select pg_temp.guarda(2, '{"hora_llegada":"4:00 PM","adultos":3,"ninos":1,"vehiculos":["AB123CD · Fortuner"]}', 'Gómez')$q$, 'cero');
select pg_temp.probar('Parte 2: hora, adultos, niños y vehículos', 'anon', $q$select pg_temp.guarda(2, '{"hora_llegada":"4:00 PM","adultos":3,"ninos":1,"vehiculos":["AB123CD · Fortuner",""]}')$q$, 'hay');
select pg_temp.probar('Parte 2 no cambia el número de personas (lo anotó Recepción)', 'anon', $q$select pg_temp.guarda(2, '{"hora_llegada":"5:00 PM","adultos":10,"ninos":3,"personas":13}')$q$, 'hay');
select pg_temp.probar('…la reserva sigue siendo de 4 personas', 'base', $q$select count(*) from reservas where id = (select a from ids) and personas = 4 and coalesce(adultos, 0) + coalesce(ninos, 0) <> 13$q$, 'hay');
select pg_temp.probar('Parte 3: tienen que ser las personas de la reserva (aquí faltan)', 'anon', $q$select pg_temp.guarda(3, '{"ocupantes":[{"nombre":"María José Pérez Rojas","documento":"V-12345678"},{"nombre":"Ana Rojas","documento":"V-20111222"}]}')$q$, 'cero');
select pg_temp.probar('Parte 3: un adulto sin C.I. no se guarda', 'anon', $q$select pg_temp.guarda(3, '{"ocupantes":[{"nombre":"María José Pérez Rojas","documento":"V-12345678"},{"nombre":"Ana Rojas","documento":"","edad":30},{"nombre":"Juan Rojas","documento":"V-30111222"},{"nombre":"Pedrito Rojas","documento":"","edad":6}]}')$q$, 'cero');
select pg_temp.probar('Parte 3: un niño sin edad no se guarda', 'anon', $q$select pg_temp.guarda(3, '{"ocupantes":[{"nombre":"María José Pérez Rojas","documento":"V-12345678"},{"nombre":"Ana Rojas","documento":"V-20111222"},{"nombre":"Juan Rojas","documento":"V-30111222"},{"nombre":"Pedrito Rojas","documento":""}]}')$q$, 'cero');
select pg_temp.probar('Parte 3: 4 personas que cuadran, el niño con edad', 'anon', $q$select pg_temp.guarda(3, '{"ocupantes":[{"nombre":"María José Pérez Rojas","documento":"•••678"},{"nombre":"Ana Rojas","documento":"V-20111222"},{"nombre":"Juan Rojas","documento":"V-30111222"},{"nombre":"Pedrito Rojas","documento":"","edad":6}]}')$q$, 'hay');
select pg_temp.probar('…el titular queda con su C.I. completo', 'base', $q$select count(*) from reservas where id = (select a from ids) and ocupantes->0->>'documento' = 'V-12345678'$q$, 'hay');
select pg_temp.probar('…y los acompañantes pasan a su ficha de huésped', 'base', $q$select count(*) from acompanantes where huesped_id = (select h from ids) and nombre = 'Ana Rojas' and documento = 'V-20111222'$q$, 'hay');
select pg_temp.probar('…cuenta sola 3 adultos y 1 niño', 'base', $q$select count(*) from reservas where id = (select a from ids) and adultos = 3 and ninos = 1$q$, 'hay');
select pg_temp.probar('Parte 3: una persona de más (no bebé) no se acepta', 'anon', $q$select pg_temp.guarda(3, '{"ocupantes":[{"nombre":"María José Pérez Rojas","documento":"•••678"},{"nombre":"Ana Rojas","documento":"V-20111222"},{"nombre":"Juan Rojas","documento":"V-30111222"},{"nombre":"Pedrito Rojas","documento":"","edad":6},{"nombre":"Tío Rojas","documento":"V-40111222"}]}')$q$, 'cero');
select pg_temp.probar('Parte 3: sin bebés anotados por Recepción, no se suma un bebé', 'anon', $q$select pg_temp.guarda(3, '{"ocupantes":[{"nombre":"María José Pérez Rojas","documento":"•••678"},{"nombre":"Ana Rojas","documento":"•••222"},{"nombre":"Juan Rojas","documento":"•••222"},{"nombre":"Pedrito Rojas","documento":"","edad":6},{"nombre":"Bebé Rojas","documento":"","edad":1}]}')$q$, 'cero');
select pg_temp.probar('Cocina no anota bebés', 'cocina', $q$select count(*) from (select fijar_bebes((select a from ids), 1)) s$q$, 'error');
select pg_temp.probar('No se anotan más de 2 bebés que no pagan', 'recepcion', $q$select count(*) from (select fijar_bebes((select a from ids), 3)) s$q$, 'error');
select pg_temp.probar('Recepción anota 1 bebé en la reserva', 'recepcion', $q$select count(*) from (select fijar_bebes((select a from ids), 1)) s$q$, 'hay');
select pg_temp.probar('…el portal lo sabe', 'anon', $q$select (portal_entrar((select a from locs), 'Pérez')->'reserva'->>'bebes')::int$q$, 'hay');
select pg_temp.probar('Parte 3: con 1 bebé anotado, va en la lista', 'anon', $q$select pg_temp.guarda(3, '{"ocupantes":[{"nombre":"María José Pérez Rojas","documento":"•••678"},{"nombre":"Ana Rojas","documento":"•••222"},{"nombre":"Juan Rojas","documento":"•••222"},{"nombre":"Pedrito Rojas","documento":"","edad":6},{"nombre":"Bebé Rojas","documento":"","edad":1}]}')$q$, 'hay');
select pg_temp.probar('…queda con 3 adultos, 2 niños, 4 personas que pagan y 1 bebé', 'base', $q$select count(*) from reservas where id = (select a from ids) and adultos = 3 and ninos = 2 and personas = 4 and bebes = 1 and jsonb_array_length(ocupantes) = 5$q$, 'hay');
select pg_temp.probar('Parte 3: con 1 bebé anotado, sin el bebé no cuadra', 'anon', $q$select pg_temp.guarda(3, '{"ocupantes":[{"nombre":"María José Pérez Rojas","documento":"•••678"},{"nombre":"Ana Rojas","documento":"•••222"},{"nombre":"Juan Rojas","documento":"•••222"},{"nombre":"Pedrito Rojas","documento":"","edad":6}]}')$q$, 'cero');
select pg_temp.probar('Parte 3: el «bebé» tiene que ser menor de 3 años', 'anon', $q$select pg_temp.guarda(3, '{"ocupantes":[{"nombre":"María José Pérez Rojas","documento":"•••678"},{"nombre":"Ana Rojas","documento":"•••222"},{"nombre":"Juan Rojas","documento":"•••222"},{"nombre":"Pedrito Rojas","documento":"","edad":6},{"nombre":"Primo Rojas","documento":"","edad":8}]}')$q$, 'cero');
select pg_temp.probar('Parte 3: más de 2 bebés de más no se aceptan', 'anon', $q$select pg_temp.guarda(3, '{"ocupantes":[{"nombre":"María José Pérez Rojas","documento":"•••678"},{"nombre":"Ana Rojas","documento":"•••222"},{"nombre":"Juan Rojas","documento":"•••222"},{"nombre":"Pedrito Rojas","documento":"","edad":6},{"nombre":"Bebé Uno","documento":"","edad":1},{"nombre":"Bebé Dos","documento":"","edad":2},{"nombre":"Bebé Tres","documento":"","edad":0}]}')$q$, 'cero');
select pg_temp.probar('Parte 4: alergias, bebidas y requerimientos', 'anon', $q$select pg_temp.guarda(4, '{"alergias":["Mariscos"],"alergias_detalle":"Camarón","bebidas":"Café negro","requerimientos":"Menú infantil"}')$q$, 'hay');
select pg_temp.probar('…las alergias quedan en su ficha', 'direccion', $q$select count(*) from huespedes where id = (select h from ids) and 'Mariscos' = any(alergias)$q$, 'hay');
select pg_temp.probar('Parte 5: mascota y celebración', 'anon', $q$select pg_temp.guarda(5, '{"mascota":true,"mascota_nombre":"Toby","mascota_raza":"Poodle","motivo":"Aniversario"}')$q$, 'hay');
select pg_temp.probar('Recuerda qué partes ya llenó', 'anon', $q$select jsonb_array_length(portal_entrar((select a from locs), 'Pérez')->'ficha'->'partes')$q$, 'hay');
select pg_temp.probar('…son las 5', 'anon', $q$select jsonb_array_length(portal_entrar((select a from locs), 'Pérez')->'ficha'->'partes') - 5$q$, 'cero');
select pg_temp.probar('Una parte que no existe no se guarda', 'anon', $q$select pg_temp.guarda(9, '{}')$q$, 'cero');
select pg_temp.probar('Lo que guarda el cliente no toca otra reserva', 'base', $q$select count(*) from reservas where id = (select b from ids) and (emergencia_nombre <> '' or ficha_origen <> '')$q$, 'cero');
update reservas set ficha_firmada = now(), ficha_firma = 'María José Pérez Rojas' where id = (select a from ids);
select pg_temp.probar('Si la ficha estaba firmada y la cambia…', 'anon', $q$select pg_temp.guarda(5, '{"mascota":false,"motivo":"Descanso"}')$q$, 'hay');
select pg_temp.probar('…pide firmar de nuevo', 'direccion', $q$select count(*) from reservas where id = (select a from ids) and ficha_firmada is null$q$, 'hay');

-- ---------- Firmar (tarea 4) ----------
create temp table png as select 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='::text v;
grant select on png to anon;
create function pg_temp.firma(p_loc text, p jsonb) returns int language sql as $$
  select case when (portal_firmar(p_loc, 'Pérez', p)->>'ok')::boolean then 1 else 0 end $$;
grant execute on function pg_temp.firma(text, jsonb) to anon;

select pg_temp.probar('No firma si le faltan partes de la ficha', 'anon', $q$select pg_temp.firma((select e from locs), jsonb_build_object('acepto', true, 'nombre', 'María José Pérez Rojas', 'documento', 'V-12345678', 'firma', (select v from png), 'normas', '2026-11-24'))$q$, 'cero');
select pg_temp.probar('No firma sin aceptar las normas', 'anon', $q$select pg_temp.firma((select a from locs), jsonb_build_object('acepto', false, 'nombre', 'María José Pérez Rojas', 'documento', 'V-12345678', 'firma', (select v from png), 'normas', '2026-11-24'))$q$, 'cero');
select pg_temp.probar('No firma con un C.I. distinto al del titular', 'anon', $q$select pg_temp.firma((select a from locs), jsonb_build_object('acepto', true, 'nombre', 'María José Pérez Rojas', 'documento', 'V-99999999', 'firma', (select v from png), 'normas', '2026-11-24'))$q$, 'cero');
select pg_temp.probar('No firma con otro nombre', 'anon', $q$select pg_temp.firma((select a from locs), jsonb_build_object('acepto', true, 'nombre', 'Otra Persona', 'documento', 'V-12345678', 'firma', (select v from png), 'normas', '2026-11-24'))$q$, 'cero');
select pg_temp.probar('No firma si la firma no es una imagen PNG', 'anon', $q$select pg_temp.firma((select a from locs), jsonb_build_object('acepto', true, 'nombre', 'María José Pérez Rojas', 'documento', 'V-12345678', 'firma', 'data:image/png;base64,' || encode('<script>alert(1)</script>'::bytea, 'base64'), 'normas', '2026-11-24'))$q$, 'cero');
select pg_temp.probar('No firma con una imagen demasiado grande', 'anon', $q$select pg_temp.firma((select a from locs), jsonb_build_object('acepto', true, 'nombre', 'María José Pérez Rojas', 'documento', 'V-12345678', 'firma', (select v from png) || repeat('A', 600000), 'normas', '2026-11-24'))$q$, 'cero');
select pg_temp.probar('Firma con todo en orden (C.I. enmascarado vale)', 'anon', $q$select pg_temp.firma((select a from locs), jsonb_build_object('acepto', true, 'nombre', 'maría josé pérez rojas', 'documento', '•••678', 'firma', (select v from png), 'normas', '2026-11-24'))$q$, 'hay');
select pg_temp.probar('…la ficha queda firmada', 'base', $q$select count(*) from reservas where id = (select a from ids) and ficha_firmada is not null and ficha_firma <> ''$q$, 'hay');
select pg_temp.probar('…el portal lo sabe', 'anon', $q$select count(*) from (select portal_entrar((select a from locs), 'Pérez') j) s where j->'ficha'->>'firmada' is not null$q$, 'hay');
select pg_temp.probar('…la firma se guarda con su huella SHA-256 y la versión de las normas', 'base', $q$select count(*) from fichas_firmas where reserva_id = (select a from ids) and vigente and huella ~ '^[0-9a-f]{64}$' and normas = '2026-11-24' and documento = 'V-12345678'$q$, 'hay');
select pg_temp.probar('Firmar de nuevo deja la anterior en el historial', 'anon', $q$select pg_temp.firma((select a from locs), jsonb_build_object('acepto', true, 'nombre', 'María José Pérez Rojas', 'documento', 'V-12345678', 'firma', (select v from png), 'normas', '2026-11-24'))$q$, 'hay');
select pg_temp.probar('…una sola firma vigente, dos en total', 'base', $q$select (select count(*) from fichas_firmas where reserva_id = (select a from ids) and vigente) * 10 + (select count(*) from fichas_firmas where reserva_id = (select a from ids)) - 12$q$, 'cero');
select pg_temp.probar('Anónimo no lee las firmas', 'anon', 'select count(*) from fichas_firmas', 'error');
select pg_temp.probar('Ni el equipo lee la tabla de firmas directo', 'recepcion', $q$select count(*) from fichas_firmas$q$, 'error');
select pg_temp.probar('Cocina no ve la firma', 'cocina', $q$select count(*) from (select ver_firma((select a from ids)) j) s where j is not null$q$, 'cero');
select pg_temp.probar('Recepción ve la firma de la reserva con la función', 'recepcion', $q$select count(*) from (select ver_firma((select a from ids)) j) s where j->>'imagen' like 'data:image/png;base64,%'$q$, 'hay');

-- ---------- Panel (tarea 5) ----------
select pg_temp.probar('Recepción registra que envió el acceso', 'recepcion', $q$select count(*) from (select registrar_acceso((select a from ids)) j) s where j->>'enlace' like '%/mi-reserva?c=' || (select a from locs)$q$, 'hay');
select pg_temp.probar('…otra vez (reenvío)', 'recepcion', $q$select count(*) from (select registrar_acceso((select a from ids))) s$q$, 'hay');
select pg_temp.probar('…cuenta las veces y quién', 'recepcion', $q$select count(*) from reservas where id = (select a from ids) and acceso_veces = 2 and acceso_enviado is not null and acceso_por = auth.uid()$q$, 'hay');
select pg_temp.probar('Cocina no envía accesos', 'cocina', $q$select count(*) from (select registrar_acceso((select a from ids))) s$q$, 'error');
select pg_temp.probar('Sin pago (sin código) no hay acceso que enviar', 'recepcion', $q$select count(*) from (select registrar_acceso((select f from ids))) s$q$, 'error');
select pg_temp.probar('Recepción ve el contacto de emergencia', 'recepcion', $q$select count(*) from jsonb_array_elements(datos_personales()->'reservas') x where x->>'id' = (select a from ids)::text and x->'emergencia'->>'nombre' = 'Luis Pérez'$q$, 'hay');
select pg_temp.probar('Cocina no ve el contacto de emergencia', 'cocina', $q$select count(*) from jsonb_array_elements(coalesce(datos_personales()->'reservas', '[]')) x where x->'emergencia'->>'nombre' = 'Luis Pérez'$q$, 'cero');
select pg_temp.probar('El panel guarda el contacto de emergencia en la ficha', 'recepcion', $q$select count(*) from (select guardar_ficha((select b from ids), '{"nombre":"Cher","adultos":1,"ninos":0,"emergencia_nombre":"Mamá","emergencia_parentesco":"Madre","emergencia_telefono":"+58 414 000 1111"}')) s$q$, 'hay');
select pg_temp.probar('…y queda como pasada por Recepción', 'base', $q$select count(*) from reservas where id = (select b from ids) and emergencia_nombre = 'Mamá' and ficha_origen = 'recepcion'$q$, 'hay');
select pg_temp.probar('Si la llenó el cliente y Recepción corrige, sigue diciendo «cliente»', 'recepcion', $q$select count(*) from (select guardar_ficha((select a from ids), '{"nombre":"María José Pérez Rojas","adultos":3,"ninos":1,"firmada":true}')) s$q$, 'hay');
select pg_temp.probar('…origen cliente y el contacto de emergencia no se borra', 'base', $q$select count(*) from reservas where id = (select a from ids) and ficha_origen = 'cliente' and emergencia_nombre = 'Luis Pérez'$q$, 'hay');

-- ---------- Revisión de seguridad: las piezas internas no se llaman desde afuera ----------
select pg_temp.probar('Anónimo no llama portal_datos directo', 'anon', $q$select count(*) from (select portal_datos((select a from ids)) j) s where j is not null$q$, 'error');
select pg_temp.probar('Anónimo no llama portal_reserva directo', 'anon', $q$select count(*) from (select portal_reserva((select a from locs), 'Pérez')) s$q$, 'error');
select pg_temp.probar('Anónimo no calcula huellas', 'anon', $q$select count(*) from (select portal_huella((select a from ids), 'x') j) s where j is not null$q$, 'error');
select pg_temp.probar('Anónimo no registra accesos', 'anon', $q$select count(*) from (select registrar_acceso((select a from ids))) s$q$, 'error');
select pg_temp.probar('Anónimo no ve firmas', 'anon', $q$select count(*) from (select ver_firma((select a from ids)) j) s where j is not null$q$, 'error');

-- ---------- Resultado (y todo se deshace) ----------
do $$
declare informe text; fallas int; total int;
begin
  select count(*) filter (where not ok), count(*) into fallas, total from resultados;
  select string_agg(format('%s %s · %s → %s (esperado: %s)', case when ok then 'OK   ' else 'FALLA' end, quien, prueba, obtuvo, espera), E'\n' order by n)
    into informe from resultados;
  raise exception E'PRUEBAS 0020: % pruebas, % fallas. Nada quedó guardado.\n%', total, fallas, informe;
end $$;

rollback;
