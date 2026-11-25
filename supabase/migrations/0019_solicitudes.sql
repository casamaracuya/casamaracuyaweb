-- =====================================================================
--  Casa Maracuyá · 0019: Solicitudes (SPEC-solicitudes.md)
--
--  Una solicitud es una reserva que todavía no está pagada (nueva, en
--  conversación o apartada). Esta migración suma:
--    · el estado «no_siguio» (el cliente no siguió), aparte de «rechazada» (sin cupo);
--    · las notas de la conversación de Recepción con el cliente, que no se editan ni se borran;
--    · que las solicitudes cuya llegada ya pasó se archiven solas.
--
--  Va DESPUÉS de 0017 y 0018 (la de los métodos de pago). Cómo correrlo: Supabase > SQL Editor > New query > pega todo > Run.
--  Se puede volver a correr sin romper nada.
-- =====================================================================

-- ---------- 1. Estado nuevo ----------
alter type estado_reserva add value if not exists 'no_siguio';

-- ---------- 2. La conversación ----------
create table if not exists conversaciones (
  id          uuid primary key default gen_random_uuid(),
  reserva_id  uuid not null references reservas(id) on delete cascade,
  texto       text not null check (length(trim(texto)) between 1 and 1000),
  autor       uuid default auth.uid() references perfiles(id) on delete set null,
  creada      timestamptz not null default now()
);
create index if not exists conversaciones_reserva on conversaciones (reserva_id, creada);
alter table conversaciones enable row level security;
drop policy if exists "ventas lee conversaciones" on conversaciones;
create policy "ventas lee conversaciones" on conversaciones for select
  using (tiene_algun_rol('{direccion,admin,recepcion}'));
drop policy if exists "ventas anota conversaciones" on conversaciones;
create policy "ventas anota conversaciones" on conversaciones for insert
  with check (tiene_algun_rol('{direccion,admin,recepcion}') and autor = auth.uid());
-- Sin políticas de update ni delete: una nota escrita queda fija.
revoke update, delete, truncate on conversaciones from anon, authenticated;

drop trigger if exists bitacora_conversaciones on conversaciones;
create trigger bitacora_conversaciones after insert or update or delete on conversaciones for each row
  execute function anotar_bitacora('texto','autor');

do $$ begin
  alter publication supabase_realtime add table conversaciones;
exception when duplicate_object or undefined_object then null; end $$;

-- ---------- 3. Se archivan solas ----------
-- Apartadas sin pago que pasaron sus 24 horas, y cualquier solicitud cuya llegada ya pasó.
create or replace function liberar_vencidas() returns int
language plpgsql security definer set search_path = public as $$
declare n int; m int;
begin
  update reservas set estado = 'vencida'
  where estado = 'pre' and vence_en is not null and vence_en < now() and pagado = 0;
  get diagnostics n = row_count;
  update reservas set estado = 'vencida'
  where estado in ('nueva','conversacion','pre') and llegada < current_date and pagado = 0;
  get diagnostics m = row_count;
  return n + m;
end $$;
revoke execute on function liberar_vencidas() from public, anon;
grant execute on function liberar_vencidas() to authenticated;

-- ---------- 4. Idioma de los mensajes al cliente ----------
-- Por defecto español; las solicitudes de la página en inglés llegan en inglés.
-- Recepción lo puede cambiar desde la reserva si hace falta.
create or replace function cambiar_idioma(p_reserva uuid, p_idioma text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tiene_algun_rol('{direccion,admin,recepcion}') then raise exception 'Tu rol no puede cambiar el idioma'; end if;
  if p_idioma not in ('es','en') then raise exception 'Idioma no válido'; end if;
  update reservas set idioma = p_idioma where id = p_reserva;
  if not found then raise exception 'Reserva no encontrada'; end if;
end $$;
revoke execute on function cambiar_idioma(uuid, text) from public, anon;
grant execute on function cambiar_idioma(uuid, text) to authenticated;
