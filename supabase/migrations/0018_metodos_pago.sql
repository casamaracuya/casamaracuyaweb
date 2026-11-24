-- =====================================================================
--  Casa Maracuyá · 0018: cómo pagó, solo Zelle, Binance (USDT) y Efectivo USD
--  Correr después de 0017. Se puede volver a correr.
--
--  Ya no se aceptan Transferencia, Pago móvil ni Efectivo Bs. Los pagos que ya
--  estaban registrados con esos métodos no cambian, y un cobro en espera de
--  aprobación con un método anterior se puede seguir aprobando.
--  Es la misma función registrar_pago de 0017; solo cambia la lista de métodos.
-- =====================================================================

create or replace function registrar_pago(p_reserva uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r reservas; c cotizaciones;
  metodos constant text[] := '{Zelle,"Binance (USDT)","Efectivo USD"}';
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
