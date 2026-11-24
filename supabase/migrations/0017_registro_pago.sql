-- =====================================================================
--  Casa Maracuyá · 0017: registro del pago y código de reserva
--  (SPEC-registro-pago.md)
--
--  Parte 1 · Código de reserva tipo vuelo: CM-7K4Q9X
--    Cada reserva confirmada recibe un código aleatorio y único. Es la llave
--    del apartado del huésped, la llegada y la salida. El R-1012 sigue como
--    número interno del equipo.
--
--  Cómo correrlo: Supabase > SQL Editor > New query > pega todo > Run.
--  Se puede volver a correr sin romper nada.
-- =====================================================================

-- ---------- 1. La columna ----------
alter table reservas add column if not exists localizador text;
create unique index if not exists reservas_localizador on reservas (localizador);

-- ---------- 2. Generar un código ----------
-- 6 caracteres de un alfabeto sin 0/O, 1/I/L para que se pueda dictar por teléfono
-- (31^6 ≈ 887 millones de combinaciones). El azar sale de gen_random_uuid(),
-- que es criptográficamente seguro, así que un código no ayuda a adivinar otro.
create or replace function nuevo_localizador() returns text
language plpgsql volatile set search_path = public as $$
declare
  abc constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  b bytea; c text; i int;
begin
  loop
    b := uuid_send(gen_random_uuid());
    c := 'CM-';
    for i in 0..5 loop
      c := c || substr(abc, 1 + (get_byte(b, i) % 31), 1);
    end loop;
    exit when not exists (select 1 from reservas where localizador = c);
  end loop;
  return c;
end $$;
revoke execute on function nuevo_localizador() from public, anon, authenticated;

-- ---------- 3. Se asigna solo al confirmar ----------
-- Cubre todos los caminos (cambiar_estado, registrar_pago, lo que venga después)
-- sin tocar esas funciones. Una vez puesto, nunca cambia.
create or replace function asignar_localizador() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.localizador is null and new.estado in ('confirmada','casa','finalizada') then
    new.localizador := nuevo_localizador();
  end if;
  if tg_op = 'UPDATE' and old.localizador is not null then
    new.localizador := old.localizador;
  end if;
  return new;
end $$;

drop trigger if exists reservas_localizador on reservas;
create trigger reservas_localizador
  before insert or update on reservas
  for each row execute function asignar_localizador();

-- ---------- 4. Las reservas confirmadas que ya existen reciben el suyo ----------
update reservas set localizador = nuevo_localizador()
where localizador is null and estado in ('confirmada','casa','finalizada');

-- ---------- 5. El equipo lo puede leer (ver 0015 y src/lib/api.js) ----------
grant select (localizador) on reservas to authenticated;

-- =====================================================================
--  Parte 2 · El pago con su prueba y la regla del 100 %
--    Cada pago guarda método, moneda (y tasa si es en Bs.), referencia y el
--    comprobante (foto o PDF; en efectivo, la foto del recibo firmado por el
--    cliente). La reserva se confirma sola cuando lo pagado cubre el total.
--
--  ORDEN AL PUBLICAR: correr esta migración ANTES de subir el panel nuevo.
--  La función registrar_pago cambia de forma: el panel viejo deja de poder
--  registrar pagos en cuanto se corre (a propósito: ya no se aceptan pagos
--  sin comprobante).
-- =====================================================================

-- ---------- 6. Columnas nuevas de pagos ----------
alter table pagos
  add column if not exists moneda            text not null default 'USD',
  add column if not exists monto_original    numeric(14,2),           -- lo que se recibió en su moneda
  add column if not exists tasa              numeric(14,4),           -- Bs. por 1 USD, solo si moneda = 'Bs'
  add column if not exists referencia        text not null default '',
  add column if not exists comprobante_path  text,                    -- ruta en el bucket privado «comprobantes»
  add column if not exists efectivo_lo_tiene text not null default '', -- quién guarda el dinero en efectivo
  add column if not exists creado            timestamptz not null default now();
do $$ begin
  alter table pagos add constraint pagos_moneda check (moneda in ('USD','Bs'));
exception when duplicate_object then null; end $$;

-- La misma referencia no se acepta dos veces con el mismo método (sin importar espacios, guiones ni mayúsculas).
create unique index if not exists pagos_referencia_unica
  on pagos (lower(metodo), upper(regexp_replace(referencia, '[^A-Za-z0-9]', '', 'g')))
  where referencia <> '';

-- ---------- 7. Bucket privado para los comprobantes ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes', 'comprobantes', false, 10485760, '{image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf}')
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "cobro sube comprobantes" on storage.objects;
drop policy if exists "cobro ve comprobantes"   on storage.objects;
create policy "cobro sube comprobantes" on storage.objects for insert to authenticated
  with check (bucket_id = 'comprobantes' and public.tiene_algun_rol('{direccion,admin,recepcion}'));
create policy "cobro ve comprobantes" on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes' and public.tiene_algun_rol('{direccion,admin,recepcion}'));

-- ---------- 8. Registrar un pago ----------
-- p trae: monto (USD; si es en Bs. se calcula aquí), metodo, moneda, monto_original, tasa,
--         referencia, comprobante (ruta subida), efectivo_lo_tiene, total, concepto.
-- Devuelve: { confirmada, localizador, pagado, total, falta }.
drop function if exists registrar_pago(uuid, numeric, text);
drop function if exists registrar_pago(uuid, numeric, text, numeric, text);
create or replace function registrar_pago(p_reserva uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r reservas;
  metodos constant text[] := '{Transferencia,"Pago móvil",Zelle,"Binance (USDT)","Efectivo USD","Efectivo Bs"}';
  met   text := trim(coalesce(p->>'metodo',''));
  mon   text := coalesce(nullif(p->>'moneda',''), 'USD');
  orig  numeric := nullif(p->>'monto_original','')::numeric;
  tasa  numeric := nullif(p->>'tasa','')::numeric;
  usd   numeric := nullif(p->>'monto','')::numeric;
  ref   text := left(trim(coalesce(p->>'referencia','')), 80);
  comp  text := trim(coalesce(p->>'comprobante',''));
  quien text := left(trim(coalesce(p->>'efectivo_lo_tiene','')), 80);
  tot   numeric := nullif(p->>'total','')::numeric;
  efectivo boolean := met like 'Efectivo%';
  nuevo_pagado numeric; confirma boolean := false;
begin
  if not tiene_algun_rol('{direccion,admin,recepcion}') then raise exception 'Tu rol no puede registrar pagos'; end if;
  select * into r from reservas where id = p_reserva for update;
  if not found then raise exception 'Reserva no encontrada'; end if;
  if r.estado in ('rechazada','vencida','cancelada') then raise exception 'Esta solicitud ya está cerrada. Revisa las fechas y créala de nuevo'; end if;

  if not (met = any(metodos)) then raise exception 'Elige cómo pagó'; end if;
  if met in ('Pago móvil','Efectivo Bs') then mon := 'Bs'; end if;
  if met in ('Zelle','Binance (USDT)','Efectivo USD') then mon := 'USD'; end if;
  if mon not in ('USD','Bs') then raise exception 'Moneda no válida'; end if;
  if mon = 'Bs' then
    if orig is null or orig <= 0 then raise exception 'Escribe el monto en bolívares'; end if;
    if tasa is null or tasa <= 0 then raise exception 'Escribe la tasa del día (Bs. por cada dólar)'; end if;
    usd := round(orig / tasa, 2);
  else
    orig := usd;
    tasa := null;
  end if;
  if usd is null or usd <= 0 then raise exception 'El monto tiene que ser mayor que cero'; end if;

  if not efectivo and length(ref) < 4 then raise exception 'Escribe la referencia del pago'; end if;
  if efectivo then ref := ''; end if;
  if efectivo and length(quien) < 2 then raise exception 'Anota quién tiene el dinero en efectivo'; end if;
  if comp = '' then
    raise exception '%', case when efectivo then 'Sube la foto del recibo firmado por el cliente' else 'Sube el comprobante del pago' end;
  end if;
  if comp not like p_reserva::text || '/%' then raise exception 'El comprobante no corresponde a esta reserva'; end if;

  if tot is not null then
    if tot <= 0 then raise exception 'Escribe el total de la estadía'; end if;
    update reservas set total = tot where id = p_reserva;
    r.total := tot;
  end if;
  if r.total is null or r.total <= 0 then raise exception 'Escribe el total de la estadía'; end if;

  begin
    insert into pagos (reserva_id, monto, metodo, tipo, moneda, monto_original, tasa, referencia, comprobante_path, efectivo_lo_tiene)
    values (p_reserva, usd, met, case when r.pagado > 0 then 'Pago final' else 'Pago' end, mon, orig, tasa, ref, comp, quien);
  exception when unique_violation then
    raise exception 'Esa referencia ya está registrada en otro pago con %. Revisa que no sea el mismo pago.', met;
  end;

  nuevo_pagado := r.pagado + usd;
  update reservas set pagado = nuevo_pagado,
    concepto = coalesce(nullif(left(trim(coalesce(p->>'concepto','')), 200), ''), concepto)
  where id = p_reserva;

  -- Regla del 100 %: solo se confirma cuando lo pagado cubre el total.
  if r.estado in ('nueva','conversacion','pre') and nuevo_pagado >= r.total then
    perform cambiar_estado(p_reserva, 'confirmada');
    confirma := true;
  end if;

  select * into r from reservas where id = p_reserva;
  return jsonb_build_object('confirmada', confirma, 'localizador', r.localizador,
    'pagado', r.pagado, 'total', r.total, 'falta', greatest(r.total - r.pagado, 0));
end $$;
revoke execute on function registrar_pago(uuid, jsonb) from public, anon;
grant execute on function registrar_pago(uuid, jsonb) to authenticated;

-- ---------- 9. Quién ve los pagos ----------
-- Antes solo Dirección y Administración. Recepción también, porque registra los que acuerda por WhatsApp.
drop policy if exists "dinero lee pagos" on pagos;
create policy "dinero lee pagos" on pagos for select using (tiene_algun_rol('{direccion,admin,recepcion}'));

-- ---------- 10. Una reserva apartada con un abono no se libera sola ----------
-- Con la regla del 100 %, un grupo puede abonar y completar después. Si ya pagó algo,
-- sus fechas no vencen a las 24 horas: el equipo decide (completar o devolver).
create or replace function liberar_vencidas() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update reservas set estado = 'vencida'
  where estado = 'pre' and vence_en is not null and vence_en < now() and pagado = 0;
  get diagnostics n = row_count; return n;
end $$;
revoke execute on function liberar_vencidas() from public, anon;
grant execute on function liberar_vencidas() to authenticated;

-- =====================================================================
--  Parte 3 · «Reserva pagada» en un solo paso
--    Para cuando el cliente ya acordó por WhatsApp y pagó el 100 %: crea (o reusa)
--    el huésped, crea la reserva y registra el pago, todo en una sola transacción.
--    Si algo falla (fechas ocupadas, falta el comprobante, no llega al 100 %),
--    no queda nada a medias.
--
--    p_id lo genera el panel para poder subir antes el comprobante a «p_id/…».
--    p trae: nombre, telefono, email, idioma, plan, personas, mascota, llegada, salida,
--            canal, notas, y el pago igual que registrar_pago (monto, metodo, moneda,
--            monto_original, tasa, referencia, comprobante, efectivo_lo_tiene, total, concepto).
-- =====================================================================
create or replace function crear_reserva_pagada(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  nom  text := left(regexp_replace(trim(coalesce(p->>'nombre','')), '\s+', ' ', 'g'), 120);
  tel  text := left(trim(coalesce(p->>'telefono','')), 40);
  mail text := lower(left(trim(coalesce(p->>'email','')), 160));
  n    text := right(regexp_replace(tel, '\D', '', 'g'), 10);
  lleg date := nullif(p->>'llegada','')::date;
  sal  date := nullif(p->>'salida','')::date;
  per  int  := coalesce(nullif(p->>'personas','')::int, 0);
  h uuid; res jsonb;
begin
  if not tiene_algun_rol('{direccion,admin,recepcion}') then raise exception 'Tu rol no puede registrar reservas pagadas'; end if;
  if length(nom) < 2 then raise exception 'Escribe el nombre del cliente'; end if;
  if length(n) < 7 then raise exception 'Escribe el WhatsApp del cliente'; end if;
  if mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Escribe un correo válido: ahí le llega su código y su comprobante'; end if;
  if lleg is null or sal is null then raise exception 'Elige la fecha de llegada y la de salida'; end if;
  if sal <= lleg then raise exception 'La salida tiene que ser después de la llegada'; end if;
  if lleg < current_date then raise exception 'La llegada no puede ser en el pasado'; end if;
  if per < 1 or per > 12 then raise exception 'Las personas van de 1 a 12'; end if;
  if exists (select 1 from reservas where id = p_id) then raise exception 'Esta reserva ya se guardó'; end if;
  if exists (select 1 from bloqueos b where b.desde < sal and lleg < b.hasta) then raise exception 'La casa está bloqueada en esas fechas'; end if;
  if exists (select 1 from reservas r where r.estado in ('pre','confirmada','casa') and r.llegada < sal and lleg < r.salida) then
    raise exception 'Esas fechas ya están ocupadas por otra reserva. Revisa el calendario';
  end if;

  -- El mismo cliente no se duplica: se busca por teléfono y luego por correo.
  select id into h from huespedes where tel_norm = n order by creado limit 1;
  if h is null then select id into h from huespedes where lower(email) = mail order by creado limit 1; end if;
  if h is null then
    insert into huespedes (nombre, telefono, email) values (nom, tel, mail) returning id into h;
  else
    update huespedes set email = case when coalesce(email, '') = '' then mail else email end,
                         telefono = case when coalesce(telefono, '') = '' then tel else telefono end
    where id = h;
  end if;

  insert into reservas (id, huesped_id, plan, personas, mascota, llegada, salida, estado, canal, idioma, notas)
  values (p_id, h, (p->>'plan')::plan_estadia, per, coalesce((p->>'mascota')::boolean, false), lleg, sal, 'conversacion',
          left(coalesce(nullif(p->>'canal',''), 'WhatsApp'), 40), case when p->>'idioma' = 'en' then 'en' else 'es' end,
          left(coalesce(p->>'notas',''), 1000));

  res := registrar_pago(p_id, p);
  if not coalesce((res->>'confirmada')::boolean, false) then
    raise exception 'Una reserva pagada necesita el 100 %%. Faltan $%. Si el cliente abonó una parte, anótala con «Nueva reserva» y registra el pago ahí.', res->>'falta';
  end if;
  return res || jsonb_build_object('id', p_id);
end $$;
revoke execute on function crear_reserva_pagada(uuid, jsonb) from public, anon;
grant execute on function crear_reserva_pagada(uuid, jsonb) to authenticated;

-- =====================================================================
--  Parte 4 · Roles
--    Recepción vuelve como «Recepción y reservas»: la persona del WhatsApp,
--    que cotiza, cobra y recibe (ya tenía permisos en la base de datos).
--    Administración ve y supervisa todo el panel, igual que Dirección.
-- =====================================================================
drop policy if exists "equipo edita huespedes" on huespedes;
create policy "equipo edita huespedes" on huespedes for update
  using (tiene_algun_rol('{direccion,admin,recepcion,cocina,servicio,calidad}'));
drop policy if exists "equipo anota acompanantes" on acompanantes;
create policy "equipo anota acompanantes" on acompanantes for all
  using (tiene_algun_rol('{direccion,admin,recepcion,cocina,servicio,calidad}'))
  with check (tiene_algun_rol('{direccion,admin,recepcion,cocina,servicio,calidad}'));
drop policy if exists "area marca tareas" on tareas;
create policy "area marca tareas" on tareas for update using (
  tiene_algun_rol('{direccion,admin,recepcion,operaciones,calidad}') or tiene_rol(area::text::rol_equipo));

-- =====================================================================
--  Parte 5 · Cotizaciones con código
--    Al descargar el presupuesto se guarda con un código (COT-48K2) que va
--    impreso en el PDF y vale 7 días. Al cobrar, ese código dice cuánto se
--    tiene que cobrar. Una cotización guardada no se edita ni se borra.
-- =====================================================================
create table if not exists cotizaciones (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,
  nombre      text not null,
  llegada     date,
  salida      date,
  noches      int  not null check (noches between 1 and 60),
  personas    int  check (personas between 0 and 12),
  totales     jsonb not null,             -- {"esencial": 540, "plena": 720}: uno o los dos paquetes
  detalle     jsonb not null default '[]', -- las noches con su precio, tal como salieron en el PDF
  vence       date not null default (current_date + 7),
  reserva_id  uuid references reservas(id) on delete set null,
  creado_por  uuid default auth.uid() references perfiles(id) on delete set null,
  creada      timestamptz not null default now()
);
create index if not exists cotizaciones_reserva on cotizaciones (reserva_id);
alter table cotizaciones enable row level security;
drop policy if exists "cobro lee cotizaciones" on cotizaciones;
create policy "cobro lee cotizaciones" on cotizaciones for select using (tiene_algun_rol('{direccion,admin,recepcion}'));
-- Sin políticas de insert, update ni delete: solo se crean con guardar_cotizacion().

create or replace function nuevo_codigo_cotizacion() returns text
language plpgsql volatile set search_path = public as $$
declare abc constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; b bytea; c text; i int;
begin
  loop
    b := uuid_send(gen_random_uuid()); c := 'COT-';
    for i in 0..3 loop c := c || substr(abc, 1 + (get_byte(b, i) % 31), 1); end loop;
    exit when not exists (select 1 from cotizaciones where codigo = c);
  end loop;
  return c;
end $$;
revoke execute on function nuevo_codigo_cotizacion() from public, anon, authenticated;

-- p: nombre, llegada?, salida?, noches, personas, totales {esencial?, plena?}, detalle, reserva_id?
create or replace function guardar_cotizacion(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c cotizaciones; k text; v numeric;
begin
  if not tiene_algun_rol('{direccion,admin,recepcion}') then raise exception 'Tu rol no puede hacer cotizaciones'; end if;
  if length(trim(coalesce(p->>'nombre',''))) < 2 then raise exception 'Escribe para quién es la cotización'; end if;
  if coalesce(nullif(p->>'noches','')::int, 0) < 1 then raise exception 'Revisa las noches de la cotización'; end if;
  if jsonb_typeof(p->'totales') <> 'object' or (select count(*) from jsonb_object_keys(p->'totales')) = 0 then raise exception 'La cotización no tiene total'; end if;
  for k, v in select key, value::numeric from jsonb_each_text(p->'totales') loop
    if k not in ('esencial','plena') then raise exception 'Paquete desconocido: %', k; end if;
    if v is null or v <= 0 then raise exception 'Falta el precio de alguna noche'; end if;
  end loop;
  insert into cotizaciones (codigo, nombre, llegada, salida, noches, personas, totales, detalle, reserva_id)
  values (nuevo_codigo_cotizacion(), left(trim(p->>'nombre'), 120), nullif(p->>'llegada','')::date, nullif(p->>'salida','')::date,
          (p->>'noches')::int, nullif(p->>'personas','')::int, p->'totales', coalesce(p->'detalle', '[]'),
          nullif(p->>'reserva_id','')::uuid)
  returning * into c;
  return jsonb_build_object('codigo', c.codigo, 'vence', c.vence);
end $$;
revoke execute on function guardar_cotizacion(jsonb) from public, anon;
grant execute on function guardar_cotizacion(jsonb) to authenticated;

-- =====================================================================
--  Parte 6 · El cobro tiene que coincidir con la cotización
--    Cada pago lleva el código de su cotización. Si todo coincide, se registra.
--    Si algo no coincide (sin cotización, vencida, otras fechas, otro paquete u
--    otro monto), el pago NO se registra: queda en espera con su motivo hasta
--    que Administración o Dirección lo apruebe. Quien lo pidió no puede
--    aprobarlo (salvo Dirección).
--    Esta parte reemplaza registrar_pago y crear_reserva_pagada de las partes 2 y 3.
-- =====================================================================
alter table pagos    add column if not exists cotizacion_id uuid references cotizaciones(id) on delete set null;
alter table reservas add column if not exists cotizacion_id uuid references cotizaciones(id) on delete set null;
grant select (cotizacion_id) on reservas to authenticated;

create table if not exists aprobaciones (
  id             uuid primary key default gen_random_uuid(),
  reserva_id     uuid not null references reservas(id) on delete cascade,
  cotizacion_id  uuid references cotizaciones(id) on delete set null,
  pago           jsonb not null,                 -- el pago tal como se quiso registrar
  diferencias    text[] not null,                -- sin_cotizacion, vencida, fechas, paquete, monto
  detalle        text not null default '',       -- qué no coincide, en palabras
  motivo         text not null,                  -- por qué, según quien cobró
  estado         text not null default 'pendiente' check (estado in ('pendiente','aprobada','rechazada')),
  pedida_por     uuid default auth.uid() references perfiles(id) on delete set null,
  pedida_en      timestamptz not null default now(),
  resuelta_por   uuid references perfiles(id) on delete set null,
  resuelta_en    timestamptz,
  nota           text not null default ''
);
create index if not exists aprobaciones_estado on aprobaciones (estado, pedida_en);
alter table aprobaciones enable row level security;
drop policy if exists "cobro lee aprobaciones" on aprobaciones;
create policy "cobro lee aprobaciones" on aprobaciones for select using (tiene_algun_rol('{direccion,admin,recepcion}'));

-- ---------- Aplica un pago ya revisado (uso interno) ----------
create or replace function aplicar_pago(p_reserva uuid, p jsonb, p_cot uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r reservas;
  metodos constant text[] := '{Transferencia,"Pago móvil",Zelle,"Binance (USDT)","Efectivo USD","Efectivo Bs"}';
  met   text := trim(coalesce(p->>'metodo',''));
  mon   text := coalesce(nullif(p->>'moneda',''), 'USD');
  orig  numeric := nullif(p->>'monto_original','')::numeric;
  tasa  numeric := nullif(p->>'tasa','')::numeric;
  usd   numeric := nullif(p->>'monto','')::numeric;
  ref   text := left(trim(coalesce(p->>'referencia','')), 80);
  comp  text := trim(coalesce(p->>'comprobante',''));
  quien text := left(trim(coalesce(p->>'efectivo_lo_tiene','')), 80);
  tot   numeric := nullif(p->>'total','')::numeric;
  efectivo boolean := met like 'Efectivo%';
  nuevo_pagado numeric; confirma boolean := false;
begin
  select * into r from reservas where id = p_reserva for update;
  if not found then raise exception 'Reserva no encontrada'; end if;
  if r.estado in ('rechazada','vencida','cancelada') then raise exception 'Esta solicitud ya está cerrada. Revisa las fechas y créala de nuevo'; end if;
  if met in ('Pago móvil','Efectivo Bs') then mon := 'Bs'; end if;
  if met in ('Zelle','Binance (USDT)','Efectivo USD') then mon := 'USD'; end if;
  if mon = 'Bs' then usd := round(orig / tasa, 2); else orig := usd; tasa := null; end if;
  if efectivo then ref := ''; end if;

  if tot is not null then update reservas set total = tot where id = p_reserva; r.total := tot; end if;
  if p_cot is not null then
    update reservas set cotizacion_id = p_cot where id = p_reserva;
    update cotizaciones set reserva_id = p_reserva where id = p_cot and reserva_id is null;
  end if;

  begin
    insert into pagos (reserva_id, monto, metodo, tipo, moneda, monto_original, tasa, referencia, comprobante_path, efectivo_lo_tiene, cotizacion_id, creado_por)
    values (p_reserva, usd, met, case when r.pagado > 0 then 'Pago final' else 'Pago' end, mon, orig, tasa, ref, comp, quien, p_cot,
            coalesce(nullif(p->>'cobrado_por','')::uuid, auth.uid()));
  exception when unique_violation then
    raise exception 'Esa referencia ya está registrada en otro pago con %. Revisa que no sea el mismo pago.', met;
  end;

  nuevo_pagado := r.pagado + usd;
  update reservas set pagado = nuevo_pagado,
    concepto = coalesce(nullif(left(trim(coalesce(p->>'concepto','')), 200), ''), concepto)
  where id = p_reserva;
  if r.estado in ('nueva','conversacion','pre') and nuevo_pagado >= r.total then
    perform cambiar_estado(p_reserva, 'confirmada'); confirma := true;
  end if;
  select * into r from reservas where id = p_reserva;
  return jsonb_build_object('confirmada', confirma, 'localizador', r.localizador,
    'pagado', r.pagado, 'total', r.total, 'falta', greatest(r.total - r.pagado, 0));
end $$;
revoke execute on function aplicar_pago(uuid, jsonb, uuid) from public, anon, authenticated;

-- ---------- Revisa el pago (campos y cotización) y lo aplica o lo deja en espera ----------
-- p: lo de antes + cotizacion (código COT-XXXX) + motivo (si algo no coincide).
-- Devuelve lo de aplicar_pago, o { pendiente: true, aprobacion, diferencias, detalle }.
create or replace function registrar_pago(p_reserva uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r reservas; c cotizaciones;
  metodos constant text[] := '{Transferencia,"Pago móvil",Zelle,"Binance (USDT)","Efectivo USD","Efectivo Bs"}';
  met  text := trim(coalesce(p->>'metodo',''));
  mon  text := coalesce(nullif(p->>'moneda',''), 'USD');
  orig numeric := nullif(p->>'monto_original','')::numeric;
  tasa numeric := nullif(p->>'tasa','')::numeric;
  usd  numeric := nullif(p->>'monto','')::numeric;
  ref  text := trim(coalesce(p->>'referencia',''));
  comp text := trim(coalesce(p->>'comprobante',''));
  quien text := trim(coalesce(p->>'efectivo_lo_tiene',''));
  tot  numeric := nullif(p->>'total','')::numeric;
  cod  text := upper(regexp_replace(coalesce(p->>'cotizacion',''), '\s', '', 'g'));
  mot  text := left(trim(coalesce(p->>'motivo','')), 500);
  efectivo boolean := met like 'Efectivo%';
  dif text[] := '{}'; det text[] := '{}'; cot_total numeric; a uuid;
begin
  if not tiene_algun_rol('{direccion,admin,recepcion}') then raise exception 'Tu rol no puede registrar pagos'; end if;
  -- «cobrado_por» solo lo pone esta función al dejar un cobro en espera; nunca se acepta del panel.
  p := p - 'cobrado_por';
  select * into r from reservas where id = p_reserva;
  if not found then raise exception 'Reserva no encontrada'; end if;
  if r.estado in ('rechazada','vencida','cancelada') then raise exception 'Esta solicitud ya está cerrada. Revisa las fechas y créala de nuevo'; end if;

  -- Los datos del pago
  if not (met = any(metodos)) then raise exception 'Elige cómo pagó'; end if;
  if met in ('Pago móvil','Efectivo Bs') then mon := 'Bs'; end if;
  if met in ('Zelle','Binance (USDT)','Efectivo USD') then mon := 'USD'; end if;
  if mon = 'Bs' then
    if orig is null or orig <= 0 then raise exception 'Escribe el monto en bolívares'; end if;
    if tasa is null or tasa <= 0 then raise exception 'Escribe la tasa del día (Bs. por cada dólar)'; end if;
    usd := round(orig / tasa, 2);
  end if;
  if usd is null or usd <= 0 then raise exception 'El monto tiene que ser mayor que cero'; end if;
  if not efectivo and length(ref) < 4 then raise exception 'Escribe la referencia del pago'; end if;
  if efectivo and length(quien) < 2 then raise exception 'Anota quién tiene el dinero en efectivo'; end if;
  if comp = '' then raise exception '%', case when efectivo then 'Sube la foto del recibo firmado por el cliente' else 'Sube el comprobante del pago' end; end if;
  if comp not like p_reserva::text || '/%' then raise exception 'El comprobante no corresponde a esta reserva'; end if;
  if not efectivo and exists (select 1 from pagos where lower(metodo) = lower(met) and upper(regexp_replace(referencia, '[^A-Za-z0-9]', '', 'g')) = upper(regexp_replace(ref, '[^A-Za-z0-9]', '', 'g'))) then
    raise exception 'Esa referencia ya está registrada en otro pago con %. Revisa que no sea el mismo pago.', met;
  end if;
  if not efectivo and exists (select 1 from aprobaciones where estado = 'pendiente' and lower(pago->>'metodo') = lower(met)
      and upper(regexp_replace(coalesce(pago->>'referencia',''), '[^A-Za-z0-9]', '', 'g')) = upper(regexp_replace(ref, '[^A-Za-z0-9]', '', 'g'))) then
    raise exception 'Esa referencia ya está en un cobro que espera aprobación';
  end if;

  -- La cotización
  if cod = '' and r.cotizacion_id is not null then select * into c from cotizaciones where id = r.cotizacion_id;
  elsif cod <> '' then
    select * into c from cotizaciones where codigo = cod;
    if not found then raise exception 'No existe la cotización %. Revisa el código', cod; end if;
  end if;
  if c.id is null then
    dif := array_append(dif, 'sin_cotizacion'); det := array_append(det, 'No tiene cotización');
  else
    if c.vence < current_date and r.cotizacion_id is distinct from c.id then dif := array_append(dif, 'vencida'); det := array_append(det, format('La cotización %s venció el %s', c.codigo, to_char(c.vence, 'DD/MM'))); end if;
    if c.llegada is not null and (c.llegada <> r.llegada or c.salida <> r.salida) then
      dif := array_append(dif, 'fechas'); det := array_append(det, format('La cotización es del %s al %s', to_char(c.llegada, 'DD/MM'), to_char(c.salida, 'DD/MM')));
    end if;
    cot_total := nullif(c.totales->>(r.plan::text), '')::numeric;
    if cot_total is null then dif := array_append(dif, 'paquete'); det := array_append(det, format('La cotización no incluye el plan %s', r.plan));
    else
      if tot is not null and tot <> cot_total then dif := array_append(dif, 'monto'); det := array_append(det, format('El total cotizado es $%s y se puso $%s', cot_total, tot)); end if;
      tot := coalesce(tot, cot_total);
      if r.pagado + usd > cot_total then dif := array_append(dif, 'monto'); det := array_append(det, format('Con este pago se cobraría $%s, más que los $%s cotizados', r.pagado + usd, cot_total)); end if;
    end if;
  end if;

  if cardinality(dif) = 0 then
    return aplicar_pago(p_reserva, p || jsonb_build_object('total', tot), c.id);
  end if;

  -- Algo no coincide: queda en espera.
  if length(mot) < 5 then raise exception 'El cobro no coincide con la cotización (%). Escribe el motivo para pedir la aprobación', array_to_string(det, '; '); end if;
  insert into aprobaciones (reserva_id, cotizacion_id, pago, diferencias, detalle, motivo)
  values (p_reserva, c.id, p || jsonb_build_object('total', tot, 'cobrado_por', auth.uid()), dif, array_to_string(det, '. '), mot)
  returning id into a;
  return jsonb_build_object('pendiente', true, 'aprobacion', a, 'diferencias', dif, 'detalle', array_to_string(det, '. '));
end $$;
revoke execute on function registrar_pago(uuid, jsonb) from public, anon;
grant execute on function registrar_pago(uuid, jsonb) to authenticated;

-- ---------- Aprobar o rechazar un cobro en espera ----------
create or replace function resolver_aprobacion(p_id uuid, p_aprobar boolean, p_nota text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare a aprobaciones; res jsonb := '{}';
begin
  if not tiene_algun_rol('{direccion,admin}') then raise exception 'Solo Administración y Dirección aprueban cobros'; end if;
  select * into a from aprobaciones where id = p_id for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if a.estado <> 'pendiente' then raise exception 'Esta solicitud ya fue %', a.estado; end if;
  if a.pedida_por = auth.uid() and not tiene_algun_rol('{direccion}') then raise exception 'No puedes aprobar un cobro que pediste tú'; end if;
  if not p_aprobar and length(trim(coalesce(p_nota,''))) < 3 then raise exception 'Escribe por qué se rechaza'; end if;
  if p_aprobar then res := aplicar_pago(a.reserva_id, a.pago, a.cotizacion_id); end if;
  update aprobaciones set estado = case when p_aprobar then 'aprobada' else 'rechazada' end,
    resuelta_por = auth.uid(), resuelta_en = now(), nota = left(trim(coalesce(p_nota,'')), 500)
  where id = p_id;
  return res || jsonb_build_object('estado', case when p_aprobar then 'aprobada' else 'rechazada' end, 'reserva', a.reserva_id);
end $$;
revoke execute on function resolver_aprobacion(uuid, boolean, text) from public, anon;
grant execute on function resolver_aprobacion(uuid, boolean, text) to authenticated;

-- ---------- «Reserva pagada» con la cotización (reemplaza la de la parte 3) ----------
create or replace function crear_reserva_pagada(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  nom  text := left(regexp_replace(trim(coalesce(p->>'nombre','')), '\s+', ' ', 'g'), 120);
  tel  text := left(trim(coalesce(p->>'telefono','')), 40);
  mail text := lower(left(trim(coalesce(p->>'email','')), 160));
  n    text := right(regexp_replace(tel, '\D', '', 'g'), 10);
  lleg date := nullif(p->>'llegada','')::date;
  sal  date := nullif(p->>'salida','')::date;
  per  int  := coalesce(nullif(p->>'personas','')::int, 0);
  h uuid; res jsonb;
begin
  if not tiene_algun_rol('{direccion,admin,recepcion}') then raise exception 'Tu rol no puede registrar reservas pagadas'; end if;
  if length(nom) < 2 then raise exception 'Escribe el nombre del cliente'; end if;
  if length(n) < 7 then raise exception 'Escribe el WhatsApp del cliente'; end if;
  if mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Escribe un correo válido: ahí le llega su código y su comprobante'; end if;
  if lleg is null or sal is null then raise exception 'Elige la fecha de llegada y la de salida'; end if;
  if sal <= lleg then raise exception 'La salida tiene que ser después de la llegada'; end if;
  if lleg < current_date then raise exception 'La llegada no puede ser en el pasado'; end if;
  if per < 1 or per > 12 then raise exception 'Las personas van de 1 a 12'; end if;
  if exists (select 1 from reservas where id = p_id) then raise exception 'Esta reserva ya se guardó'; end if;
  if exists (select 1 from bloqueos b where b.desde < sal and lleg < b.hasta) then raise exception 'La casa está bloqueada en esas fechas'; end if;
  if exists (select 1 from reservas r where r.estado in ('pre','confirmada','casa') and r.llegada < sal and lleg < r.salida) then
    raise exception 'Esas fechas ya están ocupadas por otra reserva. Revisa el calendario';
  end if;

  -- El mismo cliente no se duplica: se busca por teléfono y luego por correo.
  select id into h from huespedes where tel_norm = n order by creado limit 1;
  if h is null then select id into h from huespedes where lower(email) = mail order by creado limit 1; end if;
  if h is null then
    insert into huespedes (nombre, telefono, email) values (nom, tel, mail) returning id into h;
  else
    update huespedes set email = case when coalesce(email, '') = '' then mail else email end,
                         telefono = case when coalesce(telefono, '') = '' then tel else telefono end
    where id = h;
  end if;

  insert into reservas (id, huesped_id, plan, personas, mascota, llegada, salida, estado, canal, idioma, notas)
  values (p_id, h, (p->>'plan')::plan_estadia, per, coalesce((p->>'mascota')::boolean, false), lleg, sal, 'conversacion',
          left(coalesce(nullif(p->>'canal',''), 'WhatsApp'), 40), case when p->>'idioma' = 'en' then 'en' else 'es' end,
          left(coalesce(p->>'notas',''), 1000));

  res := registrar_pago(p_id, p);
  -- Si el cobro no coincide con la cotización, la reserva queda en conversación y el pago en espera.
  if coalesce((res->>'pendiente')::boolean, false) then return res || jsonb_build_object('id', p_id); end if;
  if not coalesce((res->>'confirmada')::boolean, false) then
    raise exception 'Una reserva pagada necesita el 100 %%. Faltan $%. Si el cliente abonó una parte, anótala con «Nueva reserva» y registra el pago ahí.', res->>'falta';
  end if;
  return res || jsonb_build_object('id', p_id);
end $$;
revoke execute on function crear_reserva_pagada(uuid, jsonb) from public, anon;
grant execute on function crear_reserva_pagada(uuid, jsonb) to authenticated;

-- =====================================================================
--  Parte 7 · Bitácora que nadie puede borrar (historial de cada cliente)
--    La base de datos anota sola cada cambio importante: reservas, pagos,
--    cotizaciones, cobros en espera y datos del cliente. Quién, cuándo, qué
--    había antes y qué quedó. Solo Dirección la lee. Nadie la puede editar
--    ni borrar desde el panel: no tiene políticas de escritura.
-- =====================================================================
create table if not exists bitacora (
  id          bigint generated always as identity primary key,
  tabla       text not null,
  registro    uuid,
  reserva_id  uuid,              -- sin llave foránea a propósito: el historial sobrevive aunque se borre la reserva
  huesped_id  uuid,
  accion      text not null,     -- insert, update, delete
  cambios     jsonb not null default '{}',
  quien       uuid default auth.uid(),
  cuando      timestamptz not null default now()
);
create index if not exists bitacora_huesped on bitacora (huesped_id, cuando desc);
create index if not exists bitacora_reserva on bitacora (reserva_id, cuando desc);
alter table bitacora enable row level security;
drop policy if exists "direccion lee bitacora" on bitacora;
create policy "direccion lee bitacora" on bitacora for select using (tiene_algun_rol('{direccion}'));
revoke insert, update, delete, truncate on bitacora from anon, authenticated;

-- Los argumentos del trigger son los campos que se vigilan en esa tabla.
create or replace function anotar_bitacora() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  fila jsonb := coalesce(n, o); campo text; cam jsonb := '{}'; res uuid; hue uuid;
begin
  -- El documento de identidad no se copia a la bitácora: solo queda anotado si había uno y si cambió.
  if (o ? 'documento') or (n ? 'documento') then
    if coalesce(o->>'documento','') is distinct from coalesce(n->>'documento','') and o is not null and n is not null then
      o := jsonb_set(o, '{documento}', to_jsonb(case when coalesce(o->>'documento','') = '' then 'vacío' else 'anterior' end));
      n := jsonb_set(n, '{documento}', to_jsonb(case when coalesce(n->>'documento','') = '' then 'vacío' else 'nuevo' end));
    else
      if o ? 'documento' then o := jsonb_set(o, '{documento}', to_jsonb(case when coalesce(o->>'documento','') = '' then '' else 'anotado' end)); end if;
      if n ? 'documento' then n := jsonb_set(n, '{documento}', to_jsonb(case when coalesce(n->>'documento','') = '' then '' else 'anotado' end)); end if;
    end if;
  end if;
  fila := coalesce(n, o);
  if tg_op = 'UPDATE' then
    foreach campo in array tg_argv loop
      if (o -> campo) is distinct from (n -> campo) then
        cam := cam || jsonb_build_object(campo, jsonb_build_array(o -> campo, n -> campo));
      end if;
    end loop;
    if cam = '{}'::jsonb then return null; end if;
  else
    foreach campo in array tg_argv loop cam := cam || jsonb_build_object(campo, fila -> campo); end loop;
  end if;
  res := case tg_table_name when 'reservas' then (fila->>'id')::uuid else nullif(fila->>'reserva_id', '')::uuid end;
  hue := case tg_table_name when 'huespedes' then (fila->>'id')::uuid when 'reservas' then (fila->>'huesped_id')::uuid end;
  if hue is null and res is not null then select huesped_id into hue from reservas where id = res; end if;
  insert into bitacora (tabla, registro, reserva_id, huesped_id, accion, cambios)
  values (tg_table_name, (fila->>'id')::uuid, res, hue, lower(tg_op), cam);
  return null;
end $$;
revoke execute on function anotar_bitacora() from public, anon, authenticated;

drop trigger if exists bitacora_reservas on reservas;
create trigger bitacora_reservas after insert or update or delete on reservas for each row
  execute function anotar_bitacora('estado','llegada','salida','plan','personas','total','pagado','canal','huesped_id','cotizacion_id','localizador');
drop trigger if exists bitacora_pagos on pagos;
create trigger bitacora_pagos after insert or update or delete on pagos for each row
  execute function anotar_bitacora('monto','metodo','moneda','monto_original','tasa','referencia','efectivo_lo_tiene','comprobante_path','creado_por');
drop trigger if exists bitacora_cotizaciones on cotizaciones;
create trigger bitacora_cotizaciones after insert or update or delete on cotizaciones for each row
  execute function anotar_bitacora('codigo','nombre','llegada','salida','totales','vence','reserva_id');
drop trigger if exists bitacora_aprobaciones on aprobaciones;
create trigger bitacora_aprobaciones after insert or update or delete on aprobaciones for each row
  execute function anotar_bitacora('estado','detalle','motivo','nota','pedida_por','resuelta_por');
drop trigger if exists bitacora_huespedes on huespedes;
create trigger bitacora_huespedes after insert or update or delete on huespedes for each row
  execute function anotar_bitacora('nombre','telefono','email','documento');

-- =====================================================================
--  Parte 8 · Tiempo real: el panel se entera al momento de cotizaciones y
--  cobros en espera (como con las reservas, ver 0002).
-- =====================================================================
do $$ begin
  alter publication supabase_realtime add table cotizaciones;
exception when duplicate_object or undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table aprobaciones;
exception when duplicate_object or undefined_object then null; end $$;
