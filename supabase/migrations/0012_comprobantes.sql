-- =====================================================================
--  Casa Maracuyá · 0012: comprobante de reserva y pago
--
--  Al confirmar una reserva (el pago que la confirma) se anotan el total acordado
--  y su concepto. El huésped recibe un enlace privado a su comprobante
--  (casa-maracuya.com/comprobante?c=<comprobante_token>) por correo, automáticamente,
--  y por WhatsApp con un botón del panel. Desde ahí lo puede guardar en PDF.
--
--  El comprobante NO es una factura fiscal: si el huésped la necesita, la emite
--  Administración en su sistema autorizado por el SENIAT.
--
--  Correr después de 0011. Se puede volver a correr.
-- =====================================================================

alter table reservas
  add column if not exists concepto              text not null default '',
  add column if not exists comprobante_token     uuid not null default gen_random_uuid(),
  add column if not exists comprobante_enviado   timestamptz,     -- último envío por correo
  add column if not exists comprobante_correo    text not null default '';
create unique index if not exists reservas_comprobante_token on reservas (comprobante_token);

-- ---------- Registrar un pago, con el total y el concepto de la estadía ----------
-- Reemplaza a registrar_pago(uuid, numeric, text). Si llegan p_total / p_concepto, se guardan.
drop function if exists registrar_pago(uuid, numeric, text);
create or replace function registrar_pago(p_reserva uuid, p_monto numeric, p_metodo text,
  p_total numeric default null, p_concepto text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r reservas;
begin
  if not tiene_algun_rol('{direccion,admin}') then raise exception 'Solo Dirección y Administración registran pagos'; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'El monto tiene que ser mayor que cero'; end if;
  if p_total is not null and p_total < 0 then raise exception 'El total no puede ser negativo'; end if;
  select * into r from reservas where id = p_reserva for update;
  if not found then raise exception 'Reserva no encontrada'; end if;
  insert into pagos (reserva_id, monto, metodo, tipo) values (p_reserva, p_monto, p_metodo, case when r.pagado > 0 then 'Pago final' else 'Pago' end);
  update reservas set pagado = pagado + p_monto,
    total    = coalesce(p_total, total),
    concepto = coalesce(left(trim(p_concepto), 200), concepto)
  where id = p_reserva;
  if r.estado = 'pre' then perform cambiar_estado(p_reserva, 'confirmada'); end if;
end $$;
revoke execute on function registrar_pago(uuid, numeric, text, numeric, text) from public, anon;
grant execute on function registrar_pago(uuid, numeric, text, numeric, text) to authenticated;

-- ---------- Corregir el total o el concepto sin registrar un pago ----------
create or replace function fijar_total(p_reserva uuid, p_total numeric, p_concepto text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tiene_algun_rol('{direccion,admin}') then raise exception 'Solo Dirección y Administración cambian el total'; end if;
  if p_total is null or p_total < 0 then raise exception 'Escribe un total válido'; end if;
  update reservas set total = p_total, concepto = left(trim(coalesce(p_concepto, '')), 200) where id = p_reserva;
  if not found then raise exception 'Reserva no encontrada'; end if;
end $$;
revoke execute on function fijar_total(uuid, numeric, text) from public, anon;
grant execute on function fijar_total(uuid, numeric, text) to authenticated;

-- ---------- Leer el comprobante con el enlace privado (lo usa la página pública) ----------
-- Solo reservas confirmadas, en casa o finalizadas. Devuelve lo que va impreso en el comprobante.
create or replace function leer_comprobante(p_token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'codigo', r.codigo, 'estado', r.estado, 'idioma', r.idioma, 'emitido', coalesce(
      (select min(p.fecha) from pagos p where p.reserva_id = r.id), r.creado::date),
    'llegada', r.llegada, 'salida', r.salida, 'personas', r.personas, 'plan', r.plan,
    'nombre', h.nombre, 'documento', h.documento,
    'concepto', r.concepto, 'total', r.total, 'pagado', r.pagado,
    'pagos', coalesce((select jsonb_agg(jsonb_build_object('fecha', p.fecha, 'metodo', p.metodo, 'monto', p.monto, 'tipo', p.tipo) order by p.fecha)
                       from pagos p where p.reserva_id = r.id), '[]'))
  from reservas r join huespedes h on h.id = r.huesped_id
  where r.comprobante_token = p_token and r.estado in ('confirmada','casa','finalizada');
$$;
revoke execute on function leer_comprobante(uuid) from public;
grant execute on function leer_comprobante(uuid) to anon, authenticated;
