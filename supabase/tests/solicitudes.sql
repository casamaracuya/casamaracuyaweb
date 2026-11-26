-- =====================================================================
--  Casa Maracuyá · Pruebas de Solicitudes (migración 0019)
--
--  Qué prueba: las notas de la conversación (quién las escribe, que no se
--  editan ni se borran, quién las ve), el estado «no siguió» y que las
--  solicitudes con fecha pasada se archiven solas.
--
--  Es seguro correrlo en producción: todo pasa dentro de una transacción que
--  SIEMPRE se deshace al final. Usa fechas del año 2099.
--
--  Cómo correrlo: después de 0019, Supabase > SQL Editor > New query > pega todo > Run.
--  El resultado aparece como un mensaje que empieza por «PRUEBAS 0019».
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
  foreach r in array array['direccion','admin','recepcion','cocina'] loop
    insert into usuarios values (r, gen_random_uuid());
    insert into auth.users (id, email) select id, 'prueba0019-' || r || '@prueba.invalid' from usuarios where rol = r;
    update perfiles set roles = array[r]::rol_equipo[] where id = (select id from usuarios where rol = r);
  end loop;
end $$;

-- ---------- Ejecuta una consulta como otro usuario y anota el resultado ----------
-- p_sql debe devolver un número (cuántas filas ve o cambia).
-- p_espera: 'cero' (no ve / no cambia nada), 'hay' (sí ve o cambia), 'error' (debe ser rechazado), 'funciona' (no debe dar error).
create function pg_temp.probar(p_prueba text, p_quien text, p_sql text, p_espera text) returns void
language plpgsql as $f$
declare v bigint; obt text;
begin
  if p_quien = 'anon' then
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
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  insert into resultados (prueba, quien, espera, obtuvo, ok) values (p_prueba, p_quien, p_espera, obt,
    case p_espera
      when 'cero' then obt = '0'
      when 'hay' then obt !~ '^error' and obt <> '0'
      when 'error' then obt ~ '^error'
      when 'funciona' then obt !~ '^error'
    end);
end $f$;


create temp table ids as select gen_random_uuid() a, gen_random_uuid() b, gen_random_uuid() h;
grant select on ids to authenticated;
insert into huespedes (id, nombre, telefono) select h, 'Prueba 0019', '+58 400 333 0019' from ids;
insert into reservas (id, huesped_id, plan, personas, llegada, salida, estado, canal)
  select a, h, 'esencial'::plan_estadia, 4, date '2099-05-10', date '2099-05-12', 'conversacion'::estado_reserva, 'WhatsApp' from ids
  union all select b, h, 'esencial'::plan_estadia, 4, current_date - 3, current_date - 1, 'nueva'::estado_reserva, 'Web' from ids;

select pg_temp.probar('Recepción anota en la conversación', 'recepcion', $q$with x as (insert into conversaciones (reserva_id, texto, autor) values ((select a from ids), 'Le mandé la tarifa', auth.uid()) returning 1) select count(*) from x$q$, 'hay');
select pg_temp.probar('Nadie anota a nombre de otro', 'recepcion', $q$with x as (insert into conversaciones (reserva_id, texto, autor) values ((select a from ids), 'Falsa', (select id from usuarios where rol = 'direccion')) returning 1) select count(*) from x$q$, 'error');
select pg_temp.probar('Una nota no se edita', 'recepcion', $q$with x as (update conversaciones set texto = 'cambiada' returning 1) select count(*) from x$q$, 'error');
select pg_temp.probar('Una nota no se borra', 'direccion', $q$with x as (delete from conversaciones returning 1) select count(*) from x$q$, 'error');
select pg_temp.probar('Administración lee la conversación', 'admin', $q$select count(*) from conversaciones where reserva_id = (select a from ids)$q$, 'hay');
select pg_temp.probar('Cocina no lee la conversación', 'cocina', 'select count(*) from conversaciones', 'cero');
select pg_temp.probar('La nota queda en la bitácora', 'direccion', $q$select count(*) from bitacora where tabla = 'conversaciones' and reserva_id = (select a from ids)$q$, 'hay');
select pg_temp.probar('Recepción marca «no siguió»', 'recepcion', $q$select count(*) from (select cambiar_estado((select a from ids), 'no_siguio')) x$q$, 'funciona');
select pg_temp.probar('…y queda archivada', 'direccion', $q$select count(*) from reservas where id = (select a from ids) and estado = 'no_siguio'$q$, 'hay');
select pg_temp.probar('Recepción corre el archivo automático', 'recepcion', 'select count(*) from (select liberar_vencidas()) x', 'hay');
select pg_temp.probar('…y la solicitud con fecha pasada queda vencida', 'direccion', $q$select count(*) from reservas where id = (select b from ids) and estado = 'vencida'$q$, 'hay');

-- ---------- 0023: la solicitud de la web guarda los bebés ----------
-- Crea la solicitud y, en un paso aparte, lee cuántos bebés quedaron (-1 si no quedó).
create function pg_temp.bebes_de(p_tel text, p_personas int, p_dias int, p_bebes int default null) returns int language plpgsql as $f$
declare c text; n int;
begin
  if p_bebes is null then
    c := crear_solicitud('Visitante Bebés', p_tel, 'esencial', p_personas, false, current_date + p_dias, current_date + p_dias + 2, 'Prueba');
  else
    c := crear_solicitud('Visitante Bebés', p_tel, 'esencial', p_personas, false, current_date + p_dias, current_date + p_dias + 2, 'Prueba', 'Web', 'es', p_bebes);
  end if;
  select bebes into n from reservas where codigo = c;
  return coalesce(n, -1);
end $f$;
grant execute on function pg_temp.bebes_de(text, int, int, int) to authenticated, anon;
select pg_temp.probar('La web guarda los bebés que no pagan', 'recepcion', $q$select case when pg_temp.bebes_de('+58 400 777 0023', 4, 400, 2) = 2 then 1 else 0 end$q$, 'hay');
select pg_temp.probar('…nunca más de 2 (del tercero en adelante pagan y van en personas)', 'recepcion', $q$select case when pg_temp.bebes_de('+58 400 777 0024', 4, 410, 5) = 2 then 1 else 0 end$q$, 'hay');
select pg_temp.probar('Sin decir bebés, quedan en 0', 'recepcion', $q$select case when pg_temp.bebes_de('+58 400 777 0025', 2, 420) = 0 then 1 else 0 end$q$, 'hay');

-- ---------- Resultado (y todo se deshace) ----------
do $$
declare informe text; fallas int; total int;
begin
  select count(*) filter (where not ok), count(*) into fallas, total from resultados;
  select string_agg(format('%s %s · %s → %s (esperado: %s)', case when ok then 'OK   ' else 'FALLA' end, quien, prueba, obtuvo, espera), E'\n' order by n)
    into informe from resultados;
  raise exception E'PRUEBAS 0019: % pruebas, % fallas. Nada quedó guardado.\n%', total, fallas, informe;
end $$;

rollback;
