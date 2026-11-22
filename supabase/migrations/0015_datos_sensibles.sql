-- =====================================================================
--  Casa Maracuyá · 0015: los datos personales solo llegan a quien los ve
--  Se puede volver a correr.
--
--  Antes, el panel descargaba el teléfono, el correo y la cédula de todos los
--  huéspedes para cualquier rol y solo los escondía en pantalla. Ahora la base de
--  datos no entrega esas columnas a nadie directamente; las da la función
--  datos_personales(), y solo a Dirección, Administración y Operaciones (los roles
--  que ya las ven en el panel). Los permisos para editar no cambian.
--
--  Columnas protegidas:
--    huespedes     telefono, tel_norm, email, documento
--    acompanantes  documento
--    reservas      ocupantes (la cédula de cada ocupante), comprobante_token, comprobante_correo
--
--  OJO: si agregas una columna nueva a huespedes, acompanantes o reservas, el equipo
--  no la podrá leer hasta que la sumes a su «grant select (...)» de abajo, y a la
--  lista de columnas de src/lib/api.js.
-- =====================================================================

-- Quién ve los datos personales (el mismo criterio que «phone» en src/admin/util.js)
create or replace function ve_datos_personales() returns boolean
language sql stable security definer set search_path = public as $$
  select tiene_algun_rol('{direccion,admin,operaciones,recepcion}');
$$;

-- ---------- Lectura por columnas ----------
revoke select on huespedes from anon, authenticated;
grant select (id, nombre, ciudad, alergias, gustos, mascota, celebra, kite, visitas, creado,
              cumple, no_le_gusta, notas)
  on huespedes to authenticated;

revoke select on acompanantes from anon, authenticated;
grant select (id, huesped_id, nombre, relacion, cumple, alergias, notas, creado, edad)
  on acompanantes to authenticated;

revoke select on reservas from anon, authenticated;
grant select (id, codigo, huesped_id, plan, personas, mascota, llegada, salida, estado, canal, idioma,
              total, pagado, notas, vence_en, creado,
              hora_llegada, adultos, ninos, vehiculos, bebidas, requerimientos, motivo,
              mascota_nombre, mascota_raza, ficha_firma, ficha_firmada, ficha_por, ficha_en,
              concepto, comprobante_enviado)
  on reservas to authenticated;

-- ---------- Los datos personales, solo para quien corresponde ----------
-- Al resto del equipo le devuelve los ocupantes de cada reserva sin la cédula
-- (nombre y edad sí, porque se muestran en la ficha de registro).
create or replace function datos_personales() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare ve boolean := ve_datos_personales();
begin
  if not es_equipo() then return null; end if;
  return jsonb_build_object(
    'huespedes', case when ve then coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'telefono', telefono, 'tel_norm', tel_norm, 'email', email, 'documento', documento)) from huespedes), '[]') else '[]' end,
    'acompanantes', case when ve then coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'documento', documento)) from acompanantes), '[]') else '[]' end,
    'reservas', coalesce((select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'ocupantes', case when ve then r.ocupantes
                     else coalesce((select jsonb_agg(o - 'documento') from jsonb_array_elements(r.ocupantes) o), '[]') end,
        'comprobante_token', case when ve then r.comprobante_token end,
        'comprobante_correo', case when ve then r.comprobante_correo else '' end)) from reservas r), '[]')
  );
end $$;
revoke all on function datos_personales() from public, anon;
grant execute on function datos_personales() to authenticated;
