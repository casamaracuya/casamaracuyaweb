-- =====================================================================
--  Casa Maracuyá · 0011: permisos del organigrama y semáforo de calidad (parte 2 de 2)
--  Correr DESPUÉS de 0010_roles_organigrama.sql. Se puede volver a correr.
--
--  Quién hace qué (ver «Desglose de funciones por miembro del equipo»):
--    direccion     CEO & Founder: vende, cobra, ficha del huésped, tarifas, recibe auditorías.
--    admin         Administración y Finanzas (Faby): ingresos y pagos.
--    operaciones   Robert: check-in/check-out, técnica, logística y compras, supervisa al equipo.
--    mantenimiento Gabriel: áreas verdes, piscina, bombas, tanques y caminería.
--    cocina        Victoria: menús, compras de cocina, alergias.
--    servicio      Odely: bienvenida, mesa, apoyo en el tendido de camas.
--    calidad       Yanely: semáforo de calidad, vasos Yeti, apoyo en sala y camas.
--    limpieza      Zai: limpieza profunda, tendido de camas, lencería y patrimonio.
-- =====================================================================

-- ---------- Huéspedes: quienes atienden pueden anotar gustos y alergias ----------
drop policy if exists "equipo edita huespedes" on huespedes;
create policy "equipo edita huespedes" on huespedes for update
  using (tiene_algun_rol('{direccion,recepcion,cocina,servicio,calidad}'));
drop policy if exists "equipo anota acompanantes" on acompanantes;
create policy "equipo anota acompanantes" on acompanantes for all
  using (tiene_algun_rol('{direccion,recepcion,cocina,servicio,calidad}'))
  with check (tiene_algun_rol('{direccion,recepcion,cocina,servicio,calidad}'));

-- ---------- Tareas: Operaciones y Calidad supervisan las de todas las áreas ----------
drop policy if exists "area marca tareas" on tareas;
create policy "area marca tareas" on tareas for update using (
  tiene_algun_rol('{direccion,recepcion,operaciones,calidad}') or tiene_rol(area::text::rol_equipo));

-- ---------- La casa ----------
-- Habitaciones: el tendido de camas es de Zai, Odely y Yanely; Robert supervisa.
drop policy if exists "limpieza mueve habitaciones" on habitaciones;
create policy "limpieza mueve habitaciones" on habitaciones for update
  using (tiene_algun_rol('{direccion,limpieza,servicio,calidad,operaciones}'));
create or replace function siguiente_estado_habitacion(p_id text) returns estado_hab
language plpgsql security definer set search_path = public as $$
declare e estado_hab;
begin
  if not tiene_algun_rol('{direccion,limpieza,servicio,calidad,operaciones}') then raise exception 'Tu rol no cambia el estado de las habitaciones'; end if;
  update habitaciones set estado = case estado when 'sucia' then 'limpiando' when 'limpiando' then 'lista' when 'lista' then 'revisada' else 'sucia' end::estado_hab
  where id = p_id returning estado into e;
  return e;
end $$;
-- Afuera y fechas bloqueadas: Gabriel y Robert.
drop policy if exists "mantenimiento exteriores" on exteriores;
create policy "mantenimiento exteriores" on exteriores for update using (tiene_algun_rol('{direccion,mantenimiento,operaciones}'));
drop policy if exists "mantenimiento crea bloqueos" on bloqueos;
create policy "mantenimiento crea bloqueos" on bloqueos for insert with check (tiene_algun_rol('{direccion,mantenimiento,operaciones}'));
drop policy if exists "mantenimiento borra bloqueos" on bloqueos;
create policy "mantenimiento borra bloqueos" on bloqueos for delete using (tiene_algun_rol('{direccion,mantenimiento,operaciones}'));

-- ---------- Compras: Victoria arma la lista y Robert hace la logística ----------
drop policy if exists "cocina crea compras" on compras;
create policy "cocina crea compras" on compras for insert with check (tiene_algun_rol('{direccion,cocina,operaciones}'));
drop policy if exists "cocina edita compras" on compras;
create policy "cocina edita compras" on compras for update using (tiene_algun_rol('{direccion,cocina,operaciones}'));

-- ---------- Reservas: Robert recibe y despide (check-in / check-out) ----------
-- Solo Dirección (y Administración con los pagos) vende y mueve el resto de los estados.
create or replace function cambiar_estado(p_reserva uuid, p_estado estado_reserva) returns void
language plpgsql security definer set search_path = public as $$
declare r reservas; g huespedes; prep date; hora text;
begin
  if not (tiene_algun_rol('{direccion,recepcion,admin}')
          or (tiene_rol('operaciones') and p_estado in ('casa','finalizada'))) then
    raise exception 'No tienes permiso para mover reservas';
  end if;
  select * into r from reservas where id = p_reserva for update;
  if not found then raise exception 'Reserva no encontrada'; end if;
  select * into g from huespedes where id = r.huesped_id;
  if exists (select 1 from bloqueos b where b.desde < r.salida and r.llegada < b.hasta) and p_estado in ('pre','confirmada') then
    raise exception 'La casa está bloqueada en esas fechas';
  end if;

  update reservas set estado = p_estado,
    vence_en = case when p_estado = 'pre' then now() + interval '24 hours' else null end
  where id = p_reserva;   -- si choca con otra reserva activa, la restricción sin_doble_reserva lo impide

  if p_estado = 'pre' then
    insert into tareas (area, titulo, reserva_id, para) values ('admin', 'Confirmar el pago de ' || g.nombre, r.id, current_date);
  elsif p_estado = 'confirmada' then
    prep := greatest(current_date, r.llegada - 1);
    hora := coalesce(nullif(r.hora_llegada, ''), '3:00 PM');
    insert into tareas (area, titulo, reserva_id, para, hora) values
      ('direccion', 'Pasar al panel la ficha de registro de ' || g.nombre || ' (grupo, vehículos, alergias)', r.id, current_date, ''),
      ('cocina', 'Menú para ' || g.nombre, r.id, greatest(current_date, r.llegada - 7), ''),
      ('operaciones', 'Planta eléctrica, agua dulce y calentadores listos', r.id, prep, ''),
      ('mantenimiento', 'Piscina, jardín y caminería sin salitre antes de la llegada', r.id, prep, ''),
      ('limpieza', 'Preparar habitaciones y tendido de camas para ' || r.personas || ' (con Servicio y Calidad)', r.id, prep, ''),
      ('calidad', 'Revisión de detalle antes de la llegada de ' || g.nombre, r.id, prep, ''),
      ('servicio', 'Bienvenida, bebidas de cortesía y montaje de mesa', r.id, greatest(current_date, r.llegada), hora),
      ('operaciones', 'Recibir al grupo: recorrido, normas de seguridad y llaves', r.id, greatest(current_date, r.llegada), hora);
    update tareas set hecha = true where reserva_id = r.id and area = 'admin';
  elsif p_estado = 'casa' then
    insert into tareas (area, titulo, reserva_id, para) values
      ('calidad', 'Entregar los vasos Yeti y anotar cuántos', r.id, current_date);
  elsif p_estado = 'finalizada' then
    insert into tareas (area, titulo, reserva_id, para) values
      ('calidad', 'Contar los vasos Yeti antes de la salida', r.id, current_date),
      ('limpieza', 'Limpieza de salida, lavandería y revisión de lencería', r.id, current_date),
      ('operaciones', 'Revisión técnica de la casa después de la salida', r.id, current_date),
      ('calidad', 'Semáforo de calidad e informe de la estadía para la CEO', r.id, current_date),
      ('direccion', 'Enviar las gracias y el enlace de reseña a ' || g.nombre, r.id, current_date + 1);
    update huespedes set visitas = visitas + 1 where id = g.id;
  end if;
end $$;
revoke execute on function cambiar_estado(uuid, estado_reserva) from public, anon;
grant execute on function cambiar_estado(uuid, estado_reserva) to authenticated;

-- =====================================================================
--  Semáforo de calidad (lo aplica Yanely en cada estadía y lo lee la CEO)
--  Un registro por estadía y ámbito: verde, amarillo o rojo, con una nota.
--  Solo lo ven Dirección y Calidad: es una evaluación interna del equipo.
-- =====================================================================
create table if not exists auditorias (
  id          uuid primary key default gen_random_uuid(),
  reserva_id  uuid not null references reservas(id) on delete cascade,
  ambito      text not null check (ambito in ('tecnica','cocina','servicio','limpieza')),
  nivel       text not null check (nivel in ('verde','amarillo','rojo')),
  nota        text not null default '',
  por         uuid default auth.uid() references perfiles(id) on delete set null,
  creado      timestamptz not null default now(),
  unique (reserva_id, ambito)
);
alter table auditorias enable row level security;
drop policy if exists "calidad lee auditorias" on auditorias;
drop policy if exists "calidad escribe auditorias" on auditorias;
create policy "calidad lee auditorias" on auditorias for select using (tiene_algun_rol('{direccion,calidad}'));
create policy "calidad escribe auditorias" on auditorias for all
  using (tiene_algun_rol('{direccion,calidad}')) with check (tiene_algun_rol('{direccion,calidad}'));
do $$ begin
  alter publication supabase_realtime add table auditorias;
exception when duplicate_object then null; end $$;
