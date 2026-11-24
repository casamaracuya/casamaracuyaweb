-- =====================================================================
--  Casa Maracuyá · Pruebas del registro del pago (migración 0017)
--
--  Qué prueba: el código de reserva, el pago con comprobante y la regla del
--  100 %, la cotización con código, los cobros en espera y su aprobación,
--  la bitácora y quién ve qué.
--
--  Es seguro correrlo en producción: todo pasa dentro de una transacción que
--  SIEMPRE se deshace al final. Usa fechas del año 2099.
--
--  Cómo correrlo: después de 0017, Supabase > SQL Editor > New query > pega todo > Run.
--  El resultado aparece como un mensaje que empieza por «PRUEBAS 0017».
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
    insert into auth.users (id, email) select id, 'prueba0017-' || r || '@prueba.invalid' from usuarios where rol = r;
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


-- Ids fijos para las reservas de prueba (el comprobante tiene que ir en «<id>/…»).
create temp table ids as select gen_random_uuid() a, gen_random_uuid() b, gen_random_uuid() c;
grant select on ids to authenticated;

-- ---------- 1. Cotización y «Reserva pagada» que coincide ----------
select pg_temp.probar('Recepción guarda una cotización', 'recepcion',
  $q$select count(*) from (select guardar_cotizacion('{"nombre":"Prueba 0017","llegada":"2099-03-10","salida":"2099-03-12","noches":2,"personas":6,"totales":{"esencial":540,"plena":720}}')) x$q$, 'hay');
select pg_temp.probar('Cocina no hace cotizaciones', 'cocina',
  $q$select count(*) from (select guardar_cotizacion('{"nombre":"Prueba","noches":2,"totales":{"esencial":1}}')) x$q$, 'error');
create temp table cot as select codigo from cotizaciones where nombre = 'Prueba 0017';
grant select on cot to authenticated;

select pg_temp.probar('Reserva pagada que coincide con la cotización: queda confirmada', 'recepcion', $q$
  select case when (crear_reserva_pagada((select a from ids), jsonb_build_object('nombre','Prueba 0017','telefono','+58 400 111 0017','email','prueba0017@prueba.invalid',
    'plan','esencial','personas',6,'llegada','2099-03-10','salida','2099-03-12','metodo','Zelle','monto',540,'referencia','PRUEBA-0017-A',
    'comprobante',(select a from ids)::text || '/x.jpg','cotizacion',(select codigo from cot)))->>'confirmada')::boolean then 1 else 0 end$q$, 'hay');
select pg_temp.probar('La reserva confirmada recibe su código CM-', 'direccion', $q$select count(*) from reservas where id = (select a from ids) and localizador ~ '^CM-[2-9A-Z]{6}$' and estado = 'confirmada'$q$, 'hay');

-- ---------- 2. Reglas del pago ----------
select pg_temp.probar('Sin comprobante no se registra', 'recepcion', $q$select count(*) from (select registrar_pago((select a from ids), '{"metodo":"Zelle","monto":1,"referencia":"PRUEBA-0017-X"}')) x$q$, 'error');
select pg_temp.probar('La misma referencia no se acepta dos veces', 'recepcion', $q$select count(*) from (select registrar_pago((select a from ids), jsonb_build_object('metodo','Zelle','monto',1,'referencia','prueba 0017-a','comprobante',(select a from ids)::text || '/y.jpg','motivo','prueba duplicada'))) x$q$, 'error');
select pg_temp.probar('Cocina no registra pagos', 'cocina', $q$select count(*) from (select registrar_pago((select a from ids), '{"metodo":"Zelle","monto":1}')) x$q$, 'error');
select pg_temp.probar('Nadie se hace pasar por otro al cobrar', 'recepcion', $q$
  select count(*) from (select registrar_pago((select a from ids), jsonb_build_object('metodo','Zelle','monto',1,'referencia','PRUEBA-0017-S','comprobante',(select a from ids)::text || '/s.jpg',
    'motivo','prueba de suplantación','cobrado_por',(select id from usuarios where rol = 'admin')))) x;
  $q$, 'funciona');
select pg_temp.probar('…y el cobro en espera queda a nombre de quien lo pidió', 'direccion', $q$select count(*) from aprobaciones where pago->>'referencia' = 'PRUEBA-0017-S' and pedida_por = (select id from usuarios where rol = 'recepcion') and (pago->>'cobrado_por')::uuid = (select id from usuarios where rol = 'recepcion')$q$, 'hay');

-- ---------- 3. Cobro que no coincide: queda en espera ----------
select pg_temp.probar('Sin cotización y sin motivo: se rechaza', 'recepcion', $q$
  select count(*) from (select crear_reserva_pagada((select b from ids), jsonb_build_object('nombre','Prueba 0017 B','telefono','+58 400 222 0017','email','prueba0017b@prueba.invalid',
    'plan','plena','personas',4,'llegada','2099-04-10','salida','2099-04-12','metodo','Zelle','monto',500,'total',500,'referencia','PRUEBA-0017-B','comprobante',(select b from ids)::text || '/x.jpg'))) x$q$, 'error');
select pg_temp.probar('Sin cotización con motivo: queda en espera, sin confirmar', 'recepcion', $q$
  select case when (crear_reserva_pagada((select b from ids), jsonb_build_object('nombre','Prueba 0017 B','telefono','+58 400 222 0017','email','prueba0017b@prueba.invalid',
    'plan','plena','personas',4,'llegada','2099-04-10','salida','2099-04-12','metodo','Zelle','monto',500,'total',500,'referencia','PRUEBA-0017-B','comprobante',(select b from ids)::text || '/x.jpg',
    'motivo','Precio especial de prueba'))->>'pendiente')::boolean then 1 else 0 end$q$, 'hay');
select pg_temp.probar('…la reserva sigue en conversación', 'direccion', $q$select count(*) from reservas where id = (select b from ids) and estado = 'conversacion' and pagado = 0$q$, 'hay');
select pg_temp.probar('Recepción no aprueba cobros', 'recepcion', $q$select count(*) from (select resolver_aprobacion((select id from aprobaciones where reserva_id = (select b from ids)), true)) x$q$, 'error');
select pg_temp.probar('Administración aprueba y el pago se registra', 'admin', $q$select case when (resolver_aprobacion((select id from aprobaciones where reserva_id = (select b from ids)), true)->>'confirmada')::boolean then 1 else 0 end$q$, 'hay');
select pg_temp.probar('…el pago queda a nombre de Recepción', 'direccion', $q$select count(*) from pagos where reserva_id = (select b from ids) and creado_por = (select id from usuarios where rol = 'recepcion')$q$, 'hay');

-- ---------- 4. Quién ve qué ----------
select pg_temp.probar('Cocina no ve pagos', 'cocina', 'select count(*) from pagos', 'cero');
select pg_temp.probar('Cocina no ve cotizaciones', 'cocina', 'select count(*) from cotizaciones', 'cero');
select pg_temp.probar('Cocina no ve cobros en espera', 'cocina', 'select count(*) from aprobaciones', 'cero');
select pg_temp.probar('Recepción ve sus cotizaciones', 'recepcion', $q$select count(*) from cotizaciones where nombre = 'Prueba 0017'$q$, 'hay');
select pg_temp.probar('Dirección ve la bitácora', 'direccion', $q$select count(*) from bitacora where reserva_id = (select a from ids)$q$, 'hay');
select pg_temp.probar('Administración no ve la bitácora', 'admin', 'select count(*) from bitacora', 'cero');
select pg_temp.probar('Recepción no ve la bitácora', 'recepcion', 'select count(*) from bitacora', 'cero');
select pg_temp.probar('Nadie borra la bitácora', 'direccion', 'with x as (delete from bitacora returning 1) select count(*) from x', 'error');
select pg_temp.probar('Nadie edita una cotización', 'direccion', $q$with x as (update cotizaciones set totales = '{"esencial":1}' returning 1) select count(*) from x$q$, 'cero');

-- ---------- Resultado (y todo se deshace) ----------
do $$
declare informe text; fallas int; total int;
begin
  select count(*) filter (where not ok), count(*) into fallas, total from resultados;
  select string_agg(format('%s %s · %s → %s (esperado: %s)', case when ok then 'OK   ' else 'FALLA' end, quien, prueba, obtuvo, espera), E'\n' order by n)
    into informe from resultados;
  raise exception E'PRUEBAS 0017: % pruebas, % fallas. Nada quedó guardado.\n%', total, fallas, informe;
end $$;

rollback;
