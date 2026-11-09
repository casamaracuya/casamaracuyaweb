-- =====================================================================
--  Casa Maracuyá · Auditoría de permisos (Row Level Security)
--
--  Qué hace: crea un usuario de prueba por cada rol (y uno sin rol, y el
--  visitante anónimo de la web), crea datos de prueba y comprueba que cada
--  uno vea y cambie SOLO lo que le corresponde.
--
--  Es seguro correrlo en producción: todo pasa dentro de una transacción que
--  SIEMPRE se deshace al final. No queda ningún usuario, reserva ni fecha
--  bloqueada. Las reservas de prueba usan fechas del año 2099.
--
--  Cómo correrlo: Supabase > SQL Editor > New query > pega todo > Run.
--  El resultado aparece como un mensaje que empieza por «AUDITORÍA RLS».
--  Si dice «0 fallas», los permisos están bien.
-- =====================================================================
begin;

create temp table resultados (n serial, prueba text, quien text, espera text, obtuvo text, ok boolean);
create temp table usuarios (rol text primary key, id uuid);

-- ---------- Usuarios de prueba (uno por rol) ----------
do $$
declare r text;
begin
  foreach r in array array['direccion','admin','recepcion','cocina','limpieza','mantenimiento','sinrol'] loop
    insert into usuarios values (r, gen_random_uuid());
    insert into auth.users (id, email) select id, 'auditoria-' || r || '@prueba.invalid' from usuarios where rol = r;
    if r <> 'sinrol' then
      update perfiles set roles = array[r]::rol_equipo[] where id = (select id from usuarios where rol = r);
    end if;
  end loop;
end $$;

-- ---------- Datos de prueba ----------
create temp table datos as
with h as (insert into huespedes (nombre, telefono) values ('Huésped Auditoría', '+58 400 000 0000') returning id),
     r1 as (insert into reservas (huesped_id, plan, personas, llegada, salida) select id, 'plena', 4, '2099-01-10', '2099-01-14' from h returning id),
     r2 as (insert into reservas (huesped_id, plan, personas, llegada, salida) select id, 'esencial', 2, '2099-01-12', '2099-01-15' from h returning id)
select (select id from h) as huesped, (select id from r1) as res1, (select id from r2) as res2;
insert into pagos (reserva_id, monto, metodo) select res1, 10, 'Prueba' from datos;
insert into tareas (area, titulo, para) values ('cocina', 'Tarea de prueba de cocina', '2099-01-10'), ('limpieza', 'Tarea de prueba de limpieza', '2099-01-10');
insert into compras (texto) values ('Compra de prueba');
insert into menus (reserva_id, texto) select res1, 'Menú de prueba' from datos;
insert into tarifas (clave, monto) values ('auditoria-prueba', 1);
insert into promociones (nombre, activa) values ('Promoción inactiva de prueba', false);
insert into acompanantes (huesped_id, nombre) select huesped, 'Acompañante de prueba' from datos;

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

-- ---------- 1. Visitante anónimo de la web ----------
select pg_temp.probar('No ve huéspedes',        'anon', 'select count(*) from huespedes', 'cero');
select pg_temp.probar('No ve reservas',         'anon', 'select count(*) from reservas', 'cero');
select pg_temp.probar('No ve pagos',            'anon', 'select count(*) from pagos', 'cero');
select pg_temp.probar('No ve acompañantes',     'anon', 'select count(*) from acompanantes', 'cero');
select pg_temp.probar('No ve al equipo',        'anon', 'select count(*) from perfiles', 'cero');
select pg_temp.probar('No ve tareas',           'anon', 'select count(*) from tareas', 'cero');
select pg_temp.probar('No ve tarifas',          'anon', 'select count(*) from tarifas', 'cero');
select pg_temp.probar('No ve menús ni compras', 'anon', 'select (select count(*) from menus) + (select count(*) from compras)', 'cero');
select pg_temp.probar('No ve promociones inactivas', 'anon', 'select count(*) from promociones where not activa', 'cero');
select pg_temp.probar('No crea reservas directo',    'anon', $q$with x as (insert into reservas (huesped_id, plan, personas, llegada, salida) select id, 'plena', 2, '2099-02-01', '2099-02-03' from huespedes limit 1 returning 1) select count(*) from x$q$, 'cero');
select pg_temp.probar('No crea huéspedes directo',   'anon', $q$with x as (insert into huespedes (nombre, telefono) values ('X', '1') returning 1) select count(*) from x$q$, 'error');
select pg_temp.probar('No cambia huéspedes',         'anon', $q$with x as (update huespedes set notas = 'x' returning 1) select count(*) from x$q$, 'cero');
select pg_temp.probar('Envía una solicitud desde la web', 'anon', $q$select length(crear_solicitud('Visitante', '+58 400 111 1111', 'esencial', 2, false, '2099-03-01', '2099-03-04', '', 'Web', 'es'))$q$, 'hay');
select pg_temp.probar('No mueve reservas',           'anon', format($q$select 1 from cambiar_estado(%L, 'confirmada')$q$, (select res1 from datos)), 'error');
select pg_temp.probar('No registra pagos',           'anon', format($q$select 1 from registrar_pago(%L, 5, 'x')$q$, (select res1 from datos)), 'error');
select pg_temp.probar('No libera pre-reservas',      'anon', 'select liberar_vencidas()', 'error');

-- ---------- 2. Alguien que se registró solo, sin rol ----------
select pg_temp.probar('Sin rol: no ve huéspedes',  'sinrol', 'select count(*) from huespedes', 'cero');
select pg_temp.probar('Sin rol: no ve reservas',   'sinrol', 'select count(*) from reservas', 'cero');
select pg_temp.probar('Sin rol: no ve pagos',      'sinrol', 'select count(*) from pagos', 'cero');
select pg_temp.probar('Sin rol: no se da roles a sí mismo', 'sinrol', $q$with x as (update perfiles set roles = '{direccion}' where id = auth.uid() returning 1) select count(*) from x$q$, 'cero');
select pg_temp.probar('Sin rol: no crea tareas',   'sinrol', $q$with x as (insert into tareas (area, titulo) values ('cocina', 'x') returning 1) select count(*) from x$q$, 'error');
select pg_temp.probar('Sin rol: no sube fotos de daños', 'sinrol', $q$with x as (insert into storage.objects (bucket_id, name) values ('danos', 'x.jpg') returning 1) select count(*) from x$q$, 'error');

-- ---------- 3. Cocina ----------
select pg_temp.probar('Cocina ve huéspedes (alergias y gustos)', 'cocina', 'select count(*) from huespedes', 'hay');
select pg_temp.probar('Cocina no ve pagos',          'cocina', 'select count(*) from pagos', 'cero');
select pg_temp.probar('Cocina no registra pagos',    'cocina', format($q$select 1 from registrar_pago(%L, 5, 'x')$q$, (select res1 from datos)), 'error');
select pg_temp.probar('Cocina no mueve reservas',    'cocina', format($q$select 1 from cambiar_estado(%L, 'confirmada')$q$, (select res1 from datos)), 'error');
select pg_temp.probar('Cocina no se da otros roles', 'cocina', $q$with x as (update perfiles set roles = '{direccion}' where id = auth.uid() returning 1) select count(*) from x$q$, 'cero');
select pg_temp.probar('Cocina anota gustos del huésped', 'cocina', $q$with x as (update huespedes set notas = 'Prefiere jugo de parchita' returning 1) select count(*) from x$q$, 'hay');
select pg_temp.probar('Cocina escribe menús',        'cocina', $q$with x as (update menus set texto = 'Menú nuevo' returning 1) select count(*) from x$q$, 'hay');
select pg_temp.probar('Cocina no cambia tarifas',    'cocina', $q$with x as (update tarifas set monto = 999 returning 1) select count(*) from x$q$, 'cero');

-- ---------- 4. Limpieza ----------
select pg_temp.probar('Limpieza no ve pagos',              'limpieza', 'select count(*) from pagos', 'cero');
select pg_temp.probar('Limpieza mueve habitaciones',       'limpieza', $q$select length(siguiente_estado_habitacion('maracuya')::text)$q$, 'hay');
select pg_temp.probar('Limpieza marca sus tareas',         'limpieza', $q$with x as (update tareas set hecha = true where area = 'limpieza' and titulo like '%de prueba%' returning 1) select count(*) from x$q$, 'hay');
select pg_temp.probar('Limpieza no marca tareas de cocina','limpieza', $q$with x as (update tareas set hecha = true where area = 'cocina' and titulo like '%de prueba%' returning 1) select count(*) from x$q$, 'cero');
select pg_temp.probar('Limpieza no cambia exteriores',     'limpieza', $q$with x as (update exteriores set al_dia = false returning 1) select count(*) from x$q$, 'cero');

-- ---------- 5. Mantenimiento ----------
select pg_temp.probar('Mantenimiento no ve pagos',          'mantenimiento', 'select count(*) from pagos', 'cero');
select pg_temp.probar('Mantenimiento cambia exteriores',    'mantenimiento', $q$with x as (update exteriores set al_dia = false where id = 'piscina' returning 1) select count(*) from x$q$, 'hay');
select pg_temp.probar('Mantenimiento no mueve habitaciones','mantenimiento', $q$select length(siguiente_estado_habitacion('maracuya')::text)$q$, 'error');

-- ---------- 6. Recepción ----------
select pg_temp.probar('Recepción ve reservas',        'recepcion', 'select count(*) from reservas', 'hay');
select pg_temp.probar('Recepción no ve pagos',        'recepcion', 'select count(*) from pagos', 'cero');
select pg_temp.probar('Recepción no registra pagos',  'recepcion', format($q$select 1 from registrar_pago(%L, 5, 'x')$q$, (select res1 from datos)), 'error');
select pg_temp.probar('Recepción confirma una reserva','recepcion', format($q$select 1 from cambiar_estado(%L, 'confirmada')$q$, (select res1 from datos)), 'funciona');
select pg_temp.probar('No hay doble reserva en las mismas noches', 'recepcion', format($q$select 1 from cambiar_estado(%L, 'confirmada')$q$, (select res2 from datos)), 'error');
select pg_temp.probar('Recepción no cambia tarifas',  'recepcion', $q$with x as (update tarifas set monto = 999 returning 1) select count(*) from x$q$, 'cero');

-- ---------- 7. Administración ----------
select pg_temp.probar('Administración ve pagos',        'admin', 'select count(*) from pagos', 'hay');
select pg_temp.probar('Administración registra pagos',  'admin', format($q$select 1 from registrar_pago(%L, 5, 'Transferencia')$q$, (select res1 from datos)), 'funciona');
select pg_temp.probar('Administración no cambia tarifas','admin', $q$with x as (update tarifas set monto = 999 returning 1) select count(*) from x$q$, 'cero');
select pg_temp.probar('Administración no da roles',     'admin', $q$with x as (update perfiles set roles = '{direccion}' returning 1) select count(*) from x$q$, 'cero');

-- ---------- 8. Dirección ----------
select pg_temp.probar('Dirección ve pagos',          'direccion', 'select count(*) from pagos', 'hay');
select pg_temp.probar('Dirección cambia tarifas',    'direccion', $q$with x as (update tarifas set monto = 2 where clave = 'auditoria-prueba' returning 1) select count(*) from x$q$, 'hay');
select pg_temp.probar('Dirección asigna roles',      'direccion', $q$with x as (update perfiles set roles = '{cocina}' where id = (select id from perfiles where roles = '{}' limit 1) returning 1) select count(*) from x$q$, 'hay');

-- ---------- Resultado (y todo se deshace) ----------
do $$
declare informe text; fallas int; total int;
begin
  select count(*) filter (where not ok), count(*) into fallas, total from resultados;
  select string_agg(format('%s %s · %s → %s (esperado: %s)', case when ok then 'OK   ' else 'FALLA' end, quien, prueba, obtuvo, espera), E'\n' order by n)
    into informe from resultados;
  raise exception E'AUDITORÍA RLS: % pruebas, % fallas. Nada quedó guardado.\n%', total, fallas, informe;
end $$;

rollback;
